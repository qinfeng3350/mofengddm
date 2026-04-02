import { useQuery, useMutation } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Card, Descriptions, Spin, Button, Tag, Space, Table, Timeline, message, Input, Image } from "antd";
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, RollbackOutlined } from "@ant-design/icons";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";
import { workflowApi } from "@/api/workflow";
import dayjs from "dayjs";
import { useAuthStore } from "@/store/useAuthStore";
import { apiClient } from "@/api/client";
import { extractAttachmentPreviewUrls } from "@/utils/attachmentDisplay";

interface FormDataDetailProps {
  recordId: string;
  onBack?: () => void;
}

export const FormDataDetail = ({ recordId, onBack }: FormDataDetailProps) => {
  const { user } = useAuthStore();
  const { data: formData, isLoading: isLoadingData } = useQuery({
    queryKey: ["formData", recordId],
    queryFn: () => formDataApi.getById(recordId),
  });

  const { data: formDefinition, isLoading: isLoadingDefinition } = useQuery({
    queryKey: ["formDefinition", formData?.formId],
    queryFn: () => formDefinitionApi.getById(formData!.formId),
    enabled: !!formData?.formId,
  });

  const { data: workflowInstance, isLoading: isLoadingWorkflow, refetch: refetchWorkflow } = useQuery({
    queryKey: ["workflow-instance", recordId],
    queryFn: () => workflowApi.getInstanceByRecord(recordId),
    enabled: !!recordId && formDefinition?.metadata?.workflowEnabled !== false,
    retry: false,
  });

  // 用户列表，用于把用户ID转换成姓名
  const { data: userList = [] } = useQuery({
    queryKey: ["users", "forFormDataDetail"],
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

  const pendingTask = (workflowInstance?.tasks || []).find((t: any) => t.status === "pending");
  const canHandle = useMemo(() => {
    if (!pendingTask || !user) return false;
    const assignees: any[] = pendingTask.assignees?.values || [];
    if (!assignees.length) return false;
    return assignees.map(String).includes(String(user.id));
  }, [pendingTask, user]);

  const [approvalComment, setApprovalComment] = useState<string>("");

  const actionMutation = useMutation({
    mutationFn: async ({ action }: { action: "approve" | "reject" | "return" }) => {
      if (!workflowInstance || !pendingTask) return;
      await workflowApi.action(workflowInstance.id, {
        nodeId: pendingTask.nodeId,
        action,
        comment: approvalComment || undefined,
      });
    },
    onSuccess: () => {
      message.success("已提交处理");
      refetchWorkflow();
    },
    onError: (err: any) => {
      message.error(err?.message || "处理失败");
    },
  });

  if (isLoadingData || isLoadingDefinition || isLoadingWorkflow) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!formData || !formDefinition) {
    return <div>数据不存在</div>;
  }

  // 构建字段映射，方便显示字段标签
  const fieldMap = new Map(
    formDefinition.config.fields.map((field) => [field.fieldId, field])
  );

  const dataItems = Object.entries(formData.data).map(([fieldId, value]) => {
    const field = fieldMap.get(fieldId);
    const label = field?.label || fieldId;
    
    // 格式化显示值
    let displayValue: React.ReactNode = value;
    if (value === null || value === undefined) {
      displayValue = <span style={{ color: "#999" }}>空</span>;
    } else if (field?.type === 'subtable') {
      // 子表类型，显示为表格
      if (Array.isArray(value) && value.length > 0) {
        const subtableFields = (field as any).subtableFields || [];
        if (subtableFields.length === 0) {
          displayValue = <span style={{ color: "#999" }}>子表未配置字段</span>;
        } else {
          const columns = subtableFields.map((subField: any) => ({
            title: subField.label,
            dataIndex: subField.fieldId,
            key: subField.fieldId,
            render: (text: any) => {
              if (subField.type === "attachment") {
                const urls = extractAttachmentPreviewUrls(text);
                if (!urls.length) return "-";
                return (
                  <Space wrap size={4}>
                    {urls.map((url, i) => (
                      <Image key={`${url}-${i}`} src={url} alt="" width={48} height={48} style={{ objectFit: "cover" }} />
                    ))}
                  </Space>
                );
              }
              return text ?? "-";
            },
          }));
          columns.unshift({
            title: '序号',
            key: 'index',
            width: 60,
            render: (_: any, __: any, index: number) => index + 1,
          });
          displayValue = (
            <Table
              columns={columns}
              dataSource={value}
              pagination={false}
              size="small"
              rowKey={(_, index) => `row-${index}`}
            />
          );
        }
      } else {
        displayValue = <span style={{ color: "#999" }}>暂无数据</span>;
      }
    } else if (field?.type === "attachment") {
      const urls = extractAttachmentPreviewUrls(value);
      displayValue =
        urls.length === 0 ? (
          <span style={{ color: "#999" }}>暂无文件</span>
        ) : (
          <Image.PreviewGroup>
            <Space wrap>
              {urls.map((url, i) => (
                <Image
                  key={`${url}-${i}`}
                  src={url}
                  alt=""
                  width={96}
                  style={{ objectFit: "cover", borderRadius: 4 }}
                />
              ))}
            </Space>
          </Image.PreviewGroup>
        );
    } else if (Array.isArray(value)) {
      displayValue = value.join(", ");
    } else if (typeof value === "object") {
      displayValue = JSON.stringify(value, null, 2);
    } else {
      displayValue = String(value);
    }

    return {
      label,
      children: displayValue,
    };
  });

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        {onBack && (
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            返回
          </Button>
        )}
      </Space>

      <Card title={formDefinition.formName} style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered>
          <Descriptions.Item label="记录ID">{formData.recordId}</Descriptions.Item>
          <Descriptions.Item label="表单ID">{formData.formId}</Descriptions.Item>
          <Descriptions.Item label="提交人">{formData.submitterName || "未知"}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={formData.status === "submitted" ? "green" : "orange"}>
              {formData.status}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="提交时间" span={2}>
            {dayjs(formData.createdAt).format("YYYY-MM-DD HH:mm:ss")}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="表单数据">
        <Descriptions column={1} bordered>
          {dataItems.map((item, index) => (
            <Descriptions.Item key={index} label={item.label}>
              {item.children}
            </Descriptions.Item>
          ))}
        </Descriptions>
      </Card>

      {/* 流程明细 - 只在流程启用且有实例时显示 */}
      {formDefinition?.metadata?.workflowEnabled !== false && (
        <Card title="流程明细" style={{ marginTop: 16 }}>
          {!workflowInstance ? (
            <div style={{ color: "#999" }}>未找到流程实例</div>
          ) : (
            <Space direction="vertical" style={{ width: "100%" }}>
              <Descriptions column={3} bordered size="small">
                <Descriptions.Item label="实例ID">{workflowInstance.id}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={workflowInstance.status === "completed" ? "green" : workflowInstance.status === "rejected" ? "red" : "blue"}>
                    {workflowInstance.status === "completed" ? "已完成" : workflowInstance.status === "rejected" ? "已拒绝" : workflowInstance.status === "running" ? "运行中" : workflowInstance.status || "-"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="发起人">
                  {(() => {
                    const startHistory = (workflowInstance.history || []).find((h: any) => h.type === "start");
                    const fromHistory = startHistory ? resolveUser(startHistory.userId, startHistory.userName) : "";
                    const fromFormData = formData?.submitterName && formData.submitterName !== "默认用户" ? formData.submitterName : "";
                    return fromHistory || fromFormData || "-";
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="当前节点">
                  {(() => {
                    const def = workflowInstance?.definition;
                    const nodeId = workflowInstance.currentNodeId;
                    const getLabel = (id?: string) => {
                      if (!id) return "-";
                      if (id === "start") return "发起";
                      if (id === "end") return "结束";
                      try {
                        const nodes: any[] = def?.nodes || [];
                        const found = nodes.find((n) => n?.nodeId === id || n?.id === id);
                        return found?.label || found?.name || id;
                      } catch {
                        return id;
                      }
                    };
                    return getLabel(nodeId);
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="待处理人">
                  {(() => {
                    const pendingTask = (workflowInstance.tasks || []).find((t: any) => t.status === "pending");
                    if (!pendingTask) return "-";
                    const ids: string[] = Array.isArray(pendingTask.assignees?.values) ? pendingTask.assignees.values : [];
                    if (!ids.length) return "-";
                    const names = ids.map((id) => resolveUser(id)).filter(Boolean);
                    return names.join("、") || "-";
                  })()}
                </Descriptions.Item>
                <Descriptions.Item label="下一个审批人">
                  {(() => {
                    const def = workflowInstance?.definition;
                    const currentNodeId = workflowInstance.currentNodeId;
                    if (!currentNodeId || !def) return "-";
                    try {
                      const edges: any[] = def.edges || [];
                      const nextEdge = edges.find((e) => e.source === currentNodeId || e.sourceId === currentNodeId);
                      if (!nextEdge) return "流程结束";
                      const nextNodeId = nextEdge.target || nextEdge.targetId;
                      const nodes: any[] = def.nodes || [];
                      const nextNode = nodes.find((n) => (n.nodeId === nextNodeId || n.id === nextNodeId) && (n.type === "approval" || n.type === "task"));
                      if (!nextNode) return "-";
                      const assignees = nextNode.assignees?.values || [];
                      if (!assignees.length) return "未指定";
                      const names = assignees.map((id: any) => resolveUser(id)).filter(Boolean);
                      return names.join("、") || "未指定";
                    } catch {
                      return "-";
                    }
                  })()}
                </Descriptions.Item>
              </Descriptions>

            <Timeline style={{ marginTop: 8 }}>
              {(workflowInstance.history || []).map((h: any, idx: number) => (
                <Timeline.Item
                  key={idx}
                  color={h.type === "approve" ? "green" : h.type === "reject" ? "red" : "blue"}
                >
                  <div style={{ fontWeight: 500 }}>
                    {(() => {
                      const def = workflowInstance?.definition;
                      const getLabel = (id?: string, fallback?: string) => {
                        if (!id && fallback) return fallback;
                        const nid = id || fallback || "";
                        if (nid === "start") return "发起";
                        if (nid === "end") return "结束";
                        try {
                          const nodes: any[] = def?.nodes || [];
                          const found = nodes.find((n) => n?.id === nid || n?.nodeId === nid);
                          return found?.label || found?.name || nid;
                        } catch {
                          return nid;
                        }
                      };
                      return getLabel(h.nodeId, h.label);
                    })()}
                  </div>
                  <div style={{ color: "#666" }}>
                    {resolveUser(h.userId, h.userName)} ·{" "}
                    {h.type === "approve"
                      ? "同意"
                      : h.type === "reject"
                      ? "拒绝"
                      : h.type === "return"
                      ? "退回"
                      : h.type === "start"
                      ? "发起"
                      : h.type === "end"
                      ? "结束"
                      : h.type === "submit"
                      ? "提交"
                      : "流转"}
                  </div>
                  <div style={{ color: "#999", fontSize: 12 }}>
                    {h.at && dayjs(h.at).format("YYYY-MM-DD HH:mm:ss")}
                  </div>
                  {h.comment && <div style={{ color: "#999", marginTop: 4 }}>备注：{h.comment}</div>}
                </Timeline.Item>
              ))}
            </Timeline>

            {pendingTask && canHandle && (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Input.TextArea
                  placeholder="请输入审批意见"
                  value={approvalComment}
                  onChange={(e) => setApprovalComment(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
                <Space>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  loading={actionMutation.isLoading}
                  onClick={() => actionMutation.mutate({ action: "approve" })}
                >
                  同意
                </Button>
                <Button
                  danger
                  icon={<CloseOutlined />}
                  loading={actionMutation.isLoading}
                  onClick={() => actionMutation.mutate({ action: "reject" })}
                >
                  拒绝
                </Button>
                <Button
                  icon={<RollbackOutlined />}
                  loading={actionMutation.isLoading}
                  onClick={() => actionMutation.mutate({ action: "return" })}
                >
                  退回
                </Button>
                </Space>
                </Space>
            )}
          </Space>
        )}
      </Card>
      )}
    </div>
  );
};

