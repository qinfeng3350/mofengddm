import { apiClient } from './client';

export interface Department {
  id: string;
  name: string;
  code?: string;
  parentId?: string;
  description?: string;
  sortOrder: number;
  isActive: number;
  children?: Department[];
  title?: string;
  key?: string;
}

export interface DepartmentResponse {
  success: boolean;
  data: Department[];
  tree: Department[];
}

export const departmentApi = {
  /**
   * 获取所有部门（树形结构）
   */
  getDepartments: async () => {
    return apiClient.get<DepartmentResponse>('/departments');
  },

  /**
   * 新增部门
   */
  createDepartment: async (payload: Partial<Department>) => {
    return apiClient.post('/departments', payload);
  },

  /**
   * 更新部门
   */
  updateDepartment: async (id: string, payload: Partial<Department>) => {
    return apiClient.put(`/departments/${id}`, payload);
  },

  /**
   * 删除部门
   */
  deleteDepartment: async (id: string) => {
    return apiClient.delete(`/departments/${id}`);
  },
};

