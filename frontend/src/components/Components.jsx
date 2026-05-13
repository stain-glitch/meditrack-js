import styles from "./Components.module.css";

export function Badge({ type = "default", children }) {
  return <span className={`${styles.badge} ${styles["badge_" + type]}`}>{children}</span>;
}

export function StatusBadge({ status }) {
  const map = { Registered:"blue", InTransit:"amber", Received:"green", Dispensed:"default", Flagged:"red" };
  return <Badge type={map[status] || "default"}>{status}</Badge>;
}

export function RoleBadge({ role }) {
  const map = { CMST:"green", Pharmacist:"blue", HSA:"amber", Transporter:"default", Regulator:"red" };
  return <Badge type={map[role] || "default"}>{role}</Badge>;
}

export function Button({ variant="primary", size="md", disabled, loading, onClick, type="button", children, className="" }) {
  return (
    <button type={type} disabled={disabled || loading} onClick={onClick}
      className={`${styles.btn} ${styles["btn_"+variant]} ${styles["btn_"+size]} ${className}`}>
      {loading ? <Spinner size="sm" color={variant==="primary"?"white":"dark"} /> : children}
    </button>
  );
}

export function Card({ children, className="", padding=true }) {
  return <div className={`${styles.card} ${padding ? styles.cardPad : ""} ${className}`}>{children}</div>;
}

export function Spinner({ size="md", color="dark" }) {
  return <span className={`${styles.spinner} ${styles["spinner_"+size]} ${styles["spinner_"+color]}`} />;
}

export function Input({ label, error, ...props }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <input className={`${styles.input} ${error ? styles.inputError : ""}`} {...props} />
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

export function Select({ label, error, children, ...props }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <select className={`${styles.input} ${error ? styles.inputError : ""}`} {...props}>{children}</select>
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

export function Textarea({ label, error, ...props }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <textarea className={`${styles.input} ${styles.textarea} ${error ? styles.inputError : ""}`} {...props} />
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width=520 }) {
  if (!open) return null;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.modalClose} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className={styles.modalBody}>{children}</div>
      </div>
    </div>
  );
}

export function Empty({ message="No data found" }) {
  return <div className={styles.empty}>{message}</div>;
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className={styles.pageHeader}>
      <div>
        <h1 className={styles.pageTitle}>{title}</h1>
        {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
