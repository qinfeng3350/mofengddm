import { apiClient } from "./client";

export const dingtalkLoginApi = {
  getWebUrl: (params: {
    tenantId?: string;
    tenantCode?: string;
    redirectUri?: string;
    state?: string;
  }): Promise<{ success: boolean; data: { url: string } }> => {
    return apiClient.get("/dingtalk/login/web-url", { params } as any);
  },

  h5Login: (payload: {
    tenantId?: string;
    tenantCode?: string;
    code: string;
  }): Promise<{ success: boolean; data: { access_token: string; user: any } }> => {
    return apiClient.post("/dingtalk/login/h5", payload);
  },
};

