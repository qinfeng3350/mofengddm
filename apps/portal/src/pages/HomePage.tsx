import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import {
  Card,
  Button,
  Empty,
  Spin,
  Tag,
  Space,
  Typography,
  Row,
  Col,
  Dropdown,
  Avatar,
  message,
  Popconfirm,
  Input,
  Tabs,
  Badge,
  Modal,
  Select,
} from "antd";
import type { MenuProps } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  DatabaseOutlined,
  UserOutlined,
  LogoutOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  ContactsOutlined,
  SettingOutlined,
  TeamOutlined,
  LockOutlined,
  AppstoreOutlined,
  BankOutlined,
  FileTextOutlined,
  GlobalOutlined,
  DeleteOutlined,
  SendOutlined,
  CheckCircleOutlined,
  PlayCircleOutlined,
  SearchOutlined,
  StarOutlined,
  DownloadOutlined,
  UploadOutlined,
  DownOutlined,
  DesktopOutlined,
  CustomerServiceOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { applicationApi } from "@/api/application";
import { workflowApi } from "@/api/workflow";
import { CreateAppModal } from "@/components/CreateAppModal";
import { useAuthStore } from "@/store/useAuthStore";
import { renderIcon } from "@/utils/iconRenderer";
import { usePageTitle } from "@/hooks/usePageTitle";
import dayjs from "dayjs";
import { authApi } from "@/api/auth";
import "./HomePage.css";
import { useIsMobile } from "@/hooks/useIsMobile";

const { Title, Text } = Typography;

const WORKBENCH_STORAGE_KEY = "portal-workbench-selection";

