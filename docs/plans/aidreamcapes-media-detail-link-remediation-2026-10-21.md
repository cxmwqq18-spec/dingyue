# AIVideosUGC 媒体资源「先到自己的详情页」链接整改计划（定稿 v1.0）

> 状态：代码整理与发布验收中；生产关系数据不在本次代码发布中写入
> 站点范围：仅 `site_aidreamcapes`（`www.aivideosugc.com` / `www.aidreamcapes.com`）
> 依据：本地关系库 + HTTP 读回（2026-10-21）；生产需在实施前做一次同口径只读读回
> 与既有文档的关系：本文**取代** `docs/handoffs/aivideosugc-workspace-entry-audit-20261021.md`
> 中「卡片一律直达固定工作台」的验收口径。

---

## 0. 本版已锁定的决策

| # | 决策 | 结论 |
|---|---|---|
| 1 | 演员详情 URL 形态 | **扁平 `/ai-actors/<name>`**（如 `/ai-actors/adrian`），原 `/ai-actors/{men\|women}/<name>` 一律 301 到扁平地址 |
| 2 | `/ai-image-generation/virtual-try-on` 归属 | 归 **v2 模板详情页**；旧 collection 页 301 到 `/collections/virtual-try-on` |
| 3 | 派生案例页（C 类）收录 | P0/P1 一律 `noindex, follow`，不进 sitemap；文案补齐后逐条切 `index`（P2） |
| 4 | 同媒体多 slug | **现在就 canonical 收口 + 301**，正常点击不产生跳转 |
| 5 | 卡片 prompt 是否公开 | 不作为公开文案；公开说明只取已有面向用户的 `line` 字段，生成提示词仅用于私有工作台 |

---

## 1. 你的要求与当前实现的差异

你要的：**点图片 / 视频 / 演员 → 先到它自己的详情页**，再由详情页决定是否进工作台。

现在做的：**点卡片 → 直接进工作台**（`/app/create/ai-video-generation`、
`/app/create/ai-image-generation`、`/app/create/ai-actors`）；而且公开 slug 路径上
工作台还会顶掉详情页。

差异不是「href 写错」，而是**详情页这一层没有真正存在**：

| 期望的 URL | 现在实际返回 | 证据 |
|---|---|---|
| `/ai-video-generation/streamer-reaction-app-...` | 工作台整页（`<title>Workspace \| AIVideosUGC</title>`，`noindex, nofollow`） | 本地读回 177 KB 工作台 shell |
| `/ai-image-generation/colorway-variations` | **404** | 9 个已发布 photo 模板页中 8 个 404 |
| `/ai-image-generation/<图片案例名>` | 工作台整页 | 与 video 同一条 scene-preset 分支 |
| `/ai-actors/men/adrian` | 演员详情页（200，`index`） | 53/53 演员页已存在，只是卡片没有指过去 |
| `/ai-actors/adrian` | **404**（无此路由） | 本次新增扁平地址 |

---

## 2. 现状审计（`site_aidreamcapes`，2026-10-21）

### 2.1 数据规模

| 指标 | 数值 |
|---|---|
| LivePage 总数 | 268（content 134 / ai_tool 74 / policy 19 / 其它 41） |
| 带 `publicSlug` 的 picker 卡片 | video 176（5 页）/ photo 48（5 页） |
| 带 `publicSlug` 的 `workspaceCases` | video 703（19 页）/ photo 12（3 页） |
| distinct `publicSlug` | **video 879 / photo 60**（跨页 0 冲突） |
| distinct 媒体文件 | **video 177 / photo 60**（37 张图对应多个 slug，单图最多 **21 个**） |
| 模板 owner 页（`templateDefinition`） | 18（9 photo + 9 video） |
| 演员 | 53 人，53 个唯一姓名，53 个详情页（`/ai-actors/{men\|women}/<name>`） |
| sitemap 条数 | 177（其中 `/ai-image-generation/*` 14 条，**13 条 404**；演员详情 53 条为嵌套路径） |

### 2.2 五处必须修的确定性缺陷

1. **公开 slug 被工作台顶掉**
   `src/app/[...path]/page.tsx:674-681`：两段路径命中 `resolveWorkspacePublicScenePreset` 即
   `renderAidreamcapesResolvedScenePage()` 渲染工作台；同文件 462-473 强制 `noindex`。
2. **photo 命名空间失效**
   `src/lib/photo-package-taxonomy.ts:255-276`：Aidreamcapes 的 `/ai-image-generation/<slug>`
   **无条件**被解析为 collection item → 9 个模板页 8 个 404、5 个图片工具页全 404。
