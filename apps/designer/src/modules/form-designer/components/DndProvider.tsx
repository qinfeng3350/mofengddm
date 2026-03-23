import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ReactNode } from "react";
import { useFormDesignerStore } from "../store/useFormDesignerStore";
import { BASIC_FIELDS } from "../constants/fieldLibrary";

interface DndProviderProps {
  children: ReactNode;
}

export const FormDesignerDndProvider = ({ children }: DndProviderProps) => {
  const addField = useFormDesignerStore((state) => state.addField);
  const moveField = useFormDesignerStore((state) => state.moveField);
  const fields = useFormDesignerStore((state) => state.formSchema.fields);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // 可以在这里添加拖拽开始时的视觉反馈
  // const handleDragStart = (event: DragStartEvent) => {};

  // 可以在这里添加拖拽悬停时的视觉反馈
  // const handleDragOver = (event: DragOverEvent) => {};

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    // 从字段库拖拽到画布
    if (active.data.current?.type === "field-library") {
      const fieldType = active.id as string;
      const fieldDef = BASIC_FIELDS.find((f) => f.type === fieldType);
      if (fieldDef) {
        addField({
          type: fieldDef.type,
          label: fieldDef.label,
          ...fieldDef.defaultConfig,
        });
      }
      return;
    }

    // 画布内字段排序
    if (active.data.current?.type === "canvas-field" && over.data.current?.type === "canvas-field") {
      const activeIndex = fields.findIndex((f) => f.fieldId === active.id);
      const overIndex = fields.findIndex((f) => f.fieldId === over.id);

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        moveField(activeIndex, overIndex);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map((f) => f.fieldId)} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

