import { Space, Typography, Button, Row, Col, Tabs } from "antd";
import { DeleteOutlined, CopyOutlined, DownOutlined, HolderOutlined } from "@ant-design/icons";
import type { LayoutContainerSchemaType } from "@mofeng/shared-schema";
import { useFormDesignerStore } from "../store/useFormDesignerStore";
import { DesignerFieldRenderer } from "./DesignerFieldRenderer";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

interface DesignerContainerRendererProps {
  container: LayoutContainerSchemaType;
  isSelected?: boolean;
}

export const DesignerContainerRenderer = ({ container, isSelected }: DesignerContainerRendererProps) => {
  const selectContainer = useFormDesignerStore((state) => state.selectContainer);
  const removeContainer = useFormDesignerStore((state) => state.removeContainer);
  const containerFields = container.children?.filter((child: any) => 'fieldId' in child) || [];

  // 分组标题的拖拽区域
  const { setNodeRef: setGroupDroppableRef, isOver: isGroupOver } = useDroppable({
    id: `container-${container.containerId}-drop`,
    data: {
      type: "container-drop",
      containerId: container.containerId,
    },
    disabled: container.type !== "groupTitle",
  });

  const renderContainer = () => {
    switch (container.type) {
      case "groupTitle":
        const lineWidth = Number(container.config?.lineWidth || 1);
        const lineColor = String(container.config?.lineColor || "#d9d9d9");
        const alignment = (container.config?.alignment as string) || "left";
        return (
          <div
            onClick={() => selectContainer(container.containerId)}
            style={{
              border: isSelected ? "2px dashed #1890ff" : "1px dashed #e6e6e6",
              borderRadius: 4,
              backgroundColor: "#fff",
              position: "relative",
              padding: "10px 12px",
            }}
          >
            <div style={{ marginBottom: containerFields.length > 0 ? 10 : 0 }}>
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
                {container.label}
              </Typography.Text>
              <div
                style={{
                  width: "100%",
                  borderBottom: `${lineWidth}px solid ${lineColor}`,
                }}
              />
            </div>
            <div
              ref={setGroupDroppableRef}
              style={{
                minHeight: containerFields.length > 0 ? 20 : 8,
                padding: "2px 0",
                backgroundColor: isGroupOver ? "#f5fbff" : "transparent",
                border: isGroupOver ? "1px dashed #1890ff" : "none",
                borderRadius: 4,
              }}
            >
              {containerFields.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {containerFields.map((field: any) => (
                    <SortableFieldInContainer
                      key={field.fieldId}
                      field={field}
                      containerId={container.containerId}
                    />
                  ))}
                </div>
              )}
            </div>
            {isSelected && (
              <div style={{ position: "absolute", top: 8, right: 8 }}>
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeContainer(container.containerId);
                    }}
                  />
                </Space>
              </div>
            )}
          </div>
        );

      case "multiColumn":
        const columns = (container.config?.columns as number) || 2;
        const proportions = (container.config?.proportions as number[]) || Array(columns).fill(1);
        const totalProportion = proportions.reduce((a, b) => a + b, 0);
        const colSpans = proportions.map((p) => Math.round((p / totalProportion) * 24));
        
        return (
          <div
            onClick={(e) => {
              // 如果点击的是容器内的字段，不选择容器
              if ((e.target as HTMLElement).closest('.container-field-wrapper')) {
                return;
              }
              selectContainer(container.containerId);
            }}
            style={{
              border: isSelected ? "1px dashed #1890ff" : "none",
              borderRadius: 4,
              backgroundColor: "transparent",
              position: "relative",
              padding: isSelected ? "12px" : "0px",
            }}
          >
            <Row gutter={16}>
              {Array.from({ length: columns }).map((_, index) => {
                const columnFields = containerFields.filter((field: any) => {
                  const fieldColumn = (field as any).containerColumn;
                  return fieldColumn === index || (fieldColumn === undefined && containerFields.indexOf(field) % columns === index);
                });
                
                const colSpan = colSpans[index];
                
                return (
                  <ColumnDropZone
                    key={index}
                    containerId={container.containerId}
                    columnIndex={index}
                    columnFields={columnFields}
                    colSpan={colSpan}
                  />
                );
              })}
            </Row>
            {isSelected && (
              <div style={{ position: "absolute", top: 8, right: 8 }}>
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeContainer(container.containerId);
                    }}
                  />
                </Space>
              </div>
            )}
          </div>
        );

      case "tab":
        const tabs = (container.config?.tabs as Array<{ key: string; label: string }>) || [
          { key: "tab1", label: "标签页1" },
        ];
        const [activeTab, setActiveTab] = useState(tabs[0]?.key);
        
        return (
          <div
            onClick={() => selectContainer(container.containerId)}
            style={{
              border: isSelected ? "3px dashed #1890ff" : "2px solid #d9d9d9",
              borderRadius: 4,
              backgroundColor: isSelected ? "#e6f7ff" : "#fff",
              position: "relative",
            }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabs.map((tab) => {
                const tabFields = containerFields.filter((field: any) => {
                  const fieldTab = (field as any).containerTab;
                  return fieldTab === tab.key || (fieldTab === undefined && containerFields.indexOf(field) < containerFields.length / tabs.length);
                });

                return {
                  key: tab.key,
                  label: tab.label,
                  children: (
                    <TabDropZone
                      containerId={container.containerId}
                      tabKey={tab.key}
                      tabFields={tabFields}
                    />
                  ),
                };
              })}
            />
            {isSelected && (
              <div style={{ position: "absolute", top: 8, right: 8, zIndex: 10 }}>
                <Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeContainer(container.containerId);
                    }}
                  />
                </Space>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return renderContainer();
};

