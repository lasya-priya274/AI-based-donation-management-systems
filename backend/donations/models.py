from django.conf import settings
from django.db import models


class Profile(models.Model):
    DONOR, NGO, ADMIN = "donor", "ngo", "admin"
    ROLES = [(DONOR, "Donor"), (NGO, "NGO"), (ADMIN, "Admin")]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=10, choices=ROLES, default=DONOR)


class NGO(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ngo")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=120, blank=True)
    verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class Campaign(models.Model):
    ngo = models.ForeignKey(NGO, on_delete=models.CASCADE, related_name="campaigns")
    title = models.CharField(max_length=200)
    description = models.TextField()
    category = models.CharField(max_length=60)  # education, health, food, disaster, ...
    beneficiary = models.CharField(max_length=200, blank=True)
    goal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    raised_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    spent_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def balance(self):
        return self.raised_amount - self.spent_amount


class Donation(models.Model):
    CONFIRMED, FLAGGED = "confirmed", "flagged"
    donor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="donations")
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="donations")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=10, default=CONFIRMED)
    risk_score = models.FloatField(default=0.0)
    risk_reasons = models.JSONField(default=list, blank=True)
    tx_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Expenditure(models.Model):
    """How an NGO used campaign funds (fund-utilisation tracking)."""
    campaign = models.ForeignKey(Campaign, on_delete=models.CASCADE, related_name="expenditures")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=300)
    tx_hash = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class Block(models.Model):
    """One block of the hash-chained ledger (the DLT layer)."""
    index = models.PositiveIntegerField(unique=True)
    timestamp = models.CharField(max_length=40)
    kind = models.CharField(max_length=20)  # genesis | donation | expenditure
    payload = models.JSONField(default=dict)
    prev_hash = models.CharField(max_length=64)
    hash = models.CharField(max_length=64, unique=True)

    class Meta:
        ordering = ["index"]
