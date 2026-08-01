# 店铺上线检查清单

适用店铺：

- MyDreamShoots：`www.mydreamshoots.com`
- AIdreamcapes：`www.aidreamcapes.com`
- AIdreamshoots：`aidreamshoots.eu`
- AIdreamcapes EU：`aidreamcapes.eu`

固定规则：后续展开两个西班牙 `.eu` 店铺时，不得影响正常两个 `.com` 店铺；做功能优化、路由修复、菜单/分类/工具修复、性能优化、SEO 结构优化时，必须覆盖所有适用店铺，不能只改一半。四店之间的品牌、语言、域名、SEO 文案、图片资产和客户数据必须隔离。

## 1. TDK 检查

上线前需要确认正常两个 `.com` 店铺的 `title`、`description`、`keywords` 已维护成功，并且线上页面源代码中展示的内容与下方一致。两个西班牙 `.eu` 店铺需要按 AIdreamshoots / AIdreamcapes EU 独立维护西班牙语 TDK，不能直接复用 `.com` 站文案。

### AIdreamcapes

- [ ] `title` 正确：
  `AIdreamcapes – the most advanced AI photo generator maker`
- [ ] `description` 正确：
  `Transform your favorite moments into professional-grade photos and stunning memories with AIdreamcapes. Choose any setting, outfit, or vibe – all from home.`
- [ ] `keywords` 正确：
  `Dream Photos,Dream Photoshoot,Wedding Photoshoot,Wedding Photos,AI Photos,AI Photoshoot,Couple Photos`

### MyDreamShoots

- [ ] `title` 正确：
  `Professional AI Photo Generator Online - MyDreamShoots`
- [ ] `description` 正确：
  `Create sports fan photos, VIP-style portraits, Christmas group photos, Thanksgiving portraits, and Halloween party albums from your selfies with MyDreamShoots.`
- [ ] `keywords` 正确：
  `Dream Shoots,Sports Fan Photos,VIP Style Portraits,Christmas Group Photos,Thanksgiving Photos,Halloween Party Photos,AI Photo Generator`

检查方式：

1. 打开店铺首页。
2. 查看页面源代码。
3. 搜索 `<title>`、`name="description"`、`name="keywords"`。
4. 对照本清单逐项确认。

## 2. Title 位置检查

上线前需要确认 `<title>` 位于 `<head>` 内，并且固定为 `<head>` 后第一个有效标签。这个位置是上线硬规则，不得因 Next.js 资源预加载、脚本注入、性能优化、middleware 开关或自定义 server 变更而后移。

- [ ] 页面源代码中存在 `<head>`。
- [ ] `<title>` 紧跟 `<head>` 之后，不能被 `preload`、`stylesheet`、`script` 或其他资源标签插到前面。
- [ ] `<title>` 位于主要资源加载标签之前，例如大量 `preload`、`script`、`stylesheet` 之前。
- [ ] `description`、`keywords`、canonical、OG/Twitter 等 SEO 标签也在 `<head>` 内。
- [ ] 上线前执行 `npm run smoke:storefront-head-title-order`，确认 MyDreamShoots 与 AIdreamcapes 首页源码标题顺序通过。

建议检查方式：

1. 打开页面源代码。
2. 从顶部开始查看 `<head>`。
3. 确认 `<title>` 紧跟 `<head>` 之后，是 `<head>` 内第一个有效标签，不能被渲染到 `<body>` 中。

## 3. H1 / H2 / H3 内容结构检查

上线前需要确认首页正文、套餐目录页、工具目录页和详情页使用清晰的 heading 层级，让 Google 爬虫能理解页面模块划分和内容权重。Header、Footer、桌面弹层、移动菜单、一级目录和二级目录属于导航，不使用 `h1` / `h2` / `h3` 承载目录名称。

