import { Form, Input, Switch, Empty, InputNumber, Button, Modal, Space, Tabs, Select, Alert, Tag, Radio, Typography, Table, Checkbox } from "antd";
import { useMemo, useState, useEffect, useRef } from "react";
import { useFormDesignerStore } from "../store/useFormDesignerStore";
import { FieldTypeEnum } from "@mofeng/shared-schema";
import { CalculatorOutlined, DeleteOutlined, EditOutlined, HolderOutlined, PlusOutlined } from "@ant-design/icons";
import { useDroppable } from "@dnd-kit/core";
import { IconSelector } from "@/components/IconSelector";
import { FormPropertiesPanel } from "./FormPropertiesPanel";
import { OptionsConfigPanel } from "./OptionsConfigPanel";
import { SerialNumberConfigPanel } from "./SerialNumberConfigPanel";
import { useQuery } from "@tanstack/react-query";
import { formDefinitionApi } from "@/api/formDefinition";
import { useSearchParams } from "react-router-dom";
import styles from "./PropertyPanel.module.css";
import { FormulaDefaultEditorModal } from "./FormulaDefaultEditorModal";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/useAuthStore";

export const PropertyPanel = () => {
  const formSchema = useFormDesignerStore((state) => state.formSchema);
  const setFormSchema = useFormDesignerStore((state) => state.setFormSchema);
  const selectedFieldId = useFormDesignerStore((state) => state.selectedFieldId);
  const selectedContainerId = useFormDesignerStore((state) => state.selectedContainerId);
  const selectedSubtableField = useFormDesignerStore((state) => state.selectedSubtableField);
  const updateField = useFormDesignerStore((state) => state.updateField);
  const updateContainer = useFormDesignerStore((state) => state.updateContainer);
  const [activeTab, setActiveTab] = useState("field");

  const findFieldInSchema = (fieldId?: string) => {
    if (!fieldId) return undefined;
    let field = formSchema.fields.find((f) => f.fieldId === fieldId);
    if (field) return field as any;
    const elements = formSchema.elements || [];
    const stack: any[] = [...elements];
    while (stack.length) {
      const el = stack.shift();
      if (!el) continue;
      if ("fieldId" in el && el.fieldId === fieldId) return el as any;
      if ("children" in el && Array.isArray((el as any).children)) {
        stack.push(...(el as any).children);
      }
      if ("columns" in el && Array.isArray((el as any).columns)) {
        (el as any).columns.forEach((col: any) => {
          if (col?.children && Array.isArray(col.children)) stack.push(...col.children);
        });
      }
    }
    return undefined;
  };

  const currentField = useMemo(() => {
    // 子表列字段被选中：返回“子字段”，并携带 parentId 信息用于回写
    if (selectedSubtableField?.parentFieldId && selectedSubtableField?.subFieldId) {
      const parent = findFieldInSchema(selectedSubtableField.parentFieldId);
      const subs: any[] = parent?.subtableFields || [];
      const sub = subs.find((sf: any) => sf?.fieldId === selectedSubtableField.subFieldId);
      if (parent && sub) {
        return {
          ...sub,
          __subtableParentFieldId: parent.fieldId,
          __subtableSubFieldId: sub.fieldId,
        } as any;
      }
    }
    // 首先从 fields 数组中查找
    let field = formSchema.fields.find((field) => field.fieldId === selectedFieldId);
    if (field) return field;
    
    // 如果没找到，从 elements 中查找（包括容器内的字段）
    const elements = formSchema.elements || [];
    for (const element of elements) {
      if ('fieldId' in element && element.fieldId === selectedFieldId) {
        return element as any;
      }
      // 如果是容器，检查其 children
      if ('containerId' in element && (element as any).children) {
        const childField = (element as any).children.find(
          (child: any) => 'fieldId' in child && child.fieldId === selectedFieldId
        );
        if (childField) return childField;
      }
    }
    return undefined;
  }, [formSchema.fields, formSchema.elements, selectedFieldId, selectedSubtableField]);

  const currentContainer = useMemo(() => {
    const elements = formSchema.elements || [];
    return elements.find((el: any) => 'containerId' in el && el.containerId === selectedContainerId);
  }, [formSchema.elements, selectedContainerId]);

  // 当选中字段或容器时，切换到控件属性标签页
  useEffect(() => {
    if (currentField || currentContainer) {
      setActiveTab("field");
    } else {
      setActiveTab("form");
    }
  }, [currentField, currentContainer]);

  const handleFieldValuesChange = (changedValues: Record<string, unknown>) => {
    const asAny = currentField as any;
    // 子表列字段：写回父字段的 subtableFields
    if (asAny?.__subtableParentFieldId && asAny?.__subtableSubFieldId) {
      const parentId = String(asAny.__subtableParentFieldId);
      const subId = String(asAny.__subtableSubFieldId);
      const parent = findFieldInSchema(parentId);
      const subs: any[] = parent?.subtableFields || [];
      const nextSubs = subs.map((sf: any) =>
        String(sf?.fieldId) === subId ? { ...sf, ...changedValues } : sf
      );
      updateField(parentId, { subtableFields: nextSubs } as any);
      return;
    }
    if (selectedFieldId) {
      // 立即更新字段，确保修改立即生效
      updateField(selectedFieldId, changedValues);
    }
  };

  const handleContainerValuesChange = (changedValues: Record<string, unknown>) => {
    if (selectedContainerId) {
      updateContainer(selectedContainerId, changedValues);
    }
  };

  const handleFormValuesChange = (changedValues: Record<string, unknown>) => {
    setFormSchema({
      ...formSchema,
      ...changedValues,
    });
  };

  return (
    <div style={{ 
      padding: "12px", 
      height: "100%", 
      overflow: "auto",
      background: "#fafafa",
      scrollbarWidth: "thin",
      scrollbarColor: "#d9d9d9 #fafafa",
    }}
    className={styles.propertyPanelScroll}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{
          background: "#fff",
          padding: "8px",
          borderRadius: "8px",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
        }}
        items={[
          {
            key: "field",
            label: "控件属性",
            children: currentField ? (
              <FieldPropertiesPanel field={currentField} onValuesChange={handleFieldValuesChange} formSchema={formSchema} />
            ) : currentContainer ? (
              <ContainerPropertiesPanel container={currentContainer} onValuesChange={handleContainerValuesChange} />
            ) : (
              <Empty description="请选择画布中的字段或容器以编辑属性" />
            ),
            disabled: !currentField && !currentContainer,
          },
          {
            key: "form",
            label: "表单属性",
            children: (
              <FormPropertiesPanel formSchema={formSchema} onValuesChange={handleFormValuesChange} />
            ),
          },
        ]}
      />
    </div>
  );
};

/** 与 DesignerCanvas / FormRenderer 一致：表单布局 → 栅格列数 */
function getFormLayoutColumnsCount(formSchema: any): number {
  const mode = formSchema?.metadata?.formLayout || "double";
  if (mode === "single") return 1;
  if (mode === "triple") return 3;
  if (mode === "quad") return 4;
  return 2;
}

/** 未配置 fieldSpan 时，与当前表单列数对齐的默认占位（24 栅格） */
function defaultFieldSpanForLayout(columnsCount: number): number {
  if (columnsCount === 1) return 24;
  return Math.floor(24 / columnsCount) || 12;
}

/**
 * 控件「布局」下拉：选项与文案随表单「单列/双列/三列/四列」变化，避免三列表单仍只显示「1/2」等双列语义。
 */
function getFieldSpanOptions(columnsCount: number): { value: number; label: string }[] {
  switch (columnsCount) {
    case 1:
      return [{ value: 24, label: "整行" }];
    case 2:
      return [
        { value: 12, label: "1/2 行（一列）" },
        { value: 24, label: "整行" },
        { value: 6, label: "1/4 行" },
        { value: 8, label: "1/3 行" },
        { value: 16, label: "2/3 行" },
        { value: 18, label: "3/4 行" },
      ];
    case 3:
      return [
        { value: 8, label: "1/3 行（一列）" },
        { value: 16, label: "2/3 行（两列）" },
        { value: 12, label: "1/2 行" },
        { value: 24, label: "整行" },
        { value: 6, label: "1/4 行" },
        { value: 18, label: "3/4 行" },
      ];
    case 4:
      return [
        { value: 6, label: "1/4 行（一列）" },
        { value: 12, label: "1/2 行（两列）" },
        { value: 18, label: "3/4 行（三列）" },
        { value: 24, label: "整行" },
        { value: 8, label: "1/3 行" },
        { value: 16, label: "2/3 行" },
      ];
    default:
      return [
        { value: 6, label: "1/4" },
        { value: 8, label: "1/3" },
        { value: 12, label: "1/2" },
        { value: 16, label: "2/3" },
        { value: 18, label: "3/4" },
        { value: 24, label: "全部" },
      ];
  }
}

function buildFieldSpanSelectOptions(
  columnsCount: number,
  currentSpan: number | undefined
): { value: number; label: string }[] {
  const base = getFieldSpanOptions(columnsCount);
  const allowed = new Set(base.map((o) => o.value));
  const raw = Number(currentSpan);
  if (Number.isFinite(raw) && raw > 0 && raw <= 24 && !allowed.has(raw)) {
    return [{ value: raw, label: `${raw}/24（当前）` }, ...base];
  }
  return base;
}

