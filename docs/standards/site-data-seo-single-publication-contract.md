# 全站数据与 SEO 单一发布闭环规范

> 状态：`ACTIVE / IMPLEMENTATION CONTRACT`
>
> 适用范围：本仓库所有公开 storefront、站点主题、页面、SEO、媒体、套餐、导航、sitemap、robots、JSON-LD、后台预览和发布流程。
>
> 来源：基于会话 `01a029be-5dea-74a1-860b-76b333ceaf46`（SEO 数据闭环与页面独立性）和 `01a01fd1-2ce3-7f90-abc3-3a615502907a`（数据库唯一运行时与 JSON 移除）整理。
>
> 本文是技术实现和验收合同，不是某一次审计的 PASS 证明。实时状态必须用当前代码、目标数据库和公网读回重新验证。

## 1. 核心结论

全站必须同时满足下面三句话：

1. **一个站点只有一套公开发布数据。**
2. **一个站点只有一条 SEO owner 链路。**
3. **每个可索引页面都有自己的页面实体和自己的页面数据，模板只负责结构。**

这里的“一套”不是指数据库只能有一个表，也不是指所有页面共用一份文案。它指的是：在任一公开请求中，HTML、metadata、canonical、Open Graph、Twitter、JSON-LD、sitemap、robots、媒体和内部链接，必须从同一个站点、同一个 active publication、同一个 snapshot revision 中解析出来。

多站点系统允许每个站点各自拥有一套发布投影；不允许把站点 A 的公开实体、SEO 主机、媒体或文案偷偷作为站点 B 的运行时 fallback。

## 2. 不可违反的架构原则

### 2.1 数据库是公开运行时唯一来源

本地、测试和生产的 Next.js 公开运行时只能读取 PostgreSQL 的已发布数据：

```text
公开请求
  -> PostgreSQL
  -> site 的 active publication
  -> immutable ThemePublication.snapshot
  -> published projection
  -> HTML / SEO / sitemap / robots / links
```

以下路径不得参与公开运行时读取、写入或故障降级：

- `data/platform-state.json`；
- `archive/legacy/platform-state.json`；
- `.next/cache` 中的持久化平台状态快照；
- 任何本地 JSON preview、legacy preview、file preview；
- 代码中的静态页面内容 map；
- 通过 route/profile 在请求时合成整页文案的逻辑。

数据库不可用、publication 不存在、snapshot 不完整或环境配置不合法时，必须 fail closed，返回明确错误或 5xx；**不得展示旧 JSON、旧静态页面或半套新半套旧数据**。

### 2.2 数据库中的 JSONB 不等于文件 JSON

本规范禁止的是文件 JSON 作为运行时事实源，不要求本轮把 PostgreSQL 中的 JSON/JSONB 列全部拆成关系表。下列字段可以继续作为数据库发布投影的结构化载体：

- `ThemePage.publishedJson` / `draftJson`；
- `ThemeSettings.publishedJson`；
- `StorefrontProfile.publishedJson`；
- `ThemePublication.snapshot`；
- 其他明确属于 PostgreSQL schema 的 JSONB 字段。

但是，公开页面最终必须消费 immutable publication projection。旧的 `publishedJson` 直读只能作为迁移兼容输入，不能成为第二个公开 SEO owner。

### 2.3 一个 active publication + 一个 immutable snapshot

公开站点必须通过一个明确的 active pointer 选择当前版本：

```text
ActiveThemePublication(siteId)
  -> ThemePublication(id, version)
  -> ThemePublication.snapshot
```

发布版本必须是 append-only、可审计、带 revision/hash 的不可变快照。禁止：

- 直接修改正在使用的 snapshot；
- 同步脚本直接覆盖 `publishedJson` 后宣称已经发布；
- 页面读一部分新 publication、另一部分旧 `ThemePage`；
- 只切换代码版本而不切换/验证 publication；
- 用“最新一条记录”代替 active pointer。

### 2.4 一个 SEO owner

目标链路固定为：

```text
中心业务事实 / draft
  -> publish compiler
  -> immutable published projection
  -> 一个 effective-page / SEO resolver
  -> 所有公开消费者
```

