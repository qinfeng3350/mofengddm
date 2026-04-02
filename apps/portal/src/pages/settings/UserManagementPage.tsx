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
  message,
  Descriptions,
} from "antd";
import {
  UserOutlined,
  EditOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  status: number;
}

export const UserManagementPage = () => {
  const queryClient = useQueryClient();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // 获取用户列表（含停用用户，便于配额管理）
  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["users", searchKeyword, "adminAll"],
    queryFn: async () => {
      const params: Record<string, string> = { includeDisabled: "true" };
      if (searchKeyword) params.keyword = searchKeyword;
      const res = await apiClient.get<User[]>("/users", { params });
      return Array.isArray(res) ? res : [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: number }) => {
      return apiClient.patch<User>(`/users/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      message.success("已更新用户状态");
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "更新失败（若已达启用人数上限，请先停用其他用户）";
      message.error(msg);
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
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (status: number, record: User) => (
        <Select
          size="small"
          style={{ width: 96 }}
          value={status === 1 ? 1 : 0}
          loading={statusMutation.isPending && statusMutation.variables?.id === record.id}
          disabled={statusMutation.isPending}
          onChange={(v) => statusMutation.mutate({ id: record.id, status: v })}
          options={[
            { value: 1, label: "启用" },
            { value: 0, label: "停用" },
          ]}
        />
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
              <Descriptions.Item label="用户数">
                <Space size={8}>
                  <Tag color="green">
                    启用 {users.filter((u) => u.status === 1).length} 人
                  </Tag>
                  <Tag>总计 {users.length} 人</Tag>
                </Space>
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
            <Descriptions.Item label="状态">
              {selectedUser.status === 1 ? (
                <Tag color="success">启用</Tag>
              ) : (
                <Tag>停用</Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

