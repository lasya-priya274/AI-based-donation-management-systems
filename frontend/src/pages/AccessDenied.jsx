import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function AccessDenied() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const dashboardPath =
    user?.role === "admin" ? "/admin/dashboard"
    : user?.role === "ngo" ? "/ngo"
    : "/";

  const dashboardLabel =
    user?.role === "admin" ? "Admin Dashboard"
    : user?.role === "ngo" ? "NGO Dashboard"
    : "Campaigns";

  return (
    <section className="access-denied-page">
      <div className="access-denied-inner">
        <div className="access-denied-icon" aria-hidden="true">🔒</div>
        <span className="eyebrow">403 – Forbidden</span>
        <h1>Access Denied</h1>
        <p className="muted">
          You don't have permission to view this page.
          {user
            ? " This area is restricted to a different role."
            : " Please log in to continue."}
        </p>
        {user ? (
          <div className="row gap" style={{ justifyContent: "center", marginTop: 24 }}>
            <button className="btn" onClick={() => navigate(dashboardPath)}>
              Go to {dashboardLabel}
            </button>
            <Link className="btn ghost" to="/">Back to Campaigns</Link>
          </div>
        ) : (
          <div className="row gap" style={{ justifyContent: "center", marginTop: 24 }}>
            <Link className="btn" to="/login">Log in</Link>
            <Link className="btn ghost" to="/">Back to Campaigns</Link>
          </div>
        )}
      </div>
    </section>
  );
}
