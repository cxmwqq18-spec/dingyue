# Aidreamcapes（site_aidreamcapes）未解决问题与整改方案

- 采集时间：2026-10-22 15:26–15:55 CST（UTC 07:26–07:55）
- 线上运行提交：`38faa08614ce59656b817791390746bc70e49b7c`（`origin/main` = `f6d252770`，相对运行提交只有 `docs/` 与 `scripts/` 差异，`src/` 无变更，运行时无漂移）
- 数据所有者：`site_aidreamcapes` 的 PostgreSQL `LivePage.contentJson` / `LivePage.slug`
- 范围：仅 `www.aivideosugc.com`（`site_aidreamcapes`）。MyDreamShoots、Aidreamcapes EU、Aidreamshoots EU 不在范围内，本文对它们只做只读比对。

## 0. 证据来源

| 文件 | 内容 |
| --- | --- |
| `docs/audits/aidreamcapes-technical-seo-audit-production-2026-10-22.json` | 只读技术 SEO 爬虫：sitemap 178 URL + 内链发现 224 URL，共 402 页全部 200 |
| `docs/audits/aidreamcapes-open-issues-db-audit-2026-10-22.json` | 生产库只读查询：重定向源行、退役路径行、页面类型分布 |
| `docs/audits/aidreamcapes-open-issues-http-probe-2026-10-22.json` | 上述行的逐条 HTTP 回读（状态码、Location、canonical、robots） |
| `docs/audits/aidreamcapes-plural-s-rename-production-apply-2026-10-22.json` | 本次改名生产应用清单与回读 |
| `docs/audits/aidreamcapes-technical-seo-audit-2026-10-22.md` | 上一轮技术 SEO 评估（改名上线前，本文对照使用） |
| `docs/audits/aidreamcapes-chain-remediation-2026-10-22.md` | 链路整改实施记录 |
| `docs/audits/aidreamcapes-detail-url-normalization-release-2026-10-22.md` | 并行工作流的详情地址规范化记录（含其已知遗留项） |

复现命令（必须在发布机执行；本地出口被 CDN 重置）：

```bash
node scripts/audit-aidreamcapes-technical-seo.mjs \
  --origin=https://www.aivideosugc.com \
  --out=/tmp/aidc-tech-seo.json --concurrency=6
```

## 1. 总览

| 编号 | 问题 | 级别 | 类型 | 状态 |
| --- | --- | --- | --- | --- |
| A1 | 41 条 LivePage 行是 301 重定向源 | P2 | 数据一致性 | 未解决 |
| A2 | 16 条 Save The Date 退役 URL 的 LivePage 行残留 | P2 | 数据一致性 | 未解决 |
| B1 | 41 条内链指向 301 旧地址 | P2 | 内容 / 内链 | 未解决 |
| B2 | 84 条内链指向 308 旧工作台地址 | P3 | 内容 / 内链 | 已登记为已知遗留 |
| B3 | 全站导航+页脚链接压平链接权重 | P1 | 内链架构 | 未解决 |
| B4 | 216 个 noindex 媒体页被大量内链指向（上一轮 663 条） | P1 | 索引策略 | 待决策 |
| B5 | sitemap 无 video 条目 | P3 | 索引面 | 未解决 |
| C1 | Cloudflare 不缓存 HTML | P1 | 性能 / 边缘 | 未解决 |
| C2 | HTML 体积过大（首页 827 KB） | P1 | 性能 | 未解决 |
| C3 | 全站 0 srcset、0 LCP fetchpriority | P2 | 性能 | 未解决 |
| C4 | 发布机 fresh build 堆上限 OOM | P1 | 运维 | 未解决 |
| D1 | 9 个可索引页缺 `max-image-preview:large` | P2 | 元数据 | 未解决 |
| D2 | 5 页缺 BreadcrumbList | P3 | 结构化数据 | 未解决 |
| D3 | `BlogPosting.image` 使用相对路径 | P3 | 结构化数据 | 未解决 |
| D4 | 首页 description 标点错误 | P2 | 元数据 | 未解决 |
| D5 | 94 个演员/场景页正文约 280 词 | P2 | 内容深度 | 未解决 |
| D6 | 4 个 Photos 工具页是否改单数 | P3 | 待产品决策 | 未解决 |
| D7 | 3 个行业映射待确认 | P3 | 待内容确认 | 未解决 |
| D8 | 开放索引前置：GSC 数据 + 案例独立正文 | P3 | 前置工作 | 未解决 |
| D9 | 命名清单把 `/occasions` 记为目录页 | P3 | 文档 | 未解决 |
| E1 | host 归一化 2 跳 | P3 | URL | 未解决 |
| E2 | 大小写路径 404 | P3 | URL | 未解决 |
| E3 | 近似 slug 无 301 兜底 | P3 | URL | 未解决 |
| E4 | 品牌域 `aidreamcapes.com` 410 | P3 | 业务决策 | 现状保留 |
| F1 | release 归档不含 `docs/`，服务器侧写审计清单失败 | P2 | 工具链 | 脚本已修，目录问题仍在 |
| F2 | CDN 重置本地非浏览器出口连接 | P3 | 环境 | 已固化做法 |

