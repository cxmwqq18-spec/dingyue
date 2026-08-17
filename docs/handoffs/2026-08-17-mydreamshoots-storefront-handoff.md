# MyDreamShoots 店铺交接文档

生成时间：2026-08-17
本地分支：`feature/gemini-huitu-video`
本地提交：`2ea7b82f Add MyDreamShoots video theme framework`
线上域名：`https://www.mydreamshoots.com`
本地预览：`http://127.0.0.1:3002/site/mydreamshoots`
上线状态：本地代码已提交并推送到 GitHub；未执行上线。

## 交接结论

MyDreamShoots 本地代码已经包含新的 AI Video Generation 主题目录和 9 个公开视频主题详情路由，但线上仍是旧的视频工具/图片工具目录。当前不能直接上线，因为本地首页客户可见 H1 与线上首页 H1/已批准锁定基线存在差异，需要先找站点负责人确认或恢复首页文案。

## 店铺身份

| 项 | 值 |
| --- | --- |
| Site ID | `site_dreamshoot` |
| Slug | `mydreamshoots` |
| Name | `myDreamshoots` |
| Primary domain | `www.mydreamshoots.com` |
| Status | `active` |
| Active theme | `dreamshoot-ai-studio` |
| Draft theme | `ai_subscription_theme1` |
| Theme publications | 2 |
| Creative packs | 38 |
| Creative pack categories | 50 |
| Video theme categories | 16 |
| Video themes | 8 |
| Media assets | 23 |

数据来源：`data/platform-state.json`。

## 主要源码入口

- Runtime storefront override：`src/lib/storefront-render.tsx`
- Theme section renderer：`src/components/theme-renderer.tsx`
- Video topic content：`src/lib/ai-video-topic-content.ts`
- Talking Photo content：`src/lib/talking-photo-content.ts`
- Public topic detail component：`src/components/storefront/ai-video-topic-landing.tsx`
- Talking Photo detail component：`src/components/storefront/talking-photo-landing.tsx`
- Header/menu video framework：`src/lib/mydreamshoots-video-framework.ts`
- SEO/indexing helpers：`src/lib/seo-indexing.ts`、`src/lib/theme/seo.ts`、`src/lib/theme/json-ld.ts`
- Launch baseline：`docs/storefront-launch-checklist.md`
- Homepage approved lock：`docs/content-locks/mydreamshoots-homepage-approved.json`

## 本地新增视频主题目录

本地 `/site/mydreamshoots/ai-video-generation` 已经由 renderer runtime 覆盖为一个 synthetic page，只渲染 `dreamshoot_tool_collection` 的 `video_theme_grid` 布局，不再回退到旧 photo-tool/template section。

本地 Playwright smoke 结果：

| 检查项 | 结果 |
| --- | --- |
| `[data-video-theme-card]` 数量 | 9 |
| 桌面首行卡片数 | 4 |
| 移动宽度 `390px` | 无横向溢出，`scrollWidth=390` |
| 卡片封面 | 使用各视频主题详情页的 hero/cover 图片 |
| 旧内容 | 未出现 `Paid AI photo tools`、`Studio tools are the on-ramp`、`Photo packages`、`Image To Video Concept`、`Profile Clip Maker` |

9 个公开主题：

| 主题 | 路由 |
| --- | --- |
| Talking Photo | `/ai-video-generation/talking-photo` |
| Cinematic Video | `/ai-video-generation/cinematic-video` |
| TikTok Video | `/ai-video-generation/tiktok-video` |
| Instagram Reels | `/ai-video-generation/instagram-reels` |
| Social Media Video | `/ai-video-generation/social-media-video` |
| YouTube Video | `/ai-video-generation/youtube-video` |
| Story Video | `/ai-video-generation/story-video` |
| Meme Video | `/ai-video-generation/meme-video` |
| Product Video | `/ai-video-generation/product-video` |

## 本地与线上对比

采样时间：2026-08-17。线上请求走 `https://www.mydreamshoots.com`；本地页面请求走 `http://127.0.0.1:3002/site/mydreamshoots`；本地 `robots.txt` 和 `sitemap.xml` 需要用根路径加 `Host: www.mydreamshoots.com` 验证。

