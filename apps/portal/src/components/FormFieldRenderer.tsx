import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import type { Control } from "react-hook-form";
import {
  Input,
  InputNumber,
  DatePicker,
  Select,
  Radio,
  Checkbox,
  Form,
  Image,
  Table,
  Button,
  Space,
  Typography,
  Dropdown,
  Pagination,
  Empty,
  message,
  Tag,
  Switch,
} from "antd";
import {
  UploadOutlined,
  UserOutlined,
  ApartmentOutlined,
  PlusOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CaretUpOutlined,
  CaretDownOutlined,
  MoreOutlined,
  FileTextOutlined,
  FullscreenOutlined,
  ColumnWidthOutlined,
} from "@ant-design/icons";
import type { FormFieldSchema } from "@mofeng/shared-schema";
import dayjs from "dayjs";
import { UserSelector } from "./UserSelector";
import { DepartmentSelector } from "./DepartmentSelector";
import { LocationField } from "./LocationField";
import { AddressField } from "./AddressField";
import { useAuthStore } from "@/store/useAuthStore";
import { RelatedFormSelector } from "./RelatedFormSelector";
import { useQuery } from "@tanstack/react-query";
import { formDefinitionApi } from "@/api/formDefinition";
import { formDataApi, type FormDataResponse } from "@/api/formData";
import { extractAttachmentPreviewUrls } from "@/utils/attachmentDisplay";
import { AttachmentUpload } from "./AttachmentUpload";
import { SignaturePad } from "./SignaturePad";
import {
  evaluateFormulaExpression,
  formulaDependencyWatchKey,
  stringifyFormulaResult,
} from "@/utils/formulaEngine";

interface FormFieldRendererProps {
  field: FormFieldSchema;
  control: Control<Record<string, unknown>>;
  disabled?: boolean;
  formValues?: Record<string, unknown>; // 用于公式计算
  formSchema?: any; // 当前表单的 schema，用于字段映射
}

