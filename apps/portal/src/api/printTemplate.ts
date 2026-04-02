import { apiClient } from "./client";
import type { PrintCellStyle } from "@/utils/printCellStyle";

export interface PrintTemplate {
  id: string;
  formId: string;
  name: string;
  type: "excel" | "blank";
  printType: "document" | "overlay";
  printMode: "paginated" | "continuous";
  paperSize: string;
  orientation: "portrait" | "landscape";
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  cells: Record<string, {
    row: number;
    col: number;
    value: string;
    fieldId?: string;
    style?: PrintCellStyle;
  }>;
  mergedCells: Array<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }>;
  columnWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePrintTemplateDto {
  formId: string;
  name: string;
  type: "excel" | "blank";
  printType: "document" | "overlay";
  printMode: "paginated" | "continuous";
  paperSize: string;
  orientation: "portrait" | "landscape";
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  cells: Record<string, {
    row: number;
    col: number;
    value: string;
    fieldId?: string;
    style?: PrintCellStyle;
  }>;
  mergedCells: Array<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  }>;
  columnWidths: Record<number, number>;
  rowHeights: Record<number, number>;
}

const STORAGE_KEY = "print-templates";

// 本地存储作为临时后端
const loadLocal = (): PrintTemplate[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("[printTemplateApi] localStorage parse failed:", e);
    return [];
  }
};

const saveLocal = (data: PrintTemplate[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e: any) {
    // 尽量把失败原因暴露出来，便于排查 localStorage 被禁用 / 超额 / 序列化异常等
    console.error("[printTemplateApi] localStorage write failed:", e);
    throw new Error(`本地存储失败：${e?.message || String(e)}`);
  }
};

const genId = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;

export const printTemplateApi = {
  // 获取表单的所有打印模板（本地存储）
  getByFormId: async (formId?: string): Promise<PrintTemplate[]> => {
    const list = loadLocal().filter((t) => t.formId === formId);
    if (!formId) {
      return loadLocal();
    }
    return list;
  },

  // 获取单个模板
  getById: async (id: string): Promise<PrintTemplate> => {
    const list = loadLocal();
    const found = list.find((t) => t.id === id);
    if (!found) {
      throw new Error("模板不存在");
    }
    return found;
  },

  // 创建模板
  create: async (data: CreatePrintTemplateDto): Promise<PrintTemplate> => {
    const list = loadLocal();
    const now = new Date().toISOString();
    const item: PrintTemplate = {
      id: genId(),
      createdAt: now,
      updatedAt: now,
      ...data,
    };
    list.push(item);
    saveLocal(list);
    return item;
  },

  // 更新模板
  update: async (id: string, data: Partial<CreatePrintTemplateDto>): Promise<PrintTemplate> => {
    const list = loadLocal();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) {
      throw new Error("模板不存在");
    }
    const updated: PrintTemplate = {
      ...list[idx],
      ...data,
      updatedAt: new Date().toISOString(),
    };
    list[idx] = updated;
    saveLocal(list);
    return updated;
  },

  // 删除模板
  delete: async (id: string): Promise<void> => {
    const list = loadLocal().filter((t) => t.id !== id);
    saveLocal(list);
  },
};

