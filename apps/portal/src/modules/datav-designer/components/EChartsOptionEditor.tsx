import { useState, useEffect } from "react";
import { Form, Input, Switch, Select, Button, Modal, message, Collapse } from "antd";
import { CodeOutlined } from "@ant-design/icons";
import type { EChartsOption } from "echarts";

const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

interface EChartsOptionEditorProps {
  option: EChartsOption;
  onChange: (option: EChartsOption) => void;
}

export const EChartsOptionEditor = ({ option, onChange }: EChartsOptionEditorProps) => {
  const [form] = Form.useForm();
  const [jsonEditorVisible, setJsonEditorVisible] = useState(false);
  const [jsonValue, setJsonValue] = useState("");

  useEffect(() => {
    form.setFieldsValue({
      title: typeof option.title === "object" ? option.title?.text : option.title,
      tooltip: option.tooltip ? true : false,
      legend: option.legend ? true : false,
      grid: option.grid ? true : false,
    });
  }, [option, form]);

  const handleValuesChange = (changedValues: any) => {
    const newOption: EChartsOption = { ...option };

    if (changedValues.title !== undefined) {
      newOption.title = {
        text: changedValues.title,
        left: "center",
        ...(typeof option.title === "object" ? option.title : {}),
      };
    }

    if (changedValues.tooltip !== undefined) {
      newOption.tooltip = changedValues.tooltip
        ? { trigger: "axis" }
        : undefined;
    }

    if (changedValues.legend !== undefined) {
      newOption.legend = changedValues.legend
        ? { bottom: 0 }
        : undefined;
    }

    if (changedValues.grid !== undefined) {
      newOption.grid = changedValues.grid
        ? { left: "3%", right: "4%", bottom: "3%", containLabel: true }
        : undefined;
    }

    onChange(newOption);
  };

  const handleOpenJsonEditor = () => {
    setJsonValue(JSON.stringify(option, null, 2));
    setJsonEditorVisible(true);
  };

  const handleSaveJson = () => {
    try {
      const parsed = JSON.parse(jsonValue);
      onChange(parsed);
      setJsonEditorVisible(false);
      message.success("配置已更新");
    } catch (e) {
      message.error("JSON格式错误，请检查语法");
    }
  };

  return (
    <>
      <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
        <Collapse defaultActiveKey={["basic", "series", "axis"]}>
          <Panel header="基础配置" key="basic">
            <Form.Item label="标题" name="title">
              <Input placeholder="图表标题" />
            </Form.Item>
            <Form.Item label="显示提示框" name="tooltip" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="显示图例" name="legend" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="显示网格" name="grid" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Panel>
          <Panel header="系列配置" key="series">
            <SeriesConfigPanel option={option} onChange={onChange} />
          </Panel>
          <Panel header="坐标轴配置" key="axis">
            <AxisConfigPanel option={option} onChange={onChange} />
          </Panel>
        </Collapse>
        <div style={{ marginTop: 16 }}>
          <Button
            type="primary"
            icon={<CodeOutlined />}
            block
            onClick={handleOpenJsonEditor}
          >
            打开 JSON 编辑器（完整配置）
          </Button>
        </div>
      </Form>

      <Modal
        title="ECharts 配置编辑器"
        open={jsonEditorVisible}
        onOk={handleSaveJson}
        onCancel={() => setJsonEditorVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <TextArea
            value={jsonValue}
            onChange={(e) => setJsonValue(e.target.value)}
            rows={20}
            style={{ fontFamily: "monospace" }}
          />
        </div>
        <div style={{ marginTop: 16 }}>
          <TextArea
            value={JSON.stringify(option, null, 2)}
            readOnly
            rows={10}
            style={{ fontFamily: "monospace", background: "#f5f5f5" }}
          />
        </div>
      </Modal>
    </>
  );
};

// 系列配置面板
const SeriesConfigPanel = ({
  option,
  onChange,
}: {
  option: EChartsOption;
  onChange: (option: EChartsOption) => void;
}) => {
  const series = option.series || [];
  const firstSeries = Array.isArray(series) ? series[0] : series;

  const handleSeriesChange = (field: string, value: any) => {
    const newSeries = Array.isArray(series)
      ? series.map((s, idx) => (idx === 0 ? { ...s, [field]: value } : s))
      : { ...series, [field]: value };
    onChange({ ...option, series: newSeries });
  };

  return (
    <div>
      <Form.Item label="图表类型">
        <Select
          value={firstSeries?.type || "bar"}
          onChange={(value) => handleSeriesChange("type", value)}
        >
          <Option value="line">折线图</Option>
          <Option value="bar">柱状图</Option>
          <Option value="pie">饼图</Option>
          <Option value="scatter">散点图</Option>
          <Option value="radar">雷达图</Option>
          <Option value="heatmap">热力图</Option>
          <Option value="funnel">漏斗图</Option>
          <Option value="gauge">仪表盘</Option>
          <Option value="tree">树图</Option>
          <Option value="treemap">矩形树图</Option>
          <Option value="sunburst">旭日图</Option>
          <Option value="boxplot">箱线图</Option>
          <Option value="candlestick">K线图</Option>
          <Option value="map">地图</Option>
          <Option value="parallel">平行坐标</Option>
          <Option value="sankey">桑基图</Option>
          <Option value="themeRiver">主题河流图</Option>
          <Option value="graph">关系图</Option>
        </Select>
      </Form.Item>
      <Form.Item label="系列名称">
        <Input
          value={firstSeries?.name || ""}
          onChange={(e) => handleSeriesChange("name", e.target.value)}
        />
      </Form.Item>
      {firstSeries?.type === "line" && (
        <Form.Item label="平滑曲线">
          <Switch
            checked={firstSeries.smooth || false}
            onChange={(checked) => handleSeriesChange("smooth", checked)}
          />
        </Form.Item>
      )}
      {firstSeries?.type === "bar" && (
        <Form.Item label="柱状图样式">
          <Select
            value={firstSeries.barWidth || "auto"}
            onChange={(value) => handleSeriesChange("barWidth", value)}
          >
            <Option value="auto">自动</Option>
            <Option value={20}>20px</Option>
            <Option value={40}>40px</Option>
            <Option value={60}>60px</Option>
          </Select>
        </Form.Item>
      )}
    </div>
  );
};

// 坐标轴配置面板
const AxisConfigPanel = ({
  option,
  onChange,
}: {
  option: EChartsOption;
  onChange: (option: EChartsOption) => void;
}) => {
  const handleAxisChange = (axis: "xAxis" | "yAxis", field: string, value: any) => {
    const axisConfig = option[axis];
    const newAxis = Array.isArray(axisConfig)
      ? axisConfig.map((a, idx) => (idx === 0 ? { ...a, [field]: value } : a))
      : { ...axisConfig, [field]: value };
    onChange({ ...option, [axis]: newAxis });
  };

  return (
    <div>
      <Form.Item label="X轴类型">
        <Select
          value={
            Array.isArray(option.xAxis)
              ? option.xAxis[0]?.type
              : option.xAxis?.type || "category"
          }
          onChange={(value) => handleAxisChange("xAxis", "type", value)}
        >
          <Option value="category">类目轴</Option>
          <Option value="value">数值轴</Option>
          <Option value="time">时间轴</Option>
          <Option value="log">对数轴</Option>
        </Select>
      </Form.Item>
      <Form.Item label="Y轴类型">
        <Select
          value={
            Array.isArray(option.yAxis)
              ? option.yAxis[0]?.type
              : option.yAxis?.type || "value"
          }
          onChange={(value) => handleAxisChange("yAxis", "type", value)}
        >
          <Option value="category">类目轴</Option>
          <Option value="value">数值轴</Option>
          <Option value="time">时间轴</Option>
          <Option value="log">对数轴</Option>
        </Select>
      </Form.Item>
    </div>
  );
};