export const FormFieldRenderer = ({ field, control, disabled, formValues = {}, formSchema }: FormFieldRendererProps) => {
  const { user } = useAuthStore();
  const isDisabled = disabled || !field.editable;

  const isOptionField =
    field.type === "select" ||
    field.type === "radio" ||
    field.type === "checkbox" ||
    field.type === "multiselect";

  const optionSource = (field as any)?.advanced?.optionsSource as string | undefined;
  const optionsRelatedFormId = (field as any)?.advanced?.optionsRelatedFormId as string | undefined;
  const optionsRelatedLabelFieldId = (field as any)?.advanced?.optionsRelatedLabelFieldId as string | undefined;
  const optionsAllowOther = (field as any)?.advanced?.optionsAllowOther === true;
  const optionColorful = (field as any)?.advanced?.colorful === true;

  const { data: relatedFormRows, isLoading: relatedFormRowsLoading } = useQuery({
    queryKey: ["option-field-related-rows", optionsRelatedFormId, optionsRelatedLabelFieldId],
    queryFn: async () => {
      const list = await formDataApi.getListByForm(String(optionsRelatedFormId));
      return Array.isArray(list) ? list : [];
    },
    enabled:
      !!isOptionField &&
      optionSource === "relatedForm" &&
      !!optionsRelatedFormId &&
      !!optionsRelatedLabelFieldId,
    staleTime: 10_000,
  });

  const effectiveOptions = useMemo(() => {
    if (
      isOptionField &&
      optionSource === "relatedForm" &&
      optionsRelatedFormId &&
      optionsRelatedLabelFieldId
    ) {
      const list = Array.isArray(relatedFormRows) ? relatedFormRows : [];
      const mapped = list.map((r: FormDataResponse) => {
        const labelRaw = (r?.data || {})[optionsRelatedLabelFieldId];
        const label =
          labelRaw == null || String(labelRaw).trim() === ""
            ? `记录 ${String(r.recordId)}`
            : String(labelRaw);
        return {
          label,
          value: String(r.recordId),
        };
      });
      if (optionsAllowOther) {
        mapped.push({ label: "其他", value: "__other__" });
      }
      return mapped;
    }
    const fallback = (field as any)?.options || [];
    return (fallback as any[]).map((opt: any) => ({
      label: opt?.label,
      value: String(opt?.value),
      color: opt?.color,
    }));
  }, [
    field,
    isOptionField,
    optionSource,
    optionsAllowOther,
    optionsRelatedFormId,
    optionsRelatedLabelFieldId,
    relatedFormRows,
  ]);

  const selectColorMap = useMemo(() => {
    const m = new Map<string, string>();
    if (!optionColorful) return m;
    (effectiveOptions as any[]).forEach((o: any) => {
      const v = String(o?.value ?? "");
      const c = typeof o?.color === "string" ? o.color : "";
      if (v && c) m.set(v, c);
    });
    return m;
  }, [effectiveOptions, optionColorful]);

  const selectRenderLabel = useCallback(
    (opt: any) => {
      const text = String(opt?.label ?? opt?.value ?? "");
      const color = typeof opt?.color === "string" ? opt.color : undefined;
      if (!optionColorful || optionSource === "relatedForm") return text;
      return (
        <Tag color={color || "processing"} style={{ margin: 0 }}>
          {text || "-"}
        </Tag>
      );
    },
    [optionColorful, optionSource],
  );

  const selectOptionsWithColor = useMemo(() => {
    // 关联表单数据选项不做彩色（没有颜色来源），保持纯文本即可
    if (!optionColorful || optionSource === "relatedForm") return effectiveOptions as any;
    return (effectiveOptions as any[]).map((o: any) => ({
      ...o,
      label: selectRenderLabel(o),
    }));
  }, [effectiveOptions, optionColorful, optionSource, selectRenderLabel]);

  const getDatePickerMode = (format: string): "date" | "month" | "year" => {
    // 约定：包含 D 代表选择到日；不包含 D 但包含 M 代表选择到月；否则选择到年
    if (/D/.test(format)) return "date";
    if (/M/.test(format)) return "month";
    return "year";
  };

  const hasTimePart = (format: string): boolean => /H|m|s/.test(format);

  const getNumberFormat = (f: any) => {
    const nf = f?.advanced?.numberFormat || {};
    const keepDecimals = nf.keepDecimals !== false; // 默认 true
    const decimalPlaces =
      typeof nf.decimalPlaces === "number"
        ? nf.decimalPlaces
        : typeof f?.validation?.precision === "number"
          ? f.validation.precision
          : 2;
    const noRounding = nf.noRounding === true;
    const thousandSeparator = nf.thousandSeparator === true;
    const unit = typeof nf.unit === "string" ? nf.unit : "";
    return { keepDecimals, decimalPlaces, noRounding, thousandSeparator, unit };
  };

  const truncateDecimals = (raw: string, places: number) => {
    const s = raw.trim();
    if (!s) return s;
    const neg = s.startsWith("-") ? "-" : "";
    const body = neg ? s.slice(1) : s;
    const [i, d = ""] = body.split(".");
    if (places <= 0) return `${neg}${i}`;
    return `${neg}${i}.${d.slice(0, places)}`;
  };

  const addThousandsSep = (s: string) => {
    const [i, d] = s.split(".");
    const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return d != null && d !== "" ? `${ii}.${d}` : ii;
  };
  
  // 尝试获取 form context，如果没有则使用 control 的方法
  let setValue: (name: string, value: any) => void;
  let getValues: () => Record<string, unknown>;
  
  try {
    const formContext = useFormContext();
    setValue = formContext.setValue;
    getValues = formContext.getValues;
  } catch {
    // 如果没有 form context，使用 control 的方法（判空避免 _subjects 未定义报错）
    setValue = (name: string, value: any) => {
      if (!control || !control._subjects?.values) return;
      control._formValues[name] = value;
      control._subjects.values.next({ ...control._formValues });
    };
    getValues = () => (control ? control._formValues || {} : {});
  }

  const defaultFormulaExpr =
    field.advanced?.defaultMode === "formulaEdit" &&
    typeof field.advanced?.defaultFormulaExpression === "string"
      ? field.advanced.defaultFormulaExpression.trim()
      : "";

  const defaultFormulaDepsKey = useMemo(
    () =>
      defaultFormulaExpr
        ? formulaDependencyWatchKey(
            defaultFormulaExpr,
            formValues as Record<string, unknown>,
            formSchema
          )
        : "",
    [defaultFormulaExpr, formValues, formSchema]
  );

  // 应用动态默认值（当前登录人 / 当前时间 等）
  useEffect(() => {
    const values = getValues();
    const current = values[field.fieldId];
    if (current !== undefined && current !== null && current !== "") {
      return;
    }

    // 人员字段默认当前登录人
    if (field.type === "user" && field.advanced?.defaultMode === "currentUser" && user?.id) {
      setValue(field.fieldId, user.id);
      return;
    }

    // 日期 / 日期时间字段默认当前时间
    if ((field.type === "date" || field.type === "datetime") && field.advanced?.defaultMode === "now") {
      const now = field.type === "date" ? dayjs().format("YYYY-MM-DD") : dayjs().toISOString();
      setValue(field.fieldId, now);
      return;
    }
  }, [field, user, getValues, setValue]);

  // 公式编辑型默认值：随依赖字段变化重算
  useEffect(() => {
    if (!defaultFormulaExpr) return;
    let computed: unknown;
    try {
      computed = evaluateFormulaExpression(
        defaultFormulaExpr,
        formValues as Record<string, unknown>,
        formSchema
      );
    } catch {
      return;
    }
    const cur = getValues()[field.fieldId];
    const forNum = field.type === "number";
    const nextStr = stringifyFormulaResult(computed, forNum);
    const curStr = cur == null || cur === "" ? "" : String(cur);
    if (curStr === nextStr) return;
    if (forNum) {
      setValue(field.fieldId, nextStr === "" ? null : nextStr);
    } else {
      setValue(field.fieldId, computed ?? "");
    }
  }, [defaultFormulaExpr, defaultFormulaDepsKey, field.fieldId, field.type, getValues, setValue]);

  const renderField = () => {
    switch (field.type) {
      case "input":
        // 区分定位字段和地址字段
        if (field.label === "位置" || field.advanced?.fieldType === "location") {
          // 定位字段：使用真实的定位组件，获取GPS坐标
          return (
            <Controller
              name={field.fieldId}
              control={control}
              rules={{
                required: field.required ? `${field.label}是必填项` : false,
              }}
              render={({ field: formField, fieldState }) => (
                <Form.Item
                  label={field.label}
                  required={field.required}
                  validateStatus={fieldState.error ? "error" : ""}
                  help={fieldState.error?.message}
                >
                  <LocationField
                    value={formField.value}
                    onChange={formField.onChange}
                    placeholder={field.placeholder || "获取地理位置"}
                    disabled={isDisabled}
                    readOnly={!field.editable}
                  />
                </Form.Item>
              )}
            />
          );
        }
        
        if (field.label === "地址" || field.advanced?.fieldType === "address") {
          // 地址字段：使用真实的地址选择组件，支持全国省市区县选择
          return (
            <Controller
              name={field.fieldId}
              control={control}
              rules={{
                required: field.required ? `${field.label}是必填项` : false,
              }}
              render={({ field: formField, fieldState }) => (
                <Form.Item
                  label={field.label}
                  required={field.required}
                  validateStatus={fieldState.error ? "error" : ""}
                  help={fieldState.error?.message}
                >
                  <AddressField
                    value={formField.value}
                    onChange={formField.onChange}
                    placeholder="请选择省市区县"
                    disabled={isDisabled}
                    readOnly={!field.editable}
                  />
                </Form.Item>
              )}
            />
          );
        }
        
        // 普通输入框
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
              minLength: field.validation?.minLength
                ? {
                    value: field.validation.minLength,
                    message: `最少${field.validation.minLength}个字符`,
                  }
                : undefined,
              maxLength: field.validation?.maxLength
                ? {
                    value: field.validation.maxLength,
                    message: `最多${field.validation.maxLength}个字符`,
                  }
                : undefined,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Input
                  {...formField}
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                />
              </Form.Item>
            )}
          />
        );

      case "textarea":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
              minLength: field.validation?.minLength
                ? {
                    value: field.validation.minLength,
                    message: `最少${field.validation.minLength}个字符`,
                  }
                : undefined,
              maxLength: field.validation?.maxLength
                ? {
                    value: field.validation.maxLength,
                    message: `最多${field.validation.maxLength}个字符`,
                  }
                : undefined,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Input.TextArea
                  {...formField}
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  rows={field.advanced?.rows || 4}
                  readOnly={!field.editable}
                />
              </Form.Item>
            )}
          />
        );

      case "number":
        const nf = getNumberFormat(field);
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
              min: field.validation?.min
                ? {
                    value: field.validation.min,
                    message: `最小值是${field.validation.min}`,
                  }
                : undefined,
              max: field.validation?.max
                ? {
                    value: field.validation.max,
                    message: `最大值是${field.validation.max}`,
                  }
                : undefined,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Space.Compact style={{ width: "100%" }}>
                  <InputNumber
                    {...formField}
                    stringMode
                    placeholder={field.placeholder}
                    disabled={isDisabled}
                    style={{ width: "100%" }}
                    precision={nf.keepDecimals && !nf.noRounding ? nf.decimalPlaces : undefined}
                    formatter={(v) => {
                    if (v == null || v === "") return "";
                    const raw = String(v);
                    const cleaned = raw.replace(/,/g, "");
                    const normalized = nf.keepDecimals ? cleaned : cleaned;
                    return nf.thousandSeparator ? addThousandsSep(normalized) : normalized;
                    }}
                    parser={(v) => {
                    const raw = String(v ?? "");
                    const noUnit = nf.unit ? raw.replace(new RegExp(`\\s*${nf.unit}$`), "") : raw;
                    return noUnit.replace(/,/g, "");
                    }}
                    onChange={(val) => {
                    if (!nf.keepDecimals) {
                      formField.onChange(val);
                      return;
                    }
                    const raw = val == null ? "" : String(val);
                    const cleaned = raw.replace(/,/g, "");
                    if (nf.noRounding) {
                      const next = truncateDecimals(cleaned, nf.decimalPlaces);
                      formField.onChange(next === "" ? null : next);
                      return;
                    }
                    formField.onChange(val);
                    }}
                  />
                  {nf.unit ? (
                    <div style={{ minWidth: 40, padding: "0 8px", border: "1px solid #d9d9d9", borderLeft: "none", borderRadius: "0 6px 6px 0", background: "#fafafa", color: "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                      {nf.unit}
                    </div>
                  ) : null}
                </Space.Compact>
              </Form.Item>
            )}
          />
        );

      case "date":
        const dateFormat = (field.advanced?.dateFormat as string) || "YYYY-MM-DD";
        const datePickerMode = getDatePickerMode(dateFormat);
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <DatePicker
                  {...formField}
                  picker={datePickerMode}
                  format={dateFormat}
                  value={formField.value ? dayjs(formField.value) : undefined}
                  onChange={(date) => formField.onChange(date ? date.format(dateFormat) : null)}
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            )}
          />
        );

      case "select":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Select
                  {...formField}
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  loading={relatedFormRowsLoading}
                  options={selectOptionsWithColor}
                />
              </Form.Item>
            )}
          />
        );

      case "radio":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Radio.Group
                  {...formField}
                  disabled={isDisabled}
                  options={effectiveOptions}
                />
              </Form.Item>
            )}
          />
        );

      case "boolean":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Switch
                  checked={formField.value === true}
                  onChange={(checked) => formField.onChange(checked)}
                  checkedChildren="是"
                  unCheckedChildren="否"
                  disabled={isDisabled}
                />
              </Form.Item>
            )}
          />
        );

      case "checkbox":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Checkbox.Group
                  {...formField}
                  disabled={isDisabled}
                  options={effectiveOptions}
                />
              </Form.Item>
            )}
          />
        );

      case "datetime":
        const dateTimeFormat = (field.advanced?.dateFormat as string) || "YYYY-MM-DD HH:mm:ss";
        const dateTimePickerMode = getDatePickerMode(dateTimeFormat);
        const showTime = hasTimePart(dateTimeFormat);
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <DatePicker
                  {...formField}
                  picker={dateTimePickerMode}
                  showTime={showTime}
                  format={dateTimeFormat}
                  value={formField.value ? dayjs(formField.value) : undefined}
                  onChange={(date) =>
                    formField.onChange(
                      date ? date.format(dateTimeFormat) : null
                    )
                  }
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            )}
          />
        );

      case "multiselect":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Select
                  {...formField}
                  mode="multiple"
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  loading={relatedFormRowsLoading}
                  options={selectOptionsWithColor}
                  tagRender={
                    optionColorful && optionSource !== "relatedForm"
                      ? (props) => {
                          const c = selectColorMap.get(String(props.value));
                          return (
                            <Tag
                              color={c || "processing"}
                              closable={props.closable}
                              onClose={props.onClose}
                              style={{ marginInlineEnd: 4 }}
                            >
                              {props.label}
                            </Tag>
                          );
                        }
                      : undefined
                  }
                />
              </Form.Item>
            )}
          />
        );

      case "attachment": {
        const multi = field.advanced?.multiple === true;
        const pictureMode =
          field.label?.includes("图") || field.advanced?.listType === "picture";
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => {
              const readonlyUrls = extractAttachmentPreviewUrls(formField.value);
              if (isDisabled) {
                return (
                  <Form.Item
                    label={field.label}
                    required={field.required}
                    validateStatus={fieldState.error ? "error" : ""}
                    help={fieldState.error?.message}
                  >
                    {readonlyUrls.length === 0 ? (
                      <Typography.Text type="secondary">暂无文件</Typography.Text>
                    ) : (
                      <Image.PreviewGroup>
                        <Space wrap size="middle">
                          {readonlyUrls.map((url, i) => (
                            <Image
                              key={`${url}-${i}`}
                              src={url}
                              alt=""
                              width={pictureMode ? 120 : 96}
                              height={pictureMode ? 120 : undefined}
                              style={
                                pictureMode
                                  ? { objectFit: "cover", borderRadius: 8 }
                                  : { maxHeight: 120, borderRadius: 4 }
                              }
                            />
                          ))}
                        </Space>
                      </Image.PreviewGroup>
                    )}
                  </Form.Item>
                );
              }
              return (
                <Form.Item
                  label={field.label}
                  required={field.required}
                  validateStatus={fieldState.error ? "error" : ""}
                  help={fieldState.error?.message || "文件将上传到服务端保存"}
                >
                  <AttachmentUpload
                    value={formField.value}
                    onChange={formField.onChange}
                    multiple={multi}
                    pictureMode={pictureMode}
                  />
                </Form.Item>
              );
            }}
          />
        );
      }

      case "user":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => {
              // 系统字段：创建人、拥有者
              if (field.isSystemField) {
                const systemValue = field.systemFieldType === "creator" || field.systemFieldType === "owner"
                  ? user?.id || ""
                  : formField.value;
                return (
                  <Form.Item
                    label={field.label}
                    required={field.required}
                    validateStatus={fieldState.error ? "error" : ""}
                    help={fieldState.error?.message || (field.isSystemField ? "系统自动生成" : undefined)}
                  >
                    <Input
                      value={systemValue ? (user?.name || user?.account || "") : ""}
                      disabled
                      prefix={<UserOutlined />}
                      placeholder="系统自动生成"
                    />
                  </Form.Item>
                );
              }
              // 普通用户选择字段
              const isMultiple = field.advanced?.multiple === true;
              return (
                <Form.Item
                  label={field.label}
                  required={field.required}
                  validateStatus={fieldState.error ? "error" : ""}
                  help={fieldState.error?.message}
                >
                  <UserSelector
                    value={formField.value}
                    onChange={formField.onChange}
                    multiple={isMultiple}
                    disabled={isDisabled}
                    placeholder={field.placeholder || "请选择人员"}
                  />
                </Form.Item>
              );
            }}
          />
        );

      case "department":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => {
              // 系统字段：所属部门
              if (field.isSystemField) {
                return (
                  <Form.Item
                    label={field.label}
                    required={field.required}
                    validateStatus={fieldState.error ? "error" : ""}
                    help={fieldState.error?.message || "系统自动生成"}
                  >
                    <Input
                      value={formField.value || ""}
                      disabled
                      prefix={<ApartmentOutlined />}
                      placeholder="系统自动生成"
                    />
                  </Form.Item>
                );
              }
              // 普通部门选择字段
              const isMultiple = field.advanced?.multiple === true;
              return (
                <Form.Item
                  label={field.label}
                  required={field.required}
                  validateStatus={fieldState.error ? "error" : ""}
                  help={fieldState.error?.message}
                >
                  <DepartmentSelector
                    value={formField.value}
                    onChange={formField.onChange}
                    multiple={isMultiple}
                    disabled={isDisabled}
                    placeholder={field.placeholder || "请选择部门"}
                  />
                </Form.Item>
              );
            }}
          />
        );

      case "subtable":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
              validate: (value: any) => {
                const rows = Array.isArray(value) ? value : [];
                const subtableFields = (field as any).subtableFields || [];
                const isEmpty = (v: any) =>
                  v === undefined ||
                  v === null ||
                  (typeof v === "string" && v.trim() === "") ||
                  (Array.isArray(v) && v.length === 0);
                for (let i = 0; i < rows.length; i++) {
                  const row = rows[i] || {};
                  for (const sf of subtableFields) {
                    if (!sf?.required || !sf?.fieldId) continue;
                    if (isEmpty(row[sf.fieldId])) {
                      return `第${i + 1}行「${sf.label || sf.fieldId}」为必填项`;
                    }
                  }
                }
                return true;
              },
            }}
            render={({ field: formField, fieldState }) => {
              const subtableFields = (field as any).subtableFields || [];
              const dataSource = formField.value || [];
              const [expanded, setExpanded] = useState(true);
              const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
              const [currentPage, setCurrentPage] = useState(1);
              const [pageSize, setPageSize] = useState(10);
              const [columnWidths] = useState<Record<string, number>>({});
              const isCellDisabled = (sf: any) => isDisabled || sf?.editable === false || sf?.type === "formula";

              // 子表公式计算与写回：禁止在 cell render 阶段调用 formField.onChange，
              // 否则会触发 React 报错：
              // "Cannot update a component (Controller) while rendering a different component (Cell...)"
              useEffect(() => {
                if (!subtableFields.length) return;
                if (!formSchema) return;

                let changed = false;
                const nextData = Array.isArray(dataSource) ? dataSource.map((r) => ({ ...(r || {}) })) : [];

                subtableFields.forEach((subField: any) => {
                  if (!subField?.fieldId) return;

                  // A) 子表字段类型为 formula：按行计算并写回
                  if (subField.type === "formula" && typeof subField.formulaExpression === "string") {
                    const expression = subField.formulaExpression.trim();
                    if (!expression) return;

                    for (let rowIndex = 0; rowIndex < nextData.length; rowIndex++) {
                      const row = nextData[rowIndex] || {};
                      const contextFormValues: Record<string, unknown> = {
                        ...(formValues as Record<string, unknown>),
                        // 子表Id 临时视作当前行对象，保证 {子表Id.列Id} 变成标量
                        [field.fieldId]: row,
                        ...row,
                      };
                      const result = evaluateFormulaExpression(expression, contextFormValues, formSchema);
                      const nextValue = stringifyFormulaResult(result, false);
                      const curValue = row[subField.fieldId];
                      if (String(curValue ?? "") !== String(nextValue ?? "")) {
                        row[subField.fieldId] = nextValue;
                        changed = true;
                      }
                    }
                    return;
                  }

                  // B) 普通字段：advanced.defaultMode=formulaEdit => 按行计算默认值并写回
                  const defaultFormulaExpr =
                    subField?.advanced?.defaultMode === "formulaEdit" &&
                    typeof subField?.advanced?.defaultFormulaExpression === "string"
                      ? subField.advanced.defaultFormulaExpression.trim()
                      : "";

                  if (defaultFormulaExpr && subField.type !== "formula") {
                    for (let rowIndex = 0; rowIndex < nextData.length; rowIndex++) {
                      const row = nextData[rowIndex] || {};
                      const contextFormValues: Record<string, unknown> = {
                        ...(formValues as Record<string, unknown>),
                        [field.fieldId]: row,
                        ...row,
                      };
                      const result = evaluateFormulaExpression(defaultFormulaExpr, contextFormValues, formSchema);
                      const forNum = subField.type === "number";
                      const nextStr = stringifyFormulaResult(result, forNum);
                      const nextValue = forNum ? (nextStr === "" ? null : nextStr) : nextStr;
                      const curValue = row[subField.fieldId];
                      if (String(curValue ?? "") !== String(nextValue ?? "")) {
                        row[subField.fieldId] = nextValue;
                        changed = true;
                      }
                    }
                  }
                });

                if (changed) {
                  formField.onChange(nextData);
                }
              }, [dataSource, subtableFields, formSchema, formValues, field.fieldId, formField]);
              
              // 分页数据
              const startIndex = (currentPage - 1) * pageSize;
              const endIndex = startIndex + pageSize;
              const paginatedData = dataSource
                .slice(startIndex, endIndex)
                .map((row, idx) => ({
                  ...row,
                  __rowKey: (row as any)?.__rowKey || `row-${startIndex + idx}`,
                }));
              
              const handleCellChange = (value: any, index: number, subFieldId: string) => {
                const newData = [...dataSource];
                const actualIndex = startIndex + index;
                if (!newData[actualIndex]) {
                  newData[actualIndex] = {};
                }
                newData[actualIndex][subFieldId] = value;
                formField.onChange(newData);
              };

              const handleAddRow = () => {
                const newRow: Record<string, unknown> = {};
                subtableFields.forEach((subField: any) => {
                  newRow[subField.fieldId] = subField.defaultValue || "";
                });
                formField.onChange([...dataSource, newRow]);
              };

              const handleDeleteRows = () => {
                if (selectedRowKeys.length === 0) {
                  message.warning("请选择要删除的行");
                  return;
                }
                // 按索引从大到小排序，避免删除后索引变化的问题
                const sortedKeys = [...selectedRowKeys].sort((a, b) => Number(b) - Number(a));
                let newData = [...dataSource];
                sortedKeys.forEach((key) => {
                  newData = newData.filter((_, i) => i !== Number(key));
                });
                formField.onChange(newData);
                setSelectedRowKeys([]);
                // 如果当前页没有数据了，跳转到上一页
                const newTotal = newData.length;
                const maxPage = Math.ceil(newTotal / pageSize) || 1;
                if (currentPage > maxPage) {
                  setCurrentPage(maxPage);
                }
              };

              const handleImport = () => {
                message.info("导入功能待实现");
              };

              // 当前页的选中状态
              const currentPageSelectedKeys = selectedRowKeys.filter(
                (key) => key >= startIndex && key < endIndex
              );
              const allCurrentPageSelected = paginatedData.length > 0 && 
                currentPageSelectedKeys.length === paginatedData.length;

              const handleSelectAll = (checked: boolean) => {
                if (checked) {
                  const currentPageKeys = paginatedData.map((_, index) => startIndex + index);
                  setSelectedRowKeys([...selectedRowKeys, ...currentPageKeys.filter(key => !selectedRowKeys.includes(key))]);
                } else {
                  setSelectedRowKeys(selectedRowKeys.filter(key => key < startIndex || key >= endIndex));
                }
              };

              const SubtableRelatedCell: React.FC<{
                value: any;
                onChange: (
                  val: any,
                  extra?: Record<string, unknown>,
                  selectedRecords?: FormDataResponse[],
                ) => void;
                subField: any;
                disabled?: boolean;
                currentRow?: Record<string, unknown>;
              }> = ({ value, onChange, subField, disabled, currentRow }) => {
                const [selectorVisible, setSelectorVisible] = useState(false);
                const isLikelyFormRecordId = (rawId: string) =>
                  /^record_[\w-]+$/i.test(rawId) ||
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);
                const extractRecordId = (raw: any): string | undefined => {
                  if (raw == null) return undefined;
                  if (typeof raw === "string" || typeof raw === "number") {
                    const s = String(raw).trim();
                    return s || undefined;
                  }
                  if (typeof raw === "object") {
                    const v =
                      (raw as any).recordId ??
                      (raw as any).id ??
                      (raw as any).value ??
                      (raw as any).record_id;
                    if (v == null) return undefined;
                    const s = String(v).trim();
                    return s ? s : undefined;
                  }
                  return undefined;
                };
                const extractRecordIds = (raw: any): string[] => {
                  if (Array.isArray(raw)) {
                    return raw
                      .map((item) => extractRecordId(item))
                      .filter((id): id is string => !!id);
                  }
                  const one = extractRecordId(raw);
                  return one ? [one] : [];
                };

                // 获取关联表单定义
                const { data: relatedFormDefinition } = useQuery({
                  queryKey: ["formDefinition", subField.relatedFormId],
                  queryFn: () => formDefinitionApi.getById(subField.relatedFormId!),
                  enabled: !!subField.relatedFormId,
                });

                // 子表弹窗可能存多条 recordId（数组），与字段类型是否为 relatedFormMulti 无关
                const selectedIds = extractRecordIds(value);
                const selectedRecordId = selectedIds.length === 1 ? selectedIds[0] : undefined;
                const selectedRecordIdForQuery =
                  selectedRecordId && isLikelyFormRecordId(selectedRecordId) ? selectedRecordId : undefined;

                const { data: selectedRecord } = useQuery({
                  queryKey: ["formData", selectedRecordIdForQuery],
                  queryFn: () => formDataApi.getById(selectedRecordIdForQuery!),
                  enabled: !!selectedRecordIdForQuery && selectedIds.length <= 1,
                });

                const displayText = useMemo(() => {
                  if (selectedIds.length > 1) {
                    return `已选择 ${selectedIds.length} 条记录`;
                  }
                  if (selectedIds.length === 0) {
                    return subField.placeholder || "请选择";
                  }
                  // 历史数据可能直接存了展示文本（不是 recordId），直接回显文本
                  if (selectedRecordId && !selectedRecordIdForQuery) {
                    return selectedRecordId;
                  }
                  if (selectedRecord && relatedFormDefinition) {
                    const displayFieldId = subField.relatedDisplayField;
                    const cfg: any = relatedFormDefinition.config || {};
                    const directFields = cfg.fields || [];
                    const elements = cfg.elements || [];
                    let displayField =
                      directFields.find((f: any) => f.fieldId === displayFieldId) || undefined;
                    if (!displayField && elements.length) {
                      elements.forEach((el: any) => {
                        if (displayField) return;
                        if (el && "children" in el && Array.isArray(el.children)) {
                          const found = el.children.find(
                            (child: any) => child.fieldId === displayFieldId
                          );
                          if (found) {
                            displayField = found;
                          }
                        }
                      });
                    }
                    if (!displayField) {
                      displayField = directFields[0];
                    }
                    if (displayField) {
                      const previewValue = (selectedRecord.data || {})[displayField.fieldId];
                      if (previewValue === null || previewValue === undefined) {
                        return selectedRecord.recordId;
                      }
                      if (Array.isArray(previewValue)) {
                        return `明细共 ${previewValue.length} 行`;
                      }
                      if (typeof previewValue === "object") {
                        const str = JSON.stringify(previewValue);
                        return str.length > 50 ? `${str.slice(0, 50)}...` : str;
                      }
                      return String(previewValue);
                    }
                    return selectedRecord.recordId;
                  }
                  // 兜底：即使详情查询失败，也要显示已选ID，避免看起来像“未选择”
                  return selectedRecordId;
                }, [selectedIds, selectedRecordId, selectedRecord, subField, relatedFormDefinition]);

                const handleSelect = (record: FormDataResponse | FormDataResponse[]) => {
                  // 子表里弹窗已强制 multiple：返回数组时必须走多选分支，不能依赖字段类型（可能是 relatedForm）
                  if (Array.isArray(record)) {
                    const records = record as FormDataResponse[];
                    if (records.length === 0) {
                      message.warning("请至少选择一条记录");
                      return;
                    }
                    const recordIds = records.map((r) => r.recordId);
                    const firstRecord = records[0];
                    const updates: Record<string, unknown> = {};

                    if (firstRecord && subField.fieldMapping) {
                      Object.entries(subField.fieldMapping || {}).forEach(([relatedFieldId, currentFieldId]) => {
                        const val = (firstRecord.data || {})[relatedFieldId];
                        if (val !== undefined && currentFieldId) {
                          updates[currentFieldId] = val;
                        }
                      });
                    }

                    onChange(recordIds, updates, records);
                    message.success(`已选择 ${records.length} 条记录`);
                    return;
                  }

                  {
                    const single = record as FormDataResponse;
                    const updates: Record<string, unknown> = {};
                    if (subField.fieldMapping) {
                      Object.entries(subField.fieldMapping || {}).forEach(([relatedFieldId, currentFieldId]) => {
                        const val = (single.data || {})[relatedFieldId];
                        if (val !== undefined && currentFieldId) {
                          updates[currentFieldId] = val;
                        }
                      });
                    }
                    onChange(single.recordId, updates);
                    message.success("已选择关联表单数据");
                  }
                };

                return (
                  <>
                    <Input
                      value={displayText}
                      placeholder={subField.placeholder || "请选择"}
                      disabled={disabled || !subField.relatedFormId}
                      readOnly
                      size="small"
                      suffix={
                        <Button
                          type="text"
                          size="small"
                          icon={<FileTextOutlined />}
                          style={{
                            color: "#8c8c8c",
                            paddingInline: 4,
                            minWidth: 24,
                            height: 24,
                          }}
                          onClick={() => {
                            if (!subField.relatedFormId) {
                              message.warning("请先配置关联表单");
                              return;
                            }
                            setSelectorVisible(true);
                          }}
                          disabled={disabled || !subField.relatedFormId}
                        />
                      }
                    />
                    {subField.relatedFormId && (
                      <RelatedFormSelector
                        open={selectorVisible}
                        onClose={() => setSelectorVisible(false)}
                        onSelect={handleSelect}
                        relatedFormId={subField.relatedFormId}
                        multiple
                        currentFormSchema={formSchema}
                        dataFilterEnabled={subField.enableDataFilter === true}
                        dataFilterConditions={subField.relatedDataFilterConditions}
                        runtimeFormValues={formValues as Record<string, unknown>}
                      />
                    )}
                  </>
                );
              };

              const columns = [
                ...(!isDisabled
                  ? [
                      {
                        title: (
                          <Checkbox
                            checked={allCurrentPageSelected}
                            indeterminate={currentPageSelectedKeys.length > 0 && !allCurrentPageSelected}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        ),
                        key: "checkbox",
                        width: 50,
                        render: (_: any, record: any, index: number) => {
                          const actualIndex = startIndex + index;
                          return (
                            <Checkbox
                              checked={selectedRowKeys.includes(actualIndex)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRowKeys([...selectedRowKeys, actualIndex]);
                                } else {
                                  setSelectedRowKeys(selectedRowKeys.filter((key) => key !== actualIndex));
                                }
                              }}
                            />
                          );
                        },
                      },
                    ]
                  : []),
                {
                  title: "",
                  key: "index",
                  width: 60,
                  render: (_: any, record: any, index: number) => {
                    return startIndex + index + 1;
                  },
                },
                ...subtableFields.map((subField: any) => ({
                  title: <span>{subField.label}</span>,
                  dataIndex: subField.fieldId,
                  key: subField.fieldId,
                  width: columnWidths[subField.fieldId] || 180,
                  render: (text: any, record: any, index: number) => {
                    let effectiveText = text;

                    // 子表“公式编辑默认值”（advanced.defaultMode=formulaEdit）：
                    // 这里需要手动计算并回写当前行，否则子表里的字段不会走 FormFieldRenderer 的公式 useEffect。
                    const defaultFormulaExpr =
                      subField?.advanced?.defaultMode === "formulaEdit" &&
                      typeof subField?.advanced?.defaultFormulaExpression === "string"
                        ? subField.advanced.defaultFormulaExpression.trim()
                        : "";

                    if (defaultFormulaExpr && subField.type !== "formula") {
                      try {
                        const forNum = subField.type === "number";
                        // 关键：子表新增行时，watch() 里的 formValues 可能还没同步到最新 dataSource。
                        // 对“单行公式”而言：UI里引用可能是 {子表Id.列Id}（数组变量），
                        // 但你希望按“当前行”计算，因此把 formValues[subtableId] 临时覆盖为当前行 record，
                        // 这样 rawFormValue 会返回标量而不是整列数组。
                        const contextFormValues: Record<string, unknown> = {
                          ...(formValues as Record<string, unknown>),
                          [field.fieldId]: record as Record<string, unknown>,
                          ...(record as Record<string, unknown>),
                        };
                        const result = evaluateFormulaExpression(
                          defaultFormulaExpr,
                          contextFormValues,
                          formSchema
                        );
                        const nextStr = stringifyFormulaResult(result, forNum);
                        const nextValue = forNum ? (nextStr === "" ? null : nextStr) : nextStr;

                        effectiveText = nextValue;
                      } catch (e) {
                        console.error("子表默认公式计算错误:", e);
                      }
                    }

                    switch (subField.type) {
                      case "input":
                        return (
                          <Input
                            value={effectiveText || ""}
                            onChange={(e) => handleCellChange(e.target.value, index, subField.fieldId)}
                            placeholder="请输入"
                            size="small"
                            disabled={isCellDisabled(subField)}
                          />
                        );
                      case "textarea":
                        return (
                          <Input.TextArea
                            value={effectiveText || ""}
                            onChange={(e) => handleCellChange(e.target.value, index, subField.fieldId)}
                            placeholder="请输入"
                            rows={2}
                            disabled={isCellDisabled(subField)}
                          />
                        );
                      case "number":
                        const snf = getNumberFormat(subField);
                        return (
                          <Space.Compact style={{ width: "100%" }}>
                            <InputNumber
                            value={effectiveText}
                            stringMode
                            precision={snf.keepDecimals && !snf.noRounding ? snf.decimalPlaces : undefined}
                            formatter={(v) => {
                              if (v == null || v === "") return "";
                              const raw = String(v);
                              const cleaned = raw.replace(/,/g, "");
                              return snf.thousandSeparator ? addThousandsSep(cleaned) : cleaned;
                            }}
                            parser={(v) => {
                              const raw = String(v ?? "");
                              const noUnit = snf.unit ? raw.replace(new RegExp(`\\s*${snf.unit}$`), "") : raw;
                              return noUnit.replace(/,/g, "");
                            }}
                            onChange={(value) => {
                              if (!snf.keepDecimals) {
                                handleCellChange(value, index, subField.fieldId);
                                return;
                              }
                              const raw = value == null ? "" : String(value);
                              const cleaned = raw.replace(/,/g, "");
                              if (snf.noRounding) {
                                const next = truncateDecimals(cleaned, snf.decimalPlaces);
                                handleCellChange(next === "" ? null : next, index, subField.fieldId);
                                return;
                              }
                              handleCellChange(value, index, subField.fieldId);
                            }}
                            placeholder="请输入"
                            size="small"
                            style={{ width: "100%" }}
                            disabled={isCellDisabled(subField)}
                            />
                            {snf.unit ? (
                              <div style={{ minWidth: 32, padding: "0 8px", border: "1px solid #d9d9d9", borderLeft: "none", borderRadius: "0 6px 6px 0", background: "#fafafa", color: "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                                {snf.unit}
                              </div>
                            ) : null}
                          </Space.Compact>
                        );
                      case "date":
                        const sfFormat =
                          (subField.advanced?.dateFormat as string) || "YYYY-MM-DD";
                        const sfPicker = getDatePickerMode(sfFormat);
                        return (
                          <DatePicker
                            picker={sfPicker}
                            value={effectiveText ? dayjs(effectiveText) : null}
                            onChange={(date) =>
                              handleCellChange(
                                date ? date.format(sfFormat) : null,
                                index,
                                subField.fieldId,
                              )
                            }
                            placeholder={sfFormat}
                            size="small"
                            style={{ width: "100%" }}
                            disabled={isCellDisabled(subField)}
                          />
                        );
                      case "select":
                        return (
                          <Select
                            value={effectiveText}
                            onChange={(value) => handleCellChange(value, index, subField.fieldId)}
                            placeholder="请选择"
                            size="small"
                            style={{ width: "100%" }}
                            disabled={isCellDisabled(subField)}
                            options={subField.options?.map((opt: any) => ({
                              label: opt.label,
                              value: String(opt.value),
                            }))}
                          />
                        );
                      case "radio":
                        return (
                          <Radio.Group
                            value={effectiveText}
                            onChange={(e) => handleCellChange(e.target.value, index, subField.fieldId)}
                            disabled={isCellDisabled(subField)}
                          >
                            {subField.options?.map((opt: any) => (
                              <Radio key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </Radio>
                            ))}
                          </Radio.Group>
                        );
                      case "boolean":
                        return (
                          <Switch
                            checked={effectiveText === true || effectiveText === "true" || effectiveText === 1 || effectiveText === "1"}
                            onChange={(checked) => handleCellChange(checked, index, subField.fieldId)}
                            checkedChildren="是"
                            unCheckedChildren="否"
                            disabled={isCellDisabled(subField)}
                            size="small"
                          />
                        );
                      case "formula": {
                        const expression = subField.formulaExpression as string | undefined;

                        const calculate = () => {
                          if (!expression) return "";
                          try {
                            const result = evaluateFormulaExpression(
                              expression,
                              // 子表公式要能使用“同一行字段”以及“整表/其它字段”的引用：
                              // - 用 formValues 提供整表上下文（用于 {subtableId.colId} 这种引用）
                              // - 用 record 覆盖当前行字段（用于 {colId} 这种引用）
                              {
                                ...(formValues as Record<string, unknown>),
                                // 将子表Id临时视作“当前行对象”，使 {subtableId.colId} 在单行公式中变成标量
                                [field.fieldId]: record as Record<string, unknown>,
                                ...(record as Record<string, unknown>),
                              },
                              formSchema
                            );
                            // 公式字段可能返回文本（如 CONCATENATE），不要强制按数字格式化
                            return stringifyFormulaResult(result, false);
                          } catch (e) {
                            console.error("子表公式计算错误:", e);
                            return "";
                          }
                        };

                        const formulaValue = calculate();

                        return (
                          <Input
                            value={formulaValue}
                            disabled
                            size="small"
                            placeholder="公式结果"
                          />
                        );
                      }
                      case "relatedForm":
                      case "relatedFormMulti": {
                        const actualIndex = startIndex + index;
                        const currentRow = dataSource[actualIndex] || {};
                        return (
                          <SubtableRelatedCell
                            value={effectiveText}
                            subField={subField}
                            disabled={isCellDisabled(subField)}
                            currentRow={currentRow}
                            onChange={(val, extraUpdates, selectedRecords) => {
                              const newData = [...dataSource];
                              const ensureBaseRow = () => {
                                if (!newData[actualIndex]) newData[actualIndex] = {};
                                return { ...(newData[actualIndex] || {}) };
                              };

                              const buildMappedRow = (
                                recordItem: FormDataResponse,
                                rawValue: any,
                              ) => {
                                const row: Record<string, unknown> = {
                                  ...ensureBaseRow(),
                                  [subField.fieldId]: rawValue,
                                };
                                if (subField.fieldMapping) {
                                  Object.entries(subField.fieldMapping || {}).forEach(
                                    ([relatedFieldId, currentFieldId]) => {
                                      const mappedValue = (recordItem.data || {})[relatedFieldId];
                                      if (mappedValue !== undefined && currentFieldId) {
                                        row[currentFieldId] = mappedValue;
                                      }
                                    },
                                  );
                                }
                                return row;
                              };

                              // 子表弹窗多选时一定带 selectedRecords；与字段类型无关（可能是 relatedForm）
                              if (Array.isArray(selectedRecords) && selectedRecords.length > 0) {
                                const expandedRows = selectedRecords.map((recordItem) =>
                                  buildMappedRow(recordItem, recordItem.recordId),
                                );
                                newData[actualIndex] = expandedRows[0];
                                if (expandedRows.length > 1) {
                                  newData.splice(actualIndex + 1, 0, ...expandedRows.slice(1));
                                }
                              } else {
                                if (!newData[actualIndex]) newData[actualIndex] = {};
                                newData[actualIndex][subField.fieldId] = val;
                                if (extraUpdates && typeof extraUpdates === "object") {
                                  Object.entries(extraUpdates).forEach(([k, v]) => {
                                    newData[actualIndex][k] = v;
                                  });
                                }
                              }
                              formField.onChange(newData);
                              if (Array.isArray(selectedRecords) && selectedRecords.length > 0) {
                                const nextTotal = newData.length;
                                const maxPage = Math.ceil(nextTotal / pageSize) || 1;
                                if (currentPage > maxPage) {
                                  setCurrentPage(maxPage);
                                }
                                setSelectedRowKeys((prev) =>
                                  prev.filter((key) => key >= 0 && key < newData.length),
                                );
                              }
                            }}
                          />
                        );
                      }
                      case "attachment": {
                        const subMulti = subField.advanced?.multiple === true;
                        const subPicture =
                          subField.label?.includes("图") ||
                          subField.advanced?.listType === "picture";
                        if (isDisabled) {
                          const urls = extractAttachmentPreviewUrls(effectiveText);
                          return !urls.length ? (
                            <Typography.Text type="secondary">-</Typography.Text>
                          ) : (
                            <Image.PreviewGroup>
                              <Space wrap size={4}>
                                {urls.map((url, i) => (
                                  <Image
                                    key={`${url}-${i}`}
                                    src={url}
                                    alt=""
                                    width={subPicture ? 48 : 40}
                                    height={subPicture ? 48 : undefined}
                                    style={{ objectFit: "cover", borderRadius: 4 }}
                                  />
                                ))}
                              </Space>
                            </Image.PreviewGroup>
                          );
                        }
                        return (
                          <div className="subtable-upload-inline">
                            <AttachmentUpload
                              value={effectiveText}
                              onChange={(v) =>
                                handleCellChange(v, index, subField.fieldId)
                              }
                              multiple={subMulti}
                              pictureMode={subPicture}
                              size="small"
                            />
                          </div>
                        );
                      }
                      default:
                        return (
                          <Input
                            value={effectiveText || ""}
                            onChange={(e) => handleCellChange(e.target.value, index, subField.fieldId)}
                            placeholder="请输入"
                            size="small"
                            disabled={isCellDisabled(subField)}
                          />
                        );
                    }
                  },
                })),
                ...(!isDisabled
                  ? [
                      {
                        title: "操作",
                        key: "action",
                        width: 80,
                        render: (_: any, record: any, index: number) => {
                          const actualIndex = startIndex + index;
                          return (
                            <Dropdown
                              menu={{
                                items: [
                                  {
                                    key: "delete",
                                    label: "删除",
                                    danger: true,
                                    icon: <DeleteOutlined />,
                                    onClick: () => {
                                      if (isDisabled) return;
                                      const newData = dataSource.filter((_: any, i: number) => i !== actualIndex);
                                      formField.onChange(newData);
                                    },
                                  },
                                ],
                              }}
                              trigger={["click"]}
                            >
                              <Button type="text" icon={<MoreOutlined />} />
                            </Dropdown>
                          );
                        },
                      },
                    ]
                  : []),
              ];

              return (
                <Form.Item
                  required={field.required}
                  validateStatus={fieldState.error ? "error" : ""}
                  help={fieldState.error?.message}
                  style={{ marginBottom: 24 }}
                >
                  <div
                    style={{
                      border: "1px solid #f0f0f0",
                      borderRadius: 10,
                      background: "#fff",
                      overflow: "hidden",
                    }}
                  >
                    {subtableFields.length > 0 ? (
                      <>
                        {/* 标题栏 */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px 16px",
                            borderBottom: "1px solid #f0f0f0",
                            cursor: "pointer",
                            background: "#f8fafc",
                          }}
                          onClick={() => setExpanded(!expanded)}
                        >
                          <Space>
                            {expanded ? <CaretUpOutlined /> : <CaretDownOutlined />}
                            <Typography.Text strong>{field.label}</Typography.Text>
                          </Space>
                        </div>

                        {expanded && (
                          <>
                            {/* 操作按钮栏（编辑态） */}
                            {!isDisabled && (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "10px 14px",
                                  borderBottom: "1px solid #eef2f7",
                                  background: "#fff",
                                }}
                              >
                                <Space size={10}>
                                  <Button
                                    type="primary"
                                    size="small"
                                    icon={<PlusOutlined />}
                                    onClick={() => {
                                      if (isDisabled) return;
                                      handleAddRow();
                                    }}
                                    disabled={isDisabled}
                                    style={{ borderRadius: 6 }}
                                  >
                                    新增
                                  </Button>
                                  <Button
                                    size="small"
                                    icon={<DownloadOutlined />}
                                    onClick={() => {
                                      if (isDisabled) return;
                                      handleImport();
                                    }}
                                    disabled={isDisabled}
                                    style={{ borderRadius: 6 }}
                                  >
                                    导入
                                  </Button>
                                  <Button
                                    size="small"
                                    danger
                                    icon={<DeleteOutlined />}
                                    onClick={() => {
                                      if (isDisabled) return;
                                      handleDeleteRows();
                                    }}
                                    disabled={isDisabled || selectedRowKeys.length === 0}
                                    style={{ borderRadius: 6 }}
                                  >
                                    删除
                                  </Button>
                                  <Dropdown
                                    menu={{
                                      items: subtableFields.map((subField: any) => ({
                                        key: subField.fieldId,
                                        label: subField.label,
                                      })),
                                    }}
                                    trigger={["click"]}
                                  >
                                    <Button size="small" style={{ borderRadius: 6 }}>选择筛选字段</Button>
                                  </Dropdown>
                                </Space>
                              </div>
                            )}

                            {/* 表格（查看态：对标 subgrid DOM） */}
                            {isDisabled ? (
                              <div className="subgrid-control-adapter subgrid-title-400">
                                <div className="form-grid-view is-disabled is-scrolling-none control">
                                  <div className="subgrid">
                                    <div className="subgrid-toolbar">
                                      <ul className="subgrid-toolbar__more">
                                        <li>
                                          <FullscreenOutlined />
                                        </li>
                                        <li>
                                          <ColumnWidthOutlined />
                                        </li>
                                      </ul>
                                      <div style={{ display: "inline-block" }}>
                                        <Select
                                          size="small"
                                          style={{ width: 160 }}
                                          placeholder="选择筛选字段"
                                          options={subtableFields.map((sf: any) => ({
                                            label: sf.label,
                                            value: sf.fieldId,
                                          }))}
                                        />
                                      </div>
                                    </div>

                                    <div className="subgrid-sheet">
                                      <div className="subgrid-sheet__header subgrid-sheet__header__readonly">
                                        <div className="subgrid-sheet__col is-col-first">
                                          <div className="subgrid-col-main-title is-center">
                                            <span className="subgrid-sheet__col--number">序号</span>
                                          </div>
                                        </div>
                                        <div className="subgrid-sheet__cols">
                                          <div className="subgrid-sheet__row">
                                            {subtableFields.map((sf: any) => (
                                              <div key={sf.fieldId} className="subgrid-sheet__col">
                                                <div className="subgrid-col-main-title">
                                                  <span title={sf.label}>{sf.label}</span>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="subgrid-sheet__body">
                                        {(paginatedData || []).map((row: any, idx: number) => (
                                          <div
                                            key={String((row as any).__rowKey)}
                                            className="subgrid-sheet__row is-disabled"
                                          >
                                            <div className="subgrid-sheet__col is-col-first is-center">
                                              <span className="subgrid-sheet__col--number">
                                                {startIndex + idx + 1}
                                              </span>
                                            </div>
                                            <div className="subgrid-sheet__cols is-row-content">
                                              <div className="subgrid-sheet__row">
                                                {subtableFields.map((sf: any) => (
                                                  <div key={sf.fieldId} className="subgrid-sheet__col is-middle">
                                                    <div className="readonly">
                                                      {(() => {
                                                        const v = (row || {})[sf.fieldId];
                                                        if (v == null || v === "") return "-";
                                                        if (Array.isArray(v)) return `共 ${v.length} 项`;
                                                        if (typeof v === "object") return JSON.stringify(v);
                                                        return String(v);
                                                      })()}
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="subgrid-footer">
                                      <div className="subgrid-pagination">
                                        <Pagination
                                          size="small"
                                          current={currentPage}
                                          pageSize={pageSize}
                                          total={dataSource.length}
                                          showSizeChanger
                                          showQuickJumper
                                          onChange={(page, size) => {
                                            setCurrentPage(page);
                                            setPageSize(size);
                                          }}
                                          showTotal={(total) => `共${total}条`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : paginatedData.length > 0 ? (
                              <>
                                <div style={{ overflowX: "auto" }}>
                                  <Table
                                    dataSource={paginatedData}
                                    columns={columns}
                                    pagination={false}
                                    size={isDisabled ? "small" : "middle"}
                                    rowKey={(record) => String((record as any).__rowKey)}
                                    style={{ margin: 0 }}
                                    bordered={!isDisabled}
                                    tableLayout="fixed"
                                    scroll={{ x: "max-content" }}
                                  />
                                </div>
                                {/* 底部信息栏 */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "12px 16px",
                                    borderTop: "1px solid #f0f0f0",
                                    background: "#fff",
                                  }}
                                >
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    {isDisabled ? "" : `已选${selectedRowKeys.length}条`}
                                  </Typography.Text>
                                  <Space>
                                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                      共 {dataSource.length} 条
                                    </Typography.Text>
                                    <Pagination
                                      size="small"
                                      current={currentPage}
                                      pageSize={pageSize}
                                      total={dataSource.length}
                                      showSizeChanger
                                      showQuickJumper
                                      pageSizeOptions={["10", "20", "50", "100"]}
                                      onChange={(page, size) => {
                                        setCurrentPage(page);
                                        setPageSize(size);
                                        // 分页改变时，清除当前页的选中状态（保留其他页的选中状态）
                                        setSelectedRowKeys(selectedRowKeys.filter(key => key < startIndex || key >= endIndex));
                                      }}
                                      showTotal={(total) => `共 ${total} 条`}
                                    />
                                  </Space>
                                </div>
                              </>
                            ) : (
                              <div style={{ padding: 40, textAlign: "center" }}>
                                <Empty
                                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                                  description="暂无数据"
                                />
                              </div>
                            )}
                          </>
                        )}
                      </>
                    ) : (
                      <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
                        <Typography.Text type="secondary">
                          请在属性面板中配置子表字段
                        </Typography.Text>
                      </div>
                    )}
                  </div>
                </Form.Item>
              );
            }}
          />
        );

      case "formula": {
        const calculateFormula = () => {
          if (!field.formulaExpression) return "";
          try {
            const result = evaluateFormulaExpression(
              field.formulaExpression,
              formValues as Record<string, unknown>,
              formSchema
            );
            // 公式字段可能返回文本（如 CONCATENATE），不要强制按数字格式化
            return stringifyFormulaResult(result, false);
          } catch (error) {
            console.error("公式计算错误:", error);
            return "";
          }
        };

        const formulaValue = calculateFormula();

        return (
          <Controller
            name={field.fieldId}
            control={control}
            render={({ field: formField }) => (
              <Form.Item label={field.label}>
                <Input
                  {...formField}
                  disabled
                  placeholder="公式计算结果"
                  value={formulaValue}
                  onChange={() => {}} // 公式字段不可手动编辑
                />
              </Form.Item>
            )}
          />
        );
      }

      case "serial":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            render={({ field: formField }) => (
              <Form.Item label={field.label} help="系统自动生成">
                <Input
                  value={formField.value || ""}
                  disabled
                  placeholder="系统自动生成"
                />
              </Form.Item>
            )}
          />
        );

      case "creator":
      case "owner":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            render={({ field: formField }) => (
              <Form.Item
                label={field.label}
                help="系统自动生成"
              >
                <Input
                  value={user?.name || user?.account || ""}
                  disabled
                  prefix={<UserOutlined />}
                  placeholder="系统自动生成"
                />
              </Form.Item>
            )}
          />
        );

      case "createTime":
      case "updateTime":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            render={({ field: formField }) => (
              <Form.Item
                label={field.label}
                help="系统自动生成"
              >
                <Input
                  value={formField.value || dayjs().format("YYYY-MM-DD HH:mm:ss")}
                  disabled
                  placeholder="系统自动生成"
                />
              </Form.Item>
            )}
          />
        );

      case "relatedForm":
      case "relatedFormMulti": {
        const RelatedFormField = () => {
          const [selectorVisible, setSelectorVisible] = useState(false);
          const multiple = field.type === "relatedFormMulti";
            const extractRecordId = (raw: any): string | undefined => {
              if (raw == null) return undefined;
              if (typeof raw === "string" || typeof raw === "number") {
                const s = String(raw).trim();
                return s ? s : undefined;
              }
              if (typeof raw === "object") {
                const v =
                  (raw as any).recordId ??
                  (raw as any).id ??
                  (raw as any).value ??
                  (raw as any).record_id;
                if (v == null) return undefined;
                const s = String(v).trim();
                return s ? s : undefined;
              }
              return undefined;
            };
            const extractRecordIds = (raw: any): string[] => {
              if (Array.isArray(raw)) {
                return raw
                  .map((item) => extractRecordId(item))
                  .filter((id): id is string => !!id);
              }
              const one = extractRecordId(raw);
              return one ? [one] : [];
            };

          // 获取关联表单的定义
          const { data: relatedFormDefinition } = useQuery({
            queryKey: ["formDefinition", field.relatedFormId],
            queryFn: () => formDefinitionApi.getById(field.relatedFormId!),
            enabled: !!field.relatedFormId,
          });

          // 获取已选中的记录数据（用于显示）
          const currentValue = control._formValues?.[field.fieldId];
          const selectedRecordIds = extractRecordIds(currentValue);
          const selectedRecordId = Array.isArray(selectedRecordIds)
            ? selectedRecordIds[0]
            : selectedRecordIds;
          
          const { data: selectedRecord } = useQuery({
            queryKey: ["formData", selectedRecordId],
            queryFn: () => formDataApi.getById(selectedRecordId!),
            enabled: !!selectedRecordId && !multiple,
          });

          const handleSelect = (record: FormDataResponse | FormDataResponse[]) => {
            if (multiple) {
              const records = record as FormDataResponse[];
              const recordIds = records.map((r) => r.recordId);
              setValue(field.fieldId, recordIds);
              
              // 执行字段映射填充
              if (field.fieldMapping && formSchema) {
                records.forEach((selectedRecord) => {
                  Object.entries(field.fieldMapping || {}).forEach(([relatedFieldId, currentFieldId]) => {
                    const value = selectedRecord.data[relatedFieldId];
                    if (value !== undefined && currentFieldId) {
                      setValue(currentFieldId, value);
                    }
                  });
                });
              }
              message.success(`已选择 ${records.length} 条记录`);
            } else {
              const singleRecord = record as FormDataResponse;
              setValue(field.fieldId, singleRecord.recordId);
              
              // 执行字段映射填充
              if (field.fieldMapping && formSchema && singleRecord.data) {
                Object.entries(field.fieldMapping).forEach(([relatedFieldId, currentFieldId]) => {
                  const value = singleRecord.data[relatedFieldId];
                  if (value !== undefined && currentFieldId) {
                    setValue(currentFieldId, value);
                  }
                });
              }
              message.success("已选择关联表单数据");
            }
          };

          const handleFieldMapping = (mapping: Record<string, string>) => {
            // 字段映射回调（在配置面板中使用）
            // 这里主要用于显示映射信息
          };

          // 生成显示文本
          const getDisplayText = () => {
            // 如果当前值为空，直接返回占位文本（避免使用缓存的 selectedRecord）
            if (
              !selectedRecordIds ||
              (Array.isArray(selectedRecordIds) && selectedRecordIds.length === 0)
            ) {
              return multiple
                ? field.placeholder || "请选择"
                : field.placeholder || "请选择";
            }

            if (multiple) {
              const ids = selectedRecordIds as string[] | undefined;
              if (ids && ids.length > 0) {
                return `已选择 ${ids.length} 条记录`;
              }
              return field.placeholder || "请选择";
            } else {
              // 如果没有选中的记录ID，返回占位文本
              if (!selectedRecordId) {
                return field.placeholder || "请选择";
              }

              if (selectedRecord) {
                // 优先使用配置的显示字段，否则使用第一列
                const displayFieldId = (field as any).relatedDisplayField as
                  | string
                  | undefined;

                // 从 config.fields 和 config.elements.children 里都找一遍显示字段
                const cfg: any = relatedFormDefinition?.config || {};
                const directFields = cfg.fields || [];
                const elements = cfg.elements || [];
                let displayField =
                  directFields.find((f: any) => f.fieldId === displayFieldId) ||
                  undefined;
                if (!displayField && elements.length) {
                  elements.forEach((el: any) => {
                    if (displayField) return;
                    if (el && "children" in el && Array.isArray(el.children)) {
                      const found = el.children.find(
                        (child: any) => child.fieldId === displayFieldId
                      );
                      if (found) {
                        displayField = found;
                      }
                    }
                  });
                }
                if (!displayField) {
                  displayField = directFields[0];
                }

                if (displayField) {
                  const previewValue = (selectedRecord.data || {})[
                    displayField.fieldId
                  ];

                  if (previewValue === null || previewValue === undefined) {
                    return selectedRecord.recordId;
                  }

                  // 子表 / 数组字段：避免 [object Object]
                  if (Array.isArray(previewValue)) {
                    // 简单统计行数
                    return `明细共 ${previewValue.length} 行`;
                  }

                  if (typeof previewValue === "object") {
                    const str = JSON.stringify(previewValue);
                    return str.length > 50
                      ? `${str.slice(0, 50)}...`
                      : str;
                  }

                  return String(previewValue);
                }
                return selectedRecord.recordId;
              }
              // 兜底：详情查询失败/未返回时，至少显示已选ID，避免误判为未选择
              return String(selectedRecordId);
            }
          };

          return (
            <>
              <Controller
                name={field.fieldId}
                control={control}
                rules={{
                  required: field.required ? `${field.label}是必填项` : false,
                }}
                render={({ field: formField, fieldState }) => (
                  <Form.Item
                    label={field.label}
                    required={field.required}
                    validateStatus={fieldState.error ? "error" : ""}
                    help={fieldState.error?.message || (field.relatedFormId ? "请选择关联的表单数据" : "请先在属性面板中配置关联表单")}
                  >
                    <Input
                      {...formField}
                      value={getDisplayText()}
                      placeholder={field.placeholder || "请选择"}
                      disabled={isDisabled || !field.relatedFormId}
                      readOnly
                      suffix={
                        <Space size={2}>
                          <Button
                            type="text"
                            icon={<FileTextOutlined />}
                            size="small"
                            style={{
                              color: "#8c8c8c",
                              paddingInline: 4,
                              minWidth: 24,
                              height: 24,
                            }}
                            onClick={() => {
                              if (!field.relatedFormId) {
                                message.warning("请先在属性面板中配置关联表单");
                                return;
                              }
                              setSelectorVisible(true);
                            }}
                            disabled={isDisabled || !field.relatedFormId}
                          />
                        </Space>
                      }
                    />
                    {selectedRecord && !multiple && (
                      <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
                        <Tag color="blue">已关联: {relatedFormDefinition?.formName}</Tag>
                      </div>
                    )}
                  </Form.Item>
                )}
              />
              {field.relatedFormId && (
                <RelatedFormSelector
                  open={selectorVisible}
                  onClose={() => setSelectorVisible(false)}
                  onSelect={handleSelect}
                  relatedFormId={field.relatedFormId}
                  multiple={multiple}
                  currentFormSchema={formSchema}
                  onFieldMapping={handleFieldMapping}
                  dataFilterEnabled={field.enableDataFilter === true}
                  dataFilterConditions={field.relatedDataFilterConditions}
                  runtimeFormValues={formValues as Record<string, unknown>}
                />
              )}
            </>
          );
        };
        
        return <RelatedFormField />;
      }

      case "button":
        return (
          <Form.Item label={field.label}>
            <Button
              type="primary"
              disabled={isDisabled}
              onClick={() => {
                // TODO: 执行按钮操作
                console.log("按钮点击", field.fieldId);
              }}
            >
              {field.label}
            </Button>
          </Form.Item>
        );

      case "signature":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <SignaturePad
                  value={typeof formField.value === "string" ? formField.value : undefined}
                  onChange={(next) => formField.onChange(next)}
                  disabled={isDisabled}
                  placeholder="手写签名添加签名"
                />
              </Form.Item>
            )}
          />
        );

      case "aiRecognition":
        return (
          <Controller
            name={field.fieldId}
            control={control}
            rules={{
              required: field.required ? `${field.label}是必填项` : false,
            }}
            render={({ field: formField, fieldState }) => (
              <Form.Item
                label={field.label}
                required={field.required}
                validateStatus={fieldState.error ? "error" : ""}
                help={fieldState.error?.message}
              >
                <Space style={{ width: "100%", display: "flex", flexDirection: "column" }}>
                  <Input
                    {...formField}
                    placeholder="AI识别结果将显示在这里"
                    disabled={isDisabled}
                  />
                  <Button
                    disabled={isDisabled}
                    onClick={() => {
                      // TODO: 调用AI识别接口
                      console.log("调用AI识别");
                    }}
                  >
                    AI识别
                  </Button>
                </Space>
              </Form.Item>
            )}
          />
        );

      default:
        return (
          <Form.Item label={field.label}>
            <Input disabled placeholder="暂不支持此字段类型" />
          </Form.Item>
        );
    }
  };

  if (!field.visible) {
    return null;
  }

  return renderField();
};

