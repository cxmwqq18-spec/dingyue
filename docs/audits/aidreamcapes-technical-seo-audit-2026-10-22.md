# Aidreamcapes（www.aivideosugc.com）技术 SEO 评估

日期：2026-10-22
范围：线上 `https://www.aivideosugc.com`，178 个 sitemap URL + 227 个由内链发现的 URL，共 405 个 HTML 页面；另含 robots、sitemap、重定向、404/410、大小写、尾斜杠、查询参数、结构化数据、内链图与服务端时延。
方法：`scripts/audit-aidreamcapes-technical-seo.mjs`（只读爬取，从发布机执行以避开 CDN 对审计出口 IP 的限流）＋ 178 页正文相似度/链接图第二遍 ＋ Playwright 移动端 5 个模板的 CLS 抽样。
限制：未接入 GSC/CrUX/PageSpeed Insights；LCP/INP 只能由服务端时延与页面载荷推断，实验室 LCP 需另跑。评分是技术面评估，不含外链、品牌需求与关键词难度。

## 1 结论

**技术 SEO 总分：81 / 100（Good，但被性能明显拖累）**

抓取、索引、canonical、元数据、结构化数据这些"地基"做得相当干净；真正的问题集中在两处：**服务端渲染时延与页面体积**，以及**全局导航/页脚造成的扁平内链图**。内容层面，178 个可索引 URL 里有 94 个是演员/场景页，正文中位数约 280 词，占用了一半以上的索引面。

| 维度 | 权重 | 得分 | 主要依据 |
|---|---:|---:|---|
| 可抓取性与索引 | 20% | 86 | robots 干净、sitemap 178/178 全带 lastmod、0 非 200、0 孤儿；扣分：214 个 noindex 页面被 663 条内链指向，sitemap 无 video 条目 |
| 页面元数据 | 15% | 95 | title/description 唯一且长度全部合规、每页 1 个 H1 且无重复、OG 完整；8 页缺 `max-image-preview:large` |
| 内容质量与深度 | 15% | 76 | blog/guides 1.5–2.1k 词；演员/场景页中位 280 词却占 53% 索引面；`/platforms` hub 仅 86 词 |
| 架构与内链 | 15% | 72 | 深度 ≤2、0 孤儿；但每页 113 条全局链接、166 条内链、多数页面约 398 条入链，链接权重被摊平；708 条页脚链接指向 301 |
| 结构化数据 | 10% | 88 | Organization/WebSite/Breadcrumb/FAQ/HowTo/SoftwareApplication/BlogPosting 覆盖广；图片 URL 为相对路径，5 页缺面包屑 |
| 性能与 Core Web Vitals | 20% | 45 | TTFB p50 1.23s / p90 2.04s；首页 SSR 2.35s、809KB HTML、472KB 内联 RSC；Cloudflare 不缓存 HTML；0 个 `srcset` |
| URL 与重定向 | 5% | 92 | 小写 kebab、无参数、≤3 层、301 正确；host 归一化 2 跳、大小写 404、品牌域 410 |
| 移动与安全基础 | 5% | 95 | viewport、响应式、HSTS、brotli、nosniff、referrer-policy、证书有效 |

## 2 网站架构

### 2.1 技术架构：单一 catch-all 的全动态 SSR

- 路由：`src/app/[...path]/page.tsx` 一个 catch-all 处理所有公开路径，`export const dynamic = "force-dynamic"`、`revalidate = 0`；没有 `generateStaticParams`，也没有 ISR。
- 数据：host → site → `LivePage.contentJson`（PostgreSQL 关系数据）；`SiteContentRevision` 只是派生缓存，不作为发布源。这与仓库的 no-snapshot 契约一致。
- 渲染：`renderStorefrontPage` / `renderAidreamcapesMediaDetailPage` 按路径类型分流；legacy 路径在代码内以 301 映射表兜底。
- 元数据：`metadataForPublishedStorefrontPage` 按 LivePage 生成 title/description/canonical/robots/OG；sitemap 与 robots 是 `src/app/sitemap.xml/route.ts`、`src/app/robots.txt/route.ts` 的宿主感知 route handler。
- 交付：Next.js standalone（`server.mjs`）→ nginx → Cloudflare。静态资源 `/_next/static/*` 为 `immutable` + 1 年 + CF HIT；HTML 全部 `cf-cache-status: DYNAMIC`。

