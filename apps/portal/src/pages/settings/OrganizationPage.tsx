import { Card, Tree, Button, Space, Typography, message, Modal, Form, Input, Spin } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined } from "@ant-design/icons";
import { useState } from "react";
import { dingtalkApi, type DingtalkConfig } from "@/api/dingtalk";
import { departmentApi } from "@/api/department";
import { useMutation, useQuery } from "@tanstack/react-query";
import "./SettingsPage.css";

const { Title } = Typography;

export const OrganizationPage = () => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [syncForm] = Form.useForm<DingtalkConfig>();
  const [createForm] = Form.useForm();

  // 获取部门列表
  const {
    data: departmentsData,
    isLoading: departmentsLoading,
    refetch: refetchDepartments,
  } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      return departmentApi.getDepartments();
    },
  });

  // 同步组织架构
  const syncOrganizationMutation = useMutation({
    mutationFn: async (values: DingtalkConfig) => {
      return dingtalkApi.syncOrganization(values);
    },
    onSuccess: (data) => {
      message.success(data.message || "同步成功！");
      setSyncModalVisible(false);
      syncForm.resetFields();
      // 刷新组织架构数据
      refetchDepartments();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || "未知错误";
      message.error(`同步失败: ${errorMessage}`);
      console.error("同步组织架构失败:", error);
    },
  });

  const handleSyncOrganization = async () => {
    try {
      const values = await syncForm.validateFields();
      syncOrganizationMutation.mutate(values);
    } catch (error) {
      // 表单验证失败
    }
  };

  // 新建部门
  const createDepartmentMutation = useMutation({
    mutationFn: async (values: any) => {
      return departmentApi.createDepartment(values);
    },
    onSuccess: () => {
      message.success("新建成功");
      setCreateModalVisible(false);
      createForm.resetFields();
      refetchDepartments();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || "未知错误";
      message.error(`新建失败: ${errorMessage}`);
      console.error("新建部门失败:", error);
    },
  });

  const handleCreateDepartment = async () => {
    try {
      const values = await createForm.validateFields();
      createDepartmentMutation.mutate(values);
    } catch (e) {
      // ignore
    }
  };

  // 删除部门
  const deleteDepartmentMutation = useMutation({
    mutationFn: async (id: string) => {
      return departmentApi.deleteDepartment(id);
    },
    onSuccess: () => {
      message.success("删除成功");
      setSelectedKeys([]);
      refetchDepartments();
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message || "未知错误";
      message.error(`删除失败: ${errorMessage}`);
      console.error("删除部门失败:", error);
    },
  });

  const handleDeleteDepartment = () => {
    if (selectedKeys.length === 0) return;
    Modal.confirm({
      title: "确定删除选中的部门吗？",
      content: "删除后将无法恢复，请谨慎操作。",
      onOk: () => deleteDepartmentMutation.mutate(selectedKeys[0]),
    });
  };

  // 构建树形数据
  const treeData = departmentsData?.tree || [];
  const findDeptById = (nodes: any[], id: string): any | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findDeptById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };
  const selectedDept = selectedKeys.length ? findDeptById(treeData, selectedKeys[0]) : null;
  // 钉钉同步的部门禁止修改/删除（兼容多种字段命名）
  const isDingtalkDept =
    !!selectedDept &&
    (selectedDept?.source === "dingtalk" ||
      selectedDept?.origin === "dingtalk" ||
      selectedDept?.isDingtalk === true ||
      selectedDept?.dingtalkId);

  return (
    <div className="settings-page">
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            组织机构
          </Title>
          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined />}
              onClick={() => setSyncModalVisible(true)}
            >
              同步钉钉组织架构
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
              新建部门
            </Button>
            <Button
              icon={<EditOutlined />}
              disabled={selectedKeys.length === 0 || isDingtalkDept}
              title={isDingtalkDept ? "钉钉同步的部门不可修改" : undefined}
            >
              编辑
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={selectedKeys.length === 0 || isDingtalkDept}
              onClick={handleDeleteDepartment}
              loading={deleteDepartmentMutation.isPending}
              title={isDingtalkDept ? "钉钉同步的部门不可删除" : undefined}
            >
              删除
            </Button>
          </Space>
        </div>
        <Spin spinning={departmentsLoading}>
          {treeData.length > 0 ? (
            <Tree
              treeData={treeData}
              selectedKeys={selectedKeys}
              onSelect={(keys) => setSelectedKeys(keys as string[])}
              defaultExpandAll
            />
          ) : (
            <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
              {departmentsLoading ? "加载中..." : "暂无部门数据，请先同步钉钉组织架构"}
            </div>
          )}
        </Spin>
      </Card>

      <Modal
        title="新建部门"
        open={createModalVisible}
        onOk={handleCreateDepartment}
        confirmLoading={createDepartmentMutation.isPending}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="部门名称"
            name="name"
            rules={[{ required: true, message: "请输入部门名称" }]}
          >
            <Input placeholder="请输入部门名称" />
          </Form.Item>
          <Form.Item label="上级部门ID" name="parentId">
            <Input placeholder="可不填，默认顶级" />
          </Form.Item>
          <Form.Item label="排序" name="sortOrder" initialValue={0}>
            <Input placeholder="数字越小越靠前，默认0" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="同步钉钉组织架构"
        open={syncModalVisible}
        onOk={handleSyncOrganization}
        onCancel={() => {
          setSyncModalVisible(false);
          syncForm.resetFields();
        }}
        confirmLoading={syncOrganizationMutation.isPending}
        okText="开始同步"
        cancelText="取消"
      >
        <Form
          form={syncForm}
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
        </Form>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          提示：同步后，用户可以使用手机号登录，默认密码为 123456
        </Typography.Text>
      </Modal>
    </div>
  );
};

