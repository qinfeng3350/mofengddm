import React, { useMemo, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Button, Input, Select, Space, Tabs, Typography, message } from "antd";

type DeveloperPageConfig = {
  id: string;
  name: string;
  code: string;
};

const STORAGE_KEY = (appId?: string) => (appId ? `developerPages_${appId}` : "developerPages_unknown");
const STORAGE_SELECTED_KEY = (appId?: string) => (appId ? `developerPageSelected_${appId}` : "developerPageSelected_unknown");

export const DeveloperPage: React.FC = () => {
  const { appId } = useParams<{ appId: string }>();

  const [pages, setPages] = useState<DeveloperPageConfig[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("");
  const selectedPage = useMemo(
    () => pages.find((p) => p.id === selectedPageId) || pages[0],
    [pages, selectedPageId],
  );

  const [name, setName] = useState<string>("");
  const [code, setCode] = useState<string>("");

  useEffect(() => {
    if (!appId) return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY(appId));
      const parsed = raw ? JSON.parse(raw) : [];
      const list: DeveloperPageConfig[] = Array.isArray(parsed)
        ? parsed
            .map((x: any) => ({
              id: String(x.id),
              name: String(x.name || "未命名开发页面"),
              code: String(x.code || ""),
            }))
            .filter((x: DeveloperPageConfig) => !!x.id)
        : [];

      const selectedRaw = localStorage.getItem(STORAGE_SELECTED_KEY(appId));
      const initialSelected = selectedRaw && list.some((p) => p.id === selectedRaw) ? selectedRaw : list[0]?.id;

      setPages(list);
      setSelectedPageId(initialSelected || "");
    } catch {
      setPages([]);
      setSelectedPageId("");
    }
  }, [appId]);

  useEffect(() => {
    if (!selectedPage) {
      setName("");
      setCode("");
      return;
    }
    setName(selectedPage.name);
    setCode(selectedPage.code || "");
  }, [selectedPage]);

  const persist = (nextPages: DeveloperPageConfig[], nextSelectedId?: string) => {
    if (!appId) return;
    setPages(nextPages);
    const selected = nextSelectedId ?? selectedPageId;
    setSelectedPageId(selected);
    try {
      localStorage.setItem(STORAGE_KEY(appId), JSON.stringify(nextPages));
      localStorage.setItem(STORAGE_SELECTED_KEY(appId), selected);
    } catch {
      // ignore
    }
  };

  const handleCreateNew = () => {
    if (!appId) return;
    const nextId = `dev_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const next: DeveloperPageConfig = {
      id: nextId,
      name: "未命名开发页面",
      code: `// 这里写你的自定义页面代码（占位版）\n// appId: ${appId}\n// 你可以在后续接入：\n// 1) 表单字段/数据源\n// 2) 自定义报表渲染/自定义填写页渲染\n`,
    };
    const nextPages = [next, ...pages];
    persist(nextPages, nextId);
    message.success("已创建开发页面");
  };

  const handleSave = () => {
    if (!appId || !selectedPage) return;
    const nextPages = pages.map((p) => {
      if (p.id !== selectedPage.id) return p;
      return { ...p, name: name.trim() || "未命名开发页面", code };
    });
    persist(nextPages, selectedPage.id);
    message.success("保存成功（本地）");
  };

  return (
    <div style={{ padding: 24, background: "#fff", borderRadius: 8, minHeight: "calc(100vh - 120px)" }}>
      <Space style={{ width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          开发者页面
        </Typography.Title>
        <Space>
          <Button onClick={handleCreateNew} type="primary">
            新建自定义页面
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </Space>
      </Space>

      <Tabs
        style={{ marginTop: 16 }}
        items={[
          { key: "code", label: "代码编辑", children: null },
          { key: "preview", label: "预览", children: null },
        ]}
      />

      <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
        <div style={{ width: 320 }}>
          <Typography.Text style={{ color: "#999", fontSize: 12 }}>开发页面</Typography.Text>
          <Select
            style={{ width: "100%", marginTop: 8 }}
            value={selectedPage?.id}
            options={pages.map((p) => ({ label: p.name, value: p.id }))}
            onChange={(id) => {
              setSelectedPageId(String(id));
              try {
                if (appId) localStorage.setItem(STORAGE_SELECTED_KEY(appId), String(id));
              } catch {
                // ignore
              }
            }}
            placeholder="暂无页面"
          />

          <Input
            style={{ marginTop: 12 }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="页面名称"
          />

          <div style={{ marginTop: 12, color: "#999", fontSize: 12, lineHeight: 1.6 }}>
            说明：
            <br />
            1) 当前为“可写代码”的占位界面（保存到本地）。
            <br />
            2) 后续接入：用代码生成报表/填写页，并把数据源与表单字段联动起来。
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <Typography.Text style={{ color: "#999", fontSize: 12 }}>代码</Typography.Text>
          <Input.TextArea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={18}
            style={{ marginTop: 8, fontFamily: "monospace" }}
          />

          <div style={{ marginTop: 12 }}>
            <Button onClick={handleSave} type="primary">
              保存
            </Button>
            <Button style={{ marginLeft: 8 }} onClick={() => message.info("预览：待接入（占位）")}>
              预览
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

