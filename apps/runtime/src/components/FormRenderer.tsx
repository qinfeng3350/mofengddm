import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { Form as AntForm, Button, Spin, message, Space } from "antd";
import { ListOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formDefinitionApi } from "@/api/formDefinition";
import { formDataApi } from "@/api/formData";
import { FormFieldRenderer } from "./FormFieldRenderer";
import type { FormSchemaType } from "@mofeng/shared-schema";

interface FormRendererProps {
  formId: string;
  onSubmitSuccess?: (data: Record<string, unknown>) => void;
}

export const FormRenderer = ({ formId, onSubmitSuccess }: FormRendererProps) => {
  const navigate = useNavigate();
  const { data: formDefinition, isLoading } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId),
  });

  // 根据字段配置生成默认值
  const defaultValues = useMemo(() => {
    if (!formDefinition) return {};
    const values: Record<string, unknown> = {};
    formDefinition.config.fields.forEach((field) => {
      if (field.defaultValue !== undefined) {
        values[field.fieldId] = field.defaultValue;
      }
    });
    return values;
  }, [formDefinition]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm({
    defaultValues,
  });

  const onSubmit = async (data: Record<string, unknown>) => {
    try {
      const response = await formDataApi.submit({
        formId,
        data,
      });
      message.success("提交成功");
      // 重置表单
      reset(defaultValues);
      onSubmitSuccess?.(response.data);
    } catch (error: unknown) {
      console.error("提交失败:", error);
      const errorMessage = error instanceof Error ? error.message : "提交失败，请重试";
      message.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!formDefinition) {
    return <div>表单不存在</div>;
  }

  const formSchema: FormSchemaType = {
    formId: formDefinition.formId,
    formName: formDefinition.formName,
    status: formDefinition.status,
    version: formDefinition.version,
    fields: formDefinition.config.fields,
    layout: formDefinition.config.layout,
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 24 }}>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{formSchema.formName}</h2>
        <Button
          icon={<ListOutlined />}
          onClick={() => navigate(`/list?formId=${formId}`)}
        >
          查看数据列表
        </Button>
      </Space>
      <AntForm layout="vertical" onFinish={handleSubmit(onSubmit)}>
        {formSchema.fields.map((field) => (
          <FormFieldRenderer key={field.fieldId} field={field} control={control} />
        ))}
        <AntForm.Item>
          <Button type="primary" htmlType="submit" loading={isSubmitting} block>
            提交
          </Button>
        </AntForm.Item>
      </AntForm>
    </div>
  );
};

