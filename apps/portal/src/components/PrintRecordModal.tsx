import React, { useMemo, useRef, useState } from "react";
import { Modal, Radio, Button, Space, Typography, Empty } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import type { PrintTemplate } from "@/api/printTemplate";
import { printTemplateApi } from "@/api/printTemplate";
import { apiClient } from "@/api/client";
import { departmentApi } from "@/api/department";
import { resolvePrintTemplateCells } from "@/utils/printTemplateResolve";
import { PrintPreviewTable } from "@/components/PrintPreviewTable";

const { Text } = Typography;

export interface PrintRecordModalProps {
  open: boolean;
  onCancel: () => void;
  formId: string;
  recordData: Record<string, unknown>;
  formFields: any[];
}

export const PrintRecordModal: React.FC<PrintRecordModalProps> = ({
  open,
  onCancel,
  formId,
  recordData,
  formFields,
}) => {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const printRef = useRef<HTMLDivElement>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["printTemplates", formId],
    queryFn: () => printTemplateApi.getByFormId(formId),
    enabled: open && !!formId,
  });

  const { data: userList = [] } = useQuery({
    queryKey: ["users", "forPrintModal"],
    queryFn: async () => {
      try {
        const res = await apiClient.get("/users");
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: departmentList = [] } = useQuery({
    queryKey: ["departments", "forPrintModal"],
    queryFn: async () => {
      try {
        const res = await departmentApi.getDepartments();
        return res?.data || [];
      } catch {
        return [];
      }
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const userMap = useMemo(() => {
    const map = new Map<string, { name?: string; account?: string; label?: string }>();
    (userList as any[]).forEach((u) => {
      if (u?.id != null) map.set(String(u.id), u);
    });
    return map;
  }, [userList]);

  const departmentMap = useMemo(() => {
    const map = new Map<string, { name?: string; label?: string }>();
    (departmentList as any[]).forEach((d) => {
      if (d?.id != null) map.set(String(d.id), d);
    });
    return map;
  }, [departmentList]);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId),
    [templates, selectedId],
  );

  const previewPayload = useMemo(() => {
    if (!selected) return null;
    const resolved = resolvePrintTemplateCells(
      selected.cells || {},
      selected.mergedCells || [],
      recordData || {},
      formFields || [],
      { userMap, departmentMap },
    );
    return {
      name: selected.name,
      cells: resolved.cells,
      mergedCells: resolved.mergedCells,
      columnWidths: selected.columnWidths || {},
      rowHeights: selected.rowHeights || {},
      orientation: selected.orientation || "portrait",
    };
  }, [selected, recordData, formFields, userMap, departmentMap]);

  React.useEffect(() => {
    if (open && templates.length && !selectedId) {
      setSelectedId(templates[0].id);
    }
    if (!open) setSelectedId(undefined);
  }, [open, templates, selectedId]);

  const handlePrint = () => {
    const w = window.open("", "_blank");
    if (!w || !printRef.current) return;
    w.document.write(
      `<!DOCTYPE html><html><head><title>打印</title><style>
        body{margin:0;font-family:system-ui,sans-serif;}
        @media print { .noprint{display:none!important;} }
      </style></head><body>${printRef.current.innerHTML}</body></html>`,
    );
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  return (
    <>
      <Modal
        title="选择打印模板"
        open={open}
        onCancel={onCancel}
        width={960}
        footer={[
          <Button key="close" onClick={onCancel}>
            关闭
          </Button>,
          <Button
            key="print"
            type="primary"
            icon={<PrinterOutlined />}
            disabled={!previewPayload}
            onClick={handlePrint}
          >
            打印
          </Button>,
        ]}
        destroyOnHidden
      >
        <Space style={{ width: "100%", display: "flex", flexDirection: "column" }} size="middle">
          {isLoading ? (
            <Text type="secondary">加载模板…</Text>
          ) : templates.length === 0 ? (
            <Empty description="当前表单还没有打印模板，请先在「表单设置 → 打印模板」中创建" />
          ) : (
            <Radio.Group
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
            >
              {templates.map((t: PrintTemplate) => (
                <Radio key={t.id} value={t.id}>
                  {t.name}
                  <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                    {t.paperSize} · {t.orientation === "portrait" ? "纵向" : "横向"}
                  </Text>
                </Radio>
              ))}
            </Radio.Group>
          )}
          {previewPayload && (
            <div ref={printRef} style={{ maxHeight: 480, overflow: "auto", border: "1px solid #f0f0f0" }}>
              <PrintPreviewTable previewData={previewPayload} />
            </div>
          )}
        </Space>
      </Modal>
    </>
  );
};
