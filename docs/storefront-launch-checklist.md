# 店铺上线检查清单

适用店铺：

- AIdreamcapes
- MyDreamShoots

## 1. TDK 检查

上线前需要确认两个店铺的 `title`、`description`、`keywords` 已维护成功，并且线上页面源代码中展示的内容与下方一致。

### AIdreamcapes

- [ ] `title` 正确：
  `AIdreamcapes – the most advanced AI photo generator  maker`
- [ ] `description` 正确：
  `Transform your favorite moments into professional-grade photos and stunning memories with AIdreamcapes. Choose any setting, outfit, or vibe – all from home.`
- [ ] `keywords` 正确：
  `Dream Photos,Dream Photoshoot,Wedding Photoshoot,Wedding Photos,AI Photos,AI Photoshoot,Couple Photos`

### MyDreamShoots

- [ ] `title` 正确：
  `Professional AI Photo Generator Online - MyDreamShoots`
- [ ] `description` 正确：
  `Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator  maker. No studio, no outfits, just magic.`
- [ ] `keywords` 正确：
  `Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot`

检查方式：

1. 打开店铺首页。
2. 查看页面源代码。
3. 搜索 `<title>`、`name="description"`、`name="keywords"`。
4. 对照本清单逐项确认。

## 2. Title 位置检查

上线前需要确认 `<title>` 位于 `<head>` 内，并且位置靠前。

- [ ] 页面源代码中存在 `<head>`。
- [ ] `<title>` 出现在 `<head>` 之后。
- [ ] `<title>` 位于主要资源加载标签之前，例如大量 `preload`、`script`、`stylesheet` 之前。
- [ ] `description`、`keywords`、canonical、OG/Twitter 等 SEO 标签也在 `<head>` 内。

建议检查方式：

1. 打开页面源代码。
2. 从顶部开始查看 `<head>`。
3. 确认 `<title>` 紧跟在基础 head 元素后方，不能被渲染到 `<body>` 中。

## 3. H2 / H3 内容结构检查

上线前需要确认首页、Header 菜单弹层、套餐目录、工具目录等 SEO 重点模块使用清晰的 heading 层级，让 Google 爬虫能理解页面模块划分和内容权重。

- [ ] 页面主内容只有合理数量的核心 H1，不能把普通导航按钮误做 H1。
- [ ] 桌面端一级目录 `Browse packages` 与手机端同一入口名称保持一致，不能桌面叫 `Browse packages`、手机端叫 `AI Shoot Packages`。
- [ ] Header 的 Browse packages / Tools 弹层中，弹层总标题使用 `h2`。
- [ ] Browse packages 目录下的套餐分类、套餐入口标题使用 `h2` 包裹可见文字。
- [ ] Tools 目录下的工具分类、工具入口标题使用 `h3` 包裹可见文字。
- [ ] 不能只用裸 `<a>`、`<span>` 或 `<div>` 承载 SEO 重点入口文字；例如套餐入口应使用 `<a href="..."><h2>Professional Headshots</h2></a>`，工具入口应使用 `<a href="..."><h3>Professional headshot maker</h3></a>` 这一类结构。
- [ ] 保留原来的链接 `href`、点击区域、视觉样式和移动端布局，heading 标签只用于表达内容层级。

建议检查重点：

- Header Browse packages 弹层
- Header Tools 弹层
- 首页套餐/工具推荐模块
- Collections / Tools 列表页
- Package detail pages
- Tool detail pages

## 4. 图片和艺术字 Alt 检查

上线前需要确认店铺图片、Logo、艺术字、图标型品牌内容具备可访问名称。

- [ ] 首页 Logo 图片有 `alt`，或父级链接有明确 `aria-label` / `title`。
- [ ] 艺术字品牌展示不影响可访问名称，例如视觉上显示 `myᕲreamshoots` 或 `ልiጋreamርapes` 时，辅助信息仍能表达 `MyDreamShoots` 或 `Aidreamcapes`。
- [ ] Logo 图片使用合法 `alt`；文字型艺术字不能乱加无效 `alt` 属性，应使用 `aria-label`、`title`、`sr-only` 明文解析。
- [ ] 主要内容图片有描述性 `alt`。
- [ ] 纯装饰图片可以使用空 `alt=""`，但不能影响关键信息理解。
- [ ] 生成图、套餐图、工具图等用户需要理解的图片，`alt` 不应为空。