当前代码中的 `createPublishedSiteSnapshot`、`resolveEffectivePublishedPage`、`resolvePublishedSeoEntity` 等模块可以承担这个职责，但最终必须对外表现为**一个可比对的解析结果**，而不是多个消费者各自重新推导。

同一个解析结果至少要同时提供：

- `siteId`；
- `pageEntityId` / `pageId`；
- `publicPath` / `canonicalPath`；
- `routeDisposition`；
- `indexability`；
- title、description、H1、body、FAQ、CTA、related links；
- media projection；
- offers / collections / facts；
- `publicationId`、publication version、各实体 revision；
- `snapshotHash` / `buildId`。

正文渲染、metadata、JSON-LD、redirect、sitemap、robots、OG/Twitter、预览和缓存都只能消费这个结果。

## 3. 全站数据分层和 ownership

### 3.1 允许存在的层

| 层 | 作用 | 是否可直接服务公开页面 |
|---|---|---|
| Draft / source | 编辑器、导入、同步、人工审核的工作数据 | 否 |
| Center facts | 法律实体、隐私、退款、积分生命周期、支付能力等业务事实 | 只能通过发布投影 |
| Publish compiler | 校验路由、页面、媒体、链接、套餐和事实，并生成快照 | 否 |
| Active publication | 当前站点唯一公开版本的指针 | 间接 |
| Immutable snapshot | 一次发布的完整公开投影 | 是，唯一公开数据边界 |
| Runtime resolver | 按请求路径从 snapshot 解析一个 effective page | 是，唯一解析入口 |
| Public HTML / metadata / schema | 对用户和爬虫的最终输出 | 是 |

### 3.2 共享数据与独立页面数据必须分开

可以共享的内容：

- 站点级已核验 `PublishedFacts`；
- 真实套餐和支付能力 `PublishedOffers`；
- 组件结构、设计 token、序列化器；
- 已批准且有 owner/revision 的公共媒体或分类。

不得共享为页面内容的内容：

- 每个页面的 title、description、H1、正文、hero 叙事；
- 页面 FAQ、CTA、related links；
- 页面主图、gallery、alt 和 social image；
- 页面特有的产品/集合说明；
- 页面特有的 schema 主体和 Breadcrumb 末项。

共享事实只能被页面实体引用，不能借共享事实把多页渲染成同一篇内容。

## 4. 页面实体合同

### 4.1 可索引页面的最低数据要求

每一个 `indexable=true` 的公开 URL 必须存在且仅存在一个有效 `PublishedPageEntity`，并有稳定的 `pageEntityId`。页面实体至少需要：

```text
siteId
pageEntityId
pageId（若有旧页面记录）
pageType / routeKind
canonicalPath
status
indexable
sitemapEligible
title
description
h1
body / sections
hero / gallery introduction
faq
ctaLinkEntityId
relatedLinkEntityIds
mediaEntityId
pageRevision
copyRevision
```

字段可以在 snapshot 内按结构组织，但 owner、revision 和引用关系必须可机器校验。

### 4.2 页面与路由必须一一对应

对每个公开路由建立完整 inventory，并明确其 disposition：

```text
render + published + indexable
render + published + noindex
redirect -> targetPath
deferred / review_required
not_found
```

不得出现以下状态：

- 有 sitemap URL 但没有 page entity；
- 有 page entity 但没有可访问 route；
- route 指向 A，canonical 指向 B；
- 页面可见 H1 属于 A，JSON-LD/metadata 属于 B；
- 通过未列入 inventory 的隐藏路径发布内容。

### 4.3 页面类型覆盖

标准必须覆盖完整公开路由，而不是只覆盖最容易实现的叶子页：

- 首页；
- 标准内容页、目录页、价格页、FAQ、workflow、about、contact；
- AI image theme/use-case leaf；
- AI video directory、topic/detail、工具详情页；
- Blog index、category、author、article；
- Privacy、Terms 及其他政策页；
- redirect、404、500 等非索引终端路由。

没有完整 route inventory 时，结论只能写 `REVIEW_REQUIRED / INCOMPLETE_PAGE_COVERAGE`，不能写全站 PASS。

## 5. SEO 输出合同

### 5.1 身份字段必须完全一致

