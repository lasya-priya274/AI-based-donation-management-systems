from django.contrib import admin
from . import models

for m in (models.Profile, models.NGO, models.Campaign, models.Donation, models.Expenditure, models.Block):
    admin.site.register(m)
