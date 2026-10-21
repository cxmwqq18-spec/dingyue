# AIVideosUGC 媒体详情页分类归档与目录投放设计

> 状态：**产品级方案已确认（A）；Phase 1 代码已按产品分组修订；本地 19 个产品试点已应用；生产尚未写入**
> 站点范围：仅 `site_aidreamcapes`（`www.aivideosugc.com` / `www.aidreamcapes.com`）
> 日期：2026-10-21
> 关联文档：
> - `docs/plans/aidreamcapes-template-directory-data-chain-audit-2026-10-21.md`（§2.4 维度缺失、§6 Phase 2）
> - `docs/plans/aidreamcapes-remediation-consolidation-2026-10-21.md`（§5 待决策项）
> - `docs/plans/aidreamcapes-media-detail-link-remediation-2026-10-21.md`（路由层权威，本文不改路由）
> - `AGENTS.md`（SSR 数据规则、no-snapshot、店铺隔离）

---

## 0. 2026-10-21 修订：产品级分组（取代初版卡片级表述）

用户已确认口径 A：**一张图片/视频素材 = 一个产品**。初版把 987 个 `publicSlug` 当作 987 个独立产品，这个口径不成立，以下内容取代初版的卡片级表述。

### 0.1 只读审计结果（本地 `site_aidreamcapes`）

脚本：`scripts/audit-aidreamcapes-media-products.mjs`  
机器报告：`docs/audits/aidreamcapes-media-product-groups-2026-10-21.json`  
可读摘要：`docs/audits/aidreamcapes-media-product-groups-2026-10-21.md`

| 项目 | 结果 |
|---|---:|
| 提取的页面卡 | 1,005 |
| 唯一 `publicSlug` | 987 |
| 产品组（按素材） | **285** |
| 多卡产品组中的卡片 | 775 |
| 同一素材被复制成多个 slug 的组 | **37** |
| 这些组涉及的卡片 | **739** |
| 单产品最多卡片数 | 21 |
| label 变体冲突组 | 18 |
| 模板产品组 | 18（每组 2 张同 slug 卡） |

37 组里最典型的是 20–21 张同一素材、同一产品的页面副本。按卡片打标会让同一产品重复 20 次，目录页重复展示，标签还会互相漂移。

### 0.2 修订后的数据契约

产品身份不依赖 `publicSlug`，而是：

```text
productKey = kind + video.src（无 video 时用 image.src / poster）
```

- 页面卡是产品的**引用/上下文**，不是独立产品。
- `placement` 是产品级标签；只需写在组内一张规范卡上，所有同素材详情页都继承。
- 目录页按 `productKey` 分组，同一产品只渲染一次；代表卡按“模板定义 > picker > 首页 > 短 slug”稳定选择。
- 详情页按 `productKey` 聚合 `placement`；访问任一别名 slug 都显示同一组目录，不因页面副本不同而分类不同。
- 模板产品组同样按素材分组；模板的目录归属仍以其 `templateDirectory.paths` 为准，避免 definition 与 paths 两个真源。模板卡不写显式 `placement` 的规则保留。
- 目前 `productKey` 由运行时/审计按素材派生，不新增数据库字段；若素材 URL 会变，再引入显式 `productKey` 回填。

### 0.3 被本修订取代的初版表述

- §1.1 “每一张媒体卡片上新增 `placement`” → 改为“每个产品组的一张规范卡”。
- §1.2 的“非模板卡” → “非模板产品卡（media/product card）”；这是存储角色，不是产品分类。
- §3.1 的 987 张是**页面卡**，不是 987 个产品；产品组为 285。
- §5.1 的写入位置 → 产品组的规范卡；允许同组其他卡暂时保留空 `placement`。
- §8.3 的去重键 → `productKey`，不是 `kind + publicSlug`。
- §9.1 manifest 的定位键 → `productKey + 规范 publicSlug + mediaSrc`，不再按每个页面副本逐条写入。
- §10.1/10.2 的“张数” → 产品组数；试点为 20–30 个产品组。
- 其余 SSR、详情页 UI、目录页区块、CAS、无 snapshot、店铺隔离约束不变。

### 0.4 本地试点已应用（2026-10-21）

目标：本地 `site_aidreamcapes`，只写当前 `LivePage.contentJson`，不写 publication/snapshot。

| 项目 | 结果 |
|---|---:|
| 试点产品组 | **19**（18 个重复组 + `canvas-tote-product-detail`） |
| 覆盖页面卡 | **359** |
| 写入页面 | 2（`/`、`/ai-video-generation/video-ads`） |
| 字段级写入 | **19 个 `placement`** |
| 计划哈希 | `50f92826749d7b8ef59573ac98dc81e5630ccb4abaf911275ae37dde2e535722` |
| `SiteContentRevision` | **8 → 10**（两页各触发一次） |
| MyDreamShoots 内容指纹 | 应用前后一致 |

manifest / 应用证据：

- `scripts/manifests/aidreamcapes-media-product-pilot-selection-2026-10-21.json`
- `scripts/manifests/aidreamcapes-media-product-placement-local-2026-10-21.json`
- `scripts/manifests/aidreamcapes-media-product-placement-local-2026-10-21-apply-report.json`
- `scripts/manifests/aidreamcapes-media-product-placement-local-2026-10-21-post-apply.json`

目录页读回（每张产品卡 = 唯一 href + 唯一素材）：

| 目录 | 产品卡 |
|---|---:|
| `/industries/beauty-skincare` | 3 |
| `/industries/electronics` | 2 |
| `/industries/fashion-clothing` | 4 |
| `/industries/food-drinks` | 3 |
| `/industries/health-wellness` | 1 |
| `/industries/jewelry-accessories` | 4 |
| `/industries/shoes` | 8（6 条既有外部编辑 + 2 条本试点） |

详情页读回：19 个规范 slug + 18 个别名 slug，共 37 页；分类 chip 全部与规范卡一致，0 假归属。

3 个有歧义的映射按建议应用，review note 保留在 manifest 中：

- `Kitchen Appliance Evening Demo Reel` → `/industries/electronics`（chip 是 tech-electronics）
- `Berry Bowl First Bite Reel` → `/industries/food-drinks`（label 是食物，chip 是 health-fitness）
- `Quiet Unboxing: Makeup Tools` → `/industries/beauty-skincare`（内容是化妆工具，chip 是 accessories）

