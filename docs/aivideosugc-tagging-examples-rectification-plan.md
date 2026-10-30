# Aidreamcapes 素材标签规范 + 案例目录页整改方案

> 2026-10-30 起草。基于生产 `LivePage.contentJson` 只读读回（当日）的盘点数据。
> 前置状态：367 条规范详情页（273 视频 + 94 图片），两遍收敛去重已完成（pass1 `aa1408ebb`、pass2 `60e5353fa`）。
> 已拍板：40 条视频 + 12 条图片无入口素材 → 纳入公开案例目录页 + 标签化，素材不删。

---

## 1. 现状底数

### 1.1 素材与入口

| 类别 | 总量 | 有入口 | 无入口 |
|---|---|---|---|
| 视频详情页 | 273 | 233（picker 206 + 画廊 27） | **40**（案例卡拥有，全部仅封面） |
| 图片详情页 | 94 | 82 | **12**（挂在 `/occasions/*` 案例卡） |
| 已生成真视频 | 117 | 全部有入口 | 0 |

无入口页全部是 `workspaceCase` 案例卡拥有的规范页：公开侧无渲染链接、noindex；私有侧被工作台预设机制消费（`presets.server.ts` 把案例卡并入预设池）。

### 1.2 标签机制现状

**placement 机制（唯一注册表，健康）**：
- `placement[]` 字段 = 排序去重的 facet 页路径列表（`/industries/*`、`/platforms/*`、`/occasions/*`，共 17 个 facet 页）。
- 运行时注册表：`src/lib/aidreamcapes-workspace/media-placement.ts`（`MEDIA_PLACEMENT_PATTERN` 白名单，非法值自动丢弃）。
- 详情页已有 chips 渲染：`media-detail.tsx` `v-detail-categories`（placement 分组 chip，链接 facet 页）。
- **结论：标签机制不需要新建，缺的是数据。**

**placement 覆盖率（本次生产盘点）**：

| 卡形状 | 卡数 | 有 placement | 覆盖率 |
|---|---|---|---|
| workspaceCase（案例卡） | 715（52 个规范 slug） | **0** | 0% |
| templateCard（模板卡） | 18 | **0** | 0% |
| picker（选卡） | 265 | 54 | 20% |
| exampleGallery（画廊卡） | 97 | 67 | 69% |

placement 值分布（按去重 slug 数）：tiktok-ads 45、instagram-ads 28、electronics 16、fashion-clothing 15、beauty-skincare 12……occasion 维几乎为空（sale-discount 3、black-friday 2、holidays 0）。

**chips 字段（无管控词表，乱源）**：
- 卡上 `chips[]` 是自由文本，出现近重复类别词：`apparel`/`clothing`、`accessories`/`jewelry-accessories`、`food-beverage`/`food-drinks`、`health-fitness`/`health-wellness`、`tech-electronics`/`electronics`；以及 `example`、`viral`、`pet`、`kids-toy`、`financial-services`、`education`、`apps` 等不受目录支撑的词（点了没有落地页）。
- 有 44 张卡共享同一组同质 chips（一次批量生成的产物），另有零散场景词（`studio`、`terrace`、`hands-on`、`gift-reveal`、`review` 等）。

### 1.3 工具面（「工具」维度的取值域）

导航注册表（`aidreamcapes-navigation.ts`）与生产 picker 挂载页：

- **视频工具**：`/ai-video-generation`（通用）+ `video-ads`、`image-to-video`、`product-video`、`before-after-video`、`spokesperson-video`（有 picker，带示例）；`text-to-video`、`ai-twin`（路由存在，暂无示例素材）；9 个视频模板工具页（beauty-routine、cinematic-video、fashion-try-on-reel、food-video、home-organization、how-to-video、promo-video、spark-ads-style-video、black-friday-countdown）。
- **图片工具**：`/ai-image-generation`（通用）+ `change-background`、`lifestyle-photos`、`model-photos`、`social-ad-photos`、`white-background-photos`；9 个图片模板工具页（colorway-variations、jewelry-positioning、packaging-mockup、packshot-multi-angle、professional-headshot、sale-campaign-key-visual、story-ad-vertical、ugc-still-ad、virtual-try-on）。

### 1.4 模板 facet 归属缺口（/templates 整理项）

18 个模板定义（`templateDefinition.industries/platforms/occasions`）：

