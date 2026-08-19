# MyDreamShoots 27 页博客 SEO 深度复审与整改方案

审计日期：2026-08-19
线上采样时间：2026-08-19 07:12 UTC
审计范围：用户指定的 27 个 `www.mydreamshoots.com/blog/` URL
审计框架：本机 `seo-audit` / `seo-audit-full` skill 的技术、页面、内容、Schema、图片、内链与站点信号检查框架

## 1. 结论

这 27 页当前最严重的问题不是单个标题或描述，而是**生产环境仍在提供旧模板版本**：

- 线上 H1 与仓库最新内容匹配：`0/27`。
- 线上 title 与仓库最新内容匹配：`2/27`。
- 三批最新 profile 与通用发布契约已经在 GitHub `main`，但本地 smoke 明确标记为 `local-only-not-published`。
- GET 全部直接返回 200，但 HEAD 全部返回 `308`，并跳转到 11 个已返回 404 的旧聚合页。
- 线上 27 页仍使用相同文章模板；351 个页面组合的 5-gram Jaccard 全部高于 `0.35`，其中 246 对不低于 `0.70`。
- Anime Avatar 与 Profile Cards 的线上 title、H1 和正文实体发生直接碰撞，最高相似度为 `0.9054`。

因此，正确整改顺序是：

1. 修复生产代码、内容数据库与 CDN 的发布漂移。
2. 消除 GET/HEAD 路由分叉。
3. 发布仓库中已经完成的 27 个独立 profile 和 SEO 发布契约。
4. 对线上结果做逐页验收，而不是把本地文件存在视为完成。
5. 再处理品牌写法、搜索意图区隔和 GSC 表现优化。

## 2. 审计方法与限制

### 2.1 已执行检查

- 对 27 个 URL 分别执行真实 GET 与 HEAD 请求，不自动跟随跳转。
- 解析 title、meta description、H1-H3、canonical、Open Graph、正文图片和正文链接。
- 解析 Organization、BreadcrumbList、BlogPosting 和 FAQPage JSON-LD。
- 检查 robots.txt、sitemap URL、sitemap lastmod 与 sitemap image。
- 对 27 页正文执行两两 5-gram Jaccard 相似度检查，共 351 对。
- 检查所有正文 CTA 和相关文章链接的在线 GET 状态。
- 对照 `data/platform-state.json` 中当前发布候选内容和最近三批 Git 提交。
- 运行仓库已有 SEO smoke，验证本地 profile、索引规则、Schema 和媒体 alt 合同。

### 2.2 工具限制

- `seo-audit` 自带 Python 脚本在当前环境缺少 `requests`，且其 SSRF 防护将当前 DNS 解析结果判定为保留地址，因此没有把该脚本的失败结果误当作站点故障。
- 本报告改用 `curl`、Node HTML 解析和仓库 smoke 生成等价证据。
- 未提供 PageSpeed Insights API key，因此不对 LCP、INP、CLS 或 Lighthouse 分数作结论。
- 未接入 Google Search Console 或 GA4，因此不对曝光、点击、CTR、排名和自然流量作推断。

## 3. 线上证据摘要

| 检查项 | 结果 | 结论 |
|---|---:|---|
| GET 直接 200 | 27/27 | 通过 |
| HEAD 直接 200 | 0/27 | 严重失败 |
| HEAD 跳转 | 27/27 | 全部 `308` 到旧聚合页 |
| HEAD 最终目标 | 11/11 为 404 | 严重失败 |
| 自引用 canonical | 27/27 | 通过 |
| OG URL 与 canonical 一致 | 27/27 | 通过 |
| 进入 sitemap | 27/27 | 通过 |
| sitemap image | 27/27 | 通过 |
| 唯一 title | 26/27 | Anime 与 Profile Cards 冲突 |
| 唯一 H1 | 26/27 | Anime 与 Profile Cards 冲突 |
| 使用旧模板 H1 | 27/27 | 失败 |
| description 长度 120-160 | 27/27 | 机械通过，语义仍模板化 |
| 正文 Jaccard 中位数 | 0.7113 | 高度同质化 |
| 正文 Jaccard 最大值 | 0.9054 | Anime 与 Profile Cards |
| 页面组合不低于 0.70 | 246/351 | 严重失败 |
| 页面组合不低于 0.35 | 351/351 | 全部需要人工复核 |
| 每页一个 BlogPosting | 27/27 | 通过 |
| BlogPosting author 为 Organization | 0/27 | 失败 |
| author URL | 0/27 | 失败 |
| publisher logo | 0/27 | 失败 |
| `og:type=article` | 0/27 | 失败 |
| article published/modified meta | 0/27 | 失败 |
| `og:image:alt` | 0/27 | 失败 |
| 正文首图有 alt | 27/27 | 文本存在，但多页语义不准 |
| 正文首图有 width/height | 0/27 | 失败 |

