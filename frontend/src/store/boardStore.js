// ============================================================================
// TeamSync — Board store (Zustand)
// ============================================================================
// Holds the open board: `board` (metadata + members) and `columns` (each with
// an ordered `tasks` array). Local actions call the API and update state;
// `applyRemote*` actions apply Socket.IO events from other users.
// ============================================================================

import { create } from "zustand";
import toast from "react-hot-toast";
import { boardsAPI, columnsAPI, errorMessage, tasksAPI } from "../services/api.js";

const byPosition = (a, b) => a.position - b.position;

function normaliseColumns(columns) {
  return [...columns].sort(byPosition).map((col) => ({ ...col, tasks: [...(col.tasks || [])].sort(byPosition) }));
}

/** Pure helper: return new columns with the task moved. Never mutates its input. */
export function moveTaskInColumns(columns, taskId, destColumnId, newPosition) {
  const moved = columns.flatMap((c) => c.tasks).find((t) => t.id === taskId);
  if (!moved) return columns;
  const renumber = (tasks) => tasks.map((t, i) => (t.position === i ? t : { ...t, position: i }));
  return columns.map((col) => {
    const hadTask = col.tasks.some((t) => t.id === taskId);
    if (col.id !== destColumnId && !hadTask) return col;
    const tasks = col.tasks.filter((t) => t.id !== taskId);
    if (col.id === destColumnId) {
      tasks.splice(Math.min(newPosition, tasks.length), 0, { ...moved, column_id: destColumnId });
    }
    return { ...col, tasks: renumber(tasks) };
  });
}

const mapTasks = (columns, fn) => columns.map((col) => ({ ...col, tasks: col.tasks.map(fn) }));

const useBoardStore = create((set, get) => ({
  board: null,
  columns: [],
  isLoading: false,
  error: null,

  loadBoard: async (boardId, { silent = false } = {}) => {
    if (!silent) set({ isLoading: true, error: null });
    try {
      const { data } = await boardsAPI.get(boardId);
      set({ board: data, columns: normaliseColumns(data.columns || []), isLoading: false, error: null });
    } catch (error) {
      set({ error: errorMessage(error, "Failed to load board"), isLoading: false });
    }
  },

  clearBoard: () => set({ board: null, columns: [], isLoading: false, error: null }),

  // ── Columns ──
  addColumn: async (title, boardId) => {
    try {
      const { data } = await columnsAPI.create({ title, board_id: boardId });
      set((s) => ({ columns: [...s.columns, { ...data, tasks: [] }] }));
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add column"));
    }
  },

  deleteColumn: async (columnId) => {
    try {
      await columnsAPI.delete(columnId);
      set((s) => ({ columns: s.columns.filter((c) => c.id !== columnId) }));
      toast.success("Column deleted");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete column"));
    }
  },

  // ── Tasks ──
  addTask: async (taskData) => {
    try {
      const { data } = await tasksAPI.create(taskData);
      get().applyRemoteTaskCreate(data);
      return data;
    } catch (error) {
      toast.error(errorMessage(error, "Failed to create task"));
      return null;
    }
  },

  updateTask: async (taskId, updateData) => {
    try {
      const { data } = await tasksAPI.update(taskId, updateData);
      get().applyRemoteTaskUpdate(data);
      return data;
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update task"));
      return null;
    }
  },

  deleteTask: async (taskId) => {
    try {
      await tasksAPI.delete(taskId);
      get().applyRemoteTaskDelete(taskId);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete task"));
    }
  },

  /** Optimistic move: update the UI first, roll back if the API rejects it. */
  moveTask: async (taskId, destColumnId, newPosition) => {
    const snapshot = get().columns;
    set({ columns: moveTaskInColumns(snapshot, taskId, destColumnId, newPosition) });
    try {
      await tasksAPI.move(taskId, { column_id: destColumnId, position: newPosition });
    } catch (error) {
      set({ columns: snapshot });
      toast.error(errorMessage(error, "Failed to move task"));
    }
  },

  // ── Members ──
  addMember: async (email) => {
    const { board } = get();
    try {
      const { data } = await boardsAPI.addMember(board.id, email);
      set({ board: { ...board, members: data.members } });
      toast.success("Member added");
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add member"));
      return false;
    }
  },

  // ── Remote events (also reused by local actions, so they must be idempotent) ──
  applyRemoteTaskCreate: (task) =>
    set((s) => ({
      columns: s.columns.map((col) =>
        col.id === task.column_id && !col.tasks.some((t) => t.id === task.id)
          ? { ...col, tasks: [...col.tasks, task].sort(byPosition) }
          : col,
      ),
    })),

  applyRemoteTaskUpdate: (task) =>
    set((s) => ({ columns: mapTasks(s.columns, (t) => (t.id === task.id ? { ...t, ...task } : t)) })),

  applyRemoteTaskDelete: (taskId) =>
    set((s) => ({
      columns: s.columns.map((col) =>
        col.tasks.some((t) => t.id === taskId)
          ? { ...col, tasks: col.tasks.filter((t) => t.id !== taskId).map((t, i) => ({ ...t, position: i })) }
          : col,
      ),
    })),

  applyRemoteTaskMove: ({ task_id, to_column, position }) =>
    set((s) => ({ columns: moveTaskInColumns(s.columns, task_id, to_column, position) })),

  applyCommentCount: (taskId, delta) =>
    set((s) => ({
      columns: mapTasks(s.columns, (t) =>
        t.id === taskId ? { ...t, comment_count: Math.max(0, (t.comment_count || 0) + delta) } : t,
      ),
    })),
}));

export default useBoardStore;
