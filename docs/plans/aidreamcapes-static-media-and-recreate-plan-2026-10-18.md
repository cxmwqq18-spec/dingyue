# Aidreamcapes 公共媒体静态地址与 Recreate 链接整改计划

- 日期：2026-10-18
- 状态：Aidreamcapes 公共静态媒体迁移与 Recreate 静态场景路由已部署并完成生产回读；跨站只读保护通过
- 范围：`site_aidreamcapes` 当前公开页面、站点级媒体记录及公开示例进入私有工作台的 Recreate 链接

## 1. 目标与边界

将 Aidreamcapes 的公开图片、视频统一发布到可直接访问、版本不可变的静态地址，并让服务端渲染的 HTML 直接引用这些地址。公开素材不得依赖签名链接、API 代理或浏览器补数据；客户上传和生成的私有素材继续使用原有鉴权存储。

Recreate 链接改为稳定 slug 路由，例如 `/app/create/scene/navy-cardigan-demo`。浏览器点击时发起普通 GET，服务端从当前 Aidreamcapes 关系数据解析场景并预填工作台；实际生成仍由现有需登录、需校验 credit 的 POST 链路执行。工作台页面保持 `noindex,nofollow`。

本次数据库写入只允许针对 `site_aidreamcapes`，公开页面内容及资源引用只以 PostgreSQL `LivePage.contentJson` 当前值为准。不得用本地 JSON、`ThemePage`、草稿/已发布旧字段或历史快照覆盖当前内容；不改 MyDreamShoots 数据、Aidreamcapes EU 数据或其公开输出。

全量完成的标准是：当前 `LivePage.contentJson` 中每个非空图片、视频和封面引用，以及 `site_aidreamcapes` 每个非空 `MediaAsset.previewUrl`、`originUrl`，都指向可访问的哈希版本静态文件；未找到、未归属或未回读成功的公开资源数必须为零。`AssetUpload` 私有文件不属于公开静态化范围，继续受登录和所有权校验保护。

## 2. 当前基线

以下数量以 2026-10-18 从本地 `dingyue_local` 数据库重新执行的只读审计为准。机器清单见 [`releases/aidreamcapes-static-media-20261018/inventory-local.json`](../../releases/aidreamcapes-static-media-20261018/inventory-local.json)，审计脚本为 [`scripts/audit-aidreamcapes-static-media.mjs`](../../scripts/audit-aidreamcapes-static-media.mjs)。当前站点主域名为 `www.aivideosugc.com`。这些数据只代表本地库和工作区 `public/` 镜像，不代表生产关系数据或服务器文件状态。

| 范围 | 当前发现 | 对整改的影响 |
|---|---|---|
| `LivePage` | `site_aidreamcapes` 有 173 页；审计到 6,261 次媒体引用、2,681 个不同 URL 字符串、2,611 个归一化路径。格式为 2,503 WebP、131 JPG、24 PNG、23 MP4。当前引用全部是静态路径；70 个 URL 使用绝对 `www.aivideosugc.com` 主机，9 个 URL 含查询参数。 | 公开 SSR 引用目前没有发现客户下载或本地资源代理 API。绝对同源地址可改成 root-relative；查询参数版本需在确认文件字节后换为哈希文件名。 |
| 本地公开媒体目录 | 2,681 个 `LivePage` URL 中，2,151 个能在工作区 `public/` 找到，530 个未找到。 | 缺失项不可用本地种子或旧快照补齐。生产 SSH 当前返回公钥认证失败；公网 HEAD 连接被重置，因此缺失文件尚未获得生产源站回读。 |
| `MediaAsset` | 有 780 条站点级记录，739 个非空资源地址，`previewUrl`/`originUrl` 共 1,478 个非空字段。当前本地文件镜像未找到这些地址对应文件；其中 1,454 个在 `site_aidreamcapes_eu/mirror` 路径，另有 16 个 `site_aidreamcapes` fan-holiday 路径及 8 个 `site_aidreamcapes` mirror 路径。 | 需逐记录确定文件源和当前使用状态。Aidreamcapes EU 数据不能被复制、迁移或改写；先核验 Aidreamcapes 自己的源站与记录关系，再确定可执行映射。 |
| 客户素材 | 本地库有 92 条未删除的私有 `AssetUpload`。 | 全部留在客户私有存储及鉴权接口内，不能复制到公开静态目录，也不能把私有 URL 写入公开页面或 `MediaAsset`。 |
| Recreate 卡片 | 当前关系数据有 1,178 个带 `/app/create` 目标的图片卡对象，其中 939 个属于可预填的视觉选择器卡片，另 239 个不是完整的预设卡片；开始前均无 `sceneSlug`。生产迁移已为 939 个选择器卡片写入 `sceneSlug`，覆盖 32 个 `LivePage`。 | 只把具备当前 prompt、类型、标签和合法静态预览图的选择器卡片改成稳定 GET 路由；其余通用 CTA 保持普通创建入口，不生成虚构预设。 |
| 静态部署 | `deploy-aidreamcapes-release.mjs` 会从现有 release 复制 `public/`。通用 `sync-public-media.mjs` 没有 `aidreamcapes.com` 目标。 | 需要 Aidreamcapes 专用静态同步与域名映射，不扩展或改变会影响其他站点的默认同步目标。 |
| SSR 媒体元素 | Aidreamcapes v2 已用 `<img src>` 输出图片；三个视频组件已改为 `<video src poster>`，仍经现有 Aidreamcapes 页面渲染 resolver。 | 已完成静态 HTML 属性调整；仍需验证当前 SSR 输出 URL、文件 MIME 和 MP4 Range，并在静态资源完成前保持数据库 URL 不变。 |

