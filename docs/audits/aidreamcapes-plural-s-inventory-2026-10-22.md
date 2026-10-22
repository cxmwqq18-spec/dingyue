# Aidreamcapes 复数 s 命名清单（2026-10-22）

范围：`site_aidreamcapes`（`www.aivideosugc.com` / `www.aidreamcapes.com`）。
本文是只读盘点 + 本次已执行的改名记录；未列出的 MyDreamShoots 站点不在范围内。

## 1. 本次已统一（3 条，已写入 LivePage + 代码 + 301）

| 旧名称 | 新名称 | 旧 URL | 新 URL |
| --- | --- | --- | --- |
| Product Videos | Product Video | `/ai-video-generation/product-videos` | `/ai-video-generation/product-video` |
| Before & After Videos | Before & After Video | `/ai-video-generation/before-after-videos` | `/ai-video-generation/before-after-video` |
| Spokesperson Videos | Spokesperson Video | `/ai-video-generation/spokesperson-videos` | `/ai-video-generation/spokesperson-video` |

执行结果：

- `LivePage.slug` 已改为单数；旧 slug 不再有 `LivePage` 行。
- `src/lib/aidreamcapes-site-v2-redirects.json` 已新增 3 条旧 → 新 301。
- 原 `product-video → product-videos` 的反向重定向已删除，避免形成循环。
- 原本指向旧复数 URL 的 10 条历史 301 已直接改指新 URL，不会产生 2 跳。
- `LivePage.contentJson` 内共替换 **151 处链接**、**92 处 label**，涉及 50 个页面；迁移后旧路径 / 旧 label 残留为 0。
- 页脚法务链接最左侧新增 `Content → /content`。
- 对比度：新页面 canonical、面包屑、siblings、relatedLinks、sitemap 均由新 slug 派生。

机器可读记录：`docs/audits/aidreamcapes-plural-s-rename-manifest-2026-10-22.json`。

## 2. 同类候选：公开工具页里仍以复数 s 结尾

### 2.1 Photos（图片工具，4 条）

| 导航名称 | URL |
| --- | --- |
| White Background Photos | `/ai-image-generation/white-background-photos` |
| Lifestyle Photos | `/ai-image-generation/lifestyle-photos` |
| Model Photos | `/ai-image-generation/model-photos` |
| Social Ad Photos | `/ai-image-generation/social-ad-photos` |

说明：`Photos` 表达的是“一组照片”，与 `Videos` 被当作工具名的情况略有不同。
如果按“工具名不加 s”的同一规则处理，应改为 `*-photo`；**本次未改，等待确认**。

### 2.2 Ads（广告类，5 条）

| 导航名称 | URL |
| --- | --- |
| Video Ads | `/ai-video-generation/video-ads` |
| Spark Ads Style Video | `/ai-video-generation/spark-ads-style-video` |
| Native Spark Ads | `/ai-video-generation/native-spark-ads` |
| PAS Formula Ads | `/ai-video-generation/pas-formula-ads` |
| Testimonial Ads | `/ai-video-generation/testimonial-ads` |

平台页同样使用 Ads：`/platforms/tiktok-ads`、`/platforms/instagram-ads`、`/platforms/facebook-ads`、`/platforms/youtube-shorts-ads`。
说明：`Ads` 是行业通用词（不是工具名的多余后缀），**建议保留**。

### 2.3 Variations / Reels / Shorts（2 条）

| 导航名称 | URL |
| --- | --- |
| Color Variants | `/ai-image-generation/colorway-variations` |
| TikTok, Reels & Shorts | `/ai-video-generation/tiktok-reels-shorts` |

说明：分别表示“多色变体”和平台内容形态，**建议保留**。

## 3. 目录 / 集合 / 法务页（建议保留复数）

| 名称 | URL |
| --- | --- |
| Templates | `/templates` |
| Industries | `/industries` |
| Platforms | `/platforms` |
| Occasions | `/occasions` |
| How-to Guides | `/guides` |
| Policies | `/policies` |
| Terms | `/terms` |
| Refunds | `/refunds` |
| Cookies | `/cookies` |
| AI Actors | `/ai-actors` |
| All Video Tools | `/ai-video-generation` |
| All Image Tools | `/ai-image-generation` |

说明：这些是“目录页 / 集合页 / 法务页”，复数语义正确，不属于“工具名多加了 s”。

## 4. 行业 / 场景 / 人群标签（建议保留）

`Jewelry & Accessories`（`/industries/jewelry-accessories`）、`Tech & Electronics`（`/industries/electronics`）、`Health & Fitness`（`/industries/health-wellness`）、`Holidays`（`/occasions/holidays`）、`Sports`（`/ai-actors/scene/sports`）、`Fitness`（`/ai-actors/scene/fitness`）。

## 5. 内部工作台 URL（已统一为单数）

公开卡片上的创建按钮原指向复数工具 ID：

```text
/app/create/tool/product-videos
/app/create/tool/before-after-videos
/app/create/tool/spokesperson-videos
```

`contentJson` 中原有 117 / 46 / 111 处（合计 274 处）；另有 `/ai-actors` 页面 146 处旧式
`/app/create?tool=spokesperson-videos&size=9%3A16&length=10#step-video` 查询链接。

现已按以下方式统一：

1. 工作台规范 ID 改为 `product-video`、`before-after-video`、`spokesperson-video`；
2. `tool-aliases.ts` 保留旧复数 ID 作为别名，旧书签、旧草稿和旧查询链接继续打开同一编辑器；
3. 公开卡片链接切到单数固定路径，演员页查询链接切到
   `/app/create/spokesperson-video?size=9%3A16&length=10#step-video`；
4. 同步更新 `handoff.ts`、`static-routes.ts`、工作台场景映射、预设解析和 smoke 测试。

`contentJson` 中仍有少量 `data.id`、`siblings[].id`、`tools[].id`、`make.video[].id`
使用复数。这些是页面/卡片内部标识（仅用作 DOM id 和 React key），不是工作台工具 URL，
本次保持不变；旧 ID 由代码别名兼容。

## 6. 结论

- 用户明确指出的 3 个 “Videos” 工具名及其公开 URL 已完成统一。
- 其余复数分为“语义正确的集合/行业/平台词”和“可选的 Photos 工具”两类；后者需要产品确认后再改。
- 工作台工具 ID 已统一为单数，并通过别名保留旧链接兼容性。
