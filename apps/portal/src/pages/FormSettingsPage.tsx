import React, { useState, useEffect, useRef } from "react";
import { Layout, Menu, Empty, Button, Card, Modal, Form, Select, Alert, Typography, Space, Input, Collapse, Drawer, Dropdown, Tag, Switch, Divider, Radio, Table, Tooltip, QRCode } from "antd";
import {
  LockOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ThunderboltOutlined,
  BellOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  PrinterOutlined,
  AppstoreOutlined,
  RobotOutlined,
  ImportOutlined,
  ThunderboltFilled,
  PlusOutlined,
  SearchOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  QrcodeOutlined,
  FileTextOutlined as FileTextIcon,
  SwapOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formDefinitionApi } from "@/api/formDefinition";
import { businessRuleApi } from "@/api/businessRule";
import { printTemplateApi } from "@/api/printTemplate";
import { roleApi } from "@/api/role";
import { useFormDesignerStore } from "@/modules/form-designer/store/useFormDesignerStore";
import { message } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useIsMobile } from "@/hooks/useIsMobile";

const { Text } = Typography;
const { Option, OptGroup } = Select;
const { TextArea } = Input;
const { Panel } = Collapse;

const { Sider, Content } = Layout;

// 统一的设置页面布局包装组件
const SettingsPageLayout: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fff" }}>
      <div style={{ padding: "16px 24px", background: "#fff", borderBottom: "1px solid #f0f0f0", flexShrink: 0 }}>
        <h3 style={{ fontSize: 16, fontWeight: 500, margin: 0 }}>
          {title}
        </h3>
      </div>
      <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
};

interface FormSettingsPageProps {
  formId?: string;
  appId?: string;
}

type MenuItem = Required<MenuProps>["items"][number];

