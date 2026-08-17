# MyDreamShoots Google Official SEO Audit

审计日期：2026-08-16
适用站点：`https://www.mydreamshoots.com`
项目：`/Users/a1/work/ai-project/dingyue`
范围：只使用 Google Search Central、Google 官方 Search 文档更新页、web.dev 等 Google 一手资料，结合当前仓库的 SEO 实现和只读 smoke 检查。
变更边界：本次只新增本文件；未修改应用代码、数据库、测试脚本或其他文件。

## 结论摘要

MyDreamShoots 的技术 SEO 基础已经比较完整：当前仓库有 host-aware `robots.txt`、host-aware sitemap、迁移后的 `/ai-image-generation/...` 与 `/ai-video-generation/...` canonical 路由、SSR metadata、Product/ImageObject 等结构化数据，以及图片 sitemap。

但在 2026-08-16 的规范和质量检查口径下，不能把当前状态称为“全部 SEO 验收通过”：

1. **FAQ rich result 已不再是有效目标。** Google 官方已移除 FAQ rich result 文档，并说明 FAQ rich result 自 **2026-05-07** 起不再出现在 Google Search。FAQ 页面仍应保留真实、可见、对用户有帮助的问答内容，但不能再把 `FAQPage` 当作搜索结果增强的收益来源。
2. **媒体 SEO schema smoke 当前失败。** `/ai-image-generation/street-style` 的图片 sitemap 标题为 `Editorial fashion portrait with refined wardrobe styling.`，项目内部检查要求至少 8 个描述性词，因此该质量门槛未通过。Google 官方没有“至少 8 个词”的硬规则；这是项目自己的内容质量断言，仍应修复或重新确认断言是否合理。
3. **首页结构指纹 smoke 当前失败。** 当前实际首页 section 顺序缺少预期中的 `tutorial_video_2`。这首先是发布基线/内容锁一致性问题，也可能影响页面主题覆盖和内部内容结构；在确认是否为批准变更前，不应直接把它当成“无害 SEO 差异”。
4. **Core Web Vitals 尚未获得当前生产环境的 field 证据。** 官方目标是 LCP ≤ 2.5 秒、INP ≤ 200 毫秒、CLS ≤ 0.1，并以移动端和桌面端分别统计的第 75 百分位为主要判断口径。当前仓库检查没有提供 2026-08-16 的 PageSpeed Insights、CrUX 或 Search Console 生产数据，因此性能状态应标为“未验证”。
5. **上线文档存在旧路由口径。** 当前代码和数据已经以 `/ai-image-generation`、`/ai-video-generation` 为 canonical 方向，但 `docs/storefront-launch-checklist.md` 仍把 `/collections`、`/tools` 作为 canonical 目录示例。该文件本次未修改，但它会继续制造错误的上线验收信号。

综合判断：**技术可抓取性为强，路由/canonical 方向基本正确，结构化数据基础较好；内容语义质量、媒体描述、性能实测和发布文档一致性仍需补齐。**

## 1. 2026-08-16 仍适用的 Google 官方规范

### 1.1 Title

Google 会从多个来源自动生成搜索结果标题，但页面应为每个可索引页面提供 `<title>`。官方建议：

- 每个页面都有明确的 `<title>`。
- 标题应描述页面主题、简洁、避免泛化词，例如单独使用 `Home`。
- 不要堆砌关键词或重复同一短语。
- 标题没有固定字符上限，但搜索结果会按设备宽度截断。
- `<title>` 是点击决策的重要信息，不只是开发实现细节。

官方来源：