### 3.1 正向信号

- HTTPS 和 `www` 规范化工作正常。
- 随机不存在路径返回真实 404，没有发现全站级 soft 404。
- robots.txt 允许抓取并声明正确 sitemap。
- `/about-us`、`/contact-us`、`/privacy`、`/terms`、`/content` 均返回 200。
- 27 页 canonical、OG URL、BlogPosting `mainEntityOfPage` 当前彼此一致。
- BreadcrumbList 和 BlogPosting JSON-LD 均可解析。
- FAQ 作为可见正文存在，没有滥加 FAQPage 富结果结构。
- 当前正文链接的目标 GET 均返回 200；问题主要是语义错误，而不是断链。

## 4. P0 问题

### 4.1 GET 与 HEAD 返回不同页面状态

所有目标页 GET 为 200，但 HEAD 返回 `308`。HEAD 的目标按旧分类聚合如下：

| 旧目标 | 受影响页面数 | 线上目标状态 |
|---|---:|---:|
| `/blog/creative-photo-package-guide` | 6 | 404 |
| `/blog/seasonal-photo-package-guide` | 5 | 404 |
| `/blog/cultural-wedding-photo-guide` | 2 | 404 |
| `/blog/couple-photo-package-guide` | 2 | 404 |
| `/blog/avatar-photo-package-guide` | 1 | 404 |
| `/blog/creator-photo-package-guide` | 5 | 404 |
| `/blog/beauty-style-photo-guide` | 2 | 404 |
| `/blog/headshot-photo-package-guide` | 1 | 404 |
| `/blog/utility-image-prep-guide` | 1 | 404 |
| `/blog/wedding-photo-package-guide` | 1 | 404 |
| `/blog/sports-fan-photo-guide` | 1 | 404 |

风险：

- 使用 HEAD 的爬虫、链接检查器、预渲染器和监控工具会把有效 URL 判断为重定向或失效。
- Google 通常使用 GET，但不应依赖搜索引擎替站点容忍协议层不一致。
- 当前行为说明生产运行时、边缘缓存或数据库路由映射仍保留旧版本。

整改：

1. 确认生产运行 commit 不低于 `0a21aef5`，并包含 `34824ad2` 与 `ea6ae40e`。
2. 清除这 27 个 URL 及 11 个旧目标的 CDN/HTML 缓存。
3. 确保 GET 与 HEAD 共用同一 canonical route disposition。
4. 目标页 GET、HEAD 都必须直接返回 200，且不得输出 `Location`。
5. 旧聚合页如果没有独立搜索价值，应保持 404/410；不要让目标页再次跳向它们。

### 4.2 生产内容未消费最新 profile

当前仓库已经包含三批整改：

| Commit | 内容 |
|---|---|
| `ea6ae40e` | Anime、Creator、Fashion、Gala、Hairstyle、Product、Headshots、Profile Cards、Social Cards |
| `34824ad2` | author、publisher、canonical、Schema、OG 和发布快照合同 |
| `0a21aef5` | Boudoir、Christmas、Wedding、Engagement、Halloween、Holiday、Thanksgiving 等第二批九页 |

仓库 `main` 与 `origin/main` 一致，但线上仍显示旧 H1 和旧正文。该应用优先读取数据库发布状态，所以只拉取 Git 代码不足以完成整改。

整改：

1. 从干净的 release checkout 生成仅包含 `site_dreamshoot` 公共内容的 manifest。
2. 先在测试环境执行 content plan、precheck、apply 与完整页面验收。
3. 生产 apply 必须使用受保护的 scoped content manifest；禁止全量导入本地 platform state。
4. 发布后同时检查服务 release marker、数据库 published snapshot 与 CDN 页面内容。

建议发布命令框架：

