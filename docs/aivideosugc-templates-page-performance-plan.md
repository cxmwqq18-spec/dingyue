# AIVideosUGC `/templates` 页面性能与 SEO 评估 + 优化方案

> 日期：2026-11-02 · 范围：`https://www.aivideosugc.com/templates`（PageSpeed Insights 移动端报告）
> 性质：**评估与方案文档，本任务不改代码**。实施前需按仓库契约逐条走字段级 manifest + CAS + 读回断言。
> 本文档不包含面向最终用户的 frontend copy；全部为内部实施说明。

## 1. 一句话结论

PageSpeed 报告的问题**基本属实**，且根因集中、可修：
- LCP 8.6s 的主因不是 JS，而是 **20 张视频卡的一次性大图 poster（实测合计 3,375 KiB JPEG）**——无 srcset、无预加载、无尺寸优化。
- 渲染阻塞 1,930ms 来自 **4 个串行发现的阻塞 CSS（gzip 合计 ~117KB，其中主文件原始体积 508KB）** + **源站 SSR 渲染 TTFB（`/templates` 0.74s，首页高达 2.96s）**。
- SEO 69 分：on-page 基本项（title/description/canonical/robots/alt/h1）全部过关，扣分主要来自 hreflang 缺失、正文标题层级单薄（仅 1 个 h1、0 个 h2）以及移动端可读字号/点击目标（需跑本地 Lighthouse 精确定位）。

## 2. 逐条核对（报告项 → 实测事实 → 判定）

| PageSpeed 项 | 报告值 | 实测事实 | 判定 |
|---|---|---|---|
| FCP | 2.1s | 源站 SSR 渲染 `/templates` TTFB 0.74s（`?cb=` 破缓存实测），HTML gzip 前 318KB；NGINX 对 HTML `private, no-cache`（**无任何 CDN/代理缓存**，每次回源 SSR） | 属实：SSR 渲染 + 阻塞 CSS 串行链共同造成 |
| LCP | 8.6s | LCP 元素≈第一屏视频卡 poster（如 `closet-organizer-walkthrough-ref.jpg` 266KB、`denim-shirt-detail-reel-ref.jpg` 292KB）；`<video poster>` 无 `preload` 提示、无 `<link rel=preload>`、无 srcset | **属实，且是最大问题** |
| 改进图片传送 | 2,357 KiB | 20 张 poster JPEG 实测合计 **3,455,646 B（≈3,290 KiB）**，单张 141~292KB，均为原始引用图，未生成展示宽度衍生物 | 属实 |
| 渲染阻塞请求 | 1,930ms | head 内 4 个阻塞 stylesheet（gzip 78.3/17.5/5.5/15.9 KB）；主 CSS 原始 508KB | 属实 |
| 缓存生命周期 | 379 KiB | poster 与 `/assets/` 图片 `Cache-Control: public, max-age=604800`（7 天，低于 Lighthouse 30 天门槛）；`/_next/static/*` 已是 1 年 immutable（良好） | 属实 |
| LCP 请求发现 | — | LCP poster 未在 head 预加载；浏览器需先解析 HTML → 触发 poster 请求 | 属实 |
| 网络依赖树 | — | 页面引用**外域图** `semilaunch.com/assets/badge.png`（页脚徽标） | 属实 |
| 旧版 JavaScript | 22 KiB | `polyfills-*.js` 带 `noModule`（现代浏览器不下载） | 属实但影响小 |
| 强制自动重排 | — | 静态 HTML 无法定位；怀疑点：hover 自动播放预览（`data-adc2-preview`）的水合脚本在滚动重算样式 | 待线上 profile 确认 |
| DOM 大小 | — | 顶级标签仅 744（div 108 / img 22 / video 20）——页面本体 DOM 并不臃肿 | 轻微，非重点 |
| 布局偏移原因 | CLS 0 | `<video>` 均带 width/height；img 为 lazy | 无问题（CLS 已达标） |
| 缓存命中提示（HTML） | — | HTML `private, no-cache`，每次回源渲染 0.74s（破缓存实测） | 改进空间在「缓存/渲染」方案里处理 |

**SEO 附加核对**：title/description/canonical/`robots index,follow`/alt 全覆盖/1 个 h1/lang=en，均无缺陷；无 hreflang（单语站点可不做，PSI 会记一处）；**全文 0 个 h2**（标题层级薄弱会在搜索摘要相关性上吃亏但不是 PSI 扣分主因）；页脚 230 个链接 + 小字号社交链接，怀疑触发「清晰易读字体大小/适当大小的点击目标」扣分。

