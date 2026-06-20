# SAAS 对标 DreamShootAI 当前权威改造蓝图

日期：2026-05-30

本文件是 `/Users/cxm/Documents/订阅整体` 后续改造的当前权威方案。旧的过程文档只作为参考；后续菜单、装修器、主题包和验收以本文为准。

目标不是照抄 `/Users/cxm/saas` 的 PHP/jQuery 代码，而是吸收它的产品模型：一个店铺就是一个独立经营单元；每个店铺有独立后台、前台、主题、商品、订单、客户、装修草稿和发布版本。

当前核心目标：

1. 管理后台菜单和工作流必须清晰，客户能一眼看懂每个模块负责什么。
2. 装修器必须对标 SaaS 店铺装修：页面树、section/block 树、模块库、属性面板、iframe 预览、拖拽排序、草稿保存、发布、回滚。
3. DreamShootAI 不再只是写死首页，而要沉淀为一个可安装、可复制、可拖拽装修的 AI 摄影订阅主题包。
4. 第一阶段先做到“可展示、可演示、可继续工程化”，不宣称真实生产上线。

## 1. 当前源码真实状态

### 已经具备

- Next.js App Router + TypeScript 项目骨架。
- 平台后台 `/platform`。
- 站点后台 `/site/[siteSlug]/admin`。
- 站点前台 `/site/[siteSlug]`。
- 平台管理员、站点管理员、客户三套登录入口。
- `site_id` 作为租户边界。
- 客户、产品、价格、订单、订阅、credits、ledger、AI apps、jobs、albums、assets 的演示闭环。
- 主题页面 JSON：`sectionsOrder + sections`。
- `draftJson / publishedJson` 草稿和发布版本。
- 设计器已有 section/block 拖拽、模块库、字段编辑、iframe 预览、保存草稿、发布、回滚。
- `src/lib/admin-menu.ts` 已经抽出平台/站点菜单配置。
- `AdminShell` 已从 `src/components/ui.tsx` 拆到 `src/components/admin/admin-shell.tsx`，模块栏和命令栏已分别进入 `admin-module-rail.tsx`、`admin-command-bar.tsx`。
- `dreamshoot-ai-studio` 主题包已从 `registry.ts` 拆到 `src/lib/theme/packages/dreamshoot-ai-studio/`，`registry.ts` 仅保留兼容导出。
- DreamShootAI 主题模板已覆盖 `home / pricing / packages / package-detail / tool-detail / login / app-home / job-progress / album / account-billing / help / policy / blog-list / blog-detail`。
- `pricing_table`、`photo_package_wall`、`hero`、`login_method_panel`、`generation_form`、`album_gallery` 等 AI/订阅业务 section 已有渲染。
- 站点后台 Design 模块已新增 `/admin/design/pages`、`/admin/design/navigation`、`/admin/design/publications`，普通后台能管理页面树、导航菜单和发布快照，不再只依赖全屏装修器。
- 全屏 `Design` 已补统一的 design workspace tabs，能在 `装修器 / 页面 / 导航 / SEO / 主题 / 素材 / 发布 / 前台` 之间切换，不再像孤立页面。
- 页面管理支持按页进入装修器、预览 draft 页面、打开前台、查看 section/block 数、发布整站和回滚单页草稿。
- 导航管理支持编辑 header/footer links，并保存到 `theme_settings.draft_json`。
- 发布历史页支持发布当前整站草稿、把 draft 恢复到最新线上 publication，也支持指定历史 publication 恢复到草稿后再预览/发布。
- 已新增发布前校验：页面树、导航链接、真实价格、Stripe Connect、AI 工具绑定、媒体引用、政策页覆盖和 SEO metadata 会在发布历史页集中展示，存在阻断项时发布按钮不可用。
- 站点后台 Design 模块已新增 `/admin/design/seo`，可编辑全局 site title、description、title template、默认 OG、robots，以及逐页 title、description、canonical、OG 和 noindex/follow。
- 前台首页、定价页、工具页、catch-all 内容页、客户登录、客户工作台和任务进度页已接入 `generateMetadata`，发布后读取 `theme_settings.published_json.seo`。
- `npm run typecheck` 和 `npm run smoke:core` 当前通过。

### 仍然不足

