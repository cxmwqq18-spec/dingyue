# 主题设计文档与当前发布文案一致性检查

检查日期：2026-08-27  
检查对象：`site_dreamshoot` 当前发布快照 `releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json`  
设计资料范围：`docs/design-packages/` 下的主题设计包、Markdown 文案、HTML 原型、PNG 设计图及 SEO 配置。

本次为第二轮复核。除当前工作区外，还检索了 `dingyue` Git 的全部可见历史（`git log --all -- docs/design-packages/**`）以及部署快照目录；没有把附件图片中的说明性文字当成需求，也没有把上一轮审计报告的结论当成设计基准。

## 结论摘要

当前不能判定为“设计文档与线上主题文案一比一对应”。发现 3 个 P0、3 个 P1 和 2 个资料完整性问题：

1. **P0：内部 SEO/内容策略被当作客户文案渲染。** `/holidays-events/engagement` 的页面正文直接出现 “SEO page”；`/holidays-events/save-the-date` 也发布了 “The page should stay focused...” 和 “SEO copy” 等作者指令。截图中“而非 SEO 页面所针对的产品”就是这一类内容泄漏，而不是正常产品文案。
2. **P0：Wedding Anniversary 错用整套 Save the Date 文案。** 该路由标题虽然是 `AI Wedding Anniversary`，但模板、SEO title/description、11 个 section、FAQ 和 CTA 全部沿用 Save the Date；且图片也只是 Anniversary 文件夹中的 Save the Date 复用图。
3. **P0：Save the Date 的设计包要求 `Indexation = HOLD`，当前发布 SEO 却是 `index=true`。** 设计包明确要求证据门禁通过前保持 HOLD；当前快照仍允许索引。
4. **P1：HTML 原型与线上结构有可见差异。** Save the Date HTML 的 Secondary CTA 指向 `#scenes`，线上指向 `#use-cases`；HTML 芯片只有 5 个且使用 `Identity + Date Review`，线上有 6 个且使用 `Identity and Date Review`；线上还使用了生成媒体路径和生产渲染样式，不能视为 HTML 原型的一比一实现。
5. **P1：Wedding Invitation 文案主体基本一致，但发布状态仍为 `index=false`，这与设计包的 HOLD 规则一致；当前只可确认“文案已导入”，不能确认设计图一致，因为该目录实际缺少承诺的 HTML/PNG 预览文件。**
6. **P1：仓库没有 Engagement、Proposal、Wedding Anniversary 的独立设计文档/HTML 设计图。** 这些路由无法按“一套对应设计文档”验收；其中 Anniversary 已经证实是错误复用，Engagement/Proposal 只能按线上 sourceRevision 做内容审查。

全量扫描 `docs/design-packages/` 后实际只有两个主题包目录：`ai-save-the-date-video` 和 `ai-wedding-invitation-maker-final`。截图中的 12 个主题路由均能在当前发布快照中找到，但 Christmas、Father's Day、Halloween、Mother's Day、New Year、Thanksgiving、Valentine's Day、Wedding Ceremony、Engagement、Proposal、Wedding Anniversary 没有在当前工作区或 Git 可见历史中找到可配对的独立设计包文件。因此本报告对它们的结论是“缺少可追溯基准，未完成一比一验收”，不是断言用户从未提供过文件；若文件只存在于历史对话附件而未同步到工作区，仍需将原文件导入后补验。

## 截图对应的 12 个主题全量盘点

