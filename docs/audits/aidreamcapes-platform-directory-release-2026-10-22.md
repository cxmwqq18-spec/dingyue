# Aidreamcapes 平台目录页与产品级分类代码发布记录

日期：2026-10-22
生产域名：`https://www.aivideosugc.com`
数据所有者：`site_aidreamcapes`（PostgreSQL `LivePage.contentJson`）

## 1 发布的代码

线上提交：`fcbb33460ffb6e994fe000dc631f0d256dc05ee5`（`origin/main`）

本次发布包含三个代码/工具提交：

| 提交 | 内容 |
|---|---|
| `fd5493689` | 产品级媒体分类：产品身份、详情页分类标签、目录去重网格、模板目录筛选规范化、平台目录页组件、移除 `/platforms` 旧 301 |
| `9046c26e8` | 只读审计/计划/应用脚本与评审 manifest（含 `/platforms` 字段级创建脚本） |
| `b439a8197` | SEO 路径与媒体分类的审计与计划文档 |

`fcbb33460` 是同批会话追加的只读审计文档提交，构建输入与上述代码一致。

## 2 线上内容写入

只有一条字段级写入，全部落在 `LivePage.contentJson`：

- 操作：创建 `LivePage` 行 `site_aidreamcapes_platforms`（slug `/platforms`）。
- 依据：`scripts/manifests/aidreamcapes-platform-page-production-2026-10-21.json`（planHash `7ed418bd7e2ba3287f48c550358f434ecb8d69df4e5e15ed6dc77db88d8acf1f`）。
- 执行：`scripts/apply-aidreamcapes-platform-page.mjs --target=production --apply --confirm=aidreamcapes-platform-page-production --base-hash=<planHash>`。
- 保护：写前校验目标行必须不存在、6 个公开图片资源必须存在、MyDreamShoots 内容哈希前后一致、`SiteContentRevision_LivePage` 触发器必须存在；写后回读行内容并断言 revision 恰好 +1。
- 结果：revision `0 → 1`，MyDreamShoots 哈希未变，未写 publication/snapshot，未激活任何历史状态。
- 报告：`scripts/manifests/aidreamcapes-platform-page-production-2026-10-21-apply-report.json`。

图片路径在该 manifest 内由本地 `/ai-image-generation/t33-plat-*` 改为线上已存在的
`/assets/sites/site_aidreamcapes/site-v2/gen/t33-plat-*`，避免引用本地独占资源。

## 3 线上回读

| 检查 | 结果 |
|---|---|
| `/platforms` | 200，H1「Find Ideas for Where You Sell」，6 个平台入口，canonical `https://www.aivideosugc.com/platforms`，robots `index, follow` |
| 6 个平台子页 | 全部 200（`tiktok-ads`、`instagram-ads`、`facebook-ads`、`youtube-shorts-ads`、`amazon-product-photos`、`shopify-product-photos`） |
| 平台页图片 | 6 张全部 200 |
| `/templates?type=photo` | 308 → `/templates/photo` |
| `/templates?kind=video` | 308 → `/templates/video` |
| `/templates?type=photo&industries=/industries/shoes` | 308 → `/templates/photo?industries=…` |
| 筛选后的目录页 | 200，`robots noindex, follow`，canonical 保留筛选参数 |
| 详情页分类标签 | `black-friday-countdown-black-friday-video` 展示 Platform（Facebook、TikTok）、Occasion（Black Friday、Sale & Discount）、Catalog（Templates、Video Templates），无行业目录，与真实目录归属一致 |
| sitemap | 178 个 URL（发布前 177），含 `/platforms` |
| 媒体详情回归套件 | 5 个审计全部通过，0 failures，sitemap 178 / dead 0（发布前基线 177 / dead 0） |
| 发布脚本内建冒烟 | 候选实例与切流后 origin 的路由冒烟、卡片入口审计均通过 |

## 4 未上线的内容（按约定保持本地）

- 19 个产品的 `placement` 试点：线上 `placement` 页面数仍为 0。
- 5 条短地址别名：线上 `publicAliases` 页面数仍为 0。
- 3 个有歧义的行业映射（Kitchen Appliance、Berry Bowl、Quiet Unboxing）：未写线上，等内容团队确认。
- 944 张未标注素材不做批量标注。

## 5 构建注意

服务器端 `next build` 在 12GB 堆上限下 OOM（`Reached heap limit`），发布前失败且未切流量，线上仍是旧版本
`4fb509bfb`。改用仓库支持的 `--prebuilt-build` 路径：在本地以生产环境变量（生产库经 SSH 隧道只读访问、
`NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL` 与线上一致）执行 `scripts/build-production.mjs`，产物不含平台相关原生二进制，
候选实例仍先跑完整 SSR 冒烟再切流。服务器端构建需要提高 `AIDREAMCAPES_BUILD_HEAP_MB` 后再恢复。

## 6 店铺隔离证据

- `mydreamshoots.service` 未重启，工作目录与 PID 未变（`d869ca42dd09f5e84c58135e5df7956751cb40f5` / PID 30872）。
- MyDreamShoots 生产页响应哈希发布前后一致：`/` `8a85fa40161d144b`、`/pricing` `8d68047e03e3565c`、
  `/ai-video-generation` `2289c0f423ed3bc3`、`/faq` `a68b0e5025557b5e`。
- 共享文件的改动均以站点与主机为条件：`src/lib/storefront-render.tsx` 仅对 `site_aidreamcapes` 改写 JSON-LD，
  `src/middleware.ts` 仅对 aidreamcapes 主机与路径前缀生效。
- `aidreamcapes-eu.service`、`aidreamshoots.service` 未触碰。
