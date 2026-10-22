# Aidreamcapes 技术 SEO 整改计划

日期：2026-10-22
依据：[技术 SEO 评估](../audits/aidreamcapes-technical-seo-audit-2026-10-22.md)
范围：`https://www.aivideosugc.com`（`site_aidreamcapes`）
目标：把技术评分从 81 提升到 90+，并保持“LivePage 提交后下一次请求可见”的仓库契约。

## 0. 执行摘要

审计把问题集中在三处：**源站 SSR 与页面体积**、**全局内链过平**、**演员/场景页内容偏薄**。本计划按“先测量、再改架构；先代码/配置、再内容”的顺序推进。

五个最高投入产出比的动作：

1. **调大现有 revision-keyed 缓存**：生产已启用缓存，但 `STOREFRONT_SNAPSHOT_CACHE_MAX=8`，178 个页面轮流访问会立即把缓存冲掉，导致几乎每次都是冷读。全站 `LivePage.contentJson` 合计仅约 4.2 MB，缓存条目很便宜，应先做容量与失效覆盖验证，再把 MAX 提到 256–512、TTL 设为 0（仅靠 revision 失效）。
2. **修掉首页载荷**：首页 829 KB HTML、约 472 KB 内联 RSC、140 KB 内联 CSS、177 张图 0 个 `srcset`。先做 LCP 图和 `srcset`，再决定首页卡片数量与 RSC 裁剪。
3. **内链治理**：页脚 4 条旧博客链接的 708 条 301 内链已随 `b0b68c1a` 修复（首页已验证，全站待复核）；下一步把全局链接从 113 压到 70–80，并给 noindex 媒体页的 663 条内链设预算。
4. **`/platforms` hub 扩写**：86 词 → 600–800 词，作为渠道目录的入口页，与 6 个子页和 `/industries` 互链。
5. **结构化数据收口**：JSON-LD 图片绝对 URL、5 页面包屑、8 页 `max-image-preview:large`、首页 description 标点。

明确不做：

- 不在没有 purge-on-commit 的情况下直接打开 Cloudflare HTML 缓存；这会违反“内容提交后下一次请求可见”的契约。
- 不批量生成 94 个演员页或 285 个产品组；内容按 3–10 页/批、产品按 30–50 组/批推进。
- 不恢复、导入或回退任何历史快照；不做跨店铺的共享层改动。
- 不 stage/commit 工作区中其它 agent 未提交的复数 s 改名改动。

## 1. 基线复核（2026-10-22 13:24）

审计快照时间为 12:2x。之后生产已部署 `b0b68c1a`（13:24），因此部分结论需要按当前线上状态修正。

### 1.1 已关闭或已具备条件

| 项 | 状态 | 证据 |
|---|---|---|
| `/platforms` 页面生产发布 | 已完成 | 178 个 sitemap URL，页面 200，店铺隔离通过 |
| 页脚 4 条旧博客链接 | **已修复，待全站复核** | `b0b68c1a` 首页已 0 条 `/blog/motion-generator-video-guide` 等旧链接；`4cec901ff` 已包含 footer 过滤逻辑 |
| 构建堆上限 | 已完成 | `edb086696`，默认 8192 MB；**源站实际不可用于构建**，改走本地预构建上传（见审计文档第 7 节） |
| 生产缓存开关 | 已启用 | `STOREFRONT_SNAPSHOT_CACHE_SITES=site_aidreamcapes` |
| 缓存容量 | **已调整到 512** | 2026-10-22 18:19 上线 `f21a03ae4`；`MemoryCurrent` 2.46–2.70 GB / 6 GB |
| 缓存失效覆盖 | **已补齐 18/18** | 迁移 `20261022160000` 已在生产应用，门禁 `ok: true`、`uncovered: []` |
| P0-2 重复 `ssr` 计时 | **已修复上线** | 线上单组 `Server-Timing`；HTML 逐字节不变 |
| 复数→单数 URL 改名 | **未上线** | 线上 `/product-video` 仍 301 到 `/product-videos`；`/spokesperson-video`、`/before-after-video` 仍 404 |

### 1.2 当前仍存在的问题（按影响）

| ID | 问题 | 当前证据 | 影响 |
|---|---|---|---|
| P0-1 | ~~缓存容量过小~~ **已关闭（18:19 上线）** | `MAX=512` + 18/18 触发器；生产门禁 `ok: true` | — |
| P0-2 | ~~传输层重复处理~~ **已关闭（18:19 上线）** | 线上单组 `ssr` 计时；HTML 字节不变 | — |
| P0-3 | 图片无 `srcset`、无 LCP 优先级 | 首页 177 张图，0 个 `srcset`，0 个 `fetchpriority` | LCP、移动端流量 |
| P0-4 | 全局内链过平 + noindex 链接过多 | 审计时每页 113 条全局链接、166 条内链；663 条指向 214 个 noindex 页 | 链接权重、抓取效率 |
| P1-1 | `/platforms` hub 过薄 | 正文 86 词 | 目录页无聚合价值 |
| P1-2 | 演员/场景页占索引面 53% | 94 页，正文中位 280 词 | 内容质量、索引价值密度 |
| P1-3 | 薄 hub | industries 490 词、templates 362 词、occasions 475 词 | 商业落地页竞争力 |
| P1-4 | 结构化数据/元数据缺口 | 生产探针已 0 缺口（178/178）；首页 description 标点待改 | 富结果、元数据完整性 |
| P2-1 | 媒体索引策略未定 | 214 个 noindex 页；sitemap 0 个 video 条目 | 与 placement batch 3 耦合 |
| P2-2 | URL 边界 | host 2 跳、大小写 404、品牌域 410、`/platforms/instagram` 404 | 少量流量与体验 |
| P2-3 | 缺少持续门禁 | 已有缓存失效覆盖门禁 + 元数据探针 + SEO smoke 新断言；内链 301、体积预算尚未纳入 | 回归风险 |

### 1.3 新增技术发现

**缓存命中率被 MAX=8 抵消。**
`getCachedPublicRuntimeState` 的 key 是 `siteId + pageSlugs + contextSlug`。178 个页面意味着至少 178 个 key，而 LRU 只保留 8 个；顺序爬取时每个请求都会把上一个条目挤掉。实测：

- `/ai-actors` 冷读 `ssr ~1.67 s`，第二次、第三次 `~0.53 s`。
- 首页冷读 `~1.62 s`，热读 `~0.95–1.29 s`（仍有渲染成本）。
- 全站 `LivePage.contentJson` 合计约 4.2 MB（本地关系库 269 行，均值 16 KB，最大 112 KB），缓存条目本身不贵；生产条目还要加上导航、产品、媒体等关联数据，需按 RSS 实测。

