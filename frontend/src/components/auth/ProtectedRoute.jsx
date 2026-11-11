// ============================================================================
// TeamSync — ProtectedRoute Component
// ============================================================================
// A wrapper that checks authentication before rendering child routes.
// If the user is NOT authenticated, redirect them to /login.
//
// PATTERN: Guard Route (or Protected Route)
//   This is a standard pattern in React apps with authentication.
//   Instead of checking auth in EVERY page component, we wrap routes
//   with a single guard that handles it.
//
// HOW IT WORKS with React Router v6:
//   <Route element={<ProtectedRoute />}>     ← Guard
//     <Route path="/boards" element={...} />  ← Protected pages
//     <Route path="/boards/:id" element={...} />
//   </Route>
//
//   ProtectedRoute uses <Outlet /> to render the child routes.
//   If not authenticated, it renders <Navigate to="/login" /> instead.
//
// Interview Talking Point:
//   "I implement protected routes using React Router v6's nested route pattern.
//    A ProtectedRoute wrapper component checks the auth store — if the user
//    isn't authenticated, it redirects to /login. The Outlet component renders
//    the actual page if auth passes. I also save the original URL in location
//    state so after login, the user is redirected back to where they were."
// ============================================================================

import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuthStore from "../../store/authStore.js";
import Loader from "../common/Common.jsx";

export default function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuthStore();
  const location = useLocation();

  // ── Show loader while checking auth ──
  if (isInitializing) {
    return <Loader fullScreen />;
  }

  // ── Not authenticated → redirect to login ──
  // `state={{ from: location }}` saves where the user was trying to go.
  // After login, we can read this and redirect them back.
  // `replace` prevents the login page from appearing in browser history.
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ── Authenticated → render the child route ──
  // <Outlet /> is React Router's way of saying "render the matching child route here"
  return <Outlet />;
}
