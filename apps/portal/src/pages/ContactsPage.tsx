import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Layout,
  Tabs,
  Tree,
  Table,
  Input,
  Button,
  Space,
  Typography,
  Tag,
  Avatar,
  Dropdown,
  Spin,
  Empty,
  Switch,
  Divider,
  Select,
  Modal,
  message,
} from "antd";
import {
  ArrowLeftOutlined,
  SearchOutlined,
  UserOutlined,
  DownloadOutlined,
  FileTextOutlined,
  PlusOutlined,
  SettingOutlined,
  TeamOutlined,
  LogoutOutlined,
  DownOutlined,
  RightOutlined,
  ApartmentOutlined,
  DeleteOutlined,
  EllipsisOutlined,
} from "@ant-design/icons";
import { apiClient } from "@/api/client";
import { departmentApi } from "@/api/department";
import { roleApi } from "@/api/role";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuthStore } from "@/store/useAuthStore";
import { UserAccountDropdown } from "@/components/UserAccountDropdown";

type UserRow = {
  id: string;
  name: string;
  account: string;
  email?: string;
  phone?: string;
  avatar?: string;
  position?: string;
  jobNumber?: string;
  departmentId?: string;
  department?: { id: string; name: string } | null;
  status: number;
};

type AdminGroup = {
  id: string;
  name: string;
  category: string;
  creator: string;
};

