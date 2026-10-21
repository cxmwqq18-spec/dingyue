# AIVideosUGC「模板」目录数据链路评估与整改方案

> 状态：**评估方案待确认**（只读审计已完成，未做任何内容或路由写入）
> 站点范围：仅 `site_aidreamcapes`（`www.aivideosugc.com` / `www.aidreamcapes.com`）
> 依据：生产 HTTP 只读读回 + 本地关系库读回（2026-10-21 12:30–13:00 CST）
> 与既有文档的关系：
> - 路由层以 `aidreamcapes-media-detail-link-remediation-2026-10-21.md` 为权威（已上线 `360efb26c`）
> - 可用性 P0 以 `aidreamcapes-production-ssr-memory-stability-2026-10-21.md` 为权威
> - 三份文档的口径裁决与统一执行序列见 `aidreamcapes-remediation-consolidation-2026-10-21.md`
> - 本文的 §4 口径差异已裁决完毕，§5/§6-Phase0 已移交专项文档

---

## 1. 结论摘要

先给结论，再给证据。

| # | 你的观察 | 判定 | 依据 |
|---|---|---|---|
| 1 | 模板 mega menu 的「按行业 / 按平台 / 偶尔」三列内容相同 | **不是数据错误** | 三列是 3 组静态导航索引（8+6+3），指向 17 个不同的 facet 落地页；75 条菜单链接全部有对应 LivePage 行，0 死链 |
| 2 | 各 facet 页展示的模板「没打上正确标签」 | **部分成立，但位置不同** | facet 页的**模板选择确实是按行业配的**（`/industries/shoes` → 4 条专属路径）；问题出在**模板卡片继承自目标模板页自身素材，而那些模板不是行业专属**（鞋子页出现皂液瓶、便携音箱） |
| 3 | 同一板块出现同样的数据 | **成立，但属于模板层** | 14 个 facet 页的 `data` 键结构与 `templateDirectory.links` 完全一致 → 视觉上"每个板块长得一样"；这是**共享版式**，不是数据串了 |
| 4 | `colorway-variations` 与 `colorway-variations-color-variants` 是同一个产品 | **是同一能力，但属两个不同层级**，且**命名确实有缺陷** | 前者=工具页（`index, follow`），后者=模板详情页（`noindex, follow`）；工具 slug 恰好是详情 slug 的前缀，观感重复 |
| 5 | 「一个分类目录页 vs 一个类型页」 | **你的判断正确** | `/ai-image-generation/<工具slug>` = 工具/能力页；`/ai-image-generation/<工具slug>-<卡片名>` = 模板详情页；`/ai-image-generation/<场景>-ai-image-generation-<工具slug>` = 工作台案例页 |
| 6 | 需不需要整改 | **需要，但优先级不是现在** | 先决条件是 P0 可用性（见 §5）；内容侧主要是**命名规范**与**模板资产行业属性**两件事 |

---

## 2. 链路现状审计

### 2.1 第一段链路：mega menu → facet 落地页（结论：健康）

「模板」菜单是**首页 `LivePage.contentJson.siteNavigation.menus` 里的静态导航**，不是动态聚合：

| 菜单 | 组 | 数量 | 链接形态 |
|---|---|---|---|
| Templates | By industry | 8 | `/industries/*` |
| Templates | By platform | 6 | `/platforms/*` |
| Templates | By occasion | 3 | `/occasions/*` |
| Templates | footerLink | 1 | `/templates`（"查看全部 18 个模板"） |

**读回结果**

- 75 条菜单链接 → 全部命中已发布 LivePage 行，**0 死链**
- `/templates` 画廊实际渲染 **18 张卡片**，与菜单文案「18 个模板」一致 ✓
- `/templates/photo` 9 条 + `/templates/video` 9 条 = 18，与 `/templates` 的 `templateDirectory.paths` 完全对应 ✓

### 2.2 第二段链路：facet 落地页 → 模板卡片（结论：选择正确，素材不行业化）

14 个 facet 页（8 行业 + 6 平台 + 3 场合）**共享同一套 `data` 键结构**（`templateDirectory` / `platformLinks` / `cards` / `examples` / `heroCards` / `tools` / `tips` / `benefits` / `reasons` …），并且：