- 运行时主存储仍是 `data/platform-state.json`，不是 Postgres 事务模型。
- `prisma/schema.prisma` 是目标模型，尚未真正接管运行时。
- Stripe Connect 是 dev-shaped，生产签名、connected account checkout、refund/dispute 还不完整。
- AI worker 回调闭环已有，但 HMAC 验证、超时补偿、幂等审计还需硬化。
- `designer-client.tsx` 仍然过大，但 `PageTree`、`PreviewFrame` 和 `PropertyInspector` 已先拆出，后续继续拆 section 树、模块库、字段控件和资源选择器。
- DreamShootAI 主题已有独立目录，但 `sections.ts / settings.ts` 还未继续拆出，主题市场安装/升级模型仍需完善。
- SEO 设置已独立成后台子模块，并纳入草稿/发布/发布前校验；主题市场升级/回滚还没有完全独立成后台子模块。
- 前台租户识别仍以 `/site/[siteSlug]` 为主，最终生产应切到 host/domain 解析。

当前定位：**SaaS 级产品雏形 + 可展示后台/装修器 demo，不是可直接收真实客户钱的生产版本。**

## 2. `/Users/cxm/saas` 可借鉴模型

参考路径：

- `/Users/cxm/saas/SAAS建站总入口.md`
- `/Users/cxm/saas/app/controller/admin/themes.php`
- `/Users/cxm/saas/app/view/admin/theme_edit.html`
- `/Users/cxm/saas/app/logic/themes.php`
- `/Users/cxm/saas/themes/*/templates/*.liquid`
- `/Users/cxm/saas/themes/*/sections/*.liquid`

应吸收的模型：

- 店铺是后台、前台、主题、商品、订单、客户的边界。
- 主题由 `templates + settings + sections` 组成。
- 页面模板通过 `content_for_page` 控制 section 顺序。
- section schema 决定字段、block、默认 preset。
- `header_plus / footer_plus` 是全局 section。
- 装修器是页面选择 + iframe 预览 + section/block 树 + 字段配置。
- 编辑协议覆盖 `change / dropition / dropitem / delition / delitem / addition / additem`。
- 发布时把 draft theme 复制为 active/published theme，并生成可读缓存。

新系统映射：

| SaaS/XFCart | 新系统 |
| --- | --- |
| 店铺 sid | `site_id` |
| `fc_themes.templates` | `theme_pages.draft_json / published_json` |
| `settings_data.current` | `theme_settings.draft_json / published_json` |
| `content_for_page` | `sectionsOrder` |
| Liquid section schema | `section_definitions.schema_json` / `section-schema.ts` |
| active theme cache | `theme_publications` |
| theme assets | `media_assets` |
| 商品/分类选择器 | products / creative_packs / media_assets resource selector |

明确不照抄：

- 不复用 PHP controller。
- 不复用 jQuery iframe 编辑器。
- 不让站点管理员写 HTML 拼 AI 业务。
- 不让 N8N 承担用户、支付、额度、账本、主题主数据。

## 3. DreamShootAI 当前页面拆解

已检查 `https://dreamshootai.com/` 当前页面形态，核心不是普通 SaaS 首页，而是 AI 摄影订阅转化站。

关键模块：

- 顶部导航：logo、工具入口、照片包入口、定价入口、登录/开始按钮。
- Hero：深色视觉、AI Couple Photo Maker 主标题、邮箱/登录转化表单、社交/购买提示、视觉样片。
- 价格和套餐：Starter / Pro / Premium，页面结构强调 credits、数字照片、数字交付。
- Photo packages：Indian Wedding、Holiday、Engagement、Boudoir、Gala、Christmas 等多主题照片包。
- FAQ：解释 DreamShootAI、AI clone/model、生成照片/视频、退款与 credits。
- SEO/结构化数据：Product、PhotoService、FAQPage、Offer、MerchantReturnPolicy。
- 客户闭环：登录、上传自拍、生成、相册、credits、订阅/一次性包。

我们的主题包必须把这些能力拆成可拖拽 section，而不是写死单个首页。

## 4. 最终后台信息架构

### 4.1 平台后台

入口：`/platform`

一级菜单建议固定为 7 个：

1. 平台总览
   - 全平台收入
   - 活跃站点
   - AI 成本
   - 失败任务
   - 收款异常
   - 最近审计