3. **sitemap 提交死链**
   `/site/aidreamcapes/sitemap.xml` 中 13 条 `/ai-image-generation/*` 返回 404。
4. **卡片入口全部固定工作台**
   `/ai-video-generation/video-ads` 37 张卡 → 全部 `/app/create/ai-video-generation`；
   演员卡 54 张 → 全部 `/app/create/ai-actors`；`/templates*` 的「View template」→
   `?source=&preset=` 工作台链接。
5. **演员详情只有一层嵌套地址**
   数据行 slug 为 `/ai-actors/{men|women}/<name>`，`seo.canonicalPath` 与 JSON-LD 面包屑
   也都写死嵌套路径；需要扁平化的路由 + 渲染层覆写 + 301 + sitemap 替换。

### 2.3 `/ai-video-generation/*`「看起来像详情页」的到底是哪些页

该命名空间有 51 条 `LivePage`，但**不是 51 个可用详情页**：

| 状态 | 数量 | 说明 |
|---|---|---|
| `200` 真页面 | **17** | 9 个模板页（`beauty-routine`…）+ 8 个工具/能力页（`video-ads`、`text-to-video`、`image-to-video`、`spokesperson-videos`…），`index, follow` |
| `404` | 23 | 残留 `ai_tool` 行（`app-saas-demo`、`duet-reaction`、`hook-lab`…），站内无 href 引用、不在 sitemap → 孤儿行 |
| `308` | 11 | 节日/活动页重定向到 `/ai-save-the-date/<slug>`（`christmas`、`halloween`、`proposal`…） |

关键判定：这 17 个真页的 basename 与 879 个卡片 `publicSlug` **重叠数 = 0**（photo 侧同为 0）。
也就是说「看起来有详情页」的是**工具页/模板页**，不是**每条媒体资源**的详情页。

对照读回：

| 请求 | 结果 |
|---|---|
| `/ai-video-generation/beauty-routine` | `200`，`<title>Beauty Video Templates for Your Ads…`，`index, follow` ← 真详情页（模板） |
| `/ai-video-generation/video-ads` | `200`，`<title>AI Video Ads Generator…` ← 真页面（工具） |
| `/ai-video-generation/streamer-reaction-app-…`（卡片 slug） | `200` 但 `<title>Workspace \| AIVideosUGC`、`noindex, nofollow`、h1 为「AI Video」← **工作台** |

`/ai-image-generation/*` 侧则是**声明了却没落地**：`/templates/photo` 的
`templateDirectory.paths` 明确列出 9 条 `/ai-image-generation/<slug>`，实际 8 条 404
（仅 `virtual-try-on` 200，且渲染的是旧 collection 页）。

**站内现存死链 href（5 条，P0 一并清理）**：
`/ai-image-generation/commercial-lighting`、`/ai-image-generation/fashion-editorial`、
`/ai-image-generation/macro-details`、`/ai-image-generation/motion-generator`、
`/ai-video-generation/ai-actors`（错误嵌套）。

---

## 3. 目标链接契约

```
公开页面（首页 / 目录 / 模板 / 演员 / 灵感库）
   │  卡片整体点击
   ▼
媒体详情页（SSR，非工作台）
   ├─ /ai-video-generation/<slug>
   ├─ /ai-image-generation/<slug>
   └─ /ai-actors/<name>            ← 扁平
   │  页面内唯一「Use this template / Make my video」CTA
   ▼
工作台 /app/create/<view>          （沿用 entry cookie 预填）
```

保留直达工作台的入口（不属于媒体资源）：导航「开始使用」、`/app/create/home`、
`/app/create/library`、`/app/create/text-to-video`、详情页唯一 CTA、表单提交。

**判定规则唯一实现点**：`href` 命中媒体卡语义（picker card / case card / template card /
actor card / inspiration card）→ 输出详情页 URL；其它 `href` 原样。不再以
「含不含 `/app/create`」判断。

---

## 4. 详情页设计

### 4.1 四类详情页

| 类型 | 数量 | 数据来源 | 实现 |
|---|---|---|---|
| A. 模板 owner 页 | 18（9 photo + 9 video） | 该 LivePage 的 `templateDefinition` + v2 版式 | 复用 `layout: "template"`（只需修 photo 路由） |
| B. 演员详情页 | 53 | `/ai-actors` 的 `actors[]` + 对应详情行 `data.actor` | 已存在；新增扁平路由，渲染同一行 |
| C1. 派生案例页（video） | canonical ≤ 177 | 该 slug 所属 LivePage 的那张卡 | 新增 SSR 详情路由（只读） |
| C2. 派生案例页（photo） | canonical ≤ 60 | 同上 | 同上 |

