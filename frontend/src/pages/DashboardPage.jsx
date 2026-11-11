// ============================================================================
// TeamSync — Dashboard Page (Analytics)
// ============================================================================
// Shows an overview of all boards and task statistics.
//
// REACT CONCEPTS:
//   - useMemo for computed/derived values
//   - Multiple API calls in useEffect
//   - Data transformation for display
// ============================================================================

import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { boardsAPI } from "../services/api.js";
import Loader from "../components/common/Common.jsx";
import styles from "./DashboardPage.module.css";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data } = await boardsAPI.list();
        setBoards(data);
      } catch {
        // Silently handle errors for dashboard
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // useMemo: Compute statistics only when boards data changes
  // Without useMemo, these calculations run on EVERY render
  // With useMemo, they only recalculate when the `boards` array changes
  const stats = useMemo(() => ({
    totalBoards: boards.length,
    // Summing member_count would count the same person once per board, so report per-board figures instead.
    sharedBoards: boards.filter((b) => (b.member_count || 1) > 1).length,
    largestTeam: boards.reduce((max, b) => Math.max(max, b.member_count || 1), 0),
  }), [boards]);

  if (isLoading) return <Loader fullScreen />;

  return (
    <div className={styles.dashboardPage}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.subtitle}>Overview of your workspace</p>

      {/* ── Stats Cards ── */}
      <div className={styles.statsGrid}>
        {[
          { label: "Total Boards", value: stats.totalBoards, icon: "📋", color: "#6366f1" },
          { label: "Shared Boards", value: stats.sharedBoards, icon: "🤝", color: "#22c55e" },
          { label: "Largest Team", value: stats.largestTeam, icon: "👥", color: "#f59e0b" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            className={styles.statCard}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <span className={styles.statIcon}>{stat.icon}</span>
            <div>
              <p className={styles.statValue}>{stat.value}</p>
              <p className={styles.statLabel}>{stat.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Recent Boards ── */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Recent Boards</h2>
        <div className={styles.recentList}>
          {boards.slice(0, 5).map((board) => (
            <div
              key={board.id}
              className={styles.recentItem}
              onClick={() => navigate(`/boards/${board.id}`)}
            >
              <div
                className={styles.recentDot}
                style={{ backgroundColor: board.background_color }}
              />
              <div>
                <p className={styles.recentTitle}>{board.title}</p>
                <p className={styles.recentMeta}>
                  {board.member_count || 1} {(board.member_count || 1) === 1 ? "member" : "members"}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
