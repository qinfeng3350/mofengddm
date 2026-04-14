// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Layout, Input, Button, Space, message, Drawer, Dropdown, Avatar, Typography, Modal, Form, Table, Popconfirm, Spin, Card } from "antd";
import {
  PlusOutlined,
  DownloadOutlined, 
  UploadOutlined, 
  DeleteOutlined, 
  QrcodeOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  SearchOutlined,
  SettingOutlined,
  FileTextOutlined,
  MoreOutlined,
  DashboardOutlined,
  ApartmentOutlined,
  ThunderboltOutlined,
  EditOutlined,
  HolderOutlined,
  PrinterOutlined,
  CommentOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  EllipsisOutlined,
  HomeOutlined,
} from "@ant-design/icons";
import { UserAccountDropdown } from "@/components/UserAccountDropdown";
import { FormDataList } from "@/components/FormDataList";
import { FormRenderer } from "@/components/FormRenderer";
import { WorkflowInstancePanel } from "@/components/WorkflowInstancePanel";
import { PrintRecordModal } from "@/components/PrintRecordModal";
import { IconSelector } from "@/components/IconSelector";
import { renderIcon } from "@/utils/iconRenderer";
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
  DigitalFlop,
  WaterLevelPond,
  ScrollRankingBoard,
  CapsuleChart,
  ActiveRingChart,
  ConicalColumnChart,
  PercentPond,
} from "@jiaminghi/data-view-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { formDefinitionApi } from "@/api/formDefinition";
import type { FormDefinitionResponse } from "@/api/formDefinition";
import { applicationApi } from "@/api/application";
import { formDataApi } from "@/api/formData";
import { workflowApi } from "@/api/workflow";
import { useAuthStore } from "@/store/useAuthStore";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useIsMobile } from "@/hooks/useIsMobile";
import dayjs from "dayjs";
import styles from "./RuntimeListPage.module.css";
import { convertToDataVData } from "@/modules/datav-designer/DataVDesigner";

// 实时时间显示组件（支持自定义样式，默认用于报表和数据大屏）
const RealtimeTimeDisplay = ({
  format,
  style,
}: {
  format: string;
  style?: React.CSSProperties;
}) => {
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

  const baseStyle: React.CSSProperties = {
    height: "100%",
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    fontWeight: "normal",
    color: "#1890ff",
    padding: "8px 0",
  };

  return <div style={{ ...baseStyle, ...style }}>{formattedTime}</div>;
};

const { Sider, Content } = Layout;

// 可拖拽宽度的 Drawer 包装组件
const ResizableDrawer: React.FC<React.ComponentProps<typeof Drawer>> = (props) => {
  const [width, setWidth] = useState<number>(960);
  const minWidth = 720;
  const maxWidth = 1400;

  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    resizingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const delta = startXRef.current - e.clientX;
    let next = startWidthRef.current + delta;
    if (next < minWidth) next = minWidth;
    if (next > maxWidth) next = maxWidth;
    setWidth(next);
  };

  const onMouseUp = () => {
    resizingRef.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <Drawer
      {...props}
      size={width as any}
      style={{ ...(props.style || {}), position: "relative" }}
    >
      {props.children}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 6,
          height: "100%",
          cursor: "col-resize",
          zIndex: 1000,
        }}
        onMouseDown={onMouseDown}
      />
    </Drawer>
  );
};

