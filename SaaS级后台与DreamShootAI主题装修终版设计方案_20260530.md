# SaaS级后台与 DreamShootAI 主题装修终版设计方案

日期：2026-05-30

## 0. 目标边界

当前目标不是继续做一个“能点开的 demo”，而是把 `/Users/cxm/Documents/订阅整体` 改造成一套可对客户展示、后续可生产化的多站 AI 订阅 SaaS。

最终形态：

- 后台信息架构对标 `/Users/cxm/saas` 的店铺后台，但重新设计得更清晰、更现代。
- 每个站点有独立后台、独立客户、独立订阅、独立装修、独立主题发布。
- 装修器不是品牌配置器，而是可拖拽的主题区块设计器。
- 通过主题 + section + block 拖拽，可以装修出接近 `https://dreamshootai.com/` 的 AI 摄影订阅站。
- N8N 只做 AI worker，不承担用户、支付、credits、主题主数据。

## 1. 当前源码判断

当前系统已有基础，但还不是 SaaS 量级。

已经具备：

- 多站点 seed 数据。
- 平台后台、站点后台、客户前台入口。
- 站点管理员登录。
- 产品、订阅、credits、订单、AI jobs、客户相册、媒体库等演示数据。
- 主题页面 JSON、draft/published、发布/回滚雏形。
- 设计器页面树、section/block、字段配置、预览雏形。
- 部分 DreamShoot 风格前台 section。

主要差距：

- 运行时仍以 `data/platform-state.json` 为主，不是真正数据库驱动。
- 后台虽然有模块入口，但菜单、页面职责和工作流还没有完全产品化。
- 装修器已有拖拽雏形，但还不是完整“主题包 + 页面 + 全局设置 + section schema + 发布快照”的系统。
- DreamShootAI 风格还未沉淀成可安装、可复制、可装修的完整主题包。
- 发布仍偏页面级，最终应是整站 publication snapshot。
- 缺少主题市场、页面管理、菜单管理、SEO、博客/政策内容的完整闭环。

## 2. SaaS 参考系统要吸收什么

参考 `/Users/cxm/saas`，吸收产品模型，不照搬 PHP/jQuery。

核心模型：

- 店铺是后台、前台、主题、商品、订单、客户的边界。
- 后台按商品、交易、顾客、营销、数据、装修、收款、设置组织。
- 主题由 `templates + settings + sections` 构成。
- 页面 section 顺序由 `content_for_page` 控制。
- section schema 决定字段、block、默认 preset。
- header/footer 是全站 global section。
- 装修器是 iframe 预览 + 页面/section/block 树 + 字段属性面板。
- 编辑动作包括新增、删除、排序、字段变更、发布、回滚。

新系统的映射：

- `fc_themes.templates` -> `theme_pages.draft_json / published_json`
- `settings_data.current` -> `theme_settings.draft_json / published_json`
- Liquid section schema -> `section_definitions.schema_json`
- 发布缓存 -> `theme_publications` 整站快照
- 店铺 sid -> `site_id`

## 3. DreamShootAI 目标拆解

DreamShootAI 不是普通 SaaS 首页，它是一个 AI 摄影订阅转化站。

需要装修器能拼出的前台结构：

- 顶部导航：logo、Tools、Photo Packages、Blog、Pricing、登录入口。
- 深色沉浸式 hero：照片墙、标题、高亮词、卖点、社会证明。
- 登录转化面板：Google 登录、email 输入、CTA、活动 ribbon、terms/privacy。
- AI photo packages：横向 marquee + 包卡片墙。
- 活动 banner：Christmas、Valentine、Wedding、Engagement 等。
- How it works：上传自拍、生成、下载相册。
- AI tool/generation：上传、参数表单、任务进度、相册。
- Pricing：monthly/yearly 切换，价格来自真实 products/prices。
- Testimonials。
- FAQ。
- Policy/Help/Blog。