这意味着：**每一次页面访问都要打回源站做一次数据库读取和完整 SSR**。应用已经声明 `Cache-Control: public, s-maxage=300, stale-while-revalidate=1800`，但 Cloudflare 对 HTML 一律不缓存，这份声明没有生效。

### 2.2 信息架构：7 个内容支柱，索引面高度偏向演员库

| 区块 | URL 数 | 占 sitemap | 正文词数中位 | 说明 |
|---|---:|---:|---:|---|
| `/ai-actors` | 94 | 53% | 280 | 55 个演员档案 + 32 个场景 + 6 个年龄段 + 1 个 hub |
| `/ai-video-generation` | 18 | 10% | 880 | 商业能力 hub + 17 个用例 |
| `/ai-image-generation` | 15 | 8% | 1,094 | 商业能力 hub + 14 个用例 |
| `/industries` | 9 | 5% | 490 | 行业落地页 |
| `/platforms` | 7 | 4% | 505（hub 仅 86） | 本次新增的渠道目录 |
| `/blog` | 6 | 3% | 1,672 | 编辑内容 |
| `/guides` | 6 | 3% | 1,495 | 操作指南 |
| `/templates` | 3 | 2% | 362 | 模板目录 |
| `/occasions` | 3 | 2% | 475 | 场景目录 |
| 单页（首页/定价/法务等） | 17 | 10% | 306–4,758 | 首页 4,758 词 |

另有 **214 个媒体详情页**（162 个 `/ai-video-generation/*`、44 个 `/ai-image-generation/*`、7 个 `/app/*`、1 个 `/login`）被显式设为 `robots: index:false, follow:true`，不在 sitemap 中。这是有意的产品决策，但它们仍被可索引页面用 663 条内链指向。

### 2.3 内链拓扑：深度很好，但图是"平"的

- 从首页出发：106 个页面 1 击可达，71 个 2 击可达，**最大深度 2**，0 孤儿。
- 每页内链中位数 **166 条**（p90 175，最大 257）；其中 **113 条是全站导航/页脚共用链接**。
- 由于页脚几乎链接全站，大多数页面入链约 **398 条**；演员页 169、guides 73、部分法务页 8。首页与商业 hub 在链接权重上没有明显优势。
- 749 条内链指向 13 个 301 旧地址，其中 **708 条来自 4 个页脚链接 × 177 个页面**。

```
首页 (229–240 links)
 ├─ /ai-video-generation (18) ── 媒体详情 (noindex, 162)
 ├─ /ai-image-generation (15) ── 媒体详情 (noindex, 44)
 ├─ /ai-actors (94: 55 actors + 32 scenes + 6 age ranges)
 ├─ /industries (9) · /platforms (7) · /templates (3) · /occasions (3)
 ├─ /blog (6) · /guides (6)
 └─ 单页 (17)
        全局导航/页脚：113 条链接，出现在每个页面
```

## 3 URL 链路

### 3.1 主机与协议归一化

```
http://aivideosugc.com    ─301→ https://aivideosugc.com ─301→ https://www.aivideosugc.com
https://aivideosugc.com   ─301→ https://www.aivideosugc.com
https://aidreamcapes.com  ─410 Gone（品牌域，nginx 直接返回）
https://aidreamcapes.eu   ─200（独立法语站，另一套部署）
```

- 全站 canonical 只使用 `www.aivideosugc.com`，0 个 canonical 指向其它 host。
- 主机归一化是 2 跳；可以合并为 1 跳（apex 直接 301 到 `https://www`），减少一次往返。
- 品牌域 `aidreamcapes.com` 返回 410：如果它还有外链或品牌搜索流量，这部分权重目前是直接丢弃的，属于业务决策而非技术缺陷。

### 3.2 路径规则

