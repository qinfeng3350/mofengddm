import { useEffect, useState, useCallback, useRef } from "react";
import { Layout, Card, Space, Typography, Button, Input, Select, Spin, Alert, Divider, Form, InputNumber, Radio, Checkbox, Table, Tag, Dropdown, Menu, Modal } from "antd";
import {
  TableOutlined,
  FileTextOutlined,
  CalendarOutlined,
  NumberOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  AreaChartOutlined,
  PlusOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  FormatPainterOutlined,
  SortAscendingOutlined,
  AlignLeftOutlined,
  CheckOutlined,
  DeleteOutlined,
  UserOutlined,
} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import { formDefinitionApi } from "@/api/formDefinition";
import { formDataApi } from "@/api/formData";
import { message } from "antd";
import dayjs from "dayjs";
import { type ReportWidget } from "./ReportDesignerV2";
import { useAuthStore } from "@/store/useAuthStore";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

// 获取字段图标的辅助函数
const getFieldIcon = (field: any) => {
  const type = field.type;
  if (type === "text" || type === "textarea") return <FileTextOutlined />;
  if (type === "number" || type === "money") return <NumberOutlined />;
  if (type === "date" || type === "datetime" || type === "createdAt" || type === "updatedAt") return <CalendarOutlined />;
  if (type === "select" || type === "radio") return <GlobalOutlined />;
  if (type === "table") return <TableOutlined />;
  if (field.isSystemField && field.fieldId === "submitterName") return <UserOutlined />;
  return <FileTextOutlined />;
};

interface ReportWidgetDesignerProps {
  appId?: string;
  widget: ReportWidget;
  reportConfig: any;
  onWidgetChange: (widget: ReportWidget) => void;
}

