import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [react(), cesium()],
  server: {
    port: 5173,
    host: true,
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: https:; font-src 'self' data:;",
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
        rewrite: (path: string) => path.replace(/^\/ws/, "/api/v1/ws"),
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          deckgl: ["@deck.gl/core", "@deck.gl/layers"],
          wallet: ["@rainbow-me/rainbowkit", "wagmi", "viem"],
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