export const HomePage = () => {
  usePageTitle("应用管理 - 墨枫低代码平台");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, clearAuth } = useAuthStore();
  const isMobile = useIsMobile();

  useEffect(() => {
    const todoRecordId = searchParams.get("todoRecordId");
    if (!todoRecordId) return;
    const todoFormId = searchParams.get("todoFormId");
    const next = new URLSearchParams();
    next.set("recordId", todoRecordId);
    if (todoFormId) next.set("formId", todoFormId);
    navigate(`/runtime/list?${next.toString()}`, { replace: true });
    // 清理首页 URL 参数，避免返回首页时重复跳转
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [navigate, searchParams, setSearchParams]);
  
  // 获取当前用户信息（包括租户信息）
  const { data: currentUserInfo, refetch: refetchUserInfo } = useQuery({
    queryKey: ["current-user-info"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/auth/profile");
        console.log("【调试】获取到的用户信息:", res);
        return res;
      } catch (error) {
        console.error("【调试】获取用户信息失败:", error);
        return null;
      }
    },
    staleTime: 0, // 不缓存，每次都获取最新数据
    refetchOnMount: true, // 组件挂载时重新获取
    refetchOnWindowFocus: true, // 窗口获得焦点时重新获取
  });

  const tenantName = useMemo(() => {
    return (
      (currentUserInfo as any)?.tenant?.name ||
      (currentUserInfo as any)?.tenantName ||
      (user as any)?.tenant?.name ||
      "企业默认工作台"
    );
  }, [currentUserInfo, user]);
  const [selectedWorkbenchId, setSelectedWorkbenchId] = useState<string>(() => {
    try {
      return localStorage.getItem(WORKBENCH_STORAGE_KEY) || "default";
    } catch {
      return "default";
    }
  });

  const [createModalOpen, setCreateModalOpen] = useState(false);
  /** 右下角悬浮客服：false 为收起仅圆钮，true 为展开上方面板 */
  const [customerServiceOpen, setCustomerServiceOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("全部");
  const [configDrawerOpen, setConfigDrawerOpen] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const { data: applications, isLoading, refetch } = useQuery({
    queryKey: ["applications"],
    queryFn: () => applicationApi.getList(),
  });

  const { data: rawPendingTasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["workflow", "tasks", "pending"],
    queryFn: () => workflowApi.listTasks("pending"),
  });

  // 用户列表映射，用于显示待办中的指派人姓名
  const { data: userList = [] } = useQuery({
    queryKey: ["users", "forHome"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/users");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  });
  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    (userList as any[]).forEach((u) => u && map.set(String(u.id), u));
    return map;
  }, [userList]);

  // 只统计当前用户的待办数量
  const pendingTasks = useMemo(() => {
    if (!rawPendingTasks || !user) return rawPendingTasks || [];
    return (rawPendingTasks as any[]).filter((task) => {
      const ids: any[] = task.assignees?.values || [];
      return ids.map(String).includes(String(user.id));
    });
  }, [rawPendingTasks, user]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  // 租户切换弹窗（同一账号可切换多个 tenantId）
  const [tenantSwitchOpen, setTenantSwitchOpen] = useState(false);
  const [tenantSwitchLoading, setTenantSwitchLoading] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<
    Array<{ id: string; code?: string; name?: string }>
  >([]);
  const [targetTenantId, setTargetTenantId] = useState<string | null>(null);

  const handleTenantSwitchOpen = async () => {
    setTenantSwitchOpen(true);
    setTenantSwitchLoading(true);
    try {
      const res = await authApi.getTenants();
      const list = Array.isArray(res) ? res : (res as any)?.tenants ?? [];
      message.info(`检测到可切换租户：${list.length} 个`);
      setTenantOptions(list);
      setTargetTenantId(list?.[0]?.id ?? null);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "获取租户列表失败";
      message.error(msg);
      console.error("获取租户列表失败:", e);
    } finally {
      setTenantSwitchLoading(false);
    }
  };

  const handleTenantSwitchConfirm = async () => {
    if (!targetTenantId) {
      message.warning("请选择要切换的租户");
      return;
    }
    setTenantSwitchLoading(true);
    try {
      const res = await authApi.switchTenant({ tenantId: targetTenantId });
      if (res?.access_token && res?.user) {
        // 刷新 token + 用户信息后重载页面
        useAuthStore.getState().setAuth(res.access_token, res.user);
        message.success("租户切换成功");
        setTenantSwitchOpen(false);
        window.location.reload();
      } else {
        message.error("租户切换失败：响应格式错误");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "租户切换失败";
      message.error(msg);
      console.error("租户切换失败:", e);
    } finally {
      setTenantSwitchLoading(false);
    }
  };

  const handleCreateApp = () => {
    setCreateModalOpen(true);
  };

  const workbenchButtonLabel =
    selectedWorkbenchId === "default" ? "企业默认工作台" : "企业默认工作台";

  const workbenchMenuItems = useMemo<MenuProps["items"]>(
    () => [
      {
        type: "group",
        label: "选择工作台",
        children: [
          {
            key: "wb-default",
            label: (
              <span style={{ fontWeight: selectedWorkbenchId === "default" ? 600 : 400 }}>
                企业默认工作台{" "}
                <Tag color="processing" style={{ margin: 0, marginLeft: 6, fontSize: 10, padding: "0 4px" }}>
                  默认
                </Tag>
              </span>
            ),
          },
        ],
      },
      { type: "divider" },
      {
        key: "set-enterprise",
        icon: <SettingOutlined />,
        label: "设置企业工作台",
      },
      {
        key: "set-mine",
        icon: <UserOutlined />,
        label: "设置我的工作台",
      },
      {
        key: "workbench-settings",
        icon: <DesktopOutlined />,
        label: "工作台设置",
      },
    ],
    [selectedWorkbenchId],
  );

  const onWorkbenchMenuClick = useCallback(
    ({ key }: { key: string }) => {
      if (key === "wb-default") {
        setSelectedWorkbenchId("default");
        try {
          localStorage.setItem(WORKBENCH_STORAGE_KEY, "default");
        } catch {
          /* ignore */
        }
        message.success("已切换为企业默认工作台");
        return;
      }
      if (key === "set-enterprise") {
        navigate("/settings/system");
        return;
      }
      if (key === "set-mine") {
        navigate("/settings/profile");
        return;
      }
      if (key === "workbench-settings") {
        navigate("/settings/workbench");
      }
    },
    [navigate],
  );

  const handleAppClick = (appId: string) => {
    // 点击应用进入应用管理页面，可以看到该应用下的所有表单
    navigate(`/app/${appId}`);
  };

  const handleDeleteApp = async (appId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡
    try {
      await applicationApi.delete(appId);
      message.success("删除成功");
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.message || "删除失败，请重试");
    }
  };

  const handleView = (formId: string) => {
    navigate(`/runtime/form?formId=${formId}`);
  };

  const handleViewData = (formId: string) => {
    navigate(`/runtime/list?formId=${formId}`);
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
      case "enterprise":
        navigate("/settings/enterprise");
        break;
      case "system":
        navigate("/settings/system");
        break;
      case "template":
        navigate("/settings/template");
        break;
      case "website":
        // 在新标签页打开官网（LandingPage）
        window.open("/", "_blank");
        break;
      case "logout":
        handleLogout();
        break;
      default:
        break;
    }
  };

  const handleTaskClick = (task: any) => {
    if (task?.recordId) {
      // 跳到列表页并直接打开该记录的详情抽屉
      navigate(`/runtime/list?recordId=${task.recordId}`);
    }
  };

  // 根据搜索和标签页筛选应用
  const filteredApplications = useMemo(() => {
    if (!applications) return [];
    let filtered = applications;
    
    // 根据标签页筛选
    if (activeTab === "我管理的") {
      // 这里可以根据实际权限逻辑筛选
      filtered = filtered;
    } else if (activeTab === "默认分组") {
      // 筛选未分组的应用
      filtered = filtered.filter(app => !app.metadata?.formGroups || app.metadata.formGroups.length === 0);
    }
    
    // 根据搜索文本筛选
    if (searchText.trim()) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(app => 
        app.name.toLowerCase().includes(lowerSearch) ||
        (app.metadata?.formGroups && app.metadata.formGroups.some((group: any) => 
          group.name?.toLowerCase().includes(lowerSearch)
        ))
      );
    }
    
    return filtered;
  }, [applications, activeTab, searchText]);

  const userMenuItems = [
    {
      key: "tenant",
      label: (
        <div style={{ padding: "8px 0" }}>
          <div style={{ fontWeight: 500 }}>
            {currentUserInfo?.tenant?.name || currentUserInfo?.tenant?.code || "默认租户"}
          </div>
          <Button
            type="link"
            size="small"
            style={{ padding: 0, height: "auto" }}
            onClick={(e) => {
              e.stopPropagation();
              void handleTenantSwitchOpen();
            }}
          >
            切换
          </Button>
        </div>
      ),
      onClick: () => {
        void handleTenantSwitchOpen();
      },
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
      key: "enterprise",
      label: "企业管理",
      icon: <BankOutlined />,
      onClick: () => handleMenuClick("enterprise"),
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
    <div className="home-page">
      <div className="home-header">
        <Space size="middle" style={{ width: "100%", justifyContent: "space-between" }}>
          {/* 左侧：企业名称 */}
          <Space size={8} style={{ minWidth: 0 }}>
            <Typography.Text
              strong
              style={{
                fontSize: 14,
                maxWidth: isMobile ? 180 : 320,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={tenantName}
            >
              {tenantName}
            </Typography.Text>
          </Space>

          {/* 右侧：工作台 / 帮助 / 通讯录 / 通知 / 用户菜单（客服在右下角圆形入口） */}
          <Space size="middle">
            <Dropdown
              placement="bottomRight"
              trigger={["click"]}
              menu={{ items: workbenchMenuItems, onClick: onWorkbenchMenuClick }}
            >
              <Button
                type="text"
                style={{
                  maxWidth: isMobile ? 140 : 220,
                  color: "#333",
                  fontWeight: 500,
                  padding: "4px 8px",
                }}
              >
                <Space size={6}>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={workbenchButtonLabel}
                  >
                    {workbenchButtonLabel}
                  </span>
                  <DownOutlined style={{ fontSize: 10, color: "#8c8c8c" }} />
                </Space>
              </Button>
            </Dropdown>

            {/* 帮助中心（右侧） */}
            <Dropdown
              placement="bottomRight"
              trigger={["click"]}
              menu={{
                items: [
                  { key: "docs-user", label: "使用文档", onClick: () => navigate("/docs/user") },
                  { key: "docs-dev", label: "开发文档", onClick: () => navigate("/docs/dev") },
                  { key: "docs-changelog", label: "更新日志", onClick: () => navigate("/docs/changelog") },
                  { key: "docs-api", label: "接口文档", onClick: () => navigate("/docs/api") },
                ],
              }}
            >
              <Button type="text" icon={<QuestionCircleOutlined />} style={{ fontSize: 18 }} title="帮助中心" />
            </Dropdown>

            {/* 通讯录 */}
            <Button
              type="text"
              icon={<ContactsOutlined />}
              style={{ fontSize: 18 }}
              title="通讯录"
              onClick={() => navigate("/contacts")}
            />

            <Badge count={pendingTasks?.length || 0} overflowCount={99} size="small">
              <Button
                type="text"
                icon={<BellOutlined />}
                style={{ fontSize: 18 }}
                title="待办通知"
                onClick={() => navigate("/workflow/tasks?tab=pending")}
              />
            </Badge>
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              trigger={["click"]}
            >
              <Space style={{ cursor: "pointer" }}>
                <Avatar
                  src={currentUserInfo?.avatar || user?.avatar}
                  icon={<UserOutlined />}
                  style={{ backgroundColor: "#1890ff" }}
                >
                  {((currentUserInfo?.name || user?.name || currentUserInfo?.account || user?.account || "")[0] || "").toUpperCase()}
                </Avatar>
                <span style={{ fontSize: 14, color: "#333" }}>
                  {currentUserInfo?.name || user?.name || currentUserInfo?.account || user?.account || "未登录"}
                </span>
              </Space>
            </Dropdown>
          </Space>
        </Space>
      </div>

      <div className="home-content">
        <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", minHeight: 0 }}>
          {/* 上面两个：通知区域和推广横幅 */}
          <Row gutter={[16, 16]} style={{ flexShrink: 0 }}>
            <Col xs={24} lg={16}>
              <Card className="notification-section" bodyStyle={{ padding: isMobile ? 12 : "20px" }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
                  <Title level={5} style={{ margin: 0 }}>我的流程</Title>
                  <Text type="secondary">常用入口</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: isMobile ? 8 : 16 }}>
                  <Card hoverable style={{ flex: 1, textAlign: "center" }} onClick={() => navigate("/workflow/tasks?tab=pending")}>
                    <Space direction="vertical">
                      <Badge count={pendingTasks?.length || 0} overflowCount={99}>
                        <UserOutlined style={{ fontSize: 28, color: "#1890ff" }} />
                      </Badge>
                      <Text>待办</Text>
                    </Space>
                  </Card>
                  <Card hoverable style={{ flex: 1, textAlign: "center" }} onClick={() => navigate("/workflow/tasks?tab=completed") }>
                    <Space direction="vertical">
                      <FileTextOutlined style={{ fontSize: 28, color: "#1890ff" }} />
                      <Text>待阅</Text>
                    </Space>
                  </Card>
                  <Card hoverable style={{ flex: 1, textAlign: "center" }} onClick={() => navigate("/workflow/tasks?tab=started") }>
                    <Space direction="vertical">
                      <SendOutlined style={{ fontSize: 28, color: "#1890ff" }} />
                      <Text>我发起的</Text>
                    </Space>
                  </Card>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card 
                className="promotion-banner"
                style={{ 
                  background: "linear-gradient(135deg, #1890ff 0%, #096dd9 100%)",
                  border: "none",
                  color: "#fff",
                  height: "100%"
                }}
                bodyStyle={{ 
                  padding: "20px",
                  textAlign: "center",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center"
                }}
              >
                <div>
                  <Title level={4} style={{ color: "#fff", marginBottom: 8, fontSize: 16 }}>
                    打造高效办公,从工作台开始!
                  </Title>
                  <Text style={{ color: "#fff", fontSize: 12, display: "block", marginBottom: 16 }}>
                    开始体验数字化办公之旅
                  </Text>
                  <div style={{ 
                    background: "#fff", 
                    borderRadius: 8, 
                    padding: 12, 
                    width: 100,
                    height: 100,
                    margin: "0 auto",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}>
                    <AppstoreOutlined style={{ fontSize: 40, color: "#1890ff" }} />
                  </div>
                </div>
              </Card>
            </Col>
          </Row>

          {/* 下面一个：我的应用区域 */}
          <Card 
            className="section" 
            style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}
            bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? 12 : "20px", minHeight: 0, overflow: "hidden" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div className="section-header" style={{ marginBottom: 12 }}>
                  <Title level={4} style={{ margin: 0, fontSize: 16 }}>我的应用</Title>
                  <Space>
                    <Button 
                      type="text" 
                      icon={<SettingOutlined />} 
                      size="small" 
                      title="设置"
                      onClick={(e) => {
                        e.stopPropagation();
                        // 这个按钮暂时不处理，因为每个应用卡片都有自己的设置按钮
                      }}
                    />
                    <Button type="text" icon={<DownloadOutlined />} size="small" title="导出" />
                    <Button type="text" icon={<UploadOutlined />} size="small" title="导入" />
                  </Space>
                </div>
                
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={[
                    { key: "全部", label: "全部" },
                    { key: "我管理的", label: "我管理的" },
                    { key: "默认分组", label: "默认分组" },
                  ]}
                  style={{ marginBottom: 12 }}
                  size="small"
                />
                
                {activeTab === "默认分组" && (
                  <div style={{ marginBottom: 12 }}>
                    <Title level={5} style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>默认分组</Title>
                  </div>
                )}
              </div>
              
              {/* 右侧搜索和新建应用 */}
              <div style={{ marginLeft: isMobile ? 8 : 16, flexShrink: 0 }}>
                <Space size="small">
                  <Input
                    placeholder="搜索应用或表单名称"
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: isMobile ? 140 : 200 }}
                    allowClear
                    size="small"
                  />
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateApp} size="small">
                    {isMobile ? "新建" : "新建应用"}
                  </Button>
                </Space>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {isLoading ? (
                <div style={{ textAlign: "center", padding: 30 }}>
                  <Spin size="large" />
                </div>
              ) : !filteredApplications || filteredApplications.length === 0 ? (
                <Empty
                  description={searchText ? "未找到匹配的应用" : "暂无应用"}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  style={{ padding: "40px 0" }}
                >
                  {!searchText && (
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateApp} size="small">
                      创建第一个应用
                    </Button>
                  )}
                </Empty>
              ) : (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingBottom: 8 }}>
                  {filteredApplications.map((app) => (
                    <Card
                      key={app.id}
                      hoverable
                      className="app-card"
                      onClick={() => handleAppClick(app.id)}
                      style={{ 
                        width: 280
                      }}
                      bodyStyle={{ padding: "16px" }}
                      actions={[
                        <Button
                          type="link"
                          icon={<EditOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/${app.id}`);
                          }}
                          key="manage"
                        >
                          管理
                        </Button>,
                        <Popconfirm
                          title="确定要删除这个应用吗？"
                          description="删除后无法恢复，请谨慎操作"
                          onConfirm={(e) => {
                            e?.stopPropagation();
                            handleDeleteApp(app.id, e as any);
                          }}
                          onCancel={(e) => e?.stopPropagation()}
                          okText="确定"
                          cancelText="取消"
                          key="delete"
                        >
                          <Button
                            type="link"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                          >
                            删除
                          </Button>
                        </Popconfirm>,
                      ]}
                    >
                      <div style={{ position: "relative" }}>
                        <StarOutlined 
                          style={{ 
                            position: "absolute", 
                            top: 0, 
                            right: 0, 
                            fontSize: 16, 
                            color: "#d9d9d9",
                            cursor: "pointer"
                          }} 
                        />
                        <SettingOutlined 
                          style={{ 
                            position: "absolute", 
                            top: 0, 
                            right: 20, 
                            fontSize: 16, 
                            color: "#1890ff",
                            cursor: "pointer"
                          }} 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/${app.id}/config`);
                          }}
                        />
                        <Card.Meta
                          avatar={
                            app.metadata?.icon ? (
                              <div style={{ fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                {renderIcon(app.metadata.icon as string, AppstoreOutlined)}
                              </div>
                            ) : (
                              <AppstoreOutlined style={{ fontSize: 32, color: "#1890ff" }} />
                            )
                          }
                          title={
                            <Space>
                              <span>{app.name}</span>
                              <Tag color={app.status === "published" ? "green" : "orange"}>
                                {app.status === "published" ? "已发布" : "未发布"}
                              </Tag>
                            </Space>
                          }
                          description={
                            <div>
                              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 4 }}>
                                创建时间: {dayjs(app.createdAt).format("YYYY-MM-DD HH:mm")}
                              </Text>
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                更新时间: {dayjs(app.updatedAt).format("YYYY-MM-DD HH:mm")}
                              </Text>
                            </div>
                          }
                        />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* 右下角圆形悬浮客服（宜搭式）：收起仅圆钮，点击展开上方面板 */}
      <div className="home-cs-fab-wrap">
        {customerServiceOpen ? (
          <div className="home-cs-popover">
            <div className="home-cs-panel-head">
              <Space>
                <CustomerServiceOutlined style={{ color: "#597ef7" }} />
                <Typography.Text strong>在线客服</Typography.Text>
              </Space>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                aria-label="收起客服"
                onClick={() => setCustomerServiceOpen(false)}
              />
            </div>
            <div className="home-cs-panel-body">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                如需帮助，可查看帮助中心文档；人工客服接入能力后续开放。
              </Typography.Paragraph>
              <Button type="link" style={{ padding: 0 }} onClick={() => navigate("/docs/user")}>
                打开使用文档
              </Button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="home-cs-fab"
          title={customerServiceOpen ? "收起" : "客服"}
          aria-expanded={customerServiceOpen}
          onClick={() => setCustomerServiceOpen((v) => !v)}
        >
          <CustomerServiceOutlined style={{ fontSize: 26 }} />
        </button>
      </div>

      {/* 租户切换弹窗 */}
      <Modal
        title="切换租户"
        open={tenantSwitchOpen}
        onCancel={() => setTenantSwitchOpen(false)}
        confirmLoading={tenantSwitchLoading}
        onOk={() => void handleTenantSwitchConfirm()}
        okText="切换"
      >
        <Select
          value={targetTenantId ?? undefined}
          onChange={(v) => setTargetTenantId(String(v))}
          style={{ width: "100%" }}
          placeholder="请选择要切换的租户"
          options={tenantOptions.map((t) => ({
            label: t.name ? (t.code ? `${t.name}(${t.code})` : t.name) : (t.code ? t.code : t.id),
            value: t.id,
          }))}
        />
      </Modal>

      <CreateAppModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
      />
    </div>
  );
};

