import { Card, Typography, Button, Space, Tag } from "antd";
import { ThunderboltOutlined, RobotOutlined } from "@ant-design/icons";
import "./SettingsPage.css";

const { Title, Paragraph } = Typography;

export const AIPage = () => {
  return (
    <div className="settings-page">
      <Card>
        <Space direction="vertical" size="large" style={{ width: "100%" }}>
          <div>
            <Title level={4}>
              <ThunderboltOutlined /> AI能力中心
            </Title>
            <Tag color="red">NEW</Tag>
          </div>
          <Paragraph>
            AI能力中心提供智能化的应用生成、数据分析、内容生成等功能，让低代码开发更智能、更高效。
          </Paragraph>
          <div>
            <Title level={5}>可用功能</Title>
            <Space direction="vertical" style={{ width: "100%" }}>
              <Card size="small">
                <Space>
                  <RobotOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>智能表单生成</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      通过自然语言描述自动生成表单结构
                    </div>
                  </div>
                </Space>
              </Card>
              <Card size="small">
                <Space>
                  <RobotOutlined style={{ fontSize: 24, color: "#52c41a" }} />
                  <div>
                    <div style={{ fontWeight: 500 }}>智能数据分析</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      自动分析数据趋势和生成报表
                    </div>
                  </div>
                </Space>
              </Card>
            </Space>
          </div>
          <Button type="primary" size="large">
            开始使用AI功能
          </Button>
        </Space>
      </Card>
    </div>
  );
};

