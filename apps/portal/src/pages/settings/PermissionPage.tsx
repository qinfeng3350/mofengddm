import { Card, Table, Button, Space, Typography, Tag, message } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { useState } from "react";
import "./SettingsPage.css";

const { Title } = Typography;

export const PermissionPage = () => {
  const [loading, setLoading] = useState(false);

  // TODO: 从API获取权限列表
  const columns = [
    {
      title: "权限代码",
      dataIndex: "code",
      key: "code",
    },
    {
      title: "权限名称",
      dataIndex: "name",
      key: "name",
    },
    {
      title: "描述",
      dataIndex: "description",
      key: "description",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={status === "active" ? "green" : "red"}>{status === "active" ? "启用" : "禁用"}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} size="small">
            编辑
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} size="small">
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const data = [
    {
      key: "1",
      code: "form:create",
      name: "创建表单",
      description: "允许创建新表单",
      status: "active",
    },
    {
      key: "2",
      code: "form:edit",
      name: "编辑表单",
      description: "允许编辑表单",
      status: "active",
    },
    {
      key: "3",
      code: "form:delete",
      name: "删除表单",
      description: "允许删除表单",
      status: "active",
    },
  ];

  return (
    <div className="settings-page">
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            权限管理
          </Title>
          <Button type="primary" icon={<PlusOutlined />}>
            新建权限
          </Button>
        </div>
        <Table columns={columns} dataSource={data} loading={loading} />
      </Card>
    </div>
  );
};

