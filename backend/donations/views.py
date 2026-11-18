from datetime import timedelta
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Count, F, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import ai, ledger
from .models import NGO, Block, Campaign, Donation, Expenditure, Profile
from .permissions import (
    IsAdmin,
    IsDonor,
    IsDonorOrAdmin,
    IsNGO,
    IsNGOOrAdmin,
    IsAuthenticated as RBACAuthenticated,
)

MAX_DONATION = Decimal("1000000")


def err(msg, code=400):
    return Response({"error": msg}, status=code)


def access_denied(msg="You do not have permission to access this resource."):
    return Response({"error": msg, "code": "access_denied"}, status=403)


def role_of(user):
    if user.is_superuser:
        return "admin"
    p = getattr(user, "profile", None)
    return p.role if p else "donor"


def money(v):
    return str(Decimal(v).quantize(Decimal("0.01")))


def parse_amount(raw):
    try:
        a = Decimal(str(raw)).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        return None
    return a if 0 < a <= MAX_DONATION else None


# ------------------------------------------------------------ serializers ----
def s_user(u):
    d = {"id": u.id, "username": u.username, "email": u.email, "role": role_of(u)}
    if hasattr(u, "ngo"):
        d["ngo"] = {"id": u.ngo.id, "name": u.ngo.name, "verified": u.ngo.verified}
    return d


def s_user_admin(u):
    """Extended user serializer for admin views (includes more info)."""
    d = s_user(u)
    d["date_joined"] = u.date_joined
    d["is_active"] = u.is_active
    if hasattr(u, "ngo"):
        d["ngo"]["description"] = u.ngo.description
        d["ngo"]["location"] = u.ngo.location
        d["ngo"]["created_at"] = u.ngo.created_at
    return d


def s_campaign(c, detail=False):
    d = {
        "id": c.id, "title": c.title, "description": c.description, "category": c.category,
        "beneficiary": c.beneficiary, "goal_amount": money(c.goal_amount),
        "raised_amount": money(c.raised_amount), "spent_amount": money(c.spent_amount),
        "balance": money(c.balance), "active": c.active, "created_at": c.created_at,
        "ngo": {"id": c.ngo_id, "name": c.ngo.name, "verified": c.ngo.verified},
        "donor_count": c.donations.filter(status="confirmed").values("donor").distinct().count(),
    }
    if detail:
        d["expenditures"] = [s_exp(e) for e in c.expenditures.order_by("-created_at")]
        d["recent_donations"] = [
            {"amount": money(x.amount), "donor": ledger.pseudonym(x.donor_id),
             "tx_hash": x.tx_hash, "created_at": x.created_at}
            for x in c.donations.filter(status="confirmed").order_by("-created_at")[:15]]
    return d


def s_exp(e):
    return {"id": e.id, "amount": money(e.amount), "description": e.description,
            "tx_hash": e.tx_hash, "created_at": e.created_at}


def s_donation(d):
    c = d.campaign
    util = float(c.spent_amount / c.raised_amount * 100) if c.raised_amount else 0.0
    return {
        "id": d.id, "amount": money(d.amount), "status": d.status, "risk_score": d.risk_score,
        "risk_reasons": d.risk_reasons, "tx_hash": d.tx_hash, "created_at": d.created_at,
        "campaign": {"id": c.id, "title": c.title, "ngo": c.ngo.name,
                     "raised": money(c.raised_amount), "spent": money(c.spent_amount),
                     "utilisation_pct": round(util, 1)},
    }


def s_donation_admin(d):
    """Extended donation serializer for admin/NGO views (includes real donor name)."""
    base = s_donation(d)
    base["donor"] = d.donor.username
    base["donor_id"] = d.donor_id
    return base


def s_block(b):
    return {"index": b.index, "timestamp": b.timestamp, "kind": b.kind, "payload": b.payload,
            "prev_hash": b.prev_hash, "hash": b.hash}


