import { apiClient } from "./client";

export interface ApplicationResponse {
  id: string;
  name: string;
  code: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateApplicationRequest {
  name: string;
  code: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export const applicationApi = {
  getList: async (): Promise<ApplicationResponse[]> => {
    const response = await apiClient.get("/applications");
    // 解析metadata字段
    return response.map((app: any) => ({
      ...app,
      metadata: typeof app.metadata === 'string' ? JSON.parse(app.metadata || '{}') : (app.metadata || {}),
    }));
  },

  getById: async (appId: string): Promise<ApplicationResponse> => {
    const response = await apiClient.get(`/applications/${appId}`);
    // 解析metadata字段
    return {
      ...response,
      metadata: typeof response.metadata === 'string' ? JSON.parse(response.metadata || '{}') : (response.metadata || {}),
    };
  },

  create: async (data: CreateApplicationRequest): Promise<ApplicationResponse> => {
    return apiClient.post("/applications", data);
  },

  update: async (appId: string, data: Partial<CreateApplicationRequest>): Promise<ApplicationResponse> => {
    return apiClient.patch(`/applications/${appId}`, data);
  },

  delete: async (appId: string): Promise<void> => {
    return apiClient.delete(`/applications/${appId}`);
  },

  // 应用下的表单
  getForms: async (appId: string): Promise<any[]> => {
    return apiClient.get(`/applications/${appId}/forms`);
  },

  createForm: async (appId: string, data: any): Promise<any> => {
    return apiClient.post(`/applications/${appId}/forms`, data);
  },

  updateForm: async (appId: string, formId: string, data: any): Promise<any> => {
    return apiClient.patch(`/applications/${appId}/forms/${formId}`, data);
  },

  deleteForm: async (appId: string, formId: string): Promise<void> => {
    return apiClient.delete(`/applications/${appId}/forms/${formId}`);
  },
};

