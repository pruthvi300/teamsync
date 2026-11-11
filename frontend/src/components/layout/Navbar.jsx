// ============================================================================
// TeamSync — Navbar Component
// ============================================================================
// Top navigation bar with app logo, navigation links, and user menu.
//
// REACT CONCEPTS DEMONSTRATED:
//   - useCallback: Memoize the logout handler (prevents child re-renders)
//   - Conditional rendering: Show different UI based on auth state
//   - React Router Link: Client-side navigation (no page reload)
// ============================================================================

import { useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuthStore from "../../store/authStore.js";
import { Avatar } from "../common/Common.jsx";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  // useCallback: Memoize the function so it doesn't get recreated every render
  // This matters when passing callbacks as props to child components —
  // without useCallback, the child would re-render every time the parent renders
  // because the function reference would be different each time.
  const handleLogout = useCallback(() => {
    logout();
    navigate("/login");
  }, [logout, navigate]);

  return (
    <nav className={styles.navbar}>
      {/* ── Logo / Brand ── */}
      <Link to="/boards" className={styles.brand}>
        <span className={styles.logo}>⚡</span>
        <span className={styles.brandText}>TeamSync</span>
      </Link>

      {/* ── Navigation Links ── */}
      <div className={styles.navLinks}>
        <Link to="/boards" className={styles.navLink}>
          Boards
        </Link>
        <Link to="/dashboard" className={styles.navLink}>
          Dashboard
        </Link>
      </div>

      {/* ── User Menu ── */}
      {user && (
        <div className={styles.userSection}>
          <Avatar
            username={user.username}
            color={user.avatar_color}
            size={32}
          />
          <span className={styles.username}>{user.username}</span>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}
