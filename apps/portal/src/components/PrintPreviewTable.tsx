import React from "react";
import { mergePrintTdStyle } from "@/utils/printCellStyle";

export interface PrintPreviewTableData {
  cells?: Record<string, any>;
  mergedCells?: any[];
  columnWidths?: Record<number, number>;
  rowHeights?: Record<number, number>;
  orientation?: string;
}

type PrintPreviewTableProps = {
  previewData: PrintPreviewTableData;
  /** 至少渲染的行数（含），默认 1；设计器可用 20 */
  minRowCount?: number;
  /** 至少渲染的列数（含），默认 1；设计器可用 12 */
  minColCount?: number;
};

/**
 * 打印模板预览用表格：合并单元格、Luckysheet 导出样式、仅在有边框设置时画线
 */
export const PrintPreviewTable: React.FC<PrintPreviewTableProps> = ({
  previewData,
  minRowCount = 1,
  minColCount = 1,
}) => {
  const cells: Record<string, any> = previewData?.cells || {};
  const mergedCells: any[] = previewData?.mergedCells || [];
  const columnWidths: Record<number, number> = previewData?.columnWidths || {};
  const rowHeights: Record<number, number> = previewData?.rowHeights || {};
  const orientation = previewData?.orientation || "portrait";

  const maxRowFromCells = Math.max(
    -1,
    ...Object.keys(cells).map((k) => parseInt(k.split("-")[0], 10)),
  );
  const maxRowFromMerge = Math.max(-1, ...mergedCells.map((m) => m.endRow));
  const maxRowFromHeight = Math.max(-1, ...Object.keys(rowHeights).map((k) => parseInt(k, 10)));
  const rowCount =
    Math.max(maxRowFromCells, maxRowFromMerge, maxRowFromHeight, minRowCount - 1) + 1;

  const maxColFromCells = Math.max(
    -1,
    ...Object.keys(cells).map((k) => parseInt(k.split("-")[1], 10)),
  );
  const maxColFromMerge = Math.max(-1, ...mergedCells.map((m) => m.endCol));
  const maxColFromWidth = Math.max(-1, ...Object.keys(columnWidths).map((k) => parseInt(k, 10)));
  const colCount =
    Math.max(maxColFromCells, maxColFromMerge, maxColFromWidth, minColCount - 1) + 1;

  const getWidth = (col: number) => columnWidths[col] || 80;
  const getHeight = (row: number) => rowHeights[row] || 25;
  const getCell = (row: number, col: number) => cells[`${row}-${col}`];

  const findMerge = (row: number, col: number) =>
    mergedCells.find(
      (m) =>
        row >= m.startRow && row <= m.endRow && col >= m.startCol && col <= m.endCol,
    );

  const isPortrait = orientation === "portrait";
  const previewWidth = isPortrait ? "210mm" : "297mm";
  const previewHeight = isPortrait ? "297mm" : "210mm";

  return (
    <div style={{ overflow: "auto", background: "#fff" }}>
      <div
        style={{
          width: previewWidth,
          minHeight: previewHeight,
          background: "#fff",
          margin: "0 auto",
          padding: "12px",
        }}
      >
        <table
          style={{
            tableLayout: "fixed",
            width: "100%",
            borderCollapse: "collapse",
          }}
        >
          <tbody>
            {rowCount > 0 &&
              Array.from({ length: rowCount }, (_, rowIndex) => (
                <tr key={rowIndex} style={{ height: getHeight(rowIndex) }}>
                  {Array.from({ length: colCount }, (_, colIndex) => {
                    const merged = findMerge(rowIndex, colIndex);
                    const isHidden =
                      merged && !(merged.startRow === rowIndex && merged.startCol === colIndex);
                    if (isHidden) return null;
                    const rowSpan = merged ? merged.endRow - merged.startRow + 1 : 1;
                    const colSpan = merged ? merged.endCol - merged.startCol + 1 : 1;
                    const baseCell = merged
                      ? getCell(merged.startRow, merged.startCol)
                      : getCell(rowIndex, colIndex);
                    const value =
                      typeof baseCell?.value === "string"
                        ? baseCell.value
                        : baseCell?.value ?? "";
                    const styleFromCell = mergePrintTdStyle(baseCell?.style, { defaultGrid: true });
                    return (
                      <td
                        key={colIndex}
                        rowSpan={rowSpan > 1 ? rowSpan : undefined}
                        colSpan={colSpan > 1 ? colSpan : undefined}
                        style={{
                          padding: "6px 8px",
                          minWidth: getWidth(colIndex),
                          width: getWidth(colIndex),
                          wordBreak: "break-all",
                          ...styleFromCell,
                        }}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