如果内容团队改判，按同一产品组生成字段级 inverse manifest 并 CAS 回写，不覆盖其他字段、不碰历史 publication。

当前本地共 **25 个产品组**带 `placement`：上述 19 个 + 审计期间出现的 6 个 `/industries/shoes` 单卡产品。其余 944 张媒体卡仍未投放，未做全量回填。

复现脚本：

```bash
npm run audit:aidreamcapes-media-products
node scripts/plan-aidreamcapes-media-product-placement.mjs --target=local
node scripts/apply-aidreamcapes-media-product-placement.mjs --target=local
npm run smoke:aidreamcapes-media-product-placement
```

---

## 1. 结论摘要

### 1.1 推荐方案

> 以下是初版卡片级描述；产品级修订见 §0。`placement` 应写在产品组的规范卡上，同素材页面副本共享。

在媒体卡片上新增一个可选的 `placement` 字段：

```json
"placement": ["/industries/jewelry-accessories", "/platforms/instagram-ads"]
```

- 值是**规范目录页的 slug**，不是标签文字，也不是旧的 `chips` id。
- 详情页只展示「点过去真的能看到这张卡」的目录，按 Industry / Platform / Occasion / Catalog 分组。
- 目录页新增一个「More {label} examples」媒体网格，服务端直接读取带该 `placement` 的卡片。
- 打一个标签 = 详情页多一个可点击目录 + 目录页真实多一张卡；两者同源，不会出现“有标签但目录里找不到”。

### 1.2 关键判断

| 判断 | 结论 |
|---|---|
| 是否复用现有 `chips` | **否**。19 个旧 chip 是页内筛选器，和 17 个目录不是同一套；`footwear` / `shoes`、`beauty-personal-care` / `beauty-skincare` 等并不等价 |
| 是否新增 `TemplateFacet` 表 | **否（本阶段）**。目录集合很小且是策展数据，放在 `LivePage.contentJson` 内即可；不引入迁移，不破坏“公开内容只读 `LivePage.contentJson`” |
| 是否让非模板卡片继承模板 facets | **否**。715 张 workspace case 并不在模板页公开渲染，继承会产生“目录里有链接、点进去找不到”的假归属 |
| 是否改路由 / sitemap / robots | **否**。987 条详情页继续 `noindex, follow`，不进 sitemap |
| 是否需要全站生成 / snapshot | **否**。只做字段级 manifest、逐页 CAS、线上读回 |
| 首批可见效果 | 18 张模板卡详情页立即有完整分类；本地试点 19 个产品组（含截图页 `canvas-tote-product-detail`）已获得目录并在目录页出现 |

### 1.3 一句话

**归属不是“声明了什么标签”，而是“目录页实际渲染了哪张卡”。** 本设计让 `placement` 同时驱动这两件事。

---

## 2. 需求口径

### 2.1 功能需求

| 编号 | 需求 | 验收口径 |
|---|---|---|
| R1 | 详情页列出该媒体可被找到的**全部**分类/目录路径 | 按维度分组，链接完整，不遗漏已投放目录 |
| R2 | 每个链接必须真实可达 | 目标目录页的 HTML 中必须出现该媒体的详情链接，或出现其模板页链接（仅模板卡） |
| R3 | 新增视频/图片可打标，精确进入目录 | 只改卡片 `placement`，目录页自动出现；不逐页改 17 个目录 |
| R4 | 公开页 SSR-only | 完整 HTML；禁用 JS 后分类链接仍在；无客户端 fetch/XHR |
| R5 | 可运营、可回滚 | plan/apply、逐字段 CAS、读回；无 snapshot、无全站生成 |
| R6 | 仅 Aidreamcapes | 不写 MyDreamShoots 任何数据/页面/路由/SEO；`git diff` 可逐文件核对 |

### 2.2 “能被找到”的定义

本设计只承认三种真实路径：

1. **直接投放**：目录页的媒体网格里出现这张卡的详情链接。
2. **模板卡投放**：目录页的模板网格里出现这张卡所属的模板页，且这张卡就是该模板的 `templateDefinition.card`。
3. **目录集合**：`/templates` 或 `/templates/{photo|video}` 的模板网格里出现该模板页（仅模板卡）。

以下**不算**：

- 卡片只在某个 owner 页出现，但 owner 页不在任何目录里；
- `workspaceCases` 只在 `contentJson` 里存在、公开页没有渲染；
- 模板 definition 声明了某个 facet，但对应目录页的 `templateDirectory.paths` 没有列该模板；
- 旧 `chips` 里有某个值，但没有对应的目录页。

> 这条口径是本文最重要的约束。它直接排除了“给 715 张 case 继承模板 facet”的做法。

---

## 3. 现状读回（2026-10-21，本地关系库）

### 3.1 媒体卡规模

`site_aidreamcapes` 当前 269 条 `LivePage`，带 `publicSlug` 的唯一媒体卡 987 张：

| 卡片形态 | 数量 | 当前公开渲染位置 | 当前目录归属 |
|---|---:|---|---|
| `templateDefinition.card` | 18 | 模板页的 picker | 通过 `templateDirectory.paths` 进入 17 个 facet 中的若干 + `/templates*` |
| 其他 picker card | 224 | owner 页的 picker（首页 / 工具页 / hub） | 无 |
| example card | 30 | owner 页的 example gallery | 无 |
| workspace case | 715 | **公开页不渲染**（仅详情页 / related 网格） | 无 |
| **合计** | **987** | | |

> **产品级修订：** 上表的 987 是页面卡数量，不是产品数量。按素材分组后为 **285 个产品组**；37 组、739 张卡是同一素材的页面副本。详见 §0 和 `docs/audits/aidreamcapes-media-product-groups-2026-10-21.json`。

补充事实：

- 987 张卡的 `kind + publicSlug` 无重复；详情解析要求“唯一 owner”，当前成立。
- 卡片分布在 33 个 owner 页。
- 其中 673 张非模板卡位于 18 个模板页上（666 张 case + 7 张 example），但模板页并不渲染这些 case。
- 其余 296 张非模板卡位于非模板页（首页、工具页、hub、facet 页）。

