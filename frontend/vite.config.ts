import { defineConfig } from "vite";
import path from "path";

const isGitHubPages = !!process.env.GITHUB_PAGES;

export default defineConfig({
  base: isGitHubPages ? "/traerphysics-js/" : "/",
  build: {
    outDir: isGitHubPages ? "../docs" : "dist",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": {
        target: "ws://localhost:8000",
        ws: true,
      },
    },
  },
});
