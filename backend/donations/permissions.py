"""
Role-based DRF permission classes for the donation system.
All checks are enforced server-side so they cannot be bypassed via the frontend.
"""
from rest_framework.permissions import BasePermission


def _role(user):
    """Return the role string for an authenticated user."""
    if user.is_superuser:
        return "admin"
    p = getattr(user, "profile", None)
    return p.role if p else "donor"


class IsDonor(BasePermission):
    """Allow access only to authenticated donors."""
    message = "Only donor accounts can perform this action."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and _role(request.user) == "donor")


class IsNGO(BasePermission):
    """Allow access only to authenticated NGO accounts."""
    message = "Only NGO accounts can perform this action."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and _role(request.user) == "ngo")


class IsAdmin(BasePermission):
    """Allow access only to admin accounts."""
    message = "Only admin accounts can access this resource."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and _role(request.user) == "admin")


class IsAuthenticated(BasePermission):
    """Any authenticated user (donor, ngo, or admin)."""
    message = "Authentication is required."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)


class IsDonorOrAdmin(BasePermission):
    """Allow donors (viewing their own data) and admins."""
    message = "Only donor or admin accounts can access this resource."

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and _role(request.user) in ("donor", "admin")
        )


class IsNGOOrAdmin(BasePermission):
    """Allow NGOs and admins (e.g. admin can manage campaigns too)."""
    message = "Only NGO or admin accounts can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and _role(request.user) in ("ngo", "admin")
        )
