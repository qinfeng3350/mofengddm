import type { CSSProperties } from "react";

/** 与 Luckysheet 单元格对应、可 JSON 落库的打印样式 */
export interface PrintCellStyle {
  fontSize?: number;
  fontWeight?: number;
  fontStyle?: "italic";
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  textAlign?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  textDecoration?: string;
  borderTop?: string;
  borderRight?: string;
  borderBottom?: string;
  borderLeft?: string;
}

const normColor = (c: unknown): string | undefined => {
  if (c == null || c === "") return undefined;
  const s = String(c);
  return s;
};

const lsSideToCss = (s: any): string | undefined => {
  if (!s || s.style == null || Number(s.style) === 0) return undefined;
  const color = normColor(s.color) || "#000";
  return `1px solid ${color}`;
};

/** 从 Luckysheet cell 对象提取可序列化样式（fs/bl/ht/bd 等） */
export function luckysheetCellToStyle(cellData: any): PrintCellStyle | undefined {
  if (!cellData || typeof cellData !== "object") return undefined;
  const st: PrintCellStyle = {};

  if (cellData.fs != null && Number.isFinite(Number(cellData.fs))) {
    st.fontSize = Number(cellData.fs);
  }
  if (cellData.bl === 1 || cellData.bl === true) {
    st.fontWeight = 700;
  }
  if (cellData.it === 1 || cellData.it === true) {
    st.fontStyle = "italic";
  }
  if (cellData.ff) {
    st.fontFamily = String(cellData.ff);
  }
  const fc = normColor(cellData.fc);
  if (fc) st.color = fc;
  const bg = normColor(cellData.bg);
  if (bg) st.backgroundColor = bg;

  const ht = cellData.ht;
  if (ht === 0) st.textAlign = "center";
  else if (ht === 1) st.textAlign = "left";
  else if (ht === 2) st.textAlign = "right";

  const vt = cellData.vt;
  if (vt === 0) st.verticalAlign = "middle";
  else if (vt === 1) st.verticalAlign = "top";
  else if (vt === 2) st.verticalAlign = "bottom";

  const deco: string[] = [];
  if (cellData.un === 1 || cellData.un === true) deco.push("underline");
  if (cellData.cl === 1 || cellData.cl === true) deco.push("line-through");
  if (deco.length) st.textDecoration = deco.join(" ");

  const bd = cellData.bd;
  if (bd && typeof bd === "object") {
    const top = lsSideToCss(bd.t);
    const right = lsSideToCss(bd.r);
    const bottom = lsSideToCss(bd.b);
    const left = lsSideToCss(bd.l);
    if (top) st.borderTop = top;
    if (right) st.borderRight = right;
    if (bottom) st.borderBottom = bottom;
    if (left) st.borderLeft = left;
  }

  const keys = Object.keys(st) as (keyof PrintCellStyle)[];
  if (!keys.length) return undefined;
  return st;
}

/** 打印/预览 <td> 用：默认无边框，仅应用已保存样式 */
export function printCellStyleToCss(style?: PrintCellStyle | null): CSSProperties {
  const s = style || {};
  const css: CSSProperties = {
    borderTop: s.borderTop ?? "none",
    borderRight: s.borderRight ?? "none",
    borderBottom: s.borderBottom ?? "none",
    borderLeft: s.borderLeft ?? "none",
  };
  if (s.fontSize != null) css.fontSize = s.fontSize;
  if (s.fontWeight != null) css.fontWeight = s.fontWeight;
  if (s.fontStyle) css.fontStyle = s.fontStyle;
  if (s.fontFamily) css.fontFamily = s.fontFamily;
  if (s.color) css.color = s.color;
  if (s.backgroundColor) css.backgroundColor = s.backgroundColor;
  if (s.textAlign) css.textAlign = s.textAlign;
  if (s.verticalAlign) css.verticalAlign = s.verticalAlign;
  if (s.textDecoration) css.textDecoration = s.textDecoration;
  return css;
}

/** 是否在模板里显式画过至少一条边（Luckysheet 边框） */
export function hasExplicitCellBorder(style?: PrintCellStyle | null): boolean {
  if (!style) return false;
  return [style.borderTop, style.borderRight, style.borderBottom, style.borderLeft].some(
    (b) => !!b && b !== "none",
  );
}

/**
 * 合并 Luckysheet 导出样式与打印默认网格：未单独设置边框时显示浅灰网格，便于与 Excel 观感一致
 */
export function mergePrintTdStyle(
  style: PrintCellStyle | undefined | null,
  options?: { defaultGrid?: boolean },
): CSSProperties {
  const defaultGrid = options?.defaultGrid !== false;
  const base = printCellStyleToCss(style);
  if (!defaultGrid) return base;
  if (hasExplicitCellBorder(style)) return base;
  return {
    ...base,
    border: "1px solid #d9d9d9",
  };
}

/** 将落库样式写回 Luckysheet setCellValue 对象 */
export function applyPrintStyleToLuckysheetCell(target: Record<string, any>, style?: PrintCellStyle | null) {
  if (!style) return;
  if (style.fontSize != null) target.fs = style.fontSize;
  if (style.fontWeight === 700 || style.fontWeight === "bold" as any) target.bl = 1;
  if (style.fontStyle === "italic") target.it = 1;
  if (style.fontFamily) target.ff = style.fontFamily;
  if (style.color) target.fc = style.color;
  if (style.backgroundColor) target.bg = style.backgroundColor;

  if (style.textAlign === "center") target.ht = 0;
  else if (style.textAlign === "left") target.ht = 1;
  else if (style.textAlign === "right") target.ht = 2;

  if (style.verticalAlign === "middle") target.vt = 0;
  else if (style.verticalAlign === "top") target.vt = 1;
  else if (style.verticalAlign === "bottom") target.vt = 2;

  if (style.textDecoration?.includes("underline")) target.un = 1;
  if (style.textDecoration?.includes("line-through")) target.cl = 1;

  const mkBd = (css?: string) => {
    if (!css || css === "none") return undefined;
    const m = css.match(/(?:^|\s)(#[0-9a-fA-F]{3,8}|rgb\([^)]+\))/);
    return { style: 1, color: m ? m[1] : "#000" };
  };
  const t = mkBd(style.borderTop);
  const r = mkBd(style.borderRight);
  const b = mkBd(style.borderBottom);
  const l = mkBd(style.borderLeft);
  if (t || r || b || l) {
    target.bd = {
      ...(t ? { t } : {}),
      ...(r ? { r } : {}),
      ...(b ? { b } : {}),
      ...(l ? { l } : {}),
    };
  }
}