export const RuntimeListPage = () => {
  usePageTitle("数据管理 - 墨枫低代码平台");
  const { appId } = useParams<{ appId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedFormId, setSelectedFormId] = useState<string>(
    searchParams.get("formId") || ""
  );
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [viewDrawerOpen, setViewDrawerOpen] = useState(false);
  const [viewingRecordId, setViewingRecordId] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingAppName, setEditingAppName] = useState(false);
  const [appNameValue, setAppNameValue] = useState("");
  const [editFormModalOpen, setEditFormModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const [editFormForm] = Form.useForm();
  const [filterManageModalOpen, setFilterManageModalOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("全部");
  const [newFormModalOpen, setNewFormModalOpen] = useState(false);
  const [groups, setGroups] = useState<Array<{ id: string; name: string; formIds: string[] }>>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(["ungroup", "reports", "datavScreens"]));
  const [editingGroupId, setEditingGroupId] = useState<string>();
  const [editingGroupName, setEditingGroupName] = useState("");
  const [draggingFormId, setDraggingFormId] = useState<string>();
  const [draggingGroupId, setDraggingGroupId] = useState<string>();
  const [ungroupOrder, setUngroupOrder] = useState<string[]>([]);
  const [reports, setReports] = useState<
    Array<{ reportId: string; reportName: string }>
  >([]);
  const [datavScreens, setDatavScreens] = useState<
    Array<{ screenId: string; screenName: string }>
  >([]);
  const [selectedDatavScreenId, setSelectedDatavScreenId] = useState<string | null>(
    searchParams.get("datavScreenId") || null
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(
    searchParams.get("reportId") || null
  );
  const [reportWidgets, setReportWidgets] = useState<any[]>([]);
  const [reportDataMap, setReportDataMap] = useState<Record<string, any>>({});
  const [reportLoading, setReportLoading] = useState(false);
  const [datavScreenConfig, setDatavScreenConfig] = useState<any | null>(null);
  const [datavComponents, setDatavComponents] = useState<any[]>([]);
  const [datavLoading, setDatavLoading] = useState(false);
  const [datavChartData, setDatavChartData] = useState<Record<string, any>>({});
  const [datavTableDataMap, setDatavTableDataMap] = useState<Record<string, { columns: any[]; data: any[] }>>({});

  // 若从 URL 直接携带 recordId 打开抽屉，但未选择表单，则根据记录拉取其 formId
  const { data: viewingRecord } = useQuery({
    queryKey: ["formData", "forDrawer", viewingRecordId],
    queryFn: () => formDataApi.getById(viewingRecordId!),
    enabled: !!viewingRecordId,
  });
  const effectiveFormId = selectedFormId || viewingRecord?.formId || "";

  const [printModalOpen, setPrintModalOpen] = useState(false);

  // 查看/打印时按记录上的 formId 拉定义（避免未选中左侧表单时 selectedFormId 为空）
  const { data: formDefinitionForEffective } = useQuery({
    queryKey: ["formDefinition", effectiveFormId],
    queryFn: () => formDefinitionApi.getById(effectiveFormId!),
    enabled: !!effectiveFormId && (!!viewDrawerOpen || printModalOpen),
  });

  // 与 WorkflowInstancePanel 共用缓存：流程进行中时不显示「编辑」
  const { data: workflowInstanceRaw } = useQuery({
    queryKey: ["workflow-instance", viewingRecordId],
    queryFn: () => workflowApi.getInstanceByRecord(viewingRecordId!),
    enabled: !!viewingRecordId && viewDrawerOpen,
    retry: false,
  });
  const workflowInstanceView = (workflowInstanceRaw as any)?.data ?? workflowInstanceRaw;
  /** 运行中默认隐藏编辑；退回发起节点后仅发起人可改单再提，需显示「编辑」 */
  const hideEditWhileWorkflowRunning = useMemo(() => {
    const status = workflowInstanceView?.status;
    if (status !== "running") return false;
    const defNodes = (workflowInstanceView?.definition?.nodes || []) as { type?: string; nodeId?: string }[];
    const startNodeId = defNodes.find((n) => n.type === "start")?.nodeId;
    const atStartNode =
      !!startNodeId && workflowInstanceView?.currentNodeId === startNodeId;
    const startHist = (workflowInstanceView?.history || []).find((h: any) => h.type === "start");
    const initiatorId = startHist?.userId
      ? String(startHist.userId)
      : viewingRecord?.submitterId != null
        ? String(viewingRecord.submitterId)
        : null;
    const uid = user?.id != null ? String(user.id) : null;
    const initiatorCanEdit = atStartNode && initiatorId && uid && initiatorId === uid;
    if (initiatorCanEdit) return false;
    return true;
  }, [workflowInstanceView, viewingRecord, user]);

  // 获取应用信息
  const { data: appInfo } = useQuery({
    queryKey: ["application", appId],
    queryFn: () => applicationApi.getById(appId!),
    enabled: !!appId,
  });

  // 从 URL 参数同步 selectedReportId、selectedFormId、selectedDatavScreenId，并处理直接打开记录详情
  useEffect(() => {
    const reportIdFromUrl = searchParams.get("reportId");
    const formIdFromUrl = searchParams.get("formId");
    const datavScreenIdFromUrl = searchParams.get("datavScreenId");
    const recordIdFromUrl = searchParams.get("recordId");
    
    if (datavScreenIdFromUrl) {
      setSelectedDatavScreenId(datavScreenIdFromUrl);
      setSelectedFormId("");
      setSelectedReportId(null);
    } else if (reportIdFromUrl) {
      setSelectedReportId(reportIdFromUrl);
      setSelectedFormId("");
      setSelectedDatavScreenId(null);
    } else if (formIdFromUrl) {
      setSelectedFormId(formIdFromUrl);
      setSelectedReportId(null);
      setSelectedDatavScreenId(null);
    } else {
      // 如果 URL 中既没有 reportId 也没有 formId，保持当前状态不变
    }

    if (recordIdFromUrl) {
      setViewingRecordId(recordIdFromUrl);
      setViewDrawerOpen(true);
    }
  }, [searchParams]);

  // 从应用的metadata中恢复分组数据
  useEffect(() => {
    if (appInfo) {
      setAppNameValue(appInfo.name);
      // 从metadata中恢复分组数据
      if (appInfo.metadata?.formGroups && Array.isArray(appInfo.metadata.formGroups)) {
        console.log("恢复分组数据:", appInfo.metadata.formGroups);
        setGroups(appInfo.metadata.formGroups);
      }
      if (appInfo.metadata?.ungroupOrder && Array.isArray(appInfo.metadata.ungroupOrder)) {
        console.log("恢复未分组顺序:", appInfo.metadata.ungroupOrder);
        setUngroupOrder(appInfo.metadata.ungroupOrder);
      }
      if (appInfo.metadata?.reports && Array.isArray(appInfo.metadata.reports)) {
        setReports(
          appInfo.metadata.reports.map((r: any) => ({
            reportId: r.reportId,
            // 兼容老数据：优先用顶层 reportName，其次用 config 里的 reportName，不再强制默认值
            reportName: r.reportName ?? (r.config && r.config.reportName) ?? "",
          })),
        );
      }
      if (appInfo.metadata?.datavScreens && Array.isArray(appInfo.metadata.datavScreens)) {
        setDatavScreens(
          appInfo.metadata.datavScreens.map((s: any) => ({
            screenId: s.screenId,
            screenName: s.screenName || "未命名大屏",
          })),
        );
      }
    }
  }, [appInfo]);

  const handleDeleteReport = async (reportId: string) => {
    if (!appId) return;
    try {
      const current = await applicationApi.getById(appId);
      const metadata = current.metadata || {};
      const originReports: any[] = Array.isArray(metadata.reports)
        ? metadata.reports
        : [];
      const nextReports = originReports.filter(
        (r: any) => r.reportId !== reportId,
      );
      await applicationApi.update(appId, {
        metadata: {
          ...metadata,
          reports: nextReports,
        },
      });
      setReports(nextReports.map((r: any) => ({
        reportId: r.reportId,
        reportName: r.reportName ?? (r.config && r.config.reportName) ?? "",
      })));
      await queryClient.invalidateQueries({ queryKey: ["application", appId] });
      message.success("删除报表成功");
    } catch (e) {
      console.error(e);
      message.error("删除报表失败");
    }
  };

  const handleDeleteDatavScreen = async (screenId: string) => {
    if (!appId) return;
    try {
      const current = await applicationApi.getById(appId);
      const metadata = current.metadata || {};
      const originScreens: any[] = Array.isArray(metadata.datavScreens)
        ? metadata.datavScreens
        : [];
      const nextScreens = originScreens.filter(
        (s: any) => s.screenId !== screenId,
      );
      await applicationApi.update(appId, {
        metadata: {
          ...metadata,
          datavScreens: nextScreens,
        },
      });
      setDatavScreens(nextScreens.map((s: any) => ({
        screenId: s.screenId,
        screenName: s.screenName || "未命名大屏",
      })));
      await queryClient.invalidateQueries({ queryKey: ["application", appId] });
      message.success("删除数据大屏成功");
    } catch (e) {
      console.error(e);
      message.error("删除数据大屏失败");
    }
  };

  // 保存分组数据到应用的metadata
  const saveGroupsToMetadata = async (groupsToSave: typeof groups, ungroupOrderToSave: typeof ungroupOrder) => {
    if (!appId) return;
    try {
      // 获取最新的应用信息
      const currentAppInfo = appInfo || await applicationApi.getById(appId);
      const currentMetadata = currentAppInfo.metadata || {};
      
      console.log("保存分组数据:", { groupsToSave, ungroupOrderToSave });
      
      const updatedMetadata = {
        ...currentMetadata,
        formGroups: groupsToSave,
        ungroupOrder: ungroupOrderToSave,
      };
      
      await applicationApi.update(appId, {
        metadata: updatedMetadata,
      });
      
      // 刷新查询缓存，确保下次加载时能获取最新数据
      await queryClient.invalidateQueries({ queryKey: ["application", appId] });
      
      console.log("分组数据保存成功");
    } catch (error) {
      console.error("保存分组数据失败:", error);
      message.error("保存分组数据失败");
    }
  };

  // 处理应用名称编辑
  const handleAppNameEdit = () => {
    setEditingAppName(true);
  };

  const handleAppNameSave = async () => {
    if (!appId || !appNameValue.trim()) {
      message.warning("应用名称不能为空");
      return;
    }
    try {
      await applicationApi.update(appId, { name: appNameValue.trim() });
      message.success("应用名称更新成功");
      setEditingAppName(false);
      queryClient.invalidateQueries({ queryKey: ["application", appId] });
    } catch (error) {
      message.error("更新失败，请重试");
      console.error(error);
    }
  };

  const handleAppNameCancel = () => {
    setAppNameValue(appInfo?.name || "");
    setEditingAppName(false);
  };

  // 加载选中报表的所有组件配置和数据，用于在当前页面内展示报表
  useEffect(() => {
    if (!appId || !selectedReportId) {
      setReportWidgets([]);
      setReportDataMap({});
      return;
    }

    (async () => {
      try {
        setReportLoading(true);
        const app = await applicationApi.getById(appId);
        const list: any[] = Array.isArray(app.metadata?.reports)
          ? app.metadata!.reports
          : [];
        const report =
          list.find((r) => r.reportId === selectedReportId) || list[0];
        if (!report || !report.widgets?.length) {
          message.warning("报表中没有配置组件");
          setReportWidgets([]);
          setReportDataMap({});
          return;
        }

        // 加载表单列表以查找正确的 formId
        const formsList = await formDefinitionApi.getListByApplication(appId);
        
        // 加载所有组件
        const widgetsList = report.widgets || [];
        console.log("RuntimeListPage - 报表中的组件列表:", widgetsList.length, "个组件");
        setReportWidgets(widgetsList);

        // 为每个组件加载数据
        const newDataMap: Record<string, any> = {};
        widgetsList.forEach(widget => {
          newDataMap[widget.id] = null; // 先初始化为 null
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
              // 数据表数据 - 复用 RuntimeReportPage 的逻辑
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
              // 图表数据 - 复用 RuntimeReportPage 的逻辑
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
        
        console.log("RuntimeListPage - 数据加载完成，数据映射:", Object.keys(newDataMap).length, "个组件有数据");
        setReportDataMap(newDataMap);
      } catch (e) {
        console.error("RuntimeListPage - 加载报表数据失败:", e);
        message.error("加载报表数据失败");
        setReportWidgets([]);
        setReportDataMap({});
      } finally {
        setReportLoading(false);
      }
    })();
  }, [appId, selectedReportId]);

  // 加载数据大屏配置和组件
  useEffect(() => {
    if (!appId || !selectedDatavScreenId) {
      setDatavScreenConfig(null);
      setDatavComponents([]);
      setDatavChartData({});
      setDatavTableDataMap({});
      return;
    }

    (async () => {
      setDatavLoading(true);
      try {
        const app = await applicationApi.getById(appId);
        const screens = (app.metadata?.datavScreens as any[]) || [];
        
        if (!screens.length) {
          message.warning("当前应用还没有配置数据大屏");
          setDatavScreenConfig(null);
          setDatavComponents([]);
          return;
        }

        const screen = screens.find((s) => s.screenId === selectedDatavScreenId);
        if (!screen) {
          message.warning("数据大屏不存在");
          setDatavScreenConfig(null);
          setDatavComponents([]);
          return;
        }

        console.log("【加载数据大屏】找到大屏配置:", {
          screenId: screen.screenId,
          screenName: screen.screenName,
          componentsCount: screen.components?.length || 0,
          components: screen.components,
        });

        setDatavScreenConfig(screen);
        // 先设置组件，数据加载完成后会更新为包含数据的组件
        // setDatavComponents(screen.components || []);

        // 加载所有图表和表格的数据
        const chartDataMap: Record<string, any> = {};
        const tableDataMap: Record<string, { columns: any[]; data: any[] }> = {};
        const updatedComponents: any[] = [];
        
        for (const component of screen.components || []) {
          const updatedComponent = { ...component };
          if (component.type === "chart" && component.dataSource?.formId && component.dataSource?.xFieldId && component.dataSource?.yFieldId) {
            try {
              console.log("【数据大屏预览】开始加载图表数据:", {
                id: component.id,
                title: component.title,
                chartType: component.chartType,
                dataSource: component.dataSource,
              });
              const rows = await formDataApi.getListByForm(component.dataSource.formId);
              const xData: string[] = [];
              const yData: number[] = [];

              (rows || []).forEach((row: any) => {
                const data = row.data || {};
                xData.push(String(data[component.dataSource!.xFieldId!] ?? ""));
                const v = Number(data[component.dataSource!.yFieldId!] ?? 0);
                yData.push(Number.isFinite(v) ? v : 0);
              });

              const baseOption = component.echartsOption || {};
              const chartType = component.chartType || "bar";

              let option: any = { ...baseOption };
              if (chartType === "pie") {
                option = {
                  ...baseOption,
                  tooltip: { trigger: "item" },
                  series: [{
                    type: "pie",
                    data: xData.map((name, idx) => ({ name, value: yData[idx] ?? 0 })),
                    ...(baseOption.series?.[0] || {}),
                  }],
                };
              } else {
                option = {
                  ...baseOption,
                  xAxis: { type: "category", data: xData },
                  yAxis: { type: "value" },
                  series: [{
                    type: chartType,
                    data: yData,
                    ...(baseOption.series?.[0] || {}),
                  }],
                };
              }
              
              console.log("【数据大屏预览】生成图表配置:", {
                id: component.id,
                chartType,
                xData,
                yData,
                option,
              });
              chartDataMap[component.id] = option;
            } catch (e) {
              console.error(`加载图表 ${component.id} 数据失败:`, e);
            }
          }
          
          if (component.type === "table" && component.dataSource?.formId) {
            try {
              const formDef = await formDefinitionApi.getById(component.dataSource.formId);
              const fields = formDef.fields || [];
              const rows = await formDataApi.getListByForm(component.dataSource.formId);
              
              // 根据选择的字段过滤
              const selectedFieldIds = component.dataSource?.fieldIds || [];
              const filteredFields = selectedFieldIds.length > 0
                ? fields.filter((f: any) => selectedFieldIds.includes(f.fieldId))
                : fields;

              const columns = filteredFields.map((field: any) => ({
                title: field.label || field.fieldName || field.fieldId,
                dataIndex: field.fieldId,
                key: field.fieldId,
                ellipsis: true,
              }));

              const data = (rows || []).slice(0, component.dataSource?.rowNum || 100).map((row: any, index: number) => {
                const record: any = { key: index };
                const rowData = row.data || {};
                filteredFields.forEach((field: any) => {
                  record[field.fieldId] = rowData[field.fieldId] ?? "";
                });
                return record;
              });

              tableDataMap[component.id] = { columns, data };
            } catch (e) {
              console.error(`加载表格 ${component.id} 数据失败:`, e);
            }
          }
          
          // 加载 DataV 组件的数据（scrollBoard, digitalFlop 等）
          if (["scrollBoard", "digitalFlop", "waterLevelPond", "scrollRankingBoard", "capsuleChart", "activeRingChart", "conicalColumnChart", "percentPond"].includes(component.type) && component.dataSource?.formId) {
            try {
              const formDef = await formDefinitionApi.getById(component.dataSource.formId);
              
              // 收集所有字段（包括嵌套字段）
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
              
              const rows = await formDataApi.getListByForm(component.dataSource.formId);
              
              // 转换数据为 DataV 格式
              const dataVData = convertToDataVData(updatedComponent.type as any, rows, updatedComponent.dataSource, allFields);
              
              // 更新组件配置中的 dataVData
              updatedComponent.dataSource = {
                ...updatedComponent.dataSource,
                dataVData,
              };
              
              console.log(`【预览页面】加载 DataV 组件 ${updatedComponent.id} 数据:`, {
                type: updatedComponent.type,
                hasDataVData: !!dataVData,
                dataVData,
              });
            } catch (e) {
              console.error(`加载 DataV 组件 ${updatedComponent.id} 数据失败:`, e);
            }
          }
          
          updatedComponents.push(updatedComponent);
        }
        
        setDatavChartData(chartDataMap);
        setDatavTableDataMap(tableDataMap);
        setDatavComponents(updatedComponents);
      } catch (e) {
        console.error("加载数据大屏失败:", e);
        message.error("加载数据大屏失败");
        setDatavScreenConfig(null);
        setDatavComponents([]);
      } finally {
        setDatavLoading(false);
      }
    })();
  }, [appId, selectedDatavScreenId]);

  // 获取应用下的表单列表（左侧导航）
  const { data: forms } = useQuery({
    queryKey: ["applicationForms", appId],
    queryFn: () => formDefinitionApi.getListByApplication(appId!),
    enabled: !!appId,
  });

  const formMap = useMemo(() => {
    const map = new Map<string, FormDefinitionResponse>();
    forms?.forEach((form) => {
      map.set(form.formId, form);
    });
    return map;
  }, [forms]);

  useEffect(() => {
    if (!forms) return;
    const groupedIds = new Set(groups.flatMap((group) => group.formIds));
    const allFormIds = forms.map((form) => form.formId);
    setUngroupOrder((prev) => {
      const filtered = prev.filter((id) => allFormIds.includes(id) && !groupedIds.has(id));
      const filteredSet = new Set(filtered);
      allFormIds.forEach((id) => {
        if (!groupedIds.has(id) && !filteredSet.has(id)) {
          filtered.push(id);
          filteredSet.add(id);
        }
      });
      return filtered;
    });
  }, [forms, groups]);

  // 获取当前选中表单的定义
  const { data: formDefinition, refetch: refetchFormDefinition } = useQuery({
    queryKey: ["formDefinition", selectedFormId],
    queryFn: () => formDefinitionApi.getById(selectedFormId),
    enabled: !!selectedFormId,
  });

  // 处理表单选择
  const handleFormSelect = (formId: string) => {
    // 选中表单时，清空当前选中的报表和数据大屏，回到表单数据列表视图
    setSelectedReportId(null);
    setSelectedDatavScreenId(null);
    setSelectedFormId(formId);
    setSearchParams({ formId });
  };

  // 处理报表选择
  const handleReportSelect = (reportId: string) => {
    // 选中报表时，清空当前选中的表单和数据大屏，显示报表内容
    setSelectedReportId(reportId);
    setSelectedFormId("");
    setSelectedDatavScreenId(null);
    // 更新 URL 参数，移除 formId，只保留 reportId
    setSearchParams({ reportId }, { replace: false });
  };

  // 处理数据大屏选择
  const handleDatavScreenSelect = (screenId: string) => {
    // 选中数据大屏时，清空当前选中的表单和报表，显示数据大屏内容
    setSelectedDatavScreenId(screenId);
    setSelectedFormId("");
    setSelectedReportId(null);
    // 更新 URL 参数
    setSearchParams({ datavScreenId: screenId }, { replace: false });
  };

  const handleMoveFormToGroup = (formId: string, targetGroupId?: string, beforeFormId?: string) => {
    let newGroups: typeof groups;
    let newUngroupOrder: typeof ungroupOrder;

    setGroups((prev) => {
      newGroups = prev.map((group) => {
        const filtered = group.formIds.filter((id) => id !== formId);
        if (targetGroupId && group.id === targetGroupId) {
          const next = [...filtered];
          if (beforeFormId) {
            const index = next.indexOf(beforeFormId);
            if (index >= 0) {
              next.splice(index, 0, formId);
            } else {
              next.push(formId);
            }
          } else {
            next.push(formId);
          }
          return { ...group, formIds: next };
        }
        return { ...group, formIds: filtered };
      });
      return newGroups;
    });

    setUngroupOrder((prev) => {
      const next = prev.filter((id) => id !== formId);
      if (!targetGroupId) {
        if (beforeFormId) {
          const index = next.indexOf(beforeFormId);
          if (index >= 0) {
            next.splice(index, 0, formId);
          } else {
            next.push(formId);
          }
        } else {
          next.push(formId);
        }
      }
      newUngroupOrder = next;
      return next;
    });

    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (targetGroupId) {
        next.add(targetGroupId);
      } else {
        next.add("ungroup");
      }
      return next;
    });

    setDraggingFormId(undefined);

    // 保存到后端
    setTimeout(() => {
      saveGroupsToMetadata(newGroups!, newUngroupOrder!);
    }, 0);
  };

  const handleGroupReorder = (targetGroupId: string) => {
    if (!draggingGroupId || draggingGroupId === targetGroupId) return;
    let newGroups: typeof groups;
    setGroups((prev) => {
      const list = [...prev];
      const fromIndex = list.findIndex((group) => group.id === draggingGroupId);
      const toIndex = list.findIndex((group) => group.id === targetGroupId);
      if (fromIndex === -1 || toIndex === -1) {
        return prev;
      }
      const [moved] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, moved);
      newGroups = list;
      return list;
    });
    setDraggingGroupId(undefined);
    // 保存到后端
    setTimeout(() => {
      saveGroupsToMetadata(newGroups!, ungroupOrder);
    }, 0);
  };

  const handleGroupDropAtEnd = () => {
    if (!draggingGroupId) return;
    let newGroups: typeof groups;
    setGroups((prev) => {
      const list = [...prev];
      const fromIndex = list.findIndex((group) => group.id === draggingGroupId);
      if (fromIndex === -1) {
        return prev;
      }
      const [moved] = list.splice(fromIndex, 1);
      list.push(moved);
      newGroups = list;
      return list;
    });
    setDraggingGroupId(undefined);
    // 保存到后端
    setTimeout(() => {
      saveGroupsToMetadata(newGroups!, ungroupOrder);
    }, 0);
  };

  const commitGroupName = (groupId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      message.warning("分组名称不能为空");
      return;
    }
    let newGroups: typeof groups;
    setGroups((prev) => {
      newGroups = prev.map((g) => (g.id === groupId ? { ...g, name: trimmed } : g));
      return newGroups;
    });
    setEditingGroupId(undefined);
    setEditingGroupName("");
    // 保存到后端
    setTimeout(() => {
      saveGroupsToMetadata(newGroups!, ungroupOrder);
    }, 0);
  };

  const renderFormMenuItem = (form: any, groupId?: string) => {
    const formIcon = form.config?.metadata?.icon;
    const isActive = selectedFormId === form.formId;
    return (
      <li
        key={form.formId}
        className={`${styles.menuItem} ${styles.nodeItem} ${styles.schemaItem} ${isActive ? styles.current : ""}`}
        data-draggable="true"
        draggable
        onDragStart={(e) => {
          setDraggingFormId(form.formId);
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.dropEffect = "move";
          e.dataTransfer.setData("text/plain", form.formId);
        }}
        onDragEnd={() => setDraggingFormId(undefined)}
        onDragOver={(e) => {
          if (!draggingFormId || draggingFormId === form.formId) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          if (!draggingFormId || draggingFormId === form.formId) return;
          e.preventDefault();
          handleMoveFormToGroup(draggingFormId, groupId, form.formId);
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest(".form-menu-trigger")) {
            return;
          }
          handleFormSelect(form.formId);
        }}
      >
        <HolderOutlined className={styles.dragIcon} />
        <div className={styles.titleWrap}>
          <div className={styles.top}>
            {renderIcon(formIcon, FileTextOutlined, { style: { width: 14, height: 14, marginRight: 8 } })}
            <span className={styles.nodeName}>{form.formName}</span>
          </div>
        </div>
        <Dropdown
          menu={{
            items: [
              {
                key: "design",
                label: "设计表单",
                icon: <AppstoreOutlined />,
                onClick: () => {
                  if (form.formId && appId) {
                    navigate(`/designer?formId=${form.formId}&appId=${appId}`);
                  }
                },
              },
              {
                key: "edit",
                label: "修改基础信息",
                onClick: async () => {
                  setEditingForm(form);
                  try {
                    const formDetail = await formDefinitionApi.getById(form.formId);
                    const metadata = formDetail.config?.metadata || {};
                    editFormForm.setFieldsValue({
                      formName: form.formName,
                      description: metadata.description || "",
                      icon: metadata.icon || "",
                    });
                  } catch (error) {
                    editFormForm.setFieldsValue({
                      formName: form.formName,
                      description: "",
                      icon: "",
                    });
                  }
                  setEditFormModalOpen(true);
                },
              },
              {
                key: "delete",
                label: "删除",
                danger: true,
                onClick: async () => {
                  try {
                    await formDefinitionApi.delete(form.formId);
                    message.success("删除成功");
                    queryClient.invalidateQueries({ queryKey: ["applicationForms", appId] });
                  } catch (error) {
                    message.error("删除失败");
                  }
                },
              },
            ],
          }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <EllipsisOutlined className={`${styles.settingIcon} form-menu-trigger`} />
        </Dropdown>
      </li>
    );
  };

  const renderReportMenuItem = (report: { reportId: string; reportName: string }) => {
    const isActive = selectedReportId === report.reportId;
    return (
      <li
        key={`report-${report.reportId}`}
        className={`${styles.menuItem} ${styles.nodeItem} ${styles.schemaItem} ${isActive ? styles.current : ""}`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          // 如果点击的是设置按钮或其父元素，不处理
          if (target.closest(".report-menu-trigger") || target.closest(".ant-dropdown")) {
            return;
          }
          // 阻止事件冒泡到父元素（分组标题）
          e.stopPropagation();
          handleReportSelect(report.reportId);
        }}
      >
        {/* 占位符，保持与表单项的拖拽图标对齐 */}
        <HolderOutlined className={styles.dragIcon} style={{ pointerEvents: 'none', cursor: 'default' }} />
        <div className={styles.titleWrap}>
          <div className={styles.top}>
            <BarChartOutlined style={{ width: 14, height: 14, marginRight: 8, color: "#1890ff" }} />
            <span className={styles.nodeName}>{report.reportName || "未命名报表"}</span>
          </div>
        </div>
        <Dropdown
          menu={{
            items: [
              {
                key: "design",
                label: "设计",
                icon: <EditOutlined />,
                onClick: () => {
                  navigate(
                    `/reports/designer?appId=${appId ?? ""}&reportId=${encodeURIComponent(report.reportId)}`,
                  );
                },
              },
              {
                key: "delete",
                label: "删除",
                danger: true,
                onClick: () => {
                  handleDeleteReport(report.reportId);
                },
              },
            ],
          }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <EllipsisOutlined 
            className={`${styles.settingIcon} report-menu-trigger`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        </Dropdown>
      </li>
    );
  };

  const renderDatavScreenMenuItem = (screen: { screenId: string; screenName: string }) => {
    const isActive = selectedDatavScreenId === screen.screenId;
    return (
      <li
        key={`datav-${screen.screenId}`}
        className={`${styles.menuItem} ${styles.nodeItem} ${styles.schemaItem} ${isActive ? styles.current : ""}`}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          // 如果点击的是设置按钮或其父元素，不处理
          if (target.closest(".datav-menu-trigger") || target.closest(".ant-dropdown")) {
            return;
          }
          // 阻止事件冒泡到父元素（分组标题）
          e.stopPropagation();
          // 选择数据大屏，在主内容区域显示
          handleDatavScreenSelect(screen.screenId);
        }}
      >
        {/* 占位符，保持与表单项的拖拽图标对齐 */}
        <HolderOutlined className={styles.dragIcon} style={{ pointerEvents: 'none', cursor: 'default' }} />
        <div className={styles.titleWrap}>
          <div className={styles.top}>
            <DashboardOutlined style={{ width: 14, height: 14, marginRight: 8, color: "#722ed1" }} />
            <span className={styles.nodeName}>{screen.screenName || "未命名大屏"}</span>
          </div>
        </div>
        <Dropdown
          menu={{
            items: [
              {
                key: "design",
                label: "设计",
                icon: <EditOutlined />,
                onClick: () => {
                  navigate(`/datav/designer?appId=${appId ?? ""}&screenId=${encodeURIComponent(screen.screenId)}`);
                },
              },
              {
                key: "preview",
                label: "预览",
                icon: <EyeOutlined />,
                onClick: () => {
                  navigate(`/app/${appId}/datav?screenId=${encodeURIComponent(screen.screenId)}`);
                },
              },
              {
                key: "delete",
                label: "删除",
                danger: true,
                onClick: () => {
                  handleDeleteDatavScreen(screen.screenId);
                },
              },
            ],
          }}
          trigger={["click"]}
          placement="bottomRight"
        >
          <EllipsisOutlined 
            className={`${styles.settingIcon} datav-menu-trigger`}
            onClick={(e) => {
              e.stopPropagation();
            }}
          />
        </Dropdown>
      </li>
    );
  };

  const ungroupForms = useMemo(() => {
    return ungroupOrder
      .map((id) => formMap.get(id))
      .filter((form): form is FormDefinitionResponse => !!form);
  }, [ungroupOrder, formMap]);

  // 仅在初始化时：如果没有选中表单且没有选中报表，默认选中第一个表单
  useEffect(() => {
    // 只在 URL 中没有 formId 和 reportId 时才自动选择第一个表单
    const formIdFromUrl = searchParams.get("formId");
    const reportIdFromUrl = searchParams.get("reportId");
    
    // 如果 URL 中有 reportId，不要自动选择表单
    if (reportIdFromUrl) {
      return;
    }
    
    // 如果 URL 中有 formId 或者已经选中了表单，不要自动选择
    if (formIdFromUrl || selectedFormId) {
      return;
    }
    
    // 只有在真正没有任何选择时才自动选择第一个表单
    if (!selectedReportId && forms && forms.length > 0) {
      handleFormSelect(forms[0].formId);
    }
  }, [forms]); // 只在表单列表加载时执行一次，避免在 URL 变化时重复执行

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {/* 顶部导航栏 */}
      <Layout.Header style={{ 
        padding: isMobile ? "0 12px" : "0 24px", 
        background: "#fff", 
        borderBottom: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
      }}>
        <Space>
          {isMobile && (
            <Button
              type="text"
              icon={<MoreOutlined />}
              onClick={() => setMobileMenuOpen(true)}
              title="菜单"
            />
          )}
          <Button
            type="text" 
            icon={<HomeOutlined />}
            onClick={() => navigate("/home")}
            title="返回首页"
          />
          {appInfo?.metadata?.icon && (
            <div style={{ fontSize: 24, display: "flex", alignItems: "center" }}>
              {renderIcon(appInfo.metadata.icon as string, AppstoreOutlined)}
            </div>
          )}
          {editingAppName ? (
            <Space>
              <Input
                value={appNameValue}
                onChange={(e) => setAppNameValue(e.target.value)}
                onPressEnter={handleAppNameSave}
                onBlur={handleAppNameSave}
                style={{ width: 200 }}
                autoFocus
              />
              <Button size="small" onClick={handleAppNameCancel}>取消</Button>
            </Space>
          ) : (
            <Typography.Text 
              strong 
              style={{ fontSize: 16, cursor: "pointer" }}
              onClick={handleAppNameEdit}
            >
              {appInfo?.name || "应用"}
            </Typography.Text>
          )}
        </Space>
        <Space>
          <Button
            type="text" 
            icon={<AppstoreOutlined />}
            onClick={() => {
              if (!appId) {
                message.warning("请先选择应用");
                return;
              }
              if (!selectedFormId) {
                message.warning("请先选择要设计的表单");
                return;
              }
              navigate(`/designer?formId=${selectedFormId}&appId=${appId}`);
            }}
            disabled={!selectedFormId}
          >
            {isMobile ? "设计" : "设计表单"}
          </Button>
          <UserAccountDropdown showUserName />
        </Space>
      </Layout.Header>

      <Layout>
      {/* 左侧导航栏 - 表单列表 */}
      {isMobile ? (
        <Drawer
          title="菜单"
          placement="left"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          size={300 as any}
          destroyOnHidden
          bodyStyle={{ padding: 0 }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid #f0f0f0" }}>
            <Input
              placeholder="搜索表单"
              prefix={<SearchOutlined />}
              suffix={
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "form",
                        label: "表单",
                        icon: <FileTextOutlined style={{ color: "#52c41a" }} />,
                        onClick: () => {
                          setNewFormModalOpen(true);
                        },
                      },
                      {
                        key: "developer",
                        label: "开发者页面",
                        icon: <ThunderboltOutlined style={{ color: "#722ed1" }} />,
                        onClick: () => {
                          if (!appId) {
                            message.warning("请先选择应用");
                            return;
                          }
                          navigate(`/app/${appId}/developer`);
                        },
                      },
                      {
                        key: "report",
                        label: "报表",
                        icon: <BarChartOutlined style={{ color: "#1890ff" }} />,
                        onClick: () => {
                          navigate(`/reports/designer?appId=${appId ?? ""}`);
                        },
                      },
                      {
                        key: "datav",
                        label: "数据大屏",
                        icon: <DashboardOutlined style={{ color: "#722ed1" }} />,
                        onClick: () => {
                          if (!appId) {
                            message.warning("请先选择应用");
                            return;
                          }
                          navigate(`/datav/designer?appId=${appId}`);
                        },
                      },
                      {
                        key: "report-datav",
                        label: "数据大屏预览",
                        icon: <DashboardOutlined style={{ color: "#722ed1" }} />,
                        onClick: () => {
                          if (!appId) {
                            message.warning("请先选择应用");
                            return;
                          }
                          navigate(`/app/${appId}/datav`);
                        },
                      },
                      {
                        key: "group",
                        label: "分组",
                        icon: <ApartmentOutlined style={{ color: "#faad14" }} />,
                        onClick: () => {
                          const newGroupId = `group_${Date.now()}`;
                          const defaultName = "未命名的分组";
                          let newGroups: typeof groups;
                          setGroups((prev) => {
                            newGroups = [...prev, { id: newGroupId, name: defaultName, formIds: [] }];
                            return newGroups;
                          });
                          setExpandedGroups((prev) => new Set([...prev, newGroupId]));
                          setEditingGroupId(newGroupId);
                          setEditingGroupName(defaultName);
                          setTimeout(() => {
                            saveGroupsToMetadata(newGroups!, ungroupOrder);
                          }, 0);
                        },
                      },
                    ],
                  }}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    size="small"
                    style={{ borderRadius: "50%", width: 24, height: 24, padding: 0 }}
                  />
                </Dropdown>
              }
            />
          </div>
          <div style={{ padding: "0 16px 16px" }}>
            <ul className={styles.menuContainer}>
            {groups.map((group) => {
              const groupForms =
                group.formIds
                  .map((id) => formMap.get(id))
                  .filter((form): form is FormDefinitionResponse => !!form);
              const isExpanded = expandedGroups.has(group.id);
              return (
                <li
                  key={group.id}
                  className={`${styles.menuItem} ${styles.hasGroup}`}
                  data-draggable="true"
                  onDragOver={(e) => {
                    if (draggingGroupId && draggingGroupId !== group.id) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      return;
                    }
                    if (draggingFormId) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(e) => {
                    if (draggingGroupId && draggingGroupId !== group.id) {
                      e.preventDefault();
                      handleGroupReorder(group.id);
                      return;
                    }
                    if (!draggingFormId) return;
                    e.preventDefault();
                    handleMoveFormToGroup(draggingFormId, group.id);
                  }}
                >
                  <div
                    className={`${styles.nodeItem} ${styles.groupItem}`}
                    onClick={() => {
                      const next = new Set(expandedGroups);
                      if (next.has(group.id)) next.delete(group.id);
                      else next.add(group.id);
                      setExpandedGroups(next);
                    }}
                >
                    <HolderOutlined
                      className={styles.dragIcon}
                      draggable
                      onDragStart={(e) => {
                        e.stopPropagation();
                        setDraggingGroupId(group.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.dropEffect = "move";
                        e.dataTransfer.setData("text/plain", group.id);
                      }}
                      onDragEnd={() => setDraggingGroupId(undefined)}
                    />
                    {isExpanded ? (
                      <CaretDownOutlined className={styles.groupNodeIcon} />
                    ) : (
                      <CaretRightOutlined className={styles.groupNodeIcon} />
                    )}
                    {editingGroupId === group.id ? (
                      <Input
                        size="small"
                        autoFocus
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onPressEnter={(e) => {
                          e.stopPropagation();
                          commitGroupName(group.id, editingGroupName);
                        }}
                        onBlur={(e) => {
                          e.stopPropagation();
                          if (editingGroupName.trim()) {
                            commitGroupName(group.id, editingGroupName);
                          } else {
                            setEditingGroupId(undefined);
                            setEditingGroupName("");
                          }
                        }}
                        style={{ flex: 1, marginRight: 8 }}
                      />
                    ) : (
                      <span className={`${styles.nodeName} ${styles.groupName}`}>
                        {group.name} <span className={styles.childrenNum}>({groupForms.length})</span>
                      </span>
                    )}
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: "edit",
                            label: "编辑",
                            icon: <EditOutlined />,
                            onClick: () => {
                              setEditingGroupId(group.id);
                              setEditingGroupName(group.name);
                            },
                          },
                          {
                            key: "delete",
                            label: "删除",
                            danger: true,
                            onClick: async () => {
                              try {
                                const newGroups = groups.filter((g) => g.id !== group.id);
                                setGroups(newGroups);
                                await saveGroupsToMetadata(newGroups, ungroupOrder);
                                message.success("删除成功");
                              } catch (error) {
                                message.error("删除失败");
                              }
                            },
                          },
                        ],
                      }}
                      trigger={["click"]}
                      placement="bottomRight"
                    >
                      <EllipsisOutlined className={styles.settingIcon} />
                    </Dropdown>
          </div>
                  <ul className={styles.subMenu} style={{ display: isExpanded ? "block" : "none" }}>
                    {groupForms.length ? (
                      groupForms.map((form) => {
                        const node = renderFormMenuItem(form, group.id);
                        return React.isValidElement(node)
                          ? React.cloneElement(node as any, {
                              onClick: (...args: any[]) => {
                                (node as any).props?.onClick?.(...args);
                                setMobileMenuOpen(false);
                              },
                            })
                          : node;
                      })
                    ) : (
                      <li style={{ padding: "8px 12px", color: "#999", fontSize: 12 }}>
                        暂无表单，拖动表单到此处
                      </li>
                    )}
                  </ul>
                </li>
              );
            })}

            {/* 未分组的表单列表 */}
            {ungroupForms.length > 0 && (
              <li className={styles.menuItem}>
                <div
                  className={`${styles.nodeItem} ${styles.groupItem}`}
                  onClick={() => {
                    const next = new Set(expandedGroups);
                    if (next.has("ungroup")) {
                      next.delete("ungroup");
                    } else {
                      next.add("ungroup");
                    }
                    setExpandedGroups(next);
                  }}
                >
                  <HolderOutlined
                    className={styles.dragIcon}
                    style={{ pointerEvents: 'none', cursor: 'default' }}
                  />
                  {expandedGroups.has("ungroup") ? (
                    <CaretDownOutlined className={styles.groupNodeIcon} />
                  ) : (
                    <CaretRightOutlined className={styles.groupNodeIcon} />
                  )}
                  <span className={`${styles.nodeName} ${styles.groupName}`}>
                    未分组 <span className={styles.childrenNum}>({ungroupForms.length})</span>
                  </span>
                </div>
                <ul className={styles.subMenu} style={{ display: expandedGroups.has("ungroup") ? "block" : "none" }}>
                  {ungroupForms.map((form) => {
                    const node = renderFormMenuItem(form);
                    return React.isValidElement(node)
                      ? React.cloneElement(node as any, {
                          onClick: (...args: any[]) => {
                            (node as any).props?.onClick?.(...args);
                            setMobileMenuOpen(false);
                          },
                        })
                      : node;
                  })}
                </ul>
              </li>
            )}

            {/* 报表列表 - 只在有报表时显示 */}
            {reports.length > 0 && (
              <li className={styles.menuItem}>
                <div
                  className={`${styles.nodeItem} ${styles.groupItem}`}
                  onClick={() => {
                    const next = new Set(expandedGroups);
                    if (next.has("reports")) {
                      next.delete("reports");
                    } else {
                      next.add("reports");
                    }
                    setExpandedGroups(next);
                  }}
                >
                  <HolderOutlined
                    className={styles.dragIcon}
                    style={{ pointerEvents: 'none', cursor: 'default' }}
                  />
                  {expandedGroups.has("reports") ? (
                    <CaretDownOutlined className={styles.groupNodeIcon} />
                  ) : (
                    <CaretRightOutlined className={styles.groupNodeIcon} />
                  )}
                  <span className={`${styles.nodeName} ${styles.groupName}`}>
                    报表 <span className={styles.childrenNum}>({reports.length})</span>
                  </span>
                </div>
                <ul 
                  className={styles.subMenu} 
                  style={{ display: expandedGroups.has("reports") ? "block" : "none" }}
                >
                  {reports.map((report) => renderReportMenuItem(report))}
                </ul>
              </li>
            )}

            {/* 数据大屏列表 - 只在有数据大屏时显示 */}
            {datavScreens.length > 0 && (
              <li className={styles.menuItem}>
                <div
                  className={`${styles.nodeItem} ${styles.groupItem}`}
                  onClick={() => {
                    const next = new Set(expandedGroups);
                    if (next.has("datavScreens")) {
                      next.delete("datavScreens");
                    } else {
                      next.add("datavScreens");
                    }
                    setExpandedGroups(next);
                  }}
                >
                  <HolderOutlined
                    className={styles.dragIcon}
                    style={{ pointerEvents: 'none', cursor: 'default' }}
                  />
                  {expandedGroups.has("datavScreens") ? (
                    <CaretDownOutlined className={styles.groupNodeIcon} />
                  ) : (
                    <CaretRightOutlined className={styles.groupNodeIcon} />
                  )}
                  <span className={`${styles.nodeName} ${styles.groupName}`}>
                    数据大屏 <span className={styles.childrenNum}>({datavScreens.length})</span>
                  </span>
                </div>
                <ul 
                  className={styles.subMenu} 
                  style={{ display: expandedGroups.has("datavScreens") ? "block" : "none" }}
                >
                  {datavScreens.map((screen) => renderDatavScreenMenuItem(screen))}
                </ul>
              </li>
            )}

            {/* 拖拽区域 - 只在有分组时显示 */}
            {groups.length > 0 && (
              <li className={styles.menuItem}>
                <div
                  className={styles.dropZone}
                  onDragOver={(e) => {
                    if (draggingGroupId) {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDrop={(e) => {
                    if (!draggingGroupId) return;
                    e.preventDefault();
                    handleGroupDropAtEnd();
                  }}
                >
                  可将分组拖拽到此追加
                </div>
              </li>
            )}
            </ul>
          </div>

          <div style={{ padding: 16, borderTop: "1px solid #f0f0f0" }}>
            <Button
              type="text"
              icon={<SettingOutlined />}
              block
              onClick={() => {
                navigate(`/app/${appId}/config`);
                setMobileMenuOpen(false);
              }}
              style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "flex-start" }}
            >
              应用配置
            </Button>
          </div>
        </Drawer>
      ) : (
        <Sider 
          width={280} 
          style={{ 
            background: "#fff", 
            borderRight: "1px solid #f0f0f0",
            overflow: "auto"
          }}
        >
          {/* 搜索框 */}
          <div style={{ padding: "16px" }}>
            <Input
              placeholder="搜索表单"
              prefix={<SearchOutlined />}
              suffix={
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: "form",
                        label: "表单",
                        icon: <FileTextOutlined style={{ color: "#52c41a" }} />,
                        onClick: () => {
                          setNewFormModalOpen(true);
                        },
                      },
                      {
                        key: "developer",
                        label: "开发者页面",
                        icon: <ThunderboltOutlined style={{ color: "#722ed1" }} />,
                        onClick: () => {
                          if (!appId) {
                            message.warning("请先选择应用");
                            return;
                          }
                          navigate(`/app/${appId}/developer`);
                        },
                      },
                      {
                        key: "report",
                        label: "报表",
                        icon: <BarChartOutlined style={{ color: "#1890ff" }} />,
                        onClick: () => {
                          // 跳转到报表设计器，带上应用ID
                          navigate(`/reports/designer?appId=${appId ?? ""}`);
                        },
                      },
                      {
                        key: "datav",
                        label: "数据大屏",
                        icon: <DashboardOutlined style={{ color: "#722ed1" }} />,
                        onClick: () => {
                          if (!appId) {
                            message.warning("请先选择应用");
                            return;
                          }
                          // 点击加号 → 数据大屏，始终是新建，不带 screenId
                          navigate(`/datav/designer?appId=${appId}`);
                        },
                      },
                      {
                        key: "report-datav",
                        label: "数据大屏预览",
                        icon: <DashboardOutlined style={{ color: "#722ed1" }} />,
                        onClick: () => {
                          if (!appId) {
                            message.warning("请先选择应用");
                            return;
                          }
                          navigate(`/app/${appId}/datav`);
                        },
                      },
                      {
                        key: "group",
                        label: "分组",
                        icon: <ApartmentOutlined style={{ color: "#faad14" }} />,
                        onClick: () => {
                          const newGroupId = `group_${Date.now()}`;
                          const defaultName = "未命名的分组";
                          let newGroups: typeof groups;
                          setGroups((prev) => {
                            newGroups = [...prev, { id: newGroupId, name: defaultName, formIds: [] }];
                            return newGroups;
                          });
                          setExpandedGroups((prev) => new Set([...prev, newGroupId]));
                          setEditingGroupId(newGroupId);
                          setEditingGroupName(defaultName);
                          // 保存到后端
                          setTimeout(() => {
                            saveGroupsToMetadata(newGroups!, ungroupOrder);
                          }, 0);
                        },
                      },
                    ],
                  }}
                  trigger={["click"]}
                  placement="bottomRight"
                >
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                    size="small"
                    style={{ borderRadius: "50%", width: 24, height: 24, padding: 0 }}
                  />
                </Dropdown>
              }
            />
            </div>

          <div style={{ padding: "0 16px 16px" }}>
            <ul className={styles.menuContainer}>
              {groups.map((group) => {
                const groupForms =
                  group.formIds
                    .map((id) => formMap.get(id))
                    .filter((form): form is FormDefinitionResponse => !!form);
                const isExpanded = expandedGroups.has(group.id);
                return (
                  <li
                    key={group.id}
                    className={`${styles.menuItem} ${styles.hasGroup}`}
                    data-draggable="true"
                    onDragOver={(e) => {
                      if (draggingGroupId && draggingGroupId !== group.id) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        return;
                      }
                      if (draggingFormId) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(e) => {
                      if (draggingGroupId && draggingGroupId !== group.id) {
                        e.preventDefault();
                        handleGroupReorder(group.id);
                        return;
                      }
                      if (!draggingFormId) return;
                      e.preventDefault();
                      handleMoveFormToGroup(draggingFormId, group.id);
                    }}
                  >
                    <div
                      className={`${styles.nodeItem} ${styles.groupItem}`}
                      onClick={() => {
                        const next = new Set(expandedGroups);
                        if (next.has(group.id)) {
                          next.delete(group.id);
                        } else {
                          next.add(group.id);
                        }
                        setExpandedGroups(next);
                      }}
                    >
                      <HolderOutlined
                        className={styles.dragIcon}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          setDraggingGroupId(group.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.dropEffect = "move";
                          e.dataTransfer.setData("text/plain", group.id);
                        }}
                        onDragEnd={() => setDraggingGroupId(undefined)}
                      />
                      {isExpanded ? (
                        <CaretDownOutlined className={styles.groupNodeIcon} />
                      ) : (
                        <CaretRightOutlined className={styles.groupNodeIcon} />
                      )}
                      {editingGroupId === group.id ? (
                        <Input
                          size="small"
                          autoFocus
                          value={editingGroupName}
                          onChange={(e) => setEditingGroupName(e.target.value)}
                          onPressEnter={(e) => {
                            e.stopPropagation();
                            commitGroupName(group.id, editingGroupName);
                          }}
                          onBlur={(e) => {
                            e.stopPropagation();
                            if (editingGroupName.trim()) {
                              commitGroupName(group.id, editingGroupName);
                            } else {
                              setEditingGroupId(undefined);
                              setEditingGroupName("");
                            }
                          }}
                          style={{ flex: 1, marginRight: 8 }}
                        />
                      ) : (
                        <span className={`${styles.nodeName} ${styles.groupName}`}>
                          {group.name} <span className={styles.childrenNum}>({groupForms.length})</span>
                        </span>
                      )}
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: "edit",
                              label: "编辑",
                              icon: <EditOutlined />,
                              onClick: () => {
                                setEditingGroupId(group.id);
                                setEditingGroupName(group.name);
                              },
                            },
                            {
                              key: "delete",
                              label: "删除",
                              danger: true,
                              onClick: async () => {
                                try {
                                  const newGroups = groups.filter((g) => g.id !== group.id);
                                  setGroups(newGroups);
                                  await saveGroupsToMetadata(newGroups, ungroupOrder);
                                  message.success("删除成功");
                                } catch (error) {
                                  message.error("删除失败");
                                }
                              },
                            },
                          ],
                        }}
                        trigger={["click"]}
                        placement="bottomRight"
                      >
                        <EllipsisOutlined className={styles.settingIcon} />
                      </Dropdown>
            </div>
                    <ul className={styles.subMenu} style={{ display: isExpanded ? "block" : "none" }}>
                      {groupForms.length ? (
                        groupForms.map((form) => renderFormMenuItem(form, group.id))
                      ) : (
                        <li style={{ padding: "8px 12px", color: "#999", fontSize: 12 }}>
                          暂无表单，拖动表单到此处
                        </li>
                      )}
                    </ul>
                  </li>
                );
              })}

              {/* 未分组的表单列表 */}
              {ungroupForms.length > 0 && (
                <li className={styles.menuItem}>
                  <div
                    className={`${styles.nodeItem} ${styles.groupItem}`}
                    onClick={() => {
                      const next = new Set(expandedGroups);
                      if (next.has("ungroup")) {
                        next.delete("ungroup");
                      } else {
                        next.add("ungroup");
                      }
                      setExpandedGroups(next);
                    }}
                  >
                    <HolderOutlined
                      className={styles.dragIcon}
                      style={{ pointerEvents: 'none', cursor: 'default' }}
                    />
                    {expandedGroups.has("ungroup") ? (
                      <CaretDownOutlined className={styles.groupNodeIcon} />
                    ) : (
                      <CaretRightOutlined className={styles.groupNodeIcon} />
                    )}
                    <span className={`${styles.nodeName} ${styles.groupName}`}>
                      未分组 <span className={styles.childrenNum}>({ungroupForms.length})</span>
                    </span>
                  </div>
                  <ul className={styles.subMenu} style={{ display: expandedGroups.has("ungroup") ? "block" : "none" }}>
                    {ungroupForms.map((form) => renderFormMenuItem(form))}
                  </ul>
                </li>
              )}

              {/* 报表列表 - 只在有报表时显示 */}
              {reports.length > 0 && (
                <li className={styles.menuItem}>
                  <div
                    className={`${styles.nodeItem} ${styles.groupItem}`}
                    onClick={() => {
                      const next = new Set(expandedGroups);
                      if (next.has("reports")) {
                        next.delete("reports");
                      } else {
                        next.add("reports");
                      }
                      setExpandedGroups(next);
                    }}
                  >
                    <HolderOutlined
                      className={styles.dragIcon}
                      style={{ pointerEvents: 'none', cursor: 'default' }}
                    />
                    {expandedGroups.has("reports") ? (
                      <CaretDownOutlined className={styles.groupNodeIcon} />
                    ) : (
                      <CaretRightOutlined className={styles.groupNodeIcon} />
                    )}
                    <span className={`${styles.nodeName} ${styles.groupName}`}>
                      报表 <span className={styles.childrenNum}>({reports.length})</span>
                    </span>
                  </div>
                  <ul 
                    className={styles.subMenu} 
                    style={{ display: expandedGroups.has("reports") ? "block" : "none" }}
                  >
                    {reports.map((report) => renderReportMenuItem(report))}
                  </ul>
                </li>
              )}

              {/* 数据大屏列表 - 只在有数据大屏时显示 */}
              {datavScreens.length > 0 && (
                <li className={styles.menuItem}>
                  <div
                    className={`${styles.nodeItem} ${styles.groupItem}`}
                    onClick={() => {
                      const next = new Set(expandedGroups);
                      if (next.has("datavScreens")) {
                        next.delete("datavScreens");
                      } else {
                        next.add("datavScreens");
                      }
                      setExpandedGroups(next);
                    }}
                  >
                    <HolderOutlined
                      className={styles.dragIcon}
                      style={{ pointerEvents: 'none', cursor: 'default' }}
                    />
                    {expandedGroups.has("datavScreens") ? (
                      <CaretDownOutlined className={styles.groupNodeIcon} />
                    ) : (
                      <CaretRightOutlined className={styles.groupNodeIcon} />
                    )}
                    <span className={`${styles.nodeName} ${styles.groupName}`}>
                      数据大屏 <span className={styles.childrenNum}>({datavScreens.length})</span>
                    </span>
                  </div>
                  <ul 
                    className={styles.subMenu} 
                    style={{ display: expandedGroups.has("datavScreens") ? "block" : "none" }}
                  >
                    {datavScreens.map((screen) => renderDatavScreenMenuItem(screen))}
                  </ul>
                </li>
              )}

              {/* 拖拽区域 - 只在有分组时显示 */}
              {groups.length > 0 && (
                <li className={styles.menuItem}>
                  <div
                    className={styles.dropZone}
                    onDragOver={(e) => {
                      if (draggingGroupId) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(e) => {
                      if (!draggingGroupId) return;
                      e.preventDefault();
                      handleGroupDropAtEnd();
                    }}
                  >
                    可将分组拖拽到此追加
                  </div>
                </li>
              )}
            </ul>
          </div>

          {/* 应用配置 */}
          <div style={{ 
            position: "absolute", 
            bottom: 0, 
            left: 0, 
            right: 0, 
            padding: "12px 16px",
            borderTop: "1px solid #f0f0f0",
            background: "#fff"
          }}>
            <Button
              type="text"
              icon={<SettingOutlined />}
              block
              onClick={() => navigate(`/app/${appId}/config`)}
              style={{
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                padding: "0 12px",
                borderRadius: "6px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f0f7ff";
                e.currentTarget.style.color = "#1890ff";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "inherit";
              }}
            >
              应用配置
            </Button>
          </div>
        </Sider>
      )}

      {/* 右侧内容区 - 数据列表 */}
      <Content 
        className="runtime-list-content"
              style={{
          display: "flex", 
          flexDirection: "column", 
          height: "calc(100vh - 64px)", 
          overflow: "hidden", /* 隐藏滚动条，参考实现 */
          maxHeight: "calc(100vh - 64px)",
          minHeight: 0
        } as React.CSSProperties}
      >
        {selectedDatavScreenId ? (
          <div
            style={{
              padding: 0,
              background: "#0f2a43",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              minHeight: 0,
              height: "100%",
              position: "relative",
            }}
          >
            {datavLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#fff" }}>
                <Spin size="large" />
              </div>
            ) : datavComponents.length > 0 ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  position: "relative",
                  overflow: "auto",
                }}
              >
                {datavComponents.map((component) => {
                  // 基础位置和尺寸样式
                  let style: React.CSSProperties = {
                    position: "absolute",
                    left: component.x,
                    top: component.y,
                    width: component.width,
                    height: component.height,
                    zIndex: component.zIndex || 1,
                    ...component.style,
                  };

                  // 装饰组件在运行时也保持透明背景和不遮挡内容
                  if (component.type === "decoration") {
                    style = {
                      ...style,
                      background: "transparent",
                      backgroundColor: "transparent",
                      border: "none",
                      padding: 0,
                      zIndex: component.zIndex ?? -100,
                    };
                  }

                  switch (component.type) {
                    case "chart": {
                      const option = datavChartData[component.id] || component.echartsOption || {};
                      return (
                        <div key={component.id} style={style}>
                          <ReactECharts
                            option={option}
                            style={{ width: "100%", height: "100%" }}
                            opts={{ renderer: "svg" }}
                          />
                        </div>
                      );
                    }
                    case "table": {
                      const tableData = datavTableDataMap[component.id];
                      return (
                        <div key={component.id} style={style}>
                          <Table
                            columns={tableData?.columns || []}
                            dataSource={tableData?.data || []}
                            pagination={false}
                            size="small"
                            scroll={{ x: true, y: component.height - 40 }}
                            style={{ background: "#fff" }}
                          />
                        </div>
                      );
                    }
                    case "text": {
                      const textStyle: React.CSSProperties = {
                        ...style,
                        ...component.textStyle,
                        color: component.textStyle?.color || "#fff",
                        background: "transparent",
                        backgroundColor: "transparent",
                        border: "none",
                        padding: 0,
                      };
                      return (
                        <div key={component.id} style={textStyle}>
                          {component.text || ""}
                        </div>
                      );
                    }
                    case "datetime": {
                      const timeStyle: React.CSSProperties = {
                        ...style,
                        ...component.textStyle,
                        color: component.textStyle?.color || "#fff",
                        background: "transparent",
                        backgroundColor: "transparent",
                        border: "none",
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: component.textStyle?.textAlign || "center",
                      };
                      const format = component.timeFormat || "YYYY-MM-DD HH:mm:ss";
                      return (
                        <div key={component.id} style={timeStyle}>
                          <RealtimeTimeDisplay format={format} style={{ color: timeStyle.color, fontSize: timeStyle.fontSize }} />
                        </div>
                      );
                    }
                    case "image":
                      return (
                        <div key={component.id} style={style}>
                          <img
                            src={component.imageUrl || ""}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                          />
                        </div>
                      );
                    case "decoration": {
                      // 渲染装饰组件（边框和装饰）
                      const renderDecoration = (type: string) => {
                        const props = { style: { width: "100%", height: "100%" } };
                        // BorderBox 组件需要 children 才能正确显示边框效果
                        const borderBoxProps = { ...props, className: "border-box-content" };
                        const DecorationMap: Record<string, React.ComponentType<any>> = {
                          borderBox1: BorderBox1,
                          borderBox2: BorderBox2,
                          borderBox3: BorderBox3,
                          borderBox4: BorderBox4,
                          borderBox5: BorderBox5,
                          borderBox6: BorderBox6,
                          borderBox7: BorderBox7,
                          borderBox8: BorderBox8,
                          borderBox9: BorderBox9,
                          borderBox10: BorderBox10,
                          borderBox11: BorderBox11,
                          borderBox12: BorderBox12,
                          borderBox13: BorderBox13,
                          decoration1: Decoration1,
                          decoration2: Decoration2,
                          decoration3: Decoration3,
                          decoration4: Decoration4,
                          decoration5: Decoration5,
                          decoration6: Decoration6,
                          decoration7: Decoration7,
                          decoration8: Decoration8,
                          decoration9: Decoration9,
                          decoration10: Decoration10,
                        };
                        const Component = DecorationMap[type];
                        if (!Component) return null;
                        
                        // BorderBox 组件需要 children
                        if (type.startsWith("borderBox")) {
                          return <Component {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></Component>;
                        }
                        
                        return <Component {...props} />;
                      };
                      
                      return (
                        <div key={component.id} style={style}>
                          {renderDecoration(component.decorationType!)}
                        </div>
                      );
                    }
                    case "scrollBoard": {
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
                      
                      if (!Array.isArray(scrollBoardConfig.data) || scrollBoardConfig.data.length === 0) {
                        scrollBoardConfig.data = [["数据1", "100", "正常"], ["数据2", "200", "正常"]];
                      }
                      
                      if (scrollBoardConfig.data.length > 0 && scrollBoardConfig.data[0].length !== scrollBoardConfig.header.length) {
                        const colCount = scrollBoardConfig.data[0].length;
                        scrollBoardConfig.header = Array.from({ length: colCount }, (_, i) => `列${i + 1}`);
                      }
                      
                      return (
                        <div key={component.id} style={style}>
                          <ScrollBoard config={scrollBoardConfig} style={{ width: "100%", height: "100%" }} />
                        </div>
                      );
                    }
                    case "digitalFlop": {
                      const fontSize = component.style?.fontSize || 36;
                      const titleFontSize = component.style?.titleFontSize || 16;
                      const title = component.title || "";
                      const componentId = `digital-flop-${component.id}`;
                      
                      return (
                        <div key={component.id} style={style}>
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
                        </div>
                      );
                    }
                    case "waterLevelPond":
                      return (
                        <div key={component.id} style={style}>
                          <WaterLevelPond
                            config={{
                              shape: component.dataSource?.dataVData?.shape || "roundRect",
                              percent: component.dataSource?.dataVData?.percent || 0.5,
                            }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        </div>
                      );
                    case "scrollRankingBoard":
                      return (
                        <div key={component.id} style={style}>
                          <ScrollRankingBoard
                            config={{
                              data: component.dataSource?.dataVData?.data || [],
                            }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        </div>
                      );
                    case "capsuleChart":
                      return (
                        <div key={component.id} style={style}>
                          <CapsuleChart
                            config={{
                              data: component.dataSource?.dataVData?.data || [],
                            }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        </div>
                      );
                    case "activeRingChart":
                      return (
                        <div key={component.id} style={style}>
                          <ActiveRingChart
                            config={{
                              data: component.dataSource?.dataVData?.data || [],
                            }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        </div>
                      );
                    case "conicalColumnChart":
                      return (
                        <div key={component.id} style={style}>
                          <ConicalColumnChart
                            config={{
                              data: component.dataSource?.dataVData?.data || [],
                            }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        </div>
                      );
                    case "percentPond":
                      return (
                        <div key={component.id} style={style}>
                          <PercentPond
                            config={{
                              value: component.dataSource?.dataVData?.value || 0.5,
                            }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        </div>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 40, color: "#9ad1ff" }}>
                当前数据大屏还没有配置组件，请到「数据大屏设计器」中添加组件
              </div>
            )}
          </div>
        ) : selectedReportId ? (
          <div
            style={{
              padding: 24,
              background: "#f5f5f5",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "auto",
              minHeight: 0,
              height: "100%",
            }}
          >
            {reportLoading ? (
              <div style={{ textAlign: "center", padding: 40 }}>
                <Spin />
              </div>
            ) : reportWidgets.length > 0 ? (
              <div>
                {/* 使用网格布局显示所有组件 */}
                {(() => {
                  // 计算网格布局
                  const normalizedWidgets = reportWidgets.map(w => ({
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
                  
                  return gridLayout.map((rowIndex) => {
                    const rowWidgets = normalizedWidgets.filter((w) => (w.row ?? 0) === rowIndex).sort((a, b) => (a.col ?? 0) - (b.col ?? 0));
                    const totalSpan = rowWidgets.reduce((sum, w) => sum + (w.span ?? 12), 0);
                    
                    return (
                      <div key={rowIndex} style={{ marginBottom: 16 }}>
                        <div style={{ display: "flex", gap: 16, flexWrap: totalSpan > 24 ? "wrap" : "nowrap" }}>
                          {rowWidgets.map((widget) => {
                            const widgetData = reportDataMap[widget.id];
                            // 生成图表配置（简化版，只处理基本图表类型）
                            let chartOption: any = null;
                            if (widgetData?.type === "chart" && widgetData.xData && widgetData.yData) {
                              const { xData, yData } = widgetData;
                              const title = widget.title || "图表";
                              
                              if (widget.type === "pie") {
                                chartOption = {
                                  title: { text: title, left: "center" },
                                  tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
                                  legend: { bottom: 0 },
                                  series: [{
                                    name: title,
                                    type: "pie",
                                    radius: "60%",
                                    data: xData.map((name: string, idx: number) => ({ name, value: yData[idx] ?? 0 })),
                                  }],
                                };
                              } else {
                                chartOption = {
                                  title: { text: title },
                                  tooltip: { trigger: "axis" },
                                  xAxis: { type: "category", data: xData },
                                  yAxis: { type: "value" },
                                  series: [{
                                    name: title,
                                    type: widget.type === "line" ? "line" : "bar",
                                    data: yData,
                                  }],
                                };
                              }
                            }
                            
                            const widgetSpan = widget.span ?? 12;
                            const gapPerWidget = rowWidgets.length > 1 ? (16 * (rowWidgets.length - 1)) / rowWidgets.length : 0;
                            const widthStyle = { 
                              width: `calc(${(widgetSpan / 24) * 100}% - ${gapPerWidget}px)`, 
                              minWidth: 300,
                              flexShrink: 0
                            };
                            
                            return (
                              <Card key={widget.id} title={widget.title} style={widthStyle}>
                                {widget.type === "realtime" ? (
                                  <RealtimeTimeDisplay
                                    format={widget.realtimeConfig?.format || "YYYY-MM-DD HH:mm:ss dddd"}
                                  />
                                ) : widget.type === "dataTable" ? (
                                  widgetData?.type === "table" && widgetData.data ? (
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
                                  ) : (
                                    <div style={{ padding: 24, textAlign: "center", color: "#999" }}>暂无数据</div>
                                  )
                                ) : chartOption ? (
                                  <ReactECharts option={chartOption} style={{ height: 400, width: "100%" }} />
                                ) : (
                                  <div style={{ padding: 24, textAlign: "center", color: "#999" }}>暂无数据</div>
                                )}
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <Card>
                <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
                  当前报表还没有配置组件，请在「报表设计器」中为报表添加并配置组件。
                </div>
              </Card>
            )}
            </div>
        ) : selectedFormId ? (
          <div style={{ padding: "24px", background: "#f5f5f5", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0, height: "100%" }}>
            <FormDataList
              formId={selectedFormId}
              formDefinition={formDefinition}
              listWorkflowHoverEnabled={
                (appInfo?.metadata as Record<string, unknown> | undefined)
                  ?.listWorkflowHoverPreview === true
              }
              onView={(recordId) => {
                setViewingRecordId(recordId);
                setViewDrawerOpen(true);
              }}
              onAdd={() => setFormDrawerOpen(true)}
              onDesign={() => {
                if (selectedFormId && appId) {
                  navigate(`/designer?formId=${selectedFormId}&appId=${appId}`);
                }
              }}
              selectedFilter={selectedFilter}
              onFilterChange={setSelectedFilter}
              onManageFilters={() => setFilterManageModalOpen(true)}
            />
          </div>
        ) : (
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            height: "100vh",
            flexDirection: "column"
          }}>
            <p>请从左侧选择一个表单</p>
            {forms && forms.length === 0 && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate(`/designer?appId=${appId}`)}
                >
                  创建第一个表单
                </Button>
              )}
            </div>
        )}
      </Content>
      </Layout>

      {/* 表单填写抽屉（可拖拽调整宽度） */}
      <ResizableDrawer
        title={`${formDefinition?.formName || "未命名表单"}-${editingRecordId ? "编辑" : "新增"}`}
        open={formDrawerOpen}
        onClose={() => {
          setFormDrawerOpen(false);
          setEditingRecordId(null);
        }}
        destroyOnHidden
      >
          {selectedFormId && (
          <FormRenderer
            formId={selectedFormId}
            recordId={editingRecordId || undefined}
            mode={editingRecordId ? "edit" : "add"}
            onSubmitSuccess={async (data) => {
              // FormRenderer 内部已经提交了，这里只需要刷新列表
              setFormDrawerOpen(false);
              setEditingRecordId(null);
              // 刷新数据列表
              queryClient.invalidateQueries({ queryKey: ["formData", selectedFormId] });
            }}
          />
        )}
      </ResizableDrawer>

      {/* 查看详情抽屉 */}
      <ResizableDrawer
        title={`${formDefinition?.formName || "未命名表单"}-查看`}
        open={viewDrawerOpen}
        onClose={() => {
          setViewDrawerOpen(false);
          setViewingRecordId(null);
        }}
        destroyOnHidden
              extra={
                <Space>
                  {!hideEditWhileWorkflowRunning && (
                  <Button
              type="text"
                        icon={<EditOutlined />}
              onClick={() => {
                // 切换到编辑模式
                setViewingRecordId(viewingRecordId);
                setEditingRecordId(viewingRecordId);
                setViewDrawerOpen(false);
                setFormDrawerOpen(true);
              }}
            >
              编辑
                  </Button>
                  )}
                  <Button
              type="text"
              icon={<PrinterOutlined />}
              onClick={() => {
                if (!effectiveFormId) {
                  message.warning("无法确定表单，请稍后重试");
                  return;
                }
                setPrintModalOpen(true);
              }}
            >
              打印
                      </Button>
            <Popconfirm
              title="确定要删除这条记录吗？"
              onConfirm={async () => {
                if (viewingRecordId) {
                  try {
                    await formDataApi.delete(viewingRecordId);
                    message.success("删除成功");
                    setViewDrawerOpen(false);
                    setViewingRecordId(null);
                    queryClient.invalidateQueries({ queryKey: ["formData", selectedFormId] });
                  } catch (error) {
                    message.error("删除失败");
                  }
                }
              }}
              okText="确定"
              cancelText="取消"
            >
                  <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                  >
                删除
                  </Button>
            </Popconfirm>
                  <Button
              type="text"
              icon={<CommentOutlined />}
              onClick={() => {
                message.info("评论功能待实现");
              }}
            >
              评论
                  </Button>
                </Space>
              }
            >
        {viewingRecordId && (
          <>
            {effectiveFormId ? (
              <FormRenderer
                formId={effectiveFormId}
                recordId={viewingRecordId}
                mode="view"
              />
            ) : (
              <div style={{ padding: 24, textAlign: "center" }}>正在加载表单定义...</div>
            )}
            <div style={{ marginTop: 16 }}>
              <WorkflowInstancePanel recordId={viewingRecordId} />
            </div>
          </>
              )}
      </ResizableDrawer>

      <PrintRecordModal
        open={printModalOpen}
        onCancel={() => setPrintModalOpen(false)}
        formId={effectiveFormId}
        recordData={(viewingRecord?.data || {}) as Record<string, unknown>}
        formFields={
          (formDefinitionForEffective?.config?.fields ||
            formDefinition?.config?.fields ||
            []) as any[]
        }
      />

      {/* 修改基础信息模态框 */}
      <Modal
        title="修改基础信息"
        open={editFormModalOpen}
        onOk={async () => {
          try {
            const values = await editFormForm.validateFields();
            if (editingForm) {
              // 获取当前表单的完整配置
              const currentForm = await formDefinitionApi.getById(editingForm.formId);
              const currentConfig = currentForm.config || { fields: [], layout: {} };
              
              // 更新表单名称和配置中的metadata
              const updatedConfig = {
                fields: currentConfig.fields || [],
                layout: currentConfig.layout || { type: 'grid', columns: 12 },
                metadata: {
                  ...(currentConfig.metadata || {}),
                  description: values.description || "",
                  icon: values.icon || "",
                },
              };

              // 确保metadata被包含在更新中
              // 将metadata作为额外字段传递，后端会将其合并到config中
              await formDefinitionApi.update(editingForm.formId, {
                formName: values.formName,
                fields: updatedConfig.fields,
                layout: updatedConfig.layout,
                metadata: updatedConfig.metadata, // 传递metadata
              } as any);
              
              message.success("修改成功");
              setEditFormModalOpen(false);
              // 刷新表单列表
              queryClient.invalidateQueries({ queryKey: ["applicationForms", appId] });
              // 如果当前选中的是这个表单，也刷新表单定义
              if (selectedFormId === editingForm.formId) {
                queryClient.invalidateQueries({ queryKey: ["formDefinition", selectedFormId] });
              }
            }
          } catch (error) {
            console.error("修改失败:", error);
            message.error("修改失败，请重试");
          }
        }}
        onCancel={() => {
          setEditFormModalOpen(false);
          editFormForm.resetFields();
        }}
        okText="确定"
        cancelText="取消"
      >
        <Form
          form={editFormForm}
          layout="vertical"
        >
          <Form.Item
            label="表单名称"
            name="formName"
            rules={[{ required: true, message: "请输入表单名称" }]}
          >
            <Input placeholder="请输入表单名称" />
          </Form.Item>
          <Form.Item
            label="表单描述"
            name="description"
          >
            <Input.TextArea 
              placeholder="请输入" 
              rows={3}
            />
          </Form.Item>
          <Form.Item
            label="表单图标"
            name="icon"
          >
            <IconSelector />
          </Form.Item>
        </Form>
      </Modal>

      {/* 管理常用筛选模态框 */}
      <Modal
        title="管理常用筛选"
        open={filterManageModalOpen}
        onCancel={() => setFilterManageModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setFilterManageModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        <Table
          columns={[
            {
              title: "名称",
              dataIndex: "name",
              key: "name",
            },
            {
              title: "类型",
              dataIndex: "type",
              key: "type",
            },
            {
              title: (
                <Space>
                  数据筛选范围
                  <span style={{ color: "#1890ff", cursor: "pointer" }}>?</span>
                </Space>
              ),
              dataIndex: "scope",
              key: "scope",
            },
            {
              title: "操作",
              key: "action",
              render: (_, record) => {
                // 系统类型的不显示操作按钮
                if (record.type === "系统") {
                  return null;
                }
                return (
                  <Space>
                    <Button type="link" size="small">
                      编辑
                    </Button>
                    <Button type="link" danger size="small">
                      删除
                    </Button>
                  </Space>
                );
              },
            },
          ]}
          dataSource={[
            {
              key: "1",
              name: "全部",
              type: "系统",
              scope: "全部的",
            },
            {
              key: "2",
              name: "我部门的",
              type: "系统",
              scope: "我的部门",
            },
            {
              key: "3",
              name: "我的",
              type: "系统",
              scope: "我的",
            },
          ]}
          pagination={false}
        />
      </Modal>

      {/* 新建表单模态框 */}
      <Modal
        title="新建表单"
        open={newFormModalOpen}
        onCancel={() => setNewFormModalOpen(false)}
        footer={null}
        width={600}
        centered
      >
        <div style={{ 
          display: "flex", 
          gap: 24, 
          justifyContent: "center",
          padding: "40px 0"
        }}>
          {/* 新建空白表单 */}
          <div
            style={{
              width: 200,
              padding: 24,
              border: "1px solid #d9d9d9",
              borderRadius: 8,
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#1890ff";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(24, 144, 255, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#d9d9d9";
              e.currentTarget.style.boxShadow = "none";
            }}
            onClick={() => {
              setNewFormModalOpen(false);
              if (appId) {
                navigate(`/designer?appId=${appId}`);
              }
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              📄
    </div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>
              新建空白表单
            </div>
          </div>

          {/* 导入Excel新建表单 */}
          <div
            style={{
              width: 200,
              padding: 24,
              border: "1px solid #d9d9d9",
              borderRadius: 8,
              textAlign: "center",
              cursor: "pointer",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#1890ff";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(24, 144, 255, 0.2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#d9d9d9";
              e.currentTarget.style.boxShadow = "none";
            }}
            onClick={() => {
              message.info("导入Excel新建表单功能待实现");
              setNewFormModalOpen(false);
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>
              📊
            </div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>
              导入Excel新建表单
            </div>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

