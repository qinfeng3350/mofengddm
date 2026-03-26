import { apiClient } from "./client";

export interface LoginDto {
  account: string;
  password: string;
}

export interface RegisterDto {
  account: string;
  password: string;
  name: string;
  email: string;
  phone?: string;
}

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    account: string;
    name: string;
    email: string;
    phone?: string;
  };
}

export const authApi = {
  login: (data: LoginDto): Promise<AuthResponse> => {
    return apiClient.post("/auth/login", data);
  },

  register: (data: RegisterDto): Promise<AuthResponse> => {
    return apiClient.post("/auth/register", data);
  },

  getProfile: (): Promise<any> => {
    return apiClient.get("/auth/profile");
  },

  getTenants: (): Promise<Array<{ id: string; code: string; name: string }>> => {
    return apiClient.get("/auth/tenants");
  },

  switchTenant: (payload: { tenantId: string }): Promise<any> => {
    return apiClient.post("/auth/switch-tenant", payload);
  },

  changePassword: (payload: {
    oldPassword?: string;
    newPassword: string;
  }): Promise<{ success: boolean }> => {
    return apiClient.post("/auth/change-password", payload);
  },
};

