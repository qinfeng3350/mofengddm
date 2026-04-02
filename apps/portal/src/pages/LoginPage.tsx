import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Form, Input, Button, message, Card, Tabs, Typography, Space, Divider } from "antd";
import {
  RocketOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  TeamOutlined,
  CloudOutlined,
  LockOutlined,
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { authApi } from "@/api/auth";
import { dingtalkLoginApi } from "@/api/dingtalk-login";
import { useAuthStore } from "@/store/useAuthStore";
import { usePageTitle } from "@/hooks/usePageTitle";
import "./LoginPage.css";

const { Title, Text, Paragraph } = Typography;

export const LoginPage = () => {
  usePageTitle("登录 - 墨枫低代码平台");
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [dingLoading, setDingLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [loginForm] = Form.useForm();
  const [registerForm] = Form.useForm();

  const urlTenant = useMemo(() => {
    const sp = new URLSearchParams(window.location.search);
    return {
      tenantId: sp.get("tenantId") || undefined,
      tenantCode: sp.get("tenantCode") || undefined,
      token: sp.get("token") || undefined,
      inviteCode:
        sp.get("inviteCode") || sp.get("invitationCode") || sp.get("invite") || undefined,
    };
  }, []);

  // 注册入口默认关闭：仅当 URL 带邀请码时才允许注册页
  const allowRegister = !!urlTenant.inviteCode;

  useEffect(() => {
    if (!allowRegister && activeTab === "register") {
      setActiveTab("login");
    }
  }, [allowRegister, activeTab]);

  useEffect(() => {
    // 钉钉网页登录回调会把 token 带回到 /login?token=...
    if (urlTenant.token) {
      void (async () => {
        try {
          // 先把 token 写入 store，确保后续 profile 请求携带 Authorization
          setAuth(urlTenant.token, {
            id: "temp",
            account: "dingtalk",
            name: "DingTalk",
            email: "dingtalk@local",
            tenantId: urlTenant.tenantId,
          } as any);

          // 立刻拉取一次 profile，补全用户信息（并验证 token 可用）
          const profile = await authApi.getProfile();
          if (profile?.id) {
            setAuth(urlTenant.token, profile as any);
          }

          message.success("钉钉登录成功");
          navigate("/home", { replace: true });
        } catch (e: any) {
          message.error(e?.response?.data?.message || e?.message || "钉钉登录失败");
        }
      })();
    }
  }, [navigate, setAuth, urlTenant.tenantId, urlTenant.token]);

  const onDingTalkScanLogin = async () => {
    try {
      setDingLoading(true);
      const resp = await dingtalkLoginApi.getWebUrl({
        tenantId: urlTenant.tenantId,
        tenantCode: urlTenant.tenantCode,
        redirectUri: `${window.location.origin}/api/dingtalk/login/callback`,
      });
      const url = resp?.data?.url;
      if (!url) {
        message.error("获取钉钉登录地址失败");
        return;
      }
      window.location.href = url;
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || "钉钉扫码登录失败");
    } finally {
      setDingLoading(false);
    }
  };

  const onLogin = async (values: { account: string; password: string }) => {
    try {
      setLoading(true);
      console.log("正在登录...", values.account);
      const response = await authApi.login(values);
      console.log("登录响应:", response);
      if (response && response.access_token && response.user) {
        setAuth(response.access_token, response.user);
        message.success("登录成功");
        navigate("/");
      } else {
        console.error("登录响应格式错误:", response);
        message.error("登录失败：响应格式错误");
      }
    } catch (error: any) {
      console.error("登录错误:", error);
      console.error("错误详情:", {
        message: error.message,
        response: error.response,
        data: error.response?.data,
        status: error.response?.status,
      });
      const errorMessage = 
        error.response?.data?.message || 
        error.message || 
        "登录失败，请检查账号密码";
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async (values: {
    account: string;
    password: string;
    name: string;
    email: string;
    phone?: string;
    inviteCode: string;
  }) => {
    try {
      setLoading(true);
      const response = await authApi.register(values);
      setAuth(response.access_token, response.user);
      message.success("注册成功");
      navigate("/");
    } catch (error: any) {
      message.error(error.response?.data?.message || "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* 左侧登录表单区域 */}
        <div className="login-left">
          <div className="login-header">
            <div className="logo-section">
              <RocketOutlined className="logo-icon" />
              <Title level={2} className="login-title">
                墨枫低代码平台
              </Title>
            </div>
            <Paragraph className="login-subtitle">
              请使用管理员账号登录后台
            </Paragraph>
          </div>

          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as "login" | "register")}
            className="login-tabs"
            items={[
              {
                key: "login",
                label: "登录",
              },
              ...(allowRegister
                ? [
                    {
                      key: "register",
                      label: "注册",
                    },
                  ]
                : []),
            ]}
          />

          {activeTab === "login" ? (
            <Form
              form={loginForm}
              name="login"
              onFinish={onLogin}
              autoComplete="off"
              className="login-form"
              size="large"
            >
              <Form.Item
                name="account"
                rules={[{ required: true, message: "请输入账号" }]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="用户名"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[{ required: true, message: "请输入密码" }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码"
                  className="login-input"
                />
              </Form.Item>

              <div className="login-actions">
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    block
                    className="login-button"
                  >
                    登录
                  </Button>
                </Form.Item>
                <Form.Item>
                  <Button
                    block
                    onClick={onDingTalkScanLogin}
                    loading={dingLoading}
                    disabled={loading}
                  >
                    钉钉扫码登录
                  </Button>
                </Form.Item>
                <div className="forgot-password">
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    忘记密码？
                  </a>
                </div>
              </div>
            </Form>
          ) : (
            <Form
              form={registerForm}
              name="register"
              onFinish={onRegister}
              autoComplete="off"
              className="login-form"
              size="large"
              initialValues={{
                inviteCode: urlTenant.inviteCode || "",
              }}
            >
              <Form.Item
                name="account"
                rules={[
                  { required: true, message: "请输入账号" },
                  { min: 3, message: "账号至少3个字符" },
                ]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="账号（至少3个字符）"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item
                name="name"
                rules={[{ required: true, message: "请输入姓名" }]}
              >
                <Input
                  prefix={<UserOutlined />}
                  placeholder="姓名"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item
                name="email"
                rules={[
                  { required: true, message: "请输入邮箱" },
                  { type: "email", message: "邮箱格式不正确" },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="邮箱"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item
                name="inviteCode"
                rules={[{ required: true, message: "请输入邀请码" }]}
              >
                <Input
                  prefix={<SafetyOutlined />}
                  placeholder="邀请码"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item name="phone">
                <Input
                  prefix={<PhoneOutlined />}
                  placeholder="手机号（可选）"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item
                name="password"
                rules={[
                  { required: true, message: "请输入密码" },
                  { min: 6, message: "密码至少6个字符" },
                ]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="密码（至少6个字符）"
                  className="login-input"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  block
                  className="login-button"
                >
                  注册
                </Button>
              </Form.Item>
            </Form>
          )}

          <div className="login-footer" />
        </div>

        {/* 右侧品牌展示区域 */}
        <div className="login-right">
          <div className="brand-content">
            <div className="brand-logo">
              <RocketOutlined className="brand-icon" />
            </div>
            <Title level={1} className="brand-title">
              墨枫低代码平台
            </Title>
            <Paragraph className="brand-description">
              以数字化技术服务千行百业
            </Paragraph>
            <Divider className="brand-divider" />
            <div className="brand-features">
              <Space orientation="vertical" size="large" className="features-list">
                <div className="feature-item">
                  <ThunderboltOutlined className="feature-icon" />
                  <Text className="feature-text">钉钉生态</Text>
                </div>
                <div className="feature-item">
                  <CloudOutlined className="feature-icon" />
                  <Text className="feature-text">系统集成</Text>
                </div>
                <div className="feature-item">
                  <SafetyOutlined className="feature-icon" />
                  <Text className="feature-text">应用开发</Text>
                </div>
                <div className="feature-item">
                  <TeamOutlined className="feature-icon" />
                  <Text className="feature-text">企业级服务</Text>
                </div>
              </Space>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

