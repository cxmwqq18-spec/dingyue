# 主题页 PostgreSQL → SSR → 设计基准一致性审计

审计日期：2026-08-29

站点：`site_dreamshoot` / `www.mydreamshoots.com`

范围：Save the Date 菜单中的 12 个主题页；额外检查未进入菜单的 Wedding Anniversary 相邻页。

## 数据边界

本次结论只来自：

1. 生产 PostgreSQL 当前关系记录：`ThemePage.draftJson`、`ThemeSettings.draftJson`、`MediaAsset`；
2. 当前本地 SSR `127.0.0.1:3002`；
3. 当前生产 SSR `https://www.mydreamshoots.com`；
4. 当前工作区 `docs/design-packages/` 中实际存在的设计文件。

没有读取或激活 `SitePublishedState`、`ThemePublication`、release snapshot 或历史 publication 作为页面真值，也没有执行任何数据库写入。

公开运行时确实把最新 `draftJson` 映射为 SSR 页面数据，见：

- `src/lib/stores/site-store.ts:956-962`
- `src/lib/storefront-context/snapshot.ts:202-224`

`guard:public-storefront-ssr` 与 `guard:live-storefront-ssr` 均通过。

## 总结判定

**不通过一比一验收。**

通过的部分：12 个菜单 URL 均返回 200；菜单 label/href 与数据库完全一致；Title、Description、canonical、H1、OG image 12/12 与当前 `draftJson` 一致；FAQ JSON-LD 12/12 与各页数据库 FAQ 一致；未发现某页 H1、整段长正文、FAQ 集合、CTA 或外来图片 URL 被另一主题整套替换。

不通过的主要原因：

- 12/12 页面数据库设置 `index=true`，生产 SSR 却全部输出 `noindex, follow`；
- sitemap 包含其中 11 页，但这些页面自身仍为 `noindex`；Father's Day 不在 sitemap；
- 12/12 页面线上 meta keywords 被代码重写，0/12 使用数据库关键词；
- Engagement 把内部 noindex/product-evidence 指令直接显示给客户；
- Father’s Day 内容合同、`sectionsOrder` 和实际 sections 不一致；
- 只有 Save the Date 存在完整 HTML/PNG/MD/图片设计包，其余页面缺少可做一比一验收的权威基准；
- Engagement 11 张图与 Save the Date 11 张图逐张二进制完全相同；
- New Year 有一张已登记资源未进入 SSR；多页存在数据字段已保存但 renderer 不消费的问题。

## P0 / 发布阻断问题

### P0-1：取消快照后，旧 fail-closed 仍令全部主题详情 noindex

数据库 12 页的 `draftJson.seo.index`、`draftJson.seo.robots.index` 均为 `true`，生产 SSR 12/12 输出：

```html
<meta name="robots" content="noindex, follow, max-image-preview:large">
```

同时 head 输出 `storefront-current-revision=unpublished` 和 `storefront-snapshot-hash=unpublished`。

触发链：

1. `src/lib/stores/site-store.ts:1111-1128` 的注释要求 editorial 详情加载完整媒体，但 `mediaAssets` 条件没有覆盖普通 `/ai-save-the-date/*` 详情，详情 bundle 实际拿到 0 个媒体；
2. `src/lib/stores/theme-store.ts:316-333` 要求 editorial manifest 中每个资源都有当前 `MediaAsset` owner，因详情 bundle 媒体为空，route 被判为 `review_required / EDITORIAL_PAGE_CONTRACT_REQUIRED`；
3. `src/lib/storefront-context/index.ts:67-68` 在无快照模式下刻意返回 `currentState: undefined`、`publication: undefined`；
4. `src/lib/storefront-context/core.ts:236-255` 仍执行旧 `snapshotFailClosed`，把 `currentState` 不存在解释为 SEO 失败并强制 `noindex`。

这不是历史 snapshot 数据污染，而是当前直连数据库链路仍残留以 snapshot/current-state 存在性为前提的判定。

