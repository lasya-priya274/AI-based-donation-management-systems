import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.utils import timezone

from donations import ledger
from donations.models import NGO, Campaign, Donation, Expenditure, Profile

NGOS = [
    ("hope", "Hope Foundation", "Hyderabad", [
        ("Books for Rural Schools", "education", "Textbooks, uniforms and libraries for government schools in rural Telangana.", "Rural students", 200000),
        ("Scholarships for Girls", "education", "Tuition support so girls from low-income families can finish school.", "Girl students", 300000)]),
    ("annapurna", "Annapurna Trust", "Chennai", [
        ("Daily Meals for Homeless", "food", "Hot nutritious meals served daily to homeless families in the city.", "Homeless families", 150000),
        ("Nutrition for Children", "food", "Mid-day meal supplements and nutrition kits for malnourished children.", "Children under 10", 120000)]),
    ("medcare", "MedCare India", "Bengaluru", [
        ("Free Eye Surgeries", "health", "Cataract surgeries for elderly patients who cannot afford treatment.", "Elderly patients", 250000),
        ("Mobile Health Clinic", "health", "A van delivering primary healthcare and medicines to remote villages.", "Village communities", 400000)]),
    ("reliefnow", "Relief Now", "Kochi", [
        ("Flood Relief Kits", "disaster", "Emergency shelter, water and food kits for flood-affected families.", "Flood victims", 500000)]),
]


class Command(BaseCommand):
    help = "Load demo data (all passwords: demo12345; admin: admin / admin12345)"

    def handle(self, *a, **o):
        if User.objects.filter(username="admin").exists():
            self.stdout.write("Already seeded.")
            return
        random.seed(7)
        admin = User.objects.create_superuser("admin", "admin@example.com", "admin12345")
        Profile.objects.create(user=admin, role="admin")
        camps = []
        for uname, name, loc, cs in NGOS:
            u = User.objects.create_user(uname, password="demo12345")
            Profile.objects.create(user=u, role="ngo")
            n = NGO.objects.create(owner=u, name=name, location=loc, verified=True,
                                   description=f"{name} — verified charity partner.")
            for t, cat, desc, ben, goal in cs:
                camps.append(Campaign.objects.create(ngo=n, title=t, category=cat, description=desc,
                                                     beneficiary=ben, goal_amount=goal))
        donors = []
        for i in range(1, 9):
            u = User.objects.create_user(f"donor{i}", password="demo12345")
            Profile.objects.create(user=u, role="donor")
            User.objects.filter(pk=u.pk).update(date_joined=timezone.now() - timedelta(days=random.randint(20, 200)))
            donors.append(User.objects.get(pk=u.pk))
        favs = {d.id: random.sample(camps, 2) for d in donors}
        for _ in range(70):
            d = random.choice(donors)
            c = random.choice(favs[d.id]) if random.random() < 0.7 else random.choice(camps)
            amt = Decimal(random.choice([100, 200, 250, 500, 500, 1000, 1500, 2000]))
            when = timezone.now() - timedelta(days=random.randint(0, 28), hours=random.randint(0, 20))
            row = Donation.objects.create(donor=d, campaign=c, amount=amt, risk_score=0.1)
            Donation.objects.filter(pk=row.pk).update(created_at=when)
            blk = ledger.append("donation", {"donation_id": row.id, "donor": ledger.pseudonym(d.id),
                                             "campaign_id": c.id, "ngo": c.ngo.name, "amount": str(amt),
                                             "status": "confirmed", "risk": 0.1})
            Donation.objects.filter(pk=row.pk).update(tx_hash=blk.hash)
            c.raised_amount += amt
            c.save(update_fields=["raised_amount"])
        for c in camps:
            if c.raised_amount > 3000:
                amt = (c.raised_amount * Decimal("0.4")).quantize(Decimal("1"))
                e = Expenditure.objects.create(campaign=c, amount=amt, description="Procurement and distribution")
                blk = ledger.append("expenditure", {"expenditure_id": e.id, "campaign_id": c.id,
                                                    "amount": str(amt), "description": e.description})
                e.tx_hash = blk.hash
                e.save()
                c.spent_amount = amt
                c.save(update_fields=["spent_amount"])
        self.stdout.write(self.style.SUCCESS("Seeded. Logins: donor1..8 / hope,annapurna,medcare,reliefnow (demo12345), admin (admin12345)"))
