import { useSearchParams, useNavigate } from "react-router-dom";
import { Button, Modal, Checkbox, Space } from "antd";
import { ArrowLeftOutlined, ShareAltOutlined, BorderOutlined, CloseOutlined } from "@ant-design/icons";
import { FormRenderer } from "@/components/FormRenderer";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formDefinitionApi } from "@/api/formDefinition";

export const RuntimeFormPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const formId = searchParams.get("formId") || "";
  const [submitAndAddNext, setSubmitAndAddNext] = useState(false);

  const { data: formDefinition } = useQuery({
    queryKey: ["formDefinition", formId],
    queryFn: () => formDefinitionApi.getById(formId),
    enabled: !!formId,
  });

  if (!formId) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <h2>请提供表单ID</h2>
        <Button onClick={() => navigate("/home")}>返回首页</Button>
      </div>
    );
  }

  const handleSubmitSuccess = () => {
    if (submitAndAddNext) {
      // 提交后新增下一条，重置表单
      window.location.reload();
    } else {
      // 提交后关闭窗口（如果是新窗口）或返回列表
      if (window.opener) {
        // 如果是通过 window.open 打开的，关闭窗口并刷新父窗口
        window.opener.location.reload();
        window.close();
      } else {
        // 否则返回列表
        const appId = searchParams.get("appId");
        if (appId) {
          navigate(`/app/${appId}/data?formId=${formId}`);
        } else {
          navigate(`/runtime/list?formId=${formId}`);
        }
      }
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      {/* 顶部导航栏 */}
      <div style={{ 
        padding: "12px 24px", 
        background: "#fff", 
        borderBottom: "1px solid #f0f0f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <Space>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => {
              if (window.opener) {
                window.close();
              } else {
                const appId = searchParams.get("appId");
                if (appId) {
                  navigate(`/app/${appId}/data?formId=${formId}`);
                } else {
                  navigate(`/runtime/list?formId=${formId}`);
                }
              }
            }}
          >
            返回
          </Button>
        </Space>
        <Space>
          <Button type="text" icon={<ShareAltOutlined />} />
          <Button type="text" icon={<BorderOutlined />} />
          <Button type="text" icon={<CloseOutlined />} onClick={() => navigate(`/runtime/list?formId=${formId}`)} />
        </Space>
      </div>

      {/* 表单内容 */}
      <div style={{ padding: "24px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ 
          background: "#fff", 
          borderRadius: 8, 
          padding: 24,
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
        }}>
          <h2 style={{ marginBottom: 24 }}>
            {formDefinition?.formName || "表单"} - 新增
          </h2>
          <FormRenderer 
            formId={formId} 
            onSubmitSuccess={handleSubmitSuccess}
          />
          <div style={{ 
            marginTop: 24, 
            paddingTop: 16, 
            borderTop: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <Checkbox 
              checked={submitAndAddNext}
              onChange={(e) => setSubmitAndAddNext(e.target.checked)}
            >
              提交后新增下一条
            </Checkbox>
            <Space>
              <Button onClick={() => navigate(`/runtime/list?formId=${formId}`)}>
                暂存
              </Button>
            </Space>
          </div>
        </div>
      </div>
    </div>
  );
};