**顺带实测（超出截图范围的警报）**：`/`（首页）SSR 渲染 **2.96s、836KB**，`/ai-video-generation/spokesperson-video` 1.33s / 500KB —— 首页比画廊页糟糕得多，用户如果跑首页 PSI 分数会更难看。

## 3. 优化方案（按投入产出排序；未实施）

### P0 — Poster 图片管线（预计直接压掉 LCP 与 2,357 KiB 图片项）

1. **生成展示宽度衍生物**：为 20→全部视频卡 poster 生成 320/640/960px WebP（必要时 AVIF）：目录规则 `/assets/sites/site_aidreamcapes/v2-responsive/<源目录>/<原名>--<width>.webp`（复用 v2 响应式索引管线 `aidreamcapes-v2-responsive-image-manifest.json`；生成脚本 `scripts/generate-aidreamcapes-gallery-poster-variants.mjs` 在释放主机上爬取 SSR 画廊 enumerating 源图并在本地产物时合并索引）。原始 `-ref.jpg` **保持原样在线**（sitemap/JSON-LD/已收录 URL 不断链，符合 `google-indexed-url-safety` 红线）。
2. **poster 指向衍生物**：渲染层映射（`aidreamcapesV2ResponsivePosterSrc`，640px 档），无变体条目时回退原图——数据行不改、manifest 部署即生效。
3. **LCP 预热**：首屏第 1、第 2 张视频卡 poster 的 `<link rel=preload as=image>`（第 1 张 `fetchpriority=high`），SSR 注入。
4. **缓存升级**：衍生物走 `/assets/` 位置（nginx `immutable, max-age=31536000`），同时解消「缓存生命周期 379 KiB」扣分。

分页部分（本轮一并实施）：`/templates` 改为**离散 SSR 分页**——每页 12 卡（`exampleDirectory.pageSize` 字段级 manifest 20→12）、页底 Previous/Next 锚（`rel=prev/next`）+ "Page X of Y"、深链接 `?page=N` 独立可寻址、kind 状态透传；同时**下线客户端 GalleryGridLoader 与 `/api/aidreamcapes/gallery-cards`**（浏览器抓目录数据违反 SSR-only 红线，也是「无加载更多链接」achievability 缺口的根因）。分页页沿用既有过滤视图判例：index,follow + canonical 无 query（同 `?kind=video` 现状），链接保持可爬，328 详情页全部继续收录于 sitemap。媒体完整性审计改为走 SSR 分页遍历。

预期：图片字节 −65% 以上（3.3MB → ~1MB），LCP 请求提前一个渲染周期被发现并高优先级加载。

### P1 — CSS 与 SSR 渲染路径（压 FCP 与渲染阻塞 1,930ms）

1. **CSS 瘦身/分包**：核查 508KB 主 CSS 的构成（疑似全局设计系统一次性下发）。目标：按站点壳层/组件拆分，画廊页只下需要的部分；4 个阻塞文件收敛到 ≤2 个或对关键 shell 样式内联 `<style>`（SSR 注入，非客户端注入）。
2. **SSR 渲染提速**：`/templates` 0.74s、首页 2.96s 均为每次冷渲染（无 HTML 缓存）。选项（按风险递增）：
   a. 排查首页 2.96s 是否有可消除的同步查询聚合（与画廊页共用数据源函数的复用点在 `media-cards.server.ts`）；
   b. 对公开允许的 HTML 采用 Next 层短 TTL（`revalidate` 导出或路由段配置），保持内容由 `LivePage.contentJson` 单一来源，与 no-snapshot 规则冲突面需先评审；
   c. NGINX `proxy_cache` 需先评审站点数据契约，不在本轮默认。
3. **HTML 体积**：318KB（gzip 前）对 `?kind=video` 也是同量级；确认压缩配置（gzip/brotli）对 HTML 生效，可再加 `preload` 提示 Buddy。

### P2 — 资源与第三方

