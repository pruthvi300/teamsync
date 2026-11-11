// ============================================================================
// TeamSync — API client
// ============================================================================
// - Access token: kept in memory only (short-lived, never written to storage).
// - Refresh token: kept in localStorage so a page reload doesn't log you out.
//   Trade-off: localStorage is readable by injected scripts (XSS). A stricter
//   setup would put the refresh token in an httpOnly cookie set by the API.
// - On a 401, one shared refresh request runs, then the original request retries.
// ============================================================================

import axios from "axios";

const REFRESH_KEY = "teamsync.refreshToken";

const api = axios.create({
  baseURL: "/api", // proxied to FastAPI by Vite (see vite.config.js)
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

let accessToken = null;
let refreshPromise = null;
let onSessionExpired = () => {};

export function setTokens(access, refresh) {
  accessToken = access;
  try {
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    // storage unavailable (private mode); the session just won't survive a reload
  }
}

export function clearTokens() {
  accessToken = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
}

export function getAccessToken() {
  return accessToken;
}

export function getStoredRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

/** Called when refreshing fails; the auth store uses it to log out cleanly. */
export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

/** Exchange the stored refresh token for new tokens. Concurrent callers share one request. */
export function refreshSession() {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return Promise.reject(new Error("No refresh token"));
  refreshPromise ??= axios
    .post("/api/auth/refresh", { refresh_token: refreshToken })
    .then(({ data }) => {
      setTokens(data.access_token, data.refresh_token);
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const isAuthCall = original?.url?.startsWith("/auth/");
    if (error.response?.status === 401 && !original._retry && !isAuthCall) {
      original._retry = true;
      try {
        await refreshSession();
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        clearTokens();
        onSessionExpired();
      }
    }
    return Promise.reject(error);
  },
);

/** Turn a FastAPI error into a readable message. */
export function errorMessage(error, fallback = "Something went wrong") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join("; ");
  return fallback;
}

export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
};

export const boardsAPI = {
  list: () => api.get("/boards/"),
  get: (boardId) => api.get(`/boards/${boardId}`),
  create: (data) => api.post("/boards/", data),
  update: (boardId, data) => api.put(`/boards/${boardId}`, data),
  delete: (boardId) => api.delete(`/boards/${boardId}`),
  addMember: (boardId, email) => api.post(`/boards/${boardId}/members`, { email }),
};

export const columnsAPI = {
  create: (data) => api.post("/columns/", data),
  update: (columnId, data) => api.put(`/columns/${columnId}`, data),
  delete: (columnId) => api.delete(`/columns/${columnId}`),
  reorder: (boardId, columnIds) => api.put(`/columns/reorder/${boardId}`, { column_ids: columnIds }),
};

export const tasksAPI = {
  get: (taskId) => api.get(`/tasks/${taskId}`),
  create: (data) => api.post("/tasks/", data),
  update: (taskId, data) => api.put(`/tasks/${taskId}`, data),
  delete: (taskId) => api.delete(`/tasks/${taskId}`),
  move: (taskId, data) => api.put(`/tasks/${taskId}/move`, data),
};

export const commentsAPI = {
  list: (taskId) => api.get(`/comments/${taskId}`),
  create: (data) => api.post("/comments/", data),
  delete: (commentId) => api.delete(`/comments/${commentId}`),
};

export default api;
