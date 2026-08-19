# MyDreamShoots 九个博客页面 SEO 审查与整改方案

审查日期：2026-08-19  
审查对象：`https://www.mydreamshoots.com/blog/` 下 9 个 photo-package guide 页面  
状态：**线上审查完成；整改方案待执行**

## 1. 结论摘要

这 9 个页面目前不是“缺少 title/canonical”的基础技术 SEO 问题，而是**页面实体、搜索意图和内容模板没有真正分开**。线上 HTML 能看到 index/follow、自引用 canonical、sitemap 收录、BlogPosting JSON-LD、OG/Twitter 图片等基础信号；真正拉低质量的部分是：

1. `/blog/profile-cards-photo-package-guide` 的 title、H1、BlogPosting headline 和正文主体都输出了 Avatar，和 `/blog/anime-avatar-photo-package-guide` 形成近重复页面。两页正文抽取后的相似度约为 `0.988`，这是本次最高优先级问题。
2. 其余页面共享几乎相同的 12 个标题层级、FAQ 问法、比较表逻辑、credits/private gallery 叙事和相关文章结构。单页约 1,075–1,111 个英文词并不等于内容质量高；当前主要风险是**模板化、主题边界弱、用户问题没有被具体回答**。
3. 多个页面存在明显的实体或语句错配，例如 `Avatar and Avatar`、`Gala Photo and Creative`、`Product Style → background-changer`、`Professional Headshot` 只缩写成 `Headshot`。这些问题会削弱 query-to-page relevance，也会让 Google 和用户难以判断页面与产品的关系。
4. 当前 9 个 URL 都出现在 sitemap，sitemap 的目标路径与页面 canonical 一致；但给定的 Anime URL 曾在一次 HEAD/redirect 检查中表现为 `308 → /blog/avatar-photo-package-guide` 后返回 `404`，随后 GET 又返回 `200`。这说明路由需要做 HEAD、GET、缓存和 Cloudflare 多次回归，不能只以一次浏览器访问成功作为结论。
5. Schema 已有 `BlogPosting`、`BreadcrumbList`、`WebSite`、`Organization`，且 JSON-LD 可解析；审查脚本持续提示全局 `Organization` 缺少 `logo`、`WebSite` 缺少 `potentialAction`。其中 `logo` 应修复，`potentialAction` 只在真实站内搜索存在且可公开访问时补充，不能为了通过工具硬填。
6. PageSpeed、Core Web Vitals、Search Console 收录/查询/点击、日志抓取和外部竞品数据本次均不可用，因此性能和真实排名不能判定为通过或失败。

总体评级：**技术可抓取性中上；页面差异化与意图匹配不合格；Profile Cards 为 P0，内容重写与 CTA/Schema/图片语义为 P1，性能和 GSC 验证为 P2。**

## 2. 审查方法与证据边界

本次按 GitHub 拉取的 `seo-audit-full` 技能（仓库 `JeffLi1993/seo-audit-skill`，commit `523bdfb2c94f4689408a5a344f4ea74ced49ff32`，版本 `2.1`）执行其核心检查框架，并结合仓库现有的 `seo-wordpress-project`、`blog-article-ops` 和项目内 Google 官方 SEO 审计结论。

已检查：

- 9 个页面的最终 GET 响应、响应头、title、meta description、robots、H1/H2/H3、canonical、图片及 alt、正文长度、内链、OG/Twitter。
- sitemap.xml 中的 9 个 URL、lastmod、图片 title/caption。
- robots.txt、index/follow 信号、页面 JSON-LD 类型和关键字段。
- 9 个页面的文章正文模板重复、标题重复、文章内链目标和 CTA 映射。
- 本地源代码中的博客内容同步脚本、BlogPosting 生成、图片 alt 规则和已有 smoke 门禁。

未完成或未提供：

