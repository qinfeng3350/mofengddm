import { useDraggable } from "@dnd-kit/core";
import { Button, Space } from "antd";
import { 
  CheckSquareOutlined,
  CalendarOutlined,
  NumberOutlined,
  CheckCircleOutlined,
  DownOutlined,
  SwapOutlined,
  PaperClipOutlined,
  PictureOutlined,
  EnvironmentOutlined,
  UserOutlined,
  TeamOutlined,
  ApartmentOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  QuestionCircleOutlined,
  TableOutlined,
  TagsOutlined,
  OrderedListOutlined,
} from "@ant-design/icons";
import { Typography } from "antd";
import type { FieldDefinition } from "../constants/fieldLibrary";
import { useFormDesignerStore } from "../store/useFormDesignerStore";

interface DraggableFieldCardProps {
  field: FieldDefinition;
}

// 字段图标映射
const getFieldIcon = (type: string, label: string) => {
  // 根据字段类型和标签返回对应的图标
  const iconMap: Record<string, React.ReactNode> = {
    input: <CheckSquareOutlined />,
    textarea: <FileTextOutlined />,
    date: <CalendarOutlined />,
    datetime: <CalendarOutlined />,
    number: <NumberOutlined />,
    radio: <CheckCircleOutlined />,
    checkbox: <CheckSquareOutlined />,
    boolean: <SwapOutlined />,
    select: <DownOutlined />,
    multiselect: <DownOutlined />,
    attachment: <PaperClipOutlined />,
    user: label.includes("多选") ? <TeamOutlined /> : <UserOutlined />,
    department: label.includes("多选") ? <ApartmentOutlined /> : <ApartmentOutlined />,
    subtable: <TableOutlined />,
    formula: <NumberOutlined />,
  };
  
  // 特殊处理
  if (label === "是/否") {
    return <SwapOutlined />;
  }
  if (label === "图片") {
    return <PictureOutlined />;
  }
  if (label === "地址" || label === "位置") {
    return <EnvironmentOutlined />;
  }
  if (label === "分组标题") {
    return <Typography.Text strong style={{ fontSize: 14 }}>T</Typography.Text>;
  }
  if (label === "一行多列") {
    return <AppstoreOutlined />;
  }
  if (label === "描述说明") {
    return <QuestionCircleOutlined />;
  }
  if (label === "标签页") {
    return <TagsOutlined />;
  }
  if (label === "流水号") {
    return <OrderedListOutlined />;
  }
  if (label === "创建人") {
    return <UserOutlined />;
  }
  
  return iconMap[type] || <FileTextOutlined />;
};

export const DraggableFieldCard = ({ field }: DraggableFieldCardProps) => {
  const addField = useFormDesignerStore((state) => state.addField);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${field.type}-${field.label}`,
    data: {
      type: "field-library",
      field,
    },
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  const handleClick = () => {
    addField({
      type: field.type as any,
      label: field.label,
      ...field.defaultConfig,
    });
  };

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
      onClick={handleClick}
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
        {getFieldIcon(field.type, field.label)}
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
        {field.label}
      </span>
    </div>
  );
};

