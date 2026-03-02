import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    // CesiumJS requires these globals
    CESIUM_BASE_URL: JSON.stringify("/cesium"),
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          cesium: ["cesium"],
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