C 类页面内容（全部取自现有关系行，不新增文案、不生成整页）：

```
面包屑：首页 → 所属工具/模板 → 本案例
媒体：image（视频案例用 poster + <video>）
标题：card.label
说明：只使用已有公开 card.line；缺失时省略，不转换生成提示词
规格：aspect / duration / 所属工具
相关：同工具其它 canonical 案例 ≤6
主 CTA：Use this template → /app/create（entry 预填本案例）
```

### 4.2 URL 与 canonical

- slug 直接复用卡片现有 `publicSlug`，不新造命名。
- 同一媒体（`kind + image.src`）多 slug 时的 canonical 优先级：
  1. 来自模板 owner 页（`templateDefinition`）的 slug；
  2. 不带页面前后缀的 slug（不以 `-templates`、`-ai-video-generation-<page>`、
     `-ai-image-generation-<page>` 结尾）；
  3. 来自 `/ai-video-generation` / `/ai-image-generation` 枢纽页的 slug；
  4. 最短；同长度取字典序最小。
- 卡片 SSR **直接输出 canonical URL**；非 canonical slug `301` → canonical。
- 规则实现为纯函数 + golden 快照（939 slug → canonical 全量落盘，人工过一遍）。

### 4.3 命名空间优先级

`/ai-image-generation/<slug>`（Aidreamcapes）：

1. v2 模板 owner 页 → 详情页 A；
2. v2 派生案例（canonical）→ 详情页 C；
3. 其它 → `301 /collections/<slug>`（legacy collection item 退到 `/collections`）。

`/ai-video-generation/<slug>`（Aidreamcapes）：

1. v2 内容页（17 条已 200）→ 详情页；
2. v2 派生案例（canonical）→ 详情页 C；
3. 其它 → 404。

`/ai-actors/<segment>`（两段路径）解析顺序：

1. 保留字 `men`、`women`、`scene`、`age-range` → 各自 hub 页（行为不变）；
2. 其余匹配演员姓名（大小写不敏感，53/53 唯一）→ 演员详情页 B；
3. 其它 → 404。

> 已核对：53 个姓名（adrian、akio、amara … yara）与保留字无冲突，且无重名。

### 4.4 演员扁平化的实现方式（不改数据）

- 新增解析器：`resolveActorDetailByName(name)` →
  在 `/ai-actors` 的 `actors[]` 里按姓名取 `actor.id`，再定位 `data.actor.id` 相同的
  详情行（当前 53 行，一次查询即可），返回 `{ row, actor }`。
- 渲染：`renderStorefrontPage({ slug: 详情行.slug, publicPath: "/ai-actors/<name>" })`，
  由 `publicPath` 驱动 canonical 与站内基础路径（已有能力，`storefront-render.tsx:3166-3182`）。
- canonical / OG / JSON-LD URL 覆写：复用
  `src/lib/theme/json-ld.ts:1746-1749` 的 origin 归一化模式，增加
  「`/ai-actors/{men|women}/<name>` → `/ai-actors/<name>`」的渲染期归一化；
  面包屑 JSON-LD 去掉中间层（首页 → AI Actors → 姓名）。
- 旧地址：`/ai-actors/{men|women}/<name>` → `301 /ai-actors/<name>`（53 条，动态规则即可）。
- hub 页 `/ai-actors/men`、`/ai-actors/women`、`/ai-actors/scene`、`/ai-actors/age-range`
  **保持 200**，不重定向；其内部卡片改指扁平地址。
- **存储层不动**：`LivePage` slug 与 `seo.canonicalPath` 仍是嵌套路径（P2 如需对齐，
  走字段级 manifest，compare-and-set，线上编辑优先）。

---

## 5. SEO / 索引策略

| 页面 | robots | sitemap | canonical | JSON-LD |
|---|---|---|---|---|
| A 模板详情（18） | `index, follow` | 纳入（修 404 后 photo 9 条） | 自身 | 保留现有 |
| B 演员详情（53） | `index, follow` | 纳入，**URL 由嵌套换为扁平（53 换 53）** | `/ai-actors/<name>` | BreadcrumbList 去中间层 |
| C 派生案例 | `noindex, follow`（P0/P1） | 不纳入 | 自身 canonical | 仅 `BreadcrumbList` + `ImageObject`/`VideoObject` |
| 非 canonical slug | `noindex` | — | `301` → canonical | — |
| 旧嵌套演员 URL | `noindex` | — | `301` → 扁平 | — |

