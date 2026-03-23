import React, { useState, useEffect, useMemo, useCallback, useImperativeHandle, useRef } from "react";
import { Layout, Button, Space, Typography, Input, Select, Tabs, Form, Switch, InputNumber, ColorPicker, Collapse, Tooltip, Divider, Spin, Table } from "antd";
import {
  DeleteOutlined,
  CopyOutlined,
  BarChartOutlined,
  LineChartOutlined,
  PieChartOutlined,
  DotChartOutlined,
  RadarChartOutlined,
  HeatMapOutlined,
  FundProjectionScreenOutlined,
  TableOutlined,
  DashboardOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignBottomOutlined,
  BorderOutlined,
  AppstoreOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  CompressOutlined,
} from "@ant-design/icons";
import { DndContext, useDraggable, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";
import ReactECharts from "echarts-for-react";
import {
  FullScreenContainer,
  BorderBox1,
  BorderBox2,
  BorderBox3,
  BorderBox4,
  BorderBox5,
  BorderBox6,
  BorderBox7,
  BorderBox8,
  BorderBox9,
  BorderBox10,
  BorderBox11,
  BorderBox12,
  BorderBox13,
  Decoration1,
  Decoration2,
  Decoration3,
  Decoration4,
  Decoration5,
  Decoration6,
  Decoration7,
  Decoration8,
  Decoration9,
  Decoration10,
  ScrollBoard,
  FlylineChart,
  WaterLevelPond,
  DigitalFlop,
  ScrollRankingBoard,
  CapsuleChart,
  ActiveRingChart,
  ConicalColumnChart,
  PercentPond,
} from "@jiaminghi/data-view-react";
import { formDefinitionApi } from "@/api/formDefinition";
import { formDataApi } from "@/api/formData";
import { EChartsOptionEditor } from "./components/EChartsOptionEditor";
import { message } from "antd";
import type { EChartsOption } from "echarts";

const { Sider, Content } = Layout;
const { Option } = Select;
const { Panel } = Collapse;

// 图表类型定义
export type ChartType =
  | "line"
  | "bar"
  | "pie"
  | "scatter"
  | "radar"
  | "tree"
  | "treemap"
  | "sunburst"
  | "boxplot"
  | "candlestick"
  | "heatmap"
  | "map"
  | "parallel"
  | "sankey"
  | "funnel"
  | "gauge"
  | "pictorialBar"
  | "themeRiver"
  | "calendar"
  | "graph"
  | "liquidFill"
  | "wordCloud"
  | "text"
  | "image";

// 装饰组件类型
export type DecorationType =
  | "borderBox1"
  | "borderBox2"
  | "borderBox3"
  | "borderBox4"
  | "borderBox5"
  | "borderBox6"
  | "borderBox7"
  | "borderBox8"
  | "borderBox9"
  | "borderBox10"
  | "borderBox11"
  | "borderBox12"
  | "borderBox13"
  | "decoration1"
  | "decoration2"
  | "decoration3"
  | "decoration4"
  | "decoration5"
  | "decoration6"
  | "decoration7"
  | "decoration8"
  | "decoration9"
  | "decoration10";

// DataV 组件类型
export type DataVComponentType = 
  | "scrollBoard"      // 轮播表
  | "flylineChart"     // 飞线图
  | "waterLevelPond"   // 水位图
  | "digitalFlop"      // 数字翻牌器
  | "scrollRankingBoard" // 滚动排名表
  | "capsuleChart"     // 胶囊图
  | "activeRingChart"  // 活跃环图
  | "conicalColumnChart" // 锥形柱图
  | "percentPond";     // 百分比池

// 组件配置接口
export interface ComponentConfig {
  id: string;
  type: "chart" | "decoration" | "text" | "image" | "table" | DataVComponentType;
  chartType?: ChartType;
  decorationType?: DecorationType;
  dataVType?: DataVComponentType; // DataV 组件类型
  title?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  // 图表配置
  echartsOption?: EChartsOption;
  // 数据源配置
  dataSource?: {
    formId?: string;
    xFieldId?: string;
    yFieldId?: string;
    aggregation?: "sum" | "avg" | "count" | "max" | "min";
    // DataV 组件数据配置
    dataVData?: any; // DataV 组件的原始数据
  };
  // 样式配置
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
    borderRadius?: number;
    padding?: number;
  };
  // 边框装饰配置
  borderType?: DecorationType; // 使用的边框类型
  // 文本内容
  text?: string;
  textStyle?: {
    fontSize?: number;
    color?: string;
    fontWeight?: string;
    textAlign?: "left" | "center" | "right";
  };
  // 实时时间组件
  timeFormat?: string; // 时间格式，例如 YYYY-MM-DD HH:mm:ss
  // 图片URL
  imageUrl?: string;
}

interface DataVDesignerProps {
  appId?: string;
  initialConfig?: any | null;
  onConfigChange?: (config: any) => void;
}

export interface DataVDesignerRef {
  getCurrentConfig: () => { screenName: string; components: ComponentConfig[] };
}

// 图表类型选项
const chartTypeOptions: Array<{ value: ChartType; label: string; icon: React.ReactNode }> = [
  { value: "line", label: "折线图", icon: <LineChartOutlined /> },
  { value: "bar", label: "柱状图", icon: <BarChartOutlined /> },
  { value: "pie", label: "饼图", icon: <PieChartOutlined /> },
  { value: "scatter", label: "散点图", icon: <DotChartOutlined /> },
  { value: "radar", label: "雷达图", icon: <RadarChartOutlined /> },
  { value: "heatmap", label: "热力图", icon: <HeatMapOutlined /> },
  { value: "funnel", label: "漏斗图", icon: <FundProjectionScreenOutlined /> },
  { value: "gauge", label: "仪表盘", icon: <DashboardOutlined /> },
];

// 数据组件选项（表格、指标卡等）
const dataComponentOptions: Array<{ type: string; label: string; icon: React.ReactNode }> = [
  { type: "table", label: "表格", icon: <TableOutlined /> },
  { type: "scrollBoard", label: "滚动表格", icon: <TableOutlined /> },
  { type: "scrollRankingBoard", label: "排名榜", icon: <BarChartOutlined /> },
  { type: "digitalFlop", label: "指标卡", icon: <DashboardOutlined /> },
  { type: "percentPond", label: "进度池", icon: <DashboardOutlined /> },
  { type: "waterLevelPond", label: "水位图", icon: <DashboardOutlined /> },
  { type: "capsuleChart", label: "胶囊图", icon: <BarChartOutlined /> },
  { type: "activeRingChart", label: "环形图", icon: <PieChartOutlined /> },
  { type: "conicalColumnChart", label: "锥形柱图", icon: <BarChartOutlined /> },
];

// 装饰组件选项
const decorationOptions: Array<{ value: DecorationType; label: string }> = [
  { value: "borderBox1", label: "边框1" },
  { value: "borderBox2", label: "边框2" },
  { value: "borderBox3", label: "边框3" },
  { value: "borderBox4", label: "边框4" },
  { value: "borderBox5", label: "边框5" },
  { value: "borderBox6", label: "边框6" },
  { value: "borderBox7", label: "边框7" },
  { value: "borderBox8", label: "边框8" },
  { value: "borderBox9", label: "边框9" },
  { value: "borderBox10", label: "边框10" },
  { value: "borderBox11", label: "边框11" },
  { value: "borderBox12", label: "边框12" },
  { value: "borderBox13", label: "边框13" },
  { value: "decoration1", label: "装饰1" },
  { value: "decoration2", label: "装饰2" },
  { value: "decoration3", label: "装饰3" },
  { value: "decoration4", label: "装饰4" },
  { value: "decoration5", label: "装饰5" },
  { value: "decoration6", label: "装饰6" },
  { value: "decoration7", label: "装饰7" },
  { value: "decoration8", label: "装饰8" },
  { value: "decoration9", label: "装饰9" },
  { value: "decoration10", label: "装饰10" },
];

// 获取默认 ECharts 配置（移到组件外部，供 DraggableComponent 使用）
const getDefaultEChartsOption = (type: ChartType): EChartsOption => {
  const baseOption: EChartsOption = {
    title: { text: "示例图表", left: "center" },
    tooltip: { trigger: "axis" },
  };

  switch (type) {
    case "line":
      return {
        ...baseOption,
        xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
        yAxis: { type: "value" },
        series: [{ type: "line", data: [120, 132, 101, 134, 90, 230, 210] }],
      };
    case "bar":
      return {
        ...baseOption,
        xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: [120, 132, 101, 134, 90, 230, 210] }],
      };
    case "pie":
      return {
        ...baseOption,
        tooltip: { trigger: "item" },
        legend: { bottom: 0 },
        series: [
          {
            type: "pie",
            radius: "60%",
            data: [
              { value: 1048, name: "搜索引擎" },
              { value: 735, name: "直接访问" },
              { value: 580, name: "邮件营销" },
              { value: 484, name: "联盟广告" },
              { value: 300, name: "视频广告" },
            ],
          },
        ],
      };
    case "scatter":
      return {
        ...baseOption,
        tooltip: { trigger: "item" },
        xAxis: { type: "value" },
        yAxis: { type: "value" },
        series: [
          {
            type: "scatter",
            data: [
              [10.0, 8.04],
              [8.07, 6.95],
              [13.0, 7.58],
              [9.05, 8.81],
              [11.0, 8.33],
            ],
          },
        ],
      };
    case "radar":
      return {
        ...baseOption,
        radar: {
          indicator: [
            { name: "销售", max: 6500 },
            { name: "管理", max: 16000 },
            { name: "信息技术", max: 30000 },
            { name: "客服", max: 38000 },
            { name: "研发", max: 52000 },
            { name: "市场", max: 25000 },
          ],
        },
        series: [
          {
            type: "radar",
            data: [
              {
                value: [4200, 3000, 20000, 35000, 50000, 18000],
                name: "预算分配",
              },
            ],
          },
        ],
      };
    case "heatmap":
      return {
        ...baseOption,
        tooltip: { position: "top" },
        grid: { height: "50%", top: "10%" },
        xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
        yAxis: { type: "category", data: ["Morning", "Afternoon", "Evening"] },
        visualMap: {
          min: 0,
          max: 10,
          calculable: true,
          orient: "horizontal",
          left: "center",
          bottom: "15%",
        },
        series: [
          {
            type: "heatmap",
            data: [
              [0, 0, 5],
              [0, 1, 1],
              [0, 2, 0],
              [1, 0, 0],
              [1, 1, 0],
              [1, 2, 2],
            ],
          },
        ],
      };
    case "funnel":
      return {
        ...baseOption,
        tooltip: { trigger: "item", formatter: "{a} <br/>{b} : {c}%" },
        series: [
          {
            type: "funnel",
            data: [
              { value: 60, name: "访问" },
              { value: 40, name: "咨询" },
              { value: 20, name: "订单" },
              { value: 80, name: "点击" },
              { value: 100, name: "展现" },
            ],
          },
        ],
      };
    case "gauge":
      return {
        ...baseOption,
        series: [
          {
            type: "gauge",
            data: [{ value: 50, name: "完成率" }],
          },
        ],
      };
    default:
      return baseOption;
  }
};

