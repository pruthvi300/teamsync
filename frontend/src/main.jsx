// ============================================================================
// TeamSync — React Entry Point
// ============================================================================
// This is the FIRST JavaScript file that runs.
// It mounts the React app into the DOM element with id="root".
//
// React.StrictMode:
//   - Development-only wrapper that helps find bugs
//   - Re-renders components twice to detect side effects
//   - Warns about deprecated APIs
//   - Does NOT affect production builds
//
// Interview Talking Point:
//   "StrictMode double-renders in development to catch side effects in
//    useEffect. If your effect runs twice and breaks, it means you have
//    a cleanup issue — which would be a bug in production anyway."
// ============================================================================

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
