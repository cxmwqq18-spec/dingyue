# Aidreamcapes 线上 SEO 与 sitemap 评估（2026-10-23）

评估对象：`https://www.aivideosugc.com`，线上 release `32e29d9e0`（`main` = `origin/main` = `cbff85ec5`，运行时一致）。

方法：

- 全站抓取：`scripts/audit-aidreamcapes-technical-seo.mjs`，从 sitemap 178 条出发并跟随内链，共抓取 **392 页**，耗时 116 s。
- sitemap：直接取线上 `/sitemap.xml`，解析 XML、统计命名空间/条目/`lastmod`/缓存头。
- 性能：在发布机上分别做顺序、并发 4、并发 8 的 TTFB 探针，并直连应用（`127.0.0.1:3013`）与经 Cloudflare 对比。
- 内容重复度：抽取 3 个 scene facet、2 个 age facet、2 个演员详情，取 `<main>` 正文做 5-gram Jaccard。

本轮修正了两个审计口径，避免误判：

- `imgMissingAlt` 只统计**没有 alt 属性**的图片（`alt=""` 是装饰图的正确写法），另外单列 `imgDecorativeAlt`。
- 新增 `mainWords`：只统计 `<main>` 内的正文。原来的 `words` 含导航与页脚，全站每页重复，会把薄页算厚。

## 0. 结论

1. **基础卫生全部达标**：392/392 页返回 200；`brokenLinks: 0`、`orphans: 0`、`unreachableFromHome: 0`；标题/描述重复 0；每个可索引页 canonical 自指；H1 唯一；OG/Twitter 齐全；JSON-LD 解析错误 0；robots 与 sitemap 互相指向；404 与退役地址行为正确。
2. **索引面结构失衡**：178 条 URL 中 94 条（52.8%）属于 `/ai-actors`；该区 87 条页面 `<main>` 正文少于 300 词（中位数 283 词）；31 个 `scene` facet 两两相似度 **Jaccard 0.55**，属近重复目录页。
3. **结构化数据有 4 个缺口**：全站 0 条 `VideoObject`（产品是视频）、0 条 `Product/Offer`（只有首页 1 条 `OfferCatalog`）、53 个演员详情用 `CollectionPage`（应为 `Person`/`ProfilePage`）、`SoftwareApplication` 只覆盖 13/178 页。
4. **性能是当前最大风险**：首页 HTML 819 KB（内联 RSC 492 KB + 内联 CSS 140 KB，gzip 128 KB）；TTFB 并发 1 ≈ 0.55 s，并发 4 ≈ 2.0 s，并发 8 ≈ 3.3 s，源站单进程随并发线性劣化；sitemap 本身 TTFB 1.46 s 且边缘未缓存。
5. **sitemap 合规但内容类型不全**：结构、host、canonical、图片条目都正确；`video` 条目 0 条，`changefreq`/`priority` 全量输出（Google 已忽略），边缘 `cf-cache-status: DYNAMIC`。

## 1. sitemap 逐项检查

| 检查项 | 结果 | 判定 |
| --- | --- | --- |
| XML 合法性 | `fast-xml-parser` 校验通过 | ✅ |
| 命名空间 | `sitemap/0.9` + `image:1.1` + `video:1.1` 均声明 | ✅ |
| URL 数 | 178（`<urlset>` 1 + `<url>` 178） | ✅ |
| 主机 | 178/178 为 `https://www.aivideosugc.com/` | ✅ |
| 查询串 / 大写 / 尾斜杠 | 0 / 0 / 0 | ✅ |
| 状态码 | 178/178 返回 200 | ✅ |
| canonical | 178/178 自指，`canonicalMismatch: 0` | ✅ |
| 可索引性 | 178/178 `index, follow` + `max-image-preview:large` | ✅ |
| sitemap 与可索引集一致 | 抓到的 214 个内链页全部 `noindex`，无“可索引但不在 sitemap”的页面 | ✅ |
| 孤儿 / 不可达 | 0 / 0；深度分布 `{0:1, 1:108, 2:69}`，最深 2 跳 | ✅ |
| `lastmod` | 178/178 存在、178 个互不相同，范围 `2026-10-19T06:54Z` → `2026-10-22T12:06Z`，取自页面内容更新时间 | ✅ |
| 图片条目 | 694 条（463 个去重地址），每条都有 `image:loc` + `image:title` + `image:caption`；165/178 页带图，单页最多 56 张 | ✅ |
| 视频条目 | **0** | ❌ B5 |
| `changefreq` / `priority` | 178/178 输出（weekly 166、daily 4、monthly 8；priority 0.7×143、0.8×31、0.9×3、1.0×1） | ⚠️ 无效信号，可精简 |
| 响应 | 200、`application/xml`、gzip 27.9 KB（原始 320 KB）、TTFB 1.46 s | ⚠️ 偏慢 |
| 缓存 | `s-maxage=900, stale-while-revalidate=86400`，但 `cf-cache-status: DYNAMIC` | ⚠️ C1 未开规则 |
| 引用 | robots.txt 第 5 行 `Sitemap: https://www.aivideosugc.com/sitemap.xml` | ✅ |
| host 归一化 | `http://` 与 apex 均 301 到 `https://www.aivideosugc.com/sitemap.xml` | ✅ |