```bash
npm run release:content-export -- --target=local --site-id=site_dreamshoot --release-id=mydreamshoots-blog-27-seo-20260819
npm run release:content-plan -- --target=local --manifest=releases/manifests/mydreamshoots-blog-27-seo-20260819.json
npm run release:precheck -- --target=local --manifest=releases/manifests/mydreamshoots-blog-27-seo-20260819.json --skip-live

npm run prisma:migrate:deploy -- --target=test
npm run release:content-apply -- --target=test --manifest=releases/manifests/mydreamshoots-blog-27-seo-20260819.json --apply --confirm=release-content-apply

# 仅在测试环境验收通过且明确批准生产发布后执行
npm run prisma:migrate:deploy -- --target=production --confirm-production
npm run release:content-apply -- --target=production --confirm-production --manifest=releases/manifests/mydreamshoots-blog-27-seo-20260819.json --apply --confirm=release-content-apply
```

### 4.3 线上正文高度重复

线上旧模板造成：

- 最大相似度：`0.9054`。
- 中位数：`0.7113`。
- 最小值：`0.6718`。
- 246/351 对达到硬失败线 `>= 0.70`。
- 351/351 对达到人工复核线 `>= 0.35`。

本地三批 smoke 的最大相似度分别为：

- 优先主题九页：`0.0253`。
- 第一批九页：`0.0032`。
- 季节/场合九页：`0.0077`。

这说明内容重写本身已经完成，当前动作应是正确发布和线上验收，而不是再次重写同一批文章。

### 4.4 实体碰撞与错误 CTA

线上 Anime Avatar 与 Profile Cards 共用 Avatar title、H1 和主体内容，Profile Cards 未形成独立实体。

以下 CTA 虽然目标返回 200，但语义错误：

| 页面 | 当前线上 CTA | 正确策略 |
|---|---|---|
| Christmas Couple | `/ai-image-generation/nightlife` | `/ai-image-generation`，`Browse AI Image Generation` |
| Desi Wedding | `/ai-image-generation/cannes` | `/ai-image-generation`，`Browse AI Image Generation` |
| Indian Wedding | `/ai-image-generation/rich-lifestyle` | `/ai-image-generation`，`Browse AI Image Generation` |
| Fashion Editorial | `/ai-image-generation/street-style` | `/ai-image-generation`，`Browse AI Image Generation` |
| Product Style | `/ai-image-generation/background-changer` | `/ai-image-generation`，`Browse AI Image Generation` |
| Social Cards | `/ai-image-generation/edit-by-prompt` | `/ai-image-generation`，`Browse AI Image Generation` |

线上每页还固定推荐 Headshot、AI Video Add-ons、Anime Avatar 和 Profile Cards；这些链接虽然可访问，但大多不符合当前段落上下文，且 Profile Cards 的锚文本仍错误写成 `Open Avatar theme`。

## 5. 27 页目标合同

以下内容已经存在于仓库最新 profile，应作为生产发布后的逐页验收基线。

### 5.1 季节与场合九页

| Slug | 目标 H1 | 主 CTA |
|---|---|---|
| `boudoir-photo-package-guide` | How to Plan Tasteful AI Boudoir Photos for Private Portraits | `/ai-image-generation/boudoir` |
| `christmas-couple-photo-package-guide` | How to Plan Christmas Couple Photos for Cards and Keepsakes | `/ai-image-generation` |
| `christmas-photos-photo-package-guide` | How to Plan Christmas Photos for Cards and Family Albums | `/ai-image-generation/christmas-photo` |
| `desi-wedding-photo-package-guide` | How to Plan AI Desi Wedding Photos for Celebrations and Albums | `/ai-image-generation` |
| `engagement-photo-package-guide` | How to Plan AI Engagement Photos for Proposals and Announcements | `/ai-image-generation/engagement-photo` |
| `halloween-party-photos-photo-package-guide` | How to Plan Halloween Party Photos for Costumes and Group Cards | `/ai-image-generation/halloween-photo` |
| `holiday-photo-package-guide` | How to Plan AI Holiday Photos for Cards and Seasonal Profiles | `/ai-image-generation/holiday` |
| `indian-wedding-photo-package-guide` | How to Plan AI Indian Wedding Photos for Ceremony Portraits | `/ai-image-generation` |
| `thanksgiving-group-photos-photo-package-guide` | How to Plan Thanksgiving Group Photos for Cards and Gatherings | `/ai-image-generation/thanksgiving-photo` |

