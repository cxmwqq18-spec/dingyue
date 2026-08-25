# myDreamshoots 首页二次审计与整改文档

审计日期：2026-08-25
适用范围：`www.mydreamshoots.com` 首页、首页发布/模板契约，以及本轮明确列出的 sitemap、公共路由和导航生产环境检查。
标准文档：`/Users/a1/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_p18jcnxkt5d112_3a66/temp/drag/mydreamshoots-homepage-final-seo-redesign.md`

## 1. 基线与结论

本轮以 Save the Date 已正式展示为 Phase B 判断依据，使用当前 active publication v116、approved lock 和生产 HTML readback 作为事实基线：

- publication：`pub_site_dreamshoot_mt7lfuex_e3a39455`
- version：`116`
- snapshot hash：`b0f8ee35fbfb5f78757f3c81141e7a01e2a025f01ba3f2b9bfa8735b2eca8222`
- approved lock：`docs/content-locks/mydreamshoots-homepage-approved.json`
- 页面顺序：Video -> AI Save the Date -> Photo
- 精选数量：Video / Save the Date / Photo = `8 / 4 / 8`

结论：Phase B 核心内容已写入 publication、approved lock 和模板契约，并已部署到 production release `codex-homepage-phaseb-20260825` 完成 HTML readback。另需持续处理与首页发布独立的 sitemap projection、公共路由及 TLS smoke 问题。

## 2. 已符合项

- Title、Meta Description、canonical、单一 H1 和 JSON-LD 位于 head。
- Hero H1、Hero CTA、Google 登录、Email CTA、Announcement、About、登录卡正文符合 Video + Photo + Save the Date 语义。
- 三个 Gallery 的顺序、卡片数量、真实页面链接和用途型第二行文案符合批准基线。
- Pricing、Prompt 未开放版本的 How It Works、Photo Packages 到 `/ai-video-generation` 的内链符合要求。
- FAQ 已包含两个 Video 问题和从照片创建 Save the Date 的问题。
- Header/Footer Product 已切换到 `AI Video Generation`、`AI Save the Date`、`AI Image Generation`、`AI Photo Packages`、`Pricing`。
- Motion Generator 在 Image-to-Video 独立页面尚未单独上线时，作为合法替代入口保留。

## 3. 本轮继续整改项

### P1 文案与语义

1. Gallery 顶部的 `Creative workflow examples built with myDreamshoots` 保留视觉说明，但在 MyDreamShoots 首页降为普通文字，不再占用独立 H2；Photo Package 卡片标题统一为 H3。
2. Hero 的 `eyebrow` 与 `heroBadge` 统一为 `AI Video & Photo Creation`，防止编辑器或模板回退出现空 eyebrow。
3. Hero 长描述、Bottom CTA 说明统一使用批准的长破折号版本：`images—all in one private workspace.`。仓库的 ASCII 编辑约束下，ASCII 连字符只能作为批准等价形式，smoke 不应因标点差异误报。
4. `How It Works` 标题统一为最终大小写。

### P0 默认文案与发布契约

1. MyDreamShoots 模板默认 branding、Footer tagline、Hero 默认值和 Product 默认项已改为 Video + Photo + Save the Date 语义。
2. 通用 Hero schema 的旧 `Private AI photo studio`、`Create studio-quality photos...` 等默认值已替换为中性的 Video + Photo fallback；Aidreamcapes、西语店铺和独立 SEO 页面不使用本次 MyDreamShoots 首页批准值。MyDreamShoots Phase B 文案已集中到 `src/lib/mydreamshoots-homepage-copy.json`。
3. 模板默认 Footer 不再把 `Best AI image` / `Best AI video` 作为 MyDreamShoots Product 菜单项；独立 Best Pages 仍保留自己的页面和契约。
4. 发布脚本与数据库同步脚本同时写入 `eyebrow`、`heroBadge`、最终标点、Pricing、How It Works 和 Bottom CTA，避免再次只更新单一字段。

### P1 测试与文档契约

- 首页 showcase smoke 已更新为 Phase B 的 How It Works、Pricing、Bottom CTA、Logo intro 和 tutorial 文案。
- Header smoke 已更新 MyDreamShoots 导航顺序：Video -> AI Save the Date -> Image -> How it works -> Blog -> Pricing -> Workspace；`Tools -> Best Packages` 顺序断言仅适用于 Aidreamcapes/Grownstride。
- Sitemap smoke 增加 GET/HEAD、状态、空 HEAD body、响应时间和真实域名请求检查。
- 发布 checklist 已记录 publication v116 和新的 Footer Product 基线，并区分 Best Packages 独立兼容路径。