## 2. sitemap 组成与内容深度

| 分区 | URL 数 | 占比 | `<main>` 词数中位数 | `<300` 词页数 |
| --- | --- | --- | --- | --- |
| `/ai-actors`（含 facet） | 94 | 52.8% | 283 | 87 |
| `/ai-video-generation` | 18 | 10.1% | 1012 | 0 |
| `/ai-image-generation` | 15 | 8.4% | 1097 | 0 |
| `/industries` | 9 | 5.1% | 519 | 0 |
| `/platforms` | 7 | 3.9% | 512 | 1（`/platforms` 81 词） |
| `/blog` | 6 | 3.4% | 1735 | 0 |
| `/guides` | 6 | 3.4% | 1624 | 0 |
| `/occasions` | 3 | 1.7% | 486 | 0 |
| `/templates` | 3 | 1.7% | 374 | 0 |
| 首页与其余 16 个根级页 | 17 | 9.6% | 328–4787（中位 587） | 0 |

全站可索引页 `<main>` 词数：min 81、p10 279、中位 328、p90 1425、max 4787；**88/178（49.4%）低于 300 词**，其中 87 条是 `/ai-actors`。

`/ai-actors` 内部构成：1 个区首页 + 53 个演员详情 + 4 个 facet 根（`age-range`、`scene`、`men`、`women`）+ 36 个 facet（`age-range` 5、`scene` 31）。

近重复抽样（`<main>` 正文，5-gram Jaccard）：

| 对比 | 相似度 |
| --- | --- |
| `scene/balcony` vs `scene/bathroom` | 0.552 |
| `scene/balcony` vs `scene/beach` | 0.551 |
| `scene/bathroom` vs `scene/beach` | 0.579 |
| `age-range/20s` vs `age-range/30s` | 0.253 |
| 演员详情 vs 演员详情（adrian vs amara） | 约 0.07（模板相同但卡片集合不同） |

结论：**53 个详情页是“模板 + 卡片集合”的薄页，31 个 scene facet 是近重复目录页**；这两块合计 84 条（47% 的 sitemap）是当前索引面质量的主要拖累。

## 3. 页面级 SEO

| 指标 | 结果（178 个可索引页） |
| --- | --- |
| Title | 长度 29–59，0 条 >60，0 条 <30（2 条 29）；重复 0 |
| Description | 长度 87–160，0 条 >160，0 条缺失；重复 0 |
| H1 | 每页恰好 1 个，缺失 0，多 H1 0 |
| Canonical | 178/178 自指 |
| robots meta | 178/178 存在 |
| OG / Twitter | `og:title`、`og:description`、`og:image`、`twitter:card` 均 178/178 |
| hreflang | 0（单语言站点，符合预期） |
| `lang` / viewport | 全部 `en` / 全部存在 |
| H2 | 中位数 3；1 页无 H2 |
| 图片 | 178 个可索引页合计 4971 张；全站 392 页中**没有 alt 属性的 0 张**；装饰性 `alt=""` 8092 处；next-gen 格式 4615 张（92.8%）；lazy 4540 张 |
| JSON-LD | 解析错误 0；`@type` 覆盖见下节 |
| 文本/HTML 比 | 中位数 1.7%（Markup 187 KB / 总 819 KB） |

## 4. 结构化数据覆盖

