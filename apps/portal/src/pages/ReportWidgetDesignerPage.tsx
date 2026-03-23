import { Layout, Button, message, Typography } from "antd";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { ReportWidgetDesigner } from "@/modules/report-designer/ReportWidgetDesigner";
import { applicationApi } from "@/api/application";

const { Header, Content } = Layout;
const { Text } = Typography;

export const ReportWidgetDesignerPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appId = searchParams.get("appId") || undefined;
  const reportId = searchParams.get("reportId") || "";
  const widgetId = searchParams.get("widgetId") || "";
  const [reportConfig, setReportConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const latestConfigRef = useRef<any | null>(null);

  // 调试信息
  useEffect(() => {
    console.log("ReportWidgetDesignerPage 组件已加载", { 
      appId, 
      reportId, 
      widgetId,
      searchParams: Object.fromEntries(searchParams.entries())
    });
  }, [appId, reportId, widgetId, searchParams]);

  // 加载报表配置
  useEffect(() => {
    if (!appId || !reportId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    
    // 首先尝试从localStorage获取最新配置（可能包含未保存的组件）
    const localConfigKey = `local_report_${reportId}`;
    const localConfig = window.localStorage.getItem(localConfigKey);
    let tempConfig = null;
    if (localConfig) {
      try {
        tempConfig = JSON.parse(localConfig);
        console.log("从localStorage加载临时配置", tempConfig);
      } catch (e) {
        console.warn("解析localStorage配置失败", e);
      }
    }
    
    applicationApi
      .getById(appId)
      .then((app) => {
        const reports = (app.metadata?.reports as any[]) || [];
        const found = reports.find((r) => r.reportId === reportId) || null;
        console.log("加载报表配置", {
          reportId,
          found,
          tempConfig,
          reports: reports.map((r) => ({ reportId: r.reportId, widgetsCount: r.widgets?.length || 0 })),
        });
        
        // 优先使用数据库中的配置，如果没有则使用localStorage中的临时配置
        const finalConfig = found || tempConfig;
        setReportConfig(finalConfig);
        latestConfigRef.current = finalConfig;
        setLoading(false);
        
        if (!finalConfig) {
          message.warning("未找到报表配置，请先保存报表");
        } else if (finalConfig.widgets) {
          console.log("报表中的组件列表", finalConfig.widgets.map((w: any) => ({ id: w.id, title: w.title })));
        }
      })
      .catch((e) => {
        console.error(e);
        // 如果API调用失败，尝试使用localStorage中的配置
        if (tempConfig) {
          console.log("API调用失败，使用localStorage配置", tempConfig);
          setReportConfig(tempConfig);
          latestConfigRef.current = tempConfig;
          message.warning("无法从服务器加载配置，使用本地临时配置");
        } else {
          message.error("加载报表配置失败");
        }
        setLoading(false);
      });
  }, [appId, reportId]);

  const handleSave = async () => {
    try {
      const config = latestConfigRef.current || reportConfig;
      if (!config || !appId) {
        message.warning("请先配置组件内容");
        return;
      }

      const newReport = { ...config, reportId };

      const app = await applicationApi.getById(appId);
      const reports = (app.metadata?.reports as any[]) || [];
      const idx = reports.findIndex((r) => r.reportId === reportId);

      if (idx >= 0) {
        reports[idx] = newReport;
      } else {
        reports.push(newReport);
      }

      await applicationApi.update(appId, {
        metadata: {
          ...(app.metadata || {}),
          reports,
        },
      });
      message.success("组件已保存");
      
      // 返回报表设计页面
      navigate(`/reports/designer?appId=${appId}&reportId=${reportId}`);
    } catch (e) {
      console.error(e);
      message.error("保存组件失败");
    }
  };

  const handleBack = () => {
    if (appId && reportId) {
      navigate(`/reports/designer?appId=${appId}&reportId=${reportId}`);
    } else if (appId) {
      // 如果没有reportId，返回到应用页面
      navigate(`/app/${appId}`);
    } else {
      navigate(-1); // 如果参数不完整，使用浏览器历史返回
    }
  };

  if (loading) {
    return (
      <Layout style={{ height: "100vh" }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回
            </Button>
            <div style={{ fontSize: 16, fontWeight: 500 }}>
              {reportConfig?.reportName ? `< ${reportConfig.reportName}` : "组件配置"}
            </div>
          </div>
        </Header>
        <Content style={{ padding: 24, textAlign: "center" }}>
          <div>加载中...</div>
        </Content>
      </Layout>
    );
  }

  if (!reportConfig) {
    return (
      <Layout style={{ height: "100vh" }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回
            </Button>
            <div style={{ fontSize: 16, fontWeight: 500 }}>组件配置</div>
          </div>
        </Header>
        <Content style={{ padding: 24, textAlign: "center" }}>
          <div>未找到报表配置，请先保存报表</div>
          <Button type="primary" style={{ marginTop: 16 }} onClick={handleBack}>
            返回报表设计页面
          </Button>
        </Content>
      </Layout>
    );
  }

  if (!widgetId) {
    return (
      <Layout style={{ height: "100vh" }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回
            </Button>
            <div style={{ fontSize: 16, fontWeight: 500 }}>组件配置</div>
          </div>
        </Header>
        <Content style={{ padding: 24, textAlign: "center" }}>
          <div>缺少组件ID参数</div>
          <Button type="primary" style={{ marginTop: 16 }} onClick={handleBack}>
            返回报表设计页面
          </Button>
        </Content>
      </Layout>
    );
  }

  const widget = reportConfig.widgets?.find((w: any) => w.id === widgetId);
  console.log("查找组件", {
    widgetId,
    widgetsCount: reportConfig.widgets?.length || 0,
    widgetIds: reportConfig.widgets?.map((w: any) => w.id) || [],
    found: !!widget,
  });
  if (!widget) {
    return (
      <Layout style={{ height: "100vh" }}>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回
            </Button>
            <div style={{ fontSize: 16, fontWeight: 500 }}>组件配置</div>
          </div>
        </Header>
        <Content style={{ padding: 24, textAlign: "center" }}>
          <div style={{ marginBottom: 16 }}>
            <Text type="warning">未找到组件 ID: {widgetId}</Text>
          </div>
          {reportConfig.widgets && reportConfig.widgets.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text>报表中的组件列表：</Text>
              <ul style={{ textAlign: "left", display: "inline-block", marginTop: 8 }}>
                {reportConfig.widgets.map((w: any) => (
                  <li key={w.id}>
                    {w.title} (ID: {w.id})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button type="primary" onClick={handleBack}>
            返回报表设计页面
          </Button>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ height: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <div style={{ fontSize: 16, fontWeight: 500 }}>
            {reportConfig?.reportName ? `< ${reportConfig.reportName}` : "组件配置"}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        </div>
      </Header>
      <Content style={{ height: "calc(100vh - 64px)", overflow: "hidden" }}>
        <ReportWidgetDesigner
          appId={appId}
          widget={widget}
          reportConfig={reportConfig}
          onWidgetChange={(updatedWidget) => {
            // 更新组件配置
            const widgets = (reportConfig.widgets || []).map((w: any) =>
              w.id === widgetId ? updatedWidget : w
            );
            const newConfig = { ...reportConfig, widgets };
            setReportConfig(newConfig);
            latestConfigRef.current = newConfig;
          }}
        />
      </Content>
    </Layout>
  );
};

