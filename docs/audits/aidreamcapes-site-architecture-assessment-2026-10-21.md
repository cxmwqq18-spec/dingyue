# AIVideosUGC 站点结构与方法评估

> 性质：**只读架构评估**，未做任何写入、发布或配置变更
> 评估对象：`site_aidreamcapes`（`www.aivideosugc.com`）及其所在平台（`dingyue`）
> 评估基准：仓库 `main` 分支 HEAD `a8b7b1906` + 生产关系库只读读回（2026-10-21）
> 口径说明：本文只描述**结构与机制**，不含内容质量评价；内容侧见
> `docs/plans/aidreamcapes-template-directory-data-chain-audit-2026-10-21.md`

---

## 1. 结论摘要

| 维度 | 评价 | 一句话结论 |
|---|---|---|
| 数据架构 | **强** | 单一 PostgreSQL 关系库为唯一事实源，公开页只读 `LivePage.contentJson`，有闸门强制 |
| 交付形态 | **强** | 公开页 100% 服务端渲染，浏览器不发数据请求，有 SSR 契约闸门 |
| 工程治理 | **强** | 13 个发布闸门 + 独立部署脚本 + 字段级内容契约，规则被代码而非文档强制 |
| 性能与可用性 | **弱** | 运行时内存贴着 V8 上限，常态 OOM 崩溃；TTFB p50 7s / p90 14s |
| 可维护性 | **中偏弱** | 单应用承载 7 店铺，共享层 9–18% 的行是店铺专属分支；两套渲染栈并存 |
| 文档一致性 | **中** | `AGENTS.md` 描述的 `SitePublishedState` 派生缓存实际已被"退役"，实现与契约有漂移 |

**一句话**：这是一个**治理规范、数据纪律远超一般中小型项目，但复杂度已经超过其结构承载力**的平台——规则写得很清楚，代码大体遵守，而"一个应用七个店铺 + 两套渲染栈 + 21k 行渲染器"的结构正在把规则的成本推高。

---

## 2. 平台结构

### 2.1 单应用承载 7 个店铺

一个 Next.js 应用同时服务 7 个店铺（关系库 `Site` 表读回）：

| siteId | slug | 主域名 | LivePage | 状态 |
|---|---|---|---|---|
| `site_aidreamcapes` | aidreamcapes | www.aivideosugc.com | **268** | active |
| `site_dreamshoot` | mydreamshoots | www.mydreamshoots.com | 107 | active |
| `site_aidreamcapes_xby` | aidreamcapes-eu | aidreamcapes.eu | 97 | active |
| `site_mydreamshoots_xby` | aidreamshoots | aidreamshoots.eu | 97 | active |
| `site_grownstride_test` | grownstride | test.grownstride.com | 95 | active |
| `site_lumen` | lumen | lumen.localhost | 23 | active |
| `site_atlas` | atlas | atlas.localhost | 20 | draft |

LivePage 合计 **707** 行；`SiteDomain` 14 条。

**含义**：AIVideosUGC 是体量最大的一个店铺（268 行，占 38%），它的数据模型实际上定义了这套平台的复杂度上限。

### 2.2 三种寻址模式并存

| 模式 | 路由 | 适用 |
|---|---|---|
| host 模式 | `src/app/ai-image-generation/[themeSlug]/page.tsx` | 独立域名商店 |
| path 模式 | `src/app/site/[siteSlug]/[...path]/page.tsx` + `src/app/site/[siteSlug]/ai-image-generation/[themeSlug]/page.tsx` | 同一域名多店（本地/多品牌） |
| catch-all | `src/app/[...path]/page.tsx`（1098 行） | 兜底 + 重定向 |

三套路由都调用同一个 `parsePublicCollectionRouteForSite`（`src/lib/photo-package-taxonomy.ts`），**按 `isAidreamcapesRouteSite(site)` 分支隔离店铺行为**——这是当前唯一可靠的隔离机制。

### 2.3 两套渲染栈并存（最大结构特征）

