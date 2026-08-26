# Sitemap 链路与主题详情图片隔离审计

审计日期：2026-08-25（Asia/Shanghai）  
审计范围：`www.mydreamshoots.com`、`www.aidreamcapes.com` 的线上 `robots.txt`、`sitemap.xml`、sitemap 中全部 URL，以及详情页 `image:image` 引用。  
审计目标：确认 sitemap URL 是否为真实可访问、规范、可索引且能纳入站内链路；确认不同主题详情页之间是否错误复用图片。

## 结论摘要

| 站点 | Sitemap 基线 | URL 可达性 | 图片隔离 | 结论 |
|---|---:|---:|---:|---|
| MyDreamShoots | 118 个 URL、775 个图片引用 | GET 跟随重定向后 118/118 为 200；但 `/blog/ai-video-add-ons-photo-package-guide` 的 HEAD 为 308 | 68 个详情页中有 24 个图片 URL 跨页重复，归并为 5 组 | P1：详情素材所有权不独立；另有 sitemap 重定向项 |
| AIdreamcapes | 29 个 URL、71 个图片引用 | 当前实测仅首页、`/contact-us`、`/tools` 为 200；其余 26/29 为 404 | 详情图片也存在大面积共用；且页面本身已失效 | P0：sitemap 与线上路由脱节，应先止损 |

这不是单纯的“图片 sitemap 去重”问题。当前生成器只在**同一个 URL entry 内**去重，允许不同详情 URL 指向同一套 `pageMedia`/pack 素材；因此 XML 合法，但主题实体、页面内容和图片所有权不一致。

## 线上证据

### 1. robots 与 sitemap

- 两站 `robots.txt` 均返回 200，`User-Agent: *` 为 `Allow: /`，并声明各自的 `Sitemap: https://<host>/sitemap.xml`。
- MyDreamShoots sitemap 响应头：`x-sitemap-url-count: 118`、`x-sitemap-image-count: 775`、publication `pub_site_dreamshoot_mt8rj38o_99050be2`、version `122`。
- AIdreamcapes sitemap 响应头：`x-sitemap-url-count: 29`、`x-sitemap-image-count: 71`。
- 两个 XML 的 `<loc>` 均无重复、无跨站 host。

### 2. Sitemap URL 与页面状态

MyDreamShoots 当前 URL 分布：

| 目录 | URL 数 |
|---|---:|
| `/ai-image-generation`（含目录页） | 38 |
| `/ai-video-generation`（含目录页） | 21 |
| `/blog`（含目录页） | 29 |
| `/holidays-events` | 11 |
| 首页、内容页、政策页及其它公共页 | 19 |

MyDreamShoots 的 118 个 sitemap URL 逐个 GET 并跟随重定向后均为 200，canonical 与 sitemap loc 基本一致；但 `/blog/ai-video-add-ons-photo-package-guide` 在 HEAD 检查返回 `308 -> /blog/video-photo-package-guide`，不应继续作为 sitemap loc。应直接替换为最终 canonical，或删除该旧 URL。

AIdreamcapes 当前实测结果为：

```text
200  https://www.aidreamcapes.com/
200  https://www.aidreamcapes.com/contact-us
200  https://www.aidreamcapes.com/tools
404  其余 26 个 sitemap URL（包括 /collections、/blog 目录及全部工具/博客详情）
```

因此 AIdreamcapes 当前 sitemap 至少有 26 个“提交给搜索引擎但线上不存在”的 URL。必须先确认生产发布、域名路由和 active publication 是否一致；在修复前，不应继续把这些 URL 保留在 sitemap。

### 3. 站内链路判定

- Sitemap URL 200 只能证明“直达可访问”，不能证明用户能从首页、导航、目录或相关内容进入该页面。
- 旧的静态链接审计记录过 MyDreamShoots `/best-ai-video`、`/shipping` 的潜在孤儿状态；由于当前 sitemap 已从旧版本变更为 118 URL，必须用当前生产 HTML 重新跑一次全站 crawl，不能沿用旧报告作为通过证据。
- AIdreamcapes 26 个 404 URL 已经是比“孤儿页”更严重的链路断裂：即使导航存在，最终目标也不存在。
- `/app/create`、登录、购物车等交易/认证路径，以及旧路径/别名，不应为了“链路闭合”加入 sitemap；应通过白名单明确标记为非 sitemap 目标。

