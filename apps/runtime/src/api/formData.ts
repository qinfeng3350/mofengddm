import { apiClient } from "./client";

export interface SubmitFormDataRequest {
  formId: string;
  data: Record<string, unknown>;
}

export interface FormDataResponse {
  recordId: string;
  formId: string;
  data: Record<string, unknown>;
  submitterId?: string;
  submitterName?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const formDataApi = {
  // 提交表单数据
  submit: async (request: SubmitFormDataRequest): Promise<FormDataResponse> => {
    return apiClient.post("/api/form-data", request);
  },

  // 获取表单的所有数据
  getListByForm: async (formId: string): Promise<FormDataResponse[]> => {
    return apiClient.get(`/api/form-data/form/${formId}`);
  },

  // 获取单个数据记录
  getById: async (recordId: string): Promise<FormDataResponse> => {
    return apiClient.get(`/api/form-data/${recordId}`);
  },

  // 删除数据记录
  delete: async (recordId: string): Promise<void> => {
    return apiClient.delete(`/api/form-data/${recordId}`);
  },
};