- 全部小写、kebab-case、无扩展名、无 ID、无日期、无查询参数；最大 3 段。
- 尾斜杠：`/about-us/` → 301 → `/about-us`。
- 查询参数：`?utm_source=...` 返回 200，canonical 仍指向干净 URL（正确）。
- 模板筛选参数（`/templates|industries|platforms|occasions` + 参数）走 canonical + `noindex`，不进入 sitemap。
- 大小写：`/ABOUT-US` → 404（不是 301）。可接受，但会丢掉少量直接输入/旧外链流量。
- `/index.html`、`/undefined`、`/null` 均为 404，且 404 页带 `noindex,nofollow`，没有软 404。

### 3.3 旧地址 301 映射（13 条）

| 旧 URL | 301 目标 |
|---|---|
| `/ai-video-generation/ai-actors` | `/ai-actors` |
| `/ai-video-generation/ugc-ad-video` | `/ai-video-generation/video-ads` |
| `/ai-video-generation/product-video` | `/ai-video-generation/product-videos` |
| `/ai-video-generation/ai-actor-product-ads` | `/ai-video-generation/spokesperson-videos` |
| `/ai-image-generation/lifestyle-scene` | `/ai-image-generation/lifestyle-photos` |
| `/ai-image-generation/on-model-generation` | `/ai-image-generation/model-photos` |
| `/ai-image-generation/ecommerce-main-image` | `/ai-image-generation/white-background-photos` |
| `/ai-image-generation/background-remove-replace` | `/ai-image-generation/change-background` |
| `/ai-image-generation/feed-ad-still` | `/ai-image-generation/social-ad-photos` |
| `/blog/motion-generator-video-guide` | `/ai-video-generation/image-to-video` |
| `/blog/ecommerce-product-image-workflow` | `/blog/ai-product-photography-guide` |
| `/blog/ai-talking-photo-video-guide` | `/blog/ai-ugc-video-ads-guide` |
| `/blog/ai-content-disclosure-safe-usage` | `/blog/ai-video-review-checklist` |

全部为单跳 301 → 200，没有链式跳转；sitemap 中不含任何 301 URL。

### 3.4 sitemap 与 robots 契约

- `robots.txt`：`User-agent: *` / `Allow: /` / `Sitemap: https://www.aivideosugc.com/sitemap.xml`，无 Disallow，无 `noindex` 误伤。
- `sitemap.xml`：178 个 URL，178 个 lastmod（2026-10-19 至 2026-10-21），694 个 image 条目，0 个 video 条目；changefreq/priority 存在（Google 已忽略，无副作用）。
- sitemap 与可索引面完全一致：178 个最终 200 URL 全部在内，0 个 301、0 个 noindex 混入；sitemap 返回 `application/xml`、`s-maxage=900`（但 CF 仍 DYNAMIC，未缓存）。

## 4 评分明细

### 4.1 可抓取性与索引（86/100）

做得好：
- robots 允许全站，sitemap 声明正确；sitemap 无 301/404/noindex 污染。
- 405 个抓取 URL 全部 HTTP 200（探针除外），无 5xx、无软 404。
- canonical 全部自指且 host 统一，0 个 canonical 与最终 URL 不一致。
- 0 孤儿、最大点击深度 2。

扣分：
- 214 个 noindex 媒体页被可索引页面链接 663 次（入口：`/ai-video-generation/spokesperson-videos` 56、视频 hub 46、`video-ads` 40、首页 27）。这些页面不贡献索引价值，却持续消耗抓取预算。
- 4 个页脚链接指向 301（每条出现在 177 个页面），共 708 条。
- sitemap 无 video 条目，尽管站点有大量视频素材与视频用例页。

### 4.2 页面元数据（95/100）

- 178 个可索引 URL 的 title、description **全部唯一**（此前看到的 18 组重复都是"旧地址 301 + 新地址"被同一爬虫记录两次，按最终 URL 去重后为 0）。
- title 全部 ≤60 字符，description 全部 ≤160 且无缺失。
- 每页恰好 1 个 H1，跨页无重复；H2 中位 6 个。
- OG title/description/image 覆盖 178/178。
- 扣分：8 个页面缺少 `max-image-preview:large`（`/platforms` 与 7 个法务页）；首页 description 有标点问题：`Ai actors ,ready-to-use`。

