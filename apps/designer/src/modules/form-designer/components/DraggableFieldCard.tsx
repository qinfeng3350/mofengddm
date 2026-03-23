import { useDraggable } from "@dnd-kit/core";
import { Card, Button, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type { FieldDefinition } from "../constants/fieldLibrary";
import { useFormDesignerStore } from "../store/useFormDesignerStore";

interface DraggableFieldCardProps {
  field: FieldDefinition;
}

export const DraggableFieldCard = ({ field }: DraggableFieldCardProps) => {
  const addField = useFormDesignerStore((state) => state.addField);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: field.type,
    data: {
      type: "field-library",
      field,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        size="small"
        title={field.label}
        extra={
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() =>
              addField({
                type: field.type,
                label: field.label,
                ...field.defaultConfig,
              })
            }
          >
            添加
          </Button>
        }
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          ...(isDragging && { opacity: 0.5 }),
        }}
      >
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {field.description ?? "拖拽或点击添加此字段"}
        </Typography.Paragraph>
      </Card>
    </div>
  );
};

