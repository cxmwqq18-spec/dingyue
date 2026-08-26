# MyDreamShoots Sitemap 与主题图片隔离整改实施记录

## 已完成

- Prisma schema/client 与 `ThemePublication.approvalId` 已验证可读回。
- Sitemap canonical 归一化：旧 `/blog/ai-video-add-ons-photo-package-guide` 不再进入 sitemap，canonical 指向 `/blog/video-photo-package-guide`。
- coverage smoke 默认只检查 `site_dreamshoot`，AIdreamcapes 保持延期；新增最终状态、重定向、canonical、robots、同站 inbound 与 orphan 输出。
- snapshot integrity 增加 `detailMediaUnique`、`detailMediaOwner`、`detailMediaHashUnique`；详情范围覆盖 image/video/holidays leaf。
- image isolation smoke 从 active publication 反向检查详情页媒体 URL、页内重复、跨页 SHA-256 冲突；目录近重复降为 warning，不阻断详情页发布。
- 新增 `scripts/repair-mydreamshoots-detail-media-ownership.mjs`：只允许 local DB，默认 dry-run；使用本地素材生成按 slug 隔离的 pack、standard page、video topic media，并写入 draft source、MediaAsset owner/alt。
- 已通过 approval -> publish -> activate 流程生成 MyDreamShoots publication；最近一次数据库回读为 version 162，snapshot hash 为 `2381faa25130bd96f95f97b5dd759734ea9d4102c516add336a64edf3ce209be`，旧 blog URL 不在 sitemap。

## 验收结果

通过：

```text
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run smoke:mydreamshoots-publication-db-readback
npm run smoke:mydreamshoots-publication-snapshot
npm run smoke:mydreamshoots-seo-indexing
npm run smoke:storefront-image-isolation
npm run smoke:mydreamshoots-media-seo-schema
npm run smoke:mydreamshoots-standard-page-media
```

`smoke:storefront-image-isolation` 仅保留两条目录封面 perceptual-hash warning；详情页 URL/hash 冲突为 0。

本地真实 HTML coverage（`SITEMAP_SMOKE_WWW_MYDREAMSHOOTS_COM_BASE_URL=http://127.0.0.1:3002`）结果：118/118 loc，缺失 0，多余 0，重复 0，live failure 0，orphan 0，publication 统一为 version 162。DOM image isolation 通过 39 个 MyDreamShoots 路由。

## 发布后必须执行

1. 部署本次 MyDreamShoots 代码与 `public/assets/dreamshoot/generated/**` 资产。
2. 线上请求 `robots.txt`、`sitemap.xml`，逐个 GET sitemap loc；确认最终 200、无 3xx、canonical/self URL 一致、robots 为 `index,follow`。
3. 运行 `SITEMAP_SMOKE_SITE_IDS=site_dreamshoot npm run smoke:storefront-sitemap-directory-coverage` 并保存 JSON 输出。
4. 抽查 gala、save-the-date、wedding、instagram/social、story/youtube 页面 HTML、OG、JSON-LD 与 sitemap image owner。
5. 记录 production publication ID、version、snapshot hash、media revision，与本地 version 162 的验收证据对比。

## 延期

AIdreamcapes 的 sitemap/routing/media 恢复不在本轮范围，不得为了 coverage 通过而加入 sitemap 或修改其 production release。