function collectSchemaFields(schema: any): any[] {
  const result = new Map<string, any>();
  const cfg = schema || {};
  (cfg.fields || []).forEach((f: any) => {
    if (f?.fieldId) result.set(String(f.fieldId), f);
  });
  (cfg.elements || []).forEach((el: any) => {
    if (el && "fieldId" in el && el.fieldId && !result.has(String(el.fieldId))) {
      result.set(String(el.fieldId), el);
    }
    if (el && "children" in el && Array.isArray(el.children)) {
      el.children.forEach((child: any) => {
        if (child && "fieldId" in child && child.fieldId && !result.has(String(child.fieldId))) {
          result.set(String(child.fieldId), child);
        }
      });
    }
  });
  return Array.from(result.values());
}

/**
 * 属性面板里 Ant Form 与 useForm 单例会「合并」 setFieldsValue，切换字段时必须 reset，
 * 否则上一字段的 advanced.defaultMode 等会残留，表现为新字段默认变成公式编辑、多字段互相串值。
 * 对支持「自定义 / 数据联动 / 公式编辑」的字段，store 里未写 defaultMode 时表单侧默认「自定义」。
 */
function mergeFieldForPropertiesForm(field: any, formSchema?: any): Record<string, unknown> {
  const t = field.type;
  const usesDefaultModeThreeWay =
    t !== "user" &&
    t !== "department" &&
    t !== "date" &&
    t !== "datetime" &&
    t !== "formula" &&
    t !== "subtable" &&
    t !== "serial";

  const cols = getFormLayoutColumnsCount(formSchema);
  const adv = { ...(field.advanced || {}) };
  if (usesDefaultModeThreeWay) {
    adv.defaultMode = adv.defaultMode ?? "custom";
  }
  if (t !== "subtable" && adv.fieldSpan == null) {
    adv.fieldSpan = defaultFieldSpanForLayout(cols);
  }

  return {
    ...field,
    dataSource: adv.optionsSource ?? "custom",
    advanced: adv,
  };
}

