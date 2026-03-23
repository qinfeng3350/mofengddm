import { useDroppable } from "@dnd-kit/core";
import { Empty } from "antd";
import { useFormDesignerStore } from "../store/useFormDesignerStore";
import { SortableFieldItem } from "./SortableFieldItem";
import styles from "./DesignerCanvas.module.css";

export const DesignerCanvas = () => {
  const fields = useFormDesignerStore((state) => state.formSchema.fields);

  const { setNodeRef, isOver } = useDroppable({
    id: "designer-canvas",
    data: {
      type: "canvas",
    },
  });

  if (!fields.length) {
    return (
      <div
        ref={setNodeRef}
        style={{
          minHeight: 400,
          border: isOver ? "2px dashed #1890ff" : "2px dashed #d9d9d9",
          borderRadius: 4,
          padding: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: isOver ? "#e6f7ff" : "#fafafa",
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="从左侧字段库拖拽或点击添加组件"
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={styles.canvasList}
      style={{
        border: isOver ? "2px dashed #1890ff" : "1px solid #d9d9d9",
        borderRadius: 4,
        padding: 8,
        backgroundColor: isOver ? "#e6f7ff" : "#fff",
      }}
    >
      {fields.map((field, index) => (
        <SortableFieldItem key={field.fieldId} field={field} index={index} />
      ))}
    </div>
  );
};

