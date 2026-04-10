import { Card, Typography, Space, Button } from "antd";
import { ArrowLeftOutlined, DesktopOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import "./SettingsPage.css";

const { Title, Paragraph, Text } = Typography;

/** 首页工作台下拉中的「工作台设置」落地页（后续可接布局、快捷入口、组件显隐等配置） */
export const WorkbenchSettingsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="settings-page">
      <Card>
        <Space direction="vertical" size="middle" style={{ width: "100%" }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate("/home")}>
            返回首页
          </Button>
          <Space align="start">
            <DesktopOutlined style={{ fontSize: 24, color: "#1890ff" }} />
            <div>
              <Title level={4} style={{ margin: 0 }}>
                工作台设置
              </Title>
              <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
                在此配置工作台展示方式，例如：常用入口、待办与流程卡片、我的应用分组等。当前为占位页面，保存后将与首页联动。
              </Paragraph>
            </div>
          </Space>
          <Text type="secondary">功能开发中，敬请期待。</Text>
        </Space>
      </Card>
    </div>
  );
};
