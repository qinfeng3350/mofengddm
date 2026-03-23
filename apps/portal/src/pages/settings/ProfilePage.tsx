import { Card, Form, Input, Button, Space, Typography, message, Divider } from "antd";
import { UserOutlined, MailOutlined, PhoneOutlined, LockOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/store/useAuthStore";
import { authApi } from "@/api/auth";
import "./SettingsPage.css";

const { Title } = Typography;

export const ProfilePage = () => {
  const { user } = useAuthStore();
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();

  const onFinish = (values: any) => {
    // TODO: 调用API更新个人信息
    message.success("个人信息更新成功");
  };

  const onPasswordFinish = async (values: any) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error("两次输入的新密码不一致");
      return;
    }

    try {
      await authApi.changePassword({
        oldPassword: values.oldPassword,
        newPassword: values.newPassword,
      });
      message.success("密码修改成功，请使用新密码重新登录");
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error?.response?.data?.message || "密码修改失败");
    }
  };

  return (
    <div className="settings-page">
      <Card>
        <Title level={4}>个人信息</Title>
        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          initialValues={{
            name: user?.name,
            account: user?.account,
            email: user?.email,
            phone: user?.phone,
          }}
        >
          <Form.Item label="账号" name="account">
            <Input prefix={<UserOutlined />} disabled />
          </Form.Item>
          <Form.Item
            label="姓名"
            name="name"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input prefix={<UserOutlined />} />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ type: "email", message: "邮箱格式不正确" }]}
          >
            <Input prefix={<MailOutlined />} />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input prefix={<PhoneOutlined />} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
              <Button onClick={() => form.resetFields()}>重置</Button>
            </Space>
          </Form.Item>
        </Form>

        <Divider />

        <Title level={4}>修改密码</Title>
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={onPasswordFinish}
        >
          <Form.Item
            label="当前密码"
            name="oldPassword"
            rules={[{ required: false }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="如果是第一次登录，可留空，直接设置新密码"
            />
          </Form.Item>
          <Form.Item
            label="新密码"
            name="newPassword"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "密码长度不能小于 6 位" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item
            label="确认新密码"
            name="confirmPassword"
            dependencies={["newPassword"]}
            rules={[{ required: true, message: "请再次输入新密码" }]}
          >
            <Input.Password prefix={<LockOutlined />} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit">
              保存新密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

