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
  Table,
  message,
  Popconfirm,
  Empty,
  Spin,
} from "antd";
import {
  ArrowLeftOutlined,
  PlusOutlined,
  EditOutlined,
  EyeOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { applicationApi } from "@/api/application";
import { formDefinitionApi } from "@/api/formDefinition";
import { usePageTitle } from "@/hooks/usePageTitle";
import dayjs from "dayjs";
import "./AppManagementPage.css";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

export const AppManagementPage = () => {
  usePageTitle("页面管理 - 墨枫低代码平台");
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();

  // 获取应用信息
  const { data: appInfo, isLoading: appLoading } = useQuery({
    queryKey: ["application", appId],
    queryFn: () => applicationApi.getById(appId!),
    enabled: !!appId,
  });

  // 获取应用下的表单列表
  const { data: forms, isLoading: formsLoading, refetch } = useQuery({
    queryKey: ["applicationForms", appId],
    queryFn: () => formDefinitionApi.getListByApplication(appId!),
    enabled: !!appId,
  });

  const handleCreateForm = () => {
    // 创建新表单，跳转到设计器
    navigate(`/designer?appId=${appId}`);
  };

  const handleEditForm = (formId: string) => {
    navigate(`/designer?appId=${appId}&formId=${formId}`);
  };

  // 点击表单名称，直接进入数据列表
  const handleFormClick = (formId: string) => {
    // 跳转到数据列表页面，使用应用ID和表单ID
    navigate(`/app/${appId}/data?formId=${formId}`);
  };

  const handleDeleteForm = async (formId: string) => {
    try {
      await formDefinitionApi.delete(formId);
      message.success("删除成功");
      refetch();
    } catch (error: any) {
      message.error(error.response?.data?.message || "删除失败，请重试");
    }
  };

  const columns = [
    {
      title: "表单名称",
      dataIndex: "formName",
      key: "formName",
      render: (text: string, record: any) => (
        <Space>
          <FileTextOutlined style={{ color: "#1890ff" }} />
          <span 
            style={{ cursor: "pointer", color: "#1890ff" }}
            onClick={() => handleFormClick(record.formId)}
          >
            {text}
          </span>
          <Tag color={record.status === "published" ? "green" : "orange"}>
            {record.status === "published" ? "已发布" : "草稿"}
          </Tag>
        </Space>
      ),
    },
    {
      title: "表单ID",
      dataIndex: "formId",
      key: "formId",
      ellipsis: true,
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      render: (date: string) => dayjs(date).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "action",
      width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditForm(record.formId)}
          >
            设计表单
          </Button>
          <Popconfirm
            title="确定要删除这个表单吗？"
            description="删除后无法恢复，请谨慎操作"
            onConfirm={() => handleDeleteForm(record.formId)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (appLoading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!appInfo) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Text>应用不存在</Text>
        <Button onClick={() => navigate("/home")} style={{ marginTop: 16 }}>
          返回首页
        </Button>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <Header className="app-management-header">
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
                {appInfo.name}
              </Title>
              <Tag color={appInfo.status === "published" ? "green" : "orange"}>
                {appInfo.status === "published" ? "已发布" : "草稿"}
              </Tag>
            </Space>
          </Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateForm}
          >
            新建表单
          </Button>
        </Space>
      </Header>

      <Content style={{ padding: "24px" }}>
        <Card>
          <div style={{ marginBottom: 16 }}>
            <Title level={5}>表单列表</Title>
            <Text type="secondary">
              应用内可以创建多个表单，每个表单由字段组成，可以收集和存储数据
            </Text>
          </div>

          {formsLoading ? (
            <div style={{ textAlign: "center", padding: 50 }}>
              <Spin size="large" />
            </div>
          ) : !forms || forms.length === 0 ? (
            <Empty
              description="该应用下还没有表单"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateForm}>
                创建第一个表单
              </Button>
            </Empty>
          ) : (
            <Table
              columns={columns}
              dataSource={forms}
              rowKey="formId"
              onRow={(record) => ({
                onClick: () => handleFormClick(record.formId),
                style: { cursor: "pointer" },
              })}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 个表单`,
              }}
            />
          )}
        </Card>
      </Content>
    </Layout>
  );
};