| 栈 | 位置 | 规模 | 适用 |
|---|---|---|---|
| 旧主题引擎 | `src/components/theme-renderer.tsx` | **21,184 行**，121 种 section 类型 | MyDreamShoots / Aidreamcapes-EU / GrownStride |
| v2 手写栈 | `src/components/storefront/aidreamcapes-v2/` | 39 个文件 | **AIVideosUGC 独占** |

分界点在 `theme-renderer.tsx:342`：

```ts
if (aidreamcapesV2Navigation?.version === 2) { /* → AidreamcapesV2Shell + AidreamcapesV2Page */ }
```

即 **由首页 LivePage 里的 `siteNavigation.version` 决定走哪套栈**。

**评估**：
- ✅ 好处：AIVideosUGC 摆脱了 21k 行主题引擎的包袱，用 39 个手写组件拿到完全可控的页面结构与样式
- ⚠️ 代价：同一应用内有两套**导航/页脚/JSON-LD/面包屑**实现（本轮修的页脚与面包屑就只存在于 v2 栈），任何"全站一致性"需求都要改两遍
- ⚠️ 代价：`theme-renderer.tsx` 仍在共享路径上，AIVideosUGC 的任何改动都要确认没碰它

---

## 3. 数据架构

### 3.1 单一关系库为事实源

| 表 | 行数 | 作用 |
|---|---|---|
| `LivePage` | 707 | **公开页唯一内容源**（`contentJson` jsonb） |
| `CreativePack` | 371 | 照片/图片类模板实体 |
| `VideoTheme` | 228 | 视频类模板实体 |
| `StorefrontProfile` | 5 | 站点身份/法务信息（`publishedJson.identity`） |
| `PlatformStateDocument` | 1（31 MB） | **legacy 全量状态，读取已禁用** |

`src/lib/stores/site-store.ts:1110` 是公开读取的唯一入口：

```ts
Object.assign(publicPage, { liveContentJson: cloneJson(page.contentJson) });
```

→ 公开面确实只消费 `LivePage.contentJson`，符合 AGENTS.md 契约。

### 3.2 内容模型：页面 = sections + 有序块

`LivePage.contentJson` 结构：

```
{ seo, version, pageType, sections, sectionsOrder, mediaManifest,
  siteNavigation, contentContract, templateDefinition, ... }
```

- `pageType` 是路由语义的主控字段：`home / content / ai_tool / collection / policy / article / ai_tool_directory / workspace / album / pricing / search / account / 404 …`（AIVideosUGC 268 行分布：`content` 134、`ai_tool` 74、`policy` 19、`article` 9、其它 32）
- `sections` 是 `sectionId → { type, settings: { layout, data } }`
- `sectionsOrder` + `blockOrder` 决定渲染顺序
- 页面是**自描述**的：没有独立的"页面表 + 区块表"，一个 JSONB 装下整页

**评价**：
- ✅ 优势：改版不需要迁移，改一行 JSON 即时生效，天然支持"整页策展"
- ⚠️ 代价：**无法对区块做关系查询**。上一轮评估里"facet 页的模板是不是按行业配的"这类问题，只能靠解析 JSON 遍历 `templateDirectory.paths` 才能回答——这正是"行业/平台/场合维度在关系模型里不存在"的根因
- ⚠️ 代价：单个 JSONB 承载整页，`LivePage.contentJson` 平均 12 kB / 最大 112 kB；AIVideosUGC 首页 112 kB 单行即为一个 HTTP 请求要解析的 JSON

### 3.3 导航模型：导航发布在首页

站点导航（含页脚分组、mega menu）**整份存在首页 LivePage 的 `contentJson.siteNavigation`**，全站共享：

```
siteNavigation = { version, links, menus[5], actions, footer{ tagline, groups[5], legal, copyright, socialLinks } }
```

- mega menu = `menus[]`（Video / Image / Templates / AI Actors / Resources）
- 页脚 = `footer.groups[]`（5 组：Video / Image / Templates / Industries / Platforms & help）

**评价**：单点发布、全站一致，运营上很省事。
**风险**：首页成为导航的单点故障域——首页 LivePage 一旦异常，全站导航与页脚同时失真；且 AIVideosUGC 首页承担了"内容 + 导航 + 公司信息 + SEO keywords"四重职责。

