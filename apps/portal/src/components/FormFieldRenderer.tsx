import React, { useEffect, useMemo, useState } from "react";
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
  LinkOutlined,
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
                <InputNumber
                  {...formField}
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  style={{ width: "100%" }}
                  precision={field.validation?.precision}
                />
              </Form.Item>
            )}
          />
        );

      case "date":
        const dateFormat = (field.advanced?.dateFormat as string) || "YYYY-MM-DD";
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
                  options={field.options?.map((opt) => ({
                    label: opt.label,
                    value: String(opt.value),
                  }))}
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
                  options={field.options?.map((opt) => ({
                    label: opt.label,
                    value: String(opt.value),
                  }))}
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
                  options={field.options?.map((opt) => ({
                    label: opt.label,
                    value: String(opt.value),
                  }))}
                />
              </Form.Item>
            )}
          />
        );

      case "datetime":
        const dateTimeFormat = (field.advanced?.dateFormat as string) || "YYYY-MM-DD HH:mm:ss";
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
                  showTime
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
                  options={field.options?.map((opt) => ({
                    label: opt.label,
                    value: String(opt.value),
                  }))}
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
            }}
            render={({ field: formField, fieldState }) => {
              const subtableFields = (field as any).subtableFields || [];
              const dataSource = formField.value || [];
              const [expanded, setExpanded] = useState(true);
              const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
              const [currentPage, setCurrentPage] = useState(1);
              const [pageSize, setPageSize] = useState(10);
              
              // 分页数据
              const startIndex = (currentPage - 1) * pageSize;
              const endIndex = startIndex + pageSize;
              const paginatedData = dataSource.slice(startIndex, endIndex);
              
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
                onChange: (val: any, extra?: Record<string, unknown>) => void;
                subField: any;
                disabled?: boolean;
                currentRow?: Record<string, unknown>;
              }> = ({ value, onChange, subField, disabled, currentRow }) => {
                const [selectorVisible, setSelectorVisible] = useState(false);
                const multiple = subField.type === "relatedFormMulti";

                // 获取关联表单定义
                const { data: relatedFormDefinition } = useQuery({
                  queryKey: ["formDefinition", subField.relatedFormId],
                  queryFn: () => formDefinitionApi.getById(subField.relatedFormId!),
                  enabled: !!subField.relatedFormId,
                });

                // 已选记录（单选）
                const selectedRecordId = !multiple && typeof value === "string" ? value : undefined;
                const selectedIds = multiple && Array.isArray(value) ? value : [];

                const { data: selectedRecord } = useQuery({
                  queryKey: ["formData", selectedRecordId],
                  queryFn: () => formDataApi.getById(selectedRecordId!),
                  enabled: !!selectedRecordId && !multiple,
                });

                const displayText = useMemo(() => {
                  if (multiple) {
                    if (!selectedIds || selectedIds.length === 0) {
                      return subField.placeholder || "点击选择关联表单数据（可多选）";
                    }
                    return `已选择 ${selectedIds.length} 条记录`;
                  }
                  if (!selectedRecordId) {
                    return subField.placeholder || "点击选择关联表单数据";
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
                  return subField.placeholder || "点击选择关联表单数据";
                }, [multiple, selectedIds, selectedRecordId, selectedRecord, subField, relatedFormDefinition]);

                const handleSelect = (record: FormDataResponse | FormDataResponse[]) => {
                  if (multiple) {
                    const records = record as FormDataResponse[];
                    const recordIds = records.map((r) => r.recordId);
                    const updates: Record<string, unknown> = {};

                    if (subField.fieldMapping) {
                      records.forEach((r) => {
                        Object.entries(subField.fieldMapping || {}).forEach(([relatedFieldId, currentFieldId]) => {
                          const val = (r.data || {})[relatedFieldId];
                          if (val !== undefined && currentFieldId) {
                            updates[currentFieldId] = val;
                          }
                        });
                      });
                    }

                    onChange(recordIds, updates);
                    message.success(`已选择 ${records.length} 条记录`);
                  } else {
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
                      placeholder={subField.placeholder || "点击选择关联表单数据"}
                      disabled={disabled || !subField.relatedFormId}
                      readOnly
                      size="small"
                      suffix={
                        <Button
                          type="link"
                          size="small"
                          icon={<LinkOutlined />}
                          onClick={() => {
                            if (!subField.relatedFormId) {
                              message.warning("请先配置关联表单");
                              return;
                            }
                            setSelectorVisible(true);
                          }}
                          disabled={disabled || !subField.relatedFormId}
                        >
                          选择
                        </Button>
                      }
                    />
                    {subField.relatedFormId && (
                      <RelatedFormSelector
                        open={selectorVisible}
                        onClose={() => setSelectorVisible(false)}
                        onSelect={handleSelect}
                        relatedFormId={subField.relatedFormId}
                        multiple={multiple}
                        currentFormSchema={formSchema}
                      />
                    )}
                  </>
                );
              };

              const columns = [
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
                {
                  title: "",
                  key: "index",
                  width: 60,
                  render: (_: any, record: any, index: number) => {
                    return startIndex + index + 1;
                  },
                },
                ...subtableFields.map((subField: any) => ({
                  title: subField.label,
                  dataIndex: subField.fieldId,
                  key: subField.fieldId,
                  render: (text: any, record: any, index: number) => {
                    switch (subField.type) {
                      case "input":
                        return (
                          <Input
                            value={text || ""}
                            onChange={(e) => handleCellChange(e.target.value, index, subField.fieldId)}
                            placeholder="请输入"
                            size="small"
                            disabled={isDisabled}
                          />
                        );
                      case "textarea":
                        return (
                          <Input.TextArea
                            value={text || ""}
                            onChange={(e) => handleCellChange(e.target.value, index, subField.fieldId)}
                            placeholder="请输入"
                            rows={2}
                            disabled={isDisabled}
                          />
                        );
                      case "number":
                        return (
                          <InputNumber
                            value={text}
                            onChange={(value) => handleCellChange(value, index, subField.fieldId)}
                            placeholder="请输入"
                            size="small"
                            style={{ width: "100%" }}
                            disabled={isDisabled}
                          />
                        );
                      case "date":
                        return (
                          <DatePicker
                            value={text ? dayjs(text) : null}
                            onChange={(date) => handleCellChange(date ? date.format("YYYY-MM-DD") : null, index, subField.fieldId)}
                            placeholder="年-月-日"
                            size="small"
                            style={{ width: "100%" }}
                            disabled={isDisabled}
                          />
                        );
                      case "select":
                        return (
                          <Select
                            value={text}
                            onChange={(value) => handleCellChange(value, index, subField.fieldId)}
                            placeholder="请选择"
                            size="small"
                            style={{ width: "100%" }}
                            disabled={isDisabled}
                            options={subField.options?.map((opt: any) => ({
                              label: opt.label,
                              value: String(opt.value),
                            }))}
                          />
                        );
                      case "radio":
                        return (
                          <Radio.Group
                            value={text}
                            onChange={(e) => handleCellChange(e.target.value, index, subField.fieldId)}
                            disabled={isDisabled}
                          >
                            {subField.options?.map((opt: any) => (
                              <Radio key={opt.value} value={String(opt.value)}>
                                {opt.label}
                              </Radio>
                            ))}
                          </Radio.Group>
                        );
                      case "formula": {
                        const actualIndex = startIndex + index;
                        const expression = subField.formulaExpression as string | undefined;
                        const deps: string[] = subField.formulaDependencies || [];

                        const calculate = () => {
                          if (!expression) return "";
                          let expr = expression;
                          deps.forEach((depFieldId: string) => {
                            const value = record[depFieldId];
                            const numValue =
                              typeof value === "number" ? value : parseFloat(String(value ?? 0));
                            expr = expr.replace(
                              new RegExp(`\\{${depFieldId}\\}`, "g"),
                              isNaN(numValue) ? "0" : String(numValue)
                            );
                          });
                          try {
                            // eslint-disable-next-line no-eval
                            const result = eval(expr);
                            return isNaN(result) ? "" : String(result);
                          } catch (e) {
                            console.error("子表公式计算错误:", e);
                            return "";
                          }
                        };

                        const formulaValue = calculate();

                        // 把计算结果写回当前行，确保提交时有值
                        if (record[subField.fieldId] !== formulaValue) {
                          const newData = [...dataSource];
                          if (!newData[actualIndex]) newData[actualIndex] = {};
                          newData[actualIndex] = {
                            ...newData[actualIndex],
                            [subField.fieldId]: formulaValue,
                          };
                          formField.onChange(newData);
                        }

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
                            value={text}
                            subField={subField}
                            disabled={isDisabled}
                            currentRow={currentRow}
                            onChange={(val, extraUpdates) => {
                              const newData = [...dataSource];
                              if (!newData[actualIndex]) newData[actualIndex] = {};
                              newData[actualIndex][subField.fieldId] = val;
                              if (extraUpdates && typeof extraUpdates === "object") {
                                Object.entries(extraUpdates).forEach(([k, v]) => {
                                  newData[actualIndex][k] = v;
                                });
                              }
                              formField.onChange(newData);
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
                          const urls = extractAttachmentPreviewUrls(text);
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
                              value={text}
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
                            value={text || ""}
                            onChange={(e) => handleCellChange(e.target.value, index, subField.fieldId)}
                            placeholder="请输入"
                            size="small"
                            disabled={isDisabled}
                          />
                        );
                    }
                  },
                })),
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
              ];

              return (
                <Form.Item
                  required={field.required}
                  validateStatus={fieldState.error ? "error" : ""}
                  help={fieldState.error?.message}
                  style={{ marginBottom: 24 }}
                >
                  <div style={{ border: "1px solid #d9d9d9", borderRadius: 4, background: "#fff", overflow: "hidden" }}>
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
                            background: "#fafafa",
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
                            {/* 操作按钮栏 */}
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "12px 16px",
                                borderBottom: "1px solid #f0f0f0",
                              }}
                            >
                              <Space>
                                <Button
                                  type="primary"
                                  size="small"
                                  icon={<PlusOutlined />}
                                  onClick={handleAddRow}
                                >
                                  新增
                                </Button>
                                <Button
                                  size="small"
                                  icon={<DownloadOutlined />}
                                  onClick={handleImport}
                                >
                                  导入
                                </Button>
                                <Button
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={handleDeleteRows}
                                  disabled={selectedRowKeys.length === 0}
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
                                  <Button size="small">选择筛选字段</Button>
                                </Dropdown>
                              </Space>
                            </div>

                            {/* 表格 */}
                            {paginatedData.length > 0 ? (
                              <>
                                <div style={{ overflowX: "auto" }}>
                                  <Table
                                    dataSource={paginatedData}
                                    columns={columns}
                                    pagination={false}
                                    size="small"
                                    rowKey={(_, index) => `row-${startIndex + index}`}
                                    style={{ margin: 0 }}
                                    bordered={false}
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
                                    background: "#fafafa",
                                  }}
                                >
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                    已选{selectedRowKeys.length}条
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

      case "formula":
        // 计算公式值
        const calculateFormula = () => {
          if (!field.formulaExpression) return "";
          
          try {
            let expression = field.formulaExpression;
            // 替换字段引用 {fieldId} 为实际值
            const dependencies = field.formulaDependencies || [];
            dependencies.forEach((depFieldId: string) => {
              const value = formValues[depFieldId];
              const numValue = typeof value === 'number' ? value : parseFloat(String(value || 0));
              expression = expression.replace(
                new RegExp(`\\{${depFieldId}\\}`, 'g'),
                isNaN(numValue) ? '0' : String(numValue)
              );
            });
            
            // 安全计算表达式（仅支持基本数学运算）
            // eslint-disable-next-line no-eval
            const result = eval(expression);
            return isNaN(result) ? "" : String(result);
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

          // 获取关联表单的定义
          const { data: relatedFormDefinition } = useQuery({
            queryKey: ["formDefinition", field.relatedFormId],
            queryFn: () => formDefinitionApi.getById(field.relatedFormId!),
            enabled: !!field.relatedFormId,
          });

          // 获取已选中的记录数据（用于显示）
          const currentValue = control._formValues?.[field.fieldId];
          const selectedRecordIds = currentValue as string | string[] | undefined;
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
                ? field.placeholder || "点击选择关联表单数据（可多选）"
                : field.placeholder || "点击选择关联表单数据";
            }

            if (multiple) {
              const ids = selectedRecordIds as string[] | undefined;
              if (ids && ids.length > 0) {
                return `已选择 ${ids.length} 条记录`;
              }
              return field.placeholder || "点击选择关联表单数据（可多选）";
            } else {
              // 如果没有选中的记录ID，返回占位文本
              if (!selectedRecordId) {
                return field.placeholder || "点击选择关联表单数据";
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
              return field.placeholder || "点击选择关联表单数据";
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
                      placeholder={field.placeholder || "点击选择关联表单数据"}
                      disabled={isDisabled || !field.relatedFormId}
                      readOnly
                      suffix={
                        <Space size={4}>
                          {currentValue && !multiple && (
                            <Button
                              type="link"
                              size="small"
                              onClick={() => {
                                // 清空已选
                                setValue(field.fieldId, undefined);
                              }}
                              disabled={isDisabled}
                            >
                              清空
                            </Button>
                          )}
                          <Button
                            type="link"
                            icon={<LinkOutlined />}
                            size="small"
                            onClick={() => {
                              if (!field.relatedFormId) {
                                message.warning("请先在属性面板中配置关联表单");
                                return;
                              }
                              setSelectorVisible(true);
                            }}
                            disabled={isDisabled || !field.relatedFormId}
                          >
                            选择
                          </Button>
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
                <div
                  style={{
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    minHeight: 150,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    background: isDisabled ? "#f5f5f5" : "#fff",
                  }}
                  onClick={() => {
                    if (!isDisabled) {
                      // TODO: 打开手写签名画板
                      console.log("打开手写签名画板");
                    }
                  }}
                >
                  {formField.value ? (
                    <img src={formField.value} alt="签名" style={{ maxWidth: "100%", maxHeight: 150 }} />
                  ) : (
                    <Typography.Text type="secondary">点击进行手写签名</Typography.Text>
                  )}
                </div>
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
                <Space direction="vertical" style={{ width: "100%" }}>
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