| 模板 | 缺口 |
|---|---|
| `/ai-image-generation/professional-headshot` | industries、platforms、occasions **全空** |
| `/ai-video-generation/black-friday-countdown` | industries 空（有 platform/occasion） |
| `/ai-video-generation/spark-ads-style-video` | industries 空 |

其余 15 个模板三维齐备（fashion/beauty/shoes/jewelry/electronics/health/food/home ×平台 ×场合），结构健康。

---

## 2. 标签体系定义（规范）

### 2.1 四个维度

| 维度 | 取值域 | 存储方式 | 落地页 |
|---|---|---|---|
| **工具 Tool** | 素材被哪些工具页引用（≤24 个工具页路径） | **不落字段**，渲染时由引用关系推导 | 工具页本身（强落地页） |
| **行业 Industry** | 8 个标准 facet：`fashion-clothing` 衣服、`electronics` 电子产品、`beauty-skincare` 美容个护、`shoes` 鞋类、`jewelry-accessories` 珠宝配饰、`health-wellness` 健康健身、`food-drinks` 食品饮料、`home-living` 家居生活 | `placement[]`（manifest 写入） | `/industries/<slug>` ×8 |
| **平台 Platform** | 6 个 facet：`tiktok-ads`、`instagram-ads`、`facebook-ads`、`youtube-shorts-ads`、`amazon-product-photos`、`shopify-product-photos` | `placement[]` | `/platforms/<slug>` ×6 |
| **场合 Occasion** | 3 个 facet：`sale-discount`、`black-friday`、`holidays` | `placement[]` | `/occasions/<slug>` ×3 |

**核心原则：placement[] 是唯一标签字段，目录页即词表。** 不新建标签表、不新增第二套标签机制。工具维度因为是「引用关系」（素材被哪个工具页用），天然可推导，不落字段。

### 2.2 行业词表 v2（与工具页筛选分类对齐，2026-10-30 拍板）

工具页/模板页的分类筛选 chips（19 个，纯 CSS 筛选器：`picker.chips` 定义 + 卡 `chips[]` 匹配）即用户可见分类基准。行业维度与其对齐：

| 图示分类 | chip id | 行业 facet |
|---|---|---|
| 衣服 | clothing / apparel | `/industries/fashion-clothing`（已有） |
| 鞋类 | footwear | `/industries/shoes`（已有） |
| 健康与健身 | health-fitness | `/industries/health-wellness`（已有） |
| 珠宝及配饰 / 配饰 | jewelry-accessories / accessories | `/industries/jewelry-accessories`（已有） |
| 科技与电子产品 | tech-electronics | `/industries/electronics`（已有） |
| 食品和饮料 | food-beverage | `/industries/food-drinks`（已有） |
| 美容个护 | beauty-personal-care | `/industries/beauty-skincare`（已有） |
| 宠物 | pet | `/industries/pet`（**新建**） |
| 儿童玩具 | kids-toy | `/industries/kids-toy`（**新建**） |
| 电子商务 | e-commerce | `/industries/e-commerce`（**新建**） |
| 教育 | education | `/industries/education`（**新建**） |
| 金融服务 | financial-services | `/industries/financial-services`（**新建**） |
| 运动与健身 | sports-gym | `/industries/sports-gym`（**新建**，与健康与健身分开，同图示） |
| App 软件 | apps | `/industries/apps`（**新建**） |
| UGC 风格 | ugc | `/industries/ugc`（**新建**） |
| 爆款 | viral | `/industries/viral`（**新建**） |
| 教程讲解 | explainer | `/industries/explainer`（**新建**） |

- **拍板（2026-10-30）**：ugc / viral / explainer 三个风格类**也建 facet 页**——行业 facet 共新增 **10** 页（8 已有 + 10 新 = 18 个行业 facet；全站 facet 页 17 → 27）。
- 新 facet 页为 SSR LivePage（复用现有 facet 页结构：模板网格 + placement 示例聚合）；主导航「按行业」组随之扩充。
- 家居 `/industries/home-living`（已有）不在 19 chips 内，保留（素材有归属）。

### 2.3 多标签规则

- 一个素材允许多个行业/平台/场合标签（如「黑色连衣裙试穿视频」= fashion-clothing + tiktok-ads + instagram-ads）。
- 每维度标签数无上限，但必须逐条可审计（manifest 里每条标签带推断依据）。
- 素材行业无法归入 8 个标准 facet 时的处理：**待拍板项 A**（见 §7）。