### 3.4 派生状态：`SitePublishedState` 已退役但文档未更新

`AGENTS.md` 写：

> The compiler may refresh `SitePublishedState` as a derived cache.

实际：

- `SitePublishedState` 模型**存在**（`prisma/schema.prisma:1171`，是 `Site` 的可选关系）
- 但 `SitePublishedState` 表**0 行**
- `scripts/guard-live-storefront-ssr.mjs` 明确断言：

```js
assert.doesNotMatch(publicRuntime, /prisma\.(sitePublishedState|themePublication|activeThemePublication|themePublishApproval)/,
  "public runtime must not query retired snapshot tables");
```

→ **它是"退役快照表"**，被闸门禁止在公开运行时查询。真实的派生缓存是 `src/lib/storefront-context/snapshot.ts` 的内存投影（`createPublishedSiteSnapshot`）。

**补充：`SiteContentRevision` 已合入，生产未启用。**

并行产出已在 `918ab3a19` 落地 `SiteContentRevision`（`prisma/migrations/20261021150000_add_site_content_revision`）——由数据库触发器维护的**每站单调内容修订号**，只作公开 SSR 的**缓存探针**，明确"不是内容源、不是发布记录、不是回滚源"。

| 项 | 状态 |
|---|---|
| 代码 | 已合入 `918ab3a19` |
| 迁移 | 本地库已应用（表存在） |
| 生产 | **未启用**（生产 `deployed_commit=360efb26c`，早于该提交） |
| 默认行为 | `STOREFRONT_SNAPSHOT_CACHE_SITES` 未设置 → 缓存关闭，其余店铺读路径不变 |

方向与契约一致（时间驱动 → 内容变更驱动），并在启用后缓解 R1 的**症状**（单请求内存压力下降），但**不触及 R1 的根因**（每请求全站投影重建 + 入口无并发上限 + `connection_limit=3`）。

⚠️ 该实现带出两个**尚无人守的缺口**，详见 `docs/plans/aidreamcapes-remediation-consolidation-2026-10-21.md` §3 的 F1 / F2：
- F1：现有 SSR 闸门按**变量名**匹配 TTL 断言，新缓存改名 `STOREFRONT_SNAPSHOT_CACHE_TTL_MS` 即放行，300 s 跨请求 TTL 实际存在；
- F2：触发器守卫硬编码 `site_aidreamcapes`，而 flag 接受任意站（含 `*`）→ 若为他站开启，修订号恒为 `"0"`，内容最多陈旧 5 分钟。

**评估**：闸门把"不许读旧表"写进了代码，这是好的；但**契约文档没跟上**，新人按 AGENTS.md 会去找一个已被明令禁用的机制。建议同步修订文档。

---

## 4. 渲染与交付方式

### 4.1 纯 SSR + 中间件 HTML 改写

公开页 100% 服务端渲染，且**浏览器不发数据请求**——由 `guard-live-storefront-ssr.mjs` / `guard-public-storefront-ssr.mjs` 强制。

但 **SEO 与国际化是在中间件里对 HTML 字符串做后处理**（`src/middleware.ts`，1151 行）：

| 中间件职责 | 说明 |
|---|---|
| 约 30 条重定向规则 | canonical host、legacy 域名、trailing slash、EU www、Spanish XBY、旧 slug 前缀（`-photo-package-guide` / `-tool-guide` / `-video-theme-guide`）等 |
| head SEO 重排 | `moveSeoTagsBeforeResources()`：把 title/meta/canonical/JSON-LD 提到资源标签之前 |
| JSON-LD 归一化 | `stripBodyMarkerJsonLd()` + `dedupeJsonLdSeoTags()`：把 body 标记搬进 head 并去重 |
| 本地化注入 | `withStorefrontLocale()`：**正则替换 `<html lang>` 并插入 `<meta http-equiv="Content-Language">`** |
| 缓存头 | `storefrontHtmlCacheControl()` |
| favicon | `withStorefrontIcons()` |