2. 站点工厂
   - 站点列表
   - 创建站点
   - 复制站点
   - 域名绑定
   - 站点管理员
   - 暂停/恢复
3. 主题市场
   - DreamShootAI Studio
   - SaaS 原主题导入
   - 内置主题包
   - section 定义库
   - 主题导出/复制
4. AI 网关
   - AI app 定义
   - Provider 路由
   - 账号池策略
   - 成本配置
   - 失败率/耗时
5. 收款订阅
   - Stripe Connect accounts
   - Application fee
   - Webhook events
   - Refund/dispute
   - 跨站收入
6. 审计风控
   - 敏感素材查看
   - 管理员操作日志
   - 任务重跑日志
   - 黑名单/限流
7. 系统设置
   - 平台管理员
   - 密钥配置
   - 队列补偿
   - 数据备份

平台后台原则：

- 平台管理员可以跨站看成本和状态，但敏感查看必须写审计。
- 平台后台不直接编辑客户私人素材。
- 平台后台管理主题包、AI provider、费用策略和风控，不替代单站运营后台。

### 4.2 站点后台

入口：`/site/[siteSlug]/admin`

一级菜单固定 8 个：

1. 概览工作台
   - 今日待办
   - 上线状态
   - 收款状态
   - AI 队列
   - 转化漏斗
   - 最近活动
2. 店铺装修
   - 视觉装修器
   - 页面管理
   - 主题管理
   - 导航菜单
   - SEO 设置
   - 媒体库
   - 发布历史
3. 商品套餐
   - Subscription products
   - Credit packs
   - Photo packages
   - Stripe price 绑定
   - 币种/周期
4. 订单订阅
   - 订单列表
   - 订阅列表
   - 支付事件
   - 退款/争议
   - Customer Portal
5. 顾客资产
   - 客户列表
   - 余额账本
   - 私有素材
   - 生成相册
   - 客户状态
   - 模型状态
6. AI 工厂
   - 启用工具
   - 参数 schema
   - 扣费规则
   - Worker 路由
   - 失败重跑
7. 内容运营
   - Help center
   - FAQ
   - Blog
   - Policy pages
   - Campaign landing pages
8. 设置收款
   - 站点资料
   - 域名
   - 管理员
   - Stripe Connect
   - 审计日志

后台布局原则：

- `/admin` 只做总览和入口，不放跨模块编辑器。
- `/admin/design` 是全屏装修工具，不套普通后台大壳。
- 商品、订单、客户、AI、内容、装修、设置不能混在一个长页面里。
- 高级技术信息默认隐藏，保留给平台后台或开发调试。
- 移动/窄屏后台要能先看到业务内容，不被左侧深色菜单占满。

## 5. 装修器最终架构

### 5.1 四区布局

最终布局：

```text
顶部命令栏：
  返回后台 / 当前站点 / 主题库 / 素材库 / 打开前台 / 退出
  当前页面 / 设备切换 / 预览模式 / 还原 / 保存草稿 / 发布全站

左侧工作台：
  页面选择
  页面树
  页面结构 section 树
  section 内 block 树
  全局 header/footer 树
  模块库

中间预览：
  iframe 真实壳预览
  本地草稿预览
  桌面/手机视图
  点击预览 section 后同步选中树节点

右侧属性面板：
  当前 section 字段
  当前 block 字段
  header/footer 字段
  资源选择器
  业务绑定状态
```

当前代码已经实现了双栏/三栏雏形：

- `data-designer-layout="saas-three-pane-builder"`
- 左侧：页面/section/block 树与模块库。
- 中间：实时预览。
- 超宽屏右侧：属性面板。

后续重点不是再堆 UI，而是拆组件和补完整操作。

### 5.2 必须支持的操作

页面：

- 选择全站页面。
- 套用主题包页面模板。
- 新增自定义页面。
- 编辑页面标题、slug、SEO。
- 页面复制和禁用。

Section：

- 从模块库新增 section。
- 删除 section。
- 复制 section。
- 拖拽 section 到任意 before/after 位置。
- 折叠/展开 section。
- section enable/disable。
- section 字段校验。

Block：

- 新增 block。
- 删除 block。
- 复制 block。
- 拖拽 block 排序。
- block enable/disable。
- block 字段校验。

全局：