### 2.4 chips 清理（拍板修订版，2026-10-30）

**前提修正**：卡上 `chips[]` 是工具页 CSS 筛选器的匹配数据源（`picker.chips` 的 radio/label 按 chip id 匹配卡片），**类别 chips 不能移除**，否则筛选失效。清理内容修订为：

1. **同义词规范**：`apparel`→`clothing`、`accessories`→`jewelry-accessories`（卡 chips 与 picker.chips 筛选行同步收敛，19 → 16 个筛选 chip）；
2. **id bug 修复**：hub 页 Viral 筛选 id 为 `trending`、其余页为 `viral`——统一为 `viral`；
3. **场景词白名单保留**：studio、terrace、hands-on、gift-reveal、clean-setting、room-shelf、review 等拍摄场景/风格词不动（各工具页自有筛选词）；
4. 详情页不渲染 chips（现状保持），分类展示职责由 placement chips 承担。

---

## 3. 打标规则（确定性推断 + 人工审核）

每个规范 slug 的标签由脚本按以下优先级推断，产出 manifest 供人工审核，不静默写入：

### 3.1 行业（industries）

1. **继承来源模板**：引用该素材的工具页若为模板页，继承其 `templateDefinition.industries[]`（如 jewelry-positioning 的素材 → beauty-skincare + jewelry-accessories）。16 个模板三维齐备可直接继承。
2. **关键词映射兜底**：对通用工具页（/ai-video-generation、spokesperson-video、video-ads 等）的素材，用**冻结的关键词→行业映射表**（label + prompt 文本，确定性词表如 dress/shirt/hoodie→fashion-clothing，ring/necklace→jewelry-accessories）推断，映射表本身入文档、可逐条复核。
3. **多标签合并**：同一素材被多个工具页引用 → 继承结果取并集。

### 3.2 平台/场合（platforms / occasions）

- 继承来源模板页的 `templateDefinition.platforms[] / occasions[]`。
- 通用工具页素材：v1 工具有固定适配（video-ads→tiktok/instagram/facebook；spokesperson-video→tiktok 等，按工具页现有 placement 继承链）。

### 3.3 工具（tool，渲染时推导）

- 工具标签 = 引用该产品的工具页集合（picker owner pages ∩ 工具路由），详情页渲染为「Made with」chip 组，链接对应工具页。
- 已有聚合机制：`media-placement.server.ts` 已经跨页聚合引用（DirectoryMediaCard），扩展一个分组即可，**零数据写入**。

### 3.4 执行约束（沿用既定合同）

- 字段级显式 manifest：每条操作 = `{ slug, shape, ownerPage, setPlacement: [...], basis }`。
- plan/apply 脚本对 + planHash + CAS（baseHash mismatch 即放弃重 plan）。
- apply 事务内含 `SiteContentRevision` 触发器与保护哈希断言；apply 后逐 slug 读回断言。
- 不触碰 MyDreamShoots；只写 `site_aidreamcapes`。
- 服务器本机直跑（scp 脚本 + `PRISMA_BASE` 模式），不走 SSH 隧道大 payload。

---

## 4. 详情页渲染规范

- **placement chips**（已有 `v-detail-categories`）：数据补齐后自动生效，展示 Industry / Platform / Occasion 分组，chip 链 facet 页。
- **工具 chips**（新增分组）：「Made with」组，chip 链工具页；由引用关系渲染时推导（§3.3）。
- 顺序：Industry → Platform → Occasion → Made with；空组不渲染。
- 详情页其余区块（图/视频、提示词、CTA、相关推荐）不动。

## 5. 公开案例目录页 `/examples`

> **现状查证（2026-10-30）**：`/examples` 目前不是页面——生产实测 308 重定向到 `/ai-image-generation`（历史遗留映射），无 LivePage、无代码路由、robots 无相关条目。方案里的是**新建**页面。