## 3. 目标存储与 URL 规则

### 3.1 公开静态文件

- URL 保持在同源静态目录，例如 `/assets/sites/site_aidreamcapes/public-media/<relative-path>`；域名使用相对路径，避免绑定到某个主机名。
- 文件名带内容哈希，例如 `navy-cardigan-demo--sha256-<hash>.mp4`。文件内容变化时生成新文件名，不能覆盖旧哈希地址；查询参数不再承担版本控制。
- 服务端保存一份只用于传输和校验的媒体清单，记录源路径、目标路径、完整 SHA-256、字节数、识别出的 MIME 类型及公开用途。清单不得包含页面文案或客户数据，也不能作为运行时数据源或回滚快照。
- 优先使用 Aidreamcapes 专属静态目录及专用同步脚本，将 `site_aidreamcapes` 文件同步到站点服务器的持久静态根目录。Web 服务器按静态文件直接响应；如采用 CDN，必须确保地址长期稳定、无需签名，并透传字节范围请求。
- 每个文件在切换关系数据前完成文件哈希核验和源站 URL 读取。未核实归属、缺失或跨 `site_aidreamcapes_eu` 路径的资源进入待处理清单，不从旧快照补文件、不盲目复制或改写。

### 3.2 数据引用

- 从当前 `LivePage.contentJson` 提取公开媒体引用，按精确 JSON 路径生成字段级变更清单；绝对同源地址规范化为相对静态路径，替换成内容哈希文件地址。
- 对 `site_aidreamcapes` 的 `MediaAsset`，为每条非空 `previewUrl`、`originUrl` 建立独立来源映射。确认文件归属和内容后，两字段都改为可直接访问的静态 URL；空字段保持为空。未引用记录也需完成分类，但不因“统一”而删除记录或编造资源。
- `storageKey` 先按现有存储契约识别语义。若它只是稳定的记录键则保留；只有被证实承担实际文件路径时才另行制定兼容迁移，避免破坏媒体查找和唯一约束。
- 数据库更新使用显式 `siteId = 'site_aidreamcapes'` 过滤、当前字段哈希和源 `updatedAt` 检查。线上同字段已修改时跳过并报告冲突，不能用本地基线覆盖。

### 3.3 私有资源

- `AssetUpload` 中 `visibility = private` 的上传、生成结果、角色参考图及视频继续保存在 `customer-assets` 私有根目录。
- 工作台预览和下载继续经过现有客户会话鉴权路由；临时 worker 签名只可用于限定期限的服务端传输，不得进入公开页面、静态目录或公开媒体清单。
- 公开页面引用检查必须拒绝 `/api/local-assets/`、客户下载 API、客户存储 key、签名 query 和任何 `AssetUpload` URL。

