import { Typography } from "antd";
import { BASIC_FIELDS } from "../constants/fieldLibrary";
import { DraggableFieldCard } from "./DraggableFieldCard";

export const FieldLibraryPanel = () => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <Typography.Title level={5}>字段库</Typography.Title>
      {BASIC_FIELDS.map((field) => (
        <DraggableFieldCard key={field.type} field={field} />
      ))}
    </div>
  );
};

