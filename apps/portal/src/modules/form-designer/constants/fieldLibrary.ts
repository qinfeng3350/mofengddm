import type { FormFieldSchema } from "@mofeng/shared-schema";
import { FieldTypeEnum } from "@mofeng/shared-schema";

export type FieldDefinition = {
  label: string;
  type: FormFieldSchema["type"];
  description?: string;
  defaultConfig?: Partial<FormFieldSchema>;
};

// 基础控件
export const BASIC_FIELDS: FieldDefinition[] = [
  {
    label: "单行文本",
    type: "input",
    description: "用于录入短文本",
  },
  {
    label: "多行文本",
    type: "textarea",
    description: "用于描述性内容",
    defaultConfig: {
      advanced: { rows: 4 },
    },
  },
  {
    label: "日期",
    type: "date",
    description: "选择日期",
  },
  {
    label: "数字",
    type: "number",
    description: "录入整数或小数",
  },
  {
    label: "单选框",
    type: "radio",
    description: "单选按钮组",
    defaultConfig: {
      options: [
        { label: "选项1", value: "option1" },
        { label: "选项2", value: "option2" },
      ],
    },
  },
  {
    label: "复选框",
    type: "checkbox",
    description: "复选框组",
    defaultConfig: {
      options: [
        { label: "选项1", value: "option1" },
        { label: "选项2", value: "option2" },
      ],
    },
  },
  {
    label: "下拉框",
    type: "select",
    description: "从下拉列表中选择",
    defaultConfig: {
      options: [
        { label: "选项1", value: "option1" },
        { label: "选项2", value: "option2" },
      ],
    },
  },
  {
    label: "是/否",
    type: "checkbox",
    description: "布尔值选择",
  },
  {
    label: "附件",
    type: "attachment",
    description: "上传文件附件",
  },
  {
    label: "图片",
    type: "attachment",
    description: "上传图片",
  },
  {
    label: "地址",
    type: "input",
    description: "地址输入",
    defaultConfig: {
      advanced: { fieldType: "address" },
    },
  },
  {
    label: "位置",
    type: "input",
    description: "地理位置",
    defaultConfig: {
      advanced: { fieldType: "location" },
    },
  },
  {
    label: "人员单选",
    type: "user",
    description: "选择单个人员",
    defaultConfig: {
      advanced: { multiple: false },
    },
  },
  {
    label: "人员多选",
    type: "user",
    description: "选择多个人员",
    defaultConfig: {
      advanced: { multiple: true },
    },
  },
  {
    label: "部门单选",
    type: "department",
    description: "选择单个部门",
    defaultConfig: {
      advanced: { multiple: false },
    },
  },
  {
    label: "部门多选",
    type: "department",
    description: "选择多个部门",
    defaultConfig: {
      advanced: { multiple: true },
    },
  },
  {
    label: "日期时间",
    type: "datetime",
    description: "选择日期和时间",
  },
];

// 布局容器（不是字段，是容器）
export type LayoutContainerDefinition = {
  label: string;
  type: "groupTitle" | "multiColumn" | "tab";
  description?: string;
  defaultConfig?: Record<string, unknown>;
};

export const LAYOUT_CONTAINERS: LayoutContainerDefinition[] = [
  {
    label: "分组标题",
    type: "groupTitle",
    description: "分组标题容器，可包含其他字段",
    defaultConfig: {
      alignment: "left", // 左对齐、居中、右对齐
      lineWidth: 1, // 分割线粗细
      lineColor: "#d9d9d9", // 分割线颜色
    },
  },
  {
    label: "一行多列",
    type: "multiColumn",
    description: "多列布局容器，可在同一行放置多个字段",
    defaultConfig: {
      columns: 2, // 列数
    },
  },
  {
    label: "标签页",
    type: "tab",
    description: "标签页容器，可切换显示不同内容",
    defaultConfig: {
      tabs: [],
    },
  },
];

// 布局控件（这些是真正的字段）
export const LAYOUT_FIELDS: FieldDefinition[] = [
  {
    label: "描述说明",
    type: "textarea",
    description: "描述性文本字段",
    defaultConfig: {
      editable: false,
      placeholder: "请输入描述说明",
      advanced: { rows: 3 },
    },
  },
  {
    label: "子表",
    type: "subtable",
    description: "嵌套表单表格",
  },
];

// 系统控件
export const SYSTEM_FIELDS: FieldDefinition[] = [
  {
    label: "流水号",
    type: "serial",
    description: "自动生成流水号",
    defaultConfig: {
      isSystemField: true,
      systemFieldType: "serial",
      editable: false,
    },
  },
  {
    label: "创建人",
    type: "creator",
    description: "自动记录创建人",
    defaultConfig: {
      isSystemField: true,
      systemFieldType: "creator",
      editable: false,
    },
  },
  {
    label: "拥有者",
    type: "owner",
    description: "记录拥有者",
    defaultConfig: {
      isSystemField: true,
      systemFieldType: "owner",
      editable: false,
    },
  },
  {
    label: "所属部门",
    type: "department",
    description: "自动记录所属部门",
    defaultConfig: {
      isSystemField: true,
      systemFieldType: "department",
      editable: false,
    },
  },
  {
    label: "创建时间",
    type: "createTime",
    description: "自动记录创建时间",
    defaultConfig: {
      isSystemField: true,
      systemFieldType: "createTime",
      editable: false,
    },
  },
  {
    label: "修改时间",
    type: "updateTime",
    description: "自动记录修改时间",
    defaultConfig: {
      isSystemField: true,
      systemFieldType: "updateTime",
      editable: false,
    },
  },
];

// 高级控件
export const ADVANCED_FIELDS: FieldDefinition[] = [
  {
    label: "关联表单",
    type: "relatedForm",
    description: "关联其他表单数据",
  },
  {
    label: "关联表单多选",
    type: "relatedFormMulti",
    description: "关联多个表单数据",
  },
  {
    label: "公式型控件",
    type: "formula",
    description: "根据公式自动计算",
  },
  {
    label: "汇总计算",
    type: "formula",
    description: "汇总子表数据",
  },
  {
    label: "按钮",
    type: "button",
    description: "触发操作按钮",
  },
  {
    label: "手写签名",
    type: "signature",
    description: "手写签名输入",
  },
  {
    label: "AI识别",
    type: "aiRecognition",
    description: "AI智能识别",
  },
];