| 区块 | 是否按 facet 区分 | 说明 |
|---|---|---|
| `templatesLead` | ✅ 是 | 「Choose a shoe ad scene for sneakers, boots, or the next pair in your catalog.」 |
| `tools` | ✅ 是 | 鞋子页专属：`alt="Plain cream walking shoe centered alone on a pure white background"`，图 `fx30-shoes-tool-white-r1-640.webp` |
| `platformLinks` | ❌ 全站同款 | 6 条平台链接在 14 个页面里逐字相同（Industries 页甚至 `label` 为 undefined） |
| `templateDirectory.links` | ❌ 全站同款 | 5 条（All templates / Photo templates / Video templates / By industry / By platform），14 页逐字相同 |
| `templateDirectory.paths` | ✅ 是 | 真正决定卡片的那一项，按 facet 配 |

**`/industries/shoes` 的 4 条路径与卡片实际素材**

| 路径 | 卡片标题 | 卡片实际素材 alt | 是否鞋类 |
|---|---|---|---|
| `/ai-image-generation/colorway-variations` | 颜色变体 | *Sage ceramic soap dispenser stands on a clean white background.* | ❌ 皂液瓶 |
| `/ai-image-generation/packshot-multi-angle` | 每个角度 | *Square front and rear views of the same unbranded black woven portable speaker…* | ❌ 便携音箱 |
| `/ai-image-generation/sale-campaign-key-visual` | 促销横幅 | —（`t33-tpl-sale-og-r2.webp`） | ❌ 通用促销 |
| `/ai-video-generation/cinematic-video` | 品牌宣传片 | *The same rounded pebble-shaped black speaker catches a cool cinematic highlight…* | ❌ 音箱 |

> **判定**：facet 页确实选了"该行业该用的模板"，但**被选中的模板本身是通用产品图模板**，素材与 alt 描述也是通用产品。行业标签只打在了 `tools` 区块，没打在 `templateDirectory` 卡片上。
> 这就是"看着像没打标签"的真实成因——**不是选择逻辑错，是模板资产的行业属性缺失**。

### 2.3 第三段链路：`/ai-image-generation/*` 命名空间的三层结构

这是最需要整改的一层。当前一个前缀下叠了三种东西：

| 层 | URL 形态 | 实例 | robots | 说明 |
|---|---|---|---|---|
| ① 工具/能力页 | `/ai-image-generation/<工具slug>` | `colorway-variations`、`packshot-multi-angle`、`video-ads` | `index, follow` | 一个"能力"，带 `templateDefinition` + picker 卡片 |
| ② 模板详情页 | `/ai-image-generation/<工具slug>-<卡片名>` | `colorway-variations-color-variants` | `noindex, follow` | 一张具体模板卡 |
| ③ 工作台案例页 | `/ai-image-generation/<场景描述>-ai-image-generation-<工具slug>` | `running-shoe-creator-showcase-ai-image-generation-colorway-variations` | `noindex` | 该工具的一个具体案例 |

**三个由此产生的缺陷**

1. **前缀包含**：① 的路径是 ②③ 的前缀 → 用户看到 `/colorway-variations` 与 `/colorway-variations-color-variants` 会判定为同一产品（你的原话："这两个看上去都是同一个产品"）。
2. **工具 slug 在一条 URL 内重复两次**：③ 的形态是 `<场景>-ai-image-generation-<工具slug>`，同一段 slug 出现 2 次。实测带 `publicSlug` 的卡片共 **987** 条，其中形如 `*-ai-image-generation-colorway-variations` 的占绝大多数。
3. **父子层级不可从 URL 推断**：`/ai-image-generation/<x>` 有时是页、有时是卡片、有时是案例，取决于后缀拼接规则，而不是取决于路径深度。

**生产命名空间全量读回（2026-10-21 12:50 CST）**

| 命名空间 | sitemap 条数 | 逐条读回 | 标题正确 |
|---|---|---|---|
| `/ai-image-generation/*` | 14 | **14/14 → 200** | ✅ 全部与 slug 语义相符 |
| `/ai-video-generation/*` | 17 | **17/17 → 200** | ✅ 全部相符 |
| `/ai-actors/*` | 93 | 未逐条读回 | — |

> 补充：`/ai-image-generation/every-angle` 返回 **404**，但它**不在 sitemap**、站内也无 href 引用（属孤儿路径，非死链）。

### 2.4 数据库侧的归因能力（结论：维度缺失）

`prisma/schema.prisma` 中**不存在行业 / 平台 / 场合维度的表**：

- `VideoTheme` / `CreativePack` → `categoryId` → `VideoThemeCategory` / `CreativePackCategory`
- 分类表是**两级树**（`parentId` → `children`），字段仅 `slug/label/description/icon/accentColor/imageUrl/sortOrder/status`
- `VideoTheme` 自身字段：`slug/name/headline/description/prompt/status/creditCost/modelPricing/durationSeconds/imageUrl/galleryImages/sortOrder`