入口还互相冲突：线上 sitemap 包含前 11 个主题 URL，但这些 URL 自身全部 `noindex`；Father’s Day 因下述合同错误不在 sitemap。

### P0-2：Engagement 公开泄漏内部发布门禁

生产页面可见文本：

> Do not index the page until real myDreamshoots product evidence is present.

数据库位置：`engagement_publishing.blocks[7].settings.text`。

同页还显示 `Engagement is not the same query as every wedding page.`。这些是 SEO/发布策略，不是客户文案，违反仓库 Public Frontend Copy Boundary。

### P0-3：Father’s Day 内容合同断裂

数据库中：

- `contentContract.requiredSections` 包含 `gallery`；
- `sections` 中存在 `fathers_day_gallery`；
- `sectionsOrder` 只有 8 项，遗漏 `fathers_day_gallery`。

后果：

- Gallery 标题、`Family dinner toast` 和正文在线上不显示；
- 页面即使在完整媒体 bundle 中仍为 `review_required`；
- 页面不进入 sitemap；
- 当前本地代码会额外显示 Gallery，而生产旧 commit 不显示，形成同库不同渲染结果。

### P0-4：生产“只读”数据库凭据实际拥有写权限

只执行权限查询得到：

```json
{
  "current_user": "dingyue",
  "transaction_read_only": "off",
  "ThemePage": {
    "select": true,
    "insert": true,
    "update": true,
    "delete": true
  }
}
```

`REMOTE_DB_READONLY_DATABASE_URL` 当前不是数据库层只读角色。虽然项目包装器标记为 `remote-readonly`，但底层凭据可写，违反 `docs/remote-database-readonly-access.md`。本次没有测试写入，也没有修改数据库。

## P1 / 高优先级问题

### P1-1：12 页 Keywords 0/12 直读数据库

Title、Description、canonical、H1、OG image 均与 DB 一致，但 `<meta name="keywords">` 12/12 被 `src/lib/mydreamshoots-tdk.ts:91-130` 按 URL、Title、Description 重新生成，调用点是 `src/lib/storefront-context/core.ts:257-263`。

例如 Christmas：

- DB：`ai christmas photo; ai christmas video; christmas ai photo maker; ...`
- SSR：`ai save the date christmas, AI Christmas Photo and Video Maker ..., myDreamshoots ai save the date christmas`

季节页因此被错误附加 `ai save the date` 关键词，也不满足 TDK 一比一。

### P1-2：内部 SEO/作者措辞仍在多页客户正文

除 Engagement 的 P0 句子外，还确认以下可见或 FAQ 数据：

- Halloween：`The keyword and topic intent support a combined page...`、`Product claims should only be published after...`、`landing-page hero`，并有 `This page therefore show...` 语病；
- New Year：`because New Year searches often cover both`；
- Father’s Day：`Can one page cover both photo and video intent?`；
- Mother’s Day：`This theme naturally aligns with family-photo intent.`；
- Wedding Ceremony：`date-announcement intent`、`RSVP intent`、页面“owns”某类内容的分类说明；
- Proposal：`The proposal page owns...`、`verify the live product privacy policy before launch.`；
- Save the Date：`not every wedding query`、`RSVP intent`。

`editorial_evidence` 区块当前被 renderer 隐藏是正确方向；不能为了追求 HTML 字面一比一而把内部 Evidence Gate 重新显示给客户。

### P1-3：Engagement 全套媒体与 Save the Date 二进制重复

12 页共有 130 个不同 URL，但按 SHA-256 只有 119 个不同二进制。Engagement 11/11 与 Save the Date 11/11 逐张相同，只换目录、文件名和 alt。

图片语义可以泛用于订婚，但严格不满足“每主题独立资源、没有串页复用”。

### P1-4：8 个线上 alt 不与数据库逐字一致

Thanksgiving 3 个、Mother’s Day 4 个、Father’s Day 1 个，共 8 个长 alt 在线上被截短。

