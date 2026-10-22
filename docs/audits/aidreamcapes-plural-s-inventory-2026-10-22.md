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

## 7. 生产发布记录（2026-10-22）

### 7.1 代码部署（仅代码）

| 项 | 值 |
| --- | --- |
| 提交 | `38faa08614ce59656b817791390746bc70e49b7c`（`origin/main` 一致） |
| Release 目录 | `/www/wwwroot/aidreamcapes.com/releases/38faa08614ce59656b817791390746bc70e49b7c-seo` |
| `current` 指向 | 同上；`.deployed-commit` = `38faa086…` |
| 服务 | `aidreamcapes.service` = active，监听 `127.0.0.1:3013` |
| 构建方式 | 本地预构建产物上传（服务器端新构建会触发 8 GB 堆上限 OOM） |

本次代码改动文件全部落在 Aidreamcapes 作用域内（`scripts/data/aidreamcapes-site-v2/**`、
`src/lib/aidreamcapes-*`、`src/components/storefront/aidreamcapes-v2/**` 及对应 smoke 脚本），
未触及任何 MyDreamShoots 文件、路由、SEO、媒体或导航。

### 7.2 内容迁移（独立于代码部署，字段级 compare-and-set）

生产库 `127.0.0.1:5432/dingyue`，站点 `site_aidreamcapes`，共 267 个 `LivePage` 行。
`scripts/aidreamcapes-apply-plural-s-rename.mjs --apply --confirm=site_aidreamcapes-plural-s`
以 `updatedAt` 为 CAS 基准逐行改写，写入 146 个页面行 + 1 个页脚行（合计 147 次写入）：

| 计数 | 值 |
| --- | --- |
| slug 改名 | 3 |
| 链接替换 | 160 |
| label 替换 | 92 |
| 工作台路径替换 | 274 |
| 工作台工具 ID 替换 | 2 |
| 工作台查询链接替换 | 146 |
| 页脚 | `Content` 插入 index 0 |

未启用任何快照 / 发布物激活；未使用历史快照兜底。

**审计文件写入缺陷与修复**：release 归档不包含 `docs/`，脚本最后写
`docs/audits/aidreamcapes-plural-s-rename-production-apply-2026-10-22.json` 时报
`ENOENT`。数据库写入与页脚写入在此之前已提交（脚本在写文件前无异常），已用生产库
只读审计逐项复核确认。脚本已修复为写文件前 `mkdirSync(path.dirname(out), { recursive: true })`，
后续运行可直接指定目标目录。审计清单按“预演清单 + 落库后的行时间戳”重建，见
`docs/audits/aidreamcapes-plural-s-rename-production-apply-2026-10-22.json`。

### 7.3 生产回读

数据库只读审计（生产库）：

```json
{
  "pages": 267,
  "oldSlugsPresent": [],
  "newSlugsPresent": [
    "/ai-video-generation/product-video",
    "/ai-video-generation/before-after-video",
    "/ai-video-generation/spokesperson-video"
  ],
  "exactOldLabels": 0,
  "residualOld": {},
  "footerLegal": [
    { "label": "Content", "href": "/content" },
    { "label": "Privacy", "href": "/privacy" },
    { "label": "Terms", "href": "/terms" },
    { "label": "Refunds", "href": "/refunds" },
    { "label": "Cookies", "href": "/cookies" }
  ]
}
```

派生状态版本：`SiteContentRevision` = `261`，触发器 `SiteContentRevision_LivePage` 为 enabled，
因此每次 `LivePage` 行更新都会推进版本，SSR 读路径未落后。

HTTP 回读（生产 origin `http://127.0.0.1:3013`，`X-Forwarded-Host: www.aivideosugc.com`，
以及公网 `https://www.aivideosugc.com` 复核）：

| 路径 | 结果 |
| --- | --- |
| `/ai-video-generation/product-videos` | 301 → `/ai-video-generation/product-video` |
| `/ai-video-generation/before-after-videos` | 301 → `/ai-video-generation/before-after-video` |
| `/ai-video-generation/spokesperson-videos` | 301 → `/ai-video-generation/spokesperson-video` |
| 3 个新 slug | 200，canonical 为单数 URL |
| `/content` | 200 |
| `/app/create/product-video` 等 3 条新工作台路径 | 200 |
| `/app/create/product-videos` 等 3 条旧复数工作台路径 | 200（别名解析到同一编辑器） |
| `/app/create?tool=spokesperson-videos&size=9%3A16&length=10` | 308 → `/app/create/spokesperson-video?size=9%3A16&length=10` |
| sitemap | 仅含新单数路径 |
| 首页 CSS | 含 `.adc2 .adc-workflow.hx-feature .adc-workflow-heading h2{text-align:center!important}` |

完整 SEO 合同（`scripts/smoke-aidreamcapes-seo-contract.mjs`，生产 origin，`preNavigationMigration=false`）：

```json
{
  "ok": true,
  "redirects": 67,
  "mediaDetail": { "detailPages": 47, "flatActorUrls": 53, "nestedActorUrls": 0 },
  "targetMetadataPages": 32,
  "sitemapPages": 178,
  "sitemapImageRecords": 694,
  "uniqueSitemapImages": 463,
  "checks": ["metadata","jsonld","site-v2-redirects","canonical","robots","sitemap-xml","image-page-membership","image-status","random-404","retired-410","https-www-redirects","security-headers","hsts"]
}
```

### 7.4 内容应用后的回归（生产 origin）

| 脚本 | 结果 | 证据 |
| --- | --- | --- |
| `smoke-aidreamcapes-release-routes.mjs` | ok，`errors/failures/offenders/warnings` 均为 0；sitemap 178 URL；首页无遗留查询式工作台链接 | `aidreamcapes-plural-s-rename-production-routes-smoke-2026-10-22.json` |
| `smoke-media-slug-aliases.mjs` | ok，74 条别名，`errors` 为 0，`writes: false`（只读） | `aidreamcapes-plural-s-rename-production-media-aliases-2026-10-22.json` |
| `audit-card-entry-links.mjs` | ok，`offenders` 与 `failures` 为空 | `aidreamcapes-plural-s-rename-production-card-links-2026-10-22.json` |
| `smoke-aidreamcapes-seo-contract.mjs`（完整） | ok，13 项检查全过 | `aidreamcapes-plural-s-rename-production-seo-contract-2026-10-22.json` |

`audit-card-entry-links.mjs` 的 5 条 `skippedPages` 均为“该页无卡片网格、只渲染步骤 UI”，
其中包含新 slug `/ai-video-generation/product-video`；内容应用前出现的
“旧复数 URL 404”跳过项已消失。

### 7.5 MyDreamShoots 未受影响

- `mydreamshoots.service` = active，`ActiveEnterTimestamp` 仍为 `2026-10-10 14:21:33 CST`（本次发布未重启）。
- `mydreamshoots.com/current/.deployed-commit` = `d869ca42dd09f5e84c58135e5df7956751cb40f5`，未被本次发布改动。
- `https://www.mydreamshoots.com/` 回读 200。
- 本次未对 `site_dreamshoot` 执行任何写操作，也未修改共享导航、共享主题、共享迁移或部署配置。
