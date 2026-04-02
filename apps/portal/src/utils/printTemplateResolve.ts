/**
 * 将打印模板中的 ${...} 占位符解析为当前记录数据。
 * 支持：${fieldId}、${字段标签}、${子表字段Id.子列字段Id}
 */

import dayjs from "dayjs";
import type { PrintCellStyle } from "./printCellStyle";

const PLACEHOLDER = /\$\{([^}]+)\}/g;

export interface PrintResolveContext {
  /** 用户 id -> 展示名（与列表页一致） */
  userMap?: Map<string, { name?: string; account?: string; label?: string }>;
  /** 部门 id -> 名称 */
  departmentMap?: Map<string, { name?: string; label?: string }>;
}

export interface PrintCell {
  row: number;
  col: number;
  value: string;
  fieldId?: string;
  style?: PrintCellStyle;
}

export interface PrintMerged {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export function resolvePrintTemplateCells(
  cells: Record<string, PrintCell>,
  mergedCellsInput: PrintMerged[] | undefined,
  recordData: Record<string, unknown>,
  formFields: any[],
  ctx?: PrintResolveContext,
): { cells: Record<string, PrintCell>; mergedCells: PrintMerged[] } {
  const labelToId = new Map<string, string>();
  (formFields || []).forEach((f: any) => {
    const id = String(f?.fieldId || f?.id || "");
    const lab = String(f?.label || f?.fieldName || "");
    if (id && lab) labelToId.set(lab, id);
  });

  const userMap = ctx?.userMap;
  const departmentMap = ctx?.departmentMap;

  const findFieldByExpr = (expr: string): any => {
    const t = expr.trim();
    for (const f of formFields || []) {
      const fid = String(f?.fieldId || f?.id || "");
      if (fid && fid === t) return f;
      const lab = String(f?.label || f?.fieldName || "");
      if (lab && lab === t) return f;
    }
    const idFromLabel = labelToId.get(t);
    if (idFromLabel) {
      return (formFields || []).find((f: any) => String(f?.fieldId || f?.id) === idFromLabel);
    }
    return undefined;
  };

  const extractUserName = (v: unknown): string => {
    if (v == null || v === "") return "";
    if (typeof v === "string" && (v.trim().startsWith("{") || v.trim().startsWith("["))) {
      try {
        return extractUserName(JSON.parse(v));
      } catch {
        /* fallthrough */
      }
    }
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, unknown>;
      return String(o.name ?? o.label ?? o.account ?? o.nick ?? o.id ?? "");
    }
    if (typeof v === "string" || typeof v === "number") {
      const id = String(v).trim();
      const u = userMap?.get(id);
      if (u) return String(u.name ?? u.account ?? u.label ?? id);
      if (/\D/.test(id)) return id;
      return `用户(#${id})`;
    }
    return String(v);
  };

  const extractDeptName = (v: unknown): string => {
    if (v == null || v === "") return "";
    if (typeof v === "string" && (v.trim().startsWith("{") || v.trim().startsWith("["))) {
      try {
        return extractDeptName(JSON.parse(v));
      } catch {
        /* fallthrough */
      }
    }
    if (typeof v === "object" && v !== null) {
      const o = v as Record<string, unknown>;
      return String(o.name ?? o.label ?? o.id ?? "");
    }
    if (typeof v === "string" || typeof v === "number") {
      const id = String(v);
      const d = departmentMap?.get(id);
      if (d) return String(d.name ?? d.label ?? id);
      if (/\D/.test(id)) return id;
      return `部门(#${id})`;
    }
    return String(v);
  };