所以目标主题不是单个首页，而是 `dreamshoot-ai-studio` 主题包。

## 4. 最终后台菜单架构

### 4.1 平台总后台

一级菜单：

1. 平台总览
   - 总收入
   - 活跃站点
   - AI 成本
   - 支付异常
   - 失败任务
2. 站点管理
   - 站点列表
   - 创建站点
   - 复制站点
   - 域名绑定
   - 暂停/恢复
3. 主题市场
   - 内置主题
   - DreamShootAI 主题
   - SaaS 原主题导入
   - section 定义库
   - 主题导出/复制
4. AI Provider
   - AI app 定义
   - provider 路由
   - 成本配置
   - 账号池
   - 失败率/耗时
5. 收款与结算
   - Stripe Connect accounts
   - application fee
   - webhook events
   - dispute/refund
6. 风控与审计
   - 敏感素材查看日志
   - 管理员操作日志
   - 任务重跑日志
   - 限流/黑名单
7. 系统设置
   - 平台管理员
   - 密钥配置
   - 队列补偿
   - 数据备份

### 4.2 站点后台

一级菜单控制在 8 个：

1. 店铺总览
   - 今日待办
   - 发布状态
   - 收款状态
   - AI 队列
   - 转化漏斗
   - 最近活动
2. 前台装修
   - 视觉装修器
   - 页面管理
   - 主题管理
   - 导航菜单
   - SEO 设置
   - 媒体库
   - 发布历史
3. 商品与套餐
   - Subscription products
   - Credit packs
   - Photo packages
   - Stripe price 绑定
   - 币种/周期
4. 订单与订阅
   - 订单列表
   - 订阅列表
   - 支付事件
   - 退款/争议
   - Customer Portal
5. 顾客管理
   - 客户列表
   - 余额账本
   - 私有素材
   - 生成相册
   - 客户状态
6. AI 工具
   - 启用工具
   - 参数 schema
   - 扣费规则
   - Worker 路由
   - 失败重跑
7. 内容运营
   - FAQ
   - Help center
   - Blog
   - Policy pages
   - Campaign landing pages
8. 设置
   - 站点资料
   - 域名
   - 管理员
   - Stripe Connect
   - 审计日志

### 4.3 后台布局原则

- `/admin` 只做店铺总览，不放所有编辑器。
- 每个一级模块必须有独立页面。
- 左侧是模块导航，顶部是当前工作区状态，右侧可放上线检查/活动流。
- 商品、订单、客户、AI、装修、设置不混在一个长页面里。
- 所有文案面向站点管理员，不暴露 JSON、API、contract 等技术词。
- 高级信息保留给平台后台或隐藏调试区。

## 5. 主题与装修器总架构

### 5.1 主题包结构

```text
theme_package
  manifest.json
  templates/
    index.json
    pricing.json
    packages.json
    package-detail.json
    tool-detail.json
    login.json
    app-home.json
    job-progress.json
    album.json
    account-billing.json
    help.json
    policy.json
    blog-list.json
    blog-detail.json
  sections/
    dreamshoot_hero.json
    auth_capture_panel.json
    photo_package_marquee.json
    photo_package_wall.json
    pricing_table.json
    generation_form.json
  assets/
    preview.webp
    sample-*.webp
  settings_schema.json
  settings_data.json
```

每个主题包必须能安装到任意站点，复制主题只复制主题配置，不复制客户、订单、订阅、任务、相册。

### 5.2 页面 JSON 标准

```json
{
  "schemaVersion": 2,
  "pageType": "home",
  "templateKey": "index",
  "slug": "/",
  "seo": {
    "title": "AI Couple Photo Maker",
    "description": "Create professional couple photos from selfies."
  },
  "sectionsOrder": ["hero_1", "trust_1", "packages_1"],
  "sections": {
    "hero_1": {
      "id": "hero_1",
      "type": "dreamshoot_hero",
      "disabled": false,
      "settings": {},
      "blocks": []
    }
  }
}
```

