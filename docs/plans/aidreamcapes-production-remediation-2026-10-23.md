# Aidreamcapes 生产整改方案（2026-10-23）

依据：`docs/audits/aidreamcapes-seo-sitemap-review-2026-10-23.md` 的线上实测（392 页抓取、178 条 sitemap、并发探针），以及 `docs/audits/aidreamcapes-open-issues-remediation-2026-10-22.md` 的未闭环项。

## 0. 原则与边界

- 写入范围仅限 `site_aidreamcapes` 的代码、路由、结构化数据与运行时数据。MyDreamShoots（`site_dreamshoot`）与 EU 站点只做只读回归，任何字节变化都是发布阻断项。
- 代码与内容分离：
  - 代码改动（渲染、sitemap、中间件）走 release。
  - 页面文案改动必须走字段级 manifest + compare-and-set + 线上回读 + 反向 manifest，禁止整站生成、禁止快照导入或回滚。
- 结构化数据属于派生元数据，可以在渲染期规范化；不得因此改写 `LivePage.contentJson`。
- 每次停服发布都必须展示维护页；发布后必须验证维护页覆盖率、切换期 503 与 0×502。
- 发布方式：干净工作区预构建 + `--prebuilt-build`，发布后跑 `--full-seo-contract`、`--verify-load`，再执行缓存清理。

## 1. 第 0 批（本次发布，零内容写入）

| 编号 | 改动 | 线上证据（改前） | 实现 | 验收 |
| --- | --- | --- | --- | --- |
| B0-1 | sitemap 停止输出 `changefreq` / `priority` | 178/178 条都输出；Google 已忽略 | `src/app/sitemap.xml/route.ts` 按 host 剥离两个字段 | XML 中 0 个 `<changefreq` / `<priority`，URL 数仍 178 |
| B0-2 | `WebSite` / `SearchAction` 只在首页 | 9 个页面输出 WebSite；SearchAction 指向会 301 的 `/search` | 渲染期只保留首页 WebSite；删除 SearchAction | 178 页中仅 `/` 有 WebSite；全站 0 个 SearchAction |
| B0-3 | 工具详情页统一 `SoftwareApplication` | 仅 6/18 视频页、6/15 图片页有 | 渲染期缺失即补，`AIVideosUGC <label>`，`MultimediaApplication` | 所有 `/ai-video-generation/<slug>`、`/ai-image-generation/<slug>` 均为 1 个 SoftwareApplication |
| B0-4 | 目录页统一 `CollectionPage`，移除目录页上的 `SoftwareApplication` | `/ai-image-generation` 缺 CollectionPage 且带 SoftwareApplication | 渲染期去重/补齐 | `/ai-actors`、`/ai-video-generation`、`/ai-image-generation` 及其 facet 目录均为 CollectionPage 且无 SoftwareApplication |
| B0-5 | 演员详情改为 `ProfilePage` + `Person` | 53 个详情页错误使用 `CollectionPage` | 从页面自身的 `kind/actor` 数据生成 ProfilePage + Person（name/image/description/jobTitle） | 每个演员详情 1 个 ProfilePage、1 个 Person、0 个 CollectionPage |

验收脚本：`scripts/smoke-aidreamcapes-seo-contract.mjs` 新增 3 组断言（sitemap 字段、页面类型、WebSite 唯一性），随 `--full-seo-contract` 在发布后对 178 个可索引页逐页执行。

回滚：本批没有内容写入，回滚 = 重新部署上一个 release commit。

**执行结果（2026-10-23，release `049fe32b7`）**：候选实例与切换后实例两次契约均 `ok: true`（178 页、694 条图片、525 条近似地址），并发探针 `failures: []`，缓存清理 30 路径 + 9 前缀成功。线上回读：sitemap 0 条 `changefreq`/`priority`；`WebSite` 仅 `/`；`/privacy` 无 `WebSite`；两个 hub 为 `CollectionPage` 且无 `SoftwareApplication`；`/ai-video-generation/text-to-video`、`/ai-twin`、`/ai-image-generation/colorway-variations` 各 1 个 `SoftwareApplication`；`/ai-actors/adrian` 为 `ProfilePage`+`Person`，facet 页仍为 `CollectionPage`。MyDreamShoots sitemap 仍输出 117 条 `changefreq`，`/privacy` 仍带 `WebSite`，隔离成立。