1. **自托管 `semilaunch.com/assets/badge.png`**：下载进 `/assets/sites/site_aidreamcapes/brand/`（带 `?v=`），页脚引用改为同域，消除外域依赖树。
2. **polyfills/旧版 JS**：22KB、现代浏览器不下载，**不动**。
3. **强制重排**：在 P0/P1 落地后用本地 Playwright + tracing 定位 `data-adc2-preview` 水合脚本中的样式读取/写入交替；预计为 `getBoundingClientRect` 或布局属性读取后立即写样式，可用读写分离或 `content-visibility` 消解。**未定位前不改**。

### P3 — SEO 收尾（69 → 95+ 路径）

1. **标题层级**：正文给分区补 h2（案例画廊分区标题、筛选说明等，均为最终用户文案，符合公开 copy 边界）。
2. **页脚可读性**：字号 ≥12px、点击目标 ≥44px 的 CSS 复核（社交/导航小链接区）。
3. **hreflang**：单语站点可维持现状（PSI 记一条），若想清零可加自指 `hreflang="en"`。
4. 每步完成后复跑 PSI + 本地 Lighthouse（移动端）确认移动性，不凭感觉改。

### P4 — 首页专项（建议列为下一轮）

首页 TTFB 2.96s / 836KB 远差于画廊页，是同一根因的放大版（SSR 无缓存 + 大 HTML + 图片管线一致）。本轮 P0/P1 的机制建立后应把首页作为第一批受益者纳入回归。

## 4. 实施顺序与回归要求

1. P0（图片衍生物 + manifest 切换 + preload + 缓存头）→ 本地 `node scripts/dev-local.mjs` 验证 → 部署 → 线上 PSI/截图回归（复用 8443 隧道验证脚本）。
2. P1 CSS 拆分与 SSR 渲針优化 → 同流程；重点回归 no-JS/静态 SSR guard（公开页零浏览器数据请求红线不可回退）。
3. P2 自托管徽标：按 `google-indexed-url-safety` 处理 `semilaunch.com` 出现过的外域引用（外域资源不受收录红线约束，但替换后需确认页脚渲染正常）。
4. P3 SEO 项每个均为纯 copy/样式增补，走常规提交 + 回归截图。
5. 每步实测前后 PSI 数字入档（§5 追加实施记录）。

## 5. 实施记录

### 2026-11-02 P0 一批（分页 + 客户端加载器下线 + poster 管线接线）— 本地已实施

- 代码：`template-directory.server.tsx` 离散分页（discrete `?page=N`，越界收敛）、poster 变体映射 helper、`ExampleDirectory` SSR 分页导航 + 首屏 preload；删除 `gallery-grid-loader.tsx` 与 `/api/aidreamcapes/gallery-cards`（含 next.config.mjs 头规则）；审计脚本改走 SSR 分页遍历并断言分页链严格递增。
- 数据：`aidreamcapes-gallery-pagination-*-2026-11-02.json` manifest（pageSize 20→12，CAS + 保护哈希 + revision 断言 + rollback），本地已应用并读回确认。
- 本地验证（dev-local 3002）：每页 12 张 video 卡、Page 1 of 28、rel=next/prev、`?page=2&kind=video` kind 透传、`?page=999` 收敛到 28、preload 注入（首张 fetchpriority=high）、HTML 无 gallery-cards 引用与 Load more 按钮。

### 2026-11-02 P0 一批 — 生产已上线（release 0d9e3e0722b0e63c51b207423000be662946f111）

- 代码与数据：SSR 离散分页 + 客户端加载器下线 + poster/photo 宽度变体（656 个 WebP 文件入库 `public/assets/sites/site_aidreamcapes/v2-responsive/`，索引合并至 `aidreamcapes-v2-responsive-image-manifest.json`，共 426 条）随 release 部署；`exampleDirectory.pageSize` 20→12 经字段级 manifest 应用（planHash `bf738ec5…`，CAS + revision 断言 + 保护哈希 + rollback `aidreamcapes-gallery-pagination-production-2026-11-02-rollback.json`），DB 读回确认 12。变体生成脚本对生产 SSR 爬取 328 个源（171 poster + 157 照片），首屏样本字节降幅 −57%~−72%（如 citrus 147KB→42KB）。
- 部署插曲（记录供复盘）：① 首次部署在 origin 冒烟阶段因一个详情页别名渲染超时触发回滚 trap（按设计工作，重试通过）；② apply 事务初版未调大交互事务超时（P2028，未产生写入，已修为 `timeout: 120s`）；③ 事务提交后运行崩溃于 rollback 工件写出（脚本缺陷已修，工件经 `--write-rollback-only` 只读模式补齐，DB 无二次写入）。
- 生产回归：`/templates` 200（12 video 卡、12/12 poster 走 640 WebP 变体、3 个 preload、分页 nav、无 gallery-cards 引用）；`?page=2`、`?page=2&kind=video`、`?page=999` 均 200；`/templates/video` 保持 308；旧 `/api/aidreamcapes/gallery-cards` 404；变体文件 `image/webp` + `max-age=31536000, immutable`（31.5KB/张）；sitemap 516 条 URL 不变且无 `?page=` 入口；媒体完整性审计（SSR 分页链遍历）328/328 详情页、578 资产、0 失败。
- 待办：PSI 复测（移动端目标：LCP 显著低于 8.6s、图片改进项消除）后回填本节；观察 Cloudflare 缓存预热后 TTFB。

