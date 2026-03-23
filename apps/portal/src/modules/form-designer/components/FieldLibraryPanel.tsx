import { Typography, Collapse, Space } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { BASIC_FIELDS, LAYOUT_FIELDS, SYSTEM_FIELDS, ADVANCED_FIELDS, LAYOUT_CONTAINERS } from "../constants/fieldLibrary";
import { DraggableFieldCard } from "./DraggableFieldCard";
import { DraggableContainerCard } from "./DraggableContainerCard";
import styles from "./FieldLibraryPanel.module.css";

export const FieldLibraryPanel = () => {
  return (
    <div className={styles.fieldLibraryPanel}>
      <Collapse
        defaultActiveKey={["basic", "layout", "system", "advanced"]}
        ghost
        className={styles.collapseWrapper}
        items={[
          {
            key: "basic",
            label: (
              <Space>
                <Typography.Text strong>基础控件</Typography.Text>
                <QuestionCircleOutlined style={{ color: "#999", fontSize: 12 }} />
              </Space>
            ),
            children: (
              <div className={styles.fieldGrid}>
                {BASIC_FIELDS.map((field) => (
                  <DraggableFieldCard key={`${field.type}-${field.label}`} field={field} />
                ))}
              </div>
            ),
          },
          {
            key: "layout",
            label: (
              <Space>
                <Typography.Text strong>布局控件</Typography.Text>
                <QuestionCircleOutlined style={{ color: "#999", fontSize: 12 }} />
              </Space>
            ),
            children: (
              <>
                <Typography.Text className={styles.sectionLabel}>
                  布局容器（可包含其他字段）
                </Typography.Text>
                <div className={styles.fieldGrid} style={{ marginBottom: 20 }}>
                  {LAYOUT_CONTAINERS.map((container) => (
                    <DraggableContainerCard key={`${container.type}-${container.label}`} container={container} />
                  ))}
                </div>
                <Typography.Text className={styles.sectionLabel}>
                  布局字段
                </Typography.Text>
                <div className={styles.fieldGrid}>
                  {LAYOUT_FIELDS.map((field) => (
                    <DraggableFieldCard key={`${field.type}-${field.label}`} field={field} />
                  ))}
                </div>
              </>
            ),
          },
          {
            key: "system",
            label: (
              <Space>
                <Typography.Text strong>系统控件</Typography.Text>
                <QuestionCircleOutlined style={{ color: "#999", fontSize: 12 }} />
              </Space>
            ),
            children: (
              <div className={styles.fieldGrid}>
                {SYSTEM_FIELDS.map((field) => (
                  <DraggableFieldCard key={`${field.type}-${field.label}`} field={field} />
                ))}
              </div>
            ),
          },
          {
            key: "advanced",
            label: (
              <Space>
                <Typography.Text strong>高级控件</Typography.Text>
                <QuestionCircleOutlined style={{ color: "#999", fontSize: 12 }} />
              </Space>
            ),
            children: (
              <div className={styles.fieldGrid}>
                {ADVANCED_FIELDS.map((field) => (
                  <DraggableFieldCard key={`${field.type}-${field.label}`} field={field} />
                ))}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
};

