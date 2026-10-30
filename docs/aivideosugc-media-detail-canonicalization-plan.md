# AIVIDEOSUGC 素材详情页收敛去重计划（canonical 化）

> 2026-10-30 整理，**已于当日执行完成**（manifest planHash `a132b8a8…`，
> apply report + inverse rollback manifest 见 `scripts/manifests/`，生产
> SiteContentRevision 推进至 3101）。执行后生产实测：详情页 1032 → **459**
> （video 365 / photo 94），0 多归属；规范页 200、被摘 slug 404、CTA 进
> 工作台正常。模板级 facet 数据来自生产 `LivePage.contentJson` 只读读回。

## 1. 目标模型（站长的产品规划）

**一个产品（同参考图 + 同提示词）= 一条规范详情页。** 多个目录/模板引用同一产品时，
全部跳转到同一条详情页，而不是每个引用点各生一条重复页。

详情页可打分类标签：用什么工具生成（tool）、类型（photo/video）、题材（industry/
platform/occasion）——对应现有 `templateDefinition/card` 上的 `placement[]` 字段
（canonical facet 目录路径数组），facet 页「More examples」媒体网格即由 placement 聚合，
后续可在详情页渲染标签 chips。**标签化与本次去重解耦，可分步实施。**

## 2. 现状（生产读回，2026-10-30）

详情页总数 **1032**（video 938 / photo 94），按卡片来源：

| 来源形状 | slug 数 | 前端可见 |
|---|---|---|
| workspaceCase（案例副本） | **703** | ❌ 不渲染成任何链接，孤儿页 |
| picker（工具页卡） | 208 | ✅ |
| exampleGallery（hub 图库） | 27 | ✅ |
| templateCard（模板卡） | 9 | ✅ |

**重复的根源**：同一案例（scene，如 "Bathroom Review: Moisturizer"）被复制到多个模板页，
每份带模板名后缀的独立 slug（`<scene>-ai-video-generation-<模板>`、`…-templates` 等）。
案例变体数分布极不均匀：

| 变体数/案例 | 案例数 |
|---|---|
| 19 条（9 视频 + 9 图片模板页 + 1 /templates） | 18 |
| 10–17 条 | 6 |
| 5–9 条 | 15 |
| 2–4 条 | 41 |
| 1 条 | 62 |

- 视频案例共 **130 个**（占 703 条 slug）；图片案例 12 个（12 条，无重复）。
- 案例与可见形状（picker/gallery/template）**零重叠**——案例产品只存在于 workspaceCase 副本中。
- 可见形状内部仅 **2 组重复**：`Lifestyle App Recommendation`、`Streamer Reaction: App`
  （各 2 条 slug，一条裸 slug + 一条 `-ai-video-generation` 后缀）。

## 3. 处理量

| | 数量 |
|---|---|
| 摘掉 `publicSlug` 的案例副本（保留每案例 1 条规范页） | **573 条**（全部为视频案例副本） |
| 保留的案例规范页 | 130（视频）+ 12（图片）= 142 |
| 整改后详情页总数 | **1032 → 459**（video 365 / photo 94） |
| 可选：清掉可见形状 2 组重复（每组摘 1 条） | 再 -2 → **457** |

**规范页选择规则（待确认）**：优先保留最短 slug（即 `/templates` 页持有的
`<scene>-templates` 基础变体，35 个案例有）；其余案例按确定性规则（owner 页路径 +
slug 字典序）取第一条。也可改为"挂在题材最相关模板页的那条"，规则需站长拍板。

## 4. 影响面评估

**不受影响（好的方面）：**
1. **工作台入口流程不变**：规范页 CTA → entry cookie → `resolveWorkspacePublicScenePreset`
   按 publicSlug 找到恰好 1 个 owner 页 → preset 解析正常（依赖 `pages.length === 1`，
   收敛后每 slug 恰好 1 owner，比现在更稳）。
2. **不删任何素材数据**：只摘 workspaceCase 卡片上的 `publicSlug` 字段，卡片本体、
   提示词、参考图全部保留，工作台内案例功能不受影响。
