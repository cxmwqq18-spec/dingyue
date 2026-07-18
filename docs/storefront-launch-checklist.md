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
  `Turn your selfies into stunning couple photos in seconds with MyDreamShoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.`
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
| Footer 最底部链接 | [x] | [x] | 在版权行附近新增 `Children's Privacy` 与 `State Privacy Rights`，链接带 `rel="nofollow"`。 |
| Policy 页面互链 | [x] | [x] | Policy 内容页底部提供儿童隐私和州隐私互链；儿童隐私正文也明确指向 `State Privacy Rights`，覆盖 California 与其他美国州隐私请求入口。 |
| Policy 正文 SSR | [x] | [x] | `policy_content` 不再走懒加载；儿童隐私 / 州隐私正文可在首屏 HTML/DOM 中直接读取，便于 Google 和 AI 理解。 |
| 结构化公司信息 | [x] | [x] | Organization JSON-LD 已写入 legalName、email、telephone、PostalAddress、taxID，并增加 Legal entity、Tax ID、U.S. state entity jurisdiction、Entity type 标识。 |
| 实体清单 / Google-AI 理解提示 | [x] | [x] | 州隐私页和本文档均写入公司主体、州全称、州缩写、地址、电话、邮箱、税号，便于搜索引擎和 AI 系统识别运营实体。 |
| SECURE / GUARD 联邦法案监测 | [x] | [x] | SECURE Data Act 与 GUARD Financial Data Act 记录为拟议联邦隐私法案监测项；若后续生效，再更新为强制执行政策。 |
| 合规来源记录 | [x] | [x] | 参考 FTC COPPA、California OAG / CPPA privacy rights、USPS 州缩写、House Financial Services Committee 2026-04-22 法案介绍；WY = Wyoming，DE = Delaware。 |

公司资料记录：

| 站点 | 公司 | 地址 | 州名说明 | 电话 | 邮箱 | 企业税号 |
| --- | --- | --- | --- | --- | --- | --- |
| `www.aidreamcapes.com` | `BLYDEYUS INC` | `30 N GOULD ST STE R,SHERIDAN,WY 82801` | `WY` = `Wyoming` | `(+1)307-310-3014` | `support@aidreamcapes.com` | `41-5317529` |
| `www.mydreamshoots.com` | `MRNARUEBET LLC` | `8 THE GREEN STE B,DOVER,DE 19901` | `DE` = `Delaware` | `(+1)302-200-5780` | `support@mydreamshoots.com` | `98-1926243` |

实体清单 / Entity inventory:

| Domain | Brand | Legal entity | Entity type / jurisdiction | Address | Phone | Support email | Tax identifier | Customer policy pages |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `www.aidreamcapes.com` | `Aidreamcapes` | `BLYDEYUS INC` | `Wyoming (WY) entity` | `30 N GOULD ST STE R,SHERIDAN,WY 82801` | `(+1)307-310-3014` | `support@aidreamcapes.com` | `Tax ID: 41-5317529` | `/children-privacy`, `/state-privacy` |
| `www.mydreamshoots.com` | `MyDreamShoots` | `MRNARUEBET LLC` | `Delaware (DE) limited liability company` | `8 THE GREEN STE B,DOVER,DE 19901` | `(+1)302-200-5780` | `support@mydreamshoots.com` | `EIN / Tax ID: 98-1926243` | `/children-privacy`, `/state-privacy` |

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
