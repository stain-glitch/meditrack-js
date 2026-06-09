import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../hooks/useAuth";
import { Card, RoleBadge, PageHeader, Spinner, Empty, Button, Modal, Input, Select } from "../components/Components";
import styles from "./Users.module.css";

function AddUserModal({ open, onClose, onSuccess }) {
  const init = { name:"", role:"HSA", facility:"", password:"" };
  const [form, setForm]       = useState(init);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const r = await api.post("/users", form);
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

function UserActionModal({ open, onClose, onSuccess, user, action }) {
  const [reason, setReason]   = useState("");
  const [newPw,  setNewPw]    = useState("");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [result,  setResult]  = useState(null);

  async function handleConfirm() {
    setLoading(true); setError(null);
    try {
      let r;
      if (action === "deactivate") {
        r = await api.patch(`/users/${user.wallet}/deactivate`, { reason });
      } else if (action === "reinstate") {
        r = await api.patch(`/users/${user.wallet}/reinstate`);
      } else if (action === "delete") {
        r = await api.delete(`/users/${user.wallet}`);
      } else if (action === "reset-password") {
        r = await api.patch(`/users/${user.wallet}/reset-password`, { newPassword: newPw });
        setResult(r.data.newPassword);
        onSuccess(); return;
      }
      onSuccess(); onClose();
    } catch (err) { setError(err.response?.data?.error || "Action failed"); }
    finally { setLoading(false); }
  }

  if (!user) return null;

  const configs = {
    deactivate:     { title:"Deactivate account",   color:"var(--amber)", desc:`${user.name} will be suspended and unable to log in. You can reinstate them later.` },
    reinstate:      { title:"Reinstate account",    color:"var(--accent)", desc:`${user.name}'s account will be reactivated and they will be able to log in again.` },
    delete:         { title:"Delete account",       color:"var(--red)",   desc:`This will permanently delete ${user.name}'s account and cannot be undone.` },
    "reset-password":{ title:"Reset password",      color:"var(--blue)",  desc:`A new password will be set for ${user.name}. Leave blank to use the default (meditrack123).` },
  };
  const cfg = configs[action] || {};

  return (
    <Modal open={open} onClose={onClose} title={cfg.title} width={460}>
      <div className={styles.actionModalBody}>
        <div className={styles.actionModalUser}>
          <div className={styles.avatar} style={{ background: cfg.color + "18", color: cfg.color, width:44, height:44 }}>
            {user.name?.charAt(0)}
          </div>
          <div>
            <div className={styles.name}>{user.name}</div>
            <div className={styles.facility}>{user.facility || user.role}</div>
          </div>
        </div>
        <p className={styles.actionModalDesc}>{cfg.desc}</p>
        {action === "deactivate" && (
          <Input label="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Staff on leave, account misuse..." />
        )}
        {action === "reset-password" && (
          <Input label="New password (blank = meditrack123)" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="meditrack123" />
        )}
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.formActions}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant={action === "delete" ? "danger" : "primary"}
            loading={loading}
            onClick={handleConfirm}
          >
            {cfg.title}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function ResetPasswordResultModal({ open, onClose, password, userName }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(password).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }
  return (
    <Modal open={open} onClose={onClose} title="Password reset" width={400}>
      <div className={styles.credBody}>
        <p style={{ fontSize:".85rem", color:"var(--text-2)" }}>New password for <strong>{userName}</strong>:</p>
        <div className={styles.credField}>
          <div className={styles.credValue}>
            <span className={styles.credValueText}>{password}</span>
            <button className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`} onClick={copy} type="button">
              {copied
                ? <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M2 8l4 4 8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                : <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="5" y="1" width="9" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M11 12v2a1.5 1.5 0 0 1-1.5 1.5H2A1.5 1.5 0 0 1 .5 12.5v-8A1.5 1.5 0 0 1 2 3h2" stroke="currentColor" strokeWidth="1.3"/></svg>
              }
            </button>
          </div>
        </div>
        <div className={styles.formActions}><Button onClick={onClose}>Done</Button></div>
      </div>
    </Modal>
  );
}

const ROLES       = ["All","CMST","Pharmacist","HSA","Transporter","Regulator"];
const ROLE_COLORS = { CMST:"#1a6b4a", Pharmacist:"#1a4a8a", HSA:"#92580a", Transporter:"#5f5e5a", Regulator:"#a02020" };

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users,     setUsers]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState("All");
  const [showAdd,   setShowAdd]   = useState(false);
  const [creds,     setCreds]     = useState(null);
  const [newUser,   setNewUser]   = useState(null);
  const [showCreds, setShowCreds] = useState(false);
  const [actionUser,setActionUser]= useState(null);
  const [action,    setAction]    = useState(null);
  const [pwResult,  setPwResult]  = useState(null);

  const isCMST = currentUser?.role === "CMST";

  async function load() {
    setLoading(true);
    try { const r = await api.get("/users"); setUsers(r.data.users); }
    catch (e) { console.error(e); } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleCreated(credentials, user) {
    setCreds(credentials); setNewUser(user); setShowCreds(true); load();
  }

  function openAction(user, act) { setActionUser(user); setAction(act); }

  function handleActionSuccess(resetPw) {
    load();
    if (action === "reset-password" && resetPw) {
      setPwResult(resetPw);
    }
    setActionUser(null); setAction(null);
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
            <Card key={u.wallet} className={`${styles.userCard} ${u.active === false ? styles.userCardInactive : ""}`}>
              <div className={styles.avatar} style={{ background:(ROLE_COLORS[u.role]||"#888")+"18", color:ROLE_COLORS[u.role]||"#888" }}>
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className={styles.info}>
                <div className={styles.nameRow}>
                  <span className={styles.name}>{u.name}</span>
                  {u.active === false && <span className={styles.inactiveTag}>Suspended</span>}
                </div>
                <span className={styles.facility}>{u.facility || "—"}</span>
                <div className={styles.bottom}>
                  <RoleBadge role={u.role} />
                  <span className={`mono ${styles.wallet}`} title={u.wallet}>
                    {u.wallet.slice(0,8)}…{u.wallet.slice(-4)}
                  </span>
                </div>
                {isCMST && u.wallet !== currentUser?.wallet && (
                  <div className={styles.userActions}>
                    {u.active !== false ? (
                      <button className={styles.actionBtn} onClick={() => openAction(u, "deactivate")}>Suspend</button>
                    ) : (
                      <button className={`${styles.actionBtn} ${styles.actionBtnGreen}`} onClick={() => openAction(u, "reinstate")}>Reinstate</button>
                    )}
                    <button className={styles.actionBtn} onClick={() => openAction(u, "reset-password")}>Reset password</button>
                    <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => openAction(u, "delete")}>Delete</button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <AddUserModal open={showAdd} onClose={() => setShowAdd(false)} onSuccess={handleCreated} />
      <CredentialsModal open={showCreds} onClose={() => { setShowCreds(false); setCreds(null); setNewUser(null); }} credentials={creds} user={newUser} />
      <UserActionModal
        open={!!action}
        onClose={() => { setActionUser(null); setAction(null); }}
        onSuccess={(pw) => handleActionSuccess(pw)}
        user={actionUser}
        action={action}
      />
      {pwResult && (
        <ResetPasswordResultModal
          open={!!pwResult}
          onClose={() => setPwResult(null)}
          password={pwResult}
          userName={actionUser?.name || ""}
        />
      )}
    </div>
  );
}
