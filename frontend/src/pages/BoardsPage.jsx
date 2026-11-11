// ============================================================================
// TeamSync — Boards Page (List of all boards)
// ============================================================================
// Shows all boards the user is a member of with a "Create Board" button.
//
// REACT CONCEPTS:
//   - useEffect for data fetching on mount
//   - useState for form modal state
//   - Conditional rendering (loading, empty state, board grid)
//   - Array.map() for rendering lists (MUST include `key` prop)
// ============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { boardsAPI } from "../services/api.js";
import { Button, Modal, Input } from "../components/common/Common.jsx";
import Loader from "../components/common/Common.jsx";
import styles from "./BoardsPage.module.css";
import toast from "react-hot-toast";

export default function BoardsPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // ── Fetch boards on component mount ──
  // The empty dependency array [] means this effect runs ONCE (on mount)
  useEffect(() => {
    fetchBoards();
  }, []);

  const fetchBoards = async () => {
    try {
      const { data } = await boardsAPI.list();
      setBoards(data);
    } catch (error) {
      toast.error("Failed to load boards");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;

    setIsCreating(true);
    try {
      const { data } = await boardsAPI.create({ title: newBoardTitle.trim() });
      setBoards((prev) => [data, ...prev]); // Add to beginning of list
      setShowCreateModal(false);
      setNewBoardTitle("");
      toast.success("Board created!");
      navigate(`/boards/${data.id}`); // Navigate to the new board
    } catch (error) {
      toast.error("Failed to create board");
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) return <Loader fullScreen />;

  return (
    <div className={styles.boardsPage}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Boards</h1>
          <p className={styles.subtitle}>
            {boards.length} board{boards.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowCreateModal(true)}>
          + New Board
        </Button>
      </div>

      {/* ── Board Grid ── */}
      {boards.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📋</span>
          <h2>No boards yet</h2>
          <p>Create your first board to start managing tasks</p>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            Create Board
          </Button>
        </div>
      ) : (
        <div className={styles.boardGrid}>
          {/* KEY PROP: React uses `key` to track which items changed in a list.
              Without key, React re-renders ALL items when the list changes.
              With key, React only updates the items that actually changed. */}
          {boards.map((board, index) => (
            <motion.div
              key={board.id}   // ← ALWAYS use a unique ID, not array index
              className={styles.boardCard}
              onClick={() => navigate(`/boards/${board.id}`)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }} // Stagger animation
              whileHover={{ y: -4, boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}
            >
              {/* Color accent bar at the top */}
              <div
                className={styles.boardCardAccent}
                style={{ backgroundColor: board.background_color }}
              />
              <div className={styles.boardCardBody}>
                <h3 className={styles.boardCardTitle}>{board.title}</h3>
                <p className={styles.boardCardDesc}>
                  {board.description || "No description"}
                </p>
                <div className={styles.boardCardMeta}>
                  <span>{board.member_count || 1} member{(board.member_count || 1) !== 1 ? "s" : ""}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Create Board Modal ── */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create New Board"
        size="sm"
      >
        <form onSubmit={handleCreateBoard}>
          <Input
            id="new-board-title"
            label="Board Title"
            placeholder="e.g., Sprint 24, Product Roadmap"
            value={newBoardTitle}
            onChange={(e) => setNewBoardTitle(e.target.value)}
            required
            autoFocus
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isCreating}>
              Create Board
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
