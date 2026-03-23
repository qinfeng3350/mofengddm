import { useDraggable } from "@dnd-kit/core";
import { 
  AppstoreOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import { Typography } from "antd";
import type { LayoutContainerDefinition } from "../constants/fieldLibrary";

interface DraggableContainerCardProps {
  container: LayoutContainerDefinition;
}

// 容器图标映射
const getContainerIcon = (type: string) => {
  const iconMap: Record<string, React.ReactNode> = {
    groupTitle: <Typography.Text strong style={{ fontSize: 14 }}>T</Typography.Text>,
    multiColumn: <AppstoreOutlined />,
    tab: <TagsOutlined />,
  };
  return iconMap[type] || <AppstoreOutlined />;
};

export const DraggableContainerCard = ({ container }: DraggableContainerCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `container-${container.type}`,
    data: {
      type: "layout-container",
      containerType: container.type,
      label: container.label,
      defaultConfig: container.defaultConfig,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={{
        ...style,
        background: "#fff",
        border: "1px solid #e8e8e8",
        borderRadius: 6,
        padding: "8px 10px",
        cursor: "grab",
        transition: "all 0.2s",
        display: "flex",
        alignItems: "center",
        gap: 8,
        minHeight: 36,
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#1890ff";
        e.currentTarget.style.backgroundColor = "#f0f7ff";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#e8e8e8";
        e.currentTarget.style.backgroundColor = "#fff";
      }}
      {...attributes}
      {...listeners}
    >
      <span style={{ 
        fontSize: 16, 
        color: "#595959", 
        display: "flex", 
        alignItems: "center",
        width: 18,
        height: 18,
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {getContainerIcon(container.type)}
      </span>
      <span style={{ 
        fontSize: 13, 
        color: "#262626", 
        flex: 1, 
        fontWeight: 400,
        lineHeight: 1.4,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}>
        {container.label}
      </span>
    </div>
  );
};

