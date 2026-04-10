import { apiClient } from "./client";

export type RoleDto = { id: string; code: string; name: string; status?: number };

export const roleApi = {
  list: async (): Promise<RoleDto[]> => {
    return apiClient.get("/roles");
  },

  getSystemAdmins: async (): Promise<{ userIds: string[] }> => {
    return apiClient.get("/roles/system-admins");
  },

  setSystemAdmins: async (userIds: string[]): Promise<{ userIds: string[] }> => {
    return apiClient.put("/roles/system-admins", { userIds });
  },
};

