import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Layout,
  Button,
  Card,
  Row,
  Col,
  Typography,
  Space,
  Tag,
  Input,
  Menu,
  Divider,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  HomeOutlined,
  AppstoreOutlined,
  DashboardOutlined,
  LinkOutlined,
  PlusOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  UserOutlined,
  SendOutlined,
  FolderOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { formDefinitionApi } from "@/api/formDefinition";
import "./AppPagesPage.css";

const { Header, Sider, Content } = Layout;
const { Title, Text } = Typography;

export const AppPagesPage = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("pages");

  const { data: appInfo } = useQuery({
    queryKey: ["formDefinition", appId],
    queryFn: () => formDefinitionApi.getById(appId!),
    enabled: !!appId,
  });

  const pageTypes = [
    {
      icon: <ThunderboltOutlined style={{ fontSize: 32, color: "#722ed1" }} />,
      title: "智能生成页面",
      desc: "对话生成智能表单/门户等",
      onClick: () => {
        // TODO: 智能生成
        console.log("智能生成页面");
      },
    },
    {
      icon: <FileTextOutlined style={{ fontSize: 32, color: "#1890ff" }} />,
      title: "新建普通表单",
      desc: "数据收集、事件跟进",
      onClick: () => {
        navigate(`/designer?formId=${appId}&type=form`);
      },
    },
    {
      icon: <ApartmentOutlined style={{ fontSize: 32, color: "#1890ff" }} />,
      title: "新建流程表单",
      desc: "业务审批、任务协同",
      onClick: () => {
        navigate(`/designer?formId=${appId}&type=workflow`);
      },
    },
    {
      icon: <BarChartOutlined style={{ fontSize: 32, color: "#52c41a" }} />,
      title: "新建报表",
      desc: "数据分析、报表展示",
      onClick: () => {
        // TODO: 报表设计器
        console.log("新建报表");
      },
    },
    {
      icon: <DashboardOutlined style={{ fontSize: 32, color: "#52c41a" }} />,
      title: "新建仪表盘",
      desc: "数据统计、分析及可视化呈现",
      onClick: () => {
        // TODO: 仪表盘设计器
        message.info("仪表盘功能开发中");
      },
    },
    {
      icon: <HomeOutlined style={{ fontSize: 32, color: "#722ed1" }} />,
      title: "新建可播报门户",
      desc: "可视化搭建会播报的门户",
      onClick: () => {
        // TODO: 门户设计器
        console.log("新建门户");
      },
    },
    {
      icon: <AppstoreOutlined style={{ fontSize: 32, color: "#fa8c16" }} />,
      title: "新建自定义页面",
      desc: "信息展示及导航、门户页面",
      onClick: () => {
        // TODO: 自定义页面
        console.log("新建自定义页面");
      },
    },
    {
      icon: <DashboardOutlined style={{ fontSize: 32, color: "#52c41a" }} />,
      title: "新建大屏",
      desc: "业务数字化酷炫大屏",
      onClick: () => {
        // TODO: 大屏设计器
        console.log("新建大屏");
      },
    },
    {
      icon: <LinkOutlined style={{ fontSize: 32, color: "#ff4d4f" }} />,
      title: "添加外部链接",
      desc: "从本站点链接到外部",
      onClick: () => {
        // TODO: 外部链接
        console.log("添加外部链接");
      },
    },
  ];

  const commonControls = [
    { icon: <FileTextOutlined />, label: "新建普通表单" },
    { icon: <ApartmentOutlined />, label: "新建流程表单" },
    { icon: <BarChartOutlined />, label: "新建报表" },
    { icon: <HomeOutlined />, label: "新建可播报门户" },
    { icon: <FolderOutlined />, label: "新建分组" },
  ];

  const advancedControls = [
    { icon: <AppstoreOutlined />, label: "新建自定义页面" },
    { icon: <DashboardOutlined />, label: "新建大屏" },
    { icon: <LinkOutlined />, label: "新增外部链接" },
  ];

  if (!appId) {
    return <div>应用ID不存在</div>;
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header className="app-pages-header">
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate("/home")}
            >
              返回
            </Button>
            <Space>
              <Title level={4} style={{ margin: 0 }}>
                {appInfo?.formName || "未命名应用"}
              </Title>
              <Tag color="green">已启用</Tag>
            </Space>
          </Space>
          <Space>
            <Button type="text" icon={<QuestionCircleOutlined />} />
            <Button>访问</Button>
          </Space>
        </Space>

        <div className="app-tabs">
          <Button
            type={activeTab === "pages" ? "link" : "text"}
            onClick={() => setActiveTab("pages")}
            className={activeTab === "pages" ? "active-tab" : ""}
          >
            页面管理
          </Button>
          <Button
            type={activeTab === "integration" ? "link" : "text"}
            onClick={() => setActiveTab("integration")}
            className={activeTab === "integration" ? "active-tab" : ""}
          >
            集成&自动化
          </Button>
          <Button
            type={activeTab === "settings" ? "link" : "text"}
            onClick={() => setActiveTab("settings")}
            className={activeTab === "settings" ? "active-tab" : ""}
          >
            应用设置
          </Button>
          <Button
            type={activeTab === "publish" ? "link" : "text"}
            onClick={() => setActiveTab("publish")}
            className={activeTab === "publish" ? "active-tab" : ""}
          >
            应用发布
          </Button>
        </div>
      </Header>

      <Layout>
        <Sider width={240} className="app-pages-sider">
          <div className="sider-search">
            <Input
              placeholder="搜索"
              prefix={<SearchOutlined />}
              suffix={
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => {
                    // TODO: 显示创建页面菜单
                    console.log("创建页面");
                  }}
                />
              }
            />
          </div>

          <div className="sider-nav">
            <div className="nav-item">
              <ClockCircleOutlined />
              <span>待我处理</span>
            </div>
            <div className="nav-item">
              <UserOutlined />
              <span>我已处理</span>
            </div>
            <div className="nav-item">
              <UserOutlined />
              <span>我创建的</span>
            </div>
            <div className="nav-item">
              <SendOutlined />
              <span>抄送我的</span>
            </div>
          </div>

          <Divider style={{ margin: "16px 0" }} />

          <div className="sider-pages">
            <Text type="secondary" style={{ padding: "0 16px", fontSize: 12 }}>
              新建页面会在这里
            </Text>
            <div className="page-placeholders">
              <div className="page-placeholder" />
              <div className="page-placeholder" />
              <div className="page-placeholder" />
            </div>
          </div>

          <Divider style={{ margin: "16px 0" }} />

          <div className="sider-controls">
            <Text strong style={{ padding: "0 16px", fontSize: 12 }}>
              常用
            </Text>
            <Menu mode="inline" className="control-menu">
              {commonControls.map((control, index) => (
                <Menu.Item key={`common-${index}`} icon={control.icon}>
                  {control.label}
                </Menu.Item>
              ))}
            </Menu>

            <Text strong style={{ padding: "0 16px", fontSize: 12, marginTop: 16, display: "block" }}>
              高级
            </Text>
            <Menu mode="inline" className="control-menu">
              {advancedControls.map((control, index) => (
                <Menu.Item key={`advanced-${index}`} icon={control.icon}>
                  {control.label}
                </Menu.Item>
              ))}
            </Menu>
          </div>

          <div className="sider-footer">
            <Button
              type="text"
              icon={<QuestionCircleOutlined />}
              style={{ width: "100%", textAlign: "left" }}
            >
              了解页面类型
            </Button>
          </div>
        </Sider>

        <Content className="app-pages-content">
          {activeTab === "pages" && (
            <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px" }}>
              <div style={{ marginBottom: 24, textAlign: "center" }}>
                <Title level={3}>从创建第一个页面开始,构建应用</Title>
                <Text type="secondary">
                  表单、报表、展示页,从哪开始?{" "}
                  <a href="#">点击了解更多</a>
                </Text>
              </div>

              <Row gutter={[16, 16]}>
                {pageTypes.map((pageType, index) => (
                  <Col xs={24} sm={12} md={8} lg={6} key={index}>
                    <Card
                      hoverable
                      style={{ textAlign: "center", height: "100%" }}
                      onClick={pageType.onClick}
                    >
                      <div style={{ marginBottom: 16 }}>{pageType.icon}</div>
                      <Title level={5}>{pageType.title}</Title>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {pageType.desc}
                      </Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          )}

          {activeTab === "integration" && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <Text type="secondary">集成&自动化功能开发中...</Text>
            </div>
          )}

          {activeTab === "settings" && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <Text type="secondary">应用设置功能开发中...</Text>
            </div>
          )}

          {activeTab === "publish" && (
            <div style={{ padding: 24, textAlign: "center" }}>
              <Text type="secondary">应用发布功能开发中...</Text>
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};
