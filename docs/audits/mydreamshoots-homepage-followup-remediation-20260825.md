# myDreamshoots 首页再次审计与整改计划

审计日期：2026-08-25
标准文档：`/Users/a1/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_p18jcnxkt5d112_3a66/temp/drag/mydreamshoots-homepage-final-seo-redesign.md`
事实基线：production release `codex-homepage-phaseb-v118-20260825`、publication v118、approved lock `docs/content-locks/mydreamshoots-homepage-approved.json`

## 1. 复审结论

当前首页已完成附件要求的 Phase B 文案、结构和精选数据闭环。publication v118、approved lock、生产 HTML 与当前 renderer 已完成回读；剩余事项仅属于全站基础设施持续验收，不再阻塞首页发布。

1. 首页生产 HTML 为 H1=1、主模块 H2=9，Bottom CTA 已降为普通文本。
2. Video 已按批准顺序展示 8 张真实 publication projection 卡片：Talking Photo、Cinematic Video、TikTok Video、Instagram Reels、Product Video、Product Ad Video、Promo Video、Motion Generator。
3. 首页不再使用静态 `imageSlugs` / `videoSlugs` 作为 MyDreamShoots published 内容源。
4. Phase B 文案契约已扩展到 SEO、Hero、Auth、Gallery、FAQ、CTA 和 Footer 关键字段，并由模板/同步链路复用。
5. approved lock 已刷新到 publication v118；生产 release、service、current symlink 和 HTML readback 一致。

## 2. 已符合项

以下内容已通过生产 HTML、publication v118 或双域名 smoke 验证，本轮不重复改写：

- `<title>`：`AI Video & Photo Generator | myDreamshoots`
- Meta description 已使用 Save the Date 正式上线版本。
- canonical 为 `https://www.mydreamshoots.com`。
- 首页恰好一个 H1：`Create AI Videos, Professional AI Headshots & Photo Sets from Your Images`。
- Hero eyebrow、Announcement、Hero description、Google 登录、Email CTA、`Create Now`、`Explore AI Video`。
- Video → Save the Date → Photo 顺序。
- Video Intro、Save the Date Intro、Photo Intro、Pricing credits 说明。
- FAQ 两个 Video 问题和 Save the Date 问题及答案。
- Footer Product：`AI Video Generation`、`AI Save the Date`、`AI Image Generation`、`AI Photo Packages`、`Pricing`。
- Photo Package 卡片为 H3/普通标题，Photo→`/ai-video-generation` 描述性内链存在。
- Aidreamcapes 根路径现在返回 200；MyDreamShoots 与 Aidreamcapes 真实 hostname 的 Head title-order smoke 已通过。
- MyDreamShoots publication projection 当前包含 Video 19 条、Save the Date 4 条、Photo 8 条；Save the Date 四条均为 published/indexable/sitemapEligible。

## 3. 本轮已闭环问题记录

### P0：线上结构与首页数据源

#### 3.1 Bottom CTA 不应占用主模块 H2

生产 HTML readback 已为 `H1=1`、`H2=9`；`Ready to create with myDreamshoots?` 不再渲染为 H2。附件最终 H 标签结构要求的主模块为 About、Video、Save the Date、Photo、Pricing、How It Works、Photo Packages、Reviews、FAQ，共 9 个 H2。

整改已完成：保持 Bottom CTA 的视觉层级和文案不变，将 conversion panel 标题改为普通文本；smoke 已断言主模块 H2 集合准确且 CTA 不计入 H2。

#### 3.2 Video Gallery 已切换到 publication projection

发布前生产首页曾实际显示：

- Creator Scene Motion
- Cinematic Portrait Motion
- Social Profile Clip
- Travel Route Story
- Wedding Memory Film
- Holiday Card Motion
- Product Showcase Motion
- Prompt Directed Motion

这些已切换为附件要求的 Phase B 首批 8 个 Video 精选意图；publication v118 提供合法投影记录，首页 JSON 的静态 `videoSlugs` 不再覆盖 projection。

整改已完成：移除 MyDreamShoots 首页 published/draft JSON 中的 `imageSlugs`、`videoSlugs`；首页只从同一 active publication 的 `publishedHomepageShowcases` 读取卡片，固定精选 8 条并按附件顺序排序。卡片第二行使用用途说明，不重复标题。

### P1：文案契约与默认回退（已完成本轮收敛）

#### 3.3 Phase B 文案契约已扩展

当前 `src/lib/mydreamshoots-homepage-copy.json` 已集中 Video、Save the Date、Photo、Pricing、How It Works、Reviews、Bottom CTA，但以下字段仍分散：

- SEO title / description / keywords
- Announcement bar
- Hero headline / subheadline / primary and secondary CTA
- Auth card headline / ribbon / Email CTA
- Photo Intro
- FAQ 问题与答案
- Footer Product labels

整改已完成：contract 已覆盖 SEO、Hero、Auth、Gallery、FAQ、CTA 和 Footer 关键字段，并由模板、section schema、Postgres 同步脚本、publication smoke、approved lock 对比复用。独立 Best AI Image/Video 页面继续保留自己的 contract。

#### 3.4 模板与同步脚本的首页 fallback 已隔离

发现的风险包括：