- [ ] 页面主内容只有合理数量的核心 H1，不能把普通导航按钮误做 H1。
- [ ] 桌面端一级目录 `Browse packages` 与手机端同一入口名称保持一致，不能桌面叫 `Browse packages`、手机端叫 `AI Shoot Packages`。
- [ ] Header 的 `Browse packages` / `Travel Packages` / `Tools` 弹层总标题、分类名、入口名只用普通导航文本，例如 `span`；不要用 `h2` / `h3` 包裹导航目录名。
- [ ] `/collections` / Browse packages 正文内容中，套餐分类、套餐入口标题使用 `h2` 表达内容层级。
- [ ] `/tools` 正文内容中，工具分类、工具入口标题使用 `h3` 表达内容层级。
- [ ] 首页正文内容需要按页面结构使用 `h1` / `h2` / `h3`；不要把 Header、Footer、桌面弹层、移动菜单里的一级/二级目录名称算作正文 heading。
- [ ] 保留原来的链接 `href`、点击区域、视觉样式和移动端布局，heading 标签只用于正文内容层级。

建议检查重点：

- Header Browse packages / Travel Packages 弹层：确认无 `h2` / `h3` 导航目录名
- Header Tools 弹层：确认无 `h2` / `h3` 导航目录名
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

上线前需要确认四个店铺的客户可见内容没有出现不应该出现的其他语言。

- [ ] AIdreamcapes 前台客户可见页面内容为英文。
- [ ] MyDreamShoots 前台客户可见页面内容为英文。
- [ ] AIdreamshoots（`aidreamshoots.eu`）前台客户可见页面内容为西班牙语。
- [ ] AIdreamcapes EU（`aidreamcapes.eu`）前台客户可见页面内容为西班牙语。
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

## 7. Google Translate 兼容检查

上线前需要确认客户前台所有页面都支持 Chrome / Google Translate，不能再引入阻止翻译的属性、meta 或运行时状态。

- [ ] 客户前台页面的 `<html>` 保持正确 `lang`：英文 `.com` 店铺为 `en`，西班牙 `.eu` 店铺为 `es`。
- [ ] `<html>` 和 `<body>` 都保留 `translate="yes"`。
- [ ] 页面不存在 `<meta name="google" content="notranslate">`。
- [ ] 页面根节点和客户前台主要容器不存在 `.notranslate` 或 `translate="no"`。
- [ ] `src/components/storefront/html-lang-sync.tsx` 与 `src/app/layout.tsx` 的翻译兼容守护未被删除或削弱。
- [ ] 首页、FAQ、Pricing、Collections、Tools、Login、Account、App Workspace、生成结果 / 相册页均抽查 Google Translate 弹窗可用，不出现“无法翻译此网页”。

建议自动化检查：

```js
({
  lang: document.documentElement.lang,
  htmlTranslate: document.documentElement.getAttribute("translate"),
  bodyTranslate: document.body.getAttribute("translate"),
  googleNoTranslate: !!document.querySelector('meta[name="google"][content*="notranslate" i]'),
  blockedTranslateNodes: document.querySelectorAll('[translate="no"], .notranslate').length
})
```

## 8. Sitemap 与目录覆盖检查

上线前必须确认每个对应网站的 `sitemap.xml` 按独立域名输出，并覆盖该网站全部可索引目录。检查不能只看 Header 菜单里当前露出的几个链接；必须覆盖公共基础页、policy 页、套餐目录、工具目录、博客目录和所有当前 active 的二级详情目录。

覆盖范围：

- [ ] 使用对应生产 Host 单独请求 sitemap：`www.mydreamshoots.com/sitemap.xml` 只包含 MyDreamShoots URL，`www.aidreamcapes.com/sitemap.xml` 只包含 AIdreamcapes URL；后续 `.eu` 店铺上线时也按各自域名单独检查。
- [ ] 基础公共页进入 sitemap：`/`、`/workflow`、`/pricing`、`/faq`、`/about-us`、`/contact-us`。
- [ ] Policy 页进入 sitemap：`/privacy`、`/terms`、`/cookies`、`/refunds`、`/content`、`/shipping`、`/children-privacy`、`/state-privacy`。
- [ ] 套餐目录完整覆盖：`/collections`、全部 active `creativePackCategories`、全部 active `creativePacks` 对应的 canonical `/collections/*` 路径。
- [ ] 工具目录完整覆盖：`/tools`、全部 active `toolMenuItems`、MyDreamShoots 默认公开工具、所有 canonical `/tools/*` 路径。
- [ ] 博客目录完整覆盖：`/blog`、全部可索引 `article` 页面对应的 `/blog/*` 路径。
- [ ] Header 桌面 / 移动端 `Browse packages` / `Occasion Albums` / `Tools` 内链全部可以跳转，最终 canonical URL 为 200，并且最终路径存在于对应网站 sitemap。
- [ ] 旧路径、重定向路径、重复 policy 路径不得出现在 sitemap，例如旧工具、旧 travel blog、`/cookie-policy`、`/privacy-policy`、`/terms-of-service`。
- [ ] 修改 `data/platform-state.json`、关系表、分类/工具菜单或 SEO 目录后，必须同步 platform-state 文档和关系表，再清理 `.next/cache/platform-state-postgres.json`。