**实测后修正（2026-10-22，详见 [缓存审计报告](../audits/aidreamcapes-cache-revision-audit-2026-10-22.md)）**：
工作集是 **288 个 key**（不是 178），`MAX=256` 仍会每轮淘汰 601 次；`MAX=512` 淘汰 0 次。
失效覆盖有 **3 个缺口**：`StripeConnectAccount`（结账可用性）、`AiApp`（工具卡片文案）、
`VideoThemeExample`（提示词示例）被公共投影读取但没有触发器，已补迁移。
另：`DINGYUE_ENV=local` 会让 slug 路径绕过修订缓存，本地命中率不可代表生产。

**传输层存在重复处理迹象。**
每个 HTML 响应带两组 `ssr;dur`，且两次的 HTML 字节数固定相差 33 字节（例如 587508 / 587541、829369 / 829402）。`server.mjs` 会全量缓冲 HTML、重排 `<head>`、重设 `content-length`，再写回。需要确认是“两层拦截器”还是“两次渲染”；无论哪种，都应改为一次渲染、一次 head 重排、尽早 flush。

**CDN HTML 缓存与仓库契约冲突。**
应用已声明 `s-maxage=300`，但 Cloudflare 对 HTML 返回 `DYNAMIC`。如果直接打开 Cache Rule，内容提交后最多 5 分钟才可见，违反 AGENTS.md 的“下一次请求可见”规则。正确顺序是：先把源站 revision-keyed 缓存调好；确有需要时，再实现“内容提交 → 按 URL purge → 允许边缘缓存”，并做契约测试。不要只加 Cache Rule。

## 2. 目标与验收指标

| 指标 | 审计基线（12:2x） | 当前（13:24 复核） | 30 天 | 60 天 | 90 天 | 测量方法 |
|---|---:|---:|---:|---:|---:|---|
| 技术评分 | 81 | 待复跑 | ≥85 | ≥88 | ≥91 | 审计脚本 |
| TTFB p50（178 页顺序爬取） | 1,233 ms | 待复跑 | ≤700 ms | ≤500 ms | ≤400 ms | 发布机顺序爬取 |
| TTFB p90 | 2,041 ms | 待复跑 | ≤1,400 ms | ≤1,000 ms | ≤800 ms | 同上 |
| 首页 SSR | 2,347 ms | 1,619 ms 冷 / 946–1,292 ms 热 | ≤1,600 ms | ≤1,100 ms | ≤850 ms | `Server-Timing` |
| 首页 HTML | 809 KB | 829 KB | ≤500 KB | ≤450 KB | ≤350 KB | `content-length` |
| 首页内联 RSC | 472 KB | 待测 | ≤300 KB | ≤200 KB | ≤150 KB | 解析 `self.__next_f` |
| 全局链接/页 | 113 | 待复跑 | ≤90 | ≤80 | ≤70 | 爬虫 |
| 内链中位数/页 | 166 | 待复跑 | ≤130 | ≤110 | ≤95 | 爬虫 |
| 指向 301 的内链 | 749（其中 708 已修） | 预计 ≈41 | 0 | 0 | 0 | 爬虫 + 重定向 map |
| 指向 noindex 的内链 | 663 | 待复跑 | ≤300 | ≤150 | ≤80 | 爬虫 |
| `/platforms` hub 正文 | 86 词 | 86 词 | ≥600 词 | ≥600 词 | ≥700 词 | 正文抽取 |
| 演员/场景页中位词数 | 280 | 待复跑 | 决策 | ≥500（被索引子集） | ≥500 | 正文抽取 |
| JSON-LD 绝对图片 URL | 0% | 待复跑 | 100% | 100% | 100% | JSON-LD 校验 |
| BreadcrumbList 覆盖 | 173/178 | 待复跑 | 178/178 | 178/178 | 178/178 | 页面解析 |
| `max-image-preview:large` | 170/178 | 待复跑 | 178/178 | 178/178 | 178/178 | meta 解析 |
| LCP（移动端 lab） | 未测 | 未测 | 建立基线 | ≤2.5 s | ≤2.5 s | Playwright/PSI |
| CLS（移动端 lab） | 0 | 0 | ≤0.05 | ≤0.05 | ≤0.05 | Playwright |

说明：

- 30 天目标只包含“缓存调优 + 快赢代码/元数据”；60/90 天目标才假设首页载荷和内链改造完成。
- 审计中的 749 条 301 内链已随 `b0b68c1a` 的页脚修复大幅下降；以复跑结果为准，不要用 749 作为当前值汇报。
- 评分是按权重的技术面估计，不替代 GSC/CrUX 字段数据；接入后应把 LCP/INP 的真实值补进本表。

## 3. 整改工作流

### 优先级总览

| ID | 优先级 | 工作项 | 类型 | 影响 | 工作量 | 依赖 |
|---|---|---|---|---|---|---|
| P0-1 | P0 | 缓存容量与失效验证 | 运维配置 + 只读代码审计 | TTFB、源站负载 | 0.5–1 人日 | 无 |
| P0-2 | P0 | 传输层去重与流式化 | 代码 | TTFB、内存 | 1–2 人日 | 先定位层级 |
| P0-3 | P0 | 首页载荷与图片 | 代码 + 内容决策 | LCP、HTML 体积 | 5–8 人日 | 图片资产管线 |
| P0-4 | P0 | 内链治理 | 代码 + 内容 | 链接权重、抓取 | 4–6 人日 | 导航信息架构 |
| P1-1 | P1 | `/platforms` hub 扩写 | 内容 | 目录聚合 | 1–2 人日 | 字段级 manifest |
| P1-2 | P1 | 薄 hub 扩写 | 内容 | 商业落地页 | 3–5 人日 | 分 3 批 |
| P1-3 | P1 | 演员/场景索引策略 | 决策 + 内容 | 索引质量 | 决策 1 人日，执行另计 | GSC/使用数据 |
| P1-4 | P1 | 结构化数据与元数据 | 代码 + 内容 | 富结果 | 1–2 人日 | 无 |
| P2-1 | P2 | 媒体索引与 video sitemap | 内容 + 代码 | 索引面 | 与 batch 3 同步 | placement 决策 |
| P2-2 | P2 | URL 边界 | 运维 + 代码 + 业务 | 少量流量 | 1–2 人日 | 业务确认 |
| P2-3 | P2 | 监控与门禁 | 代码/流程 | 防回归 | 2–3 人日 | 现有 smoke |
| P0-0 | P0 | 复数→单数 URL 迁移 | 内容（独立发布） | URL 一致性 | 已有脚本，待执行 | 代码 map + 内容迁移同步 |

