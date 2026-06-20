# 第一阶段实施任务清单：后台菜单与 DreamShootAI 装修器

日期：2026-05-30

目标：先把系统从“功能堆叠 demo”推进到“客户能看懂的 SaaS 店铺后台 + 可拖拽装修出 DreamShootAI 首页”的阶段。

## A. 后台菜单清晰化

### A1. 固定站点后台 8 个一级模块

文件：

- `src/app/site/[siteSlug]/admin/_lib/site-admin-context.tsx`
- `src/components/ui.tsx`

任务：

- 固定模块 code：
  - `overview`
  - `design`
  - `products`
  - `orders`
  - `customers`
  - `ai`
  - `content`
  - `settings`
- `AdminShell` 高亮逻辑改为显式 `activeModuleCode`。
- 删除靠 nav 文本猜测 active module 的逻辑。

验收：

- 每个模块点击都进入实际页面。
- 左侧不会出现重复、跳错、hash-only 的主要入口。

### A2. `/admin` 只保留总览

文件：

- `src/app/site/[siteSlug]/admin/page.tsx`

任务：

- 保留：
  - 今日待办
  - 上线检查
  - 经营数据
  - 模块入口
  - 最近活动
- 移除：
  - 商品编辑器
  - 客户编辑器
  - AI 编辑器
  - 设计器配置
  - 巨型隐藏兼容区域

验收：

- 页面结构不超过 4 个主要区块。
- 不出现跨模块表单。

### A3. 前台装修子菜单

新增页面：

```text
src/app/site/[siteSlug]/admin/design/pages/page.tsx
src/app/site/[siteSlug]/admin/design/navigation/page.tsx
src/app/site/[siteSlug]/admin/design/publications/page.tsx
```

任务：

- `pages`：页面列表、slug、template、draft/live 状态。
- `navigation`：header/footer 菜单管理。
- `publications`：发布历史、版本、发布时间、回滚入口。

验收：

- `/admin/design` 只做视觉装修器。
- 页面/菜单/发布历史能从装修模块进入。

## B. 装修器结构化

### B1. 拆分 DesignerClient

源文件：

- `src/components/designer/designer-client.tsx`

新增：

```text
src/components/designer/designer-state.ts
src/components/designer/designer-actions.ts
src/components/designer/page-tree.tsx
src/components/designer/section-tree.tsx
src/components/designer/module-library.tsx
src/components/designer/property-inspector.tsx
src/components/designer/resource-selector.tsx
src/components/designer/preview-frame.tsx
```

验收：

- `designer-client.tsx` 只负责布局和 state 组合。
- 拖拽、字段、资源选择不再全部挤在一个文件。

### B2. 模块库拖入指定位置

文件：

- `src/components/designer/module-library.tsx`
- `src/components/designer/section-tree.tsx`
- `src/components/designer/designer-actions.ts`

任务：

- 模块库卡片支持 drag。
- section tree 支持 before/after drop indicator。
- drop 后插入新 section 到指定位置。
- 支持空页面 drop。

验收：

- 不用点击“追加到底部”，可以拖到任意 section 上方/下方。

### B3. Section/Block 操作完整化

任务：

- section：
  - add
  - move
  - duplicate
  - delete
  - disable
- block：
  - add
  - move
  - duplicate
  - delete

验收：

- 页面结构树能完成常规店铺首页装修操作。

### B4. 属性面板降噪

任务：

- 默认显示业务字段。
- 技术字段放折叠区。
- 字段控件使用统一视觉：
  - label
  - control
  - helper/error

验收：

- 站点管理员不会看到一堆 JSON/API/contract 文案。

## C. DreamShootAI 主题包

### C1. 新增主题包目录

新增：

```text
src/lib/theme/packages/dreamshoot-ai-studio/manifest.ts
src/lib/theme/packages/dreamshoot-ai-studio/templates.ts
src/lib/theme/packages/dreamshoot-ai-studio/sections.ts
src/lib/theme/packages/dreamshoot-ai-studio/settings.ts
```

任务：

- 定义主题名、预览图、默认颜色、字体、页面模板。
- 先用 TS 对象，不急着做文件上传导入。

### C2. 首页 sections

必须定义：

- `dreamshoot_header`
- `dreamshoot_hero`
- `auth_capture_panel`
- `trust_signal_bar`
- `campaign_banner`
- `how_it_works_video`
- `upload_steps`
- `photo_package_marquee`
- `photo_package_wall`
- `pricing_table`
- `testimonial_wall`
- `faq_accordion`
- `dreamshoot_footer`

验收：

- 安装主题后首页默认顺序完整。

### C3. 业务绑定 sections

必须定义：

- `generation_form`
- `upload_panel`
- `job_progress`
- `album_gallery`
- `ai_tool_entry`

验收：

- tool detail 页面可用这些 section 拼出来。

### C4. Registry 接入

新增：

- `src/lib/theme/registry.ts`

任务：

- `getThemePackage`
- `getThemePackages`
- `getSectionDefinitions`
- `createDefaultPage`
- `createDefaultSettings`

临时兼容：

- `section-schema.ts` 可以继续 re-export legacy schemas。
- 新 DreamShoot schemas 先合并进现有 registry。

## D. 发布与回滚命名修正

### D1. 新增发布服务函数

文件：

- `src/lib/server-store.ts`

新增：

```ts
publishThemeDraft(siteId, actor, options)
rollbackThemeDraft(siteId, publicationId)
```

保留：

- `publishDraftPage` 作为兼容 wrapper。

验收：

- API 行为不变。
- 内部命名和实际整站发布一致。

### D2. Snapshot 增强

任务：

- snapshot 增加：
  - `schemaVersion`
  - `themeKey`
  - `mediaManifest`
  - `sectionDefinitionVersions`

验收：

- Theme Manager 可以显示当前 active publication。

## E. 校验

每轮必须跑：

```bash
npm run typecheck
```

第一阶段完成后还要检查：

```text
http://localhost:3000/site/lumen/admin
http://localhost:3000/site/lumen/admin/design
http://localhost:3000/site/lumen/admin/themes
http://localhost:3000/site/lumen
```

验收口径：

- 后台菜单清晰。
- 装修器能拖拽模块。
- DreamShootAI 首页结构可由主题默认模板生成。
- 草稿/发布/回滚边界仍可用。

