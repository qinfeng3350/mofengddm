import { Layout, Button, message, Input } from "antd";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ReportDesignerV2 } from "@/modules/report-designer/ReportDesignerV2";
import { applicationApi } from "@/api/application";
import { useEffect, useState, useRef, useCallback } from "react";
import { ArrowLeftOutlined, EyeOutlined, EditOutlined, CheckOutlined, CloseOutlined } from "@ant-design/icons";

const { Header, Content } = Layout;

export const ReportDesignerPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const appId = searchParams.get("appId") || undefined;
  const reportId = searchParams.get("reportId") || `report_${Date.now()}`;
  const [reportConfig, setReportConfig] = useState<any | null>(null);
  // 用 ref 保存最新配置，确保保存时总是用最新的数据
  const latestConfigRef = useRef<any | null>(null);
  // 报表名称编辑状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState("");

  // 加载应用下的报表配置
  useEffect(() => {
    if (!appId) return;
    applicationApi
      .getById(appId)
      .then((app) => {
        const reports = (app.metadata?.reports as any[]) || [];
        const found = reports.find((r) => r.reportId === reportId) || null;
        setReportConfig(found);
        latestConfigRef.current = found;
        if (found?.reportName) {
          setEditingName(found.reportName);
        }
      })
      .catch((e) => {
        console.error(e);
        message.error("加载报表配置失败");
      });
  }, [appId, reportId]);

  // 当报表配置变化时，同步编辑名称
  useEffect(() => {
    if (reportConfig?.reportName && !isEditingName) {
      setEditingName(reportConfig.reportName);
    }
  }, [reportConfig?.reportName, isEditingName]);

  const handleSave = async () => {
    try {
      // 从 ref 获取最新配置，确保保存的是所有图表的最新状态
      const config = latestConfigRef.current || reportConfig;
      if (!config) {
        message.warning("请先配置报表内容");
        return;
      }
      const newReport = { ...config, reportId };

      if (appId) {
        // 绑定到具体应用的 metadata.reports 中
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
        message.success("报表已保存");
      } else {
        // 没有 appId 时，先保存到本地，至少不会报错
        window.localStorage.setItem(
          `local_report_${reportId}`,
          JSON.stringify(newReport),
        );
        message.success("报表已保存到本地（未绑定应用）");
      }

      setReportConfig(newReport);
      latestConfigRef.current = newReport;
    } catch (e) {
      console.error(e);
      message.error("保存报表失败");
    }
  };

  const handlePreview = () => {
    if (!appId) {
      message.warning("请先绑定应用");
      return;
    }
    navigate(`/app/${appId}/report?reportId=${reportId}`);
  };

  const handleStartEditName = () => {
    setEditingName(reportConfig?.reportName || "未命名分析报表");
    setIsEditingName(true);
  };

  // 用于存储 onConfigChange 回调的 ref
  const onConfigChangeHandlerRef = useRef<((cfg: any) => void) | null>(null);

  const handleSaveName = () => {
    const newName = editingName.trim() || "未命名分析报表";
    const config = latestConfigRef.current || reportConfig || { reportName: newName, widgets: [] };
    const updatedConfig = { ...config, reportName: newName };
    setReportConfig(updatedConfig);
    latestConfigRef.current = updatedConfig;
    // 触发配置变化回调（通过 ReportDesignerV2 的 onConfigChange）
    if (onConfigChangeHandlerRef.current) {
      onConfigChangeHandlerRef.current(updatedConfig);
    }
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setEditingName(reportConfig?.reportName || "未命名分析报表");
    setIsEditingName(false);
  };

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
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              if (appId) {
                navigate(`/app/${appId}`);
              } else {
                navigate(-1);
              }
            }}
          >
            返回
          </Button>
          {isEditingName ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onPressEnter={handleSaveName}
                onBlur={handleSaveName}
                style={{ width: 200, fontSize: 16, fontWeight: 500 }}
                autoFocus
              />
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                onClick={handleSaveName}
              />
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelEditName}
              />
            </div>
          ) : (
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                padding: "4px 8px",
                borderRadius: 4,
              }}
              onClick={handleStartEditName}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f5f5f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span>{reportConfig?.reportName || "未命名分析报表"}</span>
              <EditOutlined style={{ fontSize: 12, color: "#999", opacity: 0.6 }} />
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<EyeOutlined />} onClick={handlePreview}>
            预览
          </Button>
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        </div>
      </Header>
      <Content style={{ height: "calc(100vh - 64px)", overflow: "hidden" }}>
        <ReportDesignerV2
          appId={appId}
          initialConfig={reportConfig}
          onConfigChange={useCallback((cfg) => {
            // 存储回调引用，供 handleSaveName 使用
            onConfigChangeHandlerRef.current = (cfg: any) => {
              // 同时更新 state 和 ref，确保保存时能拿到最新值
              latestConfigRef.current = cfg;
              // 将最新配置保存到localStorage，以便编辑页面能获取未保存的组件
              if (cfg && reportId) {
                try {
                  const configToSave = { ...cfg, reportId };
                  window.localStorage.setItem(
                    `local_report_${reportId}`,
                    JSON.stringify(configToSave)
                  );
                } catch (e) {
                  console.warn("保存配置到localStorage失败", e);
                }
              }
            // 使用函数式更新，避免依赖 reportConfig
            setReportConfig((prev) => {
              // 如果 prev 已经有 reportName，且 cfg 的 reportName 是默认值，则保留 prev 的名称
              if (prev?.reportName && 
                  cfg?.reportName === "未命名分析报表" && 
                  prev.reportName !== "未命名分析报表") {
                // 保留原有的名称，只更新 widgets
                return { ...cfg, reportName: prev.reportName };
              }
              // 简单比较，避免不必要的更新
              if (prev?.reportName === cfg?.reportName && 
                  prev?.widgets?.length === cfg?.widgets?.length) {
                return prev;
              }
              return cfg;
            });
              // 同步更新编辑名称
              if (cfg?.reportName && !isEditingName) {
                setEditingName(cfg.reportName);
              }
            };
            // 执行回调
            onConfigChangeHandlerRef.current(cfg);
          }, [reportId, isEditingName])}
        />
      </Content>
    </Layout>
  );
};