## 2. 第 1 批：性能与抓取（不需要内容决策）

| 项 | 现状 | 目标 | 依赖 |
| --- | --- | --- | --- |
| 边缘 HTML 缓存 | `cf-cache-status: DYNAMIC`；TTFB 并发 4 ≈ 2.0 s、并发 8 ≈ 3.3 s | 匿名 GET 命中边缘，Cookie/RSC 请求保持 DYNAMIC | Cloudflare token 需 Zone → Cache Rules → Edit（现有 token 缺此权限） |
| 进程内 HTML 微缓存 | 每个匿名请求都重新 SSR（仅数据快照有缓存） | 键 = host + path + 内容 revision；提交后自动失效；目标 TTFB < 100 ms | 无（代码） |
| 首页载荷 | 819 KB（内联 RSC 492 KB，gzip 128 KB） | 首屏 ≤ 300 KB，gzip ≤ 60 KB | 需先定首屏卡片数量（与第 3 批联动） |
| `/templates` srcset | 0 张带 srcset | 与首页/工具页一致 | 无（代码 + 图片清单） |
| 渲染阻塞 | 每页 1 个同源 polyfills 脚本 | 评估改为 `defer` 或按浏览器目标裁剪 | 无（代码，需回归旧浏览器） |

第 1 批全部是代码或边缘配置，不改页面文案。

## 3. 第 2 批：内容深度与商业结构化数据（需字段级 manifest）

| 项 | 现状 | 目标 | 方式 |
| --- | --- | --- | --- |
| `/platforms` hub 正文 | `<main>` 81 词 | ≥ 300 词 | 字段级 manifest + CAS，仅改该页正文 |
| 演员详情正文 | 53 页中位 283 词 | ≥ 400 词 | 同上，逐页 manifest |
| scene facet 近重复 | 31 页两两 Jaccard 0.55 | 收敛为 6–10 个精选页，其余 301 到上级 | 需产品决策后走路由清单 + manifest |
| 工具页 Product/Offer | 仅首页 OfferCatalog | 工具页与 `/pricing` 输出 Offer（价格取自 pricing 关系数据） | 代码派生，价格只读 |

## 4. 第 3 批：索引策略（需产品决策）

| 项 | 现状 | 决策点 |
| --- | --- | --- |
| 视频结构化数据 | `VideoObject` 0、sitemap video 0 | 先确定可公开的视频集合、版权与时长元数据 |
| 演员页规模 | 94 条 = sitemap 的 52.8% | 是否收敛到 20–30 个精选演员 + 场景组合 |
| 模板详情 | 线上仅 `/templates/photo`、`/templates/video` | 是否开放单模板详情，以及 canonical 策略 |
| 首页卡片数量 | 177 张图、136 个内链 | 与载荷瘦身一起定 |

## 5. 验收矩阵

每次发布必须全部通过：

1. `--full-seo-contract`：sitemap 结构、178 页 200 + 自指 canonical、标题/描述唯一、图片成员关系、JSON-LD 类型契约、近地址 525 条 301、404/410。
2. `--verify-load`：维护页覆盖率、切换期 503、0×502。
3. 只读回归：MyDreamShoots sitemap 与 JSON-LD 字节不变；EU 站点不变。
4. 发布后回读：`sitemap.xml` 无 changefreq/priority；`/` 唯一 WebSite；工具页 SoftwareApplication 覆盖 100%；演员页 ProfilePage + Person 覆盖 100%。
5. 缓存：提交后 purge 成功（30 条路径 + 9 个前缀）。

## 6. 风险

| 风险 | 缓解 |
| --- | --- |
| 渲染期 schema 规范化与存储图不一致 | 只做“类型/重复节点”层面规范化，不改文案；验收逐页断言 |
| 边缘缓存与“提交即生效”冲突 | 缓存键含内容 revision；提交后 purge；先灰度单路径再全量 |
| 发布期并发劣化 | 发布窗口内预热 + 维护页；发布后并发探针 |
| 内容 manifest 与线上编辑冲突 | CAS + 线上编辑优先；冲突即停止并回读 |
