import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, Spin, Button, Space, Tag, Dropdown, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  DownloadOutlined,
  UploadOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  DownOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";
import { apiClient } from "@/api/client";
import { departmentApi } from "@/api/department";
import { extractAttachmentPreviewUrls } from "@/utils/attachmentDisplay";

interface FormDataListTableProps {
  formId: string;
  formDefinition?: any;
  onAdd?: () => void;
  onDesign?: () => void;
  selectedFilter?: string;
  onFilterChange?: (filter: string) => void;
  onManageFilters?: () => void;
  // 打开查看
  onView?: (recordId: string) => void;
}

export const FormDataListTable: React.FC<FormDataListTableProps> = ({
  formId,
  formDefinition: propFormDefinition,
  onAdd,
  onDesign,
  selectedFilter = "全部",
  onFilterChange,
  onManageFilters,
  onView,
}) => {
  // 表单定义
  const { data: queryFormDefinition, isLoading: formLoading } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId),
    enabled: !!formId && !propFormDefinition,
  });

  const formDefinition = propFormDefinition || queryFormDefinition;

  // 表单数据
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["formData", formId],
    queryFn: () => formDataApi.getListByForm(formId),
    enabled: !!formId,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const dataSource = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];
    return data.map((record: any, index: number) => ({
      ...record,
      serial: index + 1,
    }));
  }, [data]);

  // 调试：打印一条原始数据，方便确认字段真实结构
  useEffect(() => {
    if (data && Array.isArray(data) && data.length > 0) {
      // 只打印前几条，避免刷屏
      console.log("【调试】表单数据原始记录前3条：", data.slice(0, 3));
    }
  }, [data]);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  // 获取用户列表，用于把ID映射成姓名
  const { data: userList = [], isLoading: userListLoading } = useQuery({
    queryKey: ["users", "forList"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/users");
        return Array.isArray(res) ? res : [];
      } catch (e) {
        console.error("获取用户列表失败（列表页）:", e);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    retry: 3, // 重试3次
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 指数退避，最多30秒
  });

  // 部门列表：从API加载
  const { data: departmentListData } = useQuery({
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
      console.log("【调试 FormDataListTable】用户列表已加载，用户数量:", userList.length);
      console.log("【调试 FormDataListTable】用户列表前3个:", userList.slice(0, 3));
      console.log("【调试 FormDataListTable】userMap大小:", map.size);
      console.log("【调试 FormDataListTable】userMap keys:", Array.from(map.keys()));
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

  const formatNumberWithThousands = (raw: any) => {
    if (raw === null || raw === undefined || raw === "") return "-";
    const s = String(raw);
    const cleaned = s.replace(/,/g, "");
    // 只处理纯数字（允许负号和小数）
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return s;
    const [i, d] = cleaned.split(".");
    const sign = i.startsWith("-") ? "-" : "";
    const intPart = sign ? i.slice(1) : i;
    const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return d != null && d !== "" ? `${sign}${withComma}.${d}` : `${sign}${withComma}`;
  };

  const formatValue = (val: any, type?: string, fieldConfig?: any) => {
    if (type === "datetime") {
      if (!val) return "-";
      const d = dayjs(val);
      return d.isValid() ? d.format("YYYY-MM-DD HH:mm:ss") : "-";
    }
    if (type === "date") {
      if (!val) return "-";
      const d = dayjs(val);
      return d.isValid() ? d.format("YYYY-MM-DD") : "-";
    }
    if (type === "multiselect" || type === "checkbox") {
      return Array.isArray(val) ? val.join(", ") : val ?? "-";
    }

    // 人员/部门字段：优先显示名称
    if (type === "user" || type === "department") {
      if (!val) return "-";

      // 如果是字符串形式的 JSON，先尝试解析
      if (typeof val === "string" && (val.trim().startsWith("{") || val.trim().startsWith("["))) {
        try {
          const parsed = JSON.parse(val);
          // 解析成功则用解析后的值继续处理
          val = parsed;
        } catch {
          // 解析失败就按普通字符串处理
        }
      }

      const extractName = (v: any) => {
        if (!v) return "";
        // 如果是纯 ID，优先从缓存中查名字
        if (typeof v === "string" || typeof v === "number") {
          const id = String(v).trim();
          if (type === "user") {
            console.log(`【调试 FormDataListTable】extractName 被调用，id: ${id}, userMap.size: ${userMap.size}`);
            const u = userMap.get(id);
            console.log(`【调试 FormDataListTable】查找结果:`, u ? `找到用户: ${u.name || u.account}` : `未找到用户`);
            if (u) return u.name || u.account || id;
            // 调试：如果未匹配到用户，打印调试信息
            if (userMap.size > 0 && /^\d+$/.test(id)) {
              console.log(`【调试 FormDataListTable】未找到用户ID: ${id}，userMap keys:`, Array.from(userMap.keys()));
            }
            // 若不是纯数字（可能已是姓名/账号），直接显示原值
            if (/\D/.test(id)) return id;
            // 纯数字但未匹配到用户，兜底显示
            return `未知用户(#${id})`;
          }
          if (type === "department") {
            const d = departmentMap.get(id);
            if (d) return d.name || id;
            // 如果不是纯数字（可能已经是部门名称），直接返回
            if (/\D/.test(id)) return id;
            // 纯数字但未匹配到部门，显示未知部门
            return `未知部门(#${id})`;
          }
          return id;
        }
        return v.name || v.label || v.account || v.id || "";
      };
      if (Array.isArray(val)) {
        const names = val.map(extractName).filter(Boolean);
        return names.length ? names.join(", ") : "-";
      }
      const name = extractName(val);
      return name || "-";
    }

    // 地址字段：拼接省市区+详细地址
    if (type === "address") {
      if (!val) return "-";

      // 处理字符串形式的 JSON 或 "[object Object]"
      if (typeof val === "string") {
        const trimmed = val.trim();
        if (trimmed === "[object Object]") {
          // 明显是错误的字符串，还原成友好的展示
          return "-";
        }
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          try {
            const parsed = JSON.parse(trimmed);
            val = parsed;
          } catch {
            return val;
          }
        } else {
          return val;
        }
      }

      if (typeof val === "object") {
        const parts = [val.province, val.city, val.district, val.detail].filter(Boolean);
        return parts.length ? parts.join("") : "-";
      }
    }

    // 流水号字段：直接显示
    if (type === "serial") {
      if (!val && val !== 0) return "-";
      return String(val);
    }

    if (type === "boolean") {
      if (val === null || val === undefined || val === "") return "-";
      const on =
        val === true || val === "true" || val === 1 || val === "1";
      return on ? "是" : "否";
    }

    if (type === "attachment") {
      const urls = extractAttachmentPreviewUrls(val);
      return urls.length ? `附件×${urls.length}` : "-";
    }

    if (type === "signature") {
      if (!val || typeof val !== "string") return "-";
      if (val.startsWith("data:image")) return "[签名]";
      return String(val);
    }

    // 数字字段千分位（列表展示）
    // 统一：number / formula 类型渲染时，对整数部分加逗号（输入为非纯数字则保持原值）。
    if (type === "number" || type === "formula") {
      return formatNumberWithThousands(val);
    }

    if (val === null || val === undefined || val === "") return "-";
    return String(val);
  };

  const columns: ColumnsType<any> = useMemo(() => {
    // 即使没有 fields 也至少返回基础列，避免整张表空白
    const cols: ColumnsType<any> = [];

    // 序号列
    cols.push({
      title: "序号",
      dataIndex: "serial",
      key: "serial",
      width: 80,
      fixed: "left",
      render: (_v, record: any, index) => (
        <span
          style={{ cursor: onView ? "pointer" : "default", color: onView ? "#1890ff" : undefined }}
          onClick={() => onView?.(record.recordId)}
        >
          {index + 1}
        </span>
      ),
    });

    const fields = (formDefinition?.fields || []) as any[];

    fields.forEach((field) => {
      const fieldId = field.fieldId || field.code || field.id;
      const title = field.label || field.name || field.fieldName || fieldId;

      if (field.type === "subtable" && Array.isArray(field.subtableFields)) {
        // 子表：为每个子字段生成一列
        field.subtableFields.forEach((sub: any, subIndex: number) => {
          const subId = sub.fieldId || sub.code || sub.fieldName || `sub${subIndex}`;
          const subTitle = `${title} ${sub.label || sub.fieldName || subId}`;
          cols.push({
            title: subTitle,
            key: `${fieldId}.${subId}`,
            width: 150,
            render: (_v, record: any) => {
              let arr = record.data?.[fieldId];
              // 兼容后端把子表以 JSON 字符串返回的情况
              if (typeof arr === "string") {
                try {
                  const parsed = JSON.parse(arr);
                  arr = Array.isArray(parsed) ? parsed : [];
                } catch {
                  arr = [];
                }
              }
              const rows: any[] = Array.isArray(arr) ? arr : [];
              if (!rows.length) return "-";
              return (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {rows.map((row, idx) => (
                    <div key={idx}>
                      {sub.type === "attachment" ? (
                        (() => {
                          const urls = extractAttachmentPreviewUrls(row[subId]);
                          if (!urls.length) return "-";
                          return (
                            <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                              {urls.slice(0, 2).map((url, i) => (
                                <img
                                  key={`${url}-${i}`}
                                  src={url}
                                  alt=""
                                  style={{
                                    maxHeight: 32,
                                    maxWidth: 48,
                                    objectFit: "cover",
                                    borderRadius: 2,
                                  }}
                                />
                              ))}
                              {urls.length > 2 ? (
                                <span style={{ color: "#888", fontSize: 12 }}>+{urls.length - 2}</span>
                              ) : null}
                            </span>
                          );
                        })()
                      ) : sub.type === "signature" ? (
                        (() => {
                          const sig = row[subId];
                          if (!sig || typeof sig !== "string") return "-";
                          if (sig.startsWith("data:image")) {
                            return (
                              <img
                                src={sig}
                                alt=""
                                style={{
                                  maxHeight: 32,
                                  maxWidth: 72,
                                  objectFit: "contain",
                                  verticalAlign: "middle",
                                }}
                              />
                            );
                          }
                          return formatValue(sig, "signature");
                        })()
                      ) : (
                        formatValue(row[subId], sub.type, sub)
                      )}
                    </div>
                  ))}
                </div>
              );
            },
          });
        });
      } else {
        // 根据字段配置，识别更细的显示类型（例如地址/人员/部门）
        let displayType = field.type as string | undefined;
        const fieldTypeHint = field.advanced?.fieldType;

        // 地址：类型是 input + 高级配置，或者 label 就是“地址”
        if (
          (field.type === "input" && fieldTypeHint === "address") ||
          field.label === "地址"
        ) {
          displayType = "address";
        }

        // 人员字段：类型为 user，或者高级配置 / 标签里包含“人员”
        if (!displayType && (field.type === "user" || fieldTypeHint === "user" || field.label?.includes("人员"))) {
          displayType = "user";
        }

        // 部门字段：类型为 department，或者高级配置 / 标签里包含“部门”
        if (
          !displayType &&
          (field.type === "department" || fieldTypeHint === "department" || field.label?.includes("部门"))
        ) {
          displayType = "department";
        }

        if (field.type === "address") {
          displayType = "address";
        }

        cols.push({
          title,
          dataIndex: ["data", fieldId],
          key: fieldId,
          width: 150,
          render: (_v, record: any) => {
            const raw = record.data?.[fieldId];
            if (field.type === "attachment") {
              const urls = extractAttachmentPreviewUrls(raw);
              if (!urls.length) return "-";
              return (
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
                      }}
                    />
                  ))}
                  {urls.length > 3 ? (
                    <span style={{ color: "#888", fontSize: 12 }}>+{urls.length - 3}</span>
                  ) : null}
                </span>
              );
            }
            if (field.type === "signature") {
              if (!raw || typeof raw !== "string") return "-";
              if (raw.startsWith("data:image")) {
                return (
                  <img
                    src={raw}
                    alt=""
                    style={{
                      maxHeight: 44,
                      maxWidth: 120,
                      objectFit: "contain",
                      verticalAlign: "middle",
                      borderRadius: 4,
                      border: "1px solid #f0f0f0",
                    }}
                  />
                );
              }
              return formatValue(raw, "signature");
            }
            return formatValue(raw, displayType, field);
          },
        });
      }
    });

    // 创建人
    cols.push({
      title: "创建人",
      key: "createdBy",
      width: 120,
      fixed: "right",
      render: (_v, record: any) =>
        record.createdByName ||
        record.createdUserName ||
        record.submitterName ||
        record.creatorName ||
        record.creator ||
        "默认用户",
    });

    // 创建时间
    cols.push({
      title: "创建时间",
      key: "createdAt",
      width: 180,
      fixed: "right",
      render: (_v, record: any) => formatValue(record.createdAt, "datetime"),
    });

    return cols;
  }, [formDefinition, onView, userMap, departmentMap]);

  if (formLoading || isLoading) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!formDefinition) {
    return (
      <div style={{ background: "#fff", padding: 24, borderRadius: 8, textAlign: "center" }}>
        <p>表单不存在</p>
      </div>
    );
  }

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <div
      style={{
        background: "#fff",
        padding: "24px",
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* 顶部工具栏（简化版） */}
      <div
        style={{
          marginBottom: 16,
          borderBottom: "1px solid #f0f0f0",
          paddingBottom: 12,
          flexShrink: 0,
        }}
      >
        {/* 第一排：表单名称 + 过滤 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <Space>
            <Typography.Text strong style={{ fontSize: 16 }}>
              {formDefinition?.formName || "未命名表单"}
            </Typography.Text>
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
                  {
                    type: "divider",
                  },
                  {
                    key: "管理",
                    label: (
                      <Space>
                        <ClockCircleOutlined style={{ color: "#1890ff" }} />
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

        {/* 第二排：按钮组 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Space>
            {onAdd && (
              <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>
                新增
              </Button>
            )}
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                message.info(`导入 ${formDefinition?.formName} 的数据`);
              }}
            >
              导入
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={() => {
                message.info(`导出 ${formDefinition?.formName} 的数据`);
              }}
            >
              导出
            </Button>
            <Button
              icon={<QrcodeOutlined />}
              onClick={() => {
                message.info(`打印 ${formDefinition?.formName} 的二维码`);
              }}
            >
              打印二维码
            </Button>
          </Space>
          <Space>
            <Button type="text" icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button type="text" icon={<ClockCircleOutlined />}>
              操作记录
            </Button>
            <Button type="text" icon={<EyeOutlined />}>
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
            <Button type="text" icon={<BarChartOutlined />} style={{ backgroundColor: "#e6f7ff" }} />
          </Space>
        </div>
      </div>

      {/* 表格本体 */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Table
          rowKey={(record) => record.recordId}
          columns={columns}
          dataSource={dataSource}
          size="small"
          pagination={false}
          scroll={{ x: "max-content", y: 393 }}
          rowSelection={rowSelection}
        />
      </div>
    </div>
  );
};


