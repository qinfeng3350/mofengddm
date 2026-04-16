import { useState, useEffect } from "react";
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  Space,
  Divider,
  Typography,
  Row,
  Col,
  Switch,
  InputNumber,
  message,
  Table,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowRightOutlined,
} from "@ant-design/icons";
import { formDefinitionApi } from "@/api/formDefinition";
import { businessRuleApi } from "@/api/businessRule";
import type {
  BusinessRuleResponse,
  BusinessRuleActionSchemaType,
} from "@/api/businessRule";

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface BusinessRuleDesignerProps {
  appId?: string;
  initialRule?: BusinessRuleResponse;
  onSave?: () => void;
  onCancel?: () => void;
}

export const BusinessRuleDesigner = ({
  appId,
  initialRule,
  onSave,
  onCancel,
}: BusinessRuleDesignerProps) => {
  const [form] = Form.useForm();
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggerFormId, setTriggerFormId] = useState<string>("");
  const [targetFormId, setTargetFormId] = useState<string>("");
  const [triggerFormFields, setTriggerFormFields] = useState<any[]>([]);
  const [targetFormFields, setTargetFormFields] = useState<any[]>([]);
  const [subtableFields, setSubtableFields] = useState<any[]>([]);

  // 加载表单列表
  useEffect(() => {
    if (!appId) return;
    (async () => {
      try {
        const list = await formDefinitionApi.getListByApplication(appId);
        setForms(list || []);
      } catch (e) {
        console.error("加载表单失败:", e);
      }
    })();
  }, [appId]);

  // 初始化表单数据
  useEffect(() => {
    if (initialRule) {
      form.setFieldsValue({
        ruleName: initialRule.ruleName,
        description: initialRule.description,
        enabled: initialRule.enabled,
        priority: initialRule.priority,
        trigger: {
          event: initialRule.trigger.event,
          formId: initialRule.trigger.formId,
        },
      });
      setTriggerFormId(initialRule.trigger.formId);
      
      // 处理actions：如果是脚本类型，尝试解析为UI配置
      const parsedActions = initialRule.actions.map((action: any) => {
        if (action.type === 'executeScript' && action.script) {
          // 尝试解析脚本，还原为UI配置
          const script = action.script;
          // 检查是否是 FOR_EACH 脚本
          const forEachMatch = script.match(/FOR_EACH\(([^,]+),\s*UPSERT\(([^,]+),\s*([^,]+),\s*([^)]+)\)\)/);
          if (forEachMatch) {
            const [, subtableFieldId, targetFormId, condition, mappings] = forEachMatch;
            // 解析匹配条件
            const conditionMatch = condition.match(/([^.]+)\.([^=]+)=([^.]+)\.(.+)/);
            const matchCondition = conditionMatch ? {
              targetField: conditionMatch[2].trim(),
              sourceField: conditionMatch[4].trim(),
            } : undefined;
            
            // 解析字段映射
            const fieldMapping: Record<string, any> = {};
            const fieldSourceMapping: Record<string, any> = {};
            const mappingParts = mappings.split(',');
            mappingParts.forEach((mapping: string) => {
              const equalIndex = mapping.indexOf('=');
              if (equalIndex > 0) {
                const targetField = mapping.substring(0, equalIndex).trim();
                const valueExpr = mapping.substring(equalIndex + 1).trim();
                // 检查是否是累加表达式
                if (valueExpr.includes('IFNULL') && valueExpr.includes('+')) {
                  const sourceMatch = valueExpr.match(/\+\s*([^.]+)\.(.+)/);
                  if (sourceMatch) {
                    fieldMapping[targetField] = '计算:累加';
                    fieldSourceMapping[targetField] = sourceMatch[2].trim();
                  }
                } else {
                  const sourceMatch = valueExpr.match(/[^.]+\.(.+)/);
                  if (sourceMatch) {
                    fieldMapping[targetField] = sourceMatch[1].trim();
                    fieldSourceMapping[targetField] = sourceMatch[1].trim();
                  }
                }
              }
            });
            
            return {
              type: 'forEachSubtable',
              subtableFieldId: subtableFieldId.trim(),
              targetFormId: targetFormId.trim(),
              matchCondition,
              fieldMapping,
              fieldSourceMapping,
            };
          }
        }
        return action;
      });
      
      setActions(parsedActions);
      form.setFieldValue("actions", parsedActions);
      
      if (parsedActions[0]?.targetFormId) {
        setTargetFormId(parsedActions[0].targetFormId);
      }
    } else {
      // 新建规则时，初始化空actions
      setActions([]);
      form.setFieldValue("actions", []);
    }
  }, [initialRule, form]);

  // 加载触发表单的字段
  useEffect(() => {
    if (!triggerFormId) {
      setTriggerFormFields([]);
      setSubtableFields([]);
      return;
    }
    (async () => {
      try {
        const formDef = await formDefinitionApi.getById(triggerFormId);
        const fields = formDef.config?.fields || [];
        setTriggerFormFields(fields);
        // 提取子表字段
        const subtables = fields.filter((f: any) => f.type === 'subtable');
        setSubtableFields(subtables);
      } catch (e) {
        console.error("加载表单字段失败:", e);
      }
    })();
  }, [triggerFormId]);

  // 加载目标表单的字段
  useEffect(() => {
    if (!targetFormId) {
      setTargetFormFields([]);
      return;
    }
    (async () => {
      try {
        const formDef = await formDefinitionApi.getById(targetFormId);
        const fields = formDef.config?.fields || [];
        setTargetFormFields(fields);
      } catch (e) {
        console.error("加载表单字段失败:", e);
      }
    })();
  }, [targetFormId]);

  // 将UI配置转换为后端格式
  const convertActionsToBackendFormat = (actions: BusinessRuleActionSchemaType[]): BusinessRuleActionSchemaType[] => {
    return actions.map((action) => {
      if (action.type === "forEachSubtable") {
        // 将"遍历子表"转换为脚本格式
        const subtableFieldId = action.subtableFieldId || "";
        const targetFormId = action.targetFormId || "";
        const matchCondition = action.matchCondition;
        const fieldMapping = action.fieldMapping || {};
        
        // 构建匹配条件字符串
        let conditionStr = "";
        if (matchCondition?.targetField && matchCondition?.sourceField) {
          conditionStr = `${targetFormId}.${matchCondition.targetField}=${subtableFieldId}.${matchCondition.sourceField}`;
        }
        
        // 构建字段映射字符串
        const mappingStrs: string[] = [];
        const fieldSourceMapping = (action as any).fieldSourceMapping || {};
        for (const [targetField, sourceExpr] of Object.entries(fieldMapping)) {
          if (typeof sourceExpr === 'string') {
            if (sourceExpr === '计算:累加') {
              // 累加：IFNULL(目标字段,0) + 子表字段
              const sourceFieldId = fieldSourceMapping[targetField] || targetField;
              mappingStrs.push(`${targetField}=IFNULL(${targetFormId}.${targetField},0)+${subtableFieldId}.${sourceFieldId}`);
            } else if (sourceExpr === '计算:覆盖') {
              // 覆盖：直接使用子表字段
              const sourceFieldId = fieldSourceMapping[targetField] || targetField;
              mappingStrs.push(`${targetField}=${subtableFieldId}.${sourceFieldId}`);
            } else if (sourceExpr && !sourceExpr.startsWith('计算:')) {
              // 普通映射：直接使用源字段ID
              mappingStrs.push(`${targetField}=${subtableFieldId}.${sourceExpr}`);
            }
          }
        }
        
        // 构建完整的脚本
        const script = `FOR_EACH(${subtableFieldId}, UPSERT(${targetFormId}, ${conditionStr}, ${mappingStrs.join(', ')}))`;
        
        return {
          type: "executeScript",
          script: script,
          targetFormId: targetFormId,
          subtableFieldId: subtableFieldId,
          matchCondition: matchCondition,
          fieldMapping: fieldMapping,
        } as any;
      } else if (action.type === "upsertRecord") {
        // UPSERT需要转换为脚本格式
        const targetFormId = action.targetFormId || "";
        const fieldMapping = action.fieldMapping || {};
        
        // 简化：使用第一个字段作为匹配条件（实际应该让用户配置）
        const firstField = Object.keys(fieldMapping)[0];
        if (firstField) {
          const conditionStr = `${targetFormId}.${firstField}=${fieldMapping[firstField]}`;
          const mappingStrs = Object.entries(fieldMapping)
            .filter(([k, v]) => typeof v === 'string' && !v.startsWith('计算:'))
            .map(([k, v]) => `${k}=${v}`);
          const script = `UPSERT(${targetFormId}, ${conditionStr}, ${mappingStrs.join(', ')})`;
          
          return {
            type: "executeScript",
            script: script,
            targetFormId: targetFormId,
            fieldMapping: fieldMapping,
          } as any;
        }
      }
      return action;
    });
  };

  // 保存规则
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (!appId) {
        message.error("缺少应用ID，无法保存规则");
        return;
      }

      const rawActions = form.getFieldValue("actions") || [];
      const convertedActions = convertActionsToBackendFormat(rawActions);

      const ruleData: BusinessRuleResponse = {
        ruleId: initialRule?.ruleId || `rule_${Date.now()}`,
        ruleName: values.ruleName,
        description: values.description,
        enabled: values.enabled ?? true,
        priority: values.priority ?? 0,
        applicationId: appId,
        trigger: {
          event: values.trigger.event,
          formId: values.trigger.formId,
          conditions: values.trigger.conditions || [],
        },
        actions: convertedActions,
      };

      setLoading(true);
      if (initialRule) {
        await businessRuleApi.update(appId, initialRule.ruleId, ruleData);
        message.success("规则更新成功");
      } else {
        await businessRuleApi.create(ruleData);
        message.success("规则创建成功");
      }
      onSave?.();
    } catch (e: any) {
      if (e?.errorFields) {
        return; // 表单验证错误
      }
      console.error("保存失败:", e);
      message.error("保存失败");
    } finally {
      setLoading(false);
    }
  };

  // 动作列表
  const [actions, setActions] = useState<BusinessRuleActionSchemaType[]>(
    initialRule?.actions || []
  );

  // 添加动作
  const handleAddAction = () => {
    const newAction: BusinessRuleActionSchemaType = {
      type: "createRecord",
      targetFormId: "",
      fieldMapping: {},
      api: {
        url: "",
        method: "POST",
        headers: {},
        body: {},
      },
    };
    setActions([...actions, newAction]);
    form.setFieldValue("actions", [...actions, newAction]);
  };

  // 删除动作
  const handleDeleteAction = (index: number) => {
    const newActions = actions.filter((_, i) => i !== index);
    setActions(newActions);
    form.setFieldValue("actions", newActions);
  };

  // 更新动作
  const handleUpdateAction = (index: number, patch: Partial<BusinessRuleActionSchemaType>) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], ...patch };
    setActions(newActions);
    form.setFieldValue("actions", newActions);
  };

  return (
    <div style={{ padding: 24, maxHeight: "calc(100vh - 200px)", overflow: "auto" }}>
      <Form form={form} layout="vertical">
        <Card title="基本信息" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="ruleName"
                label="规则名称"
                rules={[{ required: true, message: "请输入规则名称" }]}
              >
                <Input placeholder="例如：订单创建后自动创建发货单" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="priority" label="优先级" initialValue={0}>
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="规则描述">
            <TextArea rows={2} placeholder="描述这个规则的用途和效果" />
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Card>

        <Card title="触发条件" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name={["trigger", "formId"]}
                label="触发表单"
                rules={[{ required: true, message: "请选择触发表单" }]}
              >
                <Select
                  placeholder="选择触发表单"
                  onChange={(value) => setTriggerFormId(value)}
                >
                  {forms.map((f) => (
                    <Option key={f.formId} value={f.formId}>
                      {f.formName}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={["trigger", "event"]}
                label="触发事件"
                rules={[{ required: true, message: "请选择触发事件" }]}
              >
                <Select placeholder="选择触发事件">
                  <Option value="create">新增记录</Option>
                  <Option value="update">更新记录</Option>
                  <Option value="delete">删除记录</Option>
                  <Option value="statusChange">状态变更</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="触发条件（可选）" tooltip="满足以下条件时才触发规则">
            <Text type="secondary" style={{ fontSize: 12 }}>
              触发条件配置功能开发中...
            </Text>
          </Form.Item>
        </Card>

        <Card
          title="执行动作"
          extra={
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddAction}>
              添加动作
            </Button>
          }
          style={{ marginBottom: 16 }}
        >
          {actions.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#999" }}>
              请添加至少一个执行动作
            </div>
          ) : (
            <Space direction="vertical" style={{ width: "100%" }} size={16}>
              {actions.map((action, index) => (
                <Card
                  key={index}
                  size="small"
                  title={`动作 ${index + 1}`}
                  extra={
                    <Popconfirm
                      title="确定删除这个动作？"
                      onConfirm={() => handleDeleteAction(index)}
                    >
                      <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  }
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item label="动作类型">
                        <Select
                          value={action.type}
                          onChange={(value) => {
                            handleUpdateAction(index, { 
                              type: value,
                              // 切换类型时清空相关配置
                              subtableFieldId: value === 'forEachSubtable' ? action.subtableFieldId : undefined,
                              matchCondition: value !== 'forEachSubtable' ? undefined : action.matchCondition,
                            api:
                              value === 'callApi'
                                ? action.api || { url: '', method: 'POST', headers: {}, body: {} }
                                : undefined,
                            });
                          }}
                        >
                          <Option value="createRecord">创建记录</Option>
                          <Option value="updateRecord">更新记录</Option>
                          <Option value="upsertRecord">更新或创建（UPSERT）</Option>
                          <Option value="forEachSubtable">遍历子表并更新</Option>
                          <Option value="deleteRecord">删除记录</Option>
                          <Option value="updateField">更新字段</Option>
                          <Option value="sendNotification">发送通知</Option>
                          <Option value="executeScript">执行脚本（高级）</Option>
                          <Option value="callApi">调用API</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    {(action.type === "createRecord" ||
                      action.type === "updateRecord" ||
                      action.type === "upsertRecord" ||
                      action.type === "updateField") && (
                      <Col span={12}>
                        <Form.Item label="目标表单">
                          <Select
                            value={action.targetFormId}
                            onChange={(value) => {
                              handleUpdateAction(index, { targetFormId: value });
                              setTargetFormId(value);
                            }}
                            placeholder="选择目标表单"
                          >
                            {forms.map((f) => (
                              <Option key={f.formId} value={f.formId}>
                                {f.formName}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </Col>
                    )}
                    {action.type === "forEachSubtable" && (
                      <>
                        <Col span={12}>
                          <Form.Item label="子表字段">
                            <Select
                              value={action.subtableFieldId}
                              onChange={(value) => {
                                handleUpdateAction(index, { subtableFieldId: value });
                              }}
                              placeholder="选择要遍历的子表字段"
                            >
                              {subtableFields.map((f) => (
                                <Option key={f.fieldId} value={f.fieldId}>
                                  {f.label}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                        <Col span={12}>
                          <Form.Item label="目标表单">
                            <Select
                              value={action.targetFormId}
                              onChange={(value) => {
                                handleUpdateAction(index, { targetFormId: value });
                                setTargetFormId(value);
                              }}
                              placeholder="选择目标表单"
                            >
                              {forms.map((f) => (
                                <Option key={f.formId} value={f.formId}>
                                  {f.formName}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                      </>
                    )}
                  </Row>

                  {/* 遍历子表的匹配条件 */}
                  {action.type === "forEachSubtable" && action.subtableFieldId && targetFormId && (
                    <div style={{ marginTop: 16 }}>
                      <Text strong>匹配条件（用于查找目标记录）：</Text>
                      <Row gutter={16} style={{ marginTop: 8 }}>
                        <Col span={8}>
                          <Select
                            style={{ width: "100%" }}
                            value={action.matchCondition?.targetField}
                            onChange={(val) => {
                              handleUpdateAction(index, {
                                matchCondition: {
                                  ...(action.matchCondition || {}),
                                  targetField: val,
                                },
                              });
                            }}
                            placeholder="目标表单字段"
                          >
                            {targetFormFields.map((f) => (
                              <Option key={f.fieldId} value={f.fieldId}>
                                {f.label}
                              </Option>
                            ))}
                          </Select>
                        </Col>
                        <Col span={2} style={{ textAlign: "center", lineHeight: "32px" }}>
                          =
                        </Col>
                        <Col span={8}>
                          <Select
                            style={{ width: "100%" }}
                            value={action.matchCondition?.sourceField}
                            onChange={(val) => {
                              handleUpdateAction(index, {
                                matchCondition: {
                                  ...(action.matchCondition || {}),
                                  sourceField: val,
                                },
                              });
                            }}
                            placeholder="子表字段"
                          >
                            {(() => {
                              const subtableField = subtableFields.find(
                                (f) => f.fieldId === action.subtableFieldId
                              );
                              const subtableColumns = subtableField?.subtableFields || [];
                              return subtableColumns.map((col: any) => (
                                <Option key={col.fieldId} value={col.fieldId}>
                                  {col.label}
                                </Option>
                              ));
                            })()}
                          </Select>
                        </Col>
                        <Col span={6}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            用于查找匹配的库存记录
                          </Text>
                        </Col>
                      </Row>
                    </div>
                  )}

                  {/* 字段映射 */}
                  {((action.type === "createRecord" || 
                     action.type === "updateRecord" || 
                     action.type === "upsertRecord" ||
                     action.type === "forEachSubtable") &&
                    targetFormId &&
                    targetFormFields.length > 0) && (
                      <div style={{ marginTop: 16 }}>
                        <Text strong>字段映射：</Text>
                        <Table
                          size="small"
                          dataSource={targetFormFields.map((field) => ({
                            key: field.fieldId,
                            targetField: field.label,
                            sourceField: action.fieldMapping?.[field.fieldId] || "",
                          }))}
                          columns={[
                            {
                              title: "目标字段",
                              dataIndex: "targetField",
                              width: 150,
                            },
                            {
                              title: "源字段/表达式",
                              dataIndex: "sourceField",
                              render: (value, record) => {
                                const isNumericField = 
                                  record.targetField?.includes('数量') || 
                                  record.targetField?.includes('金额') ||
                                  record.targetField?.includes('价格');
                                
                                // 分离源字段和计算方式
                                const sourceField = value?.startsWith('计算:') ? undefined : value;
                                const calcMode = value?.startsWith('计算:') ? value : undefined;
                                
                                return (
                                  <Input.Group compact>
                                    <Select
                                      style={{ width: isNumericField ? "50%" : "100%" }}
                                      value={sourceField}
                                      onChange={(val) => {
                                        const newMapping = {
                                          ...(action.fieldMapping || {}),
                                          [record.key]: val || calcMode || "",
                                        };
                                        // 保存源字段映射
                                        const fieldSourceMapping = {
                                          ...((action as any).fieldSourceMapping || {}),
                                          [record.key]: val,
                                        };
                                        handleUpdateAction(index, { 
                                          fieldMapping: newMapping,
                                          fieldSourceMapping: fieldSourceMapping,
                                        } as any);
                                      }}
                                      allowClear
                                      placeholder="选择源字段"
                                      showSearch
                                    >
                                      {action.type === "forEachSubtable" && action.subtableFieldId ? (
                                        // 子表字段
                                        (() => {
                                          const subtableField = subtableFields.find(
                                            (f) => f.fieldId === action.subtableFieldId
                                          );
                                          const subtableColumns = subtableField?.subtableFields || [];
                                          return subtableColumns.map((col: any) => (
                                            <Option key={col.fieldId} value={col.fieldId}>
                                              {col.label}（子表）
                                            </Option>
                                          ));
                                        })()
                                      ) : (
                                        // 触发表单字段
                                        triggerFormFields.map((f) => (
                                          <Option key={f.fieldId} value={f.fieldId}>
                                            {f.label}
                                          </Option>
                                        ))
                                      )}
                                    </Select>
                                    {isNumericField && (
                                      <Select
                                        style={{ width: "50%" }}
                                        value={calcMode}
                                        onChange={(val) => {
                                          const sourceFieldId = (action as any).fieldSourceMapping?.[record.key] || sourceField;
                                          const newMapping = {
                                            ...(action.fieldMapping || {}),
                                            [record.key]: val || sourceFieldId || "",
                                          };
                                          handleUpdateAction(index, { fieldMapping: newMapping });
                                        }}
                                        placeholder="计算方式"
                                        allowClear
                                      >
                                        <Option value="计算:累加">
                                          累加（现有值 + 新值）
                                        </Option>
                                        <Option value="计算:覆盖">
                                          覆盖（直接替换）
                                        </Option>
                                      </Select>
                                    )}
                                  </Input.Group>
                                );
                              },
                            },
                          ]}
                          pagination={false}
                        />
                        {action.type === "forEachSubtable" && (
                          <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
                            提示：选择"累加"时，会自动将子表中的数量累加到目标记录的对应字段上
                          </Text>
                        )}
                      </div>
                    )}

                    {/* callApi：外部接口调用配置 */}
                    {action.type === "callApi" && (
                      <div style={{ marginTop: 16 }}>
                        <Text strong>API 配置：</Text>
                        <Row gutter={16} style={{ marginTop: 8 }}>
                          <Col span={8}>
                            <Form.Item label="请求方法">
                              <Select
                                value={action.api?.method || "POST"}
                                onChange={(val) => {
                                  handleUpdateAction(index, {
                                    api: {
                                      ...(action.api || {}),
                                      method: val,
                                    } as any,
                                  });
                                }}
                              >
                                <Option value="GET">GET</Option>
                                <Option value="POST">POST</Option>
                                <Option value="PUT">PUT</Option>
                                <Option value="DELETE">DELETE</Option>
                              </Select>
                            </Form.Item>
                          </Col>
                          <Col span={16}>
                            <Form.Item label="请求 URL">
                              <Input
                                value={action.api?.url || ""}
                                onChange={(e) => {
                                  handleUpdateAction(index, {
                                    api: {
                                      ...(action.api || {}),
                                      url: e.target.value,
                                    } as any,
                                  });
                                }}
                                placeholder="例如：https://example.com/hook"
                              />
                            </Form.Item>
                          </Col>
                        </Row>

                        <div style={{ marginTop: 8 }}>
                          <Form.Item label="请求 Headers（JSON）">
                            <Input.TextArea
                              rows={3}
                              value={JSON.stringify(action.api?.headers || {}, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value || "{}");
                                  handleUpdateAction(index, {
                                    api: {
                                      ...(action.api || {}),
                                      headers: parsed,
                                    } as any,
                                  });
                                } catch {
                                  message.error("headers 必须是合法 JSON");
                                }
                              }}
                            />
                          </Form.Item>
                        </div>

                        <div style={{ marginTop: 8 }}>
                          <Form.Item label="请求 Body（JSON）">
                            <Input.TextArea
                              rows={5}
                              value={JSON.stringify(action.api?.body || {}, null, 2)}
                              onChange={(e) => {
                                try {
                                  const parsed = JSON.parse(e.target.value || "{}");
                                  handleUpdateAction(index, {
                                    api: {
                                      ...(action.api || {}),
                                      body: parsed,
                                    } as any,
                                  });
                                } catch {
                                  message.error("body 必须是合法 JSON");
                                }
                              }}
                            />
                          </Form.Item>
                        </div>
                      </div>
                    )}
                </Card>
              ))}
            </Space>
          )}
        </Card>

        <div style={{ textAlign: "right", marginTop: 24 }}>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button type="primary" loading={loading} onClick={handleSave}>
              保存
            </Button>
          </Space>
        </div>
      </Form>
    </div>
  );
};

