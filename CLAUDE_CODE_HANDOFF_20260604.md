# Claude Code Handoff

## 1. 项目目标

当前项目不是普通 AI landing page，而是一个多站点 AI 订阅平台，核心目标是：

- 平台总后台管理多个站点
- 每个站点有独立前台、独立 `/admin` 后台、独立客户体系、独立订阅/credits
- 设计器必须对标 `/Users/cxm/saas` 的 SaaS/XFCart 主题装修器，而不是“更现代的 React 版”
- 当前用户的明确要求是：
  - `/site/lumen/admin/design` 要继续对标到和 saas 界面“基本一样”
  - 排版要清晰
  - 重点不是继续加功能，而是把设计器壳层和交互节奏做得像原版

## 2. 当前可运行状态

工作目录：

- `/Users/cxm/Documents/订阅整体`

本地服务：

- `npm run dev`
- 当前验证时 `localhost:3000` 已正常监听

核心脚本：

- `npm run typecheck`
- `npm run smoke:core`

当前验证结果：

- `npm run typecheck`：通过
- `npm run smoke:core`：通过
- 设计器页面真实可打开，预览 iframe 正常渲染

## 3. 当前可用地址与账号

平台总后台：

- `http://localhost:3000/platform/login`
- 账号：`platform@local.test`
- 密码：`platform123`

Lumen 站点后台：

- `http://localhost:3000/site/lumen/admin/login`
- 账号：`owner@lumen.localhost`
- 密码：`lumen123`

Lumen 前台：

- `http://localhost:3000/site/lumen`

Lumen 设计器：

- `http://localhost:3000/site/lumen/admin/design`

## 4. 已完成的关键工作

### 4.1 设计器预览权限问题已修复

之前设计器中间 iframe 预览会因为站点后台 cookie 和预览页鉴权不一致而空白。

现在已改成：

- 设计器页面生成 `previewToken`
- 预览页支持：
  - 正常 site admin cookie
  - 或签名的 `previewToken`

相关文件：

- `src/lib/designer-preview-auth.ts`
- `src/app/site/[siteSlug]/admin/design/page.tsx`
- `src/app/site/[siteSlug]/admin/design/preview/[pageId]/page.tsx`
- `src/components/designer/preview-frame.tsx`

这是当前设计器可继续迭代的基础，后续不要回退。

### 4.2 设计器整体壳层已经进入 SaaS 结构

目前已经具备：

- 顶部深色 toolbar
- 中间预览区域
- 右侧固定 `454px`
- 右侧内部分栏 `156px + 298px`
- `积木配置 / 全局配置` 双 tab
- section / block schema 驱动编辑
- 预览、保存、发布、回滚、theme records、saas-action / xfcart-edit 链路还在

### 4.3 本轮已经做的设计器对标收紧

本轮已经落地的 UI 调整：

- section 默认展开策略从“前四个都展开”改成“只展开当前 section”
- 右侧 `widget_settings` 改成统一 padding / 间距节奏
- section/global 外层从常驻浅灰卡片，改为更接近 saas 的 plain 外壳
- 资源选择字段、字体字段、菜单字段去掉多余的 `mx/px` 补偿
- `widget_back`、`widget-selected-line`、底部 action row 已经往 saas 方向收紧一轮

本轮实际改动文件：

- `src/components/designer/designer-client.tsx`
- `src/components/designer/designer-sidebar-primitives.tsx`
- `src/components/designer/designer-structure-primitives.tsx`
- `src/components/designer/global-tree.tsx`
- `src/components/designer/property-panel.tsx`
- `src/components/designer/field-editor-registry.tsx`
- `src/app/globals.css`

## 5. 当前真实界面状态

通过 Chrome DevTools 实际查看 `http://localhost:3000/site/lumen/admin/design`，当前状态如下：

- 页面可正常进入
- 顶部工具条已是深色 saas 风格
- 中间预览 iframe 正常显示 Lumen 前台首页
- 右侧面板已经是较接近 saas 的 `widget_back + widget_settings` 节奏
- `积木配置 / 全局配置` tab 可用

但是离“和 saas 基本一样”仍然有明确差距。

## 6. 仍未完成的对标差距

### 6.1 左侧结构树仍然不像原版 SaaS

这是当前最大差距。

具体表现：

- 左侧结构树仍偏“干净 React 列表”
- 还不够像 saas 那种更紧、更直接、更粗粝的装修树
- section 行、block 行、展开箭头、拖拽手柄、添加 block 行的节奏还差一截
- 白色切边和 `tools_active` 的感觉还不够强
- 全局配置树也还不够像 saas 原始 `global_setting` 列表

### 6.2 右侧属性面板虽然收紧了，但还没完全复刻