## 4. Recreate 路由设计

1. 在当前 `LivePage.contentJson` 的每张可 Recreate 卡片中保存稳定 `sceneSlug`。slug 一经写入就保持不变；标题、图片或页面文案修改时不得重新按数组位置生成。当前审计识别出 939 张具备完整类型、标签、prompt 和静态预览图的可预填卡片，另外 239 个 `/app/create` CTA 不具备预设数据，继续使用普通创建入口。
2. 路由携带来源页面定位符和持久化的 `sceneSlug`，服务端只读取对应的当前 `LivePage.contentJson`，再按 slug 找到卡片并重建初始工作台状态。不新建索引表、不复制 prompt/文案/媒体到第二数据源，也不读取 `ThemePage`、草稿或快照。
3. 新增普通服务端 GET 路由 `/app/create/scene/[sceneSlug]`，并保持本地 `/site/aidreamcapes/app/create/scene/[sceneSlug]` 与 `/site/aivideosugc/app/create/scene/[sceneSlug]` 入口正确映射。无效 slug、已删除场景或当前页面不再包含该场景时返回 404，不回退旧页面或快照。
4. 公开卡片使用普通 `<a href>`；GET 服务端 SSR 预填场景，不依赖客户端 fetch/XHR 加载场景。实际生成仍走现有受认证、需校验 credit 的 POST。
5. 复用现有工作台 metadata，为新路由输出 `noindex,nofollow`。本地与生产域名的 SSR、场景回读和无效 slug 404 均已验证。

## 5. P0 执行步骤

| 阶段 | 工作项 | 完成条件 |
|---|---|---|
| P0-A 资产与引用盘点 | 已从生产当前 PostgreSQL 读取 171 个 Aidreamcapes `LivePage`、758 个站点级 `MediaAsset` 及公开资源文件清单；未读取私有上传。 | 2,941 个公开静态文件通过生产源站字节哈希核验，站点边界已确认。 |
| P0-B 静态发布 | 已发布至持久静态根目录，并在 `www.aivideosugc.com` TLS vhost 配置专属 Nginx alias。 | 源站 2,941 / 2,941、公网 2,941 / 2,941 通过状态、MIME、大小和 immutable 缓存检查；31 个视频 Range 返回 206。 |
| P0-C 关系数据重绑 | 已将当前 Aidreamcapes `LivePage.contentJson` 与该站点 `MediaAsset.previewUrl`、`originUrl` 中的公开资源地址更新为内容哈希地址。 | 171 个页面和 758 个媒体记录读回；剩余未哈希引用、MIME 不匹配和待写媒体字段均为 0。 |
| P0-D SSR 与直接媒体输出 | Aidreamcapes v2 图片使用 `<img src>`，视频使用 `<video src poster>`；SSR 直接输出静态地址。 | 首页、详情页、视频页和媒体响应已通过源站/公网检查；播放器支持 Range。 |
| P0-E Recreate slug | 939 张选择器卡片、32 行当前 `LivePage` 写入 `sceneSlug`；静态 resolver 与主机访客分流已部署。 | 首页 20 个 Recreate 链接无查询参数；源站、公网单条 SSR、noindex、预览和无效 slug 404 通过；本地 Chromium 点击、移除、刷新流程通过。 |
| P0-F 媒体及隐私验收 | 公共媒体 URL、私有上传边界与匿名工作区 API 已回归。 | 私有 AssetUpload 未进入静态清单；匿名预览、任务读取、任务提交仍返回 401。已登录跨客户权限未因本次变更触碰。 |

## 6. 验收矩阵

