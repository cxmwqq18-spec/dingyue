# Aidreamcapes 详情地址规范化上线记录（2026-10-22）

站点：`site_aidreamcapes`（`https://www.aivideosugc.com`）
代码提交：`b0b68c1a167c9e5b09e424e40aa173e6878bf8ba`
数据所有者：PostgreSQL `LivePage.contentJson`
性质：字段级内容写入；无 publication、无 snapshot、无历史状态激活、无代码变更。

本轮把详情卡地址统一为卡片名称本身，并让旧地址 308 到新地址。覆盖三类：

| 类别 | 页面/卡片 | 新地址 | 旧地址 |
|---|---:|---:|---:|
| 模板详情卡及其 picker 副本 | 15 页 / 30 卡 | 15 | 15 |
| `/ai-video-generation` 可见示例卡 | 1 页 / 5 卡 | 5 | 5 |
| 销售/节日页数据示例卡 | 4 页 / 17 卡 | 17 | 17 |
| **合计** | **20 页 / 52 卡** | **37** | **37** |

加上此前的 37 个产品墙卡片，生产现在共有 **89 张卡**带 `publicAliases`，
覆盖 **74 个已退役详情地址**。

## 1 生产写入

生产 `SiteContentRevision` 依次推进：

| 操作 | 写入页 | 写入卡 | 字段 | revision |
|---|---:|---:|---:|---|
| 模板详情卡 | 15 | 30 | 60 | 74 → 89 |
| hub 示例卡 | 1 | 5 | 10 | 89 → 90 |
| 销售/节日示例卡 | 4 | 17 | 34 | 90 → 94 |

三次写入均使用字段级 CAS：读取 `LivePage` 行、校验 `baseHash`、只改
`publicSlug` 与 `publicAliases`、按 `updatedAt` 条件更新、回读校验。
`SiteContentRevision` 每次写入恰好推进一页一次；`MyDreamShoots` 的
`LivePage`/`ThemeSettings`/`StorefrontProfile` 保护哈希三次均未变化。

### 1.1 模板详情卡（15 页）

新地址：

- `/ai-image-generation/color-variants`
- `/ai-image-generation/jewelry-on-model`
- `/ai-image-generation/packaging-preview`
- `/ai-image-generation/every-angle`
- `/ai-image-generation/team-headshots`
- `/ai-image-generation/sale-banner`
- `/ai-image-generation/story-ad`
- `/ai-image-generation/creator-style-photo`
- `/ai-image-generation/clothing-try-on`
- `/ai-video-generation/black-friday-video`
- `/ai-video-generation/brand-film`
- `/ai-video-generation/outfit-reel`
- `/ai-video-generation/drink-pour`
- `/ai-video-generation/home-organizing`
- `/ai-video-generation/launch-promo`

每个地址同时更新 `templateDefinition.card` 与对应的 `picker.cards[0]`，
两处保留同一个 `publicSlug`，旧 `<page-leaf>-<label>` 写入两处的
`publicAliases`。13 个页面在卡片区直接显示新链接；`sale-banner` 与
`jewelry-on-model` 所在页没有 picker block，详情仍可 200 访问，但页面不显示
该卡片。

### 1.2 hub 示例卡（5 卡）

| 旧地址 | 新地址 |
|---|---|
| `/ai-video-generation/a-spoken-ad-with-a-person-on-camera` | `/ai-video-generation/bottle-ad-with-a-person` |
| `/ai-video-generation/the-same-product-walkthrough` | `/ai-video-generation/bento-box-walkthrough` |
| `/ai-video-generation/a-showcase-in-a-real-room` | `/ai-video-generation/perfume-bottle-in-a-room` |
| `/ai-video-generation/an-actor-matched-to-the-buyer` | `/ai-video-generation/an-avatar-holds-the-shaker` |
| `/ai-video-generation/a-clip-sized-for-the-feed` | `/ai-video-generation/sneaker-photo-for-the-feed` |

`/ai-video-generation` 的五张可见示例卡现在直接链接新地址；旧地址全部 308。

### 1.3 销售/节日数据示例卡（17 卡）

覆盖：

- `/ai-image-generation/sale-campaign-key-visual`：7 卡
- `/occasions/black-friday`：3 卡
- `/occasions/holidays`：3 卡
- `/occasions/sale-discount`：4 卡

这些卡片不在 178 个 sitemap 页面中形成可见锚点；旧 `<page-leaf>-<title>`
地址 308，新地址 200。页面 HTML 不再包含旧地址。

## 2 验证

生产读回：

| 项目 | 结果 |
|---|---:|
| `LivePage` 行 | 267 |
| `publicSlug` 卡对象 | 1,005 |
| 唯一详情 slug | 987 |
| 带 `publicAliases` 的卡对象 | 89 |
| `detailAliasOf`（链路整改保留） | 695 |
| sitemap URL | 178 |
| 详情页 robots | `noindex, follow` |
| 详情页 sitemap | 不收录 |

