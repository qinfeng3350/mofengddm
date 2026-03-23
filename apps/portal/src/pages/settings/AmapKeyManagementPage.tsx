import React, { useState, useEffect } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Typography,
  Tooltip,
  Tag,
  Row,
  Col,
  Divider,
} from "antd";
import {
  EditOutlined,
  PlusOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  QuestionCircleOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  InfoCircleOutlined,
  CaretUpOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

interface AmapKey {
  id: string;
  keyName: string;
  key: string;
  securityKey?: string;
  boundService: "Web端" | "服务端" | "移动端";
  createdAt: string;
  updatedAt?: string;
}

export const AmapKeyManagementPage: React.FC = () => {
  const [keys, setKeys] = useState<AmapKey[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingKey, setEditingKey] = useState<AmapKey | null>(null);
  const [form] = Form.useForm();
  const [expanded, setExpanded] = useState(true);
  const [visibleSecurityKeys, setVisibleSecurityKeys] = useState<Set<string>>(new Set());

  // 从 localStorage 加载数据，如果没有则从环境变量初始化
  useEffect(() => {
    const savedKeys = localStorage.getItem("amap_keys");
    if (savedKeys) {
      try {
        const parsedKeys = JSON.parse(savedKeys);
        if (parsedKeys.length > 0) {
          setKeys(parsedKeys);
          return;
        }
      } catch (error) {
        console.error("加载API Key数据失败:", error);
      }
    }

    // 如果没有保存的数据，尝试从环境变量初始化
    const envKey = import.meta.env.VITE_AMAP_KEY;
    if (envKey && envKey !== "YOUR_AMAP_API_KEY" && envKey.trim() !== "") {
      const defaultKey: AmapKey = {
        id: "amap_default",
        keyName: "高德地图定位",
        key: envKey,
        boundService: "Web端",
        createdAt: dayjs().format("YYYY-MM-DD HH:mm:ss"),
      };
      saveKeys([defaultKey]);
    }
  }, []);

  // 保存数据到 localStorage
  const saveKeys = (newKeys: AmapKey[]) => {
    localStorage.setItem("amap_keys", JSON.stringify(newKeys));
    setKeys(newKeys);
  };

  // 打开添加/编辑模态框
  const handleOpenModal = (key?: AmapKey) => {
    if (key) {
      setEditingKey(key);
      form.setFieldsValue(key);
    } else {
      setEditingKey(null);
      form.resetFields();
    }
    setIsModalVisible(true);
  };

  // 关闭模态框
  const handleCloseModal = () => {
    setIsModalVisible(false);
    setEditingKey(null);
    form.resetFields();
  };

  // 保存Key
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const now = dayjs().format("YYYY-MM-DD HH:mm:ss");

      if (editingKey) {
        // 编辑
        const updatedKeys = keys.map((k) =>
          k.id === editingKey.id
            ? { ...k, ...values, updatedAt: now }
            : k
        );
        saveKeys(updatedKeys);
        message.success("更新成功");
      } else {
        // 新增
        const newKey: AmapKey = {
          id: `key_${Date.now()}`,
          ...values,
          createdAt: now,
        };
        saveKeys([...keys, newKey]);
        message.success("添加成功");
      }

      handleCloseModal();
    } catch (error) {
      console.error("保存失败:", error);
    }
  };

  // 删除Key
  const handleDelete = (keyId: string) => {
    const updatedKeys = keys.filter((k) => k.id !== keyId);
    saveKeys(updatedKeys);
    message.success("删除成功");
  };

  // 删除整个分组
  const handleDeleteGroup = () => {
    saveKeys([]);
    message.success("删除成功");
  };

  // 切换安全密钥显示/隐藏
  const toggleSecurityKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleSecurityKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleSecurityKeys(newVisible);
  };

  // 复制到剪贴板
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    message.success(`${label}已复制到剪贴板`);
  };

  const columns = [
    {
      title: "Key 名称",
      dataIndex: "keyName",
      key: "keyName",
      width: 200,
    },
    {
      title: (
        <Space>
          <span>Key</span>
          <Tooltip title="高德地图API Key，用于调用地图服务">
            <QuestionCircleOutlined style={{ color: "#1890ff", cursor: "pointer" }} />
          </Tooltip>
          <span style={{ color: "#1890ff", fontSize: 12, fontWeight: "normal" }}>
            商用说明
          </span>
        </Space>
      ),
      dataIndex: "key",
      key: "key",
      width: 300,
      render: (text: string) => (
        <Space>
          <Text
            copyable={{ text, onCopy: () => handleCopy(text, "Key") }}
            style={{ fontFamily: "monospace", fontSize: 12 }}
          >
            {text}
          </Text>
        </Space>
      ),
    },
    {
      title: (
        <Space>
          <span>安全密钥</span>
          <Tooltip
            title={
              <div>
                <p>安全密钥用于增强API Key的安全性</p>
                <p style={{ marginTop: 8 }}>
                  <a
                    href="https://lbs.amap.com/api/webservice/guide/api-config"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#fff" }}
                  >
                    点击查看安全密钥使用说明
                  </a>
                </p>
              </div>
            }
          >
            <QuestionCircleOutlined style={{ color: "#1890ff", cursor: "pointer" }} />
          </Tooltip>
          <span style={{ color: "#666", fontSize: 12, fontWeight: "normal" }}>
            (点击查看安全密钥使用说明)
          </span>
        </Space>
      ),
      dataIndex: "securityKey",
      key: "securityKey",
      width: 350,
      render: (text: string, record: AmapKey) => {
        const isVisible = visibleSecurityKeys.has(record.id);
        return (
          <Space>
            {text ? (
              <>
                <Text
                  copyable={{ text, onCopy: () => handleCopy(text, "安全密钥") }}
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {isVisible ? text : "••••••••••••••••"}
                </Text>
                <Button
                  type="text"
                  size="small"
                  icon={isVisible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                  onClick={() => toggleSecurityKeyVisibility(record.id)}
                />
              </>
            ) : (
              <Text type="secondary" style={{ fontSize: 12 }}>
                未设置
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: "绑定服务",
      dataIndex: "boundService",
      key: "boundService",
      width: 150,
      render: (service: string) => (
        <Tag color="blue">{service}</Tag>
      ),
    },
    {
      title: (
        <Space>
          <span>操作</span>
          <Tooltip title="管理API Key的操作">
            <InfoCircleOutlined style={{ color: "#1890ff", cursor: "pointer" }} />
          </Tooltip>
        </Space>
      ),
      key: "action",
      width: 150,
      render: (_: any, record: AmapKey) => (
        <Space split={<Divider type="vertical" />}>
          <Button
            type="link"
            onClick={() => handleOpenModal(record)}
            style={{ padding: 0 }}
          >
            设置
          </Button>
          <Popconfirm
            title="确定要删除这个Key吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger style={{ padding: 0 }}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 获取创建日期（如果有数据）
  const getCreatedDate = () => {
    if (keys.length > 0) {
      const firstKey = keys[0];
      return dayjs(firstKey.createdAt).format("YYYY/M/D");
    }
    return dayjs().format("YYYY/M/D");
  };

  return (
    <div style={{ background: "#fff" }}>
      {/* 顶部标题区域 */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid #f0f0f0",
          background: "#fff",
        }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Space size="middle">
              <AppstoreOutlined style={{ fontSize: 20, color: "#1890ff" }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>高德地图使用</div>
                <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 4 }}>
                  {getCreatedDate()} 创建
                </div>
              </div>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<EditOutlined />}
                onClick={() => message.info("编辑分组功能待实现")}
              >
                编辑
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenModal()}
              >
                添加Key
              </Button>
              <Popconfirm
                title="确定要删除整个分组吗？这将删除所有Key。"
                onConfirm={handleDeleteGroup}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
              <Button
                type="text"
                icon={<CaretUpOutlined />}
                onClick={() => setExpanded(!expanded)}
                style={{ transform: expanded ? "rotate(180deg)" : "none" }}
              />
            </Space>
          </Col>
        </Row>
      </div>

      {/* 表格区域 */}
      {expanded && (
        <div style={{ padding: "24px" }}>
          {keys.length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "60px 0" }}>
                <AppstoreOutlined style={{ fontSize: 64, color: "#d9d9d9", marginBottom: 16 }} />
                <div style={{ color: "#8c8c8c", marginBottom: 24 }}>
                  暂无API Key，点击"添加Key"创建
                </div>
                <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal()}>
                  添加Key
                </Button>
              </div>
            </Card>
          ) : (
            <Table
              columns={columns}
              dataSource={keys}
              rowKey="id"
              pagination={false}
              bordered
            />
          )}
        </div>
      )}

      {/* 添加/编辑模态框 */}
      <Modal
        title={editingKey ? "编辑Key" : "添加Key"}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={handleCloseModal}
        width={600}
        okText="确定"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="keyName"
            label="Key 名称"
            rules={[{ required: true, message: "请输入Key名称" }]}
          >
            <Input placeholder="例如：高德地图定位" />
          </Form.Item>

          <Form.Item
            name="key"
            label="Key"
            rules={[{ required: true, message: "请输入API Key" }]}
            extra="高德地图API Key，可在高德开放平台获取"
          >
            <Input placeholder="请输入API Key" />
          </Form.Item>

          <Form.Item
            name="securityKey"
            label="安全密钥"
            extra="可选，用于增强API Key的安全性"
          >
            <Input.Password placeholder="请输入安全密钥（可选）" />
          </Form.Item>

          <Form.Item
            name="boundService"
            label="绑定服务"
            rules={[{ required: true, message: "请选择绑定服务" }]}
            initialValue="Web端"
          >
            <Select>
              <Select.Option value="Web端">Web端</Select.Option>
              <Select.Option value="服务端">服务端</Select.Option>
              <Select.Option value="移动端">移动端</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

