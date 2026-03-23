import { useState } from "react";
import { Modal, Input, Form, message } from "antd";
import { applicationApi } from "@/api/application";
import { IconSelector } from "@/components/IconSelector";

interface CreateAppNameModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: (appId: string) => void;
}

export const CreateAppNameModal = ({
  open,
  onCancel,
  onSuccess,
}: CreateAppNameModalProps) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // 生成应用代码（基于名称）
      const code = `app_${Date.now()}`;

      // 创建应用
      const response = await applicationApi.create({
        name: values.appName,
        code: code,
        status: "draft",
        metadata: {
          icon: values.icon || "",
        },
      });

      message.success("应用创建成功");
      form.resetFields();
      onSuccess(response.id);
    } catch (error: any) {
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      console.error("创建应用失败:", error);
      message.error(error.response?.data?.message || "创建应用失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="新建应用"
      open={open}
      onCancel={handleCancel}
      onOk={handleSubmit}
      confirmLoading={loading}
      okText="确定"
      cancelText="取消"
      width={500}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 24 }}>
        <Form.Item
          label="应用名称"
          name="appName"
          rules={[
            { required: true, message: "请输入应用名称" },
            { min: 2, message: "应用名称至少2个字符" },
            { max: 32, message: "应用名称最多32个字符" },
          ]}
        >
          <Input placeholder="请输入2-32个字" maxLength={32} />
        </Form.Item>
        <Form.Item
          label="应用图标"
          name="icon"
        >
          <IconSelector />
        </Form.Item>
      </Form>
    </Modal>
  );
};