上一轮评估中已被修复、不再是待办的问题：页脚 708 条指向 301 的博客链接（现为 0）、canonical 与最终 URL 不一致（0）、孤儿页（0）、`/platforms` 86 词薄页（现 587 词）、`/templates` 362 词（现 1494 词）、`/industries` 490 词（现 1676 词）。

## 2. 数据一致性

### A1｜41 条 LivePage 行是 301 重定向源（P2）

现象：生产库 `site_aidreamcapes` 有 41 个 `LivePage` 行的 slug 同时出现在 `src/lib/aidreamcapes-site-v2-redirects.json` 的重定向源位置。运行时重定向表优先，41 条全部返回 301，这些行永远不会被渲染。

证据：

```text
redirectSourceRowCount: 41   （missingTargets: 0，全部目标页存在）
HTTP: 41 条全部 301，无 200
示例: /ai-image-generation/carousel-set → /ai-image-generation/social-ad-photos
      /ai-video-generation/hook-lab → /ai-video-generation/video-ads
      /creators-circle → /contact-us   /search → /templates   /tools → /ai-video-generation
```

影响：同一地址存在「重定向表」和「LivePage 行」两个来源，内容修改会写到不可见行上；`LivePage` 行数（267）与可索引面（178）长期背离，审计与统计口径容易出错。

整改：

1. 生成字段级删除清单（只含 `site_aidreamcapes` 这 41 行的 `id`、当前 `slug`、当前 `updatedAt`）；
2. 以 `updatedAt` 做 CAS 删除，冲突行跳过并单独记录；
3. 重定向表保留不动，删除后立即回读这 41 个地址仍为单跳 301；
4. 保留逆向清单（行 id + 删除前内容快照），需要恢复时按 CAS 重建行，不恢复历史快照。

验收：生产库 `redirectSourceRows` = 0；41 个地址 HTTP 仍 301；sitemap 仍无这 41 个地址；`SiteContentRevision` 前进且健康探针回读一致。

### A2｜16 条 Save The Date 退役 URL 的 LivePage 行残留（P2）

现象：`aidreamcapes.com` 已下线 Save The Date 产品，代码侧退役清单（`isRetiredAidreamcapesPublicPath` / `AIDREAMCAPES_GONE_PUBLIC_PATHS`）让这些地址返回 404/410，但库里仍有 16 行内容。

证据（HTTP 回读）：

| 行数 | 状态 | 地址 |
| --- | --- | --- |
| 12 | 404 | `/ai-save-the-date/{christmas,fathers-day,halloween,mothers-day,new-year,thanksgiving,wedding-anniversary,wedding-ceremony}`、`/ai-video-generation/{save-the-date,wedding-ceremony,wedding-invitation}`、`/best-save-the-date` |
| 4 | 410 | `/ai-save-the-date/{save-the-date,valentines-day,engagement,proposal}` |

影响：退役产品内容仍占用数据所有者行数；若退役清单未来被误删，这些页面会直接以旧内容复活并被索引。

整改：

1. 与 A1 合并为同一份删除清单（同样字段级 CAS，行数 41 + 16 = 57）；
2. 删除前回读这 16 个地址仍为 404/410；
3. 代码侧退役清单保留（它是运行时闸门，不依赖数据行）。

验收：库内退役行 = 0；16 个地址状态码不变；`/ai-save-the-date/*` 不出现在 sitemap、导航与内链中。

## 3. 内链与索引面

### B1｜41 条内链指向 301 旧地址（P2）

现象：402 页爬取发现 125 条指向重定向地址的内链（来自 55 个来源页），其中 41 条跳到 301 旧公开地址（来自 13 个页面，多为 blog / guides 正文），另有 84 条跳到 308 旧工作台地址（B2）。没有真正的 404 内链。

证据（41 条 301 内链的目标）：

