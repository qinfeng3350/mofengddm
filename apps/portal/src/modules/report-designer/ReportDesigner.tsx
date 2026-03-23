import { useEffect, useState } from "react";
import {
  Layout,
  Menu,
  Card,
  Space,
  Typography,
  Button,
  Input,
  Row,
  Col,
  Select,
  Spin,
} from "antd";
import {
  AreaChartOutlined,
  BarChartOutlined,
  DotChartOutlined,
  PieChartOutlined,
  LineChartOutlined,
  HeatMapOutlined,
  FundProjectionScreenOutlined,
  RadarChartOutlined,
} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import { formDataApi } from "@/api/formData";

const { Sider, Content } = Layout;
const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

type ChartType =
  | "combo"
  | "line"
  | "column"
  | "bar"
  | "pie"
  | "scatter"
  | "area"
  | "radar"
  | "heatmap"
  | "funnel"
  | "gantt";

const chartTypeMeta: Record<ChartType, { name: string; desc: string }> = {
  combo: { name: "组合图", desc: "同时展示柱状图与折线图等多种图形。" },
  line: { name: "折线图", desc: "展示趋势变化，适合时间序列数据。" },
  column: { name: "柱形图", desc: "对比不同分类的数值大小。" },
  bar: { name: "条形图", desc: "适合类目较多或名称较长的对比场景。" },
  pie: { name: "饼图", desc: "展示占比结构，适合比例分布分析。" },
  scatter: { name: "散点图", desc: "展示两维数据间的相关性分布。" },
  area: { name: "面积图", desc: "展示累计趋势和变化范围。" },
  radar: { name: "雷达图", desc: "展示多指标综合对比情况。" },
  heatmap: { name: "热力图", desc: "通过颜色深浅展示数值密度或强度。" },
  funnel: { name: "漏斗图", desc: "展示业务转化漏斗各阶段数量及转化率。" },
  gantt: { name: "甘特图", desc: "展示任务在时间轴上的计划与进度。" },
};

interface ReportDesignerProps {
  appId?: string;
  initialConfig?: any | null;
  onConfigChange?: (config: any) => void;
}

type ReportWidget = {
  id: string;
  type: ChartType;
  title: string;
  dataSourceFormId?: string;
  xFieldId?: string;
  yFieldId?: string;
};