- **目的**：(a) 给 52 条无入口素材一个全量可浏览的公开载体；(b) 作为素材内链枢纽提升收录与抓取效率；(c) 承载工具维浏览（facet 页只有行业/平台/场合三维）。
- **形态**：SSR-only 新路由，列出全部 367 条规范素材卡（图 + 标题 + 标签 chips）。
- **筛选**：沿用 `/templates` 的 facet 模式——单维度筛选走既有 17 个 facet 页的「More examples」聚合区（placement 补齐后自动聚合）；`/examples` 页内 query 组合筛选（如 `?industry=fashion-clothing&tool=product-video`）一律 noindex，与 facet 页结果集收敛去重（沿用 308 规则）。
- **轻量替代（不建新页）**：52 条孤儿打标后自动进入 17 个 facet 页的聚合区 → 同样获得 SSR 入口。缺点：工具维无落地页、行业外素材（拍板项 A 选 a 时）仍无入口、缺一个全量内链枢纽。
- **入口挂载**（若建）：主导航新菜单项 or「资源」下拉——**待拍板项 B**。
- 合同要求：静态 + 无 JS 回归检查、audit 脚本新口径、sitemap/robots 更新；新 /examples 上线前需处理既有 308 映射（改为 200）。

## 6. /templates 页整理

1. **补全 3 个模板的 facet 缺口**（§1.4 表）：professional-headshot 补 industries（electronics? health-wellness? 按素材实际归属定）、black-friday-countdown 补 industries、spark-ads-style-video 补 industries——同走 manifest 流程。
2. **模板卡排序固定**：按固定规则（视频组在前 + slug 字母序）替代当前任意序。
3. **模板卡数据一致性检查**：card.image 必填、kind 标注正确、name/description 为正式文案；巡检脚本加断言。
4. 顶部 chips（全部/照片/视频）与筛选 308 收敛逻辑不动。

## 7. 待拍板项

| # | 决策 | 结论 |
|---|---|---|
| **A** | 行业词表覆盖面 | **已拍板（2026-10-30）：行业词表对齐工具页 19 分类**（§2.2），含 ugc/viral/explainer 三个风格类也建 facet 页，新增 10 个行业 facet 页 |
| **B** | 是否新建 /examples 目录页（现状 308 → /ai-image-generation） | **已拍板（2026-10-30）：不建。** 工具页 picker 即全量商品浏览面；标签浏览走 /templates → facet 页（场景标签）跳转定位。/examples 维持 308 现状，方案 §5 仅留档 |
| **C** | chips 清理 | **已拍板（2026-10-30）：做，范围修订**（§2.4）——类别 chips 是筛选数据源不能摘，清理 = 同义词规范 + viral/trending id 修复 + 场景词白名单 |

## 8. 实施步骤

| Phase | 内容 | 产出 | 状态 |
|---|---|---|---|
| **1** | 词表冻结：18 行业 facet（8 已有 + 10 新）、6+3 平台/场合、chip 同义词映射、工具页清单入文档 | 本文档 §2.2/§2.4 | ✅ 2026-10-30（+`/industries/other` catch-all，行业 facet 19） |
| **2** | 生成打标 manifest：脚本全量推断 367 slug → placement[]，逐条带依据；含 chips 规范化操作清单 | `scripts/manifests/aidreamcapes-placement-tags-draft-2026-10-30.json`（人审） | ✅ 2026-10-30 |
| **3** | apply：plan/apply 脚本对，CAS + 读回断言，服务器直跑 | 生产数据更新 + 报告 + 回滚文件 | ✅ 2026-10-30：38 页 420 卡，revision 3117→3155，线上 chips 验证通过 |
| **4** | 新建行业 facet 页（SSR LivePage）+ 主导航「按行业」组 8→19 + /industries hub 卡 8→19 | manifest + apply | ✅ 2026-10-30：11 页（10 新类目 + other），revision 3155→3168，sitemap 自动收录 19 |
| **5** | 详情页工具 chip 分组（渲染时推导，代码改动）+ 部署 | 代码 commit | ⬜ |
| **6** | /templates 整理（§6）+ 回归：SSR-only 合同、no-JS 检查、audit 脚本、facet 页聚合验证 | 回归报告 | ⬜ |

Phase 3/4 已上线——placement 全覆盖、chips 规范化生效、11 个新 facet 页 live（素材网格由 placement 聚合自动填充，无需代码部署）。

## 9. 不变量

- 不新增第二套标签机制；placement[] 是唯一分类字段，17 facet 页是唯一分类词表。
- 不写快照/发布状态；`SitePublishedState` 仅派生缓存。
- 摘除/新增的公开地址必须过 SSR-only + noindex/sitemap 合同检查。
- 所有公开可见字符串符合公开文案边界（标签 label 为正式站点文案）。
- Aidreamcapes 隔离：所有写操作显式 `site_aidreamcapes` 过滤。
