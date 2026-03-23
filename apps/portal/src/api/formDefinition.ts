import { apiClient } from "./client";
import type { FormSchemaType } from "@mofeng/shared-schema";

export interface FormDefinitionResponse {
  id?: string; // 添加 id 字段
  applicationId?: string; // 添加 applicationId 字段
  formId: string;
  formName: string;
  category?: string;
  status: "draft" | "published";
  version: number;
  metadata?: FormSchemaType["metadata"];
  config: {
    fields: FormSchemaType["fields"];
    layout: FormSchemaType["layout"];
    metadata?: FormSchemaType["metadata"];
    elements?: FormSchemaType["elements"];
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateFormDefinitionRequest {
  formName: string;
  category?: string;
  status?: "draft" | "published";
  fields: FormSchemaType["fields"];
  layout?: FormSchemaType["layout"];
  metadata?: FormSchemaType["metadata"];
  elements?: FormSchemaType["elements"];
}

export const formDefinitionApi = {
  getList: async (): Promise<FormDefinitionResponse[]> => {
    return apiClient.get("/form-definitions");
  },

  getById: async (formId: string): Promise<FormDefinitionResponse> => {
    const response = await apiClient.get(`/form-definitions/${formId}`);
    // 确保 config 是对象而不是字符串
    if (typeof response.config === 'string') {
      try {
        response.config = JSON.parse(response.config);
      } catch (e) {
        console.error('解析 config JSON 失败:', e);
        response.config = { fields: [], layout: { type: 'grid', columns: 12 }, metadata: {} };
      }
    }
    if (!response.config.metadata) {
      response.config.metadata = {};
    }
    response.metadata = response.config.metadata;
    return response;
  },

  create: async (data: CreateFormDefinitionRequest): Promise<FormDefinitionResponse> => {
    return apiClient.post("/form-definitions", data);
  },

  update: async (formId: string, data: Partial<CreateFormDefinitionRequest>): Promise<FormDefinitionResponse> => {
    return apiClient.patch(`/form-definitions/${formId}`, data);
  },

  delete: async (formId: string): Promise<void> => {
    return apiClient.delete(`/form-definitions/${formId}`);
  },

  getListByApplication: async (applicationId: string): Promise<FormDefinitionResponse[]> => {
    return apiClient.get(`/applications/${applicationId}/forms`);
  },
};