| 检查 | 通过标准 |
|---|---|
| 公共资源可用性 | `LivePage.contentJson` 每个图片、视频和封面 URL 返回 200；响应 `Content-Type` 与实际文件字节一致，包括 `image/jpeg`、`image/png`、`image/webp` 和 `video/mp4`。 |
| 视频播放与拖动 | 对 MP4 发送 `Range: bytes=0-1023` 返回 206、正确 `Content-Range` 和 `Accept-Ranges: bytes`；浏览器可播放和拖动进度。 |
| 稳定缓存 | URL 文件名包含内容版本；地址不含签名或临时 token。修改媒体生成新地址，旧哈希文件在缓存过渡期保留，不作为运行时 fallback。 |
| HTML 与无 JS | 桌面和手机视口下检查原始 SSR HTML；禁用 JavaScript 后仍能读取资源 URL 和点击 Recreate；公开页面不发起媒体元数据 fetch/XHR。 |
| 媒体展示 | 页面所有静态 URL 均可读，截图无破图；图片 `src`、视频 `src` 和 `poster` 不指向动态代理。 |
| Recreate | 每个 slug 唯一且解析到正确页面、卡片、prompt、场景和工具；GET 路由不调用生成 API；生成 POST 仍要求登录并服务端校验 credit。 |
| 私有资产隔离 | `AssetUpload` 不进入静态文件清单；登出后客户文件预览/下载返回未授权；登录后不能跨客户或跨站访问。 |
| 数据归属与回读 | `LivePage.contentJson` 是公开页面资源引用唯一运行时来源；`MediaAsset` 两个 URL 字段逐条回读；`site_aidreamcapes` revision 和源站/公网读回可追踪。 |
| 站点隔离 | 数据库更新、静态同步、slug 查询均显式限制 `site_aidreamcapes`；检查变更文件与公开输出，MyDreamShoots 不发生变化。 |

## 7. 发布顺序与回退

1. 先从目标环境的当前关系数据和服务器静态目录生成新的盘点清单，不读旧快照，不使用本地 seed 作为生产资源来源。
2. 先上传全部新哈希文件并从应用源站验证，再从公网验证静态响应和 MP4 Range。验证前不要把 URL 写入 `LivePage`。
3. 预演并审阅数据库字段级差异；生产执行时只改已批准的 Aidreamcapes 行，写后立即逐项回读。当前线上同字段发生变化时保留线上值并报告冲突。
4. 部署 SSR 与 Recreate 路由实现；在 origin 和公开域名分别检查无 JS 页面、媒体响应、robots 和生成鉴权。按合同记录 `LivePage` 版本、静态文件哈希及 origin/public readback。
5. 若数据库引用有误，使用针对当前关系数据的字段级逆向清单恢复这些字段；不得恢复、导入或切换历史发布/数据库快照。静态旧文件不删除，避免破坏已缓存页面。

媒体迁移前需要从当前生产源站核实 530 个工作区镜像缺失路径及 1,478 个 `MediaAsset` URL 字段的文件来源。无法在服务器找到或确认归属的资源不能迁移为公开静态文件，也不能用历史快照或重新生成的素材悄悄替代。

## 9. 执行记录（2026-10-18）

- 已新增只读审计脚本 `scripts/audit-aidreamcapes-static-media.mjs`，强制目标为本地并显式过滤 `site_aidreamcapes`；读取当前 `LivePage.contentJson`、该站点 `MediaAsset` URL 字段和私有上传数量，不读取旧快照或 `ThemePage`。
- 已生成 `releases/aidreamcapes-static-media-20261018/inventory-local.json`。清单包含公开媒体 URL、JSON 指针、文件存在性和本地 SHA-256，不包含私有 AssetUpload URL 或客户数据。新增 `scripts/build-aidreamcapes-static-url-map-local.mjs`，只读取该本地清单和 Aidreamcapes `public/` 文件，验证文件签名并生成哈希目标地址候选，不复制文件、不写数据库。候选结果见 `releases/aidreamcapes-static-media-20261018/static-url-map-local-candidates.json`：LivePage 2,151 个引用有本地源文件、530 个缺失；MediaAsset 的 1,454 个 EU 路径被隔离阻止，另 24 个 Aidreamcapes 路径本地缺失，均未改写。
- 已新增 Aidreamcapes 专用场景 slug 迁移脚本。它只写 `site_aidreamcapes` 当前 `LivePage.contentJson` 的 `sceneSlug` 字段；本地预演覆盖 939 张卡、32 行，事务读回及幂等检查通过。字段级记录见 `releases/aidreamcapes-static-media-20261018/scene-slugs-local-apply.json`。随后已按下方生产执行结果写入当前生产关系数据；本地预演文件不是生产数据来源。
- 已实现 `/app/create/scene/[sceneSlug]` 的 SSR resolver、`noindex,nofollow` 页面、Aidreamcapes 主机域名访客路由、公开选择器和灵感库的普通 GET 链接；工作台生成仍走现有鉴权 POST。Aidreamcapes v2 视频组件已改为直接 `<video src poster>`。
- `npm run typecheck` 通过。通过本地当前数据验证了工作台路径和 host 路径均返回预填 SSR HTML、包含 `X-Robots-Tag: noindex, nofollow`；无效场景 slug 返回 404。首页原始 HTML 返回 200，图片地址由 SSR 直接输出。本地静态 WebP 和 MP4 返回正确 MIME，MP4 Range 请求返回 206。
- 初始本地盘点时 SSH 只读探测失败且公网 HEAD 被重置；随后恢复生产访问并完成下方生产执行记录。
- 初始盘点的下一步要求已由下方生产执行记录完成；Aidreamcapes EU 的 1,454 个字段保持隔离，未复制、迁移或改写。

