import axios from "axios";

// 统一使用 /api 代理（前端 dev 由 Vite 代理到本地 4000，穿透域名同样可用）；如需自定义后端地址可通过 VITE_API_BASE_URL 覆盖
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器：添加token
apiClient.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete (config.headers as Record<string, unknown>)["Content-Type"];
    }
    const token = localStorage.getItem("auth-storage");
    if (token) {
      try {
        const authData = JSON.parse(token);
        if (authData.state?.token) {
          config.headers.Authorization = `Bearer ${authData.state.token}`;
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    const status = error.response?.status;
    const url = String(error.config?.url || "");
    const isExpected404 =
      status === 404 &&
      (url.includes("/workflows/instances/by-record/") || url.includes("/workflows/instances/by-record%2F"));

    if (!isExpected404) {
      console.error("[API Client] 请求错误:", {
        url: error.config?.url,
        method: error.config?.method,
        status,
        data: error.response?.data,
        message: error.message,
      });
    }
    if (error.response?.status === 401) {
      // token过期或无效，清除认证信息
      localStorage.removeItem("auth-storage");
      // 只在非登录页面时跳转
      if (!window.location.pathname.includes('/login')) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