| 次数 | 旧地址 | 最终地址 |
| --- | --- | --- |
| 13 | `/ai-video-generation/ai-actors` | `/ai-actors` |
| 8 | `/ai-image-generation/lifestyle-scene` | `/ai-image-generation/lifestyle-photos` |
| 6 | `/ai-video-generation/ugc-ad-video` | `/ai-video-generation/video-ads` |
| 5 | `/ai-image-generation/background-remove-replace` | `/ai-image-generation/change-background` |
| 4 | `/ai-image-generation/on-model-generation` | `/ai-image-generation/model-photos` |
| 2 | `/ai-image-generation/ecommerce-main-image` | `/ai-image-generation/white-background-photos` |
| 2 | `/ai-image-generation/feed-ad-still` | `/ai-image-generation/social-ad-photos` |
| 1 | `/ai-video-generation/ai-actor-product-ads` | `/ai-video-generation/spokesperson-video` |

整改：字段级改写这 41 处 `href` 为最终地址（清单需包含当前 `href` 与目标 `href`，CAS 写入 `contentJson`）；不改任何其它字段。改写后复跑爬虫，指向重定向的内链应为 0。

补充说明：这 8 个旧地址本身返回 301 且 canonical 指向新地址，爬虫记录的「可索引但不在 sitemap」的 8 页正是它们，不构成重复索引问题；问题只在于仍有内链送流量过去。

### B2｜84 条内链指向 308 旧工作台地址（P3，已登记遗留）

现象：84 条 308 内链来自 42 个来源页（41 个媒体详情页 + `/ai-video-generation` hub），每页 2 条，指向 `<label>-ai-video-generation` 旧工作台地址，例如：

```text
/ai-video-generation/lifestyle-app-recommendation-ai-video-generation → 308 → /ai-video-generation/lifestyle-app-recommendation
/ai-video-generation/streamer-reaction-app-ai-video-generation         → 308 → /ai-video-generation/streamer-reaction-app
```

这属于并行工作流已记录的「已知遗留锚点」：落地地址已规范，链接仍走一次 308。整改：与 B1 合并为一次字段级改写，直接写 308 目标地址；不改动任何 `publicSlug` / `detailAliasOf` 语义字段。

### B3｜全站导航 + 页脚压平链接权重（P1）

现象：每页 165 条内链（首页 226 条，全站中位 164）；可索引页入链中位 395、最大 402，首页入链 402，而 `/platforms` 仅 20 条入链。链接权重在首页、商业 hub 与法务页之间几乎没有差别。

整改：

1. 导航/页脚从 113 条压到 60–80 条：演员库改为「年龄段 + 场景 + 精选演员」，其余由 `/ai-actors` hub 分发；
2. 保留商业 hub、`/platforms`、`/industries`、`/blog`、`/guides`、`/pricing` 直达链接；
3. 每次压缩后复跑爬虫，确认 0 孤儿、深度仍 ≤2。

### B4｜216 个 noindex 媒体页被 663 条内链指向（P1，待决策）

现象：216 个媒体详情页为 `noindex, follow`，不在 sitemap，但仍被可索引页面链接（上一轮评估为 663 条，入口集中在 `/ai-video-generation`、`/ai-actors` 与首页）。这是产品级索引决策，不是代码缺陷。

整改（二选一，需产品确认）：

1. 内容足够独特的详情页转可索引并进入 sitemap（同时补 B5 的 video 条目）；或
2. 保持 noindex，但从可索引页面移除直链，改为 hub 内分页/筛选。

在决策前不得批量删除内链，也不得自动把详情页改为可索引。

### B5｜sitemap 无 video 条目（P3）

现象：sitemap 178 URL、694 条 image、0 条 video、0 条 news。站点有大量视频素材与视频用例页。

整改：依赖 B4 的结论；若保持详情页 noindex，则至少为可索引的视频用例页补 `videoObject` 条目。实现走 `src/app/sitemap.xml/route.ts` 的代码变更，属代码部署，不写内容。

## 4. 性能

### C1｜Cloudflare 不缓存 HTML（P1）

现象：HTML 响应头声明 `cache-control: public, max-age=60, s-maxage=300, stale-while-revalidate=1800`，但 402/402 页 `cf-cache-status: DYNAMIC`，CDN 完全不缓存 HTML，每次访问都回源做完整 SSR。TTFB p50 1,268 ms、p90 4,797 ms（6 并发；4 并发时 p90 2,041 ms）。

整改：在 Cloudflare 增加 HTML Cache Rule：`GET`、路径不含 `/app/*`、无登录 Cookie 时按源站 `s-maxage=300` 缓存并启用 `stale-while-revalidate`；带会话 Cookie 的请求 bypass。该项为边缘配置，不改代码、不写内容。