必跑命令：

```bash
npm run smoke:storefront-navigation-data
npm run smoke:storefront-sitemap-directory-coverage
```

自动化脚本说明：

- `smoke:storefront-navigation-data`：确认不同页面上的套餐/工具弹层数据一致，避免局部页面读到旧分类或旧工具。
- `smoke:storefront-sitemap-directory-coverage`：从 `data/platform-state.json` 推导对应站点全部可索引目录，使用 Host header 拉取各站 `sitemap.xml`，检查缺失目录、跨站域名、旧路径残留。

当前 `.com` 店铺目录口径：

| 店铺 | 套餐目录 | 工具目录 | 博客 / 公共目录 |
| --- | --- | --- | --- |
| MyDreamShoots | `/collections`、40 个 active 分类、28 个 active pack 的 canonical collection 路径 | `/tools`、28 个 canonical 公开工具路径 | `/blog`、全部可索引 article、基础公共页、policy 页 |
| AIdreamcapes | `/collections`、27 个 active 分类、28 个 active pack 的 canonical collection 路径 | `/tools`、20 个 active tool menu item 路径 | `/blog`、全部可索引 article、基础公共页、policy 页 |

## 2026-08-01 Storefront 视觉、路由、Footer 修复记录

本轮固定两站 `.com` footer 最底部版权文案，后续上线和同步脚本不得改回旧品牌格式：

| 店铺 | Footer 底部版权文案 |
| --- | --- |
| MyDreamShoots | `© 2026 myDreamshoots.com. All rights reserved.` |
| AIdreamcapes | `© 2026 Aidreamcapes.com. All rights reserved.` |

同步要求：

- 目标视觉资产缓存版本为 `20260801visualfix1`。
- MyDreamShoots Thanksgiving `Keepsake Cover` 使用 `public/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp`。
- AIdreamcapes Christmas `Holiday story` 使用 `public/assets/sites/site_aidreamcapes/fan-holiday-theme/posters/christmas-card-motion.webp`。
- 首页套餐分类 pills、卡片、箭头和图片数量入口必须进入对应 `/collections/<slug>` 详情页；真正创建 CTA 仍可进入 `/login`、`/app/create` 或 `/tools/*`。
- 首页 generated showcase 图片 rail 不得出现灰色空白块；featured pack 左侧文案卡不得被右侧图片墙强行撑高出大量空白。

## 2026-07-31 Sitemap 与新分类 / 新工具内链记录

本轮针对 MyDreamShoots 与 AIdreamcapes 的新主题分类、工具分类和 sitemap 做了本地及关系表复查，并把 sitemap 覆盖纳入上线固定检查项。

