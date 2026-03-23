import { Controller, Control } from "react-hook-form";
import { Input, InputNumber, DatePicker, Select, Radio, Checkbox, Form } from "antd";
import type { FormFieldSchema, FieldTypeEnum } from "@mofeng/shared-schema";
import dayjs from "dayjs";

interface FormFieldRendererProps {
  field: FormFieldSchema;
  control: Control;
  disabled?: boolean;
}

export const FormFieldRenderer = ({ field, control, disabled }: FormFieldRendererProps) => {
  const isDisabled = disabled || !field.editable;

  const renderField = () => {
    switch (field.type) {
      case FieldTypeEnum.Enum.input:
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

      case FieldTypeEnum.Enum.textarea:
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
                  rows={4}
                />
              </Form.Item>
            )}
          />
        );

      case FieldTypeEnum.Enum.number:
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

      case FieldTypeEnum.Enum.date:
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
                  value={formField.value ? dayjs(formField.value) : undefined}
                  onChange={(date) => formField.onChange(date ? date.format("YYYY-MM-DD") : null)}
                  placeholder={field.placeholder}
                  disabled={isDisabled}
                  style={{ width: "100%" }}
                />
              </Form.Item>
            )}
          />
        );

      case FieldTypeEnum.Enum.select:
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

      case FieldTypeEnum.Enum.radio:
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

      case FieldTypeEnum.Enum.checkbox:
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