# ------------------------------------------------------------------- auth ----
@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    f = request.data
    username, password = (f.get("username") or "").strip(), f.get("password") or ""
    role = f.get("role", "donor")
    if not username or len(password) < 8:
        return err("Username required and password must be at least 8 characters.")
    if role not in ("donor", "ngo"):
        return err("Role must be donor or ngo.")
    if role == "ngo" and not (f.get("ngo_name") or "").strip():
        return err("ngo_name is required for NGOs.")
    if User.objects.filter(username=username).exists():
        return err("Username already taken.")
    with transaction.atomic():
        u = User.objects.create_user(username, password=password)
        u.email = (f.get("email") or "").strip()
        u.save(update_fields=["email"])
        Profile.objects.create(user=u, role=role)
        if role == "ngo":
            NGO.objects.create(owner=u, name=f["ngo_name"].strip(), description=f.get("description", ""),
                               location=f.get("location", ""),
                               verified=getattr(settings, "NGO_AUTO_VERIFY", settings.DEBUG))
    token, _ = Token.objects.get_or_create(user=u)
    return Response({"token": token.key, "user": s_user(User.objects.get(pk=u.pk))}, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    u = authenticate(username=request.data.get("username"), password=request.data.get("password"))
    if not u:
        return err("Invalid credentials.", 401)
    token, _ = Token.objects.get_or_create(user=u)
    return Response({"token": token.key, "user": s_user(u)})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(s_user(request.user))


# -------------------------------------------------------------- campaigns ----
@api_view(["GET", "POST"])
def campaigns(request):
    if request.method == "GET":
        qs = Campaign.objects.select_related("ngo").filter(active=True).order_by("-created_at")
        if cat := request.query_params.get("category"):
            qs = qs.filter(category__iexact=cat)
        if q := request.query_params.get("q"):
            qs = qs.filter(title__icontains=q)
        return Response([s_campaign(c) for c in qs])

    # POST – only NGOs can create campaigns
    if not request.user.is_authenticated:
        return err("Authentication required.", 401)
    if role_of(request.user) != "ngo" or not hasattr(request.user, "ngo"):
        return access_denied("Only NGO accounts can create campaigns.")
    if not request.user.ngo.verified:
        return err("Your NGO is awaiting verification.", 403)
    f = request.data
    goal = parse_amount(f.get("goal_amount"))
    if not (f.get("title") and f.get("description") and f.get("category") and goal):
        return err("title, description, category and a valid goal_amount are required.")
    c = Campaign.objects.create(ngo=request.user.ngo, title=f["title"], description=f["description"],
                                category=f["category"].lower(), beneficiary=f.get("beneficiary", ""),
                                goal_amount=goal)
    return Response(s_campaign(c, True), status=201)


@api_view(["GET"])
def campaign_detail(request, pk):
    try:
        c = Campaign.objects.select_related("ngo").get(pk=pk)
    except Campaign.DoesNotExist:
        return err("Not found.", 404)
    return Response(s_campaign(c, True))


@api_view(["GET"])
@permission_classes([IsNGO])
def my_campaigns(request):
    """NGO-only: returns only this NGO's campaigns."""
    if not hasattr(request.user, "ngo"):
        return Response([])
    return Response([s_campaign(c) for c in request.user.ngo.campaigns.order_by("-created_at")])


@api_view(["PATCH"])
def campaign_update(request, pk):
    """Update a campaign. NGO owner or admin only."""
    if not request.user.is_authenticated:
        return err("Authentication required.", 401)
    try:
        c = Campaign.objects.select_related("ngo").get(pk=pk)
    except Campaign.DoesNotExist:
        return err("Not found.", 404)

    r = role_of(request.user)
    if r == "donor":
        return access_denied("Donors cannot edit campaigns.")
    if r == "ngo" and c.ngo.owner_id != request.user.id:
        return access_denied("You can only edit your own campaigns.")

    f = request.data
    if "title" in f:
        c.title = f["title"]
    if "description" in f:
        c.description = f["description"]
    if "category" in f:
        c.category = f["category"].lower()
    if "beneficiary" in f:
        c.beneficiary = f["beneficiary"]
    if "goal_amount" in f:
        goal = parse_amount(f["goal_amount"])
        if not goal:
            return err("Invalid goal_amount.")
        c.goal_amount = goal
    if "active" in f and r == "admin":
        # Only admins can toggle active status
        c.active = bool(f["active"])
    c.save()
    return Response(s_campaign(c, True))


@api_view(["GET"])
def ngo_campaign_donations(request, pk):
    """Donations for a specific campaign. NGO owner or admin only."""
    if not request.user.is_authenticated:
        return err("Authentication required.", 401)
    try:
        c = Campaign.objects.select_related("ngo").get(pk=pk)
    except Campaign.DoesNotExist:
        return err("Not found.", 404)

    r = role_of(request.user)
    if r == "donor":
        return access_denied("Donors cannot view campaign donation details.")
    if r == "ngo" and c.ngo.owner_id != request.user.id:
        return access_denied("You can only view donations for your own campaigns.")

    qs = Donation.objects.filter(campaign=c).select_related("donor").order_by("-created_at")
    return Response([s_donation_admin(d) for d in qs])


@api_view(["POST"])
def add_expenditure(request, pk):
    """Record spending on a campaign. NGO owner only (not admin, not donor)."""
    if not request.user.is_authenticated:
        return err("Authentication required.", 401)
    if role_of(request.user) == "donor":
        return access_denied("Donors cannot record campaign spending.")

    amount = parse_amount(request.data.get("amount"))
    desc = (request.data.get("description") or "").strip()
    if not amount or not desc:
        return err("A valid amount and description are required.")
    with transaction.atomic():
        try:
            c = Campaign.objects.select_for_update().select_related("ngo").get(pk=pk)
        except Campaign.DoesNotExist:
            return err("Not found.", 404)
        if c.ngo.owner_id != request.user.id:
            return access_denied("Only the campaign's NGO can record spending.")
        if amount > c.balance:
            return err(f"Amount exceeds available balance ({money(c.balance)}).")
        e = Expenditure.objects.create(campaign=c, amount=amount, description=desc)
        blk = ledger.append("expenditure", {"expenditure_id": e.id, "campaign_id": c.id,
                                            "amount": money(amount), "description": desc})
        e.tx_hash = blk.hash
        e.save(update_fields=["tx_hash"])
        Campaign.objects.filter(pk=c.pk).update(spent_amount=F("spent_amount") + amount)
    return Response(s_exp(e), status=201)


# --------------------------------------------------------------- donations ----
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def donate(request):
    """Donors (and admins for testing) can donate. NGOs cannot."""
    r = role_of(request.user)
    if r == "ngo":
        return access_denied("NGO accounts cannot donate; use a donor account.")
    amount = parse_amount(request.data.get("amount"))
    if not amount:
        return err(f"Amount must be between 0.01 and {MAX_DONATION}.")
    with transaction.atomic():
        try:
            c = Campaign.objects.select_for_update().select_related("ngo").get(
                pk=request.data.get("campaign_id"), active=True)
        except (Campaign.DoesNotExist, ValueError, TypeError):
            return err("Campaign not found or closed.", 404)
        risk, reasons = ai.assess_donation(request.user, c, amount)
        flagged = risk >= ai.FLAG_THRESHOLD
        d = Donation.objects.create(donor=request.user, campaign=c, amount=amount, risk_score=risk,
                                    risk_reasons=reasons,
                                    status=Donation.FLAGGED if flagged else Donation.CONFIRMED)
        blk = ledger.append("donation", {
            "donation_id": d.id, "donor": ledger.pseudonym(request.user.id), "campaign_id": c.id,
            "ngo": c.ngo.name, "amount": money(amount), "status": d.status, "risk": risk})
        d.tx_hash = blk.hash
        d.save(update_fields=["tx_hash"])
        if not flagged:
            Campaign.objects.filter(pk=c.pk).update(raised_amount=F("raised_amount") + amount)
    d.refresh_from_db()
    return Response(s_donation(d), status=201)


@api_view(["GET"])
@permission_classes([IsDonorOrAdmin])
def my_donations(request):
    """Returns the requesting donor's own donations. Admins see their own too."""
    qs = Donation.objects.filter(donor=request.user).select_related("campaign__ngo").order_by("-created_at")
    return Response([s_donation(d) for d in qs])


@api_view(["GET"])
@permission_classes([IsAdmin])
def flagged_donations(request):
    """Admin only: all flagged (pending review) donations."""
    qs = Donation.objects.filter(status="flagged").select_related("campaign__ngo", "donor").order_by("-created_at")
    return Response([s_donation_admin(d) for d in qs])


@api_view(["POST"])
@permission_classes([IsAdmin])
def review_donation(request, pk):
    """Admin only: approve or reject a flagged donation."""
    approve = bool(request.data.get("approve"))
    with transaction.atomic():
        try:
            d = Donation.objects.select_for_update().select_related("campaign__ngo").get(pk=pk, status="flagged")
        except Donation.DoesNotExist:
            return err("No such flagged donation.", 404)
        d.status = "confirmed" if approve else "rejected"
        d.save(update_fields=["status"])
        ledger.append("review", {"donation_id": d.id, "decision": d.status, "campaign_id": d.campaign_id,
                                 "amount": money(d.amount)})
        if approve:
            Campaign.objects.filter(pk=d.campaign_id).update(raised_amount=F("raised_amount") + d.amount)
    d.refresh_from_db()
    return Response(s_donation(d))


# ---------------------------------------------------------- admin views ----
@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_dashboard(request):
    """Admin-only aggregate dashboard statistics."""
    ok = Donation.objects.filter(status="confirmed")
    total_raised = Campaign.objects.aggregate(r=Sum("raised_amount"))["r"] or 0
    return Response({
        "total_users": User.objects.count(),
        "total_ngos": NGO.objects.count(),
        "total_campaigns": Campaign.objects.count(),
        "active_campaigns": Campaign.objects.filter(active=True).count(),
        "total_donations": ok.count(),
        "flagged_pending": Donation.objects.filter(status="flagged").count(),
        "total_raised": money(total_raised),
        "total_donors": ok.values("donor").distinct().count(),
    })


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_users(request):
    """Admin-only: list all users with roles and NGO info."""
    qs = User.objects.select_related("profile", "ngo").order_by("-date_joined")
    return Response([s_user_admin(u) for u in qs])


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_campaigns(request):
    """Admin-only: list ALL campaigns (including inactive)."""
    qs = Campaign.objects.select_related("ngo").order_by("-created_at")
    if cat := request.query_params.get("category"):
        qs = qs.filter(category__iexact=cat)
    if q := request.query_params.get("q"):
        qs = qs.filter(title__icontains=q)
    if status_filter := request.query_params.get("status"):
        if status_filter == "active":
            qs = qs.filter(active=True)
        elif status_filter == "inactive":
            qs = qs.filter(active=False)
    return Response([s_campaign(c) for c in qs])


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_all_donations(request):
    """Admin-only: list ALL donations with full donor details."""
    qs = Donation.objects.select_related("campaign__ngo", "donor").order_by("-created_at")
    if status_filter := request.query_params.get("status"):
        qs = qs.filter(status=status_filter)
    return Response([s_donation_admin(d) for d in qs])


# ----------------------------------------------------------- AI / ledger ----
@api_view(["GET"])
@permission_classes([AllowAny])
def recommendations(request):
    recs = ai.recommend(request.user)
    by_id = {c.id: c for c in Campaign.objects.filter(id__in=[r["campaign_id"] for r in recs]).select_related("ngo")}
    return Response([{**r, "campaign": s_campaign(by_id[r["campaign_id"]])} for r in recs])


@api_view(["GET"])
@permission_classes([AllowAny])
def ledger_list(request):
    limit = min(int(request.query_params.get("limit", 50)), 200)
    return Response([s_block(b) for b in Block.objects.order_by("-index")[:limit]])


@api_view(["GET"])
@permission_classes([AllowAny])
def ledger_verify(request):
    return Response(ledger.verify())


@api_view(["GET"])
@permission_classes([AllowAny])
def ledger_tx(request, tx_hash):
    b = Block.objects.filter(hash=tx_hash).first()
    return Response(s_block(b)) if b else err("Unknown transaction.", 404)


@api_view(["GET"])
@permission_classes([AllowAny])
def analytics(request):
    ok = Donation.objects.filter(status="confirmed")
    since = timezone.now() - timedelta(days=30)
    daily = (ok.filter(created_at__gte=since).annotate(day=TruncDate("created_at"))
             .values("day").annotate(total=Sum("amount"), n=Count("id")).order_by("day"))
    by_cat = (Campaign.objects.values("category")
              .annotate(raised=Sum("raised_amount"), spent=Sum("spent_amount")).order_by("-raised"))
    top = Campaign.objects.select_related("ngo").order_by("-raised_amount")[:5]
    agg = Campaign.objects.aggregate(r=Sum("raised_amount"), s=Sum("spent_amount"))
    raised, spent = agg["r"] or 0, agg["s"] or 0
    return Response({
        "total_raised": money(raised), "total_spent": money(spent),
        "utilisation_pct": round(float(spent / raised * 100), 1) if raised else 0.0,
        "donations": ok.count(), "donors": ok.values("donor").distinct().count(),
        "campaigns": Campaign.objects.filter(active=True).count(),
        "flagged_pending": Donation.objects.filter(status="flagged").count(),
        "daily": [{"day": r["day"], "total": money(r["total"]), "count": r["n"]} for r in daily],
        "by_category": [{"category": r["category"], "raised": money(r["raised"] or 0),
                         "spent": money(r["spent"] or 0)} for r in by_cat],
        "top_campaigns": [s_campaign(c) for c in top],
        "ledger": ledger.verify(),
    })