| 检查项 | MyDreamShoots | AIdreamcapes | 结果 |
| --- | --- | --- | --- |
| Header 套餐 / 工具菜单内链 | 套餐 28 条、工具 28 条 | 套餐 20 条、工具 20 条 | 2026-07-31 线上新 release 复查通过，跨路由菜单数据一致。 |
| 菜单最终路径进入 sitemap | [x] | [x] | 所有菜单链接最终 canonical 路径均存在于对应域名 sitemap。 |
| 新主题 / 工具目录进入 sitemap | [x] `outdoor-creator-scenes`、`thanksgiving-group-photos`、`halloween-party-photos` 等已覆盖 | [x] fan-scene、game-day、premiere、Christmas、Thanksgiving、Halloween、seasonal 工具和分类已覆盖 | `smoke:storefront-sitemap-directory-coverage` 通过。 |
| 旧路径从 sitemap 移除 | [x] 旧 `travel-scene-pack` / `travel-story` blog 未残留；旧集合路径 308 到 `outdoor-creator-scenes` | [x] 旧 travel tools / old travel blog / `route-portrait-engine` 未残留 | 旧路径残留为 0。 |
| 关系表与 platform-state 文档 | 页面 106、active 分类 40、active pack 28、公开工具 28、博客 80 | 页面 98、active 分类 27、active pack 28、active 工具 20、博客 61 | 已同步线上 Postgres 关系表和 platform-state 文档；Postgres smoke 显示 6 sites、7 customers、41 jobs、98 assets、16 albums。 |
| sitemap URL 数量 | 168 | 149 | 对应 Host 独立输出，无跨站域名；directory bucket 缺失为 0。 |
| 博客主题严格扫描 | 80 个 blog URL，旧主题词命中 0 | 61 个 blog URL，旧主题词命中 0 | 逐篇检查 slug、title、H1、description、正文，未见旧 travel / route 主题残留。 |
| 图片健康抽样 | 全 sitemap 去重 436 个图片引用全部 `200 image/*` | 全 sitemap 去重 406 个图片引用全部 `200 image/*` | 覆盖 sitemap 页面、首页、目录页、集合页、工具页、博客页；4 个首次抓取超时页面已单独复核，页面 200、图片 17/17 通过；当前资产版本为 `20260731assetfix1`。 |

本轮执行命令：

```bash
npm run typecheck
npm run smoke:storefront-public-routes
npm run smoke:storefront-navigation-data
npm run smoke:storefront-sitemap-directory-coverage
npm run smoke:storefront-head-title-order
npm run smoke:dreamshoot-blog-content
npm run smoke:postgres-state
```

2026-07-31 线上发布记录：

- Release：`/www/wwwroot/mydreamshoots.com/releases/copy-20260731235558`，`mydreamshoots.service` 与 `/www/wwwroot/mydreamshoots.com/app` 均已指向该 release，服务端口 `3010`。
- 数据同步：`sync-fan-holiday-storefront-theme`、`sync-dreamshoot-blog-content.mjs`、`db:import-state` 已执行；因全量 relational import 被历史 `siteDomain.domain` 唯一约束阻断，本轮改用定向 relational upsert 更新两个 `.com` 站的 `themePage`、`themeSettings`、`siteTheme`，并更新 MyDreamShoots 的 `creativePackCategory` / `creativePack`。本次补丁额外精准更新线上 Postgres 的 MyDreamShoots `toolMenuItem`、`themePublication` 和 `platformStateDocument`，清理旧 `travel-inspired` 工具文案。
- 内容修复：MyDreamShoots 旧 `Travel Scene Pack` 改为 `Outdoor Creator Scenes`，canonical 路径为 `/collections/outdoor-creator-scenes`；旧 `/collections/travel-scene-pack` 308 到新路径；旧 `/blog/travel-scene-pack-photo-package-guide` 与 `/blog/travel-story-video-theme-guide` 已从关系表和 sitemap 删除。AIdreamcapes fallback collection 文案从旧 `Travel Gallery` / postcard keepsake 口径改为 private fan-scene / holiday album 口径；两站博客生成模板已按品牌拆分语言结构。
- 图片修复：AIdreamcapes `fan-holiday-theme` covers/gallery 与 MyDreamShoots Thanksgiving / Christmas / outdoor creator 图片均使用 `20260731assetfix1` 版本规避 Cloudflare 旧 404 缓存；最终全 sitemap 图片 probe 为 MyDreamShoots 436/436、AIdreamcapes 406/406 通过，首次超时页面单独复核图片 17/17 通过。
- 最终验证：`typecheck`、`smoke:storefront-public-routes`、`smoke:storefront-navigation-data`、`smoke:storefront-sitemap-directory-coverage`、`smoke:storefront-head-title-order`、`smoke:dreamshoot-blog-content`、`smoke:fan-holiday-storefront-theme`、`smoke:postgres-state` 通过；Playwright smoke 使用本机浏览器经 SSH tunnel 指向线上 `127.0.0.1:3010` 执行。
- 公网复查：`https://www.mydreamshoots.com/`、`https://www.aidreamcapes.com/`、两个 `.com` sitemap、`https://www.mydreamshoots.com/tools/nature-adventure`、`https://www.aidreamcapes.com/blog/fan-scene-photo-albums-guide` 均返回 200；全 sitemap 文案扫描两站旧主题命中 0、跨品牌命中 0；`.eu` 可达性抽查 `https://aidreamshoots.eu/`、`https://www.aidreamshoots.eu/`、`https://aidreamcapes.eu/`、`https://www.aidreamcapes.eu/` 均返回 200。