- 未运行 PageSpeed Insights：`seo-audit-full` 技能要求 API key，当前没有提供；不伪造 Lighthouse 或 CWV 分数。
- 未访问 Search Console，因此不判定真实收录、排名、查询词、点击率或人工措施。
- 未进行完整全站抓取、日志分析、反向链接分析或竞品 SERP 基准测试。
- HTML 约 174–179 KB 只能作为传输体积观察，不能替代移动端 LCP/INP/CLS 实测。

## 3. 线上现状矩阵

| 页面 | HTTP/可索引信号 | Title / H1 实体 | 正文与内链问题 | 主 CTA 现状 | 评级 |
|---|---|---|---|---|---|
| `anime-avatar-photo-package-guide` | GET 采样为 200；`index, follow`；self-canonical；在 sitemap | `Avatar`，没有覆盖 URL 中的 `Anime Avatar` | 正文出现 `Avatar and Avatar`；只做泛 Avatar 解释 | `/ai-image-generation/avatar`，目标方向基本正确 | P1 |
| `creator-portraits-photo-package-guide` | 200；index/follow；self-canonical；在 sitemap | `Portrait Photo`，弱化 `Creator Portraits` | `Portrait Photo and Creator`；与其他页共享同一比较/FAQ 模板 | `/ai-image-generation/portrait-photo`，方向可保留 | P1 |
| `fashion-editorial-photo-package-guide` | 200；index/follow；self-canonical；在 sitemap | `Fashion Editorial`，实体最清楚之一 | 结构仍与全组相同；需增加服装、构图、版权边界 | 未从当前文章 CTA 采样到稳定的专属 canonical 目标 | P1 |
| `gala-photos-photo-package-guide` | 200；index/follow；self-canonical；在 sitemap | `Gala Photo`，单复数与 URL 不完全一致 | 正文出现 `Gala Photo and Creative`；分类邻接关系不稳定 | `/ai-image-generation/gala-photo`，方向可保留 | P1 |
| `hairstyle-photo-package-guide` | 200；index/follow；self-canonical；在 sitemap | `Hairstyle`，需要补齐 preview/search intent | 正文出现 `Hairstyle and Beauty`；缺少发型预览的边界说明 | `/ai-image-generation/hairstyle-generator`，方向正确 | P1 |
| `product-style-photo-package-guide` | 200；index/follow；self-canonical；在 sitemap | `Product Style`，方向清楚 | 内容仍套用人物肖像模板；缺少产品、包装、品牌资产和商业使用判断 | `/ai-image-generation/background-changer`，语义明显不匹配 | P0/P1 |
| `professional-headshots-photo-package-guide` | 200；index/follow；self-canonical；在 sitemap | `Headshot`，没有覆盖 `Professional Headshots` | 正文偏通用；图片 alt 甚至为 `Credit plan panel for private photo galleries` | `/ai-image-generation/headshot`，方向正确 | P1 |
| `profile-cards-photo-package-guide` | 200；index/follow；self-canonical；在 sitemap | title/H1/headline 都是 `Avatar` | 与 Anime Avatar 正文相似度约 0.988；实体与 URL 冲突 | `/ai-image-generation/avatar`，产品方向可保留但文章必须独立 | P0 |
| `social-cards-photo-package-guide` | 200；index/follow；self-canonical；在 sitemap | `Social Cards`，方向清楚 | 正文把 Social Cards 和 Creator 混在一起；缺少版式、比例、文字留白问题 | `/ai-image-generation/edit-by-prompt`，需要确认是否为真实主工具 | P1 |

## 4. 已验证的共性问题

### 4.1 页面级 SEO 字段：存在，但不够准确

当前 9 页均能看到：

- 一个 H1；
- `meta robots=index, follow`；
- 自引用 canonical；
- 约 123–160 字符的 meta description；
- OG title/description/url/image；
- `twitter:card=summary_large_image`、title、description、image；
- 4 组 JSON-LD：`Organization`、`WebSite`、`BreadcrumbList`、`BlogPosting`。

因此不建议把整改预算继续花在“补一个 meta description”这种表面动作上。优先应当把 URL、title、H1、首段、BlogPosting headline、CTA 目标和图片主题统一成同一个页面实体。

需要修复的具体点：

