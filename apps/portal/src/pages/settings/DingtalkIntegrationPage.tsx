import { useState } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Space,
  message,
  Typography,
  Table,
  Tag,
  Divider,
  Alert,
  Spin,
  Tree,
} from "antd";
import {
  CheckCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { dingtalkApi, type DingtalkConfig, type DingtalkDepartment, type DingtalkUser } from "@/api/dingtalk";
import { useMutation, useQuery } from "@tanstack/react-query";
import "./SettingsPage.css";

const { Title, Text } = Typography;
const { TextArea } = Input;

export const DingtalkIntegrationPage = () => {
  const [form] = Form.useForm<DingtalkConfig>();
  const [config, setConfig] = useState<DingtalkConfig | null>(null);

  // Stream 通道状态（用于“Stream 模式推送”验证连接通道）
  const {
    data: streamStatus,
    isLoading: streamStatusLoading,
    refetch: refetchStreamStatus,
  } = useQuery({
    queryKey: ["dingtalk-stream-status"],
    queryFn: async () => {
      return dingtalkApi.getStreamStatus();
    },
    retry: false,
  });

  // 测试连接
  const testConnectionMutation = useMutation({
    mutationFn: async (values: DingtalkConfig) => {
      return dingtalkApi.testConnection(values);
    },
    onSuccess: (data) => {
      message.success("连接成功！");
      const values = form.getFieldsValue();
      setConfig(values);
      // 测试连接成功后自动刷新数据
      setTimeout(() => {
        refetchDepartments().catch((error) => {
          console.error("刷新部门列表失败:", error);
        });
        refetchUsers().catch((error) => {
          console.error("刷新用户列表失败:", error);
        });
      }, 100);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || "未知错误";
      message.error(`连接失败: ${errorMessage}`);
      console.error("测试连接失败:", error);
    },
  });

  // 获取部门列表
  const {
    data: departmentsData,
    isLoading: departmentsLoading,
    refetch: refetchDepartments,
    error: departmentsError,
  } = useQuery({
    queryKey: ["dingtalk-departments", config],
    queryFn: async () => {
      if (!config) throw new Error("请先配置并测试连接");
      return dingtalkApi.getAllDepartments(config);
    },
    enabled: !!config,
    retry: false,
  });

  // 获取用户列表
  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["dingtalk-users", config],
    queryFn: async () => {
      if (!config) throw new Error("请先配置并测试连接");
      return dingtalkApi.getAllUsers(config);
    },
    enabled: !!config,
    retry: false,
  });

  const handleTestConnection = async () => {
    try {
      const values = await form.validateFields();
      testConnectionMutation.mutate(values);
    } catch (error) {
      // 表单验证失败
    }
  };

  const handleLoadData = async () => {
    if (!config) {
      message.warning("请先配置并测试连接");
      return;
    }
    try {
      await Promise.all([refetchDepartments(), refetchUsers()]);
      if (departmentsError || usersError) {
        message.error(
          `刷新数据失败: ${departmentsError?.message || usersError?.message || "未知错误"}`
        );
      } else {
        message.success("数据刷新成功");
      }
    } catch (error: any) {
      message.error(`刷新数据失败: ${error?.message || "未知错误"}`);
    }
  };

  // 同步组织架构
  const syncOrganizationMutation = useMutation({
    mutationFn: async (values: DingtalkConfig) => {
      return dingtalkApi.syncOrganization(values);
    },
    onSuccess: (data) => {
      message.success(data.message || "同步成功！");
      // 同步成功后刷新数据
      setTimeout(() => {
        refetchDepartments().catch((error) => {
          console.error("刷新部门列表失败:", error);
        });
        refetchUsers().catch((error) => {
          console.error("刷新用户列表失败:", error);
        });
      }, 100);
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || "未知错误";
      message.error(`同步失败: ${errorMessage}`);
      console.error("同步组织架构失败:", error);
    },
  });

  const handleSyncOrganization = async () => {
    if (!config) {
      message.warning("请先配置并测试连接");
      return;
    }
    try {
      syncOrganizationMutation.mutate(config);
    } catch (error) {
      // 表单验证失败
    }
  };

  // 构建部门树形数据
  const buildDepartmentTree = (departments: DingtalkDepartment[]): any[] => {
    const deptMap = new Map<number, any>();
    const rootDepts: any[] = [];

    // 创建所有节点
    departments.forEach((dept) => {
      deptMap.set(dept.dept_id, {
        title: dept.name,
        key: dept.dept_id,
        dept_id: dept.dept_id,
        children: [],
      });
    });

    // 构建树形结构
    departments.forEach((dept) => {
      const node = deptMap.get(dept.dept_id);
      if (dept.parent_id === 0 || dept.parent_id === 1) {
        rootDepts.push(node);
      } else {
        const parent = deptMap.get(dept.parent_id);
        if (parent) {
          parent.children.push(node);
        } else {
          rootDepts.push(node);
        }
      }
    });

    return rootDepts;
  };

  const departmentTreeData = departmentsData?.data
    ? buildDepartmentTree(departmentsData.data)
    : [];

  const userColumns = [
    {
      title: "用户ID",
      dataIndex: "userid",
      key: "userid",
      width: 150,
    },
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      width: 120,
    },
    {
      title: "手机号",
      dataIndex: "mobile",
      key: "mobile",
      width: 130,
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 200,
    },
    {
      title: "职位",
      dataIndex: "position",
      key: "position",
      width: 150,
    },
    {
      title: "工号",
      dataIndex: "jobnumber",
      key: "jobnumber",
      width: 120,
    },
    {
      title: "部门",
      key: "dept_id_list",
      width: 200,
      render: (_: any, record: DingtalkUser) => {
        if (!record.dept_id_list || record.dept_id_list.length === 0) {
          return <Tag>-</Tag>;
        }
        return (
          <Space wrap>
            {record.dept_id_list.map((deptId) => {
              const dept = departmentsData?.data?.find(
                (d) => d.dept_id === deptId,
              );
              return (
                <Tag key={deptId} color="blue">
                  {dept?.name || deptId}
                </Tag>
              );
            })}
          </Space>
        );
      },
    },
  ];

  return (
    <div className="settings-page">
      <Card>
        <Title level={4}>钉钉集成</Title>
        <Alert
          title="配置说明"
          description="请在钉钉开放平台创建应用，获取 AppKey 和 AppSecret。确保应用已开通通讯录管理权限。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />
        <Alert
          loading={streamStatusLoading}
          type={
            streamStatus?.data?.connected
              ? "success"
              : streamStatus?.data?.enabled
                ? "warning"
                : "info"
          }
          showIcon
          style={{ marginBottom: 24 }}
          message={`Stream 通道：${
            streamStatus?.data?.connected
              ? "已连接"
              : streamStatus?.data?.enabled
                ? "未连接"
                : "未启用"
          }（${streamStatus?.data?.registered ? "已注册" : "未注册"}）`}
          description={
            streamStatus?.data?.lastError
              ? `错误：${streamStatus.data.lastError}`
              : streamStatus?.data?.enabled
                ? "请在钉钉后台点击“验证连接通道”，并等待连接成功"
                : "请在后端设置 DINGTALK_STREAM_CLIENT_ID/DINGTALK_STREAM_CLIENT_SECRET 并重启服务"
          }
          closable
          onClose={() => {
            // 关闭后不再自动刷新；若需要可点刷新按钮
          }}
        />

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            appKey: "",
            appSecret: "",
            agentId: "",
          }}
        >
          <Form.Item
            label="AppKey"
            name="appKey"
            rules={[{ required: true, message: "请输入 AppKey" }]}
          >
            <Input placeholder="请输入钉钉应用的 AppKey" />
          </Form.Item>

          <Form.Item
            label="AppSecret"
            name="appSecret"
            rules={[{ required: true, message: "请输入 AppSecret" }]}
          >
            <Input.Password placeholder="请输入钉钉应用的 AppSecret" />
          </Form.Item>

          <Form.Item label="AgentId（可选）" name="agentId">
            <Input placeholder="请输入 AgentId（可选）" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                onClick={handleTestConnection}
                loading={testConnectionMutation.isPending}
              >
                测试连接
              </Button>
              {config && (
                <>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={handleLoadData}
                    loading={departmentsLoading || usersLoading}
                  >
                    刷新数据
                  </Button>
                  <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={handleSyncOrganization}
                    loading={syncOrganizationMutation.isPending}
                  >
                    同步到组织架构
                  </Button>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => refetchStreamStatus().catch(() => {})}
                      >
                        刷新Stream状态
                      </Button>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>

        {config && (
          <>
            <Divider />
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* 部门列表 */}
              <Card
                title={
                  <Space>
                    <TeamOutlined />
                    <span>通讯录（部门）</span>
                    {departmentsData && (
                      <Tag color="green">
                        {departmentsData.data?.length || 0} 个部门
                      </Tag>
                    )}
                  </Space>
                }
                style={{ flex: "1 1 320px", minWidth: 280 }}
              >
                <Spin spinning={departmentsLoading}>
                  {departmentsError ? (
                    <Alert
                      message="获取部门列表失败"
                      description={departmentsError.message || "请检查配置和网络连接"}
                      type="error"
                      showIcon
                    />
                  ) : departmentsData?.data ? (
                    <Tree
                      treeData={departmentTreeData}
                      defaultExpandAll
                      style={{ maxHeight: 600, overflow: "auto" }}
                    />
                  ) : (
                    <Text type="secondary">暂无数据，请点击"刷新数据"按钮</Text>
                  )}
                </Spin>
              </Card>

              {/* 用户列表 */}
              <Card
                title={
                  <Space>
                    <UserOutlined />
                    <span>人员列表</span>
                    {usersData && (
                      <Tag color="blue">
                        {usersData.data?.length || 0} 个用户
                      </Tag>
                    )}
                  </Space>
                }
                style={{ flex: "2 1 560px", minWidth: 0 }}
              >
                <Spin spinning={usersLoading}>
                  {usersError ? (
                    <Alert
                      message="获取用户列表失败"
                      description={usersError.message || "请检查配置和网络连接"}
                      type="error"
                      showIcon
                    />
                  ) : usersData?.data ? (
                    <div style={{ width: "100%", overflowX: "auto" }}>
                      <Table
                        columns={userColumns}
                        dataSource={usersData.data}
                        rowKey="userid"
                        pagination={{
                          pageSize: 10,
                          showSizeChanger: true,
                          showTotal: (total) => `共 ${total} 条`,
                        }}
                        scroll={{ x: "max-content", y: 600 }}
                        size="small"
                      />
                    </div>
                  ) : (
                    <Text type="secondary">暂无数据，请点击"刷新数据"按钮</Text>
                  )}
                </Spin>
              </Card>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

