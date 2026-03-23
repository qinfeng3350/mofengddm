import type { FormFieldSchema } from "@mofeng/shared-schema";
import { FieldTypeEnum } from "@mofeng/shared-schema";

export type FieldDefinition = {
  label: string;
  type: FormFieldSchema["type"];
  description?: string;
  defaultConfig?: Partial<FormFieldSchema>;
};

export const BASIC_FIELDS: FieldDefinition[] = [
  {
    label: "单行文本",
    type: FieldTypeEnum.Enum.input,
    description: "用于录入短文本",
  },
  {
    label: "多行文本",
    type: FieldTypeEnum.Enum.textarea,
    description: "用于描述性内容",
    defaultConfig: {
      advanced: { rows: 4 },
    },
  },
  {
    label: "数字",
    type: FieldTypeEnum.Enum.number,
    description: "录入整数或小数",
  },
  {
    label: "日期",
    type: FieldTypeEnum.Enum.date,
  },
  {
    label: "单选",
    type: FieldTypeEnum.Enum.radio,
    defaultConfig: {
      options: [
        { label: "选项1", value: "option1" },
        { label: "选项2", value: "option2" },
      ],
    },
  },
  {
    label: "多选",
    type: FieldTypeEnum.Enum.multiselect,
    defaultConfig: {
      options: [
        { label: "选项1", value: "option1" },
        { label: "选项2", value: "option2" },
      ],
    },
  },
  {
    label: "附件",
    type: FieldTypeEnum.Enum.attachment,
  },
  {
    label: "人员选择",
    type: FieldTypeEnum.Enum.user,
  },
];

