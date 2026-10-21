# Aidreamcapes 媒体详情短地址规范化上线记录（2026-10-22）

生产域名：`https://www.aivideosugc.com`
数据所有者：`site_aidreamcapes`（PostgreSQL `LivePage.contentJson`）
线上提交（代码）：`fcbb33460ffb6e994fe000dc631f0d256dc05ee5`（未变更，仅内容写入）
审计依据：`docs/audits/aidreamcapes-redundant-media-slugs-2026-10-22.md`
方案：`docs/plans/aidreamcapes-media-slug-alias-plan-2026-10-22.md`

## 1 变更内容

产品墙上的媒体卡曾用「产品名 + 目录页路径」作为详情地址，例如
`/ai-video-generation/bedroom-try-on-knitwear-ai-video-generation-ugc-ad-video`。
本次把公开可点的产品墙卡片改为产品自身的短地址，旧长名作为 `publicAliases` 留在同一张卡上，
旧地址因此 308 到规范地址。

只写 `LivePage.contentJson` 的两个字段：`publicSlug`、`publicAliases`。

| 项目 | 数量 |
|---|---:|
| 写入页面 | 2（`/ai-video-generation`、`/ai-video-generation/video-ads`） |
| 写入卡片 | 37 |
| 迁移后 308 的旧地址 | 37 |
| 计划冲突 | 0 |
| 被跳过（已是短名或归属他页） | 38 |

## 2 归属规则

运行时一个 slug 只能由一页拥有（`pagesOwningSlug` 要求恰好 1 页命中），
因此同一产品出现在两堵墙时，规范短地址归 `/ai-video-generation/video-ads`，
hub 墙的同产品副本保留自身地址：

- `lifestyle-app-recommendation` → 规范地址 `/ai-video-generation/lifestyle-app-recommendation`（video-ads 墙）
- `streamer-reaction-app` → 规范地址 `/ai-video-generation/streamer-reaction-app`（video-ads 墙）

这两张 hub 墙卡片仍指向各自的 `…-ai-video-generation` 旧地址，行为与本次改动前一致。

## 3 执行记录

- 计划：`scripts/plan-aidreamcapes-media-slug-alias.mjs --target=production`（只读）
- 清单：`scripts/manifests/aidreamcapes-media-slug-alias-production-plan.json`
- 应用：`scripts/apply-aidreamcapes-media-slug-alias.mjs --target=production --apply
  --confirm=site_aidreamcapes-media-slug-alias-production --base-hash=0295dc66…`
- 报告：`scripts/manifests/aidreamcapes-media-slug-alias-production-apply-report.json`
- 字段级逆向清单（回滚用）：`scripts/manifests/aidreamcapes-media-slug-alias-production-rollback.json`
- 写前备份（服务器）：`ops/aidreamcapes-media-slug-alias-20261022/backup-before.json`

守卫结果：

- `SiteContentRevision` 1 → 3（每页 +1）
- MyDreamShoots 内容哈希未变
- 未写 publication / snapshot，未激活任何历史状态
- `derivedStateReadOnly` 无变更

## 4 生产回读

- 37 个旧地址全部 308，且 `Location` 指向规范地址
- 规范地址全部 200，`canonical` 自指、`noindex, follow`、恰好 1 个 workspace CTA
- sitemap 不含任何旧地址
- 两堵墙渲染出的卡片链接不再带路径回声

## 5 回归

| 门禁 | 结果 |
|---|---|
| `audit-card-entry-links` | 0 offenders / 0 failures |
| `audit-media-detail-routes` | 0 failures |
| `audit-workspace-entry-transfer`（path 模式） | 0 failures |
| `smoke-media-slug-aliases.mjs` | 76 checks / 0 errors |

`smoke-media-slug-aliases.mjs` 已接入 `scripts/deploy-aidreamcapes-release.mjs` 的候选阶段与线上阶段，
发布流程会守住全部已迁移地址。

说明：`scripts/smoke-aidreamcapes-seo-paths.mjs` 中的 `/industries/shoes` 目录媒体断言依赖
`placement` 数据，而生产 `placement` 为 0（本次改动前的既有状态），故该断言在生产本就失败，
未纳入发布门禁；alias 相关断言已拆入专项门禁。

## 6 未包含的范围

- 19 个目录页 `workspaceCases` 副本的 639 个旧长名仍各自 200 自指（`noindex, follow`），
  不在公开可点入口上；把它们也收敛到同一规范地址需要先解决跨页同产品的 slug 归属问题。
- 34 个 `-templates` 形态的短地址保持不变（已是短名）。
- `placement` 产品级标签未评估（按审计 §7 顺序，排在规范化之后）。
