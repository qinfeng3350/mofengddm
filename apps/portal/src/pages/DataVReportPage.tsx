import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { message } from "antd";
import ReactECharts from "echarts-for-react";
import {
  FullScreenContainer,
  BorderBox8,
  BorderBox1,
  Decoration8,
  Decoration10,
} from "@jiaminghi/data-view-react";
import { applicationApi } from "@/api/application";
import { formDataApi } from "@/api/formData";

type ChartItem = { id: string; title: string; option: any };

export const DataVReportPage = () => {
  const { appId } = useParams<{ appId: string }>();
  const [searchParams] = useSearchParams();
  const [items, setItems] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportName, setReportName] = useState<string>("");

  useEffect(() => {
    if (!appId) return;

    const reportId = searchParams.get("reportId") || undefined;

    (async () => {
      setLoading(true);
      try {
        const app = await applicationApi.getById(appId);
        const reports = (app.metadata?.reports as any[]) || [];
        if (!reports.length) {
          message.warning("当前应用还没有配置报表");
          setItems([]);
          return;
        }

        const report =
          (reportId && reports.find((r) => r.reportId === reportId)) ||
          reports[0];
        setReportName(report?.reportName || "数据大屏报表");

        if (!report || !report.widgets?.length) {
          message.warning("报表中没有配置图表");
          setItems([]);
          return;
        }

        const result: ChartItem[] = [];

        for (const widget of report.widgets) {
          const formId = widget.dataSourceFormId as string | undefined;
          const xFieldId = widget.xFieldId as string | undefined;
          const yFieldId = widget.yFieldId as string | undefined;

          if (!formId || !xFieldId || !yFieldId) continue;

          const rows = await formDataApi.getListByForm(formId);
          const xData: string[] = [];
          const yData: number[] = [];

          (rows || []).forEach((row: any) => {
            const data = row.data || {};
            xData.push(String(data[xFieldId] ?? ""));
            const v = Number(data[yFieldId] ?? 0);
            yData.push(Number.isFinite(v) ? v : 0);
          });

          let option: any;
          const title = widget.title || "报表";

          switch (widget.type) {
            case "pie":
              option = {
                title: { text: title, left: "center" },
                tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
                legend: { bottom: 0 },
                series: [
                  {
                    name: title,
                    type: "pie",
                    radius: "60%",
                    data: xData.map((name, idx) => ({ name, value: yData[idx] ?? 0 })),
                  },
                ],
              };
              break;
            case "line":
            case "area":
              option = {
                title: { text: title },
                tooltip: { trigger: "axis" },
                xAxis: { type: "category", data: xData },
                yAxis: { type: "value" },
                series: [
                  {
                    name: title,
                    type: "line",
                    areaStyle: widget.type === "area" ? {} : undefined,
                    data: yData,
                  },
                ],
              };
              break;
            case "scatter":
              option = {
                title: { text: title },
                tooltip: { trigger: "item" },
                xAxis: { type: "category", data: xData },
                yAxis: { type: "value" },
                series: [
                  {
                    name: title,
                    type: "scatter",
                    data: yData.map((v, idx) => [xData[idx], v]),
                  },
                ],
              };
              break;
            default:
              option = {
                title: { text: title },
                tooltip: { trigger: "axis" },
                xAxis: { type: "category", data: xData },
                yAxis: { type: "value" },
                series: [
                  {
                    name: title,
                    type: "bar",
                    data: yData,
                  },
                ],
              };
          }

          result.push({
            id: widget.id || `${widget.type}_${widget.xFieldId}_${widget.yFieldId}`,
            title,
            option,
          });
        }

        setItems(result);
      } catch (e) {
        console.error(e);
        message.error("加载报表数据失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [appId, searchParams]);

  return (
    <FullScreenContainer style={{ background: "#0f2a43" }}>
      <div style={{ height: "100%", padding: 16, boxSizing: "border-box" }}>
        <div style={{ height: 72 }}>
          <BorderBox8 style={{ height: "100%" }}>
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#cce6ff",
                fontSize: 20,
                letterSpacing: 2,
              }}
            >
              {reportName || "数据大屏报表"}
            </div>
          </BorderBox8>
        </div>

        <div style={{ height: 12 }}>
          <Decoration8 style={{ width: "100%", height: "100%" }} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            alignItems: "stretch",
            height: "calc(100% - 84px)",
            overflow: "auto",
            paddingBottom: 8,
          }}
        >
          {loading ? (
            <BorderBox1>
              <div
                style={{
                  height: 420,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ad1ff",
                }}
              >
                正在加载数据...
              </div>
            </BorderBox1>
          ) : items.length ? (
            items.map((item) => (
              <BorderBox1 key={item.id} style={{ padding: 8 }} className="border-box-content">
                <ReactECharts option={item.option} style={{ height: 420 }} />
              </BorderBox1>
            ))
          ) : (
            <BorderBox1 className="border-box-content">
              <div
                style={{
                  height: 420,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9ad1ff",
                }}
              >
                当前报表还没有配置可视化图表，请到「报表设计器」中为报表添加并配置图表。
              </div>
            </BorderBox1>
          )}
        </div>

        <div style={{ position: "fixed", right: 16, bottom: 16 }}>
          <Decoration10 style={{ width: 200, height: 40 }} />
        </div>
      </div>
    </FullScreenContainer>
  );
};
