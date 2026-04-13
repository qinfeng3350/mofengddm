import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Layout, Button, Tabs, Space, Avatar, Dropdown, Tag, message, Input, Typography, Drawer } from "antd";
import { 
  ArrowLeftOutlined, 
  SaveOutlined, 
  QuestionCircleOutlined, 
  UserOutlined,
  BgColorsOutlined,
  TeamOutlined,
  LockOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  FileTextOutlined,
  GlobalOutlined,
  LogoutOutlined,
  EditOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import { FormDesignerDndProvider } from "@/modules/form-designer/components/DndProvider";
import { FieldLibraryPanel } from "@/modules/form-designer/components/FieldLibraryPanel";
import { DesignerCanvas } from "@/modules/form-designer/components/DesignerCanvas";
import { PropertyPanel } from "@/modules/form-designer/components/PropertyPanel";
import { ProcessDesigner } from "@/modules/process-designer/ProcessDesigner";
import { DesignerHeader } from "@/modules/form-designer/components/DesignerHeader";
import { useFormDesignerStore } from "@/modules/form-designer/store/useFormDesignerStore";
import { useQuery } from "@tanstack/react-query";
import { applicationApi } from "@/api/application";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/useAuthStore";
import { usePageTitle } from "@/hooks/usePageTitle";
import { FormSettingsPage } from "./FormSettingsPage";
import { FormPreview } from "@/modules/form-designer/components/FormPreview";
import { UserAccountDropdown } from "@/components/UserAccountDropdown";
import "./DesignerPage.css";

const { Header, Sider, Content } = Layout;

export const DesignerPage = () => {
  usePageTitle("表单设计器 - 墨枫低代码平台");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appId = searchParams.get("appId");
  const formId = searchParams.get("formId");
  const [activeTab, setActiveTab] = useState("form");
  const loadForm = useFormDesignerStore((state) => state.loadForm);
  const setFormSchema = useFormDesignerStore((state) => state.setFormSchema);
  const setApplicationId = useFormDesignerStore((state) => state.setApplicationId);
  const saveForm = useFormDesignerStore((state) => state.saveForm);
  const isSaving = useFormDesignerStore((state) => state.isSaving);
  const formSchema = useFormDesignerStore((state) => state.formSchema);
  const { user } = useAuthStore();
  const [editingFormName, setEditingFormName] = useState(false);
  const [formNameValue, setFormNameValue] = useState(formSchema.formName);
  const [previewVisible, setPreviewVisible] = useState(false);

  // 获取应用信息
  const { data: appInfo } = useQuery({
    queryKey: ["application", appId],
    queryFn: () => applicationApi.getById(appId!),
    enabled: !!appId,
  });

  useEffect(() => {
    // 设置应用ID
    if (appId) {
      setApplicationId(appId);
    }

    if (formId) {
      // 加载已有表单
      loadForm(formId)
        .then(() => {
        })
        .catch((error) => {
          console.error("加载表单失败:", error);
          // 如果加载失败，显示错误提示
          alert(`加载表单失败: ${error instanceof Error ? error.message : "未知错误"}`);
        });
    } else {
      // 创建新表单，重置为初始状态
      setFormSchema({
        formId: "form_new",
        formName: "未命名表单",
        status: "draft",
        version: 1,
        fields: [],
        layout: {
          type: "grid",
          columns: 12,
        },
      });
    }
  }, [appId, formId, loadForm, setFormSchema, setApplicationId]);

  // 当表单名称变化时，更新本地状态
  useEffect(() => {
    setFormNameValue(formSchema.formName || "未命名表单");
  }, [formSchema.formName]);

  const handleSave = async () => {
    try {
      await saveForm();
      message.success("保存成功");
    } catch (error) {
      console.error("保存失败:", error);
      message.error("保存失败，请重试");
    }
  };

  const handleMenuClick = (key: string) => {
    switch (key) {
      case "profile":
        navigate("/settings/profile");
        break;
      case "organization":
        navigate("/settings/organization");
        break;
      case "permission":
        navigate("/settings/permission");
        break;
      case "plugin":
        navigate("/settings/plugin");
        break;
      case "ai":
        message.info("AI能力中心功能待实现");
        break;
      case "system":
        navigate("/settings/system");
        break;
      case "template":
        message.info("模板中心功能待实现");
        break;
      case "website":
        window.open("/", "_blank");
        break;
      case "logout":
        useAuthStore.getState().clearAuth();
        navigate("/login");
        break;
      default:
        break;
    }
  };

  // 获取当前用户信息（包括租户信息）
  const { data: currentUserInfo } = useQuery({
    queryKey: ["current-user-info"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/auth/profile");
        return res;
      } catch {
        return null;
      }
    },
  });

  const userMenuItems = [
    {
      key: "tenant",
      label: (
        <div style={{ padding: "8px 0" }}>
          <div style={{ fontWeight: 500 }}>
            {currentUserInfo?.tenant?.name || currentUserInfo?.tenant?.code || "默认租户"}
          </div>
          <Button type="link" size="small" style={{ padding: 0, height: "auto" }}>
            切换
          </Button>
        </div>
      ),
      disabled: true,
    },
    { type: "divider" },
    {
      key: "profile",
      label: "个人信息",
      icon: <UserOutlined />,
      onClick: () => handleMenuClick("profile"),
    },
    {
      key: "organization",
      label: "组织机构",
      icon: <TeamOutlined />,
      onClick: () => handleMenuClick("organization"),
    },
    {
      key: "permission",
      label: "权限管理",
      icon: <LockOutlined />,
      onClick: () => handleMenuClick("permission"),
    },
    {
      key: "plugin",
      label: "插件中心",
      icon: <AppstoreOutlined />,
      onClick: () => handleMenuClick("plugin"),
    },
    {
      key: "ai",
      label: (
        <Space>
          <span>AI能力中心</span>
          <Tag color="red" style={{ margin: 0, fontSize: 10, padding: "0 4px" }}>
            new
          </Tag>
        </Space>
      ),
      icon: <ThunderboltOutlined />,
      onClick: () => handleMenuClick("ai"),
    },
    {
      key: "system",
      label: "系统管理",
      icon: <SettingOutlined />,
      onClick: () => handleMenuClick("system"),
    },
    {
      key: "template",
      label: "模板中心",
      icon: <FileTextOutlined />,
      onClick: () => handleMenuClick("template"),
    },
    {
      key: "website",
      label: "墨枫官网",
      icon: <GlobalOutlined />,
      onClick: () => handleMenuClick("website"),
    },
    { type: "divider" },
    {
      key: "logout",
      label: "退出登录",
      icon: <LogoutOutlined />,
      onClick: () => handleMenuClick("logout"),
    },
  ];

  return (
    <FormDesignerDndProvider>
      <Layout className="designer-layout" style={{ height: "100vh" }}>
        {/* 顶部导航栏 */}
        <div style={{ 
          background: "#fff", 
          borderBottom: "1px solid #f0f0f0",
        }}>
          {/* 第一行：返回按钮、应用名称、新手引导 | 右侧按钮组 */}
          <Header style={{ 
            padding: "0 24px",
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#fff",
            borderBottom: "none",
          }}>
            {/* 左侧：返回按钮 + 应用名称 + 新手引导 */}
            <Space>
              <Button
                type="text"
                icon={<ArrowLeftOutlined />}
                onClick={() => {
                  if (appId) {
                    navigate(`/app/${appId}`);
                  } else {
                    navigate("/home");
                  }
                }}
              >
                {appInfo?.name || "返回"}
              </Button>
              {editingFormName ? (
                <Space>
                  <Input
                    value={formNameValue}
                    onChange={(e) => setFormNameValue(e.target.value)}
                    onPressEnter={async () => {
                      if (!formNameValue.trim()) {
                        message.warning("表单名称不能为空");
                        return;
                      }
                      setFormSchema({
                        ...formSchema,
                        formName: formNameValue.trim(),
                      });
                      setEditingFormName(false);
                      // 如果表单已保存过，立即更新
                      if (formSchema.formId && formSchema.formId !== "form_new") {
                        try {
                          await saveForm();
                          message.success("表单名称更新成功");
                        } catch (error) {
                          message.error("更新失败，请重试");
                        }
                      }
                    }}
                    onBlur={async () => {
                      if (!formNameValue.trim()) {
                        setFormNameValue(formSchema.formName || "未命名表单");
                        setEditingFormName(false);
                        return;
                      }
                      setFormSchema({
                        ...formSchema,
                        formName: formNameValue.trim(),
                      });
                      setEditingFormName(false);
                      // 如果表单已保存过，立即更新
                      if (formSchema.formId && formSchema.formId !== "form_new") {
                        try {
                          await saveForm();
                          message.success("表单名称更新成功");
                        } catch (error) {
                          message.error("更新失败，请重试");
                        }
                      }
                    }}
                    style={{ width: 150 }}
                    autoFocus
                  />
                  <Button size="small" onClick={() => {
                    setFormNameValue(formSchema.formName || "未命名表单");
                    setEditingFormName(false);
                  }}>
                    取消
                  </Button>
                </Space>
              ) : (
                <Space>
                  <Typography.Text strong style={{ fontSize: 14 }}>
                    {formSchema.formName || "未命名表单"}
                  </Typography.Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setFormNameValue(formSchema.formName || "未命名表单");
                      setEditingFormName(true);
                    }}
                    style={{ padding: 0, height: "auto" }}
                  />
                </Space>
              )}
            </Space>

            {/* 右侧：客服、用户下拉菜单 */}
            <Space>
              <Button 
                type="text" 
                icon={<QuestionCircleOutlined />}
              >
                客服
              </Button>
              <UserAccountDropdown showUserName />
            </Space>
          </Header>

          {/* 第二行：标签页 + 样式设置、保存按钮 */}
          <div style={{
            padding: "0 24px",
            height: 48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderTop: "1px solid #f0f0f0",
            position: "relative",
          }}>
            {/* 标签页 */}
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: "form",
                  label: "表单设计",
                },
                {
                  key: "process",
                  label: "流程设计",
                },
                {
                  key: "settings",
                  label: "表单设置",
                },
              ]}
              style={{ flex: "none" }}
            />

            {/* 右侧：预览、样式设置、保存按钮 */}
            <Space style={{ position: "absolute", right: 24 }}>
              <Button 
                icon={<EyeOutlined />}
                onClick={async () => {
                  // 先保存表单，然后显示预览
                  try {
                    await handleSave();
                    message.success("保存成功，正在打开预览");
                  } catch (error) {
                    // 保存失败时也显示预览（允许预览未保存的表单）
                    message.warning("保存失败，但可以预览当前表单");
                  }
                  setPreviewVisible(true);
                }}
              >
                预览
              </Button>
              <Button 
                type="text" 
                icon={<BgColorsOutlined />}
              >
                样式设置
              </Button>
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                loading={isSaving}
                onClick={handleSave}
              >
                保存
              </Button>
            </Space>
          </div>
        </div>

        <Layout style={{ height: "calc(100vh - 96px)" }}>
          {activeTab === "form" && (
            <>
              <Sider width={320} style={{ 
                background: "#fff", 
                borderRight: "1px solid #e8e8e8",
                boxShadow: "2px 0 8px rgba(0, 0, 0, 0.04)",
              }}>
                <FieldLibraryPanel />
              </Sider>
              <Content style={{ 
                background: "#f3f4f6", 
                padding: 12, 
                height: "100%", 
                overflow: "auto",
              }}>
                <DesignerCanvas />
              </Content>
              <Sider width={340} style={{ 
                background: "#fff", 
                borderLeft: "1px solid #e8e8e8",
                boxShadow: "-2px 0 8px rgba(0, 0, 0, 0.04)",
              }}>
                <PropertyPanel />
              </Sider>
            </>
          )}

          {activeTab === "process" && (
            <Content style={{ background: "#f5f5f5", padding: 0, height: "100%", overflow: "auto" }}>
              <ProcessDesigner
                value={formSchema.metadata?.workflow}
                onChange={(wf) => {
                  setFormSchema({
                    ...formSchema,
                    metadata: {
                      ...(formSchema.metadata || {}),
                      workflow: wf,
                    },
                  });
                }}
              />
            </Content>
          )}

          {activeTab === "settings" && (
            <Content style={{ background: "#fff", height: "100%", overflow: "hidden" }}>
              <FormSettingsPage formId={formId || undefined} appId={appId || undefined} />
            </Content>
          )}

        </Layout>
      </Layout>

      {/* 预览抽屉 */}
      <Drawer
        title={`预览：${formSchema.formName || "未命名表单"}`}
        placement="bottom"
        height="80vh"
        open={previewVisible}
        onClose={() => setPreviewVisible(false)}
        destroyOnClose
        styles={{
          body: {
            padding: 0,
            overflow: "auto",
          },
        }}
      >
        <FormPreview formSchema={formSchema} />
      </Drawer>
    </FormDesignerDndProvider>
  );
};