- `anime-avatar` 与 `profile-cards` 不能都使用 `Avatar` 作为 title/H1/headline。
- `creator-portraits` 应把 `creator portraits` 作为主实体，而不是只写 `Portrait Photo`。
- `professional-headshots` 应在 title/H1/首段显式出现 `professional headshots` 或 `professional headshot photos`。
- `gala-photos` 使用一个稳定实体名：正文、标题、CTA 和产品页统一用 `Gala Photos` 或统一用 `Gala Photo`，不要在同页随意切换。
- `keywords` meta 即使存在，也不应作为主要排名整改项；重点应放在可见正文、页面实体、内链和产品页关系上。

### 4.2 内容模板重复，且重复的是搜索意图结构

9 页几乎统一为：

1. `When X is the right fit`
2. `What to prepare before choosing it`
3. `How to compare X with nearby choices`
4. `Credit and private gallery planning`
5. `Details to review before download`
6. `Mistakes to avoid`
7. `A planning pass before you spend credits`
8. `X FAQ`
9. 三个相同形式的 FAQ 问题

这个结构本身不是错误，但当前页面把同一套句式、同一套邻近类别、同一套 credits/private gallery 叙述复制到不同主题上。尤其是以下固定表达应彻底移除：

- `Use X when X and Y are the nearest match...`
- `The strongest X requests keep the brief and the result aligned...`
- `Prepare clear approved source portraits...`
- `For a first pass, keep the input set smaller...`
- 与主题无关的 `AI Video Add-ons`、Avatar、Headshot 等固定推荐。

整改原则：保留可扫描结构，但每页至少有 4 个**只有该主题才会出现**的段落或表格行；不能只把 X 替换成另一个词。

### 4.3 内部链接数量看似很多，文章正文实际只有 4–5 条

完整 HTML 每页约 118 条内部链接，但绝大部分来自全局 header/footer。文章正文实际约 4–5 条，并且多页重复指向：

- `/ai-image-generation/headshot`；
- `/blog/ai-video-add-ons-photo-package-guide`；
- `/blog/anime-avatar-photo-package-guide`；
- `/blog/profile-cards-photo-package-guide`。

这不是有效的 topic cluster。整改后每页应有：

- 1 个主产品/工具 CTA；
- 1 个相邻产品对比链接；
- 1–2 个真正相关的文章链接；
- 必要时 1 个政策或版权说明链接。

每个锚文本要能说明目的，例如 `Read the Profile Card photo guide`，不能使用多个页面都相同的 `Open Avatar theme`。

### 4.4 图片 alt 有描述性，但部分语义错误；图片尺寸信息不足

每页文章主体采样到 1 张 lazy-loaded gallery 图片，alt 非空且通常可描述画面；但发现：

- Professional Headshots 的图片 alt 是 `Credit plan panel for private photo galleries...`，不描述 headshot；
- Social Cards 的图片 alt 使用 `Social profile card portrait`，与 social publishing card 不完全一致；
- Product Style 的 alt 偏人物/场景模板，没有突出 product、package、lifestyle commerce；
- 图片没有稳定的 `width`/`height` 属性，可能增加 CLS 风险；需要结合真实图片尺寸检查。

图片整改必须同时覆盖 HTML `<img>`、alt、图片 sitemap title/caption、BlogPosting image 和 OG image，不能只改 alt。

### 4.5 JSON-LD 结构存在，但需要做实体一致性治理

当前 BlogPosting 的关键字段整体存在：headline、description、mainEntityOfPage、datePublished/dateModified、author、image、publisher。建议保留一个 BlogPosting，FAQ 继续作为可见正文，不为了 rich result 强行新增 FAQPage。

需要整改：