// 获取 DataV 组件的默认数据（移到组件外部）
const getDefaultDataVData = (type: DataVComponentType): any => {
  switch (type) {
    case "scrollBoard":
      return {
        header: ["名称", "数值", "状态"],
        data: [
          ["数据1", "100", "正常"],
          ["数据2", "200", "正常"],
          ["数据3", "150", "警告"],
        ],
        rowNum: 5,
      };
    case "digitalFlop":
      return {
        number: [100],
        content: "{nt}",
      };
    case "waterLevelPond":
      return {
        shape: "roundRect",
        percent: 0.5,
      };
    case "scrollRankingBoard":
      return {
        data: [
          { name: "项目1", value: 100 },
          { name: "项目2", value: 200 },
          { name: "项目3", value: 150 },
        ],
      };
    case "capsuleChart":
      return {
        data: [
          { name: "项目1", value: 100 },
          { name: "项目2", value: 200 },
          { name: "项目3", value: 150 },
        ],
      };
    case "activeRingChart":
      return {
        data: [
          { name: "项目1", value: 100 },
          { name: "项目2", value: 200 },
          { name: "项目3", value: 150 },
        ],
      };
    case "conicalColumnChart":
      return {
        data: [
          { name: "项目1", value: 100 },
          { name: "项目2", value: 200 },
          { name: "项目3", value: 150 },
        ],
      };
    case "percentPond":
      return {
        value: 0.5,
      };
    default:
      return {};
  }
};

// 将表单数据转换为 DataV 组件需要的格式（移到组件外部）
export const convertToDataVData = (type: DataVComponentType, rows: any[], dataSource: any, formFields?: any[]): any => {
  if (!rows || rows.length === 0) {
    return getDefaultDataVData(type);
  }

  const { nameFieldId, valueFieldId, fieldIds, aggregation, max, rowNum, limit, content, shape } = dataSource || {};

  switch (type) {
    case "scrollBoard": {
      // 滚动表格：支持多字段选择
      let selectedFieldIds: string[] = [];
      
      // 优先使用 fieldIds（多选字段），如果没有则使用 nameFieldId 和 valueFieldId（兼容旧配置）
      if (fieldIds && Array.isArray(fieldIds) && fieldIds.length > 0) {
        selectedFieldIds = fieldIds;
      } else if (nameFieldId && valueFieldId) {
        selectedFieldIds = [nameFieldId, valueFieldId];
      } else if (nameFieldId) {
        selectedFieldIds = [nameFieldId];
      } else if (valueFieldId) {
        selectedFieldIds = [valueFieldId];
      }
      
      // 如果没有选择字段，使用所有可用字段
      if (selectedFieldIds.length === 0 && formFields && formFields.length > 0) {
        selectedFieldIds = formFields.slice(0, 5).map(f => f.fieldId); // 默认显示前5个字段
      }
      
      // 生成表头
      const header = selectedFieldIds.map(fieldId => {
        const field = formFields?.find(f => f.fieldId === fieldId);
        // 尝试多种可能的字段名称属性
        const fieldName = field?.label || field?.fieldName || field?.name || field?.title || fieldId;
        console.log("【表头生成】字段ID:", fieldId, "字段对象:", field, "字段名称:", fieldName);
        return fieldName || "列";
      });
      
      // 如果没有字段，使用默认表头
      if (header.length === 0) {
        header.push("名称", "数值");
        selectedFieldIds = ["name", "value"]; // 占位符
      }
      
      // 生成数据行
      const data = rows.slice(0, rowNum || 10).map((row: any) => {
        const rowData = row.data || {};
        return selectedFieldIds.map(fieldId => {
          const value = rowData[fieldId];
          return value !== null && value !== undefined ? String(value) : "";
        });
      });
      
      return { header, data, rowNum: rowNum || 5 };
    }

    case "digitalFlop": {
      // 指标卡：需要 number 数组和 content 格式
      const values = rows.map((row: any) => {
        const rowData = row.data || {};
        return Number(rowData[valueFieldId] ?? 0);
      });
      
      let number: number[];
      if (aggregation === "sum") {
        number = [values.reduce((a, b) => a + b, 0)];
      } else if (aggregation === "avg") {
        number = [values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0];
      } else if (aggregation === "count") {
        number = [values.length];
      } else if (aggregation === "max") {
        number = [values.length > 0 ? Math.max(...values) : 0];
      } else if (aggregation === "min") {
        number = [values.length > 0 ? Math.min(...values) : 0];
      } else {
        number = [values.reduce((a, b) => a + b, 0)];
      }
      
      return { number, content: content || "{nt}" };
    }

    case "scrollRankingBoard": {
      // 排名榜：需要 { name, value } 数组
      const data = rows
        .map((row: any) => {
          const rowData = row.data || {};
          return {
            name: String(rowData[nameFieldId] ?? ""),
            value: Number(rowData[valueFieldId] ?? 0),
          };
        })
        .filter(item => item.name && !isNaN(item.value))
        .sort((a, b) => b.value - a.value)
        .slice(0, rowNum || 5);
      
      return { data };
    }

    case "capsuleChart":
    case "activeRingChart":
    case "conicalColumnChart": {
      // 胶囊图、环形图、锥形柱图：需要 { name, value } 数组
      const data = rows
        .map((row: any) => {
          const rowData = row.data || {};
          return {
            name: String(rowData[nameFieldId] ?? ""),
            value: Number(rowData[valueFieldId] ?? 0),
          };
        })
        .filter(item => item.name && !isNaN(item.value))
        .slice(0, limit || 10);
      
      return { data };
    }

    case "percentPond": {
      // 进度池：需要 value (0-1 之间的百分比)
      const values = rows.map((row: any) => {
        const rowData = row.data || {};
        return Number(rowData[valueFieldId] ?? 0);
      });
      
      const total = values.reduce((a, b) => a + b, 0);
      const maxValue = max || total || 1;
      const value = Math.min(total / maxValue, 1);
      
      return { value };
    }

    case "waterLevelPond": {
      // 水位图：需要 shape 和 percent (0-1 之间的百分比)
      const values = rows.map((row: any) => {
        const rowData = row.data || {};
        return Number(rowData[valueFieldId] ?? 0);
      });
      
      const total = values.reduce((a, b) => a + b, 0);
      const maxValue = max || total || 1;
      const percent = Math.min(total / maxValue, 1);
      
      return { shape: shape || "roundRect", percent };
    }

    default:
      return getDefaultDataVData(type);
  }
};