- 编辑 header。
- 编辑 footer。
- 编辑全局颜色、字体、按钮、圆角。
- 编辑导航菜单。
- 编辑全站 SEO defaults。

发布：

- 保存草稿不影响线上。
- 发布整站 snapshot。
- 发布前校验缺失绑定。
- 发布历史列表。
- 指定版本回滚。

### 5.3 字段控件体系

字段控件必须覆盖：

- `text`
- `textarea`
- `richtext`
- `html`
- `color`
- `image_picker`
- `media_asset`
- `video_url`
- `font_picker`
- `range`
- `checkbox`
- `select`
- `product`
- `price`
- `collection / creative_pack`
- `page`
- `url`
- `menu`
- `ai_app`
- `popover / notice`

资源选择器统一设计：

```text
ResourceSelector
  media assets
  products
  prices
  creative packs
  AI apps
  pages
  menus
  URLs
```

原则：

- 站点管理员不能手写 Stripe 价格。
- pricing section 只能绑定真实 product/price。
- AI 生成表单只能绑定本站已启用 AI app。
- 媒体选择器只读取本站 `media_assets`。
- 客户私有素材不进入装修器媒体库。

## 6. DreamShootAI Studio 主题包

主题包 key：`dreamshoot-ai-studio`

当前状态：主题内容已迁到 `src/lib/theme/packages/dreamshoot-ai-studio/`，`registry.ts` 只作为旧导入兼容层。

目标目录：

```text
src/lib/theme/packages/dreamshoot-ai-studio/
  manifest.ts
  templates.ts
  sections.ts
  settings.ts
  index.ts
```

已完成：

- `manifest.ts`：主题包名称、描述、受众、featured sections、模板清单。
- `templates.ts`：DreamShootAI 多页面模板和默认 sections。
- `index.ts`：主题包导出入口。
- `src/lib/theme/packages/index.ts`：主题包统一 registry。
- `src/lib/theme/registry.ts`：兼容旧设计器导入。

未完成：

- `sections.ts`：把 DreamShootAI 专属 section 定义从通用 schema 中继续抽包。
- `settings.ts`：把主题级默认颜色、字体、header/footer、按钮等 settings 抽包。
- 主题市场安装/升级/复制 UI 仍需接入 package manifest。

### 6.1 必须覆盖页面

- `home` 首页
- `pricing` 定价页
- `packages` 照片包列表页
- `package-detail` 照片包详情页
- `tool-detail` AI 工具详情/生成页
- `login` 登录/注册页
- `app-home` 客户工作台首页
- `job-progress` 任务进度页
- `album` 相册页
- `account-billing` 账户/订阅页
- `help` 帮助中心
- `policy` 隐私、退款、内容政策
- `blog-list` 博客列表
- `blog-detail` 文章详情

### 6.2 必须内置 section

DreamShootAI 视觉转化 section：

- `dreamshoot_header`
- `dreamshoot_hero`
- `auth_capture_panel`
- `brand_logo_strip`
- `sample_photo_mosaic`
- `photo_package_marquee`
- `photo_package_wall`
- `feature_tabs`
- `how_it_works`
- `before_after_gallery`
- `pricing_table`
- `testimonial_wall`
- `faq_accordion`
- `conversion_cta`
- `dreamshoot_footer`

AI 业务 section：

- `ai_tool_grid`
- `ai_tool_entry`
- `upload_panel`
- `generation_form`
- `job_progress`
- `album_gallery`
- `account_subscription`

内容 section：

- `policy_content`
- `help_center`
- `blog_list`
- `blog_article`
- `rich_text`
- `media_banner`

### 6.3 首页默认顺序

默认首页应接近 DreamShootAI 当前结构：

1. `dreamshoot_header`
2. `dreamshoot_hero`
3. `auth_capture_panel`
4. `brand_logo_strip`
5. `sample_photo_mosaic`
6. `photo_package_marquee`
7. `photo_package_wall`
8. `feature_tabs`
9. `how_it_works`
10. `before_after_gallery`
11. `pricing_table`
12. `testimonial_wall`
13. `faq_accordion`
14. `conversion_cta`
15. `dreamshoot_footer`

### 6.4 可装修项

站点管理员必须能通过设计器修改：

