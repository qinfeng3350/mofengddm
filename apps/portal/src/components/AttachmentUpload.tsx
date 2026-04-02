import { useEffect, useMemo, useState } from "react";
import { Button, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { UploadOutlined } from "@ant-design/icons";
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
    <Upload
      listType={pictureMode ? "picture-card" : "text"}
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
        <div>
          <UploadOutlined />
          <div style={{ marginTop: 8 }}>上传</div>
        </div>
      ) : (
        <Button size={size === "small" ? "small" : "middle"} icon={<UploadOutlined />}>
          选择文件
        </Button>
      )}
    </Upload>
  );
}