### P0-1 运行时缓存调优

> **执行结果（2026-10-22，见 [缓存审计报告](../audits/aidreamcapes-cache-revision-audit-2026-10-22.md)）**
>
> 本节的初始假设有两处被实测推翻，已按实测结论修正：
>
> 1. **失效覆盖有 3 个真实缺口**：`StripeConnectAccount`、`AiApp`、`VideoThemeExample` 都被公共投影读取但没有触发器。已通过迁移 `20261022160000_close_site_content_revision_gaps` 补齐。
> 2. **工作集是 288 个 key，不是 178 个页面**。`MAX=256` 仍然每轮淘汰 601 次，必须用 `MAX=512`。
>
> 另有一个方法论陷阱：`DINGYUE_ENV=local` 时 `instantDraftPreviewEnabled()` 为真，
> `getStorefrontPublicRuntimeStateBySlug` 会直接回源、**完全绕过修订缓存**。
> 本地开发模式下测出的命中率不能代表生产，所有数字均在
> `DINGYUE_ENV=production` 等价环境下重测。
>
> 实测对比（177 个 sitemap URL、连续 3 遍、并发 1）：
>
> | 配置 | 关系库全量读取 | 缓存命中 | 淘汰次数 | 不同 key | `mapSize` |
> |---|---|---|---|---|---|
> | `MAX=8`（现生产值） | 681 | 390 | 949 | 288 | 8 |
> | `MAX=256` | 589 | 482 | 609 | 288 | 256 |
> | `MAX=512` | **196** | 1059 | **0** | 288 | 288 |
>
> 内存（`--expose-gc` 强制 GC 后）：`MAX=512` 下 `heapUsed` 稳定在 ≈1.09 GB，
> RSS 峰值 ≈2.4 GB、稳态 ≈1.9 GB，在 6 GB cgroup 与 3.5 GB V8 堆上限内。
>
> 正确性已验证：字段级 CAS 提交 `LivePage.contentJson` 后**下一次请求**即返回新标题
> （无需重启），逆向 manifest 还原后 `contentJson` MD5 与原值逐字节一致；
> 8 个并发冷请求只触发 2 次关系库读取。
>
> 生产目标值：`STOREFRONT_SNAPSHOT_CACHE_MAX=512`，`TTL` 保持 `300000`。
> 生产变更待审批窗口执行。

**问题**
生产已启用 revision-keyed 公共缓存，但 `STOREFRONT_SNAPSHOT_CACHE_MAX=8`、`TTL=300000`。178 个页面顺序访问会不断淘汰，缓存命中率接近 0；热读与冷读差距约 3 倍。

**改动**
1. 只读审计 `SiteContentRevision` 的失效覆盖：确认所有影响公开状态的写路径都会 bump revision（`LivePage`、导航/内容块、`MediaAsset`、`Product`、`CreativePack`、域名/站点设置等）。如果存在未覆盖的表，先补触发器或写入路径，再调大缓存。
   - 已完成。新增 `scripts/audit-aidreamcapes-cache-revision-coverage.mjs` 作为可重复门禁：对比公共投影实际读取的 18 张表与数据库中实际存在的触发器，有未覆盖表即非零退出。
2. 在候选环境设置：
   - `STOREFRONT_SNAPSHOT_CACHE_MAX=512`（实测工作集 288，256 会抖动）
   - `STOREFRONT_SNAPSHOT_CACHE_TTL_MS=300000`（保留非零 TTL）
     - 每次请求都先比对 revision，命中与否与 TTL 无关，所以 TTL 不会延迟失效；
       它只在“某个写路径漏 bump revision”时提供最多 5 分钟的有界自愈。
     - 代价实测：TTL 是**绝对过期**（`createdAt + TTL`）。连续爬取时每 5 分钟会有一次
       整批回源；空闲超过 5 分钟后第一遍爬取也会整批回源（实测 333 s 空闲 → 单遍 192 次读取，
       热缓存单遍为 0 次）。192 次读取合计约 4–6 s，相对于整站请求量可以忽略，
       且 in-flight collapse 保证同一 key 的并发冷读只回源一次。
     - 因此不设为 0：`MAX=512` 的收益已经由容量拿到，用 5 分钟 TTL 换取“漏触发器”时的自愈能力。
3. 顺序爬取 178 页两遍，记录第一遍/第二遍 TTFB p50/p90、进程 RSS、`systemctl show -p MemoryCurrent`。
4. 若 RSS < 2.5 GB 且第二遍 p50 明显下降，升到 512；若 RSS > 2.8 GB，回退到 128。
5. 把最终值写入当前 release 的 `.env.local`（部署脚本会从 `$BASE/.env.local` 复制到新 release），并记录到运维 runbook，避免下次部署回退。

**正确性测试（必须先做）**
- 本地/候选环境：提交一次 `LivePage` 字段更新（走正式字段级 manifest），下一次请求必须看到新内容；再用 inverse manifest 回退。
  - 已完成。注意公共页面的 `<title>` 来自 `LivePage.contentJson` 的 `seo.title`，**不是** `LivePage.title` 列；按 `title` 列改不会影响页面。
- 并发测试：4 并发冷启动，确认 in-flight collapse 生效，只有一次关系库读取。
  - 已完成（8 并发 → 2 次关系库读取）。
- 失败路径：revision 探测失败时必须回源，不能回退旧缓存；确认代码现有行为。
  - 已确认：`readSiteContentRevision()` 返回 `null` 时 `getCachedPublicRuntimeState()` 直接 `return loader()`，回源而不回退旧缓存。

**验收**
- 第二次全站爬取 TTFB p50 ≤700 ms、p90 ≤1.4 s。
- 缓存条目数 ≥178，RSS 稳定在 2.8 GB 以下。
- 内容提交后下一次请求可见（本地/候选证据）。
- 生产健康检查、404、canonical、重定向不受影响。

**回滚**
把 `STOREFRONT_SNAPSHOT_CACHE_MAX` 调回 8、`TTL` 调回 300000，重启服务；不涉及数据变更。

**风险**
- revision 触发器覆盖不全 → 读到旧内容。这是本项唯一的硬风险，必须先审计。
  - 已通过 3 个新触发器 + 可重复门禁脚本收敛。
- 内存增长 → 设置在 6 GB cgroup、3.5 GB V8 堆下要留余量；按 RSS 阶梯调整。
  - 已实测：`MAX=512` 堆占用 ≈1.09 GB，在限值内。
