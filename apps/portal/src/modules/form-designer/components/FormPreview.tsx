import { useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { Form as AntForm, Button, Space } from "antd";
import { FormFieldRenderer } from "@/components/FormFieldRenderer";
import { RuntimeContainerRenderer } from "@/components/RuntimeContainerRenderer";
import type { FormSchemaType, FormFieldSchema, LayoutContainerSchemaType } from "@mofeng/shared-schema";

interface FormPreviewProps {
  formSchema: FormSchemaType;
}

export const FormPreview = ({ formSchema }: FormPreviewProps) => {
  const form = useForm({
    defaultValues: useMemo(() => {
      const values: Record<string, unknown> = {};
      const fields = formSchema.fields || [];
      fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          values[field.fieldId] = field.defaultValue;
        }
      });
      return values;
    }, [formSchema.fields]),
  });
  
  const { control, handleSubmit, formState: { errors }, watch } = form;
  const formValues = watch();

  const onSubmit = (data: Record<string, unknown>) => {
    console.log("表单数据:", data);
  };

  // 获取所有元素（字段和容器）
  const elements = useMemo(() => {
    if (formSchema.elements && formSchema.elements.length > 0) {
      return formSchema.elements;
    }
    // 如果没有elements，从fields生成
    return formSchema.fields.map((f) => f as any);
  }, [formSchema.elements, formSchema.fields]);

  return (
    <FormProvider {...form}>
      <AntForm
        layout="vertical"
        onFinish={handleSubmit(onSubmit)}
        style={{ padding: 24 }}
      >
      {elements.map((element: any) => {
        // 判断是字段还是容器
        if ('fieldId' in element) {
          const field = element as FormFieldSchema;
          return (
            <AntForm.Item
              key={field.fieldId}
              label={field.label}
              required={field.required}
              validateStatus={errors[field.fieldId] ? "error" : undefined}
              help={errors[field.fieldId]?.message as string}
            >
              <FormFieldRenderer
                field={field}
                control={control}
                disabled={false}
                formValues={formValues}
                formSchema={formSchema}
              />
            </AntForm.Item>
          );
        } else if ('containerId' in element) {
          const container = element as LayoutContainerSchemaType;
          return (
            <RuntimeContainerRenderer
              key={container.containerId}
              container={container}
              control={control}
            />
          );
        }
        return null;
      })}

      <AntForm.Item style={{ marginTop: 24 }}>
        <Space>
          <Button type="primary" htmlType="submit">
            提交
          </Button>
          <Button htmlType="reset">
            重置
          </Button>
        </Space>
      </AntForm.Item>
      </AntForm>
    </FormProvider>
  );
};

