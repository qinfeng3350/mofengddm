import { apiClient } from './client';

export const workflowApi = {
  startInstance: async (payload: { formId: string; recordId: string; workflow: any }) => {
    return apiClient.post('/api/workflows/start', payload);
  },
  getInstanceByRecord: async (recordId: string) => {
    return apiClient.get(`/api/workflows/instances/by-record/${recordId}`);
  },
  getInstance: async (instanceId: string) => {
    return apiClient.get(`/api/workflows/instances/${instanceId}`);
  },
  action: async (instanceId: string, payload: { nodeId: string; action: 'approve' | 'reject' | 'return'; comment?: string }) => {
    return apiClient.post(`/api/workflows/instances/${instanceId}/action`, payload);
  },
  listTasks: async (status?: 'pending' | 'completed') => {
    const query = status ? `?status=${status}` : '';
    return apiClient.get(`/api/workflows/tasks${query}`);
  },
};