**结论：行业 / 平台 / 场合这个维度在关系模型里根本不存在。** 现在 `/industries/shoes` 能"看起来按行业"，是因为 `templateDirectory.paths` 人工列了 4 条路径——这是**硬编码的策展清单**，不是可计算、可扩展的标签。

这决定了整改的形态：**不能靠"补标签字段"解决**，因为根本没有标签表；要么引入维度表，要么继续用 paths 策展并把素材换掉。

---

## 3. 数据规模

| 指标 | 数值 | 来源 |
|---|---|---|
| `site_aidreamcapes` LivePage 总行数 | 268 | 本地关系库 |
| pageType 分布 | content 134 / ai_tool 74 / policy 19 / article 9 / 其他 28 | 本地关系库 |
| 带 `publicSlug` 的卡片总数 | **987** | 本地关系库 |
| 工具/能力页（`ai_tool`） | 74 | 本地关系库 |
| facet 落地页 | 17（行业 8 + 平台 6 + 场合 3） | 本地关系库 |
| 模板路径总数 | 18（photo 9 + video 9） | 本地关系库 |
| `/ai-actors/*` 详情页 | 53 | 并行计划审计 |

---

## 4. 与并行计划的口径差异（已裁决）

`docs/plans/aidreamcapes-media-detail-link-remediation-2026-10-21.md` §2.2 曾记载：

> photo 命名空间失效：9 个模板页 8 个 404
> sitemap 提交死链：13 条 `/ai-image-generation/*` 返回 404

**该结论已过时，且并行会话已修复并上线。**

| 并行计划旧结论 | 当前实测 / 状态 | 判定 |
|---|---|---|
| 9 个 photo 模板页 8 个 404 | 9/9 → 200 | **已修**（`8e92d0f81` → `5ad07903b`，随 `360efb26c` 上线） |
| sitemap 13 条 photo 死链 | sitemap 14 条 photo 全部 200 | **已修** |
| 5 条站内死链 href | 菜单 75 条链接 0 死链 | **已消解** |

**归口结论**：路由层以并行计划为权威文档，本文的 §2.3（三层命名结构）/ §2.4（维度缺失）作为**数据层**补充。
两者均已登录 `docs/plans/aidreamcapes-remediation-consolidation-2026-10-21.md` §1「已解决」清单，不再重复跟踪。

---

## 5. P0 前置项：可用性阻塞（不属于本议题，但阻塞一切验收）

**结论维持，但处置方案已由专项文档接管，本文不再给出参数。**
完整因果链、参数取值、验收标准见：

> `docs/plans/aidreamcapes-production-ssr-memory-stability-2026-10-21.md`

本文只保留与本议题相关的**事实陈述**：

- 读回期间生产应用 20 分钟内 OOM 崩溃 2 次（12:46:21、12:56:41），**这两次由本次评估的读回行为触发**；
- 崩溃前已处高压态（单请求 TTFB 达 10.4 s / 21.0 s），此时任何线上读回都不可信；
- 因此 **Phase 1 的命名空间体检必须等 P0 完成后再做**，否则 502 无法区分"真故障"与"读回把它压崩了"。

> ⚠️ 本文早期版本给出的 Phase 0 参数（`--max-old-space-size=3072`、`MemoryMax`、`connection_limit` 3→8~15）
> **已撤销**：堆上限下调会让 OOM 更早发生；宿主 systemd 219 不支持 `MemoryMax`；连接池大于闸门会持续 P2028。
> 该错误已在合并文档 §2 记录为 M1/M2/M3。

---

## 6. 评估方案（4 阶段）

每阶段都有明确的**产出物、读回口径、验收标准**。阶段 0 是前置。

### Phase 0 — 可用性止血（已移交专项文档）

| 项 | 内容 |
|---|---|
| 归属 | `docs/plans/aidreamcapes-production-ssr-memory-stability-2026-10-21.md` |
| 本文职责 | 只声明**依赖关系**：本方案 Phase 1–3 不得在其 P0 完成前开始 |
| 完成判据 | 该文档 §4.1：16 并发抓取 sitemap 177 条 URL 零 OOM、零 5xx、p95 ≤ 2.5 s |

### Phase 1 — 命名空间体检（只读，产出数据）

