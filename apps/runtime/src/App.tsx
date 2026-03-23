import { Routes, Route, useNavigate, useSearchParams } from "react-router-dom";
import { FormRenderer } from "@/components/FormRenderer";
import { FormDataList } from "@/components/FormDataList";
import { FormDataDetail } from "@/components/FormDataDetail";

function FormPage() {
  const [searchParams] = useSearchParams();
  const formId = searchParams.get("formId") || "";

  if (!formId) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <h2>请提供表单ID</h2>
        <p>使用方式: /form?formId=表单ID</p>
      </div>
    );
  }

  return <FormRenderer formId={formId} />;
}

function ListPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const formId = searchParams.get("formId") || "";

  if (!formId) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <h2>请提供表单ID</h2>
        <p>使用方式: /list?formId=表单ID</p>
      </div>
    );
  }

  return (
    <FormDataList
      formId={formId}
      onView={(recordId) => navigate(`/detail?recordId=${recordId}`)}
    />
  );
}

function DetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const recordId = searchParams.get("recordId") || "";

  if (!recordId) {
    return (
      <div style={{ textAlign: "center", padding: 50 }}>
        <h2>请提供记录ID</h2>
        <p>使用方式: /detail?recordId=记录ID</p>
      </div>
    );
  }

  return <FormDataDetail recordId={recordId} onBack={() => navigate(-1)} />;
}

function HomePage() {
  return (
    <div style={{ textAlign: "center", padding: 50 }}>
      <h1>墨枫表单运行时</h1>
      <div style={{ marginTop: 30, lineHeight: 2 }}>
        <p>
          <strong>填写表单:</strong> /form?formId=表单ID
        </p>
        <p>
          <strong>查看数据列表:</strong> /list?formId=表单ID
        </p>
        <p>
          <strong>查看数据详情:</strong> /detail?recordId=记录ID
        </p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/form" element={<FormPage />} />
      <Route path="/list" element={<ListPage />} />
      <Route path="/detail" element={<DetailPage />} />
    </Routes>
  );
}

export default App;
