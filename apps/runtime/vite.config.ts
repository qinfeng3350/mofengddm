import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@mofeng/shared-schema": path.resolve(__dirname, "../../packages/shared-schema/src/index.ts"),
    },
  },
  server: {
    port: 5181,
  },
});
