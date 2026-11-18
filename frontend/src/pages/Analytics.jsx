import React, { useEffect, useState } from "react";
import { api, inr } from "../api";
import { CAT_COLOR, CampaignCard, Progress, Stat } from "../components.jsx";

function Area({ data }) {
  if (!data.length) return <p className="muted">No donations in the last 30 days.</p>;
  const W = 560, H = 200, P = 8;
  const vals = data.map((d) => Number(d.total)), max = Math.max(...vals, 1);
  const x = (i) => P + (data.length === 1 ? (W - 2 * P) / 2 : (i * (W - 2 * P)) / (data.length - 1));
  const y = (v) => H - P - (v / max) * (H - 2 * P - 16);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(Number(d.total))}`).join(" ");
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H + 18}`} role="img" aria-label="Daily donations, last 30 days">
        <defs><linearGradient id="g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#f5a524" stopOpacity=".45" /><stop offset="1" stopColor="#f5a524" stopOpacity="0" /></linearGradient></defs>
        <path d={`${line} L${x(data.length - 1)},${H - P} L${x(0)},${H - P} Z`} fill="url(#g)" />
        <path d={line} fill="none" stroke="#c97f00" strokeWidth="2.5" strokeLinejoin="round" />
        {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(Number(d.total))} r="3.5" fill="#fff" stroke="#c97f00" strokeWidth="2"><title>{d.day}: {inr(d.total)}</title></circle>)}
        <text x={P} y={H + 14} fontSize="11" fill="#5d6b7c">{data[0].day}</text>
        <text x={W - P} y={H + 14} fontSize="11" fill="#5d6b7c" textAnchor="end">{data[data.length - 1].day}</text>
      </svg>
    </div>
  );
}

export default function Analytics() {
  const [a, setA] = useState(null);
  useEffect(() => { api("/analytics/").then(setA); }, []);
  if (!a) return null;
  return (
    <>
      <div className="report-heading"><span className="eyebrow">Public report</span><h1>Where the money goes</h1><p className="muted">An overview of donations received and spending recorded across TrustGive campaigns.</p></div>
      <div className="grid4" style={{ marginTop: 20 }}>
        <Stat tone="dark" label="Total raised" value={inr(a.total_raised)} sub={`${a.donations} donations`} />
        <Stat label="Spent on programs" value={inr(a.total_spent)} sub={`${a.utilisation_pct}% of funds used`} />
        <Stat label="Donors" value={a.donors} sub={`${a.campaigns} active campaigns`} />
        <Stat tone={a.ledger.valid ? "ok" : "bad"} label="Ledger" value={a.ledger.valid ? "Verified" : "Tampered"} sub={`${a.ledger.length} blocks checked`} />
      </div>
      <div className="two" style={{ marginTop: 24 }}>
        <div className="card flat"><h3>Donations, last 30 days</h3><Area data={a.daily} /></div>
        <div className="card flat">
          <h3>Raised and spent by cause</h3>
          {a.by_category.map((c) => {
            const r = Number(c.raised), s = Number(c.spent);
            return (
              <div key={c.category} className="hbar" style={{ "--cc": CAT_COLOR[c.category] || "#243a57" }}>
                <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{c.category}</span>
                <Progress raised={r} goal={Math.max(r, 1)} spent={s} />
                <span className="muted">{inr(r)}</span>
              </div>);
          })}
          <div className="legend"><span><i style={{ background: "#243a57", opacity: .4 }} />Raised</span><span><i style={{ background: "#243a57" }} />Spent</span></div>
        </div>
      </div>
      <div className="section-head"><h2>Top campaigns</h2></div>
      <div className="grid">{a.top_campaigns.map((c) => <CampaignCard key={c.id} c={c} />)}</div>
    </>
  );
}
