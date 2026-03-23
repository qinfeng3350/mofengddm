import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Tabs, Empty, Spin, Space, Tag, Typography, Badge, Button } from "antd";
import { UserOutlined, FileTextOutlined, SendOutlined } from "@ant-design/icons";
import { workflowApi } from "@/api/workflow";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/useAuthStore";

const { Title, Text } = Typography;

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
      <Space direction="vertical" style={{ width: "100%" }}>
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
                <Space direction="vertical" size={4}>
                  <Space>
                    <Tag color="blue">{task.label || "审批节点"}</Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>{renderNodeType(task.nodeType)}</Text>
                  </Space>
                  {task.instanceTitle && (
                    <Text style={{ fontSize: 13 }}>
                      {task.instanceTitle}
                    </Text>
                  )}
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
