import { useState } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Avatar,
  Input,
  Select,
  Modal,
  Form,
  message,
  Popconfirm,
  Descriptions,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { departmentApi } from "@/api/department";
import "./SettingsPage.css";

const { Title, Text } = Typography;
const { Search } = Input;

interface User {
  id: string;
  name: string;
  account: string;
  email?: string;
  phone?: string;
  avatar?: string;
  position?: string;
  jobNumber?: string;
  departmentId?: string;
  department?: {
    id: string;
    name: string;
  };
  tenantId: string;
}

export const UserManagementPage = () => {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 获取用户列表
  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["users", searchKeyword],
    queryFn: async () => {
      const params = searchKeyword ? { keyword: searchKeyword } : {};
      const res = await apiClient.get<User[]>("/users", { params });
      return Array.isArray(res) ? res : [];
    },
  });

  // 获取部门列表
  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      return departmentApi.getDepartments();
    },
  });

  const departments = departmentsData?.data || [];

  // 获取租户信息（从当前用户）
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/auth/profile");
        return res;
      } catch {
        return null;
      }
    },
  });

  const handleViewDetail = (user: User) => {
    setSelectedUser(user);
    setDetailModalVisible(true);
  };

  const columns = [
    {
      title: "头像",
      dataIndex: "avatar",
      key: "avatar",
      width: 80,
      render: (avatar: string, record: User) => (
        <Avatar
          src={avatar}
          icon={<UserOutlined />}
          style={{ backgroundColor: "#87d068" }}
        >
          {record.name?.[0]}
        </Avatar>
      ),
    },
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 120,
    },
    {
      title: "账号",
      dataIndex: "account",
      key: "account",
      width: 150,
    },
    {
      title: "手机号",
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (phone: string) => phone || <Text type="secondary">-</Text>,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 200,
      render: (email: string) => email || <Text type="secondary">-</Text>,
    },
    {
      title: "职位",
      dataIndex: "position",
      key: "position",
      width: 120,
      render: (position: string) => position || <Text type="secondary">-</Text>,
    },
    {
      title: "部门",
      dataIndex: "department",
      key: "department",
      width: 150,
      render: (department: User["department"]) =>
        department ? (
          <Tag color="blue" icon={<TeamOutlined />}>
            {department.name}
          </Tag>
        ) : (
          <Text type="secondary">未分配</Text>
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      fixed: "right" as const,
      render: (_: any, record: User) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="settings-page">
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            用户管理
          </Title>
          <Space>
            <Search
              placeholder="搜索用户（姓名/账号/邮箱）"
              allowClear
              style={{ width: 300 }}
              onSearch={(value) => setSearchKeyword(value)}
              enterButton={<SearchOutlined />}
            />
          </Space>
        </div>

        {/* 租户信息 */}
        {currentUser && (
          <Card
            size="small"
            style={{ marginBottom: 16, backgroundColor: "#f5f5f5" }}
          >
            <Descriptions column={3} size="small">
              <Descriptions.Item label="当前租户">
                <Tag color="blue">
                  {currentUser.tenant?.name || currentUser.tenant?.code || `租户ID: ${currentUser.tenantId || "未知"}`}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="当前用户">
                {currentUser.name || currentUser.account}
              </Descriptions.Item>
              <Descriptions.Item label="总用户数">
                <Tag color="green">{users.length} 人</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Table
          columns={columns}
          dataSource={users}
          rowKey="id"
          loading={isLoading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>

      {/* 用户详情弹窗 */}
      <Modal
        title="用户详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedUser(null);
        }}
        footer={null}
        width={600}
      >
        {selectedUser && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="头像">
              <Avatar
                src={selectedUser.avatar}
                icon={<UserOutlined />}
                size={64}
                style={{ backgroundColor: "#87d068" }}
              >
                {selectedUser.name?.[0]}
              </Avatar>
            </Descriptions.Item>
            <Descriptions.Item label="姓名">{selectedUser.name}</Descriptions.Item>
            <Descriptions.Item label="账号">{selectedUser.account}</Descriptions.Item>
            <Descriptions.Item label="手机号">
              {selectedUser.phone || <Text type="secondary">未设置</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="邮箱">
              {selectedUser.email || <Text type="secondary">未设置</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="职位">
              {selectedUser.position || <Text type="secondary">未设置</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="工号">
              {selectedUser.jobNumber || <Text type="secondary">未设置</Text>}
            </Descriptions.Item>
            <Descriptions.Item label="部门">
              {selectedUser.department ? (
                <Tag color="blue" icon={<TeamOutlined />}>
                  {selectedUser.department.name}
                </Tag>
              ) : (
                <Text type="secondary">未分配</Text>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="租户ID">
              <Tag>{selectedUser.tenantId}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