根因不是旧 snapshot 或 CDN。`src/lib/storefront-media-alt.ts:524-569` 会把显式 DB alt 强制压缩到英文 112 字符，并优先取第一个逗号分句，因此 SSR 有意改变数据库值。

示例：

- DB：`Multigenerational family gathered around a Thanksgiving dinner table while carving turkey and sharing side dishes.`
- SSR：`Multigenerational family gathered around a Thanksgiving dinner table while carving turkey and sharing side.`

若要求数据严格一比一，应让已审核的显式 alt 原样输出，只对 fallback/generated alt 做压缩。

### P1-5：Wedding Anniversary 相邻页仍存在 SEO 串页

该页未进入截图的 12 项菜单，但数据库仍有 `/ai-save-the-date/wedding-anniversary`：

- DB SEO title/description 仍是 Save the Date 文案；
- DB canonical URL 是 `/holidays-events/wedding-anniversary`，canonicalPath 是 `/ai-save-the-date/wedding-anniversary`；
- 线上 `/ai-save-the-date/wedding-anniversary` 返回 200，H1 是 hold 页面，Title 被代码覆盖为 Anniversary，但 canonical 指向会 308 回到当前页面的旧 alias，形成 canonical/redirect 不一致。

这属于隐藏相邻主题数据串页，不能仅因未显示在菜单而忽略。

### P1-6：多页卡片标题/正文与本页图片发生轮转错配

图片 URL 没有跨主题目录，但同一主题页内部的卡片与图片配对大量错误；因此“资源属于本主题”不等于“每个内容节点一比一正确”。数据库与 SSR 都在忠实展示这些错误配对，问题位于当前关系数据本身。

已确认的高密度错配：

- Christmas：`christmas_photo_ideas` 约 6/6、`christmas_scene_ideas` 11/11 错位。例如 `Snowy Winter Landscapes` 配 Santa 帽宠物图，`Snowy cabin at dusk` 配 Christmas market couple，`Pet in a Santa hat` 配 friends selfie；
- Thanksgiving：`thanksgiving_use_cases` 6/6、`thanksgiving_scene_ideas` 11/11 轮转错位。例如 `Kids with pumpkins` 配 Friendsgiving toast，`Roast turkey feast` 配 dog porch，`Pet-friendly holiday portrait` 配 family cooking；
- Wedding Ceremony：`wedding_ceremony_scene_ideas` 约 10/11 错位。例如 `First kiss` 配 guest reaction，`Recessional` 配 bouquet，`Ring exchange` 配 officiant wide；
- Valentine’s Day：`save_date_ideas` 至少 4/5、`save_date_story_styles` 2/3 错位，例如 `Rose-garden evening` 与 `City lights` 都配 envelope；
- Proposal：`proposal_use_cases` 至少 4/7 明显错位，例如 `Beach or destination proposal` 配 rooftop couple，`After-the-yes celebration` 配 planning photos；
- Engagement：workflow 至少 3 个明显错位，例如 proposal-to-engagement 配 laptop planning、ring reveal 配 beach portrait；
- Wedding Invitation：styles 至少 4/6 与 manifest 推荐用途不符，例如 Destination 配 bridesmaid review、Minimal Modern 配 reception table、Printed Suite 配 venue display。

Save the Date 自身的 scene grid 主要正确，但 use-case 卡片也有多处图片与文案不直接对应。Mother’s Day、Father’s Day、Halloween、New Year 的主要图片语义映射未发现同等级轮转。

## P2 / 结构与渲染问题