同一个页面的以下值必须解析到同一最终 URL，并在协议、host、path、大小写、尾斜杠和 canonical 参数上完全一致：

- HTML `<link rel="canonical">`；
- `og:url`；
- `twitter:url`（如输出）；
- JSON-LD 主体 URL；
- JSON-LD `BreadcrumbList` 最后一项；
- sitemap `loc`；
- 页面内部的公开 identity link。

规则：

- canonical、hreflang、sitemap、robots Sitemap、`og:url`、社交图片 URL、JSON-LD URL 使用绝对 HTTPS URL；
- 同域普通导航和可见本地资源使用 `/` 开头的 root-relative URL；
- 禁止 protocol-relative、directory-relative 和未经规范化的混合写法；
- 同一资源的 metadata 绝对 URL与可见 `<img>` root-relative URL，比较前必须先规范化。

### 5.2 metadata、正文、schema 必须来自同一实体

禁止让以下消费者各自从不同表、静态 map 或 route profile 取值：

```text
页面正文
metadata / title / description
canonical / robots
Open Graph / Twitter
JSON-LD / Breadcrumb / ItemList / FAQ
sitemap / sitemap images
```

它们必须携带并可回读相同的：

```text
siteId + pageEntityId + publicPath + publicationId + revision
```

每个可索引页面必须只有一个 H1。H1 owner 必须在 page entity 合同中明确，模板不得额外生成第二个页面级 H1。

### 5.3 indexability 是发布数据，不是运行时猜测

`indexable`、`sitemapEligible`、robots 和 redirect disposition 必须在发布时一起计算并写入投影。运行时不得根据 hostname、localhost、缺字段或旧页面类型临时改变索引策略。

公开页面缺少必需事实、媒体、canonical、H1 或实体引用时，应变为 `review_required` / `noindex` / 发布阻断，而不是自动套默认文案继续上线。

## 6. 媒体、链接、套餐和事实合同

### 6.1 页面媒体必须有 owner

每个页面的 hero、gallery、primary image、OG/Twitter image、JSON-LD image 和 sitemap image 必须能追溯到页面自己的 `mediaEntityId` 及 revision。

不得使用与页面无关的站点默认图来伪造页面完成；缺图时标记 `review_required` 或阻断发布。

### 6.2 内部链接必须是发布实体引用

CTA 和 related links 必须使用 `PublishedLinkRef`：

- `ownerPageEntityId` 必须是当前页面；
- 目标为公开渲染页时，目标 page entity 必须存在、已发布、可索引；
- 目标为私有动作时，只允许明确 allowlist（例如 `/app/create`）；
- 链接 label、href、target entity 和 revision 必须在同一个 snapshot 中。

### 6.3 商品/集合必须共享同一投影

可见套餐卡、JSON-LD Offer、价格页和结账入口必须来自同一 `PublishedOfferProjection`；可见集合列表和 JSON-LD `ItemList` 必须来自同一 collection projection。禁止 renderer 自己 `slice`、schema 自己重新筛选、价格状态自己硬编码。

### 6.4 事实必须有业务 owner

隐私、训练、保留期限、退款、积分 reserve/consume/release、安全和法律主体等绝对陈述，必须引用有版本和验证状态的 `PublishedFacts` / policy owner。

营销文案不能自行发明或复制未经核验的事实。缺失事实时降级为可证实的中性表述，或阻断需要该事实的页面。

## 7. 模板、静态内容和运行时合成禁令

### 7.1 模板只负责结构

模板可以包含：

- layout、组件结构、样式、可访问性和序列化逻辑；
- 字段缺失时的安全空态；
- 已批准的共享事实 formatter。

模板不得包含：

- 页面特有 title、description、H1、FAQ、CTA 或正文；
- 按 slug 猜页面身份的 SEO 文案；
- 直接读取代码静态 map 作为公开内容；
- DB 失败时的静态页面或 JSON fallback；
- 请求时拼接出一个未存在于 publication 的完整页面实体。

### 7.2 静态 map 的唯一允许用途

代码中的静态内容只能作为以下之一：

- draft/source seed；
- migration/import fixture；
- 离线测试 fixture；
- publish 前编译输入。