收索引前门禁：标题在 canonical 集合内唯一、description 非空不重复、正文词数达阈值、
媒体 200。

---

## 6. 工作台预填链路（不得退化）

- 卡片：不再写 `data-workspace-entry`，href 指向详情页。
- 详情页 CTA：`WorkspaceEntryLink` + `entry`，`sourcePage` = **该 slug 所属关系页**，
  `presetId` = 该卡片的 `pickerPresetId(card)`；点击时 `entry-behavior.tsx` 仍写
  `adc_workspace_entry_<view>`（`Path=/app/create`，120s），工作台服务端仍按
  **当前 LivePage 行** 解析，`sourceUpdatedAt` compare-and-set 不变。
- 演员详情 CTA：沿用 `actorWorkspaceEntry(actor)`（`view: actors`，`query.actor`）。
- `/app/create/scene/<token>` 保留（兼容），不再从公开卡片产出。

验收链：点卡片 → 详情页（无 cookie 写入）→ 点 CTA → 工作台 composer 预填该案例。

---

## 7. 代码改动清单

### 7.1 链接产出（改为详情页）

| 文件 | 位置 | 改动 |
|---|---|---|
| `src/lib/aidreamcapes-workspace/preset-contract.ts` | 105-125 | `pickerPresetHref` → 详情页 URL；新增 `workspaceCtaHref(card, sourcePage)` 供 CTA |
| `src/components/storefront/aidreamcapes-v2/visual.tsx` | 272 | `v-pick-card` 去 `mediaLink`，href 走详情页 |
| `src/components/storefront/aidreamcapes-v2/parts.tsx` | 545-600 | `TemplateCard`/`CaseCard`/`workspaceCardEntry` 改为详情页 + CTA 分离 |
| `src/components/storefront/aidreamcapes-v2/template-directory.tsx` | 29-32、42-47 | 目录卡 → owner 详情页 |
| `src/components/storefront/aidreamcapes-v2/page.tsx` | 716、787、882、927 | 演员卡 → `/ai-actors/<name>` |
| `src/lib/aidreamcapes-inspirations-types.ts` | 29-63 | 灵感卡 → 详情页；「Use」按钮保留交接 |
| `src/components/storefront/aidreamcapes-v2/directory-landings.tsx` | 136 | related 卡 → 详情页 |
| `src/components/storefront/aidreamcapes-v2/home-brand-tools.tsx` | 24、69、81 | 确认为 CTA，保持工作台 |

### 7.2 路由与渲染（新增详情层 + 演员扁平）

| 文件 | 改动 |
|---|---|
| 新增 `src/lib/aidreamcapes-workspace/media-detail.server.ts` | `resolveMediaDetail(kind, slug)`、`canonicalSlugIndex()`、`listRelatedCases()`、`resolveActorDetailByName(name)`；只读 `LivePage`；派生缓存 key = `max(updatedAt)+count`，TTL ≤ 60s，**不得作为事实源** |
| 新增 `src/components/storefront/aidreamcapes-v2/media-detail.tsx` | C 类详情 SSR 版式（无 `use client`、无客户端取数） |
| `src/app/[...path]/page.tsx` | 462-473 metadata、665-681 分支：改为「内容页 → 派生详情 → 301 别名」；新增 `/ai-actors/<name>` 解析与 `publicPath` 渲染 |
| `src/app/site/[siteSlug]/[...path]/page.tsx` | 同步同样分支（path-mode 一致） |
| `src/lib/aidreamcapes-guest-workspace.tsx` | 35-77：公开 slug 不再返回工作台 |
| `src/lib/photo-package-taxonomy.ts` | Aidreamcapes `/ai-image-generation/<slug>` 不再无条件当 collection item |
| `src/lib/theme/json-ld.ts` | 1746-1749 附近：增加演员嵌套 → 扁平 URL 归一化 |
| `src/lib/aidreamcapes-site-v2-redirects.json` | 非 canonical slug 与旧嵌套演员 URL 的 301 别名（运行时规则可，稳健则落表） |

### 7.3 数据层

- **P0：零写入。** 详情页全部由现有 `LivePage.contentJson` 派生渲染；不新增页面行、
  不写 `SitePublishedState`、不导入快照、不做整站生成。
- **P2（需批准）：** 字段级 manifest 补 `detailSlug`（939 张卡）与
  `seo.canonicalPath` 扁平化（53 行），全部 `baseHash` compare-and-set，线上已改则 conflict 跳过。

---

## 8. 回归门禁改造

现有脚本断言方向必须反转，否则改造后必红：

