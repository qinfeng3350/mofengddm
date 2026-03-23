import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Layout,
  Card,
  Space,
  Typography,
  Button,
  Input,
  Select,
  Spin,
  Alert,
  Empty,
  Divider,
  Collapse,
  Form,
  Switch,
  InputNumber,
  Radio,
  Checkbox,
  Table,
  Tooltip,
} from "antd";
import {
  TableOutlined,
  FileTextOutlined,
  CalendarOutlined,
  AppstoreOutlined,
  NumberOutlined,
  PictureOutlined,
  ClockCircleOutlined,
  GlobalOutlined,
  ContainerOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  AreaChartOutlined,
  RadarChartOutlined,
  DashboardOutlined,
  FunnelPlotOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FullscreenOutlined,
} from "@ant-design/icons";
import ReactECharts from "echarts-for-react";
import { formDefinitionApi } from "@/api/formDefinition";
import { formDataApi } from "@/api/formData";
import { message } from "antd";
import dayjs from "dayjs";

const { Sider, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

type ChartType =
  | "column" // 柱形图
  | "line" // 折线图
  | "bar" // 条形图
  | "pie" // 饼图
  | "area" // 面积图
  | "radar" // 雷达图
  | "dualAxis" // 双轴图
  | "map" // 地图
  | "funnel" // 漏斗图
  | "gauge"; // 仪表盘

type ComponentType =
  | "dataTable" // 数据表
  | "text" // 文本控件
  | "calendar" // 日历
  | "pivot" // 透视图
  | "indicator" // 指标
  | "gantt" // 甘特图
  | "image" // 图片组件
  | "realtime" // 实时时间
  | "embed" // 嵌入页面
  | "container" // 布局容器
  | ChartType;

export interface ReportWidget {
  id: string;
  type: ComponentType;
  title: string;
  // 网格布局位置
  row: number; // 行位置
  col: number; // 列位置
  span: number; // 占据的列数（1-24）
  height?: number; // 高度（像素）
  // 数据源配置
  dataSource?: {
    formId?: string;
    dimension?: string; // 维度字段ID
    metric?: string; // 指标字段ID
    aggregation?: "sum" | "avg" | "count" | "max" | "min"; // 聚合方式
    filter?: any; // 过滤条件
    displayFields?: string[]; // 数据表显示的字段
  };
  // 图表配置
  chartConfig?: {
    showDataLabel?: boolean;
    showDimensionValue?: boolean;
    showMetricValue?: boolean;
    showPercentage?: boolean;
    showLegend?: boolean;
    legendPosition?: "top" | "bottom" | "left" | "right";
    xAxisLabelDirection?: "horizontal" | "vertical";
    forceShowAllLabels?: boolean;
    yAxisTitle?: string;
    yAxisMax?: number | "auto";
    yAxisMin?: number | "auto";
    pieChartType?: "pie" | "donut" | "rose";
    colorScheme?: "default" | "custom";
  };
  // 数据表配置
  tableConfig?: {
    showSerialNumber?: boolean;
    showCheckbox?: boolean;
    pageSize?: number;
    frozenColumns?: number;
  };
  // 实时时间配置
  realtimeConfig?: {
    format?: string; // 时间格式
  };
}

interface ReportDesignerV2Props {
  appId?: string;
  initialConfig?: any | null;
  onConfigChange?: (config: any) => void;
}

export const ReportDesignerV2 = ({ appId: propAppId, initialConfig, onConfigChange }: ReportDesignerV2Props) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 优先使用 props 中的 appId，如果没有则从 URL 参数获取
  const appId = propAppId || searchParams.get("appId") || undefined;
  const reportId = searchParams.get("reportId") || `report_${Date.now()}`;
  const [reportName, setReportName] = useState<string>(initialConfig?.reportName || "未命名分析报表");
  const [widgets, setWidgets] = useState<ReportWidget[]>(() => initialConfig?.widgets || []);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | undefined>();
  const [forms, setForms] = useState<any[]>([]);
  // 每个组件的数据源字段缓存：formId -> fields[]
  const [formFieldsCache, setFormFieldsCache] = useState<Record<string, any[]>>({});
  const [previewDataMap, setPreviewDataMap] = useState<Record<string, any>>({});
  const [previewLoadingMap, setPreviewLoadingMap] = useState<Record<string, boolean>>({});

  // 必须在组件顶层调用 hooks，不能在条件语句中
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId);

  // 加载表单列表
  useEffect(() => {
    if (!appId) return;
    formDefinitionApi
      .getListByApplication(appId)
      .then((list) => setForms(list || []))
      .catch((e) => console.error("加载表单失败:", e));
  }, [appId]);

  // 加载表单字段（缓存机制）
  const loadFormFields = useCallback(async (formIdOrId: string) => {
    // 先检查缓存
    if (formFieldsCache[formIdOrId]) {
      return formFieldsCache[formIdOrId];
    }
    
    // 如果表单列表为空，等待加载完成
    if (forms.length === 0) {
      console.log("表单列表为空，等待加载完成");
      return [];
    }
    
    try {
      // 先尝试从表单列表中查找对应的 formId
      const foundForm = forms.find(f => f.id === formIdOrId || f.formId === formIdOrId);
      if (!foundForm) {
        console.warn("未在表单列表中找到表单，formIdOrId:", formIdOrId);
        return [];
      }
      
      // 优先使用 formId，如果没有则使用 id
      const actualFormId = foundForm.formId || foundForm.id;
      if (!actualFormId) {
        console.warn("表单没有有效的 formId", foundForm);
        return [];
      }
      
      console.log("从表单列表找到表单，使用 formId:", actualFormId);
      
      // 使用 actualFormId 获取表单定义
      const form = await formDefinitionApi.getById(actualFormId);
      const fields: any[] = [];
      const collectFields = (items: any[]): void => {
        items.forEach((item) => {
          if (item.fieldId && item.type !== "button") {
            fields.push({
              fieldId: item.fieldId,
              fieldName: item.fieldName || item.label || item.fieldId,
              type: item.type,
              label: item.label || item.fieldName || item.fieldId,
              options: item.options,
            });
          }
          if (item.children) {
            collectFields(item.children);
          }
          if (item.columns) {
            item.columns.forEach((col: any) => {
              if (col.children) {
                collectFields(col.children);
              }
            });
          }
        });
      };
      const elements = form.config?.elements || form.config?.fields || [];
      collectFields(elements);
      
      // 缓存时使用原始 formIdOrId，以便后续查找
      setFormFieldsCache((prev) => ({ ...prev, [formIdOrId]: fields }));
      return fields;
    } catch (e) {
      console.error("加载表单字段失败:", e);
      return [];
    }
  }, [forms, formFieldsCache]);

  // 为每个组件加载预览数据
  useEffect(() => {
    widgets.forEach((widget) => {
      if (!widget.dataSource?.formId) {
        setPreviewDataMap((prev) => ({ ...prev, [widget.id]: null }));
        return;
      }

      const { formId, dimension, metric, aggregation = "sum" } = widget.dataSource;
      
      // 确保字段已加载
      loadFormFields(formId);
      
      // 图表类型需要维度和指标
      if (["column", "line", "bar", "pie", "area", "radar"].includes(widget.type)) {
        if (!dimension || !metric) {
          setPreviewDataMap((prev) => ({ ...prev, [widget.id]: null }));
          return;
        }
      }

      // 数据表类型需要显示字段
      if (widget.type === "dataTable") {
        if (!widget.dataSource.displayFields || widget.dataSource.displayFields.length === 0) {
          setPreviewDataMap((prev) => ({ ...prev, [widget.id]: null }));
          return;
        }
      }

      (async () => {
        try {
          setPreviewLoadingMap((prev) => ({ ...prev, [widget.id]: true }));
          
          // 如果表单列表为空，等待加载完成
          if (forms.length === 0) {
            console.log("表单列表为空，等待加载完成");
            setPreviewLoadingMap((prev) => ({ ...prev, [widget.id]: false }));
            return;
          }
          
          // 先确定正确的 formId
          const formIdOrId = formId;
          const foundForm = forms.find(f => f.id === formIdOrId || f.formId === formIdOrId);
          if (!foundForm) {
            console.warn("未找到表单，formId:", formIdOrId);
            setPreviewLoadingMap((prev) => ({ ...prev, [widget.id]: false }));
            setPreviewDataMap((prev) => ({ ...prev, [widget.id]: null }));
            return;
          }
          const actualFormId = foundForm.formId || foundForm.id;
          if (!actualFormId) {
            console.warn("表单没有有效的 formId", foundForm);
            setPreviewLoadingMap((prev) => ({ ...prev, [widget.id]: false }));
            setPreviewDataMap((prev) => ({ ...prev, [widget.id]: null }));
            return;
          }
          console.log("加载数据，formId:", formId, "actualFormId:", actualFormId);
          
          const rows = await formDataApi.getListByForm(actualFormId);
          
          // 获取字段定义
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
            const displayFields = widget.dataSource.displayFields || [];
            const tableData = (rows || []).slice(0, 200).map((row: any, index: number) => {
              const data = row.data || {};
              const record: any = { key: row.id || index };
              displayFields.forEach((fieldId) => {
                const field = allFields.find((f) => f.fieldId === fieldId);
                let value: any;
                
                // 系统字段从 row 对象中获取，而不是从 data 中
                if (fieldId === "submitterName") {
                  value = row.submitterName || "";
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
            setPreviewDataMap((prev) => ({
              ...prev,
              [widget.id]: { type: "table", data: tableData, fields: displayFields.map((fid) => allFields.find((f) => f.fieldId === fid)).filter(Boolean) },
            }));
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

            // 根据聚合方式计算
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
                default: // sum
                  aggregated = values.reduce((a, b) => a + b, 0);
              }
              yData.push(aggregated);
            });

            setPreviewDataMap((prev) => ({
              ...prev,
              [widget.id]: { type: "chart", xData, yData, dimensionField, metricField },
            }));
          }
        } catch (e) {
          console.error(`加载组件 ${widget.id} 数据失败:`, e);
          setPreviewDataMap((prev) => ({ ...prev, [widget.id]: null }));
        } finally {
          setPreviewLoadingMap((prev) => ({ ...prev, [widget.id]: false }));
        }
      })();
    });
  }, [widgets, forms, forms.length, loadFormFields]);

  // 当外部传入的初始配置发生变化时，同步到内部状态（例如从后端加载完成）
  useEffect(() => {
    if (initialConfig) {
      // 只有当 initialConfig 有 reportName 时才更新，避免覆盖用户已编辑的名称
      // 但如果当前 reportName 是默认值，则允许更新
      if (initialConfig.reportName) {
        if (reportName === "未命名分析报表" || initialConfig.reportName !== "未命名分析报表") {
          setReportName(initialConfig.reportName);
        }
      }
      // 同步 widgets
      if (initialConfig.widgets) {
        setWidgets(initialConfig.widgets);
      }
    }
  }, [initialConfig?.reportName, initialConfig?.widgets]);

  // 同步配置变化
  const onConfigChangeRef = useRef(onConfigChange);
  useEffect(() => {
    onConfigChangeRef.current = onConfigChange;
  }, [onConfigChange]);

  useEffect(() => {
    if (onConfigChangeRef.current) {
      onConfigChangeRef.current({
        reportName,
        widgets,
      });
    }
  }, [reportName, widgets]);

  // 自动重新排列组件布局，让它们尽可能并排显示
  const prevWidgetIdsRef = useRef<string>('');
  const prevWidgetsHashRef = useRef<string>('');
  useEffect(() => {
    if (widgets.length === 0) {
      prevWidgetIdsRef.current = '';
      prevWidgetsHashRef.current = '';
      return;
    }
    
    const currentWidgetIds = widgets.map(w => w.id).sort().join(',');
    // 计算组件的 hash（包括 ID、row、col、span），用于检测布局变化
    const currentWidgetsHash = widgets.map(w => `${w.id}:${w.row}:${w.col}:${w.span}`).sort().join(',');
    
    // 只在组件ID列表变化或布局变化时触发
    if (currentWidgetIds === prevWidgetIdsRef.current && currentWidgetsHash === prevWidgetsHashRef.current) {
      return;
    }
    prevWidgetIdsRef.current = currentWidgetIds;
    prevWidgetsHashRef.current = currentWidgetsHash;
    
    // 按 row 和 col 排序，但实时时间组件优先放在最前面
    const sortedWidgets = [...widgets].sort((a, b) => {
      // 实时时间组件始终排在最前面
      if (a.type === "realtime" && b.type !== "realtime") return -1;
      if (a.type !== "realtime" && b.type === "realtime") return 1;
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });

    // 重新计算位置
    const rearrangedWidgets: ReportWidget[] = [];
    let currentRow = 0;
    let currentCol = 0;

    sortedWidgets.forEach((widget) => {
      // 实时时间组件特殊处理：始终在第一行，占据整行（span=24）
      if (widget.type === "realtime") {
        rearrangedWidgets.push({
          ...widget,
          row: 0,
          col: 0,
          span: 24, // 强制占据整行
        });
        // 其他组件从第二行开始
        if (currentRow === 0) {
          currentRow = 1;
          currentCol = 0;
        }
        return; // 跳过后续处理
      }
      
      let span = widget.span || 12;
      
      // 检查当前行是否已经有其他组件（通过检查 rearrangedWidgets 中是否有相同 row 的组件）
      const widgetsInCurrentRow = rearrangedWidgets.filter(w => w.row === currentRow);
      const hasOtherWidgetsInCurrentRow = widgetsInCurrentRow.length > 0;
      
      // 只有当当前行已经有组件，且当前行所有组件都是 span=24，且当前组件也是 span=24 时，才自动调整为 span=12 以便并排显示
      // 这样可以确保两个 span=24 的组件能够并排，但 span=12 和 span=24 不能并排
      if (span === 24 && hasOtherWidgetsInCurrentRow) {
        // 检查当前行所有组件是否都是 span=24
        const allWidgetsAre24 = widgetsInCurrentRow.every(w => (w.span || 12) === 24);
        if (allWidgetsAre24) {
          span = 12; // 自动调整为 12，以便并排显示
        }
      }
      
      // 检查当前行是否有足够空间
      // 如果当前列+span会超过24，则换行
      if (currentCol + span > 24) {
        // 换到下一行
        currentRow++;
        currentCol = 0;
        // 重新检查新行是否已经有组件，且所有组件都是 span=24
        const widgetsInNewRow = rearrangedWidgets.filter(w => w.row === currentRow);
        const hasOtherWidgetsInNewRow = widgetsInNewRow.length > 0;
        if (widget.span === 24 && hasOtherWidgetsInNewRow) {
          const allWidgetsAre24 = widgetsInNewRow.every(w => (w.span || 12) === 24);
          if (allWidgetsAre24) {
            span = 12; // 新行所有组件都是 span=24，自动调整为 span=12
          } else {
            span = 24; // 新行有组件但不是都是 span=24，保持 span=24，会换行
          }
        } else if (widget.span === 24 && !hasOtherWidgetsInNewRow) {
          span = 24; // 新行没有其他组件，保持 span=24
        }
      }

      rearrangedWidgets.push({
        ...widget,
        row: currentRow,
        col: currentCol,
        span: span, // 使用调整后的 span
      });

      // 更新当前列位置
      currentCol += span;
    });

    // 检查是否需要更新（位置或 span 有变化）
    const needsUpdate = rearrangedWidgets.some((w) => {
      const original = widgets.find((ow) => ow.id === w.id);
      return !original || w.row !== original.row || w.col !== original.col || w.span !== original.span;
    });

    if (needsUpdate) {
      // 使用函数式更新，避免依赖 widgets
      setWidgets((prev) => {
        const prevMap = new Map(prev.map((w) => [w.id, w]));
        return rearrangedWidgets.map((w) => {
          const original = prevMap.get(w.id);
          return original ? { ...original, row: w.row, col: w.col, span: w.span } : w;
        });
      });
    }
  }, [widgets]);

  // 添加组件到画布
  const handleAddComponent = (type: ComponentType) => {
    const id = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 实时时间组件特殊处理：放在第一行，占据整行
    if (type === "realtime") {
      // 检查第一行是否已有实时时间组件
      const firstRowRealtime = widgets.find(w => w.row === 0 && w.type === "realtime");
      if (firstRowRealtime) {
        message.warning("第一行已存在实时时间组件");
        return;
      }
      
      // 将所有现有组件向下移动一行
      const shiftedWidgets = widgets.map(w => ({
        ...w,
        row: w.row + 1,
      }));
      
      const newWidget: ReportWidget = {
        id,
        type,
        title: getComponentName(type),
        row: 0,
        col: 0,
        span: 24, // 占据整行
        height: 60, // 设置较小的高度
      };
      setWidgets([newWidget, ...shiftedWidgets]);
      setSelectedWidgetId(id);
      return;
    }
    
    // 计算下一个位置（网格布局）
    const existingWidgets = widgets;
    let nextRow = 0;
    let nextCol = 0;
    let nextSpan = 12; // 默认占据一半宽度

    if (existingWidgets.length > 0) {
      // 找到最后一行
      const lastRow = Math.max(...existingWidgets.map((w) => w.row));
      const lastRowWidgets = existingWidgets.filter((w) => w.row === lastRow);
      // 计算最后一行的最后一个组件的结束位置（col + span - 1）
      const lastColEnd = Math.max(...lastRowWidgets.map((w) => w.col + w.span - 1));
      // 下一个组件应该从 lastColEnd + 1 开始
      const nextColStart = lastColEnd + 1;
      
      if (nextColStart + nextSpan <= 24) {
        // 当前行还有空间，放在同一行
        nextRow = lastRow;
        nextCol = nextColStart;
      } else {
        // 换到下一行
        nextRow = lastRow + 1;
        nextCol = 0;
      }
    }

    const newWidget: ReportWidget = {
      id,
      type,
      title: getComponentName(type),
      row: nextRow,
      col: nextCol,
      span: nextSpan,
    };
    setWidgets([...widgets, newWidget]);
    setSelectedWidgetId(id);
  };

  // 更新组件配置
  const handleUpdateWidget = (id: string, updates: Partial<ReportWidget>) => {
    setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...updates } : w)));
  };

  // 删除组件
  const handleDeleteWidget = (id: string) => {
    setWidgets((prev) => prev.filter((w) => w.id !== id));
    if (selectedWidgetId === id) {
      setSelectedWidgetId(undefined);
    }
  };

  // 复制组件
  const handleCopyWidget = (id: string) => {
    const widget = widgets.find((w) => w.id === id);
    if (widget) {
      const newId = `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newWidget: ReportWidget = {
        ...widget,
        id: newId,
        row: widget.row + 1,
        col: widget.col,
      };
      setWidgets([...widgets, newWidget]);
      setSelectedWidgetId(newId);
    }
  };

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
                top: chartConfig.legendPosition === "top" ? 0 : undefined,
                left: chartConfig.legendPosition === "left" ? 0 : undefined,
                right: chartConfig.legendPosition === "right" ? 0 : undefined,
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
                top: chartConfig.legendPosition === "top" ? 0 : undefined,
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

  const getComponentName = (type: ComponentType): string => {
    const names: Record<ComponentType, string> = {
      dataTable: "数据表",
      text: "文本控件",
      calendar: "日历",
      pivot: "透视图",
      indicator: "指标",
      gantt: "甘特图",
      image: "图片组件",
      realtime: "实时时间",
      embed: "嵌入页面",
      container: "布局容器",
      column: "柱形图",
      line: "折线图",
      bar: "条形图",
      pie: "饼图",
      area: "面积图",
      radar: "雷达图",
      dualAxis: "双轴图",
      map: "地图",
      funnel: "漏斗图",
      gauge: "仪表盘",
    };
    return names[type] || type;
  };

  // 计算网格布局
  const gridLayout = useMemo(() => {
    const rows: number[] = [];
    widgets.forEach((w) => {
      if (!rows.includes(w.row)) {
        rows.push(w.row);
      }
    });
    rows.sort((a, b) => a - b);
    return rows;
  }, [widgets]);

  return (
    <Layout style={{ height: "100%" }}>
      {/* 左侧：组件库 */}
      <Sider width={280} style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}>
        <div style={{ padding: 16, height: "100%", overflow: "auto" }}>

          {/* 组件库 */}
          <Collapse
            defaultActiveKey={["basic", "charts"]}
            items={[
              {
                key: "basic",
                label: "基础报表",
                children: (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <ComponentButton
                      icon={<TableOutlined />}
                      label="数据表"
                      onClick={() => handleAddComponent("dataTable")}
                    />
                    <ComponentButton
                      icon={<FileTextOutlined />}
                      label="文本控件"
                      onClick={() => handleAddComponent("text")}
                    />
                    <ComponentButton
                      icon={<CalendarOutlined />}
                      label="日历"
                      onClick={() => handleAddComponent("calendar")}
                    />
                    <ComponentButton
                      icon={<AppstoreOutlined />}
                      label="透视图"
                      onClick={() => handleAddComponent("pivot")}
                    />
                    <ComponentButton
                      icon={<NumberOutlined />}
                      label="指标"
                      onClick={() => handleAddComponent("indicator")}
                    />
                    <ComponentButton
                      icon={<PictureOutlined />}
                      label="图片组件"
                      onClick={() => handleAddComponent("image")}
                    />
                    <ComponentButton
                      icon={<ClockCircleOutlined />}
                      label="实时时间"
                      onClick={() => handleAddComponent("realtime")}
                    />
                    <ComponentButton
                      icon={<GlobalOutlined />}
                      label="嵌入页面"
                      onClick={() => handleAddComponent("embed")}
                    />
                    <ComponentButton
                      icon={<ContainerOutlined />}
                      label="布局容器"
                      onClick={() => handleAddComponent("container")}
                    />
                  </div>
                ),
              },
              {
                key: "charts",
                label: "分析图表",
                children: (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <ComponentButton
                      icon={<BarChartOutlined />}
                      label="柱形图"
                      onClick={() => handleAddComponent("column")}
                    />
                    <ComponentButton
                      icon={<LineChartOutlined />}
                      label="折线图"
                      onClick={() => handleAddComponent("line")}
                    />
                    <ComponentButton
                      icon={<BarChartOutlined />}
                      label="条形图"
                      onClick={() => handleAddComponent("bar")}
                    />
                    <ComponentButton
                      icon={<PieChartOutlined />}
                      label="饼图"
                      onClick={() => handleAddComponent("pie")}
                    />
                    <ComponentButton
                      icon={<AreaChartOutlined />}
                      label="面积图"
                      onClick={() => handleAddComponent("area")}
                    />
                    <ComponentButton
                      icon={<RadarChartOutlined />}
                      label="雷达图"
                      onClick={() => handleAddComponent("radar")}
                    />
                    <ComponentButton
                      icon={<DashboardOutlined />}
                      label="仪表盘"
                      onClick={() => handleAddComponent("gauge")}
                    />
                    <ComponentButton
                      icon={<FunnelPlotOutlined />}
                      label="漏斗图"
                      onClick={() => handleAddComponent("funnel")}
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Sider>

      {/* 中间：画布 */}
      <Content
        style={{
          background: "#f5f5f5",
          padding: 24,
          overflow: "auto",
        }}
      >
        {widgets.length === 0 ? (
          <div
            style={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
            }}
          >
            <Empty
              description="从左上角添加控件,进行数据展示和分析。"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event: DragEndEvent) => {
              const { active, over } = event;
              if (!over || active.id === over.id) return;

              // 找到拖拽的组件和目标组件
              const activeWidget = widgets.find((w) => w.id === active.id);
              const overWidget = widgets.find((w) => w.id === over.id);
              if (!activeWidget || !overWidget) return;

              // 交换位置
              const newWidgets = widgets.map((w) => {
                if (w.id === active.id) {
                  return { ...w, row: overWidget.row, col: overWidget.col };
                }
                if (w.id === over.id) {
                  return { ...w, row: activeWidget.row, col: activeWidget.col };
                }
                return w;
              });
              setWidgets(newWidgets);
            }}
          >
            <div>
              {/* 使用网格布局显示组件 */}
              {gridLayout.map((rowIndex) => {
                const rowWidgets = widgets.filter((w) => w.row === rowIndex).sort((a, b) => a.col - b.col);
                return (
                  <ResizableRow
                    key={rowIndex}
                    rowWidgets={rowWidgets}
                    selectedWidgetId={selectedWidgetId}
                    previewDataMap={previewDataMap}
                    previewLoadingMap={previewLoadingMap}
                    onSelect={(id) => setSelectedWidgetId(id)}
                    onEdit={(widget) => {
                      const currentReportId = searchParams.get("reportId") || reportId;
                      const currentAppId = appId || searchParams.get("appId");
                      if (currentAppId && currentReportId && widget.id) {
                        navigate(`/reports/widget/designer?appId=${currentAppId}&reportId=${currentReportId}&widgetId=${widget.id}`);
                      }
                    }}
                    onDelete={handleDeleteWidget}
                    onCopy={handleCopyWidget}
                    onUpdate={handleUpdateWidget}
                    generateChartOption={generateChartOption}
                  />
                );
              })}
            </div>
          </DndContext>
        )}
      </Content>

    </Layout>
  );
};

// 可调整大小的行组件
const ResizableRow = ({
  rowWidgets,
  selectedWidgetId,
  previewDataMap,
  previewLoadingMap,
  onSelect,
  onEdit,
  onDelete,
  onCopy,
  onUpdate,
  generateChartOption,
}: {
  rowWidgets: ReportWidget[];
  selectedWidgetId?: string;
  previewDataMap: Record<string, any>;
  previewLoadingMap: Record<string, boolean>;
  onSelect: (id: string) => void;
  onEdit: (widget: ReportWidget) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ReportWidget>) => void;
  generateChartOption: (widget: ReportWidget, data: any) => any;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 调试日志
  const totalSpan = rowWidgets.reduce((sum, w) => sum + (w.span || 12), 0);
  console.log(`ReportDesignerV2 - 渲染行，组件数量: ${rowWidgets.length}, 总 span: ${totalSpan}`, rowWidgets.map(w => ({ id: w.id, title: w.title, row: w.row, col: w.col, span: w.span })));

  return (
    <div ref={containerRef} style={{ marginBottom: 16 }}>
      <SortableContext items={rowWidgets.map((w) => w.id)} strategy={horizontalListSortingStrategy}>
        <div style={{ display: "flex", gap: 16, flexWrap: "nowrap", position: "relative" }}>
          {rowWidgets.map((widget) => {
            return (
              <SortableWidget
                key={widget.id}
                widget={widget}
                containerWidth={containerWidth}
                rowWidgets={rowWidgets}
                selectedWidgetId={selectedWidgetId}
                previewData={previewDataMap[widget.id]}
                isLoading={previewLoadingMap[widget.id]}
                onSelect={onSelect}
                onEdit={onEdit}
                onDelete={onDelete}
                onCopy={onCopy}
                onUpdate={onUpdate}
                generateChartOption={generateChartOption}
              />
            );
          })}
        </div>
      </SortableContext>
    </div>
  );
};

// 可拖拽和调整大小的组件
const SortableWidget = ({
  widget,
  containerWidth,
  rowWidgets,
  selectedWidgetId,
  previewData,
  isLoading,
  onSelect,
  onEdit,
  onDelete,
  onCopy,
  onUpdate,
  generateChartOption,
}: {
  widget: ReportWidget;
  containerWidth: number;
  rowWidgets: ReportWidget[];
  selectedWidgetId?: string;
  previewData?: any;
  isLoading?: boolean;
  onSelect: (id: string) => void;
  onEdit: (widget: ReportWidget) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string) => void;
  onUpdate: (id: string, updates: Partial<ReportWidget>) => void;
  generateChartOption: (widget: ReportWidget, data: any) => any;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSelected = widget.id === selectedWidgetId;
  
  // 计算当前宽度（像素）
  const totalGap = 16 * (rowWidgets.length - 1);
  const availableWidth = containerWidth - totalGap;
  const currentWidth = availableWidth * (widget.span / 24);
  const minWidth = 300;
  const maxWidth = availableWidth;
  
  // 默认高度和最小高度
  const defaultHeight = widget.height || 400;
  const minHeight = 200;
  const maxHeight = 2000;

  return (
    <div ref={setNodeRef} style={style}>
      <Resizable
        width={currentWidth}
        height={defaultHeight}
        minConstraints={[minWidth, minHeight]}
        maxConstraints={[maxWidth, maxHeight]}
        onResize={(e, data) => {
          // 根据新宽度计算新的 span 值
          const newWidth = data.size.width;
          const newSpan = Math.round((newWidth / availableWidth) * 24);
          // 限制在合理范围内（6-24列，对应一行4个到1个组件）
          const clampedSpan = Math.max(6, Math.min(24, newSpan));
          const updates: Partial<ReportWidget> = {};
          if (clampedSpan !== widget.span) {
            updates.span = clampedSpan;
          }
          if (data.size.height !== widget.height) {
            updates.height = data.size.height;
          }
          if (Object.keys(updates).length > 0) {
            onUpdate(widget.id, updates);
          }
        }}
        resizeHandles={["e", "s", "se"]}
      >
        <div
          style={{
            width: currentWidth,
            height: defaultHeight,
            minWidth: minWidth,
            minHeight: minHeight,
            position: "relative",
          }}
        >
          <ReportWidgetCard
            widget={widget}
            isSelected={isSelected}
            isEditing={false}
            previewData={previewData}
            isLoading={isLoading}
            dragAttributes={attributes}
            dragListeners={listeners}
            onSelect={() => onSelect(widget.id)}
            onEdit={() => onEdit(widget)}
            onDelete={() => onDelete(widget.id)}
            onCopy={() => onCopy(widget.id)}
            onUpdate={(updates) => onUpdate(widget.id, updates)}
            generateChartOption={generateChartOption}
          />
        </div>
      </Resizable>
    </div>
  );
};

// 报表组件卡片
const ReportWidgetCard = ({
  widget,
  isSelected,
  isEditing,
  previewData,
  isLoading,
  formFields,
  dragAttributes,
  dragListeners,
  onSelect,
  onEdit,
  onDelete,
  onCopy,
  onUpdate,
  generateChartOption,
}: {
  widget: ReportWidget;
  isSelected: boolean;
  isEditing: boolean;
  previewData: any;
  isLoading: boolean;
  dragAttributes?: any;
  dragListeners?: any;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onUpdate: (updates: Partial<ReportWidget>) => void;
  generateChartOption: (widget: ReportWidget, data: any) => any;
}) => {
  const chartOption = previewData?.type === "chart" ? generateChartOption(widget, previewData) : null;

  return (
    <Card
      size="small"
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Text 
            strong 
            {...dragAttributes}
            {...dragListeners}
            style={{ cursor: "move", userSelect: "none" }}
          >
            {widget.title}
          </Text>
          <Space size={4}>
            <Tooltip title="编辑">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  console.log("编辑按钮被点击");
                  onEdit();
                }}
              />
            </Tooltip>
            <Tooltip title="复制">
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onCopy();
                }}
              />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              />
            </Tooltip>
          </Space>
        </div>
      }
      extra={
        <Space size={4}>
          <Tooltip title="刷新">
            <Button type="text" size="small" icon={<ReloadOutlined />} />
          </Tooltip>
          <Tooltip title="下载">
            <Button type="text" size="small" icon={<DownloadOutlined />} />
          </Tooltip>
          <Tooltip title="全屏">
            <Button type="text" size="small" icon={<FullscreenOutlined />} />
          </Tooltip>
        </Space>
      }
      style={{
        border: isEditing ? "2px solid #1890ff" : isSelected ? "1px solid #1890ff" : "1px solid #d9d9d9",
        cursor: "pointer",
        height: "100%",
      }}
      onClick={(e) => {
        // 如果点击的是按钮或按钮内的元素，不触发选择
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('.ant-btn') || target.closest('.anticon')) {
          return;
        }
        onSelect();
      }}
    >
      {isLoading ? (
        <div style={{ height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Spin />
        </div>
      ) : widget.type === "realtime" ? (
        <RealtimeTimeDisplay format={widget.realtimeConfig?.format || "YYYY-MM-DD HH:mm:ss dddd"} />
      ) : widget.type === "realtime" ? (
        <RealtimeTimeDisplay format={widget.realtimeConfig?.format || "YYYY-MM-DD HH:mm:ss dddd"} />
      ) : widget.type === "dataTable" ? (
        <div>
          {previewData?.type === "table" && previewData.data ? (
            <>
              <Table
                size="small"
                dataSource={previewData.data}
                columns={previewData.fields.map((field: any) => ({
                  title: field.label || field.fieldName,
                  dataIndex: field.fieldId,
                  key: field.fieldId,
                  sorter: true,
                }))}
                pagination={{
                  pageSize: widget.tableConfig?.pageSize || 20,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
              />
            </>
          ) : (
            <div
              style={{
                height: 300,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
              }}
            >
              <Text type="secondary">拖入字段来添加数据</Text>
            </div>
          )}
        </div>
      ) : chartOption ? (
        <ReactECharts
          option={chartOption}
          style={{ height: 300, width: "100%" }}
          opts={{ renderer: "svg" }}
        />
      ) : (
        <div
          style={{
            height: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#999",
          }}
        >
          <Text type="secondary">拖入字段来添加数据</Text>
        </div>
      )}
    </Card>
  );
};

// 组件属性面板
const WidgetPropertiesPanel = ({
  widget,
  forms,
  formFieldsCache,
  loadFormFields,
  onUpdate,
  onClose,
}: {
  widget: ReportWidget;
  forms: any[];
  formFieldsCache: Record<string, any[]>;
  loadFormFields: (formId: string) => Promise<any[]>;
  onUpdate: (updates: Partial<ReportWidget>) => void;
  onClose?: () => void;
}) => {
  const [formFields, setFormFields] = useState<any[]>([]);
  const selectedFormId = widget.dataSource?.formId;

  // 当组件的数据源变化时，加载对应的字段
  useEffect(() => {
    if (selectedFormId) {
      if (formFieldsCache[selectedFormId]) {
        setFormFields(formFieldsCache[selectedFormId]);
      } else {
        loadFormFields(selectedFormId).then((fields) => {
          setFormFields(fields);
        });
      }
    } else {
      setFormFields([]);
    }
  }, [selectedFormId, formFieldsCache, loadFormFields]);
  const getComponentTypeName = (type: ComponentType): string => {
    const names: Record<ComponentType, string> = {
      dataTable: "数据表",
      text: "文本控件",
      calendar: "日历",
      pivot: "透视图",
      indicator: "指标",
      gantt: "甘特图",
      image: "图片组件",
      realtime: "实时时间",
      embed: "嵌入页面",
      container: "布局容器",
      column: "柱形图",
      line: "折线图",
      bar: "条形图",
      pie: "饼图",
      area: "面积图",
      radar: "雷达图",
      dualAxis: "双轴图",
      map: "地图",
      funnel: "漏斗图",
      gauge: "仪表盘",
    };
    return names[type] || type;
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>组件配置</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {getComponentTypeName(widget.type)}
          </Text>
        </div>
        {onClose && (
          <Button type="text" size="small" onClick={onClose}>
            关闭
          </Button>
        )}
      </div>
      <Form layout="vertical" size="small">
        <Form.Item label="组件标题">
          <Input
            value={widget.title}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="请输入组件标题"
          />
        </Form.Item>

        <Form.Item label="布局">
          <Space>
            <div>
              <Text style={{ fontSize: 12 }}>占据列数</Text>
              <Select
                style={{ width: 100, marginTop: 4 }}
                value={widget.span}
                onChange={(value) => onUpdate({ span: value })}
              >
                {[6, 8, 12, 16, 24].map((s) => (
                  <Option key={s} value={s}>
                    {s}列
                  </Option>
                ))}
              </Select>
            </div>
          </Space>
        </Form.Item>

        {/* 图表类型组件的配置 */}
        {["column", "line", "bar", "pie", "area", "radar", "funnel", "gauge"].includes(widget.type) && (
          <>
            <Divider orientation="left">数据配置</Divider>
            <Form.Item label="数据源">
              <Select
                placeholder="请选择数据源"
                value={widget.dataSource?.formId}
                onChange={async (value) => {
                  // 加载字段
                  await loadFormFields(value);
                  onUpdate({
                    dataSource: {
                      ...widget.dataSource,
                      formId: value,
                      dimension: undefined, // 清空维度
                      metric: undefined, // 清空指标
                    },
                  });
                }}
                style={{ width: "100%" }}
              >
                {forms.map((form) => (
                  <Option key={form.id} value={form.id}>
                    {form.formName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            {selectedFormId && formFields.length > 0 ? (
              <>
                <Form.Item label="维度">
                  <Select
                    placeholder="拖动左侧字段到此处来添加维度"
                    value={widget.dataSource?.dimension}
                    onChange={(value) =>
                      onUpdate({
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
                </Form.Item>
                <Form.Item label="指标">
                  <Select
                    placeholder="拖动左侧字段到此处来添加指标"
                    value={widget.dataSource?.metric}
                    onChange={(value) =>
                      onUpdate({
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
                </Form.Item>
                <Form.Item label="聚合方式">
                  <Select
                    value={widget.dataSource?.aggregation || "sum"}
                    onChange={(value) =>
                      onUpdate({
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
                </Form.Item>
              </>
            ) : (
              <Alert
                message="请先添加数据源"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Divider orientation="left">图表配置</Divider>
            {widget.type === "pie" && (
              <>
                <Form.Item label="饼图类型">
                  <Radio.Group
                    value={widget.chartConfig?.pieChartType || "pie"}
                    onChange={(e) =>
                      onUpdate({
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
                  <Space direction="vertical">
                    <Checkbox
                      checked={widget.chartConfig?.showDataLabel}
                      onChange={(e) =>
                        onUpdate({
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
                        onUpdate({
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
                        onUpdate({
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
                        onUpdate({
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
                        onUpdate({
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
                          onUpdate({
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
                <Form.Item label="柱形图类型">
                  <Radio.Group>
                    <Radio.Button value="column">
                      <BarChartOutlined /> 柱形图
                    </Radio.Button>
                    <Radio.Button value="pie">
                      <PieChartOutlined /> 饼图
                    </Radio.Button>
                  </Radio.Group>
                </Form.Item>
                <Form.Item label="坐标X轴">
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <div>
                      <Text style={{ fontSize: 12 }}>标签文字显示方向</Text>
                      <Select
                        style={{ width: "100%", marginTop: 4 }}
                        value={widget.chartConfig?.xAxisLabelDirection || "horizontal"}
                        onChange={(value) =>
                          onUpdate({
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
                        onUpdate({
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
                          onUpdate({
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
                          onUpdate({
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
                          onUpdate({
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
                      onUpdate({
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
            <Divider orientation="left">数据配置</Divider>
            <Form.Item label="数据源">
              <Select
                placeholder="请选择数据源"
                value={widget.dataSource?.formId}
                onChange={async (value) => {
                  // 加载字段
                  await loadFormFields(value);
                  onUpdate({
                    dataSource: {
                      ...widget.dataSource,
                      formId: value,
                      displayFields: [], // 清空显示字段
                    },
                  });
                }}
                style={{ width: "100%" }}
              >
                {forms.map((form) => (
                  <Option key={form.id} value={form.id}>
                    {form.formName}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            {selectedFormId && formFields.length > 0 ? (
              <Form.Item label="显示字段">
                <Select
                  mode="multiple"
                  placeholder="选择要显示的字段"
                  value={widget.dataSource?.displayFields || []}
                    onChange={(value) =>
                      onUpdate({
                        dataSource: {
                          ...widget.dataSource,
                          displayFields: value,
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
              </Form.Item>
            ) : (
              <Alert
                message="请先添加数据源"
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            <Divider orientation="left">表格配置</Divider>
            <Form.Item>
              <Checkbox
                checked={widget.tableConfig?.showSerialNumber}
                onChange={(e) =>
                  onUpdate({
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
              <Checkbox
                checked={widget.tableConfig?.showCheckbox}
                onChange={(e) =>
                  onUpdate({
                    tableConfig: {
                      ...widget.tableConfig,
                      showCheckbox: e.target.checked,
                    },
                  })
                }
              >
                显示复选框
              </Checkbox>
            </Form.Item>
            <Form.Item label="每页条数">
              <InputNumber
                value={widget.tableConfig?.pageSize || 20}
                onChange={(value) =>
                  onUpdate({
                    tableConfig: {
                      ...widget.tableConfig,
                      pageSize: value || 20,
                    },
                  })
                }
                min={10}
                max={100}
              />
            </Form.Item>
          </>
        )}

        {/* 实时时间类型组件的配置 */}
        {widget.type === "realtime" && (
          <>
            <Divider orientation="left">时间格式配置</Divider>
            <Form.Item label="时间格式">
              <Select
                value={widget.realtimeConfig?.format || "YYYY-MM-DD HH:mm:ss dddd"}
                onChange={(value) =>
                  onUpdate({
                    realtimeConfig: {
                      ...widget.realtimeConfig,
                      format: value,
                    },
                  })
                }
                style={{ width: "100%" }}
              >
                <Option value="YYYY-MM-DD">2024-07-19</Option>
                <Option value="YYYY-MM-DD HH:mm:ss">2024-07-19 08:08:08</Option>
                <Option value="YYYY-MM-DD HH:mm:ss dddd">2024-07-19 08:08:08 星期五</Option>
                <Option value="YYYY/MM/DD">2024/07/19</Option>
                <Option value="YYYY/MM/DD HH:mm:ss">2024/07/19 08:08:08</Option>
                <Option value="YYYY/MM/DD HH:mm:ss dddd">2024/07/19 08:08:08 星期五</Option>
                <Option value="YYYY年MM月DD日">2024年07月19日</Option>
                <Option value="YYYY年MM月DD日 HH时mm分ss秒">2024年07月19日 08时08分08秒</Option>
                <Option value="YYYY年MM月DD日 HH时mm分ss秒 dddd">2024年07月19日 08时08分08秒 星期五</Option>
                <Option value="dddd">星期五</Option>
                <Option value="HH:mm:ss">08:08:08</Option>
              </Select>
            </Form.Item>
          </>
        )}
      </Form>
    </div>
  );
};

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

// 组件按钮
const ComponentButton = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => {
  return (
    <Button
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        height: "auto",
        padding: "12px 8px",
      }}
      onClick={onClick}
    >
      <div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 12 }}>{label}</div>
    </Button>
  );
};