- **缓存扩容到其他站点**：`bump_site_content_revision()` 的守卫写死 `site_aidreamcapes`，门禁脚本会因其它站点缺触发器而失败。扩容前需另开迁移放宽守卫。

**生产落地（2026-10-22 18:19，`f21a03ae4`）**

| 检查项 | 结果 |
|---|---|
| 迁移 | `20261022160000_close_site_content_revision_gaps` 已应用 |
| 覆盖门禁 | `ok: true`、18/18、`uncovered: []`、`revision=280` |
| 缓存配置 | `MAX=512`、`TTL=300000` |
| 内存 | `MemoryCurrent` 2.46–2.70 GB（cgroup 6 GB）、health `rssMb≈2575` |
| 维护页 | 停服 6–14 s 期间 3 次采样为 `503` + 维护文案，18:19:30 恢复 200 |
| 源站两遍爬取 | 178/178 全 200 |

**构建约束**：源站（15 GB，另有 4 个站点常驻）无法完成 webpack 构建——8 GB 堆在第 874 s
OOM，10 GB 堆把机器压到 0 可用内存。改用**本地干净 worktree 预构建 + `--prebuilt-build`**，
与线上上一版 `38faa0861…` 的产物形态一致（同样带 `.build-commit` 和本机路径）。

### P0-2 传输层去重与流式化

**问题**
每个 HTML 响应出现两组 `ssr;dur`，字节数相差 33；`server.mjs` 全量缓冲 HTML 后重排 `<head>`。可能是两层拦截器，也可能是两次渲染，当前没有请求级 trace 区分。

**根因已定位（2026-10-22，本地复现）**

不是两次 SSR，也不是 `server.mjs` 装了两层拦截器。真实链路是：

1. `src/middleware.ts` 对 storefront HTML 不是 `NextResponse.rewrite`，而是**同进程内部 `fetch`**：
   `sameServerStorefrontUrl(request)` 把 `/privacy` 变成 `/site/aidreamcapes/privacy`，
   并向该内部请求写入 `x-storefront-head-seo-reorder-skip: 1`（`middleware.ts:1063-1095`）。
2. 这个内部请求同样经过 `server.mjs` 的 `interceptHtmlResponse()`，于是**第一次**缓冲 + 重排 + 写
   `Server-Timing`（实测 `/privacy` 291721 bytes）。
3. 中间件拿到内部响应后，用 `new Headers(upstreamResponse.headers)` 原样继承头（含 `Server-Timing`），
   再做**第二次** `rewriteStorefrontHtmlFull()` 重排（291754 bytes，+33 bytes），最后 `end` 时
   `server.mjs` 又追加一组 transport timing → 客户端看到两组 `ssr;dur`。

证据（本地，Node 22，`Host: www.aivideosugc.com`）：

- 每次客户端请求只产生两次 `response.end`，分别属于 `/privacy` 与 `/site/aidreamcapes/privacy` 两个响应对象；
  每个响应对象只被拦截一次。
- 外层响应 `end` 时 `getHeader("Server-Timing")` 已等于内层那一组
  `ssr;dur=406.3, html;dur=406.3;desc="291721 bytes"`。
- 因此：**没有重复渲染**，多出来的是「内部跳 + 双重 head 重排 + 计时头泄漏」，
  成本约为每页一次 290–830 KB 的二次字符串正则重排（实测 2–36 ms）。

**结论**
`server.mjs` 没有遵守中间件已经发出的 `x-storefront-head-seo-reorder-skip: 1` 约定。

**改动**
1. 在 `server.mjs` 的拦截路径和 Next 响应路径加一次性 request id / 计数日志（只在 `STOREFRONT_PROFILE=1` 时输出），确认层级。
   - 已完成（临时探针，已移除）。结论见上。
2. 让 `server.mjs` 遵守 `x-storefront-head-seo-reorder-skip: 1`：带该头的内部请求不再安装 HTML 拦截器，
   head 重排只在外层做一次，`Server-Timing` 也只留一组。
   - 该头由中间件对**所有** storefront 内部请求写入，直接全局改动会影响 MyDreamShoots 的传输行为，
     需要单独批准；Aidreamcapes 单站收口可先加 host 判定（`aidreamcapes`/`aivideosugc`）。
   - **已按单站收口实现（2026-10-22）**：`skipsInternalHtmlIntercept()` 只在
     `x-storefront-head-seo-reorder-skip: 1` 且 host 命中 aidreamcapes/aivideosugc 时跳过拦截。
   - 本地验证：`/`、`/privacy`、`/templates/photo`、`/blog/ai-video-review-checklist`、
     `/ai-video-generation/ai-twin` 五页修复前后 **HTML 逐字节相同**（827384 / 289375 / 306370 /
     336628 / 385626 bytes），只有响应头从两组 `ssr;dur` 变成一组。
   - MyDreamShoots 仍走原路径（实测仍是两组计时、字节数不变），EU 站也不受影响。
   - 生产实测可省掉每页一次 290–830 KB 的二次重排，`/` 的 827 KB 页面约省 30–70 ms 传输层开销。
3. 把全量缓冲改为“只缓冲到 `</head>`，之后流式写出”；保留 `content-length` 时需谨慎，流式下改为 chunked 或先计算头部长度。
4. 评估 `request.headers["accept-encoding"] = "identity"`：当前由 nginx/Cloudflare 压缩，用户侧无影响；不要为了省源站带宽而引入新的压缩风险。此项只记录，不优先改。

**验收**
- 每个 HTML 响应只有一组 `ssr` 计时。
- 首页 `ssr` 降低 ≥20 ms；不引入可见内容差异（按标题、canonical、JSON-LD、robots、正文链接逐项对比，而不是按字节数对比）。
- title/canonical/JSON-LD/robots 的顺序和内容不变；SEO smoke 全绿。
- 大页面（首页、`/ai-actors`、`/ai-video-generation`）无截断。

**生产验证（2026-10-22 18:19，`f21a03ae4`）**：`/privacy` 响应头只剩一组
`server-timing: ssr;dur=…, html;dur=…`；HTML 字节数与修复前一致；MyDreamShoots
与 EU 站仍为两组，未受影响。

**回滚**
回退 `server.mjs` 到上一版本；这是纯代码发布，不涉及内容。

**风险**
head 重排逻辑对 JSON-LD 去重、title 位置有副作用；必须用现有 SEO smoke 和 3 个大页面做逐标签对比。

### P0-3 首页载荷与图片

拆成四个子项，按顺序做。

