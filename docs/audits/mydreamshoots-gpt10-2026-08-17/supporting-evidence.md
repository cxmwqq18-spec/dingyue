# GPT10 审计支持证据：Google Search Central 官方标准

## 1. 范围与方法

- 用途：为 MyDreamShoots GPT10 的 9 个博客页面审计提供统一判定标准；本文不审计、不改写任何具体页面。
- 来源限制：只使用 Google Search Central / Google for Developers 官方文档。
- 验证时间：2026-08-17（Asia/Shanghai）。下列文档均以只读 HTTP 请求访问并返回 `200`；FAQPage 旧文档地址发生官方跳转，已单独注明。
- 适用原则：官方建议是判定依据，不等于单个页面已经有问题；“建议”“资格条件”“排名因素”和“富结果保证”必须区分。

## 2. 可直接用于本次审计的判定标准

### 2.1 页面标题与主标题

**官方证据**

- 每页应有 `<title>`；标题应准确、描述性强且简洁，避免关键词堆砌、长段样板文案以及只替换一个词的近重复标题。不同页面应有能区分实际内容的标题。[Influencing your title links in search results](https://developers.google.com/search/docs/appearance/title-link)
- Google 生成搜索结果标题链接时会综合 `<title>`、页面主视觉标题、`h1` 等标题元素、`og:title`、页面锚文本等信号；如果多个大标题同样显眼，Google 可能无法确定主标题。因此主标题应明确、突出，并与页面实际内容一致。[Influencing your title links in search results](https://developers.google.com/search/docs/appearance/title-link)
- Google 的入门指南再次强调：好标题应当是页面独有、清晰、简洁且准确描述内容。[SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)

**适用边界**

- Google 没有规定固定的 `<title>` 字符数；过长标题可能按设备宽度截断，因此不能把某个字符阈值当作硬性违规。
- Google 没有“一页只能有一个 `h1`”或“标题层级顺序会直接决定排名”的规则。官方指南说明，标题语义顺序对无障碍有价值，但从 Google Search 角度并无神奇的理想标题数量。审计应关注主标题是否唯一明确、内容结构是否便于用户理解，而不是机械计数。[SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- 标题是否被 Google 重写是自动系统结果；遵守规范只能影响标题链接，不能保证完全采用页面 `<title>`。

### 2.2 People-first 内容与 E-E-A-T

**官方证据**

- 自评重点包括：是否提供原创信息、研究或分析；是否完整、实质性地覆盖主题；是否有超出显而易见内容的洞察；引用其他来源时是否增加了明显的原创价值；与搜索结果中的其他页面相比是否提供了实质价值。[Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- 信任线索包括清楚的来源、实际经验或专业能力证据、作者/发布方背景、作者页或 About 页。对于读者通常期待署名的内容，Google 强烈鼓励准确署名，并让署名能够通向作者背景信息。[Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- People-first 内容应首先解决真实用户需求，并体现第一手经验或足够深度；批量自动生成、追逐热门话题、让读者不得不再次搜索、仅为了搜索流量进入缺乏真实经验的主题，都是官方列出的警示信号。[Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- Google 明确表示没有偏好的文章字数；为达到传闻中的固定字数而写作不是合理目标。[Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

**适用边界**

- E-E-A-T 本身不是单一、可直接打分的排名因素。Google 使用多种信号识别经验、专业性、权威性和可信度，其中信任最重要；审计不能把“没有作者简介”写成自动降权或索引失败的确定结论。[Creating helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- 对本批商业摄影/AI 图像博客，作者、实测过程、真实示例、限制条件和第一方结果可以增强信任，但不能只靠添加署名或 E-E-A-T 文案替代真正有用的内容。
- 修改发布日期但内容没有实质更新，是官方列出的搜索引擎优先内容警示信号；整改时应把“内容实质更新”和 `dateModified` 同步处理。

### 2.3 重复或近重复内容与 canonical

**官方证据**

- canonical 用于重复或非常相似的页面。Google 将重定向视为强信号、`rel="canonical"` 视为强信号、Sitemap 收录视为弱信号；信号可以叠加，但 Google 最终仍会自行选择 canonical。[How to specify a canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- 指定 canonical 的主要作用包括整合重复 URL 的信号、减少重复页面爬取。官方建议 canonical 页面也使用自引用 canonical，并在站内链接中始终链接到规范 URL。[How to specify a canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- `rel="canonical"` 应位于有效 HTML 的 `<head>`，使用绝对 URL；不要让 Sitemap、HTML canonical、重定向等方法相互指向不同 URL。[How to specify a canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- 站内重复内容本身不是 Google 垃圾内容政策违规，但可能造成不良用户体验和爬取资源浪费；不能重定向时可使用 canonical。[SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)

**适用边界**

- canonical 解决的是重复/高度相似 URL 的规范化，不是薄内容、搜索意图冲突或关键词蚕食的通用修复按钮。
- 如果两个页面服务不同用户意图并有充分独特内容，应保留各自自引用 canonical，并通过标题、正文、CTA 和内部链接明确区分；不能仅因模板相同就合并。
- 如果两个页面实质回答同一问题且只有主题词替换，应先决定保留页与合并策略；彻底淘汰的重复页优先永久重定向，仍需给用户访问的近重复变体再考虑 canonical。
- 不要用 `robots.txt`、URL Removal 工具或 `noindex` 代替 canonical。Google 明确不推荐在同一站点内用 `noindex` 影响 canonical 选择。[How to specify a canonical URL](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

### 2.4 内部链接、外部链接与锚文本

**官方证据**

- Google 通常只能可靠抓取带 `href` 的 `<a>` 元素；纯脚本点击、无 `href` 的“链接”或无法解析成实际网址的目标，不应视为可靠的可抓取链接。[SEO Link Best Practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- 好的锚文本应描述性强、合理简洁，同时与当前页面和目标页面相关，让用户在点击前形成正确预期；避免堆砌关键词。[SEO Link Best Practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- 每个重要页面至少应从站内另一个页面获得链接；内部链接应在上下文中指向真正能帮助读者理解当前主题的资源。[SEO Link Best Practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- 图片链接的 `alt` 可被 Google 用作锚文本，因此图片链接需要有能说明目标的替代文本。[SEO Link Best Practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)

**适用边界**

- “Learn more”“Read more”并非自动违规；只有在上下文不足、同页反复使用却指向不同目标、或不能让用户预判目标时，才应改为更具体的锚文本。
- `nofollow` 不应默认加到所有外部链接。官方建议在不信任来源等特定情形使用；正常引用权威来源不需要机械 `nofollow`。[SEO Link Best Practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
- 本次逐链接审计应分别检查：可抓取性、HTTP/跳转结果、锚文本与目标一致性、是否把用户送到真正相关的下一步；链接数量本身不是质量结论。

### 2.5 Article / BlogPosting 结构化数据

**官方证据**

- 博客文章可使用 `Article`、`NewsArticle` 或 `BlogPosting`。标记有助于 Google 理解文章，并可能改善标题、图片和日期信息，但不是进入 Google News 的必要条件，也不保证任何富结果。[Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- 官方建议包括：准确标出所有可见作者；作者 `name` 只放姓名，并用 `url` 或 `sameAs` 指向能唯一识别作者的页面；用 ISO 8601 提供 `datePublished` / `dateModified` 及时区；`headline` 简洁；`image` 应代表文章内容、可抓取、可索引。[Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- 结构化数据必须真实反映页面可见内容，不得误导或标记用户看不到的信息；正确标记只代表具备资格，不保证展示。[General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)

**适用边界**

- 缺少 Article 标记不等于页面不能索引；应按“增强机器理解和搜索展示资格”评估，而非 P0 索引故障。
- 不能只补 JSON-LD 而不补页面可见的作者、日期、图片或事实依据。可见内容与标记不一致的风险高于“少一个推荐字段”。
- 实施后应使用 Rich Results Test 和 URL Inspection 验证，但验证通过也不保证富结果展示。

### 2.6 FAQ 内容与 FAQPage 结构化数据

**当前官方状态**

- 旧地址 [FAQ structured data](https://developers.google.com/search/docs/appearance/structured-data/faqpage) 在 2026-08-17 返回 `200` 后跳转至官方更新日志的 FAQ 移除说明。
- Google 在 2026 年 5 月宣布弃用 FAQ 富结果功能，并在 2026 年 6 月移除 FAQ 富结果文档，原因是该功能已经不再显示在 Google Search 结果中。[Google Search documentation updates: Removing documentation for the FAQ rich result feature](https://developers.google.com/search/updates#removing-faq-rich-result)

**适用边界**

- 不能把“新增 FAQPage schema 可获得 Google FAQ 富结果”列为本批页面的整改收益。
- 对用户真正有帮助的可见 FAQ 仍可保留或新增，它可以承接异议、解释限制和推动转化；这是内容/体验价值，不是当前 Google FAQ 富结果资格。
- 若站点为其他搜索引擎或下游消费者保留 FAQPage，应确保问答真实可见、标记与页面一致，并单独验证目标平台支持；不应把它计入 Google 富结果预期。

### 2.7 索引资格、robots 与 canonical 的关系

**官方证据**

- Google 最低技术资格包括：Googlebot 未被阻止、页面返回 HTTP `200`、页面包含可索引内容。满足最低条件只是“有资格被索引”，不是索引或排名保证。[Google Search technical requirements](https://developers.google.com/search/docs/essentials/technical)
- robots meta 是页面级索引/展示控制；非 HTML 资源可用 `X-Robots-Tag`。若规则冲突，更严格的规则生效。[Robots meta tag specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- `noindex` 和其他 robots meta / `X-Robots-Tag` 只有在 Google 能抓取 URL 时才能被发现。若先用 `robots.txt` 禁止抓取，页面内的 `noindex` 或 canonical 等信号可能无法被读取。[Robots meta tag specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- `robots.txt` 不是可靠的去索引或 canonical 工具；被禁止抓取的 URL 仍可能因站外链接而被发现并索引为无正文结果。[Influencing your title links in search results](https://developers.google.com/search/docs/appearance/title-link)

**审计判定顺序**

1. 验证请求状态与最终 URL：是否 `200`，是否发生预期/非预期跳转。
2. 验证 Googlebot 可访问性：`robots.txt`、登录墙、服务器限制。
3. 验证页面级指令：robots meta 与 `X-Robots-Tag` 是否存在 `noindex` 或冲突规则。
4. 验证 canonical：是否绝对地址、自引用或合理指向保留页，且与跳转、Sitemap、内部链接一致。
5. 再评估内容独特性、搜索意图与质量。技术上可索引不等于页面值得单独索引。

## 3. 用于 GPT10 报告的证据分级

| 发现 | 可判为 P0/P1 的条件 | 不应过度推断 |
|---|---|---|
| 非 `200`、意外跳转、`noindex`、Googlebot 被阻止 | 页面本应公开获客且当前直接失去或严重影响索引/访问资格 | 仅凭“Search Console 暂未收录”不能确定技术故障 |
| canonical 指错、互相冲突、指向无关页面 | 可能把信号合并到错误 URL，或让保留页被错误规范化 | 自引用 canonical 是正常状态，不是重复内容证明 |
| 大量近重复标题/正文、仅替换主题词 | 页面搜索意图相同、实质价值不足，且互相竞争时需要合并或重写 | 共用模板、导航、CTA 不足以单独证明应合并 |
| 标题/主标题不准确或样板化 | 与正文意图不符、无法区分 9 页、关键词堆砌 | 不是按固定字符数机械判错；多个标题元素也非自动违规 |
| 链接无 `href`、失效、跳错页、锚文本误导 | 破坏用户路径或让重要页不可发现 | 通用锚文本必须结合上下文判断；外链不必统一 `nofollow` |
| Article 标记与可见内容矛盾 | 可能违反结构化数据质量准则，应优先修正或删除错误字段 | 缺少 Article 标记不等于不能索引，也不保证补后展示富结果 |
| FAQPage 作为 Google 富结果方案 | 当前应从收益假设和 KPI 中移除 | 可见 FAQ 仍可能有用户与转化价值；不要求删掉真实问答 |
| 缺少作者/来源/实测证据 | 对“指南”类商业内容会削弱可信度，应按内容风险整改 | E-E-A-T 不是单一排名因子，不能承诺加署名后排名提升 |

## 4. 来源访问记录

| 官方文档 | 2026-08-17 访问结果 | 官方页面显示的最后更新 |
|---|---:|---:|
| [Title links](https://developers.google.com/search/docs/appearance/title-link) | `200` | 2025-12-10 UTC |
| [Helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | `200` | 2025-12-10 UTC |
| [Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | `200` | 2026-07-10 UTC |
| [Link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | `200` | 2025-12-10 UTC |
| [Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article) | `200` | 2025-12-10 UTC |
| [FAQPage 旧地址](https://developers.google.com/search/docs/appearance/structured-data/faqpage) | `200`，跳转至更新日志 | 更新日志 2026-07-29 UTC；移除条目为 2026-06 |
| [Robots meta / X-Robots-Tag](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag) | `200` | 2026-03-24 UTC |
| [General structured data guidelines](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) | `200` | 2026-07-10 UTC |
| [Technical requirements](https://developers.google.com/search/docs/essentials/technical) | `200` | 2025-12-18 UTC |
| [SEO Starter Guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide) | `200` | 2025-12-10 UTC |

## 5. 总结

本批页面的 SEO 整改应先处理真实可验证的访问/索引阻断、错误 canonical、失效或误导链接，再判断近重复页面是保留重写、合并重定向还是仅做局部差异化。内容层面应增加用户真正需要的原创信息、第一方示例、作者与过程证据，而不是以固定字数、机械 `h1` 计数或 FAQPage 富结果为目标。Article / BlogPosting 标记可以增强理解，但必须与可见内容一致，并且不能承诺富结果或排名提升。
