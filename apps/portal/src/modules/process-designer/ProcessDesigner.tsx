import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import ReactFlow, {
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  BackgroundVariant,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import type {
  Node,
  Edge,
  Connection,
  NodeTypes,
} from "reactflow";
import "reactflow/dist/style.css";
import { 
  Button, 
  Card, 
  Form, 
  Input, 
  Modal, 
  Radio, 
  Space, 
  Tag, 
  Typography, 
  Select, 
  InputNumber, 
  Switch, 
  Divider, 
  Tabs,
  Tooltip,
  message,
} from "antd";
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  UserSwitchOutlined, 
  SendOutlined,
  BranchesOutlined,
  ApartmentOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import type { WorkflowSchemaType } from "@mofeng/shared-schema";
import { UserSelector } from "@/components/UserSelector";
import { DepartmentSelector } from "@/components/DepartmentSelector";

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type NodeType = "start" | "end" | "approval" | "condition" | "parallel" | "task";

type AssigneeType = "user" | "role" | "department" | "formField" | "initiator" | "initiatorLeader";

type ApprovalMode = "all" | "any";

interface WorkflowNodeData {
  type: NodeType;
  label: string;
  assignees?: {
    type: AssigneeType;
    values?: string[];
    formFieldId?: string;
  };
  approvalMode?: ApprovalMode;
  conditions?: Array<{
    edgeId: string;
    expression: string;
    label: string;
  }>;
  timeout?: {
    enabled: boolean;
    duration: number;
    action: "autoApprove" | "autoReject" | "notify" | "transfer";
    transferTo?: string;
  };
  config?: Record<string, any>;
}

interface ProcessDesignerProps {
  value?: WorkflowSchemaType | null;
  onChange?: (wf: WorkflowSchemaType) => void;
}

// 自定义节点组件
const CustomNode = ({ data, selected }: { data: WorkflowNodeData; selected: boolean }) => {
  const getNodeStyle = () => {
    switch (data.type) {
      case "start":
        return {
          background: "#1f1f1f",
          color: "#fff",
          border: "1px solid #1f1f1f",
          borderRadius: 999,
          minWidth: 86,
          padding: "8px 16px",
        };
      case "end":
        return {
          background: "#8c8c8c",
          color: "#fff",
          border: "1px solid #8c8c8c",
          borderRadius: 999,
          minWidth: 86,
          padding: "8px 16px",
        };
      case "approval":
        return {
          background: "#fff",
          color: "#262626",
          border: "1px solid #e8e8e8",
          borderRadius: 10,
          minWidth: 180,
          padding: "10px 12px",
        };
      case "task":
        return {
          background: "#fff",
          color: "#262626",
          border: "1px solid #e8e8e8",
          borderRadius: 10,
          minWidth: 180,
          padding: "10px 12px",
        };
      case "condition":
        return {
          background: "#fff",
          color: "#262626",
          border: "1px solid #e8e8e8",
          borderRadius: 10,
          minWidth: 180,
          padding: "10px 12px",
        };
      case "parallel":
        return {
          background: "#fff",
          color: "#262626",
          border: "1px solid #e8e8e8",
          borderRadius: 10,
          minWidth: 180,
          padding: "10px 12px",
        };
      default:
        return {
          background: "#fff",
          color: "#262626",
          border: "1px solid #e8e8e8",
          borderRadius: 8,
          minWidth: 160,
          padding: "10px 12px",
        };
    }
  };

  const getNodeIcon = () => {
    switch (data.type) {
      case "start":
        return <PlayCircleOutlined style={{ fontSize: 20 }} />;
      case "end":
        return <StopOutlined style={{ fontSize: 20 }} />;
      case "approval":
        return <UserSwitchOutlined style={{ fontSize: 20 }} />;
      case "task":
        return <SendOutlined style={{ fontSize: 20 }} />;
      case "condition":
        return <BranchesOutlined style={{ fontSize: 20 }} />;
      case "parallel":
        return <ApartmentOutlined style={{ fontSize: 20 }} />;
      default:
        return null;
    }
  };

  const style = getNodeStyle();

  return (
    <div
      style={{
        borderRadius: style.borderRadius || "8px",
        minWidth: style.minWidth || 150,
        padding: style.padding || "10px 12px",
        textAlign: "center",
        boxShadow: selected
          ? "0 0 0 2px rgba(22,119,255,0.2), 0 6px 16px rgba(0,0,0,0.12)"
          : "0 1px 4px rgba(0,0,0,0.08)",
        cursor: "pointer",
        position: "relative",
        ...style,
      }}
    >
      {/* 顶部连接点（输入） */}
      {data.type !== "start" && (
        <Handle
          type="target"
          position={Position.Top}
          style={{ background: "#8c8c8c", width: 8, height: 8, border: "1px solid #fff" }}
        />
      )}
      
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: data.type === "approval" || data.type === "task" ? 6 : 0 }}>
        {getNodeIcon()}
        <Text strong style={{ color: style.color, fontSize: 13 }}>
          {data.label}
        </Text>
      </div>
      
      {/* 显示审批方式 */}
      {(data.type === "approval" || data.type === "task") && data.assignees && (
        <div style={{ marginTop: 2, fontSize: 12, color: "#8c8c8c" }}>
          {data.approvalMode === "all" && "发起人本人"}
          {data.approvalMode === "any" && "多人任意一人"}
          {!data.approvalMode && "待配置审批人"}
        </div>
      )}

      {/* 条件分支提示 */}
      {data.type === "condition" && data.conditions && data.conditions.length > 0 && (
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.9 }}>
          {data.conditions.length} 个分支
        </div>
      )}

      {/* 底部连接点（输出） */}
      {data.type !== "end" && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: "#8c8c8c", width: 8, height: 8, border: "1px solid #fff" }}
        />
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

