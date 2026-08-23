# AIdreamcapes 店铺交接文档

生成时间：2026-08-17
本地分支：`feature/gemini-huitu-video`
本地提交：`2ea7b82f Add MyDreamShoots video theme framework`
线上域名：`https://www.aidreamcapes.com`
本地预览：`http://127.0.0.1:3002/site/aidreamcapes`
上线状态：本地代码已提交并推送到 GitHub；未执行上线。

## 交接结论

AIdreamcapes 本地与线上在本次采样的公开核心页面上，HTTP 状态、title、description、canonical、H1、JSON-LD 数量均一致。页面 HTML hash 不一致，主要来自本地 dev build、资源版本、Next runtime 数据和边缘层差异；未发现 MyDreamShoots 新视频主题目录泄漏到 AIdreamcapes 公开路由。

## 店铺身份

| 项 | 值 |
| --- | --- |
| Site ID | `site_aidreamcapes` |
| Slug | `aidreamcapes` |
| Name | `Aidreamcapes` |
| Primary domain | `www.aidreamcapes.com` |
| Status | `active` |
| Active theme | `ai_subscription_theme1` |
| Draft theme | `ai_subscription_theme1` |
| Theme publications | 1 |
| Creative packs | 28 |
| Creative pack categories | 27 |
| Tool menu items | 20 |
| Video theme categories | 4 |
| Video themes | 8 |
| Media assets | 7 |

数据来源：PostgreSQL 关系表与 `PlatformStateDocument`；历史 JSON 仅保留在 `archive/legacy/`，不参与运行时。

## 主要源码入口

- Domain routing：`src/lib/domain-routing.ts`
- Storefront route rendering：`src/lib/storefront-render.tsx`
- Theme section renderer：`src/components/theme-renderer.tsx`
- Theme package templates：`src/lib/theme/packages/dreamshoot-ai-studio/templates.ts`
- SEO/indexing helpers：`src/lib/seo-indexing.ts`、`src/lib/theme/seo.ts`、`src/lib/theme/json-ld.ts`
- Aidreamcapes logo sync：`scripts/sync-aidreamcapes-trusted-logos.mjs`
- Homepage layout sync：`scripts/sync-dreamshoot-homepage-layout.mjs --site=aidreamcapes`
- Launch baseline：`docs/storefront-launch-checklist.md`

## 本地与线上对比

采样时间：2026-08-17。线上请求走 `https://www.aidreamcapes.com`；本地页面请求走 `http://127.0.0.1:3002/site/aidreamcapes`；本地 `robots.txt` 和 `sitemap.xml` 需要用根路径加 `Host: www.aidreamcapes.com` 验证。

| 路由 | 本地 | 线上 | 结论 |
| --- | --- | --- | --- |
| `/` | 200，title/description/keywords/canonical/H1 一致；H1 为 `Create private fan-scene albums, game-day group portraits, and holiday memory sets.` | 200，同本地 | 主信号一致 |
| `/best-packages` | 200，title/description/canonical/H1 一致 | 200，同本地 | 主信号一致 |
| `/best-ai-image` | 200，title/description/canonical/H1 一致 | 200，同本地 | 主信号一致 |
| `/best-ai-video` | 200，title/description/canonical/H1 一致 | 200，同本地 | 主信号一致 |
| `/collections` | 200，title/description/canonical/H1 一致 | 200，同本地 | 主信号一致 |
| `/tools` | 200，title/description/canonical/H1 一致 | 200，同本地 | 主信号一致 |
| `/pricing` | 200，title/description/canonical/H1 一致 | 200，同本地 | 主信号一致 |
| `/robots.txt` | 200，app 输出 `Allow: /` 和本站 sitemap | 200，Cloudflare Managed Content Signals + app 输出 | 线上多 Cloudflare 托管 robots 段，属于边缘层差异 |
| `/sitemap.xml` | 95 条，只包含 `aidreamcapes.com` | 95 条，只包含 `aidreamcapes.com` | sitemap URL 集合一致，无跨店铺域名泄漏 |

## 当前注意点

1. 本次代码提交主要围绕 MyDreamShoots 视频主题目录展开；AIdreamcapes 应保持品牌、文案、分类和 sitemap 隔离，不要被 MyDreamShoots 9 个视频主题目录影响。
2. AIdreamcapes 线上 robots.txt 比本地多 Cloudflare Managed Content Signals，这是 Cloudflare 边缘层自动内容，不是应用代码差异。
3. 页面 HTML hash 不一致不能单独作为漂移判断；更应该看 title、description、canonical、H1、route status、sitemap URL 集合、公开导航和图片资源隔离。
4. 如果后续修改 `/best-packages`、`/best-ai-image`、`/best-ai-video`、`/collections` 或 `/tools`，必须同时跑双店铺 smoke，避免只改 MyDreamShoots。

## 建议验证命令

```bash
npm run typecheck
npm run smoke:aidreamcapes-brand-links
npm run smoke:aidreamcapes-faq-rules
npm run smoke:aidreamcapes-before-after-assets
npm run smoke:storefront-public-routes
npm run smoke:storefront-navigation-data
npm run smoke:storefront-sitemap-directory-coverage
npm run smoke:storefront-header-layout
```

本地 robots/sitemap 验证示例：

```bash
curl -sS -H 'Host: www.aidreamcapes.com' http://127.0.0.1:3002/robots.txt
curl -sS -H 'Host: www.aidreamcapes.com' http://127.0.0.1:3002/sitemap.xml
```

## 建议技能

- `dreamshoot-frontend-english`：修改 AIdreamcapes 客户可见页面时使用。
- `template-config-sync`：同步主题模板、生成站点 UI 或跨店铺模板配置时使用。
- `github-sync-before-finish`：需要再次提交并推送 GitHub 时使用。
- `mydreamshoots-fast-deploy`：只有站点负责人明确要求上线时才使用；本次交接未上线。