**评价**：
- ✅ head 重排/JSON-LD 归一化确有实效（JSON-LD 提前确实利于抓取），且用闸门锁住不漂移
- ⚠️ **用字符串正则改 HTML 是脆弱层**。本轮修的 hydration 报错，本质就是 `type="application/ld+json"` 被 React 提升到 head、而客户端渲染在 body，middleware 的 `preserveBodyMarker` 机制正是为此打的补丁——**症状在 React，根子在"渲染后又改 HTML"这个模式**
- ⚠️ `withStorefrontLocale` 对 `<html lang>` 做正则替换，一旦属性顺序或引号形式变化即失效，且无测试覆盖的失败是静默的

### 4.2 素材三套路径并存

| 路径 | 承载 | 问题 |
|---|---|---|
| `/assets/sites/<siteId>/public-media/...` | nginx `alias` 到共享目录 + 1 年 immutable 缓存 | 需部署脚本同步物理文件 |
| `/media/...` | release 的 `public/` 目录 | 与 DB 里的 `previewUrl`/`originUrl` 强耦合，缺文件即 404 |
| `/ai-image-generation/*.webp` | **应用路由**（由 DB 记录驱动） | 静态图走应用，绕过 CDN 与 nginx 静态缓存 |

第三套是明显的架构债：一张图走一次 Node 进程渲染，是 AIVideosUGC 慢的一个来源。

### 4.3 响应性能（生产实测）

> ⚠️ **口径修正**：下表是**崩溃前高压窗口**的读数，**不是站点基线**。
> 串行基线应引用 `docs/plans/aidreamcapes-production-ssr-memory-stability-2026-10-21.md` §1.4：
> `/` ≈ 3.5 s，`/ai-video-generation`、`/ai-actors`、演员分面页 1.5–2.2 s，4 并发新增详情页 0.37–0.55 s。
> 下表数值说明的是"退化到崩溃的过程"，不能用来判断正常性能。

| 指标（降级窗口） | AIVideosUGC | MyDreamShoots（同期） |
|---|---|---|
| p50 TTFB | **7.0 s** | 1.9 s |
| p90 TTFB | **14.3 s** | 2.8 s |
| p95 TTFB | 21.1 s | 3.5 s |
| max TTFB | 40.3 s | 4.6 s |
| 页面成功率 | 151/177（26 次 502 落在崩溃窗口） | 117/117 |
| 常态 RSS | 3.6–3.8 GB / V8 上限 4144 MB | 3.26 GB |
| 30 天 OOM | 见内存计划 §1.1 时间线（本 release 前已有 4 次） | 0 次 |

**根因**（以内存计划 §0 的四条因果链为准）：

1. **入口无并发上限**：Nginx `location /` 直接反代，无 `limit_conn`/`limit_req`；
2. **每请求重建全站投影**：公开页读取在 `RepeatableRead` 事务内加载站点公开数据并调用 `createPublishedSiteSnapshot`，主加载器 `siteReadCache.get(..., 0)` 等价于不缓存；
3. **连接池小于应用闸门**：`connection_limit=3`，而事务闸门默认 6 → 排队 5 s 后 `P2028`，请求继续占内存等待；
4. **无内存护栏**：Node 默认堆 4144 MB（未设 `NODE_OPTIONS`），基线 RSS 已约 1.3 GB，无 cgroup 上限。

> 注：单纯下调 `--max-old-space-size` **不会**改善此问题——它只会让 OOM 更早发生。正确杠杆是限流 + 缓存 + 护栏。

---

## 5. 发布与工程治理

### 5.1 发布形态

```
/www/wwwroot/<store>/releases/<commit>-<tag>/     ← 每次发版一个不可变目录
/etc/systemd/system/<store>.service.d/release.conf  ← drop-in 指向当前 release
```

`scripts/deploy-aidreamcapes-release.mjs` 负责：构建 → 上传 → 写 drop-in → `daemon-reload` → `restart` → 校验 `WorkingDirectory` 与其他服务未被波及；**带失败回滚分支**（恢复 `.previous-release.conf`）。

