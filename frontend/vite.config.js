import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Inside docker-compose the API is reachable as http://api:8000, not localhost.
const target = process.env.API_PROXY_TARGET || "http://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": { target, changeOrigin: true },
      "/socket.io": { target, changeOrigin: true, ws: true },
    },
  },
});