- logo。
- header 菜单。
- hero 标题、副标题、视觉图、按钮、登录文案。
- 登录/邮箱捕获面板。
- 照片包显示顺序。
- 每个照片包标题、描述、封面、输出数量、credits。
- How it works 步骤。
- Pricing 展示方式。
- FAQ 问答。
- CTA 文案。
- footer 菜单和政策链接。
- 移动端布局开关。

不能让管理员手写：

- 真实价格。
- credits 发放规则。
- AI app 权限。
- 客户私有素材路径。
- worker callback 地址。

## 7. 数据模型目标

站点与权限：

- `sites`
- `site_domains`
- `site_admins`
- `audit_logs`

客户与身份：

- `customers`
- `customer_auth_identities`
- `customer_sessions`

主题与装修：

- `themes`
- `theme_pages`
- `theme_settings`
- `section_definitions`
- `theme_publications`
- `theme_package_installs`
- `media_assets`
- `navigation_menus`
- `seo_metadata`

商品与支付：

- `products`
- `prices`
- `subscriptions`
- `orders`
- `payment_events`
- `stripe_connect_accounts`

Credits：

- `credit_ledger`
- `credit_balances`

AI：

- `ai_apps`
- `site_ai_apps`
- `generation_jobs`
- `asset_uploads`
- `albums`
- `customer_models`
- `ai_gateway_groups`

强规则：

- 所有客户、订单、任务、素材、账本、主题数据必须带 `site_id`。
- 客户唯一键是 `(site_id, email)`。
- 账本 append-only，不允许直接改余额。
- 创建 AI 任务先 `reserve`。
- 成功 `consume`。
- 失败/超时 `release`。
- webhook 必须先写幂等事件，再发权益。

## 8. 工程拆分方案

### 8.1 后台

当前已有：

- `src/lib/admin-menu.ts`
- `src/components/ui.tsx`
- `src/app/site/[siteSlug]/admin/_lib/site-admin-context.tsx`

下一步：

```text
src/components/admin/admin-shell.tsx
src/components/admin/admin-command-bar.tsx
src/components/admin/admin-module-rail.tsx
src/components/admin/admin-workspace-header.tsx
src/lib/admin-menu.ts
```

目标：

- `ui.tsx` 不再承载复杂后台壳逻辑。
- 平台后台和站点后台菜单都从 `admin-menu.ts` 来。
- 所有模块页通过统一 context 拿站点数据。

### 8.2 装修器

当前主文件：

- `src/components/designer/designer-client.tsx`

已拆出：

- `src/components/designer/page-tree.tsx`
- `src/components/designer/section-tree.tsx`
- `src/components/designer/global-tree.tsx`
- `src/components/designer/module-library.tsx`
- `src/components/designer/preview-frame.tsx`
- `src/components/designer/property-inspector.tsx`

必须拆分：

```text
src/components/designer/designer-client.tsx
src/components/designer/designer-state.ts
src/components/designer/designer-actions.ts
src/components/designer/page-tree.tsx
src/components/designer/section-tree.tsx
src/components/designer/global-tree.tsx
src/components/designer/module-library.tsx
src/components/designer/property-inspector.tsx
src/components/designer/field-editor-registry.tsx
src/components/designer/resource-selector.tsx
src/components/designer/preview-frame.tsx
src/components/designer/publish-history-panel.tsx
```

目标：

- 拖拽逻辑、字段编辑、资源选择、发布状态分开。
- 设计器主组件只负责组合布局和传状态。
- 后续新增字段控件不需要改大文件。

当前拆分策略：

