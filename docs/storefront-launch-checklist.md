# 店铺上线检查清单

适用店铺：

- MyDreamShoots：`www.mydreamshoots.com`
- AIdreamcapes：`www.aidreamcapes.com`
- AIdreamshoots：`aidreamshoots.eu`
- AIdreamcapes EU：`aidreamcapes.eu`

固定规则：后续展开两个西班牙 `.eu` 店铺时，不得影响正常两个 `.com` 店铺；做功能优化、路由修复、菜单/分类/工具修复、性能优化、SEO 结构优化时，必须覆盖所有适用店铺，不能只改一半。四店之间的品牌、语言、域名、SEO 文案、图片资产和客户数据必须隔离。

## 0. 文案与 SEO 变更审批

上线前必须先比对旧网站已批准文案代码和本次新上传文案代码。没有站点负责人明确允许，不得随意改动网站文案、SEO 文案、TDK、Hero 文案、CTA、导航、Footer、Policy、FAQ、目录页、套餐页、工具页或结构化数据里的对外描述。

- [ ] 上线前对比当前线上 release / 已批准基线与本次待上线代码中的客户可见文案。
- [ ] 上线前对比 `data/platform-state.json`、主题模板、同步脚本、迁移脚本、Postgres 同步脚本和发布快照中的文案差异。
- [ ] 如果 SEO `title`、`description`、`keywords`、canonical、OG/Twitter、JSON-LD、H1/H2/H3 或页面正文有变化，必须列出旧值、新值、文件位置、页面路径和变更原因。
- [ ] 如果原来正常的文案被改动，必须把改动点列出来并等待站点负责人确认；未确认前不得上线。
- [ ] 如果只是技术修复但引入了文案差异，也按文案变更处理，不能合并进“性能优化”“SEO SSR 更新”“同步脚本修复”等笼统上线说明里。
- [ ] 上线记录里必须保留“文案差异审核结论”：无差异 / 已批准差异 / 阻断上线。

### 2026-08-07 MyDreamShoots 首页 CTA 审核记录

问题：`2026-08-06` 的 `Deploy latest storefront and SEO SSR updates` 同步中，MyDreamShoots 首页 hero 主按钮从已批准文案 `Create Now` 被改成 `Create my first photo set`。根因是 `data/platform-state.json` 的发布态页面数据和 `scripts/rectify-mydreamshoots-page-change-doc.mjs` 中的定向修复逻辑覆盖了模板里的 CTA。

修复要求：

- MyDreamShoots 首页 hero 主 CTA 固定为 `Create Now`，除非站点负责人再次明确批准变更。
- 上线前必须检查 MyDreamShoots 首页 `/` 的 `hero_cta_primary.settings.label`，确保 draft、published 和发布快照一致。
- 后续同步、SEO SSR、Postgres 修复、主题迁移或数据导入脚本不得在未记录差异并获得确认的情况下改动该 CTA。

本次批准的修复差异：

| 页面 | 字段 | 旧异常值 | 修复后值 | 结论 |
| --- | --- | --- | --- | --- |
| MyDreamShoots `/` | `hero_cta_primary.settings.label` | `Create my first photo set` | `Create Now` | 已按站点负责人要求恢复 |

### 2026-08-07 SEO fingerprint 优化上线记录

审批结论：本次差异用于处理“历史 SEO 文案相似度待审批项”，允许改动范围仅限两站套餐覆盖博客页 SEO TDK、重复 workflow 小节文案和重复 credit 卡片标题。MyDreamShoots 首页 TDK、Hero H1、Hero 正文、Hero 主 CTA `Create Now` 不在本次改动范围，已复核未变。

说明：此前中间审核里出现的 `changed: 39` 是脚本按“变更记录/字段”统计出的数量，不是第 39 行或 39 个文件；最终上线以本节列出的实际差异为准。

本次未变更的已批准首页文案：