// 控件属性面板
const FieldPropertiesPanel = ({ 
  field, 
  onValuesChange, 
  formSchema 
}: { 
  field: any; 
  onValuesChange: (values: Record<string, unknown>) => void;
  formSchema: any;
}) => {
  const [form] = Form.useForm();
  const [fieldTab, setFieldTab] = useState("basic");
  const [formulaDefaultModalOpen, setFormulaDefaultModalOpen] = useState(false);
  const [dataLinkModalOpen, setDataLinkModalOpen] = useState(false);
  const prevFieldIdRef = useRef<string | undefined>(undefined);
  
  // 只在字段切换时（fieldId 变化）重置并灌入当前字段，避免 Form 合并残留上一字段的状态
  useEffect(() => {
    if (prevFieldIdRef.current !== field.fieldId) {
      form.resetFields();
      form.setFieldsValue(mergeFieldForPropertiesForm(field, formSchema));
      prevFieldIdRef.current = field.fieldId;
      setFieldTab("basic");
    }
  }, [field.fieldId, field, form, formSchema]);
  
  const isSerialField = field.type === "serial";

  const columnsCount = useMemo(
    () => getFormLayoutColumnsCount(formSchema),
    [formSchema?.metadata?.formLayout]
  );
  const fieldSpanSelectOptions = useMemo(
    () =>
      buildFieldSpanSelectOptions(
        columnsCount,
        field.advanced?.fieldSpan != null ? Number(field.advanced.fieldSpan) : undefined
      ),
    [columnsCount, field.advanced?.fieldSpan]
  );

  // 部门字段设计时需要：用于“本部门”默认快捷值
  const { user: authUser } = useAuthStore();
  const { data: currentUserWithDept } = useQuery({
    queryKey: ["current-user-with-dept", authUser?.id, authUser?.account],
    enabled: field.type === "department" && !!authUser?.id && !!authUser?.account,
    retry: false,
    queryFn: async () => {
      const res = await apiClient.get("/users", {
        params: { includeDisabled: "true" },
      });
      const list = Array.isArray(res) ? res : [];
      return list.find((u: any) => String(u.id) === String(authUser?.id)) || null;
    },
  });
  const currentDepartmentId = currentUserWithDept?.departmentId != null ? String(currentUserWithDept.departmentId) : undefined;
  const [searchParams] = useSearchParams();
  const appId = searchParams.get("appId");
  const applicationId = useFormDesignerStore((state) => state.applicationId);
  const finalAppId = appId || applicationId;
  const optionDataSource = Form.useWatch("dataSource", form) || field.advanced?.optionsSource || "custom";
  const optionsRelatedFormId = Form.useWatch(["advanced", "optionsRelatedFormId"], form) as
    | string
    | undefined;
  const optionColorful = Form.useWatch(["advanced", "colorful"], form) === true;
  const defaultDataLink = (Form.useWatch(["advanced", "defaultDataLink"], form) as any) || field.advanced?.defaultDataLink;
  const currentFormFields = useMemo(
    () =>
      collectSchemaFields(formSchema).filter(
        (f: any) => String(f?.fieldId || "") !== String(field.fieldId || ""),
      ),
    [formSchema, field.fieldId],
  );

  const { data: optionFormsList, isLoading: optionFormsLoading } = useQuery({
    queryKey: ["option-field-forms", finalAppId],
    queryFn: () => formDefinitionApi.getListByApplication(finalAppId!),
    enabled:
      !!finalAppId &&
      (field.type === FieldTypeEnum.Enum.select ||
        field.type === FieldTypeEnum.Enum.radio ||
        field.type === FieldTypeEnum.Enum.checkbox ||
        field.type === FieldTypeEnum.Enum.multiselect) &&
      optionDataSource === "relatedForm",
    staleTime: 30_000,
  });

  const optionRelatedFormDefinition = useMemo(() => {
    if (!optionFormsList || !optionsRelatedFormId) return null;
    return (optionFormsList as any[]).find(
      (f) => String(f.formId) === String(optionsRelatedFormId),
    ) || null;
  }, [optionFormsList, optionsRelatedFormId]);

  const optionRelatedFields = useMemo(() => {
    const cfg: any = (optionRelatedFormDefinition as any)?.config || {};
    const fields = Array.isArray(cfg.fields) ? cfg.fields : [];
    return fields
      .filter((f: any) => f && f.fieldId)
      .map((f: any) => ({
        label: f.label ? `${f.label}` : String(f.fieldId),
        value: String(f.fieldId),
      }));
  }, [optionRelatedFormDefinition]);

  // 如果用户已经选择“本部门”但当前用户部门还没加载完，
  // 等拿到 departmentId 后自动补齐 defaultValue，避免出现“选了但没有默认值”的情况。
  useEffect(() => {
    const mode = form.getFieldValue(["advanced", "defaultMode"]);
    if (mode === "currentDepartment" && currentDepartmentId) {
      const dv = form.getFieldValue("defaultValue");
      if (dv == null || dv === "") {
        form.setFieldsValue({ defaultValue: currentDepartmentId });
        // 避免仅依赖 antd Form 的 onValuesChange 触发：这里显式同步写回 store
        onValuesChange({
          advanced: {
            ...(field.advanced || {}),
            defaultMode: "currentDepartment",
          },
          defaultValue: currentDepartmentId,
        });
      }
    }
  }, [currentDepartmentId, form]);
  
  const basicForm = (
    <Form
      form={form}
      layout="vertical"
      initialValues={mergeFieldForPropertiesForm(field, formSchema)}
      onValuesChange={(changedValues, allValues) => {
        // 先把原始变更回调出去
        if (Object.keys(changedValues).length) {
          onValuesChange(changedValues);
        }

        // 如果修改了状态，同步 visible / editable，并一起回调
        if ("status" in changedValues) {
          const status = changedValues.status as string;
          let updates: any;
          if (status === "hidden") {
            updates = { status, visible: false, editable: false };
          } else if (status === "readonly") {
            updates = { status, visible: true, editable: false };
          } else if (status === "disabled") {
            updates = { status, visible: true, editable: false };
          } else {
            updates = { status, visible: true, editable: true };
          }

          form.setFieldsValue({
            visible: updates.visible,
            editable: updates.editable,
          });

          onValuesChange(updates);
        }
      }}
      key={field.fieldId}
    >
      <Form.Item label="字段类型">
        <Input
          value={
            field.type === FieldTypeEnum.Enum.boolean
              ? "boolean（是/否开关）"
              : field.type
          }
          disabled
        />
      </Form.Item>
      <Form.Item label="字段名称" name="label" rules={[{ required: true }]}>
        <Input placeholder="请输入字段名称" />
      </Form.Item>
      <Form.Item label="占位提示" name="placeholder">
        <Input placeholder="请输入占位提示" />
      </Form.Item>
      <Form.Item
        label="字段 ID"
        tooltip="系统自动生成，供接口调用使用"
      >
        <Input value={field.fieldId} disabled />
      </Form.Item>
      <Form.Item label="是否必填" name="required" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item label="是否可见" name="visible" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item label="是否可编辑" name="editable" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item label="状态" name="status" initialValue={field.status || "normal"}>
        <Radio.Group>
          <Radio value="normal">普通</Radio>
          <Radio value="disabled">禁用</Radio>
          <Radio value="readonly">只读</Radio>
          <Radio value="hidden">隐藏</Radio>
        </Radio.Group>
      </Form.Item>

      {/* 字段布局：主表字段可单独设置宽度，子表字段除外 */}
      {field.type !== "subtable" && (
        <Form.Item
          label="布局"
          name={["advanced", "fieldSpan"]}
          initialValue={
            field.advanced?.fieldSpan ?? defaultFieldSpanForLayout(columnsCount)
          }
          tooltip="与「表单属性 → 表单布局」一致：三列时默认占 1/3 行（8/24 栅格）"
        >
          <Select
            options={fieldSpanSelectOptions.map((o) => ({
              value: o.value,
              label: o.label,
            }))}
          />
        </Form.Item>
      )}

      {/* 数字类型特定配置 */}
      {field.type === FieldTypeEnum.Enum.number && (
        <>
          <Form.Item label="最小值" name={["validation", "min"]}>
            <InputNumber placeholder="最小值" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="最大值" name={["validation", "max"]}>
            <InputNumber placeholder="最大值" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="小数位数" name={["validation", "precision"]}>
            <InputNumber min={0} max={10} placeholder="小数位数" style={{ width: "100%" }} />
          </Form.Item>

          {/* 数字显示格式（对应你截图那块） */}
          <Form.Item label="格式" style={{ marginTop: 8 }}>
            <Select value="number" disabled>
              <Select.Option value="number">数值</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue }) => {
              const nf = getFieldValue(["advanced", "numberFormat"]) || {};
              const keepDecimals = nf.keepDecimals !== false; // 默认开启
              const decimalPlaces =
                typeof nf.decimalPlaces === "number"
                  ? nf.decimalPlaces
                  : typeof getFieldValue(["validation", "precision"]) === "number"
                    ? getFieldValue(["validation", "precision"])
                    : 2;
              const noRounding = nf.noRounding === true;
              const thousand = nf.thousandSeparator === true;
              const unit = nf.unit || "";
              const sample = 99999.56;
              const toFixed = (n: number, p: number) => {
                const s = String(n);
                if (!noRounding) return n.toFixed(p);
                const [i, d = ""] = s.split(".");
                return p <= 0 ? i : `${i}.${d.padEnd(p, "0").slice(0, p)}`;
              };
              const withSep = (s: string) => {
                const [i, d] = s.split(".");
                const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                return d != null && d !== "" ? `${ii}.${d}` : ii;
              };
              const sampleStr = keepDecimals ? toFixed(sample, decimalPlaces) : String(sample);
              const preview = `${thousand ? withSep(sampleStr) : sampleStr}${unit ? ` ${unit}` : ""}`;
              return (
                <>
                  <Form.Item name={["advanced", "numberFormat", "keepDecimals"]} valuePropName="checked" initialValue={keepDecimals}>
                    <Checkbox>保留小数位数</Checkbox>
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate={(p, c) => p.advanced?.numberFormat?.keepDecimals !== c.advanced?.numberFormat?.keepDecimals}>
                    {({ getFieldValue }) =>
                      getFieldValue(["advanced", "numberFormat", "keepDecimals"]) !== false && (
                        <Form.Item
                          label="小数位数"
                          name={["advanced", "numberFormat", "decimalPlaces"]}
                          initialValue={decimalPlaces}
                        >
                          <InputNumber min={0} max={10} style={{ width: "100%" }} />
                        </Form.Item>
                      )
                    }
                  </Form.Item>
                  <Form.Item name={["advanced", "numberFormat", "noRounding"]} valuePropName="checked" initialValue={noRounding}>
                    <Checkbox>不四舍五入</Checkbox>
                  </Form.Item>
                  <Form.Item name={["advanced", "numberFormat", "thousandSeparator"]} valuePropName="checked" initialValue={thousand}>
                    <Checkbox>显示千分符</Checkbox>
                  </Form.Item>
                  <div style={{ padding: "6px 10px", background: "#fafafa", borderRadius: 6, marginBottom: 8 }}>
                    <Typography.Text type="secondary">{preview}</Typography.Text>
                  </div>
                  <Form.Item label="单位" name={["advanced", "numberFormat", "unit"]} initialValue={unit}>
                    <Input placeholder="请输入" />
                  </Form.Item>
                </>
              );
            }}
          </Form.Item>
        </>
      )}

      {/* 文本类型特定配置 */}
      {(field.type === FieldTypeEnum.Enum.input ||
        field.type === FieldTypeEnum.Enum.textarea) && (
        <>
          <Form.Item label="最小长度" name={["validation", "minLength"]}>
            <InputNumber min={0} placeholder="最小长度" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="最大长度" name={["validation", "maxLength"]}>
            <InputNumber min={0} placeholder="最大长度" style={{ width: "100%" }} />
          </Form.Item>
        </>
      )}

      {/* 选项类型特定配置 */}
      {(field.type === FieldTypeEnum.Enum.select ||
        field.type === FieldTypeEnum.Enum.radio ||
        field.type === FieldTypeEnum.Enum.checkbox ||
        field.type === FieldTypeEnum.Enum.multiselect) && (
        <>
          <Form.Item label="选项" name="dataSource">
            <Select
              options={[
                { value: "relatedForm", label: "关联其他表单数据" },
                { value: "custom", label: "自定义" },
                { value: "dataLink", label: "数据联动" },
              ]}
              onChange={(v) => {
                const next = String(v || "custom");
                form.setFieldValue("dataSource", next);
                onValuesChange({
                  advanced: {
                    ...(field.advanced || {}),
                    optionsSource: next,
                  },
                });
              }}
            />
          </Form.Item>

          {optionDataSource === "relatedForm" ? (
            <>
              <Form.Item label="关联其他表单数据" name={["advanced", "optionsRelatedFormId"]}>
                <Select
                  placeholder={optionFormsLoading ? "加载中..." : finalAppId ? "请选择关联表单" : "请先选择应用"}
                  loading={optionFormsLoading}
                  disabled={!finalAppId || optionFormsLoading}
                  options={(optionFormsList || []).map((f: any) => ({
                    label: f.formName || f.formId,
                    value: String(f.formId),
                  }))}
                  onChange={(v) => {
                    form.setFieldValue(["advanced", "optionsRelatedFormId"], v);
                    form.setFieldValue(["advanced", "optionsRelatedLabelFieldId"], undefined);
                    onValuesChange({
                      advanced: {
                        ...(field.advanced || {}),
                        optionsSource: "relatedForm",
                        optionsRelatedFormId: String(v || ""),
                        optionsRelatedLabelFieldId: undefined,
                      },
                    });
                  }}
                />
              </Form.Item>
              <Form.Item label="展示字段" name={["advanced", "optionsRelatedLabelFieldId"]}>
                <Select
                  placeholder={optionsRelatedFormId ? "请选择展示字段" : "请先选择关联表单"}
                  disabled={!optionsRelatedFormId}
                  options={optionRelatedFields}
                  onChange={(v) => {
                    form.setFieldValue(["advanced", "optionsRelatedLabelFieldId"], v);
                    onValuesChange({
                      advanced: {
                        ...(field.advanced || {}),
                        optionsSource: "relatedForm",
                        optionsRelatedFormId: String(optionsRelatedFormId || ""),
                        optionsRelatedLabelFieldId: String(v || ""),
                      },
                    });
                  }}
                />
              </Form.Item>
              <Form.Item name={["advanced", "optionsAllowOther"]} valuePropName="checked">
                <Checkbox>添加其他选项</Checkbox>
              </Form.Item>
              <Form.Item name={["advanced", "optionsOtherAtBottom"]} valuePropName="checked">
                <Checkbox>其他选项位于底部</Checkbox>
              </Form.Item>
              <Form.Item name={["advanced", "optionsAllowCreateRelated"]} valuePropName="checked">
                <Checkbox>允许新增关联表数据</Checkbox>
              </Form.Item>
            </>
          ) : optionDataSource === "dataLink" ? (
            <Form.Item>
              <Button block type="default">
                数据联动设置
              </Button>
            </Form.Item>
          ) : (
            <Form.Item
              label="选项"
              name="options"
              rules={[
                {
                  validator: (_, value) => {
                    if (!value || value.length === 0) {
                      return Promise.reject(new Error("至少需要添加一个选项"));
                    }
                    return Promise.resolve();
                  },
                },
              ]}
            >
              <OptionsConfigPanel
                fieldType={field.type}
                allowColor={
                  (field.type === FieldTypeEnum.Enum.select || field.type === FieldTypeEnum.Enum.multiselect) &&
                  optionColorful
                }
                value={form.getFieldValue("options") || field.options || []}
                onChange={(options) => {
                  form.setFieldValue("options", options);
                  const defaultOption = options.find((opt: any) => opt?.isDefault);
                  if (defaultOption) {
                    form.setFieldValue("defaultValue", defaultOption.value);
                    onValuesChange({ options, defaultValue: defaultOption.value });
                  } else {
                    onValuesChange({ options });
                  }
                  onValuesChange({
                    advanced: {
                      ...(field.advanced || {}),
                      optionsSource: "custom",
                    },
                  });
                }}
              />
            </Form.Item>
          )}

          {/* 移动端显示模式（仅下拉框） */}
          {field.type === FieldTypeEnum.Enum.select && (
            <Form.Item
              label="移动端显示模式"
              name={["advanced", "mobileDisplayMode"]}
              initialValue="dropdown"
            >
              <Select>
                <Select.Option value="dropdown">下拉选择</Select.Option>
                <Select.Option value="sideSlide">侧滑选择</Select.Option>
              </Select>
            </Form.Item>
          )}

          {/* 彩色选项开关（仅下拉框和多选） */}
          {(field.type === FieldTypeEnum.Enum.select || field.type === FieldTypeEnum.Enum.multiselect) && (
            <Form.Item
              label="彩色"
              name={["advanced", "colorful"]}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          )}
        </>
      )}

      {/* 关联表单字段配置 */}
      {(field.type === FieldTypeEnum.Enum.relatedForm ||
        field.type === FieldTypeEnum.Enum.relatedFormMulti) && (
        <RelatedFormConfigPanel
          field={field}
          formSchema={formSchema}
          onUpdate={(updates) => onValuesChange(updates)}
        />
      )}

      {/* 公式字段配置 */}
      {field.type === FieldTypeEnum.Enum.formula && (
        <FormulaConfigPanel 
          field={field} 
          formSchema={formSchema}
          onUpdate={(updates) => onValuesChange(updates)}
        />
      )}

      {/* 是/否开关：无需配置选项 */}
      {field.type === FieldTypeEnum.Enum.boolean && (
        <Form.Item label="说明">
          <Typography.Text type="secondary">
            滑动开关，值为是/否（true/false），无需添加选项。
          </Typography.Text>
        </Form.Item>
      )}

      {/* 子表字段配置 */}
      {field.type === "subtable" && (
        <SubtableFieldsConfigPanel 
          field={field} 
          onUpdate={(updates) => onValuesChange(updates)}
        />
      )}

      {/* 默认值配置 - 对于非公式字段和非流水号字段 */}
      {field.type !== FieldTypeEnum.Enum.formula && field.type !== "subtable" && field.type !== "serial" && (
        <>
          {/* 人员字段：支持快捷默认“当前登录人” */}
          {field.type === "user" && (
            <>
              <Form.Item
                label="默认值"
                name={["advanced", "defaultMode"]}
                initialValue={field.advanced?.defaultMode || "none"}
              >
                <Select
                  onChange={(mode) => {
                    const nextAdvanced = {
                      ...(field.advanced || {}),
                      ...(form.getFieldValue("advanced") || {}),
                      defaultMode: mode,
                    };
                    form.setFieldsValue({ advanced: nextAdvanced });
                    onValuesChange({ advanced: nextAdvanced });
                  }}
                >
                  <Select.Option value="none">无</Select.Option>
                  <Select.Option value="currentUser">当前登录人</Select.Option>
                  <Select.Option value="custom">自定义</Select.Option>
                  <Select.Option value="dataLink">数据联动</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.advanced?.defaultMode !== curr.advanced?.defaultMode}>
                {({ getFieldValue }) =>
                  getFieldValue(["advanced", "defaultMode"]) === "custom" && (
                    <Form.Item label="自定义默认值" name="defaultValue">
                      <Input placeholder="请输入用户ID（暂不支持选择器）" />
                    </Form.Item>
                  )
                }
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.advanced?.defaultMode !== curr.advanced?.defaultMode}>
                {({ getFieldValue }) =>
                  getFieldValue(["advanced", "defaultMode"]) === "dataLink" && (
                    <Form.Item>
                      <Button block type="default" onClick={() => setDataLinkModalOpen(true)}>
                        数据联动设置
                      </Button>
                    </Form.Item>
                  )
                }
              </Form.Item>
            </>
          )}

          {/* 部门字段：预留快捷默认（后续可接入“当前用户部门”） */}
          {field.type === "department" && (
            <>
              <Form.Item
                label="默认值模式"
                name={["advanced", "defaultMode"]}
                initialValue={field.advanced?.defaultMode || "none"}
              >
                <Select
                  onChange={(mode) => {
                    if (mode === "none") {
                      form.setFieldsValue({ defaultValue: undefined });
                      onValuesChange({
                        advanced: {
                          ...(field.advanced || {}),
                          defaultMode: mode,
                        },
                        defaultValue: undefined,
                      });
                      return;
                    }
                    if (mode === "currentDepartment") {
                      if (!currentDepartmentId) return;
                      form.setFieldsValue({ defaultValue: currentDepartmentId });
                      onValuesChange({
                        advanced: {
                          ...(field.advanced || {}),
                          defaultMode: mode,
                        },
                        defaultValue: currentDepartmentId,
                      });
                      return;
                    }
                    // custom：如果之前没有，就先从本部门给一个起点
                    const nextCustomDv = field.defaultValue ?? currentDepartmentId ?? undefined;
                    form.setFieldsValue({
                      defaultValue:
                        nextCustomDv,
                    });
                    onValuesChange({
                      advanced: {
                        ...(field.advanced || {}),
                        defaultMode: mode,
                      },
                      defaultValue: nextCustomDv,
                    });
                  }}
                >
                  <Select.Option value="none">无</Select.Option>
                  <Select.Option value="currentDepartment">本部门</Select.Option>
                  <Select.Option value="custom">自定义</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.advanced?.defaultMode !== curr.advanced?.defaultMode}>
                {({ getFieldValue }) =>
                  getFieldValue(["advanced", "defaultMode"]) === "custom" && (
                    <Form.Item label="默认值" name="defaultValue">
                      <Input placeholder="请输入部门ID（自定义模式）" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </>
          )}

          {/* 日期 / 日期时间 字段：支持“当前时间” */}
          {(field.type === "date" || field.type === "datetime") && (
            <>
              <Form.Item
                label="格式"
                name={["advanced", "dateFormat"]}
                initialValue={field.advanced?.dateFormat || (field.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm:ss")}
              >
                <Select>
                  {field.type === "date" ? (
                    <>
                      <Select.Option value="YYYY-MM-DD">年-月-日</Select.Option>
                      <Select.Option value="YYYY-MM">年-月</Select.Option>
                      <Select.Option value="YYYY">年</Select.Option>
                    </>
                  ) : (
                    <>
                      <Select.Option value="YYYY-MM-DD HH:mm">年-月-日 时:分</Select.Option>
                      <Select.Option value="YYYY-MM-DD HH:mm:ss">年-月-日 时:分:秒</Select.Option>
                      <Select.Option value="YYYY-MM-DD">年-月-日</Select.Option>
                      <Select.Option value="YYYY-MM">年-月</Select.Option>
                    </>
                  )}
                </Select>
              </Form.Item>
              <Form.Item
                label="默认值"
                name={["advanced", "defaultMode"]}
                initialValue={field.advanced?.defaultMode || "none"}
              >
                <Select>
                  <Select.Option value="none">无</Select.Option>
                  <Select.Option value="now">当前时间</Select.Option>
                  <Select.Option value="custom">自定义</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.advanced?.defaultMode !== curr.advanced?.defaultMode}>
                {({ getFieldValue }) =>
                  getFieldValue(["advanced", "defaultMode"]) === "custom" && (
                    <Form.Item label="自定义默认值" name="defaultValue">
                      <Input placeholder="请输入默认日期/时间，如 2026-01-06" />
                    </Form.Item>
                  )
                }
              </Form.Item>
            </>
          )}

          {/* 是/否：布尔默认值 */}
          {field.type === FieldTypeEnum.Enum.boolean && (
            <Form.Item label="默认值" name="defaultValue" valuePropName="checked">
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          )}

          {/* 其他字段：默认值支持 3 种模式（自定义 / 数据联动 / 公式编辑） */}
          {field.type !== "user" &&
            field.type !== "department" &&
            field.type !== "date" &&
            field.type !== "datetime" &&
            field.type !== FieldTypeEnum.Enum.boolean && (
            <>
              <Form.Item
                label="默认值"
                name={["advanced", "defaultMode"]}
                initialValue={field.advanced?.defaultMode || "custom"}
              >
                <Select>
                  <Select.Option value="custom">自定义</Select.Option>
                  <Select.Option value="dataLink">数据联动</Select.Option>
                  {/* 选择类控件默认值不提供公式计算（按参考产品交互） */}
                  {field.type === FieldTypeEnum.Enum.select ||
                  field.type === FieldTypeEnum.Enum.radio ||
                  field.type === FieldTypeEnum.Enum.checkbox ||
                  field.type === FieldTypeEnum.Enum.multiselect ? null : (
                    <Select.Option value="formulaEdit">公式编辑</Select.Option>
                  )}
                </Select>
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) =>
                  prev.advanced?.defaultMode !== curr.advanced?.defaultMode
                }
              >
                {({ getFieldValue }) => {
                  const mode = getFieldValue(["advanced", "defaultMode"]) || "custom";
                  if (mode === "dataLink") {
                    return (
                      <Form.Item>
                        <Button block type="default" onClick={() => setDataLinkModalOpen(true)}>
                          数据联动设置
                        </Button>
                      </Form.Item>
                    );
                  }
                  if (mode === "formulaEdit") {
                    return (
                      <Form.Item>
                        <Button
                          block
                          type="default"
                          icon={<CalculatorOutlined />}
                          onClick={() => setFormulaDefaultModalOpen(true)}
                        >
                          fx 编辑公式
                        </Button>
                      </Form.Item>
                    );
                  }
                  // custom
                  if (field.type === FieldTypeEnum.Enum.number) {
                    return (
                      <Form.Item label="默认值" name="defaultValue">
                        <InputNumber style={{ width: "100%" }} placeholder="请输入默认值" />
                      </Form.Item>
                    );
                  }
                  return (
                    <Form.Item label="默认值" name="defaultValue">
                      <Input placeholder="请输入默认值" />
                    </Form.Item>
                  );
                }}
              </Form.Item>
            </>
          )}
        </>
      )}
    </Form>
  );

  const advancedForm = isSerialField ? (
    <div>
      <SerialNumberConfigPanel
        value={field.advanced?.serialConfig}
        onChange={(config) => {
          onValuesChange({
            advanced: {
              ...field.advanced,
              serialConfig: config,
            },
          });
        }}
      />
    </div>
  ) : null;

  const formulaDefaultInitial =
    typeof field.advanced?.defaultFormulaExpression === "string"
      ? field.advanced.defaultFormulaExpression
      : "";

  return (
    <>
      {isSerialField ? (
        <Tabs
          activeKey={fieldTab}
          onChange={setFieldTab}
          items={[
            {
              key: "basic",
              label: "属性",
              children: basicForm,
            },
            {
              key: "advanced",
              label: "高级",
              children: advancedForm,
            },
          ]}
        />
      ) : (
        basicForm
      )}
      <FormulaDefaultEditorModal
        open={formulaDefaultModalOpen}
        onCancel={() => setFormulaDefaultModalOpen(false)}
        onConfirm={(expression) => {
          const prevAdv = form.getFieldValue("advanced") || field.advanced || {};
          const nextAdvanced = {
            ...prevAdv,
            defaultFormulaExpression: expression,
          };
          form.setFieldsValue({ advanced: nextAdvanced });
          onValuesChange({ advanced: nextAdvanced });
          setFormulaDefaultModalOpen(false);
        }}
        initialExpression={formulaDefaultInitial}
        formSchema={formSchema}
        excludeFieldId={field.fieldId}
        valueKind={field.type === FieldTypeEnum.Enum.number ? "number" : "text"}
      />
      <DefaultDataLinkModal
        open={dataLinkModalOpen}
        onCancel={() => setDataLinkModalOpen(false)}
        onConfirm={(config) => {
          const prevAdv = form.getFieldValue("advanced") || field.advanced || {};
          const nextAdvanced = {
            ...prevAdv,
            defaultMode: "dataLink",
            defaultDataLink: config,
          };
          form.setFieldsValue({ advanced: nextAdvanced });
          onValuesChange({ advanced: nextAdvanced });
          setDataLinkModalOpen(false);
        }}
        initialValue={defaultDataLink}
        currentField={field}
        currentFormFields={currentFormFields}
      />
    </>
  );
};