export const ProcessDesigner = ({ value, onChange }: ProcessDesignerProps) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  
  // 从value初始化nodes和edges
  const initialNodes = useMemo<Node[]>(() => {
    if (value?.nodes?.length) {
      return value.nodes.map((n) => ({
        id: n.nodeId,
        type: "custom",
        position: n.position || { x: 250, y: 100 },
        data: {
          type: n.type,
          label: n.label,
          assignees: n.assignees,
          approvalMode: n.config?.approvalMode as ApprovalMode | undefined,
          conditions: n.config?.conditions,
          timeout: n.config?.timeout,
          config: n.config,
        },
      }));
    }
    // 默认开始和结束节点
    return [
      {
        id: "start",
        type: "custom",
        position: { x: 250, y: 100 },
        data: { type: "start", label: "发起" },
      },
      {
        id: "end",
        type: "custom",
        position: { x: 250, y: 300 },
        data: { type: "end", label: "结束" },
      },
    ];
  }, [value]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (value?.edges?.length) {
      return value.edges.map((e) => ({
        id: e.edgeId,
        source: e.source,
        target: e.target,
        label: e.config?.label || "",
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: { strokeWidth: 2 },
      }));
    }
    return [];
  }, [value]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState("basic");

  // 节点类型配置
  const nodeTypeConfig = {
    approval: { label: "审批节点", icon: <UserSwitchOutlined />, color: "#1677ff" },
    task: { label: "抄送节点", icon: <SendOutlined />, color: "#faad14" },
    condition: { label: "条件分支", icon: <BranchesOutlined />, color: "#ff7875" },
    parallel: { label: "并行分支", icon: <ApartmentOutlined />, color: "#52c41a" },
  };

  // 在画布上添加节点
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow") as NodeType;
      if (!type || !reactFlowInstance) return;

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNodeId = `${type}_${Date.now()}`;
      const newNode: Node = {
        id: newNodeId,
        type: "custom",
        position,
        data: {
          type,
          label: nodeTypeConfig[type]?.label || type,
          assignees: (type === "approval" || type === "task") ? {
            type: "initiatorLeader",
            values: [],
          } : undefined,
          approvalMode: type === "approval" ? "all" : undefined,
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, nodeTypeConfig, setNodes]
  );

  // 连接节点
  const onConnect = useCallback(
    (params: Connection) => {
      // 不允许开始节点作为target
      if (params.target === "start") {
        message.warning("不能连接到开始节点");
        return;
      }
      // 不允许从结束节点连接
      if (params.source === "end") {
        message.warning("不能从结束节点连接");
        return;
      }
      
      const newEdge = {
        ...params,
        id: `e_${params.source}_${params.target}_${Date.now()}`,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
        style: { strokeWidth: 2 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // 节点选择
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setEditingIndex(nodes.findIndex((n) => n.id === node.id));
    const nodeData = node.data as WorkflowNodeData;
    editForm.setFieldsValue({
      label: nodeData.label,
      assigneeType: nodeData.assignees?.type || "initiatorLeader",
      assigneeValues: nodeData.assignees?.values || [],
      approvalMode: nodeData.approvalMode || "all",
      timeoutEnabled: nodeData.timeout?.enabled || false,
      timeoutDuration: nodeData.timeout?.duration || 60,
      timeoutAction: nodeData.timeout?.action || "notify",
      conditions: nodeData.conditions || [],
      formFieldId: nodeData.assignees?.formFieldId,
    });
  }, [nodes, editForm]);

  // 发出变更
  const emitChange = useCallback(() => {
    if (!onChange) return;
    
    const workflowNodes = nodes.map((node) => {
      const nodeData = node.data as WorkflowNodeData;
      return {
        nodeId: node.id,
        type: nodeData.type,
        label: nodeData.label,
        position: node.position,
        assignees: nodeData.assignees,
        config: {
          approvalMode: nodeData.approvalMode,
          conditions: nodeData.conditions,
          timeout: nodeData.timeout,
          ...nodeData.config,
        },
      };
    });

    const workflowEdges = edges.map((edge) => ({
      edgeId: edge.id,
      source: edge.source,
      target: edge.target,
      condition: undefined,
      config: {
        label: edge.label || "",
      },
    }));

    const wf: WorkflowSchemaType = {
      workflowId: value?.workflowId || "wf_" + Date.now(),
      workflowName: value?.workflowName || "流程",
      version: value?.version || 1,
      nodes: workflowNodes,
      edges: workflowEdges,
      metadata: value?.metadata || {},
    };
    
    onChange(wf);
  }, [nodes, edges, onChange, value]);

  // 删除节点
  const handleDeleteNode = useCallback(() => {
    if (!selectedNode || selectedNode.data.type === "start" || selectedNode.data.type === "end") {
      message.warning("不能删除开始或结束节点");
      return;
    }
    setNodes((nds) => {
      const newNodes = nds.filter((node) => node.id !== selectedNode.id);
      return newNodes;
    });
    setEdges((eds) => {
      const newEdges = eds.filter((edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id);
      return newEdges;
    });
    setSelectedNode(null);
    setEditingIndex(null);
    // 立即触发保存，确保删除操作被保存
    setTimeout(() => {
      emitChange();
    }, 0);
  }, [selectedNode, setNodes, setEdges, emitChange]);

  // 保存节点编辑
  const handleSaveNode = () => {
    editForm.validateFields().then((values) => {
      if (editingIndex === null || !selectedNode) return;
      
      const currentNode = nodes[editingIndex];
      const nodeData = currentNode.data as WorkflowNodeData;
      
      const updatedData: WorkflowNodeData = {
        ...nodeData,
        label: values.label,
      };

      // 审批节点或抄送节点配置
      if (nodeData.type === "approval" || nodeData.type === "task") {
        updatedData.assignees = {
          type: values.assigneeType,
          values: values.assigneeValues || [],
        };
        if (values.assigneeType === "formField") {
          updatedData.assignees.formFieldId = values.formFieldId;
        }
      }

      // 审批方式
      if (nodeData.type === "approval") {
        updatedData.approvalMode = values.approvalMode;
      }

      // 超时配置
      if (values.timeoutEnabled) {
        updatedData.timeout = {
          enabled: true,
          duration: values.timeoutDuration,
          action: values.timeoutAction,
          transferTo: values.timeoutAction === "transfer" ? values.transferTo : undefined,
        };
      }

      // 条件分支配置
      if (nodeData.type === "condition") {
        updatedData.conditions = values.conditions || [];
      }

      const newNodes = [...nodes];
      newNodes[editingIndex] = {
        ...currentNode,
        data: updatedData,
      };
      
      setNodes(newNodes);
      setSelectedNode(newNodes[editingIndex]);
      setEditingIndex(null);
      editForm.resetFields();
    });
  };

  // 使用debounce来避免频繁触发保存
  const saveTimerRef = useRef<NodeJS.Timeout>();
  useEffect(() => {
    if (!onChange) return;
    
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    
    saveTimerRef.current = setTimeout(() => {
      const workflowNodes = nodes.map((node) => {
        const nodeData = node.data as WorkflowNodeData;
        return {
          nodeId: node.id,
          type: nodeData.type,
          label: nodeData.label,
          position: node.position,
          assignees: nodeData.assignees,
          config: {
            approvalMode: nodeData.approvalMode,
            conditions: nodeData.conditions,
            timeout: nodeData.timeout,
            ...nodeData.config,
          },
        };
      });

      const workflowEdges = edges.map((edge) => ({
        edgeId: edge.id,
        source: edge.source,
        target: edge.target,
        condition: undefined,
        config: {
          label: edge.label || "",
        },
      }));

      const wf: WorkflowSchemaType = {
        workflowId: value?.workflowId || "wf_" + Date.now(),
        workflowName: value?.workflowName || "流程",
        version: value?.version || 1,
        nodes: workflowNodes,
        edges: workflowEdges,
        metadata: value?.metadata || {},
      };
      
      onChange(wf);
    }, 500); // 500ms后保存，避免频繁保存
    
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, [nodes, edges, onChange, value]);

  const editingNode = useMemo(() => {
    if (editingIndex === null) return null;
    return nodes[editingIndex];
  }, [editingIndex, nodes]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#f7f8fa" }}>
      <div style={{ display: "flex", height: "100%", gap: 12, padding: 12 }}>
        {/* 左侧：节点库 */}
        <div style={{ width: 220 }}>
          <Card size="small" title="流程节点" bordered style={{ height: "100%", borderRadius: 8 }}>
            <Space direction="vertical" style={{ width: "100%" }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>人工节点</Text>
                <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
                  <Button
                    icon={<UserSwitchOutlined />}
                    block
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", "approval");
                    }}
                  >
                    审批节点
                  </Button>
                  <Button
                    icon={<SendOutlined />}
                    block
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", "task");
                    }}
                  >
                    抄送节点
                  </Button>
                </Space>
              </div>
              <Divider style={{ margin: "12px 0" }} />
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>分支节点</Text>
                <Space direction="vertical" style={{ width: "100%", marginTop: 8 }}>
                  <Button
                    icon={<BranchesOutlined />}
                    block
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", "condition");
                    }}
                  >
                    条件分支
                  </Button>
                  <Button
                    icon={<ApartmentOutlined />}
                    block
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", "parallel");
                    }}
                  >
                    并行分支
                  </Button>
                </Space>
              </div>
            </Space>
          </Card>
        </div>

        {/* 中间：流程画布 */}
        <div ref={reactFlowWrapper} style={{ flex: 1, height: "100%", background: "#fff", border: "1px solid #efefef", borderRadius: 8, overflow: "hidden" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            connectionLineStyle={{ strokeWidth: 2 }}
            defaultEdgeOptions={{
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { strokeWidth: 2 },
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="#e6e8eb" />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>

        {/* 右侧：属性面板 */}
        <div style={{ width: 300 }}>
          {selectedNode ? (
            <Card 
              size="small" 
              title={
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>节点属性</span>
                  <Space>
                    <Tooltip title="编辑">
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<EditOutlined />}
                        onClick={() => {
                          if (selectedNode.data.type !== "start" && selectedNode.data.type !== "end") {
                            setEditingIndex(nodes.findIndex((n) => n.id === selectedNode.id));
                          }
                        }}
                      />
                    </Tooltip>
                    {selectedNode.data.type !== "start" && selectedNode.data.type !== "end" && (
                      <Tooltip title="删除">
                        <Button 
                          type="text" 
                          size="small" 
                          danger
                          icon={<DeleteOutlined />}
                          onClick={handleDeleteNode}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title="关闭">
                      <Button 
                        type="text" 
                        size="small" 
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                          setSelectedNode(null);
                          setEditingIndex(null);
                        }}
                      />
                    </Tooltip>
                  </Space>
                </div>
              }
              bordered
              style={{ height: "100%", borderRadius: 8 }}
            >
              <Space direction="vertical" style={{ width: "100%" }} size="small">
                <div>
                  <Text strong>节点名称：</Text>
                  <Text>{selectedNode.data.label}</Text>
                </div>
                <div>
                  <Text strong>节点类型：</Text>
                  <Tag color={nodeTypeConfig[selectedNode.data.type as keyof typeof nodeTypeConfig]?.color || "default"}>
                    {nodeTypeConfig[selectedNode.data.type as keyof typeof nodeTypeConfig]?.label || selectedNode.data.type}
                  </Tag>
                </div>
                {(selectedNode.data.type === "approval" || selectedNode.data.type === "task") && selectedNode.data.assignees && (
                  <div>
                    <Text strong>审批人：</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {selectedNode.data.assignees.type === "initiator" && "发起人本人"}
                      {selectedNode.data.assignees.type === "initiatorLeader" && "发起人直属上级"}
                      {selectedNode.data.assignees.type === "user" && "指定人员"}
                      {selectedNode.data.assignees.type === "role" && "指定角色"}
                      {selectedNode.data.assignees.type === "department" && "指定部门"}
                      {selectedNode.data.assignees.type === "formField" && "表单字段"}
                    </Text>
                  </div>
                )}
                {selectedNode.data.type === "approval" && selectedNode.data.approvalMode && (
                  <div>
                    <Text strong>审批方式：</Text>
                    <Tag>{selectedNode.data.approvalMode === "all" ? "会签" : "或签"}</Tag>
                  </div>
                )}
                {selectedNode.data.type === "condition" && selectedNode.data.conditions && (
                  <div>
                    <Text strong>条件分支：</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {selectedNode.data.conditions.length} 个分支
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          ) : (
            <Card size="small" title="提示" bordered style={{ height: "100%", borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                从左侧拖拽节点到画布，点击节点查看或编辑属性，拖拽节点端点进行连线。
              </Text>
            </Card>
          )}
        </div>
      </div>

      {/* 编辑节点弹窗 */}
      <Modal
        title={editingNode ? `编辑节点：${editingNode.data.label}` : "编辑节点"}
        open={editingIndex !== null && editingNode !== null && (editingNode.data.type !== "start" && editingNode.data.type !== "end")}
        onOk={handleSaveNode}
        onCancel={() => {
          setEditingIndex(null);
          editForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={600}
        destroyOnClose
      >
        {editingNode && (
          <Form form={editForm} layout="vertical">
            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              items={[
                {
                  key: "basic",
                  label: "基本信息",
                  children: (
                    <div>
                      <Form.Item
                        label="节点名称"
                        name="label"
                        rules={[{ required: true, message: "请输入节点名称" }]}
                      >
                        <Input placeholder="例如：部门审批 / 财务审批" />
                      </Form.Item>

                      {(editingNode.data.type === "approval" || editingNode.data.type === "task") && (
                        <>
                          <Form.Item
                            label="审批人类型"
                            name="assigneeType"
                            rules={[{ required: true, message: "请选择审批人类型" }]}
                          >
                            <Select placeholder="请选择审批人类型">
                              <Option value="initiator">发起人本人</Option>
                              <Option value="initiatorLeader">发起人直属上级</Option>
                              <Option value="user">指定人员</Option>
                              <Option value="role">指定角色</Option>
                              <Option value="department">指定部门</Option>
                              <Option value="formField">表单字段（用户选择）</Option>
                            </Select>
                          </Form.Item>

                          <Form.Item
                            noStyle
                            shouldUpdate={(prevValues, currentValues) => 
                              prevValues.assigneeType !== currentValues.assigneeType
                            }
                          >
                            {({ getFieldValue }) => {
                              const assigneeType = getFieldValue("assigneeType");
                              if (assigneeType === "formField") {
                                return (
                                  <Form.Item
                                    label="表单字段ID"
                                    name="formFieldId"
                                    rules={[{ required: true, message: "请输入表单字段ID" }]}
                                  >
                                    <Input placeholder="例如：field_user_select" />
                                  </Form.Item>
                                );
                              }
                              if (assigneeType === "user") {
                                return (
                                  <Form.Item
                                    label="选择人员"
                                    name="assigneeValues"
                                  >
                                    <UserSelector
                                      multiple
                                      placeholder="请选择人员"
                                    />
                                  </Form.Item>
                                );
                              }
                              if (assigneeType === "department") {
                                return (
                                  <Form.Item
                                    label="选择部门"
                                    name="assigneeValues"
                                  >
                                    <DepartmentSelector
                                      multiple
                                      placeholder="请选择部门"
                                    />
                                  </Form.Item>
                                );
                              }
                              if (assigneeType === "role") {
                                return (
                                  <Form.Item
                                    label="选择角色"
                                    name="assigneeValues"
                                  >
                                    <Select
                                      mode="multiple"
                                      placeholder="请选择角色"
                                      options={[
                                        { label: "管理员", value: "admin" },
                                        { label: "普通用户", value: "user" },
                                        { label: "审批人", value: "approver" },
                                      ]}
                                    />
                                  </Form.Item>
                                );
                              }
                              return null;
                            }}
                          </Form.Item>
                        </>
                      )}

                      {editingNode.data.type === "approval" && (
                        <Form.Item
                          label="审批方式"
                          name="approvalMode"
                          rules={[{ required: true, message: "请选择审批方式" }]}
                          tooltip="会签：需要所有人同意；或签：任意一人同意即可"
                        >
                          <Radio.Group>
                            <Radio value="all">会签（需要所有人同意）</Radio>
                            <Radio value="any">或签（任意一人同意即可）</Radio>
                          </Radio.Group>
                        </Form.Item>
                      )}

                      {editingNode.data.type === "condition" && (
                        <Form.Item
                          label="条件分支"
                          name="conditions"
                          tooltip="配置不同的条件分支，每条分支对应一个后续节点"
                        >
                          <Form.List name="conditions">
                            {(fields, { add, remove }) => (
                              <>
                                {fields.map((field, index) => (
                                  <Space key={field.key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                                    <Form.Item
                                      {...field}
                                      name={[field.name, "label"]}
                                      rules={[{ required: true, message: "请输入分支名称" }]}
                                    >
                                      <Input placeholder="分支名称" style={{ width: 120 }} />
                                    </Form.Item>
                                    <Form.Item
                                      {...field}
                                      name={[field.name, "expression"]}
                                      rules={[{ required: true, message: "请输入条件表达式" }]}
                                    >
                                      <Input placeholder="条件表达式，如：amount > 1000" style={{ width: 200 }} />
                                    </Form.Item>
                                    <Button type="link" danger onClick={() => remove(field.name)}>
                                      删除
                                    </Button>
                                  </Space>
                                ))}
                                <Button type="dashed" onClick={() => add()} block>
                                  添加条件分支
                                </Button>
                              </>
                            )}
                          </Form.List>
                        </Form.Item>
                      )}
                    </div>
                  ),
                },
                {
                  key: "advanced",
                  label: "高级配置",
                  children: (
                    <div>
                      <Form.Item
                        label="超时处理"
                        name="timeoutEnabled"
                        valuePropName="checked"
                        tooltip="配置节点超时后的处理方式"
                      >
                        <Switch />
                      </Form.Item>

                      <Form.Item
                        noStyle
                        shouldUpdate={(prevValues, currentValues) => 
                          prevValues.timeoutEnabled !== currentValues.timeoutEnabled
                        }
                      >
                        {({ getFieldValue }) => {
                          const timeoutEnabled = getFieldValue("timeoutEnabled");
                          if (!timeoutEnabled) return null;
                          return (
                            <>
                              <Form.Item
                                label="超时时长（分钟）"
                                name="timeoutDuration"
                                rules={[{ required: true, message: "请输入超时时长" }]}
                              >
                                <InputNumber min={1} style={{ width: "100%" }} />
                              </Form.Item>

                              <Form.Item
                                label="超时动作"
                                name="timeoutAction"
                                rules={[{ required: true, message: "请选择超时动作" }]}
                              >
                                <Select>
                                  <Option value="autoApprove">自动通过</Option>
                                  <Option value="autoReject">自动拒绝</Option>
                                  <Option value="notify">通知管理员</Option>
                                  <Option value="transfer">转交他人</Option>
                                </Select>
                              </Form.Item>

                              <Form.Item
                                noStyle
                                shouldUpdate={(prevValues, currentValues) => 
                                  prevValues.timeoutAction !== currentValues.timeoutAction
                                }
                              >
                                {({ getFieldValue }) => {
                                  if (getFieldValue("timeoutAction") === "transfer") {
                                    return (
                                      <Form.Item
                                        label="转交给"
                                        name="transferTo"
                                        rules={[{ required: true, message: "请选择转交对象" }]}
                                      >
                                        <Input placeholder="用户ID或用户名" />
                                      </Form.Item>
                                    );
                                  }
                                  return null;
                                }}
                              </Form.Item>
                            </>
                          );
                        }}
                      </Form.Item>
                    </div>
                  ),
                },
              ]}
            />
          </Form>
        )}
      </Modal>
    </div>
  );
};