## 2026-07-16 西班牙店铺名称和域名规则记录

本轮固定两个西班牙店铺的对外名称和域名，并写入后续工作规则。

| 店铺 | 对外名称 | 前台域名 | 内部说明 |
| --- | --- | --- | --- |
| 西班牙 DreamShoots 店铺 | `AIdreamshoots` | `aidreamshoots.eu` | 内部沿用旧 `site_mydreamshoots_xby` id，公开 slug 使用 `aidreamshoots`。 |
| 西班牙 AIdreamcapes 店铺 | `AIdreamcapes` | `aidreamcapes.eu` | 内部沿用旧 `site_aidreamcapes_xby` id，公开 slug 使用 `aidreamcapes-eu`。 |

固定回归要求：

- 西班牙 `.eu` 店铺工作不得影响正常 `.com` 两站。
- 功能优化、路由修复、菜单/分类/工具修复、性能优化、SEO 结构优化要覆盖所有适用店铺。
- 品牌、语言、域名、SEO 文案、图片资产、客户数据必须隔离。

## 2026-07-13 本地 SEO 修复核查记录

本轮针对 MyDreamShoots 与 AIdreamcapes 做了本地代码扫描和 Playwright 页面抽查，结果如下。

| 修复点 | 本地状态 | 验证方式 | 备注 |
| --- | --- | --- | --- |
| `/help` 与 `/faq` 内容统一 | 已通过 | Playwright 访问 `/site/mydreamshoots/help`、`/site/aidreamcapes/help`，最终 URL 均跳转到 `/faq`；canonical 分别为 `https://www.mydreamshoots.com/faq`、`https://www.aidreamcapes.com/faq`。 | 避免 Help / FAQ 重复内容分流。 |
| `#workflow` 改为独立 `/workflow` 路由 | 已通过 | Playwright 访问 `/workflow` 均 200；首页链接扫描 `#workflow` 为 0，`/help` 链接为 0。 | Header / Footer / CTA 统一指向 `/workflow`。 |
| 桌面与移动端套餐目录命名统一 | 已通过 | 静态扫描确认前台代码不再出现 `AI Shoot Packages`；移动端首页 DOM 不包含该文案，显示 `Browse packages`。 | AIdreamcapes 仍使用自己的 `Travel Packages` 品牌命名。 |
| Header 导航与正文 heading 分离 | 已通过 | MyDreamShoots 桌面弹层 DOM 抽查：套餐/工具弹层导航目录名不再使用 `h2` / `h3`；`/collections` 正文套餐入口为 `h2`，`/tools` 正文工具入口为 `h3`。 | 保留原链接和点击区域，仅调整语义层级。 |
| 生成图片与生成视频可访问名称 | 已通过 | 代码核查：生成图片使用 `runtimeGeneratedAssetAlt(...)` 写入 `alt`；生成产物入库时写入 `altText`；生成视频使用 `aria-label` 与 `title`。 | HTML `video` 没有 `alt` 属性，因此视频使用可访问名称表达。 |
| 全站图片 / 艺术字 alt 核查 | 已通过 | 静态扫描 `src + public/themes` 共 837 个前台模板 / 组件文件，`<img>` 缺失或空 `alt` 为 0；Playwright 抽查首页、FAQ、Workflow 页面缺失 alt 为 0。 | 本轮同时修复 legacy `reviews.liquid` 背景图容器，改为 `role="img"` + `aria-label/title`。 |
| Footer 页面链接 nofollow | 已通过 | Playwright 抽查两个店首页 footer，页面链接缺失 `rel="nofollow"` 为 0；外部社交链接为 `nofollow noopener noreferrer`。 | `mailto:` 邮箱不按页面导航链接处理。 |
| 前台客户可见语言抽查 | 已通过 | Playwright 抽查两个店首页、FAQ、Workflow、Pricing、Collections、Tools、Login，页面可见文本中文字符数均为 0。 | 代码中仍有后台 / theme schema 的 `zh-CN` 配置，不属于前台客户可见内容。 |
| TypeScript 回归 | 已通过 | `npm run typecheck`。 | 本轮模板与文档改动未引入类型错误。 |