验收：匿名请求 `cf-cache-status` 出现 HIT，TTFB p50 < 500 ms；带 Cookie 请求仍为 DYNAMIC 且功能正常。

### C2｜HTML 体积过大（P1）

现象：全站平均 309 KB，首页 827 KB（正文 5,295 词、约 472 KB 内联 RSC、190 个 script 标签）。

整改：首页卡片改为服务端分页/分段流式渲染，或把卡片数据从 props 移到客户端按需请求（仅限非公开数据，公开内容仍须 SSR 完整输出）；目标首页 HTML < 300 KB。改动需保持公开页面零公开数据请求的守卫。

### C3｜全站 0 srcset、0 LCP fetchpriority（P2）

现象：402 页中 0 页带 `srcset`；首页 175 张 next-gen 图全部 `loading="lazy"`，无 `fetchpriority="high"`，唯一 preload 是 64px logo。

整改：卡片与 hero 生成 `srcset/sizes`；首屏 LCP 图去掉 `lazy` 并加 `fetchpriority="high"`。属代码变更，产出新构建后单独发布。

### C4｜发布机 fresh build 堆上限 OOM（P1，运维）

现象：发布机 fresh build 在 8 GB 堆上限 OOM（`Reached heap limit`），发布只能依赖本地预构建产物上传。宿主 15.9 GB 内存与 5 个线上站点共享，加大堆上限会触发 swap 与页错误，不是解法。

整改：

1. 方案 A（推荐）：独立构建机或 CI 构建，产物按 commit 标记上传，发布机只做解包与切换；
2. 方案 B：拆分构建（按路由分片构建后合并），降低单进程峰值；
3. 保留 `AIDREAMCAPES_BUILD_HEAP_MB` 作为可调参数，但不得单独依赖提高上限；
4. 每次发布记录实际构建峰值内存，作为后续评估基线。

## 5. 内容与元数据

### D1｜9 个可索引页缺 `max-image-preview:large`（P2）

受影响页面：`/children-privacy`、`/content`、`/cookies`、`/digital-delivery`、`/platforms`、`/privacy`、`/refunds`、`/state-privacy`、`/terms`。

整改：元数据生成处统一补 `max-image-preview:large`（代码变更）。`/content` 是本次新增的页脚页，需一并纳入。

### D2｜5 页缺 BreadcrumbList（P3）

受影响页面：`/`、`/ai-video-generation/ai-twin`、`/ai-video-generation/text-to-video`、`/templates/photo`、`/templates/video`。

整改：结构化数据生成处补 BreadcrumbList；首页是否补面包屑需与「首页即根」的语义一致（可输出根面包屑或不输出，需统一规则）。

### D3｜`BlogPosting.image` 使用相对路径（P3）

证据：`/blog/ai-ugc-video-ads-guide` 的 JSON-LD 为 `"image":"/ai-image-generation/gen2guide-k8-blog-ugc-video-review.webp"`，schema.org 期望绝对 URL。同类字段还有 `primaryImageOfPage`、`ImageObject.url`、`Article.image`（`Organization.logo` 已是绝对 URL）。

整改：结构化数据图片字段统一改为绝对 URL（代码变更）。

### D4｜首页 description 标点错误（P2）

现状：`Turn product URL, image, or prompt into authentic, high-converting UGC video ads in minutes with Ai video agent and Ai actors ,ready-to-use video templates.`（`Ai actors ,ready-to-use`）。

整改：字段级修改首页 `contentJson` 中该 description 字段，改为面向用户的正确英文句子，只改该字段，CAS 写入。

### D5｜94 个演员/场景页正文约 280 词（P2）

现象：演员/场景页占可索引 URL 的 53%，正文中位约 280 词，低于商业落地页（`/ai-actors` 2,759 词、`/templates` 1,494、`/industries` 1,676、`/platforms` 587）。

整改（二选一）：逐页补足到 500–700 词差异化内容（场景、用法、示例脚本）；或收缩索引面（保留头部演员，其余并入年龄段/场景页）。不得用自动生成的模板化文案填充。

### D6｜4 个 Photos 工具页是否改单数（P3，待产品决策）

候选：`/ai-image-generation/{white-background-photos,lifestyle-photos,model-photos,social-ad-photos}`。`Photos` 在语义上是「一组照片」，与本次已改的 `Videos` 不同，因此未改。需产品确认是否统一为 `*-photo`；确认后按本次改名的同一套流程执行（字段级 CAS + 301 + 别名）。