### 2026-11-02 第二批（数字页码分页 + 字体并行发现）— 生产已上线（release 940f920ca01cfac3ec217101ea898c6b889c75f6）

- **数字页码分页**（`1b940e8be`）：页底改为「Previous + 首三页/末三页/当前页±1 的数字锚点 + 省略号 + Next」（如 `1 2 3 … 14 15 16 … 26 27 28`），全部纯 SSR `<a>`，无 JS；`rel=prev/next` 保留在 Previous/Next 上（审计与枚举脚本依赖的锚不变）；当前页为 `aria-current="page"` 胶囊（白底，与全站选中态一致）；kind 过滤视图页数独立（如 video 20 页）且透传。
- **字体并行发现**（`940f920ca`，经站点所有者批准的共享层修改）：`globals.css` 头三个 Google Fonts `@import`（渲染阻塞 CSS 解析后才能发现，串行拖慢移动端 FCP/LCP 1.5~2.5s）移至共享根布局 head 的 `preconnect ×2` + `stylesheet ×3`；family/weight 列表逐字不变，渲染输出不变，全站点同享。生产验证：head 中 2 preconnect + 3 font link、全部阻塞 CSS 中 `@import` 计数为 0。
- 生产回归：`?page=15` 渲染 `1 2 3 … 14 15 16 … 26 27 28`、rel=next/prev 在位；poster preload 2 个不变。
- **移动端剩余杠杆**（按预计收益排序，后续批次）：① 共享应用 CSS 508KB 原始/78KB gzip（render-blocking，含大量非 Aidreamcapes 主题包样式，需按站点拆分——共享层，需批准）；② head 16 个水合 script 的体积与「未用 JS」项；③ SSR TTFB ~0.6-0.75s。

### 2026-11-02 第三批（LCP 带宽饥饿修复 + 跳页表单）— 生产已上线（release efa42aaba3c190b76196e40576973633e51093c1）

- **PSI 实测**（用户复测，第二批后）：移动 75 分（72→75），FCP 2.1s、LCP 6.2s、TBT 40ms、CLS 0、SEO/无障碍/最佳做法 98-100。LCP 与 FCP 间 ~4.1s 差距定位为带宽饥饿：12 张 poster 属性图（~700KB）无原生懒加载 + 预览片段 300KB/个在视口下方 1200px 即被 prefetch（初始即 1.2~2.4MB），移动限速管道下 LCP 图被挤压。
- **修复**：① 主题 CSS 给 `.adc2 .tc` 加 `content-visibility:auto; contain-intrinsic-size:auto 420px`——Chrome 对屏外卡推迟渲染与 poster 资源加载（不支持该属性的浏览器回退为现状，无破坏）；② `video-preview-card` 的可视激活与片段 prefetch 统一经 `runAfterWindowLoad` 门控（load 事件或 2.5s 兜底）——LCP 窗口内网络管道让给首屏 poster；③ 分页新增**跳页表单**：纯 HTML GET form（`/templates?page=N` + kind 隐藏字段 + min/max），无 JS 可用，aria-label 完整。
- 生产验证：跳页表单渲染（page=3、max=28）、分页窗 `Previous 1 2 3 4 … 26 27 28 Next Go`、rel=next 在位、poster preload 2 个不变、内联主题 CSS 含 content-visibility。
- 待办：PSI 第三次复测（预期 LCP 3s 上下）；CLS 复查（contain-intrinsic-size 估高 420px 与实际卡高的差在首屏外，CLS 应保持 0）。