  const formatDisplayValue = (v: unknown, field?: any): string => {
    if (v == null) return "";
    const ft = field?.type as string | undefined;
    const hint = field?.advanced?.fieldType as string | undefined;
    const lab = String(field?.label || field?.fieldName || "");

    if (ft === "date" || ft === "datetime") {
      const d = dayjs(v as any);
      return d.isValid() ? d.format(ft === "date" ? "YYYY-MM-DD" : "YYYY-MM-DD HH:mm") : String(v);
    }

    if (ft === "user" || hint === "user" || lab.includes("人员")) {
      if (Array.isArray(v)) {
        return v.map((x) => extractUserName(x)).filter(Boolean).join(", ");
      }
      return extractUserName(v);
    }

    if (ft === "department" || hint === "department" || lab.includes("部门")) {
      if (Array.isArray(v)) {
        return v.map((x) => extractDeptName(x)).filter(Boolean).join(", ");
      }
      return extractDeptName(v);
    }

    if (typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    }

    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s.trim())) {
      const d = dayjs(s);
      if (d.isValid()) {
        return d.format(s.includes("T") ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD");
      }
    }
    if (/^\d+$/.test(s) && userMap?.has(s)) {
      const u = userMap.get(s);
      if (u) return String(u.name ?? u.account ?? u.label ?? s);
    }
    return s;
  };

  const resolveExpr = (expr: string, subRow?: Record<string, unknown>): string => {
    const raw = expr.trim();
    const field = findFieldByExpr(raw);

    if (raw.includes(".")) {
      const [, ...rest] = raw.split(".");
      const subKey = rest.join(".");
      if (subRow && subKey in subRow) {
        return formatDisplayValue((subRow as any)[subKey], undefined);
      }
      return "";
    }
    if (subRow && subRow[raw] !== undefined) {
      return formatDisplayValue(subRow[raw], field);
    }
    if (recordData[raw] !== undefined) {
      return formatDisplayValue(recordData[raw], field);
    }
    const byLabel = labelToId.get(raw);
    if (byLabel && recordData[byLabel] !== undefined) {
      return formatDisplayValue(recordData[byLabel], findFieldByExpr(byLabel) || field);
    }
    return "";
  };

  const replaceInString = (s: string, subRow?: Record<string, unknown>): string =>
    s.replace(PLACEHOLDER, (_, expr: string) => resolveExpr(expr, subRow));

  const rowIndices = Array.from(
    new Set(
      Object.keys(cells).map((k) => parseInt(k.split("-")[0], 10)).filter((n) => Number.isFinite(n)),
    ),
  ).sort((a, b) => a - b);

  const getRowSubtableTemplateId = (row: number): string | null => {
    const rowKeys = Object.keys(cells).filter((k) => k.startsWith(`${row}-`));
    let candidate: string | null = null;
    for (const k of rowKeys) {
      const val = String(cells[k]?.value ?? "");
      const ph = [...val.matchAll(PLACEHOLDER)].map((m) => m[1].trim());
      for (const inner of ph) {
        if (!inner.includes(".")) return null;
        const sid = inner.split(".")[0];
        if (!candidate) candidate = sid;
        else if (candidate !== sid) return null;
      }
    }
    return candidate;
  };

  const rowOnlyUsesSubtablePlaceholders = (row: number, subId: string): boolean => {
    const rowKeys = Object.keys(cells).filter((k) => k.startsWith(`${row}-`));
    for (const k of rowKeys) {
      const val = String(cells[k]?.value ?? "").trim();
      if (!val) continue;
      const rest = val.replace(PLACEHOLDER, "").replace(/\s/g, "");
      if (rest.length) return false;
      const ph = [...val.matchAll(PLACEHOLDER)].map((m) => m[1].trim());
      for (const inner of ph) {
        if (!inner.startsWith(`${subId}.`)) return false;
      }
    }
    return true;
  };

  const out: Record<string, PrintCell> = {};
  let outRow = 0;
  const templateRowRange = new Map<number, { start: number; end: number }>();

  const copyRow = (templateRow: number, mapper: (val: string, col: number) => string) => {
    const rowKeys = Object.keys(cells).filter((k) => k.startsWith(`${templateRow}-`));
    const colSet = new Set<number>();
    rowKeys.forEach((k) => colSet.add(parseInt(k.split("-")[1], 10)));
    colSet.forEach((col) => {
      const key = `${templateRow}-${col}`;
      const c = cells[key];
      if (!c) return;
      out[`${outRow}-${col}`] = { ...c, row: outRow, value: mapper(c.value || "", col) };
    });
    outRow += 1;
  };

  for (const r of rowIndices) {
    const startOut = outRow;
    const stId = getRowSubtableTemplateId(r);
    const canExpand =
      !!stId &&
      rowOnlyUsesSubtablePlaceholders(r, stId) &&
      Array.isArray(recordData[stId]);

    if (canExpand) {
      const rows = recordData[stId] as Record<string, unknown>[];
      if (!rows.length) {
        copyRow(r, (val) => replaceInString(val, {}));
      } else {
        rows.forEach((subRow) => {
          copyRow(r, (val) => replaceInString(val, subRow));
        });
      }
    } else {
      copyRow(r, (val) => replaceInString(val));
    }
    templateRowRange.set(r, { start: startOut, end: outRow - 1 });
  }

  const mergedOut: PrintMerged[] = [];
  for (const m of mergedCellsInput || []) {
    const rs = templateRowRange.get(m.startRow);
    const re = templateRowRange.get(m.endRow);
    if (rs == null || re == null) continue;
    mergedOut.push({
      startRow: rs.start,
      endRow: re.end,
      startCol: m.startCol,
      endCol: m.endCol,
    });
  }

  return {
    cells: out,
    mergedCells: mergedOut,
  };
}
