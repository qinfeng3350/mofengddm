import { Card, Row, Col, Typography, Button } from "antd";
import { FileTextOutlined, DownloadOutlined } from "@ant-design/icons";
import "./SettingsPage.css";

const { Title, Text } = Typography;

export const TemplatePage = () => {
  const templates = [
    {
      id: 1,
      name: "员工信息管理",
      description: "用于管理员工基本信息的表单模板",
      category: "人事管理",
    },
    {
      id: 2,
      name: "请假申请",
      description: "员工请假申请流程表单",
      category: "流程审批",
    },
    {
      id: 3,
      name: "客户管理",
      description: "客户信息管理和跟进表单",
      category: "客户管理",
    },
  ];

  return (
    <div className="settings-page">
      <Card>
        <Title level={4}>模板中心</Title>
        <Row gutter={[16, 16]}>
          {templates.map((template) => (
            <Col xs={24} sm={12} md={8} key={template.id}>
              <Card
                hoverable
                actions={[
                  <Button type="primary" icon={<DownloadOutlined />}>
                    使用模板
                  </Button>,
                ]}
              >
                <Card.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 32, color: "#1890ff" }} />}
                  title={template.name}
                  description={
                    <div>
                      <Text type="secondary">{template.description}</Text>
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {template.category}
                        </Text>
                      </div>
                    </div>
                  }
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  );
};

