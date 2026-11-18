import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, inr, short, when } from "../api";
import { useAuth } from "../auth.jsx";
import { Check, Msg, Progress, campaignImage, catPat, catStyle } from "../components.jsx";

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState(null);
  const [amount, setAmount] = useState("500");
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api(`/campaigns/${id}/`).then(setC).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, [id]);

  const donate = async (e) => {
    e.preventDefault(); setErr(""); setRes(null); setBusy(true);
    try { setRes(await api("/donations/", { method: "POST", body: { campaign_id: Number(id), amount } })); load(); }
    catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  };

  if (!c) return <Msg error={err} />;
  const raised = Number(c.raised_amount), spent = Number(c.spent_amount), goal = Number(c.goal_amount);
  const held = res && res.status !== "confirmed";
  return (
    <div style={catStyle(c.category)}>
      <div className={"detail-hero " + catPat(c.category)} style={{ backgroundImage: `linear-gradient(90deg, #0d1b2ed9 0%, #0d1b2e88 55%, #0d1b2e33 100%), url("${campaignImage(c)}")` }}>
        <span className="cat" style={{ background: "#0d1b2e55" }}>{c.category}</span>
        <h1>{c.title}</h1>
        <div className="by"><span>by {c.ngo.name}</span>{c.ngo.verified && <span className="vfy"><Check />Verified NGO</span>}<span>for {c.beneficiary || "the community"}</span></div>
      </div>
      <div className="facts">
        <div className="fact"><b>{inr(raised)}</b><span>raised of {inr(goal)}</span></div>
        <div className="fact"><b>{inr(spent)}</b><span>spent on the cause</span></div>
        <div className="fact"><b>{inr(c.balance)}</b><span>still available</span></div>
        <div className="fact"><b>{c.donor_count}</b><span>donors</span></div>
      </div>
      <div className="two">
        <div>
          <p style={{ fontSize: "1.08rem", maxWidth: "62ch" }}>{c.description}</p>
          <Progress raised={raised} goal={goal} spent={spent} />

          <h2>Where the money went</h2>
          {c.expenditures.length === 0 && <p className="muted">Nothing spent yet. Every expense this NGO records will appear here with its ledger hash.</p>}
          <ul className="timeline">
            {c.expenditures.map((e) => (
              <li key={e.id}>
                <div className="amt">{inr(e.amount)}</div>
                <div>{e.description}</div>
                <div className="small muted">{when(e.created_at)} <Link className="hash" to={`/ledger?tx=${e.tx_hash}`}>{short(e.tx_hash)}</Link></div>
              </li>
            ))}
          </ul>

          <h2>Recent donations</h2>
          <ul className="dlist">
            {c.recent_donations.map((d, i) => (
              <li key={i}><span>Donor <code>{d.donor}</code> gave <b>{inr(d.amount)}</b></span>
                <Link className="hash" to={`/ledger?tx=${d.tx_hash}`}>{short(d.tx_hash)}</Link></li>
            ))}
          </ul>
        </div>

        <aside className="card flat sticky donation-box">
          <span className="eyebrow">Support this campaign</span>
          <h3>Make a donation</h3>
          <p className="small muted">Your contribution will be recorded against this campaign.</p>
          {!user && <p className="muted"><Link to="/login" style={{ textDecoration: "underline" }}>Log in</Link> with a donor account to give.</p>}
          {user?.role === "donor" && (
            <form onSubmit={donate}>
              <label htmlFor="amt">Amount in rupees</label>
              <input id="amt" type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              <div className="chips">{[200, 500, 1000, 5000].map((v) => <button type="button" key={v} className={"chip" + (String(v) === amount ? " on" : "")} onClick={() => setAmount(String(v))}>{inr(v)}</button>)}</div>
              <button className="btn dark full" disabled={busy}>{busy ? "Checking donation…" : `Donate ${inr(amount || 0)}`}</button>
            </form>
          )}
          {user && user.role !== "donor" && <p className="muted">Only donor accounts can donate.</p>}
          <Msg error={err} />
          {res && (
            <div className={"receipt" + (held ? " held" : "")}>
              <h4>{held ? "Held for review" : "Donation confirmed"}</h4>
              <p className="small muted">{held ? "Our fraud check flagged this donation. An admin will review it before the money is released." : "Recorded on the ledger. You can verify it any time."}</p>
              <div className="line"><span>Amount</span><b>{inr(res.amount)}</b></div>
              <div className="line"><span>Ledger hash</span><Link className="hash" to={`/ledger?tx=${res.tx_hash}`}>{short(res.tx_hash)}</Link></div>
              <div className="risk"><span>Risk</span><div className="meter"><i className={res.risk_score >= 0.5 ? "hi" : ""} style={{ width: res.risk_score * 100 + "%" }} /></div><b>{Math.round(res.risk_score * 100)}%</b></div>
              {res.risk_reasons.map((r) => <div key={r} className="small muted" style={{ marginTop: 6 }}>{r}</div>)}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
