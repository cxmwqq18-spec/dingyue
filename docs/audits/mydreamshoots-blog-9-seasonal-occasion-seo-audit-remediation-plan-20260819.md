# MyDreamShoots 九页季节与场合博客 SEO 审计及整改方案

审计日期：2026-08-19  
审计范围：MyDreamShoots 线上 9 个博客 URL 及其公开产品 CTA、站点 robots/sitemap、SSR HTML、JSON-LD、OG/Twitter 元数据。  
审计方法：安装并依据 GitHub `JeffLi1993/seo-audit-skill` 的 `seo-audit` / `seo-audit-full` 工作流，补充仓库代码、产品 taxonomy、GET/HEAD 路由、正文 5-gram 相似度和 sitemap inventory 检查。

### 2026-10-04 线上复核补充

本方案列出的 9 个 URL 与《九个博客页面 SEO 审查与整改方案》列出的另外 9 个 URL，目前 GET 和 HEAD 均返回 404；18 个地址均不在当前 sitemap，也不在当前 93 条 LivePage 数据中（其中 `/blog/` 仅有 3 条已发布页面）。因此，这两份 8 月页面级内容整改计划当前对应的是已下线 URL，不能按“整改已完成”验收。当前 sitemap 的 117 页内链抓取没有死链，但这 18 个旧 URL 不属于该抓取范围；其 Google 收录状态未通过 Search Console 核验。若仍要保留这些文章，应先恢复页面、加入 sitemap 和相关正文链接，再按本计划验收；若文章已退役，应记录退役或语义适配的跳转决定。

## 结论摘要

这 9 页当前不是 9 个真正独立的内容实体，而是同一篇“photo package category”模板的主题名替换版本。页面的 GET 请求目前返回 200，但 HEAD 请求全部返回 308，并指向旧的聚合博客页；其中部分旧目标会继续返回 404。这会让搜索引擎、链接检查器和缓存层看到不一致的路由信号。

最严重的问题按优先级排列：

1. **P0 路由与索引信号冲突**：9 个目标 URL 的 GET 为 200，但 HEAD 为 308 到旧主题页；`boudoir` 的 HEAD 目标 `/blog/creative-photo-package-guide` 当前为 404。源代码中仍存在 9 个旧博客 redirect map 条目。
2. **P0 内容重复与实体混淆**：9 页正文各有 17 段、约 728–748 个正文词，正文 5-gram Jaccard 为 `0.763–0.814`；共同段落、标题顺序、FAQ 和 CTA 结构基本相同。
3. **P0 产品 CTA 错配**：Christmas Couple 指向 `nightlife`，Desi Wedding 指向 `cannes`，Indian Wedding 指向 `rich-lifestyle`。这些路由虽返回 200，但页面实体与博客主题不一致。
4. **P1 元数据未表达完整搜索意图**：9 页 title 都是 `X private AI photo guide | myDreamshoots`，H1 都是 `X: how to plan this myDreamshoots photo package category`；title、description、H1 没有稳定覆盖 `photo package/photos` 以及页面的具体用途。
5. **P1 站点级 Schema/社交信号不完整**：BlogPosting 可解析且必填字段存在，但 Organization 缺少 `logo`；9 页都缺少 `og:type=article`。BlogPosting `dateModified` 仍为 2026-07-28，而 sitemap `lastmod` 是 2026-08-11 的部署时间，更新时间语义不一致。
6. **P1 内链模板污染**：每页都链接到 `AI Video Add-ons`、`Anime Avatar` 和 `Profile Cards`，且 Profile Cards 的锚文本被错误输出为 `Open Avatar theme`。这些链接不服务于季节/婚礼/场合主题，也会继续放大旧模板实体。

## 线上证据

### 访问与路由

