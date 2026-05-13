import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { RoleBadge } from "./Components";
import styles from "./Layout.module.css";

const NAV = [
  { section: "Overview",     items: [{ to: "/",          label: "Dashboard",  Icon: IconGrid  }] },
  { section: "Supply Chain", items: [{ to: "/batches",   label: "Batches",    Icon: IconBox   },
                                      { to: "/transfers", label: "Transfers",  Icon: IconArrow }] },
  { section: "Analytics",    items: [{ to: "/alerts",    label: "Alerts",     Icon: IconBell  },
                                      { to: "/activity",  label: "Activity",   Icon: IconClock }] },
  { section: "Admin",        items: [{ to: "/users",     label: "Users",      Icon: IconUser  }] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>MT</span>
          <span className={styles.logoText}>MediTrack</span>
        </div>
        <nav className={styles.nav}>
          {NAV.map(g => (
            <div key={g.section} className={styles.navGroup}>
              <span className={styles.navSection}>{g.section}</span>
              {g.items.map(({ to, label, Icon }) => (
                <NavLink key={to} to={to} end={to === "/"}
                  className={({ isActive }) => `${styles.navItem} ${isActive ? styles.navItemActive : ""}`}>
                  <Icon />{label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFooter}>
          <div className={styles.userCard}>
            <div className={styles.userAvatar}>{user?.name?.charAt(0) || "?"}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.name}</span>
              <RoleBadge role={user?.role} />
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={() => { logout(); navigate("/login"); }} title="Sign out">
            <IconLogout />
          </button>
        </div>
      </aside>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

function IconGrid()   { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/></svg>; }
function IconBox()    { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M2 5l6 3m0 6V8m6-3L8 8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconArrow()  { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconBell()   { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 1a5 5 0 0 1 5 5v3l1 2H2l1-2V6a5 5 0 0 1 5-5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M6.5 13a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4"/></svg>; }
function IconClock()  { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconUser()   { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M2 14c0-3.3 2.7-5 6-5s6 1.7 6 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }
function IconLogout() { return <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M11 11l3-3-3-3M14 8H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