| 主题路由 | 当前页面/模板 | 当前索引 | `sourceRevision` | 内部策略词命中 | 设计基准状态 | 当前判定 |
|---|---|---:|---|---:|---|---|
| Valentine's Day | `/ai-save-the-date/valentines-day` / `save-the-date` | true | `plan-20260824` | 0 | 未找到独立设计包 | 未完成一比一验收 |
| Engagement | `/holidays-events/engagement` / `save-the-date-editorial` | true | `engagement-plan-20260824` | 3 | 未找到独立设计包 | P0 内部文案泄漏 |
| Proposal | `/holidays-events/proposal` / `save-the-date-editorial` | true | `proposal-plan-20260824` | 0 | 未找到独立设计包 | 未完成一比一验收 |
| Save the Date | `/holidays-events/save-the-date` / `save-the-date-editorial` | true | `save-the-date-plan-20260824` | 6 | 有完整设计包 | P0 不通过 |
| Wedding Invitation | `/holidays-events/wedding-invitation` / `wedding-invitation-editorial` | false | `wedding-invitation-package-20260824` | 0 | 文案包有，HTML/PNG/JPG 文件缺失 | 文案基本一致，视觉未验收 |
| Wedding Ceremony | `/ai-video-generation/wedding-ceremony` / `seasonal-editorial` | true | `wedding-ceremony-package-20260824` | 3 | 未找到独立设计包 | P1 内部策略词需清理 |
| Christmas | `/holidays-events/christmas` / `seasonal-editorial` | true | `christmas-package-20260824` | 1 | 未找到独立设计包 | P1 有 search-intent 说明泄漏风险 |
| Halloween | `/holidays-events/halloween` / `seasonal-editorial` | false | `halloween-package-20260824` | 2 | 未找到独立设计包 | 未完成一比一验收；发布与 draft SEO 有差异 |
| Thanksgiving | `/holidays-events/thanksgiving` / `seasonal-editorial` | true | `thanksgiving-package-20260824` | 0 | 未找到独立设计包 | 未完成一比一验收 |
| New Year | `/holidays-events/new-year` / `seasonal-editorial` | true | `new-year-package-20260824` | 0 | 未找到独立设计包 | 未完成一比一验收 |
| Mother's Day | `/holidays-events/mothers-day` / `seasonal-editorial` | true | `mothers-day-package-20260824` | 0 | 未找到独立设计包 | 未完成一比一验收 |
| Father's Day | `/holidays-events/fathers-day` / `seasonal-editorial` | true | `fathers-day-package-20260824` | 0 | 未找到独立设计包 | 未完成一比一验收 |

“内部策略词命中”只统计正文/section 文本中出现 `SEO page/copy`、`page should`、`search intent`、`indexation`、`Evidence Gate`、`primary keyword` 等词，不统计正常的页面标题或 SEO metadata 字段。

## 基准与判定方法

- 将设计包中的 `01_page_copy_final.md`、`02_page_structure_final.md`、`06_seo_config.csv`、`08_product_evidence_launch_gate.md` 视为文案/发布约束来源。
- 将 `03_page_prototype.html` 视为 Save the Date 的离线 HTML 设计图；截图中的浏览器说明文字不视为需求。
- 将当前快照中每个页面的 `publishedJson` 视为线上实际文案，不以 `draftJson` 代替。
- 判定“内部指令”与“客户文案”的规则：包含 `page should`, `SEO page/copy`, `indexation`, `Evidence Gate`, `primary keyword`, `search intent`, `supplied taxonomy`, “belongs on the X page”等作者/发布策略术语，默认不应直接显示给终端客户；产品 FAQ 中必要的主题边界说明除外。

## 逐主题检查

### 1. Save the Date

**对应资料**：

- 文案：[01_page_copy_final.md](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/01_page_copy_final.md)
- 结构：[02_page_structure_final.md](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/02_page_structure_final.md)
- HTML：[03_page_prototype.html](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/03_page_prototype.html)
- SEO：[06_seo_config.csv](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/06_seo_config.csv)
- 发布快照：`publishedJson` 从 [快照:45839](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:45839) 开始；source revision 为 [快照:46763](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:46763)

**已一致的主要字段**：Title、Meta description、H1、Hero 主文案、主 CTA、FAQ 8 项、Use Cases 6 项、Workflow 6 步、Scene Ideas 11 项、Formats 3 项、Final CTA 主体均已导入线上；线上 source revision 为 `save-the-date-plan-20260824`。