| 页面 | 字段 | 当前值 | 结论 |
| --- | --- | --- | --- |
| MyDreamShoots `/` | `title` | `Professional AI Photo Generator Online - MyDreamShoots` | 未改动 |
| MyDreamShoots `/` | `description` | `Create sports fan photos, VIP-style portraits, Christmas group photos, Thanksgiving portraits, and Halloween party albums from your selfies with MyDreamShoots.` | 未改动 |
| MyDreamShoots `/` | `keywords` | `Dream Shoots,Sports Fan Photos,VIP Style Portraits,Christmas Group Photos,Thanksgiving Photos,Halloween Party Photos,AI Photo Generator` | 未改动 |
| MyDreamShoots `/` | Hero 主 CTA | `Create Now` | 未改动 |

本次 SEO TDK 差异：

| 范围 | 页面数量 | 字段 | 旧规则 | 新规则 | 原因 |
| --- | ---: | --- | --- | --- | --- |
| MyDreamShoots 套餐覆盖博客 `/blog/*-photo-package-guide` | 28 | `title` / `description` / `keywords` | `Plan {Package} in MyDreamShoots: choose approved portraits, compare fit, review credit cost, and open the private gallery before downloads.` 等泛化模板 | 使用套餐自身描述生成 `private AI photo guide` 标题、差异化搜索描述和 source-photo/private-gallery keywords | 降低跨套餐 SEO 指纹相似度，保留英文客户可见文案 |
| Aidreamcapes 套餐覆盖博客 `/blog/*-photo-package-guide` | 28 | `title` / `description` / `keywords` | `Plan {Package} in Aidreamcapes: choose approved portraits, compare fit, review credit cost, and open the private gallery before downloads.` 等泛化模板 | 使用 fan/holiday/private album 语义生成差异化标题、描述和 permission-safe keywords | 降低跨套餐 SEO 指纹相似度，保留品牌隔离 |

涉及页面清单：

| 店铺 | 页面 |
| --- | --- |
| MyDreamShoots | `/blog/creator-portraits-photo-package-guide`, `/blog/fashion-editorial-photo-package-guide`, `/blog/product-style-photo-package-guide`, `/blog/profile-cards-photo-package-guide`, `/blog/social-cards-photo-package-guide`, `/blog/anime-avatar-photo-package-guide`, `/blog/wedding-portraits-photo-package-guide`, `/blog/desi-wedding-photo-package-guide`, `/blog/indian-wedding-photo-package-guide`, `/blog/engagement-photo-package-guide`, `/blog/valentine-photos-photo-package-guide`, `/blog/cyberpunk-photo-package-guide`, `/blog/gala-photos-photo-package-guide`, `/blog/mafia-photo-package-guide`, `/blog/nature-photo-package-guide`, `/blog/outdoor-creator-scenes-photo-package-guide`, `/blog/boudoir-photo-package-guide`, `/blog/hairstyle-photo-package-guide`, `/blog/virtual-try-on-photo-package-guide`, `/blog/world-cup-fan-photos-photo-package-guide`, `/blog/ai-video-add-ons-photo-package-guide`, `/blog/magic-upscaler-photo-package-guide`, `/blog/professional-headshots-photo-package-guide`, `/blog/christmas-couple-photo-package-guide`, `/blog/christmas-photos-photo-package-guide`, `/blog/holiday-photo-package-guide`, `/blog/halloween-party-photos-photo-package-guide`, `/blog/thanksgiving-group-photos-photo-package-guide` |
| Aidreamcapes | `/blog/private-fan-scene-album-photo-package-guide`, `/blog/game-day-group-portraits-photo-package-guide`, `/blog/premiere-flash-portraits-photo-package-guide`, `/blog/christmas-group-album-photo-package-guide`, `/blog/backstage-meetup-portraits-photo-package-guide`, `/blog/creator-supporter-photo-wall-photo-package-guide`, `/blog/fan-keepsake-card-set-photo-package-guide`, `/blog/stadium-night-fan-set-photo-package-guide`, `/blog/tunnel-entrance-fan-portraits-photo-package-guide`, `/blog/championship-watch-party-album-photo-package-guide`, `/blog/spotlight-couple-portrait-set-photo-package-guide`, `/blog/vip-arrival-photo-set-photo-package-guide`, `/blog/award-night-keepsake-album-photo-package-guide`, `/blog/holiday-party-photo-wall-photo-package-guide`, `/blog/cozy-card-portrait-set-photo-package-guide`, `/blog/winter-fan-greeting-album-photo-package-guide`, `/blog/autumn-host-photo-story-photo-package-guide`, `/blog/thanksgiving-keepsake-table-set-photo-package-guide`, `/blog/gratitude-group-portrait-album-photo-package-guide`, `/blog/friendsgiving-memory-set-photo-package-guide`, `/blog/halloween-party-portrait-set-photo-package-guide`, `/blog/haunted-premiere-portrait-set-photo-package-guide`, `/blog/costume-cast-photo-album-photo-package-guide`, `/blog/spooky-fan-card-portraits-photo-package-guide`, `/blog/birthday-fan-moment-set-photo-package-guide`, `/blog/family-occasion-portrait-album-photo-package-guide`, `/blog/seasonal-celebration-photo-set-photo-package-guide`, `/blog/new-year-countdown-group-album-photo-package-guide` |

