import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from "path";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@core": resolve(__dirname, "./src/core"),
      "@ui": resolve(__dirname, "./src/renderer"),
      "@facade": resolve(__dirname, "./src/facade"),
    },
  },
  server: {
    host: process.env.VITE_HOST || "localhost",
    port: 5174,
    allowedHosts: [".cspace.test"],
  },
});
