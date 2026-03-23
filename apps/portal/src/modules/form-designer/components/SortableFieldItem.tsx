import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tag, Typography, Space } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import type { FormFieldSchema } from "@mofeng/shared-schema";
import { useFormDesignerStore } from "../store/useFormDesignerStore";
import styles from "./DesignerCanvas.module.css";

interface SortableFieldItemProps {
  field: FormFieldSchema;
  index: number;
}

export const SortableFieldItem = ({ field, index }: SortableFieldItemProps) => {
  const selectedFieldId = useFormDesignerStore((state) => state.selectedFieldId);
  const selectField = useFormDesignerStore((state) => state.selectField);
  const removeField = useFormDesignerStore((state) => state.removeField);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.fieldId,
    data: {
      type: "canvas-field",
      field,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSelected = field.fieldId === selectedFieldId;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onClick={() => selectField(field.fieldId)}
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f0f0f0",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: isSelected ? "#e6f7ff" : "#fff",
          transition: "background-color 0.2s",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = "#fafafa";
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = "#fff";
          }
        }}
      >
        <Space 
          size="middle" 
          style={{ flex: 1 }}
          {...attributes}
          {...listeners}
        >
          <Typography.Text 
            style={{ 
              fontSize: 14, 
              fontWeight: 500,
              color: "#333",
              minWidth: 24,
              display: "inline-block",
            }}
          >
            {index + 1}.
          </Typography.Text>
          <Typography.Text 
            strong
            style={{ 
              fontSize: 14,
              color: isSelected ? "#1890ff" : "#333",
            }}
          >
            {field.label}
          </Typography.Text>
          <Tag 
            color={isSelected ? "blue" : "default"}
            style={{ 
              margin: 0,
              fontSize: 12,
            }}
          >
            {field.type}
          </Tag>
          <Typography.Text 
            type="secondary" 
            style={{ 
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            {field.fieldId}
          </Typography.Text>
        </Space>
        <DeleteOutlined
          onClick={(e) => {
            e.stopPropagation();
            removeField(field.fieldId);
          }}
          style={{ 
            color: "#ff4d4f", 
            cursor: "pointer", 
            fontSize: 16,
            padding: "4px",
            borderRadius: 4,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#fff2f0";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        />
      </div>
    </div>
  );
};

