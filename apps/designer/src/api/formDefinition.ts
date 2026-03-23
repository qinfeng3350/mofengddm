import { apiClient } from "./client";
import type { FormSchemaType } from "@mofeng/shared-schema";

export interface FormDefinitionResponse {
  formId: string;
  formName: string;
  category?: string;
  status: "draft" | "published";
  version: number;
  config: {
    fields: FormSchemaType["fields"];
    layout: FormSchemaType["layout"];
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
}

export const formDefinitionApi = {
  // 获取表单定义列表
  getList: async (): Promise<FormDefinitionResponse[]> => {
    return apiClient.get("/api/form-definitions");
  },

  // 获取单个表单定义
  getById: async (formId: string): Promise<FormDefinitionResponse> => {
    return apiClient.get(`/api/form-definitions/${formId}`);
  },

  // 创建表单定义
  create: async (data: CreateFormDefinitionRequest): Promise<FormDefinitionResponse> => {
    return apiClient.post("/api/form-definitions", data);
  },

  // 更新表单定义
  update: async (formId: string, data: Partial<CreateFormDefinitionRequest>): Promise<FormDefinitionResponse> => {
    return apiClient.patch(`/api/form-definitions/${formId}`, data);
  },

  // 删除表单定义
  delete: async (formId: string): Promise<void> => {
    return apiClient.delete(`/api/form-definitions/${formId}`);
  },
};

