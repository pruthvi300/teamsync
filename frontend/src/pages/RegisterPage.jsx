// ============================================================================
// TeamSync — Register Page
// ============================================================================
import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore.js";
import { Button, Input } from "../components/common/Common.jsx";
import styles from "./AuthPages.module.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, isAuthenticated } = useAuthStore();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  // Redirect if already logged in
  if (isAuthenticated) {
    return <Navigate to="/boards" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Client-side validation (server also validates, but UX is better with instant feedback)
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    const success = await register(email, username, password);
    if (success) {
      navigate("/boards");
    }
  };

  return (
    <div className={styles.authPage}>
      <div className={styles.bgGlow} />

      <motion.div
        className={styles.authCard}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className={styles.authHeader}>
          <span className={styles.authLogo}>⚡</span>
          <h1 className={styles.authTitle}>Create account</h1>
          <p className={styles.authSubtitle}>Start collaborating with your team</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.authForm}>
          <Input
            id="register-email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="register-username"
            label="Username"
            type="text"
            placeholder="Your display name"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <Input
            id="register-password"
            label="Password"
            type="password"
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            id="register-confirm"
            label="Confirm Password"
            type="password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={error}
            required
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={isLoading}
            className={styles.submitBtn}
          >
            Create Account
          </Button>
        </form>

        <p className={styles.authFooter}>
          Already have an account?{" "}
          <Link to="/login" className={styles.authLink}>
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
