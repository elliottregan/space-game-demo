// vite.visualizer.config.ts
import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: "src/visualization",
  base: process.env.VITE_VISUALIZER_BASE || "/visualizer/",
  build: {
    outDir: "../../dist/visualizer",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
