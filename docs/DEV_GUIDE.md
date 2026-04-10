# 开发文档

面向**在本仓库中开发、部署、扩展功能**的研发人员。

---

## 1. 仓库结构（概要）

- `apps/portal`：React + Vite 前端（Ant Design），业务门户与表单运行时。
- `packages/shared-schema`：共享表单 schema 与字段类型定义。
- `services/core`：NestJS 后端 API（表单定义、数据、工作流等）。

本地开发时，前端通常通过 Vite 将 `/api` 代理到后端（默认 `http://127.0.0.1:4000`，以项目配置为准）。

---

## 2. 本地运行（Portal）

在 `apps/portal` 目录：

- 安装依赖：按 monorepo 根目录工作区约定执行安装（如 `pnpm install`）。
- 启动：`pnpm dev` 或根目录提供的等价脚本。
- 环境变量：按 `vite` 与 `.env` 约定配置；公网 HMR 等特殊项见 `vite.config.ts` 注释。

---

## 3. 公式与前端扩展

- **公式引擎**：`apps/portal/src/utils/formulaEngine.ts` 负责解析 `{字段}` 引用、部分函数与表达式求值。
- **子表公式**：子表行内计算在 `FormFieldRenderer` 中与表单值联动；修改求值或引用规则时需同时关注「行上下文」与主表汇总（如 `SUM`）。
- **全角符号**：引擎会对常见全角运算符、括号做归一，减少用户从中文输入法直接输入导致的错误。

扩展新函数或语法时，请保持与现有字段 `fieldId` / 标签匹配逻辑一致，并补充必要测试与更新日志说明。

---

## 4. 开发者页面

- 路由：`/app/:appId/developer`。
- 当前实现将页面配置存于浏览器本地存储；若需跨设备或与后端同步，需新增 API 与持久化设计。

---

## 5. 文档站点

- 站内文档页面通过 Vite `?raw` 引入 `docs/*.md` 文件渲染为纯文本阅读；修改文档时直接编辑仓库根目录 `docs/` 下 Markdown 即可。

---

## 6. 代码协作建议

- 小步提交，用户可见行为变更写在 `docs/CHANGELOG.md`。
- UI 变更尽量贴合现有 Ant Design 与项目内组件风格，避免无关重构。
