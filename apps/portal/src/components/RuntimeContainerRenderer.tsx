import { Row, Col, Typography, Divider, Tabs } from "antd";
import type { LayoutContainerSchemaType, FormFieldSchema } from "@mofeng/shared-schema";
import { FormFieldRenderer } from "./FormFieldRenderer";
import type { Control } from "react-hook-form";

interface RuntimeContainerRendererProps {
  container: LayoutContainerSchemaType;
  control: Control<Record<string, unknown>>;
  formValues?: Record<string, unknown>;
  disabled?: boolean;
}

export const RuntimeContainerRenderer = ({
  container,
  control,
  formValues = {},
  disabled,
}: RuntimeContainerRendererProps) => {
  const containerFields = (container.children || []) as FormFieldSchema[];

  switch (container.type) {
    case "groupTitle":
      const lineWidth = Number(container.config?.lineWidth || 1);
      const lineColor = String(container.config?.lineColor || "#d9d9d9");
      const alignment = (container.config?.alignment as string) || "left";
      return (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 10 }}>
            <Typography.Text
              strong
              style={{
                display: "block",
                width: "100%",
                fontSize: 15,
                textAlign: alignment as "left" | "center" | "right",
                marginBottom: 8,
              }}
            >
              {container.label || "分组标题"}
            </Typography.Text>
            <div
              style={{
                width: "100%",
                borderBottom: `${lineWidth}px solid ${lineColor}`,
              }}
            />
          </div>
          <div>
            {containerFields.map((field) => (
              <FormFieldRenderer
                key={field.fieldId}
                field={field}
                control={control}
                formValues={formValues}
                disabled={disabled}
              />
            ))}
          </div>
        </div>
      );

    case "multiColumn":
      const columns = (container.config?.columns as number) || 2;
      const colSpans = (container.config?.colSpans as number[]) || Array(columns).fill(24 / columns);
      
      return (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          {Array.from({ length: columns }).map((_, index) => {
            const columnFields = containerFields.filter((field: any) => {
              const fieldColumn = (field as any).containerColumn;
              return fieldColumn === index || (fieldColumn === undefined && containerFields.indexOf(field) % columns === index);
            });
            const colSpan = colSpans[index];
            
            return (
              <Col span={colSpan} key={index}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {columnFields.map((field) => (
                    <FormFieldRenderer
                      key={field.fieldId}
                      field={field}
                      control={control}
                      formValues={formValues}
                      disabled={disabled}
                    />
                  ))}
                </div>
              </Col>
            );
          })}
        </Row>
      );

    case "tab":
      const tabs = (container.config?.tabs as Array<{ key: string; label: string }>) || [
        { key: "tab1", label: "标签页1" },
      ];
      
      const tabItems = tabs.map((tab) => {
        const tabFields = containerFields.filter((field: any) => {
          const fieldTab = (field as any).containerTab;
          return fieldTab === tab.key || (fieldTab === undefined && containerFields.indexOf(field) < containerFields.length / tabs.length);
        });

        return {
          key: tab.key,
          label: tab.label,
          children: (
            <div style={{ padding: "16px 0" }}>
              {tabFields.map((field) => (
                <FormFieldRenderer
                  key={field.fieldId}
                  field={field}
                  control={control}
                  formValues={formValues}
                  disabled={disabled}
                />
              ))}
            </div>
          ),
        };
      });

      return <Tabs items={tabItems} style={{ marginBottom: 16 }} />;

    default:
      return null;
  }
};