- 全局 Organization 补真实 logo URL；如果没有稳定公开 logo，不要填临时或不可访问 URL。
- BlogPosting 的 `headline` 必须等于页面真实 H1/标题实体，尤其是 Profile Cards 不能继续输出 Avatar。
- author 从泛化的 `Person: myDreamshoots editorial team` 改为经核实的 Organization 或真实编辑责任主体，并提供可公开访问的 `url`，指向 About/Editorial Policy 页面。
- `publisher` 与 Organization 品牌名统一为 `MyDreamShoots`，避免大小写和品牌实体混用。
- BreadcrumbList 补齐 position、name、item，并确保与可见路径一致。
- 若页面继续输出 `dateModified`，只有正文或事实确实改变时才更新；不要因批量部署自动刷新。

## 5. 逐页整改定义

以下目标不是让 9 页共用同一篇文章，而是锁定每页唯一的 search intent、产品关系和事实边界。

| 页面 | 建议主关键词 | 建议 H1 方向 | 必须新增的独有内容 | CTA / 内链整改 |
|---|---|---|---|---|
| Anime Avatar | `anime avatar photos`, `AI anime avatar` | `How to Plan an Anime Avatar Photo Set` | 动漫化程度、参考图来源、角色/风格权利、面部身份保留、与 Avatar/Profile Cards 区别 | 主 CTA `/ai-image-generation/avatar`；增加 Profile Cards 与 Creator Portraits 对比；去掉固定 AI Video Add-ons |
| Creator Portraits | `creator portraits`, `AI creator photos` | `Creator Portraits for Media Kits, Thumbnails, and Brand Profiles` | newsletter/media kit/thumbnail 场景、品牌一致性、横竖裁剪、创作者与职业 headshot 的区别 | 主 CTA `/ai-image-generation/portrait-photo`；相关链接改为 Professional Headshots、Profile Cards、Product Style |
| Fashion Editorial | `fashion editorial photos`, `AI fashion editorial` | `How to Plan AI Fashion Editorial Photos` | 服装轮廓、材质可见性、灯光、杂志构图、品牌/IP 标志和成人内容边界 | 指向已验证的 Fashion Editorial 工具/产品 canonical；若不存在专属公开路由，先建立/确认路由，不指向无关主题 |
| Gala Photos | `gala photos`, `formal event portraits` | `AI Gala Photos for Formal and Evening Portraits` | 礼服/黑领、红毯光线、正式场景、活动纪念与真实活动记录的区别 | 主 CTA `/ai-image-generation/gala-photo`；关联 Fashion Editorial、Wedding、Headshots，删除 Creative 等未定义邻类 |
| Hairstyle | `AI hairstyle preview`, `hairstyle photo generator` | `AI Hairstyle Preview: What to Prepare and What to Check` | 发型长度、层次、发际线、颜色、角度；明确 preview 不是精确剪发/染发结果保证 | 主 CTA `/ai-image-generation/hairstyle-generator`；关联 Virtual Try-On、Portrait Retouch；FAQ 询问长度/颜色/角度 |
| Product Style | `product lifestyle photos`, `AI product photos` | `AI Product Style Photos for Lifestyle and Campaign Drafts` | 产品/包装/Logo 资产、白底与生活方式场景、比例、商标/版权、商业使用前人工复核 | 不再默认 `/ai-image-generation/background-changer`；确认真实 product-style route，若无则建立专属 route 或改为明确的可用产品页 |
| Professional Headshots | `professional headshots`, `AI headshots for LinkedIn` | `Professional AI Headshots for LinkedIn, Resumes, and Team Profiles` | LinkedIn/resume/speaker bio/team profile、背景、衣着、眼镜、脸部一致性和正式程度检查 | 主 CTA `/ai-image-generation/headshot`；关联 Creator Portraits、Profile Cards；修正 headshot 图片 alt |
| Profile Cards | `profile card photos`, `social profile photo set` | `Profile Card Photos for Consistent Bios and Social Profiles` | 头像裁剪安全区、不同平台比例、统一背景/色彩、单头像与一组 profile cards 的区别 | 主 CTA `/ai-image-generation/avatar`；保留 URL 并独立重写，不与 Anime Avatar 合并；相关文章必须使用 Profile Card 锚文本 |
| Social Cards | `social media card photos`, `AI social content images` | `AI Social Card Photos for Shareable Content and Publishing` | 文字留白、标题层级、平台比例、封面/announcement/post card 区别、品牌可读性 | 不默认 `/ai-image-generation/edit-by-prompt`；确认专属 Social Cards 生成/编辑入口；关联 Product Style、Creator Portraits、Profile Cards |