| 脚本 | 现状 | 改为 |
|---|---|---|
| `scripts/aidreamcapes-workspace/audit-card-entry-links.mjs` | 卡片必须 `/app/create/...` | 媒体卡必须 `^/(ai-image-generation|ai-video-generation|ai-actors)/`，无 query |
| `scripts/aidreamcapes-workspace/audit-workspace-entry-transfer.mjs` | 卡片 cookie → 预填 | 详情页 CTA cookie → 预填 |
| `scripts/aidreamcapes-workspace/smoke-card-entry-browser.mjs` | 点卡落工作台 | 点卡落详情页；点 CTA 落工作台并预填 |
| `scripts/aidreamcapes-workspace/smoke-template-links.mjs` | `pickerPresetHref` → `/app/create` | → 详情页；新增 `workspaceCtaHref` 单测 |
| `scripts/aidreamcapes-workspace/smoke-template-presets.mjs` | 146-152 同上 | 同上 |
| `scripts/smoke-storefront-public-routes.mjs` / `smoke-aidreamcapes-seo-contract.mjs` | 路由集合 | 纳入 `/ai-image-generation/*`、`/ai-actors/<name>`、派生详情 |

新增门禁：

1. `audit-media-detail-routes.mjs` — 全量 canonical（video ≤177 + photo ≤60）+ 18 模板页 +
   53 扁平演员页逐个 HTTP：断言 200、`<title>` 不含 `Workspace`、robots 符合 §5、
   页面出现自身 label/媒体、`/app/create` 链接仅 CTA（+导航白名单）。
2. `audit-media-canonical-map.mjs` — golden 比对 939 slug → canonical 映射。
3. `audit-actor-flat-routes.mjs` — 53 扁平页 200；53 条嵌套 301 且 `Location` 正确；
   保留字 hub 页 200；sitemap 中演员 URL 100% 扁平且 200。
4. `smoke-aidreamcapes-media-detail-nojs.mjs` — 关闭 JS 后正文完整（SSR-only）。
5. `audit-media-namespace.mjs` — `/ai-video-generation/*` 与 `/ai-image-generation/*` 全量
   关系行状态盘点：只允许 `200`（真页/详情页）、`301/308`（显式重定向表）、`404`（孤儿行白名单）；
   并断言站内 `href` 死链数为 0（现为 5 条，见 §2.3）。
6. sitemap diff 门禁 — 只允许：13 条 photo 死链修复 + 53 条演员 URL 嵌套→扁平。

---

## 9. 分阶段实施与验收

### P0（代码 release，一个提交批次）

1. 派生详情路由 + canonical 解析 + 详情 SSR 版式；
2. `/ai-image-generation/<slug>` 命名空间修复（v2 优先，collection 退 `/collections`）；
3. `/ai-actors/<name>` 扁平路由 + 53 条 301 + 渲染期 canonical/JSON-LD 覆写；
4. 全量媒体卡改指详情页；演员卡改指扁平演员页；
5. metadata / robots / canonical 按 §5；
6. 清理 §2.3 的 5 条站内死链 href；23 条孤儿 404 行与 11 条 308 行只做登记，内容不动（P1 处理）；
7. 同步 6 个既有 smoke + 新增 6 个门禁；
8. 生产只读读回验证。

**P0 验收（必须全绿）**

- 7 个主页面 + 34 个演员分类页：媒体卡 href 100% 为详情页 URL；
- 所有详情页 200，`<title>` 不是 `Workspace | AIVideosUGC`；
- `/ai-actors/<name>` 53/53 为 200 且 canonical 为扁平；旧嵌套 53/53 为 301；
- 详情页唯一 CTA 进入工作台并预填该案例（浏览器 smoke）；
- `/site/<slug>/...` 与 host 模式输出一致；
- sitemap 变化仅限批准的 66 条（13 修死链 + 53 换形），无新增 C 类 URL；
- `git diff --name-only` 全在 Aidreamcapes 范围；MyDreamShoots 路由/内容 diff = 0；
- 无 `LivePage` / `SitePublishedState` 写入、无快照导入。

### P1（代码）

- photo 9 个模板页文案确认后纳入 sitemap；
- 详情页「相关案例」内链（≤6，全部 canonical）；
- 派生索引性能：单次详情请求 ≤2 条 SQL，命中率与 P95 记录；
- 旧 `/ai-actors/{men|women}/<name>` 的外部引用清理（站内 relatedLinks 归一化）。

### P2（内容，字段级 manifest，另行批准）