发布门禁
`scripts/aidreamcapes-workspace/smoke-media-slug-aliases.mjs` 覆盖 74 个旧地址，
在 path 模式与 host 模式各跑一遍，共 150 项检查，全部通过。本地同一门禁也以
74 个地址 / 150 项检查通过：

- 旧地址 308，Location 指向同一卡片的新地址；
- 新地址 200，canonical 指向自身；
- 新地址 `noindex, follow`；
- 新地址恰好一个 workspace CTA；
- sitemap 不包含任何旧地址或新详情地址。

此外：

- 15 个模板落地页仍为 200、canonical 指向自身、`index, follow`；
- 37 个产品墙旧地址回归检查全部 308，规范地址全部 200；
- `/ai-video-generation` 页面不再包含五个旧示例地址；
- MyDreamShoots 服务 active，首页 200，保护哈希未变化。

证据文件：

- 模板计划：`scripts/manifests/aidreamcapes-template-detail-slugs-production-2026-10-22.json`（`planHash 5fd44d77…`）
- 模板报告：`scripts/manifests/aidreamcapes-template-detail-slugs-production-2026-10-22-apply-report.json`
- 模板回滚：`scripts/manifests/aidreamcapes-template-detail-slugs-production-2026-10-22-rollback.json`
- hub 计划：`scripts/manifests/aidreamcapes-hub-example-slugs-production-2026-10-22.json`（`planHash dd07a996…`）
- hub 报告/回滚：`scripts/manifests/aidreamcapes-hub-example-slugs-production-2026-10-22-{apply-report,rollback}.json`
- 示例计划：`scripts/manifests/aidreamcapes-example-prefix-slugs-production-2026-10-22.json`（`planHash a40796e1…`）
- 示例报告/回滚：`scripts/manifests/aidreamcapes-example-prefix-slugs-production-2026-10-22-{apply-report,rollback}.json`
- 生产门禁报告：`scripts/manifests/aidreamcapes-detail-slug-alias-production-smoke-2026-10-22.json`
- 本地门禁报告：`scripts/manifests/aidreamcapes-detail-slug-alias-local-smoke-2026-10-22.json`

## 3 仍待决策

### 3.1 三个模板页名称冲突

`beauty-routine`、`how-to-video`、`spark-ads-style-video` 的裸名称已经是
可索引模板落地页路径。详情路由先于 `LivePage` 解析，因此不能直接把详情卡
改成同名裸 slug。当前保留 `<page-leaf>-<label>` 双段地址。可选：

1. 保留为例外（改动最小，当前状态）；
2. 重命名模板落地页并 308 旧页，腾出裸名称；
3. 把卡片详情合并到落地页（需要改运行时的一卡一详情规则）。

### 3.2 重复 picker 身份

链路整改已经为下面两个 hub 副本设置了 `detailAliasOf`，生产实测旧地址现在
308 到 `/video-ads` 的规范卡：

- `/ai-video-generation/streamer-reaction-app-ai-video-generation`
  → `/ai-video-generation/streamer-reaction-app`
- `/ai-video-generation/lifestyle-app-recommendation-ai-video-generation`
  → `/ai-video-generation/lifestyle-app-recommendation`

`/ai-video-generation` 页面仍从旧地址链接，点击后 308；这是已知的遗留锚点，
但最终落地地址已经规范。

仍有两个独立卡片无法直接合并：

- `/ai-video-generation/trousers-fold-demo-home`
- `/ai-video-generation/tinted-balm-vanity-reel-home`

它们与 hub 同名卡的图片不同，属于不同素材；规范短名已被 hub 卡占用。需要
选择：保留为例外、修改可见名称，或为它们定义明确的去重标识。

### 3.3 674 个 `workspaceCases`

仍使用 `<label>-<full owner path>`。其中 639 个在 18 个工具/目录页，35 个在
`/templates`，51 个可能出现在详情页相关列表。属于独立的大批量项目，未在本轮
写入。

### 3.4 其他

- 1 个 `workspaceCases` 撇号漂移：
  `court-gear-from-the-player-s-view` → `court-gear-from-the-players-view`；
- 6 个“其他”slug（场景名而非卡片名）。

## 4 复现命令

```bash
# 只读计划（本地/生产）
node scripts/plan-aidreamcapes-template-detail-slugs.mjs --target=production
node scripts/plan-aidreamcapes-hub-example-slugs.mjs --target=production
node scripts/plan-aidreamcapes-example-prefix-slugs.mjs --target=production

# 字段级应用（生产需在服务器 release 目录执行，并使用显式确认与 planHash）
node scripts/apply-aidreamcapes-template-detail-slugs.mjs --target=production \
  --manifest=scripts/manifests/<reviewed-plan>.json --apply \
  --confirm=site_aidreamcapes-template-detail-slugs-production --base-hash=<planHash>

# 生产门禁
AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3013 \
  node scripts/aidreamcapes-workspace/smoke-media-slug-aliases.mjs
```

本轮没有运行 `scripts/plan-aidreamcapes-example-media-slugs.mjs`，也没有读取或
激活任何历史 publication/snapshot。
