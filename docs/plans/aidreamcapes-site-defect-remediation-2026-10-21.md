# AIVideosUGC 全站功能缺陷清单与整改计划（2026-10-21）

> 状态：**只读审计完成，未做任何写入**
> 范围：`site_aidreamcapes`（`www.aivideosugc.com` / `www.aidreamcapes.com`）
> 方法：本地关系库全量读 + 代码路径核对。生产 `aivideosugc.com` 当前从审计机不可达
> （TLS Client Hello 被重置，`aidreamcapes.eu` 正常），故本轮**不含线上读回**
> 合规：本文所有整改均为 `site_aidreamcapes` 单站；不触碰 MyDreamShoots 任何数据

---

## 0. 审计规模

| 项 | 数量 |
|---|---|
| `LivePage` 行 | 268 |
| 派生媒体详情路由（卡片 `publicSlug`） | 987（图片 502 / 视频 485） |
| 工具页 | 74 |
| facet 页（行业/平台/场合） | 17 |
| 可索引页面（排除私有） | 259 |
| 生产 sitemap 条目（最近一次实测） | 177 |

---

## 0.5 功能面盘点

| 功能面 | 规模 | 形态 | 本次结论 |
|---|---|---|---|
| 首页 | 1 | v2 专属渲染 | 正常 |
| AI 图片工具 | 25 页 + 目录 | v2 | 链接有 1 条死链（D3） |
| AI 视频工具 | 50 页 + 目录 | v2 | 21 条退役未落地（D1） |
| facet 目录（行业/平台/场合） | 17 | v2 | 正常（内容同质化另见架构评估） |
| 媒体详情 | 987 派生路由 | SSR | 正常（`noindex, follow`） |
| AI Actors | 93 | content/ai_tool | 正常 |
| 模板目录 | 3（`/templates` + photo/video） | v2 | 正常 |
| Blog | 1 索引 + 9 文章 | v2 + article | 4 篇退役未落地（D1） |
| Guides | 6 | content | 正常 |
| Glossary / Inspiration | 各 1 | content | 正常 |
| 政策页 | 8 + 6 别名 | legacy | 3 组全量重复（D6） |
| Pricing | 1 | v2 | 正常 |
| FAQ / Help | 2 | v2 + legacy | 双份并存（D8） |
| Search | 1 | legacy + SSR 查询 | 可索引（D7） |
| Cart / 结账 | 1 | legacy + 客户运行时 | 需运行时验证 |
| Account / Login | 各 1 | legacy + 鉴权 | 路由已保护 |
| Workspace `/app` | 3 | 鉴权 | 需运行时验证 |
| Collections | 1 | legacy | 无入链（D1 关联） |
| Save the Date | 14 | 已退役 | 内容仍在库（D2） |
| sitemap / robots / llms.txt | — | 派生 | 闸门被绕过（D5） |
| Platform API | 10 个 route | 鉴权 | 已核对，均有 guard |

> 说明：`/api/platform/*` 与 `/api/internal/customer-assets` 均已在处理函数内做
> `getCurrentPlatformAdmin` / `requirePlatformMutation` / 内部令牌校验，未发现未鉴权入口。

---

## 1. 缺陷总览

| # | 缺陷 | 严重度 | 规模 | 是否需写入 |
|---|---|---|---|---|
| **D1** | 重定向表声明的退役页仍在线且可索引 | **P0** | 41 / 66 条 | 是 |
| **D2** | 14 页有完整内容但硬 404/410，且无 301 | **P0** | 14 | 是 |
| **D3** | 1 条活页死链（另 2 条位于已死页面） | **P2** | 1(+2) | 是（改链接） |
| **D4** | canonical 指向一个 404 页面 | **P1** | 1 | 是 |
| **D5** | 发版 SEO 闸门主动过滤重定向源，掩盖 D1 | **P1** | 1 处开关 | 否（改脚本） |
| **D6** | 3 组政策页 200 全量重复内容 | **P1** | 6 页 | 是 |
| **D7** | `/search` 可被索引 | **P1** | 1 | 是 |
| **D8** | `/help` 与 `/faq` 双份 FAQ，实现不同 | **P1** | 2 | 是 |
| **D9** | `/marketing` 与 `/tools` 内容近似且均无入链 | **P2** | 2 | 是 |
| **D10** | 42 条内链指向 301 中转而非直接目标 | **P2** | 42 | 是 |
| **D11** | 11 个媒体文件缺失 | **P2** | 11 | 是 |
| **D12** | 10 处图片缺 alt | **P3** | 10 | 是 |
| **D13** | 渲染栈混用（v2 vs legacy sections） | **P3** | 10+ 页 | 是 |
| **D14** | 5 个别名主题定义无页面，但有 301 兜底 | 非缺陷 | 5 | 否 |