一旦进入公开运行时，必须已经编译进 immutable snapshot，并由 runtime 只读 snapshot。`aiVideoTopicLandingContentByKey`、工具 fallback、目录合成等模式不得继续作为第二公开来源。

### 7.3 直接同步 `publishedJson` 的脚本禁止上线

同步脚本可以更新 draft/source，但不得直接把 `publishedJson` 当成发布动作。正式发布必须：

1. 读取已审核 draft 和中心事实；
2. 编译完整 projection；
3. 运行完整性、引用、revision、hash 校验；
4. 追加新 `ThemePublication`；
5. 在事务中原子切换 active pointer；
6. 清理/递增公开缓存；
7. 做 origin 和 public readback。

## 8. DB-only 运行时合同

### 8.1 强制环境

公开 runtime 启动前必须校验：

```text
PERSISTENCE_BACKEND=postgres
PLATFORM_STATE_POSTGRES_STRICT=1
STOREFRONT_PATH_MODE_READS=database
DINGYUE_ENV 与 DATABASE_TARGET 一致
DATABASE_URL 存在且指向预期 PostgreSQL
```

`json`、`local-preview`、`json-preview`、`legacy-preview`、`file-preview` 或非法 DATABASE_URL 必须直接阻止启动。

检查必须同时接入：

- `npm run dev`；
- `npm run start`；
- `server.mjs` 直接启动路径；
- 公共 database resolver。

不能只在某一个启动器中加 guard。

### 8.2 运行时禁止项

公开 `src/app`、`src/components`、`src/lib` 路径不得出现以下行为：

```text
读写 data/platform-state.json 或 archive/legacy/platform-state.json
PostgreSQL 失败后读取文件 JSON
localhost 强制读取 legacy JSON
用 .next 持久化状态快照替代数据库
用默认静态页面掩盖 publication 缺失
```

迁移、离线审计和 fixture 可保留文件 JSON，但必须位于明确白名单目录，且不得被生产 build/runtime import。

### 8.3 错误行为

| 故障 | 必须行为 |
|---|---|
| PostgreSQL 不可用 | 5xx / 明确数据库不可用错误 |
| 无 active publication | 发布/公开请求阻断或明确未发布状态 |
| snapshot `legacy` / `invalid` | 不得生成可索引公开页面 |
| 页面实体缺失 | 404、noindex 或 `review_required`，按路由合同处理 |
| 媒体/事实/链接缺失 | 发布 preflight 阻断或降级为明确不可索引状态 |
| 缓存与 snapshot revision 不一致 | 清缓存/阻断 readback，不得静默混用 |

## 9. 发布闭环

### 9.1 标准流程

```text
Source / Draft
  -> Center facts / offers / media / links
  -> Route inventory
  -> Publish preflight
  -> Immutable snapshot compile
  -> Snapshot integrity + hash + revision checks
  -> Append ThemePublication
  -> Atomic ActiveThemePublication switch
  -> Cache invalidation / revision bump
  -> Origin HTML + metadata + schema + sitemap/robots readback
  -> Public domain readback
  -> Closeout receipt
```

### 9.2 每一层必须有独立证据

| 层 | 最低证据 |
|---|---|
| Source | 输入版本、owner、变更范围 |
| Center | 目标 site、page/entity、事实和媒体记录存在 |
| Publication | publication id/version、active pointer、snapshot hash |
| Runtime | 页面实际消费的 `siteId/pageEntityId/revision` |
| Origin | HTML、head、schema、媒体、HTTP 状态 |
| Public | 真实域名的同样 readback |
| Sitemap/robots | sitemap URL -> route -> canonical -> robots -> schema 一致 |

`commit`、`git pull`、guard PASS、HTTP 200、scheduler accepted、单文件存在、checksum 或本地 fixture PASS，都只能作为中间证据，不能单独称为业务完成。

### 9.3 原子性和回滚

- publication 必须 append-only；
- active pointer 切换必须原子；
- 发布失败不得部分更新公开数据；
- 回滚通过重新激活一个已验证的旧 snapshot 或生成新修复 publication，不直接编辑线上 published JSON；
- 保留旧 publication、hash、revision 和 readback 记录。

## 10. 验收标准

