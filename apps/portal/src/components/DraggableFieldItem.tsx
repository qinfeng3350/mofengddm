import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { UserOutlined } from "@ant-design/icons";

interface DraggableFieldItemProps {
  fieldId: string;
  label: string;
  type?: string;
  onClick?: () => void;
  rightSlot?: React.ReactNode;
}

export const DraggableFieldItem: React.FC<DraggableFieldItemProps> = ({
  fieldId,
  label,
  type,
  onClick,
  rightSlot,
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${fieldId}`,
    data: {
      type: "field",
      fieldId,
      label,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : { opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      className="draggable-field-item"
      data-draggable-field="true"
      style={{
        padding: "8px 12px",
        border: "1px solid #f0f0f0",
        borderRadius: 4,
        cursor: "move",
        backgroundColor: "#fafafa",
        display: "flex",
        alignItems: "center",
        gap: 8,
        justifyContent: "space-between",
        ...style,
      }}
      {...listeners}
      {...attributes}
      onDoubleClick={(e) => {
        if (!onClick) return;
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        {label}
        {type === "user" && <UserOutlined />}
      </span>
      {rightSlot}
    </div>
  );
};