| 检查 | 结果 | 证据 |
|---|---|---|
| 9 个 URL GET | 9/9 返回 200，无 GET redirect | `curl -D - -o /dev/null` |
| 9 个 URL HEAD | 9/9 返回 308 | `curl -I` |
| HEAD 目标 | 旧博客聚合页 | Boudoir → `/blog/creative-photo-package-guide`；Christmas Couple/Christmas Photos/Halloween/Holiday/Thanksgiving → `/blog/seasonal-photo-package-guide`；Desi/Indian Wedding → `/blog/cultural-wedding-photo-guide`；Engagement → `/blog/couple-photo-package-guide` |
| Boudoir 旧目标 | 404 | `GET /blog/creative-photo-package-guide` 返回 404 |
| robots.txt | 200，可访问，声明 sitemap | `Sitemap: https://www.mydreamshoots.com/sitemap.xml` |
| sitemap.xml | 200，可解析，9 个 URL 均在其中 | 9 个 URL 均有 `<loc>` |
| Sitemap lastmod | 同一部署批次时间 | 9 页均为 2026-08-11T16:18:xxZ，未体现实际内容更新时间 |

审计脚本对线上域名的自动抓取被运行环境的 DNS 保留地址 `198.18.0.175` SSRF 保护拦截，因此脚本的结构化校验使用已保存的真实线上 HTML；HTTP 状态与响应头以 `curl` 直接证据为准。

### 页面级检查结果

