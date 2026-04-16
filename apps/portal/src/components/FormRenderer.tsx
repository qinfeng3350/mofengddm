import { useMemo, useEffect, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Form as AntForm, Button, Spin, message, Space, Modal, Row, Col, Select, Alert } from "antd";
import { UnorderedListOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { formDefinitionApi } from "@/api/formDefinition";
import { formDataApi } from "@/api/formData";
import { workflowApi } from "@/api/workflow";
import { useAuthStore } from "@/store/useAuthStore";
import { FormFieldRenderer } from "./FormFieldRenderer";
import { RuntimeContainerRenderer } from "./RuntimeContainerRenderer";
import type { FormSchemaType, FormFieldSchema, LayoutContainerSchemaType } from "@mofeng/shared-schema";
import dayjs from "dayjs";
import { useIsMobile } from "@/hooks/useIsMobile";

// 流水号规则类型
interface SerialRule {
  type: "autoCount" | "fixedText" | "date" | "year" | "month" | "day";
  config?: {
    digits?: number;
    text?: string;
    format?: string;
  };
}

// 生成流水号的函数
const generateSerialNumber = async (
  rules: SerialRule[],
  formId: string,
  fieldId: string,
  resetType?: "never" | "year" | "month" | "day"
): Promise<string> => {
  if (!rules || rules.length === 0) {
    return `SERIAL-${Date.now()}`;
  }

  let serialNumber = "";
  let nextCount = 1;

  // 如果有自动计数规则，需要查询已有数据来计算下一个计数
  const hasAutoCount = rules.some((r) => r.type === "autoCount");
  if (hasAutoCount) {
    try {
      // 获取该表单的所有数据
      const existingData = await formDataApi.getListByForm(formId);
      
      // 根据重置类型过滤数据
      let filteredData = existingData;
      const now = new Date();
      
      if (resetType === "year") {
        filteredData = existingData.filter((item: any) => {
          const itemDate = new Date(item.createdAt);
          return itemDate.getFullYear() === now.getFullYear();
        });
      } else if (resetType === "month") {
        filteredData = existingData.filter((item: any) => {
          const itemDate = new Date(item.createdAt);
          return (
            itemDate.getFullYear() === now.getFullYear() &&
            itemDate.getMonth() === now.getMonth()
          );
        });
      } else if (resetType === "day") {
        filteredData = existingData.filter((item: any) => {
          const itemDate = new Date(item.createdAt);
          return (
            itemDate.getFullYear() === now.getFullYear() &&
            itemDate.getMonth() === now.getMonth() &&
            itemDate.getDate() === now.getDate()
          );
        });
      }

      // 从已有数据中提取流水号，找到最大的计数
      const autoCountRule = rules.find((r) => r.type === "autoCount");
      if (autoCountRule) {
        const digits = autoCountRule.config?.digits || 4;

        // 提取已有流水号的“尾部数字”，按位数截取后计算下一个计数
        const serialNumbers = filteredData
          .map((item: any) => item.data?.[fieldId])
          .filter(Boolean)
          .map((sn: string) => {
            const matches = String(sn).match(/\d+/g);
            if (!matches || matches.length === 0) return 0;
            // 取最后一段数字，截取末尾 digits 位
            const last = matches[matches.length - 1];
            const tail = last.slice(-digits);
            const num = parseInt(tail, 10);
            return Number.isFinite(num) ? num : 0;
          })
          .filter((n: number) => n > 0);

        if (serialNumbers.length > 0) {
          nextCount = Math.max(...serialNumbers) + 1;
        }
      }
    } catch (error) {
      console.error("获取已有数据失败，使用默认计数:", error);
    }
  }

  // 根据规则生成流水号
  rules.forEach((rule) => {
    switch (rule.type) {
      case "autoCount":
        const digits = rule.config?.digits || 4;
        serialNumber += String(nextCount).padStart(digits, "0");
        break;
      case "fixedText":
        serialNumber += rule.config?.text || "";
        break;
      case "date":
        serialNumber += dayjs().format("YYYYMMDD");
        break;
      case "year":
        serialNumber += dayjs().format("YYYY");
        break;
      case "month":
        serialNumber += dayjs().format("MM");
        break;
      case "day":
        serialNumber += dayjs().format("DD");
        break;
    }
  });

  return serialNumber || `SERIAL-${Date.now()}`;
};

interface FormRendererProps {
  formId: string;
  recordId?: string; // 编辑模式下的记录ID
  onSubmitSuccess?: (data: Record<string, unknown>) => void;
  mode?: "add" | "edit" | "view"; // 模式：新增、编辑、查看
  /** 字段权限上下文（可选）：节点/角色；不传则仅按节点(start/流程实例)计算 */
  permissionContext?: {
    currentNodeId?: string;
    roleIds?: string[];
  };
}

const collectRuntimeFields = (items: any[]): any[] => {
  const result: any[] = [];
  (items || []).forEach((item) => {
    if (item?.fieldId) {
      result.push(item);
      return;
    }
    if (item?.children && Array.isArray(item.children)) {
      result.push(...collectRuntimeFields(item.children));
      return;
    }
    if (item?.columns && Array.isArray(item.columns)) {
      item.columns.forEach((col: any) => {
        if (col?.children && Array.isArray(col.children)) {
          result.push(...collectRuntimeFields(col.children));
        }
      });
    }
  });
  return result;
};

const isEmptyLinkValue = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

const sameValue = (a: unknown, b: unknown) => {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

export const FormRenderer = ({
  formId,
  recordId,
  onSubmitSuccess,
  mode = "add",
  permissionContext,
}: FormRendererProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  const isMobile = useIsMobile();
  
  const { data: formDefinition, isLoading, refetch: refetchFormDefinition } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId),
  });

  /** 与 formDefinitionApi.getById 对齐：metadata 可能在 config.metadata */
  const formMetadata = useMemo(() => {
    if (!formDefinition) return {} as Record<string, unknown>;
    return (
      (formDefinition as { metadata?: Record<string, unknown> }).metadata ??
      (formDefinition as { config?: { metadata?: Record<string, unknown> } }).config?.metadata ??
      {}
    );
  }, [formDefinition]);

  /** 是否应在提交时尝试发起流程（与 onSubmit 逻辑一致） */
  const hasWorkflowRuntime = useMemo(() => {
    const workflowEnabled = formMetadata?.workflowEnabled !== false;
    const wf = formMetadata?.workflow as { nodes?: unknown[] } | undefined;
    const nodes = wf?.nodes;
    return (
      workflowEnabled &&
      wf != null &&
      typeof wf === "object" &&
      Array.isArray(nodes) &&
      nodes.length > 0
    );
  }, [formMetadata]);

  // 获取已有数据（编辑或查看模式）
  const { data: existingData } = useQuery({
    queryKey: ["formData", recordId],
    queryFn: () => formDataApi.getById(recordId!),
    enabled: !!recordId && (isEditMode || isViewMode),
  });

  // 获取流程实例（用于节点字段权限；仅在有 recordId 时可用）
  const { data: workflowInstance } = useQuery({
    queryKey: ["workflowInstanceByRecord", recordId],
    queryFn: () => workflowApi.getInstanceByRecord(recordId!),
    enabled: !!recordId,
  });

  const { user, isAuthenticated } = useAuthStore();
  const draftStorageKey = useMemo(() => {
    const uid = user?.id ? String(user.id) : "anonymous";
    return `mofeng:draft:${formId}:${uid}`;
  }, [formId, user?.id]);

  // 当前用户角色（用于字段权限 - roleRules）
  const { data: myRoles } = useQuery({
    queryKey: ["users", "me", "roles"],
    queryFn: async () => apiClient.get("/users/me/roles"),
    enabled: isAuthenticated,
  });

  // 流水号生成状态
  const [serialNumberCache, setSerialNumberCache] = useState<Record<string, string>>({});

  // 根据字段配置生成默认值
  const defaultValues = useMemo(() => {
    if (!formDefinition) return {};
    const values: Record<string, unknown> = {};
    
    // 如果有已有数据，使用已有数据
    if (existingData?.data) {
      Object.assign(values, existingData.data);
    }
    
    // 遍历字段，设置默认值
    const elements = formDefinition.config.elements || formDefinition.config.fields || [];
    const collectFields = (items: any[]): any[] => {
      const result: any[] = [];
      items.forEach((item) => {
        if (item.fieldId) {
          result.push(item);
        } else if (item.children && Array.isArray(item.children)) {
          result.push(...collectFields(item.children));
        } else if (item.columns && Array.isArray(item.columns)) {
          item.columns.forEach((col: any) => {
            if (col.children && Array.isArray(col.children)) {
              result.push(...collectFields(col.children));
            }
          });
        }
      });
      return result;
    };
    const fields = collectFields(elements);
    
    fields.forEach((field: any) => {
      const fieldId = field.fieldId;
      if (!fieldId) return;
      
      // 如果已有值，跳过
      if (values[fieldId] !== undefined) return;
      
      // 流水号字段：新建时生成默认值
      if (field.type === "serial" || (field.isSystemField && field.systemFieldType === "serial")) {
        if (!existingData?.data?.[fieldId]) {
          // 使用缓存的流水号，如果没有则使用临时值
          if (serialNumberCache[fieldId]) {
            values[fieldId] = serialNumberCache[fieldId];
          } else {
            // 临时值，会在 useEffect 中替换
            values[fieldId] = `SERIAL-${Date.now()}`;
          }
        }
        return;
      }
      
      // 日期/日期时间字段：如果设置了"当前时间"，使用当前时间
      if ((field.type === "date" || field.type === "datetime") && field.advanced?.defaultMode === "now") {
        values[fieldId] = field.type === "date" ? dayjs().format("YYYY-MM-DD") : dayjs().toISOString();
        return;
      }
      
      // 人员字段：如果设置为“当前登录人”，直接写入 defaultValues，避免首次渲染依赖 setValue
      if (field.type === "user" && field.advanced?.defaultMode === "currentUser" && user?.id) {
        values[fieldId] = user.id;
        return;
      }

      // 其他字段：使用字段的默认值
      if (field.defaultValue !== undefined) {
        values[fieldId] = field.defaultValue;
      }
    });
    
    return values;
  }, [formDefinition, existingData, serialNumberCache]);

  // 生成流水号
  useEffect(() => {
    if (!formDefinition || mode !== "add") return;
    
    const elements = formDefinition.config.elements || formDefinition.config.fields || [];
    const collectFields = (items: any[]): any[] => {
      const result: any[] = [];
      items.forEach((item) => {
        if (item.fieldId) {
          result.push(item);
        } else if (item.children && Array.isArray(item.children)) {
          result.push(...collectFields(item.children));
        } else if (item.columns && Array.isArray(item.columns)) {
          item.columns.forEach((col: any) => {
            if (col.children && Array.isArray(col.children)) {
              result.push(...collectFields(col.children));
            }
          });
        }
      });
      return result;
    };
    const fields = collectFields(elements);
    
    // 为每个流水号字段生成流水号
    fields.forEach(async (field: any) => {
      if (field.type === "serial" || (field.isSystemField && field.systemFieldType === "serial")) {
        const fieldId = field.fieldId;
        if (!fieldId) return;
        
        // 如果已有值（编辑模式），跳过
        if (existingData?.data?.[fieldId]) return;
        
        // 如果已经生成过，跳过
        if (serialNumberCache[fieldId]) return;
        
        const serialConfig = field.advanced?.serialConfig;
        const rules = serialConfig?.rules || [];
        const resetType = serialConfig?.resetType;
        
        try {
          const serialNumber = await generateSerialNumber(rules, formId, fieldId, resetType);
          setSerialNumberCache((prev) => ({
            ...prev,
            [fieldId]: serialNumber,
          }));
        } catch (error) {
          console.error("生成流水号失败:", error);
          // 失败时使用默认值
          setSerialNumberCache((prev) => ({
            ...prev,
            [fieldId]: `SERIAL-${Date.now()}`,
          }));
        }
      }
    });
  }, [formDefinition, formId, mode, existingData]);

  const methods = useForm({
    defaultValues,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
  } = methods;
  const [isDraftSaving, setIsDraftSaving] = useState(false);
  const [isFinalSubmitting, setIsFinalSubmitting] = useState(false);

  // 当默认值（例如查看/编辑时的已有数据）或流水号生成完成后，重置表单填充值
  // 否则第一次渲染是空的，后续获取到 existingData 也不会自动填入
  useEffect(() => {
    // 如果流水号已生成，更新表单值
    if (Object.keys(serialNumberCache).length > 0) {
      const updatedValues = { ...defaultValues };
      Object.keys(serialNumberCache).forEach((fieldId) => {
        updatedValues[fieldId] = serialNumberCache[fieldId];
      });
      reset(updatedValues);
    } else {
      reset(defaultValues);
    }
  }, [defaultValues, serialNumberCache, reset]);

  // 新增模式：打开时回填本地暂存草稿
  useEffect(() => {
    if (mode !== "add" || recordId) return;
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        reset({ ...defaultValues, ...(parsed as Record<string, unknown>) });
      }
    } catch {
      // ignore broken draft
    }
  }, [mode, recordId, draftStorageKey, reset, defaultValues]);

  // 监听表单值变化，用于公式计算
  const formValues = watch();

  const onSubmit = async (data: Record<string, unknown>, status: string = "submitted") => {
    try {
      const hasWorkflow = hasWorkflowRuntime;
      const wf: any = formMetadata?.workflow;

      const response = await formDataApi.submit({
        formId,
        data,
        status,
        recordId: recordId || undefined, // 编辑模式下传递recordId
      });

      // 兼容多种返回结构；编辑场景下 props.recordId 必须作为回退，否则无法发起流程
      const rid =
        (response as { recordId?: string })?.recordId ??
        (response as { record_id?: string })?.record_id ??
        (response as { data?: { recordId?: string } })?.data?.recordId ??
        recordId;

      let workflowStarted = false;

      // 正式提交且配置了流程：无实例则发起，已有实例则不重复（编辑暂存后再提交常见）
      if (status === "submitted" && hasWorkflow && wf && rid) {
        try {
          const existing = await workflowApi.getInstanceByRecord(rid);
          if (existing?.id || existing?.instanceId) {
            message.info("当前记录已存在流程实例，未重复发起");
          } else {
            try {
              await workflowApi.startInstance({
                formId,
                recordId: rid,
                workflow: wf,
                userId: user?.id,
                userName: user?.name || user?.account,
              });
              workflowStarted = true;
            } catch (startErr: unknown) {
              console.error("启动流程失败:", startErr);
              const msg = (() => {
                const d = (startErr as { response?: { data?: { message?: unknown } } })?.response?.data;
                const m = d?.message;
                if (Array.isArray(m)) return m.join("; ");
                if (typeof m === "string" && m.trim()) return m;
                return startErr instanceof Error ? startErr.message : "";
              })();
              message.error(msg || "启动流程失败，请稍后重试或联系管理员");
            }
          }
        } catch (e: unknown) {
          console.error("查询流程实例失败:", e);
          message.warning("无法确认流程状态，请保存后刷新详情页查看流程");
        }
      }

      if (status === "draft") {
        // 暂存：保存为草稿，不关闭表单，可以继续编辑
        message.success("暂存成功");
        // 刷新数据列表，但不关闭抽屉
        queryClient.invalidateQueries({ queryKey: ["formData", formId] });
        // 如果是编辑模式，也刷新当前记录的数据
        if (recordId) {
          queryClient.invalidateQueries({ queryKey: ["formData", recordId] });
        }
        // 不重置表单，不调用 onSubmitSuccess
      } else {
        // 提交：最终提交，关闭表单
        try {
          localStorage.removeItem(draftStorageKey);
        } catch {
          // ignore
        }
        message.success(
          workflowStarted ? "提交成功（已发起流程）" : "提交成功",
        );
        // 重置表单
        reset(defaultValues);
        // 回调传入整条表单数据记录（勿用 response.data，会与表单字段 data 混淆）
        onSubmitSuccess?.(response as Record<string, unknown>);
      }
    } catch (error: unknown) {
      console.error("操作失败:", error);
      const errorMessage = (() => {
        if (error && typeof error === "object" && "response" in error) {
          const data = (error as { response?: { data?: { message?: unknown } } }).response?.data;
          const m = data?.message;
          if (Array.isArray(m)) return m.join("; ");
          if (typeof m === "string" && m.trim()) return m;
        }
        return error instanceof Error ? error.message : "操作失败，请重试";
      })();
      message.error(errorMessage);
    }
  };

  // 提交前流程预览
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingSubmitData, setPendingSubmitData] = useState<Record<string, unknown> | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>("");
  const [previewResolved, setPreviewResolved] = useState<any>(null);
  const [previewDeptOptions, setPreviewDeptOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [previewDeptId, setPreviewDeptId] = useState<string>("");
  const { data: allUsers = [] } = useQuery({
    queryKey: ["users", "forPreview"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/users");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
  });
  const userMap = useMemo(() => {
    const map = new Map<string, any>();
    (allUsers as any[]).forEach((u) => u && map.set(String(u.id), u));
    return map;
  }, [allUsers]);

  const fetchPreviewResolution = async (data: Record<string, unknown>, initiatorDeptId?: string) => {
    const wf: any = formMetadata?.workflow;
    if (!wf) return;
    setPreviewLoading(true);
    setPreviewError("");
    try {
      const res: any = await workflowApi.previewAssignees({
        workflow: wf,
        data,
        initiatorDeptId: initiatorDeptId || undefined,
      });
      setPreviewResolved(res || null);
      const options = Array.isArray(res?.initiatorDeptOptions) ? res.initiatorDeptOptions : [];
      setPreviewDeptOptions(options);
      if (initiatorDeptId) {
        setPreviewDeptId(initiatorDeptId);
      } else if (res?.selectedInitiatorDeptId) {
        setPreviewDeptId(String(res.selectedInitiatorDeptId));
      } else if (options.length) {
        setPreviewDeptId(String(options[0].id));
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "加载审批人预览失败";
      setPreviewError(msg);
      setPreviewResolved(null);
    } finally {
      setPreviewLoading(false);
    }
  };
  const previewHasUnresolvedApprover = useMemo(() => {
    const nodes = Array.isArray(previewResolved?.nodes) ? previewResolved.nodes : [];
    return nodes.some((n: any) => {
      const needAssignee = n?.type === "approval" || n?.type === "task" || n?.type === "handler";
      if (!needAssignee) return false;
      return !Array.isArray(n?.assigneeUsers) || n.assigneeUsers.length === 0;
    });
  }, [previewResolved]);

  // 部门字段：如果在设计器里选择了“本部门”，则在运行时把当前用户部门写入表单默认值
  useEffect(() => {
    if (!formDefinition) return;
    if (!user?.id) return;
    if (!userMap.size) return;
    if (!setValue || !getValues) return;

    const currentUser = userMap.get(String(user.id));
    const currentDeptId =
      currentUser?.departmentId ?? currentUser?.department?.id ?? undefined;

    if (!currentDeptId) return;

    const elements = formDefinition.config.elements || formDefinition.config.fields || [];
    const collectFields = (items: any[]): any[] => {
      const result: any[] = [];
      items.forEach((item) => {
        if (item?.fieldId) {
          result.push(item);
        } else if (item?.children && Array.isArray(item.children)) {
          result.push(...collectFields(item.children));
        } else if (item?.columns && Array.isArray(item.columns)) {
          item.columns.forEach((col: any) => {
            if (col?.children && Array.isArray(col.children)) {
              result.push(...collectFields(col.children));
            }
          });
        }
      });
      return result;
    };

    const runtimeFields = collectFields(elements);
    runtimeFields.forEach((f: any) => {
      if (f?.fieldId && f.type === "department" && f.advanced?.defaultMode === "currentDepartment") {
        const current = getValues(f.fieldId);
        if (current === undefined || current === null || current === "") {
          setValue(f.fieldId, currentDeptId);
        }
      }
    });
  }, [user?.id, userMap, formDefinition, setValue, getValues]);

  // 默认值-数据联动：当条件字段变化时，自动从关联表取值并回填当前字段（含成员字段）
  useEffect(() => {
    if (!formDefinition) return;
    if (isViewMode) return;
    if (!setValue || !getValues) return;

    const run = async () => {
      const elements = formDefinition.config.elements || formDefinition.config.fields || [];
      const runtimeFields = collectRuntimeFields(elements);
      const fieldMap = new Map<string, any>(
        runtimeFields
          .filter((f: any) => !!f?.fieldId)
          .map((f: any) => [String(f.fieldId), f]),
      );
      const linkFields = runtimeFields.filter((f: any) => {
        const adv = f?.advanced || {};
        const cfg = adv.defaultDataLink || {};
        return (
          adv.defaultMode === "dataLink" &&
          cfg &&
          typeof cfg === "object" &&
          cfg.relatedFormId &&
          cfg.targetRelatedFieldId &&
          Array.isArray(cfg.conditions) &&
          cfg.conditions.length > 0
        );
      });

      if (linkFields.length === 0) return;

      const relatedRowsCache = new Map<string, any[]>();

      for (const f of linkFields) {
        const fieldId = String(f.fieldId || "");
        if (!fieldId) continue;
        const cfg = f.advanced?.defaultDataLink || {};
        const relatedFormId = String(cfg.relatedFormId || "");
        const targetRelatedFieldId = String(cfg.targetRelatedFieldId || "");
        const matchMode = cfg.matchMode === "any" ? "any" : "all";
        const conditions = (Array.isArray(cfg.conditions) ? cfg.conditions : []).filter(
          (c: any) => c?.relatedFieldId && c?.currentFieldId,
        );
        if (!relatedFormId || !targetRelatedFieldId || conditions.length === 0) continue;

        const pairs = conditions.map((c: any) => {
          const currentFieldId = String(c.currentFieldId);
          return {
            relatedFieldId: String(c.relatedFieldId),
            currentFieldId,
            currentValue: getValues(currentFieldId),
          };
        });

        const hasAnyValue = pairs.some((p) => !isEmptyLinkValue(p.currentValue));
        if (!hasAnyValue) {
          const current = getValues(fieldId);
          if (!isEmptyLinkValue(current)) {
            setValue(fieldId, undefined, { shouldDirty: true, shouldTouch: true });
          }
          continue;
        }

        let rows = relatedRowsCache.get(relatedFormId);
        if (!rows) {
          try {
            const list = await formDataApi.getListByForm(relatedFormId);
            rows = Array.isArray(list) ? list : [];
          } catch {
            rows = [];
          }
          relatedRowsCache.set(relatedFormId, rows);
        }

        const normalize = (v: unknown) => String(v ?? "").trim();
        const getCandidateValues = async (pair: {
          relatedFieldId: string;
          currentFieldId: string;
          currentValue: unknown;
        }) => {
          const out: string[] = [];
          const raw = pair.currentValue;
          if (!isEmptyLinkValue(raw)) {
            out.push(normalize(raw));
          }

          // 兼容：当前字段是“关联其他表单数据”时，当前值可能是 recordId；
          // 条件里常配的是“名称字段”，因此补充 recordId -> 展示字段值 的匹配候选。
          const currentField = fieldMap.get(pair.currentFieldId);
          if (currentField?.advanced?.optionsSource === "relatedForm") {
            const optionRelatedFormId = String(currentField?.advanced?.optionsRelatedFormId || "");
            const optionRelatedLabelFieldId = String(currentField?.advanced?.optionsRelatedLabelFieldId || "");
            if (optionRelatedFormId && optionRelatedLabelFieldId && !isEmptyLinkValue(raw)) {
              let optionRows = relatedRowsCache.get(optionRelatedFormId);
              if (!optionRows) {
                try {
                  const list = await formDataApi.getListByForm(optionRelatedFormId);
                  optionRows = Array.isArray(list) ? list : [];
                } catch {
                  optionRows = [];
                }
                relatedRowsCache.set(optionRelatedFormId, optionRows);
              }
              const selected = (optionRows || []).find(
                (r: any) => normalize(r?.recordId) === normalize(raw),
              );
              const labelVal = selected?.data?.[optionRelatedLabelFieldId];
              if (!isEmptyLinkValue(labelVal)) {
                out.push(normalize(labelVal));
              }
            }
          }
          return Array.from(new Set(out.filter(Boolean)));
        };

        const candidatesList = await Promise.all(pairs.map((p) => getCandidateValues(p)));
        const hit = (rows || []).find((row: any) => {
          const rowData = row?.data || {};
          const checks = pairs.map((p, idx) => {
            const candidates = candidatesList[idx] || [];
            if (candidates.length === 0) return false;
            const rowVal = normalize(rowData[p.relatedFieldId]);
            return candidates.includes(rowVal);
          });
          return matchMode === "any" ? checks.some(Boolean) : checks.every(Boolean);
        });

        let nextValue = hit?.data ? hit.data[targetRelatedFieldId] : undefined;
        // 成员字段联动值格式归一：支持对象/数组/字符串，最终写入用户ID或ID数组
        if (f.type === "user") {
          const isMulti = f?.advanced?.multiple === true;
          const toUserId = (v: any): string | undefined => {
            if (v == null) return undefined;
            if (typeof v === "string" || typeof v === "number") return String(v);
            if (typeof v === "object") {
              return String(v.id ?? v.userId ?? v.value ?? "").trim() || undefined;
            }
            return undefined;
          };
          if (isMulti) {
            if (Array.isArray(nextValue)) {
              nextValue = nextValue.map((x: any) => toUserId(x)).filter(Boolean);
            } else {
              const one = toUserId(nextValue);
              nextValue = one ? [one] : [];
            }
          } else {
            if (Array.isArray(nextValue)) {
              nextValue = toUserId(nextValue[0]);
            } else {
              nextValue = toUserId(nextValue);
            }
          }
        }
        const currentValue = getValues(fieldId);
        if (!sameValue(currentValue, nextValue)) {
          setValue(fieldId, nextValue as any, { shouldDirty: true, shouldTouch: true });
        }
      }
    };

    void run();
  }, [formDefinition, formValues, isViewMode, setValue, getValues]);

  const showPreviewThenSubmit = async (data: Record<string, unknown>) => {
    if (isDraftSaving || isFinalSubmitting) return;
    if (hasWorkflowRuntime) {
      setPendingSubmitData(data);
      // 设计器刚保存后，填报页仍可能命中 React Query 旧缓存；先拉最新定义再展示预览
      try {
        await refetchFormDefinition();
      } catch (e) {
        console.warn("刷新表单定义失败，将使用缓存中的流程配置预览", e);
      }
      await fetchPreviewResolution(data, previewDeptId || undefined);
      setPreviewOpen(true);
      return;
    }
    setIsFinalSubmitting(true);
    try {
      await onSubmit(data, "submitted");
    } finally {
      setIsFinalSubmitting(false);
    }
  };

  const handleSaveDraft = async (data: Record<string, unknown>) => {
    if (isDraftSaving || isFinalSubmitting) return;
    setIsDraftSaving(true);
    try {
      // 新增模式：只存本地草稿，不触发真实提交
      if (mode === "add" && !recordId) {
        localStorage.setItem(draftStorageKey, JSON.stringify(data || {}));
        message.success("暂存成功");
        return;
      }
      // 编辑模式保留原有草稿行为（后端 status=draft）
      await onSubmit(data, "draft");
    } finally {
      setIsDraftSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!formDefinition) {
    return <div>表单不存在</div>;
  }

  const baseFormSchema: FormSchemaType = {
    formId: formDefinition.formId,
    formName: formDefinition.formName,
    status: formDefinition.status,
    version: formDefinition.version,
    fields: formDefinition.config.fields || [],
    layout: formDefinition.config.layout,
    elements: formDefinition.config.elements,
  };
  // 用于运行时布局/权限等：metadata 可能在 formDefinition.metadata 或 config.metadata
  (baseFormSchema as any).metadata = formMetadata;

  const fieldPermissions = (formMetadata as any)?.fieldPermissions;
  const roleIds = (() => {
    const ids = (myRoles || []).map((r: any) => String(r.id)).filter(Boolean);
    const extra = permissionContext?.roleIds || [];
    return Array.from(new Set([...ids, ...extra.map(String)])).filter(Boolean);
  })();
  const effectiveNodeId =
    permissionContext?.currentNodeId ||
    (mode === "add" ? "start" : (workflowInstance as any)?.currentNodeId) ||
    "start";

  const applyFieldPermissions = (el: any): any => {
    if (!fieldPermissions || typeof fieldPermissions !== "object") return el;
    const fallback = fieldPermissions?.defaults?.fallback || "editable";
    const nodeRules = fieldPermissions?.nodeRules?.[effectiveNodeId] || {};
    const roleRules = fieldPermissions?.roleRules || {};

    const chooseStrictest = (actions: string[]) => {
      // hidden > readonly > editable
      if (actions.includes("hidden")) return "hidden";
      if (actions.includes("readonly")) return "readonly";
      return "editable";
    };

    const getRoleAction = (key: string) => {
      if (!Array.isArray(roleIds) || roleIds.length === 0) return undefined;
      const hits: string[] = [];
      for (const rid of roleIds) {
        const m = roleRules?.[String(rid)];
        const a = m?.[key];
        if (a) hits.push(a);
      }
      if (hits.length === 0) return undefined;
      return chooseStrictest(hits);
    };

    const applyToField = (field: any) => {
      const fieldKey = String(field.fieldId);
      const nodeAction = nodeRules?.[fieldKey];
      const roleAction = getRoleAction(fieldKey);
      const action = (nodeAction || roleAction || fallback) as "hidden" | "readonly" | "editable";

      const next = { ...field };
      if (action === "hidden") {
        next.visible = false;
        next.editable = false;
      } else if (action === "readonly") {
        next.visible = true;
        next.editable = false;
      } else {
        next.visible = true;
        // editable 仍受字段自身配置约束：如果原来就是不可编辑，不强行改成可编辑
        next.editable = field.editable !== false;
      }

      // 子表列权限：key = `${subtableId}.${colId}`
      if (next.type === "subtable" && Array.isArray(next.subtableFields)) {
        next.subtableFields = next.subtableFields.map((c: any) => {
          const colKey = `${fieldKey}.${String(c.fieldId)}`;
          const colNodeAction = nodeRules?.[colKey];
          const colRoleAction = getRoleAction(colKey);
          const colAction = (colNodeAction || colRoleAction || fallback) as
            | "hidden"
            | "readonly"
            | "editable";
          const colNext = { ...c };
          if (colAction === "hidden") {
            colNext.visible = false;
            colNext.editable = false;
          } else if (colAction === "readonly") {
            colNext.visible = true;
            colNext.editable = false;
          } else {
            colNext.visible = true;
            colNext.editable = c.editable !== false;
          }
          return colNext;
        });
      }
      return next;
    };

    // field element
    if (el && typeof el === "object" && "fieldId" in el) {
      return applyToField(el);
    }

    // container element
    if (el && typeof el === "object" && "containerId" in el) {
      const next = { ...el };
      if (Array.isArray(next.children)) {
        next.children = next.children.map(applyFieldPermissions);
      }
      if (Array.isArray((next as any).columns)) {
        (next as any).columns = (next as any).columns.map((col: any) => {
          const colNext = { ...col };
          if (Array.isArray(colNext.children)) {
            colNext.children = colNext.children.map(applyFieldPermissions);
          }
          return colNext;
        });
      }
      return next;
    }
    return el;
  };

  const formSchema: FormSchemaType = (() => {
    const next = { ...baseFormSchema } as any;
    next.fields = (baseFormSchema.fields || []).map(applyFieldPermissions);
    if (Array.isArray(baseFormSchema.elements)) {
      next.elements = baseFormSchema.elements.map(applyFieldPermissions);
    }
    next.metadata = (baseFormSchema as any).metadata;
    return next as FormSchemaType;
  })();

  // 使用elements数组（如果存在），否则使用fields数组
  const elements = formSchema.elements || formSchema.fields.map((f) => f as any);
  const columnsCount = (() => {
    if (isMobile) return 1;
    const mode = (formSchema as any)?.metadata?.formLayout || "double";
    if (mode === "single") return 1;
    if (mode === "triple") return 3;
    if (mode === "quad") return 4;
    return 2;
  })();

  return (
    <FormProvider {...methods}>
    <AntForm layout="vertical" onFinish={handleSubmit(showPreviewThenSubmit)}>
      {columnsCount === 1 ? (
        elements.map((element: any) => {
          // 判断是字段还是容器
          if ("fieldId" in element) {
            const field = element as FormFieldSchema;
            // 跳过按钮字段（按钮在表单底部单独渲染）
            if (field.type === "button") {
              return null;
            }
            return (
              <FormFieldRenderer
                key={field.fieldId}
                field={field}
                control={control}
                formValues={formValues}
                disabled={isViewMode}
                formSchema={formSchema}
              />
            );
          } else if ("containerId" in element) {
            const container = element as LayoutContainerSchemaType;
            return (
              <RuntimeContainerRenderer
                key={container.containerId}
                container={container}
                control={control}
                formValues={formValues}
                formSchema={formSchema}
                disabled={isViewMode}
              />
            );
          }
          return null;
        })
      ) : (
        <Row gutter={[16, 12]}>
          {elements.map((element: any) => {
            if ("containerId" in element) {
              const container = element as LayoutContainerSchemaType;
              return (
                <Col span={24} key={container.containerId}>
                  <RuntimeContainerRenderer
                    container={container}
                    control={control}
                    formValues={formValues}
                    formSchema={formSchema}
                    disabled={isViewMode}
                  />
                </Col>
              );
            }

            if ("fieldId" in element) {
              const field = element as FormFieldSchema;
              if (field.type === "button") return null;
              const rawSpan = Number((field as any)?.advanced?.fieldSpan);
              const fieldSpan =
                Number.isFinite(rawSpan) && rawSpan > 0 && rawSpan <= 24
                  ? Math.round(rawSpan)
                  : undefined;
              // 子表不受表单列布局限制：永远独占一行
              const span =
                field.type === "subtable"
                  ? 24
                  : fieldSpan || Math.floor(24 / columnsCount) || 12;
              return (
                <Col span={span} key={field.fieldId} style={{ minWidth: 0 }}>
                  <FormFieldRenderer
                    field={field}
                    control={control}
                    formValues={formValues}
                    disabled={isViewMode}
                    formSchema={formSchema}
                  />
                </Col>
              );
            }
            return null;
          })}
        </Row>
      )}
      
      {/* 渲染按钮字段 */}
      {elements
        .filter((el: any) => 'fieldId' in el && (el as FormFieldSchema).type === 'button')
        .map((element: any) => {
          const field = element as FormFieldSchema;
          return (
            <FormFieldRenderer 
              key={field.fieldId} 
              field={field} 
              control={control} 
              formValues={formValues}
              disabled={isViewMode}
              formSchema={formSchema}
            />
          );
        })}
      
      {!isViewMode && (
        <AntForm.Item>
          <Space style={{ width: "100%", justifyContent: "flex-end" }}>
            <Button
              htmlType="button"
              onClick={handleSubmit(handleSaveDraft)}
              loading={isDraftSaving}
              disabled={isFinalSubmitting}
              style={{
                background: "#fff",
                color: "#1890ff",
                borderColor: "#1890ff",
              }}
            >
              暂存
            </Button>
            <Button type="primary" htmlType="submit" loading={isFinalSubmitting} disabled={isDraftSaving}>提交</Button>
          </Space>
        </AntForm.Item>
      )}

      {/* 提交前的流程预览 */}
      <Modal
        title="审批流程预览"
        open={previewOpen}
        onCancel={() => {
          setPreviewOpen(false);
          setPreviewError("");
        }}
        onOk={async () => {
          if (isFinalSubmitting) return;
          const data = pendingSubmitData || {};
          setPreviewOpen(false);
          setIsFinalSubmitting(true);
          try {
            await onSubmit(data, "submitted");
          } finally {
            setIsFinalSubmitting(false);
          }
        }}
        confirmLoading={isFinalSubmitting}
        okButtonProps={{
          disabled: previewLoading || previewHasUnresolvedApprover,
        }}
        okText="确定提交"
        cancelText="取消"
      >
        <Space orientation="vertical" style={{ width: "100%" }} size={10}>
          {previewDeptOptions.length > 0 && (
            <div>
              <div style={{ fontWeight: 500, marginBottom: 6 }}>
                发起部门
                <span style={{ marginLeft: 8, color: "#999", fontWeight: 400 }}>
                  {previewDeptOptions.length > 1 ? "多部门发起时请确认" : `当前识别到 ${previewDeptOptions.length} 个部门`}
                </span>
              </div>
              <Select
                style={{ width: 320, maxWidth: "100%" }}
                value={previewDeptId || undefined}
                disabled={previewDeptOptions.length <= 1}
                options={previewDeptOptions.map((d) => ({ label: d.name, value: d.id }))}
                onChange={async (v) => {
                  const nextDeptId = String(v || "");
                  setPreviewDeptId(nextDeptId);
                  if (pendingSubmitData) await fetchPreviewResolution(pendingSubmitData, nextDeptId);
                }}
              />
            </div>
          )}

          {previewError ? (
            <Alert type="error" showIcon message={previewError} />
          ) : previewLoading ? (
            <div style={{ textAlign: "center", padding: 16 }}><Spin /></div>
          ) : (
            <div>
              {Array.isArray(previewResolved?.nodes) && previewResolved.nodes.length > 0 ? (
                previewResolved.nodes.map((n: any, idx: number) => {
                  const users = Array.isArray(n?.assigneeUsers) ? n.assigneeUsers : [];
                  return (
                    <div key={n.nodeId || idx} style={{ marginBottom: 12 }}>
                      <div style={{ fontWeight: 600 }}>
                        {n.type === "start" ? "发起" : n.type === "end" ? "结束" : (n.label || n.type)}
                      </div>
                      {(n.type === "approval" || n.type === "task" || n.type === "handler") ? (
                        users.length > 0 ? (
                          <div style={{ color: "#666" }}>
                            审批人：{users.map((u: any) => u.name || u.id).join("、")}
                          </div>
                        ) : (
                          <div style={{ color: "#cf1322" }}>
                            未解析到审批人，请先修正领导/角色同步后再提交
                          </div>
                        )
                      ) : (
                        <div style={{ color: "#999" }}>无指派/系统节点</div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div>未配置流程</div>
              )}
            </div>
          )}
        </Space>
      </Modal>
    </AntForm>
    </FormProvider>
  );
};

