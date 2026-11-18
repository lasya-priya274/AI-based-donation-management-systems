import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr, short, when } from "../api";
import { Msg, Stat } from "../components.jsx";

export default function MyDonations() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState("");
  useEffect(() => { api("/donations/mine/").then(setRows).catch((e) => setErr(e.message)); }, []);
  const total = rows.filter((r) => r.status === "confirmed").reduce((s, r) => s + Number(r.amount), 0);
  return (
    <>
      <h1>My donations</h1><Msg error={err} />
      <div className="grid3" style={{ marginTop: 18 }}>
        <Stat tone="dark" label="Total given" value={inr(total)} />
        <Stat label="Donations" value={rows.length} />
        <Stat label="Causes supported" value={new Set(rows.map((r) => r.campaign.id)).size} />
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Date</th><th>Campaign</th><th>Amount</th><th>Status</th><th>Campaign funds spent</th><th>Ledger</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td>{when(r.created_at)}</td>
              <td><Link to={`/campaigns/${r.campaign.id}`} style={{ fontWeight: 600 }}>{r.campaign.title}</Link><div className="muted small">{r.campaign.ngo}</div></td>
              <td><b>{inr(r.amount)}</b></td>
              <td><span className={"pill " + r.status}>{r.status}</span></td>
              <td><div className="util"><div className="bar"><div className="bar-spent" style={{ width: r.campaign.utilisation_pct + "%", background: "var(--verified)" }} /></div><span className="small">{r.campaign.utilisation_pct}%</span></div></td>
              <td><Link className="hash" to={`/ledger?tx=${r.tx_hash}`}>{short(r.tx_hash)}</Link></td>
            </tr>))}</tbody>
        </table>
      </div>
      {!rows.length && <p className="muted" style={{ marginTop: 16 }}>No donations yet. <Link to="/" style={{ textDecoration: "underline" }}>Pick a campaign to support.</Link></p>}
    </>
  );
}