示例对比：

| 页面 | 旧 title / description | 新 title / description |
| --- | --- | --- |
| MyDreamShoots `/blog/creator-portraits-photo-package-guide` | `Creator Portraits guide for MyDreamShoots private galleries` / `Plan Creator Portraits in MyDreamShoots: choose approved portraits, compare fit, review credit cost, and open the private gallery before downloads.` | `Creator Portraits private AI photo guide | MyDreamShoots` / `Generate fresh profile portraits for newsletters, landing pages, thumbnails, media kits. Review credit cost, source quality, and private downloads.` |
| MyDreamShoots `/blog/product-style-photo-package-guide` | `Product Style guide for MyDreamShoots private galleries` / `Plan Product Style in MyDreamShoots: choose approved portraits, compare fit, review credit cost, and open the private gallery before downloads.` | `Product Style private AI photo guide | MyDreamShoots` / `Plan product-style visuals with lifestyle context, creator framing, and simple campaign direction. Review credit cost, source quality, and private downloads.` |
| Aidreamcapes `/blog/private-fan-scene-album-photo-package-guide` | `Private Fan-Scene Album guide for Aidreamcapes private galleries` / `Plan Private Fan-Scene Album in Aidreamcapes: choose approved portraits, compare fit, review credit cost, and open the private gallery before downloads.` | `Private Fan-Scene Album planning guide | Aidreamcapes` / `Build a private album with fan meetup atmosphere, poster-wall styling. Review credit cost, approved uploads, and private album delivery.` |
| Aidreamcapes `/blog/game-day-group-portraits-photo-package-guide` | `Game-Day Group Portraits guide for Aidreamcapes private galleries` / `Plan Game-Day Group Portraits in Aidreamcapes: choose approved portraits, compare fit, review credit cost, and open the private gallery before downloads.` | `Game-Day Group Portraits private album guide | Aidreamcapes` / `Create supporter group photos with arena glow, team-color styling notes. Review credit cost, approved uploads, and private album delivery.` |

本次客户可见正文差异：

| 范围 | 旧文案 | 新文案 | 原因 |
| --- | --- | --- | --- |
| MyDreamShoots mobile workflow 标题 | `Mobile workflow preview for MyDreamShoots.` | `MyDreamShoots mobile photo workflow preview.` | 避免两站重复句式 |
| Aidreamcapes mobile workflow 标题 | `Mobile workflow preview for Aidreamcapes.` | `Aidreamcapes mobile private album preview.` | 避免两站重复句式 |
| 两站 mobile workflow 副标题 | `See the image tutorial and video tutorial side by side in a vertical phone layout.` | MyDreamShoots: `Compare image setup and motion-preview steps in a vertical phone view.` / Aidreamcapes: `Compare portrait intake and album review steps in a vertical phone view.` | 避免跨站重复正文 |
| MyDreamShoots credit 卡片标题 | `Review credits first` | `Check credits before generation` | 避免跨站重复正文 |
| Aidreamcapes credit 卡片标题 | `Review credits first` | `Confirm album credits first` | 避免跨站重复正文 |

