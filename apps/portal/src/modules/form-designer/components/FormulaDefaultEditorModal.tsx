import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Collapse, Input, Modal, Tabs, Tag, Typography } from "antd";
import { CalculatorOutlined, FormOutlined } from "@ant-design/icons";
import { FormulaChipEditor, type FormulaChipEditorHandle } from "./FormulaChipEditor";

export type FormulaVarItem = {
  refId: string;
  label: string;
  typeLabel: string;
};

type FnDef = {
  name: string;
  insert: string;
  category: string;
  desc: string;
  syntax: string;
  example: string;
  note?: string;
};

function fieldTypeLabel(type: string): string {
  const m: Record<string, string> = {
    input: "文本",
    textarea: "多行文本",
    number: "数字",
    select: "单选",
    multiselect: "多选",
    date: "日期",
    datetime: "时间戳",
    checkbox: "勾选",
    boolean: "是/否",
    radio: "单选框",
    attachment: "附件",
    subtable: "子表",
    formula: "公式",
    user: "成员",
    department: "部门",
    serial: "流水号",
    creator: "成员",
    owner: "成员",
    createTime: "时间戳",
    updateTime: "时间戳",
    relatedForm: "关联",
    relatedFormMulti: "关联",
    button: "按钮",
    signature: "签名",
    aiRecognition: "识别",
  };
  return m[type] || type || "字段";
}

function collectVarsForTab(
  formSchema: { fields?: any[] },
  excludeFieldId: string,
  tab: "current" | "all"
): FormulaVarItem[] {
  const out: FormulaVarItem[] = [];
  const fields = formSchema.fields || [];

  for (const f of fields) {
    if (!f?.fieldId || f.fieldId === excludeFieldId) continue;

    if (f.type === "subtable") {
      const cols = f.subtableFields || [];
      const parentLabel = f.label || f.fieldId;
      for (const c of cols) {
        if (!c?.fieldId || c.fieldId === excludeFieldId) continue;
        const colLabel = c.label || c.fieldId;
        out.push({
          refId: `${f.fieldId}.${c.fieldId}`,
          label: `${parentLabel}.${colLabel}`,
          typeLabel: "数组",
        });
      }
      if (cols.length === 0) {
        out.push({
          refId: f.fieldId,
          label: parentLabel,
          typeLabel: "子表",
        });
      }
      if (tab === "all" && cols.length > 0) {
        out.push({
          refId: f.fieldId,
          label: `${parentLabel}（整表）`,
          typeLabel: "子表",
        });
      }
    } else {
      out.push({
        refId: f.fieldId,
        label: f.label || f.fieldId,
        typeLabel: fieldTypeLabel(f.type),
      });
    }
  }

  return out;
}

function buildRefLabelMap(formSchema: { fields?: any[] }): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of formSchema.fields || []) {
    if (!f?.fieldId) continue;
    if (f.type === "subtable") {
      const parentLabel = f.label || f.fieldId;
      map.set(f.fieldId, parentLabel);
      for (const c of f.subtableFields || []) {
        if (!c?.fieldId) continue;
        map.set(`${f.fieldId}.${c.fieldId}`, `${parentLabel}.${c.label || c.fieldId}`);
      }
    } else {
      map.set(f.fieldId, f.label || f.fieldId);
    }
  }
  return map;
}