### 4.3 内容质量与深度（76/100）

- 强项：`/blog` 6 篇中位 1,672 词、`/guides` 6 篇中位 1,495 词，标题/描述/FAQ/HowTo 结构完整；`/ai-video-generation` 与 `/ai-image-generation` 的商业用例页中位 880–1,094 词。
- 弱项：94 个演员/场景页正文中位 **280 词**（p10 269 / p90 290），占可索引 URL 的 53%；`/platforms` hub 正文仅 **86 词**；`/templates`（362 词）、`/occasions`（475 词）、`/industries`（490 词）偏薄。
- 近重复检测：178 页两两做 8-word shingle Jaccard，最高相似度 **0.497**（`/ai-actors/scene/*` 之间），没有 ≥0.6 的近重复页面对。模板化但文案有区分度。
- 首页正文 4,758 词，信息密度高，但也是 809KB HTML 的主要来源。

### 4.4 架构与内链（72/100）

- 深度与孤儿控制满分：106 个页面 1 击可达、71 个 2 击可达、0 孤儿，说明"首页 → hub → 详情"的骨架成立。
- 但每个页面有 **113 条全站共用链接**、内链中位 166 条；这直接把大多数页面的入链数推到约 398，首页/商业 hub 与法务页在链接权重上几乎没有差别，属于"扁平化过度"。
- 页脚 4 个旧博客链接（每条 177 次）把 708 条内链送进 301，是投入产出比最高的修复点。
- `/ai-actors` hub 只直接链接 55/94 个演员/场景入口，其余靠年龄段/场景页与其它页面分发；虽然深度仍 ≤2，但 hub 的目录作用被削弱。

### 4.5 结构化数据（88/100）

覆盖（178 个可索引页中出现次数）：Organization 178、ContactPoint 178、ImageObject 178、BreadcrumbList 173、FAQPage 165、CollectionPage 120、WebPage 38、HowTo 31、ItemList 21、SoftwareApplication 13、WebSite 9、BlogPosting 5、Article 5、DefinedTerm/DefinedTermSet 各 1。
- Organization 带 logo、sameAs、PostalAddress、ContactPoint；BlogPosting 带 headline/datePublished/dateModified/author/publisher/mainEntityOfPage/inLanguage；FAQPage 的 Question/Answer 与页面可见 FAQ 对应；HowTo 有 position/name/text。
- JSON-LD 全部可解析，0 个语法错误。
- 扣分：`primaryImageOfPage`、`ImageObject.url`、`BlogPosting.image`、`Article.image` 抽查均为**相对路径**（如 `/ai-image-generation/...webp`），schema.org 期望绝对 URL；5 个页面缺 BreadcrumbList（首页、`/ai-video-generation/ai-twin`、`/ai-video-generation/text-to-video`、`/templates/photo`、`/templates/video`）；`SearchAction` 只在 8 个页面出现，WebSite 声明不一致。

### 4.6 性能与 Core Web Vitals（45/100）

实测（从发布机、经 Cloudflare）：

| 页面 | SSR 耗时（server-timing） | HTML |
|---|---:|---:|
| `/` | 2,347 ms | 809 KB |
| `/ai-video-generation` | 753 ms | 509–521 KB |
| `/ai-actors` | 600 ms | 587 KB |
| `/platforms` | 733 ms | 292 KB |
| `/blog/ai-ugc-video-ads-guide` | 753 ms | 330 KB |

