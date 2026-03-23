import { useState } from "react";
import { Modal, Input, Tree, Space, Typography, Button } from "antd";
import { ApartmentOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { departmentApi, type Department as ApiDepartment } from "@/api/department";

const { Text } = Typography;

type Department = ApiDepartment;

interface DepartmentSelectorProps {
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const DepartmentSelector = ({ 
  value, 
  onChange, 
  multiple = false, 
  disabled = false,
  placeholder = "请选择部门"
}: DepartmentSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");

  // 获取部门列表
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await departmentApi.getDepartments();
      // 后端返回 tree 已经是树形，兜底用 data
      return (res.tree || (res as any).data || []) as Department[];
    },
  });

  // 构建树形结构
  const treeData = departments; // 已为树形

  const selectedDepts = Array.isArray(value) 
    ? departments.filter(d => value.includes(d.id))
    : departments.filter(d => d.id === value);

  const handleSelect = (dept: Department) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      const newValue = currentValue.includes(dept.id)
        ? currentValue.filter(id => id !== dept.id)
        : [...currentValue, dept.id];
      onChange?.(newValue);
    } else {
      onChange?.(dept.id);
      setOpen(false);
    }
  };

  const handleRemove = (deptId: string) => {
    if (multiple && Array.isArray(value)) {
      onChange?.(value.filter(id => id !== deptId));
    } else {
      onChange?.(undefined);
    }
  };

  const filteredTreeData = searchText
    ? treeData.filter(dept => dept.name.includes(searchText))
    : treeData;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 32, padding: "4px 11px", border: "1px solid #d9d9d9", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer" }} onClick={() => !disabled && setOpen(true)}>
        {selectedDepts.length > 0 ? (
          selectedDepts.map(dept => (
            <Space key={dept.id} style={{ background: "#f0f0f0", padding: "2px 8px", borderRadius: 4 }}>
              <ApartmentOutlined />
              <Text>{dept.name}</Text>
              {!disabled && (
                <Button
                  type="text"
                  size="small"
                  style={{ padding: 0, height: "auto" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(dept.id);
                  }}
                >
                  ×
                </Button>
              )}
            </Space>
          ))
        ) : (
          <Text type="secondary" style={{ lineHeight: "24px" }}>{placeholder}</Text>
        )}
      </div>
      <Modal
        title={multiple ? "选择部门（可多选）" : "选择部门"}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={600}
      >
        <Input
          placeholder="搜索部门名称"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <Tree
          loading={isLoading}
          treeData={filteredTreeData.map(dept => ({
            title: (
              <div
                onClick={() => handleSelect(dept)}
                style={{
                  cursor: "pointer",
                  padding: "4px 0",
                }}
              >
                <Space>
                  <ApartmentOutlined />
                  <Text>{dept.name}</Text>
                  {(multiple
                    ? Array.isArray(value) && value.includes(dept.id)
                    : value === dept.id) && <Text type="primary">✓</Text>}
                </Space>
              </div>
            ),
            key: dept.id,
            children: dept.children?.map(child => ({
              title: (
                <div
                  onClick={() => handleSelect(child)}
                  style={{
                    cursor: "pointer",
                    padding: "4px 0",
                  }}
                >
                  <Space>
                    <ApartmentOutlined />
                    <Text>{child.name}</Text>
                    {(multiple
                      ? Array.isArray(value) && value.includes(child.id)
                      : value === child.id) && <Text type="primary">✓</Text>}
                  </Space>
                </div>
              ),
              key: child.id,
            })),
          }))}
          defaultExpandAll
        />
      </Modal>
    </>
  );
};

