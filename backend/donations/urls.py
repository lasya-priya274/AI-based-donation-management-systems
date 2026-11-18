from django.urls import path
from . import views as v

urlpatterns = [
    # ── Auth ─────────────────────────────────────────────────────────────────
    path("auth/register/", v.register),
    path("auth/login/", v.login),
    path("auth/me/", v.me),

    # ── Campaigns (public GET; POST → NGO only) ───────────────────────────────
    path("campaigns/", v.campaigns),
    path("campaigns/mine/", v.my_campaigns),               # NGO only
    path("campaigns/<int:pk>/", v.campaign_detail),
    path("campaigns/<int:pk>/update/", v.campaign_update), # NGO owner or Admin
    path("campaigns/<int:pk>/expenditures/", v.add_expenditure),  # NGO owner only
    path("campaigns/<int:pk>/donations/", v.ngo_campaign_donations),  # NGO owner or Admin

    # ── Donations ─────────────────────────────────────────────────────────────
    path("donations/", v.donate),                          # Donor / Admin
    path("donations/mine/", v.my_donations),               # Donor / Admin (own)
    path("donations/flagged/", v.flagged_donations),       # Admin only
    path("donations/<int:pk>/review/", v.review_donation), # Admin only

    # ── Admin-only management views ─────────────────────────────────────────
    path("admin/dashboard/", v.admin_dashboard),           # Admin only
    path("admin/users/", v.admin_users),                   # Admin only
    path("admin/campaigns/", v.admin_campaigns),           # Admin only
    path("admin/donations/", v.admin_all_donations),       # Admin only

    # ── Public / AI / Ledger ─────────────────────────────────────────────────
    path("recommendations/", v.recommendations),
    path("ledger/", v.ledger_list),
    path("ledger/verify/", v.ledger_verify),
    path("ledger/tx/<str:tx_hash>/", v.ledger_tx),
    path("analytics/", v.analytics),
]
