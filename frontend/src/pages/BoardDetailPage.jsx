// ============================================================================
// BoardDetailPage — the Kanban board
// ============================================================================
// - Drag and drop with @dnd-kit: every column is a drop target (so empty
//   columns and "drop at the end" work) and its tasks are sortable.
// - Moves are optimistic (see boardStore.moveTask) and synced live to other
//   members through useWebSocket.
// ============================================================================

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import useBoardStore from "../store/boardStore.js";
import useAuthStore from "../store/authStore.js";
import useWebSocket from "../hooks/useWebSocket.js";
import { commentsAPI, errorMessage } from "../services/api.js";
import Loader, { Avatar, Badge, Button, Input, Modal } from "../components/common/Common.jsx";
import styles from "./BoardDetailPage.module.css";

export default function BoardDetailPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const {
    board,
    columns,
    isLoading,
    error,
    loadBoard,
    clearBoard,
    moveTask,
    addTask,
    addColumn,
    deleteColumn,
    deleteTask,
    updateTask,
    addMember,
  } = useBoardStore();

  const [activeTaskId, setActiveTaskId] = useState(null);
  const [addingToColumn, setAddingToColumn] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [openTaskId, setOpenTaskId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");

  useWebSocket(boardId);

  useEffect(() => {
    loadBoard(boardId);
    return () => clearBoard();
  }, [boardId, loadBoard, clearBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findTask = useCallback(
    (taskId) => {
      for (const col of columns) {
        const task = col.tasks.find((t) => t.id === taskId);
        if (task) return task;
      }
      return null;
    },
    [columns],
  );

  const handleDragEnd = useCallback(
    ({ active, over }) => {
      setActiveTaskId(null);
      if (!over || active.id === over.id) return;
      // `over` is either a task (insert at its index) or a column (append to the end).
      const overColumn = columns.find((c) => c.id === over.id);
      const destColumn = overColumn || columns.find((c) => c.tasks.some((t) => t.id === over.id));
      if (!destColumn) return;
      const position = overColumn ? overColumn.tasks.length : destColumn.tasks.findIndex((t) => t.id === over.id);
      const task = findTask(active.id);
      if (task && (task.column_id !== destColumn.id || task.position !== position)) {
        moveTask(active.id, destColumn.id, position);
      }
    },
    [columns, findTask, moveTask],
  );

  const submitTask = async (columnId) => {
    if (!newTaskTitle.trim()) return;
    if (await addTask({ title: newTaskTitle.trim(), column_id: columnId })) {
      setNewTaskTitle("");
      setAddingToColumn(null);
    }
  };

  const submitColumn = async () => {
    if (!newColumnTitle.trim()) return;
    await addColumn(newColumnTitle.trim(), boardId);
    setNewColumnTitle("");
    setShowAddColumn(false);
  };

  const submitInvite = async (e) => {
    e.preventDefault();
    if (inviteEmail.trim() && (await addMember(inviteEmail.trim()))) setInviteEmail("");
  };

  const activeTask = activeTaskId ? findTask(activeTaskId) : null;
  const openTask = openTaskId ? findTask(openTaskId) : null;
  const isOwner = board && user && board.owner_id === user.id;

  if (isLoading) return <Loader fullScreen />;
  if (error) {
    return (
      <div className={styles.errorState}>
        <h2>Failed to load board</h2>
        <p>{error}</p>
        <Button variant="primary" onClick={() => navigate("/boards")}>
          Back to Boards
        </Button>
      </div>
    );
  }
  if (!board) return null;

  return (
    <div className={styles.boardPage}>
      <div className={styles.boardHeader}>
        <div>
          <h1 className={styles.boardTitle}>{board.title}</h1>
          {board.description && <p className={styles.boardDesc}>{board.description}</p>}
        </div>
        <div className={styles.boardActions}>
          {isOwner && (
            <form className={styles.inviteForm} onSubmit={submitInvite}>
              <Input
                id="invite-email"
                type="email"
                placeholder="Invite by email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                aria-label="Invite member by email"
              />
              <Button size="sm" type="submit" disabled={!inviteEmail.trim()}>
                Invite
              </Button>
            </form>
          )}
          <div className={styles.memberAvatars}>
            {board.members?.slice(0, 5).map((m) => (
              <Avatar key={m.id} username={m.username} color={m.avatar_color} size={28} />
            ))}
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => setActiveTaskId(active.id)}
        onDragCancel={() => setActiveTaskId(null)}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.columnsContainer}>
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              isAdding={addingToColumn === column.id}
              newTaskTitle={newTaskTitle}
              onStartAdd={() => {
                setAddingToColumn(column.id);
                setNewTaskTitle("");
              }}
              onNewTaskTitleChange={setNewTaskTitle}
              onSubmitTask={() => submitTask(column.id)}
              onCancelAdd={() => setAddingToColumn(null)}
              onTaskClick={(task) => setOpenTaskId(task.id)}
              onDeleteTask={(task) => window.confirm(`Delete "${task.title}"?`) && deleteTask(task.id)}
              onDeleteColumn={() =>
                window.confirm(`Delete column "${column.title}" and its ${column.tasks.length} task(s)?`) &&
                deleteColumn(column.id)
              }
            />
          ))}

          <div className={styles.addColumnContainer}>
            {showAddColumn ? (
              <div className={styles.addColumnForm}>
                <Input
                  id="new-column"
                  placeholder="Column title..."
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitColumn();
                    if (e.key === "Escape") setShowAddColumn(false);
                  }}
                />
                <div className={styles.addColumnActions}>
                  <Button size="sm" variant="primary" onClick={submitColumn}>
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddColumn(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button className={styles.addColumnBtn} onClick={() => setShowAddColumn(true)}>
                + Add Column
              </button>
            )}
          </div>
        </div>

        <DragOverlay>{activeTask ? <TaskCardUI task={activeTask} isDragging /> : null}</DragOverlay>
      </DndContext>

      <Modal isOpen={!!openTask} onClose={() => setOpenTaskId(null)} title={openTask?.title || ""} size="md">
        {openTask && (
          <TaskDetailView
            key={openTask.id}
            task={openTask}
            members={board.members || []}
            currentUserId={user?.id}
            onSave={async (changes) => {
              if (await updateTask(openTask.id, changes)) toast.success("Task updated");
            }}
            onClose={() => setOpenTaskId(null)}
          />
        )}
      </Modal>
    </div>
  );
}