### 5.3 Section schema 标准

每个 section 定义：

- `type`
- `label`
- `category`
- `description`
- `settings`
- `blocks`
- `presets`
- `maxBlocks`
- `runtimeBindings`
- `previewMock`
- `dataSafety`

AI 业务 section 必须显式声明绑定：

- `products`
- `prices`
- `site_ai_apps`
- `creative_packs`
- `media_assets`
- `customer_assets`
- `generation_jobs`
- `albums`

### 5.4 装修器四区布局

1. 顶部工具栏
   - 返回后台
   - 页面切换
   - 桌面/手机
   - 预览线上
   - 保存草稿
   - 发布全站
   - 回滚版本
2. 左侧结构树
   - 页面树
   - section 树
   - block 树
   - header/footer 全局树
   - 拖拽排序
   - 复制/删除/隐藏
3. 中间预览
   - iframe 真实前台预览
   - 选中 section 高亮
   - 点击预览 section 反选左侧树
   - 手机/桌面切换
4. 右侧属性面板
   - 页面 SEO
   - section settings
   - block settings
   - global settings
   - 资源选择器
   - 真实产品/价格/AI 工具绑定

### 5.5 拖拽规则

必须支持：

- 页面 section 上下拖拽排序。
- 从模块库拖入页面任意位置。
- section 内 block 拖拽排序。
- header/footer 内 block 拖拽排序。
- section 复制、删除、禁用。
- block 新增、删除、复制。
- 草稿内实时预览，线上不受影响。

不做：

- 自由画布。
- 像素级绝对定位。
- 站点管理员自定义 JS。

## 6. DreamShootAI 主题模块

### 6.1 必需页面

- 首页 `/`
- Pricing `/pricing`
- Photo packages `/packages`
- Package detail `/packages/[slug]`
- AI tool detail `/tools/[slug]`
- Login `/login`
- Customer app `/app`
- Job progress `/app/jobs/[id]`
- Album `/app/albums/[id]`
- Account billing `/app/billing`
- Help/FAQ `/help`
- Privacy `/policies/privacy`
- Refund `/policies/refunds`
- Content policy `/policies/content`
- Blog list `/blog`
- Blog detail `/blog/[slug]`

### 6.2 必需 sections

1. `dreamshoot_hero`
   - 深色 hero。
   - 背景照片墙。
   - headline / highlight / subheadline。
   - 卖点 blocks。
   - 评分和购买提示。
   - 可挂载 `auth_capture_panel`。
2. `auth_capture_panel`
   - Google login。
   - Email input。
   - CTA。
   - ribbon。
   - terms/privacy links。
3. `tool_dropdown_nav`
   - Tools、Photo Packages、Blog、Pricing。
   - 绑定 `navigation_menus`。
4. `photo_package_marquee`
   - 横向包展示。
   - 绑定 `creative_packs`。
5. `photo_package_wall`
   - 卡片墙。
   - 图片、标题、说明、标签、credits、输出数量。
   - 绑定真实 package。
6. `campaign_banner`
   - 节日/婚礼/情侣活动带。
   - CTA 绑定 package/tool。
7. `trust_signal_bar`
   - trusted by creators、数字、logo。
8. `how_it_works_video`
   - 视频或动图 walkthrough。
9. `upload_steps`
   - 上传自拍、选择主题、生成、下载。
10. `pricing_table`
    - 只绑定 products/prices。
    - monthly/yearly 切换。
    - 不允许手写价格。
11. `testimonial_wall`
    - 评价墙。
12. `faq_accordion`
    - FAQ 分组。
13. `generation_form`
    - 绑定启用的 `site_ai_apps`。
    - 根据参数 schema 渲染表单。
14. `upload_panel`
    - 当前客户私有素材上传。
15. `job_progress`
    - 当前客户任务状态。
16. `album_gallery`
    - 当前客户相册。
17. `policy_content`
    - 政策页富文本。
