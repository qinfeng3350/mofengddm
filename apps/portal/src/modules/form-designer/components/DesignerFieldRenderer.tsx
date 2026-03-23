import { memo, useMemo, useCallback } from "react";
import { Form, Input, InputNumber, DatePicker, Select, Radio, Checkbox, Upload, Button, Table, Space, Typography } from "antd";
import {
  UploadOutlined,
  UserOutlined,
  ApartmentOutlined,
  DeleteOutlined,
  CopyOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import type { FormFieldSchema } from "@mofeng/shared-schema";
import { UserSelector } from "@/components/UserSelector";
import { DepartmentSelector } from "@/components/DepartmentSelector";
import { LocationField } from "@/components/LocationField";
import { AddressField } from "@/components/AddressField";
import { useAuthStore } from "@/store/useAuthStore";
import { useFormDesignerStore } from "../store/useFormDesignerStore";

interface DesignerFieldRendererProps {
  field: FormFieldSchema;
  isSelected?: boolean;
}

// 字段容器组件 - 提取公共样式和操作按钮
const FieldContainer = memo(({ 
  field, 
  isSelected, 
  children,
  onSelect,
  onDelete,
  onCopy,
}: { 
  field: FormFieldSchema; 
  isSelected: boolean; 
  children: React.ReactNode;
  onSelect: () => void;
  onDelete: () => void;
  onCopy?: () => void;
}) => {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: "8px 10px",
        border: isSelected ? "1px solid #1890ff" : "1px solid #e8e8e8",
        borderRadius: 4,
        backgroundColor: isSelected ? "#f0f7ff" : "#fafafa",
        position: "relative",
        cursor: "pointer",
        transition: "all 0.15s ease",
        marginBottom: 6,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "#d9d9d9";
          e.currentTarget.style.backgroundColor = "#f5f5f5";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = "#e8e8e8";
          e.currentTarget.style.backgroundColor = "#fafafa";
        }
      }}
    >
      <div style={{ marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <Typography.Text style={{ fontSize: 13, color: "#262626", fontWeight: 400 }}>
            {field.label}
          </Typography.Text>
          {field.required && <Typography.Text type="danger" style={{ marginLeft: 4 }}>*</Typography.Text>}
        </div>
        {isSelected && (
          <Space size={0}>
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onCopy?.();
              }}
              style={{ 
                padding: "2px 4px",
                height: "auto",
                minWidth: "auto",
                color: "#595959",
                fontSize: 12
              }}
            />
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{ 
                padding: "2px 4px",
                height: "auto",
                minWidth: "auto",
                fontSize: 12
              }}
            />
          </Space>
        )}
      </div>
      {children}
    </div>
  );
});

FieldContainer.displayName = "FieldContainer";