const KanbanColumn = memo(function KanbanColumn({
  column,
  isAdding,
  newTaskTitle,
  onStartAdd,
  onNewTaskTitleChange,
  onSubmitTask,
  onCancelAdd,
  onTaskClick,
  onDeleteTask,
  onDeleteColumn,
}) {
  // Registering the column as a droppable is what makes empty columns accept tasks.
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const taskIds = useMemo(() => column.tasks.map((t) => t.id), [column.tasks]);
  const atLimit = column.wip_limit > 0 && column.tasks.length >= column.wip_limit;

  return (
    <div className={styles.column}>
      <div className={styles.columnHeader}>
        <div className={styles.columnTitleRow}>
          <div className={styles.columnDot} style={{ backgroundColor: column.color }} />
          <h3 className={styles.columnTitle}>{column.title}</h3>
          <span className={styles.columnCount}>{column.tasks.length}</span>
          {column.wip_limit > 0 && <span className={styles.wipLimit}>/ {column.wip_limit}</span>}
          <button className={styles.columnDeleteBtn} onClick={onDeleteColumn} aria-label={`Delete column ${column.title}`}>
            🗑
          </button>
        </div>
      </div>

      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className={`${styles.taskList} ${isOver ? styles.taskListOver : ""}`}>
          {column.tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} onClick={onTaskClick} onDelete={onDeleteTask} />
          ))}
        </div>
      </SortableContext>

      {isAdding ? (
        <div className={styles.addTaskForm}>
          <Input
            id={`new-task-${column.id}`}
            placeholder="Task title..."
            value={newTaskTitle}
            onChange={(e) => onNewTaskTitleChange(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSubmitTask();
              if (e.key === "Escape") onCancelAdd();
            }}
          />
          <div className={styles.addTaskActions}>
            <Button size="sm" variant="primary" onClick={onSubmitTask}>
              Add Task
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancelAdd} aria-label="Cancel">
              ✕
            </Button>
          </div>
        </div>
      ) : (
        <button className={styles.addTaskBtn} onClick={onStartAdd} disabled={atLimit}>
          {atLimit ? "WIP limit reached" : "+ Add a task"}
        </button>
      )}
    </div>
  );
});

const SortableTaskCard = memo(function SortableTaskCard({ task, onClick, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCardUI task={task} onClick={() => onClick(task)} onDelete={() => onDelete(task)} />
    </div>
  );
});

const PRIORITY_CLASS = {
  critical: styles.priorityCritical,
  high: styles.priorityHigh,
  medium: styles.priorityMedium,
  low: styles.priorityLow,
};