#### P0-3a LCP 图片优先级（代码，先做）

- 识别每个模板的首屏主图（首页 hero、hub hero、媒体详情主图）。
- 首屏主图：`fetchpriority="high"`、去掉 `loading="lazy"`、`decoding="async"`。
- 在 `<head>` 中 preload 首屏主图（有 `srcset` 时用 `imagesrcset`/`imagesizes`）。
- 其余图片保持 lazy；不要给所有图片加 high。

验收：移动端 lab LCP 建立基线并下降；CLS 不变；首屏图片请求提前。

#### P0-3b `srcset`/`sizes`（代码 + 资产管线）

- 为卡片图、hub 图、详情主图生成 320/640/960/1280 宽度变体（WebP；如构建成本可接受再加 AVIF）。
- 卡片：`sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"`（按实际布局调）。
- 详情主图：`sizes="(max-width: 768px) 100vw, 640px"`。
- 保留 `width`/`height`，避免 CLS。
- 如果自建变体成本过高，评估 Cloudflare Image Resizing（付费）或仅对首屏/卡片做变体，不要求一次覆盖 177 张。

验收：首页和 3 个 hub 的图片请求出现 `srcset`；移动端图片传输量下降 ≥30%；LCP 不退化；CLS ≤0.05。

#### P0-3c 首页 RSC/卡片裁剪（代码 + 内容决策）

- 先量：解析 `self.__next_f`，按区块统计 RSC 字节；确认是大卡片数据、导航数据还是重复 props。
- 确保卡片是 server component；客户端组件只接收必要字段（id、href、标题、图片、alt），不要传整页对象。
- 内容决策：首页展示的媒体卡片从 177 张降到 60–80 张，完整库留在 hub 页；这是 UX/内容决策，不以“SEO 需要”为由保留全部卡片。
- 不为公开内容引入客户端按需请求；公开内容仍须 SSR 完整输出。

验收：首页 HTML ≤500 KB（30 天）/≤450 KB（60 天）；RSC ≤300 KB/≤200 KB；首页仍保留到各 hub 的入口；sitemap URL 数不变。

#### P0-3d 内联 CSS（代码，后做）

- 140 KB 内联 `<style>` 是首页 HTML 的重要部分；把主题 CSS 移到 `/_next/static` 的可缓存文件，只保留首屏 critical CSS。
- 用 Playwright 对比首屏渲染，避免 FOUC。

验收：首页内联 CSS ≤40 KB；CSS 文件命中 CF HIT；CLS 不退化。

**总回滚**：按子项独立回退；图片变体保留原图，CSS 保留内联开关。

### P0-4 内链治理

#### P0-4a 页脚 301（已修复，补门禁）

- `b0b68c1a` 已上线 `4cec901ff` 的 footer 过滤；当前首页 0 条旧博客链接。
- 复跑全站，确认 177 个页面的 708 条链接归零；剩余约 41 条零散旧地址内链单独清理。
- 在 SEO smoke 中加“可索引页不得链接到 redirect map 的 source”断言。

#### P0-4b 全局导航压缩（代码 + 内容）

目标：113 → 70–80 条。

- 头部保留：AI Video、AI Image、AI Actors、Industries、Platforms、Templates、Occasions、Pricing、Blog、Guides。
- 页脚保留：产品 6–8、用例 8–10、资源 6、公司/法务 6–8。
- 演员库从全局导航移除长列表，只保留 `/ai-actors`、6 个年龄段、6 个精选场景；其余由 hub 分发。
- 视频用例从 35 条压到 10–12 条；其余由 `/ai-video-generation` hub 分发。
- 内容团队确认标签与分组；工程改 `src/lib/aidreamcapes-navigation.ts`。

验收：全局链接 ≤80；178 个 URL 仍 ≤2 击可达、0 孤儿；所有 sitemap URL 200；无新增 301 内链。

#### P0-4c 演员 hub 完整性（代码/内容）

- `/ai-actors` 当前只直接链接 55/94 个入口；改为分组目录：年龄段（6）、场景（32）、演员（55），确保 94 个入口都能从 hub 直达或一跳进入。
- 不为了减链接而让演员页变成孤儿。

验收：hub 覆盖 94/94；深度 ≤2；0 孤儿。

#### P0-4d noindex 媒体页链接预算（代码/内容）

- 商业 hub 的媒体网格从 40–56 条降到 12–24 条；详情页“相关媒体”从 27 条降到 6 条。
- 完整媒体库保留在 hub 的分页/筛选视图中；公开内容仍 SSR 输出，不引入客户端抓取。
- 目标：663 → ≤300（30 天）→ ≤150（60 天）→ ≤80（90 天）。

验收：可索引页到 noindex 页的链接数达标；媒体页仍有可用入口；不产生新的软 404。

### P1-1 `/platforms` hub 扩写（内容）

**问题**
`/platforms` 是本次新增目录的入口页，但正文只有 86 词，低于 6 个子页（约 1,000 词）。

**改动**
- 目标 600–800 词，面向用户写，不写 SEO 策略/页面结构说明。
- 建议结构：
  1. 这个目录解决什么问题（按渠道选视频形态）。
  2. 6 个渠道的差异：适合的品类、常见画幅、时长、 Hook 风格。
  3. 如何选择：3–4 个决策场景。
  4. 与 `/industries`、`/ai-video-generation/video-ads` 的内链。
  5. 3–5 个 FAQ（与页面可见 FAQ 一致）。
- 同步补 `max-image-preview:large`（如果代码默认尚未上线）。

**类型/位置**
内容；`LivePage.slug=/platforms` 的 `contentJson` 字段级更新。

**流程**
1. 读取当前行，记录 `updatedAt`/内容 hash。
2. 生成字段级 manifest（只改正文/FAQ/SEO 字段，不动其它字段）。
3. 人工审稿：确认没有内部信息、没有生成提示、没有未经验证的数据。
4. CAS 应用；回读 DB 和 origin HTML；记录 planHash、revision、commit。
5. 准备 inverse manifest。

**验收**
- 正文 ≥600 词；6 个子页链接；FAQ 与 JSON-LD 一致；canonical/robots 不变；sitemap 仍 178。
- 无 301 内链；移动端排版正常。

### P1-2 薄 hub 扩写（内容）

优先级：`/industries`（商业意图最强）> `/occasions` > `/templates`。

- `/industries` 9 页，当前中位 490 词 → 600–800 词；补行业场景、合规/品牌注意事项、示例输出。
- `/occasions` 3 页，475 词 → 600–800 词；补时间线、素材清单、常见错误。
- `/templates` 3 页，362 词 → 600–800 词；补适用场景、输入要求、输出示例。

