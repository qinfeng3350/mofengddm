import { z } from "zod";

/**
 * 表单组件类型
 */
export const FieldTypeEnum = z.enum([
  "input",
  "textarea",
  "number",
  "select",
  "multiselect",
  "date",
  "datetime",
  "checkbox",
  "boolean", // 是/否（滑动开关，布尔值）
  "radio",
  "attachment",
  "subtable",
  "formula",
  "user",
  "department",
  "serial", // 流水号
  "creator", // 创建人
  "owner", // 拥有者
  "createTime", // 创建时间
  "updateTime", // 修改时间
  "relatedForm", // 关联表单
  "relatedFormMulti", // 关联表单多选
  "button", // 按钮
  "signature", // 手写签名
  "aiRecognition", // AI识别
]);

/**
 * 布局容器类型
 */
export const LayoutContainerTypeEnum = z.enum([
  "groupTitle", // 分组标题
  "multiColumn", // 一行多列
  "description", // 描述说明
  "tab", // 标签页
]);

/**
 * 表单字段 Schema（使用 lazy 处理递归引用）
 * 注意：必须在 LayoutContainerSchema 之前定义，因为容器会引用字段
 */
export const FormFieldSchema: z.ZodType<any> = z.lazy(() => z.object({
  fieldId: z.string().min(1),
  type: FieldTypeEnum,
  label: z.string().min(1),
  description: z.string().optional(),
  required: z.boolean().default(false),
  defaultValue: z.any().optional(),
  placeholder: z.string().optional(),
  visible: z.boolean().default(true),
  editable: z.boolean().default(true),
  validation: z
    .object({
      minLength: z.number().int().optional(),
      maxLength: z.number().int().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      regex: z.string().optional(),
    })
    .optional(),
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.union([z.string(), z.number()]),
      })
    )
    .optional(),
  layout: z
    .object({
      x: z.number().int().nonnegative().default(0),
      y: z.number().int().nonnegative().default(0),
      w: z.number().int().positive().default(12),
      h: z.number().int().positive().default(1),
    })
    .optional(),
  advanced: z.record(z.any()).optional(),
  // 公式字段配置
  formulaExpression: z.string().optional(), // 公式表达式，如 "field_1 * field_2"
  formulaDependencies: z.array(z.string()).optional(), // 依赖的字段ID列表
  // 关联表单配置
  relatedFormId: z.string().optional(), // 关联的表单ID
  relatedFormField: z.string().optional(), // 关联的表单字段ID（保留兼容）
  relatedDisplayField: z.string().optional(), // 用于展示的关联表单字段ID
  enableDataFilter: z.boolean().optional(), // 是否启用数据筛选
  /** 关联表单可选数据范围（关联表字段条件）；值支持 `{当前表单fieldId}` 动态引用 */
  relatedDataFilterConditions: z
    .array(
      z.object({
        fieldId: z.string(),
        operator: z.string(),
        value: z.string(),
      }),
    )
    .optional(),
  enableDataFill: z.boolean().optional(), // 是否启用数据填充
  allowCreateRelated: z.boolean().optional(), // 是否允许在选择时新增关联数据
  fieldMapping: z.record(z.string()).optional(), // 字段映射：{关联表单字段ID: 当前表单字段ID}
  // 子表配置（使用 lazy 处理递归）
  subtableFields: z.array(FormFieldSchema).optional(), // 子表的字段定义
  // 系统字段配置
  isSystemField: z.boolean().default(false), // 是否为系统字段
  systemFieldType: z.enum(["serial", "creator", "owner", "createTime", "updateTime"]).optional(), // 系统字段类型
}));

/**
 * 布局容器 Schema（使用 lazy 处理递归引用）
 * 注意：必须在 FormFieldSchema 之后定义，因为容器会引用字段
 */
export const LayoutContainerSchema: z.ZodType<any> = z.lazy(() => z.object({
  containerId: z.string().min(1),
  type: LayoutContainerTypeEnum,
  label: z.string().min(1),
  config: z.record(z.any()).optional(), // 容器配置（如列数、对齐方式等）
  children: z.array(z.union([FormFieldSchema, z.lazy(() => LayoutContainerSchema)])).optional(), // 子元素（字段或容器）
}));

/**
 * 表单元素类型（字段或布局容器）
 */
