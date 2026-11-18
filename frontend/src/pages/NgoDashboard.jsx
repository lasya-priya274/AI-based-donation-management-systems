import React, { useEffect, useState } from "react";
import { api, inr, when } from "../api";
import { useAuth } from "../auth.jsx";
import { Msg, Progress } from "../components.jsx";

export default function NgoDashboard() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [f, setF] = useState({ title: "", description: "", category: "education", beneficiary: "", goal_amount: "" });
  const [sp, setSp] = useState({});
  const [donors, setDonors] = useState({}); // campId → donations array
  const [donorsOpen, setDonorsOpen] = useState({}); // campId → bool
  const [msg, setMsg] = useState({});
  const load = () => api("/campaigns/mine/").then(setList);
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault(); setMsg({});
    try {
      await api("/campaigns/", { method: "POST", body: f });
      setF({ ...f, title: "", description: "", goal_amount: "" });
      setMsg({ ok: "Campaign created." });
      load();
    } catch (ex) { setMsg({ error: ex.message }); }
  };

  const spend = async (id) => {
    const s = sp[id] || {};
    try {
      await api(`/campaigns/${id}/expenditures/`, { method: "POST", body: s });
      setSp({ ...sp, [id]: {} });
      setMsg({ ok: "Spending recorded on the ledger." });
      load();
    } catch (ex) { setMsg({ error: ex.message }); }
  };

  const toggleDonors = async (id) => {
    const nowOpen = !donorsOpen[id];
    setDonorsOpen({ ...donorsOpen, [id]: nowOpen });
    if (nowOpen && !donors[id]) {
      try {
        const data = await api(`/campaigns/${id}/donations/`);
        setDonors({ ...donors, [id]: data });
      } catch (ex) { setMsg({ error: ex.message }); }
    }
  };

  return (
    <>
      <h1>{user.ngo?.name || "NGO Dashboard"}</h1>
      {!user.ngo?.verified && (
        <p className="msg warn">Your organisation is awaiting verification by an admin.</p>
      )}
      <Msg {...msg} />
      <div className="two">
        <div>
          <h2>Your campaigns</h2>
          {list.map((c) => (
            <div key={c.id} className="card">
              <h3>{c.title}</h3>
              <Progress raised={Number(c.raised_amount)} goal={Number(c.goal_amount)} spent={Number(c.spent_amount)} />
              <div className="small muted" style={{ marginBottom: 8 }}>
                Raised {inr(c.raised_amount)} · Spent {inr(c.spent_amount)} · Available <b>{inr(c.balance)}</b>
                <span style={{ marginLeft: 12 }}>· {c.donor_count} donor{c.donor_count !== 1 ? "s" : ""}</span>
              </div>

              {/* Record spending */}
              <div className="row gap wrap">
                <input type="number" placeholder="Amount ₹"
                  value={sp[c.id]?.amount || ""}
                  onChange={(e) => setSp({ ...sp, [c.id]: { ...sp[c.id], amount: e.target.value } })} />
                <input placeholder="What was it spent on?"
                  value={sp[c.id]?.description || ""}
                  onChange={(e) => setSp({ ...sp, [c.id]: { ...sp[c.id], description: e.target.value } })} />
                <button className="btn" onClick={() => spend(c.id)}>Record spending</button>
              </div>

              {/* View donors section */}
              <div style={{ marginTop: 12 }}>
                <button className="btn ghost" style={{ padding: "5px 14px", fontSize: ".85rem" }}
                  onClick={() => toggleDonors(c.id)}>
                  {donorsOpen[c.id] ? "▲ Hide donors" : "▼ View donors"}
                </button>
                {donorsOpen[c.id] && (
                  <div style={{ marginTop: 10 }}>
                    {!donors[c.id]?.length && <p className="muted small">No donations yet.</p>}
                    {donors[c.id]?.length > 0 && (
                      <div className="table-wrap">
                        <table className="table" style={{ fontSize: ".85rem" }}>
                          <thead>
                            <tr><th>Donor</th><th>Amount</th><th>Date</th><th>Status</th></tr>
                          </thead>
                          <tbody>
                            {donors[c.id].map((d) => (
                              <tr key={d.id}>
                                <td><b>{d.donor}</b></td>
                                <td>{inr(d.amount)}</td>
                                <td className="muted small">{when(d.created_at)}</td>
                                <td><span className={"pill " + d.status}>{d.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {!list.length && <p className="muted">No campaigns yet.</p>}
        </div>

        {/* Create new campaign form */}
        <form className="card" onSubmit={create}>
          <h3>New campaign</h3>
          <label>Title</label><input value={f.title} onChange={set("title")} required />
          <label>Description</label><textarea rows="4" value={f.description} onChange={set("description")} required />
          <label>Category</label>
          <select value={f.category} onChange={set("category")}>
            {["education", "health", "food", "disaster", "environment"].map((c) => <option key={c}>{c}</option>)}
          </select>
          <label>Beneficiary</label><input value={f.beneficiary} onChange={set("beneficiary")} />
          <label>Goal (₹)</label><input type="number" min="1" value={f.goal_amount} onChange={set("goal_amount")} required />
          <button className="btn full">Create campaign</button>
        </form>
      </div>
    </>
  );
}
