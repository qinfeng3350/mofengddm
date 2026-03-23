import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Layout, Card, Spin, message, Table, Alert, Space, Typography, Empty, Button, Tooltip } from "antd";
import { FullscreenOutlined, FullscreenExitOutlined, ReloadOutlined } from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import { applicationApi } from "@/api/application";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";
import dayjs from "dayjs";

const { Content, Header } = Layout;
const { Title, Text } = Typography;

// 实时时间显示组件
const RealtimeTimeDisplay = ({ format }: { format: string }) => {
  const [currentTime, setCurrentTime] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000); // 每秒更新一次

    return () => clearInterval(timer);
  }, []);

  // 将格式字符串转换为 dayjs 格式
  const getDayjsFormat = (formatStr: string): string => {
    // dayjs 的格式字符串，需要转换
    return formatStr
      .replace(/YYYY/g, "YYYY")
      .replace(/MM/g, "MM")
      .replace(/DD/g, "DD")
      .replace(/HH/g, "HH")
      .replace(/mm/g, "mm")
      .replace(/ss/g, "ss")
      .replace(/dddd/g, "dddd");
  };

  const formattedTime = currentTime.format(getDayjsFormat(format));

  return (
    <div
      style={{
        height: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 16,
        fontWeight: "normal",
        color: "#1890ff",
        padding: "8px 0",
      }}
    >
      {formattedTime}
    </div>
  );
};

type ChartType =
  | "column"
  | "line"
  | "bar"
  | "pie"
  | "area"
  | "radar"
  | "dualAxis"
  | "map"
  | "funnel"
  | "gauge";

type ComponentType =
  | "dataTable"
  | "text"
  | "calendar"
  | "pivot"
  | "indicator"
  | "gantt"
  | "image"
  | "realtime"
  | "embed"
  | "container"
  | ChartType;

interface ReportWidget {
  id: string;
  type: ComponentType;
  title: string;
  row: number;
  col: number;
  span: number;
  dataSource?: {
    formId?: string;
    dimension?: string;
    metric?: string;
    aggregation?: "sum" | "avg" | "count" | "max" | "min";
    filter?: any;
    displayFields?: string[];
  };
  chartConfig?: any;
  tableConfig?: any;
}

