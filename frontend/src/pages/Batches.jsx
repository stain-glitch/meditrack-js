import { useEffect, useRef, useState } from "react";
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

const STATUS_COUNTS = (batches) => STATUSES.slice(1).reduce((acc, s) => {
  acc[s] = batches.filter(b => b.status === s).length;
  return acc;
}, {});

export default function Batches() {
  const [batches,    setBatches]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [modal,      setModal]      = useState(false);
  const [filter,     setFilter]     = useState("all");
  const [search,     setSearch]     = useState("");
  const [sortBy,     setSortBy]     = useState("createdAt");
  const [sortDir,    setSortDir]    = useState("desc");
  const searchRef = useRef(null);

  async function load() {
    setLoading(true);
    try { const r = await api.get("/batches"); setBatches(r.data.batches); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  // Keyboard shortcut: Ctrl+F or / focuses the search bar
  useEffect(() => {
    function onKey(e) {
      if ((e.key === "/" || (e.ctrlKey && e.key === "f")) && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") { setSearch(""); searchRef.current?.blur(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  const q = search.toLowerCase().trim();
  const visible = batches
    .filter(b => {
      const okStatus = filter === "all" || b.status === filter;
      const okSearch = !q
        || b.batchId.toLowerCase().includes(q)
        || b.medicineName.toLowerCase().includes(q)
        || (b.manufacturer || "").toLowerCase().includes(q)
        || (b.registeredBy || "").toLowerCase().includes(q)
        || b.status.toLowerCase().includes(q);
      return okStatus && okSearch;
    })
    .sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy];
      if (typeof av === "string") av = av.toLowerCase(), bv = (bv||"").toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const counts = STATUS_COUNTS(batches);

  function fmtExpiry(ts) {
    if (!ts) return "—";
    const isNear = ts * 1000 < Date.now() + 30*86400000;
    const str    = new Date(ts * 1000).toLocaleDateString("en-GB");
    return isNear ? <span style={{ color:"var(--amber)" }}>{str}</span> : str;
  }

  function SortIcon({ col }) {
    if (sortBy !== col) return <span className={styles.sortIcon}>↕</span>;
    return <span className={styles.sortIconActive}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <div>
      <PageHeader
        title="Batches"
        subtitle={`${batches.length} batch${batches.length !== 1 ? "es" : ""} registered on chain`}
        action={<Button onClick={() => setModal(true)}>Register batch</Button>}
      />

      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={searchRef}
            className={styles.search}
            placeholder="Search batches… (ID, medicine, manufacturer, status)"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.searchClear} onClick={() => { setSearch(""); searchRef.current?.focus(); }} title="Clear">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
        <div className={styles.pills}>
          <button className={`${styles.pill} ${filter==="all" ? styles.pillActive : ""}`} onClick={() => setFilter("all")}>
            All <span className={styles.pillCount}>{batches.length}</span>
          </button>
          {STATUSES.slice(1).map(s => (
            <button key={s} className={`${styles.pill} ${filter===s ? styles.pillActive : ""}`} onClick={() => setFilter(s)}>
              {s} {counts[s] > 0 && <span className={styles.pillCount}>{counts[s]}</span>}
            </button>
          ))}
        </div>
      </div>

      {search && (
        <p className={styles.resultCount}>
          {visible.length === 0
            ? `No results for "${search}"`
            : `${visible.length} result${visible.length !== 1 ? "s" : ""} for "${search}"`}
          {visible.length > 0 && filter !== "all" && ` in ${filter}`}
        </p>
      )}

      <Card padding={false}>
        {loading ? (
          <div className={styles.loading}><Spinner size="lg" color="accent" /></div>
        ) : visible.length === 0 ? (
          <Empty message="No batches found" />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thSortable} onClick={() => toggleSort("batchId")}>Batch ID <SortIcon col="batchId"/></th>
                <th className={styles.thSortable} onClick={() => toggleSort("medicineName")}>Medicine <SortIcon col="medicineName"/></th>
                <th className={styles.thSortable} onClick={() => toggleSort("manufacturer")}>Manufacturer <SortIcon col="manufacturer"/></th>
                <th className={styles.thSortable} onClick={() => toggleSort("remainingQuantity")}>Units remaining <SortIcon col="remainingQuantity"/></th>
                <th className={styles.thSortable} onClick={() => toggleSort("status")}>Status <SortIcon col="status"/></th>
                <th className={styles.thSortable} onClick={() => toggleSort("expiryDate")}>Expiry <SortIcon col="expiryDate"/></th>
              </tr>
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