- 通用模板中的 `Create my first photo set`、`/login` CTA fallback。
- MyDreamShoots 首页同步链路与模板链路没有完全复用同一 contract。
- `mergeBestGallery` 中的 `Best Photo Generator` / `Best Video Generator` 属于独立 Best Pages，应加清晰 scope guard，避免误被首页同步脚本调用。

整改已完成：MyDreamShoots 首页使用显式 `siteId + pageType=home` 分支，首页 fallback 使用 Phase B contract；独立 Best Pages 保持独立 contract。

#### 3.5 Approved lock 元数据已重新对齐

approved lock 当前记录 publication v118；发布记录、snapshot hash、生产 release 和 HTML fingerprint 已重新回读并固定。

整改已完成：通过锁定/同步脚本重新生成 lock metadata，并记录 publication、snapshot hash、release、service 和线上 HTML fingerprint。

## 4. 基础设施专项状态

### 已基本恢复

- Aidreamcapes 根路径现为 200，不再是 Head smoke 的阻塞项。
- 双域名 title-first/head ordering smoke 已通过。
- sitemap coverage 已有冷/热请求检查，publication v118 的目录覆盖此前通过。

### 仍需持续验收

- 完整双店铺 navigation Playwright 仍需在真实 TLS hostname 下完成桌面/移动断言。
- Public routes smoke 要继续区分 expected 404、301/308 alias、Cloudflare `/cdn-cgi/` 管理路径和真实应用 500。
- Sitemap 冷启动需持续监控生成耗时，避免数据库冷缓存时再次超时。

## 5. 分阶段整改计划

### Phase 0：基线确认

1. 读取 active publication v118、ThemePage、ThemeSettings、approved lock 和生产 HTML。
2. 记录当前 H1/H2/H3、Video/Save the Date/Photo 数量、卡片 canonical、静态 slug 字段和 projection hash。
3. 明确 Best Pages 与首页 contract 的边界，禁止独立页面文案回写首页。

### Phase 1：修复线上结构

1. 将 conversion panel 标题降为普通文本元素，保留视觉样式和 `Ready to create with myDreamshoots?` 文案。
2. 统一首页主模块 H2 集合为 9 个，卡片保持 H3/普通标题。
3. 增加结构 smoke：恰好 1 个 H1、主模块 H2 集合准确、CTA 不计入 H2。

### Phase 2：修复 Video 精选数据

1. 删除 MyDreamShoots 首页 JSON 的静态 `imageSlugs` / `videoSlugs`。
2. 从 active publication projection 选择 8 条 Video：Talking Photo、Cinematic Video、TikTok Video、Instagram Reels、Product Video、Product Ad Video、Promo Video、Motion Generator。
3. 保持 Save the Date 4 条和 Photo 8 条，全部来自同一 projection。
4. 校验所有卡片 href、canonical、HTTP 状态、index/follow 和 sitemap eligibility。

### Phase 3：收敛文案来源

1. 扩展 `src/lib/mydreamshoots-homepage-copy.json` 覆盖全部 Phase B 首页字段。
2. 模板、section schema、DB 同步、publication smoke、content guard 和 approved lock 全部读取 contract。
3. 增加旧文案 guard：`Create my first photo set`、`AI Headshot Photo Packages`、`Best Video Generator`、`Best Photo Generator` 只能出现在明确的独立页面 scope，不得出现在 MyDreamShoots 首页 fallback。
4. 重新生成 lock metadata，确保 publication v118、snapshot hash、release 和线上 HTML fingerprint 一致。

### Phase 4：发布与跨店铺验收

依次执行：

```text
npm run typecheck
npm run smoke:homepage-showcase-publication
npm run smoke:dreamshoot-homepage-showcase
npm run smoke:storefront-head-title-order
npm run smoke:storefront-seo-fingerprint
npm run smoke:public-seo-policy
npm run smoke:storefront-public-routes
npm run smoke:storefront-navigation-data
npm run smoke:storefront-sitemap-directory-coverage
npm run guard:mydreamshoots-content
```

发布后必须记录：

- publication ID/version/publishedAt/snapshot hash
- approved lock fingerprint 与 lockedAt
- production release、current symlink、service 状态
- 线上 H1/H2/H3、文案、卡片数量和 canonical readback
- sitemap 冷/热 GET/HEAD 响应
- MyDreamShoots 与 Aidreamcapes 的 TLS、Header、Footer、canonical、lang/translate 属性和品牌隔离结果

## 6. 验收标准

- 首页 H1=1；主模块 H2=9；Bottom CTA 不渲染为 H2；卡片为 H3/普通标题。
- Video/Save the Date/Photo 首页精选数量为 `8 / 4 / 8`。
- Video 首页首批入口与附件推荐意图一致，且每张卡片第二行是用途说明。
- 首页不再持有静态 `imageSlugs` / `videoSlugs` 作为 published 内容来源。
- Title、Meta、canonical、Hero、Announcement、Auth、Gallery Intro、Pricing、How It Works、FAQ、Bottom CTA、Footer 均来自同一 Phase B contract。
- Footer 不含 `Best Packages`；独立 `/best-packages` 仍保持自己的页面 contract。
- DB、active publication、approved lock、模板 fallback 和生产 HTML fingerprint 一致。
- 不影响 Aidreamcapes、西语店铺和独立 Best Pages 的品牌、语言、路由与内容隔离。