- 已抽 `PageTree`，隔离当前页面下拉和页面树卡片，保持页面切换和草稿/发布状态提示。
- 已抽 `SectionTree`，隔离页面 section 树、子块树、上下移动、复制、删除、拖拽落点提示和模块库拖入页面结构。
- 已抽 `GlobalTree`，隔离页眉/页脚树、全局主题设置、颜色字体和导航编辑。
- 已抽 `ModuleLibrary`，隔离 DreamShootAI 推荐模块、AI 订阅业务积木和原 SaaS 积木分组，以及拖拽/追加入口。
- 已先抽 `PreviewFrame`，隔离设备切换、预览模式、iframe 真实壳预览、本地草稿预览、保存草稿、发布、还原命令栏。
- 已先抽 `PropertyInspector` 外壳，隔离右侧属性面板容器和业务绑定状态，字段编辑内容暂留主文件。
- 已抽 `FieldEditorRegistry`，隔离 SaaS 字段控件、字段值解析、字体选择器、开关、滑块、富文本、HTML、菜单、媒体/商品/页面绑定入口。
- 已抽 `ResourceSelector`，隔离站点内媒体、商品、创意包、页面、自定义链接选择器和 selector JSON 合同。
- 已补 `/admin/design/pages`、`/admin/design/navigation`、`/admin/design/publications`，形成普通后台里的页面树、导航设置、发布快照入口。
- 已补 `PublishPreflightPanel` 和 `runThemePublishPreflight`，发布前检查页面、菜单、价格、收款、AI、素材、政策页和 SEO。
- 已补指定历史 publication 恢复到草稿的 API 和后台操作，不直接覆盖线上版本。
- 已补 `/admin/design/seo` 独立 SEO 设置后台，SEO 保存到 `theme_settings.draft_json`，发布后进入 snapshot 和前台 metadata。
- `Themes` 页已收回统一 `AdminShell` 和站点模块上下文，不再自带一套独立后台导航。
- 下一步继续拆 `PublishHistoryPanel`，并补主题市场升级/回滚体验。

### 8.3 主题包

当前：

- `src/lib/theme/registry.ts` 仅保留兼容导出。
- `src/lib/theme/packages/dreamshoot-ai-studio/manifest.ts`
- `src/lib/theme/packages/dreamshoot-ai-studio/templates.ts`
- `src/lib/theme/packages/index.ts`

目标：

```text
src/lib/theme/packages/dreamshoot-ai-studio/
  manifest.ts
  templates.ts
  sections.ts
  settings.ts
  index.ts
src/lib/theme/packages/index.ts
```

目标：

- DreamShootAI 主题包独立。
- 后续可以新增其他主题包。
- 平台主题市场读取统一 package manifest。
- 主题包升级不直接污染站点已发布 snapshot。

### 8.4 Repository 边界

第一阶段可以继续 JSON store，但新逻辑要按 repository 边界写：

```text
src/lib/repositories/site-repository.ts
src/lib/repositories/theme-repository.ts
src/lib/repositories/billing-repository.ts
src/lib/repositories/credit-repository.ts
src/lib/repositories/ai-repository.ts
```

目标：

- JSON store 只是实现细节。
- 迁 Postgres 时不重写页面和业务组件。

## 9. 实施阶段

### 阶段 1：后台菜单和装修器工作台

目标：

- 固定站点后台 8 个一级模块。
- 平台后台和站点后台菜单分离。
- `/admin` 清理成总览，不放跨模块编辑器。
- `/admin/design` 是 SaaS 风格全屏装修器。
- 设计器在常见宽度能看到 section 树和实时预览。

当前进度：

- `admin-menu.ts` 已有。
- `AdminShell` 已从 `ui.tsx` 拆出，后台壳、模块栏、命令栏已有专用组件边界。
- 后台窄屏横向模块切换已做。
- 装修器双栏/三栏布局已做。
- 装修器已拆出 `PageTree`、`SectionTree`、`GlobalTree`、`ModuleLibrary`、`FieldEditorRegistry`、`ResourceSelector`、`PreviewFrame` 和 `PropertyInspector`，降低主组件直接承载的布局复杂度。
- Design 模块已补 `页面管理 / 导航菜单 / 发布历史` 三个普通后台子页，左侧模块菜单能直达这些入口。
- Design 模块已补 `SEO 设置` 普通后台子页，左侧模块菜单可直达。
- `Themes` 已回到统一站点后台壳，和 `Design / Pages / SEO / Publications` 共享同一工作区语言。
- 发布历史页已接入发布前校验，页面管理里的发布按钮也服从同一份校验结果。
- 发布历史页已支持任意 publication 恢复到草稿，管理员可预览后再重新发布。
- SEO 设置已纳入发布前校验，前台主要站点页面已接入 published SEO metadata。
- DreamShootAI 主题包 registry 已拆出到 package 目录，模板覆盖扩展到 14 个页面。
- `npm run typecheck` 已在 `SectionTree`、`GlobalTree`、`ModuleLibrary`、`FieldEditorRegistry`、`ResourceSelector` 和 Design 子页补齐后通过。
- `npm run smoke:core` 已覆盖基础链路。

剩余：

- 主题市场安装/升级体验、发布历史面板继续组件化。