### 5.2 创作者与商业用途九页

| Slug | 目标 H1 | 主 CTA |
|---|---|---|
| `anime-avatar-photo-package-guide` | How to Plan an Anime Avatar Photo Set | `/ai-image-generation/avatar` |
| `creator-portraits-photo-package-guide` | Creator Portraits for Media Kits, Thumbnails, and Brand Profiles | `/ai-image-generation/portrait-photo` |
| `fashion-editorial-photo-package-guide` | How to Plan AI Fashion Editorial Photos | `/ai-image-generation` |
| `gala-photos-photo-package-guide` | AI Gala Photos for Formal and Evening Portraits | `/ai-image-generation/gala-photo` |
| `hairstyle-photo-package-guide` | AI Hairstyle Preview: What to Prepare and What to Check | `/ai-image-generation/hairstyle-generator` |
| `product-style-photo-package-guide` | AI Product Style Photos for Lifestyle and Campaign Drafts | `/ai-image-generation` |
| `professional-headshots-photo-package-guide` | Professional AI Headshots for LinkedIn, Resumes, and Team Profiles | `/ai-image-generation/headshot` |
| `profile-cards-photo-package-guide` | Profile Card Photos for Consistent Bios and Social Profiles | `/ai-image-generation/avatar` |
| `social-cards-photo-package-guide` | AI Social Card Photos for Shareable Content and Publishing | `/ai-image-generation` |

### 5.3 风格、工具与活动九页

| Slug | 目标 H1 | 主 CTA |
|---|---|---|
| `cyberpunk-photo-package-guide` | Cyberpunk AI Photos: Neon Styles, Source Photos, and a Review Checklist | `/ai-image-generation/cyberpunk` |
| `mafia-photo-package-guide` | Mafia-Style AI Photos: Wardrobe, Lighting, and Scene Guide | `/ai-image-generation/mafia` |
| `magic-upscaler-photo-package-guide` | Magic Upscaler Guide: Improve Clarity Without Overprocessing Your Photo | `/ai-image-generation/photo-enhancer` |
| `nature-photo-package-guide` | Nature AI Portraits: Plan Forest, Mountain, and Lakeside Scenes | `/ai-image-generation/travel` |
| `outdoor-creator-scenes-photo-package-guide` | Outdoor Creator Photos: Urban Streets vs Scenic Locations | `/ai-image-generation/urban` |
| `valentine-photos-photo-package-guide` | Valentine's Day AI Photos: Couple Portraits, Cards, and Gifts | `/ai-image-generation/valentines-photo` |
| `virtual-try-on-photo-package-guide` | AI Virtual Try-On Guide: Plan Outfits Without Treating the Preview as Exact Fit | `/ai-image-generation/virtual-try-on` |
| `wedding-portraits-photo-package-guide` | AI Wedding Portraits: Plan Save-the-Dates, Moodboards, and Keepsakes | `/ai-image-generation/wedding-photo` |
| `world-cup-fan-photos-photo-package-guide` | AI Soccer Fan Photos: Match-Day Posters Without Official Marks | `/ai-image-generation/soccer` |

## 6. P1 页面与结构化数据整改

### 6.1 Schema 和社交元数据

生产发布后，每页必须满足：

- 恰好一个 BlogPosting。
- `headline` 与真实 H1 完全一致。
- `mainEntityOfPage`、canonical、OG URL 与 sitemap loc 完全一致。
- author 为确认后的 MyDreamShoots Organization，并带 `/about-us` URL。
- publisher 为同一 Organization，并输出真实可访问 logo。
- BreadcrumbList 的每项包含 `position`、`name`、`item`。
- 输出 `og:type=article`。
- 输出 `article:published_time` 与 `article:modified_time`。
- 输出 `og:image:alt`，且与正文图片 alt 同一实体。
- FAQ 保留为可见正文，不新增 FAQPage。

`34824ad2` 已包含相应发布合同，但线上 27 页目前一项也未体现，必须以线上 HTML 为最终依据。

### 6.2 图片

线上 27 张正文首图均没有 width/height。以下页面的现有 alt 明显错误或过度泛化：