| 页面 | 当前 H1 | title 长度 | description 长度 | 5-gram 正文相似度风险 | 当前主 CTA | 判断 |
|---|---|---:|---:|---:|---|---|
| [Boudoir](https://www.mydreamshoots.com/blog/boudoir-photo-package-guide) | `Boudoir: how to plan this myDreamshoots photo package category` | 46 | 153 | 0.779–0.799 | `/ai-image-generation/boudoir` | 路由可用，但内容和内链为通用模板；需补成人、同意、非露骨边界 |
| [Christmas Couple](https://www.mydreamshoots.com/blog/christmas-couple-photo-package-guide) | `Christmas Couple: how to plan this myDreamshoots photo package category` | 55 | 147 | 0.768–0.814 | `/ai-image-generation/nightlife` | CTA 实体错误，优先修复 |
| [Christmas Photos](https://www.mydreamshoots.com/blog/christmas-photos-photo-package-guide) | `Christmas Photo: how to plan this myDreamshoots photo package category` | 54 | 156 | 0.768–0.812 | `/ai-image-generation/christmas-photo` | 主题接近但 H1 使用单数，未区分家庭/群像/卡片意图 |
| [Desi Wedding](https://www.mydreamshoots.com/blog/desi-wedding-photo-package-guide) | `Desi Wedding: how to plan this myDreamshoots photo package category` | 51 | 135 | 0.765–0.814 | `/ai-image-generation/cannes` | CTA 实体错误；需要文化语境与授权边界 |
| [Engagement](https://www.mydreamshoots.com/blog/engagement-photo-package-guide) | `Engagement: how to plan this myDreamshoots photo package category` | 49 | 135 | 0.778–0.798 | `/ai-image-generation/engagement-photo` | CTA 可用，但缺 proposal、announcement、ring/hand review 等专属内容 |
| [Halloween Party](https://www.mydreamshoots.com/blog/halloween-party-photos-photo-package-guide) | `Halloween Photo: how to plan this myDreamshoots photo package category` | 54 | 145 | 0.765–0.812 | `/ai-image-generation/halloween-photo` | H1 丢失 party/group 意图；需 costume、party、group card 专属内容 |
| [Holiday](https://www.mydreamshoots.com/blog/holiday-photo-package-guide) | `Holiday: how to plan this myDreamshoots photo package category` | 46 | 157 | 0.783–0.799 | `/ai-image-generation/holiday` | 可作为宽泛季节页，但必须与 Christmas/Thanksgiving 拆清 |
| [Indian Wedding](https://www.mydreamshoots.com/blog/indian-wedding-photo-package-guide) | `Indian Wedding: how to plan this myDreamshoots photo package category` | 53 | 158 | 0.763–0.814 | `/ai-image-generation/rich-lifestyle` | CTA 实体错误；需准确表达 ceremony/textile/jewelry，而不是 luxury lifestyle |
| [Thanksgiving Group](https://www.mydreamshoots.com/blog/thanksgiving-group-photos-photo-package-guide) | `Thanksgiving Photo: how to plan this myDreamshoots photo package category` | 57 | 145 | 0.765–0.812 | `/ai-image-generation/thanksgiving-photo` | H1 丢失 group 意图；需 dinner-table、gratitude card、group crop 内容 |

机械检查中，9 页均有一个 H1、self canonical、可解析 BlogPosting、可访问首图且图片有 alt。问题不是“页面不存在”，而是实体、内容深度和索引信号互相矛盾。

## 主要发现

### P0-1：GET/HEAD 路由不一致，旧 redirect map 仍在生产逻辑中

**证据**：9 个博客 URL 的 GET 均为 200；同 URL 的 HEAD 均为 308。源代码 [page.tsx](/Users/a1/work/ai-project/dingyue/src/app/[...path]/page.tsx:68) 仍声明：

- `boudoir -> /blog/creative-photo-package-guide`
- `christmas-couple -> /blog/seasonal-photo-package-guide`
- `christmas-photos -> /blog/seasonal-photo-package-guide`
- `desi-wedding -> /blog/cultural-wedding-photo-guide`
- `engagement -> /blog/couple-photo-package-guide`
- `halloween-party-photos -> /blog/seasonal-photo-package-guide`
- `holiday -> /blog/seasonal-photo-package-guide`
- `indian-wedding -> /blog/cultural-wedding-photo-guide`
- `thanksgiving-group-photos -> /blog/seasonal-photo-package-guide`

`/blog/creative-photo-package-guide` 当前 GET 为 404，因此至少 Boudoir 存在明确的 `308 -> 404` 链路风险。即使浏览器 GET 因缓存/方法分支得到 200，HEAD 仍会让搜索工具、预取器、监控和部分 CDN 检查得到错误结论。

**影响**：URL 可能被 Google 视为旧主题的重复/替代页，链接权重无法稳定归属；HEAD 失败还会使发布前验收误判为成功。

**整改**：

1. 从 legacy blog redirect map 移除这 9 个 slug；保留真正需要迁移的旧 URL，不要把现有 canonical URL 当作 legacy alias。
2. 对 9 个 slug 分别执行 GET、HEAD、无跟随 redirect 检查，要求两种方法均 200、无 `Location`。
3. 清理 Cloudflare/Next/CDN 对旧 308 的缓存后再次验收；在缓存未清前，不能以本地代码通过代替线上通过。
4. 旧聚合页若仍有外链或历史收录，保留其自身 canonical；不要让新独立实体指回聚合页。

### P0-2：正文是模板换名，不是独立文章实体

**证据**：每页正文均有 17 段、约 728–748 个词，章节固定为：

1. `When X is the right fit`
2. `What to prepare before choosing it`
3. `How to compare X with nearby choices`
4. `Credit and private gallery planning`
5. `Details to review before download`
6. `Mistakes to avoid`
7. `A planning pass before you spend credits`
8. `X FAQ`

正文中 9 页共同出现大量完全相同段落，例如 `Prepare clear approved source portraits`、`The strongest X requests keep the brief...`、`Finished outputs belong in the signed-in private gallery first`、以及相同的三条 FAQ 答案。剔除站点导航和 footer 后，正文 5-gram Jaccard 仍为 `0.763–0.814`。

**影响**：页面之间的主题差异不足，容易形成 near-duplicate cluster；Christmas Couple/Christmas Photos/Holiday、Desi Wedding/Indian Wedding、Engagement/Christmas Couple 又存在明显相邻意图竞争。

**整改**：

- 禁止继续使用 category-name interpolation 模板；每个 slug 建立独立 article profile。
- profile 至少固定 `entityName`、`primaryKeyword`、`searchIntent`、`seoTitle`、`seoDescription`、`h1`、`targetHref`、`relatedLinks`、`imageAlt`、`authorUrl`、`reviewOwner`、`evidenceType`。
- 每篇正文首段直接回答该页意图；至少覆盖使用场景、源图片准备、专属比较、输出检查、版权/肖像/品牌边界、3 个以上专属 FAQ、1 个准确 CTA、2–4 条上下文相关文章或产品链接。
- 目标：正文 5-gram Jaccard `< 0.70`；若仍 `> 0.35`，smoke 输出人工复核警告。

### P0-3：CTA 与产品实体错配

**证据**：当前 CTA 路由均能返回 200，但三个映射明显不正确：

| 博客实体 | 当前 CTA | 实际页面实体 | 问题 |
|---|---|---|---|
| Christmas Couple | `/ai-image-generation/nightlife` | Nightlife | 夜生活/城市灯光不是 Christmas couple |
| Desi Wedding | `/ai-image-generation/cannes` | Cannes | 电影节红毯不是 Desi wedding |
| Indian Wedding | `/ai-image-generation/rich-lifestyle` | Rich Lifestyle | 奢华生活方式不是 Indian wedding ceremony |

这些错误由 [sync-mydreamshoots-theme-taxonomy.mjs](/Users/a1/work/ai-project/dingyue/scripts/sync-mydreamshoots-theme-taxonomy.mjs:99) 的 `legacySlugReplacements` 及其对应的 `sourceCategorySlug` 复用造成；产品路由状态为 200 不能证明实体正确。

**整改策略**：

| 页面 | 目标 CTA | 实施条件 |
|---|---|---|
| Boudoir | `/ai-image-generation/boudoir` | 已验证 200，页面实体一致 |
| Christmas Couple | 暂用 `/ai-image-generation`，锚文本 `Browse AI Image Generation` | 直到有 H1、canonical、页面正文都明确为 Christmas Couple 的公开路由；不得继续用 `nightlife` |
| Christmas Photos | `/ai-image-generation/christmas-photo` | 已验证 200，页面实体接近且为 Christmas photos |
| Desi Wedding | 暂用 `/ai-image-generation`，锚文本 `Browse AI Image Generation` | 直到有准确的 Desi Wedding 公开路由；不得继续用 `cannes` |
| Engagement | `/ai-image-generation/engagement-photo` | 已验证 200，页面实体一致 |
| Halloween Party | `/ai-image-generation/halloween-photo` | 已验证 200；页面正文需突出 party/group |
| Holiday | `/ai-image-generation/holiday` | 已验证 200，页面实体一致 |
| Indian Wedding | 暂用 `/ai-image-generation`，锚文本 `Browse AI Image Generation` | 直到有准确的 Indian Wedding 公开路由；不得继续用 `rich-lifestyle` |
| Thanksgiving Group | `/ai-image-generation/thanksgiving-photo` | 已验证 200；页面正文需突出 group |

若后续创建专属产品路由，必须先通过“GET/HEAD 200、canonical self、H1/实体一致、无旧 `/tools` 跳转”的门禁，再把 CTA 写入文章。

### P1-1：title/H1/description 没有覆盖真实搜索意图

现有 title 长度大多落在 46–57 字符的可接受区间，但长度合格不等于语义合格。所有 title 都把页面写成 `private AI photo guide`，没有表达 cards、group、proposal、ceremony、party 等用途；所有 H1 都暴露了模板句式 `how to plan this ... category`。

建议 metadata：

| 页面 | 建议 primary keyword | 建议 H1 | 建议 SEO title |
|---|---|---|---|
| Boudoir | `AI boudoir photos` | `How to Plan Tasteful AI Boudoir Photos for Private Portraits` | `AI Boudoir Photos: Private Portrait Guide | MyDreamShoots` |
| Christmas Couple | `Christmas couple photos` | `How to Plan Christmas Couple Photos for Cards and Keepsakes` | `Christmas Couple Photos for Cards and Keepsakes | MyDreamShoots` |
| Christmas Photos | `Christmas photos` | `How to Plan Christmas Photos for Cards and Family Albums` | `Christmas Photos for Cards and Family Albums | MyDreamShoots` |
| Desi Wedding | `AI Desi wedding photos` | `How to Plan AI Desi Wedding Photos for Celebrations and Albums` | `AI Desi Wedding Photos for Celebrations | MyDreamShoots` |
| Engagement | `AI engagement photos` | `How to Plan AI Engagement Photos for Proposals and Announcements` | `AI Engagement Photos for Proposals | MyDreamShoots` |
| Halloween Party | `Halloween party photos` | `How to Plan Halloween Party Photos for Costumes and Group Cards` | `Halloween Party Photos for Costumes and Cards | MyDreamShoots` |
| Holiday | `AI holiday photos` | `How to Plan AI Holiday Photos for Cards and Seasonal Profiles` | `AI Holiday Photos for Cards and Profiles | MyDreamShoots` |
| Indian Wedding | `AI Indian wedding photos` | `How to Plan AI Indian Wedding Photos for Ceremony Portraits` | `AI Indian Wedding Photos for Ceremony Portraits | MyDreamShoots` |
| Thanksgiving Group | `Thanksgiving group photos` | `How to Plan Thanksgiving Group Photos for Cards and Gatherings` | `Thanksgiving Group Photos for Cards | MyDreamShoots` |

Description 要写成 120–160 字符左右的完整句子，并同时说明输入、输出用途和边界。例如：

> Plan Thanksgiving group photos for cards and gatherings with clear source portraits, dinner-table composition, group-crop checks, permission review, and private output selection.

### P1-2：相邻主题必须显式拆分

整改正文时，不能只替换主题名；每页应有独立比较段：

| 页面 | 必须讲清的边界 |
|---|---|
| Boudoir | consenting adults、tasteful/non-explicit、私密下载、衣着/光线/身体边缘检查；不得上传未成年人或未经同意的人像 |
| Christmas Couple | 两人关系和 couple composition、节日卡片/礼物留白、情侣与朋友卡片；与 Christmas Photos 的群像、Holiday 的宽泛季节意图对比 |
| Christmas Photos | solo/couple/family/group 的 Christmas cards、装饰、冬季光线、卡片文字留白；与 Christmas Couple 和 Holiday 分开 |
| Desi Wedding | festive color、couple/family posing、album/announcement；避免把 Desi 当成单一固定仪式，不编造文化规则 |
| Engagement | proposal concept、ring/hand detail、announcement crop、情侣姿态；与 wedding ceremony 和 Christmas Couple 区分 |
| Halloween Party | costume/party/group card、戏剧化灯光、角色道具和品牌/IP边界；与泛 Holiday 区分 |
| Holiday | broad seasonal/year-end/winter use；明确 Christmas 与 Thanksgiving 何时更合适，避免成为所有节日页面的重复父页 |
| Indian Wedding | ceremony portrait、textile/jewelry、bridal/groom styling、family album；使用尊重且非刻板的文化表达 |
| Thanksgiving Group | dinner-table/group composition、gratitude cards、Friendsgiving/family-style album；与 Christmas group 和 Holiday 区分 |

### P1-3：内链需要从全站导航降为上下文集群

当前每页正文/相关文章区固定出现：

- `Open AI Video Add-ons theme`
- `Open Avatar theme`
- `Open Avatar theme`（实际为 Profile Cards URL）
- `Headshot Photo Package`

建议每页保留 3–5 条有效正文内链：1 条主产品 CTA、2–3 条相邻主题、最多 1 条 `/content` 或 `/about-us` 信任页。锚文本必须描述目标实体，例如：

- Christmas Photos ↔ Christmas Couple、Holiday、Thanksgiving Group
- Desi Wedding ↔ Indian Wedding、Engagement、Wedding Photo product
- Creator/Avatar 类页面不应自动出现在这 9 页的 related links 中

每个链接目标在发布前必须 GET/HEAD 可访问并且页面 H1 与锚文本实体一致。

### P1-4：Schema、OG、作者和更新时间需要统一

线上当前结构化数据：每页可解析 `Organization`、`WebSite`、`BreadcrumbList`、`BlogPosting` 四类 JSON-LD；BlogPosting 的 headline、datePublished、author、image、mainEntityOfPage 存在，BreadcrumbList 具备完整 position/name/item。需要修正：

1. Organization 补真实、可访问的绝对 logo URL；publisher 同样带 logo。
2. `author` 统一为经过确认的 MyDreamShoots 组织实体，或使用真实编辑者 Person；补 author URL，指向 `/about-us` 或 Editorial Policy。
3. BlogPosting `headline` 必须与 H1 完全一致；`mainEntityOfPage`、canonical、OG URL、sitemap loc 必须是同一 URL。
4. 保留每页一个 BlogPosting；FAQ 继续作为可见正文，不新增虚假 FAQPage。
5. 加上 `og:type=article`、`article:published_time`、`article:modified_time`、`og:image:alt`。
6. `dateModified` 只在正文/metadata/图片 alt/链接等真实变化时更新；sitemap `lastmod` 不应随每次部署统一刷新。

### P1-5：图片 alt 与尺寸需要主题化

当前 9 页首图均存在 alt，但部分 alt 与实体不足够一致：Boudoir alt 没有明确 boudoir/private 成人语境；Christmas Photos alt 写成 solo portrait；Engagement alt 没有 engagement 语义。首图 HTML 也没有稳定的 width/height。

建议：

- Boudoir：`Tasteful non-explicit boudoir-inspired adult portrait with soft editorial light and private album framing.`
- Christmas Couple：`Christmas couple portrait with warm festive light, cozy decor, and greeting-card composition.`
- Christmas Photos：`Christmas group portrait with festive decor, winter glow, and card-ready framing.`
- Desi Wedding：`Desi wedding-inspired couple portrait with festive color, ceremony atmosphere, and album-ready framing.`
- Engagement：`Engagement couple portrait with romantic light, ring-moment composition, and announcement-ready crop.`
- Halloween Party：`Halloween party portrait with costume styling, dramatic colored light, and group-card framing.`
- Holiday：`AI holiday portrait with warm seasonal styling, card-ready composition, and a flexible festive background.`
- Indian Wedding：`Indian wedding-inspired portrait with textile detail, ceremony light, and respectful celebration styling.`
- Thanksgiving Group：`Thanksgiving group portrait with warm dinner-table light, harvest color, and gratitude-card composition.`

以上文本仍需以实际图像可见内容为准；如果图像并未呈现对应构图，应该改 alt，而不是为了关键词强行描述。正文首图补 `width`/`height` 或稳定 aspect-ratio，避免 CLS。

## 实施计划

### 阶段 1：P0 路由、实体和数据模型

- 在 `scripts/sync-dreamshoot-blog-content.mjs` 中为这 9 个 slug 建立独立 article profiles。
- 新 profile 固定 `entityName`、`primaryKeyword`、`searchIntent`、`seoTitle`、`seoDescription`、`h1`、`targetHref`、`relatedLinks`、`imageAlt`、`authorUrl`、`reviewOwner`、`evidenceType`。
- 从 [page.tsx](/Users/a1/work/ai-project/dingyue/src/app/[...path]/page.tsx:68) 的 legacy blog redirect map 移除这 9 个 slug。
- 处理 GET/HEAD/redirect/cache 分支，确保 9 个 canonical URL 均返回 200；不得出现 `308 -> 404`。
- 修正 taxonomy alias：`christmas-couple`、`desi-wedding`、`indian-wedding` 不得借用 `nightlife`、`cannes`、`rich-lifestyle` 的展示实体。若没有准确的公开产品路由，使用 `/ai-image-generation` 作为 CTA，而不是误导性专属路由。

### 阶段 2：逐页内容重写

每篇至少包含：

- 首段直接回答搜索意图；
- 主题专属使用场景和不适合的场景；
- 输入图片准备要求；
- 主题专属 brief/构图/色彩/留白建议；
- 相邻主题比较；
- 输出质量检查；
- 版权、肖像、品牌、文化表达或成人内容边界；
- 3 个以上主题专属 FAQ；
- 1 个主产品 CTA；
- 2–4 条有语义的相关文章或产品链接。

删除旧模板句式：

- `Use X when X and Y are the nearest match`
- `The strongest X requests keep the brief...`
- `Prepare clear approved source portraits`
- 固定的 `AI Video Add-ons`、Avatar、Headshot 推荐
- `X: how to plan this myDreamshoots photo package category`

### 阶段 3：Schema、媒体和 sitemap

- 保留一个 BlogPosting；补 Organization/publisher logo、author URL、完整 BreadcrumbList。
- 补 article OG 字段和图片 alt；正文首图补尺寸。
- 统一 H1/headline/title 的实体语义。
- sitemap 只列可渲染、可索引的 self-canonical URL；`lastmod` 使用实际内容更新时间。

### 阶段 4：发布前验收

建议新增 `scripts/smoke-mydreamshoots-seasonal-occasion-blog-seo.mjs`，至少覆盖：

- 9 URL 的 GET/HEAD 均 200；无意外 redirect、soft 404、canonical mismatch；
- 9 页 title、H1、BlogPosting headline 唯一且实体一致；
- 正文 5-gram Jaccard `< 0.70`，高于 `0.35` 输出人工复核；
- 每页 3–5 条有效正文内链，目标 GET/HEAD 200；
- CTA 属于经过验证的准确产品路由；
- 每页恰好一个 BlogPosting；Organization、BreadcrumbList、BlogPosting JSON-LD 可解析；
- 图片 alt、OG image、sitemap lastmod 与页面主题一致；
- sitemap 只包含可渲染 canonical URL。

运行：

```bash
npm run typecheck
npm run build
npm run smoke:mydreamshoots-priority-blog-remediation
npm run smoke:mydreamshoots-seo-indexing
npm run smoke:mydreamshoots-media-seo-schema
npm run smoke:storefront-media-alt
npm run smoke:storefront-public-routes
npm run smoke:playwright-priority-blog
```

Playwright 需覆盖 `www.mydreamshoots.com` host、`/site/mydreamshoots` path、桌面端和 390px 移动端，并检查 title、H1、canonical、首图、CTA、JSON-LD、正文内链以及 GET/HEAD 响应。

### 阶段 5：发布后监控

- 先本地 dry-run 和本地数据库同步，生成内容快照后再发布。
- 发布后在 Google Search Console 检查 9 个 URL 的 Index status、Google-selected canonical、sitemap 处理、duplicate/soft 404。
- 第 7、14、28 天比较 impressions、clicks、CTR、平均排名及 query 实体是否正确。
- PageSpeed API key 配置后，再补移动端/桌面端 LCP、INP、CLS；本次审计不把未测性能当作已通过或已失败。

## 验收通过标准

整改完成的最低标准不是“页面能打开”，而是：

- 9 页 GET/HEAD 都 200，且不被 legacy redirect map 接管；
- 9 个实体有独立 H1、title、description、正文和 CTA；
- Christmas Couple、Desi Wedding、Indian Wedding 不再落到 Nightlife/Cannes/Rich Lifestyle；
- 9 页正文相似度低于阈值，且人工抽查确认每页有真实主题差异；
- Profile/Avatar、AI Video 等无关旧模板链接不再批量出现；
- BlogPosting、Organization、BreadcrumbList、OG article signal 完整且 URL 一致；
- sitemap lastmod 反映真实更新；
- GSC 发布后未出现新的 duplicate、soft 404 或错误 canonical。

## 限制与未验证项

本审计基于 2026-08-19 可公开访问的 HTML、HTTP 响应、robots/sitemap、JSON-LD、OG/Twitter 标签及仓库代码。未包含：Google Search Console 数据、真实 query/impression/click、服务器 crawl log、反向链接、竞品关键词基准、PageSpeed Insights/CWV 实测和生产数据库内部快照。PageSpeed API key 未配置，因此性能模块明确标记为未验证，不应据此做性能结论。