export const ReportDesigner = ({ appId, initialConfig, onConfigChange }: ReportDesignerProps) => {
  const [selectedType, setSelectedType] = useState<ChartType>("combo");
  const [reportName, setReportName] = useState<string>(
    initialConfig?.reportName ?? "",
  );
  const [widgets, setWidgets] = useState<ReportWidget[]>(
    () => initialConfig?.widgets || [],
  );
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | undefined>(
    () => initialConfig?.widgets?.[0]?.id,
  );

  const [forms, setForms] = useState<any[]>([]);
  const [previewOption, setPreviewOption] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // 加载当前应用下的表单及字段，用作数据集来源
  useEffect(() => {
    if (!appId) return;
    (async () => {
      try {
        const list = await (await import("@/api/formDefinition")).formDefinitionApi.getListByApplication(appId);
        setForms(list || []);
      } catch (e) {
        console.error("加载表单失败:", e);
      }
    })();
  }, [appId]);

  // 当外部传入的初始配置发生变化时，同步到内部状态（例如从后端加载完成）
  useEffect(() => {
    if (!initialConfig) return;
    setReportName(initialConfig.reportName ?? "");
    setWidgets(initialConfig.widgets || []);
    setSelectedWidgetId(initialConfig.widgets?.[0]?.id);
  }, [initialConfig]);

  // 状态变化时向父组件回传配置，注意不要把 onConfigChange 放进依赖里，避免死循环
  useEffect(() => {
    if (!onConfigChange) return;
    onConfigChange({
      reportName,
      widgets,
    });
  }, [reportName, widgets]);

  // 为当前选中的图表加载预览数据并生成 ECharts 配置
  useEffect(() => {
    if (!appId || !selectedWidgetId) {
      setPreviewOption(null);
      return;
    }
    const current = widgets.find((w) => w.id === selectedWidgetId);
    if (
      !current ||
      !current.dataSourceFormId ||
      !current.xFieldId ||
      !current.yFieldId
    ) {
      setPreviewOption(null);
      return;
    }

    (async () => {
      try {
        setPreviewLoading(true);
        const rows = await formDataApi.getListByForm(current.dataSourceFormId!);
        const xData: string[] = [];
        const yData: number[] = [];
        (rows || []).forEach((row: any) => {
          const data = row.data || {};
          xData.push(String(data[current.xFieldId!] ?? ""));
          const v = Number(data[current.yFieldId!] ?? 0);
          yData.push(Number.isFinite(v) ? v : 0);
        });

        // 根据图表类型生成不同的 ECharts 配置
        let option: any;
        const title = current.title || "图表预览";

        switch (current.type) {
          case "pie":
            option = {
              title: { text: title, left: "center" },
              tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
              legend: { bottom: 0 },
              series: [
                {
                  name: title,
                  type: "pie",
                  radius: "60%",
                  data: xData.map((name, idx) => ({
                    name,
                    value: yData[idx] ?? 0,
                  })),
                },
              ],
            };
            break;
          case "line":
          case "area":
            option = {
              title: { text: title },
              tooltip: { trigger: "axis" },
              xAxis: { type: "category", data: xData },
              yAxis: { type: "value" },
              series: [
                {
                  name: title,
                  type: "line",
                  areaStyle: current.type === "area" ? {} : undefined,
                  data: yData,
                },
              ],
            };
            break;
          case "scatter":
            option = {
              title: { text: title },
              tooltip: { trigger: "item" },
              xAxis: { type: "category", data: xData },
              yAxis: { type: "value" },
              series: [
                {
                  name: title,
                  type: "scatter",
                  data: yData.map((v, idx) => [xData[idx], v]),
                },
              ],
            };
            break;
          default:
            // bar / column / 其他暂时统一用柱状图
            option = {
              title: { text: title },
              tooltip: { trigger: "axis" },
              xAxis: { type: "category", data: xData },
              yAxis: { type: "value" },
              series: [
                {
                  name: title,
                  type: "bar",
                  data: yData,
                },
              ],
            };
        }

        setPreviewOption(option);
      } catch (e) {
        console.error("加载图表预览数据失败:", e);
        setPreviewOption(null);
      } finally {
        setPreviewLoading(false);
      }
    })();
  }, [appId, selectedWidgetId, widgets]);

  const meta = chartTypeMeta[selectedType];

  const handleAddWidget = () => {
    const id = `chart_${Date.now()}`;
    setWidgets((prev) => {
      const next: ReportWidget[] = [
        ...prev,
        {
          id,
          type: selectedType,
          title: chartTypeMeta[selectedType].name,
        },
      ];
      return next;
    });
    setSelectedWidgetId(id);
  };

  const handleRemoveWidget = (id: string) => {
    setWidgets((prev) => {
      const next = prev.filter((w) => w.id !== id);
      if (id === selectedWidgetId) {
        setSelectedWidgetId(next[0]?.id);
      }
      return next;
    });
  };

  const handleUpdateWidget = (id: string, patch: Partial<ReportWidget>) => {
    setWidgets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    );
  };

  return (
    <Layout style={{ height: "100%" }}>
      <Sider width={220} style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}>
        <Menu
          mode="inline"
          selectedKeys={[selectedType]}
          onClick={(info) => setSelectedType(info.key as ChartType)}
          style={{ height: "100%", borderRight: 0, paddingTop: 8 }}
          items={[
            {
              key: "combo",
              icon: <FundProjectionScreenOutlined />,
              label: "组合图",
            },
            {
              key: "line",
              icon: <LineChartOutlined />,
              label: "折线图",
            },
            {
              key: "column",
              icon: <BarChartOutlined />,
              label: "柱形图",
            },
            {
              key: "bar",
              icon: <BarChartOutlined />,
              label: "条形图",
            },
            {
              key: "pie",
              icon: <PieChartOutlined />,
              label: "饼图",
            },
            {
              key: "scatter",
              icon: <DotChartOutlined />,
              label: "散点图",
            },
            {
              key: "area",
              icon: <AreaChartOutlined />,
              label: "面积图",
            },
            {
              key: "radar",
              icon: <RadarChartOutlined />,
              label: "雷达图",
            },
            {
              key: "heatmap",
              icon: <HeatMapOutlined />,
              label: "热力图",
            },
            {
              key: "funnel",
              icon: <FundProjectionScreenOutlined />,
              label: "漏斗图",
            },
            {
              key: "gantt",
              icon: <FundProjectionScreenOutlined />,
              label: "甘特图",
            },
          ]}
        />
      </Sider>

      <Content
        style={{
          background: "#f5f5f5",
          padding: 24,
          height: "100%",
          overflow: "auto",
        }}
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {/* 报表基础信息 */}
          <Card>
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              <Space align="center" style={{ width: "100%", justifyContent: "space-between" }}>
                <Space align="center">
                  <Text type="secondary">报表名称：</Text>
                  <Input
                    style={{ width: 260 }}
                    value={reportName}
                    onChange={(e) => setReportName(e.target.value)}
                    placeholder="未命名报表"
                  />
                </Space>

                <Space>
                  <Button onClick={handleAddWidget} type="primary">
                    添加到画布
                  </Button>
                </Space>
              </Space>

              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                当前选中图表类型：
                <Text strong>{meta.name}</Text>（{meta.desc}）
              </Paragraph>
            </Space>
          </Card>

          {/* 报表画布：可以放多个图表 */}
          <Card title="报表画布">
            {widgets.length === 0 ? (
              <div
                style={{
                  height: 260,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                }}
              >
                请在左侧选择图表类型，并点击「添加到画布」
              </div>
            ) : (
              <Row gutter={[16, 16]}>
                {widgets.map((w) => {
                  const info = chartTypeMeta[w.type];
                  return (
                    <Col key={w.id} span={12}>
                      <Card
                        size="small"
                        title={
                          <Space>
                            <Text strong>{w.title}</Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              ({info.name})
                            </Text>
                          </Space>
                        }
                        extra={
                          <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleRemoveWidget(w.id)}
                          >
                            删除
                          </Button>
                        }
                        bodyStyle={{
                          height: 260,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "#fafafa",
                        }}
                        onClick={() => setSelectedWidgetId(w.id)}
                      >
                        {w.id === selectedWidgetId ? (
                          previewLoading ? (
                            <Spin />
                          ) : previewOption ? (
                            <ReactECharts
                              option={previewOption}
                              style={{ height: 220, width: "100%" }}
                            />
                          ) : (
                            <Text type="secondary">
                              请在下方「图表配置」中选择数据集、横轴字段和纵轴字段后，即可看到实时图表预览。
                            </Text>
                          )
                        ) : (
                          <Text type="secondary">
                            点击选中该图表，在右侧配置后可在这里查看预览。
                          </Text>
                        )}
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </Card>

          {/* 当前选中图表的配置面板 */}
          <Card title="图表配置">
            {widgets.length === 0 || !selectedWidgetId ? (
              <div style={{ color: "#999" }}>请先在画布中添加并选择一个图表。</div>
            ) : (
              (() => {
                const current = widgets.find((w) => w.id === selectedWidgetId);
                if (!current) {
                  return (
                    <div style={{ color: "#999" }}>
                      未找到当前选中图表，请在画布中重新选择。
                    </div>
                  );
                }
                const info = chartTypeMeta[current.type];
                return (
                  <Space direction="vertical" style={{ width: "100%" }} size={12}>
                    <Space>
                      <Text type="secondary">图表类型：</Text>
                      <Text strong>{info.name}</Text>
                    </Space>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Text type="secondary">图表标题：</Text>
                      <Input
                        value={current.title}
                        onChange={(e) =>
                          handleUpdateWidget(current.id, { title: e.target.value })
                        }
                        placeholder="例如：销售趋势"
                      />
                    </Space>
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Text type="secondary">数据集：</Text>
                      {appId && forms.length > 0 ? (
                        <Select
                          value={current.dataSourceFormId}
                          onChange={(val) =>
                            handleUpdateWidget(current.id, {
                              dataSourceFormId: val,
                              xFieldId: undefined,
                              yFieldId: undefined,
                            })
                          }
                          placeholder="请选择应用下的表单作为数据源"
                        >
                          {forms.map((f) => (
                            <Option key={f.formId} value={f.formId}>
                              {f.formName}
                            </Option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          placeholder="例如：财务收款表 / 订单表（当前未绑定应用，仅文本）"
                          disabled
                        />
                      )}
                    </Space>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Text type="secondary">横轴字段：</Text>
                          {appId && current.dataSourceFormId
                            ? (() => {
                                const form = forms.find(
                                  (f) => f.formId === current.dataSourceFormId,
                                );
                                const fields = form?.config?.fields || [];
                                return (
                                  <Select
                                    value={current.xFieldId}
                                    onChange={(val) =>
                                      handleUpdateWidget(current.id, {
                                        xFieldId: val,
                                      })
                                    }
                                    placeholder="请选择横轴字段"
                                  >
                                    {fields.map((field: any) => (
                                      <Option key={field.fieldId} value={field.fieldId}>
                                        {field.label}
                                      </Option>
                                    ))}
                                  </Select>
                                );
                              })()
                            : (
                              <Input
                                placeholder="例如：月份（当前未绑定数据集，仅文本）"
                                disabled
                              />
                            )}
                        </Space>
                      </Col>
                      <Col span={12}>
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <Text type="secondary">纵轴字段：</Text>
                          {appId && current.dataSourceFormId
                            ? (() => {
                                const form = forms.find(
                                  (f) => f.formId === current.dataSourceFormId,
                                );
                                const fields = form?.config?.fields || [];
                                return (
                                  <Select
                                    value={current.yFieldId}
                                    onChange={(val) =>
                                      handleUpdateWidget(current.id, {
                                        yFieldId: val,
                                      })
                                    }
                                    placeholder="请选择纵轴字段"
                                  >
                                    {fields.map((field: any) => (
                                      <Option key={field.fieldId} value={field.fieldId}>
                                        {field.label}
                                      </Option>
                                    ))}
                                  </Select>
                                );
                              })()
                            : (
                              <Input
                                placeholder="例如：金额（当前未绑定数据集，仅文本）"
                                disabled
                              />
                            )}
                        </Space>
                      </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      说明：现在可以从当前应用的表单和字段中选择数据源、横轴和纵轴字段；后续再接入真实图表库展示数据。
                    </Text>
                  </Space>
                );
              })()
            )}
          </Card>
        </Space>
      </Content>
    </Layout>
  );
};