## 详情主题图片重复证据

以下均为当前线上 sitemap 的**完全相同 base URL**（去除 query 参数后比较），不是感知哈希推测。共有 68 个详情页、669 个不同图片 URL，24 个 URL 出现在多个详情页，归并为 5 组冲突：

| 冲突组 | 重复范围 | 复用规模 | 严重度 |
|---|---|---:|---|
| Gala pack | `/ai-image-generation/black-friday`、`/cannes`、`/gala-photo` | cover + 12 gallery，共 13 张整套复用 | P0 |
| Save-the-Date 主图 | `/holidays-events/save-the-date`、`/wedding-anniversary`、`/wedding-invitation` | 5 张 | P1 |
| Instagram Reels | `/ai-video-generation/instagram-reels`、`/social-media-video` | 3 张 | P1 |
| Story Video | `/ai-video-generation/story-video`、`/youtube-video` | 2 张 | P1 |
| Wedding gallery | `/ai-image-generation/wedding-photo` 与上述 3 个 holidays 页面 | 1 张 `wedding-portraits-01.webp` | P1 |

额外观察：AIdreamcapes sitemap 中 `private-fan-scene-album.webp` 被首页、目录、博客和几乎全部工具页引用。目录/导航页复用可以是有意的品牌/分类展示，但详情页之间不能把同一 cover 当作不同主题的唯一视觉证据；AIdreamcapes 需在路由恢复后重新做同一规则的详情页扫描。

## 根因定位

1. [`src/lib/seo-indexing.ts`](/Users/a1/work/ai-project/dingyue/src/lib/seo-indexing.ts:464) 的 `sitemapEntriesForSite()` 从已发布 snapshot 生成 URL。
2. MyDreamShoots 主题详情在 [`src/lib/seo-indexing.ts`](/Users/a1/work/ai-project/dingyue/src/lib/seo-indexing.ts:511) 通过 `publishedRoutes` 创建动态 leaf entry，并在 537-546 行直接把 `pageMedia.primaryImage + galleryImages` 写入 sitemap。
3. 该逻辑只保证单页 entry 内的 URL 去重；没有维护 `image URL -> canonical detail path` 的全局反向索引，因此同一 pack/media 可以被多个 canonical detail route 复用。
4. [`scripts/smoke-storefront-image-isolation.mjs`](/Users/a1/work/ai-project/dingyue/scripts/smoke-storefront-image-isolation.mjs:438) 已经能检查同 scope 的重复 URL/hash，但它读取本地 PostgreSQL 状态，不直接验证线上 sitemap 的跨详情页映射；线上 XML 仍暴露出发布数据和 sitemap 投影没有被同一条阻断规则约束。
5. 当前本地审计脚本运行被数据库 schema 阻断：Prisma 查询报 `ThemePublication.approvalId does not exist`。这意味着代码 schema、迁移和审计数据库未同步，不能把本地 smoke 通过当成发布证据。

## 整改方案

### P0：先恢复 sitemap 与可访问路由

1. AIdreamcapes：核对 Cloudflare/vhost 的域名绑定、生产 release、active publication 和 route resolver；逐个恢复 `/collections`、`/blog`、工具详情和博客详情，或从 active publication 中移除这些未发布路由。
2. 在修复完成前，sitemap 只保留实际 200、self-canonical、`index,follow` 的 URL；不得用 404 URL 占位。
3. MyDreamShoots：把 `/blog/video-photo-package-guide` 作为唯一 sitemap loc；旧 `/blog/ai-video-add-ons-photo-package-guide` 保留 301/308 兼容即可，不再进入 sitemap。
4. 发布后分别用生产 Host 请求两个 sitemap，并对每个 loc 做 GET、最终 URL、canonical、robots 四项检查。

### P0/P1：建立详情图片所有权规则

定义“详情图片唯一性”边界：

