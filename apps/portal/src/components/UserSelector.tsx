import { useState } from "react";
import { Modal, Input, List, Avatar, Space, Typography, Button } from "antd";
import { UserOutlined, SearchOutlined } from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/useAuthStore";

const { Text } = Typography;

interface User {
  id: string;
  name: string;
  account: string;
  avatar?: string;
  email?: string;
  phone?: string;
}

interface UserSelectorProps {
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export const UserSelector = ({ 
  value, 
  onChange, 
  multiple = false, 
  disabled = false,
  placeholder = "请选择人员"
}: UserSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const authUser = useAuthStore((state) => state.user);

  // 获取用户列表
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users", searchText],
    queryFn: async () => {
      try {
        // 如果有关键词，传递搜索参数
        const url = searchText 
          ? `/users?keyword=${encodeURIComponent(searchText)}`
          : "/users";
        const response = await apiClient.get(url);
        const list = Array.isArray(response) ? response : [];

        // 如果接口返回空，并且当前有登录用户，至少返回当前用户
        if (list.length === 0 && authUser && !searchText) {
          return [
            {
              id: authUser.id,
              name: authUser.name || authUser.account,
              account: authUser.account,
              email: authUser.email,
              phone: authUser.phone,
            },
          ] as User[];
        }

        return list;
      } catch (error) {
        console.error("获取用户列表失败:", error);
        // 接口未实现或报错时，退化为使用当前登录用户（仅在无搜索关键词时）
        if (authUser && !searchText) {
          return [
            {
              id: authUser.id,
              name: authUser.name || authUser.account,
              account: authUser.account,
              email: authUser.email,
              phone: authUser.phone,
            },
          ] as User[];
        }
        return [] as User[];
      }
    },
  });

  const selectedUsers = Array.isArray(value) 
    ? users.filter(u => value.includes(u.id))
    : users.filter(u => u.id === value);

  const handleSelect = (user: User) => {
    if (multiple) {
      const currentValue = Array.isArray(value) ? value : [];
      const newValue = currentValue.includes(user.id)
        ? currentValue.filter(id => id !== user.id)
        : [...currentValue, user.id];
      onChange?.(newValue);
    } else {
      onChange?.(user.id);
      setOpen(false);
    }
  };

  const handleRemove = (userId: string) => {
    if (multiple && Array.isArray(value)) {
      onChange?.(value.filter(id => id !== userId));
    } else {
      onChange?.(undefined);
    }
  };

  // 后端已经支持搜索，直接使用users
  const filteredUsers = users;

  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, minHeight: 32, padding: "4px 11px", border: "1px solid #d9d9d9", borderRadius: 6, cursor: disabled ? "not-allowed" : "pointer" }} onClick={() => !disabled && setOpen(true)}>
        {selectedUsers.length > 0 ? (
          selectedUsers.map(user => (
            <Space key={user.id} style={{ background: "#f0f0f0", padding: "2px 8px", borderRadius: 4 }}>
              <Avatar size="small" src={(user as any).avatar} icon={<UserOutlined />} />
              <Text>{user.name}</Text>
              {!disabled && (
                <Button
                  type="text"
                  size="small"
                  style={{ padding: 0, height: "auto" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(user.id);
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
        title={multiple ? "选择人员（可多选）" : "选择人员"}
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={600}
      >
        <Input
          placeholder="搜索姓名、账号、邮箱"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 16 }}
        />
        <List
          loading={isLoading}
          dataSource={filteredUsers}
          style={{ maxHeight: 400, overflow: "auto" }}
          renderItem={(user) => {
            const isSelected = multiple
              ? Array.isArray(value) && value.includes(user.id)
              : value === user.id;
            return (
              <List.Item
                style={{
                  cursor: "pointer",
                  background: isSelected ? "#e6f7ff" : "transparent",
                }}
                onClick={() => handleSelect(user)}
              >
                <List.Item.Meta
                  avatar={<Avatar src={(user as any).avatar} icon={<UserOutlined />} />}
                  title={user.name}
                  description={
                    <Space>
                      <Text type="secondary">{user.account}</Text>
                      {user.email && <Text type="secondary">{user.email}</Text>}
                    </Space>
                  }
                />
                {isSelected && <Text type="primary">✓</Text>}
              </List.Item>
            );
          }}
        />
      </Modal>
    </>
  );
};

