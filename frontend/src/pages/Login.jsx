import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../api";
import styles from "./Login.module.css";
import { Button, Spinner } from "../components/Components";

export default function Login() {
  const { login, user, loading, error } = useAuth();
  const navigate = useNavigate();
  const [username,  setUsername]  = useState("");
  const [password,  setPassword]  = useState("");
  const [accounts,  setAccounts]  = useState([]);
  const [loadingAcc, setLoadingAcc] = useState(true);

  useEffect(() => { if (user) navigate("/"); }, [user]);

  useEffect(() => {
    api.get("/users/accounts")
      .then(r => setAccounts(r.data.accounts || []))
      .catch(() => {})
      .finally(() => setLoadingAcc(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const ok = await login(username.trim(), password);
    if (ok) navigate("/");
  }

  function fillAccount(acc) {
    setUsername(acc.name);
    setPassword("meditrack123");
  }

  const ROLE_COLOR = { CMST:"#1a6b4a", Pharmacist:"#1a4a8a", HSA:"#92580a", Transporter:"#5f5e5a", Regulator:"#a02020" };

  return (
    <div className={styles.page}>
      <div className={styles.left}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>MT</div>
          <span className={styles.brandName}>MediTrack</span>
        </div>
        <h1 className={styles.headline}>Medicine supply chain transparency for Malawi</h1>
        <p className={styles.sub}>Blockchain-verified tracking from CMST warehouses to last-mile health facilities.</p>
        <div className={styles.features}>
          {["Immutable audit trail", "SHA-256 tamper detection", "Real-time discrepancy alerts", "Role-based access control"].map(f => (
            <div key={f} className={styles.feature}><span className={styles.dot} />{f}</div>
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Sign in</h2>
          <p className={styles.formSub}>Use your name and password</p>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>Name or wallet address</label>
              <input
                className={styles.input}
                value={username}
                onChange={e => setUsername(e.target.value)}
                required autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <input
                className={styles.input}
                type="password"
                placeholder="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <Button type="submit" loading={loading} size="lg" className={styles.submitBtn}>
              Sign in
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
