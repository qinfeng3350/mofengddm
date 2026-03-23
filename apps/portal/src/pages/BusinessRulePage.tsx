import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Layout,
  Card,
  Table,
  Button,
  Space,
  Popconfirm,
  message,
  Tag,
  Switch,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Divider,
  Typography,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { businessRuleApi } from "@/api/businessRule";
import type { BusinessRuleResponse } from "@/api/businessRule";
import { formDefinitionApi } from "@/api/formDefinition";
import { applicationApi } from "@/api/application";
import { BusinessRuleDesigner } from "@/modules/business-rule-designer/BusinessRuleDesigner";

const { Header, Content } = Layout;
const { Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

export const BusinessRulePage = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [rules, setRules] = useState<BusinessRuleResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BusinessRuleResponse | null>(null);
  const [form] = Form.useForm();

  // 加载规则列表
  const loadRules = async () => {
    if (!appId) return;
    setLoading(true);
    try {
      const list = await businessRuleApi.getListByApplication(appId);
      setRules(list);
    } catch (e) {
      console.error("加载规则失败:", e);
      // 不重复弹很多次，只在控制台提示
      message.error("加载规则失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [appId]);

  // 删除规则
  const handleDelete = async (ruleId: string) => {
    try {
      if (!appId) return;
      await businessRuleApi.delete(appId, ruleId);
      message.success("删除成功");
      loadRules();
    } catch (e) {
      console.error("删除失败:", e);
      message.error("删除失败");
    }
  };

  // 切换启用状态
  const handleToggleEnabled = async (ruleId: string, enabled: boolean) => {
    try {
      if (!appId) return;
      await businessRuleApi.toggleEnabled(appId, ruleId, enabled);
      message.success(enabled ? "已启用" : "已禁用");
      loadRules();
    } catch (e) {
      console.error("操作失败:", e);
      message.error("操作失败");
    }
  };

  // 打开设计器
  const handleOpenDesigner = (rule?: BusinessRuleResponse) => {
    setEditingRule(rule || null);
    setModalOpen(true);
  };

  // 关闭设计器
  const handleCloseDesigner = () => {
    setModalOpen(false);
    setEditingRule(null);
    loadRules();
  };

  const columns = [
    {
      title: "规则名称",
      dataIndex: "ruleName",
      key: "ruleName",
      width: 200,
    },
    {
      title: "触发事件",
      key: "trigger",
      width: 150,
      render: (_: any, record: BusinessRuleResponse) => {
        const eventMap: Record<string, string> = {
          create: "新增",
          update: "更新",
          delete: "删除",
          statusChange: "状态变更",
        };
        return (
          <Tag color="blue">
            {eventMap[record.trigger.event] || record.trigger.event}
          </Tag>
        );
      },
    },
    {
      title: "触发表单",
      key: "triggerForm",
      width: 150,
      render: (_: any, record: BusinessRuleResponse) => {
        return <Tag>{record.trigger.formId}</Tag>;
      },
    },
    {
      title: "执行动作",
      key: "actions",
      width: 200,
      render: (_: any, record: BusinessRuleResponse) => {
        const actionMap: Record<string, string> = {
          createRecord: "创建记录",
          updateRecord: "更新记录",
          deleteRecord: "删除记录",
          updateField: "更新字段",
          sendNotification: "发送通知",
          executeScript: "执行脚本",
          callApi: "调用API",
        };
        return (
          <Space size={4}>
            {record.actions.map((action, idx) => (
              <Tag key={idx} color="green">
                {actionMap[action.type] || action.type}
              </Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: "状态",
      dataIndex: "enabled",
      key: "enabled",
      width: 100,
      render: (enabled: boolean, record: BusinessRuleResponse) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleToggleEnabled(record.ruleId, checked)}
        />
      ),
    },
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 100,
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: (_: any, record: BusinessRuleResponse) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenDesigner(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这个规则？"
            onConfirm={() => handleDelete(record.ruleId)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Layout style={{ height: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Title level={4} style={{ margin: 0 }}>
          <ThunderboltOutlined style={{ marginRight: 8 }} />
          业务规则与自动化
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => handleOpenDesigner()}
        >
          新建规则
        </Button>
      </Header>
      <Content style={{ padding: 24, overflow: "auto" }}>
        <Card>
          <Table
            columns={columns}
            dataSource={rules}
            rowKey="ruleId"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条规则`,
            }}
          />
        </Card>
      </Content>

      {/* 规则设计器弹窗 */}
      <Modal
        title={editingRule ? "编辑规则" : "新建规则"}
        open={modalOpen}
        onCancel={handleCloseDesigner}
        footer={null}
        width="90%"
        style={{ top: 20 }}
        destroyOnClose
      >
        {modalOpen && (
          <BusinessRuleDesigner
            appId={appId}
            initialRule={editingRule || undefined}
            onSave={handleCloseDesigner}
            onCancel={handleCloseDesigner}
          />
        )}
      </Modal>
    </Layout>
  );
};