const TaskCardUI = memo(function TaskCardUI({ task, onClick, onDelete, isDragging }) {
  return (
    <motion.div
      className={`${styles.taskCard} ${isDragging ? styles.taskCardDragging : ""}`}
      onClick={onClick}
      whileHover={{ y: -2 }}
    >
      <div className={`${styles.taskPriority} ${PRIORITY_CLASS[task.priority] || ""}`} />
      <div className={styles.taskCardBody}>
        <p className={styles.taskTitle}>{task.title}</p>
        {task.labels?.length > 0 && (
          <div className={styles.taskLabels}>
            {task.labels.map((label) => (
              <Badge key={label}>{label}</Badge>
            ))}
          </div>
        )}
        <div className={styles.taskCardFooter}>
          <div className={styles.taskMeta}>
            {task.comment_count > 0 && <span className={styles.taskMetaItem}>💬 {task.comment_count}</span>}
            {task.due_date && (
              <span className={styles.taskMetaItem}>📅 {new Date(task.due_date).toLocaleDateString()}</span>
            )}
          </div>
          {task.assignee && <Avatar username={task.assignee.username} color={task.assignee.avatar_color} size={24} />}
        </div>
      </div>
      {onDelete && (
        <button
          className={styles.taskDeleteBtn}
          aria-label={`Delete ${task.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ✕
        </button>
      )}
    </motion.div>
  );
});

function TaskDetailView({ task, members, currentUserId, onSave, onClose }) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority || "medium");
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || "");

  const save = () =>
    onSave({ title: title.trim() || task.title, description, priority, assignee_id: assigneeId || null });

  return (
    <div className={styles.taskDetail}>
      <div className={styles.detailField}>
        <label className={styles.detailLabel} htmlFor="task-title">Title</label>
        <input id="task-title" className={styles.detailInput} value={title} maxLength={300} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className={styles.detailField}>
        <label className={styles.detailLabel} htmlFor="task-priority">Priority</label>
        <select id="task-priority" className={styles.detailSelect} value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="critical">🔴 Critical</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
      </div>
      <div className={styles.detailField}>
        <label className={styles.detailLabel} htmlFor="task-assignee">Assignee</label>
        <select id="task-assignee" className={styles.detailSelect} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.username}
            </option>
          ))}
        </select>
      </div>
      <div className={styles.detailField}>
        <label className={styles.detailLabel} htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          className={styles.detailTextarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add a detailed description..."
          rows={5}
        />
      </div>
      <div className={styles.detailMeta}>
        {task.creator && (
          <p>
            Created by <strong>{task.creator.username}</strong> on {new Date(task.created_at).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className={styles.detailActions}>
        <Button variant="primary" onClick={save}>
          Save Changes
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <TaskComments taskId={task.id} currentUserId={currentUserId} />
    </div>
  );
}

function TaskComments({ taskId, currentUserId }) {
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const applyCommentCount = useBoardStore((s) => s.applyCommentCount);

  useEffect(() => {
    let cancelled = false;
    commentsAPI
      .list(taskId)
      .then(({ data }) => !cancelled && setComments(data))
      .catch((e) => !cancelled && toast.error(errorMessage(e, "Failed to load comments")));
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      const { data } = await commentsAPI.create({ task_id: taskId, content: draft.trim() });
      setComments((prev) => [...(prev || []), data]);
      applyCommentCount(taskId, +1);
      setDraft("");
    } catch (error) {
      toast.error(errorMessage(error, "Failed to add comment"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (commentId) => {
    try {
      await commentsAPI.delete(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      applyCommentCount(taskId, -1);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to delete comment"));
    }
  };

  return (
    <div className={styles.comments}>
      <h4 className={styles.detailLabel}>Comments</h4>
      {comments === null ? (
        <Loader size="sm" />
      ) : (
        comments.map((c) => (
          <div key={c.id} className={styles.comment}>
            <Avatar username={c.author?.username} color={c.author?.avatar_color} size={24} />
            <div className={styles.commentBody}>
              <div className={styles.commentMeta}>
                {c.author?.username} · {new Date(c.created_at).toLocaleString()}
                {c.author_id === currentUserId && (
                  <button className={styles.linkButton} onClick={() => remove(c.id)}>
                    delete
                  </button>
                )}
              </div>
              <div className={styles.commentText}>{c.content}</div>
            </div>
          </div>
        ))
      )}
      <form className={styles.commentForm} onSubmit={submit}>
        <input
          className={styles.detailInput}
          placeholder="Write a comment…"
          value={draft}
          maxLength={5000}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="New comment"
        />
        <Button size="sm" variant="primary" type="submit" loading={busy} disabled={!draft.trim()}>
          Post
        </Button>
      </form>
    </div>
  );
}