const FORMULA_FUNCTIONS: FnDef[] = [
  {
    name: "SUM",
    insert: "SUM(",
    category: "常用函数",
    desc: "对多个数值或子表列（数组）中的数字求和。",
    syntax: "SUM(数字1, 数字2, ...)",
    example: "SUM({单价}, {数量}) 或 SUM({明细.金额})",
    note: "子表列引用会得到多行组成的数组，SUM 会展开后累加。",
  },
  {
    name: "AVERAGE",
    insert: "AVERAGE(",
    category: "常用函数",
    desc: "计算算术平均值（参数可为多个数值或数组）。",
    syntax: "AVERAGE(数字1, 数字2, ...)",
    example: "AVERAGE({a}, {b})",
  },
  {
    name: "MAX",
    insert: "MAX(",
    category: "常用函数",
    desc: "返回参数中的最大值。",
    syntax: "MAX(数字1, 数字2, ...)",
    example: "MAX({a}, {b})",
  },
  {
    name: "MIN",
    insert: "MIN(",
    category: "常用函数",
    desc: "返回参数中的最小值。",
    syntax: "MIN(数字1, 数字2, ...)",
    example: "MIN({a}, {b})",
  },
  {
    name: "ABS",
    insert: "ABS(",
    category: "数学函数",
    desc: "返回数字的绝对值。",
    syntax: "ABS(数字)",
    example: "ABS({field_a})",
  },
  {
    name: "ROUND",
    insert: "ROUND(",
    category: "数学函数",
    desc: "将数字四舍五入到指定小数位。",
    syntax: "ROUND(数字, 小数位)",
    example: "ROUND({field_a}, 2)",
  },
  {
    name: "FLOOR",
    insert: "FLOOR(",
    category: "数学函数",
    desc: "向下取整。",
    syntax: "FLOOR(数字)",
    example: "FLOOR({field_a})",
  },
  {
    name: "CEILING",
    insert: "CEILING(",
    category: "数学函数",
    desc: "向上取整。",
    syntax: "CEILING(数字)",
    example: "CEILING({field_a})",
  },
  {
    name: "POWER",
    insert: "POWER(",
    category: "数学函数",
    desc: "返回数字的乘幂。",
    syntax: "POWER(底数, 指数)",
    example: "POWER({r}, 2)",
  },
  {
    name: "CONCATENATE",
    insert: "CONCATENATE(",
    category: "文本函数",
    desc: "将多段文本连接成一个字符串；数组会按行拼接。",
    syntax: "CONCATENATE(文本1, 文本2, ...)",
    example: "CONCATENATE({姓}, {名})",
  },
  {
    name: "LEN",
    insert: "LEN(",
    category: "文本函数",
    desc: "文本返回字符数；数组返回元素个数。",
    syntax: "LEN(文本或数组)",
    example: "LEN({field_a})",
  },
  {
    name: "LEFT",
    insert: "LEFT(",
    category: "文本函数",
    desc: "从左侧截取指定长度的字符。",
    syntax: "LEFT(文本, 字符数)",
    example: "LEFT({code}, 4)",
  },
  {
    name: "RIGHT",
    insert: "RIGHT(",
    category: "文本函数",
    desc: "从右侧截取指定长度的字符。",
    syntax: "RIGHT(文本, 字符数)",
    example: "RIGHT({code}, 4)",
  },
  {
    name: "UPPER",
    insert: "UPPER(",
    category: "文本函数",
    desc: "转为大写。",
    syntax: "UPPER(文本)",
    example: "UPPER({name})",
  },
  {
    name: "LOWER",
    insert: "LOWER(",
    category: "文本函数",
    desc: "转为小写。",
    syntax: "LOWER(文本)",
    example: "LOWER({name})",
  },
  {
    name: "YEAR",
    insert: "YEAR(",
    category: "日期函数",
    desc: "从日期时间字符串解析年份。",
    syntax: "YEAR(日期文本)",
    example: "YEAR({日期})",
  },
  {
    name: "MONTH",
    insert: "MONTH(",
    category: "日期函数",
    desc: "解析月份（1-12）。",
    syntax: "MONTH(日期文本)",
    example: "MONTH({日期})",
  },
  {
    name: "DAY",
    insert: "DAY(",
    category: "日期函数",
    desc: "解析日。",
    syntax: "DAY(日期文本)",
    example: "DAY({日期})",
  },
  {
    name: "DATEDIF",
    insert: "DATEDIF(",
    category: "日期函数",
    desc: "两日期之差；第三参数为 D（天，默认）、M（月）、Y（年）。",
    syntax: "DATEDIF(开始, 结束, \"D\" | \"M\" | \"Y\")",
    example: "DATEDIF({开始},{结束},\"D\")",
  },
  {
    name: "IF",
    insert: "IF(",
    category: "逻辑函数",
    desc: "条件为真返回第二参数，否则第三参数。",
    syntax: "IF(条件, 真值, 假值)",
    example: "IF({qty} > 0, {qty}, 0)",
  },
  {
    name: "AND",
    insert: "AND(",
    category: "逻辑函数",
    desc: "所有条件为真时返回真。",
    syntax: "AND(条件1, 条件2, ...)",
    example: "AND({a} > 0, {b} > 0)",
  },
  {
    name: "OR",
    insert: "OR(",
    category: "逻辑函数",
    desc: "任一条件为真时返回真。",
    syntax: "OR(条件1, 条件2, ...)",
    example: "OR({a} > 0, {b} > 0)",
  },
  {
    name: "COUNTA",
    insert: "COUNTA(",
    category: "子表单函数",
    desc: "统计非空参数个数（适合统计子表列有值的行或参数列表）。",
    syntax: "COUNTA(值1, 值2, ...)",
    example: "COUNTA({明细.姓名})",
  },
];

