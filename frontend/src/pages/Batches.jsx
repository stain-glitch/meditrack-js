import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { Card, StatusBadge, Button, Modal, Input, Select, Textarea, PageHeader, Spinner, Empty } from "../components/Components";
import styles from "./Batches.module.css";

function RegisterModal({ open, onClose, onSuccess }) {
  const init = { batchId:"", medicineName:"", manufacturer:"", quantity:"", expiryDate:"", location:"", notes:"" };
  const [form, setForm]       = useState(init);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await api.post("/batches", { ...form, quantity: Number(form.quantity) });
      onSuccess(); onClose(); setForm(init);
    } catch (err) { setError(err.response?.data?.error || "Failed to register batch"); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Register new batch" width={560}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.row2}>
          <Input label="Batch ID"      value={form.batchId}      onChange={set("batchId")}      placeholder="MW-2050" required />
          <Input label="Medicine name" value={form.medicineName} onChange={set("medicineName")} placeholder="Amoxicillin 500mg" required />
        </div>
        <div className={styles.row2}>
          <Input label="Manufacturer"  value={form.manufacturer} onChange={set("manufacturer")} placeholder="Cipla Ltd" />
          <Input label="Quantity"      type="number" min="1" value={form.quantity} onChange={set("quantity")} required />
        </div>
        <div className={styles.row2}>
          <Input label="Expiry date"   type="date" value={form.expiryDate} onChange={set("expiryDate")} />
          <Input label="Location"      value={form.location}     onChange={set("location")}     placeholder="CMST Lilongwe" />
        </div>
        <Textarea label="Notes" value={form.notes} onChange={set("notes")} placeholder="Optional..." />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Register on blockchain</Button>
        </div>
      </form>
    </Modal>
  );
}

const STATUSES = ["all","Registered","InTransit","Received","Flagged","Dispensed"];

export default function Batches() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState(false);
  const [filter,  setFilter]  = useState("all");
  const [search,  setSearch]  = useState("");

  async function load() {
    setLoading(true);
    try { const r = await api.get("/batches"); setBatches(r.data.batches); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const visible = batches.filter(b => {
    const okStatus = filter === "all" || b.status === filter;
    const okSearch = !search || b.batchId.toLowerCase().includes(search.toLowerCase()) || b.medicineName.toLowerCase().includes(search.toLowerCase());
    return okStatus && okSearch;
  });

  function fmtExpiry(ts) {
    if (!ts) return "—";
    const isNear = ts * 1000 < Date.now() + 30*86400000;
    const str    = new Date(ts * 1000).toLocaleDateString("en-GB");
    return isNear ? <span style={{ color:"var(--amber)" }}>{str}</span> : str;
  }

  return (
    <div>
      <PageHeader
        title="Batches"
        subtitle={`${batches.length} batch${batches.length !== 1 ? "es" : ""} registered on chain`}
        action={<Button onClick={() => setModal(true)}>Register batch</Button>}
      />

      <div className={styles.filters}>
        <input className={styles.search} placeholder="Search by ID or medicine..." value={search} onChange={e => setSearch(e.target.value)} />
        <div className={styles.pills}>
          {STATUSES.map(s => (
            <button key={s} className={`${styles.pill} ${filter === s ? styles.pillActive : ""}`} onClick={() => setFilter(s)}>
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div className={styles.loading}><Spinner size="lg" color="accent" /></div>
        ) : visible.length === 0 ? (
          <Empty message="No batches found" />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr><th>Batch ID</th><th>Medicine</th><th>Manufacturer</th><th>Units remaining</th><th>Status</th><th>Expiry</th></tr>
            </thead>
            <tbody>
              {visible.map(b => (
                <tr key={b.batchId}>
                  <td><Link to={`/batches/${b.batchId}`} className={styles.link}>{b.batchId}</Link></td>
                  <td>{b.medicineName}</td>
                  <td className={styles.muted}>{b.manufacturer}</td>
                  <td className="mono">{b.remainingQuantity.toLocaleString()} <span className={styles.muted}>/ {b.quantity.toLocaleString()}</span></td>
                  <td><StatusBadge status={b.status} /></td>
                  <td className="mono">{fmtExpiry(b.expiryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <RegisterModal open={modal} onClose={() => setModal(false)} onSuccess={load} />
    </div>
  );
}