### 3.2 目录页规模

| 维度 | 数量 | 页面 |
|---|---:|---|
| Industry | 8 | `/industries/beauty-skincare`、`electronics`、`fashion-clothing`、`food-drinks`、`health-wellness`、`home-living`、`jewelry-accessories`、`shoes` |
| Platform | 6 | `/platforms/amazon-product-photos`、`facebook-ads`、`instagram-ads`、`shopify-product-photos`、`tiktok-ads`、`youtube-shorts-ads` |
| Occasion | 3 | `/occasions/black-friday`、`holidays`、`sale-discount` |
| Catalog | 3 | `/templates`、`/templates/photo`、`/templates/video` |

17 个 facet 页都有 `data.kind`（`industry` / `platform` / `occasion`）和 `data.label`；3 个 catalog 页没有 `kind`。

### 3.3 模板 facets 与目录 paths 的一致性

18 个模板页的 `templateDefinition` 都带 `industries` / `platforms` / `occasions`。反向索引 20 个目录页的 `templateDirectory.paths` 后：

- 18/18 模板都在 `/templates` 的 paths 中；
- 17 个 facet 页中，**0 个**出现“definition 声明了但 paths 没列”的偏差；
- 每个模板还额外出现在 `/templates` 与 `/templates/{kind}`（catalog，不属于 facet）。

这说明当前“模板级归属”是健康的，可以作为模板卡的可靠数据源。

### 3.4 旧 `chips` 不是目录体系

- `scripts/data/aidreamcapes-site-v2/template-wall.json` 的 19 个 chip（`pet`、`accessories`、`apparel`、`apps`、`beauty-personal-care`、`clothing`、`e-commerce`、`education`、`explainer`、`financial-services`、`food-beverage`、`footwear`、`health-fitness`、`jewelry-accessories`、`kids-toy`、`sports-gym`、`tech-electronics`、`ugc`、`viral`）是页内筛选器。
- 其中只有一部分能语义映射到 8 个 industry；`apps`、`e-commerce`、`education`、`explainer`、`financial-services`、`ugc`、`viral` 等没有对应目录。
- 值也不一致：`footwear` → `/industries/shoes`，`beauty-personal-care` → `/industries/beauty-skincare`，`tech-electronics` → `/industries/electronics`。
- 因此 `chips` 只能作为**回填建议**，不能作为线上归属来源。

### 3.5 截图页现状（试点前）与结果

`/ai-video-generation/canvas-tote-product-detail`：

- owner 是 `/` 的 picker；
- `kind: "video"`；
- `chips: ["accessories"]`；
- `publicSlug: "canvas-tote-product-detail"`；
- 试点前不属于任何 facet 目录，详情页没有分类可列。

本地试点已按示例应用：

```json
"placement": ["/industries/jewelry-accessories"]
```

读回结果：详情页出现 `Jewelry & Accessories`；`/industries/jewelry-accessories` 的媒体网格出现这张卡且只出现一次。完整证据见 §0.4、§10.5。

---

## 4. 设计原则

1. **渲染包含优先于声明**：只在目标页真的会渲染该卡时展示链接。
2. **单一目录注册表**：17 个 facet 页就是分类体系；不另建一套标签表。
3. **卡片上的 `placement` 是唯一写入点**：目录页媒体网格由它派生，不维护第二份 `items` 数组。
4. **模板卡走反向索引**：模板卡的 facets 以目录页 `templateDirectory.paths` 为准，避免 definition 与 paths 漂移。
5. **SSR-only**：详情页分类块、目录页媒体网格都是服务端渲染；无客户端数据请求。
6. **无快照、无全站生成**：只读写当前 `LivePage.contentJson`；字段级 manifest + CAS + 读回。
7. **Aidreamcapes 隔离**：所有改动限定在 `site_aidreamcapes` 使用的代码/数据路径；共享层改动必须停下请求授权。

---

## 5. 数据契约

### 5.1 `placement` 字段

位置：**产品组的一张规范卡**（picker card / example item / workspace case 均可；模板卡不允许显式 placement，见 5.3）。同组其他页面副本可以没有 `placement`，运行时按素材身份聚合，不需要重复写 20 份。

类型：

```ts
/** 规范目录页 slug 数组；排序、去重、只允许 17 个 facet 页。 */
type MediaPlacement = string[];
```

约束：

- 值必须匹配 `^/(industries|platforms|occasions)/[a-z0-9-]+$`；
- 必须存在对应 `LivePage`；
- 页面 `data.kind` 必须与路径前缀一致（industries → industry，platforms → platform，occasions → occasion）；
- 不允许 `/templates*`（catalog 不是媒体投放目录）；
- 不允许旧 chip id、标签文字、外链；
- 写入时排序去重；读取时再次过滤，脏数据不会变成公开死链。

示例：

```json
{
  "label": "Canvas Tote Product Detail",
  "publicSlug": "canvas-tote-product-detail",
  "kind": "video",
  "placement": ["/industries/jewelry-accessories"]
}
```

### 5.2 有效归属（effective placement）

| 产品/卡片 | 有效归属来源 | 说明 |
|---|---|---|
| 模板产品（`ownerTemplate.cardSlug === slug`） | 模板 `industries + platforms + occasions`，再按目录页 `paths` 反向过滤 | 只保留真的列了该模板页的目录 |
| 非模板产品组 | 同素材所有页面卡 `placement` 的并集 | 写在一张规范卡上即可；别名详情页继承 |
| 无 `placement` 的非模板产品组 | 空 | 详情页不显示分类块，宁缺毋假 |

非模板产品的同组 `placement` 如果出现冲突，审计脚本报错，不静默合并成不可解释的结果；试点阶段只允许写规范卡，其他副本保持空值。

模板卡还会额外获得 catalog 归属：

- `/templates`（若 paths 含模板页）
- `/templates/{kind}`（若 paths 含模板页）

### 5.3 模板卡不允许显式 `placement`

模板卡已经有 `templateDefinition` 的 facets。若允许再写一份 `placement`，会出现两个真源，且目录页模板网格与媒体网格可能重复。规则：

- 模板卡的分类编辑入口是模板 definition + 目录页 paths；
- 校验脚本发现模板卡带 `placement` 直接报错；
- 目录页媒体网格跳过模板卡（它已经在模板网格里）。

