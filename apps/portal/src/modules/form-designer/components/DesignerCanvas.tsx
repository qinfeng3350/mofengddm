import { memo, useMemo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Empty } from "antd";
import { useFormDesignerStore } from "../store/useFormDesignerStore";
import { DesignerFieldRenderer } from "./DesignerFieldRenderer";
import { DesignerContainerRenderer } from "./DesignerContainerRenderer";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormFieldSchema, LayoutContainerSchemaType } from "@mofeng/shared-schema";
import styles from "./DesignerCanvas.module.css";

export const DesignerCanvas = memo(() => {
  const formSchema = useFormDesignerStore((state) => state.formSchema);
  const selectedFieldId = useFormDesignerStore((state) => state.selectedFieldId);
  const selectedContainerId = useFormDesignerStore((state) => state.selectedContainerId);

  // 使用elements数组（如果存在），否则使用fields数组
  const elements = useMemo(() => {
    return formSchema.elements || formSchema.fields.map((f) => f as any);
  }, [formSchema.elements, formSchema.fields]);

  const { setNodeRef, isOver } = useDroppable({
    id: "designer-canvas",
    data: {
      type: "canvas",
    },
  });

  if (!elements.length) {
    return (
      <div
        ref={setNodeRef}
        className={styles.canvasRoot}
      >
        <div
          className={styles.canvasPaper}
          style={{
            outline: isOver ? "2px dashed #1677ff" : "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <div className={styles.canvasEmpty}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{ textAlign: "center", display: "block", color: "#8c8c8c" }}>
                  从左侧拖拽来添加字段或布局容器
                </span>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.canvasRoot} ${styles.designerCanvasScroll}`}
    >
      <div
        className={styles.canvasPaper}
        style={{
          outline: isOver ? "2px dashed #1677ff" : "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          {elements.map((element: any) => {
            // 判断是字段还是容器
            if ("fieldId" in element) {
              const field = element as FormFieldSchema;
              return (
                <SortableFieldWrapper key={field.fieldId} field={field}>
                  <DesignerFieldRenderer
                    field={field}
                    isSelected={field.fieldId === selectedFieldId}
                  />
                </SortableFieldWrapper>
              );
            } else if ("containerId" in element) {
              const container = element as LayoutContainerSchemaType;
              return (
                <SortableContainerWrapper
                  key={container.containerId}
                  container={container}
                >
                  <DesignerContainerRenderer
                    container={container}
                    isSelected={container.containerId === selectedContainerId}
                  />
                </SortableContainerWrapper>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
});

DesignerCanvas.displayName = "DesignerCanvas";

// 可排序的字段包装器
const SortableFieldWrapper = memo(({ field, children }: { field: FormFieldSchema; children: React.ReactNode }) => {
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
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
});

SortableFieldWrapper.displayName = "SortableFieldWrapper";

// 可排序的容器包装器
const SortableContainerWrapper = memo(({ container, children }: { container: LayoutContainerSchemaType; children: React.ReactNode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: container.containerId,
    data: {
      type: "canvas-container",
      container,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
});

SortableContainerWrapper.displayName = "SortableContainerWrapper";