18. `blog_list`
    - 博客列表。
19. `blog_article`
    - 博客详情。

### 6.3 首页默认顺序

```text
header
dreamshoot_hero
trust_signal_bar
campaign_banner
how_it_works_video
upload_steps
photo_package_marquee
photo_package_wall
testimonial_wall
pricing_table
faq_accordion
footer
```

### 6.4 站点管理员可装修项

- Logo、导航、CTA。
- hero 标题、高亮词、副标题。
- 背景照片墙素材。
- 登录面板 ribbon、按钮文案、terms/privacy。
- 卖点 blocks 增删排序。
- photo package 卡片增删排序。
- package 绑定真实 creative pack。
- pricing 绑定真实 subscription products。
- FAQ 增删排序。
- 政策页内容。
- 博客列表模块。
- 移动端预览。

## 7. 数据模型改造

### 7.1 核心表

必须从 demo JSON 迁移到数据库驱动：

- `sites`
- `site_domains`
- `site_admins`
- `customers`
- `customer_auth_identities`
- `products`
- `prices`
- `stripe_connect_accounts`
- `subscriptions`
- `orders`
- `payment_events`
- `credit_ledger`
- `credit_balances`
- `ai_apps`
- `site_ai_apps`
- `generation_jobs`
- `asset_uploads`
- `media_assets`
- `customer_models`
- `albums`
- `audit_logs`

### 7.2 主题相关表

- `themes`
- `theme_pages`
- `theme_settings`
- `section_definitions`
- `theme_publications`
- `navigation_menus`
- `theme_assets`

`theme_publications` 保存整站不可变快照：

```json
{
  "publicationId": "pub_123",
  "siteId": "site_lumen",
  "themeId": "theme_123",
  "version": 12,
  "settings": {},
  "pages": {},
  "menus": {},
  "assetsManifest": {},
  "publishedAt": "2026-05-30T00:00:00.000Z"
}
```

### 7.3 强约束

- 前台只读 active publication。
- 草稿只写 draft。
- 发布前校验：价格绑定、AI app 绑定、媒体存在、菜单链接、政策页。
- 回滚只能选择历史 publication。
- 所有业务数据必须带 `site_id`。

## 8. API 与服务分层

建议服务层：

- `SiteResolver`
  - host/path -> site
  - admin/customer session -> site scoped identity
- `ThemeService`
  - install theme
  - duplicate theme
  - save draft
  - publish site
  - rollback publication
- `ThemeRuntimeResolver`
  - draft preview data
  - published live data
  - customer scoped data
- `BillingService`
  - Connect onboarding
  - Checkout
  - webhook idempotency
  - subscription entitlement
- `CreditLedgerService`
  - reserve
  - consume
  - release
  - adjustment
- `AiJobService`
  - create job
  - worker dispatch
  - callback verification
  - timeout compensation
  - rerun
- `MediaService`
  - theme media
  - customer private assets
  - signed URL
  - delete/audit

## 9. 实施阶段

### 阶段 1：后台信息架构重构

目标：

- `/admin` 变成真正店铺总览。
- 商品、订单、客户、AI、内容、装修、设置全部独立模块页。
- 平台后台和站点后台菜单分离。

验收：

- 站点后台不再像功能堆叠页。
- 站点管理员能清楚知道：先配置收款/商品/装修/AI，再发布前台。
- 所有模块入口都可用。

### 阶段 2：主题包与 schema registry

目标：

- 把 `section-schema.ts` 拆成主题 section registry。
- 支持内置主题包。
- `dreamshoot-ai-studio` 作为首个完整主题包。

验收：

- 新站可安装 DreamShootAI 主题。
- 主题包包含页面、section、settings、默认素材。
- section schema 可从 registry 加载。

### 阶段 3：设计器 MVP 升级

目标：

- 页面树、section 树、block 树、global header/footer 树。
- 从模块库拖入页面任意位置。
- 拖拽排序 section/block。
- 字段控件覆盖 SaaS 常见类型。

