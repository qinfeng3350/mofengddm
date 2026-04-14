import { useMemo, useState } from "react";
import { Modal, Input, Tree, Space, Typography, Button } from "antd";
import { ApartmentOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { departmentApi, type Department as ApiDepartment } from "@/api/department";

const { Text } = Typography;

type Department = ApiDepartment;

const ensureDepartmentTree = (input: Department[]): Department[] => {
  const list = Array.isArray(input) ? input : [];
  if (!list.length) return [];
  // 如果已经是树结构，直接用
  if (list.some((x: any) => Array.isArray(x?.children) && x.children.length > 0)) {
    return list;
  }
  // 平铺转树
  const byId = new Map<string, any>();
  const roots: any[] = [];
  list.forEach((d: any) => {
    if (!d?.id) return;
    byId.set(String(d.id), { ...d, id: String(d.id), children: [] });
  });
  byId.forEach((node) => {
    const pid = node.parentId != null ? String(node.parentId) : "";
    if (pid && byId.has(pid) && pid !== String(node.id)) {
      byId.get(pid).children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
};

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

  const flattenDepartments = (nodes: Department[]): Department[] => {
    const out: Department[] = [];
    const walk = (items: Department[]) => {
      (items || []).forEach((d) => {
        out.push(d);
        if (Array.isArray(d.children) && d.children.length > 0) {
          walk(d.children as Department[]);
        }
      });
    };
    walk(nodes || []);
    return out;
  };

  const treeData = useMemo(() => ensureDepartmentTree(departments), [departments]);
  const allDepartments = useMemo(() => flattenDepartments(treeData), [treeData]);

  const selectedDepts = useMemo(() => {
    if (Array.isArray(value)) {
      return allDepartments.filter((d) => value.includes(d.id));
    }
    return allDepartments.filter((d) => d.id === value);
  }, [value, allDepartments]);

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

  const buildTreeNodes = (nodes: Department[]): any[] =>
    (nodes || []).map((dept) => ({
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
      children: buildTreeNodes((dept.children || []) as Department[]),
    }));

  const filterTree = (nodes: Department[], keyword: string): Department[] => {
    if (!keyword.trim()) return nodes;
    const lower = keyword.trim().toLowerCase();
    const walk = (items: Department[]): Department[] => {
      const result: Department[] = [];
      (items || []).forEach((item) => {
        const children = walk((item.children || []) as Department[]);
        const hit = String(item.name || "").toLowerCase().includes(lower);
        if (hit || children.length > 0) {
          result.push({
            ...item,
            children,
          });
        }
      });
      return result;
    };
    return walk(nodes || []);
  };

  const filteredTreeData = useMemo(
    () => filterTree(treeData, searchText),
    [treeData, searchText],
  );

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
          treeData={buildTreeNodes(filteredTreeData)}
          defaultExpandAll
        />
      </Modal>
    </>
  );
};

