import React, {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  applyPrintStyleToLuckysheetCell,
  luckysheetCellToStyle,
  type PrintCellStyle,
} from "@/utils/printCellStyle";

interface Cell {
  row: number;
  col: number;
  value: string;
  fieldId?: string; // 如果是字段，保存字段ID
  style?: PrintCellStyle;
}

interface MergedCell {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

interface SpreadsheetEditorProps {
  rows?: number;
  cols?: number;
  onCellChange?: (row: number, col: number, value: string) => void;
  onFieldDrop?: (row: number, col: number, fieldId: string, fieldLabel: string) => void;
  orientation?: "portrait" | "landscape";
  /** 编辑模板时由父组件传入已保存的格子数据；revision 变化会重建 Luckysheet 并灌入（解决模板异步加载晚于首次初始化导致空白） */
  bootstrapData?: {
    cells?: Record<string, Cell>;
    mergedCells?: MergedCell[];
    columnWidths?: Record<number, number>;
    rowHeights?: Record<number, number>;
  } | null;
  /** 与 bootstrapData 联动，如 `${id}:${updatedAt}` 或 `loading:${templateId}` */
  bootstrapRevision?: string;
}

export interface SpreadsheetEditorRef {
  insertField: (row: number, col: number, fieldId: string, fieldLabel: string) => void;
  mergeCells: () => void;
  unmergeCells: () => void;
  getSelectedRange: () => { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  startEditSelected: () => void;
  commitEditing: () => void;
  undo: () => void;
  redo: () => void;
  toggleBold: () => void;
  toggleItalic: () => void;
  toggleUnderline: () => void;
  toggleStrike: () => void;
  alignHorizontal: (align: "left" | "center" | "right") => void;
  alignVertical: (align: "top" | "middle" | "bottom") => void;
  setFontFamily: (family: string) => void;
  setFontSize: (size: number) => void;
  setFontColor: (color: string) => void;
  setCellBgColor: (color: string) => void;
  /** 为当前选区设置全部边框（打印时会按 Luckysheet 边框导出） */
  setSelectionBorderAll: () => void;
  /** 清除当前选区边框 */
  clearSelectionBorders: () => void;
  insertSubtableBlock: (
    subtableId: string,
    subtableLabel: string,
    columns: Array<{ fieldId: string; label: string }>,
  ) => void;
  getAllData: () => {
    cells: Record<string, Cell>;
    mergedCells: MergedCell[];
    columnWidths: Record<number, number>;
    rowHeights: Record<number, number>;
  };
  setData: (data: {
    cells: Record<string, Cell>;
    mergedCells: MergedCell[];
    columnWidths: Record<number, number>;
    rowHeights: Record<number, number>;
  }) => void;
}

const SpreadsheetEditorComponent = forwardRef<SpreadsheetEditorRef, SpreadsheetEditorProps>(({
  rows = 20,
  cols = 12,
  onCellChange,
  onFieldDrop,
  orientation = "portrait",
  bootstrapData,
  bootstrapRevision = "default",
}, ref) => {
  const [selectedRange, setSelectedRange] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null);
  const reactId = useId();
  const containerId = useMemo(() => `luckysheet-${reactId.replace(/:/g, "_")}`, [reactId]);
  const initializedRef = useRef(false);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [hostHeight, setHostHeight] = useState<number>(720);
  const pendingDataRef = useRef<{
    cells?: Record<string, Cell>;
    mergedCells?: MergedCell[];
    columnWidths?: Record<number, number>;
    rowHeights?: Record<number, number>;
  } | null>(null);
  const bootstrapDataRef = useRef(bootstrapData);
  bootstrapDataRef.current = bootstrapData;
  const orientationRef = useRef(orientation);
  orientationRef.current = orientation;

  const getLuckysheet = () => luckysheetRef.current ?? (window as any).luckysheet;
  const luckysheetRef = useRef<any>(null);
  const assetsReadyRef = useRef(false);
  const [boundaryLeft, setBoundaryLeft] = useState<number | null>(null);

  const callFirst = (names: string[], ...args: any[]) => {
    const luckysheet = getLuckysheet();
    if (!luckysheet) return;
    for (const n of names) {
      const fn = luckysheet?.[n];
      if (typeof fn === "function") {
        try {
          fn(...args);
          return;
        } catch {
          /* 尝试下一个同名兜底 API */
        }
      }
    }
  };

  /** 优先用 Luckysheet getRange()，避免 React state 未同步时合并只有 1×1 */
  const getActiveRange = () => {
    const luckysheet = getLuckysheet();
    const fromApi = luckysheet?.getRange?.()?.[0];
    if (
      fromApi &&
      Array.isArray(fromApi.row) &&
      Array.isArray(fromApi.column) &&
      fromApi.row.length >= 2 &&
      fromApi.column.length >= 2
    ) {
      return {
        startRow: fromApi.row[0],
        endRow: fromApi.row[1],
        startCol: fromApi.column[0],
        endCol: fromApi.column[1],
      };
    }
    if (selectedRange) return selectedRange;
    const row = Number(luckysheet?.getCurrentRow?.());
    const col = Number(luckysheet?.getCurrentColumn?.());
    if (Number.isFinite(row) && Number.isFinite(col)) {
      return { startRow: row, endRow: row, startCol: col, endCol: col };
    }
    return null;
  };

  /**
   * setRangeMerge 内部会访问 data[r][c] 并赋值 cfg.merge[`${r}_${c}`]；
   * create 后 data 可能缺行/缺列或 config.merge 非对象，会触发
   * "Cannot set properties of undefined (setting '0_0')"。
   */
  const ensureLuckysheetGridForRange = (luckysheet: any, maxRow: number, maxCol: number) => {
    const files = luckysheet.getLuckysheetfile?.();
    const file = files?.[0];
    if (!file) return;

    if (!file.config || typeof file.config !== "object") {
      file.config = {};
    }
    const mergeCfg = file.config.merge;
    if (mergeCfg == null || typeof mergeCfg !== "object" || Array.isArray(mergeCfg)) {
      file.config.merge = {};
    }

    if (!Array.isArray(file.data)) {
      file.data = [];
    }
    const data = file.data;
    const minRows = Math.max(maxRow + 1, rows, data.length, 1);
    const minCols = Math.max(maxCol + 1, cols, 1);
    while (data.length < minRows) {
      data.push([]);
    }
    for (let r = 0; r < minRows; r += 1) {
      if (!Array.isArray(data[r])) {
        data[r] = [];
      }
      const rowArr = data[r];
      while (rowArr.length < minCols) {
        rowArr.push(null);
      }
    }
  };

  const mergeSelection = () => {
    const luckysheet = getLuckysheet();
    const range = getActiveRange();
    if (!luckysheet || !range) return;
    if (range.startRow === range.endRow && range.startCol === range.endCol) return;

    const rc = {
      row: [range.startRow, range.endRow] as [number, number],
      column: [range.startCol, range.endCol] as [number, number],
    };

    ensureLuckysheetGridForRange(luckysheet, range.endRow, range.endCol);

    // 文档：先设选区再 setRangeMerge("all")；setting.range 为 { row, column }
    luckysheet.setRangeShow?.(rc);
    const merge = luckysheet.setRangeMerge?.bind(luckysheet);
    if (typeof merge !== "function") return;
    const mergeOpts = { range: rc, order: 0 };
    try {
      merge("all", mergeOpts);
      luckysheet.refresh?.();
    } catch {
      try {
        merge("all");
        luckysheet.refresh?.();
      } catch (e) {
        console.warn("luckysheet merge failed", e);
      }
    }
  };

  const unmergeSelection = () => {
    const luckysheet = getLuckysheet();
    const range = getActiveRange();
    if (!luckysheet || !range) return;

    const rc = {
      row: [range.startRow, range.endRow] as [number, number],
      column: [range.startCol, range.endCol] as [number, number],
    };

    ensureLuckysheetGridForRange(luckysheet, range.endRow, range.endCol);
    luckysheet.setRangeShow?.(rc);
    // cancelRangeMerge 只有可选 setting，禁止传入 "all" 作为首参（会坏掉拆区）
    try {
      luckysheet.cancelRangeMerge?.({ range: rc, order: 0 });
      luckysheet.refresh?.();
    } catch {
      try {
        luckysheet.cancelRangeMerge?.();
        luckysheet.refresh?.();
      } catch (e) {
        console.warn("luckysheet cancelRangeMerge failed", e);
      }
    }
  };

  const applyStyleToSelection = (
    updater: (cell: Record<string, any>) => Record<string, any>,
  ) => {
    const luckysheet = getLuckysheet();
    const range = getActiveRange();
    if (!luckysheet || !range) return;

    const sheets = luckysheet.getLuckysheetfile?.() || [];
    const sheet = sheets?.[0] || {};
    const matrix = (sheet.data || []) as any[][];

    for (let r = range.startRow; r <= range.endRow; r += 1) {
      for (let c = range.startCol; c <= range.endCol; c += 1) {
        const current = (matrix?.[r]?.[c] || {}) as Record<string, any>;
        const nextCell = updater({ ...current });
        luckysheet.setCellValue?.(r, c, nextCell);
      }
    }
  };

  const recalcBoundary = () => {
    const luckysheet = getLuckysheet();
    const host = hostRef.current;
    if (!luckysheet || !host) return;

    const sheet = luckysheet.getLuckysheetfile?.()?.[0];
    const columnlen = sheet?.config?.columnlen || {};
    const defaultWidth = 73;
    const boundaryCol = orientationRef.current === "portrait" ? 8 : 12;
    let left = 0;
    for (let c = 0; c < boundaryCol; c += 1) {
      left += Number(columnlen[c] ?? defaultWidth);
    }
    setBoundaryLeft(Math.max(0, left));
  };

  /** Luckysheet 在 create 后异步量宽，立刻 recalc 常为 0；延后一帧并 resize 再算纸宽边界 */
  const scheduleRecalcBoundary = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const luckysheet = getLuckysheet();
        if (!luckysheet || !hostRef.current) return;
        luckysheet.resize?.();
        recalcBoundary();
      });
    });
  };

  const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[data-lucky-src="${src}"]`);
      if (existing) {
        if ((existing as any).__loaded) return resolve();
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }
      const s = document.createElement("script");
      s.src = src;
      s.async = false; // keep order
      s.defer = false;
      s.dataset.luckySrc = src;
      s.addEventListener("load", () => {
        (s as any).__loaded = true;
        resolve();
      });
      s.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      document.head.appendChild(s);
    });

  const loadStyle = (href: string) =>
    new Promise<void>((resolve) => {
      const existing = document.querySelector<HTMLLinkElement>(`link[data-lucky-href="${href}"]`);
      if (existing) return resolve();
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.dataset.luckyHref = href;
      link.addEventListener("load", () => resolve(), { once: true });
      link.addEventListener("error", () => resolve(), { once: true });
      document.head.appendChild(link);
    });

  const ensureLuckysheetAssets = async () => {
    if (assetsReadyRef.current) return;

    // Use static assets under `public/vendor` to avoid Vite module wrapping.
    // Order matters: jquery -> plugin.js -> luckysheet.umd.js
    await loadStyle("/vendor/luckysheet/plugins/css/pluginsCss.css");
    await loadStyle("/vendor/luckysheet/plugins/plugins.css");
    await loadStyle("/vendor/luckysheet/css/luckysheet.css");
    await loadStyle("/vendor/luckysheet/assets/iconfont/iconfont.css");

    await loadScript("/vendor/jquery.min.js");
    await loadScript("/vendor/luckysheet/plugins/js/plugin.js");
    await loadScript("/vendor/luckysheet/luckysheet.umd.js");

    luckysheetRef.current = (window as any).luckysheet;
    assetsReadyRef.current = true;
  };

  const extractData = (): {
    cells: Record<string, Cell>;
    mergedCells: MergedCell[];
    columnWidths: Record<number, number>;
    rowHeights: Record<number, number>;
  } => {
    const luckysheet = getLuckysheet();
    if (!luckysheet) {
      return { cells: {}, mergedCells: [], columnWidths: {}, rowHeights: {} };
    }

    const sheets = luckysheet.getLuckysheetfile?.() || [];
    const sheet = sheets?.[0] || {};
    const cells: Record<string, Cell> = {};
    const mergedCells: MergedCell[] = [];
    const columnWidths: Record<number, number> = sheet?.config?.columnlen || {};
    const rowHeights: Record<number, number> = sheet?.config?.rowlen || {};

    const matrix = Array.isArray(sheet?.data) ? sheet.data : [];
    matrix.forEach((rowArr: any[], rowIndex: number) => {
      if (!Array.isArray(rowArr)) return;
      rowArr.forEach((cellData: any, colIndex: number) => {
        const mc = cellData?.mc;
        if (mc && typeof mc.r === "number" && typeof mc.c === "number") {
          if (mc.r !== rowIndex || mc.c !== colIndex) return;
        }
        const rawVal = cellData?.m ?? cellData?.v ?? "";
        const value = String(rawVal ?? "");
        const style = luckysheetCellToStyle(cellData);
        if (value === "" && !style) return;
        const key = `${rowIndex}-${colIndex}`;
        cells[key] = {
          row: rowIndex,
          col: colIndex,
          value,
          ...(style ? { style } : {}),
        };
      });
    });

    const mergeMap = sheet?.config?.merge || {};
    Object.values(mergeMap).forEach((m: any) => {
      if (typeof m?.r !== "number" || typeof m?.c !== "number") return;
      mergedCells.push({
        startRow: m.r,
        startCol: m.c,
        endRow: m.r + (m.rs || 1) - 1,
        endCol: m.c + (m.cs || 1) - 1,
      });
    });

    return { cells, mergedCells, columnWidths, rowHeights };
  };

  const initLuckysheet = (data?: {
    cells?: Record<string, Cell>;
    mergedCells?: MergedCell[];
    columnWidths?: Record<number, number>;
    rowHeights?: Record<number, number>;
  }) => {
    const luckysheet = getLuckysheet();
    if (!luckysheet) return;

    luckysheet.destroy?.();
    const persisted = data;
    luckysheet.create({
      container: containerId,
      lang: "zh",
      showtoolbar: false,
      showinfobar: false,
      showsheetbar: false,
      row: rows,
      column: cols,
      hook: {
        cellUpdated: (r: number, c: number, value: any) => {
          onCellChange?.(r, c, String(value ?? ""));
        },
        rangeSelect: (_sheet: any, range: any) => {
          const picked = Array.isArray(range) ? range[0] : range;
          if (
            picked &&
            Array.isArray(picked.row) &&
            Array.isArray(picked.column) &&
            picked.row.length >= 2 &&
            picked.column.length >= 2
          ) {
            setSelectedRange({
              startRow: picked.row[0],
              endRow: picked.row[1],
              startCol: picked.column[0],
              endCol: picked.column[1],
            });
          }
        },
      },
      success: () => {
        const sheet0 = luckysheet.getLuckysheetfile?.()?.[0];
        if (sheet0) {
          if (!sheet0.config || typeof sheet0.config !== "object") {
            sheet0.config = {};
          }
          const mc = sheet0.config.merge;
          if (mc == null || typeof mc !== "object" || Array.isArray(mc)) {
            sheet0.config.merge = {};
          }
        }

        // Apply persisted data after base workbook is created.
        // Passing a custom `data` sheet object is brittle across Luckysheet builds and can
        // break rendering (e.g. internal `config` undefined). Incremental application is stable.
        const sourceCells = persisted?.cells || {};
        let maxCellR = 0;
        let maxCellC = 0;
        Object.keys(sourceCells).forEach((key) => {
          const [a, b] = key.split("-");
          const r = Number(a);
          const c = Number(b);
          if (Number.isFinite(r)) maxCellR = Math.max(maxCellR, r);
          if (Number.isFinite(c)) maxCellC = Math.max(maxCellC, c);
        });
        (persisted?.mergedCells || []).forEach((m) => {
          maxCellR = Math.max(maxCellR, m.endRow);
          maxCellC = Math.max(maxCellC, m.endCol);
        });
        ensureLuckysheetGridForRange(luckysheet, maxCellR, maxCellC);

        Object.entries(sourceCells).forEach(([key, cell]) => {
          const [rStr, cStr] = key.split("-");
          const r = Number(rStr);
          const c = Number(cStr);
          const value = String(cell?.value ?? "");
          const style = cell?.style;
          if (!Number.isFinite(r) || !Number.isFinite(c)) return;
          if (value === "" && !style) return;
          const pkg: Record<string, any> = { v: value, m: value };
          applyPrintStyleToLuckysheetCell(pkg, style);
          luckysheet.setCellValue?.(r, c, pkg);
        });

        const merges = persisted?.mergedCells || [];
        merges.forEach((m) => {
          luckysheet.setRangeMerge?.("all", {
            range: { row: [m.startRow, m.endRow], column: [m.startCol, m.endCol] },
          });
        });

        const columnWidths = persisted?.columnWidths || {};
        Object.entries(columnWidths).forEach(([cStr, w]) => {
          const c = Number(cStr);
          if (!Number.isFinite(c)) return;
          (luckysheet as any).setColumnWidth?.(c, Number(w));
        });

        const rowHeights = persisted?.rowHeights || {};
        Object.entries(rowHeights).forEach(([rStr, h]) => {
          const r = Number(rStr);
          if (!Number.isFinite(r)) return;
          (luckysheet as any).setRowHeight?.(r, Number(h));
        });

        luckysheet.refresh?.();
        scheduleRecalcBoundary();
      },
    });
  };

  // Ensure container has a concrete pixel height for canvas layout
  useEffect(() => {
    const node = hostRef.current;
    const parent = node?.parentElement;
    if (!node || !parent) return;

    const compute = () => {
      const h = parent.clientHeight;
      if (h > 0) {
        const next = Math.max(520, h);
        setHostHeight((prev) => (prev === next ? prev : next));
      }
    };

    compute();

    const ro = new ResizeObserver(() => {
      compute();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  // Only trigger Luckysheet resize on height change (do NOT recreate workbook)
  useEffect(() => {
    if (!initializedRef.current) return;
    const luckysheet = getLuckysheet();
    luckysheet?.resize?.();
    scheduleRecalcBoundary();
  }, [hostHeight]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      await ensureLuckysheetAssets();
      if (cancelled) return;

      const empty = {
        cells: {} as Record<string, Cell>,
        mergedCells: [] as MergedCell[],
        columnWidths: {} as Record<number, number>,
        rowHeights: {} as Record<number, number>,
      };

      const b = bootstrapDataRef.current;
      if (b != null) {
        pendingDataRef.current = {
          cells: b.cells || {},
          mergedCells: b.mergedCells || [],
          columnWidths: b.columnWidths || {},
          rowHeights: b.rowHeights || {},
        };
      } else {
        pendingDataRef.current = pendingDataRef.current ?? empty;
      }

      initLuckysheet(pendingDataRef.current);
      initializedRef.current = true;
      scheduleRecalcBoundary();
    };

    void run();
    return () => {
      cancelled = true;
      const luckysheet = getLuckysheet();
      luckysheet?.destroy?.();
      initializedRef.current = false;
      pendingDataRef.current = null;
    };
  }, [containerId, rows, cols, orientation, bootstrapRevision]);

  useEffect(() => {
    if (!initializedRef.current) return;
    scheduleRecalcBoundary();
  }, [orientation, selectedRange]);

  useImperativeHandle(ref, () => ({
    insertField: (row, col, fieldId, fieldLabel) => {
      const luckysheet = getLuckysheet();
      if (!luckysheet) return;
      const fieldValue = `\${${fieldLabel}}`;
      luckysheet.setCellValue?.(row, col, fieldValue);
      onFieldDrop?.(row, col, fieldId, fieldLabel);
      setSelectedRange({ startRow: row, endRow: row, startCol: col, endCol: col });
    },
    mergeCells: () => mergeSelection(),
    unmergeCells: () => unmergeSelection(),
    getSelectedRange: () => selectedRange,
    startEditSelected: () => {
      const luckysheet = getLuckysheet();
      luckysheet?.enterEditMode?.();
    },
    commitEditing: () => {
      const luckysheet = getLuckysheet();
      luckysheet?.exitEditMode?.();
    },
    undo: () => callFirst(["undo", "doUndo"]),
    redo: () => callFirst(["redo", "doRedo"]),
    toggleBold: () =>
      applyStyleToSelection((cell) => ({ ...cell, bl: cell.bl ? 0 : 1 })),
    toggleItalic: () =>
      applyStyleToSelection((cell) => ({ ...cell, it: cell.it ? 0 : 1 })),
    toggleUnderline: () =>
      applyStyleToSelection((cell) => ({ ...cell, un: cell.un ? 0 : 1 })),
    toggleStrike: () =>
      applyStyleToSelection((cell) => ({ ...cell, cl: cell.cl ? 0 : 1 })),
    alignHorizontal: (align) =>
      applyStyleToSelection((cell) => ({
        ...cell,
        ht: align === "center" ? 0 : align === "left" ? 1 : 2,
      })),
    alignVertical: (align) =>
      applyStyleToSelection((cell) => ({
        ...cell,
        vt: align === "middle" ? 0 : align === "top" ? 1 : 2,
      })),
    setFontFamily: (family) =>
      applyStyleToSelection((cell) => ({ ...cell, ff: family })),
    setFontSize: (size) =>
      applyStyleToSelection((cell) => ({ ...cell, fs: size })),
    setFontColor: (color) =>
      applyStyleToSelection((cell) => ({ ...cell, fc: color })),
    setCellBgColor: (color) =>
      applyStyleToSelection((cell) => ({ ...cell, bg: color })),
    setSelectionBorderAll: () => {
      const luckysheet = getLuckysheet();
      const range = getActiveRange();
      if (!luckysheet || !range) return;
      luckysheet.setRangeFormat?.(
        "bd",
        { borderType: "border-all", style: "1", color: "#000000" },
        {
          range: {
            row: [range.startRow, range.endRow],
            column: [range.startCol, range.endCol],
          },
        },
      );
    },
    clearSelectionBorders: () => {
      const luckysheet = getLuckysheet();
      const range = getActiveRange();
      if (!luckysheet || !range) return;
      luckysheet.setRangeFormat?.(
        "bd",
        { borderType: "border-none", style: "1", color: "#000000" },
        {
          range: {
            row: [range.startRow, range.endRow],
            column: [range.startCol, range.endCol],
          },
        },
      );
    },
    insertSubtableBlock: (subtableId, subtableLabel, columns) => {
      const luckysheet = getLuckysheet();
      const start = getActiveRange();
      if (!luckysheet || !start) return;

      const baseRow = start.startRow;
      const baseCol = start.startCol;

      // Row 1: header (bold + centered)
      luckysheet.setCellValue?.(baseRow, baseCol, { v: subtableLabel, m: subtableLabel, bl: 1 });
      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        const header = String(col.label || col.fieldId);
        const r = baseRow;
        const c = baseCol + i;
        luckysheet.setCellValue?.(r, c, { v: header, m: header, bl: 1, ht: 0, vt: 0 });
      }

      // Row 2: placeholders for one detail row (engine can later loop)
      for (let i = 0; i < columns.length; i += 1) {
        const col = columns[i];
        const token = `\${${subtableId}.${col.fieldId}}`;
        const r = baseRow + 1;
        const c = baseCol + i;
        luckysheet.setCellValue?.(r, c, { v: token, m: token });
      }
    },
    getAllData: () => extractData(),
    setData: (data) => {
      pendingDataRef.current = data;
      if (!initializedRef.current) return;
      initLuckysheet(data);
      scheduleRecalcBoundary();
    },
  }));

  return (
    <div style={{ position: "relative", width: "100%", height: hostHeight, minHeight: 560 }}>
      <div
        ref={hostRef}
        id={containerId}
        style={{ width: "100%", height: "100%", minHeight: 560 }}
      />
      {/* 竖版/横版均显示可打印区边界；z-index 需高于 Luckysheet 画布层 */}
      {boundaryLeft != null && (
        <>
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: boundaryLeft,
              width: 0,
              borderLeft: "2px dashed #1677ff",
              pointerEvents: "none",
              zIndex: 10002,
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: boundaryLeft + 2,
              right: 0,
              background: "rgba(0,0,0,0.03)",
              pointerEvents: "none",
              zIndex: 10001,
            }}
          />
        </>
      )}
    </div>
  );
});

SpreadsheetEditorComponent.displayName = "SpreadsheetEditor";

export const SpreadsheetEditor = SpreadsheetEditorComponent;

