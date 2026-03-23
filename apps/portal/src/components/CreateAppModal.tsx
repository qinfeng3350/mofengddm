import { useState } from "react";
import { Modal, Space, Card, Row, Col, Typography } from "antd";
import {
  ThunderboltOutlined,
  FileAddOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { CreateAppNameModal } from "./CreateAppNameModal";

const { Title, Text } = Typography;

interface CreateAppModalProps {
  open: boolean;
  onCancel: () => void;
}

export const CreateAppModal = ({ open, onCancel }: CreateAppModalProps) => {
  const navigate = useNavigate();
  const [nameModalOpen, setNameModalOpen] = useState(false);

  const handleCreateBlank = () => {
    setNameModalOpen(true);
  };

  const handleNameSubmit = (appId: string) => {
    setNameModalOpen(false);
    onCancel();
    navigate(`/app/${appId}`);
  };

  const handleIntelligentCreate = () => {
    // TODO: 实现智能创建
    console.log("智能创建应用");
  };

  const handleImportFromExcel = () => {
    // TODO: 实现从Excel导入
    console.log("从Excel创建应用");
  };

  return (
    <Modal
      title="创建应用"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={900}
      centered
    >
      <div style={{ marginBottom: 24 }}>
        <Text type="secondary">
          你可以选择创建空白应用，也可以选择智能创建或从Excel导入来创建应用！
        </Text>
      </div>

      <Space direction="vertical" size="large" style={{ width: "100%" }}>
        <Row gutter={16}>
          <Col span={8}>
            <Card
              hoverable
              style={{ textAlign: "center", height: "100%" }}
              onClick={handleIntelligentCreate}
            >
              <ThunderboltOutlined
                style={{ fontSize: 48, color: "#722ed1", marginBottom: 16 }}
              />
              <Title level={5}>智能创建应用</Title>
              <Text type="secondary">AI辅助快速生成应用</Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card
              hoverable
              style={{ textAlign: "center", height: "100%" }}
              onClick={handleCreateBlank}
            >
              <FileAddOutlined
                style={{ fontSize: 48, color: "#1890ff", marginBottom: 16 }}
              />
              <Title level={5}>创建空白应用</Title>
              <Text type="secondary">从零开始设计应用</Text>
            </Card>
          </Col>
          <Col span={8}>
            <Card
              hoverable
              style={{ textAlign: "center", height: "100%" }}
              onClick={handleImportFromExcel}
            >
              <FileExcelOutlined
                style={{ fontSize: 48, color: "#52c41a", marginBottom: 16 }}
              />
              <Title level={5}>从Excel创建应用</Title>
              <Text type="secondary">导入Excel表格生成应用</Text>
            </Card>
          </Col>
        </Row>
      </Space>

      <CreateAppNameModal
        open={nameModalOpen}
        onCancel={() => setNameModalOpen(false)}
        onSuccess={handleNameSubmit}
      />
    </Modal>
  );
};

