import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { message, Spin, Table, Select } from "antd";
import ReactECharts from "echarts-for-react";
import {
  FullScreenContainer,
  BorderBox1,
  BorderBox2,
  BorderBox3,
  BorderBox4,
  BorderBox5,
  BorderBox6,
  BorderBox7,
  BorderBox8,
  BorderBox9,
  BorderBox10,
  BorderBox11,
  BorderBox12,
  BorderBox13,
  Decoration1,
  Decoration2,
  Decoration3,
  Decoration4,
  Decoration5,
  Decoration6,
  Decoration7,
  Decoration8,
  Decoration9,
  Decoration10,
} from "@jiaminghi/data-view-react";
import { applicationApi } from "@/api/application";
import { formDataApi } from "@/api/formData";
import { formDefinitionApi } from "@/api/formDefinition";
import type { ComponentConfig } from "@/modules/datav-designer/DataVDesigner";
import type { EChartsOption } from "echarts";

export const DataVRuntimePage = () => {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [screenConfig, setScreenConfig] = useState<any | null>(null);
  const [components, setComponents] = useState<ComponentConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState<Record<string, EChartsOption>>({});
  const [tableDataMap, setTableDataMap] = useState<Record<string, { columns: any[]; data: any[] }>>({});
  const [screens, setScreens] = useState<any[]>([]);

  useEffect(() => {
    if (!appId) return;

    const screenId = searchParams.get("screenId") || undefined;

    (async () => {
      setLoading(true);
      try {
        const app = await applicationApi.getById(appId);
        const screens = (app.metadata?.datavScreens as any[]) || [];
        setScreens(screens);
        
        if (!screens.length) {
          message.warning("当前应用还没有配置数据大屏");
          return;
        }

        const screen = screenId
          ? screens.find((s) => s.screenId === screenId)
          : screens[0];

        if (!screen) {
          message.warning("数据大屏不存在");
          return;
        }

        setScreenConfig(screen);
        setComponents(screen.components || []);

        // 加载所有图表的数据
        const dataMap: Record<string, EChartsOption> = {};
        const tableMap: Record<string, { columns: any[]; data: any[] }> = {};
        for (const component of screen.components || []) {
          if (component.type === "chart" && component.dataSource) {
            try {
              const option = await loadChartData(component);
              dataMap[component.id] = option;
            } catch (e) {
              console.error(`加载图表 ${component.id} 数据失败:`, e);
            }
          }
          if (component.type === "table" && component.dataSource?.formId) {
            try {
              const table = await loadTableData(component);
              tableMap[component.id] = table;
            } catch (e) {
              console.error(`加载表格 ${component.id} 数据失败:`, e);
            }
          }
        }
        setChartData(dataMap);
        setTableDataMap(tableMap);
      } catch (e) {
        console.error(e);
        message.error("加载数据大屏失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [appId, searchParams]);

  // 加载图表数据
  const loadChartData = async (component: ComponentConfig): Promise<EChartsOption> => {
    if (!component.dataSource?.formId || !component.dataSource.xFieldId || !component.dataSource.yFieldId) {
      return component.echartsOption || {};
    }

    const rows = await formDataApi.getListByForm(component.dataSource.formId);
    const xData: string[] = [];
    const yData: number[] = [];

    (rows || []).forEach((row: any) => {
      const data = row.data || {};
      xData.push(String(data[component.dataSource!.xFieldId!] ?? ""));
      const v = Number(data[component.dataSource!.yFieldId!] ?? 0);
      yData.push(Number.isFinite(v) ? v : 0);
    });

    // 根据图表类型生成配置
    const baseOption = component.echartsOption || {};
    const chartType = component.chartType || "bar";

    switch (chartType) {
      case "line":
        return {
          ...baseOption,
          xAxis: { type: "category", data: xData },
          yAxis: { type: "value" },
          series: [
            {
              type: "line",
              data: yData,
              ...(baseOption.series?.[0] || {}),
            },
          ],
        };
      case "bar":
        return {
          ...baseOption,
          xAxis: { type: "category", data: xData },
          yAxis: { type: "value" },
          series: [
            {
              type: "bar",
              data: yData,
              ...(baseOption.series?.[0] || {}),
            },
          ],
        };
      case "pie":
        return {
          ...baseOption,
          tooltip: { trigger: "item" },
          series: [
            {
              type: "pie",
              data: xData.map((name, idx) => ({
                name,
                value: yData[idx] ?? 0,
              })),
              ...(baseOption.series?.[0] || {}),
            },
          ],
        };
      default:
        return {
          ...baseOption,
          xAxis: { type: "category", data: xData },
          yAxis: { type: "value" },
          series: [
            {
              type: chartType,
              data: yData,
              ...(baseOption.series?.[0] || {}),
            },
          ],
        };
    }
  };

  // 加载表格数据
  const loadTableData = async (component: ComponentConfig) => {
    const formId = component.dataSource?.formId;
    if (!formId) return { columns: [], data: [] };

    const formDef = await formDefinitionApi.getById(formId);
    const fields = formDef.fields || [];
    const rows = await formDataApi.getListByForm(formId);

    const columns = fields.map((field: any) => ({
      title: field.label || field.fieldName || field.fieldId,
      dataIndex: field.fieldId,
      key: field.fieldId,
    }));

    const data = (rows || []).map((row: any, index: number) => {
      const record: any = { key: index };
      const rowData = row.data || {};
      fields.forEach((field: any) => {
        record[field.fieldId] = rowData[field.fieldId] ?? "";
      });
      return record;
    });

    return { columns, data };
  };

  const renderComponent = (component: ComponentConfig) => {
    const style: React.CSSProperties = {
      position: "absolute",
      left: component.x,
      top: component.y,
      width: component.width,
      height: component.height,
      zIndex: component.zIndex || 1,
      ...component.style,
    };

    switch (component.type) {
      case "chart":
        const option = chartData[component.id] || component.echartsOption || {};
        return (
          <div key={component.id} style={style}>
            <ReactECharts
              option={option}
              style={{ width: "100%", height: "100%" }}
              opts={{ renderer: "svg" }}
            />
          </div>
        );
      case "decoration":
        return (
          <div key={component.id} style={style}>
            {renderDecoration(component.decorationType!)}
          </div>
        );
      case "text":
        return (
          <div key={component.id} style={{ ...style, ...component.textStyle }}>
            {component.text || ""}
          </div>
        );
      case "image":
        return (
          <div key={component.id} style={style}>
            <img
              src={component.imageUrl || ""}
              alt=""
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
        );
      case "table":
        return (
          <div key={component.id} style={style}>
            <Table
              columns={tableDataMap[component.id]?.columns || []}
              dataSource={tableDataMap[component.id]?.data || []}
              pagination={false}
              size="small"
              scroll={{ x: true, y: component.height - 40 }}
            />
          </div>
        );
      default:
        return null;
    }
  };

  const renderDecoration = (type: string) => {
    const props = { style: { width: "100%", height: "100%" } };
    // BorderBox 组件需要 children 才能正确显示边框效果
    const borderBoxProps = { ...props, className: "border-box-content" };
    const DecorationMap: Record<string, React.ComponentType<any>> = {
      borderBox1: BorderBox1,
      borderBox2: BorderBox2,
      borderBox3: BorderBox3,
      borderBox4: BorderBox4,
      borderBox5: BorderBox5,
      borderBox6: BorderBox6,
      borderBox7: BorderBox7,
      borderBox8: BorderBox8,
      borderBox9: BorderBox9,
      borderBox10: BorderBox10,
      borderBox11: BorderBox11,
      borderBox12: BorderBox12,
      borderBox13: BorderBox13,
      decoration1: Decoration1,
      decoration2: Decoration2,
      decoration3: Decoration3,
      decoration4: Decoration4,
      decoration5: Decoration5,
      decoration6: Decoration6,
      decoration7: Decoration7,
      decoration8: Decoration8,
      decoration9: Decoration9,
      decoration10: Decoration10,
    };
    const Component = DecorationMap[type];
    if (!Component) return null;
    
    // BorderBox 组件需要 children
    if (type.startsWith("borderBox")) {
      return <Component {...borderBoxProps}><div style={{ width: "100%", height: "100%" }} /></Component>;
    }
    
    return <Component {...props} />;
  };

  if (loading) {
    return (
      <FullScreenContainer style={{ background: "#0f2a43" }}>
        <div
          style={{
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <Spin size="large" />
        </div>
      </FullScreenContainer>
    );
  }

  return (
    <FullScreenContainer style={{ background: "#0f2a43" }}>
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {screens.length > 0 && (
          <div style={{ position: "absolute", top: 16, left: 16, zIndex: 1000, width: 260 }}>
            <Select
              value={screenConfig?.screenId}
              style={{ width: "100%" }}
              placeholder="选择数据大屏"
              options={screens.map((s) => ({ label: s.screenName || s.screenId, value: s.screenId }))}
              onChange={(val) => {
                if (!appId) return;
                navigate(`/app/${appId}/datav?screenId=${val}`);
              }}
            />
          </div>
        )}
        {components.map((component) => renderComponent(component))}
        {components.length === 0 && (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#9ad1ff",
            }}
          >
            当前数据大屏还没有配置组件，请到「数据大屏设计器」中添加组件
          </div>
        )}
      </div>
    </FullScreenContainer>
  );
};