本轮执行过的本地检查：

- `node` 静态扫描 `src` 与 `public/themes` 的 `<img>`、背景图可访问名称。
- Playwright 抽查 `http://127.0.0.1:3002/site/mydreamshoots` 与 `http://127.0.0.1:3002/site/aidreamcapes` 的首页、`/help`、`/faq`、`/workflow`。
- Playwright 抽查 MyDreamShoots 桌面 Header 的 Browse packages / Tools 弹层不使用 heading 承载导航目录名，并确认移动端菜单文案。
- Playwright 抽查两个店首页、FAQ、Workflow、Pricing、Collections、Tools、Login 的客户可见文本中文字符数。
- Playwright 抽查两个店公共页面与客户工作区的 Google Translate 兼容属性。
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
| Google Translate 兼容 | [x] | [x] | 2026-07-14 已加入 `html/body translate=yes` 与 `Content-Language` 守护；公共页与客户工作区 DOM 属性抽查通过。 |
| Sitemap 全目录覆盖 | [x] | [x] | 2026-07-31 菜单内链最终路径均在对应 sitemap；目录覆盖脚本通过；旧路径残留为 0。 |
| 主要页面已抽查 | [x] | [x] | 首页、Pricing、FAQ/Help、Workflow、Collections、Tools、Login、工具详情页已抽查。 |

## 2026-07-14 上线复查补充

本轮按上线要求再次复查 MyDreamShoots 与 AIdreamcapes，本地发现并修复以下问题：

- MyDreamShoots `/contact-us` 的 `Email support` CTA 被 `hrefFor` 当成站内路径，错误生成 `/site/mydreamshoots/mailto:support@mydreamshoots.com`；已放行 `mailto:` / `tel:` / `sms:` 协议链接，复查所有 support 链接均为 `mailto:support@mydreamshoots.com`。
- AIdreamcapes 首页 visual proof 卡片图的 fallback alt 曾显示泛化 `Photo result`；已改为优先使用卡片标题，复查为 `Coastal Light Sets`、`Old Quarter Walks`、`Island Balcony Scenes`、`Alpine Trail Frames`。
- 部分工具详情页缺少首屏 H1；根因是工具详情页的 `ai_tool_entry` 可能排在 banner / SEO section 后并被懒加载，同时 `/site/[siteSlug]/tools/[toolSlug]` 解析工具状态时没有按当前 `siteSlug` 精确选站点。已修复站点选择、工具详情 fallback 合成与 `ai_tool_entry` 前置。复查 `/tools/gala-photo`、`/tools/creator-portrait`、`/tools/noir-portrait`、`/tools/editorial-getaway` 均有且仅有一个 H1。
- Google Translate 在客户工作区可能显示“无法翻译此网页”；已把翻译兼容设为上线门槛，并强化 `HtmlLangSync` / 根 layout：前台路由保持正确 `lang`、`html/body translate="yes"`、`Content-Language`，并清理意外的 `google notranslate` meta。

本轮复查命令/方式：

- Playwright 抽查 `http://127.0.0.1:3102/site/mydreamshoots` 与 `http://127.0.0.1:3102/site/aidreamcapes` 主要页面。
- Playwright 聚焦验证 contact CTA、Aidreamcapes visual proof alt、工具详情页 H1。
- `git diff --check`
- `npm run prisma:validate`
- `npm run typecheck`
- `npm run lint`
- `npm run build`

## 2026-07-14 隐私与公司资料上线记录

本轮新增并同步 MyDreamShoots 与 AIdreamcapes 的儿童隐私、州隐私入口和公司资料。儿童隐私文案按 COPPA 方向说明未满 13 岁儿童资料处理、父母/监护人删除请求和未成年人照片授权；州隐私文案覆盖 California privacy rights / CCPA 相关客户请求和其他适用美国州隐私请求。

