/**
 * 流程实例里「动态审批人」在 definition 中常无具体 userId，需结合 assignees.type 展示可读说明。
 */

export function describeAssigneeRule(
  assignees: { type?: string; formFieldId?: string } | undefined | null,
): string {
  if (!assignees) return "待分配";
  const t = String(assignees.type || "");
  const ff = String((assignees as { formFieldId?: string }).formFieldId || "");
  if (t === "initiator") return "发起人本人";
  if (t === "initiatorLeader") return "发起人直属上级";
  if (t === "formField") {
    const map: Record<string, string> = {
      __initiator__: "发起人本人",
      __dept_leader__: "部门领导",
      __owner_dept__: "所属部门用户",
      __owner__: "拥有者",
    };
    if (map[ff]) return map[ff];
    return "表单字段";
  }
  if (t === "role") return "按角色分配";
  if (t === "department") return "按部门";
  if (t === "user") return "指定人员";
  return "待分配";
}

export function formatPendingHandlersLine(
  assignees: { type?: string; values?: string[]; formFieldId?: string } | undefined | null,
  resolveUser: (id: string) => string,
): string {
  const ids = Array.isArray(assignees?.values) ? assignees.values.map(String).filter(Boolean) : [];
  if (ids.length) {
    const names = ids.map((id) => resolveUser(id)).filter(Boolean).join("、");
    return names || "—";
  }
  const rule = describeAssigneeRule(assignees || undefined);
  return `${rule}（未解析到具体用户，请检查钉钉同步或用户上级的 metadata）`;
}

export function describeNextHumanAfterCurrent(
  instance: { currentNodeId?: string; definition?: any },
  resolveUser: (id: string) => string,
): string {
  const def = instance?.definition;
  const currentNodeId = instance?.currentNodeId;
  if (!currentNodeId || !def) return "—";
  try {
    const edges: any[] = def.edges || [];
    const nextEdge = edges.find(
      (e) => e.source === currentNodeId || e.sourceId === currentNodeId,
    );
    if (!nextEdge) return "—";
    const nextNodeId = nextEdge.target || nextEdge.targetId;
    const nodes: any[] = def.nodes || [];
    const nextNode = nodes.find((n) => n.nodeId === nextNodeId || n.id === nextNodeId);
    if (!nextNode) return "—";
    if (nextNode.type === "end") return "—（下一节点为结束，无后续审批人）";
    if (nextNode.type !== "approval" && nextNode.type !== "task" && nextNode.type !== "handler") {
      return "—";
    }
    const ids: string[] = Array.isArray(nextNode.assignees?.values) ? nextNode.assignees.values.map(String) : [];
    if (ids.length) {
      return ids.map((id) => resolveUser(id)).filter(Boolean).join("、") || "—";
    }
    return `${describeAssigneeRule(nextNode.assignees)}（提交/流转时解析）`;
  } catch {
    return "—";
  }
}

/** 流程节点 Steps：副标题一行展示「审批类型 + 审批人姓名或规则」 */
export function buildWorkflowStepDescription(params: {
  node: { nodeId?: string; type?: string; label?: string; assignees?: any };
  instance: {
    history?: Array<{ nodeId?: string; type?: string; at?: string; userId?: string; userName?: string }>;
    tasks?: Array<{ nodeId?: string; status?: string; assignees?: any }>;
  };
  resolveUser: (userId?: any, userName?: string) => string;
  dayjs: (v: string) => { format: (f: string) => string };
}): string {
  const { node, instance, resolveUser, dayjs } = params;
  const nodeId = node.nodeId || "";
  const baseRole =
    node.type === "approval"
      ? "审批"
      : node.type === "task"
        ? "抄送"
        : node.type === "handler"
          ? "经办"
          : node.type === "start"
            ? "发起"
            : node.type === "end"
              ? "结束"
              : String(node.type || "");

  if (node.type === "start" || node.type === "end") {
    const hid = (instance.history || []).find((h) => h.nodeId === nodeId);
    const t = hid?.at ? ` · ${dayjs(hid.at).format("YYYY-MM-DD HH:mm")}` : "";
    return `${baseRole}${t}`;
  }

  const approveHist = (instance.history || []).find(
    (h) => h.nodeId === nodeId && h.type === "approve",
  );
  if (approveHist) {
    const who = resolveUser(approveHist.userId, approveHist.userName);
    const t = approveHist.at ? ` · ${dayjs(approveHist.at).format("YYYY-MM-DD HH:mm")}` : "";
    return `${baseRole} · ${who} 已处理${t}`;
  }

  const task =
    (instance.tasks || []).find((t) => t.nodeId === nodeId && t.status === "pending") ||
    (instance.tasks || []).find((t) => t.nodeId === nodeId);

  const assignees = task?.assignees || node.assignees;
  const ids = Array.isArray(assignees?.values) ? assignees.values.map(String).filter(Boolean) : [];

  if (node.type === "approval" || node.type === "task" || node.type === "handler") {
    if (ids.length) {
      const names = ids.map((id) => resolveUser(id)).filter(Boolean).join("、");
      const who =
        node.type === "approval" ? "审批人" : node.type === "task" ? "抄送人" : "处理人";
      return `${baseRole} · ${who}：${names}`;
    }
    const rule = describeAssigneeRule(assignees);
    return `${baseRole} · ${rule}（未解析到用户）`;
  }

  const hid = (instance.history || []).find((h) => h.nodeId === nodeId);
  const t = hid?.at ? ` · ${dayjs(hid.at).format("YYYY-MM-DD HH:mm")}` : "";
  return `${baseRole}${t}`;
}
