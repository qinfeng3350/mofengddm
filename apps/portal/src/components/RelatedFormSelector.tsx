import { useState, useEffect } from "react";
import { Modal, Table, Input, Button, Space, message, Tag, Empty, Pagination } from "antd";
import { SearchOutlined, CheckOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { formDefinitionApi, type FormDefinitionResponse } from "@/api/formDefinition";
import { formDataApi, type FormDataResponse } from "@/api/formData";
import type { FormSchemaType } from "@mofeng/shared-schema";

interface RelatedFormSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelect: (record: FormDataResponse) => void;
  relatedFormId: string;
  multiple?: boolean;
  currentFormSchema?: FormSchemaType; // 当前表单的 schema，用于字段映射
  onFieldMapping?: (mapping: Record<string, string>) => void; // 字段映射回调
}

export const RelatedFormSelector = ({
  open,
  onClose,
  onSelect,
  relatedFormId,
  multiple = false,
  currentFormSchema,
  onFieldMapping,
}: RelatedFormSelectorProps) => {
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<FormDataResponse | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});

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
      // 多选模式：返回选中的记录数组
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
  const allRelatedFields = (() => {
    if (!relatedFormDefinition) return [];
    const result = new Map<string, any>();
    const cfg: any = relatedFormDefinition.config || {};
    (cfg.fields || []).forEach((f: any) => {
      if (f && f.fieldId) {
        result.set(f.fieldId, f);
      }
    });
    const elements = cfg.elements || [];
    elements.forEach((el: any) => {
      if (el && "fieldId" in el && !result.has(el.fieldId)) {
        result.set(el.fieldId, el);
      }
      if (el && "children" in el && Array.isArray(el.children)) {
        el.children.forEach((child: any) => {
          if (child && "fieldId" in child && !result.has(child.fieldId)) {
            result.set(child.fieldId, child);
          }
        });
      }
    });
    return Array.from(result.values());
  })();

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
          render: (value: any) => {
            if (value === null || value === undefined) return "-";

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

    // 只展示前 5 列，避免列太多撑爆弹窗
    return cols.slice(0, 5);
  })();

  // 添加操作列
  columns.push({
    title: "操作",
    key: "action",
    width: 100,
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
                dataSource={formDataList || []}
                rowSelection={rowSelection}
                pagination={false}
                size="small"
                scroll={{ y: 400 }}
              />
              {formDataList && formDataList.length > 0 && (
                <div style={{ marginTop: 16, textAlign: "right" }}>
                  <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={formDataList.length}
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

