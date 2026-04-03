import { Card, Col, Row, Spin, Typography } from "antd";
import { FileTextOutlined, DatabaseOutlined, TeamOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { tenantApi } from "@/api/tenant";

const { Text, Title } = Typography;

function formatCap(used: number, max?: number | null) {
  if (max == null || max <= 0) return null;
  return `已用 ${used.toLocaleString()} / 上限 ${max.toLocaleString()}`;
}

export const TenantBasicInfoTab = () => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["tenant-limits"],
    queryFn: () => tenantApi.getMyLimits(),
    retry: false,
  });

  const snapshot = data?.success ? data.data : null;

  if (isLoading) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !snapshot) {
    return (
      <Text type="danger">
        {(error as any)?.response?.data?.message || (error as Error)?.message || "加载失败"}
      </Text>
    );
  }

  const { limits, formsCount, recordsCount, enabledUsersCount, totalUsersCount } = snapshot;

  const policyBits: string[] = [];
  if (limits.expiresAt) {
    try {
      const d = new Date(limits.expiresAt);
      if (!Number.isNaN(d.getTime())) {
        policyBits.push(`授权到期：${d.toLocaleString()}`);
      }
    } catch {
      policyBits.push(`授权到期：${limits.expiresAt}`);
    }
  }
  if (limits.enabled === false) {
    policyBits.push("租户已停用（若仍能看到此页，请刷新或重新登录）");
  }

  const items = [
    {
      title: "表单数量",
      value: formsCount,
      capLine: formatCap(formsCount, limits.maxForms),
      icon: <FileTextOutlined style={{ fontSize: 28, color: "#1677ff" }} />,
      desc: "当前租户下已创建的表单定义数量",
    },
    {
      title: "数据数量",
      value: recordsCount,
      capLine: formatCap(recordsCount, limits.maxRecords),
      icon: <DatabaseOutlined style={{ fontSize: 28, color: "#52c41a" }} />,
      desc: "当前租户下表单提交记录总条数（配额仅限制新建记录）",
    },
    {
      title: "人员数量（启用）",
      value: enabledUsersCount,
      capLine: formatCap(enabledUsersCount, limits.maxEnabledUsers),
      icon: <TeamOutlined style={{ fontSize: 28, color: "#722ed1" }} />,
      desc: `状态为启用的用户人数；租户用户总计 ${totalUsersCount.toLocaleString()} 人（含停用）`,
    },
  ];

  return (
    <div>
      <Title level={5} style={{ marginTop: 0 }}>
        基础信息
      </Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
        以下为当前登录租户下的实时统计与配额（由管理员在租户 metadata 中配置 limits）。
      </Text>
      {policyBits.length > 0 ? (
        <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
          {policyBits.join(" · ")}
        </Text>
      ) : (
        <div style={{ marginBottom: 24 }} />
      )}
      <Row gutter={[16, 16]}>
        {items.map((item) => (
          <Col xs={24} sm={24} md={8} key={item.title}>
            <Card>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                <div style={{ marginTop: 4 }}>{item.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text type="secondary">{item.title}</Text>
                  <div style={{ fontSize: 28, fontWeight: 600, lineHeight: 1.3, marginTop: 4 }}>
                    {item.value.toLocaleString()}
                  </div>
                  {item.capLine ? (
                    <Text style={{ fontSize: 13, display: "block", marginTop: 4 }}>{item.capLine}</Text>
                  ) : null}
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>
                    {item.desc}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
