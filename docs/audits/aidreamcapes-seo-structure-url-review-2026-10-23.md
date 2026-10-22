# Aidreamcapes 整体 SEO 技术、站点结构与 URL 结构评估

- 评估时间：2026-10-22 21:00–22:30 CST
- 线上 commit：`3a4254557b10ed1610468ebbd789e393607add14`
- 对象：`site_aidreamcapes` / `https://www.aivideosugc.com`（仅本站；MyDreamShoots、EU 站只做只读比对）
- 数据来源：发布机全站爬虫（`scripts/audit-aidreamcapes-technical-seo.mjs`，392 页）、元数据探针（178 页）、源站两遍爬取基准、生产库只读查询、线上 HTML 实测

## 1. 结论摘要

| 维度 | 现状 | 判断 |
|---|---|---|
| 抓取与索引 | 392 页全 200、0 孤儿、0 canonical 不一致、0 跳板内链 | **健康** |
| 索引面结构 | 可索引 178 页里 **94 页（52.8%）是 `/ai-actors/*` 演员/场景页** | **最大的结构性问题** |
| URL 结构 | 178 个 sitemap URL 全部两段式，命名法基本一致；67 条 301/308 跳板已收敛 | **基本健康**，但缺一条可执行的 URL 规范 |
| 结构化数据 | FAQ/Breadcrumb/Organization/CollectionPage 覆盖到位；**无 Product/Offer/VideoObject** | 富结果缺口 |
| 性能 | 首页 826 KB 中 **60.2% 是内联脚本、57.8% 是 RSC flight 数据**；177 张图 0 `srcset`（已部分修复） | **瓶颈是 RSC 载荷，不是 HTML** |
| 边缘缓存 | `cf-cache-status: DYNAMIC`，HTML 不缓存 | 长期收益最大的一项，但需 Cloudflare 权限 |
| 爬虫可见性 | robots.txt 仅 `Allow: /`；`/app/*`、`/login` 只靠 noindex | 可优化 |

## 2. 技术 SEO 体检

### 2.1 抓取与索引（实测）

| 指标 | 2026-10-23 实测 | 一周前基线 | 说明 |
|---|---|---|---|
| 爬取页 / 全 200 | 392 / 392 | 402 / 402 | 页数减少是跳板地址不再被链接 |
| `brokenLinks` | **0** | 125 | 本轮清零 |
| `orphans` / `unreachableFromHome` | 0 / 0 | 0 / 0 | 无孤岛页 |
| `canonicalMismatch` | 0 | 0 | canonical 与最终 URL 一致 |
| `duplicateTitles` / `duplicateDescriptions` | 1 / 1 | 11 / 11 | 残留 1 组待查（见 §4） |
| `thinPages` | 7（全部 `/app/create/*` 私有页） | 7 | 不影响索引面 |
| `missingCanonical` | 8（`/login`、`/app/*`） | 8 | 私有页，可接受 |
| sitemap | 178 URL / 694 image / **0 video** | 同 | 无视频条目 |
| `lastmod` | 178 个互不相同，最新 2026-10-22 | 同 | 质量正常 |

### 2.2 结构化数据（26 页抽样）

```
FAQPage 52 · Question 208 · Answer 208 · BreadcrumbList 50 · CollectionPage 48
Organization 52 · ContactPoint 52 · PostalAddress 52 · ImageObject 104
PropertyValue 104 · ListItem 192 · WebSite 2 · WebPage 2 · OfferCatalog 2
```

- 覆盖到位：FAQ、面包屑、组织、集合页、图片对象。
- **缺口**：`Product` / `Offer` / `VideoObject` 完全没有。站点有大量视频素材与模板产品，却没有任何商品或视频 schema，Google 无法产出价格/评分/视频富结果。
- `Organization` 在每页重复输出（52 次 / 26 页 = 每页 2 次，含 JSON-LD 与微数据两套），属于可精简的体积项。

### 2.3 性能