**不一致/不应公开的文案**：

| 优先级 | 位置 | 设计资料中的内容 | 当前发布内容/表现 | 判断 |
|---|---|---|---|---|
| P0 | Definition 正文 | [文案:40](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/01_page_copy_final.md:40) 的 “The page should stay focused on Save the Date video intent... SEO/产品目标...” 是作者说明 | 线上 `save_date_definition.blocks[0].settings.text` 原样发布；快照中同句可见于 [快照:46408](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:46408) | 不是面向客户的解释，应改成自然语言产品说明或删除 |
| P0 | Quality Standards | [文案:101](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/01_page_copy_final.md:101) 含 “SEO copy” | 线上 `save_date_quality` 直接显示 “Do not bake ... SEO copy ...”；快照 [快照:46094](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:46094) | 客户不应看到 SEO 编辑术语，应改为“不要把任何界面或未经核实的文字烧录进素材” |
| P1 | Hero chips | HTML 原型 [HTML:14](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/03_page_prototype.html:14) 有 5 个 chip，且为 `Identity + Date Review` | 线上 6 个 chip，额外加入 `Social Sharing`，并改为 `Identity and Date Review` | 设计图与线上 UI 不一比一；需确定最终词表并同步 HTML/PNG/线上 |
| P1 | Secondary CTA anchor | HTML [HTML:14](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/03_page_prototype.html:14) 为 `#scenes` | 线上 `secondaryHref` 为 `#use-cases`（快照 [快照:45805](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:45805)） | 点击后落点不同；需统一为最终信息架构 |
| P1 | Desktop/mobile 设计图 | Desktop PNG [03_desktop_design_final.png](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/03_desktop_design_final.png) 和 mobile PNG [04_mobile_design_final.png](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/04_mobile_design_final.png) 的 Hero 只显示一个主 CTA；mobile 文案还缩写为 “verify every factual detail before publishing” | HTML 与线上 Hero 有主/次 CTA、chips，线上 Hero intro 为完整长版本 | PNG、HTML、线上不是同一版稿；需指定唯一最终基准并重新导出设计图 |
| P1 | 设计图中的内部验收内容 | Desktop full-page PNG [03_desktop_full_page.png](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/03_desktop_full_page.png) 在页面中展示 `EVIDENCE GATE · INDEXATION HOLD` 及 “Keep indexation on HOLD...” | 线上渲染器隐藏 `editorial_evidence`，但仍把部分策略文字留在 Definition/Quality | 设计图是“内部 QA 版”与“客户页面版”混合稿；必须拆分，避免把发布门禁画进对外页面 |
| P0 | Indexation | SEO CSV 要求 `indexation_status,HOLD`（[SEO:20](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/06_seo_config.csv:20)），Evidence Gate 也要求 HOLD（[Gate:29](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/08_product_evidence_launch_gate.md:29)） | 当前发布 `seo.index=true`、robots `index=true`（快照 [快照:45840](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:45840)） | 发布控制与设计文档冲突；应先改为 noindex 或更新并批准证据门禁 |
| P1 | Evidence section | HTML 原型包含完整 Evidence Gate 与 footer “Offline SEO and design prototype...” （[HTML:30](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/03_page_prototype.html:30)、[HTML:42](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-save-the-date-video/03_page_prototype.html:42)） | 线上 section 数据仍保留，但渲染器明确将 `editorial_evidence` 隐藏（[renderer:8598](/Users/a1/work/ai-project/dingyue/src/components/theme-renderer.tsx:8598)） | 线上与 HTML 原型不一致；隐藏是正确方向，但应从客户可见原型/最终稿中区分“内部验收版”和“客户页面版” |

### 2. Engagement

**对应资料状态**：没有 `ai-engagement-*` 独立设计包、HTML 或 PNG；线上 source revision 为 `engagement-plan-20260824`。因此无法声称与设计图一比一对应。

**已确认问题**：