| 项 | 内容 |
|---|---|
| 复用脚本 | `scripts/aidreamcapes-workspace/audit-media-namespace.mjs`、`audit-media-detail-routes.mjs`、`audit-card-entry-links.mjs`（均为只读） |
| 新增检查 | ① 三层 URL 分类器（工具页 / 模板详情页 / 工作台案例页）；② 同源 slug 前缀包含关系图；③ 987 条 `publicSlug` 的重复与包含检测；④ 14 个 facet 页的 `templateDirectory.paths` 交集/并集矩阵 |
| 产出 | `docs/audits/aidreamcapes-template-namespace-audit-2026-10-21.md` + JSON 报告 |
| 验收 | 每个 404/重名/包含关系都有唯一归因与唯一责任方 |

### Phase 2 — 命名规范与标签体系设计（设计阶段，不写数据）

这是**需要你拍板**的核心决策，两条路线：

| 路线 | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A. 引入维度表** | 新增 `TemplateFacet`（kind: industry/platform/occasion）+ 关联表；facet 页按维度查询 | 可计算、可扩展、行业归属可运营 | 需 schema 迁移 + 987 条卡片补标 + 14 个 facet 页重接 |
| **B. 保持 paths 策展** | 不改数据模型；保留人工 `templateDirectory.paths`，但**换掉素材**并补 alt 文本 | 改动小、可控、见效快 | 仍是硬编码；行业归属无法规模化维护 |

无论哪条路线，以下三项**必须同时落地**（否则 URL 观感问题不会消失）：

1. **打破前缀包含**：模板详情页 slug 不再以工具 slug 为前缀。建议形态 `/ai-image-generation/<工具slug>/<模板slug>`（两级路径，层级自解释），或工具页改用不与模板同段的命名。
2. **消除 slug 内重复**：工作台案例页去掉重复的 `ai-image-generation-<工具slug>` 段。
3. **同源 301**：旧 URL 全部 301 到新地址，sitemap 同步替换，JSON-LD canonical 同步。

### Phase 3 — 内容整改（字段级 manifest，线上读回）

| 项 | 内容 |
|---|---|
| 写入方式 | **严格字段级 manifest**（逐 `LivePage` 行、逐字段、`compare-and-set`），**不做全站生成**（AGENTS.md 明令禁止） |
| 范围 | 仅 `site_aidreamcapes` 的 `LivePage.contentJson`；不触碰 MyDreamShoots 任何数据 |
| 冲突 | 线上已改动的字段以线上为准（online edits win） |
| 实施前 | 对生产关系库做**同口径只读读回**（与本地库比对行数与字段分布） |
| 验收 | ① 目标 URL 全部 200 且标题正确；② 旧 URL 301 生效；③ sitemap 无死链；④ facet 页素材与行业语义一致；⑤ 静态与无 JS 回归检查通过 |

---

## 7. 风险与隔离边界

| 风险 | 说明 | 处置 |
|---|---|---|
| **共享层** | `src/lib/photo-package-taxonomy.ts::parsePublicCollectionRouteForSite` 被 `src/app/[...path]`、`src/app/ai-image-generation/[themeSlug]`、`src/app/site/[siteSlug]/ai-image-generation/[themeSlug]` 三处共用，影响 MyDreamShoots | 该函数已按 `isAidreamcapesRouteSite(site)` 分支隔离；任何改动**必须保持该门禁**，并在改动后跑 MyDreamShoots 回归（只读）确认无行为变化，否则**停下请求授权** |
| 与并行会话冲突 | 并行会话有未提交改动，同属 media detail 区域 | 建议先合并其路由层改动，再执行本方案 Phase 2/3；本文不改动其文件 |
| 发版期抖动 | Phase 0 改 systemd unit 会触发一次重启 | 需选低峰窗口并提前告知 |
| 素材补齐 | 「鞋子页要出现鞋」需要新的行业专属图片 | 需要素材产出预算；否则 Phase 2 的收益只有 URL 层，视觉层无改善 |

---

## 8. 需要你决策的三件事

> 合并后这三条已收敛进 `docs/plans/aidreamcapes-remediation-consolidation-2026-10-21.md` §5。

1. **Phase 2 走路线 A（引入维度表）还是路线 B（保持策展 + 换素材）？** 这决定工作量级别（数天 vs 数周）与是否需要素材预算。
2. **模板详情页是否值得保留独立 URL？** 若不值得，987 条 `publicSlug` 可整体收进工具页（`/ai-image-generation/colorway-variations` 内部锚点），§2.3 的三层问题一步消解。
3. **可用性 P0 是否批准？**（原"是否先做 Phase 0 止血"）
   Phase 0 的**参数与验收已由** `aidreamcapes-production-ssr-memory-stability-2026-10-21.md` **接管**，本文不再重复。
   不批则 Phase 1–3 的每次线上读回都不可靠。
