import { useDeferredValue, useMemo, useState } from "react";
import {
  Layout,
  Menu,
  Table,
  Button,
  Input,
  DatePicker,
  Typography,
  message,
  Tabs,
  Select,
  Spin,
} from "antd";
import type { MenuProps } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import {
  AppstoreOutlined,
  BellOutlined,
  UserOutlined,
  FileTextOutlined,
  FileSearchOutlined,
  BarChartOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  LogoutOutlined,
  CustomerServiceOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { UserAccountDropdown } from "@/components/UserAccountDropdown";
import { useNavigate } from "react-router-dom";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuthStore } from "@/store/useAuthStore";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { enterpriseLogApi } from "@/api/enterprise-log";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import "./EnterpriseManagementPage.css";

type MenuKey = "login-log" | "enterprise-log" | "usage" | "security-policy";
type EnterpriseLogTabKey = "platform" | "app" | "message";

type LoginLogRow = {
  key: string;
  user: string;
  time: string;
  location: string;
  platform: string;
  ip: string;
};

type LoginLogApiItem = {
  id: string;
  userId: string;
  user: string;
  time: string;
  location: string;
  platform: string;
  ip: string;
};

type EnterpriseLogRow = {
  key: string;
  operator: string;
  time: string;
  operationType: string;
  triggerType?: string;
  errorType?: string;
  relatedApp?: string;
  relatedObject?: string;
  content?: string;
  detail: string;
  ip: string;
};

type EnterpriseLogApiItem = {
  id: string;
  operatorName?: string | null;
  operationType?: string | null;
  triggerType?: string | null;
  errorType?: string | null;
  relatedApp?: string | null;
  relatedObject?: string | null;
  content?: string | null;
  detail?: string | null;
  ip?: string | null;
  createdAt: string;
};

const MENU_TITLE: Record<MenuKey, string> = {
  "login-log": "登录日志",
  "enterprise-log": "企业日志",
  usage: "使用统计",
  "security-policy": "安全策略",
};