**评价**：不可变 release 目录 + drop-in 指针 + 自动回滚 + 跨服务不变性校验，这是相当成熟的发布形态。

**但观察到**：2026-10-21 01:13 / 01:18 / 01:30 连续三次发版回滚，回滚后 drop-in 仍指向旧 release（`d198de292`），新 release 建好未接管；后续发版成功并上线 `360efb26c`。

**准确的问题是"失败原因未持久化"，不是"静默回滚"**：`rollback()` 保留退出码、失败命令的 stderr 会输出到终端、成功路径有 `trap - EXIT` 正常解除；但触发回滚的具体命令与原因**没有落盘**，事后无法回答"为什么回滚"。这是可观测性缺口，不是逻辑错误。

**该缺口仍然存在**：发布脚本的 `rollback()` 不写任何失败记录文件，`releases/` 下也不留失败标记。

**评价**（补充）：`server.mjs` 把整页 HTML 缓冲到 `chunks` → `Buffer.concat` → `toString` → 多轮正则重排 `<head>` → 重新编码发送，并把上游 `accept-encoding` 固定为 `identity`。这不是 OOM 主因，但会放大瞬时分配与带宽，且让"传输层改写 HTML"成为第二个脆弱点（与 §4.1 的 middleware 改写叠加）。

### 5.2 闸门体系（强项）

`scripts/guard-*.mjs` 共 **13** 个，覆盖：

- `guard-live-storefront-ssr` / `guard-public-storefront-ssr` — 公开页必须纯 SSR、禁客户端取数、禁读退役快照表、禁跨请求内容 TTL
- `guard-postgres-single-source` — PostgreSQL 单一事实源
- `guard-remote-readonly-database-role` — 远程库只读角色
- `guard-mydreamshoots-*`（copy/page-independence/publication-immutability/tdk-uniqueness/theme-copy-parity）— MyDreamShoots 内容契约
- `guard-aidreamcapes-eu-homepage-integrity`

**评价**：把"不许做什么"写成可执行断言，比写在文档里强一个量级。这是本项目最值得保留的工程实践。

### 5.3 文档—实现漂移

| 文档表述 | 实现实际 |
|---|---|
| AGENTS.md：编译器可刷新 `SitePublishedState` 作派生缓存 | 该表 0 行，且被闸门列为"退役快照表"禁读 |
| AGENTS.md：public SSR 只读 `LivePage.contentJson` | ✅ 一致（经 site-store 投影） |
| AGENTS.md：禁止全站生成 Aidreamcapes 内容 | ✅ 部署脚本已禁用写模式（`deploy-aidreamcapes-release.mjs` 走代码发布） |

---

## 6. 结构性风险（按严重度）

| # | 风险 | 证据 | 影响 |
|---|---|---|---|
| **R1** | **可用性无护栏，常态 OOM** | 每请求重建全站投影 + 入口无限流 + 池小于闸门 + 无 cgroup 上限（内存计划 §0） | 线上可用性，且**阻断一切内容整改的验收** |
| **R2** | **共享层店铺分支密度 9–18%** | middleware 17.5%、theme-renderer 16.1%、json-ld 14.8%、photo-package-taxonomy 15.8% | 改一个店铺的行为有隐性影响他店的风险；AGENTS.md 因此要求"改共享层需授权" |
| **R3** | **两套渲染栈并存** | theme-renderer 21k 行 vs aidreamcapes-v2 39 文件 | "全站一致性"类需求要改两遍；本轮页脚/面包屑修复即只存在于 v2 栈 |
| **R4** | **HTML 字符串后处理层** | middleware 1151 行做正则改 HTML | 脆弱、静默失败；与 React 19 的提升行为冲突（已实际发生） |
| **R5** | **内容模型缺维度** | 无行业/平台/场合表；分类只有两级树 | 无法计算化运营，facet 页只能人工策展路径 |
| **R6** | **命名空间三层混叠** | 工具页 slug 是详情页前缀；案例页 slug 内重复工具 slug（987 条） | URL 观感重复、层级不可推断 |
| **R7** | **静态图走应用路由** | `/ai-image-generation/*.webp` | 绕过 CDN/nginx 静态缓存，拖慢首屏 |
| **R8** | **发布失败原因未持久化** | `rollback()` 不写失败记录，三次回滚后无法追溯原因 | 排障困难 |
| **R9** | **文档漂移** | `SitePublishedState` 表述已过时 | 新人/新会话按文档走错路 |
| **R10** | **应用层承载店铺过多** | 7 店铺 / 707 页 / 1 个 Next 应用 | 单点故障：任一发布影响全部店铺（已有跨服务不变性校验作缓解） |
| **R11** | **新缓存无闸门 + 跨店陈旧陷阱** | 闸门按变量名匹配 TTL；触发器守卫硬编码单站而 flag 接受任意站（详见合并文档 F1/F2） | 若为他站开启缓存，内容最多陈旧 5 分钟，违反 AGENTS.md |