### 店铺标题艺术字记录

上线前 Header / Footer 的视觉品牌标题必须与已批准艺术字一致，同时 `aria-label`、`alt`、`title`、SEO、JSON-LD 等可访问或结构化名称继续使用普通品牌名。

- MyDreamShoots：视觉展示 `myᕲreamshoots`；可访问 / SEO 名称使用 `MyDreamShoots`。
- AIdreamcapes：视觉展示 `ልiጋreamርapes`；可访问 / SEO 名称使用 `Aidreamcapes`。

建议检查重点：

- Header Logo
- Footer Logo
- Hero 区主视觉图片
- 套餐/工具卡片图片
- 生成结果图片
- 艺术字品牌元素

## 5. Footer 链接 Nofollow 检查

上线前需要确认底部页面链接统一带 `rel="nofollow"`，避免把底部重复导航当作重点权重出口。

- [ ] Footer 的 Explore / Content / Support 等页面导航链接带 `rel="nofollow"`。
- [ ] Footer 轻量版本的快捷链接带 `rel="nofollow"`。
- [ ] Footer 外部社交链接带 `rel="nofollow noopener noreferrer"`，并保留安全的外链行为。
- [ ] 邮箱、地址等非页面导航信息不强制按页面链接处理。

## 6. 店铺语言检查

上线前需要确认两个店铺的客户可见内容没有出现不应该出现的其他语言。

- [ ] AIdreamcapes 前台客户可见页面内容为英文。
- [ ] MyDreamShoots 前台客户可见页面内容为英文。
- [ ] Header、Footer、按钮、表单、弹窗、错误提示均无中文或其他非预期语言。
- [ ] 套餐页、工具页、价格页、FAQ、登录页、工作区页面均无其他语言混入。
- [ ] SEO 文案、OG 文案、结构化数据中的可见品牌描述无其他语言混入。

建议检查页面：

- 首页
- Pricing
- FAQ / Help
- Login / Register / Reset Password
- Account
- App Workspace
- Packages / Collections
- Tools
- Package detail pages
- Tool detail pages
- Footer policy pages

## 2026-07-13 本地 SEO 修复核查记录

本轮针对 MyDreamShoots 与 AIdreamcapes 做了本地代码扫描和 Playwright 页面抽查，结果如下。

| 修复点 | 本地状态 | 验证方式 | 备注 |
| --- | --- | --- | --- |
| `/help` 与 `/faq` 内容统一 | 已通过 | Playwright 访问 `/site/mydreamshoots/help`、`/site/aidreamcapes/help`，最终 URL 均跳转到 `/faq`；canonical 分别为 `https://www.mydreamshoots.com/faq`、`https://www.aidreamcapes.com/faq`。 | 避免 Help / FAQ 重复内容分流。 |
| `#workflow` 改为独立 `/workflow` 路由 | 已通过 | Playwright 访问 `/workflow` 均 200；首页链接扫描 `#workflow` 为 0，`/help` 链接为 0。 | Header / Footer / CTA 统一指向 `/workflow`。 |
| 桌面与移动端套餐目录命名统一 | 已通过 | 静态扫描确认前台代码不再出现 `AI Shoot Packages`；移动端首页 DOM 不包含该文案，显示 `Browse packages`。 | AIdreamcapes 仍使用自己的 `Travel Packages` 品牌命名。 |
| Browse packages / Tools 语义 heading | 已通过 | MyDreamShoots 桌面弹层 DOM 抽查：套餐弹层标题、分类、套餐入口为 `h2`；Tools 弹层分类与工具入口为 `h3`。 | 保留原链接和点击区域，仅调整语义层级。 |
| 生成图片与生成视频可访问名称 | 已通过 | 代码核查：生成图片使用 `runtimeGeneratedAssetAlt(...)` 写入 `alt`；生成产物入库时写入 `altText`；生成视频使用 `aria-label` 与 `title`。 | HTML `video` 没有 `alt` 属性，因此视频使用可访问名称表达。 |
| 全站图片 / 艺术字 alt 核查 | 已通过 | 静态扫描 `src + public/themes` 共 837 个前台模板 / 组件文件，`<img>` 缺失或空 `alt` 为 0；Playwright 抽查首页、FAQ、Workflow 页面缺失 alt 为 0。 | 本轮同时修复 legacy `reviews.liquid` 背景图容器，改为 `role="img"` + `aria-label/title`。 |
| Footer 页面链接 nofollow | 已通过 | Playwright 抽查两个店首页 footer，页面链接缺失 `rel="nofollow"` 为 0；外部社交链接为 `nofollow noopener noreferrer`。 | `mailto:` 邮箱不按页面导航链接处理。 |
| 前台客户可见语言抽查 | 已通过 | Playwright 抽查两个店首页、FAQ、Workflow、Pricing、Collections、Tools、Login，页面可见文本中文字符数均为 0。 | 代码中仍有后台 / theme schema 的 `zh-CN` 配置，不属于前台客户可见内容。 |
| TypeScript 回归 | 已通过 | `npm run typecheck`。 | 本轮模板与文档改动未引入类型错误。 |

