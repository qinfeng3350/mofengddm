import { Layout, Button, message, Input, Select } from "antd";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SaveOutlined, EyeOutlined, ArrowLeftOutlined } from "@ant-design/icons";
import { DataVDesigner } from "@/modules/datav-designer/DataVDesigner";
import { applicationApi } from "@/api/application";
import { useEffect, useState, useRef } from "react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useQueryClient } from "@tanstack/react-query";

const { Header, Content } = Layout;

export const DataVDesignerPage = () => {
  usePageTitle("数据大屏设计器 - 墨枫低代码平台");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const appId = searchParams.get("appId") || undefined;
  const initialScreenId = searchParams.get("screenId") || undefined;
  const [screenId, setScreenId] = useState<string | undefined>(initialScreenId);
  const [screenList, setScreenList] = useState<any[]>([]);
  const [screenConfig, setScreenConfig] = useState<any | null>(null);
  const latestConfigRef = useRef<any | null>(null);
  const dataVDesignerRef = useRef<DataVDesignerRef | null>(null);

  // 默认大屏配置（现在改为：新建时给一个空画布，不预置任何组件）
  const createDefaultScreenConfig = (screenId: string) => {
    return {
      screenId,
      screenName: "数据大屏",
      components: [],
    };
  };

  // 加载应用下的数据大屏配置
  useEffect(() => {
    if (!appId) return;
    
    console.log("【加载数据大屏】开始加载，appId:", appId, "screenId:", screenId);
    
    applicationApi
      .getById(appId)
      .then((app) => {
        console.log("【加载数据大屏】应用数据:", {
          appId: app.id,
          hasMetadata: !!app.metadata,
          metadataKeys: Object.keys(app.metadata || {}),
        });
        
        const screens = (app.metadata?.datavScreens as any[]) || [];
        
        console.log("【加载数据大屏】找到的 screens:", {
          screensCount: screens.length,
          screens: screens.map(s => ({
            screenId: s.screenId,
            screenName: s.screenName,
            componentsCount: s.components?.length || 0,
            hasComponents: !!s.components,
          })),
        });
        
        // 先把后端已有的大屏列表放进去
        setScreenList(screens);

        // 如果 URL 中有 screenId，说明是编辑已有大屏；如果没有，说明是新建
        let targetId: string;
        let found: any = null;

        if (screenId) {
          // 编辑模式：使用 URL 中的 screenId
          targetId = screenId;
          found = screens.find((s) => s.screenId === targetId) || null;

          if (!found) {
            // 这个 screenId 目前还没保存到后台，相当于「本地新建但未保存」的大屏
            console.log("【加载数据大屏】当前 screenId 在 metadata 中未找到，仍按新建大屏处理，使用默认示例布局");
            found = createDefaultScreenConfig(targetId);
          } else if (!found.components || found.components.length === 0) {
            // 找到了，但里面没有组件，也使用默认模板
            console.log("【加载数据大屏】找到的大屏为空，使用默认示例布局");
            found = createDefaultScreenConfig(targetId);
          }
        } else {
          // 新建模式：生成新的 screenId，使用默认模板
          targetId = `datav_${Date.now()}`;
          console.log("【加载数据大屏】新建数据大屏，screenId:", targetId);
          found = createDefaultScreenConfig(targetId);
        }

        // 确保下拉框里也能马上看到当前这个大屏，避免选项和值不一致导致抖动
        if (found) {
          setScreenList((prev) => {
            if (prev.some((s) => s.screenId === targetId)) return prev;
            return [...prev, found];
          });
        }

        setScreenId(targetId);
        
        console.log("【加载数据大屏】找到的目标配置:", {
          targetId,
          found: !!found,
          foundScreenName: found?.screenName,
          foundComponentsCount: found?.components?.length || 0,
          foundComponents: found?.components,
        });
        
        setScreenConfig(found);
        latestConfigRef.current = found;
      })
      .catch((e) => {
        console.error("【加载数据大屏】加载失败:", e);
        message.error("加载数据大屏配置失败");
      });
  }, [appId, screenId]);

  const handleSave = async () => {
    try {
      const effectiveScreenId = screenId || `datav_${Date.now()}`;
      if (!screenId) setScreenId(effectiveScreenId);

      // 确保获取最新配置，等待防抖完成（增加到800ms确保所有状态更新完成）
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 优先从 DataVDesigner 获取最新配置（最可靠，直接获取组件状态）
      let config: any = null;
      if (dataVDesignerRef.current?.getCurrentConfig) {
        const currentConfig = dataVDesignerRef.current.getCurrentConfig();
        if (currentConfig) {
          // 确保 components 是数组且不为空
          const componentsArray = Array.isArray(currentConfig.components) ? currentConfig.components : [];
          
          config = {
            screenName: currentConfig.screenName || screenConfig?.screenName || "数据大屏",
            components: componentsArray,
          };
          
          console.log("【保存数据大屏】从 DataVDesigner 获取最新配置:", {
            screenName: config.screenName,
            componentsCount: config.components?.length || 0,
            componentIds: config.components?.map((c: any) => c.id) || [],
            componentTypes: config.components?.map((c: any) => c.type) || [],
            components: config.components,
          });
          
          // 验证组件数据完整性
          if (config.components.length === 0) {
            console.warn("【保存数据大屏】警告：从 DataVDesigner 获取的组件列表为空！");
          } else {
            // 检查每个组件是否有必要的字段
            const invalidComponents = config.components.filter((c: any) => !c.id || !c.type);
            if (invalidComponents.length > 0) {
              console.error("【保存数据大屏】错误：发现无效组件:", invalidComponents);
            }
          }
        } else {
          console.warn("【保存数据大屏】警告：getCurrentConfig 返回 null 或 undefined");
        }
      } else {
        console.warn("【保存数据大屏】警告：dataVDesignerRef.current 或 getCurrentConfig 不存在");
      }
      
      // 如果从 DataVDesigner 获取失败或组件为空，使用 latestConfigRef 或 screenConfig
      if (!config || !config.components || config.components.length === 0) {
        const fallbackConfig = latestConfigRef.current || screenConfig;
        if (fallbackConfig) {
          config = {
            screenName: fallbackConfig.screenName || "数据大屏",
            components: fallbackConfig.components || [],
          };
          console.log("【保存数据大屏】使用 latestConfigRef 或 screenConfig:", {
            screenName: config.screenName,
            componentsCount: config.components?.length || 0,
            componentIds: config.components?.map((c: any) => c.id) || [],
          });
        } else {
          // 如果都没有，创建一个空配置
          config = {
            screenName: "数据大屏",
            components: [],
          };
          console.warn("【保存数据大屏】警告：没有找到任何配置，将保存空配置");
        }
      }
      
      console.log("【保存数据大屏】当前配置:", {
        screenId: effectiveScreenId,
        screenName: config?.screenName,
        componentsCount: config?.components?.length || 0,
        componentIds: config?.components?.map((c: any) => ({ id: c.id, type: c.type })) || [],
        components: config?.components,
      });
      
      // 确保所有组件数据完整（包括所有必要字段）
      const componentsToSave = (config?.components || []).map((comp: any) => ({
        ...comp,
        // 确保每个组件都有必要的字段
        id: comp.id,
        type: comp.type,
        x: comp.x ?? 0,
        y: comp.y ?? 0,
        width: comp.width ?? 200,
        height: comp.height ?? 200,
        zIndex: comp.zIndex ?? 1,
      }));
      
      const newScreen = { 
        screenId: effectiveScreenId,
        screenName: config?.screenName || "数据大屏",
        components: componentsToSave,
        // 保留其他可能的配置字段（但不覆盖上面的字段）
        ...(config || {}),
      };
      // 确保 components 是我们处理过的版本
      newScreen.components = componentsToSave;
      
      console.log("【保存数据大屏】准备保存的数据:", {
        screenId: newScreen.screenId,
        screenName: newScreen.screenName,
        componentsCount: newScreen.components?.length || 0,
        componentIds: newScreen.components?.map((c: any) => ({ id: c.id, type: c.type })) || [],
        components: newScreen.components,
      });

      if (appId) {
        // 重新获取最新的应用数据，确保 metadata 是最新的
        const app = await applicationApi.getById(appId);
        
        console.log("【保存数据大屏】获取的应用数据:", {
          appId: app.id,
          hasMetadata: !!app.metadata,
          metadataKeys: Object.keys(app.metadata || {}),
          currentScreensCount: (app.metadata?.datavScreens as any[])?.length || 0,
        });
        
        // 确保 metadata 对象存在
        const currentMetadata = app.metadata || {};
        const screens = (currentMetadata.datavScreens as any[]) || [];
        const idx = screens.findIndex((s) => s.screenId === effectiveScreenId);

        if (idx >= 0) {
          screens[idx] = newScreen;
          console.log("【保存数据大屏】更新现有大屏，索引:", idx);
        } else {
          screens.push(newScreen);
          console.log("【保存数据大屏】添加新大屏，总数:", screens.length);
        }

        // 确保保存所有 metadata 字段，不仅仅是 datavScreens
        // 使用深拷贝避免引用问题
        const updatedMetadata = {
          ...currentMetadata,
          datavScreens: JSON.parse(JSON.stringify(screens)), // 深拷贝
        };
        
        console.log("【保存数据大屏】准备保存的 metadata:", {
          metadataKeys: Object.keys(updatedMetadata),
          screensCount: updatedMetadata.datavScreens.length,
          screens: updatedMetadata.datavScreens.map((s: any) => ({
            screenId: s.screenId,
            screenName: s.screenName,
            componentsCount: s.components?.length || 0,
            componentIds: s.components?.map((c: any) => c.id) || [],
          })),
        });
        
        // 保存到后端
        console.log("【保存数据大屏】开始保存到后端，metadata 大小:", JSON.stringify(updatedMetadata).length, "字节");
        
        const savedApp = await applicationApi.update(appId, {
          metadata: updatedMetadata,
        });
        
        console.log("【保存数据大屏】后端返回的数据:", {
          hasMetadata: !!savedApp.metadata,
          metadataKeys: Object.keys(savedApp.metadata || {}),
          screensCount: (savedApp.metadata?.datavScreens as any[])?.length || 0,
          savedScreens: (savedApp.metadata?.datavScreens as any[])?.map((s: any) => ({
            screenId: s.screenId,
            screenName: s.screenName,
            componentsCount: s.components?.length || 0,
          })),
        });
        
        // 等待一小段时间确保数据库写入完成
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // 立即重新加载应用数据，确保数据同步
        const updatedApp = await applicationApi.getById(appId);
        const updatedScreens = (updatedApp.metadata?.datavScreens as any[]) || [];
        
        console.log("【保存数据大屏】保存后重新加载的数据:", {
          screensCount: updatedScreens.length,
          screens: updatedScreens.map((s: any) => ({
            screenId: s.screenId,
            screenName: s.screenName,
            componentsCount: s.components?.length || 0,
            componentIds: s.components?.map((c: any) => c.id) || [],
            hasComponents: !!s.components && Array.isArray(s.components),
          })),
        });
        
        // 验证保存是否成功
        const savedScreen = updatedScreens.find((s) => s.screenId === effectiveScreenId);
        if (!savedScreen) {
          console.error("【保存数据大屏】错误：保存后未找到对应的大屏配置！", {
            effectiveScreenId,
            allScreenIds: updatedScreens.map((s: any) => s.screenId),
          });
          message.error("保存失败：保存后未找到对应的大屏配置");
          return;
        }
        
        if (!savedScreen.components || savedScreen.components.length === 0) {
          console.warn("【保存数据大屏】警告：保存的大屏没有组件！", {
            screenId: savedScreen.screenId,
            components: savedScreen.components,
          });
        }
        
        // 更新本地状态
        setScreenList(updatedScreens);
        setScreenConfig(savedScreen);
        latestConfigRef.current = savedScreen;
        
        console.log("【保存数据大屏】本地状态已更新，组件数量:", savedScreen.components?.length || 0);
        
        // 使应用查询失效，确保 RuntimeListPage 中的列表自动刷新
        await queryClient.invalidateQueries({ queryKey: ["application", appId] });
        message.success(`数据大屏已保存（${savedScreen.components?.length || 0} 个组件）`);
      } else {
        window.localStorage.setItem(
          `local_datav_${screenId}`,
          JSON.stringify(newScreen),
        );
        message.success("数据大屏已保存到本地（未绑定应用）");
      }

      setScreenConfig(newScreen);
      latestConfigRef.current = newScreen;
      setScreenList((prev) => {
        const idx = prev.findIndex((s) => s.screenId === effectiveScreenId);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = newScreen;
          return next;
        }
        return [...prev, newScreen];
      });
    } catch (e) {
      console.error(e);
      message.error("保存数据大屏失败");
    }
  };

  const handlePreview = () => {
    if (!appId) {
      message.warning("请先绑定应用");
      return;
    }
    const effectiveId = screenId || `datav_${Date.now()}`;
    if (!screenId) setScreenId(effectiveId);
    navigate(`/app/${appId}/datav?screenId=${effectiveId}`);
  };

  const handleSwitchScreen = (id: string) => {
    setScreenId(id);
    const found = screenList.find((s) => s.screenId === id) || null;
    setScreenConfig(found);
    latestConfigRef.current = found;
    const params = new URLSearchParams();
    if (appId) params.set("appId", appId);
    params.set("screenId", id);
    navigate(`/datav/designer?${params.toString()}`, { replace: true });
  };

  const handleCreateScreen = () => {
    const newId = `datav_${Date.now()}`;
    setScreenId(newId);
    setScreenConfig(null);
    latestConfigRef.current = null;
    const params = new URLSearchParams();
    if (appId) params.set("appId", appId);
    params.set("screenId", newId);
    navigate(`/datav/designer?${params.toString()}`, { replace: true });
  };

  return (
    <Layout style={{ height: "100vh" }}>
      <Header
        style={{
          background: "#fff",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          >
            返回
          </Button>
          <div style={{ fontSize: 16, fontWeight: 500 }}>数据大屏设计器</div>
          <Select
            style={{ width: 240 }}
            placeholder="选择数据大屏"
            value={screenId}
            options={screenList.map((s) => ({ label: s.screenName || s.screenId, value: s.screenId }))}
            onChange={handleSwitchScreen}
            allowClear={false}
          />
          <Button onClick={handleCreateScreen}>新建大屏</Button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button icon={<EyeOutlined />} onClick={handlePreview}>
            预览
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            保存
          </Button>
        </div>
      </Header>
      <Content style={{ height: "calc(100vh - 64px)", overflow: "hidden" }}>
        <DataVDesigner
          ref={dataVDesignerRef as any}
          appId={appId}
          initialConfig={screenConfig}
          onConfigChange={(cfg) => {
            setScreenConfig(cfg);
            latestConfigRef.current = cfg;
          }}
        />
      </Content>
    </Layout>
  );
};