- 为高价值案例补真实文案，逐条切 `index`；
- 写 `detailSlug`；对齐 53 行 `seo.canonicalPath` 与面包屑数据；
- 禁止整站重生成；线上编辑优先。

---

## 10. 风险与回滚

| 风险 | 处置 |
|---|---|
| 879 → ≤237 收口判断错误，卡片跳到别人的详情页 | canonical golden 快照 + 纯函数单测 + 人工抽检 30 条 |
| photo 命名空间调整影响 `virtual-try-on` | 该页本身就是模板 owner，301 旧 collection 到 `/collections/virtual-try-on`；单独 smoke |
| 演员扁平化与保留字冲突 | 已核对 53 姓名无冲突；解析顺序固定「保留字 > 姓名 > 404」，单测覆盖 |
| 演员 canonical 变更影响已有排名 | 53 换 53，301 永久跳转 + sitemap 同批更新 + 站内链接同批改；不保留双地址 |
| 6 个旧断言脚本红绿并存 | 同一提交内反转断言，脚本名不变，避免流水线漏跑 |
| 详情页 JSONB 扫描成本 | 派生索引带 `updatedAt` 版本键 + 60s TTL；必要时加 GIN 索引（additive migration） |
| 卡片文案越界成内部信息 | 只用卡片已有公开字段，prompt 截断展示；不新增营销语 |
| 回滚 | **代码回滚即可**；无数据写入，不产生内容回滚需求；严禁用快照/旧 publication 回滚 |

---

## 11. 边界（本次不做）

- 不生成整站、不改现有 268 个 LivePage、不写 `SitePublishedState`；
- 不恢复/导入历史 publication 或 snapshot；
- 不触碰 `site_dreamshoot` / `site_mydreamshoots_xby` / `site_aidreamcapes_xby`；
- 不改工作台内部模块、生成链路、计费；
- 公开页面不引入客户端取数（`use client` 仅限纯表现层）。

---

## 12. 验证命令

```sh
# 媒体卡链接分布（应 0 条直达 /app/create）
curl -s http://127.0.0.1:3003/site/aivideosugc/ai-video-generation/video-ads \
  | grep -o 'class="v-pick-card"[^>]*href="[^"]*"' | sort | uniq -c

# 详情页不是工作台
curl -s http://127.0.0.1:3003/site/aivideosugc/ai-video-generation/<canonicalSlug> \
  | grep -o '<title>[^<]*</title>'

# photo 详情页不再 404
for s in colorway-variations professional-headshot white-background-photos; do
  curl -s -o /dev/null -w "%{http_code} $s\n" \
    "http://127.0.0.1:3003/site/aivideosugc/ai-image-generation/$s"
done

# 演员扁平地址与旧地址
for n in adrian ari lola yara; do
  curl -s -o /dev/null -w "flat %{http_code} $n\n" \
    "http://127.0.0.1:3003/site/aivideosugc/ai-actors/$n"
done
curl -s -o /dev/null -D - "http://127.0.0.1:3003/site/aivideosugc/ai-actors/men/adrian" \
  | grep -i '^location'

# 保留字 hub 不受影响
for h in men women scene age-range; do
  curl -s -o /dev/null -w "%{http_code} /ai-actors/$h\n" \
    "http://127.0.0.1:3003/site/aivideosugc/ai-actors/$h"
done

# sitemap 死链归零 + 演员 URL 全扁平
curl -s http://127.0.0.1:3003/site/aidreamcapes/sitemap.xml > /tmp/sm.xml
grep -o '<loc>https://www.aivideosugc.com/ai-actors[^<]*' /tmp/sm.xml \
  | sed 's|<loc>https://www.aivideosugc.com||' \
  | while read -r u; do echo "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3003/site/aivideosugc$u") $u"; done
```

```sql
-- 媒体分布（复核 canonical 收口范围）
WITH cards AS (
  SELECT lp.slug AS page, c->>'kind' AS kind, c->>'publicSlug' AS slug,
         c->'image'->>'src' AS img
  FROM "LivePage" lp
  CROSS JOIN LATERAL jsonb_path_query(lp."contentJson",
    '$.sections.*.settings.data.visual.picker.cards[*]') c
  WHERE lp."siteId" = 'site_aidreamcapes'
  UNION ALL
  SELECT lp.slug, c->>'kind', c->>'publicSlug', c->'image'->>'src'
  FROM "LivePage" lp
  CROSS JOIN LATERAL jsonb_path_query(lp."contentJson",
    '$.sections.*.settings.data.workspaceCases[*]') c
  WHERE lp."siteId" = 'site_aidreamcapes'
)
SELECT kind, count(DISTINCT slug) AS slugs, count(DISTINCT img) AS media
FROM cards WHERE slug IS NOT NULL GROUP BY 1;

-- 演员姓名唯一性与保留字冲突
WITH actors AS (
  SELECT lower(c->>'name') AS name, lower(c->>'gender') AS gender
  FROM "LivePage" lp
  CROSS JOIN LATERAL jsonb_path_query(lp."contentJson",
    '$.sections.*.settings.data.actors[*]') c
  WHERE lp."siteId" = 'site_aidreamcapes' AND lp.slug = '/ai-actors'
)
SELECT count(*) AS total, count(DISTINCT name) AS unique_names,
       count(*) FILTER (WHERE name IN ('men','women','scene','age-range')) AS reserved_collisions
FROM actors;
```

