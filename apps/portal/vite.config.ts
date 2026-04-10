import path from "node:path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicHmr = env.VITE_PUBLIC_HMR === "1";

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
        "@docs": path.resolve(__dirname, "../../docs"),
        "@mofeng/shared-schema": path.resolve(
          __dirname,
          "../../packages/shared-schema/src/index.ts",
        ),
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
        "ddm.mofeng33506.xyz",
      ],
      proxy: {
        "/api": {
          // Windows 下 localhost 可能走 IPv6/代理导致超时，固定用 127.0.0.1 更稳定
          target: "http://127.0.0.1:4000",
          changeOrigin: true,
          timeout: 60_000,
          proxyTimeout: 60_000,
        },
      },
      // 只在“公网访问模式”下强制 wss/443；本地开发不要覆盖，否则会出现 wss://localhost 连接失败
      hmr: publicHmr
        ? {
            clientPort: 443,
            protocol: "wss",
          }
        : undefined,
    },
    build: {
      outDir: "dist",
      assetsDir: "assets",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
            "antd-vendor": ["antd"],
            "echarts-vendor": ["echarts", "echarts-for-react"],
          },
        },
      },
    },
  };
});