export const EnterpriseManagementPage = () => {
  usePageTitle("企业管理 - 墨枫低代码平台");
  const navigate = useNavigate();
  const { clearAuth } = useAuthStore();
  const [activeKey, setActiveKey] = useState<MenuKey>("login-log");
  const [keyword, setKeyword] = useState("");
  const deferredKeyword = useDeferredValue(keyword);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [customerServiceOpen, setCustomerServiceOpen] = useState(false);
  const [enterpriseLogTab, setEnterpriseLogTab] = useState<EnterpriseLogTabKey>("platform");
  const [enterpriseKeyword, setEnterpriseKeyword] = useState("");
  const [enterpriseDateRange, setEnterpriseDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [enterpriseOpType, setEnterpriseOpType] = useState<string>("all");
  const [enterpriseScope, setEnterpriseScope] = useState<string>("all");
  const [enterprisePage, setEnterprisePage] = useState(1);
  const [enterprisePageSize, setEnterprisePageSize] = useState(10);
  const [usageStatsTab, setUsageStatsTab] = useState<"login" | "operation">("login");
  const usageDays = 30;

  const centerTitle = MENU_TITLE[activeKey];

  const rangeStart = dateRange?.[0]?.startOf("day").format("YYYY-MM-DD HH:mm:ss");
  const rangeEnd = dateRange?.[1]?.endOf("day").format("YYYY-MM-DD HH:mm:ss");
  const enterpriseStart = enterpriseDateRange?.[0]?.startOf("day").format("YYYY-MM-DD HH:mm:ss");
  const enterpriseEnd = enterpriseDateRange?.[1]?.endOf("day").format("YYYY-MM-DD HH:mm:ss");

  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: [
      "login-logs",
      page,
      pageSize,
      deferredKeyword,
      rangeStart ?? "",
      rangeEnd ?? "",
    ],
    queryFn: async () => {
      const params: Record<string, string | number> = {
        page,
        pageSize,
      };
      if (deferredKeyword.trim()) params.keyword = deferredKeyword.trim();
      if (rangeStart) params.start = rangeStart;
      if (rangeEnd) params.end = rangeEnd;
      return (await apiClient.get("/login-logs", {
        params,
      })) as { items: LoginLogApiItem[]; total: number };
    },
    enabled: activeKey === "login-log",
  });

  const tableData: LoginLogRow[] = useMemo(() => {
    const items = logData?.items ?? [];
    return items.map((r) => ({
      key: r.id,
      user: r.user || "-",
      time: dayjs(r.time).format("YYYY-MM-DD HH:mm:ss"),
      location: r.location,
      platform: r.platform,
      ip: r.ip,
    }));
  }, [logData]);

  const menuItems: MenuProps["items"] = useMemo(
    () => [
      {
        key: "login-log",
        icon: <FileTextOutlined />,
        label: "登录日志",
      },
      {
        key: "enterprise-log",
        icon: <FileSearchOutlined />,
        label: "企业日志",
      },
      {
        key: "usage",
        icon: <BarChartOutlined />,
        label: "使用统计",
      },
      {
        key: "security-policy",
        icon: <SafetyCertificateOutlined />,
        label: "安全策略",
      },
    ],
    [],
  );

  const columns: ColumnsType<LoginLogRow> = [
    { title: "登录人", dataIndex: "user", key: "user", width: 120 },
    { title: "登录时间", dataIndex: "time", key: "time", width: 180 },
    { title: "登录地", dataIndex: "location", key: "location", width: 160 },
    { title: "登录平台", dataIndex: "platform", key: "platform", width: 140 },
    { title: "ip", dataIndex: "ip", key: "ip", width: 140 },
  ];

  const enterpriseCategory = enterpriseLogTab === "platform" ? "platform" : enterpriseLogTab === "app" ? "app" : "message";
  const { data: enterpriseData, isLoading: enterpriseLoading } = useQuery({
    queryKey: [
      "enterprise-logs",
      enterpriseCategory,
      enterpriseScope,
      enterpriseKeyword,
      enterpriseOpType,
      enterpriseStart ?? "",
      enterpriseEnd ?? "",
      enterprisePage,
      enterprisePageSize,
    ],
    queryFn: async () => {
      return enterpriseLogApi.list({
        category: enterpriseCategory as any,
        subtype: enterpriseScope,
        keyword: enterpriseKeyword.trim() || undefined,
        operationType: enterpriseOpType,
        start: enterpriseStart,
        end: enterpriseEnd,
        page: enterprisePage,
        pageSize: enterprisePageSize,
      });
    },
    enabled: activeKey === "enterprise-log",
  });

  const { data: loginDailyStats, isLoading: loginDailyLoading } = useQuery({
    queryKey: ["usage-stats-login-daily", usageDays],
    queryFn: async () =>
      (await apiClient.get("/login-logs/stats/daily-users", {
        params: { days: usageDays },
      })) as { days: number; series: { date: string; count: number }[] },
    enabled: activeKey === "usage",
  });

  const { data: operationDailyStats, isLoading: operationDailyLoading } = useQuery({
    queryKey: ["usage-stats-operation-daily", usageDays],
    queryFn: async () =>
      (await apiClient.get("/enterprise-logs/stats/daily-operations", {
        params: { days: usageDays },
      })) as { days: number; series: { date: string; count: number }[] },
    enabled: activeKey === "usage",
  });

  const loginChartOption = useMemo((): EChartsOption => {
    const series = loginDailyStats?.series ?? [];
    return {
      title: {
        text: "每日登录人数",
        left: "center",
        top: 8,
        textStyle: { fontSize: 14, fontWeight: 600, color: "#262626" },
      },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, data: ["人数"] },
      grid: { left: 52, right: 20, bottom: 48, top: 52 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: series.map((s) => s.date),
        axisLabel: { color: "#8c8c8c", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: "人数",
        minInterval: 1,
        axisLabel: { color: "#8c8c8c" },
        splitLine: { lineStyle: { color: "#f0f0f0" } },
      },
      series: [
        {
          name: "人数",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: series.map((s) => s.count),
          itemStyle: { color: "#597ef7" },
          lineStyle: { color: "#597ef7", width: 2 },
        },
      ],
    };
  }, [loginDailyStats]);

  const operationChartOption = useMemo((): EChartsOption => {
    const series = operationDailyStats?.series ?? [];
    return {
      title: {
        text: "每日操作次数",
        left: "center",
        top: 8,
        textStyle: { fontSize: 14, fontWeight: 600, color: "#262626" },
      },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, data: ["次数"] },
      grid: { left: 52, right: 20, bottom: 48, top: 52 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: series.map((s) => s.date),
        axisLabel: { color: "#8c8c8c", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: "次数",
        minInterval: 1,
        axisLabel: { color: "#8c8c8c" },
        splitLine: { lineStyle: { color: "#f0f0f0" } },
      },
      series: [
        {
          name: "次数",
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 6,
          data: series.map((s) => s.count),
          itemStyle: { color: "#597ef7" },
          lineStyle: { color: "#597ef7", width: 2 },
        },
      ],
    };
  }, [operationDailyStats]);

  const enterpriseRows: EnterpriseLogRow[] = useMemo(() => {
    const items = (enterpriseData as any)?.items || [];
    return (items as EnterpriseLogApiItem[]).map((x) => ({
      key: String(x.id),
      operator: x.operatorName || "-",
      time: dayjs(x.createdAt).format("YYYY-MM-DD HH:mm:ss"),
      operationType: x.operationType || "-",
      triggerType: x.triggerType || "-",
      errorType: x.errorType || "-",
      relatedApp: x.relatedApp || "-",
      relatedObject: x.relatedObject || "-",
      content: x.content || "-",
      detail: x.detail || "-",
      ip: x.ip || "-",
    }));
  }, [enterpriseData]);

  const enterpriseColumns = useMemo<ColumnsType<EnterpriseLogRow>>(() => {
    if (enterpriseLogTab === "message") {
      return [
        { title: "接收人", dataIndex: "operator", key: "operator", width: 120 },
        { title: "发送时间", dataIndex: "time", key: "time", width: 180 },
        { title: "消息类型", dataIndex: "triggerType", key: "triggerType", width: 140 },
        { title: "错误类型", dataIndex: "errorType", key: "errorType", width: 120 },
        { title: "错误详情", dataIndex: "detail", key: "detail", width: 220 },
        { title: "消息内容", dataIndex: "content", key: "content", width: 180 },
        { title: "所属应用", dataIndex: "relatedApp", key: "relatedApp", width: 140 },
        { title: "操作对象", dataIndex: "relatedObject", key: "relatedObject", width: 140 },
      ];
    }
    if (enterpriseLogTab === "app") {
      return [
        { title: "操作人", dataIndex: "operator", key: "operator", width: 110 },
        { title: "日志时间", dataIndex: "time", key: "time", width: 180 },
        { title: "操作类型", dataIndex: "operationType", key: "operationType", width: 140 },
        { title: "所属应用", dataIndex: "relatedApp", key: "relatedApp", width: 140 },
        { title: "操作对象", dataIndex: "relatedObject", key: "relatedObject", width: 140 },
        { title: "操作详情", dataIndex: "detail", key: "detail" },
        { title: "ip", dataIndex: "ip", key: "ip", width: 120 },
      ];
    }
    return [
      { title: "操作人", dataIndex: "operator", key: "operator", width: 110 },
      { title: "日志时间", dataIndex: "time", key: "time", width: 180 },
      { title: "操作类型", dataIndex: "operationType", key: "operationType", width: 160 },
      { title: "操作详情", dataIndex: "detail", key: "detail" },
      { title: "ip", dataIndex: "ip", key: "ip", width: 140 },
    ];
  }, [enterpriseLogTab]);

  const handleExport = async () => {
    try {
      const params: Record<string, string | number> = {
        page: 1,
        pageSize: 5000,
      };
      if (deferredKeyword.trim()) params.keyword = deferredKeyword.trim();
      if (rangeStart) params.start = rangeStart;
      if (rangeEnd) params.end = rangeEnd;
      const res = (await apiClient.get("/login-logs", {
        params,
      })) as { items: LoginLogApiItem[]; total: number };
      const rows = res?.items ?? [];
      const header = "登录人,登录时间,登录地,登录平台,ip\n";
      const body = rows
        .map((r) => {
          const t = dayjs(r.time).format("YYYY-MM-DD HH:mm:ss");
          const cells = [r.user || "", t, r.location, r.platform, r.ip].map((c) =>
            `"${String(c).replace(/"/g, '""')}"`,
          );
          return cells.join(",");
        })
        .join("\n");
      const blob = new Blob(["\ufeff" + header + body], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `登录日志_${dayjs().format("YYYY-MM-DD_HHmm")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      message.success("导出成功");
    } catch {
      message.error("导出失败");
    }
  };

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  return (
    <Layout className="em-root">
      <Layout.Header className="em-header" style={{ position: "relative", padding: 0 }}>
        <button
          type="button"
          className="em-header-left"
          title="返回应用"
          onClick={() => navigate("/home")}
        >
          <AppstoreOutlined className="em-module-icon" />
          <span className="em-module-title">企业管理</span>
        </button>
        <div className="em-header-center">{centerTitle}</div>
        <div className="em-header-right">
          <button type="button" className="em-header-icon-btn" title="退出登录" onClick={handleLogout}>
            <LogoutOutlined />
          </button>
          <button
            type="button"
            className="em-header-icon-btn"
            title="通知"
            onClick={() => message.info("暂无通知")}
          >
            <BellOutlined />
          </button>
          <UserAccountDropdown showUserName />
        </div>
      </Layout.Header>

      <div className="em-body">
        <aside className="em-sider">
          <div className="em-sider-section-title">安全</div>
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            items={menuItems}
            className="em-sider-menu"
            onClick={({ key }) => {
              setActiveKey(key as MenuKey);
              setPage(1);
              if (key === "usage") setUsageStatsTab("login");
            }}
          />
        </aside>

        <main className="em-content-wrap">
          {activeKey === "login-log" ? (
            <div className="em-card">
              <div className="em-card-title-row">
                <Typography.Text className="em-card-title">登录日志</Typography.Text>
                <Typography.Text className="em-card-sub">保存最近6个月的登录日志</Typography.Text>
              </div>

              <div className="em-filter-row">
                <div className="em-filter-fields">
                  <div className="em-filter-item">
                    <span className="em-filter-label">登录人</span>
                    <Input
                      placeholder="请选择登录人"
                      style={{ width: 220 }}
                      suffix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                      allowClear
                      value={keyword}
                      onChange={(e) => {
                        setKeyword(e.target.value);
                        setPage(1);
                      }}
                    />
                  </div>
                  <div className="em-filter-item">
                    <span className="em-filter-label">登录时间</span>
                    <DatePicker.RangePicker
                      style={{ width: 280 }}
                      value={dateRange as any}
                      onChange={(v) => {
                        setDateRange(v as [Dayjs | null, Dayjs | null] | null);
                        setPage(1);
                      }}
                    />
                  </div>
                </div>
                <Button type="primary" onClick={() => void handleExport()}>
                  导出日志
                </Button>
              </div>

              <div className="em-table-wrap">
                <Table
                  rowKey="key"
                  columns={columns}
                  dataSource={tableData}
                  loading={logLoading}
                  pagination={{
                    current: page,
                    pageSize,
                    total: logData?.total ?? 0,
                    showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 条`,
                    style: { marginTop: 16, textAlign: "right" },
                    onChange: (p, ps) => {
                      setPage(p);
                      setPageSize(ps);
                    },
                  }}
                  size="middle"
                />
              </div>
            </div>
          ) : activeKey === "enterprise-log" ? (
            <div className="em-card">
              <div className="em-card-title-row">
                <Typography.Text className="em-card-title">企业日志</Typography.Text>
                <Typography.Text className="em-card-sub">保存最近6个月的操作日志</Typography.Text>
              </div>

              <Tabs
                activeKey={enterpriseLogTab}
                onChange={(k) => setEnterpriseLogTab(k as EnterpriseLogTabKey)}
                size="small"
                items={[
                  { key: "platform", label: "平台日志" },
                  { key: "app", label: "应用日志" },
                  { key: "message", label: "消息日志" },
                ]}
                style={{ marginBottom: 10 }}
              />

              <div className="em-filter-row">
                <div className="em-filter-fields">
                  <div className="em-filter-item">
                    <span className="em-filter-label">{enterpriseLogTab === "message" ? "接收人" : "操作人"}</span>
                    <Input
                      placeholder={enterpriseLogTab === "message" ? "请选择接收人" : "请选择操作人"}
                      style={{ width: 200 }}
                      suffix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
                      allowClear
                      value={enterpriseKeyword}
                      onChange={(e) => setEnterpriseKeyword(e.target.value)}
                    />
                  </div>
                  <div className="em-filter-item">
                    <span className="em-filter-label">{enterpriseLogTab === "message" ? "发送时间" : "操作时间"}</span>
                    <DatePicker.RangePicker
                      style={{ width: 250 }}
                      value={enterpriseDateRange as any}
                      onChange={(v) => setEnterpriseDateRange(v as any)}
                    />
                  </div>
                  <div className="em-filter-item">
                    <span className="em-filter-label">日志范围</span>
                    <Select
                      style={{ width: 130 }}
                      value={enterpriseScope}
                      onChange={setEnterpriseScope}
                      options={[
                        { value: "all", label: "全平台" },
                        { value: "platform", label: "平台" },
                        { value: "app", label: "应用" },
                        { value: "message", label: "消息" },
                      ]}
                    />
                  </div>
                  <div className="em-filter-item">
                    <span className="em-filter-label">{enterpriseLogTab === "message" ? "消息类型" : "操作类型"}</span>
                    <Select
                      style={{ width: 170 }}
                      value={enterpriseOpType}
                      onChange={setEnterpriseOpType}
                      options={[
                        { value: "all", label: enterpriseLogTab === "message" ? "请选择消息类型" : "请选择操作类型" },
                        { value: "创建应用", label: "创建应用" },
                        { value: "修改应用", label: "修改应用" },
                        { value: "删除应用", label: "删除应用" },
                        { value: "创建数据表", label: "创建数据表" },
                        { value: "修改数据表", label: "修改数据表" },
                        { value: "删除数据表", label: "删除数据表" },
                        { value: "登录系统", label: "登录系统" },
                        { value: "切换租户", label: "切换租户" },
                        { value: "发送消息", label: "发送消息" },
                      ]}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Button type="primary" onClick={() => setEnterprisePage(1)}>查询</Button>
                  <Button onClick={() => message.info("企业日志导出开发中")}>导出日志</Button>
                </div>
              </div>

              <div className="em-table-wrap">
                <Table
                  rowKey="key"
                  columns={enterpriseColumns}
                  dataSource={enterpriseRows}
                  loading={enterpriseLoading}
                  pagination={{
                    current: enterprisePage,
                    pageSize: enterprisePageSize,
                    total: (enterpriseData as any)?.total ?? 0,
                    showSizeChanger: true,
                    showTotal: (t) => `共 ${t} 条`,
                    style: { marginTop: 16, textAlign: "right" },
                    onChange: (p, ps) => {
                      setEnterprisePage(p);
                      setEnterprisePageSize(ps);
                    },
                  }}
                  size="middle"
                />
              </div>
            </div>
          ) : activeKey === "usage" ? (
            <div className="em-card em-usage-card">
              <div className="em-card-title-row">
                <Typography.Text className="em-card-title">使用统计</Typography.Text>
                <Typography.Text className="em-card-sub">
                  基于登录日志与企业日志，统计最近 {usageDays} 天
                </Typography.Text>
              </div>
              <Tabs
                activeKey={usageStatsTab}
                onChange={(k) => setUsageStatsTab(k as "login" | "operation")}
                size="small"
                items={[
                  {
                    key: "login",
                    label: "登录统计",
                    children: (
                      <div className="em-usage-tab-pane">
                        <Typography.Paragraph type="secondary" className="em-usage-desc">
                          统计最近{usageDays}天的登录情况（同一日多名用户登录按人去重）
                        </Typography.Paragraph>
                        <Spin spinning={loginDailyLoading}>
                          <div className="em-usage-chart-wrap">
                            <ReactECharts
                              option={loginChartOption}
                              style={{ height: 380, width: "100%" }}
                              notMerge
                              lazyUpdate
                            />
                          </div>
                        </Spin>
                      </div>
                    ),
                  },
                  {
                    key: "operation",
                    label: "操作统计",
                    children: (
                      <div className="em-usage-tab-pane">
                        <Typography.Paragraph type="secondary" className="em-usage-desc">
                          统计最近{usageDays}天的企业操作日志条数（平台+应用+消息）
                        </Typography.Paragraph>
                        <Spin spinning={operationDailyLoading}>
                          <div className="em-usage-chart-wrap">
                            <ReactECharts
                              option={operationChartOption}
                              style={{ height: 380, width: "100%" }}
                              notMerge
                              lazyUpdate
                            />
                          </div>
                        </Spin>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          ) : (
            <div className="em-card">
              <div className="em-card-title-row">
                <Typography.Text className="em-card-title">{centerTitle}</Typography.Text>
              </div>
              <div className="em-placeholder">敬请期待</div>
            </div>
          )}
        </main>
      </div>

      <div className="em-cs-fab-wrap">
        {customerServiceOpen ? (
          <div className="em-cs-popover">
            <div className="em-cs-panel-head">
              <Typography.Text strong>
                <CustomerServiceOutlined style={{ color: "#597ef7", marginRight: 8 }} />
                在线客服
              </Typography.Text>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                aria-label="收起客服"
                onClick={() => setCustomerServiceOpen(false)}
              />
            </div>
            <div className="em-cs-panel-body">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8 }}>
                如需帮助，可查看帮助中心文档；人工客服接入能力后续开放。
              </Typography.Paragraph>
              <Button type="link" style={{ padding: 0 }} onClick={() => navigate("/docs/user")}>
                打开使用文档
              </Button>
            </div>
          </div>
        ) : null}
        <button
          type="button"
          className="em-cs-fab"
          title={customerServiceOpen ? "收起" : "客服"}
          aria-expanded={customerServiceOpen}
          onClick={() => setCustomerServiceOpen((v) => !v)}
        >
          <CustomerServiceOutlined style={{ fontSize: 26 }} />
        </button>
      </div>
    </Layout>
  );
};