---

## 2. 逐项缺陷

### D1 — 41 条"已计划退役"的页面仍在线且可索引（P0）

**现象**

`src/lib/aidreamcapes-site-v2-redirects.json` 有 66 条"旧路径 → 新路径"，其中 **41 条的旧路径仍然存在 `LivePage` 行**。

而 `aidreamcapesMissingPageRedirect()` 的实现是：

```ts
const row = await prisma.livePage.findUnique({ where: { siteId_slug: { ... } } });
return row ? undefined : target;   // 有页面就不重定向
```

→ **这 41 条 301 实际从未生效**。

**证据**

| 检查 | 结果 |
|---|---|
| 冲突条目 | 41 / 66 |
| 其中 `robots.index = true` | **41 / 41** |
| 其中无任何站内入链 | 31 |
| 其中被代码判 404/410 | 0（全部 200） |

典型条目：

```
/ai-video-generation/pas-formula-ads        → /ai-video-generation/video-ads
/ai-video-generation/testimonial-ads        → /ai-video-generation/video-ads
/ai-image-generation/ghost-mannequin        → /ai-image-generation/white-background-photos
/blog/ai-content-disclosure-safe-usage      → /blog/ai-video-review-checklist
/marketing                                  → /templates
/tools                                      → /ai-video-generation
/search                                     → /templates
```

**根因**

退役意图只写进了代码侧的映射表，没有落到数据侧（删行 / 下架 / 设 noindex）。而路由规则是"活页面优先"，两者直接冲突。

**影响**

- 41 个页面与它们自己的重定向目标争夺同一主题，稀释排名
- 31 个页面用户无法通过导航到达，只能靠 sitemap 被发现
- 可索引页面 259 个，而生产 sitemap 仅 177 条，这类"该退未退"页面是差额来源之一
- 重定向表读起来像"已完成"，实际是"未执行"——后续判断会被误导

**修复（二选一，建议先做 A）**

| 方案 | 动作 | 破坏性 | 效果 |
|---|---|---|---|
| **A. 非破坏性下架** | 给 41 条 `contentJson.seo.robots.index` 置 `false` | 可逆 | 立刻退出索引竞争，页面仍可访问 |
| **B. 真正退役** | 删除 41 条 `LivePage` 行 → 既有 301 立刻生效 | 不可逆，需备份 | 完全符合映射表意图 |

**验收**：A 后 sitemap 不再收录这 41 条；B 后这 41 条返回 301 且目标 200。

---

### D2 — 14 页有完整内容却硬 404/410（P0）

**现象**

`isRetiredAidreamcapesPublicPath()` 对 `/best-save-the-date` 和所有 `/ai-save-the-date/*` 一律返回退役，路由直接 404/410。但库里有 **14 条内容行**：13 条 `/ai-save-the-date/*`（每条 8–11 个 section 的完整内容）+ 1 条 `/best-save-the-date`（1 个 section）。

**证据**

| 状态 | 路径 |
|---|---|
| **410** | `save-the-date`、`valentines-day`、`engagement`、`proposal` |
| **404** | `mothers-day`、`thanksgiving`、`wedding-anniversary`、`wedding-ceremony`、`fathers-day`、`halloween`、`new-year`、`easter`、`christmas` |

这 14 页**没有任何 301 映射**，也不在重定向表里。

