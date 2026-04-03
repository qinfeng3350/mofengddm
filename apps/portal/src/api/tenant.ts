import { apiClient } from "./client";

export interface TenantMetrics {
  formsCount: number;
  recordsCount: number;
  enabledUsersCount: number;
}

export type TenantLimitsRaw = {
  enabled?: boolean;
  expiresAt?: string;
  maxEnabledUsers?: number;
  maxForms?: number;
  maxRecords?: number;
};

export type TenantLimitsSnapshot = {
  limits: TenantLimitsRaw;
  formsCount: number;
  recordsCount: number;
  enabledUsersCount: number;
  totalUsersCount: number;
};

export const tenantApi = {
  getMyMetrics: (): Promise<{ success: boolean; data: TenantMetrics; message?: string }> => {
    return apiClient.get("/tenants/me/metrics");
  },

  getMyLimits: (): Promise<{
    success: boolean;
    data: TenantLimitsSnapshot;
    message?: string;
  }> => {
    return apiClient.get("/tenants/me/limits");
  },
};