本轮执行过的本地检查：

- `node` 静态扫描 `src` 与 `public/themes` 的 `<img>`、背景图可访问名称。
- Playwright 抽查 `http://127.0.0.1:3002/site/mydreamshoots` 与 `http://127.0.0.1:3002/site/aidreamcapes` 的首页、`/help`、`/faq`、`/workflow`。
- Playwright 抽查 MyDreamShoots 桌面 Header 的 Browse packages / Tools 弹层 heading 层级与移动端菜单文案。
- Playwright 抽查两个店首页、FAQ、Workflow、Pricing、Collections、Tools、Login 的客户可见文本中文字符数。
- `npm run typecheck`。

## 上线前确认记录

| 检查项 | AIdreamcapes | MyDreamShoots | 备注 |
| --- | --- | --- | --- |
| TDK 已正确维护 | [x] | [x] | 2026-07-14 本地 raw HTML 精确对照通过。 |
| `<title>` 位于 `<head>` 靠前位置 | [x] | [x] | 2026-07-14 本地 raw HTML 确认 `<title>` 早于资源标签。 |
| H2 / H3 内容结构清晰 | [x] | [x] | 2026-07-14 修复工具详情页 H1 前置，复查目录 / 工具详情 heading 通过。 |
| 图片和艺术字有可访问名称 / alt | [x] | [x] | 2026-07-14 修复 Aidreamcapes visual proof 泛化 alt；静态与页面抽查通过。 |
| Footer 页面链接带 nofollow | [x] | [x] | 2026-07-14 页面抽查通过；邮件链接不按页面导航 nofollow 处理。 |
| 前台无其他语言混入 | [x] | [x] | 2026-07-14 主要页面可见文本中文字符数为 0。 |
| 主要页面已抽查 | [x] | [x] | 首页、Pricing、FAQ/Help、Workflow、Collections、Tools、Login、工具详情页已抽查。 |

## 2026-07-14 上线复查补充

本轮按上线要求再次复查 MyDreamShoots 与 AIdreamcapes，本地发现并修复以下问题：

- MyDreamShoots `/contact-us` 的 `Email support` CTA 被 `hrefFor` 当成站内路径，错误生成 `/site/mydreamshoots/mailto:support@mydreamshoots.com`；已放行 `mailto:` / `tel:` / `sms:` 协议链接，复查所有 support 链接均为 `mailto:support@mydreamshoots.com`。
- AIdreamcapes 首页 visual proof 卡片图的 fallback alt 曾显示泛化 `Photo result`；已改为优先使用卡片标题，复查为 `Coastal Light Sets`、`Old Quarter Walks`、`Island Balcony Scenes`、`Alpine Trail Frames`。
- 部分工具详情页缺少首屏 H1；根因是工具详情页的 `ai_tool_entry` 可能排在 banner / SEO section 后并被懒加载，同时 `/site/[siteSlug]/tools/[toolSlug]` 解析工具状态时没有按当前 `siteSlug` 精确选站点。已修复站点选择、工具详情 fallback 合成与 `ai_tool_entry` 前置。复查 `/tools/gala-photo`、`/tools/creator-portrait`、`/tools/noir-portrait`、`/tools/editorial-getaway` 均有且仅有一个 H1。

本轮复查命令/方式：

- Playwright 抽查 `http://127.0.0.1:3102/site/mydreamshoots` 与 `http://127.0.0.1:3102/site/aidreamcapes` 主要页面。
- Playwright 聚焦验证 contact CTA、Aidreamcapes visual proof alt、工具详情页 H1。
- `git diff --check`
- `npm run prisma:validate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
