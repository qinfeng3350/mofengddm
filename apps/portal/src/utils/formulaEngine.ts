/**
 * 表单公式求值：字段引用 {fieldId} 或 {子表fieldId.列fieldId}，以及常用函数。
 * 不含任意 eval 用户原始串；通过 new Function 注入白名单函数与 getValue。
 */

export function extractFormulaRefs(expression: string): string[] {
  const refs: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(expression))) {
    refs.push(m[1].trim());
  }
  return [...new Set(refs)];
}

function parseRef(ref: string): { parent: string; child?: string } {
  const i = ref.indexOf(".");
  if (i === -1) return { parent: ref };
  return { parent: ref.slice(0, i), child: ref.slice(i + 1) };
}

export function rawFormValue(
  ref: string,
  formValues: Record<string, unknown>
): unknown {
  const { parent, child } = parseRef(ref);
  const v = formValues[parent];
  if (child) {
    if (Array.isArray(v)) {
      return v.map((row) =>
        row && typeof row === "object" ? (row as Record<string, unknown>)[child] : undefined
      );
    }
    if (v && typeof v === "object") {
      return (v as Record<string, unknown>)[child];
    }
    return undefined;
  }
  return v;
}

/** 将设计器里可能出现的「字段标题」或混写引用解析为存储用的 fieldId / 子表.列Id */
export function resolveRefToStorageKey(
  ref: string,
  formSchema?: { fields?: any[] }
): string {
  const r = ref.trim();
  if (!formSchema?.fields?.length) return r;

  if (r.includes(".")) {
    const [a, b] = r.split(".", 2);
    const st = formSchema.fields.find(
      (f: any) => f?.fieldId === a || f?.label === a
    );
    if (st?.type === "subtable" && Array.isArray(st.subtableFields)) {
      const col = st.subtableFields.find(
        (c: any) => c?.fieldId === b || c?.label === b
      );
      if (col) return `${st.fieldId}.${col.fieldId}`;
    }
    return r;
  }

  const f = formSchema.fields.find(
    (x: any) => x?.fieldId === r || x?.label === r
  );
  if (f?.fieldId) return f.fieldId;

  // 顶层字段没有命中时，尝试在所有子表列里匹配：
  // 允许在子表公式里写 `{单价}`、`{数量}` 这类“仅列名”的引用。
  //
  // 这里的关键策略：如果引用本身不带点号（没有明确子表前缀），我们返回“列 fieldId”（不带子表前缀）。
  // 这样在子表逐行公式计算时，evaluate 的上下文会把当前行 record 展平进 formValues，
  // rawFormValue 能直接取到当前行的标量值，而不是整列数组。
  for (const top of formSchema.fields) {
    if (top?.type !== "subtable") continue;
    const cols = top?.subtableFields;
    if (!Array.isArray(cols)) continue;
    const col = cols.find((c: any) => c?.fieldId === r || c?.label === r);
    if (col?.fieldId) return col.fieldId;
  }

  return r;
}

/** 用于触发重算：按解析后的顶层字段 id 序列化当前值 */
export function formulaDependencyWatchKey(
  expression: string,
  formValues: Record<string, unknown>,
  formSchema?: { fields?: any[] }
): string {
  const refs = extractFormulaRefs(expression);
  if (!refs.length) return "";
  return refs
    .map((ref) => {
      const key = resolveRefToStorageKey(ref, formSchema);
      const top = key.includes(".") ? key.slice(0, key.indexOf(".")) : key;
      return `${top}:${JSON.stringify(formValues[top])}`;
    })
    .join("\x1e");
}

function toNumber(x: unknown): number | null {
  if (x === null || x === undefined || x === "") return null;
  if (typeof x === "number" && !Number.isNaN(x)) return x;
  const n = parseFloat(String(x).replace(/,/g, ""));
  return Number.isNaN(n) ? null : n;
}

function flattenArgs(args: unknown[]): unknown[] {
  const out: unknown[] = [];
  for (const a of args) {
    if (Array.isArray(a)) out.push(...a);
    else out.push(a);
  }
  return out;
}

function truthy(x: unknown): boolean {
  if (x === false || x === 0 || x === "" || x == null) return false;
  if (Array.isArray(x)) return x.length > 0;
  return true;
}

function parseDate(d: unknown): Date | null {
  if (d == null || d === "") return null;
  const t = new Date(String(d));
  return Number.isNaN(t.getTime()) ? null : t;
}

function SUM(...args: unknown[]): number {
  let s = 0;
  for (const x of flattenArgs(args)) {
    const n = toNumber(x);
    if (n !== null) s += n;
  }
  return s;
}

function AVERAGE(...args: unknown[]): number {
  const nums = flattenArgs(args)
    .map(toNumber)
    .filter((n): n is number => n !== null);
  if (!nums.length) return 0;
  return SUM(...nums) / nums.length;
}

function MAX(...args: unknown[]): number {
  const nums = flattenArgs(args)
    .map(toNumber)
    .filter((n): n is number => n !== null);
  return nums.length ? Math.max(...nums) : 0;
}

function MIN(...args: unknown[]): number {
  const nums = flattenArgs(args)
    .map(toNumber)
    .filter((n): n is number => n !== null);
  return nums.length ? Math.min(...nums) : 0;
}

function ABS(x: unknown): number {
  const n = toNumber(x);
  return n == null ? 0 : Math.abs(n);
}