### 5.4 为什么不新增表

- 公开内容规则要求公开页只读 `LivePage.contentJson`；新增表会引入第二数据源和迁移。
- 目录集合只有 17 个 facet，且是人工策展；不需要可计算的维度表。
- `placement` 是内容字段，适合字段级 manifest、CAS、线上读回。
- 若未来查询规模需要，可从 `LivePage` 派生只读投影表，但投影永远不是源。

### 5.5 为什么不复用 `tags` / `filterTags`

- `tags` 只在 8 个页面出现，不是全站媒体字段；
- `filterTags` 是页内筛选器，语义与目录不同；
- 复用会让“页内筛选”和“公共目录”耦合，后续无法独立演进。

---

## 6. 详情页 UI 设计

### 6.1 位置

`media-detail.tsx` 右栏，顺序：

```
eyebrow
H1
lead
specs (Format / Length / Tool)
【Browse by category】   ← 新增
CTA 按钮组
note
```

不放进面包屑，不新增第二条面包屑。面包屑继续是：

```
Home / AI Video Generation / <card label>
```

分类块是“发现路径”，面包屑是“层级位置”，两者职责不同。

### 6.2 分组与顺序

固定顺序，只渲染非空组：

1. **Industry**
2. **Platform**
3. **Occasion**
4. **Catalog**（仅模板卡）

每组内按目录 label 字母序，链接文案直接用目录页的 `data.label`（例如 `/industries/shoes` 显示 `Footwear`，不是 slug）。

### 6.3 示例

模板卡 `/ai-video-generation/cinematic-video-brand-film`：

```
Browse by category
Industry   Footwear · Jewelry & Accessories · Tech & Electronics
Platform   YouTube Shorts
Catalog    Templates · Video Templates
```

截图页打标后：

```
Browse by category
Industry   Jewelry & Accessories
```

### 6.4 结构示意

```tsx
{placements.length ? (
  <nav aria-label="Browse by category" className="v-detail-categories" data-media-categories="true">
    <div className="eyebrow">Browse by category</div>
    <dl>
      {placements.map((group) => (
        <div key={group.kind}>
          <dt>{group.label}</dt>
          <dd>
            {group.links.map((link) => (
              <a className="chip" href={r.href(link.href)} key={link.href}>{link.label}</a>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  </nav>
) : null}
```

要点：

- 用普通 `<a>`，不用 `WorkspaceEntryLink`。详情页必须保持恰好一个 `data-workspace-entry` CTA，现有 parity gate 会断言这一点。
- `r.href` 处理 `/site/aidreamcapes` 路径模式，host 模式不带前缀。
- 不加 `target="_blank"`，不加 query/hash。
- 禁用 JS 后链接仍可用。

### 6.5 样式

复用全站 `.chip`，新增 scoped CSS：

```css
#media-detail .v-detail-categories{
  margin:0 0 26px;padding-top:18px;border-top:1px solid var(--line)
}
#media-detail .v-detail-categories dl{
  display:grid;gap:10px;margin:10px 0 0
}
#media-detail .v-detail-categories dl>div{
  display:grid;grid-template-columns:92px minmax(0,1fr);gap:12px;align-items:start
}
#media-detail .v-detail-categories dt{
  padding-top:6px;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;opacity:.6
}
#media-detail .v-detail-categories dd{
  display:flex;flex-wrap:wrap;gap:8px;margin:0
}
#media-detail .v-detail-categories .chip:hover{
  border-color:var(--line-2);color:var(--ink)
}
@media(max-width:520px){
  #media-detail .v-detail-categories dl>div{grid-template-columns:1fr;gap:4px}
  #media-detail .v-detail-categories dt{padding-top:0}
}
```

### 6.6 空状态

`placements.length === 0` 时整块不渲染。不显示 “Uncategorized”“No categories” 或内部提示。

### 6.7 不做的 UI

- 不做多面包屑；
- 不做客户端筛选动画；
- 不显示旧 chips（`ugc`、`viral`、`example` 等不是目录）；
- 不显示“建议标签”或任何内部运营信息；
- 不改 `<title>` / canonical / robots。

---

## 7. 目录页承载

### 7.1 新增区块

在 17 个 facet 页（不是 `/templates*`）的模板网格下方新增：

```
More {label} examples
[媒体卡 1] [媒体卡 2] ...
```

例如 `/industries/jewelry-accessories` → `More Jewelry & Accessories examples`。

- 只在该 facet 有 `placement` 卡片时渲染；
- 没有时整块不渲染；
- 不显示“暂无”。

### 7.2 卡片形态

复用现有 `.tgrid` / `.tc` 样式：

```tsx
<article className="tc" data-directory-media={card.slug}>
  <a className="ti" href={r.href(card.href)}>
    <img
      alt={card.image.alt || card.label}
      decoding="async"
      height={card.image.h ?? 640}
      loading="lazy"
      src={r.asset(card.image.src)}
      width={card.image.w ?? 640}
    />
  </a>
  <div className="tb">
    <span>{card.kind === "photo" ? "Photo" : "Video"}</span>
    <h3><a href={r.href(card.href)}>{card.label}</a></h3>
  </div>
</article>
```

- 链接目标：媒体详情页（`/ai-{image|video}-generation/<slug>`），不是 owner 页。
- 不显示 `publicSlug`、内部 key、prompt。
- `data-directory-media` 仅用于审计，不是用户可见文案。

### 7.3 与现有筛选器的关系

目录页现有 `kind` / `industries` / `platforms` / `occasions` 四个 GET 筛选器作用于**模板网格**。媒体网格：

- 只响应 `kind`（photo/video）筛选；
- 不响应 facet 筛选（当前页面已经是一个 facet，媒体卡的 placement 只可能包含当前 facet）；
- 其余情况下展示全部已投放卡片；
- 全部服务端渲染，不引入客户端过滤。

如果实现成本需要压缩，第一版可以完全忽略筛选器，始终展示该 facet 的全部媒体卡；但必须在区块标题里保持“examples”语义，避免用户以为它被筛选了。

### 7.4 数量控制

