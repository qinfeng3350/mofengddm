import { Form, Input, Select, Alert, Radio, Switch, Progress } from "antd";
import { useEffect } from "react";
import { IconSelector } from "@/components/IconSelector";

interface FormPropertiesPanelProps {
  formSchema: any;
  onValuesChange: (values: Record<string, unknown>) => void;
}

export const FormPropertiesPanel = ({ 
  formSchema, 
  onValuesChange 
}: FormPropertiesPanelProps) => {
  const [form] = Form.useForm();

  useEffect(() => {
    form.setFieldsValue({
      formName: formSchema.formName,
      description: formSchema.metadata?.description || "",
      category: formSchema.category || "",
      icon: formSchema.metadata?.icon || "",
      dataTitle: formSchema.metadata?.dataTitle || "",
      viewPermission: formSchema.metadata?.viewPermission || "role",
      comment: formSchema.metadata?.comment || "enable",
      taskReminder: formSchema.metadata?.taskReminder || "disable",
      dataLog: formSchema.metadata?.dataLog || "disable",
      pcDisplay: formSchema.metadata?.pcDisplay !== false,
      mobileDisplay: formSchema.metadata?.mobileDisplay !== false,
    });
  }, [formSchema, form]);

  return (
    <Form
      form={form}
      layout="vertical"
      onValuesChange={(changedValues) => {
        // 将表单属性保存到metadata中
        const metadata = {
          ...(formSchema.metadata || {}),
          description: changedValues.description,
          icon: changedValues.icon,
          dataTitle: changedValues.dataTitle,
          viewPermission: changedValues.viewPermission,
          comment: changedValues.comment,
          taskReminder: changedValues.taskReminder,
          dataLog: changedValues.dataLog,
          pcDisplay: changedValues.pcDisplay,
          mobileDisplay: changedValues.mobileDisplay,
        };
        onValuesChange({
          formName: changedValues.formName || formSchema.formName,
          category: changedValues.category || formSchema.category,
          metadata,
        });
      }}
    >
      <Form.Item 
        label="表单名称" 
        name="formName"
        rules={[{ required: true, message: "请输入表单名称" }]}
      >
        <Input placeholder="请输入表单名称" />
      </Form.Item>

      <Form.Item label="表单描述" name="description">
        <Input.TextArea rows={3} placeholder="请输入表单描述" />
      </Form.Item>

      <Form.Item label="所属分组" name="category">
        <Select placeholder="请选择分组" allowClear>
          <Select.Option value="客户信息">客户信息</Select.Option>
          <Select.Option value="订单管理">订单管理</Select.Option>
          <Select.Option value="库存管理">库存管理</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label="图标" name="icon">
        <IconSelector />
      </Form.Item>

      <Form.Item label="数据标题" name="dataTitle">
        <Input placeholder="请输入数据标题" />
      </Form.Item>
      <Alert
        title="修改数据标题后将对所有数据生效"
        type="warning"
        showIcon
        style={{ marginTop: -16, marginBottom: 16 }}
      />

      <Form.Item 
        label="数据查看权限" 
        name="viewPermission"
        rules={[{ required: true, message: "请选择数据查看权限" }]}
      >
        <Select placeholder="请选择数据查看权限">
          <Select.Option value="role">用户根据角色权限查看数据</Select.Option>
          <Select.Option value="all">所有人可查看</Select.Option>
          <Select.Option value="creator">仅创建人可查看</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label="表单评论" name="comment">
        <Radio.Group>
          <Radio value="enable">开启</Radio>
          <Radio value="disable">不开启</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item label="任务提醒" name="taskReminder">
        <Radio.Group>
          <Radio value="enable">开启</Radio>
          <Radio value="disable">不开启</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item label="数据日志" name="dataLog">
        <Radio.Group>
          <Radio value="enable">开启</Radio>
          <Radio value="disable">不开启</Radio>
        </Radio.Group>
      </Form.Item>

      <Form.Item label="显示设置">
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span>电脑端</span>
            <Form.Item name="pcDisplay" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>手机端</span>
            <Form.Item name="mobileDisplay" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </div>
        </div>
      </Form.Item>

      <Form.Item label="表单控件容量">
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span>已使用{Math.round((formSchema.fields?.length || 0) / 100 * 100)}%</span>
          </div>
          <Progress 
            percent={Math.min((formSchema.fields?.length || 0) / 100 * 100, 100)} 
            showInfo={false}
            strokeColor="#1890ff"
          />
        </div>
      </Form.Item>
    </Form>
  );
};

