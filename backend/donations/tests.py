from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from . import ledger
from .models import Block, Campaign, Donation


class FlowTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed", verbosity=0)

    def client_for(self, username, password="demo12345"):
        c = APIClient()
        r = c.post("/api/auth/login/", {"username": username, "password": password}, format="json")
        c.credentials(HTTP_AUTHORIZATION="Token " + r.data["token"])
        return c

    def test_donation_is_recorded_and_chain_valid(self):
        c = self.client_for("donor1")
        camp = Campaign.objects.first()
        before = camp.raised_amount
        r = c.post("/api/donations/", {"campaign_id": camp.id, "amount": "250"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "confirmed")
        camp.refresh_from_db()
        self.assertEqual(camp.raised_amount - before, 250)
        self.assertTrue(Block.objects.filter(hash=r.data["tx_hash"]).exists())
        self.assertTrue(ledger.verify()["valid"])

    def test_tampering_is_detected(self):
        self.assertTrue(ledger.verify()["valid"])
        b = Block.objects.filter(kind="donation").order_by("index")[5]
        b.payload = {**b.payload, "amount": "1.00"}
        b.save()
        v = ledger.verify()
        self.assertFalse(v["valid"])
        self.assertEqual(v["broken_at"], b.index)

    def test_suspicious_donation_flagged_and_held(self):
        c = self.client_for("donor2")
        camp = Campaign.objects.get(title="Flood Relief Kits")
        before = camp.raised_amount
        r = c.post("/api/donations/", {"campaign_id": camp.id, "amount": "400000"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "flagged")
        self.assertTrue(r.data["risk_reasons"])
        camp.refresh_from_db()
        self.assertEqual(camp.raised_amount, before)  # held until admin review
        admin = self.client_for("admin", "admin12345")
        rv = admin.post(f"/api/donations/{r.data['id']}/review/", {"approve": True}, format="json")
        self.assertEqual(rv.data["status"], "confirmed")
        camp.refresh_from_db()
        self.assertEqual(camp.raised_amount - before, 400000)

    def test_velocity_flag(self):
        c = self.client_for("donor3")
        camp = Campaign.objects.first()
        last = None
        for _ in range(6):
            last = c.post("/api/donations/", {"campaign_id": camp.id, "amount": "100"}, format="json")
        self.assertEqual(last.data["status"], "flagged")

    def test_spending_cannot_exceed_balance_and_only_owner(self):
        camp = Campaign.objects.get(title="Books for Rural Schools")
        hope = self.client_for("hope")
        r = hope.post(f"/api/campaigns/{camp.id}/expenditures/",
                      {"amount": "99999999", "description": "x"}, format="json")
        self.assertEqual(r.status_code, 400)
        other = self.client_for("medcare")
        r = other.post(f"/api/campaigns/{camp.id}/expenditures/", {"amount": "10", "description": "x"}, format="json")
        self.assertEqual(r.status_code, 403)
        r = hope.post(f"/api/campaigns/{camp.id}/expenditures/", {"amount": "10", "description": "Books"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(ledger.verify()["valid"])

    def test_recommendations_personalised(self):
        c = self.client_for("donor4")
        r = c.get("/api/recommendations/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(len(r.data) > 0)
        self.assertIn("reason", r.data[0])

    def test_ngo_cannot_donate_and_validation(self):
        self.assertEqual(self.client_for("hope").post("/api/donations/", {"campaign_id": 1, "amount": "5"}, format="json").status_code, 403)
        d = self.client_for("donor1")
        self.assertEqual(d.post("/api/donations/", {"campaign_id": 1, "amount": "-5"}, format="json").status_code, 400)

    def test_analytics(self):
        r = APIClient().get("/api/analytics/")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data["ledger"]["valid"])
