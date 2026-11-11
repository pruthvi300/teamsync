// ============================================================================
// TeamSync — Login Page
// ============================================================================
// User login form with email and password.
//
// REACT CONCEPTS DEMONSTRATED:
//   - useState for form state management
//   - useNavigate for programmatic navigation after login
//   - Controlled components (input values tied to state)
//   - Form submission with async/await
//   - Conditional redirect (if already logged in)
//
// Interview Talking Point:
//   "For simple forms like login, I use controlled components with useState.
//    For complex forms with validation, arrays, and dependent fields,
//    I switch to React Hook Form — it's uncontrolled under the hood,
//    so it doesn't re-render on every keystroke."
// ============================================================================

import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore.js";
import { Button, Input } from "../components/common/Common.jsx";
import styles from "./AuthPages.module.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, isAuthenticated } = useAuthStore();

  // ── Form State (Controlled Components) ──
  // Each input's value is controlled by React state.
  // When the user types, onChange → setState → re-render → input shows new value
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ── Redirect if already logged in ──
  if (isAuthenticated) {
    return <Navigate to="/boards" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); // Prevent browser's default form submission (page reload)

    const success = await login(email, password);
    if (success) {
      navigate("/boards"); // Programmatic navigation after successful login
    }
  };

  return (
    <div className={styles.authPage}>
      {/* ── Decorative background ── */}
      <div className={styles.bgGlow} />

      {/* ── Login Card ── */}
      <motion.div
        className={styles.authCard}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Header */}
        <div className={styles.authHeader}>
          <span className={styles.authLogo}>⚡</span>
          <h1 className={styles.authTitle}>Welcome back</h1>
          <p className={styles.authSubtitle}>Sign in to your TeamSync account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={styles.authForm}>
          <Input
            id="login-email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="login-password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            className={styles.submitBtn}
          >
            Sign In
          </Button>
        </form>

        {/* Footer */}
        <p className={styles.authFooter}>
          Don't have an account?{" "}
          <Link to="/register" className={styles.authLink}>
            Create one
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