建议的 title 统一格式：

`[主题实体] + [明确用途或决策问题] | MyDreamShoots`

不要使用 `private AI photo guide` 作为 9 页统一尾巴；它几乎没有区分主题，也把产品隐私属性放在了本应表达搜索意图的位置。Meta description 应首句回答“这个页面帮谁解决什么选择”，第二句再补 source quality、credits 或 private gallery 等真实产品流程。

## 6. 推荐实施顺序

### P0：先消除索引和实体冲突

1. **修复并验证所有 9 个 URL 的 GET/HEAD/redirect 行为。** 每个 URL 必须稳定返回 200；不存在旧路径跳转链；canonical、sitemap、BlogPosting `mainEntityOfPage` 完全一致。重点重复测试 Anime URL 的 `308` 异常。
2. **独立重写 Profile Cards。** 保留其 URL、自引用 canonical 和 sitemap 收录；不要把它继续渲染成 Avatar。只有当业务明确放弃 Profile Cards 搜索意图时才考虑 301，当前更推荐保留并重写。
3. **停止通用模板继续生成这 9 页。** 在内容源增加按 slug/entity 的显式 override，生成前阻断重复 H1/title/headline、相同 related links 和主题词错配。
4. **锁定产品 CTA 合同。** Product Style 和 Social Cards 先确认真实可公开访问的产品页；在 route 未确认前，不发布误导性 CTA。

### P1：重做内容和主题集群

5. **每页按独立搜索任务重写正文。** 建议 900–1,400 个英文词作为工作区间，但不以字数作为通过条件；必须有首段直接答案、主题专属比较表、输入准备、输出检查、限制/版权边界、FAQ 和产品 CTA。
6. **删除复制式句子和无关推荐。** 每页只保留和本主题有明确决策关系的 3–5 个文章/产品链接。
7. **重写 title、meta description、H1、BlogPosting headline。** 四者使用同一个实体名，避免 URL 是 `professional-headshots` 而页面只写 `Headshot`，也避免 URL 是 `anime-avatar` 而页面只写 `Avatar`。
8. **图片语义对齐。** 为每页使用真实主题图片；alt、sitemap caption、OG image 和 BlogPosting image 统一描述该主题；给所有正文首屏图片补 width/height 或稳定 aspect-ratio。

### P1：结构化数据和站点信号

9. **修正 Organization/BlogPosting/BreadcrumbList。** 补真实 logo、author URL、publisher 一致性和 breadcrumb item；确保一页只有一个主 BlogPosting。
10. **补充 `og:type=article` 和 article 时间字段。** 仅在页面确实为文章且时间字段真实时添加；OG/Twitter 图片必须能直接返回 200 图片响应。
11. **清理 sitemap freshness。** `lastmod` 只在正文/事实/标题等重要内容改变时更新；不要所有页面随部署同步修改当前时间；`changefreq`/`priority` 不当作排名控制。
12. **审核 robots.txt 的 AI crawler 策略。** 当前一般 `User-agent: *` 允许搜索，但显式阻断 `Google-Extended`、`GPTBot`、`ClaudeBot` 等。根据是否需要 AI search/reference 流量做业务决策；不要误把 robots 规则当成 noindex 或隐私控制。

### P2：性能、真实收录和长期监控

13. 用 PageSpeed Insights/CrUX/Search Console 验证移动端和桌面端 LCP、INP、CLS；优先检查 lazy image、图片尺寸、首屏 JS/CSS、全局 mega-menu 和文章 HTML payload。
14. 在 GSC 提交/检查 sitemap，逐页使用 URL Inspection 验证：可抓取、用户声明 canonical、Google 选择 canonical、已编入索引状态。
15. 上线后 7、14、28 天记录每页 impressions、clicks、CTR、平均位置、query 覆盖、抓取异常和页面被选 canonical；用数据决定是继续扩展内容还是合并页面。

