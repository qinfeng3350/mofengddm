import type { UploadFile } from "antd/es/upload/interface";
import { extractAttachmentPreviewUrls } from "./attachmentDisplay";

/**
 * 表单里保存的附件值 → antd Upload 的 fileList
 */
export function attachmentValueToFileList(value: unknown): UploadFile[] {
  if (value == null || value === "") return [];

  let v: unknown = value;
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "[object Object]") return [];
    if (t.startsWith("[") || t.startsWith("{")) {
      try {
        v = JSON.parse(t);
      } catch {
        const urls = extractAttachmentPreviewUrls(t);
        return urls.map((url, i) => ({
          uid: `legacy-${i}`,
          name: url.split("/").pop() || "file",
          status: "done",
          url,
        }));
      }
    } else {
      const urls = extractAttachmentPreviewUrls(t);
      return urls.map((url, i) => ({
        uid: `legacy-${i}`,
        name: url.split("/").pop() || "file",
        status: "done",
        url,
      }));
    }
  }

  const asArray = Array.isArray(v) ? v : [v];
  const list: UploadFile[] = [];
  asArray.forEach((item: unknown, i: number) => {
    if (item == null) return;
    if (typeof item === "string") {
      const url = item.trim();
      if (!url) return;
      list.push({
        uid: `u-${i}-${url.slice(-12)}`,
        name: url.split("/").pop() || "file",
        status: "done",
        url,
      });
      return;
    }
    if (typeof item === "object") {
      const o = item as Record<string, unknown>;
      const url =
        (typeof o.url === "string" && o.url) ||
        (typeof o.thumbUrl === "string" && o.thumbUrl) ||
        extractAttachmentPreviewUrls(item)[0];
      if (!url) return;
      list.push({
        uid: (typeof o.uid === "string" && o.uid) || `u-${i}`,
        name: (typeof o.name === "string" && o.name) || url.split("/").pop() || "file",
        status: "done",
        url,
      });
    }
  });
  return list;
}

/**
 * Upload onChange 后的 fileList → 写入表单 JSON 的值（单文件存对象，多文件存数组）
 */
export function fileListToAttachmentFormValue(
  fileList: UploadFile[],
  multiple: boolean,
): Record<string, unknown> | Record<string, unknown>[] | null {
  const done = fileList
    .filter((f) => f.status === "done")
    .map((f) => {
      const url =
        (typeof f.url === "string" && f.url) ||
        (typeof f.thumbUrl === "string" && f.thumbUrl) ||
        (f.response && typeof f.response === "object" && (f.response as { url?: string }).url);
      if (!url) return null;
      return {
        uid: f.uid,
        name: f.name || url.split("/").pop() || "file",
        url,
        status: "done" as const,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  if (!done.length) return null;
  return multiple ? done : done[0]!;
}
