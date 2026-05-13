import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import api from "../api";
import { Card, StatusBadge, Spinner, PageHeader, Badge } from "../components/Components";
import styles from "./Dashboard.module.css";

const EVT_COLORS = { REGISTERED:"blue", TRANSFERRED:"amber", RECEIVED:"green", DISCREPANCY:"red", FLAGGED:"red", DISPENSED:"default" };
const SEV_COLORS = { high:"red", medium:"amber", low:"blue" };

function useData(url) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(url).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [url]);
  return { data, loading };
}

export default function Dashboard() {
  const { data: statsData,    loading: ls }   = useData("/dashboard/stats");
  const { data: alertsData,   loading: la }   = useData("/dashboard/alerts");
  const { data: activityData, loading: lact } = useData("/dashboard/activity");
  const { data: batchData,    loading: lb }   = useData("/batches");

  const stats    = statsData?.stats;
  const alerts   = alertsData?.alerts?.slice(0, 5) || [];
  const activity = activityData?.activity?.slice(0, 8) || [];
  const batches  = batchData?.batches || [];

  const statusChart = stats
    ? Object.entries(stats.byStatus).map(([name, count]) => ({ name, count }))
    : [];

  const fillRate = stats
    ? Math.round((stats.remainingUnits / Math.max(stats.totalUnits, 1)) * 100)
    : 0;

  function fmtTime(ts) {
    if (!ts) return "";
    return new Date(ts * 1000).toLocaleString("en-GB", { day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit" });
  }

  if (ls) return <div className={styles.loading}><Spinner size="lg" color="accent" /></div>;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Supply chain overview — CMST to last-mile facilities" />

      {/* Metrics */}
      <div className={styles.metrics}>
        {[
          { label:"Total batches",  value: stats?.totalBatches ?? 0,          sub:"on chain",         color:"" },
          { label:"In transit",     value: stats?.byStatus.InTransit ?? 0,    sub:"active shipments", color:"amber" },
          { label:"Flagged",        value: stats?.discrepancies ?? 0,         sub:"need attention",   color: stats?.discrepancies > 0 ? "red" : "" },
          { label:"Expiring <30d",  value: stats?.expiringWithin30Days ?? 0,  sub:"require action",   color: stats?.expiringWithin30Days > 0 ? "amber" : "" },
          { label:"Fill rate",      value: fillRate + "%",                    sub:"units remaining",  color: fillRate < 40 ? "red" : fillRate < 70 ? "amber" : "green" },
        ].map(m => (
          <Card key={m.label} className={styles.metricCard}>
            <span className={styles.metricLabel}>{m.label}</span>
            <span className={`${styles.metricValue} ${m.color ? styles["mv_"+m.color] : ""}`}>{m.value}</span>
            <span className={styles.metricSub}>{m.sub}</span>
          </Card>
        ))}
      </div>

      {/* Middle row */}
      <div className={styles.midRow}>
        <Card className={styles.chartCard}>
          <h3 className={styles.cardTitle}>Status breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={statusChart} barSize={26} margin={{ top:10, right:10, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e2db" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize:11, fill:"#9c9a92" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:"#9c9a92" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize:12, borderRadius:8, border:"1px solid #e4e2db", boxShadow:"none" }} />
              <Bar dataKey="count" fill="#1a6b4a" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.alertsCard}>
          <div className={styles.cardHeaderRow}>
            <h3 className={styles.cardTitle}>Alerts</h3>
            <Link to="/alerts" className={styles.viewAll}>View all</Link>
          </div>
          {la ? <Spinner size="sm" /> : alerts.length === 0 ? (
            <p className={styles.empty}>No active alerts</p>
          ) : (
            <div className={styles.alertList}>
              {alerts.map((a, i) => (
                <div key={i} className={styles.alertItem}>
                  <span className={`${styles.dot} ${styles["dot_"+(SEV_COLORS[a.severity]||"default")]}`} />
                  <div className={styles.alertBody}>
                    <span className={styles.alertMsg}>{a.message}</span>
                    <span className={styles.alertMeta}>
                      <Link to={`/batches/${a.batchId}`} className={styles.batchLink}>{a.batchId}</Link>
                      {" · "}{a.medicineName}
                    </span>
                  </div>
                  <Badge type={SEV_COLORS[a.severity]}>{a.severity}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom row */}
      <div className={styles.bottomRow}>
        <Card>
          <div className={styles.cardHeaderRow}>
            <h3 className={styles.cardTitle}>Recent batches</h3>
            <Link to="/batches" className={styles.viewAll}>View all</Link>
          </div>
          {lb ? <Spinner size="sm" /> : (
            <table className={styles.table}>
              <thead><tr><th>Batch ID</th><th>Medicine</th><th>Remaining</th><th>Status</th><th>Expiry</th></tr></thead>
              <tbody>
                {batches.slice(0, 6).map(b => (
                  <tr key={b.batchId}>
                    <td><Link to={`/batches/${b.batchId}`} className={styles.batchLink}>{b.batchId}</Link></td>
                    <td>{b.medicineName}</td>
                    <td className="mono">{b.remainingQuantity.toLocaleString()} / {b.quantity.toLocaleString()}</td>
                    <td><StatusBadge status={b.status} /></td>
                    <td className="mono" style={b.expiryDate * 1000 < Date.now() + 30*86400000 ? { color:"var(--amber)" } : {}}>
                      {b.expiryDate ? new Date(b.expiryDate * 1000).toLocaleDateString("en-GB") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card className={styles.feedCard}>
          <div className={styles.cardHeaderRow}>
            <h3 className={styles.cardTitle}>Live activity</h3>
            <Link to="/activity" className={styles.viewAll}>View all</Link>
          </div>
          {lact ? <Spinner size="sm" /> : (
            <div className={styles.feed}>
              {activity.map((e, i) => (
                <div key={i} className={styles.feedItem}>
                  <span className={`${styles.dot} ${styles["dot_"+(EVT_COLORS[e.eventType]||"default")]}`} />
                  <div className={styles.feedBody}>
                    <span className={styles.feedMsg}>
                      <Badge type={EVT_COLORS[e.eventType]||"default"}>{e.eventType}</Badge>
                      {" "}<Link to={`/batches/${e.batchId}`} className={styles.batchLink}>{e.batchId}</Link>
                    </span>
                    <span className={styles.feedMeta}>{e.actorName}{e.location ? ` · ${e.location}` : ""}</span>
                  </div>
                  <span className={styles.feedTime}>{fmtTime(e.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
