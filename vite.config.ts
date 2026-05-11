import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@core": resolve(__dirname, "./src/core"),
      "@ui": resolve(__dirname, "./src/renderer"),
    },
  },
  define: {
    __VUE_OPTIONS_API__: true,
    __VUE_PROD_DEVTOOLS__: false,
    __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
  },
  server: {
    host: process.env.VITE_HOST || "localhost",
    port: 5173,
    // Allow a browser running on the host to reach the dev server via the
    // cspace sandbox hostname (<sandbox>.<project>.cspace.test:5173).
    // Without this, vite returns "Blocked request" for any non-localhost
    // Host header.
    allowedHosts: [".cspace.test"],
  },
});