- 线上 `engagement_intent.blocks[0]` 发布了 “The page should stay focused on video intent. Couple photos are source material for the video, not the product being targeted by the SEO page...”（快照 [快照:35946](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:35946)）。这正是截图中“而非 SEO 页面所针对的产品”对应的源文案，属于编辑/SEO 指令，不应出现在客户页面。
- 该路由的 FAQ/边界内容仍带有 “search intent” 等内部术语（同一发布 section），应改为客户可理解的“本页专注订婚阶段的视频；正式邀请函另见……”等自然表达。
- `engagement_evidence` 虽存于发布 JSON，但当前渲染器对 `editorial_evidence` 返回 `null`，所以该区块不会进入正常页面；这与线上仍暴露 `engagement_intent` 的问题不同。

### 3. Proposal

**对应资料状态**：没有独立 Proposal 设计文档/HTML/PNG；线上 source revision 为 `proposal-plan-20260824`。

**文案判断**：Proposal 的 Title、Meta、Hero、FAQ 和 workflow 是 proposal-specific，未发现直接复用 Save the Date 的整页 section。当前只能判定“无设计图基准，无法做像素/文案一比一验收”，不能判定完全合格。

### 4. Wedding Anniversary

**对应资料状态**：没有 Anniversary 设计包；该页却使用 `templateKey=save-the-date-editorial`，并引用 `save_date_*` 全套 section（快照 [快照:48241](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:48241)）。

**明确不一致**：

- 页面标题为 `AI Wedding Anniversary | myDreamshoots`，但 SEO title 是 `AI Save the Date Video Maker | myDreamshoots`，description 也是 Save the Date 文案（[快照:48250](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:48250)）。
- Hero、Definition、Use Cases、Workflow、Scene Ideas、Quality、Formats、Boundaries、FAQ、CTA 均为 Save the Date 文案；例如 Hero title 仍是 `Create an AI Save the Date Video`，FAQ 仍回答 Save the Date（快照从 [快照:48264](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:48264) 起）。
- 该页虽 `index=false`，但 noindex 不能解决用户打开页面后看到错误主题文案的问题；应重做 Anniversary 文案，或明确下线/重定向，而不是保留错误页面。

### 5. Wedding Invitation

**对应资料**：文案包 [01_page_copy_final.md](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-wedding-invitation-maker-final/01_page_copy_final.md)、SEO [06_seo_config.csv](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-wedding-invitation-maker-final/06_seo_config.csv)。

**文案一致性**：Title、Meta、H1、Hero、What Is、6 个 style/use case、Do/Avoid、6 步流程、Information、Save the Date 边界、Accuracy、8 个 FAQ、Final CTA 与线上 `wedding_invitation_*` section 基本逐项一致；线上 source revision 为 `wedding-invitation-package-20260824`（[快照:50734](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:50734)）。

**发布状态**：设计包要求 `HOLD`（[README:26](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-wedding-invitation-maker-final/README.md:26)），线上 `publishedJson.seo.index=false`（[快照:50751](/Users/a1/work/ai-project/dingyue/releases/remote-snapshots/mydreamshoots-production-current-2026-08-27.json:50751)），此项一致。

**无法核验**：README 声称包内含 HTML prototype、Desktop/Mobile previews（[README:11](/Users/a1/work/ai-project/dingyue/docs/design-packages/ai-wedding-invitation-maker-final/README.md:11)），但当前目录实际没有 HTML、PNG 或 JPG 设计图，只有 Markdown/CSV/审计资料。因此视觉和 HTML 文案无法做三方一比一核对。

### 6. 其余主题的深入检查结果

由于这些主题没有可追溯的独立计划文档，以下是对线上文案结构和发布状态的“内部一致性”检查，不等同于与用户原始设计文档的一比一确认：

