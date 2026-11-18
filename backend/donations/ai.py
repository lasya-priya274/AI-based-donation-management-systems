"""AI layer: anomaly/fraud detection (Isolation Forest) and recommendations (TF-IDF)."""
import math
from collections import defaultdict
from decimal import Decimal

import numpy as np
from django.utils import timezone
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .models import Campaign, Donation

# ----------------------------------------------------------------- fraud ----
FLAG_THRESHOLD = 0.5
_model = {"clf": None, "trained_on": -1}


def _features(amount, ref_amount, velocity, age_days, goal):
    return [
        math.log1p(amount),
        math.log1p(amount / max(ref_amount, 1.0)),
        float(velocity),
        math.log1p(max(age_days, 0.0)),
        min(amount / max(goal, 1.0), 1.0),
    ]


def _synthetic_baseline(n=300, seed=0):
    """Typical behaviour so the model works from day one (cold start)."""
    rng = np.random.default_rng(seed)
    amt = rng.lognormal(mean=5.0, sigma=0.8, size=n)           # ~ 150 median
    ref = amt * rng.uniform(0.6, 1.6, size=n)
    vel = rng.choice([0, 0, 0, 1, 1, 2], size=n)
    age = rng.uniform(1, 400, size=n)
    goal = amt * rng.uniform(20, 400, size=n)
    return [_features(*r) for r in zip(amt, ref, vel, age, goal)]


def _history_rows(limit=1000):
    rows, prior = [], defaultdict(list)
    qs = (Donation.objects.select_related("donor", "campaign")
          .order_by("created_at")[:limit])
    for d in qs:
        amt = float(d.amount)
        hist = prior[d.donor_id]
        ref = sum(h[1] for h in hist) / len(hist) if hist else amt
        vel = sum(1 for h in hist if (d.created_at - h[0]).total_seconds() < 3600)
        age = (d.created_at - d.donor.date_joined).total_seconds() / 86400
        rows.append(_features(amt, ref, vel, age, float(d.campaign.goal_amount)))
        hist.append((d.created_at, amt))
    return rows


def _get_model():
    count = Donation.objects.count()
    if _model["clf"] is None or count - _model["trained_on"] >= 25:
        X = np.array(_synthetic_baseline() + _history_rows())
        _model["clf"] = IsolationForest(n_estimators=150, contamination=0.04, random_state=42).fit(X)
        _model["trained_on"] = count
    return _model["clf"]


def assess_donation(donor, campaign, amount):
    """Return (risk 0..1, reasons[]). Combines the ML anomaly score with explainable rules."""
    amount = float(amount)
    now = timezone.now()
    prior = list(Donation.objects.filter(donor=donor).values_list("amount", "created_at"))
    ref = sum(float(a) for a, _ in prior) / len(prior) if prior else amount
    velocity = sum(1 for _, t in prior if (now - t).total_seconds() < 3600)
    age = (now - donor.date_joined).total_seconds() / 86400
    goal = float(campaign.goal_amount)

    x = np.array([_features(amount, ref, velocity, age, goal)])
    d = float(_get_model().decision_function(x)[0])  # >0 normal, <0 anomalous
    risk = min(max(0.5 - 2.5 * d, 0.0), 1.0)

    reasons = []
    if prior and amount > 10 * ref and amount > 1000:
        reasons.append(f"Amount is {amount / ref:.0f}x this donor's average")
    if velocity >= 4:
        reasons.append(f"{velocity + 1} donations within one hour")
    if age < 1 and amount > 5000:
        reasons.append("Large donation from a brand-new account")
    if amount >= 0.5 * goal and amount > 5000:
        reasons.append("Single donation covers over half of campaign goal")
    if reasons:
        risk = max(risk, 0.6 + 0.1 * min(len(reasons), 3))
    if d < 0 and not reasons:
        reasons.append("Unusual pattern vs. historical donations (anomaly model)")
    return round(min(risk, 1.0), 3), reasons


# --------------------------------------------------------- recommendations ----
def recommend(user, k=6):
    campaigns = list(Campaign.objects.filter(active=True).select_related("ngo"))
    campaigns = [c for c in campaigns if c.raised_amount < c.goal_amount]
    if not campaigns:
        return []
    donor_counts = defaultdict(int)
    for cid in Donation.objects.filter(status="confirmed").values_list("campaign_id", flat=True):
        donor_counts[cid] += 1
    max_pop = max(donor_counts.values(), default=1) or 1

    all_ids = list(Campaign.objects.values_list("id", flat=True))
    texts = {c.id: f"{c.title} {c.category} {c.category} {c.description} {c.beneficiary} {c.ngo.name}"
             for c in Campaign.objects.select_related("ngo")}
    vec = TfidfVectorizer(stop_words="english").fit([texts[i] for i in all_ids])
    cmat = vec.transform([texts[c.id] for c in campaigns])

    history = list(Donation.objects.filter(donor=user, status="confirmed")
                   .values("campaign_id", "amount").order_by("-created_at")[:50]) if user.is_authenticated else []
    profile, anchors = None, []
    if history:
        w = np.array([math.log1p(float(h["amount"])) for h in history])
        hm = vec.transform([texts[h["campaign_id"]] for h in history])
        profile = np.asarray(hm.multiply(w[:, None]).sum(axis=0)) / w.sum()
        anchors = (hm, [h["campaign_id"] for h in history])
    sims = cosine_similarity(profile, cmat)[0] if profile is not None else np.zeros(len(campaigns))

    donated = {h["campaign_id"] for h in history}
    out = []
    for i, c in enumerate(campaigns):
        progress = float(c.raised_amount / c.goal_amount) if c.goal_amount else 1.0
        pop = donor_counts[c.id] / max_pop
        score = (0.65 if profile is not None else 0.0) * sims[i] + 0.2 * (1 - progress) + 0.15 * pop
        reason = "Trending with other donors" if profile is None else "Matches causes you support"
        if profile is not None and sims[i] > 0.05:
            sc = cosine_similarity(cmat[i], anchors[0])[0].copy()
            for j, aid in enumerate(anchors[1]):
                if aid == c.id:
                    sc[j] = -1  # never cite a campaign as similar to itself
            j = int(np.argmax(sc))
            if sc[j] > 0.05:
                ref = Campaign.objects.filter(pk=anchors[1][j]).values_list("title", flat=True).first()
                reason = f"Similar to “{ref}” which you supported"
            else:
                reason = "You've supported this cause before"
        elif progress < 0.3:
            reason = "Needs support — early in its funding"
        if c.id in donated:
            score *= 0.6
        out.append((score, c, reason))
    out.sort(key=lambda t: -t[0])
    return [{"campaign_id": c.id, "score": round(float(s), 3), "reason": r} for s, c, r in out[:k]]