export type FormElement = z.infer<typeof FormFieldSchema> | z.infer<typeof LayoutContainerSchema>;

/**
 * 表单 Schema
 */
export const FormSchema = z.object({
  formId: z.string().min(1),
  formName: z.string().min(1),
  category: z.string().nullable().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  version: z.number().int().positive().default(1),
  // 支持字段和布局容器的混合结构（可选，向后兼容）
  elements: z.array(z.union([FormFieldSchema, LayoutContainerSchema])).optional(),
  // 为了向后兼容，保留 fields 字段（必需，因为现有代码都使用它）
  fields: z.array(FormFieldSchema),
  rules: z
    .array(
      z.object({
        ruleId: z.string(),
        trigger: z.enum(["change", "blur", "submit"]),
        condition: z.string(),
        actions: z.array(
          z.object({
            type: z.string(),
            payload: z.record(z.any()),
          })
        ),
      })
    )
    .optional(),
  layout: z
    .object({
      type: z.enum(["grid", "flex", "custom"]).default("grid"),
      columns: z.number().int().positive().default(12),
    })
    .optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * 页面组件 Schema
 */
export const PageWidgetSchema = z.object({
  widgetId: z.string(),
  type: z.string(),
  props: z.record(z.any()).default({}),
  binding: z
    .object({
      dataSourceId: z.string(),
      expression: z.string().optional(),
    })
    .optional(),
  children: z.lazy(() => z.array(PageWidgetSchema)).optional(),
  style: z.record(z.any()).optional(),
});

/**
 * 页面 Schema
 */
export const PageSchema = z.object({
  pageId: z.string(),
  pageName: z.string(),
  route: z.string().default("/"),
  widgets: z.array(PageWidgetSchema),
  metadata: z.record(z.any()).optional(),
});

/**
 * 流程节点 Schema
 */
export const WorkflowNodeSchema = z.object({
  nodeId: z.string(),
  type: z.enum(["start", "end", "approval", "condition", "parallel", "task"]),
  label: z.string(),
  position: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  assignees: z
    .object({
      type: z.enum(["user", "role", "department", "formField"]).optional(),
      values: z.array(z.string()).optional(),
    })
    .optional(),
  config: z.record(z.any()).optional(),
});

export const WorkflowEdgeSchema = z.object({
  edgeId: z.string(),
  source: z.string(),
  target: z.string(),
  condition: z.string().optional(),
  config: z.record(z.any()).optional(),
});

export const WorkflowSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  version: z.number().int().positive().default(1),
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(WorkflowEdgeSchema),
  metadata: z.record(z.any()).optional(),
});

/**
 * 字段权限（节点 + 角色）
 *
 * - action: hidden | readonly | editable
 * - roleRules: roleId -> { fieldId -> action }
 * - nodeRules: nodeId -> { fieldId -> action }
 */
export const FieldPermissionActionEnum = z.enum(["hidden", "readonly", "editable"]);
export type FieldPermissionAction = z.infer<typeof FieldPermissionActionEnum>;

export const FieldPermissionsConfigSchema = z.object({
  defaults: z
    .object({
      fallback: FieldPermissionActionEnum.default("editable"),
    })
    .optional(),
  roleRules: z.record(z.record(FieldPermissionActionEnum)).optional(),
  nodeRules: z.record(z.record(FieldPermissionActionEnum)).optional(),
});
export type FieldPermissionsConfig = z.infer<typeof FieldPermissionsConfigSchema>;

/**
 * 数据源 Schema（报表、大屏复用）
 */
export const DataSourceSchema = z.object({
  dataSourceId: z.string(),
  name: z.string(),
  type: z.enum(["form", "api", "sql"]),
  config: z.record(z.any()),
  refreshInterval: z.number().int().positive().optional(),
});

/**
 * 报表 Schema
 */
export const ReportSchema = z.object({
  reportId: z.string(),
  reportName: z.string(),
  dataSource: DataSourceSchema,
  fields: z.array(
    z.object({
      fieldId: z.string(),
      label: z.string(),
      sourceField: z.string(),
      aggregate: z.enum(["sum", "avg", "count", "max", "min"]).optional(),
      format: z.enum(["number", "currency", "percent", "date"]).optional(),
      visible: z.boolean().default(true),
    })
  ),
  filters: z
    .array(
      z.object({
        fieldId: z.string(),
        operator: z.string(),
        value: z.any(),
      })
    )
    .optional(),
  groupBy: z.array(z.string()).optional(),
  chart: z
    .object({
      type: z.enum(["table", "bar", "line", "pie", "area", "mixed"]),
      config: z.record(z.any()).optional(),
    })
    .optional(),
});