// 多列容器的列拖拽区域
const ColumnDropZone = ({
  containerId,
  columnIndex,
  columnFields,
  colSpan,
}: {
  containerId: string;
  columnIndex: number;
  columnFields: any[];
  colSpan: number;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `container-${containerId}-column-${columnIndex}`,
    data: {
      type: "container-column-drop",
      containerId,
      columnIndex,
    },
  });

  return (
    <Col span={colSpan}>
      <div
        ref={setNodeRef}
        style={{
          minHeight: 60,
          padding: "10px 12px",
          border: isOver ? "2px dashed #1890ff" : "1px dashed #e6e6e6",
          borderRadius: 6,
          backgroundColor: "#fff",
        }}
      >
        {columnFields.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            从左侧拖拽来添加字段
          </Typography.Text>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {columnFields.map((field: any) => (
              <SortableFieldInContainer
                key={field.fieldId}
                field={field}
                containerId={containerId}
                columnIndex={columnIndex}
              />
            ))}
          </div>
        )}
      </div>
    </Col>
  );
};

// 标签页容器的拖拽区域
const TabDropZone = ({
  containerId,
  tabKey,
  tabFields,
}: {
  containerId: string;
  tabKey: string;
  tabFields: any[];
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `container-${containerId}-tab-${tabKey}`,
    data: {
      type: "container-tab-drop",
      containerId,
      tabKey,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 60,
        padding: "12px",
        backgroundColor: isOver ? "#e6f7ff" : "#fff",
        border: isOver ? "2px dashed #1890ff" : "none",
      }}
    >
      {tabFields.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          从左侧拖拽来添加字段
        </Typography.Text>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tabFields.map((field: any) => (
            <SortableFieldInContainer
              key={field.fieldId}
              field={field}
              containerId={containerId}
              tabKey={tabKey}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 容器内的可排序字段
const SortableFieldInContainer = ({
  field,
  containerId,
  columnIndex,
  tabKey,
}: {
  field: any;
  containerId: string;
  columnIndex?: number;
  tabKey?: string;
}) => {
  const selectedFieldId = useFormDesignerStore((state) => state.selectedFieldId);
  const selectField = useFormDesignerStore((state) => state.selectField);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.fieldId,
    data: {
      type: "container-field",
      field,
      containerId,
      columnIndex,
      tabKey,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // 只在拖拽手柄上应用 listeners，允许点击选择字段
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="container-field-wrapper">
      <div style={{ position: "relative" }}>
        <div
          {...listeners}
          style={{
            position: "absolute",
            left: 4,
            top: 4,
            width: 20,
            height: 20,
            cursor: "grab",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
            borderRadius: 2,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
        >
          <HolderOutlined style={{ fontSize: 12, color: "#999" }} />
        </div>
        <div 
          onClick={(e) => {
            e.stopPropagation(); // 阻止事件冒泡到容器
            selectField(field.fieldId);
          }}
        >
          <DesignerFieldRenderer
            field={field}
            isSelected={field.fieldId === selectedFieldId}
          />
        </div>
      </div>
    </div>
  );
};

