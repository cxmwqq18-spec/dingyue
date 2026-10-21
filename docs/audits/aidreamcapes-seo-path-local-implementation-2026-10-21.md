# AIVideosUGC SEO 路径本地整改与验收记录

## 实施结果

本地平台目录、筛选 URL、鞋类示例及 5 条短地址试点已完成。生产环境未部署，生产数据写入为 0。

预览入口：<http://localhost:3113/site/aidreamcapes/platforms>。服务使用 `.next-seo-path-release` 的生产构建，连接本地 PostgreSQL。

| 项目 | 本地结果 |
|---|---|
| 平台总目录 | 独立 LivePage，六个平台入口；移除 Aidreamcapes 专属映射中的错误跳转 |
| 类型筛选 | kind/type 直接 308 到 photo/video 固定目录；保留其余筛选与追踪参数 |
| 单分类筛选 | 实际模板集合等价、且没有额外投放素材时才跳到固定分类页 |
| 组合筛选 | SSR 完整结果，noindex、自引用规范参数 canonical；OG 和结构化页面身份一致 |
| 非法输入 | 外部地址、非法路径和冲突的重复键返回 400；未知分类返回真实空结果并 noindex |
| 鞋类试点 | 关联 6 个现有鞋履素材；与 4 个通用模板入口分开展示；详情可返回所属分类 |
| 短地址试点 | 5 个当前素材的 publicSlug 缩短，旧值保存为精确 publicAliases，旧地址 308 到新地址 |
| 工作台 | 详情 CTA 仍进入固定功能地址，并保留所选素材的提示内容 |

案例索引评审结论：本批素材详情仍主要用于浏览与选择素材，尚未提供足够独立的案例说明，因此继续 `noindex, follow`，不批量开放索引，不加入 sitemap。

## 本地数据边界

公开数据 owner 为 `LivePage.contentJson`，只写入 `site_aidreamcapes`：

- 新增 1 个 `/platforms` 页面，采用不存在条件检查。
- 新增 6 个卡片 placement 字段和鞋类目录 3 个展示文案字段。
- 修改 5 个素材 publicSlug，并新增 5 个 publicAliases 数组。
- 使用站点锁、字段旧值与行 updatedAt 比较；发生冲突时事务失败，不覆盖其他编辑。
- 最终 `SiteContentRevision.revision` 为 8，当前行读回与两个清单的目标字段一致。
- 未使用历史 snapshot、publication、整库导入或全站生成。

清单仅适用于本地，不能直接应用到生产：

- [平台页与鞋类试点清单](../../scripts/manifests/aidreamcapes-seo-path-local-2026-10-21.json)
- [五条短地址与别名清单](../../scripts/manifests/aidreamcapes-seo-media-alias-local-2026-10-21.json)
- [最终关系数据读回](../../releases/aidreamcapes/seo-path-implementation-20261021/final-data-readback.json)

## 验收结果

| 检查 | 结果 | 证据 |
|---|---|---|
| 生产构建 | 通过；仓库已有 lint 警告仍存在 | build-release.log |
| TypeScript | 通过 | typecheck-final.log |
| 本次新增模块 ESLint | 通过 | lint-own.log |
| Live storefront SSR 契约 | 通过 | ssr-guard.log |
| URL 纯函数检查 | 15 项通过 | filter-unit.json |
| host 与 path 模式 | 26 项通过，包含六个平台目标、筛选、别名、canonical、JSON-LD 与 sitemap | http-checks.json |
| 浏览器 | 六组检查通过：图片、移动端、表单、后退、详情到工作台、无 JavaScript | browser-checks.json |
| 浏览器错误及公开数据请求 | pageerror 为 0，公开 fetch/XHR/EventSource 为 0 | browser-checks.json |
| MyDreamShoots 对照 | 原始提交与候选版本的三条抽检路由一致 | mydreamshoots-regression.json |

MyDreamShoots 的独立基线使用原始提交 `c65ceeecf`，与候选版本连接同一本地数据库。抽检首页、价格页、模板参数地址的状态码、Location、title、H1、canonical、robots 和链接列表；模板地址在基线与候选中都为 404。该结论是共享入口回归抽检，不代表全站功能覆盖。

桌面与移动端截图已检查；六个平台图片均成功加载，移动端无横向溢出。

完整证据位于 [本地验收目录](../../releases/aidreamcapes/seo-path-implementation-20261021/)。

## 响应时间对照

对原始提交与候选构建进行串行交替请求，使用相同的四个地址、两轮预热和五轮记录，每个版本 20 个样本。时间为本机接收完整 HTML 的耗时，不包含浏览器图片和脚本加载，也不代表公网响应。

| 版本 | p50 | p95 |
|---|---:|---:|
| 原始提交 | 143 ms | 358 ms |
| 本次候选 | 151 ms | 354 ms |

p95 未发生超过计划阈值的回归。数据见 [performance.json](../../releases/aidreamcapes/seo-path-implementation-20261021/performance.json)。

## 生产发布前的剩余步骤

1. 核对并整理工作区其他会话的改动，提交可审查的完整代码版本。
2. 对生产当前 LivePage 逐字段重新准备平台页、鞋类投放与短地址清单，检查页面、素材和别名冲突。
3. 在独立候选版本验证代码与数据应用顺序；不得因生产缺字段而恢复旧内容。
4. 发布后重新核对修订号、源站、公网、sitemap、旧新地址和工作台链路。
5. Search Console 的收录及流量观察在实际发布后进行。

此次没有执行收费生成、支付或生产内容操作。