按 3 页/批推进，每批独立 manifest + CAS；批间复跑近重复检测（8-word shingle Jaccard <0.6）。

### P1-3 演员/场景索引策略（决策门）

**现状**
94 页、正文中位 280 词，占 sitemap 53%。这是“可索引但价值密度低”的典型形态。

**先决策，不先写**
用 GSC（如已接入）或站内使用数据，按演员/场景看 impressions、clicks、conversions、关联媒体/产品数。第 3 周做一次决策会，三选一：

- **A（推荐）**：保留头部 20–30 个演员/场景，补到 500–700 词差异化内容；其余改为 `noindex,follow`，保留页面供用户访问，从 sitemap 移除。
- **B**：全部 94 页分批补到 500+ 词；仅在数据证明长尾有价值时采用。
- **C**：把场景页合并进演员页（301）；改动最大，暂不推荐。

**执行要求**
- 走字段级 manifest 更新正文和 robots 字段；sitemap 自动复核。
- 不批量生成模板文案；每批 6–10 页，人工审稿。
- 与媒体 placement batch 3 协调：有真实产品/媒体支撑的演员页优先。

**验收**
- 被索引的演员页 ≥500 词，近重复 <0.6。
- noindex 页不在 sitemap；仍有可用入口；不产生孤儿。
- 决策记录写入审计文档，附数据依据。

### P1-4 结构化数据与元数据（代码 + 内容）

| 子项 | 改动 | 类型 | 文件 |
|---|---|---|---|
| JSON-LD 图片绝对 URL | `ImageObject.url`、`primaryImageOfPage`、`BlogPosting.image`、`Article.image` 统一转绝对 URL；幂等，避免二次前缀 | 代码 | `src/lib/theme/json-ld.ts` |
| 5 页面包屑 | v2 存储图没有 BreadcrumbList，渲染层按当前路由补一条（首页不加单条面包屑） | 代码 | `src/lib/theme/json-ld.ts` |
| `max-image-preview` | 可索引页默认 `large`；noindex 页不加；显式内容值优先 | 代码 | `src/lib/storefront-context/core.ts` |
| 首页 description | `Ai actors ,ready-to-use` → 正确标点与文案 | 内容 | `home` LivePage |
| SearchAction 一致性 | 要么 178 页统一，要么全部移除；不做 8 页特例 | 代码 | JSON-LD 构建器 |

**执行结果（2026-10-22）**

生产 178 个 URL 逐页探针（`scripts/audit-aidreamcapes-metadata-gaps.mjs`，全部 200）：
9 页缺 `max-image-preview`（全部是 policy/directory 页），5 页缺 BreadcrumbList。

两类缺口都在**渲染层**收口，不写内容行：

1. **面包屑**：5 页都是 `aidreamcapes_v2_page`，JSON-LD 直接来自 `LivePage.contentJson.seo.jsonLd` 的存储图，
   绕过了 `buildStorefrontJsonLd()` 里的 `breadcrumbs()`。存储图里没有 BreadcrumbList 时，
   由 `aidreamcapesV2JsonLd()` 按当前 canonical 路由补一条，首页（深度 0）不加。
   该分支本身有 `site.id === "site_aidreamcapes"` 守卫，其它站点输出不变。
2. **`max-image-preview`**：这 9 页的 `contentJson.seo.robots` 里本来就没有该字段。
   它是 meta 指令而不是页面文案，和 `index`/`follow` 的默认值同类，所以在
   `resolveSeo()` 里对 `site_aidreamcapes` 的**可索引**页默认 `large`；
   内容里显式写了 `none`/`standard` 时仍然以内容为准。守卫同样限定站点，MyDreamShoots 不变。
3. **JSON-LD 相对图片**：10 个 blog/guide 页的存储图里 `image` 是站内相对路径
   （例如 `/ai-image-generation/rd1-…-cover-r1.webp`）。v2 存储图在输出前统一把
   `image`/`contentUrl`/`thumbnailUrl`/`logo`/`url`/`@id` 等字段的相对值解析成绝对 URL，
   幂等（已是绝对 URL 的值不动），仍然只在 `site_aidreamcapes` 的 v2 分支生效。

**本地验证（2026-10-22，178 个 sitemap URL）**

```
node scripts/audit-aidreamcapes-metadata-gaps.mjs \
  --origin=http://127.0.0.1:3100 --host=www.aivideosugc.com
```

| 指标 | 修复前（生产） | 修复后（本地候选） |
|---|---|---|
| 缺 `max-image-preview` | 9 | **0** |
| 缺 BreadcrumbList | 5 | **0**（首页按约定例外） |
| JSON-LD 相对图片页 | 10 | **0** |
| JSON-LD 无法解析 | 0 | **0** |

`scripts/smoke-aidreamcapes-seo-contract.mjs` 在同一构建上通过（exit 0，
32 个目标页 + 178 个 sitemap 页 + 67 条重定向）。

门禁：`scripts/smoke-aidreamcapes-seo-contract.mjs` 新增断言——导航目标页、policy 页、
`/templates/photo`、`/templates/video` 必须同时具备 `max-image-preview:large` 与至少两级 BreadcrumbList。

**验收**
- 178 个可索引页 JSON-LD 可解析；图片字段 100% 绝对 URL。
- Breadcrumb 覆盖率 178/178（首页按约定例外需记录）。
- `max-image-preview` 覆盖 178/178 可索引页。
- 首页 description 无标点错误；OG/Twitter 同步。

**生产验证（2026-10-22 18:19，`f21a03ae4` 上线后，178 个 URL）**

| 指标 | 结果 |
|---|---|
| 缺 `max-image-preview` | 0 |
| 缺 BreadcrumbList | 0（首页记为约定例外） |
| JSON-LD 相对图片页 | 0 |
| JSON-LD 无法解析 | 0 |
| HTTP 状态 | 178/178 = 200 |

仍待内容侧处理：首页 description 标点、SearchAction 与站点实际搜索路径一致性。

### P2-1 媒体索引与 video sitemap（与 batch 3 联动）

**决策**
214 个媒体详情页当前 `noindex,follow`，不在 sitemap，却被 663 条内链指向。与“一素材=一产品”的 placement 设计一起决定：

- 若媒体页能获得独特的产品文案（标题、描述、规格、使用场景、真实目录），选 30–50 个试点转为可索引，进 sitemap，并补 video sitemap。
- 若内容仍以模板为主，保持 noindex，执行 P0-4d 的链接预算。

