import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Card, Badge, PageHeader, Spinner, Empty } from "../components/Components";

const MOVEMENT_TYPES = ["TRANSFERRED","RECEIVED","DISCREPANCY","DISPENSED"];
const EVT_COLORS     = { TRANSFERRED:"amber", RECEIVED:"green", DISCREPANCY:"red", DISPENSED:"default" };
const FILTERS        = ["All","TRANSFERRED","RECEIVED","DISCREPANCY","DISPENSED"];

export default function Transfers() {
  const [all,     setAll]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("All");

  useEffect(() => {
    api.get("/dashboard/activity")
      .then(r => setAll((r.data.activity || []).filter(e => MOVEMENT_TYPES.includes(e.eventType))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visible = filter === "All" ? all : all.filter(e => e.eventType === filter);
  const counts  = FILTERS.slice(1).reduce((acc, t) => { acc[t] = all.filter(e => e.eventType === t).length; return acc; }, {});

  function fmtDate(ts) {
    return ts ? new Date(ts * 1000).toLocaleString("en-GB", {
      day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit"
    }) : "";
  }

  return (
    <div>
      <PageHeader title="Transfers" subtitle="All custody movements recorded on the blockchain" />

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:"5px 12px", borderRadius:99, border:"1px solid", fontSize:".78rem", cursor:"pointer",
              borderColor: filter===f ? "var(--accent)" : "var(--border)",
              background:  filter===f ? "var(--accent)" : "var(--surface)",
              color:       filter===f ? "#fff" : "var(--text-2)" }}>
            {f === "All" ? `All (${all.length})` : `${f} (${counts[f]||0})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spinner size="lg" color="accent" /></div>
      ) : visible.length === 0 ? (
        <Empty message="No movement events" />
      ) : (
        <Card padding={false}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:".84rem" }}>
            <thead>
              <tr>
                {["Type","Batch","Medicine","Actor","Location","Units","Time"].map(h => (
                  <th key={h} style={{ textAlign:"left", padding:"12px 16px", fontSize:".7rem", fontWeight:500, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".05em", borderBottom:"1px solid var(--border)", background:"var(--surface-2)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((t, i) => (
                <tr key={i} style={{ cursor:"default" }}>
                  <td style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)" }}><Badge type={EVT_COLORS[t.eventType]||"default"}>{t.eventType}</Badge></td>
                  <td style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)" }}><Link to={`/batches/${t.batchId}`} style={{ color:"var(--accent)", fontFamily:"var(--mono)", fontSize:".82rem" }}>{t.batchId}</Link></td>
                  <td style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)" }}>{t.medicineName}</td>
                  <td style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)" }}>{t.actorName}</td>
                  <td style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)", color:"var(--text-2)" }}>{t.location || "—"}</td>
                  <td style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)", fontFamily:"var(--mono)" }}>{t.quantity > 0 ? t.quantity.toLocaleString() : "—"}</td>
                  <td style={{ padding:"11px 16px", borderBottom:"1px solid var(--border)", fontFamily:"var(--mono)", color:"var(--text-2)", fontSize:".78rem" }}>{fmtDate(t.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