第一版**全量渲染**该 facet 的已投放卡片，因为投放是人工策展，初期数量可控。审计脚本对每个 facet 设软阈值（建议 48），超过时给出 warning，提醒策展或后续分页；不自动截断，避免“详情页说在目录里、目录页却看不到”的假归属。

后续若单页超过阈值，再做 SSR 分页或“See all”子路由，仍不引入客户端数据请求。

### 7.5 目录页 SEO

- 不新增 H1；媒体区块用 H2。
- 目录页原有 canonical / title / description 不变。
- 详情页继续 `noindex, follow`，不进 sitemap；新增内链只帮助发现，不改变索引策略。
- 不对媒体卡生成新的结构化数据。

---

## 8. 解析与查询实现

### 8.1 共享卡片提取

当前 `media-detail.server.ts` 里的 `cardValues` / `toDetailCard` 同时被详情页和 workspace preset 使用。建议抽到：

```
src/lib/aidreamcapes-workspace/media-cards.server.ts
```

导出：

- `cardsFromContent(contentJson)`：templateDefinition.card + picker + workspaceCases + examples；
- `toDetailCard(value)`：统一成 `MediaDetailCard`；
- `templateDefinitionFrom(contentJson)`：取模板 definition。

详情解析、目录媒体解析都复用它，避免四套卡片形态各写一遍。

### 8.2 详情页解析流程

`resolveMediaDetail` 增加：

```ts
ownerTemplate?: {
  path: string;
  name: string;
  cardSlug?: string;
  facets: string[]; // industries + platforms + occasions
};
```

`MediaDetailCard` 增加：

```ts
placement?: string[];
```

`resolveMediaPlacements(detail)`：

1. 若 `detail.ownerTemplate?.cardSlug === detail.slug`：
   - 读取 20 个目录页；
   - 对每个 facet 页，若 `paths.includes(detail.ownerPath)`，加入该组；
   - 对 `/templates` 和 `/templates/{kind}`，若 `paths.includes(detail.ownerPath)`，加入 Catalog；
   - label 取目录页 `data.label ?? title`。
2. 否则：
   - 读取 `detail.card.placement`；
   - 逐个校验：slug 存在、是 facet 页、`data.kind` 与前缀一致；
   - 非法值静默丢弃（公开页不产生死链），审计脚本报错；
   - 按 kind 分组，label 取目录页。
3. 返回 `MediaPlacementGroup[]`，空数组则不渲染。

调用点：`renderAidreamcapesMediaDetailPage`，在 `resolveMediaDetail` 之后调用一次，传给组件。metadata 不需要调用，避免重复查询。

### 8.3 目录页解析流程

`resolveDirectoryMedia(facetSlug)`：

```sql
SELECT "slug", "contentJson"
FROM "LivePage"
WHERE "siteId" = 'site_aidreamcapes'
  AND jsonb_path_exists(
    "contentJson",
    '$.**.placement[*] ? (@ == $facet)',
    jsonb_build_object('facet', ${facetSlug})
  )
```

然后在 JS 中：

1. `cardsFromContent` 提取卡片；
2. 只保留 `placement` 数组包含 `facetSlug` 的卡；
3. 跳过模板卡（`templateDefinition.card` 的 slug 相同）；
4. 要求 `publicSlug`、`label`、`image.src`、`kind` 齐全；
5. **按 `productKey`（kind + video/image src）分组**，不再按 `kind + publicSlug` 去重；
6. 每组选一张代表卡：首页/模板页优先、slug 更短优先，保证同一产品只出现一次；
7. 排序：owner 页 slug、代表卡 slug；
8. 映射为 `{ slug, label, kind, href, image }`。

详情页解析同样按 `productKey` 聚合：同素材的 20 张页面副本共享同一组 `placement`，访问任意别名详情页都显示相同目录。

`href` 用 `mediaDetailPath(kind, slug)`，不拼 owner 页。

### 8.4 服务端接入

`template-directory.server.tsx` 当前只读 `templateDirectory.paths` 对应的模板。增加：

```ts
const pagePath = props.pagePath; // 目录页自身 slug
const kind = data.kind; // industry / platform / occasion
const media = kind ? await resolveDirectoryMedia(pagePath) : [];
resolved = {
  ...data,
  directoryTemplates: all,
  directoryLabels: ...,
  directoryMedia: media
};
```

`template-directory.tsx` 读取 `data.directoryMedia` 渲染 7.2 的网格。

### 8.5 新鲜度与缓存

- 不做跨请求 TTL 缓存；默认每次请求读当前 `LivePage` 行，符合“下一次请求生效”。
- 若后续需要缓存，只能使用现有 `SiteContentRevision` 作为键的一部分，不能只用 TTL；且 `LivePage` 仍是唯一源。
- 详情页最多增加 1 次 20 行查询；目录页最多增加 1 次 268 行 JSONB 扫描。按当前数据量可接受，上线前测 p95；若目录页回归明显，再加 revision-keyed 缓存。

### 8.6 预计改动文件

| 文件 | 改动 |
|---|---|
| `src/lib/aidreamcapes-workspace/media-cards.server.ts` | 新增：共享卡片提取 |
| `src/lib/aidreamcapes-workspace/media-placement.ts` | 新增：类型、分组、slug 校验 |
| `src/lib/aidreamcapes-workspace/media-placement.server.ts` | 新增：目录注册表、详情归属、目录媒体解析 |
| `src/lib/aidreamcapes-workspace/media-detail.ts` | `MediaDetailCard` 增加 `placement?` |
| `src/lib/aidreamcapes-workspace/media-detail.server.ts` | 复用共享提取；返回 `ownerTemplate`；透传 `placement` |
| `src/lib/aidreamcapes-guest-workspace.tsx` | 详情页渲染时调用 placement resolver，透传 `placements` |
| `src/components/storefront/aidreamcapes-v2/media-detail.tsx` | 分类块 + CSS + `placements` prop |
| `src/components/storefront/aidreamcapes-v2/template-directory.tsx` | 媒体网格 + 类型 |
| `src/components/storefront/aidreamcapes-v2/template-directory.server.tsx` | 读取 `directoryMedia` |
| `src/components/storefront/aidreamcapes-v2/types.ts` | 卡片可选 `placement`，目录数据类型 |
| `src/components/storefront/aidreamcapes-v2/template-directory.module.css` | 媒体区块样式 |
| `scripts/audit-aidreamcapes-media-placement.mjs` | 新增：只读卡片级数据审计 |
| `scripts/audit-aidreamcapes-media-products.mjs` | 新增：只读产品组审计 |
| `scripts/plan-aidreamcapes-media-product-placement.mjs` | 新增：生成产品级 manifest |
| `scripts/apply-aidreamcapes-media-product-placement.mjs` | 新增：字段级 CAS 应用 |
| `scripts/smoke-aidreamcapes-media-product-placement.mjs` | 新增：目录页 + 详情页 SSR 读回 |
| `package.json` | 新增 audit/plan/apply/smoke 命令 |