- Professional Headshots 被描述为 credit plan panel。
- Magic Upscaler 被描述为 group framing。
- Nature 被描述为普通 travel portrait 和 event lighting。
- Product Style 未清楚体现产品包装、比例或 lifestyle commerce。
- Social Cards 与 Profile Cards 语义混淆。
- Wedding、Engagement、Valentine 多处共用普通 couple keepsake 描述。
- Boudoir、Virtual Try-On 仍使用普通 beauty portrait 描述。
- Christmas Photos 描述为 solo portrait，与 family/group 意图冲突。

整改：

1. 发布 profile 中已经写好的主题专属 alt。
2. 正文首图输出固有 `width`、`height`，或由稳定 aspect-ratio 保留布局空间。
3. OG image、正文 image 与 sitemap image 的 URL 和主题保持一致。
4. 图片发生实际变化时才更新 sitemap image 与 lastmod。

### 6.3 内链

最新本地 smoke 显示每个 profile 已有 3 个 related links。线上验收要求：

- 每页 1 个准确主 CTA。
- 每页 2-4 个真正与段落语义相关的产品或文章链接。
- 页面正文内部总计 3-5 条主要链接。
- 链接锚文本描述目标实体，禁止 `Open Avatar theme` 这类错误复用。
- 所有目标必须直接 GET 200，不经旧 `/tools`、旧聚合页或错误 taxonomy 跳转。

## 7. P2 搜索意图区隔与编辑质量

发布后继续人工复核以下相邻主题，防止重新形成关键词蚕食：

| 主题组 | 必须保持的区隔 |
|---|---|
| Christmas Couple / Christmas Photos / Holiday | 双人卡片与纪念品 / 家庭群像与相册 / 宽泛年末季节内容 |
| Desi Wedding / Indian Wedding / Wedding Portraits | 跨地区庆典与相册 / 参与者定义的仪式服饰珠宝检查 / 通用婚礼肖像与 save-the-date |
| Engagement / Valentine / Wedding | 求婚、订婚公告与戒指细节 / 情人节卡片与礼物 / 婚礼用途与正式细节 |
| Anime Avatar / Profile Cards / Social Cards | 插画化角色头像 / 多平台一致头像与 bio / 带发布文案空间的分享卡片 |
| Creator Portraits / Outdoor Creator Scenes | media kit、缩略图和品牌资料 / Urban 与 Travel 场景选择 |
| Nature / Outdoor Creator Scenes | 自然环境肖像 / 创作者渠道与场景策略 |
| Hairstyle / Virtual Try-On | 发型预览边界 / 服装预览且不承诺真实合身 |

编辑注意事项：

- 不为达到字数而填充内容；只补搜索任务中缺失的决策信息。
- 不编造价格、credits、输出数量、训练策略、删除承诺、用户评价或文化仪式事实。
- Boudoir 坚持 consenting adults、tasteful、non-explicit 和私密使用边界。
- Wedding 类内容由参与者自己定义服饰、仪式与文化背景，不把生成图当成文化事实。
- World Cup/Soccer 和 Halloween 避免未经授权的官方标志、角色和第三方 IP。
- 统一品牌大小写。目前较早九页 title 使用 `myDreamshoots`，新两批使用 `MyDreamShoots`；应由品牌负责人确定一种写法后统一，不应让三批页面长期混用。

## 8. 实施阶段

### Phase 0：冻结范围与生成发布快照

- 目标仅为这 27 页及其必要站点 SEO 映射。
- 不改 Aidreamcapes、其他博客、客户数据、订单、credits、媒体所有权和非目标产品 taxonomy。
- 记录生产当前 release marker、服务状态和数据库内容备份。
- 生成 scoped manifest，审查 diff 中只包含允许的公共内容。

### Phase 1：测试环境发布

- 部署包含 `0a21aef5`、`34824ad2`、`ea6ae40e` 的代码。
- 应用 scoped content manifest。
- 清除测试环境缓存。
- 运行 host 路由、`/site/mydreamshoots` 路由、桌面端和 390px 移动端检查。
- 对 27 页逐一核对 title、H1、CTA、图片、Schema、canonical 和正文内链。

### Phase 2：生产发布

- 只有测试环境全部通过后才部署生产。
- 部署代码后再应用同一已审查 manifest，避免代码与数据库版本不一致。
- 只重启 MyDreamShoots 生产服务。
- 清除 27 个目标 URL、11 个旧聚合 URL、sitemap 与相关 HTML 缓存。
- 发布完成后立即执行真实公网 GET/HEAD，不以服务内网响应代替。