### 10.1 代码合同

至少通过以下类别的检查（命令名可随仓库调整，但语义不可减少）：

```bash
npm run typecheck
npm run guard:storefront-single-source
npm run guard:mydreamshoots-page-independence
npm run guard:mydreamshoots-publication-immutability
npm run smoke:mydreamshoots-route-entity-contract
npm run smoke:mydreamshoots-publication-snapshot
npm run smoke:mydreamshoots-seo-indexing
npm run smoke:mydreamshoots-standard-page-media
npm run smoke:database-target-isolation
```

如某命令依赖数据库，必须记录实际目标数据库；不能用 JSON fixture 冒充 DB readback。

### 10.2 数据库 readback

必须直接读取目标 PostgreSQL，确认：

- site 有唯一 active publication；
- active snapshot integrity 为 `valid`；
- snapshot hash 与 revisions 一致；
- 所有 indexable route 都有 page entity；
- page、copy、media、collection、link、offer、facts 的 owner/revision 一致；
- 首页 approved lock 未改变；
- 没有旧 publication 内容混入当前公开 projection。

### 10.3 逐页公网 readback

对完整 route inventory 的每一条公开 URL逐页记录：

```text
HTTP status
最终 URL / redirect
siteId
pageEntityId
publicationId / version
revision
title
description
唯一 H1
canonical
og:url / twitter:url
JSON-LD URL / Breadcrumb / ItemList / FAQ
sitemap loc
robots index/follow
hero / gallery / alt / social image
CTA / related links
```

这些值必须与同一 snapshot 的投影逐项相等。只抽查首页或几个 image leaf，不足以证明全站闭环。

### 10.4 破坏性测试

在隔离环境执行：

1. 设置 `PERSISTENCE_BACKEND=json`，启动必须失败。
2. 设置 `STOREFRONT_PATH_MODE_READS=local-preview`，启动必须失败。
3. 停止/改错 PostgreSQL，首页、metadata、JSON-LD、sitemap 不得显示旧 JSON 内容。
4. 移走测试副本中的文件 JSON，健康数据库下页面仍正常。
5. 删除/失效 active publication，indexable 页面不得继续以旧缓存成功返回。
6. 发布后使用新 revision，HTML、head、schema、sitemap 和缓存必须全部切到同一 revision。

## 11. 当前会话暴露的已知偏差

以下是会话中发现的实现风险，写入本规范是为了防止技术误以为“已有几个 guard 就代表全站完成”。它们必须在当前 checkout 和目标环境重新确认：

1. 公开运行时虽已向 PostgreSQL-only 收敛，但历史 JSON fallback、迁移脚本和测试脚本仍需按白名单逐项清理。
2. `ActiveThemePublication` / immutable v1 snapshot 如果在目标数据库不存在或未激活，不能报告全站闭环完成。
3. 图像主题 leaf 的独立性合同通过，不代表首页、标准页、视频、工具、博客和政策页都已进入同一 `PublishedPageEntity` 投影。
4. 视频 topic 静态 map、工具详情运行时合成、目录页动态拼接等路径，若仍被公开 runtime 调用，就构成第二数据源。
5. 任何普通同步、修复、迁移脚本直接写 `publishedJson`，都绕过了正式 publication 边界，必须改为 draft/source -> 正式 publish。唯一允许写入 published row 的入口是专门的 publication command，且必须在同一变更中校验 snapshot、创建 immutable `ThemePublication`、切换 active pointer，并提供备份和 readback；本次 TDK 使用 `scripts/publish-mydreamshoots-homepage-tdk.mjs`，不能由通用同步脚本代替。
6. `ThemePage.publishedJson` 记录数量不能作为 page entity 覆盖证明；必须验证 route/entity/media/link/revision parity。
7. 本地数据库或本地补齐的数据只能证明代码路径可运行，不能证明线上 production 闭环。

上述条目不是允许长期保留的例外；在未关闭前，结论使用 `PARTIAL`、`REVIEW_REQUIRED` 或 `PUBLISH_BLOCKED`，不得使用 `PASS`。

## 12. 实施顺序

### P0：先建立唯一公开边界