**video sitemap**
- 只为确实有视频文件/播放器的页面添加 `<video:video>`：`thumbnail_loc`、`title`、`description`、`content_loc` 或 `player_loc`。
- 用 XML 校验与 Google 视频索引要求检查；没有真实视频的页面不要凑数。

**验收**
- 试点媒体页有独特正文 ≥300 词、canonical 自指、200、无 301。
- sitemap video 条目可解析；不混入 noindex/301。
- 与 batch 3 的 30–50 组产品一一对应，不做 214 页全量。

### P2-2 URL 边界（运维 + 代码 + 业务）

| 项 | 动作 | 类型 | 验收 |
|---|---|---|---|
| host 2 跳 | nginx/Cloudflare：apex http 直接 301 到 `https://www`，路径保留 | 运维 | `http://aivideosugc.com/x` 一跳；`https://aivideosugc.com/x` 一跳 |
| 大小写 404 | middleware 对已知路由做 lowercase 301（仅 GET/HEAD，保留 query） | 代码 | `/ABOUT-US` → 301 `/about-us`；无循环 |
| 品牌域 410 | 业务决策：保持 410（并确认无外链/广告）或 301 到 `https://www.aivideosugc.com`（路径保留） | 业务 + 运维 | 决策记录；若 301，单跳 |
| `/platforms/instagram` 404 | 仅在有 404 日志/广告需求时加 alias 到 `/platforms/instagram-ads`；不猜测所有 slug | 代码 | 指定 alias 301；不掩盖真实 404 |

### P2-3 监控与门禁

**扩展现有 `scripts/smoke-aidreamcapes-seo-contract.mjs`**
1. 内链完整性：抓 sitemap 页面，解析 `<a>`，断言没有链接到 `aidreamcapes-site-v2-redirects.json` 的 source，也没有链接到实际返回 301 的 URL（允许白名单：登录/账户等私有路径）。
2. JSON-LD：所有 `ImageObject.url`/`primaryImageOfPage`/`BlogPosting.image` 为绝对 URL。
3. Breadcrumb 与 `max-image-preview` 覆盖率。
4. HTML 体积预算：首页/三个 hub/三个详情模板，超预算先警告，稳定后改为失败。

**新增 `scripts/smoke-aidreamcapes-performance.mjs`**
- 对候选实例跑首页、`/ai-video-generation`、`/ai-actors`、`/platforms`、一个媒体详情页、一篇 blog。
- 记录 `server-timing ssr`、HTML bytes、TTFB；冷/热各 3 次；输出 JSON。
- 门禁阈值按第 2 节 30/60/90 天目标分阶段设置。

**持续测量**
- 每周从发布机跑一次 `scripts/audit-aidreamcapes-technical-seo.mjs`，对比 p50/p90、HTML、内链、评分。
- 接入 GSC/Bing：验证属性、提交 sitemap、每周看 Coverage/Enhancements；接入 CrUX/PSI 看真实 LCP/INP。
- 生产健康检查加缓存条目数/命中计数（仅在 `STOREFRONT_PROFILE=1` 输出，避免常态开销）。

## 4. 发布排期

### 第 1 周（测量 + 快赢）

| 天 | 动作 | 类型 | 产出 |
|---|---|---|---|
| D1 | 复跑审计，更新基线；确认页脚 301 归零 | 测量 | 新审计 JSON/报告 |
| D1–D2 | P0-1 revision 覆盖只读审计；候选环境缓存 256/0 测试 | 运维/代码审计 | 缓存测试记录 |
| D2 | P0-2 传输层 trace，确认双计时来源 | 代码 | 定位结论 |
| D3 | P1-4 JSON-LD/面包屑/robots 代码 PR | 代码 | PR + smoke |
| D3–D4 | P0-4a 全站 301 内链复核；加 smoke 断言 | 代码 | PR |
| D4 | P1-1 `/platforms` hub 文案 + manifest | 内容 | manifest + 审稿 |
| D5 | P0-3a LCP 图片优先级 | 代码 | PR |

### 第 2 周（性能与内链骨架）

| 动作 | 类型 | 产出 |
|---|---|---|
| P0-1 生产缓存参数上调 + 重启 + 复测 | 运维 | 生产 TTFB 前后对比 |
| P1-1 `/platforms` hub 发布 + 回读 | 内容 | planHash/readback |
| P0-4b 导航压缩设计与评审 | 内容/代码 | 新导航表 |
| P0-4c 演员 hub 完整性 | 代码/内容 | hub 94/94 |
| P0-3b 图片变体管线 + 首批 `srcset` | 代码 | 首页/3 hub |
| P2-2 host 1 跳 | 运维 | 一跳验证 |

### 第 3–4 周（载荷与内容批次）

| 动作 | 类型 | 产出 |
|---|---|---|
| P0-3c 首页卡片/RSC 裁剪 | 代码 + 内容 | 首页 ≤500 KB |
| P0-3d 内联 CSS 外置 | 代码 | 内联 CSS ≤40 KB |
| P0-4d noindex 链接预算 | 代码/内容 | ≤300 |
| P1-2 industries 第 1 批（3 页） | 内容 | manifest + 回读 |
| P1-3 演员决策会 | 决策 | A/B/C 记录 |
| P2-3 性能 smoke + 周审计 | 代码/流程 | 门禁上线 |

### 第 30–90 天

- 第 5–6 周：P1-2 剩余批次；P1-3 方案 A/B 执行（如批准）；P2-1 媒体试点与 video sitemap；第 2 次审计。
- 第 7–8 周：P0-3 收尾；导航/内链复测；第 3 次审计。
- 第 9–12 周：P1-3 收尾；URL 边界清理；第 4 次审计与 90 天复盘。

### 独立发布：P0-0 复数→单数 URL 迁移

- 当前线上运行的是 `b0b68c1a`，但内容仍是复数 URL；`/product-video` 仍 301 到 `/product-videos`，另外两个单数 URL 404。
- 迁移必须把“内容 slug + 内链/导航 + 301 方向 + sitemap”作为一个原子批次；先 dry-run，再字段级 manifest + CAS，最后回读。
- 与 SEO 整改**分开发布**，避免把排名变化归因到错误的改动。
- 上线后按审计 §3.3 复核 3 条反向映射；确认无链式 301、sitemap 无旧 URL。
- 不要 stage/commit 工作区中其它 agent 未提交的复数 s 改动；先协调。

## 5. 内容变更与发布流程

所有公开内容写入必须满足：

