import { apiClient } from "./client";

export const wecomLoginApi = {
  getWebUrl(params?: { redirectUri?: string; state?: string }) {
    return apiClient.get("/wecom/login/web-url", { params } as any);
  },
};

