import { Button, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import changelog from "@docs/CHANGELOG.md?raw";
import userGuide from "@docs/USER_GUIDE.md?raw";
import devGuide from "@docs/DEV_GUIDE.md?raw";
import apiDoc from "@docs/API.md?raw";
import { usePageTitle } from "@/hooks/usePageTitle";

const DOC_MAP: Record<string, { title: string; body: string }> = {
  changelog: { title: "更新日志", body: changelog },
  user: { title: "使用文档", body: userGuide },
  dev: { title: "开发文档", body: devGuide },
  api: { title: "接口文档", body: apiDoc },
};

export const DocsPage = () => {
  const { doc } = useParams<{ doc: string }>();
  const navigate = useNavigate();
  const entry = doc ? DOC_MAP[doc] : undefined;

  usePageTitle(entry ? `${entry.title} - 墨枫低代码平台` : "文档 - 墨枫低代码平台");

  if (!entry) {
    return <Navigate to="/home" replace />;
  }

  return (
    <div style={{ padding: 24, maxWidth: 960, margin: "0 auto", minHeight: "calc(100vh - 48px)" }}>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 8, paddingLeft: 0 }}
      >
        返回
      </Button>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        {entry.title}
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
        以下内容来自仓库 Markdown，仅供阅读；排版为纯文本样式。
      </Typography.Paragraph>
      <pre
        style={{
          margin: 0,
          padding: 16,
          background: "#fafafa",
          border: "1px solid #f0f0f0",
          borderRadius: 8,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 13,
          lineHeight: 1.65,
        }}
      >
        {entry.body}
      </pre>
    </div>
  );
};
