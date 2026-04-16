import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Tabs, Empty, Spin, Space, Tag, Typography, Badge, Button } from "antd";
import { UserOutlined, FileTextOutlined, SendOutlined } from "@ant-design/icons";
import { workflowApi } from "@/api/workflow";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/useAuthStore";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";

const { Title, Text } = Typography;

const TaskRichText: React.FC<{ task: any }> = ({ task }) => {
  const { data: formData } = useQuery({
    queryKey: ["task-card-formData", task?.recordId],
    queryFn: () => formDataApi.getById(String(task.recordId)),
    enabled: !!task?.recordId,
    staleTime: 30_000,
  });

  const { data: workflowInstance } = useQuery({
    queryKey: ["task-card-workflow-instance", task?.recordId],
    queryFn: () => workflowApi.getInstanceByRecord(String(task.recordId)),
    enabled: !!task?.recordId,
    staleTime: 30_000,
    retry: false,
  });

  const { data: formDefinition } = useQuery({
    queryKey: ["task-card-formDefinition", task?.formId || formData?.formId],
    queryFn: () => formDefinitionApi.getById(String(task?.formId || formData?.formId || "")),
    enabled: !!(task?.formId || formData?.formId),
    staleTime: 60_000,
  });

  const rendered = useMemo(() => {
    const instance: any = (workflowInstance as any)?.data ?? (workflowInstance as any) ?? {};
    const metaFromInstance: any = instance?.definition?.metadata?.dingtalk || {};
    const metaFromFormDef: any = (formDefinition as any)?.config?.workflow?.metadata?.dingtalk || {};
    const meta: any = Object.keys(metaFromFormDef || {}).length ? metaFromFormDef : metaFromInstance;
    const formValues = (formData as any)?.data || {};
    const submitterName = String((formData as any)?.submitterName || task?.initiatorName || "").trim();
    const formName = String((formDefinition as any)?.formName || "").trim();
    const workflowName = String(instance?.definition?.workflowName || "").trim();

    const fieldMap = new Map<string, string>();
    const fieldDefMap = new Map<string, any>();
    const cfg: any = (formDefinition as any)?.config || {};
    const walk = (list: any[]) => {
      (Array.isArray(list) ? list : []).forEach((item: any) => {
        if (!item || typeof item !== "object") return;
        const id = String(item?.fieldId || "").trim();
        const label = String(item?.label || item?.fieldName || "").trim();
        if (id) {
          fieldMap.set(id, id);
          fieldMap.set(`{${id}}`, id);
          fieldDefMap.set(id, item);
          if (label) {
            fieldMap.set(label, id);
            fieldMap.set(`{${label}}`, id);
          }
        }
        if (Array.isArray(item.children)) walk(item.children);
        if (item.type === "subtable" && Array.isArray(item.subtableFields)) {
          item.subtableFields.forEach((sf: any) => {
            const sid = String(sf?.fieldId || "").trim();
            const slabel = String(sf?.label || sf?.fieldName || "").trim();
            if (!sid) return;
            fieldMap.set(sid, sid);
            fieldMap.set(`{${sid}}`, sid);
            fieldDefMap.set(sid, sf);
            if (slabel) {
              fieldMap.set(slabel, sid);
              fieldMap.set(`{${slabel}}`, sid);
            }
          });
        }
        if (Array.isArray(item.columns)) {
          item.columns.forEach((c: any) => Array.isArray(c?.children) && walk(c.children));
        }
      });
    };
    walk(cfg?.elements || cfg?.fields || []);

    const stringifyValue = (v: any): string => {
      if (v == null) return "";
      if (Array.isArray(v)) {
        return v
          .map((x) => (x == null ? "" : typeof x === "object" ? Object.values(x).join(" / ") : String(x)))
          .filter(Boolean)
          .join("；");
      }
      if (typeof v === "object") return JSON.stringify(v);
      return String(v);
    };

    const formatValueByFieldDef = (fieldId: string, rawValue: any): string => {
      const fieldDef = fieldDefMap.get(fieldId);
      if (!fieldDef) return stringifyValue(rawValue);

      const fieldType = String(fieldDef?.type || "");
      const options = Array.isArray(fieldDef?.options) ? fieldDef.options : [];
      const optionLabelMap = new Map<string, string>();
      options.forEach((opt: any) => {
        const ov = String(opt?.value ?? "").trim();
        const ol = String(opt?.label ?? ov).trim();
        if (ov) optionLabelMap.set(ov, ol);
      });

      const mapSingle = (v: any) => {
        const s = String(v ?? "").trim();
        if (!s) return "";
        return optionLabelMap.get(s) || s;
      };

      if (fieldType === "select" || fieldType === "radio") {
        return mapSingle(rawValue);
      }
      if (fieldType === "checkbox" || fieldType === "multiselect") {
        if (Array.isArray(rawValue)) {
          return rawValue.map((v) => mapSingle(v)).filter(Boolean).join("、");
        }
        return mapSingle(rawValue);
      }
      return stringifyValue(rawValue);
    };

    const resolveToken = (tokenRaw: string) => {
      const inner = String(tokenRaw || "").trim().replace(/^\{|\}$/g, "");
      if (!inner) return "";
      if (inner === "表单名称") return formName || workflowName || "审批流程";
      if (inner === "流程名称") {
        const wf = String(workflowName || "").trim();
        // 设计器常见默认名“流程”信息量太低，回退到更有业务语义的表单名
        if (!wf || wf === "流程") return formName || "审批流程";
        return wf;
      }
      if (inner === "节点名称") return String(task?.label || "审批节点");
      if (inner === "提交人") return submitterName;
      const fieldId = fieldMap.get(inner) || fieldMap.get(`{${inner}}`) || inner;
      return Object.prototype.hasOwnProperty.call(formValues, fieldId)
        ? formatValueByFieldDef(fieldId, formValues[fieldId])
        : "";
    };

    const renderTpl = (tpl: string) => String(tpl || "").replace(/\{[^{}]+\}/g, (m) => resolveToken(m));
    const title =
      renderTpl(String(meta?.todoTitleTemplate || "")).trim() ||
      String(task?.todoTitle || "").trim() ||
      String(task?.label || "流程待办");

    const rows = Array.isArray(meta?.messageFormFields) ? meta.messageFormFields : [];
    const details = rows
      .map((r: any) => {
        const label = String(r?.label || "").trim();
        const token = String(r?.token || "").trim();
        if (!label || !token) return null;
        const val = resolveToken(token);
        return { label, value: val || "-" };
      })
      .filter(Boolean) as Array<{ label: string; value: string }>;

    const remark =
      meta?.appendRemark !== false && meta?.remark
        ? renderTpl(String(meta.remark)).trim()
        : "";

    // 兜底：配置为空时仍尽量显示后端已有描述
    if (!details.length && task?.todoDescription) {
      String(task.todoDescription)
        .split("\n")
        .map((x: string) => x.trim())
        .filter(Boolean)
        .forEach((line: string) => {
          const idx = line.indexOf("：");
          if (idx > 0) {
            details.push({ label: line.slice(0, idx), value: line.slice(idx + 1) || "-" });
          }
        });
    }

    return { title, details, remark, submitterName };
  }, [formData, formDefinition, workflowInstance, task]);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      <Text strong style={{ fontSize: 18, lineHeight: 1.45, display: "block", whiteSpace: "normal" }}>
        {rendered.title}
      </Text>
      {rendered.details.map((row, idx) => (
        <Text
          key={`${row.label}-${idx}`}
          type="secondary"
          style={{ fontSize: 13, lineHeight: 1.7, display: "block", whiteSpace: "normal" }}
        >
          {row.label}：{row.value}
        </Text>
      ))}
      <Text style={{ fontSize: 13, lineHeight: 1.7, color: "#d46b08", display: "block", whiteSpace: "normal" }}>
        {rendered.remark || (rendered.submitterName ? `由 ${rendered.submitterName} 提交` : "")}
      </Text>
    </div>
  );
};