- [Influencing your title links in search results](https://developers.google.com/search/docs/appearance/title-link)

对 MyDreamShoots 的落地要求：

- 首页标题应表达品牌和主搜索意图，例如当前批准值 `Professional AI Photo Generator Online - myDreamshoots`。
- 目录页、工具页、套餐页、政策页必须使用页面专属标题，不应全部套用首页标题。
- 标题中的 `myDreamshoots` / `MyDreamShoots` / 视觉艺术字应保持可读名称一致，避免不同层级结构化数据互相冲突。

### 1.2 Meta description

Google 主要根据页面正文自动生成 snippet，也可能在 `<meta name="description">` 比页面其他内容更准确时使用它。因此 meta description 是重要的候选摘要，不是强制显示的广告文案。

官方口径：

- 每页使用与页面内容匹配的描述。
- 尽量使用独特、可读、完整的描述。
- 不要把关键词列表直接当成 description。
- 不要假设 description 会原样出现在所有查询的结果中；Google 可能根据查询词替换 snippet。

官方来源：

- [Control your snippets in search results](https://developers.google.com/search/docs/appearance/snippet)

对 MyDreamShoots 的落地要求：

- 首页 description 应说明“AI photo generation + 私密图库/credits”等真实价值，不要只写品牌口号。
- 每个 AI image / AI video 目录详情页应体现该 slug 的具体用途，不能全部使用同一段 generic copy。
- description 要和首屏正文、H1、页面实际功能一致，避免结构化数据和页面可见内容不一致。

### 1.3 `keywords` meta tag

Google 官方明确说明，Google Search 不使用 `keywords` meta tag 进行网页排名。

官方来源：

- [Google does not use the keywords meta tag in web ranking](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)

对项目的判断：

- 当前项目保留 `keywords` 字段可以作为内部内容管理或兼容字段。
- 它不应被视为排名优化项，也不应占用上线审批的主要 SEO 预算。
- 真正应优先维护的是 title、description、可见正文、内部链接、canonical、sitemap、图片语义和页面体验。

### 1.4 Canonical

Google 官方给出的 canonical 信号强度顺序是：

1. redirect；
2. `rel="canonical"`；
3. sitemap inclusion。

这些信号可以叠加，但都不是绝对命令；Google 仍会根据页面内容和其他信号选择 canonical。

官方来源：

- [How to specify a canonical URL with rel="canonical" and other methods](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

对 MyDreamShoots 的落地要求：

- 站内正文链接、导航、JSON-LD、sitemap 和 canonical 应全部指向新的 `/ai-image-generation/...` 或 `/ai-video-generation/...`。
- 旧 `/collections/...`、旧 `/tools/...` 只能作为历史兼容入口；不能进入 sitemap、canonical、JSON-LD 或正常站内内容链接。
- canonical 应是绝对 URL，并与公开 Host、协议、路径规范一致。
- 带 query/hash 的 URL 应有明确的参数处理策略，避免筛选参数制造大量重复页面。
- JavaScript 不应把原始 HTML 中的 canonical 改成另一个值；初始 HTML 和渲染后的 canonical 应保持一致。

### 1.5 `robots.txt`

`robots.txt` 主要用于管理 crawler 访问和请求压力，不是隐藏页面的可靠 index 控制机制。若页面必须不出现在 Google，应使用 `noindex` 或身份验证，同时不能用 `robots.txt` 阻止 Google 访问该页面，否则 Google 可能看不到 `noindex`。

官方来源：

- [Introduction to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Create and submit a robots.txt file](https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt)

对 MyDreamShoots 的落地要求：

- `/robots.txt` 应返回 200，并仅针对当前 Host 输出正确的 sitemap。
- 公开可索引页面不能被误 `Disallow`。
- 登录、搜索、账户、工作台、任务详情等私有页面应通过 `noindex`/`X-Robots-Tag` 控制。
- 旧路由若需要重定向，不能因为 `robots.txt` 禁止抓取而阻断 Google 发现重定向关系。
- 不应把 `robots.txt` 当作 canonical、删除索引或隐私控制。

### 1.6 Sitemap

Google 将 sitemap 视为帮助发现重要页面和文件的提示，同时允许提供 last modification、alternate language、image、video 等信息。提交 sitemap 不保证抓取、索引或排名。

官方来源：

- [Learn about sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Image sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)

对 MyDreamShoots 的落地要求：

- sitemap 只包含希望被索引的 canonical URL。
- URL 使用绝对 HTTPS URL，且只属于 `www.mydreamshoots.com`。
- 不包含旧重定向 URL、404 URL、登录/账户/搜索/任务 URL 或明确 noindex 页面。
- `lastmod` 只能在页面确实发生重要更新时更新，不能每次请求生成当前时间。
- 图片 sitemap 可以帮助发现常规 HTML 之外的图片，但不能替代图片落地页的正文、`<img>`、alt 和页面相关性。

### 1.7 Structured data / JSON-LD

Google 官方将结构化数据定位为帮助搜索理解页面的显式线索，但它不是排名保证，也不是 rich result 保证。结构化数据必须：

- 与页面主内容真实相关；
- 页面用户可见或能从可见内容合理推断；
- 信息及时、完整、准确；
- 不伪造评价、价格、库存、组织关系或用户生成内容；
- 不被 robots、noindex 或其他访问控制阻断；
- 遵守 Google Search spam policies 和具体 feature guide。

官方来源：

- [Introduction to structured data markup in Search](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
- [General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Rich Results Test](https://search.google.com/test/rich-results)

对 MyDreamShoots 的落地要求：

- 首页可以使用 `Organization`、`WebSite`、`SoftwareApplication` 等实体，但字段必须与页面真实内容和品牌身份一致。
- 套餐目录页的 `Product`、`Offer`、`ImageObject` 必须和页面上实际可购买的套餐、价格、图片、credits、输出数量一致。
- 不应在没有真实评论源时输出 `Review` 或 `AggregateRating`。
- `BreadcrumbList` 的每一层应和页面实际导航层级一致，不能为了堆 schema 虚构目录。
- 任何 JSON-LD 变化都要同时检查 raw HTML、可见正文和 Rich Results Test。

### 1.8 Image SEO

Google 官方建议：

- 使用可抓取的 HTML `<img src="...">`；CSS background image 不利于 Google 发现图片。
- 为重要图片提供描述性 alt。
- 使用 image sitemap 辅助发现图片。
- 使用 responsive images，并在 `picture` 中保留带 `src` 的 fallback `<img>`。
- 图片落地页本身也要有高质量、相关的页面内容。
- 图片 URL、页面内容、alt、结构化数据和 image sitemap 的语义应保持一致。

官方来源：

- [Google image SEO best practices](https://developers.google.com/search/docs/appearance/google-images)
- [Image sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)

对 MyDreamShoots 的落地要求：

- 套餐 cover、gallery preview、视频缩略图应使用描述性 alt，而不是 `image`、`preview`、`thumbnail` 这类占位词。
- 图片 sitemap title/caption 要描述图片主题和页面用途；项目内部“至少 8 个词”可以保留为质量门槛，但不要误写成 Google 硬性规则。
- 图片必须有稳定、可访问的绝对 URL；缓存参数不能制造大量等价 URL。
- 尺寸属性和稳定布局也应纳入 CLS 排查。

### 1.9 Core Web Vitals / Page experience

截至 2026-08-16，web.dev 列出的 Core Web Vitals 仍为：

| 指标 | 关注点 | Good 阈值 |
| --- | --- | --- |
| LCP | 加载性能 | ≤ 2.5 秒 |
| INP | 交互响应 | ≤ 200 毫秒 |
| CLS | 视觉稳定 | ≤ 0.1 |

官方建议按移动端和桌面端分别看第 75 百分位；三项都达到目标才算通过 Core Web Vitals 口径。Lighthouse 是实验室工具，不能替代真实用户 field data；PageSpeed Insights、CrUX 和 Search Console Core Web Vitals 报告应作为生产判断依据。

官方来源：

- [Web Vitals](https://web.dev/articles/vitals)
- [Understanding page experience in Google Search results](https://developers.google.com/search/docs/appearance/page-experience)
- [PageSpeed Insights](https://pagespeed.web.dev/)

对 MyDreamShoots 的落地要求：

- 首屏 hero 和首张主图应优先服务 LCP，不应被过大的图片、字体或客户端数据请求阻塞。
- 首页大量 gallery、视频、动态 section 要避免同时加载所有媒体。
- 生成器交互、菜单、价格选择、弹窗和媒体网格要重点观察 INP。
- 图片尺寸、字体切换、延迟插入的价格/评论/视频模块要重点观察 CLS。
- 不能只以“构建成功”或 Lighthouse 单次高分代替生产 field 证据。

### 1.10 FAQ rich results

这是本次审计最重要的规则更新：

- Google 官方更新记录显示，FAQ rich result 文档已于 2026-06-15 被移除。
- Google 在 2026-05-08 的更新中说明：FAQ rich result 自 **2026-05-07** 起不再出现在 Google Search。
- 因此，`FAQPage` JSON-LD 不应再作为 MyDreamShoots 的搜索增强目标或验收 KPI。

官方来源：

- [Google Search documentation updates: Removing documentation for the FAQ rich result feature](https://developers.google.com/search/updates#removing-faq-rich-result)
- 原 FAQ 文档入口（当前重定向到上述更新页）：[FAQ structured data](https://developers.google.com/search/docs/appearance/structured-data/faqpage)

对 MyDreamShoots 的落地要求：

- `/faq` 仍应保留真实、可见、能解决用户问题的正文内容，服务用户理解、转化和站内语义。
- 不应承诺 FAQ schema 会带来 FAQ 折叠富结果。
- 后续可以保留准确的 FAQPage 语义标注，但应评估维护成本，并确保不造成“隐藏内容标记”“重复问题”“与正文不一致”等结构化数据风险。
- 测试名称和上线文档应把“FAQ 内容存在且可见”与“FAQ rich result 展示”分开。

## 2. 当前项目证据

### 2.1 当前数据与路由状态

只读扫描 `data/platform-state.json` 得到：

- MyDreamShoots 页面记录：62 个。
- 当前标记为 indexable 的页面：54 个。
- 当前标记为 noindex 的页面：8 个。
- 活跃图片套餐：38 个。
- 活跃套餐分类：43 个。
- 数据字符串扫描中的旧 `/collections` 路由残留：0 处。
- 当前 canonical 图片路由使用 `/ai-image-generation/...`。
- 首页批准的 title、description、canonical、index/follow 值存在且完整。

当前关键 canonical：

- `/`
- `/ai-image-generation`
- `/ai-image-generation/{slug}`
- `/ai-video-generation`
- `/ai-video-generation/{slug}`
- `/best-packages`
- `/best-ai-image`
- `/best-ai-video`
- `/pricing`
- `/faq`
- `/workflow`
- `/blog`

### 2.2 代码实现位置

- Metadata、canonical、robots 字段和旧路由归一化：[`src/lib/theme/seo.ts`](/Users/a1/work/ai-project/dingyue/src/lib/theme/seo.ts:113)
- host-aware `robots.txt`：[`src/app/robots.ts`](/Users/a1/work/ai-project/dingyue/src/app/robots.ts:1)
- host-aware sitemap、image sitemap、稳定缓存头：[`src/app/sitemap.xml/route.ts`](/Users/a1/work/ai-project/dingyue/src/app/sitemap.xml/route.ts:1)
- sitemap URL 筛选、canonical 目录、lastmod/changefreq：[`src/lib/seo-indexing.ts`](/Users/a1/work/ai-project/dingyue/src/lib/seo-indexing.ts:829)
- Organization、WebSite、SoftwareApplication、BreadcrumbList、FAQPage、Product、ImageObject、VideoObject：[`src/lib/theme/json-ld.ts`](/Users/a1/work/ai-project/dingyue/src/lib/theme/json-ld.ts:387)
- sitemap/canonical/旧路由/目录覆盖静态守护：[`scripts/smoke-mydreamshoots-seo-indexing.mjs`](/Users/a1/work/ai-project/dingyue/scripts/smoke-mydreamshoots-seo-indexing.mjs:206)
- 媒体 Product/ImageObject/image sitemap 守护：[`scripts/smoke-mydreamshoots-media-seo-schema.mjs`](/Users/a1/work/ai-project/dingyue/scripts/smoke-mydreamshoots-media-seo-schema.mjs:130)
- SSR title、description、canonical、JSON-LD、sitemap、旧路由检查：[`scripts/smoke-mydreamshoots-seo-ssr.mjs`](/Users/a1/work/ai-project/dingyue/scripts/smoke-mydreamshoots-seo-ssr.mjs:107)

### 2.3 只读检查结果

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `npm run smoke:mydreamshoots-seo-indexing` | 通过 | 62 个 page slug，无重复；canonical 迁移和 host-aware sitemap 断言通过。 |
| `npm run smoke:public-seo-policy` | 通过 | 公共 SEO policy 断言通过。 |
| `npm run smoke:mydreamshoots-media-seo-schema` | 失败 | `/ai-image-generation/street-style` image sitemap title 只有 6 个词，未达到项目内部至少 8 个描述性词的断言。 |
| `npm run smoke:storefront-seo-fingerprint` | 失败 | 首页实际 section 顺序缺少预期的 `tutorial_video_2`。需要先确认是否为批准内容变更。 |
| `npm run smoke:storefront-head-title-order` | 未完成 | 本地 `127.0.0.1:3002` 未启动，连接被拒绝；不是应用 SEO 结论。 |
| `npm run smoke:storefront-sitemap-directory-coverage` | 未完成 | 同样因为本地 `127.0.0.1:3002` 未启动，无法完成运行时覆盖检查。 |

## 3. 分项评价

### A. Crawlability / indexability：良好，但需要生产证据闭环

仓库实现已经区分：

- 公开页面：允许抓取和 index/follow；
- 登录、账户、搜索、工作台、任务等页面：使用 noindex 方向；
- 测试域：通过 host 规则阻断索引；
- sitemap：按请求 Host 选择对应站点，不混入其他站点 URL。

这符合 Google 对 robots、noindex、sitemap 各自职责的区分。

仍需补齐：

- 在生产 Host 上实际请求 `robots.txt`、`sitemap.xml`、代表性首页、目录页和详情页。
- 在 Search Console URL Inspection 中抽查 canonical、crawled page、rendered HTML 和 index status。
- 对旧路由验证 redirect/404 策略与 sitemap、站内链接完全一致。

### B. Title / description：基础合格，需持续防止模板重复

当前首页批准 TDK 存在，主要目录页也有专属 title/description。代码中的 `metadataForThemePage` 和 `metadataForSingleThemePage` 会根据页面、站点和 canonical path 组装最终 metadata。

主要风险不是缺标签，而是：

- 目录详情页数量多，模板化 description 容易变成同义重复。
- `keywords` 字段仍存在，可能让审核者误以为它是排名重点。
- FAQ、workflow、best pages 的主题词需要和正文、H1、内部链接一致。

建议将“每页都有 title/description”升级为“每个可索引页面都有独立搜索意图和独立首屏证据”。

### C. Canonical / legacy routes：方向正确

当前静态 SEO smoke 已验证新的图片、视频目录路由形态，且数据扫描没有旧 `/collections` 字符串残留。`src/lib/theme/seo.ts` 仍保留旧路径归一化逻辑，符合“旧链接兼容、站内链接使用新 canonical”的迁移策略。

上线验收必须坚持：

- sitemap 只放新 canonical；
- 站内正文和 JSON-LD 不产生旧链接；
- 旧 URL 的响应行为必须有明确策略，不允许一部分重定向、一部分意外 404；
- 不能仅因为旧 URL 不进 sitemap，就认为旧 URL 问题已解决。

### D. Structured data：覆盖面好，FAQ 预期需要更新

当前实现包含 Organization、WebSite、SoftwareApplication、BreadcrumbList、Product、Offer、ImageObject 等较有价值的类型，并且媒体 smoke 对价格、币种、库存、图片数量、SKU、产品 URL 等进行了较严格的内部一致性验证。

需要注意：

- Google 不保证任何结构化数据一定展示 rich result。
- FAQPage 现在不能再作为 FAQ rich result 目标。
- Product/Offer schema 必须持续与真实价格、库存、购买状态和页面可见信息同步。
- 未来若加入 review schema，必须有真实、可验证的 review source；不能用营销文案替代评分。

### E. Image SEO：工程覆盖较强，语义质量有一处失败

当前实现已经有：

- public asset URL；
- cover + gallery image；
- ImageObject；
- image sitemap；
- 图片 title/caption；
- 图片唯一性和文件存在检查。

但 `street-style` 失败说明至少有一条图片 sitemap 描述没有达到项目自己设定的语义丰富度。应优先修复该数据或调整断言，再重新跑媒体 smoke；不要把“8 个词”误写成 Google 规则。

### F. Core Web Vitals：当前只能判定为未验证

现有静态 smoke 可以验证 SSR、图片、JSON-LD、sitemap 和部分页面内容，但不能证明：

- 真实移动用户的 LCP；
- 真实交互下的 INP；
- 真实布局稳定性 CLS；
- 不同网络、设备和缓存状态下的第 75 百分位。

上线前后的正确闭环应是：

1. 用 Lighthouse/Chrome DevTools 做 lab 回归；
2. 用 PageSpeed Insights 看生产 URL 的 field data；
3. 用 Search Console Core Web Vitals 报告观察真实页面群；
4. 必要时接入 `web-vitals` 做自有 RUM。

### G. FAQ：内容价值仍在，搜索富结果价值已取消

`/faq` 作为用户支持、转化、内容理解页面仍有价值。页面应继续保持：

- 真实问题和直接答案；
- 可见正文；
- 清晰的标题层级；
- 到 pricing、privacy、refunds、workflow 等相关页面的内部链接；
- 与页面 JSON-LD 内容一致。

但 2026-08-16 起不能把 FAQPage 是否生成折叠富结果作为验收项。

### H. 发布文档和质量门禁：需要治理修正

当前 `docs/storefront-launch-checklist.md` 仍保留旧 `/collections`、`/tools` canonical 口径，而当前实现和数据已经迁移到新的 AI Image / AI Video 路由。这会造成：

- 发布前检查误报；
- 新旧路由标准混用；
- sitemap coverage 与文档期望不一致；
- 后续维护者重新写入脏链接。

本次按要求未修改该文档；它应在下一次专门的发布规则整理中更新。

## 4. 优先级建议

### P0：发布前处理

1. 修复 `/ai-image-generation/street-style` 图片 sitemap title，或由负责人确认项目“至少 8 词”门槛是否合理。
2. 重新执行 `npm run smoke:mydreamshoots-media-seo-schema`。
3. 确认首页 section 缺少 `tutorial_video_2` 是批准内容变更还是意外漂移；未确认前不要刷新内容锁。

### P1：生产 SEO 验证

1. 启动与当前 release 一致的本地服务，重新运行 title order 和 sitemap directory coverage。
2. 对生产首页、`/ai-image-generation`、代表性图片详情、`/ai-video-generation`、`/pricing`、`/faq`、`/workflow` 做 raw HTML 检查。
3. 在 Search Console URL Inspection 抽查 canonical、robots、rendered HTML、index status。
4. 在 PageSpeed Insights 和 Search Console 中分别记录移动/桌面 CWV。

### P2：规则和内容治理

1. 将上线文档中的 `/collections`、`/tools` canonical 示例改为当前 canonical 路由；旧路径只放在 legacy redirect 章节。
2. 将 FAQ rich result 从发布 KPI 和 smoke 目标中移除，保留 FAQ 页面内容质量检查。
3. 维护每个目录详情页的独立主题词、title、description、H1、首段和图片语义。
4. 对图片 sitemap title/caption 建立内容审查，而不是只依赖词数阈值。

## 5. 官方来源索引

以下来源均为 Google 官方一手资料，核对日期为 2026-08-16：

1. [Technical requirements](https://developers.google.com/search/docs/essentials/technical)
2. [Influencing your title links in search results](https://developers.google.com/search/docs/appearance/title-link)
3. [Control your snippets in search results](https://developers.google.com/search/docs/appearance/snippet)
4. [How to specify a canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
5. [Introduction to robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
6. [Create and submit a robots.txt file](https://developers.google.com/search/docs/crawling-indexing/robots/create-robots-txt)
7. [Learn about sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
8. [Build and submit a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
9. [Image sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
10. [Introduction to structured data markup](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data)
11. [General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
12. [Google image SEO best practices](https://developers.google.com/search/docs/appearance/google-images)
13. [Understand the JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
14. [Understanding page experience in Google Search results](https://developers.google.com/search/docs/appearance/page-experience)
15. [Web Vitals](https://web.dev/articles/vitals)
16. [Google Search documentation updates](https://developers.google.com/search/updates)
17. [Google does not use the keywords meta tag in web ranking](https://developers.google.com/search/blog/2009/09/google-does-not-use-keywords-meta-tag)

## Final status

本次研究文档已完成。只新增：

- `/Users/a1/work/ai-project/dingyue/docs/google-official-seo-audit-20260816.md`

未修改应用代码或其他文件。当前 MyDreamShoots 的 SEO 结论是：**技术基础可继续上线，但媒体 schema smoke、首页内容指纹、生产 CWV 证据和上线文档路由口径必须在正式宣布“SEO 全部通过”前处理完。**