const DefaultDataLinkModal = ({
  open,
  onCancel,
  onConfirm,
  initialValue,
  currentField,
  currentFormFields,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (config: Record<string, unknown>) => void;
  initialValue?: any;
  currentField: any;
  currentFormFields: any[];
}) => {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const appId = searchParams.get("appId");
  const applicationId = useFormDesignerStore((state) => state.applicationId);
  const finalAppId = appId || applicationId;
  const relatedFormId = Form.useWatch("relatedFormId", form) as string | undefined;

  const { data: formsList, isLoading: formsLoading } = useQuery({
    queryKey: ["default-data-link-forms", finalAppId],
    queryFn: () => formDefinitionApi.getListByApplication(finalAppId!),
    enabled: open && !!finalAppId,
  });

  const { data: relatedFormDefinition, isLoading: relatedFieldsLoading } = useQuery({
    queryKey: ["default-data-link-related-form", relatedFormId],
    queryFn: () => formDefinitionApi.getById(String(relatedFormId)),
    enabled: open && !!relatedFormId,
  });

  const relatedFields = useMemo(() => collectSchemaFields(relatedFormDefinition?.config || {}), [relatedFormDefinition]);

  useEffect(() => {
    if (!open) return;
    const seededConditions = Array.isArray(initialValue?.conditions) && initialValue.conditions.length > 0
      ? initialValue.conditions
      : [{ relatedFieldId: undefined, currentFieldId: undefined, operator: "eq" }];
    form.setFieldsValue({
      relatedFormId: initialValue?.relatedFormId,
      matchMode: initialValue?.matchMode || "all",
      conditions: seededConditions,
      targetRelatedFieldId: initialValue?.targetRelatedFieldId,
    });
  }, [open, initialValue, form]);

  return (
    <Modal
      title="数据联动"
      open={open}
      onCancel={onCancel}
      width={980}
      onOk={async () => {
        const values = await form.validateFields();
        const config = {
          relatedFormId: String(values.relatedFormId || ""),
          matchMode: values.matchMode === "any" ? "any" : "all",
          conditions: (Array.isArray(values.conditions) ? values.conditions : [])
            .filter((c: any) => c?.relatedFieldId && c?.currentFieldId)
            .map((c: any) => ({
              relatedFieldId: String(c.relatedFieldId),
              currentFieldId: String(c.currentFieldId),
              operator: "eq",
            })),
          targetRelatedFieldId: String(values.targetRelatedFieldId || ""),
        };
        onConfirm(config);
      }}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="数据关联表"
          name="relatedFormId"
          rules={[{ required: true, message: "请选择数据关联表" }]}
        >
          <Select
            placeholder={formsLoading ? "加载中..." : "请选择关联表单"}
            showSearch
            loading={formsLoading}
            options={(formsList || [])
              .filter((f: any) => f?.formId)
              .map((f: any) => ({ label: f.formName || f.formId, value: String(f.formId) }))}
          />
        </Form.Item>

        <Space align="center" style={{ marginBottom: 8 }}>
          <Typography.Text>满足以下</Typography.Text>
          <Form.Item name="matchMode" noStyle initialValue="all">
            <Select style={{ width: 100 }}>
              <Select.Option value="all">所有</Select.Option>
              <Select.Option value="any">任一</Select.Option>
            </Select>
          </Form.Item>
          <Typography.Text>条件时</Typography.Text>
        </Space>

        <Form.List name="conditions">
          {(fields, { add, remove }) => (
            <Space direction="vertical" style={{ width: "100%" }}>
              {fields.map((f) => (
                <Space key={f.key} align="baseline" style={{ width: "100%" }}>
                  <Form.Item
                    name={[f.name, "relatedFieldId"]}
                    rules={[{ required: true, message: "请选择关联表字段" }]}
                    style={{ width: 280, marginBottom: 0 }}
                  >
                    <Select
                      placeholder="关联表字段"
                      loading={relatedFieldsLoading}
                      options={relatedFields.map((rf: any) => ({
                        label: rf.label || rf.fieldId,
                        value: String(rf.fieldId),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item name={[f.name, "operator"]} initialValue="eq" style={{ width: 100, marginBottom: 0 }}>
                    <Select options={[{ label: "等于", value: "eq" }]} />
                  </Form.Item>
                  <Form.Item
                    name={[f.name, "currentFieldId"]}
                    rules={[{ required: true, message: "请选择当前表字段" }]}
                    style={{ width: 280, marginBottom: 0 }}
                  >
                    <Select
                      placeholder="当前表单字段"
                      options={currentFormFields.map((cf: any) => ({
                        label: cf.label || cf.fieldId,
                        value: String(cf.fieldId),
                      }))}
                    />
                  </Form.Item>
                  <Button type="link" danger onClick={() => remove(f.name)}>
                    删除
                  </Button>
                </Space>
              ))}
              <Button type="link" onClick={() => add({ operator: "eq" })} style={{ padding: 0 }}>
                + 添加关联条件
              </Button>
            </Space>
          )}
        </Form.List>

        <Space align="center" style={{ marginTop: 12 }}>
          <Typography.Text>当前表单的</Typography.Text>
          <Tag>{currentField?.label || currentField?.fieldId || "当前字段"}</Tag>
          <Typography.Text>联动显示为</Typography.Text>
          <Form.Item
            name="targetRelatedFieldId"
            rules={[{ required: true, message: "请选择关联表字段" }]}
            style={{ width: 280, marginBottom: 0 }}
          >
            <Select
              placeholder="关联表字段"
              loading={relatedFieldsLoading}
              options={relatedFields.map((rf: any) => ({
                label: rf.label || rf.fieldId,
                value: String(rf.fieldId),
              }))}
            />
          </Form.Item>
          <Typography.Text>中对应值</Typography.Text>
        </Space>
      </Form>
    </Modal>
  );
};

// 子表字段配置面板
const SubtableFieldsConfigPanel = ({ 
  field, 
  onUpdate 
}: { 
  field: any; 
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const [subtableFields, setSubtableFields] = useState<any[]>(field.subtableFields || []);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const selectSubtableField = useFormDesignerStore((s) => s.selectSubtableField);
  const selectedSubtableField = useFormDesignerStore((s) => s.selectedSubtableField);
  const appId = searchParams.get("appId");
  const applicationId = useFormDesignerStore((state) => state.applicationId);
  const finalAppId = appId || applicationId;
  const relatedFormId = Form.useWatch("relatedFormId", form);

  // 应用下的表单列表
  const { data: formsList, isLoading: formsLoading } = useQuery({
    queryKey: ["applicationForms", finalAppId],
    queryFn: () => formDefinitionApi.getListByApplication(finalAppId!),
    enabled: !!finalAppId && modalVisible,
  });

  // 关联表单定义
  const { data: relatedFormDefinition, isLoading: relatedFormLoading } = useQuery({
    queryKey: ["subtableRelatedFormDefinition", relatedFormId],
    queryFn: () => formDefinitionApi.getById(relatedFormId!),
    enabled: !!relatedFormId && modalVisible,
  });

  const allRelatedFields = useMemo(() => {
    if (!relatedFormDefinition) return [];
    const result = new Map<string, any>();
    const cfg: any = relatedFormDefinition.config || {};
    (cfg.fields || []).forEach((f: any) => {
      if (f && f.fieldId) result.set(f.fieldId, f);
    });
    const elements = cfg.elements || [];
    elements.forEach((el: any) => {
      if (el && "fieldId" in el && !result.has(el.fieldId)) {
        result.set(el.fieldId, el);
      }
      if (el && "children" in el && Array.isArray(el.children)) {
        el.children.forEach((child: any) => {
          if (child && "fieldId" in child && !result.has(child.fieldId)) {
            result.set(child.fieldId, child);
          }
        });
      }
    });
    return Array.from(result.values());
  }, [relatedFormDefinition]);

  const subtableFieldOptions = useMemo(
    () => subtableFields.map((f) => ({ label: f.label, value: f.fieldId })),
    [subtableFields]
  );

  // 在公式编辑时插入字段引用 {fieldId}
  const handleInsertFieldRef = (fieldId: string) => {
    const current = form.getFieldValue("formulaExpression") || "";
    const ref = `{${fieldId}}`;
    // 简单避免重复连续拼接相同引用
    const next =
      current && !current.endsWith(" ")
        ? `${current} ${ref}`
        : `${current}${ref}`;
    form.setFieldsValue({ formulaExpression: next });
  };

  // 当 field 变化时，同步更新 subtableFields
  useEffect(() => {
    if (field.subtableFields) {
      setSubtableFields(field.subtableFields);
    }
  }, [field.subtableFields]);

  // 支持：从字段库拖拽到子表面板（快速添加子表列）
  const { setNodeRef: setSubtableDropRef, isOver: isSubtableDropOver } = useDroppable({
    id: `subtable-${field.fieldId}-drop`,
    data: {
      type: "subtable-drop",
      subtableFieldId: field.fieldId,
    },
  });

  const handleAddField = () => {
    setEditingField(null);
    form.resetFields();
    form.setFieldsValue({
      type: "input",
      fieldMappingPairs: [],
    });
    setModalVisible(true);
  };

  const handleEditField = (fieldItem: any) => {
    setEditingField(fieldItem);
    const fieldMappingPairs = fieldItem.fieldMapping
      ? Object.entries(fieldItem.fieldMapping).map(([relatedFieldId, currentFieldId]) => ({
          relatedFieldId,
          currentFieldId,
        }))
      : [];
    form.setFieldsValue({
      ...fieldItem,
      fieldMappingPairs,
    });
    setModalVisible(true);
  };

  const handleDeleteField = (fieldId: string) => {
    const newFields = subtableFields.filter((f: any) => f.fieldId !== fieldId);
    setSubtableFields(newFields);
    onUpdate({ subtableFields: newFields });
  };

  const handleDragStart = (index: number) => {
    setDraggingIndex(index);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (index: number) => {
    if (draggingIndex === null || draggingIndex === index) return;
    const newFields = [...subtableFields];
    const [moved] = newFields.splice(draggingIndex, 1);
    newFields.splice(index, 0, moved);
    setSubtableFields(newFields);
    onUpdate({ subtableFields: newFields });
    setDraggingIndex(null);
  };

  const handleSaveField = () => {
    form.validateFields().then((values) => {
      const fieldId = editingField?.fieldId || `subfield_${Date.now()}`;

      // 将映射列表转换为对象
      let fieldMapping: Record<string, string> | undefined;
      if (Array.isArray(values.fieldMappingPairs) && values.fieldMappingPairs.length > 0) {
        fieldMapping = {};
        values.fieldMappingPairs.forEach((pair: any) => {
          if (pair?.relatedFieldId && pair?.currentFieldId) {
            fieldMapping![pair.relatedFieldId] = pair.currentFieldId;
          }
        });
      }

      // 解析公式依赖字段（{fieldId}）
      let formulaDependencies: string[] | undefined;
      if (values.type === "formula" && typeof values.formulaExpression === "string") {
        const depSet = new Set<string>();
        const reg = /\{(.*?)\}/g;
        let match;
        while ((match = reg.exec(values.formulaExpression))) {
          if (match[1]) depSet.add(match[1]);
        }
        if (depSet.size > 0) {
          formulaDependencies = Array.from(depSet);
        }
      }

      const newField = {
        fieldId,
        type: values.type,
        label: values.label,
        required: values.required || false,
        relatedFormId: values.relatedFormId,
        relatedDisplayField: values.relatedDisplayField,
        fieldMapping,
        formulaExpression: values.formulaExpression,
        formulaDependencies,
        ...values,
      };

      // 清理内部字段，避免存储冗余
      delete (newField as any).fieldMappingPairs;
      if (values.type === "boolean") {
        delete (newField as any).options;
      }

      let newFields;
      if (editingField) {
        newFields = subtableFields.map((f: any) => 
          f.fieldId === editingField.fieldId ? newField : f
        );
      } else {
        newFields = [...subtableFields, newField];
      }

      setSubtableFields(newFields);
      onUpdate({ subtableFields: newFields });
      setModalVisible(false);
      form.resetFields();
    });
  };

  return (
    <>
      <Form.Item label="子表字段">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            字段
          </Typography.Text>
          <Button type="text" size="small" icon={<PlusOutlined />} onClick={handleAddField}>
            添加字段
          </Button>
        </div>
        <div
          ref={setSubtableDropRef}
          className={styles.subtableFieldsDrop}
          style={{
            border: isSubtableDropOver ? "2px dashed #1890ff" : "none",
            borderRadius: 4,
            maxHeight: 300,
            overflow: "auto",
            padding: subtableFields.length === 0 ? 8 : 0,
            background: "#fff",
          }}
        >
          {subtableFields.length === 0 ? (
            <Alert
              message="暂无字段"
              description="可以从左侧字段库拖拽添加，或点击上方按钮添加"
              type="info"
              showIcon
            />
          ) : (
            <div style={{ padding: 4 }}>
              {subtableFields.map((sf: any, idx: number) => {
                const active =
                  selectedSubtableField?.parentFieldId === field.fieldId &&
                  selectedSubtableField?.subFieldId === sf.fieldId;
                return (
                  <div
                    key={sf.fieldId}
                    className={styles.subtableFieldItem}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(idx)}
                    onClick={() => selectSubtableField(field.fieldId, sf.fieldId)}
                    style={{
                      background: active ? "#f0f7ff" : "transparent",
                      border: active ? "1px solid #1890ff" : "1px solid transparent",
                    }}
                  >
                    <div className={styles.subtableFieldDrag}>
                      <HolderOutlined />
                    </div>
                    <div className={styles.subtableFieldLabel} title={sf?.label || sf?.fieldId}>
                      {sf?.label || sf?.fieldId}
                    </div>
                    <div className={styles.subtableFieldActions} onClick={(e) => e.stopPropagation()}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEditField(sf)}
                      />
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteField(sf.fieldId)}
                      />
                    </div>
                  </div>
                );
              })}
              <div style={{ padding: "6px 0" }}>
                <Button type="dashed" block icon={<PlusOutlined />} onClick={handleAddField}>
                  添加字段
                </Button>
              </div>
            </div>
          )}
        </div>
      </Form.Item>

      <Modal
        title={editingField ? "编辑子表字段" : "添加子表字段"}
        open={modalVisible}
        onOk={handleSaveField}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="字段类型"
            name="type"
            rules={[{ required: true, message: "请选择字段类型" }]}
            initialValue="input"
          >
            <Select>
              <Select.Option value="input">单行文本</Select.Option>
              <Select.Option value="textarea">多行文本</Select.Option>
              <Select.Option value="number">数字</Select.Option>
              <Select.Option value="date">日期</Select.Option>
              <Select.Option value="select">下拉框</Select.Option>
              <Select.Option value="radio">单选框</Select.Option>
              <Select.Option value="checkbox">复选框</Select.Option>
              <Select.Option value="boolean">是/否（开关）</Select.Option>
              <Select.Option value="formula">公式字段</Select.Option>
              <Select.Option value="relatedForm">关联表单</Select.Option>
              <Select.Option value="relatedFormMulti">关联表单（多选）</Select.Option>
            </Select>
          </Form.Item>
          {form.getFieldValue("type") === "formula" && (
            <>
              <Form.Item
                label="公式表达式"
                name="formulaExpression"
                tooltip="在公式中使用 {字段ID} 引用同一行的其他列，例如: {qty} * {price}"
                rules={[{ required: true, message: "请输入公式表达式" }]}
              >
                <Input.TextArea rows={3} placeholder="例如: {qty} * {price}" />
              </Form.Item>
              <Form.Item label="可用字段">
                <Space wrap>
                  {subtableFields
                    .filter((sf: any) => sf.fieldId !== editingField?.fieldId)
                    .map((sf: any) => (
                      <Button
                        key={sf.fieldId}
                        size="small"
                        onClick={() => handleInsertFieldRef(sf.fieldId)}
                      >
                        {sf.label}
                      </Button>
                    ))}
                  {subtableFields.length === 0 && (
                    <span style={{ color: "#999" }}>当前暂无可引用字段</span>
                  )}
                </Space>
              </Form.Item>
            </>
          )}
          {(form.getFieldValue("type") === "relatedForm" || form.getFieldValue("type") === "relatedFormMulti") && (
            <>
              <Form.Item
                label="关联表单"
                name="relatedFormId"
                rules={[{ required: true, message: "请选择关联表单" }]}
              >
                <Select
                  placeholder={formsLoading ? "加载中..." : finalAppId ? "请选择关联表单" : "请先选择应用"}
                  showSearch
                  loading={formsLoading}
                  disabled={!finalAppId || formsLoading}
                  filterOption={(input, option) => (option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                  onChange={() => {
                    // 切换关联表时清空显示字段和映射
                    form.setFieldsValue({
                      relatedDisplayField: undefined,
                      fieldMappingPairs: [],
                    });
                  }}
                  notFoundContent={
                    formsLoading ? (
                      <div style={{ padding: 12, textAlign: "center" }}>加载中...</div>
                    ) : !finalAppId ? (
                      <div style={{ padding: 12, textAlign: "center", color: "#999" }}>请先选择应用</div>
                    ) : (
                      <div style={{ padding: 12, textAlign: "center", color: "#999" }}>暂无可用表单</div>
                    )
                  }
                >
                  {formsList
                    ?.filter((formItem) => formItem.formId) // 不排除当前表，子表允许关联其他表
                    .map((formItem) => (
                      <Select.Option key={formItem.formId} value={formItem.formId} label={formItem.formName}>
                        {formItem.formName}
                      </Select.Option>
                    ))}
                </Select>
              </Form.Item>
              <Form.Item
                label="显示字段"
                name="relatedDisplayField"
                tooltip="展示时优先显示该字段值，未选则默认关联表单首字段"
              >
                <Select
                  placeholder={relatedFormLoading ? "加载字段..." : "可选，留空默认首字段"}
                  loading={relatedFormLoading}
                  allowClear
                  notFoundContent={
                    relatedFormLoading ? (
                      <div style={{ padding: 12, textAlign: "center" }}>加载中...</div>
                    ) : (
                      <div style={{ padding: 12, textAlign: "center", color: "#999" }}>暂无字段</div>
                    )
                  }
                >
                  {allRelatedFields.map((f: any) => (
                    <Select.Option key={f.fieldId} value={f.fieldId}>
                      {f.label || f.fieldId}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.List name="fieldMappingPairs">
                {(fields, { add, remove }) => (
                  <Form.Item label="字段映射（可选）" required={false}>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      {fields.length === 0 && <span style={{ color: "#999" }}>选择后自动回填子表行内其它字段</span>}
                      {fields.map((mapField) => (
                        <Space key={mapField.key} align="baseline">
                          <Form.Item
                            noStyle
                            name={[mapField.name, "relatedFieldId"]}
                            rules={[{ required: true, message: "关联字段" }]}
                          >
                            <Select
                              placeholder="关联表单字段"
                              style={{ width: 180 }}
                              loading={relatedFormLoading}
                              options={allRelatedFields.map((f: any) => ({
                                label: f.label || f.fieldId,
                                value: f.fieldId,
                              }))}
                            />
                          </Form.Item>
                          <Form.Item
                            noStyle
                            name={[mapField.name, "currentFieldId"]}
                            rules={[{ required: true, message: "子表字段" }]}
                          >
                            <Select
                              placeholder="子表字段"
                              style={{ width: 180 }}
                              options={subtableFieldOptions}
                            />
                          </Form.Item>
                          <Button type="link" danger onClick={() => remove(mapField.name)}>
                            删除
                          </Button>
                        </Space>
                      ))}
                      <Button type="dashed" onClick={() => add()}>
                        + 添加映射
                      </Button>
                    </Space>
                  </Form.Item>
                )}
              </Form.List>
            </>
          )}
          <Form.Item
            label="字段名称"
            name="label"
            rules={[{ required: true, message: "请输入字段名称" }]}
          >
            <Input placeholder="请输入字段名称" />
          </Form.Item>
          <Form.Item label="是否必填" name="required" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// 关联表单配置面板组件
const RelatedFormConfigPanel = ({
  field,
  formSchema,
  onUpdate,
}: {
  field: any;
  formSchema: any;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const [searchParams] = useSearchParams();
  const appId = searchParams.get("appId");
  const applicationId = useFormDesignerStore((state) => state.applicationId);
  const finalAppId = appId || applicationId;

  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>(
    field.fieldMapping || {}
  );

  // 获取关联表单的定义（先声明，供下面的 useMemo 使用）
  const { data: relatedFormDefinition } = useQuery({
    queryKey: ["formDefinition", field.relatedFormId],
    queryFn: () => formDefinitionApi.getById(field.relatedFormId!),
    enabled: !!field.relatedFormId,
  });

  // 关联表单的所有字段（包含容器内字段）
  const allRelatedFields = useMemo(() => {
    if (!relatedFormDefinition) return [];
    const result = new Map<string, any>();
    const cfg: any = relatedFormDefinition.config || {};
    (cfg.fields || []).forEach((f: any) => {
      if (f && f.fieldId) {
        result.set(f.fieldId, f);
      }
    });
    const elements = cfg.elements || [];
    elements.forEach((el: any) => {
      if (el && "fieldId" in el && !result.has(el.fieldId)) {
        result.set(el.fieldId, el);
      }
      if (el && "children" in el && Array.isArray(el.children)) {
        el.children.forEach((child: any) => {
          if (child && "fieldId" in child && !result.has(child.fieldId)) {
            result.set(child.fieldId, child);
          }
        });
      }
    });
    return Array.from(result.values());
  }, [relatedFormDefinition]);

  // 当前表单的所有字段（包含容器内字段）
  const allCurrentFields = useMemo(() => {
    const result = new Map<string, any>();
    (formSchema.fields || []).forEach((f: any) => {
      result.set(f.fieldId, f);
    });
    const elements = formSchema.elements || [];
    elements.forEach((el: any) => {
      if ("fieldId" in el) {
        if (!result.has(el.fieldId)) {
          result.set(el.fieldId, el);
        }
      }
      if ("children" in el && Array.isArray(el.children)) {
        el.children.forEach((child: any) => {
          if (child && "fieldId" in child && !result.has(child.fieldId)) {
            result.set(child.fieldId, child);
          }
        });
      }
    });
    return Array.from(result.values());
  }, [formSchema]);

  // 获取当前应用下的所有表单列表
  const { data: formsList, isLoading: formsLoading } = useQuery({
    queryKey: ["applicationForms", finalAppId],
    queryFn: () => formDefinitionApi.getListByApplication(finalAppId!),
    enabled: !!finalAppId,
  });

  // 自动匹配字段映射
  useEffect(() => {
    if (relatedFormDefinition && formSchema && !field.fieldMapping) {
      const mapping: Record<string, string> = {};
      const relatedFields = allRelatedFields || [];
      const currentFields = allCurrentFields || [];

      // 自动匹配相同 fieldId 和相同类型的字段
      relatedFields.forEach((relatedField: any) => {
        const matchField = currentFields.find(
          (f: any) => f.fieldId === relatedField.fieldId && f.type === relatedField.type
        );
        if (matchField) {
          mapping[relatedField.fieldId] = matchField.fieldId;
        }
      });

      if (Object.keys(mapping).length > 0) {
        setFieldMapping(mapping);
        onUpdate({ fieldMapping: mapping });
      }
    }
  }, [relatedFormDefinition, formSchema, field.relatedFormId]);

  const handleFormSelect = (formId: string) => {
    onUpdate({
      relatedFormId: formId,
      // 切换关联表时，重置显示字段和映射
      relatedDisplayField: undefined,
      fieldMapping: undefined,
    });
    setFieldMapping({});
  };

  const handleFieldMappingChange = (relatedFieldId: string, currentFieldId: string) => {
    const newMapping = { ...fieldMapping };
    if (currentFieldId) {
      newMapping[relatedFieldId] = currentFieldId;
    } else {
      delete newMapping[relatedFieldId];
    }
    setFieldMapping(newMapping);
    onUpdate({ fieldMapping: newMapping });
  };

  return (
    <>
      {/* 关联表单 */}
      <Form.Item
        label="关联表单"
        name="relatedFormId"
        rules={[{ required: true, message: "请选择要关联的表单" }]}
      >
        <Select
          placeholder={formsLoading ? "加载中..." : finalAppId ? "请选择关联的表单" : "请先选择应用"}
          showSearch
          loading={formsLoading}
          disabled={!finalAppId || formsLoading}
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          onChange={handleFormSelect}
          notFoundContent={
            formsLoading ? (
              <div style={{ padding: 20, textAlign: "center" }}>加载中...</div>
            ) : !finalAppId ? (
              <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
                请先选择应用
              </div>
            ) : formsList && formsList.length === 0 ? (
              <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
                暂无可用表单
              </div>
            ) : (
              <div style={{ padding: 20, textAlign: "center", color: "#999" }}>
                未找到匹配的表单
              </div>
            )
          }
        >
          {formsList
            ?.filter((form) => form.formId !== formSchema.formId) // 排除当前表单
            .map((form) => (
              <Select.Option key={form.formId} value={form.formId} label={form.formName}>
                {form.formName}
              </Select.Option>
            ))}
        </Select>
      </Form.Item>

      {/* 显示设置 / 数据筛选 / 数据填充 / 允许新增 */}
      {field.relatedFormId && relatedFormDefinition && (
        <>
          <Form.Item label="显示设置" name="relatedDisplayField">
            <Select placeholder="请选择用于显示的字段" allowClear>
              {allRelatedFields.map((f: any) => (
                <Select.Option key={f.fieldId} value={f.fieldId}>
                  {f.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="数据筛选" name="enableDataFilter" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="数据填充" name="enableDataFill" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="允许新增" name="allowCreateRelated" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>

          {/* 字段映射（在启用数据填充时显示） */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.enableDataFill !== curr.enableDataFill}
          >
            {({ getFieldValue }) =>
              getFieldValue("enableDataFill") ? (
                <Form.Item
                  label="字段映射"
                  tooltip="选择关联表单数据后，自动填充到当前表单的字段"
                >
                  <div
                    style={{
                      border: "1px solid #d9d9d9",
                      borderRadius: 4,
                      padding: 12,
                      maxHeight: 300,
                      overflow: "auto",
                      background: "#fafafa",
                    }}
                  >
                    {relatedFormDefinition.config?.fields?.length === 0 ? (
                      <Empty description="关联表单暂无字段" size="small" />
                    ) : (
                      relatedFormDefinition.config?.fields?.map((relatedField: any) => {
                        const mappedFieldId = fieldMapping[relatedField.fieldId];
                        return (
                          <div
                            key={relatedField.fieldId}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              marginBottom: 8,
                              padding: 8,
                              background: "#fff",
                              borderRadius: 4,
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#999",
                                  marginBottom: 4,
                                }}
                              >
                                关联表单字段
                              </div>
                              <div style={{ fontWeight: 500 }}>
                                {relatedField.label} ({relatedField.type})
                              </div>
                            </div>
                            <div style={{ fontSize: 20, color: "#d9d9d9" }}>→</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 12,
                                  color: "#999",
                                  marginBottom: 4,
                                }}
                              >
                                当前表单字段
                              </div>
                              <Select
                                style={{ width: "100%" }}
                                placeholder="选择映射字段"
                                value={mappedFieldId}
                                onChange={(value) =>
                                  handleFieldMappingChange(relatedField.fieldId, value)
                                }
                                allowClear
                              >
                          {allCurrentFields
                                  ?.filter(
                                    (f: any) =>
                                      f.type === relatedField.type &&
                                      f.fieldId !== field.fieldId // 排除关联字段本身
                                  )
                                  .map((f: any) => (
                                    <Select.Option key={f.fieldId} value={f.fieldId}>
                                      {f.label} ({f.type})
                                    </Select.Option>
                                  ))}
                              </Select>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </>
      )}
    </>
  );
};

// 公式配置面板组件
const FormulaConfigPanel = ({ field, formSchema, onUpdate }: {
  field: any;
  formSchema: any;
  onUpdate: (updates: Record<string, unknown>) => void;
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [formula, setFormula] = useState(field.formulaExpression || "");
  const [selectedFields, setSelectedFields] = useState<string[]>(field.formulaDependencies || []);

  const availableFields = formSchema.fields.filter(
    (f: any) => f.fieldId !== field.fieldId && (f.type === "number" || f.type === "input")
  );

  const handleSaveFormula = () => {
    onUpdate({
      formulaExpression: formula,
      formulaDependencies: selectedFields,
    });
    setModalVisible(false);
  };

  return (
    <>
      <Form.Item label="计算公式">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Input
            value={formula || ""}
            placeholder="点击右侧按钮配置公式"
            readOnly
            suffix={
              <Button
                type="link"
                icon={<CalculatorOutlined />}
                onClick={() => setModalVisible(true)}
              >
                配置公式
              </Button>
            }
          />
          {field.formulaDependencies && field.formulaDependencies.length > 0 && (
            <div style={{ fontSize: 12, color: "#999" }}>
              依赖字段: {field.formulaDependencies.map((id: string) => {
                const depField = formSchema.fields.find((f: any) => f.fieldId === id);
                return depField?.label || id;
              }).join(", ")}
            </div>
          )}
        </Space>
      </Form.Item>

      <Modal
        title="配置计算公式"
        open={modalVisible}
        onOk={handleSaveFormula}
        onCancel={() => {
          setModalVisible(false);
          setFormula(field.formulaExpression || "");
          setSelectedFields(field.formulaDependencies || []);
        }}
        width={800}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>可用字段：</div>
          <div style={{ 
            border: "1px solid #d9d9d9", 
            borderRadius: 4, 
            padding: 8, 
            maxHeight: 200, 
            overflow: "auto",
            background: "#fafafa"
          }}>
            {availableFields.length === 0 ? (
              <div style={{ color: "#999" }}>暂无可用字段（需要数字或文本类型字段）</div>
            ) : (
              availableFields.map((f: any) => (
                <Button
                  key={f.fieldId}
                  size="small"
                  type={selectedFields.includes(f.fieldId) ? "primary" : "default"}
                  style={{ margin: "4px" }}
                  onClick={() => {
                    if (selectedFields.includes(f.fieldId)) {
                      setSelectedFields(selectedFields.filter((id) => id !== f.fieldId));
                      // 从公式中移除该字段引用
                      const fieldRef = `{${f.fieldId}}`;
                      setFormula(formula.replace(new RegExp(fieldRef, "g"), ""));
                    } else {
                      setSelectedFields([...selectedFields, f.fieldId]);
                      // 在公式末尾添加字段引用
                      setFormula(formula + (formula ? " + " : "") + `{${f.fieldId}}`);
                    }
                  }}
                >
                  {f.label} ({f.fieldId})
                </Button>
              ))
            )}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>公式表达式：</div>
          <Input.TextArea
            rows={6}
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            placeholder="例如: {field_1} * {field_2} + 100&#10;支持运算符: +, -, *, /, (, )&#10;使用 {字段ID} 引用字段值"
          />
          <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
            提示：使用 {"{字段ID}"} 来引用字段值，支持基本数学运算
          </div>
        </div>
      </Modal>
    </>
  );
};

// 容器属性面板
const ContainerPropertiesPanel = ({
  container,
  onValuesChange,
}: {
  container: any;
  onValuesChange: (values: Record<string, unknown>) => void;
}) => {
  const handleChange = (changedValues: Record<string, unknown>) => {
    onValuesChange(changedValues);
  };

  if (container.type === "groupTitle") {
    return (
      <Form
        layout="vertical"
        initialValues={container}
        onValuesChange={handleChange}
        key={container.containerId}
      >
        <Form.Item label="标题" name="label" rules={[{ required: true }]}>
          <Input placeholder="请输入标题" />
        </Form.Item>
        <Form.Item label="对齐" name={["config", "alignment"]}>
          <Radio.Group>
            <Radio value="left">左</Radio>
            <Radio value="center">中</Radio>
            <Radio value="right">右</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="线条粗细(px)" name={["config", "lineWidth"]} initialValue={1}>
          <InputNumber min={1} max={8} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="线条颜色" name={["config", "lineColor"]} initialValue="#d9d9d9">
          <Input type="color" />
        </Form.Item>
      </Form>
    );
  }

  if (container.type === "multiColumn") {
    const columns = (container.config?.columns as number) || 2;
    const proportions = (container.config?.proportions as number[]) || Array(columns).fill(1);
    
    const proportionOptions = [
      { label: "1/3, 1/3, 1/3", value: [1, 1, 1] },
      { label: "1/4, 1/4, 1/2", value: [1, 1, 2] },
      { label: "1/2, 1/4, 1/4", value: [2, 1, 1] },
      { label: "1/4, 1/2, 1/4", value: [1, 2, 1] },
    ];

    const handleColumnsChange = (newColumns: number) => {
      const newProportions = Array(newColumns).fill(1);
      handleChange({
        config: {
          ...container.config,
          columns: newColumns,
          proportions: newProportions,
        },
      });
    };

    const handleProportionChange = (proportions: number[]) => {
      handleChange({
        config: {
          ...container.config,
          proportions,
        },
      });
    };

    return (
      <Form
        layout="vertical"
        initialValues={container}
        onValuesChange={handleChange}
        key={container.containerId}
      >
        <Form.Item label="布局">
          <Space>
            <Button
              type={columns === 2 ? "primary" : "default"}
              onClick={() => handleColumnsChange(2)}
            >
              两列
            </Button>
            <Button
              type={columns === 3 ? "primary" : "default"}
              onClick={() => handleColumnsChange(3)}
            >
              三列
            </Button>
            <Button
              type={columns === 4 ? "primary" : "default"}
              onClick={() => handleColumnsChange(4)}
            >
              四列
            </Button>
          </Space>
        </Form.Item>
        {columns === 3 && (
          <Form.Item label="占比">
            <Space direction="vertical" style={{ width: "100%" }}>
              {proportionOptions.map((option) => (
                <Button
                  key={option.label}
                  type={
                    JSON.stringify(proportions) === JSON.stringify(option.value)
                      ? "primary"
                      : "default"
                  }
                  block
                  onClick={() => handleProportionChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </Space>
          </Form.Item>
        )}
      </Form>
    );
  }

  if (container.type === "tab") {
    return (
      <Form
        layout="vertical"
        initialValues={container}
        onValuesChange={handleChange}
        key={container.containerId}
      >
        <Form.Item label="标签页配置">
          <Typography.Text type="secondary">标签页配置功能开发中</Typography.Text>
        </Form.Item>
      </Form>
    );
  }

  return <Empty description="未知的容器类型" />;
};

