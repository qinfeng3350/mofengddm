import { Routes, Route, Navigate } from "react-router-dom";
import { HomePage } from "@/pages/HomePage";
import { LandingPage } from "@/pages/LandingPage";
import { AppManagementPage } from "@/pages/AppManagementPage";
import { DesignerPage } from "@/pages/DesignerPage";
import { RuntimeFormPage } from "@/pages/RuntimeFormPage";
import { RuntimeListPage } from "@/pages/RuntimeListPage";
import { AppConfigPage } from "@/pages/AppConfigPage";
import { LoginPage } from "@/pages/LoginPage";
import { ProfilePage } from "@/pages/settings/ProfilePage";
import { PermissionPage } from "@/pages/settings/PermissionPage";
import { OrganizationPage } from "@/pages/settings/OrganizationPage";
import { SystemPage } from "@/pages/settings/SystemPage";
import { PluginPage } from "@/pages/settings/PluginPage";
import { AIPage } from "@/pages/settings/AIPage";
import { TemplatePage } from "@/pages/settings/TemplatePage";
import { ReportDesignerPage } from "@/pages/ReportDesignerPage";
import { ReportWidgetDesignerPage } from "@/pages/ReportWidgetDesignerPage";
import { RuntimeReportPage } from "@/pages/RuntimeReportPage";
import { DataVReportPage } from "@/pages/DataVReportPage";
import { DataVDesignerPage } from "@/pages/DataVDesignerPage";
import { DataVRuntimePage } from "@/pages/DataVRuntimePage";
import { BusinessRulePage } from "@/pages/BusinessRulePage";
import { PrintTemplateDesignerPage } from "@/pages/PrintTemplateDesignerPage";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { WorkflowTasksPage } from "@/pages/WorkflowTasksPage";
import { useAuthStore } from "@/store/useAuthStore";

function App() {
  const { isAuthenticated } = useAuthStore();

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/home" replace /> : <LoginPage />}
      />
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/home" replace /> : <LandingPage />}
      />
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/:appId"
        element={
          <ProtectedRoute>
            <RuntimeListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/:appId/pages"
        element={
          <ProtectedRoute>
            <AppManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/:appId/data"
        element={
          <ProtectedRoute>
            <RuntimeListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/:appId/config"
        element={
          <ProtectedRoute>
            <AppConfigPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/designer"
        element={
          <ProtectedRoute>
            <DesignerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/runtime/form"
        element={
          <ProtectedRoute>
            <RuntimeFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/runtime/list"
        element={
          <ProtectedRoute>
            <RuntimeListPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workflow/tasks"
        element={
          <ProtectedRoute>
            <WorkflowTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/permission"
        element={
          <ProtectedRoute>
            <PermissionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/organization"
        element={
          <ProtectedRoute>
            <OrganizationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/system"
        element={
          <ProtectedRoute>
            <SystemPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/plugin"
        element={
          <ProtectedRoute>
            <PluginPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/ai"
        element={
          <ProtectedRoute>
            <AIPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings/template"
        element={
          <ProtectedRoute>
            <TemplatePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/widget/designer"
        element={
          <ProtectedRoute>
            <ReportWidgetDesignerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/designer"
        element={
          <ProtectedRoute>
            <ReportDesignerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/:appId/report"
        element={
          <ProtectedRoute>
            <RuntimeReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/:appId/report/datav"
        element={
          <ProtectedRoute>
            <DataVReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/datav/designer"
        element={
          <ProtectedRoute>
            <DataVDesignerPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/:appId/datav"
        element={
          <ProtectedRoute>
            <DataVRuntimePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/:appId/rules"
        element={
          <ProtectedRoute>
            <BusinessRulePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/designer/print-template"
        element={
          <ProtectedRoute>
            <PrintTemplateDesignerPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
