// ── Alerts.jsx ───────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Card, Badge, PageHeader, Spinner, Empty } from "../components/Components";

const SEV_COLOR  = { high:"red", medium:"amber", low:"blue" };
const TYPE_LABEL = { DISCREPANCY:"Discrepancy", EXPIRY:"Expiry", IN_TRANSIT:"In Transit" };

export function Alerts() {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all");

  useEffect(() => {
    api.get("/dashboard/alerts")
      .then(r => setAlerts(r.data.alerts))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const FILTERS = ["all","high","medium","low"];
  const visible  = filter === "all" ? alerts : alerts.filter(a => a.severity === filter);
  const counts   = FILTERS.slice(1).reduce((acc, s) => { acc[s] = alerts.filter(a => a.severity === s).length; return acc; }, {});

  return (
    <div>
      <PageHeader title="Alerts" subtitle={`${alerts.length} active alert${alerts.length !== 1 ? "s" : ""}`} />
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:"5px 12px", borderRadius:99, border:"1px solid", fontSize:".78rem", cursor:"pointer",
              borderColor: filter===f ? "var(--accent)" : "var(--border)",
              background:  filter===f ? "var(--accent)" : "var(--surface)",
              color:       filter===f ? "#fff" : "var(--text-2)" }}>
            {f === "all" ? `All (${alerts.length})` : `${f.charAt(0).toUpperCase()+f.slice(1)} (${counts[f]||0})`}
          </button>
        ))}
      </div>
      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spinner size="lg" color="accent" /></div>
      ) : visible.length === 0 ? (
        <Card><Empty message="No alerts" /></Card>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {visible.map((a, i) => (
            <Card key={i} padding={false}>
              <div style={{ display:"flex", overflow:"hidden" }}>
                <div style={{ width:4, background: a.severity==="high"?"var(--red)":a.severity==="medium"?"var(--amber)":"var(--blue)", flexShrink:0 }} />
                <div style={{ flex:1, padding:"14px 16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
                    <Badge type={SEV_COLOR[a.severity]}>{a.severity}</Badge>
                    <Badge type="default">{TYPE_LABEL[a.type]||a.type}</Badge>
                  </div>
                  <p style={{ fontSize:".875rem", marginBottom:6 }}>{a.message}</p>
                  <div style={{ fontSize:".78rem", color:"var(--text-3)" }}>
                    <Link to={`/batches/${a.batchId}`} style={{ color:"var(--accent)", fontFamily:"var(--mono)" }}>{a.batchId}</Link>
                    {" · "}{a.medicineName}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