### D7｜3 个行业映射待确认（P3）

`Kitchen Appliance`、`Berry Bowl`、`Quiet Unboxing` 三个媒体与行业的对应关系保持待确认状态，不纳入自动写入。

### D8｜开放索引的前置工作（P3）

案例页独立正文与 Search Console 数据是「开放索引」的前置条件；本轮未用自动生成内容替代，也未以技术检查推断收录或排名。

### D9｜命名清单把 `/occasions` 记为目录页（P3）

`docs/audits/aidreamcapes-plural-s-inventory-2026-10-22.md` 第 3 节把 `Occasions | /occasions` 列为目录页。生产库没有该 hub，只有 `/occasions/{black-friday,holidays,sale-discount}` 三个可索引页，导航直接指向这三个子页。整改：更正文档表述，或补建 hub（属内容新增，需另行评估）。

## 6. URL 边界

| 编号 | 现状 | 整改 |
| --- | --- | --- |
| E1 | host 归一化 2 跳（apex → www → 目标） | 边缘配置合并为 1 跳 |
| E2 | `/ABOUT-US` → 404 | 大小写不敏感重写或补 301 兜底，需评估是否引入重复内容 |
| E3 | `/platforms/instagram` → 404（实际为 `/platforms/instagram-ads`） | 为目录页补近似 slug 301 兜底 |
| E4 | 品牌域 `aidreamcapes.com` 返回 410 | 业务决策：若仍有品牌流量，改为 301 到主域；否则维持 410 并记录决策 |

## 7. 工具链与环境

### F1｜release 归档不含 `docs/`（P2）

现象：`scripts/deploy-aidreamcapes-release.mjs` 的 `archivePaths` 只包含 `package.json`、`src`、`scripts`、`prisma` 等，不含 `docs`。因此在服务器 release 目录执行内容迁移并把审计清单写到 `docs/audits/...` 会 `ENOENT`（本次生产改名应用即在最后一步失败，数据库写入已完成但清单缺失）。

已做：迁移脚本写文件前创建目标目录（`mkdirSync(path.dirname(out), { recursive: true })`）。

待做：

1. 内容迁移脚本的默认输出目录改为服务器上必然存在的路径（建议 `/tmp` 或 release 内 `reports/`），避免依赖未归档目录；
2. 或把 `docs/audits` 纳入 `archivePaths`（会增加发布包体积，需评估）；
3. 每次生产内容应用必须落盘清单作为审计证据，缺失即视为应用未完成。

### F2｜CDN 重置本地非浏览器出口连接（P3）

现象：本地出口对 `https://www.aivideosugc.com` 的非浏览器 UA 连接被重置（`curl: (35) Recv failure: Connection reset by peer`），发布机侧抓取正常。

现状做法：所有生产校验与审计在发布机执行。需确认 WAF/Bot Fight 不会误伤合法爬虫（SEO 工具、浏览器预渲染服务）。这同时也是 C1 之后真实用户与爬虫能否稳定访问的关键风险点。

## 8. 建议执行顺序

| 批次 | 内容 | 依赖 |
| --- | --- | --- |
| 批次 1（本周） | A1 + A2 一次字段级删除清单；B1 + B2 内链改写；D1 + D3 代码变更；D4 字段级文案修正；F1 脚本输出目录调整 | 无；均不依赖决策 |
| 批次 2（本周） | C1 边缘缓存规则；E1、E3 边缘/路由兜底 | Cloudflare 权限 |
| 批次 3（两周内） | B3 导航压缩；C3 srcset；C4 独立构建机 | C4 需要构建资源 |
| 批次 4（一个月内） | B4 + B5 索引策略；C2 首页载荷；D5 内容深度 | 需产品决策（B4、D6） |

## 9. 执行边界

- 只写 `site_aidreamcapes`；任何写入命令必须带站点过滤或站点级确认串。
- 内容变更一律字段级清单 + CAS；不导入历史 publication/snapshot，不用快照兜底，不做整页回滚。
- 代码部署与内容应用分开；代码发布只发布代码。
- 公开页面内容只来自 `LivePage.contentJson`，不新增硬编码文案，不新增客户端公开数据请求。
- 每次生产内容应用后必须回读：HTTP 状态矩阵、sitemap、页脚顺序、完整 SEO 合同、release routes / media aliases / card links 三项 smoke。
- 不修改 MyDreamShoots、Aidreamcapes EU、Aidreamshoots EU 的数据、路由、资产、SEO、导航或部署记录；共享层改动（如需改共享导航或主题）须先取得明确批准。