| 类型 | 覆盖页数 | 说明 |
| --- | --- | --- |
| Organization / ContactPoint / PostalAddress / PropertyValue / ImageObject | 178 | 全站 |
| BreadcrumbList | 177 | 仅首页没有（合理） |
| FAQPage / Question / Answer | 165 | 强项 |
| CollectionPage | 120 | 目录页；**演员详情页也用了这个类型** |
| WebPage | 38 | 工具/政策页 |
| HowTo / HowToStep | 31 | 图片与视频工具页 |
| ItemList | 21 | 列表页 |
| SoftwareApplication | 13 | 首页 + 6 个图片工具 + 6 个视频工具；`text-to-video`、`ai-twin` 等缺 |
| WebSite / SearchAction | 9 / 8 | 除首页外还出现在 8 个政策页（多余） |
| BlogPosting / Article | 5 / 5 | 博客用 BlogPosting、指南用 Article |
| OfferCatalog | 1 | 仅首页；工具页与定价页无 Product/Offer |
| **VideoObject** | **0** | 产品核心是视频，全站无视频结构化数据 |
| **Person / ProfilePage** | **0** | 53 个演员详情用 `CollectionPage`，语义不符 |
| **Service** | 0 | 可选 |

## 5. 抓取与性能

TTFB 实测（发布机，顺序与并发探针，`/ai-video-generation`）：

| 并发 | TTFB 区间 |
| --- | --- |
| 1 | 0.55 – 1.16 s |
| 4 | 1.76 – 2.38 s |
| 8 | 2.55 – 3.59 s |

直连应用 vs 经 Cloudflare：

| 页面 | 直连 TTFB | 经 CF TTFB | 字节 |
| --- | --- | --- | --- |
| `/` | 0.92 s | 1.04 s | 838 KB |
| `/ai-video-generation` | 0.48 s | 0.62 s | 540 KB |
| `/ai-actors/adrian` | 0.40 s | 0.56 s | 300 KB |
| `/pricing` | 0.42 s | 0.84 s | 304 KB |

首页载荷分解：

| 组成 | 大小 |
| --- | --- |
| 总计 | 819 KB（gzip 128 KB） |
| 内联 RSC/脚本 | 492 KB |
| 内联样式 | 140 KB |
| 标记（含 177 张图、238 条链接） | 187 KB |

其他信号：全站 0 个第三方脚本；每页 1 个同源渲染阻塞脚本（`polyfills-*.js`）；样式表 4–5 个；preload 2–10 条。

并发 4 时 TTFB 已经 2 s、并发 8 时 3.3 s，且顺序请求也不低于 0.55 s，说明**没有 HTML 级微缓存**，每个匿名请求都在重新 SSR（现有 `STOREFRONT_SNAPSHOT_CACHE` 缓存的是数据快照，不是渲染结果）。

## 6. 内部链接

| 指标 | 结果 |
| --- | --- |
| 每页唯一内链中位数 | 166（min 159、p90 181、max 255） |
| 首页 | 136 个唯一目标：导航/菜单 92、页脚 63、正文独有 24 |
| 工具页 | 149 个唯一目标：导航 92、页脚 62、正文独有 38 |
| inbound | min 4、中位 385、0 个孤儿 |

结论：导航与页脚把几乎全部 178 个页面暴露到每一页，正文独有链接只占 16–25%。链接权重被全站模板链接摊平，正文的“编辑意图”信号很弱（对应 B3）。

## 7. 问题与优先级

