import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout, Card, Typography, Space, Button, List, Input, Row, Col, Statistic, Divider, message, Popconfirm, Spin, Empty, Switch } from "antd";
import {
  LeftOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  SyncOutlined,
  SendOutlined,
  CopyOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { applicationApi } from "@/api/application";
import { formDefinitionApi } from "@/api/formDefinition";
import { formDataApi } from "@/api/formData";
import { renderIcon } from "@/utils/iconRenderer";
import dayjs from "dayjs";
import "./AppConfigPage.css";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

export const AppConfigPage = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editingAppName, setEditingAppName] = useState(false);
  const [appNameValue, setAppNameValue] = useState("");
  const [activeMenu, setActiveMenu] = useState("基础信息");

  const { data: appInfo, isLoading } = useQuery({
    queryKey: ["application", appId],
    queryFn: () => applicationApi.getById(appId!),
    enabled: !!appId,
  });

  const { data: forms } = useQuery({
    queryKey: ["forms", appId],
    queryFn: async () => {
      if (!appId) return [];
      // 获取该应用下的所有表单
      const allForms = await formDefinitionApi.getList();
      return allForms.filter((form: any) => form.applicationId === appId);
    },
    enabled: !!appId,
  });

  // 获取总数据量（所有表单的数据总和）
  const { data: totalDataCount } = useQuery({
    queryKey: ["totalDataCount", appId],
    queryFn: async () => {
      if (!forms || forms.length === 0) return 0;
      let total = 0;
      for (const form of forms) {
        try {
          const data = await formDataApi.getListByForm(form.formId);
          total += data?.length || 0;
        } catch (error) {
          console.error(`获取表单 ${form.formId} 数据失败:`, error);
        }
      }
      return total;
    },
    enabled: !!forms && forms.length > 0,
  });

  // 当appInfo变化时更新appNameValue
  useEffect(() => {
    if (appInfo) {
      setAppNameValue(appInfo.name);
    }
  }, [appInfo]);

  const handleAppNameEdit = () => {
    setEditingAppName(true);
  };

  const handleAppNameSave = async () => {
    if (!appId || !appNameValue.trim()) {
      message.warning("应用名称不能为空");
      return;
    }
    try {
      await applicationApi.update(appId, { name: appNameValue.trim() });
      message.success("应用名称更新成功");
      setEditingAppName(false);
    } catch (error) {
      message.error("更新失败，请重试");
      console.error(error);
    }
  };

  const handleAppNameCancel = () => {
    setAppNameValue(appInfo?.name || "");
    setEditingAppName(false);
  };

  const handleDeleteApp = async () => {
    if (!appId) return;
    try {
      await applicationApi.delete(appId);
      message.success("删除成功");
      navigate("/home");
    } catch (error: any) {
      message.error(error.response?.data?.message || "删除失败，请重试");
    }
  };

  const handleCopyApp = () => {
    message.info("复制应用功能待实现");
  };

  const menuItems = [
    { key: "基础信息", label: "基础信息", icon: <SendOutlined /> },
    { key: "自动化", label: "业务规则与自动化", icon: <ThunderboltOutlined /> },
    { key: "汇总计算", label: "汇总计算", icon: <SyncOutlined /> },
    { key: "应用发布", label: "应用发布", icon: <SendOutlined /> },
    { key: "复制应用", label: "复制应用", icon: <CopyOutlined /> },
    { key: "删除应用", label: "删除应用", icon: <DeleteOutlined />, danger: true },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!appInfo) {
    return <div>应用不存在</div>;
  }

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Layout style={{ background: "#fff" }}>
        {/* 左侧边栏 */}
        <Sider
          width={200}
          style={{
            background: "#fff",
            borderRight: "1px solid #f0f0f0",
            padding: "16px 0",
          }}
        >
          <div style={{ padding: "0 16px", marginBottom: 16 }}>
            <Button
              type="text"
              icon={<LeftOutlined />}
              onClick={() => navigate(`/app/${appId}`)}
              style={{ marginBottom: 8 }}
            >
              返回
            </Button>
            <div style={{ fontSize: 14, fontWeight: 500, color: "#8c8c8c" }}>
              应用配置
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
              {appInfo.name}
            </div>
          </div>
          <List
            dataSource={menuItems}
            renderItem={(item) => (
              <List.Item
                style={{
                  padding: "12px 24px",
                  cursor: "pointer",
                  backgroundColor: activeMenu === item.key ? "#e6f7ff" : "transparent",
                  borderLeft: activeMenu === item.key ? "3px solid #1890ff" : "3px solid transparent",
                }}
                onClick={() => {
                  if (item.key === "删除应用") {
                    // 删除操作由Popconfirm处理，不切换菜单
                    return;
                  }
                  if (item.key === "复制应用") {
                    handleCopyApp();
                    return;
                  }
                  if (item.key === "自动化") {
                    // 跳转到业务规则页面
                    navigate(`/app/${appId}/rules`);
                    return;
                  }
                  setActiveMenu(item.key);
                }}
              >
                <Space>
                  <span style={{ color: item.danger ? "#ff4d4f" : "#595959" }}>
                    {item.icon}
                  </span>
                  <span style={{ color: item.danger ? "#ff4d4f" : "#595959" }}>
                    {item.label}
                  </span>
                </Space>
              </List.Item>
            )}
          />
        </Sider>

        {/* 主内容区 */}
        <Content style={{ padding: "24px", background: "#f5f5f5" }}>
          {activeMenu === "基础信息" && (
            <>
              {/* 应用详情卡片 */}
              <Card
                style={{
                  marginBottom: 24,
                  background: "linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)",
                }}
              >
                <Space size="large" align="start">
                  <div style={{ fontSize: 48, color: "#1890ff" }}>
                    {appInfo.metadata?.icon ? (
                      renderIcon(appInfo.metadata.icon as string, FileTextOutlined)
                    ) : (
                      <FileTextOutlined />
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    {editingAppName ? (
                      <Space>
                        <Input
                          value={appNameValue}
                          onChange={(e) => setAppNameValue(e.target.value)}
                          onPressEnter={handleAppNameSave}
                          onBlur={handleAppNameSave}
                          style={{ width: 200 }}
                          autoFocus
                        />
                        <Button size="small" onClick={handleAppNameCancel}>
                          取消
                        </Button>
                      </Space>
                    ) : (
                      <Space>
                        <Title level={3} style={{ margin: 0, fontSize: 20 }}>
                          {appInfo.name}
                        </Title>
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          size="small"
                          onClick={handleAppNameEdit}
                        />
                      </Space>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        应用编码: {appInfo.code || appInfo.id}
                      </Text>
                    </div>
                  </div>
                </Space>
              </Card>

              <Card title="列表与运行体验" style={{ marginBottom: 24 }}>
                <Space
                  align="start"
                  style={{ justifyContent: "space-between", width: "100%" }}
                >
                  <div style={{ flex: 1, paddingRight: 16 }}>
                    <Text strong>数据列表悬停显示流程状态</Text>
                    <div style={{ marginTop: 6 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        开启后，鼠标悬停在数据列表某一行约半秒，会弹出简要流程信息（当前节点、是否拒绝等）；不挡点击与勾选。
                      </Text>
                    </div>
                  </div>
                  <Switch
                    checked={
                      (appInfo.metadata as Record<string, unknown> | undefined)
                        ?.listWorkflowHoverPreview === true
                    }
                    onChange={async (checked) => {
                      if (!appId) return;
                      try {
                        await applicationApi.update(appId, {
                          metadata: {
                            ...(appInfo.metadata || {}),
                            listWorkflowHoverPreview: checked,
                          },
                        });
                        message.success(checked ? "已开启悬停流程提示" : "已关闭悬停流程提示");
                        await queryClient.invalidateQueries({
                          queryKey: ["application", appId],
                        });
                      } catch {
                        message.error("保存失败，请重试");
                      }
                    }}
                  />
                </Space>
              </Card>

              {/* 应用用量统计 */}
              <Card title="应用用量" style={{ marginBottom: 24 }}>
                <Row gutter={[16, 16]}>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="总数据量"
                        value={totalDataCount || 0}
                        suffix="条"
                        prefix={<DatabaseOutlined style={{ color: "#722ed1", fontSize: 24 }} />}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          更新时间: {dayjs().format("YYYY-MM-DD HH:mm")}
                        </Text>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="表单数量"
                        value={forms?.length || 0}
                        suffix="个"
                        prefix={<FileTextOutlined style={{ color: "#1890ff", fontSize: 24 }} />}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          更新时间: {dayjs().format("YYYY-MM-DD HH:mm")}
                        </Text>
                      </div>
                    </Card>
                  </Col>
                  <Col xs={24} sm={8}>
                    <Card>
                      <Statistic
                        title="汇总控件个数"
                        value={0}
                        suffix="个"
                        prefix={<SyncOutlined style={{ color: "#faad14", fontSize: 24 }} />}
                      />
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          更新时间: {dayjs().format("YYYY-MM-DD HH:mm")}
                        </Text>
                      </div>
                    </Card>
                  </Col>
                </Row>
              </Card>
            </>
          )}

          {activeMenu === "自动化" && (
            <Card>
              <Empty description="自动化功能开发中" />
            </Card>
          )}

          {activeMenu === "汇总计算" && (
            <Card>
              <Empty description="汇总计算功能开发中" />
            </Card>
          )}

          {activeMenu === "应用发布" && (
            <Card>
              <Empty description="应用发布功能开发中" />
            </Card>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

