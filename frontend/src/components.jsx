import React from "react";
import { Link } from "react-router-dom";
import { inr } from "./api";

export const CAT_COLOR = { education: "#3b5bdb", health: "#0f9d8a", food: "#f5a524", disaster: "#d9363e", environment: "#5b8c3a" };
export const catStyle = (c) => ({ "--cc": CAT_COLOR[c] || "#243a57" });
export const catPat = (c) => "pat-" + (CAT_COLOR[c] ? c : "education");
const CAMPAIGN_IMAGES = {
  "flood relief kits": "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=1000&q=85",
  "mobile health clinic": "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1000&q=85",
  "free eye surgeries": "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?auto=format&fit=crop&w=1000&q=85",
  "nutrition for children": "https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=1000&q=85",
  "daily meals for homeless": "https://images.unsplash.com/photo-1593113598332-cd288d649433?auto=format&fit=crop&w=1000&q=85",
  "scholarships for girls": "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=85",
  "books for rural schools": "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1000&q=85"
};
export const campaignImage = (c) => {
  const title = (c.title || "").toLowerCase();
  if (CAMPAIGN_IMAGES[title]) return CAMPAIGN_IMAGES[title];
  if (c.category === "health") return "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1000&q=85";
  if (c.category === "food") return "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1000&q=85";
  if (c.category === "education") return "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1000&q=85";
  if (c.category === "disaster") return "https://images.unsplash.com/photo-1547683905-f686c993aae5?auto=format&fit=crop&w=1000&q=85";
  return "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1000&q=85";
};

export const Check = () => (
  <svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="9" fill="currentColor" opacity=".25" /><path d="M6 10.3l2.7 2.7L14 7.7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
export const Logo = () => (
  <svg viewBox="0 0 32 32" fill="none"><rect x="2" y="3" width="13" height="13" rx="4" fill="#f5a524" /><rect x="17" y="16" width="13" height="13" rx="4" fill="#fff" opacity=".9" /><path d="M13 14l6 4" stroke="#f5a524" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="1 4.2" /></svg>
);

export function Progress({ raised, goal, spent }) {
  const pct = Math.min(100, goal ? (raised / goal) * 100 : 0);
  const sp = Math.min(100, goal ? (spent / goal) * 100 : 0);
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin="0" aria-valuemax="100">
      <div className="bar-raised" style={{ width: pct + "%" }} />
      <div className="bar-spent" style={{ width: sp + "%" }} />
    </div>
  );
}

export function CampaignCard({ c, reason }) {
  const raised = Number(c.raised_amount), goal = Number(c.goal_amount), spent = Number(c.spent_amount);
  const progress = goal ? Math.round((raised / goal) * 100) : 0;
  return (
    <Link to={`/campaigns/${c.id}`} className="camp" style={catStyle(c.category)}>
      <div className={"camp-art " + catPat(c.category)} style={{ backgroundImage: `linear-gradient(180deg, transparent 35%, #0d1b2eaa 100%), url("${campaignImage(c)}")` }}>
        <span className="cat">{c.category}</span>
        {c.ngo.verified && <span className="vfy"><Check />Verified NGO</span>}
      </div>
      <div className="camp-body">
        <h3>{c.title}</h3>
        <p className="muted small">{c.ngo.name} · {c.ngo.verified ? "Verified NGO" : "NGO verification pending"}</p>
        {reason && <p className="why">✦ {reason}</p>}
        {!reason && progress < 25 && <p className="why urgent">Needs support · {progress}% funded</p>}
        <div className="fund">
          <Progress raised={raised} goal={goal} spent={spent} />
          <div className="nums"><span><b>{inr(raised)}</b> raised</span><span>{progress}% of {inr(goal)}</span></div>
          <div className="legend"><span><i style={{ background: "var(--cc)", opacity: .4 }} />Raised</span><span><i style={{ background: "var(--cc)" }} />Spent {inr(spent)}</span><span>{c.donor_count} donors</span></div>
        </div>
      </div>
    </Link>
  );
}

export function Stat({ label, value, sub, tone = "" }) {
  return <div className={"card stat " + tone}><div className="lbl">{label}</div><div className="big">{value}</div>{sub && <div className="small muted">{sub}</div>}</div>;
}

export function Msg({ error, ok }) {
  if (error) return <p className="msg err" role="alert">{error}</p>;
  if (ok) return <p className="msg good" role="status">{ok}</p>;
  return null;
}
