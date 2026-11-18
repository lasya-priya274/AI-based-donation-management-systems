import React, { useEffect, useState } from "react";
import { api, inr, when } from "../api";
import { Msg } from "../components.jsx";

export default function AdminReview() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  const load = () => api("/donations/flagged/").then(setRows).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const decide = async (id, approve) => { try { await api(`/donations/${id}/review/`, { method: "POST", body: { approve } }); load(); } catch (e) { setErr(e.message); } };
  return (
    <>
      <h1>Fraud review queue</h1><Msg error={err} />
      {!rows.length && <p className="muted">Nothing waiting for review.</p>}
      {rows.map((r) => (
        <div key={r.id} className="card">
          <div className="row between"><b>{inr(r.amount)} → {r.campaign.title}</b><span className="pill flagged">risk {r.risk_score}</span></div>
          <div className="muted small">donor {r.donor} · {when(r.created_at)}</div>
          {r.risk_reasons.map((x) => <div key={x} className="small">• {x}</div>)}
          <div className="row gap"><button className="btn" onClick={() => decide(r.id, true)}>Approve</button>
            <button className="btn ghost" onClick={() => decide(r.id, false)}>Reject</button></div>
        </div>))}
    </>
  );
}