- 178 页顺序抓取：TTFB p50 **1,233 ms**、p90 **2,041 ms**；4 并发时 p90 升到 3.3 s，说明源站对并发敏感。
- HTML 体积 p50 **288 KB**、p90 348 KB、最大 809 KB；正文/HTML 比中位 **1.7%**（正常内容站通常 10–15%）。
- 首页：190 个 `<script>` 标签、**472 KB 内联 RSC 数据**、140 KB 内联 `<style>`、240 个 `<a>`、177 个 `<img>`。
- 首页 177 张图：176 张 `loading="lazy"`、**0 个 `srcset`**、0 个 `fetchpriority="high"`；唯一的图片 preload 是 64px 的 logo 图标。
- HTML 的 `Cache-Control` 已写 `public, s-maxage=300`，但 405/405 个页面 `cf-cache-status: DYNAMIC`——CDN 完全不缓存 HTML，每次访问都回源 SSR。
- 静态资源正常：`/_next/static/*` 为 `immutable`、1 年、CF HIT。
- 正向：brotli 全站生效；图片有 width/height；Playwright 移动端 4x CPU 降速下 5 个模板的 CLS 均为 0；无第三方分析/像素脚本；无 webfont（系统字体）。
- 未测：实验室 LCP/INP、CrUX 字段数据。以 2.3 s 的首页 SSR 与 809 KB 文档判断，移动端 LCP 很可能落在"需要改进"区间。

### 4.7 URL 与重定向（92/100）

- 小写 kebab、无参数、≤3 层、无日期/ID；301 语义正确、单跳、sitemap 干净。
- 扣分：host 归一化 2 跳；大小写路径 404；品牌域 410（业务决策）；`/platforms/instagram` 这类"看似合理"的 slug 返回 404（实际是 `/platforms/instagram-ads`），缺少近似 slug 的 301 兜底。

### 4.8 移动与安全基础（95/100）

- `viewport` 存在、响应式布局、图片有尺寸、CLS 0。
- HTTPS + HSTS（`max-age=31536000; includeSubDomains`）、brotli、`X-Content-Type-Options: nosniff`、`Referrer-Policy: strict-origin-when-cross-origin`、`CSP frame-ancestors 'self'`。
- 证书：Let's Encrypt，有效期至 2026-12-31。
- 扣分：无 `Permissions-Policy`；CSP 仅 frame-ancestors（不是 SEO 问题）。

## 5 问题清单（按影响排序）

**P1｜性能（影响最大）**
1. Cloudflare 不缓存 HTML，`s-maxage=300` 未生效；TTFB p50 1.2 s、首页 SSR 2.35 s。
2. 首页 809 KB / 472 KB 内联 RSC / 140 KB 内联 CSS；每页 166 条内链把 RSC 载荷进一步放大。
3. 全站 0 个 `srcset`、0 个 LCP `fetchpriority`；首页 177 张图全部直接 `<img>`。

**P1｜内链**
4. 4 个页脚链接指向 301，出现在 177 个页面（708 条）；另有 41 条零散旧地址内链。
5. 113 条全站共用链接 + 每页 166 条内链，导致链接权重扁平化（多数页约 398 入链）。

**P2｜索引面**
6. 214 个 noindex 媒体页被 663 条内链指向，消耗抓取预算；sitemap 无 video 条目。
7. 53% 的可索引 URL 是 280 词左右的演员/场景页，商业落地页只有 16 个（industries + platforms）。

**P2｜内容**
8. `/platforms` hub 正文 86 词，低于其 6 个子页（约 1,000 词），hub 起不到聚合作用。
9. `/templates`（362 词）、`/occasions`（475 词）、`/industries`（490 词）偏薄。

**P3｜结构化数据与元数据**
10. JSON-LD 图片为相对路径；5 页缺面包屑；8 页缺 `max-image-preview:large`（含 `/platforms`）。
11. 首页 description 标点错误 `Ai actors ,ready-to-use`。

**P3｜URL 边界**
12. 大小写 404；host 2 跳；品牌域 410；`/platforms/instagram` 无 301 兜底。

**观察（非缺陷）**
13. 从住宅/办公 IP 以非浏览器 UA 连续抓取后，CDN 会重置连接（从服务器侧抓取 405 个 URL 全部正常）。需确认 WAF/Bot Fight 不会误伤 SEO 工具与合法爬虫。
14. 站点无第三方分析脚本（可能是隐私选择），因此本次评估没有真实用户 CWV 数据。

## 6 建议（按投入产出排序）

