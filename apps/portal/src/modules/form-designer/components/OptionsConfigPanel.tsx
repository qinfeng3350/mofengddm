import { useState, useEffect } from "react";
import { Input, Button, Space, Modal, message, Typography } from "antd";
import { PlusOutlined, DeleteOutlined, HolderOutlined } from "@ant-design/icons";

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
  const [batchEditVisible, setBatchEditVisible] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  useEffect(() => {
    setOptions(value || []);
  }, [value]);

  const makeUniqueValue = (base: string) => {
    const existed = new Set(options.map((o) => String(o.value)));
    let v = base || `option${options.length + 1}`;
    let i = 2;
    while (existed.has(v)) {
      v = `${base || "option"}${i}`;
      i += 1;
    }
    return v;
  };

  const handleAdd = () => {
    const nextIndex = options.length + 1;
    const label = `选项${nextIndex}`;
    const value = makeUniqueValue(label);
    const next = [...options, { label, value }];
    setOptions(next);
    onChange?.(next);
  };

  const updateOption = (index: number, patch: Partial<OptionItem>) => {
    const next = options.map((o, i) => (i === index ? { ...o, ...patch } : o));
    setOptions(next);
    onChange?.(next);
  };

  const handleDelete = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          选项
        </Typography.Text>
        <Space size={8}>
          <Button type="link" size="small" onClick={handleBatchEditOpen}>
            批量编辑
          </Button>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleAdd}>
            添加选项
          </Button>
        </Space>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt, index) => (
          <div
            key={String(opt.value) || index}
            draggable
            onDragStart={() => setDraggingIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (draggingIndex == null || draggingIndex === index) return;
              handleMove(draggingIndex, index);
              setDraggingIndex(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Input
              value={opt.label}
              onChange={(e) => {
                const label = e.target.value;
                // value 为空时，默认跟随 label（便于快速配置）
                const valueNext =
                  opt.value == null || String(opt.value).trim() === "" ? label : opt.value;
                updateOption(index, { label, value: valueNext });
              }}
              placeholder={`选项${index + 1}`}
              size="small"
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(index)}
            />
            <div
              title="拖拽排序"
              style={{
                width: 18,
                color: "#bfbfbf",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "grab",
              }}
            >
              <HolderOutlined />
            </div>
          </div>
        ))}
        {options.length === 0 && (
          <div style={{ padding: "8px 0" }}>
            <Button type="dashed" block size="small" icon={<PlusOutlined />} onClick={handleAdd}>
              添加选项
            </Button>
          </div>
        )}
      </div>

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
    </div>
  );
};