1. 确认目标数据库 schema、`ActiveThemePublication` 和 v1 snapshot 可用。
2. 让公开 runtime、metadata、JSON-LD、sitemap、robots 全部从同一 snapshot/resolver 读取。
3. 删除或隔离所有文件 JSON fallback 和静态公开 fallback。
4. 禁止普通同步脚本直写 `publishedJson`，统一经过 publication service；正式 publication command 必须把 published row、snapshot 和 active pointer 作为一个可回读的发布闭环处理。

### P1：补齐页面实体覆盖

1. 建完整公开 route inventory。
2. 为首页、标准页、视频、工具、博客、政策页补齐 `PublishedPageEntity`、copy、media、links 和 revisions。
3. 清理请求时页面合成；必要的内容在 publish 前编译进 snapshot。
4. 为每类页面增加逐页 readback 和缺失字段阻断。

### P2：发布与公网验收

1. 在隔离数据库创建 candidate publication。
2. 做 origin readback。
3. 做真实域名 public readback。
4. 校验 sitemap/robots 与最终页面一致。
5. 记录 publication receipt、hash、revision、commit、运行时实例和回滚点。

## 13. 技术交付时必须回答的问题

每次技术提交或发布，必须明确回答：

```text
1. 公开数据唯一 owner 是什么？
2. 当前 active publication id/version 是什么？
3. 该页面的 pageEntityId、revision、mediaEntityId、linkRevision 是什么？
4. HTML、metadata、JSON-LD、sitemap、robots 是否消费同一个解析结果？
5. 是否仍存在静态 map、运行时合成或 JSON fallback？若有，是否仅在白名单迁移/fixture 路径？
6. 数据库不可用时实际返回什么？是否可能展示旧页面？
7. 代码、数据库、origin、公网分别验证到了哪一层？未验证的层是哪一层？
8. 首页 approved lock 是否逐字段无差异？
```

## 14. 术语和状态

| 状态 | 含义 |
|---|---|
| `PASS` | 当前目标环境的代码、数据库和所需读回均满足合同 |
| `PARTIAL` | 某一页面类型或某一层满足，不能外推全站 |
| `REVIEW_REQUIRED` | 缺少完整覆盖或证据，需要逐页/逐层复核 |
| `PUBLISH_BLOCKED` | 违反唯一 owner、完整性、事实、媒体、链接或数据库前置条件 |
| `NOINDEX` | 页面可渲染但明确不允许索引，且不进入 sitemap |
| `LEGACY` | 旧结构或旧数据，仅可用于迁移/审计，不得作为公开运行时来源 |

## 15. 变更边界

- 本规范不授权修改首页文案、首页视觉、公开 URL、套餐价格、法律事实或生产数据库。
- “技术修复单一数据源”不等于可以顺手重写页面 Copy、换图、改 CTA 或新增静态页面。
- 任何扩大页面范围、改变 canonical、改变 indexability 或迁移生产数据的动作，都要单独说明 owner、影响、回滚和验收证据。
- 原来已经满足合同的内容保持不变；只修复可证明的 owner 分裂、数据缺失、事实风险或发布闭环问题。

## 16. 参考实现边界

当前仓库中与本规范直接相关的 owner/检查入口包括：

- `src/lib/storefront-context/`：published snapshot、页面和路由解析；
- `src/lib/publication-snapshot-integrity.ts`：snapshot 结构、引用、revision 和 hash 校验；
- `src/lib/seo-indexing.ts`：sitemap/robots/indexability 消费边界；
- `src/lib/storefront-metadata.ts`、`src/lib/theme/json-ld.ts`：必须消费同一 effective page projection；
- `src/lib/storefront-render.tsx`：必须禁止未发布的运行时页面合成；
- `src/lib/storefront-state.ts` / `storefront-state-relational.ts`：PostgreSQL-only 读取边界；
- `scripts/guard-storefront-single-source.mjs`；
- `scripts/guard-mydreamshoots-publication-immutability.mjs`；
- `scripts/smoke-mydreamshoots-publication-db-readback.mjs`；
- `docs/content-locks/mydreamshoots-homepage-approved.json`：首页保护基线。

实现名称可以调整，但 owner 不能重复，公开数据流不能分叉，验收证据不能省略。