**本周可做（不改内容模型）**
1. 在 Cloudflare 增加 HTML 的 Cache Rule：`GET`、非 `/app/*`、无登录 Cookie 时按源站 `s-maxage=300` 缓存，并配置 `stale-while-revalidate`；目标是 TTFB <500 ms、源站 SSR 降低一个数量级。若担心登录态，可对匿名请求缓存、对带会话 Cookie 的请求 bypass。
2. 把页脚 4 个旧博客链接改成最终 URL（`/blog/ai-product-photography-guide`、`/blog/ai-ugc-video-ads-guide`、`/blog/ai-video-review-checklist`、`/ai-video-generation/image-to-video`），一次消除 708 条 301 内链。
3. JSON-LD 图片 URL 改为绝对路径；给 5 个页面补 BreadcrumbList；给 8 个页面补 `max-image-preview:large`（`/platforms` 可随下一次字段级 content 更新一起做）。
4. 修正首页 description 的标点。

**两周内**
5. 导航/页脚从 113 条压到 60–80 条：演员库改为"年龄段 + 场景 + 精选演员"，其余由 `/ai-actors` hub 分发；保留商业 hub、platforms、industries、blog、guides、pricing 的直达链接。
6. 图片响应式：为卡片与 hero 生成 `srcset/sizes`，LCP 图加 `fetchpriority="high"`，首屏图去掉 `lazy`。
7. 降低首页 RSC 载荷：把 177 张卡片改为服务端分页/分段流式渲染，或把卡片数据从 props 移到客户端按需请求（仅限非公开数据；公开内容仍须 SSR 完整输出）。优先目标是首页 HTML <300 KB。

**一个月内**
8. `/platforms` hub 扩到 600–800 词，明确 6 个渠道的差异、适用品类与选择建议，并与 `/industries` 互链；这是本次新增目录的"入口页"，不应比子页更薄。
9. 演员/场景页二选一：要么补足到 500–700 词的差异化内容（场景、用法、示例脚本），要么收缩索引面（保留头部演员，其余合并到年龄段/场景页）。当前 94 页 × 280 词是"可索引但价值密度低"的典型形态。
10. 媒体库索引策略与产品级 placement 同步设计：214 个 noindex 详情页要么在内容足够独特后转为可索引并进入 sitemap（同时补 video sitemap），要么减少从可索引页面的直链，改为 hub 内分页/筛选。
11. 评估把可索引页面从 `force-dynamic` 改为 ISR（`revalidate` + 内容提交时按需 revalidate），在保持"LivePage 提交后下一次请求可见"契约的前提下，把 SSR 成本降到边缘缓存之后。

## 7 复现

```bash
# 在发布机执行（避开 CDN 对审计出口 IP 的限流）
node scripts/audit-aidreamcapes-technical-seo.mjs \
  --origin=https://www.aivideosugc.com \
  --out=/tmp/ac-seo-audit.json \
  --concurrency=4
```

第二遍（正文相似度与链接图）为临时脚本：读取 sitemap URL 列表与 noindex 路径集合，抓取 178 页、剥离 header/footer/nav 后做 8-word shingle Jaccard，并统计可索引页到 noindex 页的链接数。CLS 抽样使用 Playwright Chromium、412×915 视口、4x CPU 降速、1.6 Mbps/150 ms 网络模拟，5 个模板。

## 8 与本次发布的关系

- 审计时（2026-10-22 12:2x）线上仍是复数 URL。仓库在 12:47 的 `6ec3cdd74` 已准备
  `product-videos → product-video`、`before-after-videos → before-after-video`、
  `spokesperson-videos → spokesperson-video` 的改名与 301，但**尚未上线**；上线后
  第 3.3 节对应 3 条映射会反向，需按新 URL 复核。
- 本次 `/platforms` 页面已正确进入 sitemap（177 → 178），canonical、robots、6 个子页、6 张图片均通过回读。
- `/platforms` 目前是全站正文最薄的 hub（86 词），且 robots 少了 `max-image-preview:large`；建议作为下一次字段级内容更新的第一项。
- 媒体详情页的 `noindex, follow` 是既有设计，不是本次发布引入的回归；但它与产品级 placement 的后续批次直接相关，建议在 batch 3 之前确定"索引 / 不索引"的最终策略。