export const WorkflowTasksPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const active = searchParams.get("tab") || "pending";
  const { user } = useAuthStore();

  const setTab = (key: string) => {
    setSearchParams({ tab: key });
  };

  const { data: rawPendingTasks, isLoading: loadingPending } = useQuery({
    queryKey: ["workflow", "tasks", "pending"],
    queryFn: () => workflowApi.listTasks("pending"),
    enabled: active === "pending",
  });

  const { data: rawCompletedTasks, isLoading: loadingCompleted } = useQuery({
    queryKey: ["workflow", "tasks", "completed"],
    queryFn: () => workflowApi.listTasks("completed"),
    enabled: active === "completed",
  });

  const { data: userList = [] } = useQuery({
    queryKey: ["users", "forTasksPage"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/users");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  });

  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    (userList as any[]).forEach((u) => u && map.set(String(u.id), u));
    return map;
  }, [userList]);

  // 只保留当前用户相关的任务：待办是当前处理人，已办是曾处理过的
  const pendingTasks = useMemo(() => {
    if (!rawPendingTasks || !user) return rawPendingTasks || [];
    return (rawPendingTasks as any[]).filter((task) => {
      const ids: any[] = task.assignees?.values || [];
      return ids.map(String).includes(String(user.id));
    });
  }, [rawPendingTasks, user]);

  const completedTasks = useMemo(() => {
    if (!rawCompletedTasks || !user) return rawCompletedTasks || [];
    return (rawCompletedTasks as any[]).filter((task) => {
      const ids: any[] = task.assignees?.values || [];
      return ids.map(String).includes(String(user.id));
    });
  }, [rawCompletedTasks, user]);

  const renderTasks = (tasks: any[] | undefined, loading: boolean) => {
    if (loading) {
      return (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin />
        </div>
      );
    }
    if (!tasks || tasks.length === 0) {
      return <Empty description="暂无数据" />;
    }
    return (
      <Space orientation="vertical" style={{ width: "100%" }}>
        {tasks.map((task: any) => {
          const handleClick = () => {
            // 构建跳转URL，包含 recordId 和 formId（如果有）
            const params = new URLSearchParams();
            params.set('recordId', task.recordId);
            if (task.formId) {
              params.set('formId', task.formId);
            }
            navigate(`/runtime/list?${params.toString()}`);
          };

          const renderNodeType = (nodeType?: string) => {
            if (!nodeType) return "-";
            switch (nodeType) {
              case "start":
                return "发起";
              case "end":
                return "结束";
              case "approval":
                return "审批节点";
              case "task":
                return "任务节点";
              default:
                return nodeType;
            }
          };
          
          return (
            <Card
              key={task.taskId}
              hoverable
              onClick={handleClick}
            >
              <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
                <Space orientation="vertical" size={4}>
                  <Space>
                    <Tag color="blue">{task.label || "审批节点"}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{renderNodeType(task.nodeType)}</Text>
                  </Space>
                  <TaskRichText task={task} />
                  {Array.isArray(task.assignees?.values) && task.assignees.values.length > 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      审批人：{task.assignees.values.map((id: any) => {
                        const u = userMap.get(String(id));
                        return u ? (u.name || u.account) : String(id);
                      }).join("、")}
                    </Text>
                  )}
                  {task.createdAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      创建时间：{new Date(task.createdAt).toLocaleString()}
                    </Text>
                  )}
                </Space>
                <Button type="link" onClick={(e) => { e.stopPropagation(); handleClick(); }}>
                  去处理
                </Button>
              </Space>
            </Card>
          );
        })}
      </Space>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 12, gap: 8 }}>
          <Title level={5} style={{ margin: 0 }}>我的流程</Title>
          <Text type="secondary">任务中心</Text>
        </div>
        <Tabs
          activeKey={active}
          onChange={setTab}
          items={[
            { key: "pending", label: (
              <Space>
                <Badge count={pendingTasks?.length || 0} offset={[6, -2]}>
                  <UserOutlined />
                </Badge>
                <span>待办</span>
              </Space>
            ), children: renderTasks(pendingTasks, loadingPending) },
            { key: "completed", label: (
              <Space>
                <FileTextOutlined />
                <span>待阅</span>
              </Space>
            ), children: renderTasks(completedTasks, loadingCompleted) },
            { key: "started", label: (
              <Space>
                <SendOutlined />
                <span>我发起的</span>
              </Space>
            ), children: (
              <Empty description="暂未整合到一个入口，先从应用进入各表单查看" />
            )},
          ]}
        />
      </Card>
    </div>
  );
};