export const DataVDesigner = React.forwardRef<DataVDesignerRef, DataVDesignerProps>(({ appId, initialConfig, onConfigChange }, ref) => {
  const [screenName, setScreenName] = useState<string>(initialConfig?.screenName || "数据大屏");
  const [components, setComponents] = useState<ComponentConfig[]>(() => initialConfig?.components || []);
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set());
  const [forms, setForms] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"components" | "properties">("components");
  const [canvasScale, setCanvasScale] = useState<number>(1); // 画布缩放比例

  // 当 initialConfig 变化时，更新组件状态（重要：确保刷新后能正确加载）
  useEffect(() => {
    if (initialConfig) {
      console.log("【DataVDesigner】initialConfig 更新:", {
        screenName: initialConfig.screenName,
        componentsCount: initialConfig.components?.length || 0,
        componentIds: initialConfig.components?.map((c: any) => c.id) || [],
      });
      
      if (initialConfig.screenName && initialConfig.screenName !== screenName) {
        setScreenName(initialConfig.screenName);
      }
      
      if (initialConfig.components && Array.isArray(initialConfig.components) && initialConfig.components.length > 0) {
        // 只有当组件数量不同时才更新，避免覆盖用户正在编辑的内容
        if (components.length !== initialConfig.components.length) {
          console.log("【DataVDesigner】更新组件列表，从", components.length, "到", initialConfig.components.length);
          setComponents(initialConfig.components);
        } else {
          // 如果数量相同，检查是否有组件ID不匹配（说明是新的配置）
          const currentIds = new Set(components.map(c => c.id));
          const newIds = new Set(initialConfig.components.map((c: any) => c.id));
          const idsMatch = currentIds.size === newIds.size && 
            Array.from(currentIds).every(id => newIds.has(id));
          
          if (!idsMatch) {
            console.log("【DataVDesigner】组件ID不匹配，更新组件列表");
            setComponents(initialConfig.components);
          }
        }
      } else if (initialConfig.components && Array.isArray(initialConfig.components) && initialConfig.components.length === 0) {
        // 如果新配置是空数组，且当前有组件，说明可能是清空了，需要更新
        if (components.length > 0) {
          console.log("【DataVDesigner】新配置为空，清空组件列表");
          setComponents([]);
        }
      }
    } else if (initialConfig === null && components.length > 0) {
      // 如果 initialConfig 变为 null，且当前有组件，可能是切换了大屏，清空组件
      console.log("【DataVDesigner】initialConfig 为 null，清空组件列表");
      setComponents([]);
      setScreenName("数据大屏");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConfig?.screenId, initialConfig?.components?.length, initialConfig?.components?.map((c: any) => c.id).join(',')]);

  // 获取选中的组件（用于属性面板显示）
  const selectedComponents = components.filter((c) => selectedComponentIds.has(c.id));
  const selectedComponent = selectedComponents.length === 1 ? selectedComponents[0] : undefined;

  // 加载表单列表
  useEffect(() => {
    if (!appId) return;
    formDefinitionApi
      .getListByApplication(appId)
      .then((list) => setForms(list || []))
      .catch((e) => console.error("加载表单失败:", e));
  }, [appId]);

  // 暴露 getCurrentConfig 方法给父组件
  useImperativeHandle(ref, () => ({
    getCurrentConfig: () => ({
      screenName,
      components,
    }),
  }));

  // 同步配置变化 - 使用防抖优化性能，移除 onConfigChange 依赖避免死循环
  useEffect(() => {
    if (!onConfigChange) return;
    const timer = setTimeout(() => {
      onConfigChange({
        screenName,
        components,
      });
    }, 300); // 防抖 300ms
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screenName, components]); // 移除 onConfigChange 依赖

  // 添加组件
  const handleAddComponent = (type: ComponentConfig["type"], chartType?: ChartType, decorationType?: DecorationType) => {
    const newComponent: ComponentConfig = {
      id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      chartType,
      decorationType,
      dataVType: type as DataVComponentType,
      x: 100,
      y: 100,
      width: type === "text" ? 300 : type === "digitalFlop" ? 260 : 400,
      height: type === "text" ? 60 : type === "digitalFlop" ? 120 : 300,
      zIndex: components.length,
      title: chartType ? `${chartTypeOptions.find((c) => c.value === chartType)?.label || chartType}` : 
            (type === "scrollBoard" ? "轮播表" :
             type === "digitalFlop" ? "数字翻牌器" :
             type === "waterLevelPond" ? "水位图" :
             type === "scrollRankingBoard" ? "滚动排名表" :
             type === "capsuleChart" ? "胶囊图" :
             type === "activeRingChart" ? "活跃环图" :
             type === "conicalColumnChart" ? "锥形柱图" :
             type === "percentPond" ? "百分比池" :
             type === "datetime" ? "当前时间" : "新组件"),
      echartsOption: chartType ? getDefaultEChartsOption(chartType) : undefined,
      style:
        type === "decoration"
          ? {
              // 装饰组件默认完全透明，不要白色底和内边距
              backgroundColor: "transparent",
              borderColor: "transparent",
              borderWidth: 0,
              borderRadius: 0,
              padding: 0,
            }
          : type === "text"
          ? {
              // 文本组件默认透明背景，只显示文字
              backgroundColor: "transparent",
              borderColor: "transparent",
              borderWidth: 0,
              borderRadius: 0,
              padding: 0,
            }
          : type === "datetime"
          ? {
              // 实时时间组件默认透明背景，只显示时间
              backgroundColor: "transparent",
              borderColor: "transparent",
              borderWidth: 0,
              borderRadius: 0,
              padding: 0,
            }
          : {
              backgroundColor: "#fff",
              borderColor: "#e8e8e8",
              borderWidth: 1,
              borderRadius: 4,
              padding: 12,
            },
      // 为 DataV 组件设置默认数据
      dataSource: (type === "scrollBoard" || type === "digitalFlop" || type === "waterLevelPond" || 
                   type === "scrollRankingBoard" || type === "capsuleChart" || type === "activeRingChart" ||
                   type === "conicalColumnChart" || type === "percentPond") ? {
        dataVData: getDefaultDataVData(type as DataVComponentType),
      } : undefined,
      // 默认时间格式
      timeFormat: type === "datetime" ? "YYYY-MM-DD HH:mm:ss" : undefined,
    };
    setComponents([...components, newComponent]);
    setSelectedComponentIds(new Set([newComponent.id]));
  };


  // 删除组件（支持批量删除）
  const handleDeleteComponent = (id: string) => {
    // 如果删除的是选中的组件，删除所有选中的组件
    if (selectedComponentIds.has(id) && selectedComponentIds.size > 1) {
      const idsToDelete = Array.from(selectedComponentIds);
      setComponents(components.filter((c) => !selectedComponentIds.has(c.id)));
      setSelectedComponentIds(new Set());
    } else {
      // 单个删除
    setComponents(components.filter((c) => c.id !== id));
      const newSelected = new Set(selectedComponentIds);
      newSelected.delete(id);
      setSelectedComponentIds(newSelected);
    }
  };

  // 批量删除选中的组件
  const handleDeleteSelected = () => {
    if (selectedComponentIds.size === 0) return;
    setComponents(components.filter((c) => !selectedComponentIds.has(c.id)));
    setSelectedComponentIds(new Set());
  };

  // 复制组件（支持批量复制）
  const handleCopyComponent = (id: string) => {
    // 如果复制的是选中的组件，复制所有选中的组件
    if (selectedComponentIds.has(id) && selectedComponentIds.size > 1) {
      const componentsToCopy = components.filter((c) => selectedComponentIds.has(c.id));
      const newComponents = componentsToCopy.map((comp) => ({
        ...comp,
        id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: comp.x + 20,
        y: comp.y + 20,
      }));
      setComponents([...components, ...newComponents]);
      setSelectedComponentIds(new Set(newComponents.map((c) => c.id)));
    } else {
      // 单个复制
    const component = components.find((c) => c.id === id);
    if (component) {
      const newComponent: ComponentConfig = {
        ...component,
        id: `comp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        x: component.x + 20,
        y: component.y + 20,
      };
      setComponents([...components, newComponent]);
        setSelectedComponentIds(new Set([newComponent.id]));
      }
    }
  };

  // 处理组件选择（支持 Ctrl/Cmd 多选和 Shift 范围选择）
  const handleSelectComponent = (id: string, event?: React.MouseEvent) => {
    const isCtrlOrCmd = event?.ctrlKey || event?.metaKey;
    const isShift = event?.shiftKey;

    if (isCtrlOrCmd) {
      // Ctrl/Cmd 点击：切换选择状态
      const newSelected = new Set(selectedComponentIds);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      setSelectedComponentIds(newSelected);
    } else if (isShift && selectedComponentIds.size > 0) {
      // Shift 点击：范围选择
      const currentIds = Array.from(selectedComponentIds);
      const lastSelectedId = currentIds[currentIds.length - 1];
      const lastIndex = components.findIndex((c) => c.id === lastSelectedId);
      const currentIndex = components.findIndex((c) => c.id === id);
      
      if (lastIndex >= 0 && currentIndex >= 0) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = components.slice(start, end + 1).map((c) => c.id);
        setSelectedComponentIds(new Set(rangeIds));
      } else {
        setSelectedComponentIds(new Set([id]));
      }
    } else {
      // 普通点击：单选
      setSelectedComponentIds(new Set([id]));
    }
  };

  // 清空选择
  const handleClearSelection = () => {
    setSelectedComponentIds(new Set());
  };

  // 更新组件配置
  const handleUpdateComponent = (id: string, updates: Partial<ComponentConfig>) => {
    setComponents(
      components.map((c) => {
        if (c.id === id) {
          // 确保 dataSource 对象被正确合并
          const newComponent = { ...c, ...updates };
          if (updates.dataSource) {
            newComponent.dataSource = {
              ...c.dataSource,
              ...updates.dataSource,
            };
          }
          console.log("更新组件配置:", id, "更新内容:", updates, "新组件:", newComponent);
          return newComponent;
        }
        return c;
      })
    );
  };

  // 获取默认 ECharts 配置
  const getDefaultEChartsOption = (type: ChartType): EChartsOption => {
    const baseOption: EChartsOption = {
      title: { text: "示例图表", left: "center" },
      tooltip: { trigger: "axis" },
    };

    switch (type) {
      case "line":
        return {
          ...baseOption,
          xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
          yAxis: { type: "value" },
          series: [{ type: "line", data: [120, 132, 101, 134, 90, 230, 210] }],
        };
      case "bar":
        return {
          ...baseOption,
          xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
          yAxis: { type: "value" },
          series: [{ type: "bar", data: [120, 132, 101, 134, 90, 230, 210] }],
        };
      case "pie":
        return {
          ...baseOption,
          tooltip: { trigger: "item" },
          legend: { bottom: 0 },
          series: [
            {
              type: "pie",
              radius: "60%",
              data: [
                { value: 1048, name: "搜索引擎" },
                { value: 735, name: "直接访问" },
                { value: 580, name: "邮件营销" },
                { value: 484, name: "联盟广告" },
                { value: 300, name: "视频广告" },
              ],
            },
          ],
        };
      case "scatter":
        return {
          ...baseOption,
          tooltip: { trigger: "item" },
          xAxis: { type: "value" },
          yAxis: { type: "value" },
          series: [
            {
              type: "scatter",
              data: [
                [10.0, 8.04],
                [8.07, 6.95],
                [13.0, 7.58],
                [9.05, 8.81],
                [11.0, 8.33],
              ],
            },
          ],
        };
      case "radar":
        return {
          ...baseOption,
          radar: {
            indicator: [
              { name: "销售", max: 6500 },
              { name: "管理", max: 16000 },
              { name: "信息技术", max: 30000 },
              { name: "客服", max: 38000 },
              { name: "研发", max: 52000 },
              { name: "市场", max: 25000 },
            ],
          },
          series: [
            {
              type: "radar",
              data: [
                {
                  value: [4200, 3000, 20000, 35000, 50000, 18000],
                  name: "预算分配",
                },
              ],
            },
          ],
        };
      case "heatmap":
        return {
          ...baseOption,
          tooltip: { position: "top" },
          grid: { height: "50%", top: "10%" },
          xAxis: { type: "category", data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] },
          yAxis: { type: "category", data: ["Morning", "Afternoon", "Evening"] },
          visualMap: {
            min: 0,
            max: 10,
            calculable: true,
            orient: "horizontal",
            left: "center",
            bottom: "15%",
          },
          series: [
            {
              type: "heatmap",
              data: [
                [0, 0, 5],
                [0, 1, 1],
                [0, 2, 0],
                [1, 0, 0],
                [1, 1, 0],
                [1, 2, 2],
              ],
            },
          ],
        };
      case "funnel":
        return {
          ...baseOption,
          tooltip: { trigger: "item", formatter: "{a} <br/>{b} : {c}%" },
          series: [
            {
              type: "funnel",
              data: [
                { value: 60, name: "访问" },
                { value: 40, name: "咨询" },
                { value: 20, name: "订单" },
                { value: 80, name: "点击" },
                { value: 100, name: "展现" },
              ],
            },
          ],
        };
      case "gauge":
        return {
          ...baseOption,
          series: [
            {
              type: "gauge",
              data: [{ value: 50, name: "完成率" }],
            },
          ],
        };
      default:
        return baseOption;
    }
  };

  return (
    <Layout style={{ height: "100%" }}>
      {/* 左侧组件库 */}
      <Sider
        width={280}
        style={{
          background: "#fff",
          borderRight: "1px solid #f0f0f0",
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 48px)", // 限定侧栏高度，内部内容才会出现滚动条
          overflow: "hidden",
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab as any}
          style={{ flex: 1, overflow: "hidden" }}
          items={[
            {
              key: "components",
              label: "组件库",
              children: (
                <div style={{ height: "100%", overflow: "auto", paddingRight: 8 }}>
                  <ComponentLibrary onAdd={handleAddComponent} />
                </div>
              ),
            },
            {
              key: "properties",
              label: "属性",
              children: selectedComponent ? (
                <div style={{ height: "100%", overflow: "hidden", paddingRight: 8 }}>
                  <ComponentProperties
                    component={selectedComponent}
                    forms={forms}
                    onUpdate={(updates) => handleUpdateComponent(selectedComponent.id, updates)}
                  />
                </div>
              ) : selectedComponentIds.size > 1 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
                  <p>已选择 {selectedComponentIds.size} 个组件</p>
                  <p style={{ fontSize: 12, marginTop: 8, color: "#666" }}>批量编辑功能开发中...</p>
                  <p style={{ fontSize: 12, marginTop: 8, color: "#666" }}>提示：按住 Ctrl/Cmd 点击可多选，按住 Shift 点击可范围选择</p>
                </div>
              ) : (
                <div style={{ padding: 24, textAlign: "center", color: "#999" }}>
                  请选择画布中的组件
                </div>
              ),
            },
          ]}
        />
      </Sider>

      {/* 中间画布 */}
      <Content style={{ background: "#0a1929", position: "relative", overflow: "hidden" }}>
        <div style={{ padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <Input
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            style={{
              width: 200,
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
            }}
            placeholder="大屏名称"
          />
          {/* 缩放控制 */}
          <Space>
            <Tooltip title="放大">
              <Button
                type="text"
                icon={<ZoomInOutlined />}
                onClick={() => {
                  setCanvasScale(prev => {
                    const newScale = Math.min(prev + 0.1, 2);
                    console.log("放大：", prev, "->", newScale);
                    return newScale;
                  });
                }}
                style={{ color: "#fff" }}
              />
            </Tooltip>
            <Tooltip title="缩小">
              <Button
                type="text"
                icon={<ZoomOutOutlined />}
                onClick={() => {
                  setCanvasScale(prev => {
                    const newScale = Math.max(prev - 0.1, 0.5);
                    console.log("缩小：", prev, "->", newScale);
                    return newScale;
                  });
                }}
                style={{ color: "#fff" }}
              />
            </Tooltip>
            <Tooltip title="重置缩放">
              <Button
                type="text"
                icon={<CompressOutlined />}
                onClick={() => setCanvasScale(1)}
                style={{ color: "#fff" }}
              />
            </Tooltip>
            <span style={{ color: "#fff", marginLeft: 8, minWidth: 60, textAlign: "right" }}>
              {Math.round(canvasScale * 100)}%
            </span>
          </Space>
          {/* 对齐工具 */}
          {selectedComponentIds.size > 0 && (
            <Space>
              <span style={{ color: "#fff", marginRight: 8 }}>
                已选择 {selectedComponentIds.size} 个组件
              </span>
              {selectedComponentIds.size === 1 && (
                <>
              <Tooltip title="左对齐">
                <Button
                  type="text"
                  icon={<AlignLeftOutlined />}
                  onClick={() => {
                        const id = Array.from(selectedComponentIds)[0];
                        const comp = components.find(c => c.id === id);
                    if (comp) {
                          handleUpdateComponent(id, { x: 0 });
                    }
                  }}
                  style={{ color: "#fff" }}
                />
              </Tooltip>
              <Tooltip title="水平居中">
                <Button
                  type="text"
                  icon={<AlignCenterOutlined />}
                  onClick={() => {
                        const id = Array.from(selectedComponentIds)[0];
                        const comp = components.find(c => c.id === id);
                    if (comp) {
                          handleUpdateComponent(id, { x: (1920 - comp.width) / 2 });
                    }
                  }}
                  style={{ color: "#fff" }}
                />
              </Tooltip>
              <Tooltip title="右对齐">
                <Button
                  type="text"
                  icon={<AlignRightOutlined />}
                  onClick={() => {
                        const id = Array.from(selectedComponentIds)[0];
                        const comp = components.find(c => c.id === id);
                    if (comp) {
                          handleUpdateComponent(id, { x: 1920 - comp.width });
                    }
                  }}
                  style={{ color: "#fff" }}
                />
              </Tooltip>
              <Divider orientation="vertical" style={{ borderColor: "rgba(255,255,255,0.2)" }} />
              <Tooltip title="顶部对齐">
                <Button
                  type="text"
                  icon={<VerticalAlignTopOutlined />}
                  onClick={() => {
                        const id = Array.from(selectedComponentIds)[0];
                        handleUpdateComponent(id, { y: 0 });
                  }}
                  style={{ color: "#fff" }}
                />
              </Tooltip>
              <Tooltip title="垂直居中">
                <Button
                  type="text"
                  icon={<VerticalAlignMiddleOutlined />}
                  onClick={() => {
                        const id = Array.from(selectedComponentIds)[0];
                        const comp = components.find(c => c.id === id);
                    if (comp) {
                          handleUpdateComponent(id, { y: (1080 - comp.height) / 2 });
                    }
                  }}
                  style={{ color: "#fff" }}
                />
              </Tooltip>
              <Tooltip title="底部对齐">
                <Button
                  type="text"
                  icon={<VerticalAlignBottomOutlined />}
                  onClick={() => {
                        const id = Array.from(selectedComponentIds)[0];
                        const comp = components.find(c => c.id === id);
                    if (comp) {
                          handleUpdateComponent(id, { y: 1080 - comp.height });
                    }
                  }}
                  style={{ color: "#fff" }}
                />
              </Tooltip>
                </>
              )}
              {selectedComponentIds.size > 1 && (
                <>
                  <Divider orientation="vertical" style={{ borderColor: "rgba(255,255,255,0.2)" }} />
                  <Tooltip title="批量删除">
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleDeleteSelected}
                      style={{ color: "#ff4d4f" }}
                    >
                      删除选中
                    </Button>
                  </Tooltip>
                  <Tooltip title="批量复制">
                    <Button
                      type="text"
                      icon={<CopyOutlined />}
                      onClick={() => {
                        const idsToCopy = Array.from(selectedComponentIds);
                        if (idsToCopy.length > 0) {
                          handleCopyComponent(idsToCopy[0]);
                        }
                      }}
                      style={{ color: "#fff" }}
                    >
                      复制选中
                    </Button>
                  </Tooltip>
                </>
              )}
            </Space>
          )}
        </div>
        <DesignerCanvas
          components={components}
          selectedComponentIds={selectedComponentIds}
          onSelect={handleSelectComponent}
          onClearSelection={handleClearSelection}
          onUpdate={handleUpdateComponent}
          onDelete={handleDeleteComponent}
          onCopy={handleCopyComponent}
          forms={forms}
          scale={canvasScale}
        />
      </Content>
    </Layout>
  );
});

// 组件库面板
const ComponentLibrary = ({ onAdd }: { onAdd: (type: ComponentConfig["type"], chartType?: ChartType, decorationType?: DecorationType) => void }) => {
  return (
    <div
      style={{
        padding: 16,
        height: "calc(100vh - 120px)", // 给定固定可视高度，确保内容超出时出现滚动条
        overflowY: "auto",
      }}
    >
      <Collapse 
        defaultActiveKey={["charts", "decorations", "others"]} 
        ghost
        items={[
          {
            key: "charts",
            label: "图表组件",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {chartTypeOptions.map((option) => (
                  <Button
                    key={option.value}
                    icon={option.icon}
                    block
                    onClick={() => onAdd("chart", option.value)}
                    style={{ textAlign: "left" }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            ),
          },
          {
            key: "dataComponents",
            label: "数据组件",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {dataComponentOptions.map((option) => (
                  <Button
                    key={option.type}
                    icon={option.icon}
                    block
                    onClick={() => onAdd(option.type as any)}
                    style={{ textAlign: "left" }}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            ),
          },
          {
            key: "decorations",
            label: "装饰组件",
            children: (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {decorationOptions.map((option) => (
                  <Button
                    key={option.value}
                    block
                    onClick={() => onAdd("decoration", undefined, option.value)}
                    style={{ textAlign: "left" }}
                  >
                    {option.label}
                </Button>
                ))}
              </div>
            ),
          },
          {
            key: "others",
            label: "其他组件",
            children: (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Button block onClick={() => onAdd("text")}>
                  文本（标题）
                </Button>
                <Button block onClick={() => onAdd("image")}>
                  图片
                </Button>
                <Button block onClick={() => onAdd("table")}>
                  表格
                </Button>
                <Button block onClick={() => onAdd("datetime" as any)}>
                  实时时间
                </Button>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
};

// 组件属性面板
const ComponentProperties = ({
  component,
  forms,
  onUpdate,
}: {
  component: ComponentConfig;
  forms: any[];
  onUpdate: (updates: Partial<ComponentConfig>) => void;
}) => {
  const [form] = Form.useForm();
  const [selectedFormId, setSelectedFormId] = useState<string | undefined>(component.dataSource?.formId);
  const [formFields, setFormFields] = useState<any[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  useEffect(() => {
    form.setFieldsValue(component);
    setSelectedFormId(component.dataSource?.formId);
  }, [component.id, form]); // 只在组件ID变化时更新，避免频繁更新

  // 当选择的表单变化时，加载字段列表
  useEffect(() => {
    if (!selectedFormId) {
      setFormFields([]);
      return;
    }

    const selectedForm = forms.find(f => f.id === selectedFormId || f.formId === selectedFormId);
    if (!selectedForm) {
      setFormFields([]);
      return;
    }

    setLoadingFields(true);
    const actualFormId = selectedForm.formId || selectedForm.id;
    formDefinitionApi
      .getById(actualFormId)
      .then((formDef) => {
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
        setFormFields(allFields);
      })
      .catch((e) => {
        console.error("加载表单字段失败:", e);
        setFormFields([]);
      })
      .finally(() => {
        setLoadingFields(false);
      });
  }, [selectedFormId, forms]);

  const handleValuesChange = (changedValues: any) => {
    // 如果表单ID变化，清空字段选择
    if (changedValues.dataSource?.formId !== undefined) {
      setSelectedFormId(changedValues.dataSource.formId);
      if (changedValues.dataSource.formId !== component.dataSource?.formId) {
        changedValues.dataSource = {
          ...changedValues.dataSource,
          xFieldId: undefined,
          yFieldId: undefined,
          nameFieldId: undefined, // 清空轮播表旧字段选择
          valueFieldId: undefined, // 清空轮播表旧字段选择
          fieldIds: undefined, // 清空表格和轮播表字段选择
        };
      }
    }
    // 确保 dataSource 对象被正确合并
    if (changedValues.dataSource) {
      changedValues.dataSource = {
        ...component.dataSource,
        ...changedValues.dataSource,
      };
    }
    onUpdate(changedValues);
  };

  return (
    <div
      style={{
        padding: 16,
        height: "calc(100vh - 120px)", // 固定可视高度
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        style={{ overflowY: "auto", paddingRight: 8, flex: 1 }}
      >
        <Form.Item label="组件标题" name="title">
          <Input />
        </Form.Item>

        {/* 图表组件的数据源配置 */}
        {component.type === "chart" && (
          <>
            <Form.Item label="数据源表单" name={["dataSource", "formId"]}>
              <Select 
                placeholder="选择表单"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={forms.map((f) => ({
                  label: f.name || f.formName || f.id,
                  value: f.formId || f.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="X轴字段" name={["dataSource", "xFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={formFields.map((field) => ({
                  label: field.label || field.fieldName || field.fieldId,
                  value: field.fieldId,
                }))}
              />
            </Form.Item>
            <Form.Item label="Y轴字段" name={["dataSource", "yFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={formFields
                  .filter(f => f.type === "number" || f.type === "integer" || f.type === "decimal")
                  .map((field) => ({
                    label: field.label || field.fieldName || field.fieldId,
                    value: field.fieldId,
                  }))}
              />
            </Form.Item>
            <Form.Item label="聚合方式" name={["dataSource", "aggregation"]}>
              <Select placeholder="选择聚合方式">
                <Option value="sum">求和</Option>
                <Option value="avg">平均值</Option>
                <Option value="count">计数</Option>
                <Option value="max">最大值</Option>
                <Option value="min">最小值</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {/* 表格组件的数据源配置 */}
        {component.type === "table" && (
          <>
          <Form.Item label="数据源表单" name={["dataSource", "formId"]}>
            <Select 
              placeholder="选择表单"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
              }
              options={forms.map((f) => ({
                label: f.name || f.formName || f.id,
                value: f.formId || f.id,
              }))}
            />
          </Form.Item>
            <Form.Item 
              label="选择字段" 
              name={["dataSource", "fieldIds"]}
              tooltip="选择要在表格中显示的字段，如果不选择则显示所有字段"
            >
              <Select 
                mode="multiple"
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择要显示的字段（可多选）" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={formFields.map((field) => ({
                  label: field.label || field.fieldName || field.fieldId,
                  value: field.fieldId,
                }))}
              />
            </Form.Item>
            <Form.Item label="显示行数" name={["dataSource", "rowNum"]}>
              <InputNumber style={{ width: "100%" }} min={1} max={100} placeholder="默认显示所有行" />
            </Form.Item>
          </>
        )}

        {/* 滚动表格的数据源配置 */}
        {component.type === "scrollBoard" && (
          <>
            <Form.Item label="数据源表单" name={["dataSource", "formId"]}>
              <Select 
                placeholder="选择表单"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={forms.map((f) => ({
                  label: f.name || f.formName || f.id,
                  value: f.formId || f.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="滚动行数" name={["dataSource", "rowNum"]}>
              <InputNumber style={{ width: "100%" }} min={3} max={10} placeholder="默认5行" />
            </Form.Item>
            <Form.Item 
              label="选择字段" 
              name={["dataSource", "fieldIds"]}
              tooltip="选择要在轮播表中显示的字段（可多选），如果不选择则显示所有字段"
            >
              <Select 
                mode="multiple"
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择要显示的字段（可多选）" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={formFields.map((field) => ({
                  label: field.label || field.fieldName || field.fieldId,
                  value: field.fieldId,
                }))}
              />
            </Form.Item>
          </>
        )}

        {/* 指标卡的数据源配置 */}
        {component.type === "digitalFlop" && (
          <>
            <Form.Item label="数据源表单" name={["dataSource", "formId"]}>
              <Select 
                placeholder="选择表单"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={forms.map((f) => ({
                  label: f.name || f.formName || f.id,
                  value: f.formId || f.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="数值字段" name={["dataSource", "valueFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                options={formFields
                  .filter(f => f.type === "number" || f.type === "integer" || f.type === "decimal")
                  .map((field) => ({
                    label: field.label || field.fieldName || field.fieldId,
                    value: field.fieldId,
                  }))}
              />
            </Form.Item>
            <Form.Item label="聚合方式" name={["dataSource", "aggregation"]}>
              <Select placeholder="选择聚合方式">
                <Option value="sum">求和</Option>
                <Option value="avg">平均值</Option>
                <Option value="count">计数</Option>
                <Option value="max">最大值</Option>
                <Option value="min">最小值</Option>
              </Select>
            </Form.Item>
            <Form.Item label="显示格式" name={["dataSource", "content"]}>
              <Input placeholder='例如: {nt} 或 总计: {nt}' />
            </Form.Item>
            <Form.Item label="字体大小" name={["style", "fontSize"]}>
              <InputNumber style={{ width: "100%" }} min={12} max={120} placeholder="默认48" />
            </Form.Item>
            <Form.Item label="标题字体大小" name={["style", "titleFontSize"]}>
              <InputNumber style={{ width: "100%" }} min={12} max={48} placeholder="默认16" />
            </Form.Item>
          </>
        )}

        {/* 排名榜的数据源配置 */}
        {component.type === "scrollRankingBoard" && (
          <>
            <Form.Item label="数据源表单" name={["dataSource", "formId"]}>
              <Select 
                placeholder="选择表单"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={forms.map((f) => ({
                  label: f.name || f.formName || f.id,
                  value: f.formId || f.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="名称字段" name={["dataSource", "nameFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                options={formFields.map((field) => ({
                  label: field.label || field.fieldName || field.fieldId,
                  value: field.fieldId,
                }))}
              />
            </Form.Item>
            <Form.Item label="数值字段" name={["dataSource", "valueFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                options={formFields
                  .filter(f => f.type === "number" || f.type === "integer" || f.type === "decimal")
                  .map((field) => ({
                    label: field.label || field.fieldName || field.fieldId,
                    value: field.fieldId,
                  }))}
              />
            </Form.Item>
            <Form.Item label="显示条数" name={["dataSource", "rowNum"]}>
              <InputNumber style={{ width: "100%" }} min={3} max={10} placeholder="默认5条" />
            </Form.Item>
          </>
        )}

        {/* 进度池的数据源配置 */}
        {component.type === "percentPond" && (
          <>
            <Form.Item label="数据源表单" name={["dataSource", "formId"]}>
              <Select 
                placeholder="选择表单"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={forms.map((f) => ({
                  label: f.name || f.formName || f.id,
                  value: f.formId || f.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="数值字段" name={["dataSource", "valueFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                options={formFields
                  .filter(f => f.type === "number" || f.type === "integer" || f.type === "decimal")
                  .map((field) => ({
                    label: field.label || field.fieldName || field.fieldId,
                    value: field.fieldId,
                  }))}
              />
            </Form.Item>
            <Form.Item label="最大值" name={["dataSource", "max"]}>
              <InputNumber style={{ width: "100%" }} min={1} placeholder="用于计算百分比" />
            </Form.Item>
          </>
        )}

        {/* 水位图的数据源配置 */}
        {component.type === "waterLevelPond" && (
          <>
            <Form.Item label="数据源表单" name={["dataSource", "formId"]}>
              <Select 
                placeholder="选择表单"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={forms.map((f) => ({
                  label: f.name || f.formName || f.id,
                  value: f.formId || f.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="数值字段" name={["dataSource", "valueFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                options={formFields
                  .filter(f => f.type === "number" || f.type === "integer" || f.type === "decimal")
                  .map((field) => ({
                    label: field.label || field.fieldName || field.fieldId,
                    value: field.fieldId,
                  }))}
              />
            </Form.Item>
            <Form.Item label="最大值" name={["dataSource", "max"]}>
              <InputNumber style={{ width: "100%" }} min={1} placeholder="用于计算百分比" />
            </Form.Item>
            <Form.Item label="形状" name={["dataSource", "shape"]}>
              <Select>
                <Option value="roundRect">圆角矩形</Option>
                <Option value="rect">矩形</Option>
                <Option value="round">圆形</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {/* 胶囊图、环形图、锥形柱图的数据源配置 */}
        {(component.type === "capsuleChart" || component.type === "activeRingChart" || component.type === "conicalColumnChart") && (
          <>
            <Form.Item label="数据源表单" name={["dataSource", "formId"]}>
              <Select 
                placeholder="选择表单"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                }
                options={forms.map((f) => ({
                  label: f.name || f.formName || f.id,
                  value: f.formId || f.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="名称字段" name={["dataSource", "nameFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                options={formFields.map((field) => ({
                  label: field.label || field.fieldName || field.fieldId,
                  value: field.fieldId,
                }))}
              />
            </Form.Item>
            <Form.Item label="数值字段" name={["dataSource", "valueFieldId"]}>
              <Select 
                placeholder={loadingFields ? "加载中..." : selectedFormId ? "选择字段" : "请先选择表单"}
                disabled={!selectedFormId || loadingFields}
                showSearch
                options={formFields
                  .filter(f => f.type === "number" || f.type === "integer" || f.type === "decimal")
                  .map((field) => ({
                    label: field.label || field.fieldName || field.fieldId,
                    value: field.fieldId,
                  }))}
              />
            </Form.Item>
            <Form.Item label="显示条数" name={["dataSource", "limit"]}>
              <InputNumber style={{ width: "100%" }} min={1} max={20} placeholder="默认显示所有" />
            </Form.Item>
          </>
        )}

        <Form.Item label="位置X" name="x">
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="位置Y" name="y">
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="宽度" name="width">
          <InputNumber style={{ width: "100%" }} min={100} />
        </Form.Item>
        <Form.Item label="高度" name="height">
          <InputNumber style={{ width: "100%" }} min={100} />
        </Form.Item>
        <Form.Item label="层级" name="zIndex">
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>

        {component.type === "text" && (
          <>
            <Form.Item label="文本内容" name="text">
              <Input.TextArea rows={4} />
            </Form.Item>
            <Form.Item label="字体大小" name={["textStyle", "fontSize"]}>
              <InputNumber style={{ width: "100%" }} min={12} max={72} />
            </Form.Item>
            <Form.Item
              label="文字颜色"
              name={["textStyle", "color"]}
              getValueProps={(value: any) => ({
                value: typeof value === "string" ? value : value?.metaColor || "#ffffff",
              })}
              getValueFromEvent={(color: any) => color?.toHexString?.() || color}
            >
              <ColorPicker format="hex" />
            </Form.Item>
            <Form.Item label="文字对齐" name={["textStyle", "textAlign"]}>
              <Select>
                <Option value="left">左对齐</Option>
                <Option value="center">居中</Option>
                <Option value="right">右对齐</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {component.type === "datetime" && (
          <>
            <Form.Item label="时间格式" name="timeFormat">
              <Input placeholder="例如：YYYY-MM-DD HH:mm:ss" />
            </Form.Item>
            <Form.Item label="字体大小" name={["textStyle", "fontSize"]}>
              <InputNumber style={{ width: "100%" }} min={12} max={72} />
            </Form.Item>
            <Form.Item
              label="文字颜色"
              name={["textStyle", "color"]}
              getValueProps={(value: any) => ({
                value: typeof value === "string" ? value : value?.metaColor || "#ffffff",
              })}
              getValueFromEvent={(color: any) => color?.toHexString?.() || color}
            >
              <ColorPicker format="hex" />
            </Form.Item>
            <Form.Item label="文字对齐" name={["textStyle", "textAlign"]}>
              <Select>
                <Option value="left">左对齐</Option>
                <Option value="center">居中</Option>
                <Option value="right">右对齐</Option>
              </Select>
            </Form.Item>
          </>
        )}

        {component.type === "image" && (
          <Form.Item label="图片URL" name="imageUrl">
            <Input placeholder="请输入图片地址" />
          </Form.Item>
        )}

        <Form.Item
          label="背景色"
          name={["style", "backgroundColor"]}
          getValueProps={(value: any) => ({
            value: typeof value === "string" ? value : value?.metaColor || "transparent",
          })}
          getValueFromEvent={(color: any) => color?.toHexString?.() || color}
        >
          <ColorPicker format="hex" />
        </Form.Item>
        <Form.Item
          label="边框颜色"
          name={["style", "borderColor"]}
          getValueProps={(value: any) => ({
            value: typeof value === "string" ? value : value?.metaColor || "#ffffff",
          })}
          getValueFromEvent={(color: any) => color?.toHexString?.() || color}
        >
          <ColorPicker format="hex" />
        </Form.Item>
        <Form.Item label="边框宽度" name={["style", "borderWidth"]}>
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>
        <Form.Item label="圆角" name={["style", "borderRadius"]}>
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>
        <Form.Item label="内边距" name={["style", "padding"]}>
          <InputNumber style={{ width: "100%" }} min={0} />
        </Form.Item>

        {component.type === "chart" && (
          <Form.Item label="边框装饰" name="borderType">
            <Select placeholder="选择边框装饰（可选）" allowClear>
              {decorationOptions
                .filter(opt => opt.value.startsWith("borderBox"))
                .map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
            </Select>
          </Form.Item>
        )}
      </Form>

      {component.type === "chart" && component.chartType && (
        <div style={{ marginTop: 24 }}>
          <EChartsOptionEditor
            option={component.echartsOption || {}}
            onChange={(newOption) => onUpdate({ echartsOption: newOption })}
          />
        </div>
      )}
    </div>
  );
};


// 设计器画布
const DesignerCanvas = ({
  components,
  selectedComponentIds,
  onSelect,
  onClearSelection,
  onUpdate,
  onDelete,
  onCopy,
  forms,
  scale = 1,
}: {
  components: ComponentConfig[];
  selectedComponentIds: Set<string>;
  onSelect: (id: string, event?: React.MouseEvent) => void;
  onClearSelection: () => void;
  onUpdate: (id: string, updates: Partial<ComponentConfig>) => void;
  onDelete: (id: string) => void;
  onCopy: (id: string) => void;
  forms: any[];
  scale?: number;
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  // 配置拖拽传感器，只在按住鼠标移动时触发拖拽，避免阻止点击
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 移动超过 8px 才触发拖拽
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, delta } = event;
    if (delta) {
      const component = components.find((c) => c.id === active.id);
      if (component) {
        onUpdate(component.id, {
          x: component.x + delta.x,
          y: component.y + delta.y,
        });
      }
    }
    setActiveId(null);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} onDragStart={(e) => setActiveId(e.active.id as string)}>
      <div
        style={{
          width: "100%",
          height: "calc(100% - 60px)",
          position: "relative",
          overflow: "auto",
          background: "linear-gradient(135deg, #0a1929 0%, #1a2a3a 100%)",
        }}
        onClick={(e) => {
          // 点击空白区域时清空选择
          if (e.target === e.currentTarget) {
            onClearSelection();
          }
        }}
      >
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            width: scale < 1 ? `${100 / scale}%` : "100%",
            height: scale < 1 ? `${100 / scale}%` : "100%",
            position: "relative",
            minHeight: "100%",
        }}
      >
        {components.map((component) => {
          const isSelected = selectedComponentIds.has(component.id);
          return (
            <DraggableComponent
              key={component.id}
              component={component}
              isSelected={isSelected}
              onSelect={(e) => onSelect(component.id, e)}
              onUpdate={(updates) => onUpdate(component.id, updates)}
              onDelete={() => onDelete(component.id)}
              onCopy={() => onCopy(component.id)}
              forms={forms}
              canvasScale={scale}
            />
          );
        })}
        </div>
        <DragOverlay>
          {activeId ? (
            <div
              style={{
                width: 200,
                height: 150,
                background: "rgba(24, 144, 255, 0.1)",
                border: "2px dashed #1890ff",
                borderRadius: 4,
              }}
            >
              拖拽中...
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

// 可拖拽组件 - 使用 React.memo 优化性能
const DraggableComponent = React.memo(({
  component,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  onCopy,
  forms,
  canvasScale = 1,
}: {
  component: ComponentConfig;
  isSelected: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  onUpdate: (updates: Partial<ComponentConfig>) => void;
  onDelete: () => void;
  onCopy: () => void;
  forms: any[];
  canvasScale?: number;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: component.id,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [chartOption, setChartOption] = useState<EChartsOption | null>(null);
  const [tableData, setTableData] = useState<any[]>([]);
  const [tableColumns, setTableColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  // 保存缩放开始时的初始尺寸，避免在 onResize 过程中 component.width 更新导致增量计算错误
  const resizeStartSizeRef = useRef<{ width: number; height: number } | null>(null);

  // 当数据源配置变化时，加载数据并生成图表配置或表格数据
  useEffect(() => {
    // 表格组件的数据加载
    if (component.type === "table") {
      const { dataSource } = component;
      console.log("表格组件数据源:", dataSource, "组件:", component.id);
      
      if (!dataSource?.formId) {
        console.log("表格组件未配置数据源表单");
        setTableData([]);
        setTableColumns([]);
        setLoading(false);
        return;
      }

      // 确保 forms 数组已加载
      if (!forms || forms.length === 0) {
        console.log("表单列表尚未加载，等待...");
        setLoading(false);
        return;
      }

      setLoading(true);
      const foundForm = forms.find(f => f.id === dataSource.formId || f.formId === dataSource.formId);
      const actualFormId = foundForm?.formId || foundForm?.id || dataSource.formId;
      
      console.log("查找表单:", foundForm, "实际表单ID:", actualFormId, "表单列表长度:", forms.length);
      
      if (!actualFormId) {
        console.warn("无法找到表单ID:", dataSource.formId, "可用的表单:", forms.map(f => f.formId || f.id));
        setTableData([]);
        setTableColumns([]);
        setLoading(false);
        return;
      }

      // 加载表单定义以获取字段信息
      formDefinitionApi
        .getById(actualFormId)
        .then((formDef) => {
          const allFields = formDef.fields || [];
          console.log("表单字段列表:", allFields);
          
          // 如果指定了字段ID列表，只使用选中的字段；否则使用所有字段
          const selectedFieldIds = dataSource.fieldIds && Array.isArray(dataSource.fieldIds) && dataSource.fieldIds.length > 0
            ? dataSource.fieldIds
            : null;
          
          console.log("选中的字段ID:", selectedFieldIds);
          
          const fields = selectedFieldIds
            ? allFields.filter((field: any) => selectedFieldIds.includes(field.fieldId))
            : allFields;
          
          console.log("最终使用的字段:", fields);
          
          if (fields.length === 0) {
            console.warn("没有可用的字段，显示空表格");
            setTableColumns([]);
            setTableData([]);
            setLoading(false);
            return;
          }
          
          // 加载表单数据
          return formDataApi.getListByForm(actualFormId).then((rows) => {
            console.log("加载到的数据行数:", rows?.length || 0);
            
            // 生成表格列
            const columns = fields.map((field: any) => ({
              title: field.label || field.fieldName || field.fieldId,
              dataIndex: field.fieldId,
              key: field.fieldId,
              width: 150,
              ellipsis: true,
            }));

            // 限制显示行数
            const rowNum = dataSource.rowNum || undefined;
            const displayRows = rowNum ? (rows || []).slice(0, rowNum) : (rows || []);

            // 转换数据
            const data = displayRows.map((row: any, index: number) => {
              const record: any = { key: index };
              const rowData = row.data || {};
              fields.forEach((field: any) => {
                record[field.fieldId] = rowData[field.fieldId] ?? "";
              });
              return record;
            });

            console.log("生成的表格列数:", columns.length, "数据行数:", data.length);
            setTableColumns(columns);
            setTableData(data);
          });
        })
        .catch((e) => {
          console.error("加载表格数据失败:", e);
          console.error("错误详情:", e.message, e.stack);
          setTableData([]);
          setTableColumns([]);
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    // DataV 组件的数据加载
    const dataVTypes: DataVComponentType[] = ["scrollBoard", "digitalFlop", "waterLevelPond", "scrollRankingBoard", "capsuleChart", "activeRingChart", "conicalColumnChart", "percentPond"];
    if (dataVTypes.includes(component.type as DataVComponentType)) {
      const { dataSource } = component;
      if (!dataSource?.formId) {
        // 如果没有配置数据源，使用默认数据
        return;
      }

      setLoading(true);
      const foundForm = forms.find(f => f.id === dataSource.formId || f.formId === dataSource.formId);
      const actualFormId = foundForm?.formId || foundForm?.id || dataSource.formId;
      
      if (!actualFormId) {
        console.warn("无法找到表单ID:", dataSource.formId);
        setLoading(false);
        return;
      }

      // 加载表单定义和表单数据，然后转换为 DataV 组件需要的格式
      Promise.all([
        formDefinitionApi.getById(actualFormId),
        formDataApi.getListByForm(actualFormId),
      ])
        .then(([formDef, rows]) => {
          // 收集所有字段（包括嵌套字段），与 ComponentProperties 中的逻辑保持一致
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
          collectFields(formDef.config?.elements || formDef.config?.fields || formDef.fields || []);
          
          console.log("【DataV数据转换】收集到的字段数量:", allFields.length);
          console.log("【DataV数据转换】字段列表:", allFields.map(f => ({
            fieldId: f.fieldId,
            label: f.label,
            fieldName: f.fieldName,
            name: f.name,
          })));
          console.log("【DataV数据转换】数据源配置:", dataSource);
          
          const dataVData = convertToDataVData(component.type as DataVComponentType, rows, dataSource, allFields);
          console.log("【DataV数据转换】生成的表头:", dataVData?.header);
          onUpdate({ dataSource: { ...dataSource, dataVData } });
        })
        .catch((e) => {
          console.error("加载 DataV 组件数据失败:", e);
        })
        .finally(() => {
          setLoading(false);
        });
      return;
    }

    // 图表组件的数据加载（确保不是表格类型）
    if (component.type !== "chart" || !component.chartType || component.type === "table") {
      if (component.type !== "table") {
        setChartOption(null);
      }
      return;
    }

    const { dataSource } = component;
    if (!dataSource?.formId || !dataSource?.xFieldId || !dataSource?.yFieldId) {
      // 如果没有完整的数据源配置，使用默认配置
      setChartOption(component.echartsOption || getDefaultEChartsOption(component.chartType));
      setLoading(false);
      return;
    }

    // 加载数据
    setLoading(true);
    const foundForm = forms.find(f => f.id === dataSource.formId || f.formId === dataSource.formId);
    const actualFormId = foundForm?.formId || foundForm?.id || dataSource.formId;
    
    if (!actualFormId) {
      console.warn("无法找到表单ID:", dataSource.formId);
      setChartOption(component.echartsOption || getDefaultEChartsOption(component.chartType));
      setLoading(false);
      return;
    }

    console.log("开始加载数据，formId:", actualFormId, "xFieldId:", dataSource.xFieldId, "yFieldId:", dataSource.yFieldId);
    
    formDataApi
      .getListByForm(actualFormId)
      .then((rows) => {
        console.log("加载到的数据行数:", rows?.length || 0, "数据:", rows);
        
        const xData: string[] = [];
        const yData: number[] = [];
        const dataMap = new Map<string, number[]>();

        // 收集数据
        (rows || []).forEach((row: any) => {
          const data = row.data || {};
          const xValue = String(data[dataSource.xFieldId!] ?? "");
          const yValue = Number(data[dataSource.yFieldId!] ?? 0);
          
          // 过滤空值
          if (!xValue || xValue === "undefined" || xValue === "null") {
            return;
          }
          
          if (!dataMap.has(xValue)) {
            dataMap.set(xValue, []);
            xData.push(xValue);
          }
          dataMap.get(xValue)!.push(Number.isFinite(yValue) ? yValue : 0);
        });
        
        console.log("处理后的数据 - xData:", xData, "dataMap:", Array.from(dataMap.entries()));

        // 根据聚合方式处理数据
        const aggregation = dataSource.aggregation || "sum";
        const processedYData = xData.map((x) => {
          const values = dataMap.get(x) || [];
          switch (aggregation) {
            case "sum":
              return values.reduce((a, b) => a + b, 0);
            case "avg":
              return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            case "count":
              return values.length;
            case "max":
              return values.length > 0 ? Math.max(...values) : 0;
            case "min":
              return values.length > 0 ? Math.min(...values) : 0;
            default:
              return values.reduce((a, b) => a + b, 0);
          }
        });

        // 如果没有数据，使用默认配置
        if (xData.length === 0) {
          console.warn("没有找到数据，使用默认配置");
          setChartOption(component.echartsOption || getDefaultEChartsOption(component.chartType));
          setLoading(false);
          return;
        }

        // 生成图表配置
        const baseOption = component.echartsOption || getDefaultEChartsOption(component.chartType);
        
        // 根据图表类型生成不同的配置
        let newOption: EChartsOption;
        
        if (component.chartType === "pie") {
          // 饼图特殊处理
          newOption = {
            ...baseOption,
            title: {
              ...(baseOption.title as any),
              text: component.title || baseOption.title?.text || "图表",
            },
            tooltip: { trigger: "item" },
            legend: { bottom: 0 },
            series: [{
              type: "pie",
              radius: "60%",
              data: xData.map((name, index) => ({
                name,
                value: processedYData[index] || 0,
              })),
            }],
          };
        } else {
          // 其他图表类型（折线图、柱状图等）
          newOption = {
            ...baseOption,
            title: {
              ...(baseOption.title as any),
              text: component.title || baseOption.title?.text || "图表",
            },
            xAxis: {
              ...(baseOption.xAxis as any),
              type: "category",
              data: xData,
            },
            yAxis: {
              ...(baseOption.yAxis as any),
              type: "value",
            },
            series: (baseOption.series as any[])?.map((s: any, index: number) => ({
              ...s,
              type: s.type || (component.chartType === "line" ? "line" : component.chartType === "bar" ? "bar" : "line"),
              data: index === 0 ? processedYData : s.data,
            })) || [{
              type: component.chartType === "line" ? "line" : component.chartType === "bar" ? "bar" : "line",
              data: processedYData,
            }],
          };
        }

        console.log("生成的图表配置:", newOption, "数据:", { xData, processedYData });
        setChartOption(newOption);
      })
      .catch((e) => {
        console.error("加载图表数据失败:", e);
        setChartOption(component.echartsOption || getDefaultEChartsOption(component.chartType));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    component.id,
    component.type,
    component.chartType,
    component.dataSource?.formId,
    component.dataSource?.xFieldId,
    component.dataSource?.yFieldId,
    component.dataSource?.aggregation,
    component.dataSource?.fieldIds, // 表格字段选择
    component.dataSource?.rowNum, // 表格显示行数
    component.title,
    component.echartsOption,
    forms.length, // 只依赖 forms 的长度，避免 forms 对象变化导致无限循环
    // 使用 JSON.stringify 确保 dataSource 对象的其他变化能触发
    JSON.stringify(component.dataSource),
  ]);

  const style = {
    transform: CSS.Translate.toString(transform),
    position: "absolute" as const,
    left: component.x,
    top: component.y,
    width: component.width,
    height: component.height,
    // 装饰默认放在背景层，避免覆盖数据组件。需要置顶可在属性面板调高 zIndex。
    zIndex: component.type === "decoration"
      ? (component.zIndex ?? -100)
      : (component.zIndex ?? 1),
    opacity: isDragging ? 0.5 : 1,
    cursor: "move",
  };

  const renderContent = () => {
    // 首先检查是否是表格类型，避免被图表逻辑处理
    if (component.type === "table") {
      return (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {loading && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255,255,255,0.8)",
                zIndex: 10,
              }}
            >
              <Spin size="large" />
            </div>
          )}
          {tableData.length > 0 && tableColumns.length > 0 ? (
            <Table
              dataSource={tableData}
              columns={tableColumns}
              pagination={false}
              size="small"
              style={{ width: "100%", height: "100%" }}
              scroll={{ y: "calc(100% - 40px)" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
              }}
            >
              {component.dataSource?.formId ? "加载中..." : "请配置数据源"}
            </div>
          )}
        </div>
      );
    }

    switch (component.type) {
      case "chart":
        // 优先使用从数据源加载的配置，否则使用组件配置，最后使用默认配置
        const option = chartOption !== null ? chartOption : (component.echartsOption || getDefaultEChartsOption(component.chartType || "line"));
        return (
          <div style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}>
            {loading && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.8)",
                  zIndex: 10,
                }}
              >
                <Spin size="large" />
              </div>
            )}
            <ReactECharts
              key={`${component.id}-${component.dataSource?.formId || 'no-data'}-${component.dataSource?.xFieldId || ''}-${component.dataSource?.yFieldId || ''}-${chartOption ? 'loaded' : 'default'}`}
              option={option}
              style={{ width: "100%", height: "100%" }}
              opts={{ renderer: "svg" }}
              notMerge={true}
              lazyUpdate={false}
            />
          </div>
        );
      case "decoration":
        // 装饰组件：内容不拦截事件，默认在背景层
        return (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "absolute",
                pointerEvents: "none",
                background: "transparent",
                inset: 0,
              }}
            >
              {renderDecoration(component.decorationType!)}
            </div>
          </div>
        );
      case "text":
        return (
          <div
            style={{
              ...component.textStyle,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: component.textStyle?.textAlign || "center",
            }}
          >
            {component.text || "文本内容"}
          </div>
        );
      case "datetime": {
        const [now, setNow] = useState<string>("");

        useEffect(() => {
          const format = component.timeFormat || "YYYY-MM-DD HH:mm:ss";
          const formatTime = () => {
            const d = new Date();
            const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
            const year = d.getFullYear();
            const month = pad(d.getMonth() + 1);
            const day = pad(d.getDate());
            const hour = pad(d.getHours());
            const minute = pad(d.getMinutes());
            const second = pad(d.getSeconds());

            let result = format;
            result = result.replace("YYYY", `${year}`);
            result = result.replace("MM", month);
            result = result.replace("DD", day);
            result = result.replace("HH", hour);
            result = result.replace("mm", minute);
            result = result.replace("ss", second);
            setNow(result);
          };

          formatTime();
          const timer = setInterval(formatTime, 1000);
          return () => clearInterval(timer);
        }, [component.timeFormat]);

        return (
          <div
            style={{
              ...component.textStyle,
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: component.textStyle?.textAlign || "center",
            }}
          >
            {now}
          </div>
        );
      }
      case "image":
        return (
          <img
            src={component.imageUrl || ""}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        );
      case "table":
        return (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {loading && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(255,255,255,0.8)",
                  zIndex: 10,
                }}
              >
                <Spin size="large" />
              </div>
            )}
            {tableData.length > 0 && tableColumns.length > 0 ? (
              <Table
                dataSource={tableData}
                columns={tableColumns}
                pagination={false}
                size="small"
                style={{ width: "100%", height: "100%" }}
                scroll={{ y: "calc(100% - 40px)" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#999",
                }}
              >
                请配置数据源
              </div>
            )}
          </div>
        );
      // DataV 组件
      case "scrollBoard": {
        // ScrollBoard 需要正确的配置格式，确保数据格式正确
        const scrollBoardConfig = {
              header: component.dataSource?.dataVData?.header || ["列1", "列2", "列3"],
              data: component.dataSource?.dataVData?.data || [],
              rowNum: component.dataSource?.dataVData?.rowNum || 5,
          headerBGC: component.dataSource?.dataVData?.headerBGC || "#00BAFF",
          oddRowBGC: component.dataSource?.dataVData?.oddRowBGC || "#003B51",
          evenRowBGC: component.dataSource?.dataVData?.evenRowBGC || "#0A2732",
          waitTime: component.dataSource?.dataVData?.waitTime || 2000,
          headerHeight: component.dataSource?.dataVData?.headerHeight || 35,
          rowHeight: component.dataSource?.dataVData?.rowHeight || 30,
        };
        
        // 确保 data 是二维数组格式
        if (!Array.isArray(scrollBoardConfig.data) || scrollBoardConfig.data.length === 0) {
          scrollBoardConfig.data = [
            ["数据1", "100", "正常"],
            ["数据2", "200", "正常"],
            ["数据3", "150", "警告"],
          ];
        }
        
        // 确保 header 和 data 的列数匹配
        if (scrollBoardConfig.data.length > 0 && scrollBoardConfig.data[0].length !== scrollBoardConfig.header.length) {
          // 如果列数不匹配，调整 header
          const colCount = scrollBoardConfig.data[0].length;
          scrollBoardConfig.header = Array.from({ length: colCount }, (_, i) => `列${i + 1}`);
        }
        
        return (
          <ScrollBoard
            config={scrollBoardConfig}
            style={{ width: "100%", height: "100%" }}
          />
        );
      }
      case "digitalFlop": {
        const fontSize = component.style?.fontSize || 36;
        const titleFontSize = component.style?.titleFontSize || 16;
        const title = component.title || "";
        const componentId = `digital-flop-${component.id}`;
        
        return (
          <div style={{ 
            width: "100%", 
            height: "100%", 
            display: "flex", 
            flexDirection: "column",
            padding: 12,
            boxSizing: "border-box",
          }}>
            {title && (
              <div style={{ 
                fontSize: titleFontSize, 
                fontWeight: 500, 
                marginBottom: 8,
                color: "#fff",
                textAlign: "center",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {title}
              </div>
            )}
            <div 
              id={componentId}
              style={{ 
                flex: 1, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                position: "relative",
              }}
            >
          <DigitalFlop
            config={{
              number: component.dataSource?.dataVData?.number || [0],
              content: component.dataSource?.dataVData?.content || "{nt}",
            }}
            style={{ width: "100%", height: "100%" }}
          />
              <style dangerouslySetInnerHTML={{ __html: `
                #${componentId} .dv-digital-flop {
                  font-size: ${fontSize}px !important;
                }
                #${componentId} .dv-digital-flop .number-item,
                #${componentId} .dv-digital-flop .number-item-value {
                  font-size: ${fontSize}px !important;
                  line-height: ${fontSize * 1.2}px !important;
                }
              `}} />
            </div>
          </div>
        );
      }
      case "waterLevelPond":
        return (
          <WaterLevelPond
            config={{
              shape: component.dataSource?.dataVData?.shape || "roundRect",
              percent: component.dataSource?.dataVData?.percent || 0.5,
            }}
            style={{ width: "100%", height: "100%" }}
          />
        );
      case "scrollRankingBoard":
        return (
          <ScrollRankingBoard
            config={{
              data: component.dataSource?.dataVData?.data || [],
            }}
            style={{ width: "100%", height: "100%" }}
          />
        );
      case "capsuleChart":
        return (
          <CapsuleChart
            config={{
              data: component.dataSource?.dataVData?.data || [],
            }}
            style={{ width: "100%", height: "100%" }}
          />
        );
      case "activeRingChart":
        return (
          <ActiveRingChart
            config={{
              data: component.dataSource?.dataVData?.data || [],
            }}
            style={{ width: "100%", height: "100%" }}
          />
        );
      case "conicalColumnChart":
        return (
          <ConicalColumnChart
            config={{
              data: component.dataSource?.dataVData?.data || [],
            }}
            style={{ width: "100%", height: "100%" }}
          />
        );
      case "percentPond":
        return (
          <PercentPond
            config={{
              value: component.dataSource?.dataVData?.value || 0.5,
            }}
            style={{ width: "100%", height: "100%" }}
          />
        );
      default:
        return null;
    }
  };

  const handleResizeStart = (e?: any) => {
    // 阻止事件冒泡，防止触发拖拽
    if (e) {
      e.stopPropagation();
    }
    setIsResizing(true);
    // 保存缩放开始时的初始尺寸
    resizeStartSizeRef.current = { width: component.width, height: component.height };
  };

  const handleResize = (e: any, { size }: { size: { width: number; height: number } }) => {
    // 阻止事件冒泡，防止触发拖拽
    if (e) {
      e.stopPropagation();
    }
    // 如果没有初始尺寸，使用当前 component 尺寸
    const startSize = resizeStartSizeRef.current || { width: component.width, height: component.height };
    
    // react-resizable 返回的 size 是基于 DOM 坐标系的
    // 当画布有 transform: scale() 时：
    // - 鼠标移动的视觉距离 = DOM 距离 / scale
    // - react-resizable 计算的 size 是基于 DOM 距离的
    // - 所以我们需要将 size 转换为逻辑尺寸（不受 scale 影响的尺寸）
    
    // 计算增量（基于缩放开始时的初始尺寸）
    const widthDelta = size.width - startSize.width;
    const heightDelta = size.height - startSize.height;
    
    // 将 DOM 增量转换为逻辑增量
    const logicalWidthDelta = widthDelta / canvasScale;
    const logicalHeightDelta = heightDelta / canvasScale;
    
    // 计算新的逻辑尺寸
    const newWidth = startSize.width + logicalWidthDelta;
    const newHeight = startSize.height + logicalHeightDelta;
    
    console.log("【组件缩放】画布缩放:", canvasScale, "初始尺寸:", startSize.width, startSize.height, "react-resizable返回尺寸:", size.width, size.height, "DOM增量:", widthDelta, heightDelta, "逻辑增量:", logicalWidthDelta, logicalHeightDelta, "新逻辑尺寸:", newWidth, newHeight);
    
    onUpdate({
      width: Math.max(100, newWidth),
      height: Math.max(100, newHeight),
    });
  };

  const content = (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        border:
          component.type === "decoration"
            ? "none"
            : isSelected
              ? "2px solid #1890ff"
              : "1px solid rgba(255,255,255,0.2)",
        borderRadius:
          component.type === "decoration"
            ? 0
            : component.style?.borderRadius || 4,
        backgroundColor:
          component.type === "decoration" || component.type === "text" || component.type === "datetime"
            ? "transparent"
            : component.style?.backgroundColor || "rgba(255,255,255,0.05)",
        padding:
          component.type === "decoration" || component.type === "text" || component.type === "datetime"
            ? 0
            : component.style?.padding || 12,
        boxShadow:
          component.type === "decoration"
            ? "none"
            : isSelected
                ? "0 0 0 2px rgba(24,144,255,0.2)"
                : "none",
        overflow: "hidden",
      }}
      onClick={(e) => {
        e.stopPropagation();
      onSelect(e);
    }}
    onMouseDown={(e) => {
      // 如果点击的是缩放手柄区域，不触发拖拽
      const target = e.target as HTMLElement;
      if (target.closest('.react-resizable-handle')) {
        e.stopPropagation();
        return;
      }
    }}
    {...(isResizing ? {} : listeners)}
    {...(isResizing ? {} : attributes)}
    >
      {renderContent()}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        position: "absolute",
      }}
      // 外层容器在缩放时禁用拖拽事件
      {...(isResizing ? {} : {})}
    >
      {/* 删除和复制按钮 - 放在 Resizable 外部，确保可见 */}
      {isSelected && (
        <div
          style={{
            position: "absolute",
            top: -32,
            right: 0,
            background: "#1890ff",
            padding: "4px 8px",
            borderRadius: "4px 4px 0 0",
            display: "flex",
            gap: 4,
            zIndex: 10000,
            pointerEvents: "auto",
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onCopy();
            }}
            style={{ color: "#fff", pointerEvents: "auto" }}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDelete();
            }}
            style={{ color: "#fff", pointerEvents: "auto" }}
          />
        </div>
      )}
      <Resizable
        width={component.width}
        height={component.height}
        onResizeStart={(e) => handleResizeStart(e)}
      onResize={(e, data) => handleResize(e, data)}
        onResizeStop={(e, data) => {
          // 阻止事件冒泡，防止触发拖拽
          if (e) {
            e.stopPropagation();
          }
          // 使用初始尺寸计算最终尺寸
          const startSize = resizeStartSizeRef.current || { width: component.width, height: component.height };
          const widthDelta = data.size.width - startSize.width;
          const heightDelta = data.size.height - startSize.height;
          const logicalWidthDelta = widthDelta / canvasScale;
          const logicalHeightDelta = heightDelta / canvasScale;
          const newWidth = startSize.width + logicalWidthDelta;
          const newHeight = startSize.height + logicalHeightDelta;
          console.log("【组件缩放】缩放结束 - 画布缩放:", canvasScale, "初始尺寸:", startSize.width, startSize.height, "react-resizable尺寸:", data.size, "DOM增量:", widthDelta, heightDelta, "逻辑增量:", logicalWidthDelta, logicalHeightDelta, "新逻辑尺寸:", newWidth, newHeight);
          onUpdate({
            width: Math.max(100, newWidth),
            height: Math.max(100, newHeight),
          });
          // 清除初始尺寸引用
          resizeStartSizeRef.current = null;
          setIsResizing(false);
        }}
        minConstraints={[100, 100]}
        maxConstraints={[2000, 2000]}
        resizeHandles={isSelected ? ["se"] : []}
        handleStyles={{
          se: isSelected ? {
                right: 0,
            bottom: 0,
            width: "20px",
            height: "20px",
                background: "#1890ff",
                border: "2px solid #fff",
                borderRadius: "2px 0 0 0",
                zIndex: 10001,
            cursor: "nwse-resize",
            boxShadow: "0 0 4px rgba(24, 144, 255, 0.5)",
                pointerEvents: "auto",
          } : {},
              }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
          }}
        >
          {content}
        </div>
      </Resizable>
    </div>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数，只在关键属性变化时重新渲染
  return (
    prevProps.component.id === nextProps.component.id &&
    prevProps.component.x === nextProps.component.x &&
    prevProps.component.y === nextProps.component.y &&
    prevProps.component.width === nextProps.component.width &&
    prevProps.component.height === nextProps.component.height &&
    prevProps.component.zIndex === nextProps.component.zIndex &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.component.type === nextProps.component.type
  );
});

DraggableComponent.displayName = "DraggableComponent";

// 获取边框组件
const getBorderComponent = (type: DecorationType): React.ComponentType<any> | null => {
  switch (type) {
    case "borderBox1":
      return BorderBox1;
    case "borderBox2":
      return BorderBox2;
    case "borderBox3":
      return BorderBox3;
    case "borderBox4":
      return BorderBox4;
    case "borderBox5":
      return BorderBox5;
    case "borderBox6":
      return BorderBox6;
    case "borderBox7":
      return BorderBox7;
    case "borderBox8":
      return BorderBox8;
    case "borderBox9":
      return BorderBox9;
    case "borderBox10":
      return BorderBox10;
    case "borderBox11":
      return BorderBox11;
    case "borderBox12":
      return BorderBox12;
    case "borderBox13":
      return BorderBox13;
    default:
      return null;
  }
};

// 渲染装饰组件
const renderDecoration = (type: DecorationType) => {
  const props = { style: { width: "100%", height: "100%" } };
  // BorderBox 组件需要 children 才能正确显示边框效果
  const borderBoxProps = { ...props, className: "border-box-content" };
  switch (type) {
    case "borderBox1":
      return <BorderBox1 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox1>;
    case "borderBox2":
      return <BorderBox2 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox2>;
    case "borderBox3":
      return <BorderBox3 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox3>;
    case "borderBox4":
      return <BorderBox4 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox4>;
    case "borderBox5":
      return <BorderBox5 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox5>;
    case "borderBox6":
      return <BorderBox6 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox6>;
    case "borderBox7":
      return <BorderBox7 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox7>;
    case "borderBox8":
      return <BorderBox8 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox8>;
    case "borderBox9":
      return <BorderBox9 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox9>;
    case "borderBox10":
      return <BorderBox10 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox10>;
    case "borderBox11":
      return <BorderBox11 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox11>;
    case "borderBox12":
      return <BorderBox12 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox12>;
    case "borderBox13":
      return <BorderBox13 {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></BorderBox13>;
    case "decoration1":
      return <Decoration1 {...props} />;
    case "decoration2":
      return <Decoration2 {...props} />;
    case "decoration3":
      return <Decoration3 {...props} />;
    case "decoration4":
      return <Decoration4 {...props} />;
    case "decoration5":
      return <Decoration5 {...props} />;
    case "decoration6":
      return <Decoration6 {...props} />;
    case "decoration7":
      return <Decoration7 {...props} />;
    case "decoration8":
      return <Decoration8 {...props} />;
    case "decoration9":
      return <Decoration9 {...props} />;
    case "decoration10":
      return <Decoration10 {...props} />;
    default:
      return null;
  }
};

