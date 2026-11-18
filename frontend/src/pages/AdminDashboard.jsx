import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr, when } from "../api";
import { Msg, Stat } from "../components.jsx";

const TABS = ["Overview", "Campaigns", "Donations", "Users", "Fraud Review"];

export default function AdminDashboard() {
  const [tab, setTab] = useState("Overview");
  const [stats, setStats] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [donations, setDonations] = useState([]);
  const [users, setUsers] = useState([]);
  const [flagged, setFlagged] = useState([]);
  const [msg, setMsg] = useState({});
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { api("/admin/dashboard/").then(setStats).catch((e) => setMsg({ error: e.message })); }, []);

  useEffect(() => {
    if (tab === "Campaigns" && !campaigns.length)
      api("/admin/campaigns/").then(setCampaigns).catch((e) => setMsg({ error: e.message }));
    if (tab === "Donations" && !donations.length)
      api("/admin/donations/").then(setDonations).catch((e) => setMsg({ error: e.message }));
    if (tab === "Users" && !users.length)
      api("/admin/users/").then(setUsers).catch((e) => setMsg({ error: e.message }));
    if (tab === "Fraud Review" && !flagged.length)
      api("/donations/flagged/").then(setFlagged).catch((e) => setMsg({ error: e.message }));
  }, [tab]);

  const reload = () => {
    setFlagged([]);
    api("/donations/flagged/").then(setFlagged).catch((e) => setMsg({ error: e.message }));
  };

  const decide = async (id, approve) => {
    try {
      await api(`/donations/${id}/review/`, { method: "POST", body: { approve } });
      setMsg({ ok: approve ? "Donation approved." : "Donation rejected." });
      reload();
    } catch (e) { setMsg({ error: e.message }); }
  };

  const toggleCampaign = async (c) => {
    setLoading(true);
    try {
      await api(`/campaigns/${c.id}/update/`, { method: "PATCH", body: { active: !c.active } });
      setMsg({ ok: `Campaign "${c.title}" ${!c.active ? "activated" : "deactivated"}.` });
      setCampaigns([]);
      api("/admin/campaigns/").then(setCampaigns);
    } catch (e) { setMsg({ error: e.message }); }
    finally { setLoading(false); }
  };

  const filteredCampaigns = campaigns.filter(c =>
    !q || c.title.toLowerCase().includes(q.toLowerCase()) || c.ngo.name.toLowerCase().includes(q.toLowerCase())
  );
  const filteredDonations = donations.filter(d =>
    !q || d.donor?.toLowerCase().includes(q.toLowerCase()) || d.campaign.title.toLowerCase().includes(q.toLowerCase())
  );
  const filteredUsers = users.filter(u =>
    !q || u.username.toLowerCase().includes(q.toLowerCase()) || u.role.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <section className="admin-dashboard">
      <div className="admin-header">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Admin Dashboard</h1>
          <p className="muted">Complete control over the TrustGive platform.</p>
        </div>
        <span className="admin-badge">Admin</span>
      </div>

      <div className="admin-tabs">
        {TABS.map(t => (
          <button key={t} className={"pillbtn" + (tab === t ? " on" : "")} onClick={() => { setTab(t); setQ(""); setMsg({}); }}>
            {t}
            {t === "Fraud Review" && stats?.flagged_pending > 0 && (
              <span className="badge-dot">{stats.flagged_pending}</span>
            )}
          </button>
        ))}
      </div>

      <Msg {...msg} />

      {/* ── Overview ───────────────────────────────────── */}
      {tab === "Overview" && stats && (
        <div>
          <div className="grid4" style={{ marginTop: 20 }}>
            <Stat tone="dark" label="Total Users" value={stats.total_users} />
            <Stat label="NGOs Registered" value={stats.total_ngos} />
            <Stat label="Total Campaigns" value={stats.total_campaigns} sub={`${stats.active_campaigns} active`} />
            <Stat label="Total Donations" value={stats.total_donations} sub={`${inr(stats.total_raised)} raised`} />
          </div>
          <div className="grid3" style={{ marginTop: 16 }}>
            <Stat label="Unique Donors" value={stats.total_donors} />
            <Stat tone={stats.flagged_pending > 0 ? "bad" : "ok"} label="Pending Fraud Review" value={stats.flagged_pending} />
            <Stat label="Total Raised" value={inr(stats.total_raised)} />
          </div>
          <div style={{ marginTop: 24 }} className="card flat">
            <h3>Quick Actions</h3>
            <div className="row gap wrap" style={{ marginTop: 12 }}>
              <button className="btn ghost" onClick={() => setTab("Fraud Review")}>Review Flagged Donations</button>
              <button className="btn ghost" onClick={() => setTab("Campaigns")}>Manage Campaigns</button>
              <button className="btn ghost" onClick={() => setTab("Users")}>Manage Users</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Campaigns ──────────────────────────────────── */}
      {tab === "Campaigns" && (
        <div>
          <div className="section-head">
            <h2>All Campaigns ({filteredCampaigns.length})</h2>
            <input placeholder="Search by title or NGO…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 280 }} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th><th>NGO</th><th>Category</th>
                  <th>Goal</th><th>Raised</th><th>Donors</th>
                  <th>Status</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCampaigns.map(c => (
                  <tr key={c.id}>
                    <td><Link to={`/campaigns/${c.id}`} style={{ fontWeight: 600 }}>{c.title}</Link></td>
                    <td className="muted small">{c.ngo.name}{c.ngo.verified && <span className="pill confirmed" style={{ marginLeft: 6, padding: "1px 7px" }}>✓</span>}</td>
                    <td><span className="cat" style={{ fontSize: ".75rem" }}>{c.category}</span></td>
                    <td>{inr(c.goal_amount)}</td>
                    <td><b>{inr(c.raised_amount)}</b></td>
                    <td>{c.donor_count}</td>
                    <td><span className={"pill " + (c.active ? "confirmed" : "flagged")}>{c.active ? "Active" : "Inactive"}</span></td>
                    <td>
                      <button className="btn ghost" style={{ padding: "4px 12px", fontSize: ".8rem" }}
                        disabled={loading} onClick={() => toggleCampaign(c)}>
                        {c.active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredCampaigns.length && <p className="muted" style={{ marginTop: 16 }}>No campaigns found.</p>}
        </div>
      )}

      {/* ── Donations ──────────────────────────────────── */}
      {tab === "Donations" && (
        <div>
          <div className="section-head">
            <h2>All Donations ({filteredDonations.length})</h2>
            <input placeholder="Search by donor or campaign…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 280 }} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Date</th><th>Donor</th><th>Campaign</th><th>Amount</th><th>Status</th><th>Risk</th></tr>
              </thead>
              <tbody>
                {filteredDonations.map(d => (
                  <tr key={d.id}>
                    <td className="small muted">{when(d.created_at)}</td>
                    <td><b>{d.donor}</b></td>
                    <td><Link to={`/campaigns/${d.campaign.id}`}>{d.campaign.title}</Link><div className="muted small">{d.campaign.ngo}</div></td>
                    <td><b>{inr(d.amount)}</b></td>
                    <td><span className={"pill " + d.status}>{d.status}</span></td>
                    <td className="small muted">{d.risk_score?.toFixed(2) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredDonations.length && <p className="muted" style={{ marginTop: 16 }}>No donations found.</p>}
        </div>
      )}

      {/* ── Users ──────────────────────────────────────── */}
      {tab === "Users" && (
        <div>
          <div className="section-head">
            <h2>All Accounts ({filteredUsers.length})</h2>
            <input placeholder="Search by username or role…" value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 280 }} />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Username</th><th>Email</th><th>Role</th><th>NGO Name</th><th>NGO Verified</th><th>Joined</th></tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td><b>{u.username}</b></td>
                    <td className="muted small">{u.email || "—"}</td>
                    <td>
                      <span className={"pill " + (u.role === "admin" ? "confirmed" : u.role === "ngo" ? "flagged" : "")}>
                        {u.role}
                      </span>
                    </td>
                    <td>{u.ngo?.name || "—"}</td>
                    <td>
                      {u.ngo
                        ? <span className={"pill " + (u.ngo.verified ? "confirmed" : "")}>{u.ngo.verified ? "Verified" : "Pending"}</span>
                        : "—"}
                    </td>
                    <td className="small muted">{when(u.date_joined)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredUsers.length && <p className="muted" style={{ marginTop: 16 }}>No users found.</p>}
        </div>
      )}

      {/* ── Fraud Review ───────────────────────────────── */}
      {tab === "Fraud Review" && (
        <div>
          <h2 style={{ marginBottom: 16 }}>Fraud Review Queue</h2>
          {!flagged.length && <p className="muted">Nothing waiting for review.</p>}
          {flagged.map(r => (
            <div key={r.id} className="card">
              <div className="row between">
                <b>{inr(r.amount)} → {r.campaign.title}</b>
                <span className="pill flagged">risk {r.risk_score?.toFixed(2)}</span>
              </div>
              <div className="muted small">donor <b>{r.donor}</b> · {when(r.created_at)}</div>
              {r.risk_reasons?.map((x) => <div key={x} className="small">• {x}</div>)}
              <div className="row gap" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => decide(r.id, true)}>Approve</button>
                <button className="btn ghost" onClick={() => decide(r.id, false)}>Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
