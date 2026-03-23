import { useState, useEffect } from "react";
import { Form, Input, Button, Space, Modal, message, Switch } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, HolderOutlined, CopyOutlined } from "@ant-design/icons";

interface OptionItem {
  label: string;
  value: string | number;
  color?: string;
  isDefault?: boolean;
}

interface OptionsConfigPanelProps {
  value?: OptionItem[];
  onChange?: (options: OptionItem[]) => void;
  fieldType: string;
  allowColor?: boolean;
}

export const OptionsConfigPanel = ({
  value = [],
  onChange,
  fieldType,
  allowColor = false,
}: OptionsConfigPanelProps) => {
  const [options, setOptions] = useState<OptionItem[]>(value || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm] = Form.useForm();
  const [batchEditVisible, setBatchEditVisible] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [optionModalVisible, setOptionModalVisible] = useState(false);

  useEffect(() => {
    setOptions(value || []);
  }, [value]);

  const handleAdd = () => {
    setEditingIndex(null);
    editForm.setFieldsValue({
      label: "",
      value: "",
      color: undefined,
      isDefault: false,
    });
    setOptionModalVisible(true);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    const opt = options[index];
    editForm.setFieldsValue({
      label: opt.label,
      value: opt.value,
      color: opt.color,
      isDefault: !!opt.isDefault,
    });
    setOptionModalVisible(true);
  };

  const handleSave = () => {
    editForm.validateFields().then((values) => {
      const { label, value, color, isDefault } = values as {
        label: string;
        value: string;
        color?: string;
        isDefault?: boolean;
      };

      // 如果是单选控件，只允许一个默认选中
      let newOptions = [...options];
      if (fieldType === "radio" && isDefault) {
        newOptions = newOptions.map((opt) => ({
          ...opt,
          isDefault: false,
        }));
      }

      if (editingIndex !== null) {
        newOptions[editingIndex] = {
          ...newOptions[editingIndex],
          label,
          value,
          color,
          isDefault,
        };
      } else {
        newOptions.push({
          label,
          value,
          color,
          isDefault,
        });
      }

      setOptions(newOptions);
      onChange?.(newOptions);
      setEditingIndex(null);
      setOptionModalVisible(false);
      editForm.resetFields();
    });
  };

  const handleDelete = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    setOptions(newOptions);
    onChange?.(newOptions);
  };

  const handleCopy = (index: number) => {
    const optionToCopy = options[index];
    const newOption: OptionItem = {
      ...optionToCopy,
      label: `${optionToCopy.label} (副本)`,
      value: `${optionToCopy.value}_copy_${Date.now()}`,
    };
    const newOptions = [...options, newOption];
    setOptions(newOptions);
    onChange?.(newOptions);
  };

  const handleMove = (fromIndex: number, toIndex: number) => {
    const newOptions = [...options];
    const [moved] = newOptions.splice(fromIndex, 1);
    newOptions.splice(toIndex, 0, moved);
    setOptions(newOptions);
    onChange?.(newOptions);
  };

  const handleBatchEdit = () => {
    if (!batchText.trim()) {
      message.warning("请输入选项内容");
      return;
    }

    const lines = batchText
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => line.trim());

    const newOptions: OptionItem[] = lines.map((line, index) => {
      // 支持格式：选项值|选项标签 或 选项标签
      if (line.includes("|")) {
        const [value, label] = line.split("|").map((s) => s.trim());
        return {
          label: label || value,
          value: value || `option${index + 1}`,
        };
      } else {
        return {
          label: line,
          value: line,
        };
      }
    });

    setOptions(newOptions);
    onChange?.(newOptions);
    setBatchEditVisible(false);
    setBatchText("");
  };

  const handleBatchEditOpen = () => {
    const text = options
      .map((opt) => `${opt.value}|${opt.label}`)
      .join("\n");
    setBatchText(text);
    setBatchEditVisible(true);
  };

  return (
    <div>
      <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 500 }}>选项</span>
        <Space>
          <Button
            type="link"
            size="small"
            onClick={handleBatchEditOpen}
          >
            批量编辑
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            添加选项
          </Button>
        </Space>
      </div>

      {options.length === 0 ? (
        <div
          style={{
            padding: "24px",
            textAlign: "center",
            border: "1px dashed #d9d9d9",
            borderRadius: 4,
            background: "#fafafa",
          }}
        >
          <div style={{ color: "#999", marginBottom: 8 }}>暂无选项</div>
          <Button type="dashed" size="small" onClick={handleAdd}>
            添加第一个选项
          </Button>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            maxHeight: 400,
            overflow: "auto",
          }}
        >
          {options.map((option, index) => (
            <div
              key={index}
              style={{
                padding: "12px",
                borderBottom: index < options.length - 1 ? "1px solid #f0f0f0" : "none",
                display: "flex",
                flexDirection: "column",
                gap: 8,
                background: editingIndex === index ? "#f0f7ff" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <HolderOutlined
                  style={{ color: "#999", cursor: "move", marginTop: 2 }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    // 拖拽功能可以后续实现
                  }}
                />

                {allowColor && option.color && (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      backgroundColor: option.color,
                      border: "1px solid #d9d9d9",
                      marginTop: 2,
                    }}
                  />
                )}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, marginBottom: 4, lineHeight: 1.6 }}>
                    {option.label}
                    {option.isDefault && (
                      <span style={{ marginLeft: 8, fontSize: 12, color: "#1890ff" }}>
                        默认
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: "#999", lineHeight: 1.5 }}>
                    值: {String(option.value)}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-start",
                  paddingLeft: 28,
                  whiteSpace: "nowrap",
                }}
              >
                <Space size={12}>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(index)}
                  >
                    编辑
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopy(index)}
                  >
                    复制
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(index)}
                  >
                    删除
                  </Button>
                </Space>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 批量编辑弹窗 */}
      <Modal
        title="批量编辑选项"
        open={batchEditVisible}
        onOk={handleBatchEdit}
        onCancel={() => {
          setBatchEditVisible(false);
          setBatchText("");
        }}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <div style={{ marginBottom: 8 }}>
          <div style={{ marginBottom: 8, color: "#666" }}>
            每行一个选项，格式：选项值|选项标签 或 选项标签
          </div>
          <Input.TextArea
            rows={10}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            placeholder="选项值1|选项标签1&#10;选项值2|选项标签2&#10;选项标签3"
          />
        </div>
      </Modal>

      {/* 单个选项编辑弹窗 */}
      <Modal
        title={editingIndex !== null ? "编辑选项" : "新增选项"}
        open={optionModalVisible}
        onOk={handleSave}
        onCancel={() => {
          setOptionModalVisible(false);
          setEditingIndex(null);
          editForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={520}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            label="显示值"
            name="label"
            rules={[{ required: true, message: "请输入显示值" }]}
          >
            <Input placeholder="例如：入校礼" />
          </Form.Item>
          <Form.Item
            label="选项值"
            name="value"
            rules={[{ required: true, message: "请输入选项值" }]}
          >
            <Input placeholder="例如：value1" />
          </Form.Item>
          {allowColor && (
            <Form.Item label="颜色" name="color">
              <Input type="color" style={{ width: 80, height: 32, padding: 2 }} />
            </Form.Item>
          )}
          <Form.Item
            label="默认选中"
            name="isDefault"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