## 4. 独立路由与生产环境专项

这些问题不改变本轮首页文案结论，但必须单独闭环。

### P1 Sitemap coverage timeout

当前整改方向：sitemap 通过单次缓存 payload 同时读取 entries 和 publication identity，增加显式 HEAD，避免 GET 与 identity 各自重复读取数据库。生产验收必须分别检查 `GET /sitemap.xml`、`HEAD /sitemap.xml`、响应时间、XML 完整性、canonical、index/follow 和实际 200 页面覆盖。sitemap 不得包含 404、500、redirect-only 或 noindex URL。

### P1 Public routes 404/500

路由矩阵必须明确记录为 200 canonical、301/308 alias 或 404/noindex：

| 路径组 | 目标行为 |
| --- | --- |
| `/collections/engagement-photo`、`/collections/headshot` | 永久重定向到 `/ai-image-generation/engagement-photo`、`/ai-image-generation/headshot` |
| `/holidays-events/christmas`、`/new-year`、`/thanksgiving` | 若正式页面已发布则 200；否则移出导航/sitemap 并返回 404/noindex；不得 500 |
| `/ai-video-generation/explainer-video`、`how-to-video`、`meme-video` | 已发布则修复为 200；未达到发布条件则 404/noindex；不得 500 |
| `/cdn-cgi/l/email-protection` | Cloudflare 管理路径，从应用公共路由扫描中排除 |

当前生产检查中，三个视频路径已返回 200，两个集合别名已返回 308；季节旧路径按未发布实体返回 404，已纳入 expected 404 契约，并需确认不再进入导航/sitemap。Cloudflare `/cdn-cgi/` 路径已从应用路由扫描排除。publication v116 的 sitemap coverage smoke 对 MyDreamShoots 与 Aidreamcapes 均通过，冷/热 GET/HEAD 响应已稳定。

### P1 Navigation Playwright SSL protocol error

导航 smoke 已支持为每个店铺配置独立真实 hostname，并在 Playwright 前执行 TLS 预检。生产运行时使用 `STOREFRONT_NAV_MYDREAMSHOOTS_BASE_URL` 和 `STOREFRONT_NAV_AIDREAMCAPES_BASE_URL`，不再用一个 HTTPS base URL 加伪造 `Host` header 检查多个店铺。失败分类必须区分 DNS/证书/TLS、Cloudflare host routing 和应用导航内容错误。

## 5. 发布与验收计划

发布前执行：

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

首页内容契约必须断言：恰好一个 H1；Gallery 主标题为 H2；卡片为 H3 或普通标题；Video/Save the Date/Photo 数量为 `8 / 4 / 8`；卡片链接为真实 canonical；Footer 不含 `Best Packages`；不出现旧 Photo-only 文案；DB、active publication、approved lock 与生产 HTML fingerprint 一致。

本轮发布记录：publication `pub_site_dreamshoot_mt7lfuex_e3a39455` / version `116` / snapshot `b0f8ee35fbfb5f78757f3c81141e7a01e2a025f01ba3f2b9bfa8735b2eca8222`；approved lock 与 DB fingerprint 一致；production release `codex-homepage-phaseb-20260825` 已构建、切换且 `mydreamshoots.service` active。生产 HTML readback 已确认 1 个 H1、Photo Package 卡片非 H2、Photo→Video 内链存在；MyDreamShoots 与 Aidreamcapes 真实 hostname head smoke 均通过。Sitemap coverage 已通过；季节旧路径按 expected 404 契约处理。

## 6. 假设与边界

- Save the Date 已正式上线，继续使用 Phase B，不执行隐藏模块的 Phase A 分支。
- publication v116 是本轮基线。
- 本文档不修改 Aidreamcapes、西语店铺和独立 Photo/Video 页面文案；Aidreamcapes 根路径已恢复 200，跨店铺 smoke 使用真实域名/TLS 检查。
- `data/platform-state.json` 已弃用；首页 showcase smoke 改为直接读取 PostgreSQL `PlatformStateDocument`、active publication 和生产 HTML，不再依赖该文件。
- 独立路由和生产 TLS 问题属于后续专项；在其未闭环前，不得把首页已通过的内容审计标记为全站路由验收完成。
