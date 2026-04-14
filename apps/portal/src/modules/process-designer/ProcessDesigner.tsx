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
  Checkbox,
  Form, 
  Input, 
  Modal,
  Radio, 
  Tree,
  Space, 
  Tag,
  Typography, 
  Select, 
  Divider, 
  Tabs,
  message,
} from "antd";
import { 
  PlayCircleOutlined, 
  StopOutlined, 
  UserSwitchOutlined, 
  SendOutlined,
  FormOutlined,
  PartitionOutlined,
  DeploymentUnitOutlined,
  BranchesOutlined,
  ApartmentOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import type { WorkflowSchemaType } from "@mofeng/shared-schema";
import { useQuery } from "@tanstack/react-query";
import { roleApi } from "@/api/role";
import { departmentApi } from "@/api/department";
import { apiClient } from "@/api/client";

const { Text, Title } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type NodeType = "start" | "end" | "approval" | "condition" | "parallel" | "task" | "handler" | "merge" | "subprocess";

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

type NodeFieldPermissionItem = {
  fieldId: string;
  action: "hidden" | "readonly" | "editable";
};

interface ProcessDesignerProps {
  value?: WorkflowSchemaType | null;
  onChange?: (wf: WorkflowSchemaType) => void;
  formFields?: Array<{ fieldId: string; label?: string; type?: string }>;
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
      case "handler":
        return {
          background: "#fff",
          color: "#262626",
          border: "1px solid #e8e8e8",
          borderRadius: 10,
          minWidth: 180,
          padding: "10px 12px",
        };
      case "merge":
        return {
          background: "#fff",
          color: "#262626",
          border: "1px solid #e8e8e8",
          borderRadius: 10,
          minWidth: 180,
          padding: "10px 12px",
        };
      case "subprocess":
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
      case "handler":
        return <FormOutlined style={{ fontSize: 20 }} />;
      case "merge":
        return <PartitionOutlined style={{ fontSize: 20 }} />;
      case "subprocess":
        return <DeploymentUnitOutlined style={{ fontSize: 20 }} />;
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
      
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: data.type === "approval" || data.type === "task" || data.type === "handler" ? 6 : 0 }}>
        {getNodeIcon()}
        <Text strong style={{ color: style.color, fontSize: 13 }}>
          {data.label}
        </Text>
      </div>
      
      {/* 显示审批方式 */}
      {(data.type === "approval" || data.type === "task" || data.type === "handler") && data.assignees && (
        <div style={{ marginTop: 2, fontSize: 12, color: "#8c8c8c" }}>
          {data.approvalMode === "all" && "会签（需所有人同意）"}
          {data.approvalMode === "any" && "或签（任意一人同意）"}
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

export const ProcessDesigner = ({ value, onChange, formFields = [] }: ProcessDesignerProps) => {
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
  const [editForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState("basic");
  const [rightPanelTab, setRightPanelTab] = useState<"node" | "flow">("node");
  const [approverModalOpen, setApproverModalOpen] = useState(false);
  const [approverTab, setApproverTab] = useState("user");
  const [tempApproverType, setTempApproverType] = useState<AssigneeType>("initiator");
  const [tempApproverValues, setTempApproverValues] = useState<string[]>([]);
  const [tempFormFieldId, setTempFormFieldId] = useState<string>("");
  const [selectedDeptIdForUserTab, setSelectedDeptIdForUserTab] = useState<string>("");

  const { data: roleList = [] } = useQuery({
    queryKey: ["roles", "forProcessDesigner"],
    queryFn: () => roleApi.list(),
  });
  const { data: userList = [] } = useQuery({
    queryKey: ["users", "forProcessDesigner"],
    queryFn: async () => {
      const res = await apiClient.get("/users");
      return Array.isArray(res) ? res : [];
    },
  });
  const { data: deptTree = [] } = useQuery({
    queryKey: ["departments", "forProcessDesigner"],
    queryFn: async () => {
      const res = await departmentApi.getDepartments();
      return (res.tree || (res as any).data || []) as any[];
    },
  });

  const assigneeFormFieldOptions = useMemo(() => {
    return (formFields || [])
      .filter((f) => f && f.fieldId && (f.type === "user" || f.type === "department"))
      .map((f) => ({
        label: `${f.label || f.fieldId}（${f.type === "user" ? "人员字段" : "部门字段"}）`,
        value: String(f.fieldId),
      }));
  }, [formFields]);

  const permissionRows = useMemo(() => {
    const rows: Array<{ key: string; label: string; level: number; isSubtableParent?: boolean }> = [];
    const walk = (items: any[], parentLabel?: string) => {
      (items || []).forEach((f: any, idx: number) => {
        if (!f) return;
        const fid = String(f.fieldId || f.id || `field_${idx}`);
        const flabel = String(f.label || f.name || fid);
        const type = String(f.type || "");

        rows.push({
          key: fid,
          label: flabel,
          level: parentLabel ? 1 : 0,
          isSubtableParent: type === "subtable",
        });

        if (type === "subtable" && Array.isArray(f.subtableFields)) {
          f.subtableFields.forEach((sub: any, subIdx: number) => {
            const sid = String(sub?.fieldId || sub?.id || `sub_${subIdx}`);
            const slabel = String(sub?.label || sub?.name || sid);
            rows.push({
              key: `${fid}.${sid}`,
              label: slabel,
              level: 1,
            });
          });
        }

        if (Array.isArray(f.children) && f.children.length > 0) {
          walk(f.children, flabel);
        }
        if (Array.isArray(f.columns)) {
          f.columns.forEach((col: any) => {
            if (Array.isArray(col?.children) && col.children.length > 0) {
              walk(col.children, flabel);
            }
          });
        }
      });
    };
    walk(formFields || []);
    return rows;
  }, [formFields]);

  const userOptions = useMemo(
    () =>
      (userList || []).map((u: any) => ({
        label: u?.name || u?.account || String(u?.id),
        value: String(u?.id),
      })),
    [userList],
  );

  const deptTreeData = useMemo(() => {
    const mapNode = (d: any): any => ({
      title: d?.name || d?.label || d?.id,
      key: String(d?.id || d?.value || ""),
      children: Array.isArray(d?.children) ? d.children.map(mapNode) : [],
    });
    return (deptTree || []).map(mapNode);
  }, [deptTree]);

  const deptDescendantIdsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const walk = (node: any): Set<string> => {
      const id = String(node?.id || node?.value || "");
      const selfSet = new Set<string>();
      if (id) selfSet.add(id);
      const children = Array.isArray(node?.children) ? node.children : [];
      children.forEach((c: any) => {
        const childSet = walk(c);
        childSet.forEach((x) => selfSet.add(x));
      });
      if (id) map.set(id, selfSet);
      return selfSet;
    };
    (deptTree || []).forEach((n: any) => walk(n));
    return map;
  }, [deptTree]);

  const roleOptions = useMemo(
    () =>
      (roleList || []).map((r: any) => ({
        label: r?.name || r?.code || String(r?.id),
        value: String(r?.id),
      })),
    [roleList],
  );

  const usersOfSelectedDept = useMemo(() => {
    if (!selectedDeptIdForUserTab) return userOptions;
    const allowed = deptDescendantIdsMap.get(String(selectedDeptIdForUserTab)) || new Set([String(selectedDeptIdForUserTab)]);
    return (userList || [])
      .filter((u: any) => allowed.has(String(u?.departmentId || "")))
      .map((u: any) => ({
        label: u?.name || u?.account || String(u?.id),
        value: String(u?.id),
      }));
  }, [selectedDeptIdForUserTab, userList, userOptions, deptDescendantIdsMap]);

  const peopleDeptControlOptions = useMemo(
    () => [
      { label: "发起人", value: "__initiator__" },
      { label: "部门领导", value: "__dept_leader__" },
      { label: "所属部门", value: "__owner_dept__" },
      { label: "拥有者", value: "__owner__" },
    ],
    [],
  );

  const formFieldTreeData = useMemo(() => {
    const userChildren = (assigneeFormFieldOptions || [])
      .filter((x) => String(x.label).includes("人员字段"))
      .map((x) => ({ title: x.label, key: String(x.value), isLeaf: true }));
    const deptChildren = (assigneeFormFieldOptions || [])
      .filter((x) => String(x.label).includes("部门字段"))
      .map((x) => ({ title: x.label, key: String(x.value), isLeaf: true }));
    return [
      { title: "人员字段", key: "__user_fields__", children: userChildren },
      { title: "部门字段", key: "__dept_fields__", children: deptChildren },
    ];
  }, [assigneeFormFieldOptions]);

  const watchedFieldAuthMatrix = Form.useWatch("fieldAuthMatrix", editForm);
  const watchedAssigneeType = Form.useWatch("assigneeType", editForm) as AssigneeType | undefined;
  const watchedAssigneeValues = Form.useWatch("assigneeValues", editForm) as string[] | undefined;
  const watchedFormFieldId = Form.useWatch("formFieldId", editForm) as string | undefined;
  const allSelectRef = useRef<Record<string, boolean | undefined>>({});

  useEffect(() => {
    if (!selectedNode || permissionRows.length === 0) return;
    const matrix = (editForm.getFieldValue("fieldAuthMatrix") || {}) as Record<string, any>;
    const next = { ...matrix };
    let changed = false;

    permissionRows.forEach((row) => {
      const current = next[row.key];
      if (!current || typeof current !== "object") {
        next[row.key] = {
          visible: true,
          editable: false,
          required: false,
          printable: true,
        };
        changed = true;
        return;
      }
      const patched = {
        visible: Boolean(current.visible),
        editable: Boolean(current.editable),
        required: Boolean(current.required),
        printable: Boolean(current.printable),
      };
      if (
        patched.visible !== current.visible ||
        patched.editable !== current.editable ||
        patched.required !== current.required ||
        patched.printable !== current.printable
      ) {
        next[row.key] = patched;
        changed = true;
      }
    });

    if (changed) {
      editForm.setFieldsValue({ fieldAuthMatrix: next });
    }
  }, [selectedNode, permissionRows, editForm]);

  useEffect(() => {
    if (!watchedFieldAuthMatrix || permissionRows.length === 0) return;
    const matrix = watchedFieldAuthMatrix as Record<string, any>;
    const allCfg = (matrix.__all__ || {}) as Record<string, boolean>;
    const cols: Array<"visible" | "editable" | "required" | "printable"> = [
      "visible",
      "editable",
      "required",
      "printable",
    ];

    for (const col of cols) {
      const currentAll = allCfg[col];
      const prevAll = allSelectRef.current[col];
      if (typeof currentAll === "boolean" && currentAll !== prevAll) {
        const next = { ...matrix };
        permissionRows.forEach((row) => {
          next[row.key] = {
            ...(next[row.key] || {}),
            [col]: currentAll,
          };
        });
        next.__all__ = {
          ...(next.__all__ || {}),
          [col]: currentAll,
        };
        allSelectRef.current[col] = currentAll;
        editForm.setFieldsValue({ fieldAuthMatrix: next });
        return;
      }
    }

    const computedAll: Record<string, boolean> = {
      visible: permissionRows.every((row) => Boolean(matrix?.[row.key]?.visible)),
      editable: permissionRows.every((row) => Boolean(matrix?.[row.key]?.editable)),
      required: permissionRows.every((row) => Boolean(matrix?.[row.key]?.required)),
      printable: permissionRows.every((row) => Boolean(matrix?.[row.key]?.printable)),
    };
    const needSync =
      allCfg.visible !== computedAll.visible ||
      allCfg.editable !== computedAll.editable ||
      allCfg.required !== computedAll.required ||
      allCfg.printable !== computedAll.printable;
    if (needSync) {
      allSelectRef.current = { ...allSelectRef.current, ...computedAll };
      editForm.setFieldsValue({
        fieldAuthMatrix: {
          ...matrix,
          __all__: computedAll,
        },
      });
    }
  }, [watchedFieldAuthMatrix, permissionRows, editForm]);

  const approverSummary = useMemo(() => {
    const type = (watchedAssigneeType || "initiator") as AssigneeType;
    const values = (watchedAssigneeValues || []) as string[];
    const formFieldId = String(watchedFormFieldId || "");
    // 与弹窗内选项一致，用可读中文；勿用 {xxx} 以免被误认为未解析变量
    if (type === "initiator") return "发起人本人";
    if (type === "initiatorLeader") return "发起人直属上级";
    if (type === "formField") {
      const specialLabelMap: Record<string, string> = {
        "__initiator__": "发起人本人",
        "__dept_leader__": "部门领导",
        "__owner_dept__": "所属部门（部门内用户）",
        "__owner__": "拥有者",
      };
      if (specialLabelMap[formFieldId]) return specialLabelMap[formFieldId];
      const option = assigneeFormFieldOptions.find((o) => String(o.value) === formFieldId);
      return option?.label || "请选择人员部门控件";
    }
    if (type === "role") {
      const roleMap = new Map((roleList || []).map((r: any) => [String(r.id), r.name || r.code || String(r.id)]));
      return values.map((v) => roleMap.get(String(v)) || String(v)).join("、") || "点击设置审批人";
    }
    if (type === "department" || type === "user") {
      return values.length ? `已选 ${values.length} 项` : "点击设置审批人";
    }
    return "点击设置审批人";
  }, [watchedAssigneeType, watchedAssigneeValues, watchedFormFieldId, assigneeFormFieldOptions, roleList]);

  // 节点类型配置
  const nodeTypeConfig = {
    handler: { label: "经办节点", icon: <FormOutlined />, color: "#2f54eb" },
    approval: { label: "审批节点", icon: <UserSwitchOutlined />, color: "#1677ff" },
    merge: { label: "汇合点", icon: <PartitionOutlined />, color: "#595959" },
    task: { label: "抄送节点", icon: <SendOutlined />, color: "#faad14" },
    subprocess: { label: "子流程", icon: <DeploymentUnitOutlined />, color: "#13c2c2" },
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
          assignees: (type === "approval" || type === "task" || type === "handler") ? {
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

  // 节点选择（切换节点时载入表单；重复点击同一节点勿 setFieldsValue，否则会把你正在改的「节点名称」刷回画布旧值）
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const isSame = selectedNode?.id === node.id;
      setSelectedNode(node);
      if (isSame) return;
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
        nodeFieldPermissions: (nodeData.config?.nodeFieldPermissions || []) as NodeFieldPermissionItem[],
        fieldAuthMatrix: (nodeData.config?.fieldAuthMatrix || {}) as Record<string, any>,
      });
    },
    [selectedNode?.id, editForm],
  );

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
    // 立即触发保存，确保删除操作被保存
    setTimeout(() => {
      emitChange();
    }, 0);
  }, [selectedNode, setNodes, setEdges, emitChange]);

  // 保存节点编辑（不校验「高级设置」里未填完整的 nodeFieldPermissions 行，避免整表校验失败导致无法保存节点名称）
  const handleSaveNode = () => {
    if (!selectedNode) return;
    editForm
      .validateFields(["label"])
      .then(() => {
        const values = editForm.getFieldsValue(true) as Record<string, any>;
        const selectedIndex = nodes.findIndex((n) => n.id === selectedNode.id);
        if (selectedIndex < 0) return;
        const currentNode = nodes[selectedIndex];
        const nodeData = currentNode.data as WorkflowNodeData;

        const nodePerms = Array.isArray(values.nodeFieldPermissions)
          ? values.nodeFieldPermissions.filter((r: any) => r?.fieldId && r?.action)
          : [];

        const updatedData: WorkflowNodeData = {
          ...nodeData,
          label: String(values.label ?? "").trim() || nodeData.label,
          config: {
            ...(nodeData.config || {}),
          },
        };

        if (nodeData.type === "approval" || nodeData.type === "task" || nodeData.type === "handler") {
          updatedData.assignees = {
            type: values.assigneeType,
            values: values.assigneeValues || [],
          };
          if (values.assigneeType === "formField" && values.formFieldId) {
            updatedData.assignees.formFieldId = values.formFieldId;
          }
        }

        if (nodeData.type === "approval") {
          updatedData.approvalMode = values.approvalMode ?? nodeData.approvalMode ?? "all";
        }

        if (nodeData.type === "approval" || nodeData.type === "task" || nodeData.type === "handler") {
          updatedData.config = {
            ...(updatedData.config || {}),
            nodeFieldPermissions: nodePerms,
            fieldAuthMatrix:
              values.fieldAuthMatrix && typeof values.fieldAuthMatrix === "object"
                ? values.fieldAuthMatrix
                : {},
          };
        }

        if (values.timeoutEnabled) {
          updatedData.timeout = {
            enabled: true,
            duration: values.timeoutDuration,
            action: values.timeoutAction,
            transferTo: values.timeoutAction === "transfer" ? values.transferTo : undefined,
          };
        }

        if (nodeData.type === "condition") {
          updatedData.conditions = values.conditions || [];
        }

        const newNodes = [...nodes];
        newNodes[selectedIndex] = {
          ...currentNode,
          data: updatedData,
        };

        setNodes(newNodes);
        setSelectedNode(newNodes[selectedIndex]);
        message.success("节点配置已保存");
      })
      .catch((err) => {
        console.error(err);
        message.error("请先填写节点名称");
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
                    icon={<FormOutlined />}
                    block
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", "handler");
                    }}
                  >
                    经办节点
                  </Button>
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
                  <Button
                    icon={<PartitionOutlined />}
                    block
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", "merge");
                    }}
                  >
                    汇合点
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
                  <Button
                    icon={<DeploymentUnitOutlined />}
                    block
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/reactflow", "subprocess");
                    }}
                  >
                    子流程
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
                  <span>{rightPanelTab === "node" ? "节点属性" : "流程属性"}</span>
                  <Space>
                    {selectedNode.data.type !== "start" && selectedNode.data.type !== "end" && (
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={handleDeleteNode} />
                    )}
                    <Button type="text" size="small" onClick={() => setSelectedNode(null)}>
                      关闭
                    </Button>
                  </Space>
                </div>
              }
              bordered
              style={{ height: "100%", borderRadius: 8, display: "flex", flexDirection: "column" }}
              styles={{ body: { overflowY: "auto", overflowX: "hidden" } }}
            >
              <Tabs
                activeKey={rightPanelTab}
                onChange={(k) => setRightPanelTab((k as "node" | "flow") || "node")}
                items={[
                  { key: "node", label: "节点属性" },
                  { key: "flow", label: "流程属性" },
                ]}
              />
              {rightPanelTab === "node" ? (
              <>
              <Form form={editForm} layout="vertical">
                <Form.Item label="节点编码">
                  <Input value={selectedNode.id} disabled />
                </Form.Item>
                <Form.Item label="节点名称" name="label" rules={[{ required: true, message: "请输入节点名称" }]}>
                  <Input
                    placeholder="例如：部门审批 / 财务审批"
                    onBlur={() => {
                      if (!selectedNode) return;
                      const raw = editForm.getFieldValue("label");
                      const label = typeof raw === "string" ? raw.trim() : "";
                      if (!label) return;
                      const idx = nodes.findIndex((n) => n.id === selectedNode.id);
                      if (idx < 0) return;
                      const curLabel = String((nodes[idx].data as WorkflowNodeData).label ?? "");
                      if (curLabel === label) return;
                      const newNodes = [...nodes];
                      newNodes[idx] = {
                        ...nodes[idx],
                        data: { ...(nodes[idx].data as WorkflowNodeData), label },
                      };
                      setNodes(newNodes);
                      setSelectedNode(newNodes[idx]);
                    }}
                  />
                </Form.Item>
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  destroyInactiveTabPane={false}
                  items={[
                    {
                      key: "basic",
                      label: "基础设置",
                      forceRender: true,
                      children: (
                        <div>
                          {(selectedNode.data.type === "approval" || selectedNode.data.type === "task" || selectedNode.data.type === "handler") && (
                            <>
                              <Form.Item name="assigneeType" hidden><Select options={[]} /></Form.Item>
                              <Form.Item name="assigneeValues" hidden><Select mode="multiple" options={[]} /></Form.Item>
                              <Form.Item name="formFieldId" hidden><Select options={[]} /></Form.Item>
                              <Form.Item label={selectedNode.data.type === "handler" ? "经办人" : "审批人"}>
                                <div style={{ display: "flex", border: "1px solid #d9d9d9", borderRadius: 6, overflow: "hidden", height: 36, alignItems: "center" }}>
                                  <div style={{ flex: 1, textAlign: "center", color: "#666", cursor: "pointer" }} onClick={() => {
                                    const t = (editForm.getFieldValue("assigneeType") || "initiator") as AssigneeType;
                                    const vals = (editForm.getFieldValue("assigneeValues") || []) as string[];
                                    const ff = String(editForm.getFieldValue("formFieldId") || "");
                                    setTempApproverType(t);
                                    setTempApproverValues(Array.isArray(vals) ? vals : []);
                                    setTempFormFieldId(ff);
                                    setApproverTab(t === "department" ? "department" : t === "role" ? "role" : t === "formField" ? "formField" : "user");
                                    setApproverModalOpen(true);
                                  }}>{approverSummary || "点击设置审批人"}</div>
                                  <div
                                    style={{ width: 36, textAlign: "center", borderLeft: "1px solid #f0f0f0", color: "#1677ff", fontSize: 20, lineHeight: "36px", cursor: "pointer" }}
                                    onClick={() => {
                                      const t = (editForm.getFieldValue("assigneeType") || "initiator") as AssigneeType;
                                      const vals = (editForm.getFieldValue("assigneeValues") || []) as string[];
                                      const ff = String(editForm.getFieldValue("formFieldId") || "");
                                      setTempApproverType(t);
                                      setTempApproverValues(Array.isArray(vals) ? vals : []);
                                      setTempFormFieldId(ff);
                                      setApproverTab(t === "department" ? "department" : t === "role" ? "role" : t === "formField" ? "formField" : "user");
                                      setApproverModalOpen(true);
                                    }}
                                  >+</div>
                                </div>
                              </Form.Item>

                              <div style={{ marginBottom: 12 }}>
                                <div style={{ fontWeight: 600, marginBottom: 8 }}>操作权限</div>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "minmax(72px,1fr) repeat(4,30px)",
                                    columnGap: 4,
                                    alignItems: "center",
                                    fontSize: 12,
                                    color: "#666",
                                    marginBottom: 6,
                                  }}
                                >
                                  <div>字段</div>
                                  <div style={{ textAlign: "center" }}>可见</div>
                                  <div style={{ textAlign: "center" }}>可写</div>
                                  <div style={{ textAlign: "center" }}>必填</div>
                                  <div style={{ textAlign: "center" }}>打印</div>
                                </div>
                                <div
                                  style={{
                                    border: "1px solid #f0f0f0",
                                    borderRadius: 6,
                                    padding: 6,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "minmax(72px,1fr) repeat(4,30px)",
                                      columnGap: 4,
                                      alignItems: "center",
                                      padding: "4px 0",
                                      borderBottom: "1px solid #f5f5f5",
                                      marginBottom: 4,
                                    }}
                                  >
                                    <div style={{ fontSize: 12 }}>全选</div>
                                    <div style={{ display: "flex", justifyContent: "center" }}><Form.Item name={["fieldAuthMatrix", "__all__", "visible"]} valuePropName="checked" noStyle><Checkbox /></Form.Item></div>
                                    <div style={{ display: "flex", justifyContent: "center" }}><Form.Item name={["fieldAuthMatrix", "__all__", "editable"]} valuePropName="checked" noStyle><Checkbox /></Form.Item></div>
                                    <div style={{ display: "flex", justifyContent: "center" }}><Form.Item name={["fieldAuthMatrix", "__all__", "required"]} valuePropName="checked" noStyle><Checkbox /></Form.Item></div>
                                    <div style={{ display: "flex", justifyContent: "center" }}><Form.Item name={["fieldAuthMatrix", "__all__", "printable"]} valuePropName="checked" noStyle><Checkbox /></Form.Item></div>
                                  </div>
                                  {permissionRows.map((row) => (
                                    <div
                                      key={row.key}
                                      style={{
                                        display: "grid",
                                        gridTemplateColumns: "minmax(72px,1fr) repeat(4,30px)",
                                        columnGap: 4,
                                        alignItems: "center",
                                        padding: "4px 0",
                                      }}
                                    >
                                      <div
                                        style={{
                                          fontSize: 12,
                                          paddingLeft: row.level > 0 ? 16 : 0,
                                          fontWeight: row.isSubtableParent ? 600 : 400,
                                          lineHeight: "18px",
                                          wordBreak: "break-all",
                                        }}
                                      >
                                        {row.label}
                                      </div>
                                      <div style={{ display: "flex", justifyContent: "center" }}><Form.Item name={["fieldAuthMatrix", row.key, "visible"]} valuePropName="checked" noStyle><Checkbox /></Form.Item></div>
                                      <div style={{ display: "flex", justifyContent: "center" }}><Form.Item name={["fieldAuthMatrix", row.key, "editable"]} valuePropName="checked" noStyle><Checkbox /></Form.Item></div>
                                      <div style={{ display: "flex", justifyContent: "center" }}><Form.Item name={["fieldAuthMatrix", row.key, "required"]} valuePropName="checked" noStyle><Checkbox /></Form.Item></div>
                                      <div style={{ display: "flex", justifyContent: "center" }}><Form.Item name={["fieldAuthMatrix", row.key, "printable"]} valuePropName="checked" noStyle><Checkbox /></Form.Item></div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          {selectedNode.data.type === "approval" && (
                            <Form.Item label="审批方式" name="approvalMode" rules={[{ required: true, message: "请选择审批方式" }]}>
                              <Radio.Group>
                                <Radio value="all">会签（需要所有人同意）</Radio>
                                <Radio value="any">或签（任意一人同意即可）</Radio>
                              </Radio.Group>
                            </Form.Item>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: "advanced",
                      label: "高级设置",
                      forceRender: true,
                      children: (
                        <div>
                          {(selectedNode.data.type === "approval" || selectedNode.data.type === "task" || selectedNode.data.type === "handler") && (
                            <Form.Item label="节点字段权限" tooltip="按当前节点控制字段可见/只读/可编辑">
                              <Form.List name="nodeFieldPermissions">
                                {(fields, { add, remove }) => (
                                  <>
                                    {fields.map((field) => (
                                      <Space key={field.key} style={{ display: "flex", marginBottom: 8 }} align="baseline">
                                        <Form.Item {...field} name={[field.name, "fieldId"]} rules={[{ required: true, message: "请选择字段" }]}>
                                          <Select
                                            style={{ width: 170 }}
                                            placeholder="选择字段"
                                            options={(formFields || []).map((f) => ({
                                              label: f.label || f.fieldId,
                                              value: f.fieldId,
                                            }))}
                                          />
                                        </Form.Item>
                                        <Form.Item {...field} name={[field.name, "action"]} rules={[{ required: true, message: "请选择权限" }]}>
                                          <Select
                                            style={{ width: 100 }}
                                            options={[
                                              { label: "隐藏", value: "hidden" },
                                              { label: "只读", value: "readonly" },
                                              { label: "可编辑", value: "editable" },
                                            ]}
                                          />
                                        </Form.Item>
                                        <Button type="link" danger onClick={() => remove(field.name)}>删</Button>
                                      </Space>
                                    ))}
                                    <Button type="dashed" onClick={() => add({ action: "readonly" })} block>添加字段权限</Button>
                                  </>
                                )}
                              </Form.List>
                            </Form.Item>
                          )}
                        </div>
                      ),
                    },
                  ]}
                />
                <Button type="primary" block onClick={handleSaveNode}>保存节点配置</Button>
              </Form>
              <Modal
                title={selectedNode?.data?.type === "handler" ? "经办人" : "审批人"}
                open={approverModalOpen}
                onCancel={() => setApproverModalOpen(false)}
                onOk={() => {
                  const specialTypeMap: Record<string, AssigneeType> = {
                    "__initiator__": "initiator",
                    "__dept_leader__": "initiatorLeader",
                  };
                  const nextType = specialTypeMap[String(tempFormFieldId)] || tempApproverType;
                  const nextValues =
                    nextType === "formField" || nextType === "initiator" || nextType === "initiatorLeader"
                      ? []
                      : tempApproverValues;
                  editForm.setFieldsValue({
                    assigneeType: nextType,
                    assigneeValues: nextValues,
                    formFieldId: nextType === "formField" ? tempFormFieldId : undefined,
                  });
                  setApproverModalOpen(false);
                  // 同步到画布上的节点数据，避免「审批人」已改但节点仍显示旧配置，必须再点一次保存才生效
                  if (selectedNode) {
                    const idx = nodes.findIndex((n) => n.id === selectedNode.id);
                    if (idx >= 0) {
                      const cur = nodes[idx];
                      const nd = cur.data as WorkflowNodeData;
                      if (nd.type === "approval" || nd.type === "task" || nd.type === "handler") {
                        const nextData: WorkflowNodeData = {
                          ...nd,
                          assignees: {
                            type: nextType,
                            values: nextValues,
                            ...(nextType === "formField" && tempFormFieldId
                              ? { formFieldId: tempFormFieldId }
                              : {}),
                          },
                        };
                        const newNodes = [...nodes];
                        newNodes[idx] = { ...cur, data: nextData };
                        setNodes(newNodes);
                        setSelectedNode(newNodes[idx]);
                      }
                    }
                  }
                }}
                width={980}
                okText="确定"
                cancelText="取消"
              >
                <div
                  style={{
                    minHeight: 96,
                    border: "1px solid #e5e7eb",
                    borderRadius: 2,
                    padding: 10,
                    marginBottom: 12,
                    background: "#fff",
                  }}
                >
                  <Space wrap>
                    {tempApproverType === "initiator" && <Tag>{`发起人`}</Tag>}
                    {tempApproverType === "initiatorLeader" && <Tag>{`发起人直属上级`}</Tag>}
                    {tempApproverType === "formField" && tempFormFieldId && (
                      <Tag>
                        {(() => {
                          const specialLabelMap: Record<string, string> = {
                            "__initiator__": "发起人",
                            "__dept_leader__": "部门领导",
                            "__owner_dept__": "所属部门",
                            "__owner__": "拥有者",
                          };
                          return (
                            specialLabelMap[String(tempFormFieldId)] ||
                            assigneeFormFieldOptions.find((x) => String(x.value) === String(tempFormFieldId))?.label ||
                            tempFormFieldId
                          );
                        })()}
                      </Tag>
                    )}
                    {(tempApproverType === "user" || tempApproverType === "role" || tempApproverType === "department") &&
                      (tempApproverValues || []).map((x) => {
                        const key = String(x);
                        let label = key;
                        if (tempApproverType === "user") {
                          label =
                            userOptions.find((u) => String(u.value) === key)?.label || key;
                        } else if (tempApproverType === "role") {
                          label =
                            roleOptions.find((r) => String(r.value) === key)?.label || key;
                        } else if (tempApproverType === "department") {
                          const findDeptLabel = (items: any[]): string => {
                            for (const d of items || []) {
                              const id = String(d?.id || d?.value || "");
                              if (id === key) return String(d?.name || d?.label || key);
                              const child = Array.isArray(d?.children) ? findDeptLabel(d.children) : "";
                              if (child) return child;
                            }
                            return "";
                          };
                          label = findDeptLabel(deptTree || []) || key;
                        }
                        return <Tag key={key}>{label}</Tag>;
                      })}
                    {!(
                      tempApproverType === "initiator" ||
                      tempApproverType === "initiatorLeader" ||
                      tempFormFieldId ||
                      (tempApproverValues || []).length > 0
                    ) && <span style={{ color: "#bfbfbf" }}>请从下方选择内容</span>}
                  </Space>
                </div>
                <Tabs
                  activeKey={approverTab}
                  onChange={(k) => {
                    setApproverTab(k);
                    if (k === "department") setTempApproverType("department");
                    if (k === "user") setTempApproverType("user");
                    if (k === "role") setTempApproverType("role");
                    if (k === "peopleControl") setTempApproverType("formField");
                    if (k === "formField") setTempApproverType("formField");
                  }}
                  items={[
                    {
                      key: "department",
                      label: "部门",
                      children: (
                        <div>
                          <Input placeholder="搜索部门" style={{ marginBottom: 8 }} />
                          <div
                            style={{
                              height: 360,
                              border: "1px solid #e5e7eb",
                              overflow: "auto",
                              padding: "8px 12px",
                            }}
                          >
                            <Tree
                              checkable
                              defaultExpandAll
                              showLine
                              checkedKeys={tempApproverType === "department" ? tempApproverValues : []}
                              onCheck={(checked) => {
                                setTempApproverType("department");
                                const vals = Array.isArray(checked) ? checked : (checked as any).checked;
                                setTempApproverValues((vals || []).map(String));
                              }}
                              treeData={deptTreeData}
                            />
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "user",
                      label: "人员",
                      children: (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, border: "1px solid #e5e7eb", height: 360 }}>
                          <div style={{ borderRight: "1px solid #e5e7eb", overflow: "auto", padding: 8 }}>
                            <Tree
                              defaultExpandAll
                              showLine
                              selectedKeys={selectedDeptIdForUserTab ? [selectedDeptIdForUserTab] : []}
                              onSelect={(keys) => setSelectedDeptIdForUserTab(String(keys?.[0] || ""))}
                              treeData={deptTreeData}
                            />
                          </div>
                          <div style={{ overflow: "auto", padding: 8 }}>
                            {(usersOfSelectedDept || []).map((u) => {
                              const checked = (tempApproverValues || []).includes(String(u.value));
                              return (
                                <div key={u.value} style={{ padding: "6px 0" }}>
                                  <Checkbox
                                    checked={checked}
                                    onChange={(e) => {
                                      setTempApproverType("user");
                                      const next = new Set((tempApproverValues || []).map(String));
                                      if (e.target.checked) next.add(String(u.value));
                                      else next.delete(String(u.value));
                                      setTempApproverValues(Array.from(next));
                                    }}
                                  >
                                    {u.label}
                                  </Checkbox>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ),
                    },
                    {
                      key: "role",
                      label: "角色",
                      children: (
                        <div style={{ border: "1px solid #e5e7eb", height: 360, overflow: "auto", padding: 8 }}>
                          {roleOptions.map((r) => {
                            const checked = (tempApproverValues || []).includes(String(r.value));
                            return (
                              <div key={r.value} style={{ padding: "6px 0" }}>
                                <Checkbox
                                  checked={checked}
                                  onChange={(e) => {
                                    setTempApproverType("role");
                                    const next = new Set((tempApproverValues || []).map(String));
                                    if (e.target.checked) next.add(String(r.value));
                                    else next.delete(String(r.value));
                                    setTempApproverValues(Array.from(next));
                                  }}
                                >
                                  {r.label}
                                </Checkbox>
                              </div>
                            );
                          })}
                        </div>
                      ),
                    },
                    {
                      key: "peopleControl",
                      label: "人员部门控件",
                      children: (
                        <div style={{ border: "1px solid #e5e7eb", height: 360, overflow: "auto", padding: 8 }}>
                          {peopleDeptControlOptions.map((p) => {
                            const checked = tempApproverType === "formField" && tempFormFieldId === p.value;
                            return (
                              <div key={p.value} style={{ padding: "6px 0" }}>
                                <Checkbox
                                  checked={checked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setTempApproverType("formField");
                                      setTempFormFieldId(String(p.value));
                                    } else {
                                      setTempFormFieldId("");
                                    }
                                  }}
                                >
                                  {p.label}
                                </Checkbox>
                              </div>
                            );
                          })}
                        </div>
                      ),
                    },
                    {
                      key: "formField",
                      label: "表单字段",
                      children: (
                        <div style={{ border: "1px solid #e5e7eb", height: 360, overflow: "auto", padding: 8 }}>
                          <Tree
                            defaultExpandAll
                            showLine
                            checkable
                            checkedKeys={tempApproverType === "formField" && tempFormFieldId ? [tempFormFieldId] : []}
                            onCheck={(checked) => {
                              const keys = (Array.isArray(checked) ? checked : (checked as any).checked || []).map(String);
                              const leaf = keys.filter((k) => !k.startsWith("__")).slice(-1)[0] || "";
                              setTempApproverType("formField");
                              setTempFormFieldId(leaf);
                            }}
                            treeData={formFieldTreeData}
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </Modal>
              </>
              ) : (
                <div style={{ fontSize: 12, color: "#666", paddingTop: 8 }}>
                  流程属性功能将继续补齐（流程名称、发起权限、全局规则）。
                </div>
              )}
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
    </div>
  );
};