验收：

- 不写代码能修改 DreamShootAI 首页结构。
- 保存草稿刷新后仍存在。
- 线上前台不受草稿影响。

### 阶段 4：真实预览与发布快照

目标：

- iframe preview route 使用 draft runtime。
- live route 使用 active publication。
- publish 生成整站 snapshot。
- rollback 支持指定版本。

验收：

- 草稿、预览、线上三者边界清楚。
- 发布后前台变化。
- 回滚后恢复旧版本。

### 阶段 5：业务 section 绑定

目标：

- `pricing_table` 绑定真实 products/prices。
- `generation_form` 绑定启用 AI app。
- `photo_package_wall` 绑定 creative packs。
- `upload_panel`、`job_progress`、`album_gallery` 只读当前客户数据。

验收：

- 前台价格不可能和后台套餐不一致。
- A 站不能读取 B 站工具/素材/相册。
- 未启用 AI app 不能在前台生成。

### 阶段 6：内容与上线能力

目标：

- SEO metadata。
- 导航菜单。
- FAQ、help、policy、blog。
- 主题导出/复制。
- 媒体库完整管理。

验收：

- DreamShootAI 类型站点能完整展示给客户。
- 每个站点可以复制主题快速建站。
- 不共享客户数据。

### 阶段 7：生产化

目标：

- Postgres + Prisma 接管运行时。
- Stripe Connect 真 webhook 幂等。
- S3 对象存储。
- worker HMAC 和超时补偿。
- 审计日志。
- 测试覆盖。

验收：

- webhook 重放不重复发 credits。
- worker 重复回调不重复结算。
- 失败任务返还 credits。
- 敏感素材查看写审计。
- 多站隔离测试通过。

## 10. 验收清单

后台：

- 平台后台和站点后台菜单分离。
- 站点后台 `/admin` 只做总览和待办。
- 商品、订单、客户、AI、装修、内容、设置均有独立模块。
- A 站管理员不能访问 B 站后台数据。

设计器：

- 页面可切换。
- section 可新增、删除、复制、拖拽排序。
- block 可新增、删除、拖拽排序。
- 模块库可拖入页面指定位置。
- header/footer 可作为全局 section 编辑。
- 草稿保存不影响线上。
- 发布生成整站 snapshot。
- 可按版本回滚。

DreamShootAI 主题：

- 能装修出深色 hero + 登录转化面板。
- 能展示 photo package marquee/wall。
- 能配置 How it works、campaign、testimonials、FAQ。
- Pricing 读取真实套餐。
- Generation form 读取启用 AI app。
- Album gallery 只读当前客户相册。

支付/credits：

- Connect 未完成不能发布付费套餐。
- Checkout 返回不提前发 credits。
- webhook 幂等入账。
- reserve/consume/release 全部进 ledger。

AI worker：

- N8N 不处理支付和账本。
- worker accepted 不等于成功。
- 重复回调不重复结算。
- 超时任务自动释放 credits 或进入补偿队列。

## 11. 推荐实施顺序

最合理顺序：

1. 先稳定后台信息架构，把 `/admin` 清干净。
2. 做 `dreamshoot-ai-studio` 主题包定义，不再把 DreamShoot 风格写死在零散组件里。
3. 把设计器补成页面树 + section 树 + block 树 + 模块库拖入 + 属性面板。
4. 做整站 publish snapshot 和 rollback。
5. 补业务绑定控件：product/price/AI app/media/creative pack。
6. 做 DreamShootAI 默认站点装修模板。
7. 最后迁移存储、支付、worker、审计和测试到生产级。

短期不要做：

- 自由画布。
- 自定义 JS。
- 复杂动画编辑器。
- 多主题市场收费。

这些会拖慢核心闭环。当前最重要的是：菜单清晰、装修器可拖拽、主题能拼出 DreamShootAI、草稿发布边界正确。