| 项 | 实测 |
|---|---|
| 首页 HTML | 825 534 B |
| 其中内联 `<script>` | 497 294 B（**60.2%**） |
| 其中 RSC flight payload（`self.__next_f.push`） | 476 817 B（**57.8%**） |
| 外链 script | 12 → 14 |
| 首页图片 | 177 张；本轮后 39 张带 `srcset`（首页）、45（视频 hub）、14（图片 hub）、64（演员目录） |
| 变体文件 | 126 个 320w，2.19 MB（源文件同批 9.19 MB，**−76.2%**，DPR=1 生效） |
| 源站 TTFB（concurrency 1） | 冷 754 ms p50 / 暖 582 ms p50；p90 1325 ms |
| 源站 TTFB（concurrency 4，公开入口） | p50 1037 ms / p90 2892 ms |
| 首页可见文本/链接集合/class 集合/图片序列 | 发布前后**完全一致** |

结论：HTML 体积问题的主要来源是**把 175 张卡片的完整数据塞进 RSC 载荷**。要真正把首页压到 300 KB 以内，必须减少传给客户端的数据量（服务端分页/分段流式、或把卡片数据从 props 移出），这会触及渲染架构，风险远高于图片与缓存优化。

### 2.4 边缘与缓存

- 源站已启用站点级快照缓存（`MAX=512`、`TTL=300000`、18/18 失效触发器），`MemoryCurrent` 1.8–2.5 GB / 6 GB。
- **Cloudflare HTML 缓存未开**：线上站点 `www.aivideosugc.com` 是独立 zone，既有边缘脚本配的是 `aidreamcapes.com` zone（根因）。本轮已纠正 zone、把缓存规则与 purge 集合同源于线上 sitemap、并把 purge 接入发布流程（实测每次发布 2 次 purge 请求）。
- **待办**：开启缓存规则需要具备「Zone → Cache Rules → Edit」的凭据（当前 token 返回 `10405`）。

### 2.5 爬虫可见性与可访问性抽查

- `robots.txt` 只有 `Allow: /` 与 Sitemap 行。`/app/*`、`/login`、`/site/*` 依赖页面级 noindex，能被索引排除，但**不减少抓取预算**；建议在 robots.txt 显式 `Disallow: /app/`、`Disallow: /login`、`Disallow: /site/`（不影响已收录页面）。
- 结构化数据齐全、`canonical` 一致、H1 唯一（`missingH1: 0`、`multipleH1: 0`）、图片 alt 覆盖（抽样 104 个 ImageObject）。

## 3. 站点结构评估

### 3.1 当前信息架构

```
/                                   首页
├─ /ai-video-generation              工具 hub（18 可索引）
│   └─ /ai-video-generation/<slug>   产品/详情（部分 noindex）
├─ /ai-image-generation              工具 hub（15 可索引）
├─ /templates (3)  /industries (9)  /platforms (7)  /occasions (3)   商业目录 hub
├─ /ai-actors/<name>                 **94 个演员/场景页（noindex 为主）**
├─ /blog (6)  /guides (6)  /faq  /glossary  /inspiration
└─ 政策页 9 个
另有 214 个 noindex 媒体详情页（不进 sitemap，但被内链与详情页「More like this」引用）
```

### 3.2 结构性问题

1. **索引面被长尾页主导**：可索引 178 页中 94 页（52.8%）是 `/ai-actors/*`，正文约 280 词，商业价值远低于 4 个 hub（`/templates` 1494 词、`/industries` 1676 词、`/platforms` 587 词、`/ai-actors` 2759 词）。爬虫预算与权重集中在最不具商业意图的页面上。
2. **同一个产品在两个索引面上重复**：`/ai-video-generation/<产品>` 与 `/ai-video-generation/video-ads/<产品>` 同时存在（后者是 hub 形态），造成 title/description 重复（残留 1 组）。
3. **模板是「角色」却用产品 URL 承载**：987 条 `publicSlug` 模板详情页与工具页 URL 混在同一命名空间，导致「工具页」「模板详情」「媒体案例」三类内容无法从 URL 形态区分。
4. **14 张分类目录页缺失或不完整**：`/platforms/instagram` 之类近似 slug 404；`/occasions` 没有 hub 目录页（只有 3 个子页）；`/industries` 9 个子页与实际媒体分类覆盖不完整。
5. **noindex 与索引策略未分层**：214 个媒体详情页与 94 个演员页都在「被链接但不进索引」的状态，内链权重外流且无法评估真实曝光。

