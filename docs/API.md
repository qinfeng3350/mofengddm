# 接口文档

本文档描述**后端 HTTP API** 的入口约定与主要路径。详细请求体、响应字段以 `services/core` 中各 Controller 与 DTO 为准。

---

## 1. 基础约定

- **Base URL**：部署时由网关或反向代理决定；本地开发时 Portal 通常使用相对路径 `/api`，由 Vite 代理到 Core 服务。
- **认证**：大部分业务接口需要 JWT（请求头 `Authorization: Bearer <token>`），具体以各 Controller 上的守卫为准。
- **租户**：多租户场景下，业务数据与 `tenantId` 关联；切换租户等能力见 `/api/auth` 相关接口。

---

## 2. 健康与 API 索引

- `GET /api`：返回服务名称、版本与主要端点索引（见 `AppController.getApiInfo`）。

---

## 3. 认证与用户

- **前缀**：`/api/auth`
- 常见能力：注册、登录、个人信息、租户列表、切换租户、修改密码等（见 `auth.controller.ts` 与前端 `api/auth.ts`）。

---

## 4. 应用与表单定义

- **应用**：`/api/applications`（见 application 模块）。
- **表单定义**：`/api/form-definitions`（见 `form-definition.controller.ts`）。
- **应用内表单关联**：见 `application-forms.controller.ts` 等。

---

## 5. 表单数据

- **前缀**：`/api/form-data`（见 `form-data.controller.ts`）。
- 用于表单实例数据的增删改查；具体查询参数与权限与租户、应用、表单 ID 绑定。

---

## 6. 工作流

- **前缀**：`/api/workflows`（见 workflow 模块）。
- 待办、流程实例等与 Portal 待办中心对接。

---

## 7. 业务规则与其他

- **业务规则**：`/api/business-rules`。
- **用户**：`/api/users`。
- **部门等组织数据**：见 `department.controller.ts` 等。

---

## 8. 许可与租户限制（若已启用）

- **前缀**：`/api/licenses`
- 包含许可证生成、发放、租户限额管理等；部分接口需管理密钥请求头（如 `x-admin-secret`），**切勿在前端暴露**。

---

## 9. 租户指标（若已部署）

- 若已接入 `tenant-metrics` 模块，可能存在如 `GET /api/tenants/me/metrics` 等统计接口（以实际路由注册为准）。

---

## 10. 调试建议

- 使用浏览器开发者工具查看 Portal 发起的 `/api/...` 请求与响应。
- 后端可使用 NestJS 日志与 Swagger（若项目已启用）辅助调试。

接口变更时请务必更新本文档与 `CHANGELOG.md`，并保证前端 `apiClient` 封装与错误提示一致。