export const ContactsPage = () => {
  usePageTitle("通讯录 - 墨枫低代码平台");
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, clearAuth } = useAuthStore();

  const [activeTab, setActiveTab] = useState<string>("internal");
  const [keyword, setKeyword] = useState<string>("");
  const [selectedDeptId, setSelectedDeptId] = useState<string | undefined>(undefined);
  const [teamMode, setTeamMode] = useState<"dingtalk" | "role">("dingtalk");
  const [includeSubDept, setIncludeSubDept] = useState<boolean>(true);
  const [autoSyncContacts, setAutoSyncContacts] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [leftTab, setLeftTab] = useState<"org" | "role">("org");
  const [selectedAdminGroupId, setSelectedAdminGroupId] = useState<string>("sys-admin-group");
  const [adminPickerOpen, setAdminPickerOpen] = useState<boolean>(false);
  const [adminDraftIds, setAdminDraftIds] = useState<string[]>([]);
  const [groupAdminIds, setGroupAdminIds] = useState<Record<string, string[]>>({
    "sys-admin-group": [],
    "consult-admin-group": [],
  });

  const { data: systemAdminResp, refetch: refetchSystemAdmins } = useQuery({
    queryKey: ["system-admins"],
    queryFn: () => roleApi.getSystemAdmins(),
    enabled: activeTab === "admin",
    staleTime: 10_000,
  });

  const { data: departmentsData, isLoading: deptLoading } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentApi.getDepartments(),
  });

  const { data: currentUserInfo } = useQuery({
    queryKey: ["current-user-info"],
    queryFn: async () => {
      try {
        return await apiClient.get("/auth/profile");
      } catch {
        return null;
      }
    },
  });

  const userMenuItems = [
    {
      key: "profile",
      label: "个人设置",
      onClick: () => navigate("/settings/profile"),
    },
    {
      key: "logout",
      label: "退出登录",
      icon: <LogoutOutlined />,
      onClick: () => {
        clearAuth();
        navigate("/login");
      },
    },
  ];

  const { data: users = [], isLoading: userLoading } = useQuery({
    queryKey: ["contacts", "users", keyword],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (keyword.trim()) params.keyword = keyword.trim();
      const res = await apiClient.get<UserRow[]>("/users", { params });
      return Array.isArray(res) ? res : [];
    },
  });

  const filteredUsers = useMemo(() => {
    // 先做一个最小可用：其它 tab 暂时不区分数据源（后续可接外部联系人接口）
    let base = users.filter((u) => u);
    if (statusFilter === "enabled") base = base.filter((u) => Number(u.status) === 1);
    if (statusFilter === "disabled") base = base.filter((u) => Number(u.status) !== 1);
    if (!selectedDeptId) return base;
    // 先按 departmentId 过滤；子部门包含逻辑后续可通过部门树/路径补齐，这里先保留开关 UI
    return base.filter(
      (u) =>
        String(u.departmentId || u.department?.id || "") === String(selectedDeptId),
    );
  }, [users, selectedDeptId, statusFilter]);

  const creatorName = useMemo(() => {
    // 管理员页面的“创建者”显示当前租户名称（架构名称）
    return (
      (currentUserInfo as any)?.tenant?.name ||
      (currentUserInfo as any)?.tenantName ||
      user?.tenantName ||
      "未命名租户"
    );
  }, [currentUserInfo, user]);

  const adminGroups = useMemo<AdminGroup[]>(
    () => [
      {
        id: "sys-admin-group",
        name: "系统管理组",
        category: "系统管理组",
        creator: creatorName,
      },
      {
        id: "consult-admin-group",
        name: "咨询管理组",
        category: "咨询管理组",
        creator: creatorName,
      },
    ],
    [creatorName],
  );

  const selectedAdminGroup = useMemo(
    () =>
      adminGroups.find((g) => g.id === selectedAdminGroupId) || adminGroups[0] || null,
    [adminGroups, selectedAdminGroupId],
  );

  const adminUsers = useMemo(() => {
    const ids = groupAdminIds[selectedAdminGroup?.id || ""] || [];
    if (!ids.length) return [];
    const map = new Map(users.map((u) => [String(u.id), u]));
    return ids.map((id) => map.get(String(id))).filter(Boolean) as UserRow[];
  }, [groupAdminIds, selectedAdminGroup, users]);

  useEffect(() => {
    if (!selectedAdminGroup?.id) return;
    setAdminDraftIds(groupAdminIds[selectedAdminGroup.id] || []);
  }, [groupAdminIds, selectedAdminGroup]);

  // 后端真实系统管理员名单 → 映射到“系统管理组”
  useEffect(() => {
    if (activeTab !== "admin") return;
    const ids = (systemAdminResp as any)?.userIds;
    if (!Array.isArray(ids)) return;
    setGroupAdminIds((prev) => ({
      ...prev,
      "sys-admin-group": ids.map(String),
    }));
  }, [activeTab, systemAdminResp]);

  const treeData = useMemo(() => {
    const t = (departmentsData as any)?.tree || (departmentsData as any)?.data || [];
    const normalize = (nodes: any[]): any[] =>
      (nodes || []).map((n: any) => ({
        title: n.title || n.name,
        key: String(n.id || n.key),
        children: Array.isArray(n.children) ? normalize(n.children) : undefined,
      }));
    const normalized = normalize(t);

    // 主部门作为第一个根节点（可展开）
    const tenantName =
      (currentUserInfo as any)?.tenant?.name ||
      (currentUserInfo as any)?.tenantName ||
      "主部门";
    const lowerTenant = String(tenantName).toLowerCase();
    const existingRoot = normalized.find(
      (x) => String(x?.title || "").toLowerCase() === lowerTenant,
    );

    if (existingRoot) {
      const others = normalized.filter((x) => x !== existingRoot);
      return [{ ...existingRoot, children: [...(existingRoot.children || []), ...others] }];
    }

    return [
      {
        title: tenantName,
        key: "__tenant_root__",
        children: normalized,
      },
    ];
  }, [departmentsData, currentUserInfo]);

  // 树加载后默认选中主部门
  useEffect(() => {
    if (!selectedDeptId && treeData?.[0]?.key) {
      setSelectedDeptId(String(treeData[0].key));
    }
  }, [treeData, selectedDeptId]);

  const defaultExpandedKeys = useMemo(() => {
    const root = treeData?.[0]?.key;
    return root ? [String(root)] : [];
  }, [treeData]);

  const decoratedTreeData = useMemo(() => {
    const rootKey = String(treeData?.[0]?.key || "");
    const decorate = (nodes: any[]): any[] =>
      (nodes || []).map((n: any) => {
        const nodeKey = String(n.key);
        const isRoot = nodeKey === rootKey;
        return {
          ...n,
          title: (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                width: "100%",
                borderRadius: 6,
                padding: isRoot ? "2px 6px" : 0,
                background: isRoot ? "#f5f7ff" : "transparent",
              }}
            >
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontWeight: isRoot ? 600 : 400,
                }}
                title={typeof n.title === "string" ? n.title : undefined}
              >
                {n.title}
              </span>
              <Button
                type="text"
                size="small"
                icon={<EllipsisOutlined />}
                style={{ color: "#8c8c8c", width: 20, height: 20, padding: 0 }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
              />
            </div>
          ),
          children: Array.isArray(n.children) ? decorate(n.children) : undefined,
        };
      });
    return decorate(treeData);
  }, [treeData]);

  const columns = [
    {
      title: "姓名",
      dataIndex: "name",
      key: "name",
      render: (_: any, record: UserRow) => (
        <Space>
          <Avatar src={record.avatar} icon={<UserOutlined />} size="small" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 500 }}>{record.name || record.account}</span>
            <span style={{ fontSize: 12, color: "#999" }}>{record.account}</span>
          </div>
        </Space>
      ),
    },
    {
      title: "企业内用户ID",
      dataIndex: "id",
      key: "id",
      width: 180,
      render: (v: any) => (v ? String(v) : "-"),
    },
    {
      title: "手机号",
      dataIndex: "phone",
      key: "phone",
      width: 140,
      render: (v: any) => (v ? String(v) : "-"),
    },
    {
      title: "邮箱",
      dataIndex: "email",
      key: "email",
      width: 220,
      render: (v: any) => (v ? String(v) : "-"),
    },
    {
      title: "岗位",
      dataIndex: "position",
      key: "position",
      width: 140,
      render: (v: any) => (v ? String(v) : "-"),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (v: any) =>
        Number(v) === 1 ? <Tag color="green">启用</Tag> : <Tag>停用</Tag>,
    },
  ];

  const isAdminTab = activeTab === "admins";

  return (
    <Layout style={{ minHeight: "100vh", background: "#fff" }}>
      <Layout.Header
        style={{
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          padding: isMobile ? "0 12px" : "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 56,
        }}
      >
        <Space style={{ minWidth: 220 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
          <Typography.Text strong style={{ fontSize: 16 }}>
            我的通讯录
          </Typography.Text>
        </Space>

        {/* 顶部四个标签：内部组织/互联组织/外部联系人/管理员 */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            size="small"
            tabBarStyle={{ margin: 0 }}
            items={[
              { key: "internal", label: "内部组织" },
              { key: "partner", label: "互联组织" },
              { key: "external", label: "外部联系人" },
              { key: "admins", label: "管理员" },
            ]}
          />
        </div>

        <Space style={{ minWidth: 220, justifyContent: "flex-end" }}>
          <UserAccountDropdown showUserName />
        </Space>
      </Layout.Header>

      <Layout style={{ background: "#fff" }}>
        {!isMobile && (
          <Layout.Sider
            width={280}
            style={{ background: "#fff", borderRight: "1px solid #f0f0f0" }}
          >
            {isAdminTab ? (
              <>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #f0f0f0" }}>
                  <Typography.Text type="secondary">系统管理组</Typography.Text>
                  {adminGroups
                    .filter((g) => g.category === "系统管理组")
                    .map((g) => {
                      const active = selectedAdminGroup?.id === g.id;
                      return (
                        <div
                          key={g.id}
                          onClick={() => setSelectedAdminGroupId(g.id)}
                          style={{
                            marginTop: 8,
                            height: 34,
                            borderRadius: 6,
                            background: active ? "#eaf1ff" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            padding: "0 10px",
                            color: active ? "#1d39c4" : "#595959",
                            fontWeight: active ? 500 : 400,
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontSize: 13 }}>{g.name}</span>
                        </div>
                      );
                    })}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography.Text type="secondary">咨询管理组</Typography.Text>
                    <Button type="text" size="small" icon={<PlusOutlined />} />
                  </div>
                  {adminGroups
                    .filter((g) => g.category === "咨询管理组")
                    .map((g) => {
                      const active = selectedAdminGroup?.id === g.id;
                      return (
                        <div
                          key={g.id}
                          onClick={() => setSelectedAdminGroupId(g.id)}
                          style={{
                            marginTop: 8,
                            height: 34,
                            borderRadius: 6,
                            background: active ? "#eaf1ff" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            padding: "0 10px",
                            color: active ? "#1d39c4" : "#595959",
                            fontWeight: active ? 500 : 400,
                            cursor: "pointer",
                          }}
                        >
                          <span style={{ fontSize: 13 }}>{g.name}</span>
                        </div>
                      );
                    })}
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: 12, borderBottom: "1px solid #f0f0f0" }}>
                  <Typography.Text strong style={{ display: "block", textAlign: "center" }}>
                    团队模式：{teamMode === "dingtalk" ? "钉钉" : "角色"}
                  </Typography.Text>
                </div>

                <div style={{ padding: "10px 12px 8px", borderBottom: "1px solid #f5f5f5" }}>
                  <Space.Compact block>
                    <Button
                      type={leftTab === "org" ? "primary" : "default"}
                      style={{ width: "50%" }}
                      onClick={() => setLeftTab("org")}
                    >
                      组织架构
                    </Button>
                    <Button
                      type={leftTab === "role" ? "primary" : "default"}
                      style={{ width: "50%" }}
                      onClick={() => setLeftTab("role")}
                    >
                      角色
                    </Button>
                  </Space.Compact>
                </div>

                <div style={{ padding: "10px 12px 6px", borderBottom: "1px solid #f5f5f5" }}>
                  <Typography.Text type="secondary">成员</Typography.Text>
                  <div
                    style={{
                      marginTop: 8,
                      height: 34,
                      borderRadius: 6,
                      background: "#eaf1ff",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 10px",
                      color: "#1d39c4",
                      fontWeight: 500,
                    }}
                  >
                    <ApartmentOutlined style={{ marginRight: 8 }} />
                    全部成员
                  </div>
                </div>

                <div style={{ padding: "10px 12px 6px" }}>
                  <Typography.Text type="secondary">部门</Typography.Text>
                </div>

                {leftTab === "role" ? (
                  <div style={{ padding: "8px 12px", color: "#999", fontSize: 12 }}>
                    角色视图开发中
                  </div>
                ) : (
                  <>
                    {deptLoading ? (
                      <div style={{ padding: 24, textAlign: "center" }}>
                        <Spin />
                      </div>
                    ) : treeData.length === 0 ? (
                      <div style={{ padding: 24 }}>
                        <Empty description="暂无部门" />
                      </div>
                    ) : (
                      <Tree
                        treeData={decoratedTreeData}
                        defaultExpandedKeys={defaultExpandedKeys}
                        selectedKeys={selectedDeptId ? [String(selectedDeptId)] : []}
                        onSelect={(keys) => {
                          const k = keys?.[0] ? String(keys[0]) : undefined;
                          setSelectedDeptId(k);
                        }}
                        switcherIcon={(props: any) =>
                          props.expanded ? (
                            <DownOutlined style={{ fontSize: 11, color: "#999" }} />
                          ) : (
                            <RightOutlined style={{ fontSize: 11, color: "#999" }} />
                          )
                        }
                        showIcon={false}
                        blockNode
                        style={{ padding: "0 8px 16px", fontSize: 13 }}
                      />
                    )}
                  </>
                )}
              </>
            )}

            {!isAdminTab && (
              <div
                style={{
                  marginTop: "auto",
                  borderTop: "1px solid #f0f0f0",
                  padding: "10px 12px",
                  color: "#666",
                  fontSize: 13,
                }}
              >
                <DeleteOutlined style={{ marginRight: 8 }} />
                已不在通讯录成员
              </div>
            )}
          </Layout.Sider>
        )}

        <Layout.Content style={{ padding: 12 }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              border: "1px solid #f0f0f0",
              overflow: "hidden",
            }}
          >
            {isAdminTab ? (
              <div style={{ padding: isMobile ? "10px 12px" : "8px 16px" }}>
                <div style={{ borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>
                  <Typography.Text strong style={{ fontSize: 16 }}>
                    {selectedAdminGroup?.name || "系统管理组"}
                  </Typography.Text>
                </div>
                <div style={{ padding: "10px 0" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", rowGap: 2 }}>
                    <div style={{ color: "#262626", fontWeight: 500, padding: "10px 0" }}>创建者</div>
                    <div style={{ color: "#595959", padding: "10px 0" }}>
                      {selectedAdminGroup?.creator || creatorName}
                    </div>
                    <div style={{ color: "#262626", fontWeight: 500, padding: "10px 0" }}>系统管理员</div>
                    <div style={{ color: "#595959", padding: "10px 0", display: "flex", alignItems: "center", gap: 10 }}>
                      <Avatar.Group size="small">
                        {adminUsers.map((u) => (
                          <Avatar key={u.id} src={u.avatar} icon={<UserOutlined />}>
                            {(u.name || u.account || "?").slice(0, 1)}
                          </Avatar>
                        ))}
                      </Avatar.Group>
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => setAdminPickerOpen(true)}
                      >
                        修改
                      </Button>
                    </div>
                    <div style={{ color: "#262626", fontWeight: 500, padding: "10px 0" }}>应用权限</div>
                    <div style={{ color: "#595959", padding: "10px 0" }}>具备所有应用的管理权限</div>
                    <div style={{ color: "#262626", fontWeight: 500, padding: "10px 0" }}>功能权限</div>
                    <div style={{ color: "#595959", padding: "10px 0" }}>具备所有功能权限</div>
                    <div style={{ color: "#262626", fontWeight: 500, padding: "10px 0" }}>安全策略</div>
                    <div style={{ color: "#595959", padding: "10px 0" }}>不受安全策略限制</div>
                    <div style={{ color: "#262626", fontWeight: 500, padding: "10px 0" }}>通讯录管理范围</div>
                    <div style={{ color: "#595959", padding: "10px 0" }}>具备对所有成员的管理权限</div>
                    <div style={{ color: "#262626", fontWeight: 500, padding: "10px 0" }}>角色组管理范围</div>
                    <div style={{ color: "#595959", padding: "10px 0" }}>具备对所有角色组的管理权限</div>
                    <div style={{ color: "#262626", fontWeight: 500, padding: "10px 0" }}>外部联系人管理范围</div>
                    <div style={{ color: "#595959", padding: "10px 0" }}>具备对所有外部联系人的管理权限</div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    padding: isMobile ? "10px 12px" : "8px 16px",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      marginTop: 4,
                    }}
                  >
                    <Space size={10} wrap>
                      <Typography.Text strong style={{ fontSize: 16 }}>全部成员</Typography.Text>
                      <Space size={6}>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          允许自动同步通讯录
                        </Typography.Text>
                        <Switch
                          size="small"
                          checked={autoSyncContacts}
                          onChange={setAutoSyncContacts}
                        />
                      </Space>
                    </Space>

                    <Space size={10} wrap>
                      <Select
                        size="small"
                        value={statusFilter}
                        onChange={(v) => setStatusFilter(v)}
                        style={{ width: 110 }}
                        options={[
                          { value: "all", label: "全部" },
                          { value: "enabled", label: "启用" },
                          { value: "disabled", label: "停用" },
                        ]}
                      />
                      <Input
                        size="small"
                        allowClear
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        prefix={<SearchOutlined />}
                        placeholder="搜索成员"
                        style={{ width: isMobile ? 160 : 220 }}
                      />
                      <Button size="small" type="text" icon={<SettingOutlined />} title="列设置" />
                    </Space>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <Space size={10} wrap>
                      <Button size="small" onClick={() => setIncludeSubDept((v) => !v)}>
                        子部门成员{includeSubDept ? "（含）" : "（不含）"}
                      </Button>
                      <Button size="small" icon={<DownloadOutlined />} onClick={() => {}}>
                        批量导出
                      </Button>
                      <Button size="small" icon={<FileTextOutlined />} onClick={() => {}}>
                        通讯录日志
                      </Button>
                    </Space>
                    <div />
                  </div>
                </div>

                <Table
                  rowKey="id"
                  size="middle"
                  columns={columns as any}
                  dataSource={filteredUsers}
                  loading={userLoading}
                  pagination={{ pageSize: 20, showSizeChanger: true }}
                  scroll={{ x: 1000 }}
                />
              </>
            )}
          </div>
          <Modal
            title={`设置${selectedAdminGroup?.name || ""}管理员`}
            open={adminPickerOpen}
            onCancel={() => setAdminPickerOpen(false)}
            onOk={async () => {
              if (!selectedAdminGroup?.id) return setAdminPickerOpen(false);
              try {
                if (selectedAdminGroup.id === "sys-admin-group") {
                  const res = await roleApi.setSystemAdmins(adminDraftIds);
                  const saved = Array.isArray((res as any)?.userIds) ? (res as any).userIds : adminDraftIds;
                  setGroupAdminIds((prev) => ({
                    ...prev,
                    [selectedAdminGroup.id]: saved.map(String),
                  }));
                  void refetchSystemAdmins();
                  message.success("已保存系统管理员");
                } else {
                  // 其它管理组暂未落库，先保留本地（后续可扩展为独立角色/权限组）
                  setGroupAdminIds((prev) => ({
                    ...prev,
                    [selectedAdminGroup.id]: adminDraftIds,
                  }));
                  message.success("已保存");
                }
                setAdminPickerOpen(false);
              } catch (e: any) {
                const msg = e?.response?.data?.message || e?.message || "保存失败";
                message.error(msg);
              }
            }}
            okText="保存"
            cancelText="取消"
          >
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              可为当前管理组配置多个管理员
            </Typography.Text>
            <div style={{ marginTop: 10 }}>
              <Select
                mode="multiple"
                style={{ width: "100%" }}
                placeholder="选择管理员"
                value={adminDraftIds}
                onChange={(vals) => setAdminDraftIds(vals as string[])}
                options={users.map((u) => ({
                  value: String(u.id),
                  label: u.name || u.account || String(u.id),
                }))}
                optionFilterProp="label"
                showSearch
              />
            </div>
          </Modal>
        </Layout.Content>
      </Layout>
    </Layout>
  );
};