### 3.3 建议的目标结构

```
/                                   首页
├─ /ai-video-generation              工具 hub（角色维度：广告类型/场景/平台）
├─ /ai-image-generation              工具 hub
├─ /templates                        模板目录（按场景/平台/风格 facets）
├─ /industries  /platforms  /occasions   商业目录 hub
├─ /ai-actors                        演员 hub（年龄段 + 场景 + 精选）
├─ /blog  /guides  /pricing
└─ 政策页
```

- 演员页收敛为「年龄段 × 场景」组合页 + 精选演员，94 → 20–30 个可索引页。
- 媒体详情页二选一：内容足够独特的转可索引并补 `VideoObject` + sitemap video 条目；否则保留 noindex 但只从 hub 分页进入，不在可索引页里直链。
- 工具页与模板详情分离命名空间（工具 `/tools/<role>`，模板 `/templates/<slug>`），让 URL 自解释。

## 4. URL 结构评估

### 4.1 现状分布（sitemap 178）

| 前缀 | 数量 | 命名法 |
|---|---|---|
| `/ai-actors/<name>` | 94 | 名词复数 + 形容词 + 名词，无层级 |
| `/ai-video-generation/<slug>` | 18 | 工具名 + 可选修饰 |
| `/ai-image-generation/<slug>` | 15 | 同上 |
| `/industries/<slug>` | 9 | 行业名 |
| `/platforms/<slug>` | 7 | 平台名 |
| `/blog/<slug>` `/guides/<slug>` | 6 + 6 | 主题短名 |
| `/occasions/<slug>` | 3 | 节日名 |
| `/templates/<slug>` | 3 | 类型名 |
| 根级政策/商业页 | 25 | 单词或短语 |

### 4.2 评估

- **一致性**：可索引面命名法基本统一（小写、连字符、无日期、无版本后缀、长度适中）。这点做得比多数站点好。
- **不一致点**：
  1. 单复数混用（`video-ads` vs `photos` 系工具页），4 个 Photos 工具页是否改单数仍是待决项；
  2. 同义前缀并存（`/ai-actors` 与 `/ai-video-generation/ai-actors`，后者已 301）；
  3. 媒体案例与工具共用 `/ai-video-generation/` 命名空间，只靠 slug 后缀区分角色；
  4. 演员页与工具页的 slug 语义空间完全独立，无法从 URL 判断内容类型。
- **重定向策略**：67 条 301/308，运行时先于 SSR 返回；本轮把 125 条「先跳转再到达」的内链改为直连，站内跳板归零。301（永久）与 308（临时）混用是合理的：301 用于改名，308 用于别名映射。
- **缺失的规则**：没有一份可执行的 URL 规范（命名模板、长度上限、允许字符、别名与 301 的收敛规则、退役与 410 的条件），导致每次改名都要临时设计。

### 4.3 建议的 URL 规范（可增量落地，不要求大范围 301）

1. **形态**：`<集合>/<角色>[-<修饰>]`；集合限定为 `ai-video-generation | ai-image-generation | templates | industries | platforms | occasions | ai-actors | blog | guides`；角色必填、修饰可选。
2. **字符**：小写字母、数字、连字符；长度 ≤ 60；禁止下划线、大写、日期、版本号、追踪参数。
3. **别名**：同一产品只允许 1 个可索引地址；旧地址进 `publicAliases` 并返回 301/308，链接一律指向规范地址（规范由 `detailAliasOf` + `sceneSlug` 前缀证明，避免指向错误产品）。
4. **退役**：产品下线 → 保留一行 410 或 301 到最近的上位页；不保留可编辑的隐藏行（本轮已清理 69 行）。
5. **近似 slug**：目录页与 hub 必须有近似名兜底 301（`/platforms/instagram` → `/platforms/instagram-ads`）。
6. **单复数**：工具名统一用「动作/对象」而非数量词（`video-ads`），避免再出现 `photos` 与 `videos` 并存；本轮先改 4 个 Photos 页需产品确认。