---

## 13. 实施记录（2026-10-21）

### 13.1 已落地的代码

| 位置 | 变更 |
|---|---|
| `src/lib/aidreamcapes-workspace/media-detail.ts` | 纯函数：详情地址、卡片 href、演员地址与重定向目标、文案助手 |
| `src/lib/aidreamcapes-workspace/media-detail.server.ts` | 从当前 `LivePage.contentJson` 解析媒体/演员详情页、导航外壳、退役路径跳转、库存盘点 |
| `src/components/storefront/aidreamcapes-v2/media-detail.tsx` | 详情页 UI（外壳 + 主图 + 规格 + 单一 CTA + 相关卡片） |
| `src/app/[...path]/page.tsx`、`src/app/site/[siteSlug]/[...path]/page.tsx` | 路由优先级：媒体详情 → 演员扁平/嵌套 308 → 内容页 → 合集页 |
| `src/app/site/[siteSlug]/ai-image-generation/[themeSlug]/page.tsx` | 图片命名空间优先级：内容页 > 合集项；详情页优先 |
| `src/components/storefront/aidreamcapes-v2/{visual,parts,template-directory,page,types}.tsx` | 卡片改为普通 `<a>` 指向自己的详情页；演员卡与面包屑扁平化 |
| `src/lib/seo-indexing.ts` | 仅对 `site_aidreamcapes` 把 `/ai-actors/{men\|women}/<name>` 映射为 `/ai-actors/<name>` 再写 sitemap |
| `src/lib/theme/json-ld.ts` | AIVideosUGC 的 JSON-LD 内嵌套演员地址归一为扁平地址 |
| `src/lib/aidreamcapes-workspace/presets.server.ts` | 工作台预填可解析四种卡片形态（picker / workspaceCases / examples / templateDefinition） |
| `src/lib/aidreamcapes-inspirations-types.ts` 及两个 inspiration 组件 | 卡片链详情页，CTA 固定进工作台并带 entry 载荷 |

### 13.2 数据变更（字段级 manifest + compare-and-set）

- 清单：`scripts/manifests/aidreamcapes-example-media-slugs-2026-10-21.json`（66 张卡片、23 个页面）
- 计划：`scripts/plan-aidreamcapes-example-media-slugs.mjs`（只读，产出可评审的清单）
- 应用：`scripts/apply-aidreamcapes-example-media-slugs.mjs`（`--target` / `--apply` / `--confirm` / `--base-hash` 逐页 CAS）
- 本地库已应用：picker 18 + examples 30 + templateDefinition 18 = 66 张卡片补齐 `publicSlug`；重复执行 0 写入
- 覆盖校验：四种卡片形态 `publicSlug` 覆盖率 100%（picker 242/242、workspaceCases 715/715、examples 30/30、templateDefinition 18/18）
- **生产已应用**（2026-10-21）：同一流程对生产库执行
  `node scripts/apply-aidreamcapes-example-media-slugs.mjs --target=production --manifest=scripts/manifests/aidreamcapes-example-media-slugs-2026-10-21.production.json --apply --confirm=site_aidreamcapes-example-media-slugs --base-hash=38008e65c2f53b8d42ea8ed701a2e92b8bcd2daed4fecec51d92d5f121372620`
  → 23 个页面、66 张卡片写入，0 冲突；生产回读：picker 242/242、workspaceCases 715/715、examples 30/30、templateDefinition 18/18 均有 `publicSlug`。
  清单内记录 `target`，本地清单无法被用于生产写入。

### 13.3 与原计划的偏差

