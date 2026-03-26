import { apiClient } from './client';

export interface DingtalkConfig {
  appKey: string;
  appSecret: string;
  agentId?: string;
}

export interface DingtalkDepartment {
  id: number;
  name: string;
  parent_id: number;
  order: number;
  dept_id: number;
}

export interface DingtalkUser {
  userid: string;
  name: string;
  mobile?: string;
  email?: string;
  avatar?: string;
  dept_id_list?: number[];
  position?: string;
  jobnumber?: string;
}

export interface DingtalkUsersResponse {
  data: DingtalkUser[];
  hasMore: boolean;
  nextCursor?: number;
}

export const dingtalkApi = {
  /**
   * Stream 通道状态（是否已连接/已注册）
   */
  getStreamStatus: async () => {
    return apiClient.get<{
      success: boolean;
      data: {
        enabled: boolean;
        hasCredentials: boolean;
        connected: boolean;
        registered: boolean;
        lastError: string | null;
      };
    }>('/dingtalk/stream/status');
  },

  /**
   * 测试连接
   */
  testConnection: async (config: DingtalkConfig) => {
    return apiClient.post('/dingtalk/test-connection', config);
  },

  /**
   * 获取部门列表
   */
  getDepartments: async (config: DingtalkConfig, deptId?: number) => {
    const params = deptId ? { deptId: deptId.toString() } : {};
    return apiClient.post<{ success: boolean; data: DingtalkDepartment[] }>(
      '/dingtalk/departments',
      config,
      { params },
    );
  },

  /**
   * 获取所有部门（递归）
   */
  getAllDepartments: async (config: DingtalkConfig) => {
    return apiClient.post<{ success: boolean; data: DingtalkDepartment[] }>(
      '/dingtalk/departments/all',
      config,
    );
  },

  /**
   * 获取用户列表
   */
  getUsers: async (
    config: DingtalkConfig,
    deptId?: number,
    cursor?: number,
    size?: number,
  ) => {
    const params: Record<string, string> = {};
    if (deptId) params.deptId = deptId.toString();
    if (cursor !== undefined) params.cursor = cursor.toString();
    if (size) params.size = size.toString();

    return apiClient.post<DingtalkUsersResponse>(
      '/dingtalk/users',
      config,
      { params },
    );
  },

  /**
   * 获取所有用户
   */
  getAllUsers: async (config: DingtalkConfig, deptId?: number) => {
    const params = deptId ? { deptId: deptId.toString() } : {};
    return apiClient.post<{ success: boolean; data: DingtalkUser[] }>(
      '/dingtalk/users/all',
      config,
      { params },
    );
  },

  /**
   * 根据用户ID获取用户详情
   */
  getUserById: async (config: DingtalkConfig, userId: string) => {
    return apiClient.post<{ success: boolean; data: DingtalkUser | null }>(
      `/dingtalk/users/${userId}`,
      config,
    );
  },

  /**
   * 同步钉钉组织架构（部门和用户）
   */
  syncOrganization: async (config: DingtalkConfig) => {
    return apiClient.post<{
      success: boolean;
      data: {
        departments: {
          total: number;
          created: number;
          updated: number;
          errors: any[];
        };
        users: {
          total: number;
          created: number;
          updated: number;
          errors: any[];
        };
      };
      message: string;
    }>('/dingtalk/sync/organization', config);
  },
};