**根因**

Save the Date 产品在 Aidreamcapes 下线时，只改了路由判定，没有处理数据，也没有给这些路径配退役目标。

**影响**

- 14 页内容成为死资产（含图片、SEO 文案）
- 404 与 410 混用：同一簇页面给爬虫两种信号
- 若外部有历史外链，全部落到 404
- 已核实：这些路径被 `isBlockedPublicPathForSite` 过滤，**不会进 sitemap**，所以不存在"sitemap 指向死页"的次生问题

**修复**

1. 明确这些路径的终态：**410（产品下线）** 还是 **301（合并到 `/templates` 或 `/ai-video-generation`）**
2. 统一为一种信号（建议 410，因为是产品级下线而非页面搬家）
3. 把 9 条 404 补进 `AIDREAMCAPES_GONE_PUBLIC_PATHS`，与已有 4 条对齐
4. 删除或归档 14 条 `LivePage` 行（需你批准，属不可逆写入）

**验收**：14 条路径状态码一致；sitemap 无对应条目；库内无孤立内容行。

---

### D3 — 1 条活页死链 + 2 条已死页面内的死链（P2）

**证据（全站链接图实测：45 条断开链接中，42 条有 301 兜底，3 条真 404）**

| 目标 | 来源页 | 来源页状态 | 影响 |
|---|---|---|---|
| `/ai-image-generation/motion-generator` | `/collections` | 200，但无入链 | 唯一活页死链 |
| `/holidays-events/wedding-invitation` | `/ai-save-the-date/mothers-day` | 自身 404（见 D2） | 无（随 D2 消失） |
| `/holidays-events/wedding-invitation` | `/ai-save-the-date/fathers-day` | 自身 404（见 D2） | 无（随 D2 消失） |

**根因**

- `motion-generator` 既没有 `LivePage`，也不在重定向表里 → 唯一真正的 404
- `holidays-events/wedding-invitation` 属于已退役的 Save the Date 簇

**修复**

1. `/collections` 里那条链接改到 `video-ads` 或已有工具页
2. 另外 2 条随 D2 一起消失，无需单独处理

**验收**：全站链接图 0 死链。

---

### D4 — canonical 指向 404（P1）

```
/ai-video-generation/wedding-invitation
  canonical = /ai-save-the-date/wedding-invitation   ← 该路径已退役，404
```

**影响**：canonical 是给爬虫的强信号，指向死页会让该页面被判定为无效。

**修复**：canonical 改为自身，或改为 `/ai-video-generation/wedding-invitation`；与 D2 的终态决策联动。

---

### D5 — 发版 SEO 闸门主动过滤重定向源（P1）

```js
// scripts/smoke-aidreamcapes-seo-contract.mjs:334
const entriesForReadback = preNavigationMigration
  ? entries.filter((entry) => !SITE_V2_REDIRECT_SOURCES.has(new URL(entry.loc).pathname))
  : entries;
```

部署脚本对 code-only 发布固定注入 `AIDREAMCAPES_SEO_PRE_NAV_MIGRATION=1` →

**能抓 D1 的闸门，在每次发版时都被关掉。**

**修复**：D1 修完后移除该过滤分支，并新增一条断言"重定向源路径不得出现在 sitemap"。

---

### D6 — 3 组政策页全量重复（P1）

| 组 | 页面 | 现状 |
|---|---|---|
| 隐私 | `/privacy` vs `/privacy-policy` vs `/policies/privacy` | 后者两条 canonical 都指向 `/privacy`，但自身 200 且内容完全相同 |
| Cookie | `/cookie-policy` vs `/policies/cookies` | 同上 |
| 条款 | `/terms` vs `/terms-of-service` vs `/policies/terms` | 同上 |

**影响**：内容 100% 重复、标题重复、描述重复。canonical 只能缓解，不能消除抓取浪费。

**修复**：把别名页改为 **301**（而非 200 + canonical），保留单一权威 URL。

**验收**：`dup.title` / `dup.description` / `dup.body` 三个检测归零。

---

