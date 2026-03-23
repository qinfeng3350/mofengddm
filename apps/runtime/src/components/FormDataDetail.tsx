import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, Descriptions, Spin, Button, Tag, Space, Timeline, Input, message } from "antd";
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, RollbackOutlined } from "@ant-design/icons";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";
import { workflowApi } from "@/api/workflow";
import dayjs from "dayjs";

interface FormDataDetailProps {
  recordId: string;
  onBack?: () => void;
}

export const FormDataDetail = ({ recordId, onBack }: FormDataDetailProps) => {
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
    enabled: !!recordId,
    retry: false,
  });

  const pendingTask = (workflowInstance?.tasks || []).find((t: any) => t.status === "pending");

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

      <Card title="流程明细" style={{ marginTop: 16 }}>
        {!workflowInstance ? (
          <div style={{ color: "#999" }}>未找到流程实例</div>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Descriptions column={3} bordered size="small">
              <Descriptions.Item label="实例ID">{workflowInstance.id}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={workflowInstance.status === "completed" ? "green" : workflowInstance.status === "rejected" ? "red" : "blue"}>
                  {workflowInstance.status}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="当前节点">{workflowInstance.currentNodeId || "-"}</Descriptions.Item>
            </Descriptions>

            <Timeline style={{ marginTop: 8 }}>
              {(workflowInstance.history || []).map((h: any, idx: number) => (
                <Timeline.Item
                  key={idx}
                  color={h.type === "approve" ? "green" : h.type === "reject" ? "red" : "blue"}
                >
                  <div style={{ fontWeight: 500 }}>{h.label || h.nodeId}</div>
                  <div style={{ color: "#666" }}>{h.type}</div>
                  <div style={{ color: "#999", fontSize: 12 }}>{h.at && dayjs(h.at).format("YYYY-MM-DD HH:mm:ss")}</div>
                  {h.comment && <div style={{ color: "#999", marginTop: 4 }}>备注：{h.comment}</div>}
                </Timeline.Item>
              ))}
            </Timeline>

            {pendingTask && (
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
    </div>
  );
};

