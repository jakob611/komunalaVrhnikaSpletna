import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    fs: {
      // Keep development mail, SQLite, report photos and secrets off the HTTP server.
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem}",
        "**/.git/**",
        "**/.data/**",
        "**/.dev.vars*",
        "**/.deploy/**",
      ],
    },
    proxy: { "/api": { target: "http://127.0.0.1:8787", changeOrigin: false } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          maps: ["leaflet", "react-leaflet"],
        },
      },
    },
  },
});
