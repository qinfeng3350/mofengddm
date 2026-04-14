import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, Descriptions, Timeline, Tag, Space, Input, Button, message, Popconfirm, Steps, Typography, Tabs, Empty } from "antd";
import dayjs from "dayjs";
import { workflowApi } from "@/api/workflow";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";
import { apiClient } from "@/api/client";
import { operationLogApi } from "@/api/operationLog";
import { CheckOutlined, CloseOutlined, RollbackOutlined, BellOutlined } from "@ant-design/icons";
import { useAuthStore } from "@/store/useAuthStore";
import {
  buildWorkflowStepDescription,
  describeNextHumanAfterCurrent,
  formatPendingHandlersLine,
} from "@/utils/workflowDisplay";

interface Props {
  recordId: string;
}

export const WorkflowInstancePanel: React.FC<Props> = ({ recordId }) => {
  const { user } = useAuthStore();
  const { data: formData } = useQuery({
    queryKey: ["formData", "forWorkflowPanel", recordId],
    queryFn: () => formDataApi.getById(recordId),
    enabled: !!recordId,
    retry: 1,
  });

  const { data: formDefinition } = useQuery({
    queryKey: ["formDefinition", "workflow-panel", formData?.formId],
    queryFn: () => formDefinitionApi.getById(String(formData?.formId || "")),
    enabled: !!formData?.formId,
    retry: 1,
  });

  const { data: userList = [] } = useQuery({
    queryKey: ["users", "workflow-panel"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/users");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    (userList as any[]).forEach((u) => u && map.set(String(u.id), u));
    return map;
  }, [userList]);

  const resolveUser = (userId?: any, userName?: string) => {
    if (userName) return userName;
    const id = userId ? String(userId) : "";
    const u = id ? userMap.get(id) : null;
    if (u) return u.name || u.account || id;
    if (!id && formData?.submitterName) return formData.submitterName;
    if (id) return `用户#${id}`;
    return "-";
  };

  const { data: workflowInstance, refetch, isLoading } = useQuery({
    queryKey: ["workflow-instance", recordId],
    queryFn: () => workflowApi.getInstanceByRecord(recordId),
    enabled: !!recordId,
    retry: false,
  });

  const instance: any = (workflowInstance as any)?.data ?? (workflowInstance as any);

  const pendingTask = (instance?.tasks || []).find((t: any) => t.status === "pending");
  const [comment, setComment] = useState("");
  const [activeTab, setActiveTab] = useState<"workflow" | "operation">("workflow");

  const findNode = (def: any, nodeId?: string) => {
    if (!nodeId || !def?.nodes) return undefined;
    return (def.nodes as any[]).find((n) => n.nodeId === nodeId || n.id === nodeId);
  };

  /** 按连线从「发起」顺序到结束，用于展示完整流程图 */
  const orderedDefinitionNodes = useMemo(() => {
    const def = instance?.definition;
    const nodes = (def?.nodes || []) as any[];
    const edges = (def?.edges || []) as any[];
    const start = nodes.find((n) => n.type === "start");
    if (!start) return nodes;
    const out: any[] = [];
    const seen = new Set<string>();
    let cur: any = start;
    let guard = 0;
    while (cur && !seen.has(cur.nodeId) && guard++ < 50) {
      out.push(cur);
      seen.add(cur.nodeId);
      const e = edges.find((ed) => ed.source === cur.nodeId);
      const nextId = e?.target;
      cur = nextId ? nodes.find((n) => n.nodeId === nextId) : undefined;
    }
    return out;
  }, [instance?.definition]);

  const nodeTypeTitle = (node: any) => {
    if (!node) return "节点";
    if (node.label) return String(node.label);
    switch (node.type) {
      case "start":
        return "发起";
      case "end":
        return "结束";
      case "approval":
        return "审批";
      case "task":
        return "抄送";
      case "condition":
        return "条件分支";
      case "parallel":
        return "并行分支";
      default:
        return node.nodeId || "节点";
    }
  };

  const historyItemTitle = (h: any, def: any) => {
    if (h.label) return h.label;
    const n = findNode(def, h.nodeId);
    if (n) return nodeTypeTitle(n);
    if (h.nodeType) {
      return nodeTypeTitle({ type: h.nodeType, label: h.label, nodeId: h.nodeId });
    }
    return h.nodeId || "节点";
  };

  const historyActionVerb = (h: any, def: any) => {
    if (h.type === "start") return "发起";
    if (h.type === "end") return "结束";
    if (h.type === "reject") return "拒绝";
    if (h.type === "return") return "退回";
    if (h.type === "approve") {
      const nt = h.nodeType || findNode(def, h.nodeId)?.type;
      if (nt === "task") return "已阅";
      return "同意";
    }
    return "流转";
  };

  const startHistory = (instance?.history || []).find((h: any) => h.type === "start");
  const initiatorDisplay =
    startHistory?.userName || formData?.submitterName || resolveUser(startHistory?.userId, startHistory?.userName);

  const canHandle = useMemo(() => {
    if (!pendingTask || !user) return false;
    const assignees: any[] = pendingTask.assignees?.values || [];
    if (!assignees.length) return false;
    return assignees.map(String).includes(String(user.id));
  }, [pendingTask, user]);

  const [pendingWorkflowAction, setPendingWorkflowAction] = useState<
    "approve" | "reject" | "return" | null
  >(null);

  const actionMutation = useMutation({
    mutationFn: async ({ action }: { action: "approve" | "reject" | "return" }) => {
      if (!instance || !pendingTask) return;
      await workflowApi.action(instance.id, {
        nodeId: pendingTask.nodeId,
        action,
        comment: comment || undefined,
      });
    },
    onMutate: ({ action }) => setPendingWorkflowAction(action),
    onSettled: () => setPendingWorkflowAction(null),
    onSuccess: () => {
      message.success("已提交处理");
      refetch();
    },
    onError: (err: any) => {
      message.error(err?.message || "处理失败");
    },
  });

  const isInitiator = useMemo(() => {
    if (!instance || !user) return false;
    return startHistory?.userId === user.id || formData?.submitterId === user.id;
  }, [instance, user, formData, startHistory]);

  /** 退回发起节点后，待办在「发起」节点，发起人改单后用「提交」推进流程 */
  const pendingAtStartNode = useMemo(() => {
    if (!instance || !pendingTask) return false;
    const n = findNode(instance.definition, pendingTask.nodeId);
    return n?.type === "start";
  }, [instance, pendingTask]);

  const remindMutation = useMutation({
    mutationFn: async () => {
      if (!instance || !pendingTask) return;
      const assignees = pendingTask.assignees?.values || [];
      const names = assignees.map((id: any) => resolveUser(id)).filter(Boolean);
      message.success(`已催办：${names.join("、")}`);
    },
    onError: (err: any) => {
      message.error(err?.message || "催办失败");
    },
  });

  const currentNodeLabel = () => {
    const def = instance?.definition;
    const status = String(instance?.status || "");
    if (status === "completed") return "已结束";
    if (status === "rejected") return "已拒绝";
    const nodeId = instance?.currentNodeId;
    if (!nodeId) return "-";
    const n = findNode(def, nodeId);
    return n ? nodeTypeTitle(n) : nodeId;
  };

  const { data: operationLogs = [], isLoading: operationLoading } = useQuery({
    queryKey: ["operation-logs", formData?.formId, recordId],
    queryFn: () => operationLogApi.getLogs(String(formData?.formId || ""), recordId, 200),
    enabled: !!formData?.formId && !!recordId,
    staleTime: 30_000,
  });

  const prettyValue = (v: any) => {
    if (v === null || v === undefined || v === "") return "空";
    if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join("，");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const fieldLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    const cfg: any = (formDefinition as any)?.config || {};
    const walk = (items: any[]) => {
      (items || []).forEach((it: any) => {
        if (!it || typeof it !== "object") return;
        if (it.fieldId) {
          map.set(String(it.fieldId), String(it.label || it.name || it.fieldId));
          if (it.type === "subtable" && Array.isArray(it.subtableFields)) {
            it.subtableFields.forEach((sf: any) => {
              if (sf?.fieldId) {
                map.set(String(sf.fieldId), String(sf.label || sf.name || sf.fieldId));
              }
            });
          }
        }
        if (Array.isArray(it.children)) walk(it.children);
        if (Array.isArray(it.columns)) {
          it.columns.forEach((c: any) => Array.isArray(c?.children) && walk(c.children));
        }
      });
    };
    walk(cfg.elements || cfg.fields || []);
    return map;
  }, [formDefinition]);

  const prettyFieldLabel = (fieldId?: string, fieldLabel?: string) => {
    if (fieldLabel && !/^field_[A-Za-z0-9_]+$/.test(String(fieldLabel))) return String(fieldLabel);
    const fid = String(fieldId || "");
    return fieldLabelMap.get(fid) || (fid ? "字段" : "-");
  };

  const prettyDescription = (desc?: string) => {
    if (!desc) return "";
    let s = String(desc);
    // 不显示 form_xxx / record_xxx 编码
    s = s.replace(/form_[A-Za-z0-9_]+/g, "当前表单");
    s = s.replace(/record_[A-Za-z0-9_]+/g, "当前记录");
    // 把字段编码替换为可读名称
    s = s.replace(/(subfield_[A-Za-z0-9_]+|field_[A-Za-z0-9_]+)/g, (token) => {
      return fieldLabelMap.get(token) || "字段";
    });
    return s;
  };

  return (
    <Card loading={isLoading}>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as "workflow" | "operation")}
        items={[
          { key: "workflow", label: "流程明细" },
          { key: "operation", label: "操作记录" },
        ]}
      />

      {activeTab === "workflow" ? (
        !instance ? (
          <div style={{ color: "#999" }}>未找到流程实例</div>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
          <Descriptions column={3} bordered size="small">
            <Descriptions.Item label="实例ID">{instance.id}</Descriptions.Item>
            <Descriptions.Item label="状态">
              {(() => {
                const status = String(instance.status || "");
                const text = status === "completed" ? "已完成" : status === "rejected" ? "已拒绝" : status === "running" ? "运行中" : status || "-";
                const color = status === "completed" ? "green" : status === "rejected" ? "red" : "blue";
                return <Tag color={color}>{text}</Tag>;
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="发起人">{initiatorDisplay}</Descriptions.Item>
            <Descriptions.Item label="当前节点">{currentNodeLabel()}</Descriptions.Item>
            <Descriptions.Item label="待处理人">
              {(() => {
                if (!pendingTask) return "—";
                return formatPendingHandlersLine(pendingTask.assignees, (id) => resolveUser(id));
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="下一个审批人">
              {describeNextHumanAfterCurrent(instance, (id) => resolveUser(id))}
            </Descriptions.Item>
          </Descriptions>

          {orderedDefinitionNodes.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>流程节点（按设计顺序）</div>
              <Steps
                direction="vertical"
                size="small"
                items={orderedDefinitionNodes.map((node) => {
                  const done = (instance.history || []).some((h: any) => h.nodeId === node.nodeId);
                  const isCurrent = instance.currentNodeId === node.nodeId && instance.status === "running";
                  let status: "wait" | "process" | "finish" | "error" = "wait";
                  if (done) status = "finish";
                  else if (isCurrent) status = "process";
                  const desc = buildWorkflowStepDescription({
                    node,
                    instance,
                    resolveUser,
                    dayjs,
                  });
                  return {
                    status,
                    title: nodeTypeTitle(node),
                    description: <span style={{ fontSize: 12, color: "#888" }}>{desc}</span>,
                  };
                })}
              />
            </div>
          )}

          <div style={{ fontWeight: 600, marginTop: 8 }}>流转记录</div>
          <Timeline style={{ marginTop: 8 }}>
            {(instance.history || []).map((h: any, idx: number) => (
              <Timeline.Item
                key={idx}
                color={h.type === "approve" ? "green" : h.type === "reject" ? "red" : "blue"}
              >
                <div style={{ fontWeight: 500 }}>
                  {historyItemTitle(h, instance?.definition)}
                </div>
                <div style={{ color: "#666" }}>
                  {resolveUser(h.userId, h.userName)} · {historyActionVerb(h, instance?.definition)}
                </div>
                <div style={{ color: "#999", fontSize: 12 }}>{h.at && dayjs(h.at).format("YYYY-MM-DD HH:mm:ss")}</div>
                {h.comment && <div style={{ color: "#999", marginTop: 4 }}>备注：{h.comment}</div>}
              </Timeline.Item>
            ))}
          </Timeline>

          {pendingTask && canHandle && (
            <Space direction="vertical" style={{ width: "100%" }}>
              {pendingAtStartNode && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  当前为退回后的发起节点：请先到表单中修改数据并保存，再点击下方「提交」进入下一审批节点。
                </Typography.Text>
              )}
              <Input.TextArea
                placeholder={pendingAtStartNode ? "选填：备注说明" : "请输入审批意见"}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={4}
              />
              <Space>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={pendingWorkflowAction === "approve"}
                  onClick={() => actionMutation.mutate({ action: "approve" })}
                >
                  {pendingAtStartNode ? "提交" : "同意"}
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  loading={pendingWorkflowAction === "reject"}
                  onClick={() => actionMutation.mutate({ action: "reject" })}
                >
                  拒绝
                </Button>
                {!pendingAtStartNode && (
                  <Button
                    icon={<RollbackOutlined />}
                    loading={pendingWorkflowAction === "return"}
                    onClick={() => actionMutation.mutate({ action: "return" })}
                  >
                    退回
                  </Button>
                )}
              </Space>
            </Space>
          )}

          {isInitiator && pendingTask && (
            <div style={{ marginTop: 16 }}>
              <Popconfirm
                title="确定要催办吗？"
                description="将通知待处理人尽快处理此任务"
                onConfirm={() => remindMutation.mutate()}
                okText="确定"
                cancelText="取消"
              >
                <Button icon={<BellOutlined />} loading={remindMutation.isPending}>
                  催办
                </Button>
              </Popconfirm>
            </div>
          )}
          </Space>
        )
      ) : operationLoading ? (
        <div style={{ textAlign: "center", color: "#999", padding: "24px 0" }}>加载中...</div>
      ) : operationLogs.length === 0 ? (
        <Empty description="暂无操作记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <Timeline style={{ marginTop: 8 }}>
          {operationLogs.map((log: any, idx: number) => {
            const fieldChanges =
              Array.isArray(log?.fieldChanges)
                ? log.fieldChanges
                : typeof log?.fieldChanges === "string"
                  ? (() => {
                      try {
                        const parsed = JSON.parse(log.fieldChanges);
                        return Array.isArray(parsed) ? parsed : [];
                      } catch {
                        return [];
                      }
                    })()
                  : [];
            const sourceText =
              (log?.operatorName && String(log.operatorName).includes("业务规则")) ||
              (log?.description && String(log.description).includes("业务规则"))
                ? "业务规则"
                : "人工操作";
            return (
              <Timeline.Item
                key={`${log.id || idx}`}
                color={log.operationType === "delete" ? "red" : log.operationType === "create" ? "green" : "blue"}
              >
                <Space direction="vertical" size={4} style={{ width: "100%" }}>
                  <Space wrap>
                    <Tag color={sourceText === "业务规则" ? "purple" : "cyan"}>{sourceText}</Tag>
                    <Tag>{log.operationType === "create" ? "新增" : log.operationType === "delete" ? "删除" : "更新"}</Tag>
                    <span style={{ color: "#999" }}>
                      {dayjs(log.createdAt).format("YYYY-MM-DD HH:mm:ss")}
                    </span>
                  </Space>
                  <div>
                    操作人：{resolveUser(log.operatorId, log.operatorName)}{" "}
                    {formData?.submitterName ? `（提交人：${formData.submitterName}）` : ""}
                  </div>
                  {log.description ? <div style={{ color: "#666" }}>{prettyDescription(log.description)}</div> : null}
                  {fieldChanges.length > 0 ? (
                    <div style={{ background: "#fafafa", border: "1px solid #f0f0f0", borderRadius: 6, padding: 8 }}>
                      {fieldChanges.map((c: any, i: number) => (
                          <div key={`${log.id}-fc-${i}`} style={{ marginBottom: i === log.fieldChanges.length - 1 ? 0 : 6 }}>
                            <b>{prettyFieldLabel(c.fieldId, c.fieldLabel)}</b>：{prettyValue(c.oldValue)} {"->"} {prettyValue(c.newValue)}
                          </div>
                      ))}
                    </div>
                  ) : null}
                </Space>
              </Timeline.Item>
            );
          })}
        </Timeline>
      )}
    </Card>
  );
};