- 只比较可索引的 detail leaf（`/ai-image-generation/*`、`/ai-video-generation/*`、`/holidays-events/*`、恢复后的 AIdreamcapes 工具/博客详情）；
- 目录页、首页、导航卡、品牌 logo 可复用，但不得被当作详情页独立 gallery 的例外理由；
- 同一 detail 页内部 cover 不能出现在自己的 gallery；
- 不同 canonical detail path 之间，同一 base image URL、SHA-256 或感知哈希近重复均阻断发布；
- 每个主题建立 `assetOwner = canonical detail path`，素材只能由 owner 详情页作为主图/gallery 使用。

整改顺序：

1. 先拆分 `gala-photo / black-friday / cannes`，为三个主题分别生成 cover 与 12 张 gallery；这是整套 13 张完全复用，优先级最高。
2. 拆分 `save-the-date / wedding-anniversary / wedding-invitation` 的 5 张 Save-the-Date 图片，并替换 wedding-photo 复用的 `wedding-portraits-01.webp`。
3. 拆分 `instagram-reels / social-media-video` 的 3 张图，以及 `story-video / youtube-video` 的 2 张图。
4. AIdreamcapes 路由恢复后，为每个工具/博客详情建立主题相关素材；公共品牌图只保留在首页/目录，不作为所有详情页的默认 hero。
5. 若两个 URL 实际是同一个主题，不要硬生成两套图：保留一个主 URL，另一个做 301 并从 sitemap 移除；不要用 self-canonical 的重复页面掩盖实体重复。

### P1：把链路检查变成发布门禁

新增或扩展一个 production sitemap audit，输出以下字段：

```text
host, sitemap_loc, final_url, status, canonical, robots,
inbound_count, inbound_sources, detail_asset_owner, image_hashes
```

发布必须同时满足：

- sitemap XML 可解析、loc 唯一、host 正确；
- 每个 loc GET 最终为 200；禁止 3xx loc；
- sitemap loc 与最终 canonical 完全一致；
- robots 包含 `index` 且不含 `noindex`；
- 每个 indexable loc 至少有一个来自首页/导航/目录/相关文章的站内入口，或明确登记为“仅 sitemap 入口”的白名单；
- 详情图片反向索引中，每个图片 owner 只有一个 canonical detail path；
- 同页和跨页 SHA/感知哈希检查均为 0 冲突；
- AIdreamcapes 与 MyDreamShoots 不能跨品牌复用素材。

现有脚本可作为基础：

```bash
cd /Users/a1/work/ai-project/dingyue
npm run smoke:storefront-sitemap-directory-coverage
npm run smoke:storefront-image-isolation
npm run smoke:storefront-dom-image-isolation
```

但在恢复数据库迁移前，先修复 `ThemePublication.approvalId` 缺失问题，再执行以上命令；否则审计读取不到当前 publication，结果无效。

## 验收清单

- [ ] 两站 sitemap URL 数量与 active publication 的 indexable route 数量一致。
- [ ] AIdreamcapes 当前 26 个 404 已清零，或已从 sitemap 删除并完成 301/410 策略。
- [ ] MyDreamShoots `/blog/ai-video-add-ons-photo-package-guide` 不再出现在 sitemap。
- [ ] 全部 sitemap loc GET=200，无 3xx loc、无跨域 loc、无 soft-404。
- [ ] 每个 loc 的 HTML canonical 与 sitemap loc 一致，robots 为 `index,follow`。
- [ ] 当前全站 crawl 已确认 `/best-ai-video`、`/shipping` 等历史潜在孤儿的最新状态，并记录 inbound source。
- [ ] 五组已知详情图片冲突清零；详情图片 URL/hash 反向索引无跨页 owner 冲突。
- [ ] 本地 Prisma schema、migration、审计数据库列一致，`npm run smoke:storefront-sitemap-directory-coverage` 能真实读取 active publication。
- [ ] 生产发布后重新抓取两站 sitemap，并把本文件的数字、publication version、snapshot hash 更新为实测值。

## 审计边界

本次结论基于 2026-08-25 线上 HTTP/XML/HTML 实测和仓库中的 sitemap、图片隔离代码。未包含 Google Search Console 的索引覆盖、Google-selected canonical、真实 crawl log、PageSpeed/CWV 和生产数据库完整快照；这些应在路由与媒体整改完成后补做。