验收：

- 后台截图能一眼看懂店铺运营路径。
- 装修器截图能一眼看出页面树、section 树、模块库、预览。
- 左侧模块跳转不丢 `siteSlug`。

### 阶段 2：DreamShootAI 主题包独立化

目标：

- 建立 `src/lib/theme/packages/dreamshoot-ai-studio/`。
- 从 `registry.ts` 迁出 manifest/templates，并继续拆出 sections/settings。
- 覆盖首页、定价页、照片包、工具页、登录页、工作台页、任务进度页、相册页、账户订阅页、政策页、帮助页、博客列表页、文章详情页。
- 主题管理页能安装或套用 DreamShootAI 主题。

当前进度：

- package 目录、manifest、templates、统一 registry 已完成。
- `registry.ts` 已改为兼容 facade。
- 设计器套用 DreamShootAI 页面模板的旧导入不需要改动。
- `npm run typecheck` 通过。
- `npm run smoke:core` 通过。

验收：

- 新站安装主题后，不写代码即可出现 DreamShootAI 风格前台。
- 设计器可以拖拽 DreamShootAI section 调整顺序。
- 发布后前台读取 published snapshot。

### 阶段 3：设计器组件化和字段控件

目标：

- 拆分 `designer-client.tsx`。
- 建立 `FieldEditorRegistry`。
- 建立统一 `ResourceSelector`。
- 支持 section disable、block duplicate、block before/after drop。

当前进度：

- `page-tree.tsx` 已完成。
- `section-tree.tsx` 已完成。
- `global-tree.tsx` 已完成。
- `module-library.tsx` 已完成。
- `field-editor-registry.tsx` 已完成。
- `resource-selector.tsx` 已完成。
- `preview-frame.tsx` 已完成。
- `property-inspector.tsx` 已完成外壳拆分。
- `/admin/design/pages` 已完成页面树与页面级操作入口。
- `/admin/design/navigation` 已完成 header/footer 导航草稿编辑。
- `/admin/design/publications` 已完成整站发布、恢复草稿和 publication 列表。
- `/admin/design/seo` 已完成全局和逐页 SEO 草稿编辑。
- `publish-preflight-panel.tsx` 已完成发布前校验展示。
- `publish-preflight.ts` 已完成发布前校验模型，包含 SEO 全局信息、页面 title/description 和 canonical 格式。
- 指定历史 publication 恢复到草稿已完成，API 路由为 `/api/sites/[siteId]/theme/publications/[publicationId]/restore-draft`。
- 前台 `generateMetadata` 已读取 published SEO，覆盖首页、定价页、工具页、内容页、客户登录、工作台和任务进度页。
- `npm run typecheck` 通过。
- `npm run smoke:core` 通过。

剩余：

- `publish-history-panel.tsx`

验收：

- 常规装修不需要写 JSON。
- 技术字段默认不暴露给站点管理员。
- 拖拽模块到任意位置稳定。
- 资源选择器不会跨站读取数据。

### 阶段 4：发布、回滚、菜单、SEO

目标：

- `publishThemeDraft(siteId, actor)` 取代页面级命名。
- `theme_publications` 存整站快照。
- 发布历史页支持指定版本回滚。
- 导航菜单、SEO 设置、政策页、FAQ、博客列表进入后台管理。

验收：

- 草稿保存不影响线上。
- 发布后前台更新。
- 回滚后前台恢复旧版本。
- SEO/menu 不需要手改 JSON。

### 阶段 5：生产化底座

目标：

- JSON store 迁 Postgres + Prisma。
- Stripe Connect 真实 onboarding、checkout、webhook 签名验证。
- S3 兼容对象存储和 signed URL。
- Worker HMAC 验证、超时补偿、重放幂等。
- RBAC、审计、速率限制、部署密钥。

验收：

- 可以承载真实客户注册、付费、生成、下载、退款和审计。
- 失败任务、重复 webhook、重复 worker callback 不会重复扣费或重复发放。

## 10. 当前差距表

