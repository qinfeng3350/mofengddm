import { z } from "zod";
import { BusinessRuleSchema } from "@mofeng/shared-schema";
import { apiClient } from "./client";

export type BusinessRuleResponse = z.infer<typeof BusinessRuleSchema>;

export const businessRuleApi = {
  /**
   * 获取应用下的所有业务规则
   */
  getListByApplication: async (
    applicationId: string,
  ): Promise<BusinessRuleResponse[]> => {
    const response = await apiClient.get("/business-rules", {
      params: { applicationId },
    });
    return Array.isArray(response) ? response : [];
  },

  /**
   * 根据ID获取规则详情
   */
  getById: async (applicationId: string, ruleId: string): Promise<BusinessRuleResponse> => {
    return await apiClient.get(`/business-rules/${ruleId}`);
  },

  /**
   * 创建规则
   */
  create: async (rule: BusinessRuleResponse): Promise<BusinessRuleResponse> => {
    if (!rule.applicationId) {
      throw new Error("缺少 applicationId，无法创建规则");
    }
    return await apiClient.post("/business-rules", rule);
  },

  /**
   * 更新规则
   */
  update: async (
    applicationId: string,
    ruleId: string,
    patch: Partial<BusinessRuleResponse>,
  ): Promise<BusinessRuleResponse> => {
    return await apiClient.put(`/business-rules/${ruleId}`, patch);
  },

  /**
   * 删除规则
   */
  delete: async (applicationId: string, ruleId: string): Promise<void> => {
    await apiClient.delete(`/business-rules/${ruleId}`);
  },

  /**
   * 启用/禁用规则
   */
  toggleEnabled: async (
    applicationId: string,
    ruleId: string,
    enabled: boolean,
  ): Promise<BusinessRuleResponse> => {
    return await apiClient.patch(`/business-rules/${ruleId}/enabled`, { enabled });
  },
};

