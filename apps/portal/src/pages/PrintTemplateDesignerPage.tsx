import React, { useState, useRef, useLayoutEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Layout, Button, Space, Input, Typography, Card, Radio, Select, InputNumber, Collapse, Avatar, Modal, Dropdown, Tag } from "antd";
import { useAuthStore } from "@/store/useAuthStore";
import { printTemplateApi } from "@/api/printTemplate";
import { authApi } from "@/api/auth";
import {
  ArrowLeftOutlined,
  SaveOutlined,
  EyeOutlined,
  CopyOutlined,
  QuestionCircleOutlined,
  UserOutlined,
  SearchOutlined,
  PlusOutlined,
  SettingOutlined,
  UndoOutlined,
  RedoOutlined,
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  VerticalAlignTopOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignBottomOutlined,
  BgColorsOutlined,
  FontColorsOutlined,
  BorderOutlined,
  AppstoreOutlined,
  TeamOutlined,
  SolutionOutlined,
  SafetyOutlined,
  ApiOutlined,
  RocketOutlined,
  ProfileOutlined,
  LinkOutlined,
  LogoutOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { message } from "antd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formDefinitionApi } from "@/api/formDefinition";
import { apiClient } from "@/api/client";
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { SpreadsheetEditor } from "@/components/SpreadsheetEditor";
import type { SpreadsheetEditorRef } from "@/components/SpreadsheetEditor";
import { DraggableFieldItem } from "@/components/DraggableFieldItem";
import { PrintPreviewTable } from "@/components/PrintPreviewTable";

const { Header, Sider, Content } = Layout;
const { Title } = Typography;

export const PrintTemplateDesignerPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, clearAuth, setAuth } = useAuthStore();
  const formId = searchParams.get("formId");
  const initialTemplateId = searchParams.get("templateId"); // 编辑模式下的模板ID
  const templateName = searchParams.get("name") || "未命名模板";
  const templateType = searchParams.get("type") || "excel";
  const queryClient = useQueryClient();
  
  // 获取当前用户信息（包括租户信息）
  const { data: currentUserInfo } = useQuery<any>({
    queryKey: ["current-user-info"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/auth/profile");
        return res as any;
      } catch {
        return null;
      }
    },
  });
  // 当前模板ID（保存后写回URL，刷新仍能加载）
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(initialTemplateId);

  const [printType, setPrintType] = useState<"document" | "overlay">("document");
  const [printMode, setPrintMode] = useState<"paginated" | "continuous">("paginated");
  const [paperSize, setPaperSize] = useState("A4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [margins, setMargins] = useState({
    top: 20,
    bottom: 20,
    left: 17,
    right: 17,
  });
  const [searchText, setSearchText] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const spreadsheetRef = useRef<SpreadsheetEditorRef>(null);

  const [tenantSwitchOpen, setTenantSwitchOpen] = useState(false);
  const [tenantSwitchLoading, setTenantSwitchLoading] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<
    Array<{ id: string; code?: string; name?: string }>
  >([]);
  const [targetTenantId, setTargetTenantId] = useState<string | null>(null);

  const handleTenantSwitchOpen = async () => {
    setTenantSwitchOpen(true);
    setTenantSwitchLoading(true);
    try {
      const res = await authApi.getTenants();
      // 兼容后端可能返回的结构：数组或 {tenants:[]}
      const list = Array.isArray(res) ? res : (res as any)?.tenants ?? [];
      message.info(`检测到可切换租户：${list.length} 个`);
      setTenantOptions(list);
      setTargetTenantId(list?.[0]?.id ?? null);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "获取租户列表失败";
      message.error(msg);
      console.error("获取租户列表失败:", e);
    } finally {
      setTenantSwitchLoading(false);
    }
  };

  const handleTenantSwitchConfirm = async () => {
    if (!targetTenantId) {
      message.warning("请选择要切换的租户");
      return;
    }
    setTenantSwitchLoading(true);
    try {
      const res = await authApi.switchTenant({ tenantId: targetTenantId });
      if (res?.access_token && res?.user) {
        setAuth(res.access_token, res.user);
        message.success("租户切换成功");
        setTenantSwitchOpen(false);
        window.location.reload();
        return;
      }
      message.error("租户切换失败：响应格式错误");
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "租户切换失败";
      message.error(msg);
      console.error("租户切换失败:", e);
    } finally {
      setTenantSwitchLoading(false);
    }
  };

  // 处理用户菜单点击
  const handleUserMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case "tenant-switch":
        // no-op
        void handleTenantSwitchOpen();
        break;
      case "site":
        // 在新标签页打开官网
        window.open("/", "_blank");
        break;
      case "profile":
        navigate("/settings/profile");
        break;
      case "org":
        navigate("/settings/organization");
        break;
      case "perm":
        navigate("/settings/permission");
        break;
      case "plugin":
        navigate("/settings/plugin");
        break;
      case "ai":
        navigate("/settings/ai");
        break;
      case "system":
        navigate("/settings/system");
        break;
      case "template-center":
        navigate("/settings/template");
        break;
      case "logout":
        clearAuth();
        message.success("已退出登录");
        navigate("/login");
        break;
      default:
        break;
    }
  };

  const sensors = useSensors(
    // dnd-kit 当前类型定义里可能没有 shouldCancelOnStart 字段
    // 这里用 any 兜底，避免 TS 类型报错影响页面编译
    useSensor(PointerSensor as any, {
      activationConstraint: {
        distance: 8, // 移动8px后才激活拖拽
      },
      // 检查是否应该取消拖拽
      shouldCancelOnStart: (event: any) => {
        const target = event.target as HTMLElement;
        if (!target) return false;
        
        // 首先检查是否是从字段面板拖拽（允许拖拽）
        // 检查拖拽起始元素是否是字段项或其子元素
        const draggableFieldElement = 
          target.closest("[data-draggable-field]") || 
          target.closest(".draggable-field-item");
        
        // 如果是从字段面板拖拽，不取消，允许拖拽
        if (draggableFieldElement) {
          return false; // 不取消，允许拖拽
        }
        
        // 检查是否是表格单元格或其内容（取消拖拽，允许双击）
        const cellElement = 
          target.closest("td[data-row]") || 
          target.closest("th");
        
        // 如果是单元格内容且不是从字段面板拖拽，取消拖拽以允许双击
        if (cellElement) {
          return true; // 取消拖拽，允许双击
        }
        
        return false;
      },
    } as any)
  );

  // 获取表单定义
  const { data: formDefinition, isLoading, error } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId!),
    enabled: !!formId,
  });

  // 如果是编辑模式，获取模板数据
  const { data: templateData, isLoading: isLoadingTemplate, error: templateError } = useQuery({
    queryKey: ["printTemplate", currentTemplateId],
    queryFn: () => printTemplateApi.getById(currentTemplateId!),
    enabled: !!currentTemplateId,
    retry: 1,
  });

  // 打印模板加载状态
  React.useEffect(() => {
    if (currentTemplateId) {
      // no-op
      if (templateError) {
        console.error("模板加载错误:", templateError);
        message.warning("模板加载失败，将使用空白模板");
      }
    }
  }, [currentTemplateId, isLoadingTemplate, templateData, templateError]);

  // 保存模板的 mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // 优先 update；如果模板不存在则 fallback 为 create（避免 URL 带错 templateId 或 localStorage 状态不一致导致“看似保存了但实际上写入失败”）
      if (currentTemplateId) {
        try {
          return await printTemplateApi.update(currentTemplateId, data);
        } catch (e: any) {
          const msg = String(e?.message || e);
          if (msg.includes("模板不存在")) {
            return printTemplateApi.create(data);
          }
          throw e;
        }
      }
      return printTemplateApi.create(data);
    },
    onSuccess: (res) => {
      message.success("模板保存成功");
      // 放宽失效范围：FormSettingsPage 在 formId 丢失时会用其它 queryKey
      queryClient.invalidateQueries({ queryKey: ["printTemplates"], exact: false });
      // 新建或更新后，确保模板ID已记录并写回URL，确保刷新还能加载
      if (res?.id) {
        const newTemplateId = res.id;
        setCurrentTemplateId(newTemplateId);
        const url = new URL(window.location.href);
        url.searchParams.set("templateId", newTemplateId);
        window.history.replaceState(null, "", url.toString());
        // no-op
        // 刷新模板数据查询，确保数据同步
        queryClient.invalidateQueries({ queryKey: ["printTemplate", newTemplateId] });
      }
      // 通知父窗口刷新（如果是从新窗口打开的）
      if (window.opener) {
        window.opener.postMessage({ type: "template-saved", formId }, "*");
      }
    },
    onError: (error: any) => {
      console.error("[PrintTemplateDesignerPage] 保存失败:", error);
      message.error(error.response?.data?.message || "保存失败");
    },
  });

  // 表单定义加载兜底：接口失败时使用空表单，避免白屏
  React.useEffect(() => {
    if (error) {
      message.warning("表单定义加载失败，已使用空白表单继续");
    }
  }, [error]);

  const fallbackFormDefinition = React.useMemo(() => {
    if (!formId) return null;
    return {
      formId,
      formName: templateName || "未命名表单",
      status: "draft" as const,
      version: 1,
      config: {
        fields: [],
        layout: { type: "grid", columns: 12 },
      },
      createdAt: "",
      updatedAt: "",
    };
  }, [formId, templateName]);

  const effectiveFormDefinition = formDefinition || fallbackFormDefinition;

  const formFields = effectiveFormDefinition?.config?.fields || [];

  const spreadsheetBootstrap = React.useMemo(() => {
    if (!templateData) return undefined;
    return {
      cells: templateData.cells || {},
      mergedCells: templateData.mergedCells || [],
      columnWidths: templateData.columnWidths || {},
      rowHeights: templateData.rowHeights || {},
    };
  }, [templateData]);

  const spreadsheetBootstrapKey = React.useMemo(() => {
    if (templateData?.id)
      return `${templateData.id}:${(templateData as any).updatedAt ?? ""}`;
    if (currentTemplateId) return `loading:${currentTemplateId}`;
    return "new";
  }, [templateData, currentTemplateId]);

  // 打印版式与 Spreadsheet 列数联动；layout 先于 paint 同步，减少先竖版再横版的闪动
  useLayoutEffect(() => {
    if (!templateData) return;
    setPrintType(templateData.printType || "document");
    setPrintMode(templateData.printMode || "paginated");
    setPaperSize(templateData.paperSize || "A4");
    setOrientation(templateData.orientation || "portrait");
    setMargins(templateData.margins || { top: 20, bottom: 20, left: 17, right: 17 });
  }, [templateData]);

  // 如果没有 formId，显示提示
  if (!formId) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>缺少表单ID，请从表单设置页面进入</p>
        <Button onClick={() => navigate(-1)}>返回</Button>
      </div>
    );
  }

  // 业务字段（表单中的字段），子表展开为“字段明细”可拖拽项
  const businessFields = React.useMemo(() => {
    const blocked = new Set([
      "ObjectId",
      "owner",
      "owningDepartment",
      "modifier",
      "createdAt",
      "updatedAt",
    ]);

    const result: Array<{ fieldId: string; label: string; type: string; subtableFields?: any[] }> = [];

    (formFields || []).forEach((field: any, idx: number) => {
      const fieldId = String(field?.fieldId || "");
      if (blocked.has(fieldId)) return;

      // 子表字段展开：主字段 + 子字段明细
      if (field?.type === "subtable" && Array.isArray(field?.subtableFields)) {
        const parentLabel = String(field?.label || field?.fieldName || fieldId || `子表${idx + 1}`);

        result.push({
          fieldId,
          label: parentLabel,
          type: "subtable",
          subtableFields: field.subtableFields,
        });

        field.subtableFields.forEach((sub: any, subIdx: number) => {
          const subId = String(sub?.fieldId || sub?.name || `sub_${subIdx + 1}`);
          const subLabel = String(
            sub?.label || sub?.fieldName || sub?.name || `明细${subIdx + 1}`,
          );
          // 用 parent.child 形式保留层级语义，便于后续真实取值
          result.push({
            fieldId: `${fieldId}.${subId}`,
            label: `${parentLabel} · ${subLabel}`,
            type: "subtable-field",
          });
        });
        return;
      }

      result.push({
        fieldId,
        label: String(field?.label || field?.fieldName || fieldId),
        type: String(field?.type || "text"),
      });
    });

    return result;
  }, [formFields]);

  // 系统字段
  const systemFields = [
    { fieldId: "ObjectId", label: "ObjectId", type: "text" },
    { fieldId: "owner", label: "拥有者", type: "user" },
    { fieldId: "owningDepartment", label: "所属部门", type: "department" },
    { fieldId: "modifier", label: "修改人", type: "user" },
  ];

  // 过滤字段（根据搜索文本）
  const filteredBusinessFields = businessFields.filter((field: any) =>
    !searchText || field.label.toLowerCase().includes(searchText.toLowerCase())
  );
  const filteredSystemFields = systemFields.filter((field: any) =>
    !searchText || field.label.toLowerCase().includes(searchText.toLowerCase())
  );

  // 处理拖拽结束
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const fieldData = active.data.current;
    const cellData = over?.data.current as any;

    if (fieldData?.type === "field" && cellData?.type === "cell") {
      const { fieldId, label } = fieldData;
      const { row, col } = cellData;
      if (spreadsheetRef.current) {
        spreadsheetRef.current.insertField(row, col, fieldId, label);
      }
      return;
    }

    // Luckysheet 场景下没有逐格 droppable，回退为插入到当前选中单元格
    if (fieldData?.type === "field" && spreadsheetRef.current) {
      const { fieldId, label } = fieldData;
      const range = spreadsheetRef.current.getSelectedRange();
      if (!range) return;
      spreadsheetRef.current.insertField(range.startRow, range.startCol, fieldId, label);
    }
  };

  const handleSave = async () => {
    if (!formId) {
      message.error("缺少表单ID");
      return;
    }

    if (!spreadsheetRef.current) {
      message.error("编辑器未初始化");
      return;
    }

    try {
      // 保存前先提交未结束的编辑内容
      spreadsheetRef.current.commitEditing();
      const editorData = spreadsheetRef.current.getAllData();

      const saveData = {
        formId,
        name: templateName,
        type: templateType as "excel" | "blank",
        printType,
        printMode,
        paperSize,
        orientation,
        margins,
        ...editorData,
      };

      await saveMutation.mutateAsync(saveData);
    } catch (e: any) {
      console.error("[PrintTemplateDesignerPage] handleSave 捕获错误:", e);
      message.error(e?.message || "保存失败");
    }
  };

  const handlePreview = () => {
    if (!spreadsheetRef.current) {
      message.error("编辑器未初始化");
      return;
    }

    // 预览前先提交未结束的编辑内容
    spreadsheetRef.current.commitEditing();
    const editorData = spreadsheetRef.current.getAllData();
    const preview = {
      name: templateName, // 使用模板名称，不是表单名称
      cells: editorData.cells,
      mergedCells: editorData.mergedCells,
      columnWidths: editorData.columnWidths,
      rowHeights: editorData.rowHeights,
      orientation, // 传递纸张方向
    };
    setPreviewData(preview);
    setPreviewVisible(true);
  };

  const handleCopy = () => {
    message.success("模板已复制");
    // TODO: 实现复制逻辑
  };

  const handleBack = () => {
    // 如果是新窗口打开的，关闭窗口；否则返回上一页
    if (window.opener) {
      window.close();
    } else {
      navigate(-1);
    }
  };

  // 确保所有必要的数据都已准备好（使用effectiveFormDefinition，允许fallback）
  if (!effectiveFormDefinition) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>正在加载表单定义...</p>
      </div>
    );
  }

  return (
    <Layout style={{ height: "100vh", background: "#f5f5f5" }}>
      {/* 顶部导航栏 */}
      <Header
        style={{
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={handleBack}>
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {templateName}
          </Title>
        </Space>
        <Space>
          <Button icon={<QuestionCircleOutlined />} type="text">
            客服
          </Button>
          <Dropdown
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: "tenant-title",
                  label: (
                    <div style={{ fontSize: 12, color: "#999" }}>
                      {currentUserInfo?.tenant?.name || currentUserInfo?.tenant?.code || "默认租户"}
                    </div>
                  ),
                  disabled: true,
                },
                {
                  key: "tenant-switch",
                  icon: <SwapOutlined />,
                  label: "切换",
                  // 兜底：确保点击一定触发打开（有些 AntD Dropdown 使用场景下 menu.onClick 不触发）
                  onClick: () => {
                    // no-op
                    void handleTenantSwitchOpen();
                  },
                },
                { type: "divider" },
                { key: "profile", icon: <SolutionOutlined />, label: "个人信息" },
                { key: "org", icon: <TeamOutlined />, label: "组织机构" },
                { key: "perm", icon: <SafetyOutlined />, label: "权限管理" },
                { key: "plugin", icon: <ApiOutlined />, label: "插件中心" },
                {
                  key: "ai",
                  icon: <RocketOutlined />,
                  label: (
                    <Space size={4}>
                      <span>AI能力中心</span>
                      <Tag color="red" style={{ marginLeft: 4, lineHeight: "18px" }}>new</Tag>
                    </Space>
                  ),
                },
                { key: "system", icon: <SettingOutlined />, label: "系统管理" },
                { key: "template-center", icon: <ProfileOutlined />, label: "模板中心" },
                { key: "site", icon: <LinkOutlined />, label: "墨枫官网" },
                { type: "divider" },
                {
                  key: "logout",
                  icon: <LogoutOutlined />,
                  label: "退出登录",
                },
              ],
              onClick: handleUserMenuClick,
            }}
          >
            <Space style={{ cursor: "pointer" }}>
              <Avatar
                icon={<UserOutlined />}
                style={{ marginRight: 8, backgroundColor: "#1890ff" }}
              >
                {(user?.name?.[0] || user?.account?.[0] || "").toUpperCase()}
              </Avatar>
              <span style={{ marginRight: 8, fontSize: 14, color: "#333" }}>
                {user?.name || user?.account || "未登录"}
              </span>
            </Space>
          </Dropdown>
          <Button icon={<SearchOutlined />} type="text" />
          <Button icon={<PlusOutlined />} type="text" />
          <Space>
            <Button 
              icon={<SaveOutlined />} 
              type="primary" 
              onClick={handleSave}
              loading={saveMutation.isPending}
            >
              保存
            </Button>
            <Button icon={<EyeOutlined />} onClick={handlePreview}>
              预览
            </Button>
            <Button icon={<CopyOutlined />} onClick={handleCopy}>
              复制
            </Button>
          </Space>
        </Space>
      </Header>

      <DndContext 
        sensors={sensors} 
        onDragEnd={handleDragEnd}
        onDragStart={(event) => {
          // 如果拖拽起始于表格单元格，且不是从字段面板拖拽，取消拖拽
          const target = event.activatorEvent?.target as HTMLElement;
          if (target) {
            const isCellContent = target.closest("td[data-row]") || target.closest("th");
            const isDraggableField = target.closest("[data-draggable-field]") || target.closest(".draggable-field-item");
            
            // 如果是单元格内容且不是从字段面板拖拽，取消拖拽以允许双击
            if (isCellContent && !isDraggableField) {
              // 不阻止，让 shouldCancelOnStart 处理
            }
          }
        }}
      >
        <Layout style={{ height: "calc(100vh - 64px)" }}>
          {/* 左侧字段面板 */}
          <Sider
            width={240}
            style={{
              background: "#fff",
              borderRight: "1px solid #f0f0f0",
              overflow: "auto",
            }}
          >
            <div style={{ padding: 16 }}>
              <Input
                placeholder="搜索字段"
                prefix={<SearchOutlined />}
                style={{ marginBottom: 16 }}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <Collapse
                defaultActiveKey={["business", "system"]}
                ghost
                items={[
                  {
                    key: "business",
                    label: "业务字段",
                    children: (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {filteredBusinessFields.map((field: any) => (
                          <DraggableFieldItem
                            key={field.fieldId}
                            fieldId={field.fieldId}
                            label={field.label}
                            type={field.type}
                            rightSlot={
                              field.type === "subtable" ? (
                                <Button
                                  size="small"
                                  type="link"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const cols = Array.isArray(field.subtableFields)
                                      ? field.subtableFields.map((sf: any, i: number) => ({
                                          fieldId: String(sf?.fieldId || sf?.name || `col_${i + 1}`),
                                          label: String(
                                            sf?.label || sf?.fieldName || sf?.name || `字段${i + 1}`,
                                          ),
                                        }))
                                      : [];
                                    spreadsheetRef.current?.insertSubtableBlock(
                                      String(field.fieldId),
                                      String(field.label),
                                      cols,
                                    );
                                  }}
                                >
                                  插入明细表
                                </Button>
                              ) : null
                            }
                          />
                        ))}
                      </div>
                    ),
                  },
                  {
                    key: "system",
                    label: "系统字段",
                    children: (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {filteredSystemFields.map((field: any) => (
                          <DraggableFieldItem
                            key={field.fieldId}
                            fieldId={field.fieldId}
                            label={field.label}
                            type={field.type}
                          />
                        ))}
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          </Sider>

          {/* 中央表格编辑器 */}
          <Content
            style={{
              background: "#fff",
              overflow: "auto",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* 工具栏 */}
            <div
              style={{
                padding: "8px 16px",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Space>
                <Button
                  size="small"
                  icon={<UndoOutlined />}
                  title="撤销"
                  onClick={() => spreadsheetRef.current?.undo()}
                />
                <Button
                  size="small"
                  icon={<RedoOutlined />}
                  title="重做"
                  onClick={() => spreadsheetRef.current?.redo()}
                />
                <Select
                  size="small"
                  defaultValue="黑体"
                  style={{ width: 100 }}
                  options={[
                    { value: "宋体", label: "宋体" },
                    { value: "黑体", label: "黑体" },
                    { value: "微软雅黑", label: "微软雅黑" },
                    { value: "Arial", label: "Arial" },
                    { value: "Times New Roman", label: "Times New Roman" },
                  ]}
                  onChange={(v) => spreadsheetRef.current?.setFontFamily(String(v))}
                />
                <Select
                  size="small"
                  defaultValue="9"
                  style={{ width: 60 }}
                  options={[
                    "8",
                    "9",
                    "10",
                    "11",
                    "12",
                    "14",
                    "16",
                    "18",
                    "20",
                    "24",
                    "28",
                    "32",
                  ].map((v) => ({ value: v, label: v }))}
                  onChange={(v) => spreadsheetRef.current?.setFontSize(Number(v))}
                />
                <Button
                  size="small"
                  icon={<FontColorsOutlined />}
                  title="文字颜色"
                  onClick={() => spreadsheetRef.current?.setFontColor("#000000")}
                />
                <Button
                  size="small"
                  icon={<BgColorsOutlined />}
                  title="填充颜色"
                  onClick={() => spreadsheetRef.current?.setCellBgColor("#fff2cc")}
                />
                <Button
                  size="small"
                  icon={<BoldOutlined />}
                  title="粗体"
                  onClick={() => spreadsheetRef.current?.toggleBold()}
                />
                <Button
                  size="small"
                  icon={<ItalicOutlined />}
                  title="斜体"
                  onClick={() => spreadsheetRef.current?.toggleItalic()}
                />
                <Button
                  size="small"
                  icon={<UnderlineOutlined />}
                  title="下划线"
                  onClick={() => spreadsheetRef.current?.toggleUnderline()}
                />
                <Button
                  size="small"
                  icon={<StrikethroughOutlined />}
                  title="删除线"
                  onClick={() => spreadsheetRef.current?.toggleStrike()}
                />
                <Button
                  size="small"
                  icon={<AlignLeftOutlined />}
                  title="左对齐"
                  onClick={() => spreadsheetRef.current?.alignHorizontal("left")}
                />
                <Button
                  size="small"
                  icon={<AlignCenterOutlined />}
                  title="居中"
                  onClick={() => spreadsheetRef.current?.alignHorizontal("center")}
                />
                <Button
                  size="small"
                  icon={<AlignRightOutlined />}
                  title="右对齐"
                  onClick={() => spreadsheetRef.current?.alignHorizontal("right")}
                />
                <Button
                  size="small"
                  icon={<VerticalAlignTopOutlined />}
                  title="顶部对齐"
                  onClick={() => spreadsheetRef.current?.alignVertical("top")}
                />
                <Button
                  size="small"
                  icon={<VerticalAlignMiddleOutlined />}
                  title="垂直居中"
                  onClick={() => spreadsheetRef.current?.alignVertical("middle")}
                />
                <Button
                  size="small"
                  icon={<VerticalAlignBottomOutlined />}
                  title="底部对齐"
                  onClick={() => spreadsheetRef.current?.alignVertical("bottom")}
                />
              <Button
                size="small"
                icon={<AppstoreOutlined />}
                title="合并单元格"
                onClick={() => {
                  if (spreadsheetRef.current) {
                    spreadsheetRef.current.mergeCells();
                  }
                }}
              />
              <Button
                size="small"
                icon={<BorderOutlined />}
                title="取消合并"
                onClick={() => {
                  if (spreadsheetRef.current) {
                    spreadsheetRef.current.unmergeCells();
                  }
                }}
              />
              <Button
                size="small"
                title="为选中区域添加全部边框（打印时显示；未设边框的格子不画线）"
                onClick={() => spreadsheetRef.current?.setSelectionBorderAll()}
              >
                框线
              </Button>
              <Button
                size="small"
                title="清除选中区域的边框"
                onClick={() => spreadsheetRef.current?.clearSelectionBorders()}
              >
                去框
              </Button>
              <Button
                size="small"
                title="编辑单元格"
                onClick={() => {
                  spreadsheetRef.current?.startEditSelected();
                }}
              >
                编辑
              </Button>
            </Space>
          </div>

            {/* Excel表格区域 */}
            <div
              style={{
                flex: 1,
                padding: 16,
                position: "relative",
                overflow: "auto",
              }}
            >
              <SpreadsheetEditor
                ref={spreadsheetRef}
                rows={20}
                cols={orientation === "portrait" ? 12 : 16}
                orientation={orientation}
                bootstrapData={spreadsheetBootstrap}
                bootstrapRevision={spreadsheetBootstrapKey}
                onCellChange={() => {
                  // handled by SpreadsheetEditor internal state
                }}
                onFieldDrop={(row, col, fieldId, fieldLabel) => {
                  // 处理字段拖拽到单元格
                  message.success(`字段 "${fieldLabel}" 已插入到单元格 ${String.fromCharCode(65 + col)}${row + 1}`);
                }}
              />
            </div>
          </Content>

        {/* 右侧设置面板 */}
        <Sider
          width={320}
          style={{
            background: "#fff",
            borderLeft: "1px solid #f0f0f0",
            overflow: "auto",
          }}
        >
          <div style={{ padding: 16 }}>
            <Title level={5}>模板设置</Title>

            {/* 打印类型 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text strong>打印类型</Typography.Text>
              </div>
              <Radio.Group
                value={printType}
                onChange={(e) => setPrintType(e.target.value)}
                style={{ width: "100%" }}
              >
                <Space orientation="vertical" style={{ width: "100%" }}>
                  <Radio value="document">文档类</Radio>
                  <Radio value="overlay">套打类</Radio>
                </Space>
              </Radio.Group>
              <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
                {printType === "document"
                  ? "用于连续打印表单所有内容。注意:从上至下一次打印表单内容且不重复,同打印word文档"
                  : "用于在已有单据上套打内容"}
              </div>
            </Card>

            {/* 打印模式 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text strong>打印模式</Typography.Text>
              </div>
              <Radio.Group
                value={printMode}
                onChange={(e) => setPrintMode(e.target.value)}
                style={{ width: "100%" }}
              >
                <Space orientation="vertical" style={{ width: "100%" }}>
                  <Radio value="paginated">分页打印</Radio>
                  <Radio value="continuous">连续打印</Radio>
                </Space>
              </Radio.Group>
              <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
                {printMode === "paginated"
                  ? "默认模式,每条数据单独打印"
                  : "连续打印所有数据"}
              </div>
            </Card>

            {/* 纸张大小 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text strong>纸张大小</Typography.Text>
              </div>
              <Select
                value={paperSize}
                onChange={setPaperSize}
                style={{ width: "100%" }}
                options={[
                  { label: "A4", value: "A4" },
                  { label: "A3", value: "A3" },
                  { label: "A5", value: "A5" },
                  { label: "Letter", value: "Letter" },
                ]}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: "#999" }}>
                {paperSize === "A4" && "宽: 210mm 高: 297mm"}
                {paperSize === "A3" && "宽: 297mm 高: 420mm"}
                {paperSize === "A5" && "宽: 148mm 高: 210mm"}
                {paperSize === "Letter" && "宽: 216mm 高: 279mm"}
              </div>
            </Card>

            {/* 纸张方向 */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <Typography.Text strong>纸张方向</Typography.Text>
              </div>
              <Radio.Group
                value={orientation}
                onChange={(e) => setOrientation(e.target.value)}
                style={{ width: "100%" }}
              >
                <Space orientation="vertical" style={{ width: "100%" }}>
                  <Radio value="portrait">纵向</Radio>
                  <Radio value="landscape">横向</Radio>
                </Space>
              </Radio.Group>
            </Card>

            {/* 页边距 */}
            <Card size="small">
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography.Text strong>页边距</Typography.Text>
                <Button type="text" size="small" icon={<SettingOutlined />} />
              </div>
              <Space orientation="vertical" style={{ width: "100%" }} size="small">
                <Space.Compact style={{ width: "100%" }}>
                  <span style={{ width: 60, display: "inline-block", lineHeight: "32px" }}>上:</span>
                  <InputNumber
                    value={margins.top}
                    onChange={(value) => setMargins({ ...margins, top: value || 0 })}
                    min={0}
                    style={{ flex: 1 }}
                  />
                  <span style={{ padding: "0 8px", lineHeight: "32px", background: "#fafafa", border: "1px solid #d9d9d9", borderLeft: "none", borderRadius: "0 6px 6px 0" }}>mm</span>
                </Space.Compact>
                <Space.Compact style={{ width: "100%" }}>
                  <span style={{ width: 60, display: "inline-block", lineHeight: "32px" }}>下:</span>
                  <InputNumber
                    value={margins.bottom}
                    onChange={(value) => setMargins({ ...margins, bottom: value || 0 })}
                    min={0}
                    style={{ flex: 1 }}
                  />
                  <span style={{ padding: "0 8px", lineHeight: "32px", background: "#fafafa", border: "1px solid #d9d9d9", borderLeft: "none", borderRadius: "0 6px 6px 0" }}>mm</span>
                </Space.Compact>
                <Space.Compact style={{ width: "100%" }}>
                  <span style={{ width: 60, display: "inline-block", lineHeight: "32px" }}>左:</span>
                  <InputNumber
                    value={margins.left}
                    onChange={(value) => setMargins({ ...margins, left: value || 0 })}
                    min={0}
                    style={{ flex: 1 }}
                  />
                  <span style={{ padding: "0 8px", lineHeight: "32px", background: "#fafafa", border: "1px solid #d9d9d9", borderLeft: "none", borderRadius: "0 6px 6px 0" }}>mm</span>
                </Space.Compact>
                <Space.Compact style={{ width: "100%" }}>
                  <span style={{ width: 60, display: "inline-block", lineHeight: "32px" }}>右:</span>
                  <InputNumber
                    value={margins.right}
                    onChange={(value) => setMargins({ ...margins, right: value || 0 })}
                    min={0}
                    style={{ flex: 1 }}
                  />
                  <span style={{ padding: "0 8px", lineHeight: "32px", background: "#fafafa", border: "1px solid #d9d9d9", borderLeft: "none", borderRadius: "0 6px 6px 0" }}>mm</span>
                </Space.Compact>
              </Space>
            </Card>
          </div>
        </Sider>
        </Layout>
      </DndContext>

      {/* 预览模态框 */}
      <Modal
        title="打印预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewVisible(false)}>
            关闭预览
          </Button>,
        ]}
        width="90%"
        style={{ top: 20 }}
      >
          {previewData && (
          <div style={{ padding: 20, background: "#f5f5f5" }}>
            <div style={{ marginBottom: 16, textAlign: "center", fontSize: 18, fontWeight: 500 }}>
              {previewData.name}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ boxShadow: "0 0 10px rgba(0,0,0,0.1)" }}>
                <PrintPreviewTable previewData={previewData} minRowCount={20} minColCount={12} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 租户切换模态框 */}
      <Modal
        title="切换租户"
        open={tenantSwitchOpen}
        onCancel={() => setTenantSwitchOpen(false)}
        confirmLoading={tenantSwitchLoading}
        onOk={() => void handleTenantSwitchConfirm()}
        okText="切换"
      >
        <Select
          value={targetTenantId ?? undefined}
          onChange={(v) => setTargetTenantId(String(v))}
          style={{ width: "100%" }}
          placeholder="请选择要切换的租户"
        >
          {tenantOptions.map((t) => (
            <Select.Option key={t.id} value={t.id}>
              {t.name ? (t.code ? `${t.name}(${t.code})` : t.name) : (t.code ? t.code : t.id)}
            </Select.Option>
          ))}
        </Select>
      </Modal>
    </Layout>
  );
};