| 检查项 | AIdreamcapes | MyDreamShoots | 备注 |
| --- | --- | --- | --- |
| 儿童隐私页面 | [x] `/children-privacy` | [x] `/children-privacy` | `/policies/children-privacy`、`/children-privacy-policy`、`/childrens-privacy` 均归一到短路径。 |
| 州隐私页面 | [x] `/state-privacy` | [x] `/state-privacy` | `/policies/state-privacy`、`/state-privacy-rights`、`/california-privacy`、`/ccpa` 均归一到短路径。 |
| Footer 最底部链接 | [x] | [x] | 在版权行附近保留儿童隐私与州隐私入口，显示为 AIdreamcapes：`KIDS Act`、`CISA`；MyDreamShoots：`KIDS Act`、`DPDPA`，链接带 `rel="nofollow"`。 |
| Policy 页面互链 | [x] | [x] | Policy 内容页底部提供 `KIDS Act` 与对应州隐私入口；儿童隐私正文也明确指向 AIdreamcapes 的 `CISA`、MyDreamShoots 的 `DPDPA`。 |
| Policy 正文 SSR | [x] | [x] | `policy_content` 不再走懒加载；儿童隐私 / 州隐私正文可在首屏 HTML/DOM 中直接读取，便于 Google 和 AI 理解。 |
| 结构化公司信息 | [x] | [x] | Organization JSON-LD 只保留 company / address / contact email：legalName、email、PostalAddress，不再输出电话和税号。 |
| 实体清单 / Google-AI 理解提示 | [x] | [x] | 州隐私页和本文档均只记录公司名称、地址、邮箱三项，便于搜索引擎和 AI 系统识别对外联系信息。 |
| SECURE / GUARD 联邦法案监测 | [x] | [x] | SECURE Data Act 与 GUARD Financial Data Act 记录为拟议联邦隐私法案监测项；若后续生效，再更新为强制执行政策。 |
| 合规来源记录 | [x] | [x] | 参考 FTC COPPA、California OAG / CPPA privacy rights、USPS 州缩写、House Financial Services Committee 2026-04-22 法案介绍；WY = Wyoming，DE = Delaware。 |

2026-07-20 页脚公司资料与隐私入口校正记录：

| 站点 | Footer 公司名称 | Address | Contact Us | 儿童隐私入口 | 州隐私入口 |
| --- | --- | --- | --- | --- | --- |
| `www.aidreamcapes.com` | `Aidreamcapes.com` | `30 N GOULD ST STE R,SHERIDAN,WY 82801` | `support@aidreamcapes.com` | `KIDS Act` | `CISA` |
| `www.mydreamshoots.com` | `myDreamshoots.com` | `8 THE GREEN STE B,DOVER,DE 19901` | `support@mydreamshoots.com` | `KIDS Act` | `DPDPA` |

上线检查要求：

- Footer 公司资料只显示 `Company`、`Address`、`Contact Us` 三项。
- Footer 和 Policy 互链中 `/children-privacy` 显示 `KIDS Act`。
- `www.mydreamshoots.com` 的 `/state-privacy` 显示 `DPDPA`。
- `www.aidreamcapes.com` 的 `/state-privacy` 显示 `CISA`。
- 不再在 Footer 或公司资料结构化数据中展示 `Phone`、`Tax ID`、`EIN / Tax ID`。

实体清单 / Entity inventory:

| Domain | Brand | Company | Address | Contact Us | Children policy label | State policy label |
| --- | --- | --- | --- | --- | --- | --- |
| `www.aidreamcapes.com` | `Aidreamcapes` | `Aidreamcapes.com` | `30 N GOULD ST STE R,SHERIDAN,WY 82801` | `support@aidreamcapes.com` | `KIDS Act` | `CISA` |
| `www.mydreamshoots.com` | `MyDreamShoots` | `myDreamshoots.com` | `8 THE GREEN STE B,DOVER,DE 19901` | `support@mydreamshoots.com` | `KIDS Act` | `DPDPA` |

SECURE Data Act / GUARD Financial Data Act 监测记录：

- 当前按 2026-04-22 美国众议院金融服务委员会介绍资料记录为拟议联邦隐私法案，不按已生效法律写入强制承诺。
- 文案层面先覆盖准备项：仅收集必要数据、消费者访问/副本/删除请求、敏感数据 opt-in 方向、AI 使用透明度监测。
- GUARD Financial Data Act 侧重金融机构；两站当前不是金融机构，记录为外部支付、账单、AI 透明度和未来合规更新的监测项。