export const RuntimeReportPage = () => {
  const { appId } = useParams<{ appId: string }>();
  const [searchParams] = useSearchParams();
  const [widgets, setWidgets] = useState<ReportWidget[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataMap, setDataMap] = useState<Record<string, any>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [reportName, setReportName] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30); // 秒

  useEffect(() => {
    if (!appId) return;

    const reportId = searchParams.get("reportId") || undefined;

    (async () => {
      setLoading(true);
      try {
        // 先加载表单列表
        const app = await applicationApi.getById(appId);
        const formsList = await formDefinitionApi.getListByApplication(appId);

        const reports = (app.metadata?.reports as any[]) || [];
        if (!reports.length) {
          message.warning("当前应用还没有配置报表");
          setWidgets([]);
          return;
        }

        const report =
          (reportId && reports.find((r) => r.reportId === reportId)) ||
          reports[0];
        if (!report || !report.widgets?.length) {
          message.warning("报表中没有配置组件");
          setWidgets([]);
          return;
        }

        const widgetsList = report.widgets || [];
        console.log("RuntimeReportPage - 报表ID:", report.reportId, "报表名称:", report.reportName);
        console.log("RuntimeReportPage - 报表中的组件列表:", widgetsList.length, "个组件");
        console.log("RuntimeReportPage - 组件详情:", widgetsList.map((w: any) => ({ id: w.id, title: w.title, type: w.type, row: w.row, col: w.col, span: w.span, hasDataSource: !!w.dataSource, formId: w.dataSource?.formId })));
        setWidgets(widgetsList);

        // 为每个组件加载数据
        // 先初始化所有组件的数据映射，确保所有组件都会被渲染
        const newDataMap: Record<string, any> = {};
        widgetsList.forEach(widget => {
          newDataMap[widget.id] = null; // 先初始化为 null，后续会更新
        });
        
        // 然后为每个有数据源的组件加载数据
        for (const widget of widgetsList) {
          // 即使没有数据源，组件也会显示（显示"暂无数据"）
          if (!widget.dataSource?.formId) {
            // newDataMap[widget.id] 已经是 null，组件会显示"暂无数据"
            continue;
          }

          try {
            // 先确定正确的 formId
            const formIdOrId = widget.dataSource.formId;
            const foundForm = formsList.find(f => f.id === formIdOrId || f.formId === formIdOrId);
            if (!foundForm) {
              console.warn("未找到表单，formId:", formIdOrId);
              newDataMap[widget.id] = null; // 标记为无数据，但组件仍会显示
              continue;
            }
            const actualFormId = foundForm.formId || foundForm.id;
            if (!actualFormId) {
              console.warn("表单没有有效的 formId", foundForm);
              continue;
            }

            if (widget.type === "dataTable") {
              // 数据表数据
              const rows = await formDataApi.getListByForm(actualFormId);
              const formDef = await formDefinitionApi.getById(actualFormId);
              const allFields: any[] = [];
              const collectFields = (items: any[]): void => {
                items.forEach((item) => {
                  if (item.fieldId) {
                    allFields.push(item);
                  }
                  if (item.children) collectFields(item.children);
                  if (item.columns) {
                    item.columns.forEach((col: any) => {
                      if (col.children) collectFields(col.children);
                    });
                  }
                });
              };
              collectFields(formDef.config?.elements || formDef.config?.fields || []);

              // 添加系统字段
              const systemFields = [
                { fieldId: "submitterName", label: "提交人", type: "text" },
                { fieldId: "createdAt", label: "提交时间", type: "datetime" },
                { fieldId: "updatedAt", label: "更新时间", type: "datetime" },
                { fieldId: "recordId", label: "数据ID", type: "text" },
              ];
              allFields.push(...systemFields);

              const displayFields = widget.dataSource.displayFields || [];
              const tableData = (rows || []).map((row: any, index: number) => {
                const data = row.data || {};
                const record: any = { key: row.id || index };
                
                // 添加序号列
                if (widget.tableConfig?.showSerialNumber) {
                  record._serialNumber = index + 1;
                }
                
                displayFields.forEach((fieldId) => {
                  const field = allFields.find((f) => f.fieldId === fieldId);
                  let value: any;
                  
                  // 系统字段从 row 对象直接获取
                  if (fieldId === "submitterName") {
                    value = row.submitterName || "";
                  } else if (fieldId === "createdAt") {
                    value = row.createdAt ? dayjs(row.createdAt).format("YYYY-MM-DD HH:mm:ss") : "";
                  } else if (fieldId === "updatedAt") {
                    value = row.updatedAt ? dayjs(row.updatedAt).format("YYYY-MM-DD HH:mm:ss") : "";
                  } else if (fieldId === "recordId") {
                    value = row.id || "";
                  } else {
                    value = data[fieldId];
                  }
                  
                  if (value === null || value === undefined) {
                    value = "";
                  } else if (field?.type === "date" || field?.type === "datetime") {
                    value = dayjs(value).format("YYYY-MM-DD");
                  } else if (field?.type === "select" || field?.type === "radio") {
                    const options = field.options || [];
                    const option = options.find((opt: any) => opt.value === value || opt.label === value);
                    value = option ? (option.label || option.value || String(value)) : String(value);
                  } else {
                    value = String(value);
                  }
                  record[fieldId] = value;
                });
                return record;
              });
              newDataMap[widget.id] = {
                type: "table",
                data: tableData,
                fields: displayFields.map((fid) => allFields.find((f) => f.fieldId === fid)).filter(Boolean),
              };
            } else {
              // 图表数据
              const { dimension, metric, aggregation = "sum" } = widget.dataSource;
              if (!dimension || !metric) {
                newDataMap[widget.id] = null; // 标记为无数据，但组件仍会显示
                continue;
              }

              const rows = await formDataApi.getListByForm(actualFormId);
              const formDef = await formDefinitionApi.getById(actualFormId);
              const allFields: any[] = [];
              const collectFields = (items: any[]): void => {
                items.forEach((item) => {
                  if (item.fieldId) {
                    allFields.push(item);
                  }
                  if (item.children) collectFields(item.children);
                  if (item.columns) {
                    item.columns.forEach((col: any) => {
                      if (col.children) collectFields(col.children);
                    });
                  }
                });
              };
              collectFields(formDef.config?.elements || formDef.config?.fields || []);

              const dimensionField = allFields.find((f) => f.fieldId === dimension);
              const metricField = allFields.find((f) => f.fieldId === metric);

              // 聚合数据
              const groupedData: Record<string, number[]> = {};
              (rows || []).forEach((row: any) => {
                const data = row.data || {};
                let dimValue = data[dimension];
                if (dimValue === null || dimValue === undefined || dimValue === "") {
                  dimValue = "未知";
                } else {
                  if (dimensionField?.type === "number") {
                    dimValue = String(dimValue);
                  } else if (dimensionField?.type === "date" || dimensionField?.type === "datetime") {
                    const date = new Date(dimValue);
                    if (Number.isNaN(date.getTime())) {
                      dimValue = String(dimValue);
                    } else {
                      dimValue = dayjs(dimValue).format("YYYY-MM-DD");
                    }
                  } else if (dimensionField?.type === "select" || dimensionField?.type === "radio") {
                    const options = dimensionField.options || [];
                    const option = options.find((opt: any) => opt.value === dimValue || opt.label === dimValue);
                    dimValue = option ? (option.label || option.value || String(dimValue)) : String(dimValue);
                  } else {
                    dimValue = String(dimValue);
                  }
                }

                let metricValue = data[metric];
                if (metricValue === null || metricValue === undefined || metricValue === "") {
                  metricValue = 0;
                } else {
                  if (typeof metricValue === "object") {
                    metricValue = metricValue.value !== undefined ? metricValue.value : metricValue.label || 0;
                  }
                  const num = Number(metricValue);
                  metricValue = Number.isFinite(num) ? num : 0;
                }

                if (!groupedData[dimValue]) {
                  groupedData[dimValue] = [];
                }
                groupedData[dimValue].push(metricValue);
              });

          const xData: string[] = [];
          const yData: number[] = [];
              Object.entries(groupedData).forEach(([dim, values]) => {
                xData.push(dim);
                let aggregated: number;
                switch (aggregation) {
                  case "avg":
                    aggregated = values.reduce((a, b) => a + b, 0) / values.length;
                    break;
                  case "count":
                    aggregated = values.length;
                    break;
                  case "max":
                    aggregated = Math.max(...values);
                    break;
                  case "min":
                    aggregated = Math.min(...values);
                    break;
                  default:
                    aggregated = values.reduce((a, b) => a + b, 0);
                }
                yData.push(aggregated);
              });

              newDataMap[widget.id] = { type: "chart", xData, yData, dimensionField, metricField };
            }
          } catch (e) {
            console.error(`加载组件 ${widget.id} 数据失败:`, e);
            // 即使加载失败，也要标记，以便组件能够显示
            newDataMap[widget.id] = null;
          }
        }
        console.log("RuntimeReportPage - 数据加载完成，数据映射:", Object.keys(newDataMap).length, "个组件有数据");
        console.log("RuntimeReportPage - 数据映射详情:", Object.keys(newDataMap).map(id => ({ id, hasData: !!newDataMap[id], type: newDataMap[id]?.type })));
        setDataMap(newDataMap);
      } catch (e) {
        console.error("RuntimeReportPage - 加载报表数据失败:", e);
        message.error("加载报表数据失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [appId, searchParams]);

  // 生成图表配置
  const generateChartOption = (widget: ReportWidget, data: { xData: string[]; yData: number[] }) => {
    if (!data || !data.xData || !data.yData) return null;

    const { type, title, chartConfig } = widget;
    const { xData, yData } = data;

    const baseOption: any = {
      title: {
        text: title,
        left: "center",
        textStyle: {
          fontSize: 16,
          fontWeight: "bold",
        },
      },
      tooltip: {
        trigger: type === "pie" ? "item" : "axis",
        formatter: type === "pie"
          ? (params: any) => {
              const { name, value, percent } = params;
              let result = `${name}<br/>`;
              if (chartConfig?.showMetricValue) {
                result += `${value}<br/>`;
              }
              if (chartConfig?.showPercentage) {
                result += `${percent}%`;
              }
              return result;
            }
          : (params: any) => {
              if (Array.isArray(params)) {
                return params.map((p: any) => `${p.seriesName}<br/>${p.name}: ${p.value}`).join("<br/>");
              }
              return `${params.seriesName}<br/>${params.name}: ${params.value}`;
            },
      },
    };

    switch (type) {
      case "column":
        return {
          ...baseOption,
          xAxis: {
            type: "category",
            data: xData,
            axisLabel: {
              rotate: chartConfig?.xAxisLabelDirection === "vertical" ? 45 : 0,
            },
          },
          yAxis: {
            type: "value",
            name: chartConfig?.yAxisTitle,
            max: chartConfig?.yAxisMax === "auto" ? undefined : chartConfig?.yAxisMax,
            min: chartConfig?.yAxisMin === "auto" ? undefined : chartConfig?.yAxisMin,
          },
          legend: chartConfig?.showLegend
            ? {
                bottom: chartConfig.legendPosition === "bottom" ? 0 : undefined,
              }
            : undefined,
          series: [
            {
              name: title,
              type: "bar",
              data: yData,
              label: chartConfig?.showDataLabel
                ? {
                    show: true,
                    position: "top",
                  }
                : undefined,
            },
          ],
        };
      case "line":
        return {
          ...baseOption,
          xAxis: {
            type: "category",
            data: xData,
          },
          yAxis: {
            type: "value",
            name: chartConfig?.yAxisTitle,
          },
          legend: chartConfig?.showLegend
            ? {
                bottom: chartConfig.legendPosition === "bottom" ? 0 : undefined,
              }
            : undefined,
          series: [
            {
              name: title,
              type: "line",
              data: yData,
              label: chartConfig?.showDataLabel
                ? {
                    show: true,
                  }
                : undefined,
            },
          ],
        };
            case "pie":
        return {
          ...baseOption,
          legend: chartConfig?.showLegend
            ? {
                bottom: chartConfig.legendPosition === "bottom" ? 0 : undefined,
              }
            : undefined,
                series: [
                  {
                    name: title,
                    type: "pie",
              radius: chartConfig?.pieChartType === "donut" ? ["40%", "70%"] : chartConfig?.pieChartType === "rose" ? "60%" : "60%",
              roseType: chartConfig?.pieChartType === "rose" ? "radius" : undefined,
                    data: xData.map((name, idx) => ({
                      name,
                      value: yData[idx] ?? 0,
                    })),
              label: chartConfig?.showDataLabel
                ? {
                    show: true,
                    formatter: (params: any) => {
                      let result = "";
                      if (chartConfig?.showDimensionValue) {
                        result += params.name;
                      }
                      if (chartConfig?.showMetricValue) {
                        result += result ? `: ${params.value}` : params.value;
                      }
                      if (chartConfig?.showPercentage) {
                        result += result ? ` (${params.percent}%)` : `${params.percent}%`;
                      }
                      return result || params.name;
                    },
                  }
                : undefined,
                  },
                ],
              };
            case "area":
        return {
          ...baseOption,
          xAxis: {
            type: "category",
            data: xData,
          },
          yAxis: {
            type: "value",
            name: chartConfig?.yAxisTitle,
          },
                series: [
                  {
                    name: title,
                    type: "line",
              areaStyle: {},
                    data: yData,
                  },
                ],
              };
      default:
        return {
          ...baseOption,
          xAxis: {
            type: "category",
            data: xData,
          },
          yAxis: {
            type: "value",
            name: chartConfig?.yAxisTitle,
          },
                series: [
                  {
                    name: title,
                    type: "bar",
                    data: yData,
                  },
                ],
              };
          }
  };

  // 计算网格布局
  // 确保所有组件都有 row、col、span 属性，如果没有则使用默认值
  const normalizedWidgets = widgets.map(w => ({
    ...w,
    row: w.row ?? 0,
    col: w.col ?? 0,
    span: w.span ?? 12,
  }));
  
  const gridLayout = normalizedWidgets.reduce((acc: number[], w) => {
    const row = w.row ?? 0;
    if (!acc.includes(row)) {
      acc.push(row);
    }
    return acc;
  }, []).sort((a, b) => a - b);
  
  // 调试日志
  if (widgets.length > 0) {
    console.log("RuntimeReportPage - 渲染的组件数量:", widgets.length, "行数:", gridLayout.length, "数据映射:", Object.keys(dataMap).length);
    console.log("RuntimeReportPage - 组件详情:", widgets.map(w => ({ id: w.id, title: w.title, row: w.row, col: w.col, hasData: !!dataMap[w.id] })));
  }

  if (loading) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Content style={{ padding: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spin size="large" />
        </Content>
      </Layout>
    );
  }

  // 全屏切换
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setIsFullscreen(!isFullscreen);
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || refreshInterval <= 0) return;
    const timer = setInterval(() => {
      // 重新加载数据
      const reportId = searchParams.get("reportId") || undefined;
      // 触发重新加载（通过改变 searchParams 或直接调用加载函数）
      window.location.reload();
    }, refreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefresh, refreshInterval, searchParams]);

  return (
    <Layout style={{ minHeight: "100vh", background: isFullscreen ? "#000" : "#f5f5f5" }}>
      {!isFullscreen && (
        <Header style={{ background: "#fff", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
          <Title level={4} style={{ margin: 0 }}>{reportName || "数据报表"}</Title>
          <Space>
            <Tooltip title="自动刷新">
              <Button
                type={autoRefresh ? "primary" : "default"}
                icon={<ReloadOutlined />}
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? `自动刷新 (${refreshInterval}s)` : "自动刷新"}
              </Button>
            </Tooltip>
            <Tooltip title="全屏">
              <Button
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={toggleFullscreen}
              >
                全屏
              </Button>
            </Tooltip>
          </Space>
        </Header>
      )}
      <Content style={{ padding: isFullscreen ? 0 : 24, background: isFullscreen ? "#000" : "#f5f5f5" }}>
        {widgets.length === 0 ? (
          <Card>
            <Empty description="当前报表还没有配置组件" />
          </Card>
        ) : (
          <div>
            {/* 使用网格布局显示组件 */}
            {gridLayout.length > 0 ? (
              gridLayout.map((rowIndex) => {
                const rowWidgets = normalizedWidgets.filter((w) => (w.row ?? 0) === rowIndex).sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
                console.log(`渲染第 ${rowIndex} 行，组件数量: ${rowWidgets.length}`, rowWidgets.map(w => ({ id: w.id, title: w.title, row: w.row, col: w.col, span: w.span })));
                // 计算这一行的总 span
                const totalSpan = rowWidgets.reduce((sum, w) => sum + (w.span ?? 12), 0);
                console.log(`第 ${rowIndex} 行总 span: ${totalSpan}, 应该${totalSpan <= 24 ? '并排' : '换行'}显示`);
                return (
                  <div key={rowIndex} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", gap: 16, flexWrap: totalSpan > 24 ? "wrap" : "nowrap" }}>
                      {rowWidgets.map((widget) => {
                      const widgetData = dataMap[widget.id];
                      const chartOption =
                        widgetData?.type === "chart"
                          ? generateChartOption(widget, widgetData)
                          : null;

                      // 计算宽度：使用百分比，考虑 gap
                      // 如果一行有 n 个组件，每个组件占 (span/24) * 100%，但需要减去 (n-1) * gap / n
                      const widgetSpan = widget.span ?? 12;
                      const gapPerWidget = rowWidgets.length > 1 ? (16 * (rowWidgets.length - 1)) / rowWidgets.length : 0;
                      const widthStyle = { 
                        width: `calc(${(widgetSpan / 24) * 100}% - ${gapPerWidget}px)`, 
                        minWidth: 300,
                        flexShrink: 0
                      };

                      return (
                        <div
                          key={widget.id}
                          style={widthStyle}
                        >
                          <Card
                            title={widget.title}
                            style={{ height: "100%" }}
                            extra={
                              <Space>
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                  {dayjs().format("YYYY-MM-DD HH:mm:ss dddd")}
                                </Text>
                              </Space>
                            }
                          >
                            {widget.type === "realtime" ? (
                              <RealtimeTimeDisplay format={widget.realtimeConfig?.format || "YYYY-MM-DD HH:mm:ss dddd"} />
                            ) : widget.type === "dataTable" ? (
                              widgetData?.type === "table" && widgetData.data ? (
                                <div>
                                  <Table
                                    size="small"
                                    dataSource={widgetData.data}
                                    columns={[
                                      ...(widget.tableConfig?.showSerialNumber ? [{
                                        title: "序号",
                                        key: "serialNumber",
                                        width: 60,
                                        align: "center" as const,
                                        render: (_: any, __: any, index: number) => index + 1,
                                      }] : []),
                                      ...(widgetData.fields || []).map((field: any) => ({
                                        title: field.label || field.fieldName,
                                        dataIndex: field.fieldId,
                                        key: field.fieldId,
                                        sorter: true,
                                      })),
                                    ]}
                                    pagination={{
                                      pageSize: widget.tableConfig?.pageSize || 20,
                                      showSizeChanger: true,
                                      showTotal: (total) => `共 ${total} 条`,
                                    }}
                                  />
                                </div>
                              ) : (
                                <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
                                  暂无数据
                                </div>
                              )
                            ) : chartOption ? (
                              <ReactECharts
                                option={chartOption}
                                style={{ height: 400, width: "100%" }}
                                opts={{ renderer: "svg" }}
                              />
                            ) : (
                              <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
                                暂无数据
                              </div>
                            )}
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
            ) : (
              // 如果没有行布局，直接渲染所有组件（兼容旧数据）
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {widgets.map((widget) => {
                  const widgetData = dataMap[widget.id];
                  const chartOption =
                    widgetData?.type === "chart"
                      ? generateChartOption(widget, widgetData)
                      : null;

                  return (
                    <div
                      key={widget.id}
                      style={{
                        width: `calc(${(widget.span / 24) * 100}% - ${16 * (widget.span / 24 - 1)}px)`,
                        minWidth: 300,
                      }}
                    >
                      <Card
                        title={widget.title}
                        style={{ height: "100%" }}
                        extra={
                          <Space>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {dayjs().format("YYYY-MM-DD HH:mm:ss dddd")}
                            </Text>
                          </Space>
                        }
                      >
                        {widget.type === "dataTable" ? (
                          widgetData?.type === "table" && widgetData.data ? (
                            <div>
                              <Table
                                size="small"
                                dataSource={widgetData.data}
                                columns={[
                                  ...(widget.tableConfig?.showSerialNumber ? [{
                                    title: "序号",
                                    key: "serialNumber",
                                    width: 60,
                                    align: "center" as const,
                                    render: (_: any, __: any, index: number) => index + 1,
                                  }] : []),
                                  ...(widgetData.fields || []).map((field: any) => ({
                                    title: field.label || field.fieldName,
                                    dataIndex: field.fieldId,
                                    key: field.fieldId,
                                    sorter: true,
                                  })),
                                ]}
                                pagination={{
                                  pageSize: widget.tableConfig?.pageSize || 20,
                                  showSizeChanger: true,
                                  showTotal: (total) => `共 ${total} 条`,
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
                              暂无数据
                            </div>
                          )
                        ) : chartOption ? (
                          <ReactECharts
                            option={chartOption}
                            style={{ height: 400, width: "100%" }}
                            opts={{ renderer: "svg" }}
                          />
                        ) : (
                          <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
                            暂无数据
            </div>
                        )}
          </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Content>
    </Layout>
  );
};