不改：

- `src/app/[...path]/page.tsx` 及路由文件；
- sitemap / robots / metadata；
- snapshot / publication / `SitePublishedState`；
- MyDreamShoots 任何文件或数据。

---

## 9. 打标与发布流程

### 9.1 Manifest 形态

当前实现使用 `aidreamcapes-media-product-placement-2026-10-21-v1`。manifest 同时记录页级 CAS 基线和字段级操作：

```json
{
  "contract": "aidreamcapes-media-product-placement-2026-10-21-v1",
  "siteId": "site_aidreamcapes",
  "target": "local",
  "planHash": "<sha256>",
  "pages": [
    {
      "id": "site_aidreamcapes_home",
      "slug": "/",
      "baseHash": "<sha256 of current LivePage fields>",
      "items": 1
    }
  ],
  "items": [
    {
      "productKey": "mp_<stable-hash>",
      "pageId": "site_aidreamcapes_home",
      "canonicalOwnerPath": "/",
      "canonicalPublicSlug": "canvas-tote-product-detail",
      "expectedLabel": "Canvas Tote Product Detail",
      "expectedKind": "video",
      "expectedMediaType": "image",
      "expectedMediaSrc": "/ai-image-generation/...webp",
      "fieldPath": "/sections/v2_main/settings/data/visual/picker/cards/0/placement",
      "beforePlacement": [],
      "placement": ["/industries/jewelry-accessories"],
      "alreadyApplied": false,
      "cardCount": 1,
      "uniquePages": ["/"],
      "publicSlugs": ["canvas-tote-product-detail"]
    }
  ]
}
```

`pages[].baseHash` 覆盖当前页面内容与 `updatedAt`；`items[].fieldPath` 精确到规范卡的 `placement` 数组。产品身份、规范卡和当前 placement 在 plan 时重新计算，不接受过期选择。

### 9.2 Plan

`plan-aidreamcapes-media-product-placement.mjs`：

- 读取当前 `LivePage`；
- 按素材派生 `productKey`，按产品组定位规范卡；
- 校验 label / kind / mediaSrc 指纹、规范卡地址、目标目录存在且 `data.kind` 匹配；
- 校验同组所有卡片的 placement：为空或已经等于目标值；出现其他值直接 abort（线上编辑优先）；
- 校验模板卡不写显式 placement；
- 输出 before/after、目标目录、组内页面副本和 `alreadyApplied`；
- 生成 `planHash`；
- 默认只打印；`--write-manifest` 才落盘到 `scripts/manifests/`。

### 9.3 Apply

`apply-aidreamcapes-media-product-placement.mjs`：

- 必须 `--target=local|production`；
- 写操作必须 `--apply --confirm=aidreamcapes-media-product-placement --base-hash=<planHash>`；
- 只写规范卡的 `placement` 字段，不触碰同组页面副本和其他字段；
- 每页用 `updatedAt` + 内容指纹做 CAS，并验证只改动了 manifest 声明的字段路径；
- 线上已改动的字段以线上为准；指纹不一致直接 abort；
- 已经是目标值则跳过；全部已应用时输出 `noop: true`，不推进 revision；
- 全量校验通过后才开始写；
- 写后逐页读回内容哈希和字段值；
- 读回 `SiteContentRevision`（`site_aidreamcapes`）确认推进；若没有推进，不得报告完成；
- 同时校验 `site_dreamshoot` 的当前内容指纹未变化。

### 9.4 校验脚本

`audit-aidreamcapes-media-placement.mjs`（只读）：

- 构建 17 个 facet + 3 个 catalog 注册表；
- 校验所有 `placement` 值存在、kind 匹配、无重复、无旧 chip、无 `/templates*`；
- 校验每张带 `placement` 的卡都能被 `resolveMediaDetail(kind, slug)` 唯一解析，且 owner 与 manifest 一致（防止给没有详情页的 data-only 卡打标）；
- 校验模板卡没有显式 `placement`；
- 校验模板 definition facets 与目录 paths 双向一致；
- 校验每个 `publicSlug` 唯一 owner；
- 按素材身份输出产品组、重复副本、label 冲突和 `placement` 冲突；
- 统计每个 facet 的**产品**数量，超过 48 给 warning；
- 校验每个已投放卡片的详情页会显示对应链接、目录页会渲染该卡（可复用 resolver 的纯函数）；
- 输出 `{ ok, errors, warnings, counts }`，有 error 时退出码非 0。

### 9.5 运营后台（Phase 4）

第一版用 manifest CLI，稳定后再做后台：

- 在媒体卡编辑面板增加 “Categories” 多选；
- 选项从当前 17 个 facet 页实时读取，不硬编码；
- 保存前显示 “Will appear in: /industries/...（媒体网格）”；
- 模板卡显示只读 facets，并链接到模板 definition / 目录 paths 的编辑入口；
- 保存走同一个 apply service，CAS + 校验，不从浏览器直接写库；
- 后台是私有路由，允许客户端交互；公开页仍 SSR-only；
- 编辑器/内容构建器必须把 `placement` 纳入卡片 schema；任何结构化表单的 round-trip 都不得丢弃该字段，需加“编辑其他字段后 placement 仍在”的回归用例。

### 9.6 新增目录的流程

若现有 17 个 facet 不够用（例如要加 “Pets”）：

1. 先按内容流程创建 `/industries/pets` LivePage（`kind: industry`、label、paths、导航、sitemap）；
2. 校验脚本自动把它纳入注册表；
3. 之后才能在卡片上选择 `/industries/pets`。