### Phase 3：索引与表现监控

- 提交或重新处理 sitemap。
- 在 GSC 对 27 个 URL 执行 URL Inspection 抽样和 Coverage 复核。
- 第 7、14、28 天检查 Google-selected canonical、duplicate、soft 404、抓取状态、曝光、点击、CTR 和平均排名。
- PageSpeed API key 可用后，对代表性文章模板补测移动端和桌面端 LCP、INP、CLS。

## 9. 自动化验收

### 9.1 必须新增或合并的 27 页线上合同

- GET 与 HEAD 均直接返回 200。
- 不输出 `Location`，不发生 soft 404。
- 27 个 title、H1、BlogPosting headline 全部唯一且实体一致。
- 线上 H1 与当前 profile 匹配 `27/27`。
- 不出现 `how to plan this myDreamshoots photo package category`。
- Profile Cards 不出现 Anime Avatar title、H1 或正文实体。
- 5-gram Jaccard 必须 `< 0.70`；`>= 0.35` 输出人工复核警告。
- 每页 3-5 条有效正文链接，所有目标直接 200。
- 禁止六组已知错误 CTA。
- 每页只有一个 BlogPosting；Organization、BreadcrumbList、BlogPosting 都可解析。
- author 为 Organization 且有 URL；publisher 有 logo。
- canonical、OG URL、mainEntityOfPage、sitemap loc 完全一致。
- 图片 alt、OG image、sitemap image title/caption 与页面实体一致。
- 正文首图具备 width/height 或稳定布局尺寸。
- sitemap 只包含可渲染、可索引 canonical URL。
- sitemap lastmod 只因实际内容修改而变化。

### 9.2 建议命令

```bash
npm run typecheck
npm run build
npm run smoke:mydreamshoots-priority-blog-remediation
npm run smoke:mydreamshoots-seasonal-occasion-blog-seo
npm run smoke:mydreamshoots-seo-indexing
npm run smoke:mydreamshoots-media-seo-schema
npm run smoke:storefront-media-alt
npm run smoke:storefront-public-routes
npm run smoke:playwright-priority-blog
npm run smoke:playwright-seasonal-occasion-blog
```

补充一个聚合的 `smoke:mydreamshoots-blog-27-seo`，把三批 slug、线上禁止 CTA、27 页跨批次 Jaccard 和 HEAD 合同放到同一入口，避免单批测试通过但跨批次回归失败。

## 10. 当前本地验证结果

本次复审重新运行：

- `smoke:mydreamshoots-priority-blog-remediation`：通过；并串行执行三批 profile 检查。
- `smoke:mydreamshoots-seasonal-occasion-blog-seo`：通过。
- `smoke:mydreamshoots-seo-indexing`：通过。
- `smoke:mydreamshoots-media-seo-schema`：通过。
- `smoke:storefront-media-alt`：通过。

其中 `smoke:mydreamshoots-blog-seo-remediation` 不是独立的 package script 名称，但对应 Node 检查已由 `smoke:mydreamshoots-priority-blog-remediation` 串行执行并通过。

这些结果只能证明仓库候选内容符合本地合同，不能替代生产发布后验收。

## 11. 完成定义

本轮整改只有在以下条件全部满足时才算完成：

1. 生产运行代码和 GitHub `main` 对应到明确 commit。
2. 生产数据库发布快照包含 27 个最新 profile。
3. 27 页公网 GET/HEAD 都直接 200。
4. 线上 title、H1、正文、CTA、图片与 Schema 全部匹配本报告目标合同。
5. 线上 27 页跨批次相似度通过门限。
6. sitemap、canonical、OG URL 和 mainEntityOfPage 一致。
7. CDN 清理后从不同请求方式复测不再出现旧模板。
8. GSC 未继续报告这些 URL 为 redirect、duplicate 或 soft 404。

## 12. 不在本轮范围

- 不合并或 301 这 27 个 URL。
- 不创建新的 Christmas Couple、Desi Wedding、Indian Wedding、Fashion Editorial、Product Style 或 Social Cards 产品工具页。
- 不修改 Aidreamcapes 或其他站点。
- 不以未验证的 PageSpeed、GSC 或流量数据作效果承诺。
- 不直接修改生产数据；生产 apply 必须经过测试环境、manifest 审查与显式批准。