涉及代码与数据：

- `src/lib/site-route-canonical.ts`、`src/app/[...path]/page.tsx`、`src/app/site/[siteSlug]/[...path]/page.tsx`：新增儿童隐私和州隐私短路径及别名归一。
- `src/lib/storefront-render.tsx`、`src/lib/theme/policy-seo.ts`：新增两站 policy 页面文案与 SEO。
- `src/components/theme-renderer.tsx`：Footer 公司资料兜底、底部 nofollow 隐私链接、policy 页面底部互链。
- `src/lib/theme/json-ld.ts`：Organization JSON-LD 输出公司法定名称、联系方式、地址和税号。
- `src/lib/theme/packages/dreamshoot-ai-studio/templates.ts`、`scripts/sync-dreamshoot-footer-pages.mjs`、`scripts/sync-aidreamcapes-brand-footer.mjs`、`scripts/migrate-aidreamcapes-demo.mjs`、`data/platform-state.json`：同步模板、迁移脚本和当前站点数据。

本轮验证：

- `npm run prisma:validate`
- `npm run typecheck`
- `npm run lint`：0 error，仓库仍有历史 warning。
- `npm run build`
- Playwright 抽查 `http://127.0.0.1:3104/site/mydreamshoots/children-privacy`、`/state-privacy`、`http://127.0.0.1:3104/site/aidreamcapes/children-privacy`、`/state-privacy`：页面 200、正文 SSR、Footer nofollow、短路径 alias、Organization JSON-LD 公司信息均通过。
- 数据残留扫描：两个目标站点主记录、主题记录、发布快照中不再包含旧地址 `8 THE GREEN STE B, DOVER, DE 19901` 或 `sales@aidreamcapes.com`。
- 2026-07-14 补充验证：`npm run typecheck`、`data/platform-state.json` JSON 解析、`git diff --check`、旧 EIN/州缩写文案残留扫描、前台源码中文字符扫描均通过。
- 2026-07-14 补充 Playwright 抽查 `http://127.0.0.1:3109/site/mydreamshoots/state-privacy`、`http://127.0.0.1:3109/site/aidreamcapes/state-privacy`、两站首页滚动页脚：州隐私正文、SECURE/GUARD 监测项、底部公司资料、Organization JSON-LD `PostalAddress` 与实体 `identifier` 均通过。

## 2026-08-01 公开媒体批刷水印上线记录

本轮把水印放到后台批处理层，而不是生成层。公开展示的图片 / 视频通过后台按钮或 CLI 统一刷新，前台展示版本带站点域名水印；客户上传原件、生成结果和工作区素材保持干净。

检查要求：

- `public/assets/...` 里被前台展示的图片 / 视频统一由 `batchWatermarkSitePublicMedia` 或 `npm run watermark:storefront-public-media` 处理，右下角使用站点域名水印。
- MyDreamShoots 使用 `myDreamshoots.com`，AIdreamcapes 使用 `Aidreamcapes.com`。
- `.com` 店铺的生成结果、用户上传、下载预览和工作区访问不再自动打水印。
- 旧的公开素材可用后台按钮 `刷新展示水印` 或 `npm run watermark:storefront-public-media -- --force` 重刷，避免重复叠加。
- `public/assets/dreamshoot` 非品牌公开素材、`public/assets/sites/site_aidreamcapes` 非品牌公开素材、以及对应 `.eu` 公开素材均使用 `20260801-storefront-watermark1` 标记；品牌 logo/icon 不进批处理。
- 上线前执行 `npm run watermark:storefront-public-media -- --dry-run`，如果公开素材已刷新完成，应返回 `changed: 0` 且 `failures: []`。

本轮验证：

- `npm run typecheck`
- `npm run smoke:storefront-watermarks`
- `npm run smoke:dreamshoot-homepage-showcase`
- `npm run smoke:fan-holiday-storefront-theme`
- `npm run smoke:storefront-navigation-data`
- `npm run smoke:storefront-sitemap-directory-coverage`
- `npm run watermark:storefront-public-media -- --dry-run`
