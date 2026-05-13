import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Card, Badge, PageHeader, Spinner, Empty } from "../components/Components";

const EVT_COLORS = { REGISTERED:"blue", TRANSFERRED:"amber", RECEIVED:"green", DISCREPANCY:"red", FLAGGED:"red", DISPENSED:"default" };
const MOVEMENT   = ["TRANSFERRED","RECEIVED","DISCREPANCY","DISPENSED"];

export default function Activity() {
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState("all");

  useEffect(() => {
    api.get("/dashboard/activity")
      .then(r => setActivity(r.data.activity || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const FILTERS = ["all", "movements", "REGISTERED", "FLAGGED"];
  const visible  = activity.filter(e => {
    if (filter === "all")      return true;
    if (filter === "movements") return MOVEMENT.includes(e.eventType);
    return e.eventType === filter;
  });

  function fmtDate(ts) {
    return ts ? new Date(ts * 1000).toLocaleString("en-GB", {
      day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"
    }) : "—";
  }

  // Group by day
  const groups = {};
  for (const e of visible) {
    const day = e.timestamp ? new Date(e.timestamp * 1000).toLocaleDateString("en-GB", { day:"2-digit", month:"long", year:"numeric" }) : "Unknown";
    if (!groups[day]) groups[day] = [];
    groups[day].push(e);
  }

  return (
    <div>
      <PageHeader title="Activity" subtitle="All blockchain events across every batch" />

      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:16 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding:"5px 12px", borderRadius:99, border:"1px solid", fontSize:".78rem", cursor:"pointer",
              borderColor: filter===f ? "var(--accent)" : "var(--border)",
              background:  filter===f ? "var(--accent)" : "var(--surface)",
              color:       filter===f ? "#fff" : "var(--text-2)" }}>
            {f === "all" ? "All" : f === "movements" ? "Movements only" : f}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}><Spinner size="lg" color="accent" /></div>
      ) : visible.length === 0 ? (
        <Empty message="No events found" />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
          {Object.entries(groups).map(([day, events]) => (
            <div key={day}>
              <p style={{ fontSize:".75rem", fontWeight:500, color:"var(--text-3)", textTransform:"uppercase", letterSpacing:".05em", marginBottom:8 }}>{day}</p>
              <Card padding={false}>
                {events.map((e, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"11px 16px", borderBottom: i < events.length-1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background: e.eventType==="RECEIVED"||e.eventType==="REGISTERED" ? "var(--accent)" : e.eventType==="TRANSFERRED"||e.eventType==="DISPENSED" ? "var(--amber)" : "var(--red)", flexShrink:0, marginTop:5 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", fontSize:".83rem" }}>
                        <Badge type={EVT_COLORS[e.eventType]||"default"}>{e.eventType}</Badge>
                        <Link to={`/batches/${e.batchId}`} style={{ color:"var(--accent)", fontFamily:"var(--mono)", fontSize:".82rem" }}>{e.batchId}</Link>
                        {e.medicineName && <span style={{ color:"var(--text-2)", fontSize:".82rem" }}>{e.medicineName}</span>}
                      </div>
                      <div style={{ fontSize:".78rem", color:"var(--text-2)", marginTop:3 }}>
                        {e.actorName}{e.location ? ` · ${e.location}` : ""}
                        {e.quantity > 0 ? ` · ${e.quantity.toLocaleString()} units` : ""}
                      </div>
                      {e.notes && <div style={{ fontSize:".75rem", color:"var(--text-3)", marginTop:3 }}>{e.notes}</div>}
                      <div style={{ fontSize:".68rem", color:"var(--text-3)", fontFamily:"var(--mono)", marginTop:4 }}>{e.hash?.slice(0,24)}…</div>
                    </div>
                    <span style={{ fontSize:".72rem", color:"var(--text-3)", fontFamily:"var(--mono)", whiteSpace:"nowrap", marginTop:2 }}>{fmtDate(e.timestamp)}</span>
                  </div>
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
