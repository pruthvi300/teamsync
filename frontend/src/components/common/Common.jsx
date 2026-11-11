// ============================================================================
// TeamSync — Common Reusable Components
// ============================================================================
// Small, generic UI components used throughout the app.
//
// COMPONENT DESIGN PRINCIPLES:
//   1. Single Responsibility — Each component does ONE thing
//   2. Props for customization — Don't hardcode styles/behavior
//   3. Accessible — Use semantic HTML, ARIA attributes, keyboard support
//   4. Composable — Small components compose into larger ones
//
// Interview Talking Point:
//   "I build a library of small, reusable components — Button, Modal, Loader,
//    Badge, Avatar. Each component is self-contained with its own styles.
//    This prevents duplication and ensures visual consistency."
// ============================================================================

import { Component, forwardRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./Common.module.css";


// ────────────────────────────────────────────────────────────────────────────
// BUTTON — Styled button with variants
// ────────────────────────────────────────────────────────────────────────────
// Usage:
//   <Button>Default</Button>
//   <Button variant="primary">Submit</Button>
//   <Button variant="danger" size="sm">Delete</Button>
//   <Button variant="ghost" loading>Saving...</Button>
// ────────────────────────────────────────────────────────────────────────────
export function Button({
  children,
  variant = "default",  // "primary", "danger", "ghost", "default"
  size = "md",           // "sm", "md", "lg"
  loading = false,
  disabled = false,
  className = "",
  ...props               // Pass through any other props (onClick, type, etc.)
}) {
  return (
    <button
      className={`${styles.button} ${styles[`btn-${variant}`]} ${styles[`btn-${size}`]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className={styles.spinner} />}
      {children}
    </button>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// INPUT — Styled input with label
// ────────────────────────────────────────────────────────────────────────────
// Uses forwardRef so React Hook Form can register this component.
// Without forwardRef, RHF can't attach ref to the underlying <input>.
//
// Interview Talking Point:
//   "I use forwardRef on custom input components so they work with
//    React Hook Form's register() function. RHF needs a ref to the native
//    input element for uncontrolled form management."
// ────────────────────────────────────────────────────────────────────────────
export const Input = forwardRef(function Input(
  { label, error, id, className = "", ...props },
  ref
) {
  return (
    <div className={styles.inputGroup}>
      {label && (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={`${styles.input} ${error ? styles.inputError : ""} ${className}`}
        {...props}
      />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
});


// ────────────────────────────────────────────────────────────────────────────
// MODAL — Overlay dialog using React Portal
// ────────────────────────────────────────────────────────────────────────────
// WHY PORTALS?
//   A modal should render at the TOP of the DOM tree (not nested inside
//   a deeply nested component). Otherwise:
//   - z-index wars with parent elements
//   - overflow:hidden on parents clips the modal
//   - CSS stacking context issues
//
//   createPortal(element, document.body) renders the modal as a child of <body>,
//   regardless of where <Modal> is used in the component tree.
//
// Interview Talking Point:
//   "I use React Portals for modals. The Modal component renders at the root
//    of the DOM tree using createPortal(). This prevents z-index and overflow
//    issues that happen when modals are nested inside other components."
// ────────────────────────────────────────────────────────────────────────────
export function Modal({ isOpen, onClose, title, children, size = "md" }) {
  // Stays mounted inside AnimatePresence so the exit animation can play.

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — semi-transparent overlay */}
          <motion.div
            className={styles.modalBackdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal content */}
          <motion.div
            className={`${styles.modal} ${styles[`modal-${size}`]}`}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header */}
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{title}</h2>
              <button className={styles.modalClose} onClick={onClose}>
                ✕
              </button>
            </div>

            {/* Body */}
            <div className={styles.modalBody}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body // ← Portal target: render at the top of the DOM
  );
}


// ────────────────────────────────────────────────────────────────────────────
// LOADER — Loading spinner
// ────────────────────────────────────────────────────────────────────────────
export function Loader({ fullScreen = false, size = "md" }) {
  return (
    <div className={`${styles.loaderContainer} ${fullScreen ? styles.loaderFullScreen : ""}`}>
      <div className={`${styles.loader} ${styles[`loader-${size}`]}`} />
    </div>
  );
}
export default Loader;


// ────────────────────────────────────────────────────────────────────────────
// AVATAR — User avatar circle with initials
// ────────────────────────────────────────────────────────────────────────────
export function Avatar({ username, color, size = 32 }) {
  // Get first letter(s) of the username for the avatar
  const initials = username
    ? username.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div
      className={styles.avatar}
      style={{
        backgroundColor: color || "#6366f1",
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
      title={username}
    >
      {initials}
    </div>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// BADGE — Small label/tag
// ────────────────────────────────────────────────────────────────────────────
export function Badge({ children, variant = "default", className = "" }) {
  return (
    <span className={`${styles.badge} ${styles[`badge-${variant}`]} ${className}`}>
      {children}
    </span>
  );
}


// ────────────────────────────────────────────────────────────────────────────
// ERROR BOUNDARY — Catch React rendering errors
// ────────────────────────────────────────────────────────────────────────────
// Error Boundaries catch JavaScript errors in the RENDER phase.
// Without them, a single broken component crashes the ENTIRE app.
// With them, only the broken component shows an error — rest of app works fine.
//
// NOTE: Error Boundaries MUST be class components (no hook equivalent yet).
// This is one of the few places where class components are still necessary.
//
// Interview Talking Point:
//   "I wrap each board column in an Error Boundary. If one column has a
//    rendering bug, only that column shows the error fallback — the rest
//    of the board continues working. Without Error Boundaries, the entire
//    app would crash."
// ────────────────────────────────────────────────────────────────────────────

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Called when a child component throws during rendering
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log to error tracking service (e.g., Sentry) in production
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className={styles.errorFallback}>
            <p>Something went wrong</p>
            <button onClick={() => this.setState({ hasError: false })}>
              Try Again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
