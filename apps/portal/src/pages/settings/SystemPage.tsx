import { Card, Tabs, Typography } from "antd";
import { SettingOutlined, DatabaseOutlined, BellOutlined, SecurityScanOutlined, AppstoreOutlined, ApiOutlined, UserOutlined } from "@ant-design/icons";
import { AmapKeyManagementPage } from "./AmapKeyManagementPage";
import { DingtalkIntegrationPage } from "./DingtalkIntegrationPage";
import { UserManagementPage } from "./UserManagementPage";
import "./SettingsPage.css";

const { Title } = Typography;

export const SystemPage = () => {
  const items = [
    {
      label: (
        <span>
          <SettingOutlined />
          基础设置
        </span>
      ),
      key: "basic",
      children: <p>系统基础配置</p>,
    },
    {
      label: (
        <span>
          <AppstoreOutlined />
          API Key管理
        </span>
      ),
      key: "apikey",
      children: <AmapKeyManagementPage />,
    },
    {
      label: (
        <span>
          <DatabaseOutlined />
          数据管理
        </span>
      ),
      key: "data",
      children: <p>数据备份与恢复</p>,
    },
    {
      label: (
        <span>
          <BellOutlined />
          通知设置
        </span>
      ),
      key: "notification",
      children: <p>系统通知配置</p>,
    },
    {
      label: (
        <span>
          <SecurityScanOutlined />
          安全设置
        </span>
      ),
      key: "security",
      children: <p>安全策略配置</p>,
    },
    {
      label: (
        <span>
          <ApiOutlined />
          钉钉集成
        </span>
      ),
      key: "dingtalk",
      children: <DingtalkIntegrationPage />,
    },
    {
      label: (
        <span>
          <UserOutlined />
          用户管理
        </span>
      ),
      key: "users",
      children: <UserManagementPage />,
    },
  ];

  return (
    <div className="settings-page">
      <Card>
        <Title level={4}>系统管理</Title>
        <Tabs defaultActiveKey="apikey" items={items} />
      </Card>
    </div>
  );
};

