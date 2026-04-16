import { apiClient } from './client';

export interface OperationLog {
  id: string;
  tenantId: string;
  formId: string;
  recordId: string;
  operationType: 'create' | 'update' | 'delete';
  operatorId: string;
  operatorName?: string;
  fieldChanges?: Array<{
    fieldId: string;
    fieldLabel?: string;
    oldValue: any;
    newValue: any;
  }>;
  description?: string;
  createdAt: string;
}

export type { OperationLog as OperationLogType };

export interface RecordComment {
  id: string;
  tenantId: string;
  formId: string;
  recordId: string;
  operatorId: string;
  operatorName?: string;
  operatorAvatar?: string;
  content?: string;
  createdAt: string;
}

export const operationLogApi = {
  /**
   * 获取操作记录
   */
  getLogs: async (formId: string, recordId?: string, limit?: number): Promise<OperationLog[]> => {
    const params = new URLSearchParams();
    params.append('formId', formId);
    if (recordId) {
      params.append('recordId', recordId);
    }
    if (limit) {
      params.append('limit', limit.toString());
    }
    const response = await apiClient.get(`/operation-logs?${params.toString()}`);
    return Array.isArray(response) ? response : [];
  },

  getComments: async (formId: string, recordId: string): Promise<RecordComment[]> => {
    const params = new URLSearchParams();
    params.append("formId", formId);
    params.append("recordId", recordId);
    const response = await apiClient.get(`/operation-logs/comments?${params.toString()}`);
    return Array.isArray(response) ? response : [];
  },

  addComment: async (payload: {
    formId: string;
    recordId: string;
    content: string;
  }): Promise<RecordComment> => {
    return apiClient.post("/operation-logs/comments", payload);
  },

  deleteComment: async (id: string): Promise<void> => {
    return apiClient.delete(`/operation-logs/comments/${id}`);
  },
};
