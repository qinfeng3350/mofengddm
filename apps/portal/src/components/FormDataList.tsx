import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
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

import styles from "./FormDataList.module.css";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";
import { apiClient } from "@/api/client";
import { departmentApi } from "@/api/department";
import { operationLogApi } from "@/api/operationLog";
import type { OperationLog } from "@/api/operationLog";

interface FormDataListProps {
  formId: string;
  formDefinition?: any;
  onAdd?: () => void;
  onDesign?: () => void;
  onView?: (recordId: string) => void;
  selectedFilter?: string;
  onFilterChange?: (filter: string) => void;
  onManageFilters?: () => void;
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
  const { data: userList = [], isLoading: userListLoading, error: userListError } = useQuery({
    queryKey: ["users", "forList"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/users");
        const list = Array.isArray(res) ? res : [];
        console.log("【调试】用户列表API返回:", list.length, "个用户");
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

  // 调试：打印用户列表加载状态
  useEffect(() => {
    if (userListLoading) {
      console.log("【调试】用户列表加载中...");
    } else if (userListError) {
      console.error("【调试】用户列表加载失败:", userListError);
    } else if (userList.length > 0) {
      console.log("【调试】用户列表加载成功，数量:", userList.length);
    }
  }, [userListLoading, userListError, userList.length]);

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
    // 调试：打印用户列表和映射
    if (userList.length > 0) {
      console.log("【调试】用户列表已加载，用户数量:", userList.length);
      console.log("【调试】用户列表前3个:", userList.slice(0, 3));
      console.log("【调试】userMap大小:", map.size);
      console.log("【调试】userMap keys:", Array.from(map.keys()));
    }
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
  const scrollbarThumbRef = useRef<HTMLDivElement>(null);
  const scrollbarContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const scrollStartLeftRef = useRef(0);

  useEffect(() => {
    // 数据变化时重置到第一页
    setCurrentPage(1);
  }, [rowData.length]);

  const pagedRowData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return rowData.slice(start, end);
  }, [rowData, currentPage, pageSize]);

  // 同步表格滚动和底部滚动条
  useEffect(() => {
    // 延迟执行，确保 DOM 已渲染
    const timer = setTimeout(() => {
      let tableBody = tableBodyRef.current;
      const scrollbarThumb = scrollbarThumbRef.current;
      const scrollbarContainer = scrollbarContainerRef.current;

      if (!tableBody) {
        // 如果找不到元素，尝试通过选择器查找
        const tableWrapper = document.querySelector(`.${styles.tableContainer} .ant-table-body`) as HTMLElement;
        if (tableWrapper) {
          tableBody = tableWrapper;
          (tableBodyRef as any).current = tableWrapper;
        }
      }

      if (!tableBody || !scrollbarThumb || !scrollbarContainer) return;

      const actualTableBody = tableBody as HTMLElement;

      const updateScrollbar = () => {
        const scrollWidth = actualTableBody.scrollWidth;
        const clientWidth = actualTableBody.clientWidth;
        const scrollLeft = actualTableBody.scrollLeft;
        const maxScrollLeft = scrollWidth - clientWidth;

        if (maxScrollLeft <= 0) {
          // 不需要滚动
          scrollbarThumb.style.display = "none";
          return;
        }

        scrollbarThumb.style.display = "block";
        const thumbWidth = (clientWidth / scrollWidth) * 100;
        const thumbLeft = (scrollLeft / maxScrollLeft) * (100 - thumbWidth);

        scrollbarThumb.style.width = `${thumbWidth}%`;
        scrollbarThumb.style.left = `${thumbLeft}%`;
      };

      // 监听表格滚动
      actualTableBody.addEventListener("scroll", updateScrollbar);
      updateScrollbar(); // 初始更新

      // 处理滚动条点击和拖拽
      const handleMouseDown = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!scrollbarContainer.contains(target)) return;
        isDraggingRef.current = true;
        dragStartXRef.current = e.clientX;
        scrollStartLeftRef.current = actualTableBody.scrollLeft;
        
        // 如果点击的是滚动条容器而不是滑块，直接跳转到对应位置
        if (target === scrollbarContainer || !scrollbarThumb.contains(target)) {
          const rect = scrollbarContainer.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const scrollbarWidth = scrollbarContainer.clientWidth;
          const scrollWidth = actualTableBody.scrollWidth;
          const clientWidth = actualTableBody.clientWidth;
          const maxScrollLeft = scrollWidth - clientWidth;
          const scrollRatio = clickX / scrollbarWidth;
          actualTableBody.scrollLeft = scrollRatio * maxScrollLeft;
        }
        
        e.preventDefault();
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = e.clientX - dragStartXRef.current;
        const scrollbarWidth = scrollbarContainer.clientWidth;
        const scrollWidth = actualTableBody.scrollWidth;
        const clientWidth = actualTableBody.clientWidth;
        const maxScrollLeft = scrollWidth - clientWidth;
        const scrollDelta = (deltaX / scrollbarWidth) * scrollWidth;
        actualTableBody.scrollLeft = Math.max(0, Math.min(maxScrollLeft, scrollStartLeftRef.current + scrollDelta));
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
      };

      scrollbarContainer.addEventListener("mousedown", handleMouseDown);
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // 监听窗口大小变化
      const handleResize = () => {
        updateScrollbar();
      };
      window.addEventListener("resize", handleResize);

      // 清理函数
      return () => {
        actualTableBody.removeEventListener("scroll", updateScrollbar);
        scrollbarContainer.removeEventListener("mousedown", handleMouseDown);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("resize", handleResize);
      };
    }, 100);

    return () => {
      clearTimeout(timer);
    };
  }, [pagedRowData]);

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
            console.log(`【调试】extractName 被调用，id: ${id}, userMap.size: ${userMap.size}`);
            const u = userMap.get(id);
            console.log(`【调试】查找结果:`, u ? `找到用户: ${u.name || u.account}` : `未找到用户`);
            if (u) return u.name || u.account || id;
            // 调试：如果未匹配到用户，打印调试信息
            if (userMap.size > 0 && /^\d+$/.test(id)) {
              console.log(`【调试】未找到用户ID: ${id}，userMap keys:`, Array.from(userMap.keys()));
            }
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
      title: "序号",
      dataIndex: "_rowIndex",
      width: 70,
      fixed: "left" as const,
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
      const title = buildTitleWithLock(
        f.label || f.fieldName || key,
        key.toString(),
      );
      
      // 判断字段类型，决定是否支持排序
      const fieldType = f.type;
      const canSort = fieldType !== 'subtable' && fieldType !== 'attachment' && fieldType !== 'button';
      
      cols.push({
        title,
        dataIndex: key,
        fixed: isFixed ? ("left" as const) : undefined,
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
      width: 120,
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

      {/* 中部表格区域 */}
      <div className={styles.tableContainer}>
        {rowData.length === 0 ? (
          <div className={styles.emptyMessage}>
            <Empty description="暂无数据" />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
              <div
                ref={(el) => {
                  if (el) {
                    const tableBody = el.querySelector(".ant-table-body") as HTMLElement;
                    if (tableBody) {
                      (tableBodyRef as any).current = tableBody;
                    }
                  }
                }}
              >
                <Table
                  size="small"
                  rowKey="recordId"
                  columns={tableColumns}
                  dataSource={pagedRowData}
                  pagination={false}
                  scroll={{ x: "max-content", y: 385 }}
                  style={{ marginBottom: 0 }}
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
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 底部区域（分页 + 横向滚动条，整体贴到卡片最底部） */}
      <div style={{ marginTop: "auto", flexShrink: 0 }}>
        {/* 底部分页栏 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 8,
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

        {/* 横向滚动条（最底部） */}
        <div ref={scrollbarContainerRef} className={styles.fixedScrollbarContainer}>
          <div
            ref={scrollbarThumbRef}
            className={styles.fixedScrollbarThumb}
            style={{ display: "none" }}
          />
        </div>
      </div>

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

