import { useEffect, useMemo, useState } from "react";
import { Button, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { InboxOutlined, PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { uploadAttachmentFile } from "@/api/upload";
import {
  attachmentValueToFileList,
  fileListToAttachmentFormValue,
} from "@/utils/attachmentForm";

type Props = {
  value: unknown;
  onChange: (v: Record<string, unknown> | Record<string, unknown>[] | null) => void;
  multiple?: boolean;
  pictureMode?: boolean;
  /** 子表里用 small */
  size?: "default" | "small";
  disabled?: boolean;
};

/**
 * 附件/图片上传：上传过程中不能把表单值写成 null（否则受控 fileList 变空，界面会“闪没”）。
 * 仅在无「上传中」项时把结果写回表单。
 */
export function AttachmentUpload({
  value,
  onChange,
  multiple = false,
  pictureMode = false,
  size = "default",
  disabled = false,
}: Props) {
  const valueKey = useMemo(() => JSON.stringify(value ?? null), [value]);
  const [fileList, setFileList] = useState<UploadFile[]>(() =>
    attachmentValueToFileList(value),
  );

  useEffect(() => {
    setFileList(attachmentValueToFileList(value));
  }, [valueKey]);

  return (
    <Upload.Dragger
      listType={pictureMode ? "picture-card" : "text"}
      style={{
        background: "#fff",
        borderRadius: 4,
        border: "1px dashed #d9d9d9",
        padding: size === "small" ? 6 : 12,
      }}
      fileList={fileList}
      disabled={disabled}
      multiple={multiple}
      maxCount={multiple ? undefined : 1}
      customRequest={async (options) => {
        const { file, onError, onSuccess } = options;
        try {
          const res = await uploadAttachmentFile(file as File);
          if (res?.success && res.url) {
            // 显式带上 url，便于 rc-upload 合并到 file 上供缩略图使用
            onSuccess?.({ url: res.url, success: true, thumbUrl: res.url }, file);
          } else {
            message.error("上传失败");
            onError?.(new Error("上传失败"));
          }
        } catch (e) {
          message.error("上传失败，请检查网络或登录状态");
          onError?.(e as Error);
        }
      }}
      onChange={(info) => {
        setFileList(info.fileList);
        const hasUploading = info.fileList.some((f) => f.status === "uploading");
        if (hasUploading) {
          return;
        }
        onChange(fileListToAttachmentFormValue(info.fileList, multiple));
      }}
    >
      {pictureMode ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <UploadOutlined style={{ fontSize: 20, color: "#666" }} />
          <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>手机扫码上传</div>
          <div style={{ marginTop: 8 }}>
            <Button
              size="small"
              type="text"
              icon={<PlusOutlined />}
              style={{ paddingLeft: 0, paddingRight: 0 }}
            >
              选择
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <InboxOutlined style={{ fontSize: 18, color: "#666" }} />
          <div style={{ marginTop: 6, color: "#666", fontSize: 12 }}>点击或拖拽附件上传</div>
        </div>
      )}
    </Upload.Dragger>
  );
}