3. **SEO 无损**：被摘的 573 条全部 noindex、无内部链接指向、搜索引擎未收录，
   无流量损失。

**需要接受/处理的：**
1. **573 条 URL 将 404**：均为从未对外曝光的孤儿 URL，直接 404 即可（不建议做 573 条
   重定向）。已抽测此类 URL 现状 200 → 收敛后 404，属预期。
2. **回归检查口径需同步修改**：现套件有一项 "every media card must own a detail route"
   （当前已有 45 条有意失败）。收敛后无 publicSlug 卡片增至 ~600+，该项需改为
   "仅 canonical 卡应持有 publicSlug（每产品恰好 1 条）"，否则部署回归长期红。
3. **详情页"相关推荐"池变小**：related 来自同 owner 页卡片，收敛后部分规范页的
   related 列表条目减少（不影响功能）。
4. **文件级 manifest 数量大**：~573 个字段 patch，分布在 19+ 个 LivePage 行；
   逐行 CAS + 读回断言，脚本化执行。

## 5. 实施步骤（确认后执行）

1. **生成 plan**：新脚本读当前生产 LivePage（只读），按 §3 规则产出
   `scripts/manifests/aidreamcapes-media-canonical-<date>.json`——每条 patch 含
   `pageSlug / sectionId / cardIndex / before(publicSlug) / after(删除)` + CAS 基准
   （updatedAt）。
2. **本地演练**：本地库重放 manifest，断言：整改后详情页总数 459、每 slug 恰好
   1 owner、抽测规范页 200 + CTA 进工作台 A/B 正常、抽测被摘页 404。
3. **回归口径更新**：修改 storefront 回归检查为 canonical 语义（代码改动，随本次发布）。
4. **生产应用**：字段级 manifest + compare-and-set + 每行读回断言（禁全站生成、
   禁快照回滚）；在线编辑优先，冲突即停。
5. **生产验证**：总数断言、抽测规范页/CTA、部署回归套件全绿、edge 缓存清理。
6. **回滚方案**：inverse manifest（把 publicSlug 原值写回对应卡片），同样 CAS 执行。

## 6. 与标签化的衔接（后续任务，不在本次范围）

- 规范页卡片补全 `placement[]`（tool/type/topic → facet 路径）；
- 详情页渲染标签 chips 并链接到对应 facet 页；
- facet 页「More examples」自然聚合规范页素材。

## 7. 第二遍收敛：同图同提示词合并（2026-10-30 已执行）

第一遍以「标题+图片」为产品键；复查发现视频详情页存在**同参考图+同提示词、
仅标题不同**的簇（每个模板页给同一素材起了不同标题）。第二遍以
「(参考图, 提示词)」为键重新聚类（prompt md5），合同
`aidreamcapes-media-canonical-pass2-2026-10-30-v1`，manifest planHash
`7002e2bb…`：

- 23 个簇、摘除 92 条（90 条 workspaceCase 副本 + 2 条 picker 卡地址）、
  15 个页面；`SiteContentRevision` 3101 → 3116；
- 视频详情页 365 → **273**，全站 459 → **367**（视频 273 / 图片 94）；
- 2 条 picker 卡（Lifestyle App Recommendation、Streamer Reaction: App 的
  `-ai-video-generation` 地址）此前已由 `detailAliasOf` 别名机制合并到规范页
  （卡片渲染链接与 URL 解析均指向规范页），本次摘除其 `publicSlug` 并把
  `href` 固化为规范详情路径，旧地址按 2026-10-30 策略 404（无重定向），
  `scripts/lib/aidreamcapes-internal-links.mjs` 的记录同步更新；
- 判定为「非重复」的同标题不同素材页（35 组，提示词均不同）保留；
- 回归口径同步更新：`audit-card-entry-links.mjs` 的 picker 卡规则改为
  「有 `publicSlug` **或** href 指向规范详情路径」；
- 生产实测：规范页 200、被摘地址 404、工具页两张卡渲染规范详情链接、
  `/templates` 正常；审计与部署门禁口径与数据一致。

