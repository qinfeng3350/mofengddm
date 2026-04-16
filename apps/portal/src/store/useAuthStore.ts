import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { apiClient } from "@/api/client";

interface User {
  id: string;
  account: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string | null;
  tenantId?: string;
  tenant?: {
    id: string;
    code: string;
    name: string;
  };
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token: string, user: User) => {
        set({ token, user, isAuthenticated: true });
        apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      },
      clearAuth: () => {
        set({ token: null, user: null, isAuthenticated: false });
        delete apiClient.defaults.headers.common["Authorization"];
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        // 恢复状态时设置token到axios
        if (state?.token) {
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${state.token}`;
        }
      },
    }
  )
);

