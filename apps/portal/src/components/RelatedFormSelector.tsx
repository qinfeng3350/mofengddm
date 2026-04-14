import { useState, useEffect, useMemo } from "react";
import { Modal, Table, Input, Button, Space, message, Tag, Empty, Pagination, Alert } from "antd";
import { SearchOutlined, CheckOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { formDefinitionApi, type FormDefinitionResponse } from "@/api/formDefinition";
import { formDataApi, type FormDataResponse } from "@/api/formData";
import type { FormSchemaType } from "@mofeng/shared-schema";

export type RelatedDataFilterCondition = {
  fieldId: string;
  operator: string;
  value: string;
};

function resolveFilterValue(raw: string, formValues?: Record<string, unknown>): string {
  const s = String(raw ?? "").trim();
  const m = s.match(/^\{([^{}]+)\}$/);
  if (m && formValues) {
    const key = m[1].trim();
    const v = formValues[key];
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.map(String).join(",");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }
  return s;
}

/** 按设计器「数据筛选」条件过滤关联表记录（比对关联表 data[fieldId]） */
export function recordMatchesRelatedDataFilter(
  recordData: Record<string, unknown>,
  conditions: RelatedDataFilterCondition[] | undefined,
  runtimeFormValues?: Record<string, unknown>,
): boolean {
  if (!conditions?.length) return true;

  const normalize = (v: unknown) => {
    if (v === null || v === undefined) return "";
    if (Array.isArray(v)) return v.join(",");
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const toNumber = (v: unknown) => {
    const n = typeof v === "number" ? v : Number(String(v).trim());
    return Number.isFinite(n) ? n : NaN;
  };

  return conditions.every((cond) => {
    if (!String(cond.fieldId || "").trim()) return true;
    const raw = recordData[cond.fieldId];
    const condVal = resolveFilterValue(cond.value, runtimeFormValues).trim();
    if (!condVal) return true;

    switch (cond.operator) {
      case "eq":
        return normalize(raw) === condVal;
      case "ne":
        return normalize(raw) !== condVal;
      case "gt":
        return toNumber(raw) > toNumber(condVal);
      case "gte":
        return toNumber(raw) >= toNumber(condVal);
      case "lt":
        return toNumber(raw) < toNumber(condVal);
      case "lte":
        return toNumber(raw) <= toNumber(condVal);
      case "contains":
        return normalize(raw).includes(condVal);
      case "notContains":
        return !normalize(raw).includes(condVal);
      default:
        return true;
    }
  });
}

interface RelatedFormSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (record: FormDataResponse) => void;
  relatedFormId: string;
  multiple?: boolean;
  currentFormSchema?: FormSchemaType; // 当前表单的 schema，用于字段映射
  onFieldMapping?: (mapping: Record<string, string>) => void; // 字段映射回调
  /** 设计器「数据筛选」开关 */
  dataFilterEnabled?: boolean;
  dataFilterConditions?: RelatedDataFilterCondition[];
  /** 当前表单值：用于解析条件值里的 `{fieldId}` */
  runtimeFormValues?: Record<string, unknown>;
}

export const RelatedFormSelector = ({
  open,
  onClose,
  onSelect,
  relatedFormId,
  multiple = false,
  currentFormSchema,
  onFieldMapping,
  dataFilterEnabled = false,
  dataFilterConditions,
  runtimeFormValues,
}: RelatedFormSelectorProps) => {
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<FormDataResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

  const collectSchemaFields = (cfg: any): any[] => {
    const result = new Map<string, any>();
    (cfg?.fields || []).forEach((f: any) => {
      if (f?.fieldId) result.set(String(f.fieldId), f);
    });
    (cfg?.elements || []).forEach((el: any) => {
      if (el && "fieldId" in el && el.fieldId && !result.has(String(el.fieldId))) {
        result.set(String(el.fieldId), el);
      }
      if (el && "children" in el && Array.isArray(el.children)) {
        el.children.forEach((child: any) => {
          if (child && "fieldId" in child && child.fieldId && !result.has(String(child.fieldId))) {
            result.set(String(child.fieldId), child);
          }
        });
      }
      if (el && "columns" in el && Array.isArray(el.columns)) {
        el.columns.forEach((col: any) => {
          if (col?.children && Array.isArray(col.children)) {
            col.children.forEach((child: any) => {
              if (child && "fieldId" in child && child.fieldId && !result.has(String(child.fieldId))) {
                result.set(String(child.fieldId), child);
              }
            });
          }
        });
      }
    });
    return Array.from(result.values());
  };

  // 获取关联表单的定义
  const { data: relatedFormDefinition, isLoading: formLoading } = useQuery({
    queryKey: ["formDefinition", relatedFormId],
    queryFn: () => formDefinitionApi.getById(relatedFormId),
    enabled: !!relatedFormId && open,
  });

  // 获取关联表单的数据列表
  const { data: formDataList, isLoading: dataLoading } = useQuery({
    queryKey: ["formDataList", relatedFormId, page, pageSize, searchText],
    queryFn: async () => {
      const list = await formDataApi.getListByForm(relatedFormId);
      // 简单搜索过滤
      if (searchText) {
        return list.filter((item) => {
          const dataStr = JSON.stringify(item.data).toLowerCase();
          return dataStr.includes(searchText.toLowerCase());
        });
      }
      return list;
    },
    enabled: !!relatedFormId && open,
  });

  // 初始化字段映射
  useEffect(() => {
    if (relatedFormDefinition && currentFormSchema && open) {
      const mapping: Record<string, string> = {};
      const relatedFields = relatedFormDefinition.config?.fields || [];
      const currentFields = currentFormSchema.fields || [];

      // 自动匹配相同 fieldId 的字段
      relatedFields.forEach((relatedField: any) => {
        const matchField = currentFields.find(
          (f: any) => f.fieldId === relatedField.fieldId && f.type === relatedField.type
        );
        if (matchField) {
          mapping[relatedField.fieldId] = matchField.fieldId;
        }
      });
      setFieldMapping(mapping);
    }
  }, [relatedFormDefinition, currentFormSchema, open]);

  const handleSelect = () => {
    if (multiple) {
      if (selectedRowKeys.length === 0) {
        message.warning("请至少选择一条记录");
        return;
      }
      // 多选模式：返回选中的记录数组（从全量列表取，避免与分页/筛选数据源不一致）
      const selectedRecords = formDataList?.filter((item) =>
        selectedRowKeys.includes(item.recordId)
      ) || [];
      if (selectedRecords.length > 0) {
        onSelect(selectedRecords as any);
        handleClose();
      }
    } else {
      if (!selectedRecord) {
        message.warning("请选择一条记录");
        return;
      }
      // 单选模式：返回选中的记录
      onSelect(selectedRecord);
      // 如果有字段映射，执行自动填充
      if (onFieldMapping && Object.keys(fieldMapping).length > 0) {
        onFieldMapping(fieldMapping);
      }
      handleClose();
    }
  };

  const handleClose = () => {
    setSearchText("");
    setSelectedRowKeys([]);
    setSelectedRecord(null);
    setPage(1);
    onClose();
  };

  // 关联表单的所有字段（包含容器内字段）
  const allRelatedFields = useMemo(() => {
    if (!relatedFormDefinition) return [];
    const cfg: any = relatedFormDefinition.config || {};
    return collectSchemaFields(cfg).filter(
      (f: any) => f?.type !== "button" && f?.type !== "description",
    );
  }, [relatedFormDefinition]);

  // 为“关联字段(record_xxx)”准备显示文本映射
  const relatedRefFields = useMemo(
    () =>
      allRelatedFields
        .map((f: any) => {
          // 1) 关联表单字段
          if ((f?.type === "relatedForm" || f?.type === "relatedFormMulti") && f?.relatedFormId) {
            return {
              fieldId: String(f.fieldId),
              relatedFormId: String(f.relatedFormId),
              relatedDisplayField: f.relatedDisplayField,
            };
          }
          // 2) 选项字段 + 关联其他表单数据（存的是 recordId）
          if (
            (f?.type === "select" ||
              f?.type === "radio" ||
              f?.type === "checkbox" ||
              f?.type === "multiselect") &&
            f?.advanced?.optionsSource === "relatedForm" &&
            f?.advanced?.optionsRelatedFormId
          ) {
            return {
              fieldId: String(f.fieldId),
              relatedFormId: String(f.advanced.optionsRelatedFormId),
              relatedDisplayField: f.advanced.optionsRelatedLabelFieldId,
            };
          }
          return null;
        })
        .filter(Boolean) as Array<{ fieldId: string; relatedFormId: string; relatedDisplayField?: string }>,
    [allRelatedFields],
  );

  const { data: relatedValueLabelMaps = {} } = useQuery({
    queryKey: [
      "related-form-selector-ref-maps",
      relatedFormId,
      relatedRefFields.map((f: any) => `${f.fieldId}:${f.relatedFormId}:${f.relatedDisplayField || ""}`).join("|"),
    ],
    enabled: open && relatedRefFields.length > 0,
    queryFn: async () => {
      const maps: Record<string, Record<string, string>> = {};
      for (const f of relatedRefFields) {
        const refFormId = String(f.relatedFormId || "");
        if (!refFormId) continue;
        const [def, rows] = await Promise.all([
          formDefinitionApi.getById(refFormId).catch(() => null),
          formDataApi.getListByForm(refFormId).catch(() => []),
        ]);
        const refFields = collectSchemaFields(def?.config || {});
        const displayFieldId = String(
          f.relatedDisplayField || refFields[0]?.fieldId || "",
        );
        const labelMap: Record<string, string> = {};
        (Array.isArray(rows) ? rows : []).forEach((r: any) => {
          const rid = String(r?.recordId || "");
          if (!rid) return;
          const labelRaw = displayFieldId ? r?.data?.[displayFieldId] : undefined;
          labelMap[rid] =
            labelRaw == null || String(labelRaw).trim() === ""
              ? rid
              : String(labelRaw);
        });
        maps[String(f.fieldId)] = labelMap;
      }
      return maps;
    },
  });

  const filteredData = useMemo(() => {
    let list = formDataList || [];
    if (searchText) {
      const kw = searchText.toLowerCase();
      list = list.filter((item) => JSON.stringify(item.data || {}).toLowerCase().includes(kw));
    }
    if (dataFilterEnabled && dataFilterConditions?.length) {
      list = list.filter((item) =>
        recordMatchesRelatedDataFilter(
          (item.data || {}) as Record<string, unknown>,
          dataFilterConditions,
          runtimeFormValues,
        ),
      );
    }
    return list;
  }, [formDataList, searchText, dataFilterEnabled, dataFilterConditions, runtimeFormValues]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  // 生成表格列：普通字段直接展示，子表字段展开为子表列（如「客户名称」「联系电话」）
  const columns = (() => {
    const cols: any[] = [];

    allRelatedFields.forEach((field: any) => {
      // 子表：展开 subtableFields
      if (field.type === "subtable" && Array.isArray(field.subtableFields)) {
        const parentFieldId = field.fieldId;
        field.subtableFields.forEach((sub: any, idx: number) => {
          const subId = sub.fieldId || sub.fieldName || `sub_${idx}`;
          const colKey = `${parentFieldId}_${subId}`;
          cols.push({
            title: sub.label || sub.fieldName || subId,
            key: colKey,
            ellipsis: true,
            render: (_: any, record: FormDataResponse) => {
              const data = (record.data || {}) as any;
              const rows = data[parentFieldId] as any[];
              if (!Array.isArray(rows) || rows.length === 0) return "-";
              const values = rows
                .map((row) => row?.[sub.fieldId])
                .filter((v) => v !== undefined && v !== null && v !== "");
              if (!values.length) return "-";
              const text = values
                .map((v) =>
                  typeof v === "object" ? JSON.stringify(v) : String(v)
                )
                .join("，");
              return text;
            },
          });
        });
      } else {
        // 普通字段：直接从 data[fieldId] 取值
        cols.push({
          title: field.label,
          dataIndex: ["data", field.fieldId],
          key: field.fieldId,
          ellipsis: true,
          width: 160,
          render: (value: any) => {
            if (value === null || value === undefined) return "-";

            const optionRelated =
              (field.type === "select" ||
                field.type === "radio" ||
                field.type === "checkbox" ||
                field.type === "multiselect") &&
              field?.advanced?.optionsSource === "relatedForm";

            if (field.type === "relatedForm" || optionRelated) {
              const key = String(value);
              const labelMap = relatedValueLabelMaps[String(field.fieldId)] || {};
              return labelMap[key] || key || "-";
            }
            if ((field.type === "relatedFormMulti" || (optionRelated && Array.isArray(value))) && Array.isArray(value)) {
              const labelMap = relatedValueLabelMaps[String(field.fieldId)] || {};
              const labels = value.map((v: any) => labelMap[String(v)] || String(v));
              return labels.length ? labels.join("，") : "-";
            }

            // 选项字段：显示 label，并在彩色模式下显示颜色
            if (
              field.type === "select" ||
              field.type === "radio" ||
              field.type === "checkbox" ||
              field.type === "multiselect"
            ) {
              const options = Array.isArray(field.options) ? field.options : [];
              const labelMap = new Map<string, { label: string; color?: string }>();
              options.forEach((opt: any) => {
                const key = String(opt?.value ?? "");
                if (!key) return;
                labelMap.set(key, {
                  label: String(opt?.label ?? key),
                  color: typeof opt?.color === "string" ? opt.color : undefined,
                });
              });

              const colorful = field?.advanced?.colorful === true;
              const values = Array.isArray(value) ? value : [value];
              const mapped = values
                .filter((v) => v !== undefined && v !== null && String(v) !== "")
                .map((v) => {
                  const raw = String(v);
                  const hit = labelMap.get(raw);
                  return {
                    label: hit?.label || raw,
                    color: hit?.color,
                  };
                });

              if (!mapped.length) return "-";
              if (!colorful) {
                return mapped.map((m) => m.label).join("，");
              }
              return (
                <Space size={4} wrap>
                  {mapped.map((m, idx) => (
                    <Tag key={`${m.label}-${idx}`} color={m.color || "processing"} style={{ marginInlineEnd: 0 }}>
                      {m.label}
                    </Tag>
                  ))}
                </Space>
              );
            }

            // 数组类字段，显示更友好的提示
            if (Array.isArray(value)) {
              const preview = value
                .slice(0, 3)
                .map((v) =>
                  typeof v === "object" ? JSON.stringify(v) : String(v)
                )
                .join("，");
              return value.length > 3 ? `${preview} 等 ${value.length} 项` : preview;
            }

            if (typeof value === "object") {
              // 普通对象，截断显示
              const str = JSON.stringify(value);
              return str.length > 50 ? `${str.slice(0, 50)}...` : str;
            }

            return String(value);
          },
        });
      }
    });

    return cols;
  })();

  // 添加操作列
  columns.push({
    title: "操作",
    key: "action",
    width: 100,
    fixed: "right",
    render: (_: any, record: FormDataResponse) => (
      <Button
        type="link"
        size="small"
        onClick={() => {
          if (multiple) {
            const keys = selectedRowKeys.includes(record.recordId)
              ? selectedRowKeys.filter((k) => k !== record.recordId)
              : [...selectedRowKeys, record.recordId];
            setSelectedRowKeys(keys);
          } else {
            setSelectedRecord(record);
            setSelectedRowKeys([record.recordId]);
          }
        }}
      >
        {selectedRowKeys.includes(record.recordId) ? (
          <Space>
            <CheckOutlined style={{ color: "#1890ff" }} />
            已选择
          </Space>
        ) : (
          "选择"
        )}
      </Button>
    ),
  });

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys as string[]);
      if (!multiple && keys.length > 0) {
        const record = formDataList?.find((item) => item.recordId === keys[0]);
        setSelectedRecord(record || null);
      }
    },
    type: multiple ? "checkbox" : "radio",
  };

  return (
    <Modal
      title={
        <Space>
          <span>选择关联表单数据</span>
          {relatedFormDefinition && (
            <Tag color="blue">{relatedFormDefinition.formName}</Tag>
          )}
        </Space>
      }
      open={open}
      onCancel={handleClose}
      onOk={handleSelect}
      width={1000}
      okText={multiple ? `确定选择 (${selectedRowKeys.length})` : "确定选择"}
      cancelText="取消"
    >
      {formLoading ? (
        <div style={{ textAlign: "center", padding: 50 }}>
          <span>加载表单定义中...</span>
        </div>
      ) : !relatedFormDefinition ? (
        <Empty description="未找到关联表单" />
      ) : (
        <>
          <div style={{ marginBottom: 16 }}>
            <Input
              placeholder="搜索表单数据..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              style={{ width: 300 }}
            />
            {dataFilterEnabled && (dataFilterConditions?.length || 0) > 0 ? (
              <Alert
                type="info"
                showIcon
                style={{ marginTop: 12 }}
                message={`已按设计器配置过滤可选数据（${dataFilterConditions!.length} 条条件）`}
              />
            ) : null}
          </div>

          {dataLoading ? (
            <div style={{ textAlign: "center", padding: 50 }}>
              <span>加载数据中...</span>
            </div>
          ) : (
            <>
              <Table
                rowKey="recordId"
                columns={columns}
                dataSource={pagedData}
                rowSelection={rowSelection}
                pagination={false}
                size="small"
                scroll={{ x: "max-content", y: 400 }}
              />
              {filteredData && filteredData.length > 0 && (
                <div style={{ marginTop: 16, textAlign: "right" }}>
                  <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={filteredData.length}
                    onChange={(p, size) => {
                      setPage(p);
                      setPageSize(size);
                    }}
                    showSizeChanger
                    showQuickJumper
                    showTotal={(total) => `共 ${total} 条`}
                  />
                </div>
              )}
            </>
          )}

          {/* 字段映射提示 */}
          {currentFormSchema && Object.keys(fieldMapping).length > 0 && (
            <div style={{ marginTop: 16, padding: 12, background: "#f0f7ff", borderRadius: 4 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>字段自动映射：</div>
              <div style={{ fontSize: 12, color: "#666" }}>
                {Object.entries(fieldMapping).slice(0, 3).map(([relatedFieldId, currentFieldId]) => {
                  const relatedField = relatedFormDefinition.config?.fields?.find(
                    (f: any) => f.fieldId === relatedFieldId
                  );
                  const currentField = currentFormSchema.fields?.find(
                    (f: any) => f.fieldId === currentFieldId
                  );
                  return (
                    <div key={relatedFieldId} style={{ marginBottom: 4 }}>
                      {relatedField?.label} → {currentField?.label}
                    </div>
                  );
                })}
                {Object.keys(fieldMapping).length > 3 && (
                  <div>... 还有 {Object.keys(fieldMapping).length - 3} 个字段</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
};

