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
  optimizeDeps: {
    force: true, // 强制重新构建依赖，解决 Outdated Optimize Dep 错误
  },
  server: {
    host: true, // 允许外网访问（用于内网穿透）
    port: 3000,
    allowedHosts: [
      "70a2818b.r16.cpolar.top",
      "936a8de.r16.cpolar.top",
      "56760425.r16.cpolar.top",
    ],
    proxy: {
      '/api': {
        // Windows 下 localhost 可能走 IPv6/代理导致超时，固定用 127.0.0.1 更稳定
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        timeout: 60_000,
        proxyTimeout: 60_000,
      },
    },
    // HMR 通过公网访问时，仅指定 clientPort 避免绑定外网 IP 失败
    hmr: {
      clientPort: 443,
      protocol: "wss",
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd'],
          'echarts-vendor': ['echarts', 'echarts-for-react'],
        },
      },
    },
  },
});
