import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../hooks/useAuth";
import { Card, RoleBadge, PageHeader, Spinner, Empty, Button, Modal, Input, Select } from "../components/Components";
import styles from "./Users.module.css";

function AddUserModal({ open, onClose, onSuccess }) {
  const init = { name:"", role:"HSA", facility:"", password:"", vehicle:{ numberPlate:"", model:"", manufacturer:"", contractType:"" } };
  const [form, setForm]       = useState(init);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const isTransporter = form.role === "Transporter";
  const setV = k => e => setForm(f => ({ ...f, vehicle: { ...f.vehicle, [k]: e.target.value } }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const payload = { ...form };
      if (!isTransporter) delete payload.vehicle;
      const r = await api.post("/users", payload);
      onSuccess(r.data.credentials, r.data.user);
      onClose(); setForm(init);
    } catch (err) { setError(err.response?.data?.error || "Failed to create user"); }
    finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add new user" width={500}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <Input label="Full name" value={form.name} onChange={set("name")} placeholder="e.g. Dr. Amara Banda" required />
        <Select label="Role" value={form.role} onChange={set("role")}>
          {["CMST","Pharmacist","HSA","Transporter","Regulator"].map(r => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Input label="Facility" value={form.facility} onChange={set("facility")} placeholder="e.g. Mzuzu District Hospital" />
        <Input label="Password (blank = meditrack123)" type="password" value={form.password} onChange={set("password")} placeholder="meditrack123" />

        {isTransporter && (
          <div className={styles.vehicleSection}>
            <p className={styles.vehicleSectionTitle}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="1" y="5" width="14" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 5V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="11.5" cy="12" r="1" fill="currentColor"/></svg>
              Vehicle details
            </p>
            <Input label="Number plate *" value={form.vehicle?.numberPlate||""} onChange={setV("numberPlate")} placeholder="e.g. MLA 1234" required={isTransporter} />
            <div className={styles.vehicleRow}>
              <Input label="Model" value={form.vehicle?.model||""} onChange={setV("model")} placeholder="e.g. Isuzu NPR" />
              <Input label="Manufacturer" value={form.vehicle?.manufacturer||""} onChange={setV("manufacturer")} placeholder="e.g. Isuzu" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Contract type</label>
              <select className={styles.formSelect} value={form.vehicle?.contractType||""} onChange={setV("contractType")}>
                <option value="">— Select —</option>
                {["Government","Private","NGO/Donor","Subcontract","Emergency"].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className={styles.noteBox}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3"/><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>A unique wallet address will be generated automatically for this user.</span>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>Create user + wallet</Button>
        </div>
      </form>
    </Modal>
  );
}

function CredentialsModal({ open, onClose, credentials, user }) {
  const [copied, setCopied] = useState({});

  function copy(key, value) {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(c => ({ ...c, [key]: true }));
      setTimeout(() => setCopied(c => ({ ...c, [key]: false })), 2000);
    });
  }

  if (!credentials) return null;
  const fields = [
    { key:"loginName", label:"Login name",    value: credentials.loginName,  mono:false },
    { key:"wallet",    label:"Wallet address", value: credentials.wallet,     mono:true },
    { key:"privateKey",label:"Private key",    value: credentials.privateKey, mono:true, sensitive:true },
    { key:"password",  label:"Password",       value: credentials.password,   mono:false },
  ];

  return (
    <Modal open={open} onClose={null} title="Save credentials now" width={560}>
      <div className={styles.credBody}>
        <div className={styles.credWarning}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L15 14H1L8 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M8 6v3M8 11v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>The private key is shown once only. Copy and store it securely before closing.</span>
        </div>
        {user && (
          <div className={styles.credUser}>
            <div className={styles.credAvatar}>{user.name?.charAt(0)}</div>
            <div><div className={styles.credName}>{user.name}</div><RoleBadge role={user.role} /></div>
          </div>
        )}
        <div className={styles.credFields}>
          {fields.filter(f => f.value).map(f => (
            <div key={f.key} className={styles.credField}>
              <div className={styles.credFieldHeader}>
                <span className={styles.credLabel}>{f.label}</span>
                {f.sensitive && <span className={styles.sensitiveTag}>sensitive</span>}
              </div>
              <div className={styles.credValue}>
                <span className={`${styles.credValueText} ${f.mono ? "mono" : ""}`}>{f.value}</span>
                <button className={`${styles.copyBtn} ${copied[f.key] ? styles.copyBtnDone : ""}`} onClick={() => copy(f.key, f.value)} type="button">
                  {copied[f.key]
                    ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M11 12v2a1.5 1.5 0 0 1-1.5 1.5H2A1.5 1.5 0 0 1 .5 12.5v-8A1.5 1.5 0 0 1 2 3h2" stroke="currentColor" strokeWidth="1.3"/></svg>
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.credActions}>
          <button className={styles.copyAllBtn} type="button" onClick={() => copy("all", JSON.stringify(credentials, null, 2))}>
            {copied.all ? "Copied" : "Copy all as JSON"}
          </button>
          <Button onClick={onClose}>I have saved these</Button>
        </div>
      </div>
    </Modal>
  );
}

const ROLES      = ["All","CMST","Pharmacist","HSA","Transporter","Regulator"];
const ROLE_COLORS = { CMST:"#1a6b4a", Pharmacist:"#1a4a8a", HSA:"#92580a", Transporter:"#5f5e5a", Regulator:"#a02020" };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users,    setUsers]  = useState([]);
  const [loading,  setLoading] = useState(true);
  const [filter,   setFilter]  = useState("All");
  const [showAdd,  setShowAdd] = useState(false);
  const [creds,    setCreds]   = useState(null);
  const [newUser,  setNewUser] = useState(null);
  const [showCreds,setShowCreds] = useState(false);

  const isCMST = currentUser?.role === "CMST";

  async function load() {
    setLoading(true);
    try {
      const [usersRes, vehiclesRes] = await Promise.all([
        api.get("/users"),
        api.get("/users/transporters/vehicles"),
      ]);
      const vehicleMap = {};
      (vehiclesRes.data.transporters || []).forEach(t => { vehicleMap[t.wallet] = t; });
      const merged = usersRes.data.users.map(u => ({
        ...u, vehicle: vehicleMap[u.wallet] || null,
      }));
      setUsers(merged);
    }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleCreated(credentials, user) {
    setCreds(credentials); setNewUser(user); setShowCreds(true); load();
  }

  const visible = filter === "All" ? users : users.filter(u => u.role === filter);
  const counts  = ROLES.slice(1).reduce((acc, r) => { acc[r] = users.filter(u => u.role === r).length; return acc; }, {});

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${users.length} user${users.length !== 1 ? "s" : ""} registered on chain`}
        action={isCMST && <Button onClick={() => setShowAdd(true)}>Add user</Button>}
      />

      <div className={styles.filterRow}>
        <button className={`${styles.pill} ${filter==="All" ? styles.pillActive : ""}`} onClick={() => setFilter("All")}>
          All <span className={styles.pillCount}>{users.length}</span>
        </button>
        {ROLES.slice(1).map(r => (
          <button key={r} className={`${styles.pill} ${filter===r ? styles.pillActive : ""}`} onClick={() => setFilter(r)}>
            {r} {counts[r] > 0 && <span className={styles.pillCount}>{counts[r]}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}><Spinner size="lg" color="accent" /></div>
      ) : visible.length === 0 ? (
        <Empty message={filter === "All" ? "No users registered" : `No ${filter} users`} />
      ) : (
        <div className={styles.grid}>
          {visible.map(u => (
            <Card key={u.wallet} className={styles.userCard}>
              <div className={styles.avatar} style={{ background:(ROLE_COLORS[u.role]||"#888")+"18", color:ROLE_COLORS[u.role]||"#888" }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.info}>
                <span className={styles.name}>{u.name}</span>
                <span className={styles.facility}>{u.facility || "—"}</span>
                <div className={styles.bottom}>
                  <RoleBadge role={u.role} />
                  <span className={`mono ${styles.wallet}`} title={u.wallet}>
                    {u.wallet.slice(0,8)}…{u.wallet.slice(-4)}
                  </span>
                </div>
                {u.role === "Transporter" && u.vehicle?.number_plate && (
                  <div className={styles.vehicleTags}>
                    {[
                      u.vehicle.number_plate && `🚛 ${u.vehicle.number_plate}`,
                      u.vehicle.model        && u.vehicle.model,
                      u.vehicle.contract_type && u.vehicle.contract_type,
                    ].filter(Boolean).map((tag, i) => (
                      <span key={i} className={styles.vehicleTag}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddUserModal open={showAdd} onClose={() => setShowAdd(false)} onSuccess={handleCreated} />
      <CredentialsModal open={showCreds} onClose={() => { setShowCreds(false); setCreds(null); setNewUser(null); }} credentials={creds} user={newUser} />
    </div>
  );
}