export const ReportWidgetDesigner = ({
  appId,
  widget: initialWidget,
  reportConfig,
  onWidgetChange,
}: ReportWidgetDesignerProps) => {
  const [widget, setWidget] = useState<ReportWidget>(initialWidget);
  const [forms, setForms] = useState<any[]>([]);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [formFieldsCache, setFormFieldsCache] = useState<Record<string, any[]>>({});
  const [previewData, setPreviewData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editingFieldName, setEditingFieldName] = useState<string>("");
  const lastErrorRef = useRef<string>(""); // 记录最后显示的错误，避免重复提示
  
  const { user } = useAuthStore();
  const selectedFormId = widget.dataSource?.formId;
  
  // 拖拽传感器
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 加载表单列表
  useEffect(() => {
    if (!appId) return;
    formDefinitionApi
      .getListByApplication(appId)
      .then((list) => setForms(list || []))
      .catch((e) => console.error("加载表单失败:", e));
  }, [appId]);

  // 加载表单字段
  const loadFormFields = useCallback(async (formIdOrId: string) => {
    if (!formIdOrId) {
      console.warn("formIdOrId 为空，无法加载字段");
      return [];
    }
    
    // 使用函数式更新检查缓存
    let cachedFields: any[] | null = null;
    setFormFieldsCache((prev) => {
      if (prev[formIdOrId]) {
        cachedFields = prev[formIdOrId];
        return prev;
      }
      return prev;
    });
    
    if (cachedFields) {
      console.log("从缓存加载字段", formIdOrId, cachedFields.length);
      return cachedFields;
    }
    
    try {
      console.log("开始加载字段，formIdOrId:", formIdOrId, "表单列表:", forms.map(f => ({ id: f.id, formId: f.formId, formName: f.formName })));
      
      // 先尝试从表单列表中查找对应的 formId
      const foundForm = forms.find(f => f.id === formIdOrId || f.formId === formIdOrId);
      let actualFormId: string | null = null;
      
      if (foundForm) {
        // 优先使用 formId，如果没有则使用 id
        actualFormId = foundForm.formId || foundForm.id || null;
        if (!actualFormId) {
          throw new Error(`表单 ${foundForm.formName} 没有有效的 formId`);
        }
        console.log("从表单列表找到表单，使用 formId:", actualFormId);
      } else {
        // 如果表单列表为空，可能是还未加载完成，不显示错误
        if (forms.length === 0) {
          console.log("表单列表为空，可能还未加载完成，跳过本次加载");
          return [];
        }
        console.warn("未在表单列表中找到表单，formIdOrId:", formIdOrId);
        // 如果表单列表不为空但找不到，说明 formId 可能不正确，直接抛出错误
        throw new Error(`未找到表单 (formId: ${formIdOrId})，请检查数据源是否正确`);
      }
      
      // 使用 actualFormId 获取表单定义
      const form = await formDefinitionApi.getById(actualFormId);
      
      console.log("表单数据加载成功", form);
      const fields: any[] = [];
      const collectFields = (items: any[]): void => {
        items.forEach((item) => {
          if (item.fieldId) {
            fields.push(item);
          }
          if (item.children) collectFields(item.children);
          if (item.columns) {
            item.columns.forEach((col: any) => {
              if (col.children) collectFields(col.children);
            });
          }
        });
      };
      collectFields(form.config?.elements || form.config?.fields || []);
      
      // 添加系统字段（这些字段不在表单配置中，但存在于数据中）
      const systemFields = [
        {
          fieldId: "submitterName",
          fieldName: "submitterName",
          label: "提交人",
          type: "text",
          isSystemField: true,
        },
        {
          fieldId: "createdAt",
          fieldName: "createdAt",
          label: "提交时间",
          type: "datetime",
          isSystemField: true,
        },
        {
          fieldId: "updatedAt",
          fieldName: "updatedAt",
          label: "更新时间",
          type: "datetime",
          isSystemField: true,
        },
        {
          fieldId: "recordId",
          fieldName: "recordId",
          label: "数据ID",
          type: "text",
          isSystemField: true,
        },
      ];
      
      // 将系统字段添加到字段列表末尾
      fields.push(...systemFields);
      
      console.log("收集到的字段（包含系统字段）", fields.length, fields);
      setFormFieldsCache((prev) => ({ ...prev, [formIdOrId]: fields }));
      return fields;
    } catch (e: any) {
      console.error("加载字段失败:", e);
      const errorMsg = e?.response?.status === 404 
        ? `表单不存在 (formId: ${formIdOrId})，请检查数据源是否正确` 
        : `加载字段失败: ${e?.message || "未知错误"}`;
      
      // 避免重复显示相同的错误
      if (lastErrorRef.current !== errorMsg) {
        lastErrorRef.current = errorMsg;
        message.error(errorMsg);
        // 3秒后清除错误记录，允许再次显示
        setTimeout(() => {
          if (lastErrorRef.current === errorMsg) {
            lastErrorRef.current = "";
          }
        }, 3000);
      }
      return [];
    }
  }, [forms]);

  // 当组件的数据源变化时，加载对应的字段
  useEffect(() => {
    if (selectedFormId) {
      // 等待表单列表加载完成后再加载字段
      if (forms.length === 0) {
        // 如果表单列表为空，等待一下再重试
        const timer = setTimeout(() => {
          if (forms.length > 0 || selectedFormId) {
            console.log("数据源变化，加载字段", selectedFormId);
            loadFormFields(selectedFormId).then((fields) => {
              console.log("字段加载完成", fields.length);
              setFormFields(fields);
            });
          }
        }, 100);
        return () => clearTimeout(timer);
      } else {
        console.log("数据源变化，加载字段", selectedFormId);
        loadFormFields(selectedFormId).then((fields) => {
          console.log("字段加载完成", fields.length);
          setFormFields(fields);
        });
      }
    } else {
      setFormFields([]);
    }
  }, [selectedFormId, loadFormFields, forms.length]);

  // 加载预览数据
  useEffect(() => {
    if (!widget.dataSource?.formId) {
      setPreviewData(null);
      return;
    }

    const { formId, dimension, metric, aggregation = "sum", displayFields } = widget.dataSource;

    // 图表类型需要维度和指标
    if (["column", "line", "bar", "pie", "area", "radar"].includes(widget.type)) {
      if (!dimension || !metric) {
        setPreviewData(null);
        return;
      }
    }

    // 数据表类型需要显示字段
    if (widget.type === "dataTable") {
      if (!displayFields || displayFields.length === 0) {
        setPreviewData(null);
        return;
      }
    }

    (async () => {
      try {
        setIsLoading(true);
        
        // 先确定正确的 formId
        const foundForm = forms.find(f => f.id === formId || f.formId === formId);
        const actualFormId = foundForm?.formId || foundForm?.id || formId;
        console.log("加载数据，formId:", formId, "actualFormId:", actualFormId, "foundForm:", foundForm);
        
        // 使用 actualFormId 获取数据
        const rows = await formDataApi.getListByForm(actualFormId);

        // 获取字段定义 - 只使用 actualFormId，不再回退到原始 formId
        let formDef;
        try {
          formDef = await formDefinitionApi.getById(actualFormId);
        } catch (e: any) {
          console.error("加载表单定义失败，actualFormId:", actualFormId, e);
          // 如果 actualFormId 获取失败，不再尝试用原始 formId（因为原始 formId 可能是错误的）
          throw e;
        }
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
        
        // 添加系统字段到 allFields（用于数据预览）
        const systemFields = [
          {
            fieldId: "submitterName",
            fieldName: "submitterName",
            label: "提交人",
            type: "text",
            isSystemField: true,
          },
          {
            fieldId: "createdAt",
            fieldName: "createdAt",
            label: "提交时间",
            type: "datetime",
            isSystemField: true,
          },
          {
            fieldId: "updatedAt",
            fieldName: "updatedAt",
            label: "更新时间",
            type: "datetime",
            isSystemField: true,
          },
          {
            fieldId: "recordId",
            fieldName: "recordId",
            label: "数据ID",
            type: "text",
            isSystemField: true,
          },
        ];
        allFields.push(...systemFields);

        if (widget.type === "dataTable") {
          // 数据表数据
          console.log("生成数据表数据", {
            displayFields,
            allFieldsCount: allFields.length,
            allFieldIds: allFields.map(f => f.fieldId),
            rowsCount: rows?.length || 0,
          });
          
          const tableData = (rows || []).slice(0, 200).map((row: any, index: number) => {
            const data = row.data || {};
            const record: any = { key: row.id || index };
            displayFields.forEach((fieldId: string) => {
              const field = allFields.find((f) => f.fieldId === fieldId);
              if (!field) {
                console.warn("字段未找到", fieldId, "所有字段:", allFields.map(f => f.fieldId));
                record[fieldId] = "";
                return;
              }
              
              let value: any;
              
              // 系统字段从 row 对象中获取，而不是从 data 中
              if (fieldId === "submitterName") {
                // 优先使用 row 中的 submitterName，如果没有则使用当前登录用户
                value = row.submitterName || user?.name || user?.account || "";
              } else if (fieldId === "createdAt") {
                value = row.createdAt;
              } else if (fieldId === "updatedAt") {
                value = row.updatedAt;
              } else if (fieldId === "recordId") {
                value = row.recordId || row.id || "";
              } else {
                value = data[fieldId];
              }
              
              if (value === null || value === undefined) {
                value = "";
              } else if (field?.type === "date" || field?.type === "datetime" || fieldId === "createdAt" || fieldId === "updatedAt") {
                value = dayjs(value).format("YYYY-MM-DD HH:mm:ss");
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
          
          const previewFields = displayFields.map((fid: string) => allFields.find((f) => f.fieldId === fid)).filter(Boolean);
          console.log("预览字段", previewFields.map((f: any) => ({ fieldId: f.fieldId, label: f.label })));
          
          setPreviewData({ type: "table", data: tableData, fields: previewFields });
        } else {
          // 图表数据
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
                  dimValue = dayjs(date).format("YYYY-MM-DD");
                }
              } else if (dimensionField?.type === "select" || dimensionField?.type === "radio") {
                const options = dimensionField.options || [];
                const option = options.find((opt: any) => opt.value === dimValue || opt.label === dimValue);
                dimValue = option ? (option.label || option.value || String(dimValue)) : String(dimValue);
              } else {
                dimValue = String(dimValue);
              }
            }

            const metricValue = Number(data[metric]) || 0;
            if (!groupedData[dimValue]) {
              groupedData[dimValue] = [];
            }
            groupedData[dimValue].push(metricValue);
          });

          // 计算聚合值
          const chartData = Object.entries(groupedData).map(([dim, values]) => {
            let aggregatedValue = 0;
            if (aggregation === "sum") {
              aggregatedValue = values.reduce((a, b) => a + b, 0);
            } else if (aggregation === "avg") {
              aggregatedValue = values.reduce((a, b) => a + b, 0) / values.length;
            } else if (aggregation === "count") {
              aggregatedValue = values.length;
            } else if (aggregation === "max") {
              aggregatedValue = Math.max(...values);
            } else if (aggregation === "min") {
              aggregatedValue = Math.min(...values);
            }
            return { dimension: dim, metric: aggregatedValue };
          });

          setPreviewData({ type: "chart", data: chartData, dimensionField, metricField });
        }
      } catch (e: any) {
        console.error(`加载组件数据失败:`, e);
        // 只在确实找不到表单或数据时才显示错误，避免在表单列表未加载完成时显示错误
        if (e?.response?.status === 404 && forms.length > 0) {
          const errorMsg = `数据不存在 (formId: ${widget.dataSource?.formId})，请检查数据源是否正确`;
          // 避免重复显示相同的错误
          if (lastErrorRef.current !== errorMsg) {
            lastErrorRef.current = errorMsg;
            message.error(errorMsg);
            // 3秒后清除错误记录，允许再次显示
            setTimeout(() => {
              if (lastErrorRef.current === errorMsg) {
                lastErrorRef.current = "";
              }
            }, 3000);
          }
        } else if (e?.response?.status !== 404) {
          // 非404错误才显示
          const errorMsg = `加载数据失败: ${e?.message || "未知错误"}`;
          if (lastErrorRef.current !== errorMsg) {
            lastErrorRef.current = errorMsg;
            message.error(errorMsg);
            setTimeout(() => {
              if (lastErrorRef.current === errorMsg) {
                lastErrorRef.current = "";
              }
            }, 3000);
          }
        }
        setPreviewData(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [widget.dataSource, widget.type, forms, forms.length]);

  // 生成图表配置
  const generateChartOption = (widget: ReportWidget, data: any) => {
    if (!data || data.type !== "chart" || !data.data || data.data.length === 0) {
      return null;
    }

    const { data: chartData, dimensionField, metricField } = data;
    const dimensions = chartData.map((d: any) => d.dimension);
    const metrics = chartData.map((d: any) => d.metric);

    if (widget.type === "pie") {
      return {
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b}: {c} ({d}%)",
        },
        legend: {
          show: widget.chartConfig?.showLegend !== false,
          orient: "horizontal",
          bottom: widget.chartConfig?.legendPosition === "bottom" ? 0 : "auto",
          top: widget.chartConfig?.legendPosition === "top" ? 0 : "auto",
          left: widget.chartConfig?.legendPosition === "left" ? 0 : "auto",
          right: widget.chartConfig?.legendPosition === "right" ? 0 : "auto",
        },
        series: [
          {
            name: widget.title,
            type: "pie",
            radius: widget.chartConfig?.pieChartType === "donut" ? ["40%", "70%"] : widget.chartConfig?.pieChartType === "rose" ? [0, "70%"] : "70%",
            roseType: widget.chartConfig?.pieChartType === "rose" ? "area" : undefined,
            data: chartData.map((d: any) => ({
              value: d.metric,
              name: d.dimension,
            })),
            label: {
              show: widget.chartConfig?.showDataLabel !== false,
              formatter: (params: any) => {
                const parts: string[] = [];
                if (widget.chartConfig?.showDimensionValue) parts.push(params.name);
                if (widget.chartConfig?.showMetricValue) parts.push(params.value);
                if (widget.chartConfig?.showPercentage) parts.push(`${params.percent}%`);
                return parts.join("\n");
              },
            },
          },
        ],
      };
    }

    if (widget.type === "line") {
      return {
        tooltip: {
          trigger: "axis",
        },
        legend: {
          show: widget.chartConfig?.showLegend !== false,
        },
        xAxis: {
          type: "category",
          data: dimensions,
          axisLabel: {
            rotate: widget.chartConfig?.xAxisLabelDirection === "vertical" ? 45 : 0,
          },
        },
        yAxis: {
          type: "value",
          name: widget.chartConfig?.yAxisTitle,
          max: widget.chartConfig?.yAxisMax === "auto" ? undefined : widget.chartConfig?.yAxisMax,
          min: widget.chartConfig?.yAxisMin === "auto" ? undefined : widget.chartConfig?.yAxisMin,
        },
        series: [
          {
            name: metricField?.label || metricField?.fieldName || "指标",
            type: "line",
            data: metrics,
            label: {
              show: widget.chartConfig?.showDataLabel,
            },
          },
        ],
      };
    }

    if (widget.type === "column") {
      return {
        tooltip: {
          trigger: "axis",
        },
        legend: {
          show: widget.chartConfig?.showLegend !== false,
        },
        xAxis: {
          type: "category",
          data: dimensions,
          axisLabel: {
            rotate: widget.chartConfig?.xAxisLabelDirection === "vertical" ? 45 : 0,
          },
        },
        yAxis: {
          type: "value",
          name: widget.chartConfig?.yAxisTitle,
          max: widget.chartConfig?.yAxisMax === "auto" ? undefined : widget.chartConfig?.yAxisMax,
          min: widget.chartConfig?.yAxisMin === "auto" ? undefined : widget.chartConfig?.yAxisMin,
        },
        series: [
          {
            name: metricField?.label || metricField?.fieldName || "指标",
            type: "bar",
            data: metrics,
            label: {
              show: widget.chartConfig?.showDataLabel,
            },
          },
        ],
      };
    }

    return null;
  };

  const handleUpdate = (updates: Partial<ReportWidget>) => {
    const updated = { ...widget, ...updates };
    setWidget(updated);
    onWidgetChange(updated);
  };

  const chartOption = previewData?.type === "chart" ? generateChartOption(widget, previewData) : null;

  return (
    <Layout style={{ height: "100%" }}>
      {/* 左侧：数据源和字段 */}
      <Sider width={280} style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}>
        <div style={{ padding: 16, height: "100%", overflow: "auto" }}>
          <div style={{ marginBottom: 16 }}>
            <Title level={5} style={{ marginBottom: 8 }}>
              数据源
            </Title>
            {selectedFormId ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "#e6f7ff",
                    borderRadius: 4,
                    marginBottom: 8,
                  }}
                >
                  <FileTextOutlined style={{ color: "#1890ff" }} />
                  <Text style={{ flex: 1 }}>{forms.find((f) => f.id === selectedFormId)?.formName || "未知"}</Text>
                </div>
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, width: "100%", textAlign: "left" }}
                  onClick={() => {
                    handleUpdate({
                      dataSource: {
                        ...widget.dataSource,
                        formId: undefined,
                      },
                    });
                  }}
                >
                  更改数据源
                </Button>
              </>
            ) : (
              <Select
                placeholder="请选择数据源"
                value={widget.dataSource?.formId}
                onChange={async (value) => {
                  console.log("选择数据源", value, forms.find(f => f.id === value || f.formId === value));
                  // 尝试使用 formId，如果没有则使用 id
                  const selectedForm = forms.find(f => f.id === value || f.formId === value);
                  const formIdToUse = selectedForm?.formId || selectedForm?.id || value;
                  console.log("使用的 formId", formIdToUse);
                  await loadFormFields(formIdToUse);
                  handleUpdate({
                    dataSource: {
                      ...widget.dataSource,
                      formId: formIdToUse,
                      dimension: undefined,
                      metric: undefined,
                      displayFields: [],
                    },
                  });
                }}
                style={{ width: "100%" }}
              >
                {forms.map((form) => (
                  <Option key={form.id || form.formId} value={form.id || form.formId}>
                    {form.formName}
                  </Option>
                ))}
              </Select>
            )}
            <div style={{ marginTop: 16 }}>
              <Title level={5} style={{ marginBottom: 8 }}>
                数据获取权限
              </Title>
              <Button type="primary" size="small" block>
                报表权限
              </Button>
            </div>
          </div>

          {selectedFormId && formFields.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Title level={5} style={{ margin: 0 }}>
                  字段
                </Title>
                <Button type="link" size="small" icon={<PlusOutlined />} style={{ padding: 0 }}>
                  公式字段
                </Button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {formFields.map((field) => {
                  const isSelected = widget.dataSource?.displayFields?.includes(field.fieldId);
                  return (
                    <DraggableFieldItem
                      key={field.fieldId}
                      field={field}
                      isSelected={isSelected}
                      widget={widget}
                      onSelect={() => {
                        if (widget.type === "dataTable") {
                          // 数据表：点击字段添加到显示字段
                          const currentFields = widget.dataSource?.displayFields || [];
                          if (isSelected) {
                            // 如果已选中，则移除
                            const newFields = currentFields.filter((f: string) => f !== field.fieldId);
                            handleUpdate({
                              dataSource: {
                                ...widget.dataSource,
                                displayFields: newFields,
                              },
                            });
                          } else {
                            // 如果未选中，则添加
                            const newFields = [...currentFields, field.fieldId];
                            handleUpdate({
                              dataSource: {
                                ...widget.dataSource,
                                displayFields: newFields,
                              },
                            });
                          }
                        } else if (["column", "line", "bar", "pie", "area", "radar"].includes(widget.type)) {
                          // 图表：根据字段类型自动分配维度或指标
                          const isNumberField = field.type === "number" || field.type === "amount";
                          if (isNumberField) {
                            // 数字字段作为指标
                            handleUpdate({
                              dataSource: {
                                ...widget.dataSource,
                                metric: field.fieldId,
                              },
                            });
                          } else {
                            // 其他字段作为维度
                            handleUpdate({
                              dataSource: {
                                ...widget.dataSource,
                                dimension: field.fieldId,
                              },
                            });
                          }
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Sider>

      {/* 中间：预览 */}
      <Content
        style={{
          background: "#f5f5f5",
          padding: 24,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* 配置栏 */}
          <Card size="small" style={{ marginBottom: 16 }}>
            {["column", "line", "bar", "pie", "area", "radar"].includes(widget.type) && (
              <Space wrap>
                <div>
                  <Text style={{ fontSize: 12 }}>维度</Text>
                  <Select
                    style={{ width: 150, marginTop: 4 }}
                    placeholder="选择维度"
                    value={widget.dataSource?.dimension}
                    onChange={(value) =>
                      handleUpdate({
                        dataSource: {
                          ...widget.dataSource,
                          dimension: value,
                        },
                      })
                    }
                  >
                    {formFields.map((field) => (
                      <Option key={field.fieldId} value={field.fieldId}>
                        {field.label || field.fieldName}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Text style={{ fontSize: 12 }}>指标</Text>
                  <Select
                    style={{ width: 150, marginTop: 4 }}
                    placeholder="选择指标"
                    value={widget.dataSource?.metric}
                    onChange={(value) =>
                      handleUpdate({
                        dataSource: {
                          ...widget.dataSource,
                          metric: value,
                        },
                      })
                    }
                  >
                    {formFields.map((field) => (
                      <Option key={field.fieldId} value={field.fieldId}>
                        {field.label || field.fieldName}
                      </Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Text style={{ fontSize: 12 }}>聚合方式</Text>
                  <Select
                    style={{ width: 120, marginTop: 4 }}
                    value={widget.dataSource?.aggregation || "sum"}
                    onChange={(value) =>
                      handleUpdate({
                        dataSource: {
                          ...widget.dataSource,
                          aggregation: value,
                        },
                      })
                    }
                  >
                    <Option value="sum">求和</Option>
                    <Option value="avg">平均值</Option>
                    <Option value="count">计数</Option>
                    <Option value="max">最大值</Option>
                    <Option value="min">最小值</Option>
                  </Select>
                </div>
              </Space>
            )}
            {widget.type === "dataTable" && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <Text strong style={{ fontSize: 14, marginRight: 8 }}>显示字段</Text>
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      // 可以打开字段选择弹窗
                    }}
                  >
                    添加字段
                  </Button>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => {
                    const { active, over } = event;
                    if (!over) return;
                    
                    // 从字段拖拽到过滤条件区域
                    if (active.data.current?.type === "field" && over.data.current?.type === "filter-condition-zone") {
                      const fieldId = active.data.current.fieldId;
                      const currentConditions = widget.dataSource?.filterConditions || [];
                      const field = formFields.find((f) => f.fieldId === fieldId);
                      if (field && !currentConditions.find((c: any) => c.fieldId === fieldId)) {
                        handleUpdate({
                          dataSource: {
                            ...widget.dataSource,
                            filterConditions: [
                              ...currentConditions,
                              {
                                fieldId,
                                fieldName: field.label || field.fieldName,
                                operator: "eq",
                                value: "",
                              },
                            ],
                          },
                        });
                      }
                      return;
                    }
                    
                    // 显示字段之间的排序
                    if (over && active.id !== over.id && typeof active.id === "string" && typeof over.id === "string") {
                      const oldIndex = (widget.dataSource?.displayFields || []).indexOf(active.id);
                      const newIndex = (widget.dataSource?.displayFields || []).indexOf(over.id);
                      if (oldIndex !== -1 && newIndex !== -1) {
                        const newFields = arrayMove(widget.dataSource?.displayFields || [], oldIndex, newIndex);
                        handleUpdate({
                          dataSource: {
                            ...widget.dataSource,
                            displayFields: newFields,
                          },
                        });
                      }
                    }
                  }}
                >
                  <SortableContext
                    items={widget.dataSource?.displayFields || []}
                    strategy={verticalListSortingStrategy}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {(widget.dataSource?.displayFields || []).map((fieldId: string) => {
                        const field = formFields.find((f) => f.fieldId === fieldId);
                        if (!field) return null;
                        return (
                          <SortableFieldTag
                            key={fieldId}
                            fieldId={fieldId}
                            field={field}
                            widget={widget}
                            onRemove={() => {
                              const newFields = (widget.dataSource?.displayFields || []).filter(
                                (f: string) => f !== fieldId
                              );
                              handleUpdate({
                                dataSource: {
                                  ...widget.dataSource,
                                  displayFields: newFields,
                                },
                              });
                            }}
                            onUpdateFieldConfig={(updates: any) => {
                              // 更新字段配置到 widget.tableConfig.fieldConfigs
                              const currentConfigs = widget.tableConfig?.fieldConfigs || {};
                              handleUpdate({
                                tableConfig: {
                                  ...widget.tableConfig,
                                  fieldConfigs: {
                                    ...currentConfigs,
                                    [fieldId]: {
                                      ...currentConfigs[fieldId],
                                      ...updates,
                                    },
                                  },
                                },
                              });
                            }}
                            onEditName={() => {
                              setEditingFieldId(fieldId);
                              setEditingFieldName(field.customLabel || field.label || field.fieldName);
                            }}
                          />
                        );
                      })}
                  <Select
                    mode="multiple"
                    style={{ width: 200, display: "inline-block" }}
                    placeholder="选择字段"
                    value={[]}
                    onChange={(value) => {
                      const currentFields = widget.dataSource?.displayFields || [];
                      const newFields = [...new Set([...currentFields, ...value])];
                      handleUpdate({
                        dataSource: {
                          ...widget.dataSource,
                          displayFields: newFields,
                        },
                      });
                    }}
                    onBlur={() => {
                      // 清空选择
                    }}
                  >
                    {formFields
                      .filter((field) => !(widget.dataSource?.displayFields || []).includes(field.fieldId))
                      .map((field) => (
                        <Option key={field.fieldId} value={field.fieldId}>
                          {field.label || field.fieldName}
                        </Option>
                      ))}
                  </Select>
                    </div>
                  </SortableContext>
                </DndContext>
                <div style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 12, color: "#999" }}>过滤条件</Text>
                  <FilterConditionDropZone
                    filterConditions={widget.dataSource?.filterConditions || []}
                    formFields={formFields}
                    onAddCondition={(fieldId: string) => {
                      const currentConditions = widget.dataSource?.filterConditions || [];
                      const field = formFields.find((f) => f.fieldId === fieldId);
                      if (field && !currentConditions.find((c: any) => c.fieldId === fieldId)) {
                        handleUpdate({
                          dataSource: {
                            ...widget.dataSource,
                            filterConditions: [
                              ...currentConditions,
                              {
                                fieldId,
                                fieldName: field.label || field.fieldName,
                                operator: "eq", // 默认等于
                                value: "",
                              },
                            ],
                          },
                        });
                      }
                    }}
                    onRemoveCondition={(fieldId: string) => {
                      const currentConditions = widget.dataSource?.filterConditions || [];
                      handleUpdate({
                        dataSource: {
                          ...widget.dataSource,
                          filterConditions: currentConditions.filter((c: any) => c.fieldId !== fieldId),
                        },
                      });
                    }}
                    onUpdateCondition={(fieldId: string, updates: any) => {
                      const currentConditions = widget.dataSource?.filterConditions || [];
                      handleUpdate({
                        dataSource: {
                          ...widget.dataSource,
                          filterConditions: currentConditions.map((c: any) =>
                            c.fieldId === fieldId ? { ...c, ...updates } : c
                          ),
                        },
                      });
                    }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* 预览内容 */}
          <Card style={{ flex: 1 }}>
            {isLoading ? (
              <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Spin />
              </div>
            ) : widget.type === "dataTable" ? (
              <div>
                {previewData?.type === "table" && previewData.data ? (
                  <Table
                    size="small"
                    dataSource={previewData.data}
                    columns={[
                      // 序号列
                      ...(widget.tableConfig?.showSerialNumber ? [{
                        title: "序号",
                        key: "serialNumber",
                        width: 60,
                        align: "center" as const,
                        render: (_: any, __: any, index: number) => {
                          const current = (widget.tableConfig?.pageSize || 20);
                          const page = 1; // 简化处理，实际应该从pagination获取
                          return (page - 1) * current + index + 1;
                        },
                      }] : []),
                      // 数据列
                      ...previewData.fields
                        .filter((field: any) => !field.onlyDetail) // 过滤掉仅详情显示的字段
                        .map((field: any) => ({
                          title: field.customLabel || field.label || field.fieldName,
                          dataIndex: field.fieldId,
                          key: field.fieldId,
                          sorter: field.sort !== undefined ? field.sort !== "none" : true,
                          defaultSortOrder: field.sort === "asc" ? "ascend" : field.sort === "desc" ? "descend" : undefined,
                          align: field.align || "left" as const,
                          render: (text: any) => {
                            // 根据字段配置格式化显示
                            if (field.format === "currency") {
                              return `¥${Number(text || 0).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            } else if (field.format === "number") {
                              return Number(text || 0).toLocaleString("zh-CN");
                            }
                            return text;
                          },
                        })),
                    ]}
                    pagination={{
                      pageSize: widget.tableConfig?.pageSize || 20,
                      showSizeChanger: true,
                      showTotal: (total) => `共 ${total} 条`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: 400,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#999",
                    }}
                  >
                    <Text type="secondary" style={{ marginBottom: 8 }}>
                      {widget.dataSource?.formId
                        ? widget.dataSource?.displayFields?.length === 0
                          ? "请从左侧点击字段添加到显示字段"
                          : "正在加载数据..."
                        : "请先选择数据源"}
                    </Text>
                    {widget.dataSource?.formId && widget.dataSource?.displayFields?.length === 0 && (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        点击左侧字段即可添加到显示字段
                      </Text>
                    )}
                  </div>
                )}
              </div>
            ) : chartOption ? (
              <ReactECharts option={chartOption} style={{ height: 500, width: "100%" }} opts={{ renderer: "svg" }} />
            ) : (
              <div
                style={{
                  height: 400,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                }}
              >
                <Text type="secondary">请配置数据源和字段</Text>
              </div>
            )}
          </Card>
        </div>
      </Content>

      {/* 右侧：属性配置 */}
      <Sider width={360} style={{ background: "#fff", borderLeft: "1px solid #f0f0f0" }}>
        <div style={{ padding: 16, height: "100%", overflow: "auto" }}>
          <Title level={5} style={{ marginBottom: 16 }}>
            组件配置
          </Title>
          <Form layout="vertical" size="small">
            <Form.Item label="组件标题">
              <Input
                value={widget.title}
                onChange={(e) => handleUpdate({ title: e.target.value })}
                placeholder="请输入组件标题"
              />
            </Form.Item>

            <Form.Item label="布局">
              <Select
                style={{ width: "100%" }}
                value={widget.span}
                onChange={(value) => handleUpdate({ span: value })}
              >
                {[6, 8, 12, 16, 24].map((s) => (
                  <Option key={s} value={s}>
                    {s}列
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {/* 图表类型组件的配置 */}
            {["column", "line", "bar", "pie", "area", "radar"].includes(widget.type) && (
              <>
                <Divider titlePlacement="left">图表配置</Divider>
                {widget.type === "pie" && (
                  <>
                    <Form.Item label="饼图类型">
                      <Radio.Group
                        value={widget.chartConfig?.pieChartType || "pie"}
                        onChange={(e) =>
                          handleUpdate({
                            chartConfig: {
                              ...widget.chartConfig,
                              pieChartType: e.target.value,
                            },
                          })
                        }
                      >
                        <Radio.Button value="pie">饼图</Radio.Button>
                        <Radio.Button value="donut">环形图</Radio.Button>
                        <Radio.Button value="rose">玫瑰图</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                    <Form.Item label="数据显示">
                      <Space orientation="vertical">
                        <Checkbox
                          checked={widget.chartConfig?.showDataLabel}
                          onChange={(e) =>
                            handleUpdate({
                              chartConfig: {
                                ...widget.chartConfig,
                                showDataLabel: e.target.checked,
                              },
                            })
                          }
                        >
                          显示数据标签
                        </Checkbox>
                        <Checkbox
                          checked={widget.chartConfig?.showDimensionValue}
                          onChange={(e) =>
                            handleUpdate({
                              chartConfig: {
                                ...widget.chartConfig,
                                showDimensionValue: e.target.checked,
                              },
                            })
                          }
                        >
                          显示维度值
                        </Checkbox>
                        <Checkbox
                          checked={widget.chartConfig?.showMetricValue}
                          onChange={(e) =>
                            handleUpdate({
                              chartConfig: {
                                ...widget.chartConfig,
                                showMetricValue: e.target.checked,
                              },
                            })
                          }
                        >
                          显示指标值
                        </Checkbox>
                        <Checkbox
                          checked={widget.chartConfig?.showPercentage}
                          onChange={(e) =>
                            handleUpdate({
                              chartConfig: {
                                ...widget.chartConfig,
                                showPercentage: e.target.checked,
                              },
                            })
                          }
                        >
                          显示百分比
                        </Checkbox>
                      </Space>
                    </Form.Item>
                    <Form.Item label="图例">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Checkbox
                          checked={widget.chartConfig?.showLegend}
                          onChange={(e) =>
                            handleUpdate({
                              chartConfig: {
                                ...widget.chartConfig,
                                showLegend: e.target.checked,
                              },
                            })
                          }
                        >
                          显示图例
                        </Checkbox>
                        {widget.chartConfig?.showLegend && (
                          <Select
                            placeholder="图例显示位置"
                            value={widget.chartConfig?.legendPosition || "bottom"}
                            onChange={(value) =>
                              handleUpdate({
                                chartConfig: {
                                  ...widget.chartConfig,
                                  legendPosition: value,
                                },
                              })
                            }
                          >
                            <Option value="top">顶部</Option>
                            <Option value="bottom">底部</Option>
                            <Option value="left">左侧</Option>
                            <Option value="right">右侧</Option>
                          </Select>
                        )}
                      </Space>
                    </Form.Item>
                  </>
                )}
                {widget.type === "column" && (
                  <>
                    <Form.Item label="坐标X轴">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <div>
                          <Text style={{ fontSize: 12 }}>标签文字显示方向</Text>
                          <Select
                            style={{ width: "100%", marginTop: 4 }}
                            value={widget.chartConfig?.xAxisLabelDirection || "horizontal"}
                            onChange={(value) =>
                              handleUpdate({
                                chartConfig: {
                                  ...widget.chartConfig,
                                  xAxisLabelDirection: value,
                                },
                              })
                            }
                          >
                            <Option value="horizontal">横向</Option>
                            <Option value="vertical">纵向</Option>
                          </Select>
                        </div>
                        <Checkbox
                          checked={widget.chartConfig?.forceShowAllLabels}
                          onChange={(e) =>
                            handleUpdate({
                              chartConfig: {
                                ...widget.chartConfig,
                                forceShowAllLabels: e.target.checked,
                              },
                            })
                          }
                        >
                          强制显示所有标签
                        </Checkbox>
                      </Space>
                    </Form.Item>
                    <Form.Item label="坐标Y轴">
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <div>
                          <Text style={{ fontSize: 12 }}>标题</Text>
                          <Input
                            placeholder="请输入标题"
                            value={widget.chartConfig?.yAxisTitle}
                            onChange={(e) =>
                              handleUpdate({
                                chartConfig: {
                                  ...widget.chartConfig,
                                  yAxisTitle: e.target.value,
                                },
                              })
                            }
                          />
                        </div>
                        <div>
                          <Text style={{ fontSize: 12 }}>最大值</Text>
                          <Input
                            placeholder="自动计算"
                            value={
                              widget.chartConfig?.yAxisMax === "auto"
                                ? "自动计算"
                                : widget.chartConfig?.yAxisMax
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdate({
                                chartConfig: {
                                  ...widget.chartConfig,
                                  yAxisMax: val === "自动计算" ? "auto" : Number(val) || "auto",
                                },
                              });
                            }}
                          />
                        </div>
                        <div>
                          <Text style={{ fontSize: 12 }}>最小值</Text>
                          <Input
                            placeholder="自动计算"
                            value={
                              widget.chartConfig?.yAxisMin === "auto"
                                ? "自动计算"
                                : widget.chartConfig?.yAxisMin
                            }
                            onChange={(e) => {
                              const val = e.target.value;
                              handleUpdate({
                                chartConfig: {
                                  ...widget.chartConfig,
                                  yAxisMin: val === "自动计算" ? "auto" : Number(val) || "auto",
                                },
                              });
                            }}
                          />
                        </div>
                      </Space>
                    </Form.Item>
                    <Form.Item>
                      <Checkbox
                        checked={widget.chartConfig?.showDataLabel}
                        onChange={(e) =>
                          handleUpdate({
                            chartConfig: {
                              ...widget.chartConfig,
                              showDataLabel: e.target.checked,
                            },
                          })
                        }
                      >
                        显示数据标签
                      </Checkbox>
                    </Form.Item>
                  </>
                )}
              </>
            )}

            {/* 数据表类型组件的配置 */}
            {widget.type === "dataTable" && (
              <>
                <Divider titlePlacement="left">数据显示</Divider>
                <Form.Item>
                  <Checkbox
                    checked={widget.tableConfig?.showSerialNumber}
                    onChange={(e) =>
                      handleUpdate({
                        tableConfig: {
                          ...widget.tableConfig,
                          showSerialNumber: e.target.checked,
                        },
                      })
                    }
                  >
                    显示序号
                  </Checkbox>
                </Form.Item>
                <Form.Item>
                  <Space>
                    <Checkbox
                      checked={!!widget.tableConfig?.limitRows}
                      onChange={(e) =>
                        handleUpdate({
                          tableConfig: {
                            ...widget.tableConfig,
                            limitRows: e.target.checked ? widget.tableConfig?.limitRows || 100 : undefined,
                          },
                        })
                      }
                    >
                      显示前
                    </Checkbox>
                    {widget.tableConfig?.limitRows && (
                      <InputNumber
                        value={widget.tableConfig.limitRows}
                        onChange={(value) =>
                          handleUpdate({
                            tableConfig: {
                              ...widget.tableConfig,
                              limitRows: value || 100,
                            },
                          })
                        }
                        min={1}
                        style={{ width: 80 }}
                      />
                    )}
                    {widget.tableConfig?.limitRows && <Text>条数据</Text>}
                  </Space>
                </Form.Item>
                <Divider titlePlacement="left">表格冻结</Divider>
                <Form.Item>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Space>
                      <Checkbox
                        checked={!!widget.tableConfig?.frozenColumnsDesktop}
                        onChange={(e) =>
                          handleUpdate({
                            tableConfig: {
                              ...widget.tableConfig,
                              frozenColumnsDesktop: e.target.checked
                                ? widget.tableConfig?.frozenColumnsDesktop || 1
                                : undefined,
                            },
                          })
                        }
                      >
                        电脑端固定前
                      </Checkbox>
                      {widget.tableConfig?.frozenColumnsDesktop && (
                        <Select
                          value={widget.tableConfig.frozenColumnsDesktop}
                          onChange={(value) =>
                            handleUpdate({
                              tableConfig: {
                                ...widget.tableConfig,
                                frozenColumnsDesktop: value,
                              },
                            })
                          }
                          style={{ width: 80 }}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Option key={n} value={n}>
                              {n}列
                            </Option>
                          ))}
                        </Select>
                      )}
                    </Space>
                    <Space>
                      <Checkbox
                        checked={!!widget.tableConfig?.frozenColumnsMobile}
                        onChange={(e) =>
                          handleUpdate({
                            tableConfig: {
                              ...widget.tableConfig,
                              frozenColumnsMobile: e.target.checked
                                ? widget.tableConfig?.frozenColumnsMobile || 1
                                : undefined,
                            },
                          })
                        }
                      >
                        移动端固定前
                      </Checkbox>
                      {widget.tableConfig?.frozenColumnsMobile && (
                        <Select
                          value={widget.tableConfig.frozenColumnsMobile}
                          onChange={(value) =>
                            handleUpdate({
                              tableConfig: {
                                ...widget.tableConfig,
                                frozenColumnsMobile: value,
                              },
                            })
                          }
                          style={{ width: 80 }}
                        >
                          {[1, 2, 3, 4, 5].map((n) => (
                            <Option key={n} value={n}>
                              {n}列
                            </Option>
                          ))}
                        </Select>
                      )}
                    </Space>
                  </Space>
                </Form.Item>
                <Divider titlePlacement="left">控件样式</Divider>
                <Form.Item label="背景">
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Radio.Group
                      value={widget.tableConfig?.backgroundType || "solid"}
                      onChange={(e) =>
                        handleUpdate({
                          tableConfig: {
                            ...widget.tableConfig,
                            backgroundType: e.target.value,
                          },
                        })
                      }
                    >
                      <Radio value="solid">纯色</Radio>
                      <Radio value="image">图片</Radio>
                    </Radio.Group>
                    <Button size="small" type="link">
                      设置
                    </Button>
                  </Space>
                </Form.Item>
                <Form.Item label="标题颜色">
                  <Button size="small" type="link">
                    设置
                  </Button>
                </Form.Item>
                <Divider titlePlacement="left">表格样式</Divider>
                <Form.Item label="主题色">
                  <Button size="small" type="link">
                    设置
                  </Button>
                </Form.Item>
                <Form.Item label="表头文字">
                  <Button size="small" type="link">
                    设置
                  </Button>
                </Form.Item>
                <Form.Item label="内容文字">
                  <Button size="small" type="link">
                    设置
                  </Button>
                </Form.Item>
              </>
            )}
          </Form>
        </div>
      </Sider>
      
      {/* 修改显示名弹窗 */}
      <Modal
        title="修改显示名"
        open={editingFieldId !== null}
        onOk={() => {
          if (editingFieldId) {
            const currentConfigs = widget.tableConfig?.fieldConfigs || {};
            handleUpdate({
              tableConfig: {
                ...widget.tableConfig,
                fieldConfigs: {
                  ...currentConfigs,
                  [editingFieldId]: {
                    ...currentConfigs[editingFieldId],
                    customLabel: editingFieldName,
                  },
                },
              },
            });
          }
          setEditingFieldId(null);
          setEditingFieldName("");
        }}
        onCancel={() => {
          setEditingFieldId(null);
          setEditingFieldName("");
        }}
      >
        <Input
          value={editingFieldName}
          onChange={(e) => setEditingFieldName(e.target.value)}
          placeholder="请输入显示名"
          onPressEnter={() => {
            if (editingFieldId) {
              const currentConfigs = widget.tableConfig?.fieldConfigs || {};
              handleUpdate({
                tableConfig: {
                  ...widget.tableConfig,
                  fieldConfigs: {
                    ...currentConfigs,
                    [editingFieldId]: {
                      ...currentConfigs[editingFieldId],
                      customLabel: editingFieldName,
                    },
                  },
                },
              });
            }
            setEditingFieldId(null);
            setEditingFieldName("");
          }}
        />
      </Modal>
    </Layout>
  );
};

// 可拖拽的字段标签组件
interface SortableFieldTagProps {
  fieldId: string;
  field: any;
  widget: ReportWidget;
  onRemove: () => void;
  onUpdateFieldConfig: (updates: any) => void;
  onEditName: () => void;
}

const SortableFieldTag = ({ fieldId, field, widget, onRemove, onUpdateFieldConfig, onEditName }: SortableFieldTagProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fieldId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "move",
  };

  const fieldConfig = widget.tableConfig?.fieldConfigs?.[fieldId] || {};
  const displayName = fieldConfig.customLabel || field.customLabel || field.label || field.fieldName;

  const menuItems = [
    {
      key: "editName",
      label: "修改显示名",
      icon: <EditOutlined />,
      onClick: () => {
        onEditName();
      },
    },
    {
      key: "onlyDetail",
      label: "仅详情显示",
      icon: <EyeOutlined />,
      onClick: () => {
        onUpdateFieldConfig({
          onlyDetail: !fieldConfig.onlyDetail,
        });
      },
    },
    {
      type: "divider" as const,
    },
    {
      key: "format",
      label: "数据格式",
      icon: <FormatPainterOutlined />,
      children: [
        {
          key: "format-text",
          label: "文本",
          onClick: () => {
            onUpdateFieldConfig({ format: undefined });
          },
        },
        {
          key: "format-number",
          label: "数字",
          onClick: () => {
            onUpdateFieldConfig({ format: "number" });
          },
        },
        {
          key: "format-currency",
          label: "货币",
          onClick: () => {
            onUpdateFieldConfig({ format: "currency" });
          },
        },
      ],
    },
    {
      key: "sort",
      label: "排序",
      icon: <SortAscendingOutlined />,
      children: [
        {
          key: "sort-none",
          label: "不排序",
          onClick: () => {
            onUpdateFieldConfig({ sort: undefined });
          },
        },
        {
          key: "sort-asc",
          label: "升序",
          onClick: () => {
            onUpdateFieldConfig({ sort: "asc" });
          },
        },
        {
          key: "sort-desc",
          label: "降序",
          onClick: () => {
            onUpdateFieldConfig({ sort: "desc" });
          },
        },
      ],
    },
    {
      key: "align",
      label: "对齐方式",
      icon: <AlignLeftOutlined />,
      children: [
        {
          key: "align-left",
          label: "左对齐",
          onClick: () => {
            onUpdateFieldConfig({ align: "left" });
          },
        },
        {
          key: "align-center",
          label: "居中",
          onClick: () => {
            onUpdateFieldConfig({ align: "center" });
          },
        },
        {
          key: "align-right",
          label: "右对齐",
          onClick: () => {
            onUpdateFieldConfig({ align: "right" });
          },
        },
      ],
    },
    {
      key: "editable",
      label: "是否可编辑",
      icon: <CheckOutlined />,
      onClick: () => {
        onUpdateFieldConfig({
          editable: !fieldConfig.editable,
        });
      },
    },
    {
      type: "divider" as const,
    },
    {
      key: "delete",
      label: "删除字段",
      icon: <DeleteOutlined />,
      danger: true,
      onClick: () => {
        onRemove();
      },
    },
  ];

  return (
    <div ref={setNodeRef} style={style}>
      <Tag
        closable
        onClose={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        style={{
          padding: "4px 8px",
          fontSize: 12,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          cursor: "move",
        }}
        {...attributes}
        {...listeners}
      >
        <span>{displayName}</span>
        <Dropdown
          menu={{ items: menuItems }}
          trigger={["click"]}
          placement="bottomLeft"
        >
          <DownOutlined style={{ fontSize: 10, cursor: "pointer" }} onClick={(e) => e.stopPropagation()} />
        </Dropdown>
      </Tag>
    </div>
  );
};

// 可拖拽的字段项组件
interface DraggableFieldItemProps {
  field: any;
  isSelected: boolean;
  widget: ReportWidget;
  onSelect: () => void;
}

const DraggableFieldItem = ({ field, isSelected, widget, onSelect }: DraggableFieldItemProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${field.fieldId}`,
    data: {
      type: "field",
      fieldId: field.fieldId,
      field,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        background: (widget.dataSource?.dimension === field.fieldId ||
                    widget.dataSource?.metric === field.fieldId ||
                    (widget.dataSource?.displayFields || []).includes(field.fieldId))
                    ? "#e6f7ff" : "#fafafa",
        border: isSelected ? "1px solid #1890ff" : "1px solid transparent",
        borderRadius: 4,
        cursor: "move",
        transition: "all 0.2s",
      }}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "#f0f0f0";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "#fafafa";
        }
      }}
    >
      {getFieldIcon(field)}
      <Text style={{ flex: 1 }}>{field.label || field.fieldName}</Text>
      {isSelected && (
        <span style={{ color: "#1890ff", fontSize: 12 }}>✓</span>
      )}
    </div>
  );
};

// 过滤条件拖放区域
interface FilterConditionDropZoneProps {
  filterConditions: any[];
  formFields: any[];
  onAddCondition: (fieldId: string) => void;
  onRemoveCondition: (fieldId: string) => void;
  onUpdateCondition: (fieldId: string, updates: any) => void;
}

const FilterConditionDropZone = ({
  filterConditions,
  formFields,
  onAddCondition,
  onRemoveCondition,
  onUpdateCondition,
}: FilterConditionDropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "filter-condition-zone",
    data: {
      type: "filter-condition-zone",
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        marginTop: 8,
        padding: 16,
        background: isOver ? "#e6f7ff" : "#fafafa",
        borderRadius: 4,
        border: isOver ? "2px dashed #1890ff" : "1px dashed #d9d9d9",
        textAlign: filterConditions.length === 0 ? "center" : "left",
        color: "#999",
        fontSize: 12,
        minHeight: 60,
      }}
    >
      {filterConditions.length === 0 ? (
        <div>拖动左侧字段到此处来添加过滤条件</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filterConditions.map((condition: any) => {
            const field = formFields.find((f) => f.fieldId === condition.fieldId);
            if (!field) return null;
            return (
              <div
                key={condition.fieldId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  background: "#fff",
                  borderRadius: 4,
                  border: "1px solid #d9d9d9",
                }}
              >
                <Text style={{ minWidth: 80 }}>{field.label || field.fieldName}</Text>
                <Select
                  size="small"
                  style={{ width: 100 }}
                  value={condition.operator || "eq"}
                  onChange={(value) => onUpdateCondition(condition.fieldId, { operator: value })}
                >
                  <Option value="eq">等于</Option>
                  <Option value="ne">不等于</Option>
                  <Option value="gt">大于</Option>
                  <Option value="gte">大于等于</Option>
                  <Option value="lt">小于</Option>
                  <Option value="lte">小于等于</Option>
                  <Option value="contains">包含</Option>
                  <Option value="notContains">不包含</Option>
                </Select>
                <Input
                  size="small"
                  style={{ flex: 1 }}
                  placeholder="输入值"
                  value={condition.value || ""}
                  onChange={(e) => onUpdateCondition(condition.fieldId, { value: e.target.value })}
                />
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => onRemoveCondition(condition.fieldId)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