## 7. 内容源与代码实施要求

现有仓库已经有博客同步脚本、BlogPosting 生成、图片 alt 规则和 blog smoke 脚本；本次不建议另起一套页面渲染系统。实施时应沿用现有单源模型，并增加以下约束：

- 用一个按 slug 映射的 article profile 定义实体名、primary keyword、intent、product route、related links、image alt、author/review owner、evidence type 和 review date。
- 生成前做静态门禁：9 页 title/H1/headline 唯一；Profile Cards 文本不得出现 Anime Avatar 的模板段落；产品 CTA 必须是已验证 route；相关文章锚文本不得重复为 `Open Avatar theme`。
- 保留可见 FAQ，但不把 FAQ 作为主要富结果承诺；回答必须是主题事实和选择建议，不得编造固定 credits、输出数量、保证效果、训练/删除承诺或用户评价。
- `dateModified`、产品价格、credits、输出数量、版权/隐私措辞只使用有来源的事实；无证据时用保守边界语言。
- 全局模板修复必须与文章内容变更分开验收，避免把其它站点、策略页、产品页或外部域名路由带入本次范围。

## 8. 验收清单

### URL 与索引

- [ ] 9 个 URL 的 GET 返回 200；HEAD 行为已确认，不出现不一致的 308/404。
- [ ] 9 个页面都是 `index, follow`，除非明确决定合并/下线。
- [ ] canonical、sitemap loc、OG url、BlogPosting mainEntityOfPage 完全一致。
- [ ] sitemap 不包含旧 redirect URL、404 URL 或 noindex URL；lastmod 与真实更新一致。

### 页面与内容

- [ ] 每页只有一个 H1，且与页面实体一致。
- [ ] title、description、H1、首段和 BlogPosting headline 不互相冲突。
- [ ] 9 页没有共享的 substantive paragraph；5-gram Jaccard 低于项目警戒线 `0.70`，建议实际目标显著低于该阈值。
- [ ] 每页至少有 3 个主题专属事实/决策模块，而不是只替换主题名。
- [ ] Profile Cards 与 Anime Avatar 的页面实体、H1、正文、图片、CTA、schema 均独立。
- [ ] 文章正文内链为 3–5 条有语义的相关链接；无固定无关的 AI Video Add-ons/Avatar/Headshot 推荐。

### 媒体、Schema 和分享

- [ ] 图片 alt 描述真实主题，不使用占位词或错配描述。
- [ ] 文章首图尺寸稳定，OG/Twitter 图片直接可访问。
- [ ] 一页一个 BlogPosting；author、publisher、logo、image、date、headline、URL 与页面可见内容一致。
- [ ] BreadcrumbList 的 name/position/item 与页面导航一致。
- [ ] OG type、article 时间字段和 Twitter image alt 通过静态检查。

### 线上验证

- [ ] PageSpeed/CrUX 的移动端与桌面端指标已记录；不是用 HTML 体积替代 CWV。
- [ ] GSC URL Inspection 已检查 9 页的 Google-selected canonical 和 index status。
- [ ] 发布后 7/14/28 天有对比数据，且无新的 crawl anomaly、soft 404 或 duplicate without user-selected canonical。

## 9. 官方参考

- [Google：Title links](https://developers.google.com/search/docs/appearance/title-link)
- [Google：控制搜索结果摘要](https://developers.google.com/search/docs/appearance/snippet)
- [Google：规范 URL 与重复页面整合](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google：结构化数据一般政策](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Google：Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)
- [Google：Image SEO 最佳实践](https://developers.google.com/search/docs/appearance/google-images)
- [Google：Sitemap 概览](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview)
- [web.dev：Core Web Vitals](https://web.dev/articles/vitals)

本文件是审查与整改设计，不代表线上已经完成发布。现有本地 smoke 通过、代码源存在或 sitemap 已收录，都不能替代生产 URL、GSC 和性能数据验收。