## 8. 主要代码入口

- 静态媒体规则与发布：`docs/public-static-media.md`、`scripts/sync-public-media.mjs`、`scripts/deploy-aidreamcapes-release.mjs`、`scripts/build-aidreamcapes-static-url-map-local.mjs`
- Aidreamcapes v2 图片与视频 SSR：`src/components/storefront/aidreamcapes-v2/parts.tsx`、`src/components/storefront/aidreamcapes-v2/visual.tsx`、`src/components/theme-renderer.tsx`
- 当前精选卡片链接与 `LivePage` 解析：`src/lib/aidreamcapes-workspace/preset-contract.ts`、`src/lib/aidreamcapes-workspace/presets.server.ts`
- 灵感库 Recreate 链接：`src/lib/aidreamcapes-inspirations-types.ts`、`src/lib/aidreamcapes-inspirations.ts`、`src/components/storefront/aidreamcapes-inspirations-page.tsx`
- 工作台 metadata 与服务端预填：`src/lib/aidreamcapes-workspace/page.tsx`、`src/app/site/aivideosugc/app/create/page.tsx`
- 私有客户素材存储与鉴权：`src/lib/customer-asset-storage.ts`、`src/lib/stores/asset-store.ts`、`src/app/api/sites/[siteId]/customers/[customerId]/assets/[assetId]/download/route.ts`

## 10. 生产执行结果（2026-10-18）

- 部署 commit `7e2658f517a18913897a96cf1b80b3c6d9f98a81` 已推送至 GitHub `main` 并切换到 `www.aivideosugc.com`。候选及切换后 SEO 合约通过：24 个重点页、82 个 sitemap 页、55 个重定向；无待执行数据库 schema migration。
- 媒体迁移继续以当前 PostgreSQL `LivePage.contentJson` 和 `site_aidreamcapes` 过滤的 `MediaAsset` 为数据源。2,941 个唯一文件共 556,030,899 字节；写后 6,262 个页面引用和 1,434 个 MediaAsset URL 字段均无未哈希项，0 个待写 MediaAsset 字段，MIME 不匹配为 0。
- Recreate slug apply 更新 32 个当前 `LivePage` 行，为 939 张卡写入 939 个 slug；全量重复 plan 为 0 个待新增。数据库派生 `SitePublishedState` 不存在，公开 SSR 直接读取当前 `LivePage`，没有导入或切换 publication/snapshot。
- 源站和公网首页各回读 20 个静态 Recreate URL；`Canvas Tote Product Detail` 返回 200、SSR 预填、哈希预览、`noindex,nofollow`。虚构 slug 返回 404。线上 host 路由及本地 `/site/aidreamcapes/...` 别名均启用。
- 本地 Chromium 交互测试验证首页点击 Recreate、移除模板后地址重置为 `/app/create`、刷新不恢复已移除模板，浏览器 pageerror 为 0。当前工作区 `npm run typecheck` 和 MyDreamShoots 生产内容保护检查均通过。
- MyDreamShoots 生产内容保护检查通过，Aidreamcapes EU 与 MyDreamShoots 服务 PID/release 未更改；slug 写入的 SQL 过滤仅包含 `site_aidreamcapes`。生产审计保存在服务器 `ops/aidreamcapes-static-media-20261018/`，媒体 apply 原始报告已保留为 `apply-media-20261018.json`。
