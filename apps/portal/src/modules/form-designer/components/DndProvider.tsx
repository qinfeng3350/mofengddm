import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ReactNode } from "react";
import { useFormDesignerStore } from "../store/useFormDesignerStore";
import { BASIC_FIELDS, LAYOUT_FIELDS, SYSTEM_FIELDS, ADVANCED_FIELDS } from "../constants/fieldLibrary";

interface DndProviderProps {
  children: ReactNode;
}

export const FormDesignerDndProvider = ({ children }: DndProviderProps) => {
  const addField = useFormDesignerStore((state) => state.addField);
  const addContainer = useFormDesignerStore((state) => state.addContainer);
  const updateField = useFormDesignerStore((state) => state.updateField);
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

    const formSchema = useFormDesignerStore.getState().formSchema;
    const updateContainer = useFormDesignerStore.getState().updateContainer;

    // 从字段库拖拽到容器内
    if (active.data.current?.type === "field-library") {
      const fieldData = active.data.current.field;
      const overData = over.data.current;

      // 从字段库拖拽到子表字段配置面板：添加子表列
      if (overData?.type === "subtable-drop" && overData.subtableFieldId && fieldData) {
        const subtableFieldId = String(overData.subtableFieldId);

        // 在 schema（可能包含 container children）里查找该 subtable 字段
        const findFieldById = (items: any[]): any | null => {
          for (const it of items || []) {
            if (!it) continue;
            if ("fieldId" in it && it.fieldId === subtableFieldId) return it;
            const children = (it as any).children;
            if (Array.isArray(children)) {
              const found = findFieldById(children);
              if (found) return found;
            }
          }
          return null;
        };

        const rootItems = formSchema.elements || formSchema.fields || [];
        const target = findFieldById(rootItems as any[]);
        const currentSubtableFields: any[] = target?.subtableFields || [];

        const newSubtableField: any = {
          fieldId: `subfield_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          label: fieldData.label ?? "未命名字段",
          required: false,
          visible: true,
          editable: true,
          type: fieldData.type,
          ...fieldData.defaultConfig,
        };

        const nextSubtableFields = [...currentSubtableFields, newSubtableField];
        updateField(subtableFieldId, { subtableFields: nextSubtableFields } as any);
        return;
      }

      // 检查是否拖到容器内
      if (overData?.type === "container-drop" || overData?.type === "container-column-drop" || overData?.type === "container-tab-drop") {
        const containerId = overData.containerId;
        const elements = formSchema.elements || [];
        const container = elements.find((el: any) => 'containerId' in el && el.containerId === containerId);
        
        if (container && fieldData) {
          const fieldId = `field_${Date.now()}`;
          const newField: any = {
            fieldId,
            label: fieldData.label ?? "未命名字段",
            required: false,
            visible: true,
            editable: true,
            type: fieldData.type,
            ...fieldData.defaultConfig,
          };

          // 如果是多列容器，记录列索引
          if (overData.type === "container-column-drop" && overData.columnIndex !== undefined) {
            newField.containerColumn = overData.columnIndex;
          }
          // 如果是标签页容器，记录标签页key
          if (overData.type === "container-tab-drop" && overData.tabKey) {
            newField.containerTab = overData.tabKey;
          }

          const newChildren = [...(container.children || []), newField];
          updateContainer(containerId, { children: newChildren });
        }
        return;
      }

      // 拖到画布
      if (fieldData) {
        addField({
          type: fieldData.type,
          label: fieldData.label,
          ...fieldData.defaultConfig,
        });
      } else {
        // 兼容旧格式：通过ID查找字段
        const fieldId = active.id as string;
        const allFields = [...BASIC_FIELDS, ...LAYOUT_FIELDS, ...SYSTEM_FIELDS, ...ADVANCED_FIELDS];
        const fieldDef = allFields.find((f) => `${f.type}-${f.label}` === fieldId || f.type === fieldId);
        if (fieldDef) {
          addField({
            type: fieldDef.type,
            label: fieldDef.label,
            ...fieldDef.defaultConfig,
          });
        }
      }
      return;
    }

    // 从布局容器库拖拽到画布
    if (active.data.current?.type === "layout-container") {
      const containerData = active.data.current;
      if (containerData.containerType && containerData.label) {
        addContainer(
          containerData.containerType as "groupTitle" | "multiColumn" | "tab",
          containerData.label,
          containerData.defaultConfig
        );
      }
      return;
    }

    // 容器内字段移动到另一个列/标签页
    if (active.data.current?.type === "container-field") {
      const activeField = active.data.current.field;
      const activeContainerId = active.data.current.containerId;
      const overData = over.data.current;

      // 如果拖到另一个列
      if (overData?.type === "container-column-drop" && overData.containerId === activeContainerId) {
        const newColumnIndex = overData.columnIndex;
        const elements = formSchema.elements || [];
        const container = elements.find((el: any) => 'containerId' in el && el.containerId === activeContainerId);
        
        if (container) {
          const updatedChildren = (container.children || []).map((child: any) => {
            if ('fieldId' in child && child.fieldId === activeField.fieldId) {
              return { ...child, containerColumn: newColumnIndex };
            }
            return child;
          });
          updateContainer(activeContainerId, { children: updatedChildren });
        }
        return;
      }

      // 如果拖到另一个标签页
      if (overData?.type === "container-tab-drop" && overData.containerId === activeContainerId) {
        const newTabKey = overData.tabKey;
        const elements = formSchema.elements || [];
        const container = elements.find((el: any) => 'containerId' in el && el.containerId === activeContainerId);
        
        if (container) {
          const updatedChildren = (container.children || []).map((child: any) => {
            if ('fieldId' in child && child.fieldId === activeField.fieldId) {
              return { ...child, containerTab: newTabKey };
            }
            return child;
          });
          updateContainer(activeContainerId, { children: updatedChildren });
        }
        return;
      }
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

