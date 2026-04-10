import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Dropdown,
  Space,
  Avatar,
  Button,
  Modal,
  Select,
  message,
} from "antd";
import type { MenuProps } from "antd";
import {
  UserOutlined,
  TeamOutlined,
  LockOutlined,
  AppstoreOutlined,
  BankOutlined,
  SettingOutlined,
  FileTextOutlined,
  GlobalOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { apiClient } from "@/api/client";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/useAuthStore";

type Props = {
  /** 是否显示姓名（头像右侧） */
  showUserName?: boolean;
};

/**
 * 用户头像下拉：租户信息、个人信息、企业管理等，与首页行为一致。
 */
export const UserAccountDropdown = ({ showUserName = true }: Props) => {
  const navigate = useNavigate();
  const { user, clearAuth } = useAuthStore();

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

  const [tenantSwitchOpen, setTenantSwitchOpen] = useState(false);
  const [tenantSwitchLoading, setTenantSwitchLoading] = useState(false);
  const [tenantOptions, setTenantOptions] = useState<
    Array<{ id: string; code?: string; name?: string }>
  >([]);
  const [targetTenantId, setTargetTenantId] = useState<string | null>(null);

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login");
  }, [clearAuth, navigate]);

  const handleTenantSwitchOpen = useCallback(async () => {
    setTenantSwitchOpen(true);
    setTenantSwitchLoading(true);
    try {
      const res = await authApi.getTenants();
      const list = Array.isArray(res) ? res : (res as any)?.tenants ?? [];
      message.info(`检测到可切换租户：${list.length} 个`);
      setTenantOptions(list);
      setTargetTenantId(list?.[0]?.id ?? null);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "获取租户列表失败";
      message.error(msg);
      console.error("获取租户列表失败:", e);
    } finally {
      setTenantSwitchLoading(false);
    }
  }, []);

  const handleTenantSwitchConfirm = useCallback(async () => {
    if (!targetTenantId) {
      message.warning("请选择要切换的租户");
      return;
    }
    setTenantSwitchLoading(true);
    try {
      const res = await authApi.switchTenant({ tenantId: targetTenantId });
      if (res?.access_token && res?.user) {
        useAuthStore.getState().setAuth(res.access_token, res.user);
        message.success("租户切换成功");
        setTenantSwitchOpen(false);
        window.location.reload();
      } else {
        message.error("租户切换失败：响应格式错误");
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || "租户切换失败";
      message.error(msg);
      console.error("租户切换失败:", e);
    } finally {
      setTenantSwitchLoading(false);
    }
  }, [targetTenantId]);

  const handleMenuClick = useCallback(
    (key: string) => {
      switch (key) {
        case "profile":
          navigate("/settings/profile");
          break;
        case "organization":
          navigate("/settings/organization");
          break;
        case "permission":
          navigate("/settings/permission");
          break;
        case "plugin":
          navigate("/settings/plugin");
          break;
        case "enterprise":
          navigate("/settings/enterprise");
          break;
        case "system":
          navigate("/settings/system");
          break;
        case "template":
          navigate("/settings/template");
          break;
        case "website":
          window.open("/", "_blank");
          break;
        case "logout":
          handleLogout();
          break;
        default:
          break;
      }
    },
    [handleLogout, navigate],
  );

  const userMenuItems: MenuProps["items"] = useMemo(
    () => [
      {
        key: "tenant",
        label: (
          <div style={{ padding: "8px 0" }}>
            <div style={{ fontWeight: 500 }}>
              {(currentUserInfo as any)?.tenant?.name ||
                (currentUserInfo as any)?.tenant?.code ||
                "默认租户"}
            </div>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, height: "auto" }}
              onClick={(e) => {
                e.stopPropagation();
                void handleTenantSwitchOpen();
              }}
            >
              切换
            </Button>
          </div>
        ),
        onClick: () => {
          void handleTenantSwitchOpen();
        },
      },
      { type: "divider" },
      {
        key: "profile",
        label: "个人信息",
        icon: <UserOutlined />,
        onClick: () => handleMenuClick("profile"),
      },
      {
        key: "organization",
        label: "组织机构",
        icon: <TeamOutlined />,
        onClick: () => handleMenuClick("organization"),
      },
      {
        key: "permission",
        label: "权限管理",
        icon: <LockOutlined />,
        onClick: () => handleMenuClick("permission"),
      },
      {
        key: "plugin",
        label: "插件中心",
        icon: <AppstoreOutlined />,
        onClick: () => handleMenuClick("plugin"),
      },
      {
        key: "enterprise",
        label: "企业管理",
        icon: <BankOutlined />,
        onClick: () => handleMenuClick("enterprise"),
      },
      {
        key: "system",
        label: "系统管理",
        icon: <SettingOutlined />,
        onClick: () => handleMenuClick("system"),
      },
      {
        key: "template",
        label: "模板中心",
        icon: <FileTextOutlined />,
        onClick: () => handleMenuClick("template"),
      },
      {
        key: "website",
        label: "墨枫官网",
        icon: <GlobalOutlined />,
        onClick: () => handleMenuClick("website"),
      },
      { type: "divider" },
      {
        key: "logout",
        label: "退出登录",
        icon: <LogoutOutlined />,
        onClick: () => handleMenuClick("logout"),
      },
    ],
    [currentUserInfo, handleMenuClick, handleTenantSwitchOpen],
  );

  const displayName =
    (currentUserInfo as any)?.name ||
    user?.name ||
    (currentUserInfo as any)?.account ||
    user?.account ||
    "未登录";

  return (
    <>
      <Dropdown
        menu={{ items: userMenuItems }}
        placement="bottomRight"
        trigger={["click"]}
      >
        <Space style={{ cursor: "pointer" }}>
          <Avatar
            src={(currentUserInfo as any)?.avatar || user?.avatar}
            icon={<UserOutlined />}
            style={{ backgroundColor: "#1890ff" }}
            size="default"
          >
            {((displayName[0] || "") as string).toUpperCase()}
          </Avatar>
          {showUserName ? (
            <span style={{ fontSize: 14, color: "#333" }}>{displayName}</span>
          ) : null}
        </Space>
      </Dropdown>

      <Modal
        title="切换租户"
        open={tenantSwitchOpen}
        onCancel={() => setTenantSwitchOpen(false)}
        confirmLoading={tenantSwitchLoading}
        onOk={() => void handleTenantSwitchConfirm()}
        okText="切换"
      >
        <Select
          value={targetTenantId ?? undefined}
          onChange={(v) => setTargetTenantId(String(v))}
          style={{ width: "100%" }}
          placeholder="请选择要切换的租户"
          options={tenantOptions.map((t) => ({
            label: t.name ? (t.code ? `${t.name}(${t.code})` : t.name) : t.code ? t.code : t.id,
            value: t.id,
          }))}
        />
      </Modal>
    </>
  );
};