1. **字段级 manifest**：只改目标字段；记录 `siteId=site_aidreamcapes`、slug、字段路径、旧值 hash、新值。
2. **CAS**：以当前 `updatedAt` 或内容 hash 为条件；不匹配则停止，线上编辑优先。
3. **审稿**：只放面向用户的公开文案；SEO 策略、页面结构、生成提示、编辑说明不得进入页面（包括 HTML 注释、隐藏 DOM、前端变量）。
4. **回读**：DB 行 + origin HTML + canonical/robots/sitemap 三项复核。
5. **inverse manifest**：准备可回退的字段级反向清单；不用快照回滚。
6. **记录**：planHash、`SiteContentRevision`、部署 commit、回读时间写入审计文档。

批次限制：

- 内容页：每批 3–10 页（industries 3 页/批，occasions/templates 3–6 页/批）；先 industries，再 occasions，再 templates。
- 产品 placement：30–50 组/批；不处理剩余 285 组。
- 演员页：6–10 页/批；先决策，后执行。

代码发布与内容发布分离：

- 代码 PR 只带代码/测试/文档；不夹带内容写入。
- 内容 manifest 独立执行；不与代码部署同一窗口，除非是同一功能的必要内容（例如 `/platforms` 首次发布）。
- 每次发布前 `git diff --name-only` 检查 Aidreamcapes 范围；共享层改动若可能影响 MyDreamShoots，先停下请求批准。

## 6. 验证命令与门禁

```bash
# 1) 技术审计（发布机执行，避开 CDN 对办公 IP 的限流）
node scripts/audit-aidreamcapes-technical-seo.mjs \
  --origin=https://www.aivideosugc.com \
  --out=/tmp/ac-seo-audit-$(date +%Y%m%d-%H%M).json \
  --concurrency=4

# 2) SEO 契约 smoke（候选实例）
AIDREAMCAPES_SEO_ORIGIN=http://127.0.0.1:3002 \
  node scripts/smoke-aidreamcapes-seo-contract.mjs

# 3) 性能 smoke（新增）
AIDREAMCAPES_PERF_ORIGIN=http://127.0.0.1:3002 \
  node scripts/smoke-aidreamcapes-performance.mjs

# 4) 重定向方向复核
for u in /ai-video-generation/product-video /ai-video-generation/product-videos \
         /ai-video-generation/spokesperson-video /ai-video-generation/spokesperson-videos \
         /ai-video-generation/before-after-video /ai-video-generation/before-after-videos; do
  printf '%s ' "$u"
  curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "https://www.aivideosugc.com$u"
done

# 5) 缓存冷/热对比（发布机）
for i in 1 2 3; do
  curl -sS -o /dev/null -D- https://www.aivideosugc.com/ai-actors \
    | grep -i '^server-timing'
done
```

发布门禁（建议顺序）：

- [ ] `git diff --name-only` 全部在 Aidreamcapes 范围。
- [ ] 代码构建通过；8 GB 堆不 OOM。
- [ ] SEO smoke 全绿（含新增内链/JSON-LD/面包屑断言）。
- [ ] 性能 smoke 不低于当前基线，且达到阶段目标。
- [ ] sitemap 178 个 URL 全 200、canonical 自指、无 noindex/301 混入。
- [ ] 0 条可索引页 → 301 source 的内链。
- [ ] 内容 manifest 已 CAS、回读、准备 inverse。
- [ ] 生产回读：首页、`/platforms`、3 个改名 URL、1 个媒体详情页。
- [ ] 店铺隔离：MyDreamShoots 路由/内容/资产无变化。

## 7. 风险登记

| 风险 | 触发 | 影响 | 缓解 | 回滚 |
|---|---|---|---|---|
| 缓存读到旧内容 | revision 触发器覆盖不全 | 违反“下一次请求可见” | 先做失效覆盖审计；本地/候选提交测试 | 调回 MAX=8/TTL=300000 |
| 缓存内存增长 | MAX 过大 | OOM/重启 | 256→512 阶梯；监控 RSS；2.8 GB 上限 | 降 MAX |
| CDN 缓存导致陈旧 | 只加 Cache Rule，无 purge | 内容延迟 5 分钟 | 不先开；如开，先做提交→purge→契约测试 | 关闭 Cache Rule |
| 导航压缩丢发现 | 移除过多入口 | 页面变孤儿/深度 >2 | 复跑爬虫；0 孤儿/深度 ≤2 门禁 | 回退导航配置 |
| 首页裁剪影响转化 | 卡片减少 | 展示/点击下降 | 保留 hub 入口；A/B 或分阶段 | 恢复卡片数 |
| 图片变体视觉回归 | srcset/sizes 配错 | LCP/CLS 退化 | Playwright 截图 + CLS；保留原图 | 回退组件 |
| 内容与线上编辑冲突 | CAS 失败 | 覆盖他人修改 | 停止，线上编辑优先；重新生成 manifest | inverse manifest |
| 并发 agent 改动 | 工作区未提交文件 | 误提交/冲突 | 只 stage 自己的文件；发布前 diff | 不提交他人文件 |
| URL 迁移方向错 | 代码 map 与内容不一致 | 301 循环/404 | dry-run + 6 URL 矩阵测试 | 回退 map/内容 |

## 8. 度量与复盘

每周固定看：

- TTFB p50/p90（冷/热）、首页 SSR、HTML/RSC 体积。
- 全局链接、内链中位数、301 内链、noindex 内链、深度/孤儿。
- sitemap URL 数、200/canonical/noindex、video 条目。
- `/platforms`、industries、actors 的正文词数与近重复。
- 缓存条目数、RSS、重启次数。
- GSC Coverage/Enhancements、CrUX/PSI（接入后）。

30/60/90 天各做一次复盘：

- 对照第 2 节目标，记录达成/未达成及原因。
- 未达成项不自动延期；先判断是“测量问题”“发布未上线”还是“方案无效”。
- 每次复盘更新本计划的状态列，不覆盖历史记录。

## 9. 附：不做清单

- 不用 Cloudflare HTML 缓存替代源站优化；没有 purge-on-commit 就不开。
- 不为了“看起来是 SSR”而保留 177 张首页卡片；公开内容仍须 SSR，但数量是内容决策。
- 不批量生成演员/场景/产品文案；不做 285 组全量。
- 不用历史快照、`ThemePage.draftJson`/`publishedJson` 或客户端 fetch 作为公开数据源。
- 不改 MyDreamShoots 的数据、路由、内容、资产或部署记录。
- 不在 Aidreamcapes 任务中改共享模板/导航/主题默认值；如必须改，先请求批准。
- 不把 SEO 策略、页面结构说明、生成提示写进任何用户可见区域。