function ROUND(x: unknown, digits: unknown = 0): number {
  const n = toNumber(x);
  if (n == null) return 0;
  const d = Math.floor(toNumber(digits) ?? 0);
  const m = Math.pow(10, d);
  return Math.round(n * m) / m;
}

function FLOOR(x: unknown): number {
  const n = toNumber(x);
  return n == null ? 0 : Math.floor(n);
}

function CEILING(x: unknown): number {
  const n = toNumber(x);
  return n == null ? 0 : Math.ceil(n);
}

function CONCATENATE(...args: unknown[]): string {
  return flattenArgs(args)
    .map((x) => {
      if (x == null) return "";
      if (Array.isArray(x)) return x.map((y) => (y == null ? "" : String(y))).join("");
      return String(x);
    })
    .join("");
}

function LEN(x: unknown): number {
  if (Array.isArray(x)) return x.length;
  return String(x ?? "").length;
}

function LEFT(s: unknown, n: unknown): string {
  const str = String(s ?? "");
  const num = Math.max(0, Math.floor(toNumber(n) ?? 0));
  return str.slice(0, num);
}

function RIGHT(s: unknown, n: unknown): string {
  const str = String(s ?? "");
  const num = Math.max(0, Math.floor(toNumber(n) ?? 0));
  return str.slice(-num);
}

function UPPER(s: unknown): string {
  return String(s ?? "").toUpperCase();
}

function LOWER(s: unknown): string {
  return String(s ?? "").toLowerCase();
}

function IF(cond: unknown, a: unknown, b: unknown): unknown {
  return truthy(cond) ? a : b;
}

function AND(...args: unknown[]): boolean {
  return args.every(truthy);
}

function OR(...args: unknown[]): boolean {
  return args.some(truthy);
}

function YEAR(d: unknown): number {
  const t = parseDate(d);
  return t ? t.getFullYear() : 0;
}

function MONTH(d: unknown): number {
  const t = parseDate(d);
  return t ? t.getMonth() + 1 : 0;
}

function DAY(d: unknown): number {
  const t = parseDate(d);
  return t ? t.getDate() : 0;
}

/** unit: D=天, M=月差, Y=年差（简化） */
function DATEDIF(a: unknown, b: unknown, unit?: unknown): number {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return 0;
  const u = String(unit ?? "D").toUpperCase();
  if (u === "D") return Math.floor((db.getTime() - da.getTime()) / (24 * 3600 * 1000));
  if (u === "M")
    return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
  if (u === "Y") return db.getFullYear() - da.getFullYear();
  return Math.floor((db.getTime() - da.getTime()) / (24 * 3600 * 1000));
}

function COUNTA(...args: unknown[]): number {
  return flattenArgs(args).filter((x) => x !== null && x !== undefined && x !== "").length;
}

function POWER(x: unknown, y: unknown): number {
  const b = toNumber(x);
  const e = toNumber(y);
  if (b == null || e == null) return 0;
  return Math.pow(b, e);
}

/**
 * 对表达式求值。formValues 为当前表单顶层字段名 -> 值（子表字段值为行对象数组）。
 */
export function evaluateFormulaExpression(
  expression: string,
  formValues: Record<string, unknown>,
  formSchema?: { fields?: any[] }
): unknown {
  const trimmed = expression.trim();
  if (!trimmed) return "";

  // 兼容中文输入法产生的“全角符号”，避免 new Function 解析直接抛错
  // 例如：SUM（{a}，{b}）/ A≥B / “文本”
  const normalized = trimmed
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/，/g, ",")
    .replace(/＋/g, "+")
    .replace(/－/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/％/g, "%")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≠/g, "!=")
    .replace(/＝/g, "=")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  const transformed = normalized.replace(/\{([^}]+)\}/g, (_, ref: string) => {
    return `getValue(${JSON.stringify(String(ref).trim())})`;
  });

  const getValue = (ref: string) =>
    rawFormValue(resolveRefToStorageKey(ref, formSchema), formValues);

  const fn = new Function(
    "getValue",
    "SUM",
    "AVERAGE",
    "MAX",
    "MIN",
    "ABS",
    "ROUND",
    "FLOOR",
    "CEILING",
    "CONCATENATE",
    "LEN",
    "LEFT",
    "RIGHT",
    "UPPER",
    "LOWER",
    "IF",
    "AND",
    "OR",
    "YEAR",
    "MONTH",
    "DAY",
    "DATEDIF",
    "COUNTA",
    "POWER",
    `"use strict"; return (${transformed});`
  );

  return fn(
    getValue,
    SUM,
    AVERAGE,
    MAX,
    MIN,
    ABS,
    ROUND,
    FLOOR,
    CEILING,
    CONCATENATE,
    LEN,
    LEFT,
    RIGHT,
    UPPER,
    LOWER,
    IF,
    AND,
    OR,
    YEAR,
    MONTH,
    DAY,
    DATEDIF,
    COUNTA,
    POWER
  );
}

export function stringifyFormulaResult(value: unknown, forNumberField: boolean): string {
  if (value == null) return "";
  if (forNumberField && typeof value === "number" && !Number.isNaN(value)) {
    return String(value);
  }
  if (forNumberField) {
    const n = parseFloat(String(value).replace(/,/g, ""));
    return Number.isNaN(n) ? "" : String(n);
  }
  return String(value);
}