| 编号 | 问题 | 证据 | 建议 | 成本 |
| --- | --- | --- | --- | --- |
| S1 | 演员区薄页 + 近重复 | 87/178 页 `<main>` <300 词；scene facet Jaccard 0.55 | 合并/裁剪：详情页补正文或改为 noindex；31 个 scene facet 收敛为少量精选页 | 中（需产品决策） |
| S2 | 无视频结构化数据 | `VideoObject` 0、sitemap `video` 0 | 选定“可公开视频”集合，工具页加 `VideoObject` + video sitemap | 中（需内容决策） |
| S3 | 商业页缺 Product/Offer | 仅首页 1 条 `OfferCatalog`；工具页与 `/pricing` 无 Offer | 工具页补 `Service`/`Product` + `Offer`（价格来自 `pricing` 内容） | 低–中 |
| S4 | 演员详情 schema 语义错 | 53 页用 `CollectionPage` | 改 `Person` + `ProfilePage` + `ImageObject` | 低 |
| S5 | 首页 819 KB、SSR 0.9 s | 内联 RSC 492 KB；gzip 128 KB | 减少传给客户端组件的 JSON（首屏卡片、文案整体下发），或分块懒加载 | 中 |
| S6 | 并发即劣化 | 并发 4 → 2 s，并发 8 → 3.3 s | 开边缘 HTML 缓存（C1，缺 token 权限）；或加 revision 键控的进程内 HTML 微缓存 | 低（若拿到权限） |
| S7 | `/platforms` hub 正文 81 词 | 全页 591 词、`<main>` 81 词、167 条链接 | 补一段平台选择说明（字段级内容变更） | 低 |
| S8 | `SoftwareApplication` 覆盖不一致 | 13/178，`text-to-video`、`ai-twin` 缺 | 统一工具页模板 | 低 |
| S9 | `WebSite`/`SearchAction` 出现在 8 个政策页 | 政策页 JSON-LD | 只在首页输出 | 低 |
| S10 | sitemap 无效信号 | `changefreq`/`priority` 全量输出 | 移除（Google 忽略，减少噪音） | 极低 |
| S11 | sitemap 边缘未缓存、TTFB 1.46 s | `cf-cache-status: DYNAMIC` | 同 S6；sitemap 已带 `s-maxage=900` | 低（权限） |

## 8. 已达标、不要破坏的部分

- 392/392 页 200，0 断链、0 孤儿、0 不可达，深度 ≤2。
- 标题/描述/ H1 / canonical / robots / OG / Twitter 全量合规且无重复。
- 图片 0 张缺 alt 属性，92.8% next-gen 格式，694 条图片 sitemap 带 title + caption。
- JSON-LD 0 解析错误，FAQ/Breadcrumb/Organization 覆盖完整。
- 无第三方 JS；安全头（HSTS、CSP frame-ancestors、nosniff、referrer-policy）齐全。
- 404 与退役地址返回正确状态，robots 与 sitemap 互相引用，host 归一化正确。

## 9. 建议顺序

| 批次 | 内容 | 依赖 |
| --- | --- | --- |
| 第 1 批（无决策） | S4 Person schema、S8 统一 SoftwareApplication、S9 收敛 WebSite、S10 移除 changefreq/priority、S7 `/platforms` 补正文 | 无 |
| 第 2 批（需权限） | S6/S11 边缘缓存规则；进程内 revision 键控 HTML 微缓存 | Cloudflare token / 代码评审 |
| 第 3 批（需产品决策） | S1 演员区收敛、S2 视频结构化数据 + video sitemap、S3 商业页 Offer | 内容与索引策略 |
| 第 4 批 | S5 首页载荷瘦身 | 依赖 S1 的卡片数量决策 |

本轮评估阶段的改动只有审计口径修正，未改动线上数据、路由或页面内容。

### 9.1 第 1 批发布回读（2026-10-23，release `049fe32b7`）

代码发布（`--prebuilt-build`，停服期维护页配置预检通过，`--full-seo-contract` + `--verify-load` 均 `ok: true`，178 页契约、694 条图片、525 条近似地址全部通过）：

| 项 | 发布前 | 发布后 | 方式 |
| --- | --- | --- | --- |
| sitemap `changefreq` / `priority` | 178/178 条都输出 | 0 / 0 | 按 host 剥离，其他站点字节不变 |
| `WebSite` 出现页数 | 9 | 1（仅 `/`） | 渲染期只保留首页 |
| `SearchAction` | 8 | 0 | 无公开搜索端点，删除 |
| `SoftwareApplication` | 13（含首页） | 32 | 20 个工具详情页补齐 |
| `CollectionPage` | 120 | 68 | 53 个演员详情改为 ProfilePage，图片目录补 1 |
| `ProfilePage` / `Person` | 0 / 0 | 53 / 53 | 演员详情由页面自身 `kind/actor` 数据生成 |

同类回归（392 页抓取）：`brokenLinks: 0`、`duplicateTitles: 0`、`duplicateDescriptions: 0`、`imgMissingAlt: 0`、`orphans: 0`、`non200: 0`。MyDreamShoots sitemap 仍输出 117 条 `changefreq`、`/privacy` 仍带 `WebSite`，隔离成立。

仍未做：S7 `/platforms` 正文（内容改动，需字段级 manifest）。