### D7 — `/search` 可被索引（P1）

```
/search   robots: { index: true, follow: true }
```

搜索结果页被索引会产生大量低质入口页，且与站内搜索意图冲突。

**修复**：`robots.index = false`（`/cart`、`/album`、`/login`、`/account`、`/app` 都已是 false，只有 `/search` 漏了）。

---

### D8 — `/help` 与 `/faq` 双份 FAQ（P1）

| 路径 | 实现 | 入链 |
|---|---|---|
| `/faq` | `aidreamcapes_v2_page`（v2 栈） | 有（mega menu） |
| `/help` | `rich_text + faq + rich_text`（legacy 栈） | **无** |

两者都 200、都可索引、标题不同、内容不同。而 `findPage()` 还有 `/faq → /help` 的兼容映射（仅在 `/faq` 无直接页面时生效，当前不生效）。

**修复**：保留一个（建议 `/faq`，因为已入导航），另一个 301 过去；同时清理代码里的兼容映射。

---

### D9 — `/marketing` 与 `/tools` 内容近似且均无入链（P2）

- 两者 `pageType` 不同（`ai_tool_directory` vs `tools`），但都渲染同一个 section 类型 `dreamshoot_tool_collection`
- 两者都在重定向表里（`/marketing → /templates`、`/tools → /ai-video-generation`）
- 两者都无入链 → 归入 D1 的 41 条

**处置**：并入 D1，不单独处理。

---

### D10 — 42 条内链指向 301 中转（P2）

这 42 条不是死链，而是**多一跳**：链接指向的路径已被重定向表声明退役，当前要么仍 200（D1 的 41 条），要么直接 301 到别处。

其中 3 条来自 5 个"别名主题定义"（`macro-details`、`bundle-sets`、`size-reference`、`commercial-lighting`、`fashion-editorial`）——这些定义在目录卡片构建时已被 `isAidreamcapesV2RedirectPath` 过滤，不会出现在 UI 卡片里，只在个别正文链接中出现。

**处置**：D1 完成后，把这 42 条改为直接链接到最终目标，避免每次点击多一跳。

---

### D11 — 11 个媒体文件缺失（P2）

全部集中在 `/ai-save-the-date/mothers-day`，且路径可疑：

```
/assets/sites/site_aidreamcapes/mirror/.../seasonal/easter/hero-ai-mothers-day-family-breakfast.jpg
                                            ^^^^^^ 复活节目录里放母亲节图
```

**判断**：这批内容本身属于 D2 的退役簇，**修复价值低**。建议随 D2 一并归档，不单独补图。

---

### D12 — 10 处图片缺 alt（P3）

集中在 `/ai-image-generation` 与 `/ai-video-generation` 两个目录页。数量小，但目录页是重点落地页。

**修复**：按卡片 `label` 生成 alt，或补 `image.alt` 字段。

---

### D13 — 渲染栈混用（P3）

| 栈 | 页面 |
|---|---|
| **v2**（`aidreamcapes_v2_page`） | `/pricing`、`/faq`、`/inspiration`、`/blog`、`/glossary`、`/templates`×3 |
| **legacy**（121 种 section） | `/help`、`/search`、`/cart`、`/album`、`/account`、`/login`、`/app`、`/collections`、`/marketing`、`/tools` |

**影响**：同一站点两套导航/页脚/样式实现，任何"全站一致性"需求都要改两遍（本轮修页脚与面包屑时已实际踩到）。

**处置**：不要求现在统一；先明确"哪些页面允许留在 legacy 栈"，形成白名单，避免继续扩散。

---

### D14 — 5 个别名主题定义没有页面（非缺陷，仅记录）

`macro-details`、`bundle-sets`、`size-reference`、`commercial-lighting`、`fashion-editorial` 在 `AIDREAMCAPES_IMAGE_THEME_DEFINITIONS` 中注册，但没有 `LivePage`。

**核实结论：这不是缺陷。**

