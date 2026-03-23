import { create } from "zustand";
import type { FormSchemaType, FormFieldSchema, LayoutContainerSchemaType } from "@mofeng/shared-schema";
import { FormSchema, FieldTypeEnum, LayoutContainerTypeEnum } from "@mofeng/shared-schema";
import { formDefinitionApi } from "../../../api/formDefinition";
import { applicationApi } from "../../../api/application";

type DesignerState = {
  formSchema: FormSchemaType;
  selectedFieldId?: string;
  selectedContainerId?: string;
  applicationId?: string;
  isLoading: boolean;
  isSaving: boolean;
  setFormSchema: (schema: FormSchemaType) => void;
  setApplicationId: (appId: string) => void;
  addField: (field: Omit<FormFieldSchema, "fieldId">) => void;
  addContainer: (containerType: "groupTitle" | "multiColumn" | "tab", label: string, config?: Record<string, unknown>) => void;
  selectField: (fieldId?: string) => void;
  selectContainer: (containerId?: string) => void;
  updateField: (fieldId: string, updates: Partial<FormFieldSchema>) => void;
  updateContainer: (containerId: string, updates: Partial<LayoutContainerSchemaType>) => void;
  duplicateField: (fieldId: string) => void;
  removeField: (fieldId: string) => void;
  removeContainer: (containerId: string) => void;
  moveField: (fromIndex: number, toIndex: number) => void;
  saveForm: () => Promise<void>;
  loadForm: (formId: string) => Promise<void>;
};

const initialSchema: FormSchemaType = {
  formId: "form_mvp",
  formName: "墨枫表单",
  status: "draft",
  version: 1,
  fields: [
    {
      fieldId: "field_name",
      type: "input" as any, // 使用字符串类型，与其他文件保持一致
      label: "姓名",
      required: true,
      layout: { x: 0, y: 0, w: 12, h: 1 },
    },
  ],
  layout: {
    type: "grid",
    columns: 12,
  },
  metadata: {},
  // elements 字段可选，如果不存在则从 fields 生成
};

