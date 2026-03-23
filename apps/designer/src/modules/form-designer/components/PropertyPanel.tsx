import { Form, Input, Switch, Empty, InputNumber } from "antd";
import { useMemo } from "react";
import { useFormDesignerStore } from "../store/useFormDesignerStore";
import { FieldTypeEnum } from "@mofeng/shared-schema";

export const PropertyPanel = () => {
  const formSchema = useFormDesignerStore((state) => state.formSchema);
  const selectedFieldId = useFormDesignerStore((state) => state.selectedFieldId);
  const updateField = useFormDesignerStore((state) => state.updateField);

  const currentField = useMemo(
    () => formSchema.fields.find((field) => field.fieldId === selectedFieldId),
    [formSchema.fields, selectedFieldId]
  );

  if (!currentField) {
    return <Empty description="请选择画布中的字段以编辑属性" />;
  }

  const handleValuesChange = (changedValues: Record<string, unknown>) => {
    if (selectedFieldId) {
      updateField(selectedFieldId, changedValues);
    }
  };

  return (
    <Form
      layout="vertical"
      initialValues={currentField}
      onValuesChange={handleValuesChange}
      key={currentField.fieldId}
    >
      <Form.Item label="字段类型">
        <Input value={currentField.type} disabled />
      </Form.Item>
      <Form.Item label="字段名称" name="label" rules={[{ required: true }]}>
        <Input placeholder="请输入字段名称" />
      </Form.Item>
      <Form.Item label="占位提示" name="placeholder">
        <Input placeholder="请输入占位提示" />
      </Form.Item>
      <Form.Item
        label="字段 ID"
        tooltip="系统自动生成，供接口调用使用"
      >
        <Input value={currentField.fieldId} disabled />
      </Form.Item>
      <Form.Item label="是否必填" name="required" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item label="是否可见" name="visible" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item label="是否可编辑" name="editable" valuePropName="checked">
        <Switch />
      </Form.Item>

      {/* 数字类型特定配置 */}
      {currentField.type === FieldTypeEnum.Enum.number && (
        <>
          <Form.Item label="最小值" name={["validation", "min"]}>
            <InputNumber placeholder="最小值" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="最大值" name={["validation", "max"]}>
            <InputNumber placeholder="最大值" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="小数位数" name={["validation", "precision"]}>
            <InputNumber min={0} max={10} placeholder="小数位数" style={{ width: "100%" }} />
          </Form.Item>
        </>
      )}

      {/* 文本类型特定配置 */}
      {(currentField.type === FieldTypeEnum.Enum.input ||
        currentField.type === FieldTypeEnum.Enum.textarea) && (
        <>
          <Form.Item label="最小长度" name={["validation", "minLength"]}>
            <InputNumber min={0} placeholder="最小长度" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="最大长度" name={["validation", "maxLength"]}>
            <InputNumber min={0} placeholder="最大长度" style={{ width: "100%" }} />
          </Form.Item>
        </>
      )}

      {/* 选项类型特定配置 */}
      {(currentField.type === FieldTypeEnum.Enum.select ||
        currentField.type === FieldTypeEnum.Enum.radio ||
        currentField.type === FieldTypeEnum.Enum.checkbox) && (
        <Form.Item
          label="选项列表"
          name="options"
          tooltip="每行一个选项，格式：选项值|选项标签"
        >
          <Input.TextArea
            rows={6}
            placeholder="选项值1|选项标签1&#10;选项值2|选项标签2"
            onBlur={(e) => {
              const text = e.target.value;
              if (text) {
                const options = text
                  .split("\n")
                  .filter((line) => line.trim())
                  .map((line) => {
                    const [value, label] = line.split("|").map((s) => s.trim());
                    return { value: value || label, label: label || value };
                  });
                handleValuesChange({ options });
              }
            }}
          />
        </Form.Item>
      )}
    </Form>
  );
};

