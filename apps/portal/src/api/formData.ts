import { apiClient } from "./client";

export interface SubmitFormDataRequest {
  formId: string;
  data: Record<string, unknown>;
  status?: string; // 状态：'draft' 草稿，'submitted' 已提交
  recordId?: string; // 编辑模式下的记录ID，如果提供则更新，否则创建
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
  submit: async (request: SubmitFormDataRequest): Promise<FormDataResponse> => {
    return apiClient.post("/form-data", request);
  },

  getListByForm: async (formId: string): Promise<FormDataResponse[]> => {
    return apiClient.get(`/form-data/form/${formId}`);
  },

  getPagedByForm: async (
    formId: string,
    params: { page: number; pageSize: number },
  ): Promise<{ items: FormDataResponse[]; total: number }> => {
    const search = new URLSearchParams();
    search.set("page", String(params.page));
    search.set("pageSize", String(params.pageSize));
    const res = await apiClient.get(`/form-data/form/${formId}/paged?${search.toString()}`);
    return res && typeof res === "object" ? res : { items: [], total: 0 };
  },

  getById: async (recordId: string): Promise<FormDataResponse> => {
    return apiClient.get(`/form-data/${recordId}`);
  },

  delete: async (recordId: string): Promise<void> => {
    return apiClient.delete(`/form-data/${recordId}`);
  },
};