本次技术守护：

- `smoke:storefront-seo-fingerprint` 不再把不同 slug 的 article 页面互相比对为同页，避免跨套餐博客误报。
- `/robots.txt` 增加安全头、短缓存和 `Vary: Host, X-Forwarded-Host`，并纳入 SEO indexing / security smoke。
- `smoke:security-baseline` 在 legacy reset 禁用且本地 Lumen 关系表 fixture 不可重置时，会明确跳过有状态 fixture 检查；安全头和 robots 安全头仍必须通过。

本次本地上线检查结果：

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run smoke:dreamshoot-blog-content` | 通过，`checkCount: 1858` |
| `npm run smoke:storefront-seo-fingerprint` | 通过，`seoRecords: 122`、`visibleTextRecords: 4114` |
| `npm run smoke:mydreamshoots-seo-indexing` | 通过 |
| `npm run audit:domains` | 通过 |
| `npm run audit:dreamshoot` | 通过 |
| 客户前台中文扫描 | 通过，无命中 |
| 旧重复文案扫描 `Mobile workflow preview for` / `See the image tutorial and video tutorial` / `Review credits first` | 通过，无命中 |
| MyDreamShoots 首页 TDK / Hero CTA 数据核验 | 通过，CTA 为 `Create Now` |
| `npm run smoke:storefront-public-routes` | 通过 |
| `npm run smoke:storefront-sitemap-directory-coverage` | 通过，MyDreamShoots `117/110`、Aidreamcapes `117/117`，缺失 0 |
| `npm run smoke:storefront-head-title-order` | 通过，两个 `.com` 首页 `titleIndex: 0` |
| `npm run smoke:public-seo-policy` | 通过 |
| `npm run smoke:public-seo-ssr` | 通过，四站 desktop/mobile `sectionApiRequests: 0` |
| `npm run smoke:storefront-watermarks` | 通过 |
| `npm run audit:storefront-watermarks -- --disk-only` | 通过，`issueCount: 0` |
| `git diff --check` | 通过 |
| `npm run lint` | 通过，保留既有 warning：`scripts/sync-mydreamshoots-public-content-postgres.mjs:271` unused `records` |
| `npm run build` | 通过；build 后已恢复 `next-env.d.ts` 和 `tsconfig.json` 的构建副作用 |
| `SMOKE_BASE_URL=http://127.0.0.1:3002 npm run smoke:security-baseline` | 通过安全头与 robots 安全头；有状态 fixture 项因本地关系表 reset 禁用而明确 skip |

上线结论：符合本清单“文案与 SEO 变更审批”规则。除本节列出的已批准差异外，不允许夹带其他客户可见文案或 SEO TDK 改动。

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

本轮把水印放到后台批处理层，而不是生成层。公开展示的图片 / 视频通过后台按钮或 CLI 统一刷新，前台展示版本带低可见度站点域名水印；客户上传原件、生成结果和工作区素材保持干净。

检查要求：

- `public/assets/...` 里被前台展示的图片 / 视频统一由 `batchWatermarkSitePublicMedia` 或 `npm run watermark:storefront-public-media` 处理，右下角使用站点域名低透明水印。
- MyDreamShoots 使用 `myDreamshoots.com`，AIdreamcapes 使用 `Aidreamcapes.com`。
- `.com` 店铺的生成结果、用户上传、下载预览和工作区访问不再自动打水印。
- 旧的公开素材必须先从 clean release 恢复无明显水印源文件，再用后台按钮 `刷新展示水印` 或 `npm run watermark:storefront-public-media -- --restore-from=<clean-release>` 重刷，避免明显水印与透明水印叠加。
- `public/assets/dreamshoot` 非品牌公开素材、`public/assets/sites/site_aidreamcapes` 非品牌公开素材、以及对应 `.eu` 公开素材均使用 `20260802-subtle-watermark30` 标记，默认透明度 `0.3`；品牌 logo/icon 不进批处理。
- 上线前执行 `npm run watermark:storefront-public-media -- --dry-run`，如果公开素材已刷新完成，应返回 `changed: 0` 且 `failures: []`。
- 上线前执行 `npm run audit:storefront-watermarks`，同时检查本地公开素材 marker 和两个 `.com` storefront 实际 DOM 引用的图片/视频 URL；报告中的 `issueCount` 必须为 `0`。