- New Year：`ai-new-year-sparkler-closeup.jpg` 存在于 manifest、MediaAsset 和 workflow block，资源 200，但生产 SSR 不输出；12 页媒体覆盖为 129/130。
- Thanksgiving：两个 intro 存在于 section 根节点而非 `settings.intro`，renderer 不消费，SSR 丢文案。
- Wedding Invitation：`Invitation Creation Flow` 的 intro 存在于 DB，但 `editorial_steps` renderer 不输出；结构文档指定的 What Is / How It Works 图片落位也未实现。
- 8 页累计产生 74 个空 `<h3>`：Engagement 7、Father’s Day 4、Halloween 6、New Year 4、Proposal 11、Save the Date 6、Wedding Ceremony 26、Wedding Invitation 10。根因是 `src/components/theme-renderer.tsx:8724-8732` 对无 title 的 block 仍输出 heading。
- 本地与生产 T/D/H1 12/12 一致；主体文案集合除 Father’s Day 的 Gallery 外语义一致。生产 release commit 为 `ba595733e23665c89b718714a490537f37a2c123`，审计时本地/`origin/main` 为 `2457cee5217cca07948b3b6aefe105704f6cc2ba`，所以渲染结构仍有版本差异。

## 设计资料可验收性

`docs/design-packages/` 当前实际只有两个目录。

### Save the Date：唯一完整基准，但线上并非逐节点一比一

通过：

- 设计包 checksum 42/42；
- Title、Description、H1 对齐；
- 11 个图片文件、二进制、HTML path/alt 对齐；
- 当前 chips 与 HTML 一致：5 个，`Identity + Date Review`。

差异：

- 设计 canonical：`/holidays-events/save-the-date`；DB/线上：`/ai-save-the-date/save-the-date`；
- HTML secondary CTA：`#scenes`；DB/线上：`#use-cases`；
- HTML 含内部 Pre-publish / Evidence Gate，线上正确隐藏；
- 线上有 HTML 原型没有的 Output planning；
- FAQ、Hero、Definition、Use Cases、Workflow 有缩写和改写；
- 同一设计包的 Markdown 与 HTML 自身冲突：Markdown 是 6 个 chips、`Identity and Date Review`；HTML/线上是 5 个、`Identity + Date Review`。

因此应先指定“客户版 HTML”为唯一权威，并把内部 QA/Evidence Gate 移出客户页面模型，再谈自动一比一。

### Wedding Invitation：文案可部分对照，设计包不完整

通过：Title、Description、H1、canonical；6 styles、9 Do/Avoid、6 steps、8 FAQ、final CTA；10 个文件名/caption；线上 DOM alt 10/10 与 CSV 对齐。

缺口：README、manifest、SHA256SUMS 声称存在 HTML、desktop/mobile PNG、images、originals 等文件，但当前包缺 36 个 checksum 文件；没有 HTML/PNG/源图，无法做视觉/HTML/二进制一比一验收。DB manifest alt 只比 CSV 少结尾句号，标点归一后 10/10。

### 其余 10 页：无权威设计基准

Valentine’s Day、Engagement、Proposal、Wedding Ceremony、Christmas、Halloween、Thanksgiving、New Year、Mother’s Day、Father’s Day 在当前工作区没有各自独立的 `docs/design-packages` HTML/PNG/源图包。因此只能确认“当前数据库内部不串页、线上 SSR 与当前 DB 的对应关系”，不能声称“与原始设计 HTML 一比一”。

Engagement/Proposal 的 `scripts/fixtures` 中只有通用占位 CSV，不是正式设计包，不应冒充验收基准。

## 逐页结论