export const useFormDesignerStore = create<DesignerState>((set, get) => ({
  formSchema: FormSchema.parse(initialSchema),
  selectedFieldId: undefined,
  applicationId: undefined,
  isLoading: false,
  isSaving: false,
  setFormSchema: (schema) => set({ formSchema: FormSchema.parse(schema) }),
  setApplicationId: (appId) => set({ applicationId: appId }),
  addField: (field) =>
    set((state) => {
      const fieldId = `field_${Date.now()}`;
      const newField: FormFieldSchema = {
        fieldId,
        label: field.label ?? "未命名字段",
        required: false,
        visible: true,
        editable: true,
        type: field.type,
        layout: {
          x: 0,
          y: state.formSchema.fields.length,
          w: 12,
          h: 1,
          ...field.layout,
        },
        ...field,
      } as FormFieldSchema;

      // 更新elements数组（如果存在）
      const elements = state.formSchema.elements || state.formSchema.fields.map((f) => f as any);
      const newElements = [...elements, newField];

      return {
        formSchema: {
          ...state.formSchema,
          fields: [...state.formSchema.fields, newField],
          elements: newElements,
        },
        selectedFieldId: fieldId,
        selectedContainerId: undefined,
      };
    }),
  addContainer: (containerType, label, config) =>
    set((state) => {
      const containerId = `container_${Date.now()}`;
      const newContainer: LayoutContainerSchemaType = {
        containerId,
        type: containerType,
        label: label || "未命名容器",
        config: config || {},
        children: [],
      };

      // 更新elements数组（如果存在）
      const elements = state.formSchema.elements || state.formSchema.fields.map((f) => f as any);
      const newElements = [...elements, newContainer];

      return {
        formSchema: {
          ...state.formSchema,
          elements: newElements,
        },
        selectedContainerId: containerId,
        selectedFieldId: undefined,
      };
    }),
  selectField: (fieldId) => set({ selectedFieldId: fieldId, selectedContainerId: undefined }),
  selectContainer: (containerId) => set({ selectedContainerId: containerId, selectedFieldId: undefined }),
  updateField: (fieldId, updates) =>
    set((state) => {
      // 更新fields数组
      const newFields = state.formSchema.fields.map((f) =>
        f.fieldId === fieldId ? { ...f, ...updates } : f
      );
      
      // 递归更新elements数组中的字段（包括嵌套在容器中的字段）
      const updateFieldInElements = (elements: any[]): any[] => {
        return elements.map((el: any) => {
          if ('fieldId' in el && el.fieldId === fieldId) {
            // 找到匹配的字段，更新它
            return { ...el, ...updates };
          } else if ('containerId' in el && el.children && Array.isArray(el.children)) {
            // 如果是容器，递归更新其children
            return {
              ...el,
              children: updateFieldInElements(el.children),
            };
          }
          return el;
        });
      };
      
      const newElements = state.formSchema.elements 
        ? updateFieldInElements(state.formSchema.elements)
        : newFields.map((f) => f as any);
      
      return {
        formSchema: {
          ...state.formSchema,
          fields: newFields,
          elements: newElements,
        },
      };
    }),
  duplicateField: (fieldId) =>
    set((state) => {
      const generateFieldId = () => `field_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const generateSubFieldId = () => `subfield_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

      const cloneField = (field: any): FormFieldSchema => {
        const cloned: any = JSON.parse(JSON.stringify(field));
        cloned.fieldId = generateFieldId();
        cloned.label = `${field.label || "未命名字段"}(副本)`;
        if (cloned.layout) {
          cloned.layout = { ...cloned.layout };
          if (typeof cloned.layout.y === "number") {
            cloned.layout.y = cloned.layout.y + 1;
          }
        }
        if (Array.isArray(cloned.subtableFields)) {
          cloned.subtableFields = cloned.subtableFields.map((sf: any) => ({
            ...sf,
            fieldId: generateSubFieldId(),
          }));
        }
        return cloned as FormFieldSchema;
      };

      const duplicateInElements = (elements: any[]): { elements: any[]; inserted: boolean; cloned?: FormFieldSchema } => {
        const result: any[] = [];
        let inserted = false;
        let clonedField: FormFieldSchema | undefined;

        elements.forEach((el) => {
          if ("fieldId" in el && el.fieldId === fieldId) {
            const cloned = cloneField(el);
            inserted = true;
            clonedField = cloned;
            result.push(el, cloned);
          } else if ("containerId" in el && Array.isArray(el.children)) {
            const childRes = duplicateInElements(el.children);
            if (childRes.inserted) {
              inserted = true;
              if (childRes.cloned) clonedField = childRes.cloned;
              result.push({ ...el, children: childRes.elements });
            } else {
              result.push(el);
            }
          } else {
            result.push(el);
          }
        });

        return { elements: result, inserted, cloned: clonedField };
      };

      // 先尝试在 elements 中复制（包含容器内）
      const currentElements = state.formSchema.elements || state.formSchema.fields.map((f) => f as any);
      const { elements: newElements, inserted, cloned } = duplicateInElements(currentElements);

      let clonedField = cloned;

      // 如果 elements 中没找到，再从 fields 中复制
      if (!inserted) {
        const found = state.formSchema.fields.find((f) => f.fieldId === fieldId);
        if (found) {
          clonedField = cloneField(found);
          newElements.push(clonedField);
        }
      }

      if (!clonedField) {
        return state;
      }

      const newFields = [...state.formSchema.fields, clonedField];

      return {
        formSchema: {
          ...state.formSchema,
          fields: newFields,
          elements: newElements,
        },
        selectedFieldId: clonedField.fieldId,
        selectedContainerId: undefined,
      };
    }),
  removeField: (fieldId) =>
    set((state) => {
      // 更新fields数组
      const newFields = state.formSchema.fields.filter((f) => f.fieldId !== fieldId);
      
      // 递归从elements数组中删除字段（包括嵌套在容器中的字段）
      const removeFieldFromElements = (elements: any[]): any[] => {
        return elements
          .map((el: any) => {
            if ('containerId' in el && el.children && Array.isArray(el.children)) {
              // 如果是容器，递归处理其children
              return {
                ...el,
                children: removeFieldFromElements(el.children),
              };
            }
            return el;
          })
          .filter((el: any) => {
            // 过滤掉匹配的字段
            return !('fieldId' in el) || el.fieldId !== fieldId;
          });
      };
      
      const newElements = state.formSchema.elements 
        ? removeFieldFromElements(state.formSchema.elements)
        : newFields.map((f) => f as any);
      
      return {
        formSchema: {
          ...state.formSchema,
          fields: newFields,
          elements: newElements,
        },
        selectedFieldId:
          state.selectedFieldId === fieldId ? undefined : state.selectedFieldId,
      };
    }),
  removeContainer: (containerId) =>
    set((state) => {
      // 更新elements数组
      const newElements = (state.formSchema.elements || []).filter(
        (el: any) => !('containerId' in el) || el.containerId !== containerId
      );
      return {
        formSchema: {
          ...state.formSchema,
          elements: newElements,
        },
        selectedContainerId:
          state.selectedContainerId === containerId ? undefined : state.selectedContainerId,
      };
    }),
  updateContainer: (containerId, updates) =>
    set((state) => {
      const newElements = (state.formSchema.elements || []).map((el: any) =>
        'containerId' in el && el.containerId === containerId
          ? { ...el, ...updates }
          : el
      );
      return {
        formSchema: {
          ...state.formSchema,
          elements: newElements,
        },
      };
    }),
  moveField: (fromIndex, toIndex) =>
    set((state) => {
      const fields = [...state.formSchema.fields];
      const [moved] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      // 更新布局坐标
      const updatedFields = fields.map((f, idx) => ({
        ...f,
        layout: { ...f.layout, y: idx },
      }));
      return {
        formSchema: {
          ...state.formSchema,
          fields: updatedFields,
        },
      };
    }),
  saveForm: async () => {
    const state = get();
    set({ isSaving: true });
    try {
      const { formSchema, applicationId } = state;
      // 准备保存的数据
      // 后端期望 fields 和 layout，但我们需要确保 elements 也被保存
      const saveData: any = {
        formName: formSchema.formName,
        fields: formSchema.fields,
        layout: formSchema.layout,
        status: formSchema.status,
        metadata: formSchema.metadata || {},
      };
      
      // 如果存在elements，将其包含在保存数据中（后端会将其保存到config中）
      if (formSchema.elements && formSchema.elements.length > 0) {
        // 将elements作为metadata传递，后端会将其包含在config中
        (saveData as any).elements = formSchema.elements;
      }
      
      if (formSchema.formId && formSchema.formId !== "form_mvp" && formSchema.formId !== "form_new") {
        // 更新现有表单
        if (applicationId) {
          await applicationApi.updateForm(applicationId, formSchema.formId, saveData);
        } else {
          await formDefinitionApi.update(formSchema.formId, saveData);
        }
      } else {
        // 创建新表单
        if (applicationId) {
          // 在应用内创建表单
          const response = await applicationApi.createForm(applicationId, saveData);
          set({
            formSchema: {
              ...formSchema,
              formId: response.formId,
              version: response.version,
            },
          });
        } else {
          // 使用默认方式创建（兼容旧代码）
          const response = await formDefinitionApi.create(saveData);
          set({
            formSchema: {
              ...formSchema,
              formId: response.formId,
              version: response.version,
            },
          });
        }
      }
    } catch (error) {
      console.error("保存表单失败:", error);
      throw error;
    } finally {
      set({ isSaving: false });
    }
  },
  loadForm: async (formId: string) => {
    set({ isLoading: true });
    try {
      const response = await formDefinitionApi.getById(formId);
      console.log("加载表单响应:", response); // 调试日志
      
      // 确保字段数组存在
      const fields = response.config?.fields || [];
      const layout = response.config?.layout || { type: "grid", columns: 12 };
      
      console.log("表单字段:", fields); // 调试日志
      
      const schema: any = {
        formId: response.formId,
        formName: response.formName,
        category: response.category,
        status: response.status,
        version: response.version,
        fields: fields,
        layout: layout,
        metadata: response.config?.metadata || {},
      };
      
      // 如果存在 elements，也包含进去
      if (response.config?.elements) {
        schema.elements = response.config.elements;
      }
      
      const parsedSchema = FormSchema.parse(schema);
      console.log("解析后的表单Schema:", parsedSchema); // 调试日志
      
      set({
        formSchema: parsedSchema,
        selectedFieldId: undefined,
      });
    } catch (error) {
      console.error("加载表单失败:", error);
      // 显示错误提示
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));