本轮验证：

- `npm run typecheck`
- `npm run smoke:storefront-watermarks`
- `npm run smoke:dreamshoot-homepage-showcase`
- `npm run smoke:fan-holiday-storefront-theme`
- `npm run smoke:storefront-navigation-data`
- `npm run smoke:storefront-sitemap-directory-coverage`
- `npm run watermark:storefront-public-media -- --dry-run`

## 2026-08-07 最新 release 上线审核记录

本轮上线基线为线上 release `d5918d30`，最终 GitHub 提交为 `d65cfc60`，线上当前 release 为：
`/www/wwwroot/mydreamshoots.com/releases/d65cfc60-logo-fix-202608071635`。

### 文案差异审核结论

- **已按旧值恢复**：MyDreamShoots FAQ/首页 showcase 的 `hero_1.settings.imageCaption` 从未经确认的新值
  `Generate your custom AI album Transform your favorite moments into professional-grade couple photos and stunning holiday memories.`
  恢复为旧值
  `Upload selfies and create your own AI model - Professional headshots without a studio.`
- **无 CTA 新增变更**：MyDreamShoots 首页 Hero 主 CTA 的 draft、published、发布快照和线上 SSR 均为 `Create Now`。
- **无 TDK 变更**：两个 `.com` 店铺的 title、description、keywords 与本清单固定值一致。
- Header / 登录转化区域仍存在其他既有 `Create my first photo set` 文案；本轮没有擅自扩展修改范围，避免未经批准的文案变更。
- 结论：**已批准差异 / 旧值恢复，可上线**。未经站点负责人确认的 SEO fingerprint 相似文案不纳入本轮修改。

### 本轮代码与部署变更

- `9554dca9`：公开媒体水印批处理、marker 和上线 smoke 修复。
- `eed86c9f`：恢复已批准旧文案、修复 DreamShoots 页面媒体引用和上线审计规则。
- `52b721d2`：服务器无法用 sharp 渲染 SVG 文字时自动降级到 ffmpeg。
- `d65cfc60`：可信 logo 保留已有 `.png/.jpg` 资源格式，避免自动改写为不存在的 `.webp`。

### 上线前与线上验证

- `npm run typecheck`、`npm run build`、`npm run audit:domains`、`npm run audit:dreamshoot`：通过。
- `npm run smoke:storefront-watermarks`：通过。
- `npm run watermark:storefront-public-media -- --dry-run`：`changed: 0`，`failures: []`。
- `npm run audit:storefront-watermarks -- --disk-only`：`issueCount: 0`。
- 线上 live watermark 抽样：两站各 1 个页面，`missingWatermarkUrls: []`、`mediaRequestErrors: []`、`issueCount: 0`。
- 线上 sitemap：MyDreamShoots 117 条、AIdreamcapes 118 条；目录缺失 0、旧路径 0、跨站域名 0。
- 线上首页 TDK、`<title>` 首位、SSR 无 `/storefront-section` 占位、`html/body translate="yes"`：通过。
- MyDreamShoots 首页 trusted logo 29 个线上资源全部返回 200。
- `mydreamshoots.service`：active；nginx 配置测试：successful。

### 待负责人确认项

`npm run smoke:storefront-seo-fingerprint` 仍会报告两个站点博客 SEO 文案之间的高相似度。该检查涉及现有 SEO 文案调整，按照本清单审批规则，本轮不擅自改动；如需消除该项，必须先列出旧值、新值、页面路径并获得站点负责人批准。