| 页面 | 串页结果 | 设计一比一 | 特有问题 |
|---|---|---|---|
| Valentine’s Day | 未发现外来主题 URL | 无基准 | ideas/story 图文错配；draft 与兼容 publishedJson 漂移 35 字段；全站 noindex、K 重写 |
| Engagement | 正文主题归属正确；媒体全套复用 Save Date | 无基准 | workflow 图文错配、内部 noindex 指令泄漏、7 个空 h3 |
| Proposal | 未发现整页串页 | 无基准 | use-case 图文错配、内部 page/privacy-launch 措辞、11 个空 h3 |
| Save the Date | 11 个设计图文件正确 | 有基准但不一比一 | use-case 配图、canonical/CTA/正文差异、6 个空 h3 |
| Wedding Invitation | 主体文案和 10 个文件正确 | 包残缺 | 4/6 style 配图、steps intro/图片落位、10 个空 h3 |
| Wedding Ceremony | 未发现外来主题 URL | 无基准 | scene grid 约 10/11 图文错位、intent/分类措辞、26 个空 h3 |
| Christmas | 未发现外来主题 URL | 无基准 | 两个图片区块高密度轮转错位、K 错套 Save Date |
| Halloween | 未发现整页串页 | 无基准 | SEO/产品验证措辞、语病、6 个空 h3 |
| Thanksgiving | 未发现外来主题 URL | 无基准 | use-case 6/6、scene 11/11 图文错位；2 段 intro 丢失、3 个 alt 被压缩 |
| New Year | 未发现整页串页 | 无基准 | 1 图未渲染、search-intent FAQ、4 个空 h3 |
| Mother’s Day | 未发现整页串页 | 无基准 | intent 措辞、4 个 alt 被压缩 |
| Father’s Day | 未发现整页串页 | 无基准 | orphan Gallery、合同失败、不进 sitemap、1 个 alt 被压缩、4 个空 h3 |

## 已验证的通过项

- Save the Date 菜单为 2 组 × 6 项，12 个 label/href 与 `ThemeSettings.draftJson.saveTheDateNavigation` 一致；
- 12 URL 均 200，未跳到错误主题；
- T/D/canonical/H1/OG image 12/12 与 DB 一致；
- FAQ JSON-LD 12/12 与 DB FAQ 精确一致；
- 12 页 main DOM 没有外来主题 manifest 图片；
- 没有另一主题独有的长正文整段出现在错误页面；
- 130/130 媒体有 `MediaAsset` owner，MIME/alt/尺寸与 DB manifest 对应；
- 130/130 生产 HEAD/GET 成功，均为 JPEG；
- 130/130 线上二进制与工作区同名文件 SHA-256 一致；
- 130/130 尺寸为 1600×1000；
- 除 Engagement/Save Date 的二进制复用外，其余图片文件的主题大类归属正常；但上述多个页面存在严重的“本页卡片 ↔ 本页图片”配对错误。

## 建议修复顺序

1. 移除无快照运行链中的 `snapshotFailClosed/currentState` 依赖，并让普通 editorial detail bundle 加载其 manifest 所需的当前 `MediaAsset`；复核 12 页 robots 和 sitemap 同时一致。
2. 修正 Father’s Day `requiredSections / sectionsOrder / sections`，明确 Gallery 是否应公开。
3. 清理 Engagement P0 指令及所有客户可见的 query/intent/index/product-evidence/launch 作者措辞；增加 SSR 可见文本 guard。
4. 停止覆盖已存在的 DB `seo.keywords`；仅在 DB K 为空时生成 fallback。
5. 修正只读数据库角色权限，在 PostgreSQL 层启用 `default_transaction_read_only=on` 并撤销 INSERT/UPDATE/DELETE。
6. 按 card title/text 与 image alt/caption 重新配对 Christmas、Thanksgiving、Wedding Ceremony、Valentine、Proposal、Engagement、Wedding Invitation 及 Save the Date use cases；增加语义映射回归。
7. 决定 Engagement 是否允许复用 Save Date 图片；若要求每主题独立，则替换 11 张真实独立资产。
8. 显式 alt 原样渲染，仅压缩自动 fallback；修复 New Year、Thanksgiving、Wedding Invitation 的未消费字段和 74 个空 heading。
9. 修复/下线 Wedding Anniversary 隐藏页的 Save Date SEO 和 canonical/redirect 冲突。
10. 补齐 10 个缺失设计包和 Wedding Invitation 缺失文件；先统一 Save Date 包内 HTML/Markdown 冲突，再建立可自动比较的节点 ID 基准。