不允许先在卡片上写一个不存在的目录 slug，再补页面。

---

## 10. 存量回填

### 10.1 第一批：模板卡（0 次内容写入）

18 张模板卡直接从 `templateDefinition` + 目录 paths 派生，不需要写 `placement`。上线代码后即可在详情页看到完整分类，同时验证 UI/解析链路。

### 10.2 第二批：试点（本地已应用 19 个产品组）

选择标准：

- 公开页当前可见的 picker / example（用户已经能遇到）；
- label、图片语义清晰；
- 能明确映射到一个 industry 或 platform；
- 至少包含 2–3 个“同一素材 20 张副本”的重复组，验证目录只出现一次、别名详情页共享分类。

本次实际试点：

- 18 个重复组（共 358 张卡），规范卡都在 `/ai-video-generation/video-ads`；
- 1 个单卡产品 `canvas-tote-product-detail`（首页 picker）；
- 合计 19 个规范卡字段、359 张页面卡、2 个写入页面；
- 目标目录：Beauty 3、Electronics 2、Clothing 4、Food 3、Health 1、Jewelry 4、Shoes 2（另有 6 条既有 Shoes 外部编辑）；
- 本地 `SiteContentRevision` 8 → 10，MyDreamShoots 内容指纹不变。

实际应用的 3 个歧义判断见 §0.4。生产环境尚未执行同一 manifest。

试点验收：

- 详情页出现分类；
- 目标目录页出现该产品，且只出现一次；
- 同素材的任一别名详情页显示相同分类；
- 反向链接矩阵 0 假归属；
- 无 JS 读回通过。

### 10.3 第三批：分批回填（不建议一次性 987 张卡 / 285 个组）

- 按 owner 页或产品组分批，每批 30–50 个产品组；
- 每批先 plan，人工 review；
- 只给“确实适合该目录”的产品组打标；
- 715 张 workspace case 先按素材合并成产品组，再挑 label 明确、图片质量高的，不追求全覆盖。

不建议一次性给 987 张卡（285 个产品组）全部打标：

- 目录页会变成大杂烩，稀释策展质量；
- 大量相似 thumbnail 会拉长页面、影响性能；
- 许多 case 的 label 是场景描述，不一定能准确映射到 8 个 industry。

### 10.4 旧 chip 映射建议（只作为建议）

| 旧 chip | 可映射目录 | 说明 |
|---|---|---|
| `accessories` | `/industries/jewelry-accessories` | 包袋/配饰归此；需人工确认 |
| `apparel`、`clothing` | `/industries/fashion-clothing` | |
| `beauty-personal-care` | `/industries/beauty-skincare` | |
| `food-beverage` | `/industries/food-drinks` | |
| `footwear` | `/industries/shoes` | 目录 label 是 Footwear |
| `health-fitness` | `/industries/health-wellness` | |
| `jewelry-accessories` | `/industries/jewelry-accessories` | |
| `tech-electronics` | `/industries/electronics` | |
| `home`、`living-room`、`room-shelf` 等 | 不自动映射 | 这些是场景 chip，不是行业 |
| `pet`、`kids-toy`、`sports-gym` | 暂无对应目录 | 不要强塞；需要时先建目录 |
| `apps`、`e-commerce`、`education`、`explainer`、`financial-services`、`ugc`、`viral` | 无 | 内容属性，不是目录 |
| `example` | 无 | 内部标记 |

映射只用于生成建议清单，不自动写入。

### 10.5 截图页试点 manifest（已应用）

```json
{
  "productKey": "mp_fa87d11b78d4",
  "canonicalOwnerPath": "/",
  "canonicalPublicSlug": "canvas-tote-product-detail",
  "expectedKind": "video",
  "expectedMediaType": "image",
  "expectedMediaSrc": "/ai-image-generation/gen2guide-white-background-canvas-tote-640.webp",
  "fieldPath": "/sections/v2_main/settings/data/visual/picker/cards/0/placement",
  "beforePlacement": [],
  "placement": ["/industries/jewelry-accessories"]
}
```

选择 `jewelry-accessories` 而不是 `fashion-clothing` 的理由：卡片 alt 是 “Natural canvas tote bag”，包袋属于配件；如果内容团队认为应归 Clothing，可按同一字段生成 inverse manifest 改判。**这是一条人工判断，不做自动推断。**

本地已读回：详情页 `/ai-video-generation/canvas-tote-product-detail` 显示 `Jewelry & Accessories`；目录页 `/industries/jewelry-accessories` 出现该产品且只出现一次。

---

## 11. 分阶段

| 阶段 | 内容 | 写入 | 状态 / 验收 |
|---|---|---|---|
| Phase 1 | 共享卡片提取、`placement` 类型/解析、详情页分类块、目录页媒体网格、审计脚本 | 无内容写入 | **已完成**；18 张模板卡详情页分类正确；typecheck/lint/SSR gate 通过 |
| Phase 2 | 19 个产品组试点（18 个重复组 + 截图页） | 字段级写入 | **本地已完成**；详情页 + 目录页双向读回；同一产品只出现一次；18 个别名详情页分类一致；0 假归属；无 JS 通过；生产待批准 |
| Phase 3 | 分批回填（每批 30–50 个产品组） | 字段级写入 | 待开始；每批 plan/review/apply/readback；目录产品数量在阈值内 |
| Phase 4 | 运营后台 Categories 面板 + 预览 + CAS 保存 | 字段级写入 | 待开始；不绕过校验；公开页仍 SSR-only |
| Phase 5（可选） | 目录页媒体分页 / See all；`placementOrder` 策展排序 | 视需要 | 超过阈值时仍无假归属 |

Phase 1 是**纯代码**；Phase 2 已产生本地用户可见的内容变化，但未写生产。

---

## 12. 验收与回归

### 12.1 静态

- `npm run typecheck`
- `npm run lint`
- `node scripts/guard-live-storefront-ssr.mjs`
- `npm run audit:aidreamcapes-media-placement` → `{ ok: true }`
- `npm run audit:aidreamcapes-media-products`
- `npm run smoke:aidreamcapes-media-product-placement` → `{ ok: true }`

### 12.2 详情页

对每张已投放卡：

