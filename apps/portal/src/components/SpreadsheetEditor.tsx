import React, { useState, useRef, useImperativeHandle, forwardRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Input } from "antd";

interface Cell {
  row: number;
  col: number;
  value: string;
  fieldId?: string; // 如果是字段，保存字段ID
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
}

export interface SpreadsheetEditorRef {
  insertField: (row: number, col: number, fieldId: string, fieldLabel: string) => void;
  mergeCells: () => void;
  unmergeCells: () => void;
  getSelectedRange: () => { startRow: number; startCol: number; endRow: number; endCol: number } | null;
  startEditSelected: () => void;
  commitEditing: () => void;
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
}, ref) => {
  const [cells, setCells] = useState<Record<string, Cell>>({});
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ startRow: number; startCol: number; endRow: number; endCol: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [mergedCells, setMergedCells] = useState<MergedCell[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<number, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [resizingColumn, setResizingColumn] = useState<number | null>(null);
  const [resizingRow, setResizingRow] = useState<number | null>(null);
  const inputRef = useRef<any>(null);

  // 当进入编辑模式时，自动聚焦输入框
  useEffect(() => {
    if (editingCell && inputRef.current) {
      // 使用 requestAnimationFrame 确保 DOM 已更新
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (inputRef.current) {
            // Ant Design Input 组件的 ref 结构
            const inputElement = (inputRef.current as any).input || inputRef.current;
            if (inputElement) {
              try {
                inputElement.focus();
                // 选中所有文本
                if (typeof inputElement.select === "function") {
                  inputElement.select();
                } else if (typeof inputElement.setSelectionRange === "function") {
                  inputElement.setSelectionRange(0, inputElement.value?.length || 0);
                }
              } catch (err) {
                // 静默处理错误
              }
            }
          }
        });
      });
    }
  }, [editingCell]);

  // 生成列标签 (A, B, C, ..., Z, AA, AB, ...)
  const getColumnLabel = (col: number): string => {
    let label = "";
    let num = col;
    while (num >= 0) {
      label = String.fromCharCode(65 + (num % 26)) + label;
      num = Math.floor(num / 26) - 1;
    }
    return label;
  };

  // 获取单元格键
  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  // 获取单元格值
  const getCellValue = (row: number, col: number): string => {
    const key = getCellKey(row, col);
    return cells[key]?.value || "";
  };

  // 检查单元格是否在合并区域内
  const isCellMerged = (row: number, col: number): MergedCell | null => {
    for (const merged of mergedCells) {
      if (
        row >= merged.startRow &&
        row <= merged.endRow &&
        col >= merged.startCol &&
        col <= merged.endCol
      ) {
        return merged;
      }
    }
    return null;
  };

  // 检查单元格是否是合并区域的起始单元格
  const isMergedStartCell = (row: number, col: number): boolean => {
    return mergedCells.some((m) => m.startRow === row && m.startCol === col);
  };

  // 检查单元格是否应该被隐藏（因为被合并了）
  const isCellHidden = (row: number, col: number): boolean => {
    const merged = isCellMerged(row, col);
    if (!merged) return false;
    return !(merged.startRow === row && merged.startCol === col);
  };

  // 处理单元格鼠标按下
  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    // 只处理左键点击
    if (e.button !== 0) return;
    
    // 如果点击的是输入框或调整手柄，不处理
    const target = e.target as HTMLElement;
    if (target.tagName === "INPUT" || target.closest("input") || target.classList.contains("resize-handle")) {
      return;
    }

    // 如果已经在编辑模式，不处理
    if (editingCell?.row === row && editingCell?.col === col) {
      return;
    }

    // 简单设置选中状态，不阻止双击事件
    // 注意：不要调用 e.preventDefault()，让浏览器能正常识别双击
    if (e.shiftKey && selectedCell) {
      // Shift + 点击：扩展选择范围
      const startRow = Math.min(selectedCell.row, row);
      const startCol = Math.min(selectedCell.col, col);
      const endRow = Math.max(selectedCell.row, row);
      const endCol = Math.max(selectedCell.col, col);
      setSelectedRange({ startRow, startCol, endRow, endCol });
    } else {
      // 普通点击：只设置选中状态，不进入编辑模式
      setSelectedCell({ row, col });
      setSelectedRange({ startRow: row, startCol: col, endRow: row, endCol: col });
    }
  };

  // 处理单元格鼠标移动（已移除拖拽选择功能）
  const handleCellMouseMove = (row: number, col: number, e?: React.MouseEvent) => {
    // 不再处理拖拽选择
  };

  // 处理单元格鼠标释放
  const handleCellMouseUp = () => {
    // 不再需要处理
  };

  // 处理单元格点击
  const handleCellClick = (row: number, col: number, e?: React.MouseEvent) => {
    // 如果点击的是输入框或调整手柄，不处理
    if (e) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.closest("input") || target.classList.contains("resize-handle")) {
        return;
      }
      
      // 检查是否是双击（e.detail === 2 表示双击），让双击事件处理
      if (e.detail >= 2) {
        return;
      }
    }
    
    // 如果已经在编辑模式，不处理点击
    if (editingCell?.row === row && editingCell?.col === col) {
      return;
    }
    
    // 只设置选中状态，不进入编辑模式（双击才进入编辑模式）
    setSelectedCell({ row, col });
    setSelectedRange({ startRow: row, startCol: col, endRow: row, endCol: col });
  };

  // 处理单元格编辑完成
  const handleCellBlur = () => {
    if (editingCell) {
      const { row, col } = editingCell;
      const key = getCellKey(row, col);
      setCells((prev) => ({
        ...prev,
        [key]: { row, col, value: editingValue },
      }));
      onCellChange?.(row, col, editingValue);
      setEditingCell(null);
    }
  };

  // 处理单元格输入（直接输入，不需要双击）
  const handleCellKeyDown = (row: number, col: number, e: React.KeyboardEvent) => {
    // 如果已经在编辑模式，不处理
    if (editingCell?.row === row && editingCell?.col === col) {
      return;
    }
    
    // 如果按下的是可打印字符，直接进入编辑模式
    const isPrintable = e.key.length === 1 && 
      !e.ctrlKey && 
      !e.metaKey && 
      !e.altKey && 
      e.key !== "Enter" &&
      e.key !== "Tab" &&
      e.key !== "Escape" &&
      e.key !== "ArrowUp" &&
      e.key !== "ArrowDown" &&
      e.key !== "ArrowLeft" &&
      e.key !== "ArrowRight";
    
    if (isPrintable) {
      e.preventDefault();
      e.stopPropagation();
      setEditingCell({ row, col });
      setEditingValue(e.key);
      setSelectedCell({ row, col });
      setSelectedRange({ startRow: row, startCol: col, endRow: row, endCol: col });
    } else if (e.key === "F2" || (e.key === "Enter" && !e.shiftKey)) {
      // F2 或 Enter 进入编辑模式
      e.preventDefault();
      e.stopPropagation();
      const value = getCellValue(row, col);
      setEditingCell({ row, col });
      setEditingValue(value);
    }
  };

  // 获取列宽
  const getColumnWidth = (col: number): number => {
    return columnWidths[col] || 80;
  };

  // 获取行高
  const getRowHeight = (row: number): number => {
    return rowHeights[row] || 25;
  };

  // 处理列宽调整
  const handleColumnResizeStart = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingColumn(col);
    const startX = e.clientX;
    const startWidth = getColumnWidth(col);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.max(50, startWidth + diff);
      setColumnWidths((prev) => ({ ...prev, [col]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingColumn(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // 处理行高调整
  const handleRowResizeStart = (row: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingRow(row);
    const startY = e.clientY;
    const startHeight = getRowHeight(row);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientY - startY;
      const newHeight = Math.max(20, startHeight + diff);
      setRowHeights((prev) => ({ ...prev, [row]: newHeight }));
    };

    const handleMouseUp = () => {
      setResizingRow(null);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  // 处理字段拖拽到单元格（从外部调用）
  const insertField = (row: number, col: number, fieldId: string, fieldLabel: string) => {
    const key = getCellKey(row, col);
    const fieldValue = `\${${fieldLabel}}`;
    setCells((prev) => ({
      ...prev,
      [key]: { row, col, value: fieldValue, fieldId },
    }));
    onFieldDrop?.(row, col, fieldId, fieldLabel);
    setSelectedCell({ row, col });
  };

  // 外部触发编辑当前选中单元格
  const startEditSelected = () => {
    const target =
      selectedCell ??
      (selectedRange
        ? { row: selectedRange.startRow, col: selectedRange.startCol }
        : null);
    if (!target) return;
    const value = getCellValue(target.row, target.col);
    setEditingCell({ row: target.row, col: target.col });
    setEditingValue(value);
    setSelectedCell({ row: target.row, col: target.col });
    setSelectedRange({
      startRow: target.row,
      startCol: target.col,
      endRow: target.row,
      endCol: target.col,
    });
  };

  // 提交当前编辑中的值（用于保存/预览前确保落盘）
  const commitEditing = () => {
    if (!editingCell) return;
    handleCellBlur();
  };

  // 导出当前全部数据，供父组件保存/预览
  const getAllData = () => {
    return {
      cells,
      mergedCells,
      columnWidths,
      rowHeights,
    };
  };

  // 从父组件设置数据，常用于编辑/回显
  const setData = (data: {
    cells?: Record<string, Cell>;
    mergedCells?: MergedCell[];
    columnWidths?: Record<number, number>;
    rowHeights?: Record<number, number>;
  }) => {
    setCells(data.cells || {});
    setMergedCells(data.mergedCells || []);
    setColumnWidths(data.columnWidths || {});
    setRowHeights(data.rowHeights || {});
    setSelectedCell(null);
    setSelectedRange(null);
    setEditingCell(null);
    setEditingValue("");
  };

  // 合并单元格
  const mergeCells = () => {
    if (!selectedRange) return;
    const { startRow, startCol, endRow, endCol } = selectedRange;
    
    // 检查是否已经合并
    const existingMerge = mergedCells.find(
      (m) =>
        m.startRow === startRow &&
        m.startCol === startCol &&
        m.endRow === endRow &&
        m.endCol === endCol
    );
    if (existingMerge) return;

    // 检查是否与现有合并区域冲突
    const hasConflict = mergedCells.some((m) => {
      for (let r = startRow; r <= endRow; r++) {
        for (let c = startCol; c <= endCol; c++) {
          if (
            r >= m.startRow &&
            r <= m.endRow &&
            c >= m.startCol &&
            c <= m.endCol &&
            !(m.startRow === startRow && m.startCol === startCol)
          ) {
            return true;
          }
        }
      }
      return false;
    });
    if (hasConflict) return;

    // 合并：将范围内的所有单元格的值合并到起始单元格
    const startKey = getCellKey(startRow, startCol);
    let mergedValue = cells[startKey]?.value || "";
    
    // 收集所有非空单元格的值
    const values: string[] = [];
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const key = getCellKey(r, c);
        const cellValue = cells[key]?.value || "";
        if (cellValue && !values.includes(cellValue)) {
          values.push(cellValue);
        }
      }
    }
    if (values.length > 0) {
      mergedValue = values.join(" ");
    }

    // 更新单元格值
    setCells((prev) => ({
      ...prev,
      [startKey]: { row: startRow, col: startCol, value: mergedValue },
    }));

    // 添加合并区域
    setMergedCells((prev) => [
      ...prev,
      { startRow, startCol, endRow, endCol },
    ]);
  };

  // 取消合并单元格
  const unmergeCells = () => {
    if (!selectedRange) return;
    const { startRow, startCol, endRow, endCol } = selectedRange;

    // 找到并移除包含选中范围的合并区域
    setMergedCells((prev) =>
      prev.filter(
        (m) =>
          !(
            startRow >= m.startRow &&
            endRow <= m.endRow &&
            startCol >= m.startCol &&
            endCol <= m.endCol
          )
      )
    );
  };

  // 获取选中的范围
  const getSelectedRange = () => {
    return selectedRange;
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    insertField,
    mergeCells,
    unmergeCells,
    getSelectedRange,
    startEditSelected,
    commitEditing,
    getAllData,
    setData,
  }));

  // 已移除全局鼠标事件处理（不再需要拖拽选择功能）

  // 计算打印边界（根据纸张方向）
  const printBoundaryCol = orientation === "portrait" ? 8 : 12; // 纵向8列，横向12列

  // 单元格组件
  const CellComponent: React.FC<{ row: number; col: number }> = ({ row, col }) => {
    const cellKey = getCellKey(row, col);
    const cell = cells[cellKey];
    const value = cell?.value || "";
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    const isEditing = editingCell?.row === row && editingCell?.col === col;
    const isPrintBoundary = col === printBoundaryCol;
    const isNonPrintable = col >= printBoundaryCol;
    const merged = isCellMerged(row, col);
    const isHidden = isCellHidden(row, col);
    const isStartCell = isMergedStartCell(row, col);
    const tdRef = useRef<HTMLTableCellElement>(null);

    // 使用原生 DOM 事件监听器处理双击，确保不被 React 事件系统或 DndContext 干扰
    useEffect(() => {
      const tdElement = tdRef.current;
      if (!tdElement) return;

      const handleNativeDoubleClick = (e: MouseEvent) => {
        console.log("原生双击事件触发", { row, col });
        
        // 如果点击的是输入框，不处理
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.closest("input")) {
          console.log("点击的是输入框，不处理");
          return;
        }

        // 阻止事件冒泡
        e.stopPropagation();
        e.preventDefault();
        e.stopImmediatePropagation();

        // 清除所有可能的 blur 定时器
        document.querySelectorAll("input").forEach((input) => {
          const blurTimer = (input as any).__blurTimer;
          if (blurTimer) {
            clearTimeout(blurTimer);
            delete (input as any).__blurTimer;
          }
        });

        // 直接进入编辑模式
        const cellKey = `${row}-${col}`;
        const currentValue = cells[cellKey]?.value || "";
        
        console.log("进入编辑模式", { row, col, currentValue });
        
        // 立即设置状态
        setEditingCell({ row, col });
        setEditingValue(currentValue);
        setSelectedCell({ row, col });
        setSelectedRange({ startRow: row, startCol: col, endRow: row, endCol: col });
      };

      // 添加原生双击事件监听器，使用捕获阶段确保优先处理
      tdElement.addEventListener("dblclick", handleNativeDoubleClick, true);

      return () => {
        tdElement.removeEventListener("dblclick", handleNativeDoubleClick, true);
      };
    }, [row, col, cells, setEditingCell, setEditingValue, setSelectedCell, setSelectedRange]);

    // 处理双击事件（React 事件，作为备用）
    const handleDoubleClick = (e: React.MouseEvent) => {
      console.log("双击事件触发", { row, col });
      
      // 如果点击的是输入框，不处理
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.closest("input")) {
        console.log("点击的是输入框，不处理");
        return;
      }
      
      // 阻止事件冒泡到 DndContext 和其他事件处理器
      e.stopPropagation();
      e.preventDefault();
      if (e.nativeEvent.stopImmediatePropagation) {
        e.nativeEvent.stopImmediatePropagation();
      }

      // 清除所有可能的 blur 定时器
      document.querySelectorAll("input").forEach((input) => {
        const blurTimer = (input as any).__blurTimer;
        if (blurTimer) {
          clearTimeout(blurTimer);
          delete (input as any).__blurTimer;
        }
      });

      // 如果已经在编辑模式，不处理
      if (editingCell?.row === row && editingCell?.col === col) {
        console.log("已经在编辑模式");
        return;
      }

      // 直接进入编辑模式
      const cellKey = `${row}-${col}`;
      const currentValue = cells[cellKey]?.value || "";
      
      console.log("进入编辑模式", { row, col, currentValue });
      
      // 立即设置状态
      setEditingCell({ row, col });
      setEditingValue(currentValue);
      setSelectedCell({ row, col });
      setSelectedRange({ startRow: row, startCol: col, endRow: row, endCol: col });
    };

    // 如果是被隐藏的合并单元格，不渲染
    if (isHidden) {
      return null;
    }

    // 计算 rowSpan 和 colSpan
    const rowSpan = merged ? merged.endRow - merged.startRow + 1 : 1;
    const colSpan = merged ? merged.endCol - merged.startCol + 1 : 1;

    // 获取合并区域的显示值（使用起始单元格的值）
    const displayValue = merged
      ? getCellValue(merged.startRow, merged.startCol)
      : value;

    const { setNodeRef, isOver } = useDroppable({
      id: `cell-${row}-${col}`,
      data: {
        type: "cell",
        row,
        col,
      },
    });

    // 双击事件已由原生事件监听器处理（在 useEffect 中）

    // 合并 refs
    const combinedRef = (node: HTMLTableCellElement | null) => {
      setNodeRef(node);
      tdRef.current = node;
    };

    return (
      <td
        ref={combinedRef}
        data-row={row}
        data-col={col}
        rowSpan={rowSpan > 1 ? rowSpan : undefined}
        colSpan={colSpan > 1 ? colSpan : undefined}
        style={{
          minWidth: getColumnWidth(col),
          width: getColumnWidth(col),
          height: getRowHeight(row),
          minHeight: getRowHeight(row),
          border: "1px solid #d9d9d9",
          padding: 0,
          position: "relative",
          backgroundColor: isNonPrintable ? "#f5f5f5" : "#fff",
          borderLeft: isPrintBoundary ? "2px dashed #1890ff" : "1px solid #d9d9d9",
          borderRight: "1px solid #d9d9d9",
          borderTop: "1px solid #d9d9d9",
          borderBottom: "1px solid #d9d9d9",
          pointerEvents: "auto", // 确保可以接收点击事件
          cursor: "cell", // 显示单元格光标
        }}
        onMouseDown={(e) => {
          // 如果是双击的第一次点击，不处理，让双击事件能正常触发
          if (e.detail >= 2) {
            return;
          }
          // 不阻止默认行为，让双击事件能正常触发
          // 不调用 stopPropagation，让事件正常传播，以便字段拖拽能正常工作
          handleCellMouseDown(row, col, e);
        }}
        onMouseMove={(e) => handleCellMouseMove(row, col, e)}
        onMouseUp={handleCellMouseUp}
        onClick={(e) => {
          // 如果是双击（detail >= 2），不处理单击事件，让双击事件处理
          if (e.detail >= 2) {
            console.log("onClick: 检测到双击，跳过处理");
            return;
          }
          handleCellClick(row, col, e);
        }}
        onDoubleClick={(e) => {
          console.log("onDoubleClick 被调用", { row, col });
          // 双击事件 - 直接处理
          e.stopPropagation();
          e.preventDefault();
          if (e.nativeEvent.stopImmediatePropagation) {
            e.nativeEvent.stopImmediatePropagation();
          }
          handleDoubleClick(e);
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          handleCellKeyDown(row, col, e);
        }}
        tabIndex={0}
        onFocus={() => {
          setSelectedCell({ row, col });
          setSelectedRange({ startRow: row, startCol: col, endRow: row, endCol: col });
        }}
      >
        {(editingCell?.row === row && editingCell?.col === col) ? (
          <Input
            ref={(ref) => {
              inputRef.current = ref;
              // 确保 ref 设置后立即聚焦
              if (ref) {
                setTimeout(() => {
                  const inputElement = (ref as any).input || ref;
                  if (inputElement) {
                    inputElement.focus();
                    inputElement.select();
                  }
                }, 0);
              }
            }}
            value={editingValue}
            onChange={(e) => {
              setEditingValue(e.target.value);
            }}
            onBlur={(e) => {
              // 延迟处理 blur，避免与双击事件冲突
              const relatedTarget = e.relatedTarget as HTMLElement;
              const isClickingCell = relatedTarget?.closest("td[data-row]");
              
              if (isClickingCell) {
                // 如果点击的是另一个单元格，延迟处理，给双击事件留出时间
                const blurTimer = setTimeout(() => {
                  // 再次检查是否还在编辑模式（可能被双击事件取消了）
                  if (editingCell?.row === row && editingCell?.col === col) {
                    handleCellBlur();
                  }
                }, 200);
                // 存储 timer 以便双击时清除
                (e.currentTarget as any).__blurTimer = blurTimer;
              } else {
                // 如果不是点击单元格，立即处理
                handleCellBlur();
              }
            }}
            onPressEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCellBlur();
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape") {
                e.preventDefault();
                setEditingCell(null);
                setEditingValue("");
              }
            }}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              padding: "2px 4px",
              fontSize: 12,
              outline: "none",
              userSelect: "text",
              pointerEvents: "auto",
            }}
            autoFocus
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // 允许输入框内的点击，选中所有文本
              if (inputRef.current) {
                const inputElement = (inputRef.current as any).input || inputRef.current;
                if (inputElement && typeof inputElement.select === "function") {
                  setTimeout(() => {
                    inputElement.select();
                  }, 0);
                }
              }
            }}
            onMouseDown={(e) => {
              e.stopPropagation();
              // 阻止单元格的 mousedown 事件，但允许输入框内的操作
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              // 清除 blur 定时器，防止双击时输入框被关闭
              const blurTimer = (e.currentTarget as any).__blurTimer;
              if (blurTimer) {
                clearTimeout(blurTimer);
                delete (e.currentTarget as any).__blurTimer;
              }
              // 选中所有文本
              if (inputRef.current) {
                const inputElement = (inputRef.current as any).input || inputRef.current;
                if (inputElement && typeof inputElement.select === "function") {
                  setTimeout(() => {
                    inputElement.select();
                  }, 0);
                }
              }
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              padding: "2px 4px",
              fontSize: 12,
              cursor: "cell",
              backgroundColor: isSelected ? "#bae7ff" : "transparent",
              border: isSelected ? "2px solid #1890ff" : "none",
              display: "flex",
              alignItems: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: merged && rowSpan > 1 ? "normal" : "nowrap",
              minHeight: merged ? `${rowSpan * 25}px` : "25px",
              pointerEvents: "none", // 让点击事件穿透到 td，确保双击事件能正确触发
            }}
          >
            {displayValue}
          </div>
        )}
        {isOver && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(24, 144, 255, 0.1)",
              border: "2px dashed #1890ff",
              zIndex: 1,
            }}
          />
        )}
      </td>
    );
  };

  return (
    <div style={{ width: "100%", height: "100%", overflow: "auto" }}>
      <table
        style={{
          borderCollapse: "collapse",
          width: "100%",
          userSelect: "none",
        }}
        onDoubleClick={(e) => {
          // 如果双击的是表格本身（不是单元格），不处理
          if ((e.target as HTMLElement).tagName === "TABLE") {
            return;
          }
        }}
      >
        {/* 列标题行 */}
        <thead>
          <tr>
            <th
              style={{
                width: 50,
                minWidth: 50,
                border: "1px solid #d9d9d9",
                backgroundColor: "#fafafa",
                textAlign: "center",
                fontSize: 12,
                fontWeight: "normal",
              }}
            />
            {Array.from({ length: cols }, (_, i) => (
              <th
                key={i}
                style={{
                  minWidth: getColumnWidth(i),
                  width: getColumnWidth(i),
                  border: "1px solid #d9d9d9",
                  textAlign: "center",
                  fontSize: 12,
                  fontWeight: "normal",
                  borderLeft: i === printBoundaryCol ? "2px dashed #1890ff" : "1px solid #d9d9d9",
                  backgroundColor: i >= printBoundaryCol ? "#f5f5f5" : "#fafafa",
                  position: "relative",
                  userSelect: "none",
                }}
              >
                {getColumnLabel(i)}
                {/* 列宽调整手柄 */}
                <div
                  className="resize-handle"
                  style={{
                    position: "absolute",
                    top: 0,
                    right: -3,
                    width: 6,
                    height: "100%",
                    cursor: "col-resize",
                    zIndex: 10,
                    backgroundColor: resizingColumn === i ? "#1890ff" : "transparent",
                  }}
                  onMouseDown={(e) => handleColumnResizeStart(i, e)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <tr key={rowIndex} style={{ height: getRowHeight(rowIndex) }}>
              {/* 行号 */}
              <td
                style={{
                  width: 50,
                  minWidth: 50,
                  height: getRowHeight(rowIndex),
                  border: "1px solid #d9d9d9",
                  backgroundColor: "#fafafa",
                  textAlign: "center",
                  fontSize: 12,
                  color: "#666",
                  position: "relative",
                  userSelect: "none",
                }}
              >
                {rowIndex + 1}
                {/* 行高调整手柄 */}
                <div
                  className="resize-handle"
                  style={{
                    position: "absolute",
                    left: 0,
                    bottom: -3,
                    width: "100%",
                    height: 6,
                    cursor: "row-resize",
                    zIndex: 10,
                    backgroundColor: resizingRow === rowIndex ? "#1890ff" : "transparent",
                  }}
                  onMouseDown={(e) => handleRowResizeStart(rowIndex, e)}
                />
              </td>
              {/* 单元格 */}
              {Array.from({ length: cols }, (_, colIndex) => {
                // 如果单元格被隐藏（在合并区域内但不是起始单元格），跳过渲染
                if (isCellHidden(rowIndex, colIndex)) {
                  return null;
                }
                return <CellComponent key={colIndex} row={rowIndex} col={colIndex} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {/* 非打印区域提示 */}
      {cols > printBoundaryCol && (
        <div
          style={{
            position: "absolute",
            right: 16,
            top: "50%",
            transform: "translateY(-50%)",
            padding: "8px 12px",
            backgroundColor: "#f5f5f5",
            border: "1px solid #d9d9d9",
            borderRadius: 4,
            fontSize: 12,
            color: "#999",
          }}
        >
          灰色区域不可打印
        </div>
      )}
    </div>
  );
});

SpreadsheetEditorComponent.displayName = "SpreadsheetEditor";

export const SpreadsheetEditor = SpreadsheetEditorComponent;