| 路由 | 本地 | 线上 | 结论 |
| --- | --- | --- | --- |
| `/` | 200，title/canonical/keywords 与线上一致，但 description 与 H1 不一致 | 200，H1 为 `Upload selfies and create your own AI model - Headshot without a studio.` | 存在客户可见文案漂移，上线前必须处理 |
| `/ai-video-generation` | 200，H1 为 `AI Video Generation`，9 个主题卡，使用各主题详情封面 | 200，H1 为 `Paid AI photo tools for better source images.`，仍有旧 photo-tool 内容 | 本地新目录未上线 |
| `/ai-video-generation/talking-photo` | 200，H1 为 `Make a Photo Talk Without Recording Another Take` | 404 | 本地新增详情页未上线 |
| `/best-packages` | 200，title/description/canonical/H1 与线上一致 | 200 | SEO 主信号一致；本地 header/menu 链接数更多 |
| `/best-ai-image` | 200，title/description/canonical/H1 与线上一致 | 200 | SEO 主信号一致；本地 header/menu 链接数更多 |
| `/best-ai-video` | 200，title/description/canonical/H1 与线上一致；本地视频主题菜单已换成 9 个公开主题 | 200，仍是线上旧菜单/旧数据 | 主页面 SEO 一致，视频主题入口未同步 |
| `/pricing` | 200，title/description/canonical/H1 与线上一致 | 200 | SEO 主信号一致；本地 header/menu 链接数更多 |
| `/robots.txt` | 200，app 输出 `Allow: /` 和本站 sitemap | 200，Cloudflare Managed Content Signals + app 输出 | 线上多 Cloudflare 托管 robots 段，属于边缘层差异 |
| `/sitemap.xml` | 96 条，只包含 `mydreamshoots.com` | 95 条，只包含 `mydreamshoots.com` | 本地 sitemap 用新 9 个视频主题详情替换线上旧 8 个视频工具详情 |

Sitemap 差异：

| 本地新增/替换为 | 线上仍保留 |
| --- | --- |
| `/ai-video-generation/talking-photo` | `/ai-video-generation/image-to-video` |
| `/ai-video-generation/cinematic-video` | `/ai-video-generation/profile-clip` |
| `/ai-video-generation/tiktok-video` | `/ai-video-generation/fan-poster-motion` |
| `/ai-video-generation/instagram-reels` | `/ai-video-generation/creator-intro-video` |
| `/ai-video-generation/social-media-video` | `/ai-video-generation/product-teaser-clip` |
| `/ai-video-generation/youtube-video` | `/ai-video-generation/animated-avatar` |
| `/ai-video-generation/story-video` | `/ai-video-generation/fashion-reel` |
| `/ai-video-generation/meme-video` | `/ai-video-generation/album-story-video` |
| `/ai-video-generation/product-video` |  |

## 上线前阻塞项

1. 处理首页文案漂移。本地首页 description 是 `Create AI headshots, portraits, themed photo sets, editing workflows, and supported short video results from your own approved photos. Compare examples and credit costs before you generate.`；线上 description 是 `Turn your selfies into stunning couple photos in seconds with myDreamshoots – the most advanced AI photo generator maker. No studio, no outfits, just magic.`。
2. 处理首页 H1 漂移。本地 H1 是 `Create Professional AI Headshots and Photo Sets Without a Studio`；线上 H1 是 `Upload selfies and create your own AI model - Headshot without a studio.`。
3. 对照 `docs/content-locks/mydreamshoots-homepage-approved.json` 和 `docs/storefront-launch-checklist.md`，确认这次首页文案变化是否获批。未获批不要上线。
4. 如果要上线视频主题目录，需要同步确认 sitemap 从旧 8 个 video tool detail 路由切到新 9 个 public theme detail 路由是预期变更。

## 建议验证命令

```bash
npm run typecheck
npm run guard:mydreamshoots-content
npm run smoke:mydreamshoots-public-routes
npm run smoke:mydreamshoots-seo-indexing
npm run smoke:storefront-sitemap-directory-coverage
npm run smoke:storefront-header-layout
```

本地 robots/sitemap 验证示例：

```bash
curl -sS -H 'Host: www.mydreamshoots.com' http://127.0.0.1:3002/robots.txt
curl -sS -H 'Host: www.mydreamshoots.com' http://127.0.0.1:3002/sitemap.xml
```

## 建议技能

- `dreamshoot-frontend-english`：修改 DreamShoots/MyDreamShoots/AIdreamcapes 客户可见页面时使用。
- `github-sync-before-finish`：需要再次提交并推送 GitHub 时使用。
- `mydreamshoots-fast-deploy`：只有站点负责人明确要求上线时才使用；本次交接未上线。
