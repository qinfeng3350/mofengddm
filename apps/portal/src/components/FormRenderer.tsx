import { useMemo, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Form as AntForm, Button, Spin, message, Space, Modal } from "antd";
import { UnorderedListOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { formDefinitionApi } from "@/api/formDefinition";
import { formDataApi } from "@/api/formData";
import { useAuthStore } from "@/store/useAuthStore";
import { FormFieldRenderer } from "./FormFieldRenderer";
import { RuntimeContainerRenderer } from "./RuntimeContainerRenderer";
import type { FormSchemaType, FormFieldSchema, LayoutContainerSchemaType } from "@mofeng/shared-schema";
import dayjs from "dayjs";

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
}

export const FormRenderer = ({ formId, recordId, onSubmitSuccess, mode = "add" }: FormRendererProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  
  const { data: formDefinition, isLoading } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId),
  });

  // 获取已有数据（编辑或查看模式）
  const { data: existingData } = useQuery({
    queryKey: ["formData", recordId],
    queryFn: () => formDataApi.getById(recordId!),
    enabled: !!recordId && (isEditMode || isViewMode),
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

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm({
    defaultValues,
  });

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

  // 监听表单值变化，用于公式计算
  const formValues = watch();

  const { user } = useAuthStore();

  const onSubmit = async (data: Record<string, unknown>, status: string = "submitted") => {
    try {
      // 检查是否有流程配置且已启用，如果有则在提交时启动流程
      const workflowEnabled = formDefinition?.metadata?.workflowEnabled !== false;
      const hasWorkflow = workflowEnabled &&
                         formDefinition?.metadata?.workflow && 
                         typeof formDefinition.metadata.workflow === 'object' &&
                         (formDefinition.metadata.workflow as any).nodes &&
                         Array.isArray((formDefinition.metadata.workflow as any).nodes) &&
                         (formDefinition.metadata.workflow as any).nodes.length > 0;

      const response = await formDataApi.submit({
        formId,
        data,
        status,
        recordId: recordId || undefined, // 编辑模式下传递recordId
      });

      // 如果是正式提交（非草稿）且有流程配置，尝试启动流程
      if (status === "submitted" && hasWorkflow && response?.recordId) {
        try {
          const wf: any = (formDefinition.metadata!.workflow as any);
          const startResp = await (await import("@/api/workflow")).workflowApi.startInstance({
            formId,
            recordId: response.recordId,
            workflow: wf,
            userId: user?.id,
            userName: user?.name || user?.account,
          });
          console.log("流程已启动", startResp);
        } catch (workflowError) {
          console.error("启动流程失败:", workflowError);
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
        message.success("提交成功" + (hasWorkflow ? "（已启动流程）" : ""));
        // 重置表单
        reset(defaultValues);
        // 调用成功回调，关闭抽屉
        onSubmitSuccess?.(response.data);
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

  const showPreviewThenSubmit = async (data: Record<string, unknown>) => {
    const hasWorkflow = formDefinition?.metadata?.workflow &&
      typeof formDefinition.metadata.workflow === 'object' &&
      (formDefinition.metadata.workflow as any).nodes &&
      Array.isArray((formDefinition.metadata.workflow as any).nodes) &&
      (formDefinition.metadata.workflow as any).nodes.length > 0;
    if (hasWorkflow) {
      setPendingSubmitData(data);
      setPreviewOpen(true);
      return;
    }
    await onSubmit(data, "submitted");
  };

  const handleSaveDraft = async (data: Record<string, unknown>) => {
    await onSubmit(data, "draft");
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

  const formSchema: FormSchemaType = {
    formId: formDefinition.formId,
    formName: formDefinition.formName,
    status: formDefinition.status,
    version: formDefinition.version,
    fields: formDefinition.config.fields || [],
    layout: formDefinition.config.layout,
    elements: formDefinition.config.elements,
  };

  // 使用elements数组（如果存在），否则使用fields数组
  const elements = formSchema.elements || formSchema.fields.map((f) => f as any);

  return (
    <AntForm layout="vertical" onFinish={handleSubmit(showPreviewThenSubmit)}>
      {elements.map((element: any) => {
        // 判断是字段还是容器
        if ('fieldId' in element) {
          const field = element as FormFieldSchema;
          // 跳过按钮字段（按钮在表单底部单独渲染）
          if (field.type === 'button') {
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
        } else if ('containerId' in element) {
          const container = element as LayoutContainerSchemaType;
          return (
            <RuntimeContainerRenderer
              key={container.containerId}
              container={container}
              control={control}
              formValues={formValues}
              disabled={isViewMode}
            />
          );
        }
        return null;
      })}
      
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
              loading={isSubmitting}
              style={{
                background: "#fff",
                color: "#1890ff",
                borderColor: "#1890ff",
              }}
            >
              暂存
            </Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting}>提交</Button>
          </Space>
        </AntForm.Item>
      )}

      {/* 提交前的流程预览 */}
      <Modal
        title="审批流程预览"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        onOk={async () => {
          const data = pendingSubmitData || {};
          setPreviewOpen(false);
          await onSubmit(data, "submitted");
        }}
        okText="确定提交"
        cancelText="取消"
      >
        {(() => {
          const wf: any = formDefinition?.metadata?.workflow;
          const nodes = (wf?.nodes || []) as any[];
          const edges = (wf?.edges || []) as any[];
          if (!nodes.length) return <div>未配置流程</div>;

          // 按流程连线计算顺序：从开始节点沿 edges 依次前进直到结束
          const start = nodes.find((n: any) => n.type === 'start');
          const ordered: any[] = [];
          const visited = new Set<string>();
          let current: any | undefined = start || nodes[0];
          let safety = 0;
          while (current && !visited.has(current.nodeId) && safety < 100) {
            ordered.push(current);
            visited.add(current.nodeId);
            const e = edges.find((x: any) => x.source === current.nodeId);
            const nextId = e?.target;
            current = nextId ? nodes.find((n: any) => n.nodeId === nextId) : undefined;
            safety++;
          }
          if (ordered[ordered.length - 1]?.type !== 'end') {
            const end = nodes.find((n: any) => n.type === 'end');
            if (end) ordered.push(end);
          }

          const list = ordered.length ? ordered : nodes;

          return (
            <div>
              {list.map((n, idx) => {
                const names = Array.isArray(n.assignees?.values)
                  ? n.assignees!.values
                      .map((id: any) => {
                        const u = userMap.get(String(id));
                        return u ? (u.name || u.account) : String(id);
                      })
                      .filter(Boolean)
                  : [];
                return (
                  <div key={n.nodeId || idx} style={{ marginBottom: 12 }}>
                    <div style={{ fontWeight: 600 }}>
                      {n.type === 'start' ? '发起' : n.type === 'end' ? '结束' : (n.label || n.type)}
                    </div>
                    {names.length > 0 ? (
                      <div style={{ color: '#666' }}>审批人：{names.join(', ')}</div>
                    ) : (
                      <div style={{ color: '#999' }}>无指派/系统节点</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </Modal>
    </AntForm>
  );
};

