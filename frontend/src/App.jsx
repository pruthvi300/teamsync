// ============================================================================
// TeamSync — App Component (Root)
// ============================================================================
// The top-level component that sets up:
//   1. React Router — Client-side routing (no page reloads)
//   2. Route definitions — Which page component renders for which URL
//   3. Protected routes — Redirect to login if not authenticated
//   4. Toast notifications — Global notification system
//
// ROUTING ARCHITECTURE:
//   /login              → LoginPage (public)
//   /register           → RegisterPage (public)
//   /boards             → BoardsPage (protected — requires auth)
//   /boards/:boardId    → BoardDetailPage (protected — Kanban view)
//   /dashboard          → DashboardPage (protected — analytics)
//   /                   → Redirects to /boards
//
// WHY React Router v6?
//   - Nested routes (layout routes that wrap multiple pages)
//   - Relative routing (links inside components don't need full paths)
//   - Data loading with loaders (not used here, but available)
//   - Better bundle splitting with React.lazy()
//
// Interview Talking Point:
//   "I use React Router v6 with protected routes. The ProtectedRoute component
//    checks the auth store — if no token exists, it redirects to /login with
//    the original URL saved in state, so after login the user goes back to
//    where they were trying to go."
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { lazy, Suspense, useEffect } from "react";

// ── Components ──
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import Layout from "./components/layout/Layout.jsx";
import Loader, { ErrorBoundary } from "./components/common/Common.jsx";
import useAuthStore from "./store/authStore.js";

// ── Pages (Lazy Loaded) ──
// React.lazy + Suspense = Code Splitting
// Each page is a separate JavaScript chunk, loaded only when needed.
// This means the initial page load is FASTER because it doesn't download
// the board page code until the user actually navigates there.
//
// Interview Talking Point:
//   "I use React.lazy() for route-based code splitting. The login page loads
//    instantly because it doesn't include the Kanban board code. The board
//    code is loaded only when the user navigates to /boards/:id."
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegisterPage = lazy(() => import("./pages/RegisterPage.jsx"));
const BoardsPage = lazy(() => import("./pages/BoardsPage.jsx"));
const BoardDetailPage = lazy(() => import("./pages/BoardDetailPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));

function App() {
  const initAuth = useAuthStore((s) => s.initAuth);

  // Restore the session from the stored refresh token once, on first load.
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <ErrorBoundary>
      {/* ── BrowserRouter — Enables client-side routing ── */}
      {/* Uses the History API (pushState) so URLs look normal: /boards/123  */}
      {/* NOT HashRouter (#/boards/123) — that's for older deployments         */}
      <BrowserRouter>
        {/* ── Suspense — Shows a loader while lazy components are loading ── */}
        {/* fallback is rendered while the lazy component's JS chunk downloads */}
        <Suspense fallback={<Loader fullScreen />}>
          <Routes>
            {/* ── Public Routes (no auth required) ── */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* ── Protected Routes (auth required) ── */}
            {/* Layout wraps all protected pages with Navbar + Sidebar */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/boards" element={<BoardsPage />} />
                <Route path="/boards/:boardId" element={<BoardDetailPage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
              </Route>
            </Route>

            {/* ── Redirect root to boards ── */}
            <Route path="/" element={<Navigate to="/boards" replace />} />

            {/* ── 404 — Catch all unmatched routes ── */}
            <Route path="*" element={<Navigate to="/boards" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      {/* ── Toast Notifications ── */}
      {/* react-hot-toast provides a global notification system.                */}
      {/* Call toast.success("Done!") or toast.error("Failed") from anywhere. */}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "var(--color-bg-elevated)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            fontSize: "var(--font-size-sm)",
          },
        }}
      />
    </ErrorBoundary>
  );
}

export default App;