- 这 5 条在 `src/lib/aidreamcapes-site-v2-redirects.json` 里都有 301 映射
- 目录卡片构建时用 `isAidreamcapesV2RedirectPath()` 主动过滤，不会渲染成卡片（`src/lib/storefront-render.tsx:250`）
- sitemap 图片收集同样跳过（`src/lib/seo-indexing.ts:790`）

它们的角色是"旧主题别名"，不是"待补页面"。无需补内容，也无需删定义。

---

## 3. 整改顺序

> 全部为 `site_aidreamcapes` 单站写入；按 AGENTS.md 需**字段级 manifest + compare-and-set**，
> 禁止全站重生成；线上编辑优先。

| 阶段 | 内容 | 缺陷 | 破坏性 | 前置 |
|---|---|---|---|---|
| **P0-1** | 1 条活页死链改指向 + `/search` 设 noindex + 修 1 条 canonical | D3 / D7 / D4 | 低（字段级） | 无 |
| **P0-2** | 41 条置 `robots.index=false`（D1 方案 A） | D1 | 可逆 | 无 |
| **P0-3** | 移除发版闸门的 `PRE_NAV_MIGRATION` 过滤 | D5 | 无（只加闸门） | P0-2 完成 |
| **P1-1** | 3 组政策别名页改 301 | D6 | 中 | P0-1 |
| **P1-2** | `/help` → `/faq` 301 | D8 | 中 | P0-1 |
| **P2-1** | 14 条 save-the-date：统一 410 + 归档内容行 | D2 | **高（删行）** | 需你批准 |
| **P2-2** | 41 条按映射表真正退役（删行 → 301 生效） | D1 | **高（删行）** | 需你批准 |
| **P2-3** | 42 条内链改为直接指向目标 | D10 | 低 | P2-2 |
| **P3-1** | 补 10 处 alt | D12 | 低 | 无 |
| **P3-2** | 定义 legacy 栈白名单 | D13 | 无 | 无 |

**关键原则**：

1. **P0-1 / P0-2 全部可逆**，先做，不需要停机窗口。
2. **P2 的删行不可逆**，必须先备份为 manifest，并在低峰执行。
3. D1 的 A（noindex）与 B（删行）**不要同时做**：先 A 观察索引变化，再决定是否 B。

---

## 4. 需要你决策的两件事

1. **D1 走 A（noindex，可逆）还是直接 B（删行，301 生效）？**
   建议先 A，观察 2 周索引变化后再 B。
2. **D2 的 14 页终态是 410（产品下线）还是 301（合并到其他页）？**
   建议 410，因为 Save the Date 在 Aidreamcapes 是产品级下线。

---

## 5. 本轮未覆盖的部分（需运行环境）

以下属**功能性**验证，静态审计无法判定，且当前生产不可达：

| 项 | 需要的条件 |
|---|---|
| `/search` 实际搜索结果质量与空结果处理 | 运行中的服务 + 查询用例 |
| `/cart` / 结账流程可用性 | 浏览器 + 支付沙箱 |
| `/album` 客户相册的权限隔离 | 登录态 + 跨账号用例 |
| `/app` 工作台生成流程 | 登录态 + AI 队列 |
| 无 JS 回归、hydration、控制台报错 | Playwright |
| 真实 TTFB / 内存曲线 | 生产读回（当前被 TLS 重置阻断） |

**建议**：这些项等 P0 可用性修复 + 生产可达性恢复后，用现成的
`scripts/aidreamcapes-workspace/*` 与 `scripts/smoke-aidreamcapes-seo-contract.mjs` 补跑。

---

## 6. 证据文件

- 原始缺陷明细（机器可读）：`docs/audits/aidreamcapes-defect-inventory-2026-10-21.json`
  含 45 条断开链接、11 个缺失媒体、64 个无入链页面、3 组重复标题/描述、2 组重复正文
- 相关既有文档：
  - `docs/plans/aidreamcapes-remediation-consolidation-2026-10-21.md`
  - `docs/plans/aidreamcapes-template-directory-data-chain-audit-2026-10-21.md`
  - `docs/audits/aidreamcapes-site-architecture-assessment-2026-10-21.md`