export const FormSettingsPage: React.FC<FormSettingsPageProps> = ({
  formId,
  appId,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>("business-rule");
  const isMobile = useIsMobile();

  const menuItems: MenuItem[] = [
    {
      key: "field-permission",
      icon: <LockOutlined />,
      label: "字段权限",
    },
    {
      key: "data-summary",
      icon: <FileTextOutlined />,
      label: "数据摘要",
    },
    {
      key: "submit-validation",
      icon: <CheckCircleOutlined />,
      label: "提交校验",
    },
    {
      key: "business-rule",
      icon: <ThunderboltOutlined />,
      label: "业务规则",
    },
    {
      key: "message-reminder",
      icon: <BellOutlined />,
      label: "消息提醒",
    },
    {
      key: "associated-list",
      icon: <UnorderedListOutlined />,
      label: "关联列表",
    },
    {
      key: "external-link",
      icon: <LinkOutlined />,
      label: "表单外链",
    },
    {
      key: "print-template",
      icon: <PrinterOutlined />,
      label: "打印模板",
    },
    {
      key: "function-buttons",
      icon: <AppstoreOutlined />,
      label: "功能按钮",
    },
    {
      key: "automation",
      icon: <RobotOutlined />,
      label: "自动化",
    },
    {
      key: "import-rules",
      icon: <ImportOutlined />,
      label: "导入规则",
    },
    {
      key: "ai-filling",
      icon: <ThunderboltFilled />,
      label: "AI填单",
    },
    {
      key: "workflow",
      icon: <SwapOutlined />,
      label: "流程设置",
    },
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case "business-rule":
        return <BusinessRuleSettings formId={formId} appId={appId} />;
      case "field-permission":
        return <FieldPermissionSettings formId={formId} />;
      case "data-summary":
        return <DataSummarySettings formId={formId} />;
      case "submit-validation":
        return <SubmitValidationSettings formId={formId} />;
      case "message-reminder":
        return <MessageReminderSettings formId={formId} />;
      case "associated-list":
        return <AssociatedListSettings formId={formId} />;
      case "external-link":
        return <ExternalLinkSettings formId={formId} />;
      case "print-template":
        return <PrintTemplateSettings formId={formId} />;
      case "function-buttons":
        return <FunctionButtonsSettings formId={formId} />;
      case "automation":
        return <AutomationSettings formId={formId} />;
      case "import-rules":
        return <ImportRulesSettings formId={formId} />;
      case "ai-filling":
        return <AIFillingSettings formId={formId} />;
      case "workflow":
        return <WorkflowSettings formId={formId} />;
      default:
        return (
          <Empty
            description="请选择左侧菜单项"
            style={{ marginTop: 100 }}
          />
        );
    }
  };

  return (
    <Layout style={{ height: "100%", background: "#fff" }}>
      {isMobile ? (
        <>
          <div style={{ padding: 12, borderBottom: "1px solid #f0f0f0" }}>
            <Select
              value={selectedKey}
              onChange={(v) => setSelectedKey(String(v))}
              style={{ width: "100%" }}
              options={(menuItems || [])
                .filter((x: any) => x && typeof x === "object" && "key" in x)
                .map((x: any) => ({ value: x.key, label: x.label }))}
            />
          </div>
          <Content
            style={{
              padding: 0,
              overflow: "hidden",
              background: "#fff",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {renderContent()}
          </Content>
        </>
      ) : (
        <>
          <Sider
            width={200}
            style={{
              background: "#fff",
              borderRight: "1px solid #f0f0f0",
              height: "100%",
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={[selectedKey]}
              items={menuItems}
              style={{ border: "none", height: "100%" }}
              onClick={({ key }) => setSelectedKey(key as string)}
            />
          </Sider>
          <Content
            style={{
              padding: 0,
              overflow: "hidden",
              background: "#fff",
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {renderContent()}
          </Content>
        </>
      )}
    </Layout>
  );
};

// 具体操作配置组件
const SpecificOperationsConfig: React.FC<{
  form: any;
  formId?: string;
  formsList: any[];
  currentFormSchema: any;
}> = ({ form, formId, formsList, currentFormSchema }) => {
  const [operations, setOperations] = useState<Array<{
    id: string;
    targetFormField?: string;
    operator?: string;
    valueType?: string;
    value?: string;
    currentFormField?: string;
  }>>([]);

  const [targetFormId, setTargetFormId] = useState<string>();
  const [operationMethod, setOperationMethod] = useState<string>();

  // 使用 useEffect 和 form 实例来监听字段变化
  useEffect(() => {
    const updateFields = () => {
      const targetForm = form.getFieldValue("targetForm");
      const operation = form.getFieldValue("operationMethod");
      const specificOps = form.getFieldValue("specificOperations") || [];
      setTargetFormId(targetForm);
      setOperationMethod(operation);
      // 同步表单字段到状态（只在表单字段有值且状态为空时更新，避免覆盖用户操作）
      if (Array.isArray(specificOps) && specificOps.length > 0) {
        setOperations((prevOps) => {
          // 如果状态为空或长度不同，则更新
          if (prevOps.length === 0 || prevOps.length !== specificOps.length) {
            return specificOps;
          }
          return prevOps;
        });
      }
    };

    // 初始值
    updateFields();

    // 使用表单的字段变化监听（通过依赖注入的方式）
    const unsubscribe = form.getInternalHooks?.("HOOKS")?.useWatch?.();
    
    // 如果没有内置监听，则使用轮询（不推荐，但作为后备方案）
    const interval = setInterval(updateFields, 300);
    return () => clearInterval(interval);
  }, [form]);

  // 获取目标表单的字段列表
  const { data: targetFormDefinition } = useQuery({
    queryKey: ["targetFormDefinition", targetFormId],
    queryFn: () => formDefinitionApi.getById(targetFormId!),
    enabled: !!targetFormId,
  });

  const targetFormFields = targetFormDefinition?.config?.fields || [];
  const currentFormFields = currentFormSchema?.fields || [];

  // 操作方式名称映射
  const operationMethodNames: Record<string, string> = {
    onlyUpdate: "仅更新数据",
    onlyInsert: "仅插入数据",
    updateAndInsert: "更新和插入数据",
    onlyDelete: "仅删除数据",
    appendFiles: "仅在附件控件中追加文件",
    overwriteFiles: "仅在附件控件中覆盖文件",
    removeFiles: "仅在附件控件中移除指定文件",
    clearFiles: "仅在附件控件中清空文件",
  };

  const handleAddOperation = () => {
    const newOperation = {
      id: `op_${Date.now()}`,
      targetFormField: undefined,
      operator: "equals",
      valueType: "dynamic",
      value: undefined,
      currentFormField: undefined,
      calculationType: "overwrite", // 累加或覆盖，默认覆盖
    };
    const newOperations = [...operations, newOperation];
    setOperations(newOperations);
    form.setFieldValue("specificOperations", newOperations);
  };

  const handleRemoveOperation = (id: string) => {
    const newOperations = operations.filter((op) => op.id !== id);
    setOperations(newOperations);
    form.setFieldValue("specificOperations", newOperations);
  };

  const handleOperationChange = (id: string, field: string, value: any) => {
    const newOperations = operations.map((op) =>
      op.id === id ? { ...op, [field]: value } : op
    );
    setOperations(newOperations);
    form.setFieldValue("specificOperations", newOperations);
  };

  if (!operationMethod) {
    return null;
  }

  // 添加匹配条件
  const handleAddMatchCondition = () => {
    const newOperation = {
      id: `match_${Date.now()}`,
      targetFormField: undefined,
      operator: "equals",
      valueType: "dynamic",
      value: undefined,
      currentFormField: undefined,
      calculationType: "overwrite",
      operationType: "match", // 标记为匹配条件
    };
    const newOperations = [...operations, newOperation];
    setOperations(newOperations);
    form.setFieldValue("specificOperations", newOperations);
  };

  // 添加字段映射
  const handleAddFieldMapping = () => {
    const newOperation = {
      id: `mapping_${Date.now()}`,
      targetFormField: undefined,
      operator: "equals",
      valueType: "dynamic",
      value: undefined,
      currentFormField: undefined,
      calculationType: "overwrite",
      operationType: "mapping", // 标记为字段映射
    };
    const newOperations = [...operations, newOperation];
    setOperations(newOperations);
    form.setFieldValue("specificOperations", newOperations);
  };

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Text strong>具体操作</Text>
          <Text style={{ color: "#999", marginLeft: 8 }}>
            对数据的具体操作-{operationMethodNames[operationMethod] || operationMethod}
          </Text>
        </div>
        <Space>
          {/* 需要匹配条件的操作方式 */}
          {(operationMethod === "onlyUpdate" || 
            operationMethod === "updateAndInsert" || 
            operationMethod === "onlyDelete" || 
            operationMethod === "forEachSubtable") && (
            <Button type="link" icon={<PlusOutlined />} onClick={handleAddMatchCondition}>
              添加匹配条件
            </Button>
          )}
          {/* 需要字段映射的操作方式 */}
          {(operationMethod === "onlyUpdate" || 
            operationMethod === "onlyInsert" || 
            operationMethod === "updateAndInsert" || 
            operationMethod === "forEachSubtable") && (
            <Button type="link" icon={<PlusOutlined />} onClick={handleAddFieldMapping}>
              添加字段映射
            </Button>
          )}
        </Space>
      </div>

      {operations.length === 0 && (
        <div
          style={{
            border: "1px dashed #d9d9d9",
            borderRadius: 4,
            padding: "24px",
            textAlign: "center",
            color: "#999",
          }}
        >
          点击"添加操作"按钮添加字段映射规则
        </div>
      )}

      {operations.map((operation, index) => {
        // 根据operationType判断，如果没有则根据索引判断（兼容旧数据）
        // 对于 forEachSubtable，第一个是匹配条件，后续是字段映射
        // 对于其他操作方式，根据 operationType 判断
        const isMatchCondition = operation.operationType === "match" || 
          (operationMethod === "forEachSubtable" && index === 0 && !operation.operationType) ||
          ((operationMethod === "onlyUpdate" || operationMethod === "updateAndInsert" || operationMethod === "onlyDelete") && 
           operation.operationType !== "mapping" && !operation.operationType);
        const isFieldMapping = operation.operationType === "mapping" || 
          (operationMethod === "forEachSubtable" && index > 0 && !operation.operationType) ||
          ((operationMethod === "onlyUpdate" || operationMethod === "onlyInsert" || operationMethod === "updateAndInsert") && 
           operation.operationType !== "match" && !operation.operationType);
        
        return (
          <div
            key={operation.id}
            style={{
              border: "1px solid #f0f0f0",
              borderRadius: 4,
              padding: 16,
              marginBottom: 12,
              backgroundColor: "#fafafa",
            }}
          >
            {/* 操作类型标签 */}
            <div style={{ marginBottom: 8, fontSize: 12, color: "#666" }}>
              {isMatchCondition ? (
                <Tag color="blue">匹配条件</Tag>
              ) : isFieldMapping ? (
                <Tag color="green">字段映射</Tag>
              ) : (
                <Tag>操作 {index + 1}</Tag>
              )}
            </div>
            
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Select
                placeholder="选择目标表单字段"
                style={{ flex: 1, minWidth: 200 }}
                value={operation.targetFormField}
                onChange={(value) => {
                  handleOperationChange(operation.id, "targetFormField", value);
                  // 当目标字段改变时，如果当前是固定值模式，清空固定值（让用户重新选择）
                  if (operation.valueType === "static") {
                    handleOperationChange(operation.id, "value", undefined);
                  }
                }}
              >
                {targetFormFields
                  .filter((field: any) => field.type !== "button" && field.type !== "description")
                  .map((field: any) => (
                    <Option key={field.fieldId} value={field.fieldId}>
                      {targetFormDefinition?.formName || "目标表单"}.{field.label}
                    </Option>
                  ))}
              </Select>

              <span>值</span>

              {/* 匹配条件：显示操作符选择 */}
              {isMatchCondition && (
                <Select
                  style={{ width: 100 }}
                  value={operation.operator || "equals"}
                  onChange={(value) => handleOperationChange(operation.id, "operator", value)}
                >
                  <Option value="equals">等于</Option>
                  <Option value="notEquals">不等于</Option>
                  <Option value="greaterThan">大于</Option>
                  <Option value="lessThan">小于</Option>
                  <Option value="contains">包含</Option>
                </Select>
              )}

              {/* 字段映射：显示计算方式选择（累加/覆盖/减少/更新） */}
              {isFieldMapping && (
                <Select
                  style={{ width: 120 }}
                  value={operation.calculationType || "overwrite"}
                  onChange={(value) => handleOperationChange(operation.id, "calculationType", value)}
                >
                  <Option value="accumulate">累加</Option>
                  <Option value="subtract">减少</Option>
                  <Option value="overwrite">覆盖</Option>
                  <Option value="update">更新</Option>
                </Select>
              )}

              {/* 非遍历子表模式：显示操作符 */}
              {!isMatchCondition && !isFieldMapping && (
                <Select
                  style={{ width: 100 }}
                  value={operation.operator || "equals"}
                  onChange={(value) => handleOperationChange(operation.id, "operator", value)}
                >
                  <Option value="equals">等于</Option>
                  <Option value="notEquals">不等于</Option>
                  <Option value="greaterThan">大于</Option>
                  <Option value="lessThan">小于</Option>
                  <Option value="contains">包含</Option>
                </Select>
              )}

              <Select
                style={{ width: 120 }}
                value={operation.valueType || "dynamic"}
                onChange={(value) => {
                  // 先更新 valueType
                  const updatedOps = operations.map((op) =>
                    op.id === operation.id 
                      ? { 
                          ...op, 
                          valueType: value,
                          // 根据 valueType 清空对应的值
                          ...(value === "dynamic" 
                            ? { value: undefined } 
                            : { currentFormField: undefined })
                        } 
                      : op
                  );
                  setOperations(updatedOps);
                  form.setFieldValue("specificOperations", updatedOps);
                }}
              >
                <Option value="dynamic">动态值</Option>
                <Option value="static">固定值</Option>
              </Select>

              {(operation.valueType || "dynamic") === "dynamic" ? (
                <Select
                  placeholder="选择当前表单字段"
                  style={{ flex: 1, minWidth: 200 }}
                  value={operation.currentFormField}
                  onChange={(value) => handleOperationChange(operation.id, "currentFormField", value)}
                  showSearch
                  filterOption={(input, option) => {
                    const label = option?.label ?? option?.children ?? "";
                    return String(label).toLowerCase().includes(input.toLowerCase());
                  }}
                >
                  {currentFormFields
                    .filter((field: any) => field.type !== "button" && field.type !== "description")
                    .map((field: any) => {
                      // 如果是子表字段，显示子表的列
                      if (field.type === "subtable" && field.subtableFields && Array.isArray(field.subtableFields)) {
                        return (
                          <OptGroup key={field.fieldId} label={`${currentFormSchema?.formName || "当前表单"}.${field.label}`}>
                            {field.subtableFields.map((col: any) => (
                              <Option 
                                key={`${field.fieldId}.${col.fieldId}`} 
                                value={`${field.fieldId}.${col.fieldId}`}
                                label={`${field.label}.${col.label}（子表）`}
                              >
                                {field.label}.{col.label}（子表）
                              </Option>
                            ))}
                          </OptGroup>
                        );
                      }
                      return (
                        <Option 
                          key={field.fieldId} 
                          value={field.fieldId}
                          label={`${currentFormSchema?.formName || "当前表单"}.${field.label}`}
                        >
                          {currentFormSchema?.formName || "当前表单"}.{field.label}
                        </Option>
                      );
                    })}
                </Select>
              ) : (
                (() => {
                  // 获取目标字段信息
                  const targetField = targetFormFields.find((f: any) => f.fieldId === operation.targetFormField);
                  
                  // 如果目标字段未选择，显示文本输入框
                  if (!targetField || !operation.targetFormField) {
                    return (
                      <Input
                        placeholder="请先选择目标表单字段"
                        style={{ flex: 1, minWidth: 200 }}
                        value={operation.value || ""}
                        onChange={(e) => handleOperationChange(operation.id, "value", e.target.value)}
                        disabled={!operation.targetFormField}
                      />
                    );
                  }
                  
                  // 调试信息：输出目标字段信息
                  console.log('目标字段信息:', {
                    fieldId: targetField.fieldId,
                    type: targetField.type,
                    label: targetField.label,
                    options: targetField.options,
                    optionsLength: targetField.options?.length
                  });
                  
                  const isSelectType = targetField.type === "select" || 
                                      targetField.type === "radio" || 
                                      targetField.type === "multiselect" || 
                                      targetField.type === "checkbox";
                  
                  // 如果是单选/多选/下拉类型，且有选项配置，显示选项选择器
                  if (isSelectType) {
                    // 检查是否有选项配置
                    if (targetField.options && Array.isArray(targetField.options) && targetField.options.length > 0) {
                      // 确保选项数据格式正确
                      const validOptions = targetField.options.filter((opt: any) => opt && (opt.value !== undefined || opt.label !== undefined));
                      
                      if (validOptions.length > 0) {
                        console.log('显示选项选择器，选项数量:', validOptions.length);
                        return (
                          <Select
                            placeholder="选择固定值"
                            style={{ flex: 1, minWidth: 200 }}
                            value={operation.value !== undefined && operation.value !== null ? String(operation.value) : undefined}
                            onChange={(value) => {
                              console.log('选择了固定值:', value);
                              handleOperationChange(operation.id, "value", value);
                            }}
                            showSearch
                            allowClear
                            notFoundContent="暂无选项"
                            filterOption={(input, option) => {
                              const label = option?.label ?? option?.children ?? "";
                              return String(label).toLowerCase().includes(input.toLowerCase());
                            }}
                          >
                            {validOptions.map((opt: any, idx: number) => {
                              const optValue = opt.value !== undefined ? String(opt.value) : String(opt.label || `option_${idx}`);
                              const optLabel = opt.label || opt.value || optValue;
                              return (
                                <Option key={optValue} value={optValue}>
                                  {optLabel}
                                </Option>
                              );
                            })}
                          </Select>
                        );
                      } else {
                        console.log('选项数据无效，有效选项数量为0');
                      }
                    } else {
                      console.log('目标字段没有选项配置或选项为空');
                    }
                    // 如果是选择类型但没有选项配置，显示提示信息
                    return (
                      <Input
                        placeholder="该字段未配置选项，请输入固定值"
                        style={{ flex: 1, minWidth: 200 }}
                        value={operation.value || ""}
                        onChange={(e) => handleOperationChange(operation.id, "value", e.target.value)}
                      />
                    );
                  }
                  
                  // 其他类型，显示文本输入框
                  console.log('目标字段不是选择类型，类型为:', targetField.type);
                  return (
                    <Input
                      placeholder="输入固定值"
                      style={{ flex: 1, minWidth: 200 }}
                      value={operation.value || ""}
                      onChange={(e) => handleOperationChange(operation.id, "value", e.target.value)}
                    />
                  );
                })()
              )}

              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleRemoveOperation(operation.id)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

// 函数列表面板组件（用于高级模式）
const FunctionListPanel: React.FC<{
  onInsertFunction: (func: string) => void;
  searchText?: string;
}> = ({ onInsertFunction, searchText: externalSearchText }) => {
  const [internalSearchText, setInternalSearchText] = useState("");
  const searchText = externalSearchText !== undefined ? externalSearchText : internalSearchText;
  const [activePanel, setActivePanel] = useState<string | string[]>(["advanced"]);

  const functionCategories = [
    {
      key: "math",
      label: "数学函数",
      functions: ["ABS", "ROUND", "CEIL", "FLOOR", "MAX", "MIN", "SUM", "AVG"],
    },
    {
      key: "time",
      label: "时间函数",
      functions: ["NOW", "TODAY", "YEAR", "MONTH", "DAY", "DATEDIFF", "DATEADD"],
    },
    {
      key: "logic",
      label: "逻辑函数",
      functions: ["IF", "AND", "OR", "NOT", "ISNULL", "ISEMPTY"],
    },
    {
      key: "advanced",
      label: "高级函数",
      functions: [
        { name: "INSERT", desc: "向目标表单新增数据" },
        { name: "UPDATE", desc: "更新目标表单数据" },
        { name: "UPSERT", desc: "更新或插入数据" },
        { name: "DELETE", desc: "删除目标表单数据" },
        { name: "ADDFILE", desc: "添加附件" },
        { name: "REMOVEFILE", desc: "移除附件" },
      ],
    },
    {
      key: "other",
      label: "其他函数",
      functions: ["CONCAT", "SUBSTRING", "LENGTH", "UPPER", "LOWER", "TRIM"],
    },
  ];

  const handleFunctionClick = (func: string | { name: string; desc: string }) => {
    const funcName = typeof func === "string" ? func : func.name;
    onInsertFunction(funcName);
  };

  const filteredCategories = functionCategories.map((category) => ({
    ...category,
    functions:
      typeof category.functions[0] === "string"
        ? (category.functions as string[]).filter((f) =>
            f.toLowerCase().includes(searchText.toLowerCase())
          )
        : (category.functions as Array<{ name: string; desc: string }>).filter((f) =>
            f.name.toLowerCase().includes(searchText.toLowerCase())
          ),
  }));

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#fff" }}>
      {externalSearchText === undefined && (
        <>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Text strong>函数列表</Text>
          </div>
          <Input
            placeholder="搜索函数"
            prefix={<SearchOutlined />}
            value={internalSearchText}
            onChange={(e) => setInternalSearchText(e.target.value)}
            style={{ marginBottom: 16 }}
            allowClear
          />
        </>
      )}
      <Collapse
        activeKey={activePanel}
        onChange={setActivePanel}
        ghost
      >
        {filteredCategories.map((category) => (
          <Panel header={category.label} key={category.key}>
            {category.functions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {category.functions.map((func) => {
                  if (typeof func === "string") {
                    return (
                      <Button
                        key={func}
                        type="text"
                        block
                        style={{ textAlign: "left", height: "auto", padding: "4px 8px" }}
                        onClick={() => handleFunctionClick(func)}
                      >
                        {func}
                      </Button>
                    );
                  } else {
                    return (
                      <div
                        key={func.name}
                        style={{
                          padding: "8px",
                          borderRadius: 4,
                          border: "1px solid #f0f0f0",
                          cursor: "pointer",
                          marginBottom: 4,
                        }}
                        onClick={() => handleFunctionClick(func)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f5f5f5";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#fff";
                        }}
                      >
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{func.name}</div>
                        <div style={{ fontSize: 12, color: "#999" }}>{func.desc}</div>
                      </div>
                    );
                  }
                })}
              </div>
            ) : (
              <Empty description="未找到匹配的函数" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Panel>
        ))}
      </Collapse>
    </div>
  );
};

// 函数列表侧边栏组件（独立Drawer，用于其他场景）
const FunctionListDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  onInsertFunction: (func: string) => void;
}> = ({ open, onClose, onInsertFunction }) => {
  const [searchText, setSearchText] = useState("");
  const [activePanel, setActivePanel] = useState<string | string[]>(["advanced"]);

  const functionCategories = [
    {
      key: "math",
      label: "数学函数",
      functions: ["ABS", "ROUND", "CEIL", "FLOOR", "MAX", "MIN", "SUM", "AVG"],
    },
    {
      key: "time",
      label: "时间函数",
      functions: ["NOW", "TODAY", "YEAR", "MONTH", "DAY", "DATEDIFF", "DATEADD"],
    },
    {
      key: "logic",
      label: "逻辑函数",
      functions: ["IF", "AND", "OR", "NOT", "ISNULL", "ISEMPTY"],
    },
    {
      key: "advanced",
      label: "高级函数",
      functions: [
        { name: "INSERT", desc: "向目标表单新增数据" },
        { name: "UPDATE", desc: "更新目标表单数据" },
        { name: "UPSERT", desc: "更新或插入数据" },
        { name: "DELETE", desc: "删除目标表单数据" },
        { name: "ADDFILE", desc: "添加附件" },
        { name: "REMOVEFILE", desc: "移除附件" },
      ],
    },
    {
      key: "other",
      label: "其他函数",
      functions: ["CONCAT", "SUBSTRING", "LENGTH", "UPPER", "LOWER", "TRIM"],
    },
  ];

  const handleFunctionClick = (func: string | { name: string; desc: string }) => {
    const funcName = typeof func === "string" ? func : func.name;
    onInsertFunction(funcName);
  };

  const filteredCategories = functionCategories.map((category) => ({
    ...category,
    functions:
      typeof category.functions[0] === "string"
        ? (category.functions as string[]).filter((f) =>
            f.toLowerCase().includes(searchText.toLowerCase())
          )
        : (category.functions as Array<{ name: string; desc: string }>).filter((f) =>
            f.name.toLowerCase().includes(searchText.toLowerCase())
          ),
  }));

  return (
    <Drawer
      title="函数列表"
      placement="right"
      onClose={onClose}
      open={open}
      size={320}
      closable
      mask={false}
      style={{ position: "absolute", right: 0, top: 0, bottom: 0 }}
      extra={
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{ padding: 0, width: 24, height: 24 }}
        />
      }
    >
      <Input
        placeholder="搜索函数"
        prefix={<SearchOutlined />}
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
      />
      <Collapse
        activeKey={activePanel}
        onChange={setActivePanel}
        ghost
      >
        {filteredCategories.map((category) => (
          <Panel header={category.label} key={category.key}>
            {category.functions.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {category.functions.map((func) => {
                  if (typeof func === "string") {
                    return (
                      <Button
                        key={func}
                        type="text"
                        block
                        style={{ textAlign: "left", height: "auto", padding: "4px 8px" }}
                        onClick={() => handleFunctionClick(func)}
                      >
                        {func}
                      </Button>
                    );
                  } else {
                    return (
                      <div
                        key={func.name}
                        style={{
                          padding: "8px",
                          borderRadius: 4,
                          border: "1px solid #f0f0f0",
                          cursor: "pointer",
                          marginBottom: 4,
                        }}
                        onClick={() => handleFunctionClick(func)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#f5f5f5";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#fff";
                        }}
                      >
                        <div style={{ fontWeight: 500, marginBottom: 4 }}>{func.name}</div>
                        <div style={{ fontSize: 12, color: "#999" }}>{func.desc}</div>
                      </div>
                    );
                  }
                })}
              </div>
            ) : (
              <Empty description="未找到匹配的函数" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Panel>
        ))}
      </Collapse>
    </Drawer>
  );
};

// 业务规则设置组件
const BusinessRuleSettings: React.FC<{
  formId?: string;
  appId?: string;
}> = ({ formId, appId }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const functionCode = Form.useWatch("functionCode", form);
  const [insertPosition, setInsertPosition] = useState<number | null>(null);
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [functionDrawerVisible, setFunctionDrawerVisible] = useState(true);
  const [functionSearchText, setFunctionSearchText] = useState("");
  const [targetForms, setTargetForms] = useState<Array<{ type: string; value: string; formId?: string }>>([]);
  const [formSelectVisible, setFormSelectVisible] = useState(false);
  const [selectedTargetFormId, setSelectedTargetFormId] = useState<string | null>(null);
  const formSchema = useFormDesignerStore((state) => state.formSchema);
  const [allFormFieldLabelMap, setAllFormFieldLabelMap] = useState<Record<string, string>>({});

  // 获取应用下的表单列表
  const { data: formsList = [], isLoading: formsLoading } = useQuery({
    queryKey: ["forms", appId],
    queryFn: () => formDefinitionApi.getListByApplication(appId!),
    enabled: !!appId,
  });

  // 预加载应用内所有表单字段标签，供“执行规则”可读化展示
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!formsList || formsList.length === 0) {
        setAllFormFieldLabelMap({});
        return;
      }
      const map: Record<string, string> = {};
      (formsList || []).forEach((f: any) => {
        if (f?.formId) map[String(f.formId)] = String(f.formName || f.formId);
      });
      try {
        const defs = await Promise.all(
          (formsList || [])
            .filter((f: any) => !!f?.formId)
            .map((f: any) =>
              formDefinitionApi.getById(String(f.formId)).catch(() => null),
            ),
        );
        defs.forEach((d: any) => {
          const fields = d?.config?.fields || [];
          fields.forEach((f: any) => {
            if (f?.fieldId) {
              map[String(f.fieldId)] = String(f.label || f.fieldId);
            }
            if (f?.type === "subtable" && Array.isArray(f.subtableFields)) {
              f.subtableFields.forEach((sf: any) => {
                if (sf?.fieldId) {
                  map[String(sf.fieldId)] = `${f.label || f.fieldId}.${sf.label || sf.fieldId}`;
                }
              });
            }
          });
        });
      } catch {
        // 忽略可读化加载失败，不影响主流程
      }
      if (!cancelled) setAllFormFieldLabelMap(map);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [formsList]);

  // 获取选中的目标表单详情（用于显示字段列表）
  const { data: selectedTargetForm } = useQuery({
    queryKey: ["targetForm", selectedTargetFormId],
    queryFn: () => formDefinitionApi.getById(selectedTargetFormId!),
    enabled: !!selectedTargetFormId,
  });

  // 获取当前表单的字段列表
  const currentFormFields = formSchema?.fields || [];
  
  // 获取当前选中的目标表单（用于显示字段）
  const currentTargetForm = targetForms.find((tf) => tf.type === "form");
  const currentTargetFormId = currentTargetForm?.formId || selectedTargetFormId;
  
  // 获取当前目标表单的字段列表
  const { data: currentTargetFormDetail } = useQuery({
    queryKey: ["currentTargetForm", currentTargetFormId],
    queryFn: () => formDefinitionApi.getById(currentTargetFormId!),
    enabled: !!currentTargetFormId && !!currentTargetForm,
  });
  
  const displayTargetFormFields = currentTargetFormDetail?.config?.fields || [];

  // 获取业务规则列表
  const { data: rulesList = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["businessRules", appId, formId],
    queryFn: () => businessRuleApi.getListByApplication(appId!),
    enabled: !!appId,
  });

  // 过滤出当前表单的规则
  const currentFormRules = rulesList.filter((rule: any) => rule.trigger?.formId === formId);

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const handleOpenModal = (rule?: any) => {
    setModalVisible(true);
    form.resetFields();
    setIsAdvancedMode(false);
    setTargetForms([]);
    setFunctionDrawerVisible(false);
  };

  const handleSwitchToAdvanced = () => {
    setIsAdvancedMode(true);
    setModalVisible(false);
    setFunctionDrawerVisible(true); // 打开函数列表侧边栏
  };

  const handleCancel = () => {
    setModalVisible(false);
    form.resetFields();
    setIsAdvancedMode(false);
    setTargetForms([]);
  };

  const queryClient = useQueryClient();

  const saveRuleMutation = useMutation({
    mutationFn: async (ruleData: any) => {
      if (!appId) {
        throw new Error("缺少应用ID");
      }
      if (!formId) {
        throw new Error("缺少表单ID");
      }
      return await businessRuleApi.create(ruleData);
    },
    onSuccess: () => {
      message.success("业务规则保存成功");
      queryClient.invalidateQueries({ queryKey: ["businessRules", appId, formId] });
      setModalVisible(false);
      form.resetFields();
      setIsAdvancedMode(false);
      setTargetForms([]);
    },
    onError: (error: any) => {
      message.error(`保存失败: ${error.message || "未知错误"}`);
    },
  });

  const handleSubmit = async () => {
    try {
      if (!appId) {
        message.error("缺少应用ID，无法保存业务规则");
        return;
      }
      if (!formId) {
        message.error("缺少表单ID，无法保存业务规则");
        return;
      }

      const values = await form.validateFields();
      
      // 生成规则ID
      const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // 转换触发事件：dataEffective -> create/update, dataInvalidated -> delete, statusChange -> statusChange
      const triggerEvent = values.triggerEvent || "dataEffective";
      const backendEvent = triggerEvent === "dataEffective" ? "create" : triggerEvent === "dataInvalidated" ? "delete" : "statusChange";

      let actions: any[] = [];

      if (isAdvancedMode) {
        // 高级模式：解析函数代码
        const functionCode = values.functionCode || "";
        const targetFormObj = targetForms.find(tf => tf.type === "form");
        const targetFormId = targetFormObj?.formId || selectedTargetFormId;
        
        if (!functionCode.trim()) {
          message.error("请输入函数代码");
          return;
        }
        
        if (!targetFormId) {
          message.error("请选择目标表单");
          return;
        }

        // 构建表单名称到ID的映射，用于执行时替换
        const formNameMapping: Record<string, string> = {};
        if (targetFormObj) {
          formNameMapping[targetFormObj.value] = targetFormId;
        }
        if (formSchema?.formName && formId) {
          formNameMapping[formSchema.formName] = formId;
          formNameMapping["当前表单"] = formId;
        }

        // 保存为脚本执行类型的action
        // 确保保存目标表单ID，以便执行时能准确识别表单
        actions = [
          {
            type: "executeScript",
            targetFormId: targetFormId,
            script: functionCode,
            metadata: {
              mode: "advanced",
              targetFormId: targetFormId, // 明确保存目标表单ID
              targetFormName: targetFormObj?.value || "未命名的表单", // 保存表单名称
              formNameMapping: formNameMapping, // 保存表单名称到ID的映射
              targetForms: targetForms,
            },
          },
        ];
      } else {
        // 简单模式：根据操作方式构建actions
        const targetFormId = values.targetForm;
        const operationMethod = values.operationMethod;
        // 确保使用最新的表单字段值，如果为空则尝试从状态获取
        let operations = values.specificOperations || [];
        // 如果表单字段为空，尝试从 SpecificOperationsConfig 组件的状态获取（通过表单实例）
        if (!operations || operations.length === 0) {
          const formOps = form.getFieldValue("specificOperations");
          if (formOps && Array.isArray(formOps) && formOps.length > 0) {
            operations = formOps;
          }
        }

        if (!targetFormId) {
          message.error("请选择目标表单");
          return;
        }
        if (!operationMethod) {
          message.error("请选择操作方式");
          return;
        }

        // 分离匹配条件和字段映射
        const matchOps: any[] = [];
        const mappingOps: any[] = [];
        
        operations.forEach((op: any) => {
          if (op.operationType === "match") {
            matchOps.push(op);
          } else if (op.operationType === "mapping") {
            mappingOps.push(op);
          } else {
            // 兼容旧数据：根据操作方式判断
            if (operationMethod === "onlyUpdate" || operationMethod === "updateAndInsert" || operationMethod === "onlyDelete") {
              // 第一个是匹配条件，后续是字段映射
              if (matchOps.length === 0) {
                matchOps.push(op);
              } else {
                mappingOps.push(op);
              }
            } else {
              // 其他操作方式，都是字段映射
              mappingOps.push(op);
            }
          }
        });

        // 构建字段映射
        const fieldMapping: Record<string, string> = {};
        mappingOps.forEach((op: any) => {
          if (op.targetFormField && (op.currentFormField || op.value !== undefined)) {
            if (op.valueType === "static" && op.value !== undefined && op.value !== null) {
              // 固定值：直接使用固定值（不加引号，因为 createTargetRecord 会通过 resolveValue 处理）
              fieldMapping[op.targetFormField] = String(op.value);
            } else if (op.valueType === "dynamic" && op.currentFormField) {
              // 动态值：使用字段引用
              fieldMapping[op.targetFormField] = op.currentFormField;
            }
          }
        });
        
        // 构建字段映射字符串（固定值需要加引号）
        const buildFieldMappingStr = (fieldMapping: Record<string, string>): string => {
          return Object.entries(fieldMapping).map(([k, v]) => {
            // 如果值是字段引用（包含点号或不是引号字符串），直接使用
            // 否则作为固定值，需要加引号
            if (v.includes('.') || v.startsWith('"') || v.startsWith("'")) {
              return `${k}=${v}`;
            } else {
              // 固定值，添加引号
              return `${k}="${v}"`;
            }
          }).join(', ');
        };

        // 根据操作方式构建actions
        switch (operationMethod) {
          case "forEachSubtable":
            // 遍历子表并更新：需要从operations中提取子表字段和匹配条件
            // 分离匹配条件和字段映射（复用外部作用域的变量）
            matchOps.length = 0;
            mappingOps.length = 0;
            
            operations.forEach((op: any, index: number) => {
              if (op.operationType === "match") {
                matchOps.push(op);
              } else if (op.operationType === "mapping") {
                mappingOps.push(op);
              } else {
                // 兼容旧数据：第一个操作是匹配条件，后续是字段映射
                if (index === 0) {
                  matchOps.push(op);
                } else {
                  mappingOps.push(op);
                }
              }
            });
            
            console.log('匹配条件数量:', matchOps.length, '字段映射数量:', mappingOps.length);
            console.log('所有操作:', operations);
            
            // 验证匹配条件
            if (matchOps.length === 0) {
              message.error("请至少配置一个匹配条件");
              return;
            }
            
            // 找到第一个有效的匹配条件
            const matchOp = matchOps.find((op: any) => {
              const hasTarget = !!op.targetFormField;
              const hasCurrent = !!op.currentFormField && op.currentFormField.includes('.');
              console.log('匹配条件检查:', { hasTarget, hasCurrent, op });
              return hasTarget && hasCurrent;
            });
            
            if (!matchOp) {
              const incompleteOp = matchOps[0];
              if (!incompleteOp.targetFormField) {
                message.error("匹配条件必须选择目标表单字段");
              } else if (!incompleteOp.currentFormField) {
                message.error("匹配条件必须选择当前表单字段（子表字段）");
              } else if (!incompleteOp.currentFormField.includes('.')) {
                message.error("匹配条件必须选择子表字段（格式：子表.字段）");
              } else {
                message.error("请完善匹配条件：选择目标表单字段和子表字段");
              }
              return;
            }
            
            const [subtableFieldId, firstSubColId] = matchOp.currentFormField.split('.');
            
            // 构建匹配条件：目标表单.字段 = 子表.字段
            const matchCondition = `${targetFormId}.${matchOp.targetFormField}=${subtableFieldId}.${firstSubColId}`;
            
            // 构建字段映射
            const mappingStrs: string[] = [];
            for (const op of mappingOps) {
              if (!op.targetFormField) {
                message.error("字段映射必须选择目标表单字段");
                return;
              }
              
              // 根据值类型处理：动态值使用字段引用，固定值使用固定值
              if (op.valueType === "static" && op.value !== undefined && op.value !== null) {
                // 固定值：直接使用固定值，需要加引号
                const fixedValue = String(op.value);
                const calculationType = op.calculationType || "overwrite";
                
                if (calculationType === "accumulate") {
                  // 累加：原值 + 固定值
                  mappingStrs.push(`${op.targetFormField}=IFNULL(${targetFormId}.${op.targetFormField},0)+${fixedValue}`);
                } else if (calculationType === "subtract") {
                  // 减少：原值 - 固定值
                  mappingStrs.push(`${op.targetFormField}=IFNULL(${targetFormId}.${op.targetFormField},0)-${fixedValue}`);
                } else if (calculationType === "update") {
                  // 更新：如果原值存在则更新，否则使用固定值
                  mappingStrs.push(`${op.targetFormField}=IFNULL(${targetFormId}.${op.targetFormField},"${fixedValue}")`);
                } else {
                  // 覆盖：直接使用固定值，加引号
                  mappingStrs.push(`${op.targetFormField}="${fixedValue}"`);
                }
              } else {
                // 动态值：使用字段引用
                if (!op.currentFormField) {
                  message.error("字段映射必须选择当前表单字段（子表字段）");
                  return;
                }
                if (!op.currentFormField.includes('.')) {
                  message.error("字段映射必须选择子表字段（格式：子表.字段）");
                  return;
                }
                
                const [subFieldId, subColId] = op.currentFormField.split('.');
                if (subFieldId !== subtableFieldId) {
                  message.error(`字段映射中的子表字段 "${op.currentFormField}" 与匹配条件中的子表 "${subtableFieldId}" 不一致`);
                  return;
                }
                
                // 根据用户选择的计算方式来决定处理方式
                const calculationType = op.calculationType || "overwrite";
                
                if (calculationType === "accumulate") {
                  // 累加：原值 + 新值
                  mappingStrs.push(`${op.targetFormField}=IFNULL(${targetFormId}.${op.targetFormField},0)+${subtableFieldId}.${subColId}`);
                } else if (calculationType === "subtract") {
                  // 减少：原值 - 新值
                  mappingStrs.push(`${op.targetFormField}=IFNULL(${targetFormId}.${op.targetFormField},0)-${subtableFieldId}.${subColId}`);
                } else if (calculationType === "update") {
                  // 更新：如果原值存在则更新，否则使用新值
                  mappingStrs.push(`${op.targetFormField}=IFNULL(${targetFormId}.${op.targetFormField},${subtableFieldId}.${subColId})`);
                } else {
                  // 覆盖：直接使用新值
                  mappingStrs.push(`${op.targetFormField}=${subtableFieldId}.${subColId}`);
                }
              }
            }
            
            if (mappingStrs.length === 0) {
              message.error("请至少配置一个字段映射，并确保选择了目标表单字段和子表字段");
              return;
            }
            
            // 构建 FOR_EACH 脚本
            const forEachScript = `FOR_EACH(${subtableFieldId}, UPSERT(${targetFormId}, ${matchCondition}, ${mappingStrs.join(', ')}))`;
            
            console.log('生成的FOR_EACH脚本:', forEachScript);
            
            actions = [
              {
                type: "executeScript",
                targetFormId: targetFormId,
                script: forEachScript,
                metadata: {
                  mode: "simple",
                  operationMethod: operationMethod,
                  subtableFieldId: subtableFieldId,
                  operations: operations, // 保存原始操作配置，便于调试
                },
              },
            ];
            break;
          case "onlyUpdate":
            // 需要匹配条件来找到要更新的记录
            if (matchOps.length === 0) {
              message.error("仅更新数据需要至少配置一个匹配条件");
              return;
            }
            if (mappingOps.length === 0) {
              message.error("仅更新数据需要至少配置一个字段映射");
              return;
            }
            // 构建匹配条件字符串（简单处理：第一个匹配条件）
            const updateMatchCondition = matchOps[0]?.targetFormField && matchOps[0]?.currentFormField
              ? `${targetFormId}.${matchOps[0].targetFormField}=${matchOps[0].currentFormField}`
              : undefined;
            actions = [
              {
                type: "executeScript",
                targetFormId: targetFormId,
                script: updateMatchCondition 
                  ? `UPDATE(${targetFormId}, ${updateMatchCondition}, ${buildFieldMappingStr(fieldMapping)})`
                  : `UPDATE(${targetFormId}, ${buildFieldMappingStr(fieldMapping)})`,
                metadata: {
                  mode: "simple",
                  operationMethod: operationMethod,
                  matchConditions: matchOps,
                  fieldMappings: mappingOps,
                },
              },
            ];
            break;
          case "onlyInsert":
            actions = [
              {
                type: "createRecord",
                targetFormId: targetFormId,
                fieldMapping: fieldMapping,
              },
            ];
            break;
          case "updateAndInsert":
            // 需要匹配条件来找到要更新的记录
            if (matchOps.length === 0) {
              message.error("更新和插入数据需要至少配置一个匹配条件");
              return;
            }
            if (mappingOps.length === 0) {
              message.error("更新和插入数据需要至少配置一个字段映射");
              return;
            }
            // 构建匹配条件字符串
            const upsertMatchCondition = matchOps[0]?.targetFormField && matchOps[0]?.currentFormField
              ? `${targetFormId}.${matchOps[0].targetFormField}=${matchOps[0].currentFormField}`
              : undefined;
            actions = [
              {
                type: "executeScript",
                targetFormId: targetFormId,
                script: upsertMatchCondition
                  ? `UPSERT(${targetFormId}, ${upsertMatchCondition}, ${buildFieldMappingStr(fieldMapping)})`
                  : `UPSERT(${targetFormId}, ${buildFieldMappingStr(fieldMapping)})`,
                metadata: {
                  mode: "simple",
                  operationMethod: operationMethod,
                  matchConditions: matchOps,
                  fieldMappings: mappingOps,
                },
              },
            ];
            break;
          case "onlyDelete":
            // 需要匹配条件来找到要删除的记录
            if (matchOps.length === 0) {
              message.error("仅删除数据需要至少配置一个匹配条件");
              return;
            }
            // 构建匹配条件字符串
            const deleteMatchCondition = matchOps[0]?.targetFormField && matchOps[0]?.currentFormField
              ? `${targetFormId}.${matchOps[0].targetFormField}=${matchOps[0].currentFormField}`
              : undefined;
            actions = [
              {
                type: "executeScript",
                targetFormId: targetFormId,
                script: deleteMatchCondition
                  ? `DELETE(${targetFormId}, ${deleteMatchCondition})`
                  : `DELETE(${targetFormId})`,
                metadata: {
                  mode: "simple",
                  operationMethod: operationMethod,
                  matchConditions: matchOps,
                },
              },
            ];
            break;
          case "appendFiles":
          case "overwriteFiles":
          case "removeFiles":
          case "clearFiles":
            // 附件操作暂时保存为脚本
            actions = [
              {
                type: "executeScript",
                targetFormId: targetFormId,
                script: `// ${operationMethod}操作`,
                metadata: {
                  mode: "simple",
                  operationMethod: operationMethod,
                  fieldMapping: fieldMapping,
                },
              },
            ];
            break;
          default:
            message.error(`不支持的操作方式: ${operationMethod}`);
            return;
        }
      }

      // 构建业务规则数据
      const ruleData = {
        ruleId: ruleId,
        ruleName: values.ruleName || `${formSchema.formName || "表单"}的${triggerEvent === "dataEffective" ? "数据生效" : triggerEvent === "dataInvalidated" ? "数据作废" : "流程状态变化"}规则`,
        description: values.remark || "",
        enabled: true,
        applicationId: appId,
        trigger: {
          event: backendEvent,
          formId: formId,
          conditions: [],
        },
        actions: actions,
        priority: 0,
        metadata: {
          triggerEvent: triggerEvent,
          isAdvancedMode: isAdvancedMode,
          ...(isAdvancedMode ? {} : { operationMethod: values.operationMethod }),
        },
      };

      await saveRuleMutation.mutateAsync(ruleData);
    } catch (error: any) {
      console.error("业务规则保存失败:", error);
      if (error?.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(`保存失败: ${error.message || "未知错误"}`);
    }
  };

  const functionTextAreaRef = useRef<any>(null);

  // 插入字段到函数代码
  const handleInsertField = (fieldPath: string) => {
    const getTextarea = () => {
      const ref = functionTextAreaRef.current;
      if (!ref) return null;
      if (ref.resizableTextArea?.textArea) {
        return ref.resizableTextArea.textArea;
      }
      if (ref instanceof HTMLTextAreaElement) {
        return ref;
      }
      return null;
    };
    
    const textarea = getTextarea();
    if (!textarea) {
      // 如果获取不到textarea，直接追加到表单值
      const currentValue = functionCode || form.getFieldValue("functionCode") || "";
      form.setFieldValue("functionCode", currentValue + (currentValue ? " " : "") + fieldPath);
      return;
    }
    
    // 确保TextArea有焦点
    textarea.focus();
    
    // 使用TextArea的实际值，而不是表单值
    const currentValue = textarea.value || "";
    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;
    
    // 在光标位置插入字段路径
    const beforeCursor = currentValue.substring(0, start);
    const afterCursor = currentValue.substring(end);
    const newCode = beforeCursor + fieldPath + afterCursor;
    
    // 直接更新TextArea的值
    textarea.value = newCode;
    
    // 更新表单值以保持同步
    form.setFieldValue("functionCode", newCode);
    
    // 触发input事件，确保Form.Item也能收到更新
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);
    const changeEvent = new Event('change', { bubbles: true });
    textarea.dispatchEvent(changeEvent);
    
    // 设置光标位置
    const newPosition = start + fieldPath.length;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleInsertFunction = (funcName: string) => {
    const getTextarea = () => {
      const ref = functionTextAreaRef.current;
      if (!ref) return null;
      if (ref.resizableTextArea?.textArea) {
        return ref.resizableTextArea.textArea;
      }
      if (ref instanceof HTMLTextAreaElement) {
        return ref;
      }
      return null;
    };
    
    const textarea = getTextarea();
    if (!textarea) {
      // 如果获取不到textarea，直接追加到表单值
      const currentValue = functionCode || form.getFieldValue("functionCode") || "";
      form.setFieldValue("functionCode", currentValue + (currentValue ? " " : "") + funcName + "()");
      return;
    }
    
    // 确保TextArea有焦点
    textarea.focus();
    
    // 使用TextArea的实际值，而不是表单值
    const currentValue = textarea.value || "";
    const start = textarea.selectionStart ?? currentValue.length;
    const end = textarea.selectionEnd ?? currentValue.length;
    
    // 在光标位置插入函数名
    const beforeCursor = currentValue.substring(0, start);
    const afterCursor = currentValue.substring(end);
    const newCode = beforeCursor + funcName + "()" + afterCursor;
    
    // 先更新表单值（这会触发React重新渲染）
    form.setFieldValue("functionCode", newCode);
    
    // 等待React更新后，设置光标位置并触发事件
    setTimeout(() => {
      const textareaEl = getTextarea();
      if (textareaEl) {
        const newPosition = start + funcName.length + 2; // +2 for "()"
        textareaEl.focus();
        textareaEl.setSelectionRange(newPosition, newPosition);
      }
    }, 50);
  };

  // 删除规则
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      if (!appId) throw new Error("缺少应用ID");
      await businessRuleApi.delete(appId, ruleId);
    },
    onSuccess: () => {
      message.success("规则删除成功");
      queryClient.invalidateQueries({ queryKey: ["businessRules", appId, formId] });
    },
  });

  // 格式化执行规则显示
  const formatExecutionRule = (rule: any) => {
    const humanizeScript = (raw: string) => {
      if (!raw) return raw;
      const mapping = new Map<string, string>();
      Object.entries(allFormFieldLabelMap || {}).forEach(([k, v]) => {
        mapping.set(String(k), String(v));
      });
      (currentFormFields || []).forEach((f: any) => {
        if (f?.fieldId) mapping.set(String(f.fieldId), String(f.label || f.fieldId));
        if (f?.type === "subtable" && Array.isArray(f.subtableFields)) {
          f.subtableFields.forEach((sf: any) => {
            if (sf?.fieldId) mapping.set(String(sf.fieldId), `${f.label || f.fieldId}.${sf.label || sf.fieldId}`);
          });
        }
      });
      let text = String(raw);
      const ids = Array.from(mapping.keys()).sort((a, b) => b.length - a.length);
      ids.forEach((id) => {
        const label = mapping.get(id) || id;
        text = text.replaceAll(id, label);
      });

      // 兜底：规则字符串里残余的 field_xxx / subfield_xxx 再做一次替换
      text = text.replace(
        /(subfield_[A-Za-z0-9_]+|field_[A-Za-z0-9_]+)/g,
        (token) => mapping.get(token) || token,
      );

      return text;
    };

    if (rule.actions && rule.actions.length > 0) {
      const action = rule.actions[0];
      if (action.type === "executeScript" && action.script) {
        return humanizeScript(action.script);
      }
      // 简单模式：根据操作类型和字段映射构建显示文本
      if (action.type === "updateRecord" || action.type === "createRecord") {
        const fieldMappings: string[] = [];
        if (action.fieldMapping) {
          Object.entries(action.fieldMapping).forEach(([targetField, sourceField]) => {
            fieldMappings.push(`${targetField} = ${sourceField}`);
          });
        }
        const operation = action.type === "updateRecord" ? "UPDATE" : "INSERT";
        const targetFormName = getTargetFormName(rule);
        if (fieldMappings.length > 0) {
          return `${operation}(${targetFormName}, ${fieldMappings.join(", ")})`;
        }
        return `${operation}(${targetFormName})`;
      }
      if (action.type === "deleteRecord") {
        const targetFormName = getTargetFormName(rule);
        return `DELETE(${targetFormName})`;
      }
    }
    return "";
  };

  // 获取操作方式文本
  const getOperationMethodText = (rule: any) => {
    if (rule.metadata?.operationMethod) {
      const methodMap: Record<string, string> = {
        onlyUpdate: "仅更新数据",
        onlyInsert: "仅插入数据",
        updateAndInsert: "更新和插入数据",
        forEachSubtable: "遍历子表并更新",
        onlyDelete: "仅删除数据",
        appendFiles: "仅在附件控件中追加文件",
        overwriteFiles: "仅在附件控件中覆盖文件",
        removeFiles: "仅在附件控件中移除指定文件",
        clearFiles: "仅在附件控件中清空文件",
      };
      return methodMap[rule.metadata.operationMethod] || rule.metadata.operationMethod;
    }
    return "";
  };

  // 获取目标表单名称
  const getTargetFormName = (rule: any) => {
    if (rule.actions && rule.actions.length > 0) {
      const action = rule.actions[0];
      // 优先使用metadata中保存的表单名称
      if (action.metadata?.targetFormName) {
        return action.metadata.targetFormName;
      }
      // 如果没有保存名称，尝试从表单列表中查找
      if (action.targetFormId) {
        const targetForm = formsList.find((f: any) => f.formId === action.targetFormId);
        if (targetForm) {
          return targetForm.formName || "未命名的表单";
        }
        return "未命名的表单";
      }
    }
    return "未命名的表单";
  };

  // 获取触发事件文本
  const getTriggerEventText = (rule: any) => {
    if (rule.metadata?.triggerEvent === "dataInvalidated") {
      return "数据作废时";
    }
    if (rule.metadata?.triggerEvent === "statusChange" || rule.trigger?.event === "statusChange") {
      return "流程状态变化时";
    }
    return "数据生效时";
  };

  return (
    <>
      <SettingsPageLayout title="业务规则">
        <Card style={{ height: "100%", display: "flex", flexDirection: "column", padding: 0 }}>
          {/* 顶部按钮栏 */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 14, color: "#666" }}>
              说明：当数据生效或者作废时可对目标表数据进行新增/更新/删除操作
            </div>
            <Space>
              <Button>执行日志</Button>
              <Button type="primary" onClick={() => handleOpenModal()}>新建规则</Button>
            </Space>
          </div>

          {/* 规则列表 */}
          <div style={{ flex: 1, padding: 24, overflow: "auto" }}>
            {currentFormRules.length === 0 ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
                <Empty
                  description="您还没添加任何业务规则"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={() => handleOpenModal()}>立即设置</Button>
                </Empty>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {currentFormRules.map((rule: any, index: number) => (
                  <Card
                    key={rule.ruleId}
                    style={{ border: "1px solid #f0f0f0" }}
                    styles={{ body: { padding: 16 } }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
                      <div style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f0f0f0", borderRadius: 4, flexShrink: 0 }}>
                        {index + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <Space orientation="vertical" size={8} style={{ width: "100%" }}>
                          <div>
                            <Text type="secondary">触发事件：</Text>
                            <Text>{getTriggerEventText(rule)}</Text>
                          </div>
                          <div>
                            <Text type="secondary">目标表单：</Text>
                            <Text>{getTargetFormName(rule)}</Text>
                          </div>
                          {rule.metadata?.operationMethod && (
                            <div>
                              <Text type="secondary">操作方式：</Text>
                              <Text>{getOperationMethodText(rule)}</Text>
                            </div>
                          )}
                          <div>
                            <Text type="secondary">执行规则：</Text>
                            <Text code style={{ fontSize: 13 }}>{formatExecutionRule(rule) || "（无）"}</Text>
                          </div>
                        </Space>
                      </div>
                      <Space>
                        <Button
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => {
                            // TODO: 实现编辑功能
                            message.info("编辑功能开发中...");
                          }}
                        />
                        <Button
                          type="text"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            Modal.confirm({
                              title: "确认删除",
                              content: "确定要删除这条业务规则吗？",
                              onOk: () => deleteRuleMutation.mutate(rule.ruleId),
                            });
                          }}
                        />
                      </Space>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* 底部操作栏 */}
          {currentFormRules.length > 0 && (
            <div style={{ padding: "16px 24px", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Button type="link" style={{ padding: 0 }}>添加备注</Button>
              <Space>
                <Text type="secondary">已启用</Text>
                <Switch defaultChecked />
              </Space>
            </div>
          )}
        </Card>
      </SettingsPageLayout>

      {/* 简单模式：添加业务规则对话框 */}
      <Modal
        title="添加业务规则"
        open={modalVisible && !isAdvancedMode}
        onCancel={handleCancel}
        onOk={handleSubmit}
        okText="确定"
        cancelText="取消"
        width={600}
        destroyOnHidden
      >
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, color: "#666", marginBottom: 8, lineHeight: 1.8 }}>
            <div>“数据生效”是指表单数据提交、流程表单数据审批完成；</div>
            <div>“数据作废”是指表单数据删除、流程表单数据重新激活；</div>
            <div>“流程状态变化”是指流程完成时自动更新当前表单的状态字段。</div>
          </div>
          <Alert
            message={
              <span style={{ color: "#ff4d4f" }}>
                注意:编辑表单数据会先执行"数据作废"规则,再执行"数据生效"规则
              </span>
            }
            type="warning"
            showIcon
            style={{ marginTop: 12, backgroundColor: "#fff7e6", borderColor: "#ffe58f" }}
          />
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            triggerEvent: "dataEffective",
          }}
        >
          <Form.Item
            name="ruleName"
            label={
              <span>
                规则名称<span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>
              </span>
            }
            rules={[{ required: true, message: "请输入规则名称" }]}
          >
            <Input placeholder="请输入规则名称" />
          </Form.Item>

          <Form.Item
            name="triggerEvent"
            label={
              <span>
                触发事件<span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>
              </span>
            }
            rules={[{ required: true, message: "请选择触发事件" }]}
          >
            <Select placeholder="请选择触发事件">
              <Option value="dataEffective">数据生效时</Option>
              <Option value="dataInvalidated">数据作废时</Option>
              <Option value="statusChange">流程状态变化时</Option>
            </Select>
          </Form.Item>

          {!isAdvancedMode ? (
            <>
              <Form.Item
                name="targetForm"
                label="目标表单"
                rules={[{ required: true, message: "请选择目标表单" }]}
              >
                <Select
                  placeholder="选择表单"
                  loading={formsLoading}
                  showSearch
                  filterOption={(input, option) =>
                    (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                >
                  {formsList.map((form) => (
                    <Option key={form.formId} value={form.formId} label={form.formName}>
                      {form.formName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="operationMethod"
                label={
                  <span>
                    操作方式<span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>
                  </span>
                }
                rules={[{ required: true, message: "请选择操作方式" }]}
              >
                <Select placeholder="请选择操作方式">
                  <Option value="onlyUpdate">仅更新数据</Option>
                  <Option value="onlyInsert">仅插入数据</Option>
                  <Option value="updateAndInsert">更新和插入数据</Option>
                  <Option value="forEachSubtable">遍历子表并更新</Option>
                  <Option value="onlyDelete">仅删除数据</Option>
                  <Option value="appendFiles">仅在附件控件中追加文件</Option>
                  <Option value="overwriteFiles">仅在附件控件中覆盖文件</Option>
                  <Option value="removeFiles">仅在附件控件中移除指定文件</Option>
                  <Option value="clearFiles">仅在附件控件中清空文件</Option>
                </Select>
              </Form.Item>

              {/* 具体操作配置 */}
              {/* 隐藏的Form.Item用于绑定specificOperations字段 */}
              <Form.Item name="specificOperations" noStyle>
                <Input type="hidden" />
              </Form.Item>
              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) =>
                  prevValues.targetForm !== currentValues.targetForm ||
                  prevValues.operationMethod !== currentValues.operationMethod
                }
              >
                {() => (
                  <SpecificOperationsConfig
                    form={form}
                    formId={formId}
                    formsList={formsList}
                    currentFormSchema={formSchema}
                  />
                )}
              </Form.Item>

              {/* 备注 */}
              <Form.Item name="remark" label="备注">
                <TextArea rows={3} placeholder="请输入备注信息" />
              </Form.Item>
            </>
          ) : (
            <>
              {/* 高级模式：目标表单选择 */}
              <Form.Item
                label={
                  <Space>
                    <span>
                      目标表单<span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>
                    </span>
                    <Button
                      type="primary"
                      size="small"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        if (!targetForms.find((tf) => tf.type === "form" && tf.value === (formSchema.formName || "未命名的表单"))) {
                          setTargetForms([...targetForms, { type: "form", value: formSchema.formName || "未命名的表单" }]);
                        }
                      }}
                    >
                      添加
                    </Button>
                  </Space>
                }
                rules={[{ required: true, message: "请添加目标表单" }]}
              >
                <div>
                  <Input
                    value={targetForms.length > 0 ? targetForms[0].value : (formSchema.formName || "未命名的表单")}
                    readOnly
                    placeholder="点击添加按钮选择表单"
                  />
                  <Collapse
                    ghost
                    style={{ marginTop: 8 }}
                    items={[
                      {
                        key: "currentForm",
                        label: "当前表单",
                        children: (
                          <div>
                            <Button
                              type="link"
                              style={{ padding: 0 }}
                              onClick={() => {
                                if (!targetForms.find((tf) => tf.type === "form" && tf.value === (formSchema.formName || "未命名的表单"))) {
                                  setTargetForms([{ type: "form", value: formSchema.formName || "未命名的表单" }]);
                                }
                              }}
                            >
                              {formSchema.formName || "未命名的表单"}
                            </Button>
                          </div>
                        ),
                      },
                      {
                        key: "organization",
                        label: "组织机构",
                        children: (
                          <div>
                            <Button
                              type="link"
                              style={{ padding: 0 }}
                              onClick={() => {
                                // TODO: 打开组织机构选择器
                                setTargetForms([...targetForms, { type: "org", value: "组织机构" }]);
                              }}
                            >
                              选择组织机构
                            </Button>
                          </div>
                        ),
                      },
                      {
                        key: "role",
                        label: "角色",
                        children: (
                          <div>
                            <Button
                              type="link"
                              style={{ padding: 0 }}
                              onClick={() => {
                                // TODO: 打开角色选择器
                                setTargetForms([...targetForms, { type: "role", value: "角色" }]);
                              }}
                            >
                              选择角色
                            </Button>
                          </div>
                        ),
                      },
                    ]}
                  />
                </div>
              </Form.Item>

              <Form.Item
                name="operationMethod"
                label={
                  <span>
                    操作方式<span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>
                  </span>
                }
                rules={[{ required: true, message: "请选择操作方式" }]}
              >
                <Select placeholder="请选择操作方式">
                  <Option value="onlyUpdate">仅更新数据</Option>
                  <Option value="onlyInsert">仅插入数据</Option>
                  <Option value="updateAndInsert">更新和插入数据</Option>
                  <Option value="onlyDelete">仅删除数据</Option>
                  <Option value="appendFiles">仅在附件控件中追加文件</Option>
                  <Option value="overwriteFiles">仅在附件控件中覆盖文件</Option>
                  <Option value="removeFiles">仅在附件控件中移除指定文件</Option>
                  <Option value="clearFiles">仅在附件控件中清空文件</Option>
                </Select>
              </Form.Item>

              {/* 函数输入区域 */}
              <Form.Item
                name="functionCode"
                label={
                  <span>
                    {form.getFieldValue("triggerEvent") === "dataEffective"
                      ? "数据生效时执行以下函数"
                      : "数据作废时执行以下函数"}
                  </span>
                }
                rules={[{ required: isAdvancedMode, message: "请输入函数代码" }]}
              >
                <div style={{ position: "relative" }}>
                  <TextArea
                    rows={10}
                    placeholder='例: UPDATE(目标表单,目标表单.姓名=="张三",目标表单.员工状态,"已转正")'
                    style={{ fontFamily: "monospace", fontSize: 13 }}
                    onChange={(e) => {
                      form.setFieldValue("functionCode", e.target.value);
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      right: 8,
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <Button
                      size="small"
                      onClick={() => setFunctionDrawerVisible(true)}
                    >
                      插入函数
                    </Button>
                  </div>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: "#999" }}>
                  <div style={{ marginBottom: 4 }}>
                    <Text strong>函数示例:</Text>{" "}
                    <code style={{ color: "#666" }}>INSERT()</code>
                  </div>
                  <div>
                    <Text strong>函数说明:</Text> 向目标表单新增数据
                  </div>
                </div>
              </Form.Item>
            </>
          )}
        </Form>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <Button
            type="link"
            onClick={() => {
              setIsAdvancedMode(true);
              setModalVisible(false);
              setFunctionDrawerVisible(true);
            }}
            style={{ padding: 0 }}
          >
            切换到高级模式
          </Button>
        </div>
      </Modal>

      {/* 高级模式：精确模仿参考图片的三块布局 */}
      <Modal
        title={form.getFieldValue("triggerEvent") === "dataEffective" ? "数据生效时" : "数据作废时"}
        open={isAdvancedMode && !modalVisible}
        onCancel={() => {
          setIsAdvancedMode(false);
          setFunctionDrawerVisible(false);
          form.resetFields();
          setTargetForms([]);
        }}
        width={780}
        style={{ top: 100, paddingBottom: 0 }}
        footer={null}
        closable
        maskClosable={false}
        styles={{ body: { padding: 0 } }}
      >
        {/* 中间内容区域：左右两栏布局 */}
        <div style={{ display: "flex", height: 410, gap: 0 }}>
          {/* 左侧：配置区域 */}
          <div style={{ width: 280, borderRight: "1px solid #e1e1e1", padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                triggerEvent: "dataEffective",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10, color: "#000" }}>
                {form.getFieldValue("triggerEvent") === "dataEffective" ? "数据生效时" : "数据作废时"}
              </div>

              {/* 目标表单 */}
              <Form.Item
                label={
                  <Space>
                    <span>
                      目标表单<span style={{ color: "#ff4d4f", marginLeft: 4 }}>*</span>
                    </span>
                    {targetForms.length > 0 ? (
                      <Button
                        size="small"
                        onClick={() => {
                          setFormSelectVisible(true);
                        }}
                      >
                        修改
                      </Button>
                    ) : (
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={() => {
                          setFormSelectVisible(true);
                        }}
                      >
                        添加
                      </Button>
                    )}
                  </Space>
                }
              >
                <div>
                  <div
                    style={{
                      border: "1px dashed #d9d9d9",
                      borderRadius: 4,
                      padding: "8px 12px",
                      minHeight: 32,
                      color: targetForms.length > 0 ? "#000" : "#999",
                      backgroundColor: "#fafafa",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onClick={() => {
                      setFormSelectVisible(true);
                    }}
                  >
                    {targetForms.length > 0 ? targetForms[0].value : "点击添加按钮选择表单"}
                  </div>
                  <Collapse
                    ghost
                    style={{ marginTop: 8 }}
                    defaultActiveKey={currentTargetForm ? ["targetForm"] : []}
                    items={[
                      // 如果已选择目标表单，显示目标表单名称和字段列表（放在最前面，默认展开）
                      ...(currentTargetForm && displayTargetFormFields.length > 0 ? [{
                        key: "targetForm",
                        label: currentTargetForm.value || "目标表单",
                        children: (
                          <div style={{ paddingLeft: 16, maxHeight: 200, overflow: "auto" }}>
                            {/* 表单名称 - 可点击插入 */}
                            <div
                              style={{
                                padding: "6px 8px",
                                cursor: "pointer",
                                borderRadius: 4,
                                marginBottom: 8,
                                backgroundColor: "#e6f7ff",
                                border: "1px solid #91d5ff",
                                display: "inline-block",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#bae7ff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#e6f7ff";
                              }}
                              onClick={() => {
                                const formName = currentTargetForm.value || "未命名的表单";
                                handleInsertField(formName);
                              }}
                            >
                              {currentTargetForm.value || "未命名的表单"}
                            </div>
                            {/* 目标表单的字段列表 - 使用统一颜色标识 */}
                            {displayTargetFormFields.map((field: any) => (
                              <div
                                key={field.fieldId}
                                style={{
                                  padding: "4px 8px",
                                  cursor: "pointer",
                                  borderRadius: 4,
                                  marginBottom: 4,
                                  backgroundColor: "#f6ffed",
                                  border: "1px solid #b7eb8f",
                                  display: "inline-block",
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = "#d9f7be";
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = "#f6ffed";
                                }}
                                onClick={() => {
                                  // 使用表单名称和字段标签，更易读
                                  const formName = currentTargetForm.value || "未命名的表单";
                                  const fieldPath = `${formName}.${field.label}`;
                                  handleInsertField(fieldPath);
                                }}
                              >
                                {field.label}
                              </div>
                            ))}
                          </div>
                        ),
                      }] : []),
                      {
                        key: "currentForm",
                        label: "当前表单",
                        children: (
                          <div>
                            {/* 表单名称 - 可点击插入 */}
                            <div
                              style={{
                                padding: "6px 8px",
                                cursor: "pointer",
                                borderRadius: 4,
                                marginBottom: 8,
                                backgroundColor: "#e6f7ff",
                                border: "1px solid #91d5ff",
                                display: "inline-block",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = "#bae7ff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = "#e6f7ff";
                              }}
                              onClick={() => {
                                const formName = formSchema?.formName || "当前表单";
                                handleInsertField(formName);
                              }}
                            >
                              {formSchema?.formName || "当前表单"}
                            </div>
                            {/* 当前表单的字段列表 - 正常显示，不加颜色 */}
                            {currentFormFields.length > 0 && (
                              <div style={{ paddingLeft: 16, maxHeight: 200, overflow: "auto" }}>
                                {currentFormFields.map((field: any) => (
                                  <div
                                    key={field.fieldId}
                                    style={{
                                      padding: "4px 8px",
                                      cursor: "pointer",
                                      borderRadius: 4,
                                      marginBottom: 4,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = "#f5f5f5";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                    onClick={() => {
                                      // 使用表单名称和字段标签，更易读
                                      const formName = formSchema?.formName || "当前表单";
                                      const fieldPath = `${formName}.${field.label}`;
                                      handleInsertField(fieldPath);
                                    }}
                                  >
                                    {field.label}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ),
                      },
                      // 添加一个"选择目标表单"的折叠项，显示所有可用表单列表
                      {
                        key: "selectTargetForm",
                        label: "选择目标表单",
                        children: (
                          <div style={{ paddingLeft: 16, maxHeight: 200, overflow: "auto" }}>
                            {formsList
                              .filter((form: any) => form.formId !== formId) // 排除当前表单
                              .map((form: any) => (
                                <div
                                  key={form.formId}
                                  style={{
                                    padding: "6px 8px",
                                    cursor: "pointer",
                                    borderRadius: 4,
                                    marginBottom: 4,
                                    backgroundColor: currentTargetForm?.formId === form.formId ? "#e6f7ff" : "transparent",
                                    border: currentTargetForm?.formId === form.formId ? "1px solid #1890ff" : "1px solid transparent",
                                  }}
                                  onMouseEnter={(e) => {
                                    if (currentTargetForm?.formId !== form.formId) {
                                      e.currentTarget.style.backgroundColor = "#f5f5f5";
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (currentTargetForm?.formId !== form.formId) {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }
                                  }}
                                  onClick={() => {
                                    setSelectedTargetFormId(form.formId);
                                    setTargetForms([{ type: "form", value: form.formName, formId: form.formId }]);
                                  }}
                                >
                                  <div>
                                    <div style={{ fontWeight: 500 }}>{form.formName || "未命名的表单"}</div>
                                    <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>ID: {form.formId}</div>
                                  </div>
                                </div>
                              ))}
                            {formsList.filter((form: any) => form.formId !== formId).length === 0 && (
                              <div style={{ padding: "8px", color: "#999", textAlign: "center" }}>
                                没有其他可用表单
                              </div>
                            )}
                          </div>
                        ),
                      },
                      {
                        key: "organization",
                        label: "组织机构",
                        children: (
                          <Button
                            type="link"
                            style={{ padding: 0 }}
                            onClick={() => {
                              setTargetForms([...targetForms, { type: "org", value: "组织机构" }]);
                            }}
                          >
                            选择组织机构
                          </Button>
                        ),
                      },
                      {
                        key: "role",
                        label: "角色",
                        children: (
                          <Button
                            type="link"
                            style={{ padding: 0 }}
                            onClick={() => {
                              setTargetForms([...targetForms, { type: "role", value: "角色" }]);
                            }}
                          >
                            选择角色
                          </Button>
                        ),
                      },
                    ]}
                  />
                </div>
              </Form.Item>
            </Form>
          </div>

          {/* 右侧：函数输入区域 */}
          <div style={{ flex: 1, padding: 16, overflow: "auto", borderBottom: "1px solid #e1e1e1" }}>
            <Form
              form={form}
              layout="vertical"
            >
              <div style={{ fontSize: 14, color: "#333", marginBottom: 12 }}>
                数据生效时执行以下函数
              </div>
              <Form.Item
                name="functionCode"
                style={{ marginBottom: 0 }}
              >
                <div style={{ position: "relative" }}>
                  {/* 覆盖层：显示字段标签块 */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      pointerEvents: "none",
                      padding: "4px 11px",
                      fontFamily: "monospace",
                      fontSize: 13,
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      wordWrap: "break-word",
                      overflow: "hidden",
                      zIndex: 1,
                    }}
                  >
                    {functionCode && (() => {
                      // 解析文本，识别字段路径并渲染为标签块
                      const parts: Array<{ type: "text" | "field"; content: string; isTarget?: boolean }> = [];
                      const fieldPattern = /([\u4e00-\u9fa5a-zA-Z0-9_]+)\.([\u4e00-\u9fa5a-zA-Z0-9_]+)/g;
                      let lastIndex = 0;
                      let match;
                      const currentTargetFormName = currentTargetForm?.value || "";
                      
                      while ((match = fieldPattern.exec(functionCode)) !== null) {
                        // 检查是否在引号内
                        const beforeMatch = functionCode.substring(0, match.index);
                        const quoteCount = (beforeMatch.match(/"/g) || []).length;
                        if (quoteCount % 2 === 0) {
                          // 不在引号内，是字段路径
                          if (match.index > lastIndex) {
                            parts.push({ type: "text", content: functionCode.substring(lastIndex, match.index) });
                          }
                          const isTargetForm = match[1] === currentTargetFormName;
                          parts.push({ 
                            type: "field", 
                            content: match[0],
                            isTarget: isTargetForm,
                          });
                          lastIndex = match.index + match[0].length;
                        }
                      }
                      
                      if (lastIndex < functionCode.length) {
                        parts.push({ type: "text", content: functionCode.substring(lastIndex) });
                      }
                      
                      if (parts.length === 0) {
                        parts.push({ type: "text", content: functionCode });
                      }
                      
                      return parts.map((part, index) => {
                        if (part.type === "field") {
                          return (
                            <span
                              key={index}
                              style={{
                                display: "inline-block",
                                height: 20,
                                lineHeight: "20px",
                                padding: "0 6px",
                                margin: "0 2px",
                                borderRadius: 2,
                                backgroundColor: part.isTarget ? "#f6ffed" : "#e6f7ff",
                                border: `1px solid ${part.isTarget ? "#b7eb8f" : "#91d5ff"}`,
                                color: part.isTarget ? "#52c41a" : "#1890ff",
                                fontSize: 13,
                                verticalAlign: "middle",
                              }}
                            >
                              {part.content}
                            </span>
                          );
                        } else {
                          // 普通文本需要保持空白字符和换行
                          return <span key={index}>{part.content}</span>;
                        }
                      });
                    })()}
                  </div>
                  
                  {/* TextArea：可编辑，但文字颜色设为透明以显示覆盖层的标签 */}
                  <TextArea
                    ref={functionTextAreaRef}
                    rows={10}
                    value={functionCode || ""}
                    onChange={(e) => {
                      form.setFieldValue("functionCode", e.target.value);
                    }}
                    placeholder="例：UPDATE(目标表单,目标表单.姓名==&quot;张三&quot;,目标表单.员工状态,&quot;已转正&quot;)"
                    style={{ 
                      fontFamily: "monospace", 
                      fontSize: 13, 
                      lineHeight: 1.6,
                      border: "none",
                      resize: "none",
                      boxShadow: "none",
                      position: "relative",
                      zIndex: 2,
                      backgroundColor: "transparent",
                      color: "transparent",
                      caretColor: "#000", // 光标颜色保持可见
                    }}
                  />
                </div>
              </Form.Item>
            </Form>
            <div style={{ padding: "12px 0", fontSize: 12, color: "#666", borderTop: "1px solid #f0f0f0" }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontWeight: 500 }}>函数示例: </span>
                <span id="formula_example">INSERT(产品表, 产品表.产品名称, "笔记本", 产品表.价格, 500)：</span>
                <span>在产品表中新增一条产品名为 "笔记本"、价格为 500 的记录</span>
              </div>
              <div>
                <span style={{ fontWeight: 500 }}>函数说明: </span>
                <span id="formula_description">向目标表单新增数据</span>
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮区域 */}
        <div style={{ 
          borderTop: "1px solid #f0f0f0", 
          padding: "12px 16px", 
          display: "flex",
          justifyContent: "flex-end",
          gap: 8
        }}>
          <Button onClick={() => {
            setIsAdvancedMode(false);
            setFunctionDrawerVisible(false);
            form.resetFields();
            setTargetForms([]);
          }}>
            取消
          </Button>
          <Button type="primary" onClick={handleSubmit}>
            确定
          </Button>
        </div>
      </Modal>

      {/* 表单选择Modal */}
      <Modal
        title="选择目标表单"
        open={formSelectVisible}
        onCancel={() => setFormSelectVisible(false)}
        onOk={() => {
          if (selectedTargetFormId) {
            const selectedForm = formsList.find((f: any) => f.formId === selectedTargetFormId);
            if (selectedForm) {
              setTargetForms([{ type: "form", value: selectedForm.formName, formId: selectedTargetFormId }]);
              setSelectedTargetFormId(selectedTargetFormId);
              setFormSelectVisible(false);
            }
          }
        }}
        okText="确定"
        cancelText="取消"
      >
        <Select
          style={{ width: "100%" }}
          placeholder="请选择表单"
          showSearch
          value={selectedTargetFormId}
          onChange={(value) => setSelectedTargetFormId(value)}
          filterOption={(input, option) =>
            (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
          }
          options={formsList.map((form: any) => ({
            label: form.formName,
            value: form.formId,
          }))}
        />
      </Modal>

      {/* 独立的函数列表浮动面板 */}
      {isAdvancedMode && !modalVisible && (
        <div 
          style={{
            position: "fixed",
            left: "calc(50vw + 390px + 10px)",
            top: 100,
            width: 240,
            height: 548,
            backgroundColor: "#fff",
            border: "1px solid #e8e8e8",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 1001,
            display: "flex",
            flexDirection: "column"
          }}
        >
          <div style={{ 
            padding: "12px 16px", 
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ fontWeight: 500 }}>函数列表</span>
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              onClick={() => setFunctionDrawerVisible(false)}
              style={{ padding: 0, width: 20, height: 20 }}
            />
          </div>
          <div style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}>
            <Input
              placeholder="搜索"
              prefix={<SearchOutlined />}
              value={functionSearchText}
              onChange={(e) => setFunctionSearchText(e.target.value)}
              allowClear
              size="small"
            />
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "8px" }}>
            <FunctionListPanel 
              onInsertFunction={handleInsertFunction}
              searchText={functionSearchText}
            />
          </div>
        </div>
      )}
    </>
  );
};

// 字段权限设置组件
const FieldPermissionSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  const { data: formDefinition, refetch, isLoading } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId!),
    enabled: !!formId,
  });

  const { data: roleList = [] } = useQuery({
    queryKey: ["roles", "list"],
    queryFn: () => roleApi.list(),
  });

  const [dimension, setDimension] = useState<"node" | "role">("node");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("start");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [fieldSearch, setFieldSearch] = useState<string>("");

  const workflowNodes: Array<{ nodeId: string; label: string; type?: string }> =
    (formDefinition?.metadata?.workflow &&
      typeof formDefinition.metadata.workflow === "object" &&
      Array.isArray((formDefinition.metadata.workflow as any).nodes) &&
      (formDefinition.metadata.workflow as any).nodes) ||
    [];

  const allFieldItems = React.useMemo(() => {
    const fields = (formDefinition?.config?.fields || []) as any[];
    const items: Array<{ key: string; label: string; group?: string }> = [];
    for (const f of fields) {
      if (!f?.fieldId) continue;
      const baseLabel = String(f.label || f.fieldId);
      items.push({ key: String(f.fieldId), label: baseLabel, group: "主表字段" });
      if (f.type === "subtable" && Array.isArray(f.subtableFields)) {
        for (const c of f.subtableFields) {
          if (!c?.fieldId) continue;
          items.push({
            key: `${String(f.fieldId)}.${String(c.fieldId)}`,
            label: `${baseLabel} / ${String(c.label || c.fieldId)}`,
            group: "子表列",
          });
        }
      }
    }
    const kw = fieldSearch.trim();
    if (!kw) return items;
    return items.filter((x) => x.label.includes(kw) || x.key.includes(kw));
  }, [formDefinition, fieldSearch]);

  const readFieldPermissions = React.useCallback(() => {
    const fp = (formDefinition?.metadata as any)?.fieldPermissions;
    return (fp && typeof fp === "object") ? fp : {};
  }, [formDefinition]);

  const updateMutation = useMutation({
    mutationFn: async (nextFieldPermissions: any) => {
      if (!formId || !formDefinition) return;
      await formDefinitionApi.update(formId, {
        // 注意：后端 updateDto.fields 不传时，会以当前实体的 config 进行保存；
        // 如果这里把已解析的 config 对象原样传回去，会导致 TEXT 列被写成 "[object Object]"。
        // 所以必须传 fields/layout，保证后端走 JSON.stringify(config) 路径。
        fields: (formDefinition as any)?.config?.fields || [],
        layout: (formDefinition as any)?.config?.layout,
        metadata: {
          ...(formDefinition.metadata || {}),
          fieldPermissions: nextFieldPermissions,
        },
      } as any);
    },
    onSuccess: () => {
      message.success("保存成功");
      refetch();
    },
    onError: (err: any) => {
      message.error(err?.message || "保存失败");
    },
  });

  const getAction = (fieldKey: string): "hidden" | "readonly" | "editable" => {
    const fp = readFieldPermissions();
    const fallback = fp?.defaults?.fallback || "editable";
    if (dimension === "node") {
      return (fp?.nodeRules?.[selectedNodeId]?.[fieldKey] || fallback) as any;
    }
    return (fp?.roleRules?.[selectedRoleId]?.[fieldKey] || fallback) as any;
  };

  const setAction = (fieldKey: string, action: "hidden" | "readonly" | "editable") => {
    const fp = readFieldPermissions();
    const next = {
      defaults: { fallback: fp?.defaults?.fallback || "editable" },
      roleRules: fp?.roleRules || {},
      nodeRules: fp?.nodeRules || {},
    } as any;

    if (dimension === "node") {
      const m = { ...(next.nodeRules?.[selectedNodeId] || {}) };
      m[fieldKey] = action;
      next.nodeRules = { ...(next.nodeRules || {}), [selectedNodeId]: m };
    } else {
      if (!selectedRoleId) {
        message.warning("请先选择角色/权限组");
        return;
      }
      const m = { ...(next.roleRules?.[selectedRoleId] || {}) };
      m[fieldKey] = action;
      next.roleRules = { ...(next.roleRules || {}), [selectedRoleId]: m };
    }
    updateMutation.mutate(next);
  };

  return (
    <SettingsPageLayout title="字段权限">
      <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
        <Space orientation="vertical" style={{ width: "100%" }} size="middle">
          <Alert
            type="info"
            showIcon
            message="字段权限说明"
            description={
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>
                <div>字段权限可按“流程节点”或“角色/权限组”配置：隐藏 / 只读 / 可编辑。</div>
                <div>运行态优先级：节点规则优先，其次角色规则兜底（后端也会做过滤/校验）。</div>
              </div>
            }
          />

          <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
            <Space wrap>
              <Radio.Group
                value={dimension}
                onChange={(e) => setDimension(e.target.value)}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="node">按流程节点</Radio.Button>
                <Radio.Button value="role">按角色/权限组</Radio.Button>
              </Radio.Group>

              {dimension === "node" ? (
                <Select
                  style={{ width: 240 }}
                  value={selectedNodeId}
                  onChange={setSelectedNodeId}
                  options={[
                    { value: "start", label: "发起（start）" },
                    ...workflowNodes.map((n) => ({
                      value: String(n.nodeId),
                      label: `${String(n.label || n.nodeId)}（${String(n.nodeId)}）`,
                    })),
                  ]}
                />
              ) : (
                <Select
                  style={{ width: 240 }}
                  value={selectedRoleId || undefined}
                  onChange={(v) => setSelectedRoleId(String(v || ""))}
                  placeholder="选择角色/权限组"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  options={roleList.map((r: any) => ({
                    value: String(r.id),
                    label: `${String(r.name || r.code || r.id)}（${String(r.id)}）`,
                  }))}
                />
              )}
            </Space>

            <Space wrap>
              <Input
                placeholder="搜索字段"
                value={fieldSearch}
                onChange={(e) => setFieldSearch(e.target.value)}
                allowClear
                style={{ width: 240 }}
              />
              <Button
                onClick={() => {
                  Modal.confirm({
                    title: "重置当前配置",
                    content:
                      dimension === "node"
                        ? `确定要清空节点 ${selectedNodeId} 的字段权限配置吗？`
                        : `确定要清空角色 ${selectedRoleId || "(未选择)"} 的字段权限配置吗？`,
                    onOk: () => {
                      const fp = readFieldPermissions();
                      const next: any = {
                        defaults: { fallback: fp?.defaults?.fallback || "editable" },
                        roleRules: fp?.roleRules || {},
                        nodeRules: fp?.nodeRules || {},
                      };
                      if (dimension === "node") {
                        next.nodeRules = { ...(next.nodeRules || {}), [selectedNodeId]: {} };
                      } else {
                        if (!selectedRoleId) {
                          message.warning("请先选择角色/权限组");
                          return;
                        }
                        next.roleRules = { ...(next.roleRules || {}), [selectedRoleId]: {} };
                      }
                      updateMutation.mutate(next);
                    },
                  });
                }}
                danger
                icon={<DeleteOutlined />}
                disabled={updateMutation.isPending}
              >
                重置当前
              </Button>
            </Space>
          </Space>

          <Table
            size="small"
            loading={isLoading}
            rowKey="key"
            pagination={{ pageSize: 30, showSizeChanger: true }}
            dataSource={allFieldItems}
            columns={[
              {
                title: "字段",
                dataIndex: "label",
                key: "label",
                render: (t: string, row: any) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{t}</div>
                    <div style={{ fontSize: 12, color: "#999" }}>{row.key}</div>
                  </div>
                ),
              },
              {
                title: "权限",
                dataIndex: "perm",
                key: "perm",
                width: 260,
                render: (_: any, row: any) => {
                  const action = getAction(row.key);
                  return (
                    <Radio.Group
                      value={action}
                      onChange={(e) => setAction(row.key, e.target.value)}
                      disabled={updateMutation.isPending}
                    >
                      <Radio.Button value="editable">可编辑</Radio.Button>
                      <Radio.Button value="readonly">只读</Radio.Button>
                      <Radio.Button value="hidden">隐藏</Radio.Button>
                    </Radio.Group>
                  );
                },
              },
            ]}
          />
          <div style={{ fontSize: 12, color: "#999" }}>
            提示：子表列以 “子表字段ID.列字段ID” 作为权限 key（例如：`purchaseItems.price`）。
          </div>
        </Space>
      </Card>
    </SettingsPageLayout>
  );
};

// 数据摘要设置组件
const DataSummarySettings: React.FC<{ formId?: string }> = ({ formId }) => {
  return (
    <SettingsPageLayout title="数据摘要">
      <Card style={{ height: "100%" }}>
        <Empty description="数据摘要设置功能开发中..." />
      </Card>
    </SettingsPageLayout>
  );
};

// 提交校验设置组件
const SubmitValidationSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  return (
    <SettingsPageLayout title="提交校验">
      <Card style={{ height: "100%" }}>
        <Empty description="提交校验设置功能开发中..." />
      </Card>
    </SettingsPageLayout>
  );
};

// 消息提醒设置组件
const MessageReminderSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  return (
    <SettingsPageLayout title="消息提醒">
      <Card style={{ height: "100%" }}>
        <Empty description="消息提醒设置功能开发中..." />
      </Card>
    </SettingsPageLayout>
  );
};

// 关联列表设置组件
const AssociatedListSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  return (
    <SettingsPageLayout title="关联列表">
      <Card style={{ height: "100%" }}>
        <Empty description="关联列表设置功能开发中..." />
      </Card>
    </SettingsPageLayout>
  );
};

// 表单外链设置组件
const ExternalLinkSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  const [qrOpen, setQrOpen] = useState(false);
  const { data: formDefinition, refetch } = useQuery({
    queryKey: ["formDefinition", formId, "external-link"],
    queryFn: () => formDefinitionApi.getById(formId!),
    enabled: !!formId,
  });

  const updateMutation = useMutation({
    mutationFn: async (nextConfig: any) => {
      if (!formId || !formDefinition) return;
      const currentMeta = (formDefinition.metadata || {}) as Record<string, any>;
      await formDefinitionApi.update(formId, {
        fields: (formDefinition as any)?.config?.fields || [],
        layout: (formDefinition as any)?.config?.layout,
        metadata: {
          ...currentMeta,
          externalLink: {
            ...(currentMeta.externalLink || {}),
            ...nextConfig,
          },
        },
      });
    },
    onSuccess: () => {
      message.success("保存成功");
      refetch();
    },
    onError: (err: any) => {
      message.error(err?.message || "保存失败");
    },
  });

  const externalLinkConfig =
    ((formDefinition?.metadata as any)?.externalLink as
      | {
          enableExternalFill?: boolean;
          enableDataShare?: boolean;
          enablePublicQuery?: boolean;
          enableExternalView?: boolean;
        }
      | undefined) || {};

  const handleToggle = (
    key: "enableExternalFill" | "enableDataShare" | "enablePublicQuery" | "enableExternalView",
    checked: boolean,
  ) => {
    updateMutation.mutate({ [key]: checked });
  };

  const externalFillUrl = `${window.location.origin}/runtime/form?formId=${encodeURIComponent(formId || "")}`;

  const handleCopyExternalFillUrl = async () => {
    try {
      await navigator.clipboard.writeText(externalFillUrl);
      message.success("链接已复制");
    } catch {
      message.error("复制失败");
    }
  };

  const itemStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    borderBottom: "1px solid #f0f0f0",
    padding: "0 2px",
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    color: "#1f2d3d",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };

  const blueBarStyle: React.CSSProperties = {
    width: 4,
    height: 16,
    background: "#1677ff",
    borderRadius: 2,
    display: "inline-block",
  };

  return (
    <SettingsPageLayout title="表单外链">
      <div
        style={{
          minHeight: "100%",
          background: "#fff",
          border: "1px solid #f0f0f0",
          borderRadius: 2,
          padding: 16,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>表单外链</div>
        <div style={{ marginBottom: 14 }}>
          <Text strong style={{ display: "block", marginBottom: 6 }}>
            说明：
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            企业的外链访问频次支持 40 次/秒，超时上限时可能出现访问闪烁症状无法打开页面。
          </Text>
        </div>

        <div style={itemStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={blueBarStyle} />
            <span style={titleStyle}>外链填单</span>
            <Text type="secondary">外部人员访问链接或二维码扫码填写数据</Text>
            <Button type="link" style={{ padding: 0 }}>设置字段权限</Button>
          </div>
          <Switch
            checked={!!externalLinkConfig.enableExternalFill}
            onChange={(checked) => handleToggle("enableExternalFill", checked)}
            loading={updateMutation.isPending}
          />
        </div>

        {!!externalLinkConfig.enableExternalFill && (
          <div style={{ margin: "12px 0 16px", border: "1px solid #f0f0f0", background: "#fafafa", padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Input value={externalFillUrl} readOnly />
              <Button onClick={() => window.open(externalFillUrl, "_blank")}>打开</Button>
              <Button type="primary" onClick={handleCopyExternalFillUrl}>复制</Button>
              <Button type="text" icon={<QrcodeOutlined />} onClick={() => setQrOpen(true)} />
            </div>
            <div style={{ background: "#f5f6fa", padding: 12 }}>
              <div style={{ marginBottom: 10 }}>
                <Text strong>主题样式</Text>
                <Text style={{ marginLeft: 12 }}>默认主题</Text>
                <Button type="link" style={{ paddingInline: 8 }}>修改</Button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <Text strong>外链查看</Text>
                  <Text type="secondary" style={{ marginLeft: 10 }}>
                    外部人员填单后通过二维码查看数据
                  </Text>
                </div>
                <Switch
                  checked={!!externalLinkConfig.enableExternalView}
                  onChange={(checked) => handleToggle("enableExternalView", checked)}
                  loading={updateMutation.isPending}
                />
              </div>
            </div>
          </div>
        )}

        <div style={itemStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={blueBarStyle} />
            <span style={titleStyle}>数据分享</span>
            <Text type="secondary">内部人员将权限范围内的数据分享给外部人员查看</Text>
          </div>
          <Switch
            checked={!!externalLinkConfig.enableDataShare}
            onChange={(checked) => handleToggle("enableDataShare", checked)}
            loading={updateMutation.isPending}
          />
        </div>

        <div style={itemStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={blueBarStyle} />
            <span style={titleStyle}>公开查询</span>
            <Text type="secondary">外部人员通过公开链接或二维码查询表单数据</Text>
          </div>
          <Switch
            checked={!!externalLinkConfig.enablePublicQuery}
            onChange={(checked) => handleToggle("enablePublicQuery", checked)}
            loading={updateMutation.isPending}
          />
        </div>
      </div>
      <Modal
        title="外链填单二维码"
        open={qrOpen}
        footer={null}
        onCancel={() => setQrOpen(false)}
        destroyOnHidden
      >
        <div style={{ display: "flex", justifyContent: "center", padding: "8px 0 16px" }}>
          <QRCode value={externalFillUrl} size={220} />
        </div>
        <Input value={externalFillUrl} readOnly />
      </Modal>
    </SettingsPageLayout>
  );
};

// 打印模板设置组件
const PrintTemplateSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  const [searchParams] = useSearchParams();
  const effectiveFormId = formId ?? searchParams.get("formId") ?? undefined;
  const [modalVisible, setModalVisible] = useState(false);
  const [templateType, setTemplateType] = useState<"excel" | "blank">("excel");
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 获取模板列表
  const { data: templates = [], isLoading, refetch } = useQuery({
    // formId 丢失时依然返回 localStorage 里的全部模板，避免「列表一下就没了」
    queryKey: ["printTemplates", effectiveFormId ?? "__ALL__"],
    queryFn: () => printTemplateApi.getByFormId(effectiveFormId),
    enabled: true,
  });

  // 监听来自子窗口的消息，刷新列表
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (
        event.data?.type === "template-saved" &&
        (effectiveFormId ? event.data?.formId === effectiveFormId : true)
      ) {
        refetch();
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [effectiveFormId, refetch]);

  // 删除模板
  const deleteMutation = useMutation({
    mutationFn: (id: string) => printTemplateApi.delete(id),
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["printTemplates"], exact: false });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || "删除失败");
    },
  });

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key === "excel") {
      setTemplateType("excel");
      setModalVisible(true);
    } else if (key === "blank") {
      setTemplateType("blank");
      setModalVisible(true);
    }
  };

  const handleCreateTemplate = async () => {
    try {
      const values = await form.validateFields();
      const templateName = values.templateName;
      
      // 关闭模态框
      setModalVisible(false);
      form.resetFields();
      
      // 在新标签页打开打印模板设计器页面
      if (!effectiveFormId) {
        message.error("缺少表单ID，无法创建模板");
        return;
      }
      const url = `/designer/print-template?formId=${effectiveFormId}&type=${templateType}&name=${encodeURIComponent(templateName)}`;
      window.open(url, "_blank");
    } catch (error) {
      console.error("表单验证失败:", error);
    }
  };

  const menuItems = [
    {
      key: "excel",
      label: (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Excel画布</span>
          <Tag color="orange" style={{ marginLeft: 8 }}>推荐</Tag>
        </div>
      ),
    },
    {
      key: "blank",
      label: "空白画布",
    },
  ];

  const handleEdit = (template: any) => {
    // 用模板自身的 formId，确保即使当前页面 formId 丢失也能正确打开并保存回去
    const url = `/designer/print-template?formId=${template.formId}&templateId=${template.id}&type=${template.type}&name=${encodeURIComponent(template.name)}`;
    window.open(url, '_blank');
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: "确认删除",
      content: "确定要删除这个打印模板吗？",
      onOk: () => {
        deleteMutation.mutate(id);
      },
    });
  };

  return (
    <>
      <SettingsPageLayout title="打印模板">
        <Card style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {templates.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Empty
                image={
                  <div
                    style={{
                      fontSize: 80,
                      color: "#d9d9d9",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      height: 200,
                      marginBottom: 0,
                    }}
                  >
                    <PrinterOutlined style={{ fontSize: 80, color: "#d9d9d9" }} />
                  </div>
                }
                imageStyle={{ height: 200, marginBottom: 0 }}
                description={
                  <div style={{ textAlign: "center", marginTop: 40 }}>
                    <div style={{ fontSize: 16, color: "#666", marginBottom: 8 }}>
                      您还没添加任何自定义打印模板
                    </div>
                    <div style={{ fontSize: 14, color: "#999", marginBottom: 24 }}>
                      可以对表单内的字段进行自由的排版用于日常单据的打印
                    </div>
                    <Dropdown
                      menu={{ items: menuItems, onClick: handleMenuClick }}
                      trigger={["click"]}
                      placement="topCenter"
                    >
                      <Button type="primary" size="large">
                        立即设置
                      </Button>
                    </Dropdown>
                  </div>
                }
              />
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>模板列表</div>
                <Dropdown
                  menu={{ items: menuItems, onClick: handleMenuClick }}
                  trigger={["click"]}
                >
                  <Button type="primary" icon={<PlusOutlined />}>
                    新增模板
                  </Button>
                </Dropdown>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {templates.map((template: any) => (
                  <Card
                    key={template.id}
                    size="small"
                    style={{ cursor: "pointer" }}
                    actions={[
                      <EditOutlined key="edit" onClick={() => handleEdit(template)} />,
                      <DeleteOutlined key="delete" onClick={() => handleDelete(template.id)} />,
                    ]}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>
                          {template.name}
                        </div>
                        <div style={{ fontSize: 12, color: "#999" }}>
                          {template.type === "excel" ? "Excel画布" : "空白画布"} · {template.printType === "document" ? "文档类" : "套打类"} · {template.printMode === "paginated" ? "分页打印" : "连续打印"}
                        </div>
                      </div>
                      <Tag color={template.type === "excel" ? "orange" : "blue"}>
                        {template.type === "excel" ? "Excel" : "空白"}
                      </Tag>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Card>
      </SettingsPageLayout>

      {/* 新增模板模态框 */}
      <Modal
        title="新增模板"
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={handleCreateTemplate}
        okText="确定"
        cancelText="取消"
        width={400}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="templateName"
            label="模板名称"
            rules={[{ required: true, message: "请输入模板名称" }]}
          >
            <Input placeholder="请输入模板名称" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// 功能按钮设置组件
const FunctionButtonsSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  return (
    <SettingsPageLayout title="功能按钮">
      <Card style={{ height: "100%" }}>
        <Empty description="功能按钮设置功能开发中..." />
      </Card>
    </SettingsPageLayout>
  );
};

// 自动化设置组件
const AutomationSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  return (
    <SettingsPageLayout title="自动化">
      <Card style={{ height: "100%" }}>
        <Empty description="自动化设置功能开发中..." />
      </Card>
    </SettingsPageLayout>
  );
};

// 导入规则设置组件
const ImportRulesSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  return (
    <SettingsPageLayout title="导入规则">
      <Card style={{ height: "100%" }}>
        <Empty description="导入规则设置功能开发中..." />
      </Card>
    </SettingsPageLayout>
  );
};

// AI填单设置组件
const AIFillingSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  return (
    <SettingsPageLayout title="AI填单">
      <Card style={{ height: "100%" }}>
        <Empty description="AI填单设置功能开发中..." />
      </Card>
    </SettingsPageLayout>
  );
};

// 流程设置组件
const WorkflowSettings: React.FC<{ formId?: string }> = ({ formId }) => {
  const { data: formDefinition, refetch } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId!),
    enabled: !!formId,
  });

  const updateMutation = useMutation({
    mutationFn: async (metadata: any) => {
      if (!formId || !formDefinition) return;
      await formDefinitionApi.update(formId, {
        // 同上：必须带上 fields/layout，避免后端把 config 对象写入 TEXT 列
        fields: (formDefinition as any)?.config?.fields || [],
        layout: (formDefinition as any)?.config?.layout,
        metadata: {
          ...formDefinition.metadata,
          ...metadata,
        },
      });
    },
    onSuccess: () => {
      message.success("保存成功");
      refetch();
    },
    onError: (err: any) => {
      message.error(err?.message || "保存失败");
    },
  });

  const workflowEnabled = formDefinition?.metadata?.workflowEnabled !== false;
  const hasWorkflow = formDefinition?.metadata?.workflow && 
    typeof formDefinition.metadata.workflow === 'object' &&
    (formDefinition.metadata.workflow as any).nodes &&
    Array.isArray((formDefinition.metadata.workflow as any).nodes) &&
    (formDefinition.metadata.workflow as any).nodes.length > 0;

  const handleToggleWorkflow = (enabled: boolean) => {
    updateMutation.mutate({ workflowEnabled: enabled });
  };

  return (
    <SettingsPageLayout title="流程设置">
      <Card>
        <Space orientation="vertical" style={{ width: "100%" }} size="large">
          <div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>启用流程</Text>
            </div>
            <Space>
              <Switch
                checked={workflowEnabled}
                onChange={handleToggleWorkflow}
                loading={updateMutation.isPending}
              />
              <Text type="secondary">
                {workflowEnabled ? "已启用" : "已禁用"}
              </Text>
            </Space>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                启用后，提交表单时将自动启动流程。禁用后，提交表单时不会启动流程，已存在的流程实例不受影响。
              </Text>
            </div>
          </div>

          <Divider />

          <div>
            <div style={{ marginBottom: 8 }}>
              <Text strong>流程配置状态</Text>
            </div>
            {hasWorkflow ? (
              <Tag color="green">已配置流程</Tag>
            ) : (
              <Tag color="default">未配置流程</Tag>
            )}
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {hasWorkflow 
                  ? "当前表单已配置流程，可在「流程设计」标签页中查看和编辑流程。"
                  : "当前表单未配置流程，请在「流程设计」标签页中设计流程。"}
              </Text>
            </div>
          </div>
        </Space>
      </Card>
    </SettingsPageLayout>
  );
};