- **Valentine's Day**：`/ai-save-the-date/valentines-day` 使用旧式 `save-the-date` 模板，10 个 `save_date_*` section；当前快照未发现 SEO/发布策略词，但缺少外部计划文案基准。
- **Proposal**：9 个 section 均为 `proposal_*`，Title/Meta/Hero/FAQ 是 Proposal 主题，未发现 Save the Date 整页串文；仍缺独立设计文件。
- **Wedding Ceremony**：10 个 `wedding_ceremony_*` section；至少 3 处文案含 “commercial permissions”“generic cinematic video workflow”“search intent”等内部策略/合规说明，应迁移到内部验收字段或改写为用户语言。
- **Christmas**：10 个 `christmas_*` section；Definition 正文含“topic keyword and search intent”说明，属于内容策略句，应删去或改为直接解释照片与视频的区别。
- **Halloween**：8 个 section；published SEO 为 `index=false`，而 draft SEO 为 `index=true`，这是发布差异，需确认是否为有意的 noindex。
- **Thanksgiving、New Year、Mother's Day、Father's Day**：section 命名与主题一致，未检测到内部策略词，但没有计划文档/HTML/设计图，不能确认一比一还原。

全量 `draftJson` 与 `publishedJson` 对照还发现：Wedding Invitation 和 Halloween 的 SEO 字段在发布时发生变化（主要是 `index` 状态；Wedding Invitation 另有 relatedLinks/contentContract 差异），其余 10 个路由的关键 SEO 字段未发现 draft/published 差异。

## 设计资料完整性清单

| 主题 | 文案 MD | HTML 原型 | PNG/JPG 设计图 | 当前线上 sourceRevision | 可否一比一验收 |
|---|---:|---:|---:|---|---|
| Save the Date | 有 | 有 | 有 | `save-the-date-plan-20260824` | 可以，已发现上述差异 |
| Engagement | 无独立包 | 无 | 无 | `engagement-plan-20260824` | 不可以 |
| Proposal | 无独立包 | 无 | 无 | `proposal-plan-20260824` | 不可以 |
| Wedding Anniversary | 无独立包 | 无 | 无 | 错用 `save-the-date-plan-20260824` | 不可以，且已确认错页 |
| Wedding Invitation | 有 | README 声称有，但文件缺失 | README 声称有，但文件缺失 | `wedding-invitation-package-20260824` | 只能做文案 JSON 对照 |

## 建议修复顺序

1. 立即从 `engagement_intent`、`save_date_definition` 和 Save the Date quality item 中移除内部 SEO/发布策略句；保留客户可理解的产品边界说明。增加发布前检查：禁止 `SEO page/copy`、`page should`、`indexation`、`Evidence Gate` 等词出现在客户正文。
2. 立即处理 Wedding Anniversary：暂时下线/重定向，或建立独立 Anniversary 文案、section、SEO 和媒体；不能继续以 Save the Date 页面冒充 Anniversary。
3. 将 Save the Date 的线上索引状态改为 `noindex`，直到 Evidence Gate 通过；或由产品负责人书面批准更新设计包中的 HOLD 状态。
4. 决定 HTML/线上最终单一基准，统一 CTA anchor 和 Hero chip 词表，并重新生成桌面/移动设计图。
5. 为 Engagement、Proposal、Wedding Anniversary 补齐独立设计包；补齐 Wedding Invitation 缺失的 HTML/PNG/JPG 文件后再做视觉验收。
6. 将 12 个主题统一建立“计划文案、HTML 原型、Desktop/Mobile 设计图、发布 JSON、线上截图”五件套，并为每个文本节点设置稳定 ID；验收脚本逐节点比较，禁止只比较标题或 section 数量。
7. 对 Wedding Ceremony、Christmas 等已命中策略词的页面做第二轮正文清洗；对 Halloween、Wedding Invitation 做 draft/published SEO 变更审批记录。

## 最终判定

**不通过。** Wedding Invitation 的“文案导入”大体通过，Save the Date 的大部分业务文案已导入，但内部策略泄漏、Anniversary 错页复用和 Save the Date 索引门禁冲突都属于发布阻断问题；在修复并重新检查前，不能称为各主题与设计文档一比一对应。