/**
 * 大屏组件 Schema
 */
export const DashboardWidgetSchema = z.object({
  componentId: z.string(),
  type: z.enum([
    "statistic",
    "chart",
    "map",
    "table",
    "progress",
    "text",
    "custom",
  ]),
  name: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  dataSource: DataSourceSchema.optional(),
  style: z.record(z.any()).optional(),
  animation: z.record(z.any()).optional(),
});

export const DashboardSchema = z.object({
  dashboardId: z.string(),
  dashboardName: z.string(),
  canvas: z.object({
    width: z.number().default(1920),
    height: z.number().default(1080),
    backgroundColor: z.string().default("#000000"),
    backgroundImage: z.string().optional(),
  }),
  widgets: z.array(DashboardWidgetSchema),
  theme: z.record(z.any()).optional(),
  autoRefresh: z.boolean().default(false),
  refreshInterval: z.number().optional(),
});

/**
 * 业务规则 Schema
 */
export const BusinessRuleTriggerSchema = z.object({
  event: z.enum(["create", "update", "delete", "statusChange"]), // 触发事件
  formId: z.string(), // 触发表单ID
  conditions: z
    .array(
      z.object({
        fieldId: z.string(), // 字段ID
        operator: z.enum(["eq", "ne", "gt", "gte", "lt", "lte", "contains", "in", "notIn"]), // 操作符
        value: z.any(), // 值
      })
    )
    .optional(), // 触发条件（满足这些条件才触发）
});

export const BusinessRuleActionSchema = z.object({
  type: z.enum([
    "createRecord", // 创建记录
    "updateRecord", // 更新记录
    "deleteRecord", // 删除记录
    "updateField", // 更新字段
    "sendNotification", // 发送通知
    "executeScript", // 执行脚本
    "callApi", // 调用API
  ]),
  targetFormId: z.string().optional(), // 目标表单ID（用于创建/更新/删除记录）
  fieldMapping: z.record(z.string()).optional(), // 字段映射：{目标表单字段ID: 源表单字段ID或固定值}
  targetRecordId: z.string().optional(), // 目标记录ID（用于更新/删除）
  notification: z
    .object({
      recipients: z.array(z.string()), // 接收人（用户ID或角色）
      title: z.string(),
      content: z.string(),
      template: z.string().optional(), // 通知模板
    })
    .optional(),
  script: z.string().optional(), // 脚本内容（JavaScript）
  api: z
    .object({
      url: z.string(),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]),
      headers: z.record(z.string()).optional(),
      body: z.record(z.any()).optional(),
    })
    .optional(),
});

export const BusinessRuleSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string().min(1), // 规则名称
  description: z.string().optional(), // 规则描述
  enabled: z.boolean().default(true), // 是否启用
  applicationId: z.string(), // 所属应用ID
  trigger: BusinessRuleTriggerSchema, // 触发条件
  actions: z.array(BusinessRuleActionSchema).min(1), // 执行动作（至少一个）
  priority: z.number().int().default(0), // 优先级（数字越大优先级越高）
  metadata: z.record(z.any()).optional(), // 扩展元数据
});

export type FormSchemaType = z.infer<typeof FormSchema>;
export type FormFieldSchemaType = z.infer<typeof FormFieldSchema>;
export type LayoutContainerSchemaType = z.infer<typeof LayoutContainerSchema>;
export type WorkflowSchemaType = z.infer<typeof WorkflowSchema>;
export type ReportSchemaType = z.infer<typeof ReportSchema>;
export type DashboardSchemaType = z.infer<typeof DashboardSchema>;
export type BusinessRuleSchemaType = z.infer<typeof BusinessRuleSchema>;
export type BusinessRuleTriggerSchemaType = z.infer<typeof BusinessRuleTriggerSchema>;
export type BusinessRuleActionSchemaType = z.infer<typeof BusinessRuleActionSchema>;

