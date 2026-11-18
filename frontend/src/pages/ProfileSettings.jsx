import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth.jsx";

export default function ProfileSettings() {
  const { user, signOut } = useAuth();

  return (
    <section className="profile-settings">
      <div className="settings-intro">
        <div><span className="eyebrow">Your account</span><h1>Profile settings</h1><p>Manage your identity and keep your giving experience personal.</p></div>
        <span className="settings-secure">✓ Secure account</span>
      </div>

      <div className="profile-settings-grid">
        <div className="card profile-settings-card">
          <div className="settings-card-heading"><div><span className="eyebrow">Personal information</span><h2>Account details</h2></div><span className="settings-badge">Verified</span></div>
          <div className="profile-settings-identity">
            <div className="avatar profile-settings-avatar">{user.username[0]}</div>
            <div>
              <h2>{user.username}</h2>
              <span className="muted">{user.role}</span>
            </div>
          </div>

          <div className="settings-fields">
            <div className="settings-field">
              <span className="muted small">Username</span>
              <strong>{user.username}</strong>
            </div>
            <div className="settings-field">
              <span className="muted small">Email address</span>
              <strong>{user.email || "No email added"}</strong>
            </div>
            <div className="settings-field">
              <span className="muted small">Account type</span>
              <strong>{user.role === "ngo" ? "NGO" : user.role === "admin" ? "Administrator" : "Donor"}</strong>
            </div>
          </div>
        </div>

        <aside className="card profile-settings-card">
          <span className="eyebrow">Security</span><h2>Account access</h2>
          <div className="security-row"><span className="security-icon">✓</span><div><strong>Active session</strong><small>You're securely signed in</small></div></div>
          <p className="muted small">Sign out when you are finished using TrustGive on this device.</p>
          <button className="btn ghost profile-settings-signout" onClick={signOut}>Sign out</button>
        </aside>
      </div>

      <div className="settings-footer"><Link className="btn ghost" to="/">Back to campaigns</Link><span className="muted small">Your information is used only to manage your TrustGive account.</span></div>
    </section>
  );
}