---

## 7. 建议（分阶段，与既有计划对齐）

### 立即（本周）
1. **R1 止血 → 见 `docs/plans/aidreamcapes-production-ssr-memory-stability-2026-10-21.md`**。该文档的因果链与参数取值**优先于本文**：Nginx 并发 4 / 6r·s、`connection_limit` 3→**6**、应用闸门 6→**3**、`MemoryLimit=6G`（systemd 219 只支持此指令）。
   ⚠️ 本文早期版本建议的 `--max-old-space-size=3072` **已撤销**——下调堆上限只会让 OOM 更早发生。
2. **R9**：修订 `AGENTS.md` 中 `SitePublishedState` 的表述，改为"退役派生缓存，公开运行时由 `guard-live-storefront-ssr` 禁止读取"。
3. **R11**：修 F1（闸门改为意图断言）+ F2（flag 只接受已建触发器的站点），**必须在 P1 缓存生产启用前完成**。

### 短期（本月）
4. **R8**：部署脚本 `rollback()` 把触发命令与退出码写入 `release.failed.txt`（或 journald），使失败可追溯。
5. **R4**：把 `withStorefrontLocale` 从正则改 HTML 改为在 React 树里设 `lang`（`AidreamcapesV2Shell` 已有 `lang` 属性位），消除一层字符串后处理。
6. **R7**：把 `/ai-image-generation/*.webp` 迁到 nginx `alias` 或 `/assets/sites/...` 路径。

### 中期（本季）
7. **R5 + R6**（内容侧）：引入 `TemplateFacet` 维度表，打破 slug 前缀包含、消除 slug 内重复、旧 URL 301。详见 `docs/plans/aidreamcapes-template-directory-data-chain-audit-2026-10-21.md` §6。
8. **R3**：明确 v2 栈为 AIVideosUGC 终局形态、旧主题引擎只服务其余店铺；把"全站一致性"要求收敛为"v2 栈内一致 + 旧栈不动"。
9. **R2**：把共享层的店铺分支收敛成**注册表**（site id → handler），让新增店铺不再改共享文件。

### 不建议现在做
- 全站内容重生成（AGENTS.md 明令禁止，且 R1 未修前无法验收）
- 拆分多应用（当前规模下成本远超收益；先按 R2/R3 降低共享层耦合）
- 引入独立 CMS（治理闸门已经承担了它的大部分职责）

---

## 8. 需要你决策

> 合并后只剩 3 个真正需要拍板的事项，其余属工程卫生。
> 完整执行序列见 `docs/plans/aidreamcapes-remediation-consolidation-2026-10-21.md` §4–§5。

1. **是否批准可用性 P0？**（Nginx 并发 4 / 6r·s、pool 3→6 + 闸门 6→3、`MemoryLimit=6G`）
   不批则所有内容整改的线上验收都不可靠。
2. **R5/R6 走「引入维度表」还是「保持策展 + 换素材」？**（与模板链路评估文档 §8 第 1 问是同一个决策）
3. **v2 栈是否定为 AIVideosUGC 终局？** 若是，可启动 R3 的收敛工作；若否，需先定义两栈共存规范。
