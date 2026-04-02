import { apiClient } from "./client";

export type UploadFileResponse = {
  success: boolean;
  url: string;
  originalName?: string;
};

/** 上传单个文件到 core `POST /api/uploads`，需在客户端已登录 */
export function uploadAttachmentFile(file: File): Promise<UploadFileResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/uploads", formData);
}
