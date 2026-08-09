# 店铺上线检查清单

适用店铺：

- MyDreamShoots：`www.mydreamshoots.com`
- AIdreamcapes：`www.aidreamcapes.com`
- AIdreamshoots：`aidreamshoots.eu`
- AIdreamcapes EU：`aidreamcapes.eu`

固定规则：后续展开两个西班牙 `.eu` 店铺时，不得影响正常两个 `.com` 店铺；做功能优化、路由修复、菜单/分类/工具修复、性能优化、SEO 结构优化时，必须覆盖所有适用店铺，不能只改一半。四店之间的品牌、语言、域名、SEO 文案、图片资产和客户数据必须隔离。

## 0. 文案与 SEO 变更规则

上线前必须先比对当前线上 release / 站点负责人已确认的最新批准基线与本次待上线代码。没有站点负责人明确允许，不得随意改动网站文案、SEO 文案、TDK、Hero 文案、CTA、导航、Footer、Policy、FAQ、目录页、套餐页、工具页或结构化数据里的对外描述。

- [ ] 上线前对比当前线上 release / 已批准基线与本次待上线代码中的客户可见文案。
- [ ] 上线前对比 `data/platform-state.json`、主题模板、同步脚本、迁移脚本、Postgres 同步脚本和发布快照中的文案差异。
- [ ] 如果 SEO `title`、`description`、`keywords`、canonical、OG/Twitter、JSON-LD、H1/H2/H3 或页面正文有变化，必须列出旧值、新值、文件位置、页面路径和变更原因。
- [ ] 如果原来正常的文案被改动，必须把改动点列出来并等待站点负责人确认；未确认前不得上线。
- [ ] 如果只是技术修复但引入了文案差异，也按文案变更处理，不能合并进“性能优化”“SEO SSR 更新”“同步脚本修复”等笼统上线说明里。
- [ ] 本清单只保留规则与当前批准值，不记录逐次审核结论或历史检测结果。

### MyDreamShoots 首页文案锁定基线

MyDreamShoots 首页 `/` 的当前线上已批准文案已锁定。除非站点负责人明确要求修改首页文案，否则不得私自修改、切换版本、从旧 JSON 反向导入、运行覆盖脚本，或把线上数据库 `published` / 最新发布快照回退到其他版本。

锁定备份文件：`docs/content-locks/mydreamshoots-homepage-approved.json`

锁定来源：Postgres `site_dreamshoot` 的首页 `ThemePage.publishedJson`，并包含 guard 用于页面 SEO 对比的 `ThemeSettings.publishedJson` 记录。

锁定时间：`2026-08-08T00:00:00.000+08:00`

锁定指纹：

| 范围 | SHA-256 |
| --- | --- |
| 首页完整 `publishedJson` | `c6c1aa6ea1f25a7a25b80ad4f0778e1269a35bfb0dae5e86e8e634e870c284c1` |
| 首页可见文案记录 | `8eed023078ba3b3e800f90bde385e11b43de10cf45ad00ea13e689cef46123ad` |

当前批准的首页关键文案：

| 字段 | 当前批准值 |
| --- | --- |
| SEO title | `Professional AI Photo Generator Online - MyDreamShoots` |
| SEO description | `Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.` |
| SEO keywords | `Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot` |
| Hero badge | `AI Headshot Generators` |
| Hero headline | `Upload selfies and create your own AI model - Professional headshots without a studio.` |
| Hero body | `upload a few selfies and it generates photo-realistic couple, wedding, engagement, and boudoir photos that keep your real facial features. It doesn't need any skills, Turn ideas into videos instantly,just an idea that can add life to your images and make them in a motion. saving all your time & money. So, don't wait, create now! Private by default: your uploads stay private in your signed-in account.` |
| Hero primary CTA | `Create Now` |
| Hero secondary CTA | `Headshot Generator` |
| Auth card headline | `Generate your custom AI album Transform your favorite moments into professional-grade couple photos and stunning holiday memories.` |
| Auth ribbon | `Plans start at $24.50/month` |
| Auth primary action | `Continue with Google` |
| Auth email submit | `Create my first photo set with Email` |

上线硬规则：

- [ ] 上线前必须执行 `npm run guard:mydreamshoots-content`；该命令会同时比对数据库 `published`、最新 `ThemePublication.snapshot`、线上 HTML 和本锁定基线。
- [ ] 常规上线、构建、同步、修复、迁移不得传 `--skip-homepage-lock`。
- [ ] 如果 guard 报 `homepage-lock-*` 失败，默认判定为未批准首页文案漂移，必须停止上线。
- [ ] 只有站点负责人明确要求修改首页文案时，才能先更新线上 draft、发布生成新的 published，再重新生成并提交本锁定备份。
- [ ] 任何从 `data/platform-state.json`、主题模板、旧发布快照或同步脚本导入首页内容的动作都视为覆盖操作，不能作为普通 deploy/build 步骤运行。

## 1. TDK 检查

上线前需要确认正常两个 `.com` 店铺的 `title`、`description`、`keywords` 已维护成功，并且线上页面源代码中展示的内容与下方一致。两个西班牙 `.eu` 店铺需要按 AIdreamshoots / AIdreamcapes EU 独立维护西班牙语 TDK，不能直接复用 `.com` 站文案。

以下两组 TDK 是当前唯一批准基线；线上数据库、发布快照、模板默认值和同步脚本必须与此一致，其他版本一律视为待修正状态。

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
  `Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.`
- [ ] `keywords` 正确：
  `Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot`

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

### 店铺标题艺术字规则

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
