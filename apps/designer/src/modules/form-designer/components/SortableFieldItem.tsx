import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Tag, Typography } from "antd";
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

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={field.fieldId === selectedFieldId ? styles.activeItem : styles.listItem}
        onClick={() => selectField(field.fieldId)}
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f0f0f0",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1 }}>
          <div className={styles.fieldContent} {...attributes} {...listeners} style={{ cursor: "grab" }}>
            <Typography.Text strong>
              {index + 1}. {field.label}
            </Typography.Text>
            <Tag color="blue" style={{ marginLeft: 8 }}>{field.type}</Tag>
            {field.required && (
              <Typography.Text type="danger" className={styles.requiredMark}>
                *
              </Typography.Text>
            )}
          </div>
          <Typography.Paragraph type="secondary" style={{ margin: 0, marginTop: 4 }}>
            字段 ID：{field.fieldId}
          </Typography.Paragraph>
        </div>
        <DeleteOutlined
          onClick={(e) => {
            e.stopPropagation();
            removeField(field.fieldId);
          }}
          style={{ color: "#ff4d4f", cursor: "pointer", fontSize: 16, marginLeft: 8 }}
        />
      </div>
    </div>
  );
};

