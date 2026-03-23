import { create } from "zustand";
import type { FormSchemaType, FormFieldSchema } from "@mofeng/shared-schema";
import { FormSchema, FieldTypeEnum } from "@mofeng/shared-schema";
import { formDefinitionApi } from "../../../api/formDefinition";

type DesignerState = {
  formSchema: FormSchemaType;
  selectedFieldId?: string;
  isLoading: boolean;
  isSaving: boolean;
  setFormSchema: (schema: FormSchemaType) => void;
  addField: (field: Omit<FormFieldSchema, "fieldId">) => void;
  selectField: (fieldId?: string) => void;
  updateField: (fieldId: string, updates: Partial<FormFieldSchema>) => void;
  removeField: (fieldId: string) => void;
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
      type: FieldTypeEnum.Enum.input,
      label: "姓名",
      required: true,
      layout: { x: 0, y: 0, w: 12, h: 1 },
    },
  ],
  layout: {
    type: "grid",
    columns: 12,
  },
};

export const useFormDesignerStore = create<DesignerState>((set, get) => ({
  formSchema: FormSchema.parse(initialSchema),
  selectedFieldId: undefined,
  isLoading: false,
  isSaving: false,
  setFormSchema: (schema) => set({ formSchema: FormSchema.parse(schema) }),
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

      return {
        formSchema: {
          ...state.formSchema,
          fields: [...state.formSchema.fields, newField],
        },
        selectedFieldId: fieldId,
      };
    }),
  selectField: (fieldId) => set({ selectedFieldId: fieldId }),
  updateField: (fieldId, updates) =>
    set((state) => ({
      formSchema: {
        ...state.formSchema,
        fields: state.formSchema.fields.map((f) =>
          f.fieldId === fieldId ? { ...f, ...updates } : f
        ),
      },
    })),
  removeField: (fieldId) =>
    set((state) => ({
      formSchema: {
        ...state.formSchema,
        fields: state.formSchema.fields.filter((f) => f.fieldId !== fieldId),
      },
      selectedFieldId:
        state.selectedFieldId === fieldId ? undefined : state.selectedFieldId,
    })),
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
      const { formSchema } = state;
      if (formSchema.formId && formSchema.formId !== "form_mvp") {
        // 更新现有表单
        await formDefinitionApi.update(formSchema.formId, {
          formName: formSchema.formName,
          fields: formSchema.fields,
          layout: formSchema.layout,
          status: formSchema.status,
        });
      } else {
        // 创建新表单
        const response = await formDefinitionApi.create({
          formName: formSchema.formName,
          fields: formSchema.fields,
          layout: formSchema.layout,
          status: formSchema.status,
        });
        set({
          formSchema: {
            ...formSchema,
            formId: response.formId,
            version: response.version,
          },
        });
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
      const schema: FormSchemaType = {
        formId: response.formId,
        formName: response.formName,
        category: response.category,
        status: response.status,
        version: response.version,
        fields: response.config.fields,
        layout: response.config.layout,
      };
      set({
        formSchema: FormSchema.parse(schema),
        selectedFieldId: undefined,
      });
    } catch (error) {
      console.error("加载表单失败:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },
}));

