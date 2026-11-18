import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr, short } from "../api";
import { useAuth } from "../auth.jsx";
import { CampaignCard } from "../components.jsx";

const CATS = ["all", "education", "health", "food", "disaster"];
const KIND = { donation: "Donation", expenditure: "Spent", review: "Review" };

function Stream({ blocks }) {
  return (
    <div className="stream" aria-label="Latest ledger entries">
      <div className="stream-head"><span className="live"><i />Live ledger</span><Link to="/ledger" style={{ color: "#b8c5d6" }}>Open full ledger</Link></div>
      {blocks.map((b) => (
        <Link to={`/ledger?tx=${b.hash}`} key={b.hash} className="sblock">
          <div className="t"><span className={"kind " + b.kind}>{KIND[b.kind] || b.kind}</span><span>Block #{b.index}</span></div>
          <div className="amt">{b.payload.amount ? inr(b.payload.amount) : "Chain started"}{b.payload.ngo ? <span style={{ fontWeight: 400, color: "#8da0b8", fontSize: ".85rem" }}> to {b.payload.ngo}</span> : null}</div>
          <div className="hs"><span>hash <em>{short(b.hash).slice(0, 12)}</em></span><span>prev {short(b.prev_hash).slice(0, 8)}</span></div>
        </Link>
      ))}
    </div>
  );
}

export default function Campaigns() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [recs, setRecs] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [stats, setStats] = useState(null);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("recommended");

  const sortedList = useMemo(() => [...list].sort((a, b) => {
    if (sort === "newest") return Number(b.id) - Number(a.id);
    if (sort === "urgent") return (Number(b.raised_amount) / Number(b.goal_amount)) - (Number(a.raised_amount) / Number(a.goal_amount));
    if (sort === "support") return Number(b.donor_count) - Number(a.donor_count);
    return 0;
  }), [list, sort]);

  useEffect(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (cat !== "all") p.set("category", cat);
    if (q) p.set("q", q);
    api("/campaigns/?" + p).then(setList).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [cat, q]);
  useEffect(() => { api("/recommendations/").then(setRecs).catch(() => {}); }, [user]);
  useEffect(() => {
    api("/ledger/?limit=4").then((b) => setBlocks(b.filter((x) => x.kind !== "genesis"))).catch(() => {});
    api("/analytics/").then(setStats).catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div className="hero-in">
          <div>
            <div className="hero-kicker"><span />Verified causes · Transparent giving</div>
            <h1>Support a cause that matters to you.</h1>
            <p className="lead">Find campaigns run by verified NGOs, donate securely in rupees, and follow how the funds are used.</p>
            <div className="row gap wrap">
              <a className="btn" href="#campaigns">Find a campaign</a>
              <Link className="btn ghost" to="/analytics">See our impact</Link>
            </div>
            {stats && (
              <div className="hero-stats">
                <div><b>{inr(stats.total_raised)}</b><span>donated so far</span></div>
                <div><b>{stats.donations}</b><span>donations made</span></div>
                <div><b>{stats.ledger.length}</b><span>transactions recorded</span></div>
              </div>
            )}
          </div>
          {blocks.length > 0 && <Stream blocks={blocks} />}
        </div>
      </section>

      <div className="page">
        {recs.length > 0 && (
          <>
            <div className="section-head"><h2>{user ? "Picked for you" : "Campaigns needing support"}</h2><span className="muted small">{user ? "Based on causes you've supported" : "Choose a cause and make a difference"}</span></div>
            <div className="grid">{recs.slice(0, 3).map((r) => <CampaignCard key={r.campaign_id} c={r.campaign} reason={r.reason} />)}</div>
          </>
        )}
        <div className="section-head" id="campaigns">
          <h2>All campaigns</h2>
          <div className="filters">
            {CATS.map((c) => <button key={c} className={"pillbtn" + (cat === c ? " on" : "")} onClick={() => setCat(c)}>{c}</button>)}
            <input placeholder="Search by title" aria-label="Search campaigns" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Sort campaigns" value={sort} onChange={(e) => setSort(e.target.value)}><option value="recommended">Recommended</option><option value="newest">Newest</option><option value="urgent">Closest to goal</option><option value="support">Most supported</option></select>
          </div>
        </div>
        {err && <p className="msg err">{err}</p>}
        {loading ? <div className="grid" aria-label="Loading campaigns"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div>
          : <div className="grid">{sortedList.map((c) => <CampaignCard key={c.id} c={c} />)}</div>}
        {!loading && !list.length && !err && <p className="muted">No campaigns match. Clear the search or pick another cause.</p>}

        <section className="trust-section" aria-labelledby="how-it-works">
          <div className="section-head"><h2 id="how-it-works">Your donation, clearly tracked</h2><span className="muted small">From your contribution to the campaign update.</span></div>
          <div className="trust-grid">
            <div className="trust-step"><span className="step-no">01</span><h3>Choose a campaign</h3><p className="muted">Review the NGO, goal, progress, and beneficiary before donating.</p></div>
            <div className="trust-step"><span className="step-no">02</span><h3>Make a donation</h3><p className="muted">Donations are checked and confirmed before they are added to the record.</p></div>
            <div className="trust-step"><span className="step-no">03</span><h3>Check the ledger</h3><p className="muted">See confirmed donations and recorded spending on the campaign page.</p></div>
          </div>
          <div className="trust-cta"><div><h3>Want to check a transaction?</h3><p>The public ledger is available to everyone.</p></div><Link className="btn dark" to="/ledger">View ledger</Link></div>
        </section>
      </div>
    </>
  );
}
