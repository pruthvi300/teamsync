// ============================================================================
// TeamSync — Layout Component
// ============================================================================
// Wraps all protected pages with Navbar + Sidebar structure.
// Uses <Outlet /> to render the current page inside the layout.
//
// LAYOUT PATTERN:
//   ┌──────────────────────────────────────┐
//   │            NAVBAR (top)              │
//   ├──────────┬───────────────────────────┤
//   │ SIDEBAR  │                           │
//   │ (left)   │     PAGE CONTENT          │
//   │          │     (<Outlet />)          │
//   │          │                           │
//   └──────────┴───────────────────────────┘
// ============================================================================

import { Outlet } from "react-router-dom";
import Navbar from "./Navbar.jsx";
import styles from "./Layout.module.css";

export default function Layout() {
  return (
    <div className={styles.layout}>
      {/* ── Top Navigation Bar ── */}
      <Navbar />

      {/* ── Main Content Area ── */}
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