1. **不做运行时 canonical 去重**：`publicSlug` 重复的媒体组约 19/37，其标题不一致，合并会让可见文案与数据不符；本阶段以 `noindex, follow` + 不入 sitemap 控制重复，canonical 收口留到后续字段级 manifest。
2. **演员旧地址返回 308 而非 301**：Next 的 `permanentRedirect` 固定返回 308，语义同为永久跳转；门禁同时接受 301/308。
3. **示例卡片范围从 48 张扩到 66 张**：模板页渲染的其实是 `data.templateDefinition.card`（`resolveTemplateCardLinks` 会用它覆盖 picker 卡片），因此 18 张模板定义卡片同样需要 `publicSlug`；模板定义卡片与其旁边的 picker 卡片是同一媒体，共用一个详情地址。
4. **`scene` 类示例按视频归族**：示例项 `kind` 为 `clip`/`scene`/`photo`，只有 `photo` 是静态图；渲染与解析层统一为 `clip`/`scene` → video。

### 13.4 已知边界

- 5 个模板页的 `blockOrder` 不含 `picker`，因此不渲染卡片网格（改为步骤 UI）；门禁按「合法跳过」记录，不计失败。
- 派生详情页不进 sitemap，一律 `noindex, follow`。
- 本机无法访问 `https://www.aivideosugc.com`，生产回读与生产 manifest 应用需在可访问生产的机器上执行。

### 13.5 验证命令

```bash
# 汇总门禁（5 个专项审计 + sitemap 形状 + 演员页 + 退役路径）
AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3003 \
  node scripts/aidreamcapes-workspace/verify-media-detail-remediation.mjs

# 专项
node scripts/aidreamcapes-workspace/audit-card-entry-links.mjs
node scripts/aidreamcapes-workspace/audit-media-detail-routes.mjs
node scripts/aidreamcapes-workspace/audit-actor-flat-routes.mjs
node scripts/aidreamcapes-workspace/audit-media-namespace.mjs
node scripts/aidreamcapes-workspace/audit-workspace-entry-transfer.mjs

# 浏览器点击链路（卡片 → 详情页 → 工作台）
AIDREAMCAPES_CARD_BROWSER_ORIGIN=http://127.0.0.1:3003 \
  node scripts/aidreamcapes-workspace/smoke-card-entry-browser.mjs

# 数据面
node scripts/plan-aidreamcapes-example-media-slugs.mjs --target=local
node scripts/apply-aidreamcapes-example-media-slugs.mjs --target=local
```

### 13.6 上线记录（2026-10-21）

| 步骤 | 命令 / 结果 |
|---|---|
| 代码提交 | `47440da29` + `3ce79c1a1`（构建堆可配置）已推送到 `origin/main` |
| 数据上线 | 生产库字段级 manifest 应用完成（23 页 / 66 卡，0 冲突），见 13.2 |
| 代码上线 | `node scripts/deploy-aidreamcapes-release.mjs --commit=3ce79c1a1… --apply --confirm=deploy-aidreamcapes --verify-media-details` |
| 发布前门禁 | 服务器候选实例执行 `smoke-aidreamcapes-release-routes.mjs`、`audit-card-entry-links.mjs`、`verify-media-detail-remediation.mjs`（含 sitemap/演员/退役路径） |
| 隔离核验 | `docs/audits/aidreamcapes-media-detail-store-isolation-2026-10-21.md`：MyDreamShoots 与 Aidreamshoots 页面、链接与 sitemap 零差异，数据库仅 `site_aidreamcapes` 被写入 |
| 构建内存 | 生产构建曾在固定 10 GB 堆上 OOM；构建堆改为可配置（`AIDREAMCAPES_BUILD_HEAP_MB`，默认 12288） |
| 上线结果 | `deployed_commit=360efb26c955451bafdf9ab8022b2c22ffff13dc`，`current=/www/wwwroot/aidreamcapes.com/releases/360efb26c955451bafdf9ab8022b2c22ffff13dc-seo`，`service=aidreamcapes.service`（候选实例与切换后两轮门禁均通过） |
| 生产回读 | 详情页 200 + `noindex, follow` + 自引用 canonical + 唯一工作台 CTA（`media:{kind,slug}`）；`/ai-actors/<name>` 200 + 扁平 canonical；嵌套地址 308 → 扁平；退役路径 301 → 映射目标；视频/图片目录卡链 100/52 条详情链接、0 条直达 `/app/create`；sitemap 177 条、嵌套 actor 0 条、扁平 actor 53 条、派生详情页 0 条 |
| 构建方式 | 发布主机内存不足以完成整包构建（曾 OOM），改为本地 `scripts/build-production.mjs` 产出 `.next-build` 并以 `--prebuilt-build` 上传（构建时对齐生产的 `NEXT_PUBLIC_*`） |
