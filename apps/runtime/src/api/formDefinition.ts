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

export const formDefinitionApi = {
  // 获取表单定义
  getById: async (formId: string): Promise<FormDefinitionResponse> => {
    return apiClient.get(`/api/form-definitions/${formId}`);
  },
};

