import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Spin, Tag, Typography, Space } from "antd";
import { workflowApi } from "@/api/workflow";
import { apiClient } from "@/api/client";

function statusLabel(status: string | undefined) {
  switch (status) {
    case "completed":
      return { text: "已完成", color: "green" as const };
    case "rejected":
      return { text: "已拒绝", color: "red" as const };
    case "running":
      return { text: "运行中", color: "blue" as const };
    default:
      return { text: status || "-", color: "default" as const };
  }
}

function resolveNodeLabel(def: any, nodeId?: string) {
  if (!nodeId) return "-";
  if (nodeId === "start") return "发起";
  if (nodeId === "end") return "结束";
  const nodes: any[] = def?.nodes || [];
  const found = nodes.find((n) => n?.nodeId === nodeId || n?.id === nodeId);
  return found?.label || found?.name || nodeId;
}

/** 待处理人：优先任务上的 assignees，否则取当前节点配置上的 assignees */
function resolvePendingAssigneeNames(
  inst: any,
  resolveUserId: (id: string) => string,
): string {
  const pendingTask = (inst.tasks || []).find((t: any) => t.status === "pending");
  if (pendingTask) {
    const ids: string[] = Array.isArray(pendingTask.assignees?.values)
      ? pendingTask.assignees.values.map((x: any) => String(x))
      : [];
    const names = ids.map((id) => resolveUserId(id)).filter(Boolean);
    if (names.length) return names.join("、");
  }
  const nodeId = inst.currentNodeId;
  const def = inst.definition;
  if (nodeId && def?.nodes) {
    const node = (def.nodes as any[]).find(
      (n) => n?.nodeId === nodeId || n?.id === nodeId,
    );
    const vals = node?.assignees?.values;
    if (Array.isArray(vals) && vals.length) {
      return vals
        .map((x: any) => resolveUserId(String(x)))
        .filter(Boolean)
        .join("、");
    }
  }
  return "";
}

/** 列表行悬停时展示的精简流程状态（只读，不抢焦点） */
export const WorkflowRowHoverCardContent: React.FC<{
  recordId: string;
  formWorkflowEnabled: boolean;
}> = ({ recordId, formWorkflowEnabled }) => {
  const { data: userList = [] } = useQuery({
    queryKey: ["users", "workflow-hover-card"],
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
    (userList as any[]).forEach((u) => {
      if (u) map.set(String(u.id), u);
    });
    return map;
  }, [userList]);

  const resolveUserId = (id: string) => {
    const u = userMap.get(id);
    if (u) return String(u.name || u.account || id);
    return id ? `用户#${id}` : "";
  };

  const { data, isLoading } = useQuery({
    queryKey: ["workflow-instance", "hover", recordId],
    queryFn: async () => {
      try {
        const res = await workflowApi.getInstanceByRecord(recordId);
        return (res as any)?.data ?? res;
      } catch {
        return null;
      }
    },
    enabled: !!recordId && formWorkflowEnabled,
    staleTime: 15 * 1000,
  });

  if (!formWorkflowEnabled) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        本表单未启用流程
      </Typography.Text>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 8, textAlign: "center" }}>
        <Spin size="small" />
      </div>
    );
  }

  if (!data) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        暂无流程实例
      </Typography.Text>
    );
  }

  const inst: any = data;
  const st = statusLabel(inst.status);
  const lastReject = [...(inst.history || [])].reverse().find((h: any) => h.type === "reject");
  const pendingNames = resolvePendingAssigneeNames(inst, resolveUserId);

  return (
    <Space direction="vertical" size={6} style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Typography.Text strong style={{ fontSize: 12 }}>
          流程状态
        </Typography.Text>
        <Tag color={st.color}>{st.text}</Tag>
      </div>
      <div style={{ fontSize: 12, color: "#595959" }}>
        <span style={{ color: "#8c8c8c" }}>当前节点：</span>
        {resolveNodeLabel(inst.definition, inst.currentNodeId)}
      </div>
      {(inst.status === "running" || inst.status === "pending") && (
        <div style={{ fontSize: 12, color: "#595959" }}>
          <span style={{ color: "#8c8c8c" }}>审批人：</span>
          {pendingNames || "未指定"}
        </div>
      )}
      {lastReject && (
        <div style={{ fontSize: 12, color: "#cf1322" }}>
          <span style={{ color: "#8c8c8c" }}>拒绝：</span>
          {lastReject.comment || lastReject.label || "已拒绝"}
        </div>
      )}
      {inst.status === "completed" && (
        <div style={{ fontSize: 12, color: "#389e0d" }}>流程已结束</div>
      )}
    </Space>
  );
};
