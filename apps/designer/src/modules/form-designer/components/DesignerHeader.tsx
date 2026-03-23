import { Button, Input, message, Space, Typography } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useFormDesignerStore } from "../store/useFormDesignerStore";

export const DesignerHeader = () => {
  const formSchema = useFormDesignerStore((state) => state.formSchema);
  const setFormSchema = useFormDesignerStore((state) => state.setFormSchema);
  const saveForm = useFormDesignerStore((state) => state.saveForm);
  const isSaving = useFormDesignerStore((state) => state.isSaving);

  const [formName, setFormName] = useState(formSchema.formName);

  const handleSave = async () => {
    try {
      // 更新表单名称
      setFormSchema({
        ...formSchema,
        formName,
      });

      await saveForm();
      message.success("保存成功");
    } catch (error) {
      message.error("保存失败，请重试");
      console.error(error);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
      <Typography.Title level={4} style={{ margin: 0, color: "#fff" }}>
        墨枫设计器（MVP）
      </Typography.Title>
      <Space>
        <Input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="表单名称"
          style={{ width: 200 }}
          onPressEnter={handleSave}
        />
        <Button type="primary" icon={<SaveOutlined />} loading={isSaving} onClick={handleSave}>
          保存
        </Button>
      </Space>
    </div>
  );
};

