import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, short, when } from "../api";
import { Check } from "../components.jsx";

export default function Ledger() {
  const [blocks, setBlocks] = useState([]);
  const [v, setV] = useState(null);
  const [params] = useSearchParams();
  const tx = params.get("tx");
  useEffect(() => { api("/ledger/?limit=100").then(setBlocks); api("/ledger/verify/").then(setV); }, []);
  useEffect(() => { if (tx && blocks.length) document.querySelector(".block.hl")?.scrollIntoView({ block: "center" }); }, [tx, blocks]);
  return (
    <>
      <div className="report-heading"><span className="eyebrow">Public records</span><h1>Transaction ledger</h1><p className="muted">A chronological record of donations and campaign spending. Select a transaction to inspect its receipt.</p></div>
      {v && (v.valid
        ? <div className="verify ok"><span style={{ width: 22, display: "inline-flex" }}><Check /></span>Chain verified. All {v.length} blocks match.</div>
        : <div className="verify bad">Tampering detected at block #{v.broken_at}.</div>)}
      <div className="chain">
        {blocks.map((b) => (
          <div key={b.hash} className={"block" + (b.hash === tx ? " hl" : "")}>
            <div className="row between wrap"><b><span className={"kind " + b.kind}>{b.kind === "expenditure" ? "Spending" : b.kind === "donation" ? "Donation" : b.kind}</span> · Block #{b.index}</b><span className="muted small">{when(b.timestamp)}</span></div>
            <div className="small" style={{ marginTop: 6 }}><span className="muted">Hash</span> <span className="hash">{short(b.hash)}</span> <span className="muted">Previous</span> <span className="hash">{short(b.prev_hash)}</span></div>
            <pre>{JSON.stringify(b.payload)}</pre>
          </div>))}
      </div>
    </>
  );
}
