import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Spin,
  Button,
  Space,
  Tag,
  message,
  Dropdown,
  Typography,
  Modal,
  Drawer,
  Checkbox,
  Empty,
  Table,
  Pagination,
} from "antd";
import {
  EyeOutlined,
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  DownOutlined,
  SettingOutlined,
  CloseOutlined,
  LockOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";

import styles from "./FormDataList.module.css";
import { extractAttachmentPreviewUrls } from "@/utils/attachmentDisplay";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";
import { apiClient } from "@/api/client";
import { departmentApi } from "@/api/department";
import { operationLogApi } from "@/api/operationLog";
import type { OperationLog } from "@/api/operationLog";
import { WorkflowRowHoverCardContent } from "./WorkflowRowHoverCard";

const COL_MIN = 80;
const COL_MAX = 800;
const DEFAULT_W_SERIAL = 70;
const DEFAULT_W_ACTIONS = 120;
const DEFAULT_W_FIELD = 160;
const DEFAULT_W_SUB = 180;

/** 可拖拽调列宽的表头单元格（与 antd Table components.header.cell 配合） */
const ResizableHeaderCell = React.forwardRef<HTMLTableCellElement, any>((props, ref) => {
  const { onResize, width, ...restProps } = props;
  if (width == null || width === undefined) {
    return <th {...restProps} ref={ref} />;
  }
  const w = Number(width);
  return (
    <Resizable
      width={w}
      height={0}
      minConstraints={[COL_MIN, 0]}
      maxConstraints={[COL_MAX, 0]}
      handle={
        <span
          className={`react-resizable-handle ${styles.colResizeHandle}`}
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} ref={ref} />
    </Resizable>
  );
});
ResizableHeaderCell.displayName = "ResizableHeaderCell";

interface FormDataListProps {
  formId: string;
  formDefinition?: any;
  onAdd?: () => void;
  onDesign?: () => void;
  onView?: (recordId: string) => void;
  selectedFilter?: string;
  onFilterChange?: (filter: string) => void;
  onManageFilters?: () => void;
  /** 应用配置：悬停行时显示流程状态（轻量浮层） */
  listWorkflowHoverEnabled?: boolean;
}

export const FormDataList: React.FC<FormDataListProps> = ({
  formId,
  formDefinition: propFormDefinition,
  onAdd,
  onDesign,
  onView,
  selectedFilter = "全部",
  onFilterChange,
  onManageFilters,
  listWorkflowHoverEnabled = false,
}) => {
  // 表单定义
  const {
    data: queryFormDefinition,
    isLoading: formLoading,
  } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId),
    enabled: !!formId && !propFormDefinition,
  });

  const formDefinition = propFormDefinition || queryFormDefinition;

  const formWorkflowEnabled = formDefinition?.metadata?.workflowEnabled !== false;

  const [rowHoverTip, setRowHoverTip] = useState<{
    recordId: string;
    left: number;
    top: number;
  } | null>(null);
  const rowHoverEnterTimer = useRef<number | null>(null);
  const rowHoverLeaveTimer = useRef<number | null>(null);

  const clearRowHoverTimers = useCallback(() => {
    if (rowHoverEnterTimer.current != null) window.clearTimeout(rowHoverEnterTimer.current);
    if (rowHoverLeaveTimer.current != null) window.clearTimeout(rowHoverLeaveTimer.current);
    rowHoverEnterTimer.current = null;
    rowHoverLeaveTimer.current = null;
  }, []);

  useEffect(() => {
    if (!rowHoverTip) return;
    const close = () => setRowHoverTip(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [rowHoverTip]);

  useEffect(() => () => clearRowHoverTimers(), [clearRowHoverTimers]);

  useEffect(() => {
    setRowHoverTip(null);
  }, [formId]);

  // 表单数据
  const {
    data,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["formData", formId],
    queryFn: () => formDataApi.getListByForm(formId),
    enabled: !!formId,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // 删除弹窗
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  // 操作记录弹窗
  const [operationRecordVisible, setOperationRecordVisible] = useState(false);
  // 字段显示设置
  const [displaySettingsVisible, setDisplaySettingsVisible] = useState(false);
  // 顶部数据范围（全部数据/其它视图）
  const [dataScope, setDataScope] = useState<string>("全部数据");

  // 选中行
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  // 锁定列 key 列表
  const [fixedColumnKeys, setFixedColumnKeys] = useState<string[]>([]);

  // ====== 通用数据格式化：用户 / 部门 / 地址 / 流水号 ======
  // 用户列表，用于把 ID 映射成姓名
  const { data: userList = [] } = useQuery({
    queryKey: ["users", "forList"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/users");
        const list = Array.isArray(res) ? res : [];
        return list;
      } catch (e) {
        console.error("获取用户列表失败（列表页）:", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // 部门列表：从API加载
  const { data: departmentListData, isLoading: departmentListLoading } = useQuery({
    queryKey: ["departments", "forList"],
    queryFn: async () => {
      try {
        const res = await departmentApi.getDepartments();
        return res.data || [];
      } catch (e) {
        console.error("获取部门列表失败（列表页）:", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    retry: 3,
  });

  const departmentList = departmentListData || [];

  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    (userList as any[]).forEach((u) => {
      if (!u) return;
      map.set(String(u.id), u);
    });
    return map;
  }, [userList]);

  const departmentMap = useMemo(() => {
    const map = new Map<string, any>();
    departmentList.forEach((d) => {
      map.set(String(d.id), d);
    });
    return map;
  }, [departmentList]);

  // 提取所有字段（合并配置字段 + 元数据），用于构建列表和显示设置
  const allFieldsList = useMemo(() => {
    if (!formDefinition?.config) return [];
    const items =
      formDefinition.config.elements || formDefinition.config.fields || [];
    const definitionFields = (formDefinition.fields || []) as any[];

    // 从设计器配置里递归提取字段
    const collect = (list: any[]): any[] => {
      const result: any[] = [];
      list.forEach((item) => {
        if (
          item.type === "groupTitle" ||
          item.type === "tab" ||
          item.type === "multiColumn"
        ) {
          const children =
            item.children ||
            (Array.isArray(item.columns)
              ? item.columns.flatMap((c: any) => c.children || [])
              : []);
          if (children?.length) {
            result.push(...collect(children));
          }
        } else if (item.type !== "button") {
          result.push(item);
        }
      });
      return result;
    };

    const raw = collect(items);

    // 将配置字段与后端字段元数据合并，保证 fieldId / fieldName / type 等信息完整
    return raw.map((field: any) => {
      const fieldId = field.fieldId || field.id;
      const fieldName = field.fieldName || field.name || field.key;
      const key = fieldId || fieldName;

      const meta =
        definitionFields.find((df: any) => {
          return (
            (df.fieldId && df.fieldId === fieldId) ||
            (df.code && (df.code === fieldId || df.code === fieldName)) ||
            (df.key && df.key === fieldName)
          );
        }) || {};

      return {
        ...field,
        ...meta,
        fieldId: fieldId || meta.fieldId || meta.code || key,
        fieldName: fieldName || meta.fieldName || meta.code || key,
      };
    });
  }, [formDefinition]);

  // 计算「显示设置」里用到的所有字段 key（包含子表子字段）
  const getAllDisplayFieldKeys = useCallback((fields: any[]): string[] => {
    const keys: string[] = [];
    fields.forEach((f: any) => {
      const baseKey = f.fieldId || f.fieldName || f.id || f.key;
      if (!baseKey) return;
      if (f.type === "subtable" && Array.isArray(f.subtableFields)) {
        f.subtableFields.forEach((sub: any, idx: number) => {
          const subKey = sub.fieldId || sub.fieldName || sub.key || `sub${idx}`;
          const visibleKey = `${baseKey}_${
            sub.fieldName || sub.fieldId || subKey
          }`;
          keys.push(visibleKey);
        });
      } else {
        keys.push(baseKey);
      }
    });
    return keys;
  }, []);

  // 从 localStorage 读取保存的字段显示设置
  const getSavedVisibleFields = useCallback((): Set<string> | null => {
    if (!formId) return null;
    try {
      const saved = localStorage.getItem(`formDisplayFields_${formId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return new Set(parsed);
        }
      }
    } catch (e) {
      console.warn("读取字段显示设置失败", e);
    }
    return null;
  }, [formId]);

  // 保存字段显示设置到 localStorage
  const saveVisibleFields = useCallback(
    (fields: Set<string>) => {
      if (!formId) return;
      try {
        const array = Array.from(fields);
        localStorage.setItem(`formDisplayFields_${formId}`, JSON.stringify(array));
      } catch (e) {
        console.warn("保存字段显示设置失败", e);
      }
    },
    [formId]
  );

  // 可见字段集合
  const [visibleFields, setVisibleFields] = useState<Set<string>>(
    () => getSavedVisibleFields() || new Set()
  );


  // 排序状态
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    order: 'asc' | 'desc';
  } | null>(() => {
    if (!formId) return null;
    try {
      const saved = localStorage.getItem(`formSortConfig_${formId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.key) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("读取排序配置失败", e);
    }
    return null;
  });

  // 保存排序配置到 localStorage
  const saveSortConfig = useCallback(
    (config: { key: string; order: 'asc' | 'desc' } | null) => {
      if (!formId) return;
      try {
        if (config) {
          localStorage.setItem(`formSortConfig_${formId}`, JSON.stringify(config));
        } else {
          localStorage.removeItem(`formSortConfig_${formId}`);
        }
      } catch (e) {
        console.warn("保存排序配置失败", e);
      }
    },
    [formId]
  );

  // 是否正在初始化（用于避免初始化时触发保存）
  const [isInitializing, setIsInitializing] = useState(true);
  // 标记是否已经初始化过（避免重复初始化）
  const [hasInitialized, setHasInitialized] = useState(false);

  // 当表单字段加载完成时，初始化可见字段（优先使用保存的设置，否则全部可见）
  useEffect(() => {
    if (!allFieldsList.length || hasInitialized) return;
    
    const allKeys = getAllDisplayFieldKeys(allFieldsList);
    if (allKeys.length === 0) return;

    setIsInitializing(true);
    
    // 尝试从 localStorage 加载保存的设置
    const saved = getSavedVisibleFields();
    let finalFields: Set<string>;
    
    if (saved && saved.size > 0) {
      // 验证保存的字段是否仍然存在于当前字段列表中
      const validSaved = new Set(
        Array.from(saved).filter((key) => allKeys.includes(key))
      );
      if (validSaved.size > 0) {
        // 使用保存的有效字段
        finalFields = validSaved;
      } else {
        // 保存的字段都无效了，使用全部字段
        finalFields = new Set(allKeys);
      }
    } else {
      // 没有保存的设置，使用全部字段
      finalFields = new Set(allKeys);
    }
    
    setVisibleFields(finalFields);
    setHasInitialized(true);
    
    // 保存初始状态（如果是全部字段且没有保存的设置，也要保存）
    if (formId && finalFields.size > 0) {
      try {
        saveVisibleFields(finalFields);
      } catch (error) {
        console.error("保存初始字段显示设置失败:", error);
      }
    }
    
    // 延迟设置 isInitializing，确保状态更新完成
    setTimeout(() => {
      setIsInitializing(false);
    }, 50);
  }, [allFieldsList, getAllDisplayFieldKeys, getSavedVisibleFields, hasInitialized]);

  // 当 formId 变化时，重置初始化状态
  useEffect(() => {
    setHasInitialized(false);
    setIsInitializing(true);
  }, [formId]);

  // 当 visibleFields 变化时，自动保存到 localStorage（排除初始化阶段）
  useEffect(() => {
    // 只有在初始化完成且不是初始化导致的改变时才保存
    if (!isInitializing && hasInitialized && formId && allFieldsList.length > 0 && visibleFields.size > 0) {
      // 延迟保存，避免频繁写入 localStorage
      const timer = setTimeout(() => {
        saveVisibleFields(visibleFields);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [visibleFields, formId, saveVisibleFields, allFieldsList.length, isInitializing, hasInitialized]);
  
  // 当排序配置变化时，自动保存到 localStorage
  useEffect(() => {
    if (formId) {
      saveSortConfig(sortConfig);
    }
  }, [sortConfig, formId, saveSortConfig]);

  const handleColumnResize = useCallback((colKey: string) => {
    return (_e: unknown, { size }: { size: { width: number } }) => {
      setColumnWidths((prev) => ({
        ...prev,
        [colKey]: Math.min(COL_MAX, Math.max(COL_MIN, Math.round(size.width))),
      }));
    };
  }, []);

  const loadColumnWidths = useCallback((): Record<string, number> => {
    if (!formId) return {};
    try {
      const raw = localStorage.getItem(`formColumnWidths_${formId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (parsed && typeof parsed === "object") return parsed;
      }
    } catch {
      /* ignore */
    }
    return {};
  }, [formId]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const skipNextColumnWidthSaveRef = useRef(false);

  useEffect(() => {
    skipNextColumnWidthSaveRef.current = true;
    setColumnWidths(loadColumnWidths());
  }, [formId, loadColumnWidths]);

  useEffect(() => {
    if (!formId) return;
    if (skipNextColumnWidthSaveRef.current) {
      skipNextColumnWidthSaveRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(`formColumnWidths_${formId}`, JSON.stringify(columnWidths));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [columnWidths, formId]);

  // 数据源映射
  const rowData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((record: any, index: number) => {
      const recordData = record.data || {};
      const mapped: any = { ...recordData };
      return {
        ...record,
        ...mapped,
        _rowIndex: index + 1,
        recordId: record.recordId || record.id,
      };
    });
  }, [data]);

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 滚动条同步相关 refs
  const tableBodyRef = useRef<HTMLDivElement>(null);
  const FIXED_SCROLL_OFFSET = 360;
  const calcFixedScrollY = () =>
    Math.max(320, (typeof window !== "undefined" ? window.innerHeight : 900) - FIXED_SCROLL_OFFSET);
  // 固定大小策略：不依赖容器首帧测量，避免刷新后高度随机变化
  const [tableScrollY, setTableScrollY] = useState<number>(calcFixedScrollY);

  useEffect(() => {
    // 数据变化时重置到第一页
    setCurrentPage(1);
  }, [rowData.length]);

  const pagedRowData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return rowData.slice(start, end);
  }, [rowData, currentPage, pageSize]);

  useEffect(() => {
    const onResize = () => {
      const next = calcFixedScrollY();
      setTableScrollY((prev) => (Math.abs(prev - next) > 2 ? next : prev));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 不再使用自定义横向滚动条，同步逻辑移除：避免出现双横条/覆盖数据

  // 单个关联记录显示组件
  const SingleRelatedRecordDisplay: React.FC<{
    recordId: string;
    relatedFormId: string;
    relatedDisplayField?: string;
    allRelatedFields: any[];
  }> = ({ recordId, relatedDisplayField, allRelatedFields }) => {
    // 确保 recordId 是字符串
    const recordIdStr = String(recordId || "");
    
    if (!recordIdStr) {
      return <span>-</span>;
    }

    const { data: recordData, isLoading, error } = useQuery({
      queryKey: ["formData", recordIdStr],
      queryFn: () => formDataApi.getById(recordIdStr),
      enabled: !!recordIdStr,
      retry: 1, // 只重试一次
      staleTime: 5 * 60 * 1000, // 5分钟缓存
    });

    if (isLoading) {
      return <span>加载中...</span>;
    }

    if (error || !recordData) {
      // 如果获取失败，显示 recordId 的简短版本
      try {
        const shortId = recordIdStr.length > 20 ? `${recordIdStr.substring(0, 20)}...` : recordIdStr;
        return <span>{shortId}</span>;
      } catch {
        return <span>-</span>;
      }
    }

    try {
      const data = recordData.data || {};
      
      // 确定显示字段
      const displayFieldId = relatedDisplayField || 
        (() => {
          try {
            const textField = allRelatedFields.find(
              (f: any) => f?.type === "input" || f?.type === "textarea"
            );
            return textField?.fieldId || allRelatedFields[0]?.fieldId;
          } catch {
            return null;
          }
        })();

      let displayValue = displayFieldId ? data[displayFieldId] : undefined;
      
      if (displayValue === null || displayValue === undefined || displayValue === "") {
        // 如果显示字段为空，尝试使用第一个有值的字段
        const firstValue = Object.values(data).find(
          (v: any) => v !== null && v !== undefined && v !== ""
        );
        displayValue = firstValue;
      }
      
      // 如果还是没有值，使用 recordId 的简短版本
      if (displayValue === null || displayValue === undefined || displayValue === "") {
        const shortId = recordIdStr.length > 20 ? `${recordIdStr.substring(0, 20)}...` : recordIdStr;
        return <span>{shortId}</span>;
      }
      
      if (typeof displayValue === "object") {
        displayValue = JSON.stringify(displayValue);
      }
      
      return <span>{String(displayValue || recordIdStr)}</span>;
    } catch (error) {
      console.error("显示关联记录失败:", error);
      const shortId = recordIdStr.length > 20 ? `${recordIdStr.substring(0, 20)}...` : recordIdStr;
      return <span>{shortId}</span>;
    }
  };

  // 关联表单字段显示组件
  const RelatedFormFieldDisplay: React.FC<{
    field: any;
    value: any;
  }> = ({ field, value }) => {
    try {
      const relatedFormId = field?.relatedFormId;
      const relatedDisplayField = field?.relatedDisplayField;
      
      if (!relatedFormId) {
        return (
          <div>
            <div className={`${styles.h3TgCell} ${styles.runtime}`}>
              <span>-</span>
            </div>
          </div>
        );
      }

      // 处理多选情况，确保 value 是有效的
      let recordIds: string[] = [];
      try {
        if (Array.isArray(value)) {
          recordIds = value.filter((v) => v !== null && v !== undefined && v !== "").map(String);
        } else if (value !== null && value !== undefined && value !== "") {
          recordIds = [String(value)];
        }
      } catch (error) {
        console.error("解析关联表单值失败:", error);
        return (
          <div>
            <div className={`${styles.h3TgCell} ${styles.runtime}`}>
              <span>-</span>
            </div>
          </div>
        );
      }
      
      if (recordIds.length === 0) {
        return (
          <div>
            <div className={`${styles.h3TgCell} ${styles.runtime}`}>
              <span>-</span>
            </div>
          </div>
        );
      }

      // 获取关联表单定义
      const { data: relatedFormDefinition, isLoading: formLoading } = useQuery({
        queryKey: ["formDefinition", relatedFormId],
        queryFn: () => formDefinitionApi.getById(relatedFormId),
        enabled: !!relatedFormId,
        retry: 1,
        staleTime: 5 * 60 * 1000,
      });

      // 提取关联表单的所有字段（用于找显示字段）
      const allRelatedFields = useMemo(() => {
        try {
          if (!relatedFormDefinition?.config) return [];
          const items = relatedFormDefinition.config.elements || relatedFormDefinition.config.fields || [];
          
          const collect = (list: any[]): any[] => {
            const result: any[] = [];
            try {
              list.forEach((item) => {
                if (
                  item?.type === "groupTitle" ||
                  item?.type === "tab" ||
                  item?.type === "multiColumn"
                ) {
                  const children =
                    item.children ||
                    (Array.isArray(item.columns)
                      ? item.columns.flatMap((c: any) => c?.children || [])
                      : []);
                  if (children?.length) {
                    result.push(...collect(children));
                  }
                } else if (item?.type !== "button") {
                  result.push(item);
                }
              });
            } catch (error) {
              console.error("提取关联表单字段失败:", error);
            }
            return result;
          };
          
          return collect(items);
        } catch (error) {
          console.error("处理关联表单定义失败:", error);
          return [];
        }
      }, [relatedFormDefinition]);

      if (formLoading) {
        return (
          <div>
            <div className={`${styles.h3TgCell} ${styles.runtime}`}>
              <span>加载中...</span>
            </div>
          </div>
        );
      }

      return (
        <div>
          <div className={`${styles.h3TgCell} ${styles.runtime}`}>
            <span>
              {recordIds.map((recordId: string, idx: number) => (
                <React.Fragment key={recordId || idx}>
                  {idx > 0 && ", "}
                  <SingleRelatedRecordDisplay
                    recordId={recordId}
                    relatedFormId={relatedFormId}
                    relatedDisplayField={relatedDisplayField}
                    allRelatedFields={allRelatedFields}
                  />
                </React.Fragment>
              ))}
            </span>
          </div>
        </div>
      );
    } catch (error) {
      console.error("显示关联表单字段失败:", error);
      return (
        <div>
          <div className={`${styles.h3TgCell} ${styles.runtime}`}>
            <span>-</span>
          </div>
        </div>
      );
    }
  };

  // 单元格内容渲染（普通字段 + 系统字段）
  const renderCellValue = useCallback(
    (field: any, value: any, _record: any) => {
      // 统一用 h3-tg-cell runtime 结构包裹，贴近参考实现
      const wrap = (content: React.ReactNode) => (
        <div>
          <div className={`${styles.h3TgCell} ${styles.runtime}`}>
            <span>{content}</span>
          </div>
        </div>
      );

      // 关联表单字段特殊处理
      if (field?.type === "relatedForm" || field?.type === "relatedFormMulti") {
        return <RelatedFormFieldDisplay field={field} value={value} />;
      }

      // 标题字段这边按参考实现，不再做「点击查看详情」链接，只保留普通展示

      if (field?.type === "date" || field?.type === "datetime") {
        if (!value) return wrap("-");
        const d = dayjs(value);
        const text = d.isValid()
          ? d.format(field.type === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm")
          : "-";
        return wrap(text);
      }

      // 人员字段：显示姓名（支持 ID / 对象 / JSON 字符串），未匹配到时兜底“未知用户(#ID)”
      if (field?.type === "user" || field?.label?.includes("人员")) {
        let val = value;
        if (!val) return wrap("-");

        // JSON 字符串
        if (typeof val === "string" && (val.trim().startsWith("{") || val.trim().startsWith("["))) {
          try {
            val = JSON.parse(val);
          } catch {
            // ignore
          }
        }

        const extractName = (v: any) => {
          if (!v) return "";
          if (typeof v === "string" || typeof v === "number") {
            const id = String(v).trim();
            const u = userMap.get(id);
            if (u) return u.name || u.account || id;
            // 若不是纯数字（可能已是姓名/账号），直接显示原值
            if (/\D/.test(id)) return id;
            // 纯数字但未匹配到用户，兜底显示
            return `未知用户(#${id})`;
          }
          return v.name || v.label || v.account || v.id || "";
        };

        if (Array.isArray(val)) {
          const names = val.map(extractName).filter(Boolean);
          return wrap(names.length ? names.join(", ") : "-");
        }
        const name = extractName(val);
        return wrap(name || "-");
      }

      // 部门字段：显示部门名称
      if (field?.type === "department" || field?.label?.includes("部门")) {
        let val = value;
        if (!val) return wrap("-");

        if (typeof val === "string" && (val.trim().startsWith("{") || val.trim().startsWith("["))) {
          try {
            val = JSON.parse(val);
          } catch {
            // ignore
          }
        }

        const extractDeptName = (v: any) => {
          if (!v) return "";
          if (typeof v === "string" || typeof v === "number") {
            const id = String(v);
            const d = departmentMap.get(id);
            if (d) return d.name || id;
            // 如果不是纯数字（可能已经是部门名称），直接返回
            if (/\D/.test(id)) return id;
            // 纯数字但未匹配到部门，显示未知部门
            return `未知部门(#${id})`;
          }
          return v.name || v.label || v.id || "";
        };

        if (Array.isArray(val)) {
          const names = val.map(extractDeptName).filter(Boolean);
          return wrap(names.length ? names.join(", ") : "-");
        }
        const name = extractDeptName(val);
        return wrap(name || "-");
      }

      // 地址字段：拼接省市区+详细地址
      if (
        field?.type === "address" ||
        field?.advanced?.fieldType === "address" ||
        field?.label === "地址"
      ) {
        let val = value;
        if (!val) return wrap("-");

        if (typeof val === "string") {
          const trimmed = val.trim();
          if (trimmed === "[object Object]") {
            return wrap("-");
          }
          if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
            try {
              val = JSON.parse(trimmed);
            } catch {
              return wrap(val);
            }
          } else {
            return wrap(val);
          }
        }

        if (typeof val === "object") {
          const parts = [val.province, val.city, val.district, val.detail].filter(Boolean);
          return wrap(parts.length ? parts.join("") : "-");
        }
        return wrap(String(val));
      }

      // 流水号字段：直接显示值
      if (field?.type === "serial" || field?.isSystemField === true && field?.systemFieldType === "serial") {
        if (!value && value !== 0) return wrap("-");
        return wrap(String(value));
      }

      // 附件/图片：antd Upload 存对象或 fileList，禁止 String(obj) 成 [object Object]
      if (field?.type === "attachment") {
        const urls = extractAttachmentPreviewUrls(value);
        if (!urls.length) return wrap("-");
        const wrapMedia = (content: React.ReactNode) => (
          <div>
            <div className={`${styles.h3TgCell} ${styles.runtime}`}>{content}</div>
          </div>
        );
        return wrapMedia(
          <span
            style={{
              display: "inline-flex",
              gap: 4,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {urls.slice(0, 3).map((url, i) => (
              <img
                key={`${url}-${i}`}
                src={url}
                alt=""
                style={{
                  maxHeight: 44,
                  maxWidth: 72,
                  objectFit: "cover",
                  borderRadius: 4,
                  verticalAlign: "middle",
                }}
              />
            ))}
            {urls.length > 3 ? (
              <span style={{ color: "#888", fontSize: 12 }}>+{urls.length - 3}</span>
            ) : null}
          </span>
        );
      }

      if (Array.isArray(value)) {
        const text = value
          .map((v: any) => v?.name || v?.label || v)
          .join(", ");
        return wrap(text || "-");
      }

      if (value === null || value === undefined || value === "") {
        return wrap("-");
      }
      return wrap(String(value));
    },
    [userMap, departmentMap]
  );

  // antd Table 列定义（先保证能正常显示数据）
  const tableColumns = useMemo(() => {
    const cols: any[] = [];
    const colW = (colKey: string, def: number) => columnWidths[colKey] ?? def;

    const toggleFixed = (key: string) => {
      setFixedColumnKeys((prev) => {
        if (prev.includes(key)) {
          return prev.filter((k) => k !== key);
        }
        // 最多锁定前 4 列，防止锁太多
        if (prev.length >= 4) return prev;
        return [...prev, key];
      });
    };

    const buildTitleWithLock = (label: string, key: string) => {
      const isFixed = fixedColumnKeys.includes(key);
      return (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span>{label}</span>
          <LockOutlined
            style={{
              fontSize: 12,
              color: isFixed ? "#1890ff" : "#d9d9d9",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleFixed(key);
            }}
          />
        </span>
      );
    };

    // 序号
    cols.push({
      key: "_serial",
      title: "序号",
      dataIndex: "_rowIndex",
      width: colW("_serial", DEFAULT_W_SERIAL),
      fixed: "left" as const,
      onHeaderCell: (column: any) => ({
        width: column.width,
        onResize: handleColumnResize("_serial"),
      }),
    });

    allFieldsList.forEach((f: any) => {
      const key = f.fieldId || f.fieldName || f.id || f.key;
      if (!key) return;

      // 子表：拆成多个子字段列
      if (f.type === "subtable" && Array.isArray(f.subtableFields)) {
        const parentLabel = f.label || f.fieldName || key;
        const parentFieldId = f.fieldId || key;
        f.subtableFields.forEach((sub: any, idx: number) => {
          const subKey = sub.fieldId || sub.fieldName || sub.key || `sub${idx}`;
          const visibleKey = `${key}_${sub.fieldName || sub.fieldId || subKey}`;
          if (!visibleFields.has(visibleKey)) return;
          const title =
            (parentLabel ? `${parentLabel} ` : "") +
            (sub.label || sub.fieldName || `子表字段${idx + 1}`);
          cols.push({
            title,
            key: visibleKey,
            width: colW(visibleKey, DEFAULT_W_SUB),
            onHeaderCell: (column: any) => ({
              width: column.width,
              onResize: handleColumnResize(visibleKey),
            }),
            render: (_: any, record: any) => {
              let raw = record[parentFieldId] ?? record[f.fieldName];
              let rows: any[] = [];
              if (Array.isArray(raw)) {
                rows = raw;
              } else if (typeof raw === "string") {
                try {
                  const parsed = JSON.parse(raw);
                  rows = Array.isArray(parsed) ? parsed : [];
                } catch {
                  rows = [];
                }
              }
              if (!rows.length) return "-";
              return (
                <div className={styles.subtableCell}>
                  <div className={styles.subtableRowContent}>
                    <div>
                      {/* 参考 tg-lazy-fix / tg-lazy-item 结构 */}
                      {rows.map((r, i) => {
                        const v =
                          r[sub.fieldId] ??
                          r[sub.fieldName] ??
                          r[sub.key] ??
                          r[visibleKey];

                        // 子表中的关联表单字段，使用统一的显示组件，避免直接显示 record_xxx
                        const isRelatedFormSubField =
                          sub.type === "relatedForm" || sub.type === "relatedFormMulti";

                        const text =
                          v && typeof v === "object"
                            ? v.name || v.label || JSON.stringify(v)
                            : v ?? "-";

                        return (
                          <div key={i} className={styles.subtableRow}>
                            <div className={styles.h3TgCell}>
                              <div className={styles.runtime}>
                                {isRelatedFormSubField ? (
                                  <RelatedFormFieldDisplay field={sub} value={v} />
                                ) : (
                                  <span>{text}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            },
          });
        });
        return;
      }

      if (!visibleFields.has(key)) return;
      const isFixed = fixedColumnKeys.includes(key);
      const colKey = String(key);
      const title = buildTitleWithLock(
        f.label || f.fieldName || key,
        key.toString(),
      );
      
      // 判断字段类型，决定是否支持排序
      const fieldType = f.type;
      const canSort = fieldType !== 'subtable' && fieldType !== 'attachment' && fieldType !== 'button';
      
      cols.push({
        title,
        key: colKey,
        dataIndex: key,
        width: colW(colKey, DEFAULT_W_FIELD),
        fixed: isFixed ? ("left" as const) : undefined,
        onHeaderCell: (column: any) => ({
          width: column.width,
          onResize: handleColumnResize(colKey),
        }),
        render: (value: any, record: any) => renderCellValue(f, value, record),
        sorter: canSort ? (a: any, b: any) => {
          let aVal = a[key];
          let bVal = b[key];
          
          // 根据字段类型进行排序
          if (fieldType === 'number') {
            aVal = Number(aVal) || 0;
            bVal = Number(bVal) || 0;
            return aVal - bVal;
          } else if (fieldType === 'date' || fieldType === 'datetime') {
            aVal = aVal ? new Date(aVal).getTime() : 0;
            bVal = bVal ? new Date(bVal).getTime() : 0;
            return aVal - bVal;
          } else {
            aVal = String(aVal || '').toLowerCase();
            bVal = String(bVal || '').toLowerCase();
            return aVal.localeCompare(bVal);
          }
        } : undefined,
        sortOrder: sortConfig && sortConfig.key === key 
          ? (sortConfig.order === 'asc' ? 'ascend' : 'descend') 
          : null,
      });
    });

    // 操作列：详情 | 删除
    cols.push({
      title: "操作",
      key: "_actions",
      fixed: "right" as const,
      width: colW("_actions", DEFAULT_W_ACTIONS),
      onHeaderCell: (column: any) => ({
        width: column.width,
        onResize: handleColumnResize("_actions"),
      }),
      render: (_: any, record: any) => {
        const recordId = record.recordId || record.id;
        return (
          <Space size={8}>
            {onView && (
              <a
                onClick={() => {
                  onView(recordId);
                }}
              >
                详情
              </a>
            )}
            <a
              style={{ color: "#ff4d4f" }}
              onClick={() => {
                if (!recordId) return;
                setSelectedRowKeys([recordId]);
                setDeleteModalVisible(true);
              }}
            >
              删除
            </a>
          </Space>
        );
      },
    });

    return cols;
  }, [
    allFieldsList,
    visibleFields,
    renderCellValue,
    fixedColumnKeys,
    onView,
    sortConfig,
    columnWidths,
    handleColumnResize,
  ]);

  if (formLoading || isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!formDefinition) {
    return (
      <div style={{ padding: 24, borderRadius: 8, textAlign: "center" }}>
        <p>表单不存在</p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        padding: 24,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* 顶部工具栏 */}
      <div
        style={{
          marginBottom: 16,
          borderBottom: "1px solid #f0f0f0",
          paddingBottom: 12,
          flexShrink: 0,
        }}
      >
        {/* 第一排：表单名称 + 视图筛选 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 12,
            justifyContent: "space-between",
          }}
        >
          <Space size={12}>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {formDefinition?.formName || "未命名表单"}
            </Typography.Text>

            <Dropdown
              menu={{
                items: [
                  {
                    key: "全部数据",
                    label: "全部数据",
                    onClick: () => setDataScope("全部数据"),
                  },
                  {
                    key: "我的数据",
                    label: "我的数据",
                    onClick: () => setDataScope("我的数据"),
                  },
                  {
                    key: "我部门数据",
                    label: "我部门数据",
                    onClick: () => setDataScope("我部门数据"),
                  },
                ],
              }}
              trigger={["click"]}
            >
              <Tag color="default" style={{ cursor: "pointer", userSelect: "none" }}>
                {dataScope} <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
              </Tag>
            </Dropdown>

            <Button
              type="link"
              style={{ padding: 0 }}
              onClick={() => {
                if (!selectedRowKeys.length) {
                  message.warning("请先勾选要提交的数据");
                  return;
                }

                Modal.confirm({
                  title: "确认提交",
                  content: `将提交选中的 ${selectedRowKeys.length} 条数据，提交后将进入已提交状态。`,
                  okText: "提交",
                  cancelText: "取消",
                  onOk: async () => {
                    try {
                      // 逐条提交（后端通过 POST /form-data + recordId 走更新逻辑）
                      for (const recordId of selectedRowKeys) {
                        const record = rowData.find((r: any) => (r.recordId || r.id) === recordId);
                        if (!record) continue;
                        await formDataApi.submit({
                          formId,
                          recordId,
                          data: record.data || {},
                          status: "submitted",
                        });
                      }
                      message.success("提交成功");
                      setSelectedRowKeys([]);
                      refetch();
                    } catch (e: any) {
                      message.error(e?.message || "提交失败");
                    }
                  },
                });
              }}
            >
              表单提交
            </Button>

            <Button
              type="link"
              style={{ padding: 0 }}
              onClick={() => message.info("新建视图：待接入视图管理")}
            >
              新建视图
            </Button>

            <Dropdown
              menu={{
                items: [
                  {
                    key: "全部",
                    label: "全部",
                    onClick: () => onFilterChange?.("全部"),
                  },
                  {
                    key: "我部门的",
                    label: "我部门的",
                    onClick: () => onFilterChange?.("我部门的"),
                  },
                  {
                    key: "我的",
                    label: "我的",
                    onClick: () => onFilterChange?.("我的"),
                  },
                  { type: "divider" },
                  {
                    key: "管理",
                    label: (
                      <Space>
                        <SettingOutlined style={{ color: "#1890ff" }} />
                        <span style={{ color: "#1890ff" }}>管理</span>
                      </Space>
                    ),
                    onClick: () => onManageFilters?.(),
                  },
                ],
              }}
              trigger={["click"]}
            >
              <Tag color="blue" style={{ cursor: "pointer", userSelect: "none" }}>
                {selectedFilter} <DownOutlined style={{ fontSize: 10, marginLeft: 4 }} />
              </Tag>
            </Dropdown>
          </Space>
        </div>

        {/* 第二排：按钮区 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Space>
            {selectedRowKeys.length > 0 ? (
              <>
                <Space
                  style={{
                    background: "#fff1f0",
                    border: "1px solid #ffccc7",
                    borderRadius: 4,
                    padding: "4px 12px",
                    marginRight: 8,
                  }}
                >
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setSelectedRowKeys([])}
                    style={{ padding: 0, color: "#ff4d4f" }}
                  />
                  <span style={{ color: "#ff4d4f", margin: "0 8px" }}>
                    已选{selectedRowKeys.length}条
                  </span>
                </Space>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() =>
                    message.info(`导出选中的 ${selectedRowKeys.length} 条数据`)
                  }
                >
                  导出
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setDeleteModalVisible(true)}
                >
                  删除
                </Button>
              </>
            ) : (
              <>
                {onAdd && (
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={onAdd}
                  >
                    新增
                  </Button>
                )}
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() =>
                    message.info(`导入 ${formDefinition?.formName} 的数据`)
                  }
                >
                  导入
                </Button>
                <Button
                  icon={<UploadOutlined />}
                  onClick={() =>
                    message.info(`导出 ${formDefinition?.formName} 的数据`)
                  }
                >
                  导出
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() =>
                    message.info(`删除 ${formDefinition?.formName} 的数据`)
                  }
                >
                  删除
                </Button>
                <Button
                  icon={<QrcodeOutlined />}
                  onClick={() =>
                    message.info(`打印 ${formDefinition?.formName} 的二维码`)
                  }
                >
                  打印二维码
                </Button>
              </>
            )}
          </Space>

          <Space>
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
            >
              刷新
            </Button>
            <Button
              type="text"
              icon={<ClockCircleOutlined />}
              onClick={() => setOperationRecordVisible(true)}
            >
              操作记录
            </Button>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => setDisplaySettingsVisible(true)}
            >
              显示
            </Button>
            {onDesign && (
              <Button
                type="text"
                icon={<AppstoreOutlined />}
                style={{ color: "#1890ff", backgroundColor: "#e6f7ff" }}
                onClick={onDesign}
              />
            )}
            <Button
              type="text"
              icon={<BarChartOutlined />}
              style={{ backgroundColor: "#e6f7ff" }}
            />
          </Space>
        </div>
      </div>

      {/* 列表外框：边框内表格区贴底到分页，中间不留大块空白 */}
      <div className={styles.listFrame}>
        {/* 中部表格区域 */}
        <div className={styles.tableContainer}>
          {rowData.length === 0 ? (
            <div className={styles.emptyMessage}>
              <Empty description="暂无数据" />
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
              <div
                style={{ flex: 1, overflow: "hidden", position: "relative" }}
              >
                <div
                  ref={(el) => {
                    if (el) {
                      const tableBody = el.querySelector(".ant-table-body") as HTMLElement;
                      if (tableBody) {
                        (tableBodyRef as any).current = tableBody;
                      }
                    }
                  }}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    minHeight: 0,
                  }}
                >
                  <Table
                    size="small"
                    bordered
                    rowKey="recordId"
                    columns={tableColumns}
                    dataSource={pagedRowData}
                    pagination={false}
                    scroll={{ x: "max-content", y: tableScrollY }}
                    style={{ marginBottom: 0 }}
                    tableLayout="fixed"
                    components={{
                      header: { cell: ResizableHeaderCell },
                    }}
                    rowSelection={{
                      selectedRowKeys,
                      onChange: (keys) =>
                        setSelectedRowKeys(keys as React.Key[] as string[]),
                    }}
                    onChange={(_pagination, _filters, sorter: any) => {
                      // 处理排序变化
                      if (sorter) {
                        // sorter 可能是对象或数组，处理单列排序
                        const sortObj = Array.isArray(sorter) ? sorter[0] : sorter;
                        if (sortObj && sortObj.field) {
                          const newSortConfig = {
                            key: sortObj.field,
                            order: sortObj.order === 'ascend' ? 'asc' as const : 'desc' as const,
                          };
                          setSortConfig(newSortConfig);
                          saveSortConfig(newSortConfig);
                        } else {
                          setSortConfig(null);
                          saveSortConfig(null);
                        }
                      } else {
                        setSortConfig(null);
                        saveSortConfig(null);
                      }
                    }}
                    onRow={
                      listWorkflowHoverEnabled
                        ? (record) => ({
                            onMouseEnter: (e) => {
                              clearRowHoverTimers();
                              // 必须在同步阶段保存 DOM 节点：React 合成事件在返回后 currentTarget 会被置空，异步里读会报错
                              const rowEl = e.currentTarget as HTMLElement | null;
                              const id = String(
                                (record as any).recordId || (record as any).id || "",
                              );
                              if (!id || !rowEl) return;
                              rowHoverEnterTimer.current = window.setTimeout(() => {
                                if (!rowEl.isConnected) return;
                                const r = rowEl.getBoundingClientRect();
                                setRowHoverTip({
                                  recordId: id,
                                  left: Math.max(8, Math.min(r.left, window.innerWidth - 316)),
                                  top: r.bottom + 6,
                                });
                              }, 450);
                            },
                            onMouseLeave: () => {
                              clearRowHoverTimers();
                              rowHoverLeaveTimer.current = window.setTimeout(
                                () => setRowHoverTip(null),
                                200,
                              );
                            },
                          })
                        : undefined
                    }
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部区域：横向细条紧贴表格下方，再分页（与参考产品一致） */}
        <div
          style={{
            marginTop: "auto",
            flexShrink: 0,
            borderTop: "1px solid #f0f0f0",
            paddingTop: 8,
          }}
        >
        {/* 底部分页栏 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 0,
          }}
        >
          <div />
          <Space size={12}>
            <Typography.Text type="secondary">
              共 {rowData.length} 条
            </Typography.Text>
            <Pagination
              size="small"
              current={currentPage}
              pageSize={pageSize}
              total={rowData.length}
              showSizeChanger
              pageSizeOptions={["10", "20", "50", "100"]}
              onChange={(page, size) => {
                setCurrentPage(page);
                setPageSize(size || pageSize);
              }}
            />
          </Space>
        </div>
        </div>
      </div>

      {listWorkflowHoverEnabled &&
        rowHoverTip &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: rowHoverTip.left,
              top: rowHoverTip.top,
              zIndex: 1070,
              width: 300,
              maxWidth: "calc(100vw - 24px)",
              pointerEvents: "auto",
              boxShadow: "0 3px 12px rgba(0, 0, 0, 0.12)",
              borderRadius: 8,
              border: "1px solid #f0f0f0",
              background: "#fff",
              padding: "10px 12px",
            }}
            onMouseEnter={() => clearRowHoverTimers()}
            onMouseLeave={() => {
              rowHoverLeaveTimer.current = window.setTimeout(
                () => setRowHoverTip(null),
                120,
              );
            }}
          >
            <WorkflowRowHoverCardContent
              recordId={rowHoverTip.recordId}
              formWorkflowEnabled={formWorkflowEnabled}
            />
          </div>,
          document.body,
        )}

      {/* 删除确认弹窗 */}
      <Modal
        open={deleteModalVisible}
        onCancel={() => setDeleteModalVisible(false)}
        onOk={async () => {
          try {
            for (const recordId of selectedRowKeys) {
              await formDataApi.delete(recordId);
            }
            message.success(`成功删除 ${selectedRowKeys.length} 条数据`);
            setSelectedRowKeys([]);
            setDeleteModalVisible(false);
            refetch();
          } catch (e: any) {
            message.error(e?.message || "删除失败");
          }
        }}
        okText="确认"
        cancelText="取消"
        okButtonProps={{ danger: true }}
        title={null}
        width={400}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            padding: "20px 0",
          }}
        >
          <div
            style={{
              fontSize: 24,
              color: "#faad14",
              marginRight: 16,
              lineHeight: 1,
            }}
          >
            ⚠️
          </div>
          <div style={{ flex: 1, fontSize: 14, color: "#333" }}>
            选中{selectedRowKeys.length}行数据,删除后将无法恢复,确定删除?
          </div>
        </div>
      </Modal>

      {/* 字段显示设置抽屉（简单版，只区分显示/隐藏字段） */}
      <Drawer
        title="字段显示设置"
        placement="right"
        open={displaySettingsVisible}
        onClose={() => {
          // 关闭时确保保存
          if (formId && allFieldsList.length > 0 && visibleFields.size > 0) {
            saveVisibleFields(visibleFields);
          }
          setDisplaySettingsVisible(false);
        }}
        width={360}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <div style={{ marginBottom: 12, fontWeight: 500 }}>显示字段</div>
            <div
              style={{
                maxHeight: 400,
                overflowY: "auto",
                border: "1px solid #f0f0f0",
                borderRadius: 4,
                padding: "8px 0",
              }}
            >
              {allFieldsList.map((field: any) => {
                const baseKey =
                  field.fieldId || field.fieldName || field.id || field.key;
                if (!baseKey) return null;

                // 子表字段：拆成多个可勾选项
                if (field.type === "subtable" && Array.isArray(field.subtableFields)) {
                  const parentLabel = field.label || field.fieldName || baseKey;
                  return (
                    <div key={baseKey} style={{ padding: "4px 12px" }}>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>
                        {parentLabel}
                      </div>
                      {field.subtableFields.map((sub: any, idx: number) => {
                        const subKey =
                          sub.fieldId ||
                          sub.fieldName ||
                          sub.key ||
                          `sub${idx}`;
                        const visibleKey = `${baseKey}_${
                          sub.fieldName || sub.fieldId || subKey
                        }`;
                        const checked = visibleFields.has(visibleKey);
                        const label =
                          sub.label || sub.fieldName || `子表字段${idx + 1}`;
                        return (
                          <div key={visibleKey} style={{ paddingLeft: 12 }}>
                            <Checkbox
                              checked={checked}
                              onChange={(e) => {
                                setVisibleFields((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) {
                                    next.add(visibleKey);
                                  } else {
                                    next.delete(visibleKey);
                                  }
                                  // 立即保存（确保不丢失）
                                  if (formId && allFieldsList.length > 0) {
                                    try {
                                      saveVisibleFields(next);
                                    } catch (error) {
                                      console.error("保存字段显示设置失败:", error);
                                    }
                                  }
                                  return next;
                                });
                              }}
                            >
                              {label}
                            </Checkbox>
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // 普通字段
                const checked = visibleFields.has(baseKey);
                return (
                  <div key={baseKey} style={{ padding: "4px 12px" }}>
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        setVisibleFields((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) {
                            next.add(baseKey);
                          } else {
                            next.delete(baseKey);
                          }
                          // 立即保存（确保不丢失）
                          if (formId && allFieldsList.length > 0) {
                            try {
                              saveVisibleFields(next);
                            } catch (error) {
                              console.error("保存字段显示设置失败:", error);
                            }
                          }
                          return next;
                        });
                      }}
                    >
                      {field.label || field.fieldName || baseKey}
                    </Checkbox>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <Button
              type="link"
              style={{ padding: 0 }}
              onClick={() => {
                const allKeys = getAllDisplayFieldKeys(allFieldsList).filter(
                  Boolean
                );
                const newFields = new Set(allKeys);
                setVisibleFields(newFields);
                // 立即保存
                if (formId && allFieldsList.length > 0) {
                  saveVisibleFields(newFields);
                }
                message.success("已恢复显示全部字段");
              }}
            >
              显示全部字段
            </Button>
          </div>
        </div>
      </Drawer>

      {/* 操作记录弹窗 */}
      <OperationRecordModal
        visible={operationRecordVisible}
        formId={formId}
        onClose={() => setOperationRecordVisible(false)}
      />
    </div>
  );
};

// 操作记录弹窗组件
const OperationRecordModal: React.FC<{
  visible: boolean;
  formId: string;
  onClose: () => void;
}> = ({ visible, formId, onClose }) => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["operationLogs", formId],
    queryFn: () => operationLogApi.getLogs(formId, undefined, 100),
    enabled: visible && !!formId,
  });

  const getOperationTypeText = (type: string) => {
    const map: Record<string, string> = {
      create: "创建",
      update: "更新",
      delete: "删除",
    };
    return map[type] || type;
  };

  const getOperationTypeColor = (type: string) => {
    const map: Record<string, string> = {
      create: "green",
      update: "blue",
      delete: "red",
    };
    return map[type] || "default";
  };

  return (
    <Modal
      title="操作记录"
      open={visible}
      onCancel={onClose}
      footer={null}
      width={900}
    >
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "12px 16px",
            background: "#e6f7ff",
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 16, marginRight: 8 }}>ℹ️</span>
          <span style={{ fontSize: 14, color: "#1890ff" }}>
            显示表单的所有操作记录，包括创建、更新、删除操作
          </span>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Spin />
        </div>
      ) : logs.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无操作记录"
          style={{ padding: "40px 0" }}
        />
      ) : (
        <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
          {logs.map((log: OperationLog) => (
            <div
              key={log.id}
              style={{
                border: "1px solid #f0f0f0",
                borderRadius: 4,
                padding: 16,
                marginBottom: 12,
                backgroundColor: "#fafafa",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Tag color={getOperationTypeColor(log.operationType)}>
                    {getOperationTypeText(log.operationType)}
                  </Tag>
                  <span style={{ fontWeight: 500 }}>
                    {log.operatorName || log.operatorId}
                  </span>
                  <span style={{ color: "#999", fontSize: 12 }}>
                    {dayjs(log.createdAt).format("YYYY-MM-DD HH:mm:ss")}
                  </span>
                </div>
                <span style={{ color: "#999", fontSize: 12 }}>
                  记录ID: {log.recordId.substring(0, 20)}...
                </span>
              </div>

              {log.description && (
                <div style={{ marginBottom: 8, color: "#666" }}>
                  {log.description}
                </div>
              )}

              {log.fieldChanges && log.fieldChanges.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
                    字段变更：
                  </div>
                  {log.fieldChanges.map((change, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#fff",
                        borderRadius: 4,
                        marginBottom: 4,
                        border: "1px solid #e8e8e8",
                      }}
                    >
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>
                        {change.fieldLabel || change.fieldId}
                      </div>
                      <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: "#999" }}>旧值：</span>
                          <span style={{ color: "#ff4d4f" }}>
                            {change.oldValue === null || change.oldValue === undefined
                              ? "（空）"
                              : typeof change.oldValue === "object"
                              ? JSON.stringify(change.oldValue)
                              : String(change.oldValue)}
                          </span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: "#999" }}>新值：</span>
                          <span style={{ color: "#52c41a" }}>
                            {change.newValue === null || change.newValue === undefined
                              ? "（空）"
                              : typeof change.newValue === "object"
                              ? JSON.stringify(change.newValue)
                              : String(change.newValue)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
};

