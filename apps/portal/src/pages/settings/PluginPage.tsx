import { Card, Row, Col, Typography, Button, Tag } from "antd";
import { AppstoreOutlined, DownloadOutlined } from "@ant-design/icons";
import "./SettingsPage.css";

const { Title, Text } = Typography;

export const PluginPage = () => {
  const plugins = [
    {
      id: 1,
      name: "Excel导入导出",
      description: "支持Excel文件的导入和导出功能",
      status: "installed",
    },
    {
      id: 2,
      name: "邮件通知",
      description: "支持邮件发送和通知功能",
      status: "available",
    },
    {
      id: 3,
      name: "短信通知",
      description: "支持短信发送功能",
      status: "available",
    },
  ];

  return (
    <div className="settings-page">
      <Card>
        <Title level={4}>插件中心</Title>
        <Row gutter={[16, 16]}>
          {plugins.map((plugin) => (
            <Col xs={24} sm={12} md={8} key={plugin.id}>
              <Card
                hoverable
                actions={[
                  plugin.status === "installed" ? (
                    <Button type="link" disabled>
                      已安装
                    </Button>
                  ) : (
                    <Button type="primary" icon={<DownloadOutlined />}>
                      安装
                    </Button>
                  ),
                ]}
              >
                <Card.Meta
                  avatar={<AppstoreOutlined style={{ fontSize: 32, color: "#1890ff" }} />}
                  title={
                    <Space>
                      <span>{plugin.name}</span>
                      {plugin.status === "installed" && <Tag color="green">已安装</Tag>}
                    </Space>
                  }
                  description={<Text type="secondary">{plugin.description}</Text>}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