| 模块 | 当前状态 | 目标状态 | 优先级 |
| --- | --- | --- | --- |
| 后台菜单 | 已抽 `admin-menu.ts`，页面仍需细分 | 8 个站点模块 + 7 个平台模块稳定 | P0 |
| AdminShell | 已拆到 `src/components/admin/` | 继续沉淀统一后台壳和模块上下文 | Done/P1 |
| 装修器布局 | 双栏/三栏雏形完成，已拆 `PageTree`、`SectionTree`、`GlobalTree`、`ModuleLibrary`、`FieldEditorRegistry`、`ResourceSelector`、`PreviewFrame` 和 `PropertyInspector`，并补 Design 子页 | 继续拆发布历史面板 + SEO 设置 | P1 |
| DreamShootAI 主题 | 已拆到 package 目录，14 个页面模板 | 继续抽 sections/settings，接主题市场安装/升级 | Done/P1 |
| 模块库 | 已有 SaaS + AI section | 分组、搜索、收藏、业务绑定校验 | P1 |
| 字段控件 | 已拆 `FieldEditorRegistry` + `ResourceSelector`，覆盖较多 SaaS 字段类型 | 后续补字段级校验、必填提示、跨站资源防串验收 | Done/P1 |
| 发布历史 | 已有 publication 列表、发布当前草稿、恢复草稿到最新线上、发布前校验、指定历史版本恢复到草稿 | 发布面板组件化 + 恢复前 diff/确认 | P1 |
| 页面/菜单/SEO | 页面管理、导航后台和 SEO 后台已独立；SEO 进入发布校验和前台 metadata | policy/blog 内容管理增强 + 结构化数据 | Done/P1 |
| 存储 | JSON store | Postgres + Prisma repository | P2 |
| Stripe | dev-shaped | Connect scope + signature + refund/dispute | P2 |
| Worker | 回调闭环雏形 | HMAC、超时补偿、幂等审计完整 | P2 |

## 11. 近期代码动作清单

优先顺序：

1. 拆出 `PublishHistoryPanel`，把 publication 列表、发布操作和恢复草稿入口从页面 JSX 中继续独立。
2. 给 DreamShootAI 主题继续补 `sections.ts / settings.ts`，让主题包更接近可安装商品。
3. 给历史 publication 恢复补 diff/确认信息，避免误恢复。
4. 给 SEO 继续补 FAQ/Product/Offer 结构化数据。
5. 用浏览器截图验收 `/platform`、`/site/lumen/admin`、`/site/lumen/admin/design`、`/site/lumen`。

## 12. 验收清单

后台：

- 平台后台和站点后台菜单不同。
- 站点后台一级模块固定 8 个。
- `/admin` 不出现跨模块编辑器。
- `/admin/design` 是全屏装修器。
- A 站管理员不能访问 B 站后台数据。

装修器：

- 可选择全站页面。
- 可新增、复制、删除、拖拽 section。
- 可新增、复制、删除、拖拽 block。
- 可编辑 header/footer。
- 可编辑全站和逐页 SEO。
- 可编辑 section/block 字段。
- 可保存草稿。
- 可发布整站。
- 可回滚。
- 前台只读 published snapshot。

DreamShootAI：

- 首页能装修出深色 hero、登录转化、照片包、How it works、Pricing、FAQ。
- 定价页价格来自真实产品价格。
- 工具详情页可放 upload/generation/job/album 模块。
- 登录页可由主题模板控制基础布局。
- 政策页、帮助页、博客列表页可装修。

支付与 credits：

- Stripe webhook 重放不会重复发 credits。
- checkout 成功跳回但 webhook 未到时不提前发 credits。
- past_due 客户不能创建新任务。
- 任务失败/超时 release credits。

AI worker：

- N8N 不接 Stripe webhook。
- N8N 不改 credits。
- Worker accepted 不等于成功。
- 重复回调不重复结算。
- 超时任务进入补偿队列。

安全：

- 客户不能猜 URL 访问其他客户素材。
- 站点媒体和客户私有素材分离。
- 管理员敏感查看写审计日志。
- 平台跨站查看也写审计日志。

## 13. 本轮结论

目前最该做的不是继续零散加页面，而是按顺序完成：

1. 固化后台菜单和模块边界。
2. 拆装修器大组件。
3. 补页面/导航/发布历史。
4. 把 DreamShootAI 主题包继续做成可安装、可升级、可复制的后台商品。
5. 最后再做生产化底座。

这样才能从“看起来有很多功能的 demo”走向“客户能看懂、能装修、能展示、后续能上线”的 SaaS 平台。