export const DesignerFieldRenderer = memo(({ field, isSelected }: DesignerFieldRendererProps) => {
  const { user } = useAuthStore();
  const selectField = useFormDesignerStore((state) => state.selectField);
  const removeField = useFormDesignerStore((state) => state.removeField);
  const duplicateField = useFormDesignerStore((state) => state.duplicateField);
  const status = field.status || "normal";
  const isHidden = status === "hidden" || field.visible === false;
  const isDisabled = status === "disabled" || field.editable === false;
  const isReadOnly = status === "readonly" || status === "disabled" || field.editable === false;

  const handleSelect = useCallback(() => {
    selectField(field.fieldId);
  }, [selectField, field.fieldId]);

  const handleDelete = useCallback(() => {
    removeField(field.fieldId);
  }, [removeField, field.fieldId]);

  const renderField = useMemo(() => {
    switch (field.type) {
      case "input":
        if (field.label === "位置" || field.advanced?.fieldType === "location") {
          return (
            <LocationField
              value={undefined}
              onChange={() => {}}
              placeholder={field.placeholder || "获取地理位置"}
              disabled={isDisabled}
              readOnly
            />
          );
        }
        if (field.label === "地址" || field.advanced?.fieldType === "address") {
          return (
            <AddressField
              value={undefined}
              onChange={() => {}}
              placeholder="请选择省市区县"
              disabled={isDisabled}
              readOnly
            />
          );
        }
        return (
          <Input
            placeholder={field.placeholder || "请输入"}
            disabled={isDisabled}
            readOnly={isReadOnly}
            style={{ border: "none", background: "transparent", padding: 0, boxShadow: "none" }}
          />
        );

      case "textarea":
        return (
          <Input.TextArea
            placeholder={field.placeholder || "请输入"}
            disabled={isDisabled}
            readOnly={isReadOnly}
            rows={field.advanced?.rows || 4}
            style={{ border: "none", background: "transparent", padding: 0, boxShadow: "none" }}
          />
        );

      case "number":
        return (
          <InputNumber
            placeholder={field.placeholder || "请输入"}
            disabled={isDisabled}
            style={{ width: "100%", border: "none", background: "transparent" }}
            controls={false}
          />
        );

      case "date":
        const dateFormat = (field.advanced?.dateFormat as string) || "YYYY-MM-DD";
        return (
          <DatePicker
            format={dateFormat}
            placeholder={field.placeholder || dateFormat.replace(/Y/g, "年").replace(/M/g, "月").replace(/D/g, "日")}
            disabled={isDisabled}
            style={{ width: "100%" }}
          />
        );

      case "datetime":
        const dateTimeFormat = (field.advanced?.dateFormat as string) || "YYYY-MM-DD HH:mm:ss";
        return (
          <DatePicker
            showTime
            format={dateTimeFormat}
            placeholder={field.placeholder || dateTimeFormat}
            disabled={isDisabled}
            style={{ width: "100%" }}
          />
        );

      case "select":
        return (
          <Select
            placeholder={field.placeholder || "请选择"}
            disabled={isDisabled}
            style={{ width: "100%" }}
            options={field.options?.map((opt) => ({
              label: opt.label,
              value: String(opt.value),
            }))}
          />
        );

      case "radio":
        return (
          <Radio.Group
            disabled={isDisabled}
            options={field.options?.map((opt) => ({
              label: opt.label,
              value: String(opt.value),
            }))}
          />
        );

      case "checkbox":
        return (
          <Checkbox.Group
            disabled={isDisabled}
            options={field.options?.map((opt) => ({
              label: opt.label,
              value: String(opt.value),
            }))}
          />
        );

      case "multiselect":
        return (
          <Select
            mode="multiple"
            placeholder={field.placeholder || "请选择"}
            disabled={isDisabled}
            style={{ width: "100%" }}
            options={field.options?.map((opt) => ({
              label: opt.label,
              value: String(opt.value),
            }))}
          />
        );

      case "user":
        const isMultiple = field.advanced?.multiple === true;
        if (field.isSystemField && (field.systemFieldType === "creator" || field.systemFieldType === "owner")) {
          return (
            <>
              <Input
                value={user?.name || user?.account || ""}
                disabled
                prefix={<UserOutlined />}
                placeholder="系统自动生成"
                style={{ border: "none", background: "transparent", padding: 0, boxShadow: "none" }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                系统自动生成
              </Typography.Text>
            </>
          );
        }
        return (
          <UserSelector
            value={undefined}
            onChange={() => {}}
            multiple={isMultiple}
            disabled={isDisabled}
            placeholder={field.placeholder || "请选择人员"}
          />
        );

      case "department":
        const isDeptMultiple = field.advanced?.multiple === true;
        if (field.isSystemField && field.systemFieldType === "department") {
          return (
            <>
              <Input
                value=""
                disabled
                prefix={<ApartmentOutlined />}
                placeholder="系统自动生成"
                style={{ border: "none", background: "transparent", padding: 0, boxShadow: "none" }}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                系统自动生成
              </Typography.Text>
            </>
          );
        }
        return (
          <DepartmentSelector
            value={undefined}
            onChange={() => {}}
            multiple={isDeptMultiple}
            disabled={isDisabled}
            placeholder={field.placeholder || "请选择部门"}
          />
        );

      case "attachment":
        return (
          <Upload disabled={isDisabled} beforeUpload={() => false}>
            <Button icon={<UploadOutlined />} disabled={isDisabled} size="small">
              选择文件
            </Button>
          </Upload>
        );

      case "subtable":
        const subtableFields = (field as any).subtableFields || [];
        const columns = subtableFields.map((subField: any) => ({
          title: subField.label,
          dataIndex: subField.fieldId,
          key: subField.fieldId,
          render: () => <Input placeholder="请输入" disabled size="small" />,
        }));
        columns.unshift({
          title: "序号",
          dataIndex: "index",
          key: "index",
          width: 60,
          render: (_: any, __: any, index: number) => index + 1,
        });
        return (
          <div style={{ border: "1px solid #f0f0f0", borderRadius: 4 }}>
            <Table
              columns={columns}
              dataSource={[{ key: "1" }]}
              pagination={false}
              size="small"
              scroll={{ x: "max-content" }}
              footer={() => (
                <Button type="dashed" block icon={<PlusOutlined />} disabled size="small" style={{ margin: 0 }}>
                  添加行
                </Button>
              )}
            />
          </div>
        );

      case "serial":
        // 生成流水号预览
        const serialConfig = (field as any).advanced?.serialConfig;
        const serialRules = serialConfig?.rules || [];
        let serialPreview = "";
        if (serialRules.length > 0) {
          serialRules.forEach((rule: any) => {
            switch (rule.type) {
              case "autoCount":
                const digits = rule.config?.digits || 4;
                serialPreview += "0".repeat(digits - 1) + "1";
                break;
              case "fixedText":
                serialPreview += rule.config?.text || "";
                break;
              case "date":
                serialPreview += new Date().toISOString().split("T")[0].replace(/-/g, "");
                break;
              case "year":
                serialPreview += new Date().getFullYear().toString();
                break;
              case "month":
                serialPreview += String(new Date().getMonth() + 1).padStart(2, "0");
                break;
              case "day":
                serialPreview += String(new Date().getDate()).padStart(2, "0");
                break;
            }
          });
        }
        return (
          <>
            <Input
              value={serialPreview || "系统自动生成"}
              placeholder="系统自动生成"
              disabled
              style={{ border: "none", background: "transparent", padding: 0, boxShadow: "none", color: serialPreview ? "#1890ff" : undefined }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
              {serialPreview ? "流水号预览" : "系统自动生成"}
            </Typography.Text>
          </>
        );
      case "createTime":
      case "updateTime":
        return (
          <>
            <Input
              placeholder="系统自动生成"
              disabled
              style={{ border: "none", background: "transparent", padding: 0, boxShadow: "none" }}
            />
            <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
              系统自动生成
            </Typography.Text>
          </>
        );

      case "formula":
        return (
          <Input
            placeholder="公式计算结果"
            disabled
            style={{ border: "none", background: "transparent", padding: 0, boxShadow: "none" }}
          />
        );

      default:
        return <Input placeholder="暂不支持此字段类型" disabled style={{ border: "none", background: "transparent", padding: 0, boxShadow: "none" }} />;
    }
  }, [field, isDisabled, isReadOnly, user]);

  if (isHidden) {
    return null;
  }

  return (
    <FieldContainer
      field={field}
      isSelected={isSelected || false}
      onSelect={handleSelect}
      onDelete={handleDelete}
      onCopy={() => duplicateField(field.fieldId)}
    >
      {renderField}
    </FieldContainer>
  );
});

DesignerFieldRenderer.displayName = "DesignerFieldRenderer";