具体差距：

- 字段密度接近了，但还没做到“看上去几乎一样”
- `widget-selected-line` 的编辑行还可以更贴原版
- 标题、说明、字段块之间的呼吸还可以更贴 saas

### 6.3 仍残留一些 React 化的抽象痕迹

例如：

- `DesignerSidebarPanel` 在 bare/full 两套壳里还有自定义摘要逻辑
- `PageTree` / `ModuleLibrary` / chooser 一些 UI 仍偏“组件库感”
- 要继续削掉这些“后台产品化 UI”痕迹，改成更接近 SaaS 原版的装修器感

## 7. 接手时先看的文件

### SaaS 原始参考

- `/Users/cxm/saas/app/view/admin/theme_edit.html`
- `/Users/cxm/saas/app/view/admin/css/theme.css`
- `/Users/cxm/saas/app/view/admin/css/theme_after.css`

重点看这些 class/结构：

- `sectiona_l3bt`
- `section__header_title_94d5`
- `blocks__item_0377`
- `move_icon_fc26`
- `widget_back`
- `widget_settings`
- `widget-selected-line`
- `global_5bc8`
- `icon_wrapper_49aa`
- `tools_active`

### 当前设计器关键文件

- `src/components/designer/designer-client.tsx`
- `src/components/designer/section-tree.tsx`
- `src/components/designer/global-tree.tsx`
- `src/components/designer/designer-structure-primitives.tsx`
- `src/components/designer/designer-sidebar-primitives.tsx`
- `src/components/designer/designer-workspace-pane.tsx`
- `src/components/designer/designer-workspace-primitives.tsx`
- `src/components/designer/designer-property-pane.tsx`
- `src/components/designer/property-panel.tsx`
- `src/components/designer/designer-selection-editor.tsx`
- `src/components/designer/field-editor-registry.tsx`
- `src/components/designer/resource-selector.tsx`
- `src/app/globals.css`

### 预览/协议不要破坏的文件

- `src/lib/designer-preview-auth.ts`
- `src/components/designer/designer-xfcart-bridge.ts`
- `src/components/designer/designer-preview-protocol.ts`
- `src/components/designer/preview-frame.tsx`

## 8. 明确不要破坏的链路

Claude 接手时不要为了改 UI 把这些链路搞坏：

- `ThemePageJson`
- `ThemeSettings`
- preview iframe 选中同步
- `previewToken` 预览鉴权
- `save / publish / rollback`
- `saas-action`
- `xfcart-edit`
- theme install / apply / activate / export / reset
- `npm run smoke:core` 现有通过状态

## 9. 建议的接手顺序

建议按这个顺序做，不要同时大改所有层：

1. 只做左侧结构树
   - 目标：让 section / block / global tree 的视觉和 saas 更像
   - 优先改：
     - `designer-sidebar-primitives.tsx`
     - `designer-structure-primitives.tsx`
     - `section-tree.tsx`
     - `global-tree.tsx`
     - `globals.css`

2. 再做右侧属性面板
   - 目标：继续把 `widget_settings`、`widget-selected-line`、底部 action 区贴近原版
   - 优先改：
     - `property-panel.tsx`
     - `designer-property-pane.tsx`
     - `field-editor-registry.tsx`
     - `globals.css`

3. 最后收 chooser / library / popover
   - 目标：把 add module / add block / popover 视觉再贴原版
   - 优先改：
     - `designer-block-chooser.tsx`
     - `designer-module-chooser.tsx`
     - `module-library.tsx`

## 10. 推荐的验收方式

不要只看代码，要直接打开页面验收：

- `http://localhost:3000/site/lumen/admin/design`

验收重点：

- 顶部 toolbar 是否更接近 saas
- 右侧 `454px` 是否稳定
- 左 rail `156px` 是否看起来像原版装修树
- 结构树选中态是否有明显白色切边 / active 感
- block 行、add block 行、drag handle 是否像原版
- 右侧字段节奏是否更像原版 `widget_settings`

回归验证：

- `npm run typecheck`
- `npm run smoke:core`

## 11. 当前接手判断

如果 Claude Code 直接接手，当前不是从零开始，而是：

- 功能主链可跑
- 预览权限问题已修好
- SaaS 化后台壳层和设计器壳层都已经搭起来
- 当前主要剩下“设计器视觉与排版继续对标”，尤其是左侧结构树

简化结论：

- 功能链路：可继续迭代
- 设计器对标完成度：大约 60% 到 70%
- 最大短板：左侧结构树还不够像 saas
- 下一阶段重点：少谈抽象，直接按原始 `theme_edit.html + theme.css + theme_after.css` 去磨 UI
