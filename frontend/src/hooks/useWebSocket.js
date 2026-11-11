// ============================================================================
// useWebSocket — live board updates over Socket.IO
// ============================================================================
// Connects with the current access token, joins the board's room (the server
// checks membership), and applies events from *other* users to the store.
// Every event carries actor_id; our own actions are already applied locally.
// ============================================================================

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import toast from "react-hot-toast";
import { getAccessToken } from "../services/api.js";
import useAuthStore from "../store/authStore.js";
import useBoardStore from "../store/boardStore.js";

export default function useWebSocket(boardId) {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.user?.id);

  useEffect(() => {
    if (!boardId || !userId) return undefined;

    const socket = io(window.location.origin, {
      transports: ["websocket"],
      // A function, so reconnects pick up a refreshed token.
      auth: (cb) => cb({ token: getAccessToken() }),
      reconnectionAttempts: 10,
    });

    const store = () => useBoardStore.getState();
    const fromOthers = (handler) => (data) => {
      if (data?.actor_id !== userId) handler(data);
    };
    const reload = () => store().loadBoard(boardId, { silent: true });

    socket.on("connect", () => {
      socket.emit("join_board", { board_id: boardId }, (ack) => {
        if (!ack?.ok) console.warn("Could not join board room:", ack?.error);
      });
      // Catch up on anything missed while disconnected.
      reload();
    });

    socket.on("task:created", fromOthers((task) => store().applyRemoteTaskCreate(task)));
    socket.on("task:updated", fromOthers((task) => store().applyRemoteTaskUpdate(task)));
    socket.on("task:deleted", fromOthers(({ task_id }) => store().applyRemoteTaskDelete(task_id)));
    socket.on("task:moved", fromOthers((move) => store().applyRemoteTaskMove(move)));
    socket.on("comment:created", fromOthers(({ task_id }) => store().applyCommentCount(task_id, +1)));
    socket.on("comment:deleted", fromOthers(({ task_id }) => store().applyCommentCount(task_id, -1)));
    for (const event of ["column:created", "column:updated", "column:deleted", "column:reordered", "board:updated", "member:added"]) {
      socket.on(event, fromOthers(reload));
    }
    socket.on(
      "board:deleted",
      fromOthers(() => {
        toast("This board was deleted by its owner");
        navigate("/boards");
      }),
    );

    return () => {
      socket.emit("leave_board", { board_id: boardId });
      socket.disconnect();
    };
  }, [boardId, userId, navigate]);
}
