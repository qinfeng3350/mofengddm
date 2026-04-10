import { apiClient } from "./client";

export type EnterpriseLogCategory = "platform" | "app" | "message";

export const enterpriseLogApi = {
  list(params: {
    category: EnterpriseLogCategory;
    subtype?: string;
    keyword?: string;
    operationType?: string;
    triggerType?: string;
    start?: string;
    end?: string;
    page?: number;
    pageSize?: number;
  }) {
    return apiClient.get("/enterprise-logs", { params } as any);
  },
};

