import { useState, useMemo } from "react";
import { Form, InputNumber, Input, Button, Space, Card, Typography, Popconfirm, message } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, HolderOutlined } from "@ant-design/icons";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const { Text } = Typography;

interface SerialRule {
  type: "autoCount" | "fixedText" | "date" | "year" | "month" | "day";
  config?: {
    digits?: number; // 自动计数的位数
    text?: string; // 固定文本
    format?: string; // 日期格式
  };
}

interface SerialNumberConfigPanelProps {
  value?: {
    rules?: SerialRule[];
    resetType?: "never" | "year" | "month" | "day";
  };
  onChange?: (config: { rules?: SerialRule[]; resetType?: string }) => void;
}

export const SerialNumberConfigPanel = ({ value, onChange }: SerialNumberConfigPanelProps) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingRule, setEditingRule] = useState<SerialRule | null>(null);
  const rules = value?.rules || [];

  // 默认规则：自动计数4位数
  const defaultRules: SerialRule[] = rules.length > 0 ? rules : [
    { type: "autoCount", config: { digits: 4 } }
  ];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = parseInt(String(active.id).replace("rule-", ""));
    const overIndex = parseInt(String(over.id).replace("rule-", ""));

    if (activeIndex !== overIndex && !isNaN(activeIndex) && !isNaN(overIndex)) {
      const newRules = arrayMove(defaultRules, activeIndex, overIndex);
      onChange?.({ ...value, rules: newRules });
    }
  };

  const handleAddRule = () => {
    const newRule: SerialRule = { type: "fixedText", config: { text: "" } };
    const newRules = [...defaultRules, newRule];
    onChange?.({ ...value, rules: newRules });
    setEditingIndex(newRules.length - 1);
    setEditingRule(newRule);
  };

  const handleEditRule = (index: number, rule: SerialRule) => {
    setEditingIndex(index);
    setEditingRule({ ...rule });
  };

  const handleSaveRule = (index: number) => {
    if (!editingRule) return;
    
    const newRules = [...defaultRules];
    newRules[index] = editingRule;
    onChange?.({ ...value, rules: newRules });
    setEditingIndex(null);
    setEditingRule(null);
  };

  const handleDeleteRule = (index: number) => {
    const newRules = defaultRules.filter((_, i) => i !== index);
    onChange?.({ ...value, rules: newRules });
  };

  // 生成预览
  const preview = useMemo(() => {
    let previewText = "";
    defaultRules.forEach((rule) => {
      switch (rule.type) {
        case "autoCount":
          const digits = rule.config?.digits || 4;
          previewText += "0".repeat(digits - 1) + "1";
          break;
        case "fixedText":
          previewText += rule.config?.text || "";
          break;
        case "date":
          previewText += new Date().toISOString().split("T")[0].replace(/-/g, "");
          break;
        case "year":
          previewText += new Date().getFullYear().toString();
          break;
        case "month":
          previewText += String(new Date().getMonth() + 1).padStart(2, "0");
          break;
        case "day":
          previewText += String(new Date().getDate()).padStart(2, "0");
          break;
      }
    });
    return previewText || "0001";
  }, [defaultRules]);

  // 可排序的规则项组件
  const SortableRuleItem = ({ rule, index }: { rule: SerialRule; index: number }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: `rule-${index}` });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };

    if (editingIndex !== index) {
      return (
        <div
          ref={setNodeRef}
          style={{
            ...style,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            background: isDragging ? "#e6f7ff" : "#fafafa",
            borderRadius: 4,
            marginBottom: 8,
            border: isDragging ? "1px solid #91d5ff" : "1px solid #f0f0f0",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none",
          }}
          {...attributes}
          {...listeners}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
            <div
              style={{
                cursor: "grab",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
                color: "#1890ff",
                fontSize: 16,
                marginRight: 4,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <HolderOutlined />
            </div>
            {rule.type === "autoCount" && (
              <>
                <Text strong>自动计数</Text>
                <Text type="secondary">{rule.config?.digits || 4}位数</Text>
              </>
            )}
            {rule.type === "fixedText" && (
              <>
                <Text strong>固定字符</Text>
                <Text type="secondary">{rule.config?.text || "未配置字段"}</Text>
              </>
            )}
            {rule.type === "date" && <Text strong>日期</Text>}
            {rule.type === "year" && <Text strong>年份</Text>}
            {rule.type === "month" && <Text strong>月份</Text>}
            {rule.type === "day" && <Text strong>日期</Text>}
          </div>
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleEditRule(index, rule);
              }}
              style={{ padding: "4px 8px" }}
            />
            <Popconfirm
              title="确定删除此规则吗？"
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDeleteRule(index);
              }}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                style={{ padding: "4px 8px" }}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        </div>
      );
    }

    return renderRuleEditor(rule, index);
  };

  const renderRuleEditor = (rule: SerialRule, index: number) => {
    if (editingIndex !== index) {
      return null;
    }

    return (
      <Card size="small" style={{ marginBottom: 8, border: "1px solid #e8e8e8" }}>
        <Form layout="vertical" size="small">
          <Form.Item label="规则类型" style={{ marginBottom: 12 }}>
            <Space wrap>
              <Button
                type={editingRule?.type === "autoCount" ? "primary" : "default"}
                size="small"
                onClick={() => setEditingRule({ type: "autoCount", config: { digits: editingRule?.config?.digits || 4 } })}
              >
                自动计数
              </Button>
              <Button
                type={editingRule?.type === "fixedText" ? "primary" : "default"}
                size="small"
                onClick={() => setEditingRule({ type: "fixedText", config: { text: editingRule?.config?.text || "" } })}
              >
                固定字符
              </Button>
              <Button
                type={editingRule?.type === "date" ? "primary" : "default"}
                size="small"
                onClick={() => setEditingRule({ type: "date", config: {} })}
              >
                日期
              </Button>
              <Button
                type={editingRule?.type === "year" ? "primary" : "default"}
                size="small"
                onClick={() => setEditingRule({ type: "year", config: {} })}
              >
                年份
              </Button>
            </Space>
          </Form.Item>

          {editingRule?.type === "autoCount" && (
            <Form.Item label="位数" style={{ marginBottom: 12 }}>
              <InputNumber
                min={1}
                max={10}
                value={editingRule.config?.digits || 4}
                onChange={(val) => {
                  setEditingRule({
                    ...editingRule,
                    config: { ...editingRule.config, digits: val || 4 }
                  });
                }}
                style={{ width: "100%" }}
                addonAfter="位数"
              />
            </Form.Item>
          )}

          {editingRule?.type === "fixedText" && (
            <Form.Item label="固定字符" style={{ marginBottom: 12 }}>
              <Input
                value={editingRule.config?.text || ""}
                onChange={(e) => {
                  setEditingRule({
                    ...editingRule,
                    config: { ...editingRule.config, text: e.target.value }
                  });
                }}
                placeholder="请输入固定字符"
              />
            </Form.Item>
          )}

          <Form.Item style={{ marginBottom: 0 }}>
            <Space>
              <Button
                type="primary"
                size="small"
                onClick={() => handleSaveRule(index)}
              >
                保存
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setEditingIndex(null);
                  setEditingRule(null);
                }}
              >
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>规则定义</Text>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={defaultRules.map((_, index) => `rule-${index}`)} strategy={verticalListSortingStrategy}>
            <div style={{ marginBottom: 12 }}>
              {defaultRules.map((rule, index) => (
                <SortableRuleItem key={index} rule={rule} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleAddRule}
          block
          size="small"
        >
          添加规则
        </Button>
      </div>

      <div style={{ marginBottom: 24 }}>
        <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>流水号效果预览</Text>
        <div
          style={{
            padding: "16px",
            background: "#e6f7ff",
            borderRadius: 6,
            textAlign: "center",
            fontSize: 18,
            fontWeight: 500,
            color: "#1890ff",
            border: "1px solid #91d5ff",
          }}
        >
          {preview}
        </div>
      </div>

      <div>
        <Text strong style={{ fontSize: 14, display: "block", marginBottom: 12 }}>流水号重置</Text>
        <div style={{ 
          padding: "12px", 
          background: "#fafafa", 
          borderRadius: 6,
          border: "1px solid #f0f0f0"
        }}>
          <Text type="secondary" style={{ fontSize: 12, lineHeight: "20px" }}>
            当前未开始计数 下一条数据提交时将计数为1
          </Text>
        </div>
      </div>
    </div>
  );
};