## 5. 优先级路线图

| 编号 | 事项 | 影响 | 工作量 | 决策 | 停服 | 验收指标 |
|---|---|---|---|---|---|---|
| E1 | 边缘 HTML 缓存（需 Cache Rules 权限 + 已有 purge-on-commit） | 高 | 0.5 天 | 否 | 否 | 匿名请求 `cf-cache-status: HIT`；带会话 Cookie 仍 DYNAMIC |
| S1 | 演员页索引面收敛（94 → 20–30） | 高 | 3–5 天 | **是**（保留哪些演员） | 否 | 可索引页数、词数分布、孤儿为 0 |
| S2 | 媒体详情页索引策略（B4）+ video sitemap（B5） | 高 | 5–8 天 | **是** | 否 | sitemap video 条目 > 0；noindex 直链数按策略归零 |
| U1 | URL 规范成文 + 生成器按规范出地址 | 中 | 2 天 | 否 | 否 | 新增地址 100% 符合规范 |
| U2 | `/platforms/*` 近似 slug 301 兜底 | 中 | 0.5 天 | 否 | 否 | 近似 slug 404 归零 |
| U3 | 4 个 Photos 工具页统一命名 | 中 | 1 天 | **是** | 否 | 单复数一致 |
| T1 | Product/Offer/VideoObject schema | 中 | 2 天 | 否 | 否 | 富结果合格 |
| R1 | 首页 RSC 载荷瘦身（分段流式/服务端分页） | 高 | 5–8 天 | 否 | 否 | 首页 HTML < 300 KB；可见布局零变化 |
| R2 | srcset 扩展到剩余 138 张首页图 + 卡片图 | 中 | 2 天 | 否 | 否 | 目标页 100% 图带 srcset |
| W1 | 剩余 1 组重复 title/description | 低 | 0.5 天 | 否 | 否 | duplicateTitles = 0 |
| W2 | robots.txt 显式 Disallow 私有路径 | 低 | 0.5 天 | 否 | 否 | 抓取预算下降、私有页 0 索引 |
| C1 | 独立构建机 / CI（替代本地预构建） | 中 | 2–3 天 | 否 | 否 | 发布不再依赖单机内存 |

### 待决策项（附倾向与代价）

1. **演员/场景页索引面**：倾向收敛（组合页 + 精选），代价是 60+ 个现有 URL 失去索引，需要 301 到组合页或标记 noindex；若坚持保留 94 页，索引面质量与商业意图继续错配。
2. **媒体详情页**：倾向「内容独特的转可索引 + 补 video 条目」，代价是需要内容审核（禁止模板化生成）；若全部保持 noindex，则需从可索引页移除直链，站内发现性下降。
3. **模板维度 A/B**：倾向 B（保持策展 paths，只换素材），A 需要新建 `TemplateFacet` 表并重算 987 个模板详情，工作量以周计。
4. **987 条模板详情是否保留独立 URL**：倾向保留但统一到 `/templates/<slug>` 命名空间，代价是一次大规模 301（可用别名机制分批）。
5. **`aidreamcapes.com` 品牌域**：现状 410。若无品牌流量，建议记录决策并维持 410；若要引导，改 301 到 `www.aivideosugc.com` 并把品牌词挂到主域。
6. **边缘缓存方案**：Free 套餐支持 Cache Rules，但需一个具备编辑权限的凭据；升级 Pro 也能解锁更多缓存选项（成本 $25/月起）。

## 6. 执行边界（本次评估与执行均遵守）

- 只写 `site_aidreamcapes`；MyDreamShoots、EU 站零写入（哈希断言）。
- 内容改动一律字段级清单 + CAS + 回读 + 逆向清单；未导入任何历史 publication/snapshot。
- 代码发布与内容应用分开；公开页面内容只来自 `LivePage.contentJson`；未引入浏览器端公开数据请求；未写入任何内部说明到用户可见内容。
- 每次停服均由 Nginx 503 维护页覆盖（本轮两次发布实测）。