- HTML 含 `data-media-categories="true"`；
- 每个预期目录 href 存在；
- 不存在的/非法 placement 不产生链接；
- 未投放卡不渲染分类块；
- 禁用 JS 后链接仍在；
- 详情页仍恰好 1 个 `data-workspace-entry` CTA（现有 parity gate）。

### 12.3 目录页

对每个 facet：

- 已投放卡的详情 href 出现在 `data-directory-media` 网格；
- 模板网格不变；
- 没有重复卡；
- 没有模板卡被重复放进媒体网格；
- 页面仍 200，H1 不变；
- 原有筛选器仍工作。

### 12.4 反向矩阵

对每个 `(card, directory)` 组合：

- 若详情页显示该目录链接 → 目录页 HTML 必须含该卡 href；
- 若目录页含该卡 href → 详情页必须显示该目录链接（模板卡按模板页规则例外）。

这是本功能的核心回归，必须自动化。

### 12.5 隔离

- `git diff --name-only` 逐文件确认在 Aidreamcapes 范围；
- 所有数据库脚本带 `siteId = 'site_aidreamcapes'` 断言；
- 关系数据 owner 为 `LivePage.contentJson`；确认 `SiteContentRevision` 已推进；
- 从公开 origin 读回详情页和目录页，而不是只信本地库；
- MyDreamShoots 公开路由只读抽查（首页、`/best-ai-image`、`/best-ai-video`）无输出变化；
- 不写 `SitePublishedState`、snapshot、publication；
- 不跑全站生成。

### 12.6 性能

- 目录页 p95 不超过现有预算；
- 详情页新增查询不超过 1 次、20 行；
- 目录页 JSONB 扫描 268 行，实测 psql 约 25ms；应用侧需复测；
- 若回归，优先加 revision-keyed 缓存，不加纯 TTL。

---

## 13. 风险与处置

| 风险 | 影响 | 处置 |
|---|---|---|
| 假归属（有链接、目录页没有） | 用户点空，损害信任 | 渲染包含测试 + 反向矩阵 + resolver 过滤非法值 |
| 目录页膨胀 | 页面变长、性能下降、策展质量下降 | 人工策展；48 条软阈值；后续分页 |
| 旧 chip 被误当目录 | 死链、语义错误 | 只允许 17 个 facet slug；审计拒绝旧 chip |
| 模板 facets 与 paths 漂移 | 模板卡归属不一致 | 双向一致性校验；以 paths 为展示源 |
| 内容写入冲突 | 覆盖线上编辑 | 逐页 CAS + 指纹；线上优先；abort |
| 共享层影响 MyDreamShoots | 跨店回归 | 只改 Aidreamcapes 组件/脚本；共享层改动先停下请求授权 |
| 缓存陈旧 | 新标签不生效 | 默认不缓存；必须缓存时用 revision 键；不用纯 TTL |
| 目录 slug 改名 | 旧 placement 失效 | resolver 过滤；审计报错；改名需迁移 manifest |
| 运营后台绕过校验 | 脏数据上线 | 后台复用同一 apply service/CAS/校验 |
| 误用 snapshot 回滚 | 违反 AGENTS.md | 只做字段级 inverse manifest，不碰历史 publication |

---

## 14. 已确认与待确认

已确认并落地：

1. **媒体直接进目录页媒体网格**：接受；目录页新增 `More {label} examples`，详情页分类链接与目录网格同源。
2. **首批范围**：19 个产品组试点，不一次性覆盖 285 个组。
3. **运营方式**：先用 manifest CLI；后台 Categories 面板放 Phase 4。
4. **分类体系**：第一阶段只用现有 17 个 facet，不新增目录。

仍待确认：

1. **3 个歧义映射是否维持**：Kitchen Appliance → Electronics、Berry Bowl → Food & Drinks、Quiet Unboxing → Beauty & Personal Care。当前按建议应用；改判走字段级 inverse manifest。
2. **生产应用时间**：本地 manifest 已读回；生产写入需要单独批准，不复用本地页面哈希。
3. **第三批回填范围**：哪些产品组进入下一批，以及每批目录产品数上限。
4. **是否新增目录**：若未来要加 `pets`、`kids` 等，先按 9.6 建目录页，再允许 placement 引用。

---

## 附录 A：详情页分类块数据形态

```ts
type MediaPlacementGroup = {
  kind: "industry" | "platform" | "occasion" | "catalog";
  label: string; // Industry / Platform / Occasion / Catalog
  links: { label: string; href: string }[];
};
```

模板卡示例：

```json
[
  {
    "kind": "industry",
    "label": "Industry",
    "links": [
      { "label": "Footwear", "href": "/industries/shoes" },
      { "label": "Jewelry & Accessories", "href": "/industries/jewelry-accessories" },
      { "label": "Tech & Electronics", "href": "/industries/electronics" }
    ]
  },
  {
    "kind": "platform",
    "label": "Platform",
    "links": [{ "label": "YouTube Shorts", "href": "/platforms/youtube-shorts-ads" }]
  },
  {
    "kind": "catalog",
    "label": "Catalog",
    "links": [
      { "label": "Templates", "href": "/templates" },
      { "label": "Video Templates", "href": "/templates/video" }
    ]
  }
]
```

## 附录 B：目录媒体卡数据形态

```ts
type DirectoryMediaCard = {
  slug: string;
  label: string;
  kind: "photo" | "video";
  href: string;
  image: { src: string; alt?: string; w?: number; h?: number };
};
```

## 附录 C：与既有文档的关系

- 本文不改变 `aidreamcapes-media-detail-link-remediation-2026-10-21.md` 的 URL / CTA / noindex / sitemap 契约。
- 本文把 `aidreamcapes-template-directory-data-chain-audit-2026-10-21.md` 的 Route A/B 决策收敛为 **Route B+**：保留 `templateDirectory.paths` 作为模板级策展源，新增卡片级 `placement` 作为媒体级投放源，不引入新表。
- 本文不解决 slug 命名空间（工具页/模板页/案例页前缀包含）问题；该问题仍归 `aidreamcapes-template-directory-data-chain-audit` Phase 2/3 跟踪。
- 本文不解决可用性 P0；上线顺序仍以 `aidreamcapes-production-ssr-memory-stability-2026-10-21.md` 为准。