const CATEGORY_ORDER = [
  "常用函数",
  "数学函数",
  "文本函数",
  "日期函数",
  "逻辑函数",
  "高级函数",
  "子表单函数",
];

const FNS_BY_CATEGORY = CATEGORY_ORDER.map((cat) => ({
  key: cat,
  label: cat,
  children: FORMULA_FUNCTIONS.filter((f) => f.category === cat),
})).filter((x) => x.children.length > 0);

export function FormulaDefaultEditorModal({
  open,
  onCancel,
  onConfirm,
  initialExpression,
  formSchema,
  excludeFieldId,
  valueKind,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (expression: string) => void;
  initialExpression: string;
  formSchema: { formName?: string; fields?: any[] };
  excludeFieldId: string;
  valueKind: "number" | "text";
}) {
  const [varTab, setVarTab] = useState<"current" | "all">("current");
  const [fnSearch, setFnSearch] = useState("");
  const [editorEpoch, setEditorEpoch] = useState(0);
  const [selectedFn, setSelectedFn] = useState<FnDef | null>(
    () => FORMULA_FUNCTIONS.find((f) => f.name === "CONCATENATE") || null
  );
  const chipRef = useRef<FormulaChipEditorHandle>(null);

  useEffect(() => {
    if (open) {
      setVarTab("current");
      setFnSearch("");
      setSelectedFn(FORMULA_FUNCTIONS.find((f) => f.name === "CONCATENATE") || null);
      setEditorEpoch((e) => e + 1);
    }
  }, [open, initialExpression]);

  const refLabelMap = useMemo(() => buildRefLabelMap(formSchema), [formSchema]);
  const getLabel = useMemo(
    () => (ref: string) => refLabelMap.get(ref) || ref,
    [refLabelMap]
  );

  const varsCurrent = useMemo(
    () => collectVarsForTab(formSchema, excludeFieldId, "current"),
    [formSchema, excludeFieldId]
  );
  const varsAll = useMemo(
    () => collectVarsForTab(formSchema, excludeFieldId, "all"),
    [formSchema, excludeFieldId]
  );

  const formTitle = formSchema.formName || "当前表单";

  const collapseItems = useMemo(() => {
    const q = fnSearch.trim().toLowerCase();
    const match = (f: FnDef) => {
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q)
      );
    };
    return FNS_BY_CATEGORY.map((group) => {
      const list = group.children.filter(match);
      return {
        key: group.key,
        label: `${group.label}（${list.length}）`,
        children: (
          <div>
            {list.map((f) => (
              <button
                key={f.name}
                type="button"
                onClick={() => {
                  setSelectedFn(f);
                  chipRef.current?.insertText(f.insert);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 8px",
                  marginBottom: 4,
                  border:
                    selectedFn?.name === f.name ? "1px solid #1677ff" : "1px solid #f0f0f0",
                  borderRadius: 6,
                  background: selectedFn?.name === f.name ? "#e6f4ff" : "#fafafa",
                  cursor: "pointer",
                }}
              >
                <Typography.Text strong>{f.name}</Typography.Text>
              </button>
            ))}
          </div>
        ),
      };
    }).filter((panel) => {
      const n = parseInt(panel.label.match(/（(\d+)）/)?.[1] || "0", 10);
      return n > 0;
    });
  }, [fnSearch, selectedFn?.name]);

  const headerLabel = valueKind === "number" ? "数字" : "文本";

  const varList = (items: FormulaVarItem[]) => (
    <div style={{ maxHeight: 200, overflow: "auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
          paddingBottom: 6,
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <FormOutlined style={{ color: "#1677ff" }} />
        <Typography.Text strong style={{ fontSize: 13 }}>
          {formTitle}
        </Typography.Text>
      </div>
      {items.length === 0 ? (
        <Typography.Text type="secondary">暂无字段</Typography.Text>
      ) : (
        items.map((v) => (
          <button
            key={`${v.refId}-${v.label}`}
            type="button"
            onClick={() => chipRef.current?.insertVariable(v.refId, v.label)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              marginBottom: 4,
              border: "1px solid #f0f0f0",
              borderRadius: 6,
              background: "#fafafa",
              cursor: "pointer",
            }}
          >
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {v.label}
            </span>
            <Tag style={{ margin: 0 }}>{v.typeLabel}</Tag>
          </button>
        ))
      )}
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      width={960}
      footer={null}
      destroyOnClose
      styles={{ body: { paddingTop: 12 } }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            公式编辑
          </Typography.Title>
          <Typography.Text type="secondary">使用数学运算符编辑公式</Typography.Text>
        </div>
        <CalculatorOutlined style={{ fontSize: 22, color: "#1677ff" }} />
      </div>

      <div style={{ border: "1px solid #d9d9d9", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ background: "#e6f4ff", padding: "6px 12px", fontSize: 13, color: "#0958d9", fontWeight: 500 }}>
          {headerLabel} =
        </div>
        <FormulaChipEditor
          key={`${editorEpoch}-${excludeFieldId}`}
          ref={chipRef}
          initialExpression={initialExpression}
          getLabel={getLabel}
        />
      </div>

      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 8, fontSize: 12 }}>
        提示：变量以名称标签展示，保存仍为 {""}
        <Typography.Text code>{`{字段引用}`}</Typography.Text>
        ；字符串请用英文半角引号，例如 {""}
        <Typography.Text code>CONCATENATE(&apos;前缀&apos;, …)</Typography.Text>。
      </Typography.Text>

      <div style={{ display: "flex", gap: 12, minHeight: 260 }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            padding: 8,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Typography.Text strong style={{ marginBottom: 8 }}>
            可用变量
          </Typography.Text>
          <Tabs
            size="small"
            activeKey={varTab}
            onChange={(k) => setVarTab(k as "current" | "all")}
            items={[
              { key: "current", label: "当前表单字段", children: varList(varsCurrent) },
              { key: "all", label: "所有表单字段", children: varList(varsAll) },
            ]}
          />
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            padding: 8,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Typography.Text strong>函数</Typography.Text>
          <Input.Search
            allowClear
            placeholder="搜索函数"
            size="small"
            value={fnSearch}
            onChange={(e) => setFnSearch(e.target.value)}
          />
          <div style={{ flex: 1, overflow: "auto", maxHeight: 220 }}>
            <Collapse defaultActiveKey={FNS_BY_CATEGORY.map((g) => g.key)} size="small" items={collapseItems} />
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: 0,
            border: "1px solid #f0f0f0",
            borderRadius: 8,
            padding: 12,
            background: "#fafafa",
          }}
        >
          <Typography.Text strong>函数说明</Typography.Text>
          {selectedFn ? (
            <div style={{ marginTop: 12 }}>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                {selectedFn.name}
              </Typography.Title>
              <Typography.Paragraph style={{ marginBottom: 8 }}>{selectedFn.desc}</Typography.Paragraph>
              <Typography.Text type="secondary">用法：</Typography.Text>
              <pre
                style={{
                  margin: "8px 0",
                  padding: 8,
                  background: "#fff",
                  borderRadius: 4,
                  fontSize: 12,
                  overflow: "auto",
                }}
              >
                {selectedFn.syntax}
              </pre>
              <Typography.Text type="secondary">示例：</Typography.Text>
              <pre
                style={{
                  margin: "8px 0 0",
                  padding: 8,
                  background: "#fff",
                  borderRadius: 4,
                  fontSize: 12,
                  overflow: "auto",
                }}
              >
                {selectedFn.example}
              </pre>
              {selectedFn.note ? (
                <>
                  <Typography.Text type="secondary">备注：</Typography.Text>
                  <Typography.Paragraph style={{ marginTop: 4 }}>{selectedFn.note}</Typography.Paragraph>
                </>
              ) : null}
            </div>
          ) : (
            <Typography.Text type="secondary" style={{ display: "block", marginTop: 12 }}>
              请从左侧选择一个函数
            </Typography.Text>
          )}
        </div>
      </div>

      <div style={{ textAlign: "right", marginTop: 20, paddingTop: 12, borderTop: "1px solid #f0f0f0" }}>
        <Button onClick={onCancel} style={{ marginRight: 8 }}>
          取消
        </Button>
        <Button
          type="primary"
          onClick={() => onConfirm(chipRef.current?.getExpression() ?? "")}
        >
          确定
        </Button>
      </div>
    </Modal>
  );
}
