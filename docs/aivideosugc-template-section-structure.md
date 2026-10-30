# AIVIDEOSUGC「模板」板块内容结构（aivideosugc.com / site_aidreamcapes）

> 2026-10-30 整理。模板级 facet 归属数据来自生产 `LivePage.contentJson` 只读读回（当日），
> 非历史快照。代码行号以当时 main 为准，仅供定位参考。

## 0. 一图总览

```
顶部导航「模板」mega menu（siteNavigation.menus，DB）
  ├─ 按行业 ×8  ──→  /industries/<slug>   ─┐
  ├─ 按平台 ×6  ──→  /platforms/<slug>    ├─ 17 个 facet 落地页（独立 LivePage）
  ├─ 按场合 ×3  ──→  /occasions/<slug>    ─┘
  └─ 查看全部 18 个模板 →  /templates

/templates（模板总目录页，独立 LivePage）
  ├─ 顶部 chips：全部 / 照片模板 / 视频模板 / 按行业→/industries / 按平台→/platforms
  ├─ 筛选表单（4 个下拉，服务端 GET 提交）：类型 / 行业 / 平台 / 场合
  └─ 18 张模板卡片 → 每张跳模板详情页 /ai-image-generation|ai-video-generation/<slug>

/industries  /platforms（facet 总目录 hub，各一页）
/occasions —— ⚠️ 没有 hub 页，只有 3 个落地页
```

**核心结论：mega menu 的每一个入口都不是 `/templates` 的筛选拼接，而是 17 个独立 facet
落地页。`/templates` 页面上看不到这批入口的列表，只有筛选下拉和顶部 chips（chips 只
指向行业/平台 hub，无「按场合」）——这正是"两边对不上"的观感来源。**

## 1. 你的疑问的直接解答

- 菜单里"美容及个人护理"等 17 条入口，跳的是 `/industries/beauty-skincare` 这类**独立
  页面**，不是 `/templates?industry=...`。
- `/templates` 页面上，这批入口只以两种形式存在：
  1. 筛选下拉的选项（行业/平台/场合三个下拉），且**取值列表是从 18 个模板的实际标签
     实时去重生成的**，不是一份固定的维度表；
  2. 顶部 chips 里的「按行业 → /industries」「按平台 → /platforms」两个 hub 链接
     （没有「按场合」入口）。
- 所以在 `/templates` 卡片区里不会出现"行业入口卡片"，要按行业浏览得走菜单、chips
  或筛选下拉。

## 2. URL 全景（四层）

| 层 | 路由 | 数量 | 可索引 | 说明 |
|---|---|---|---|---|
| 总目录 | `/templates`、`/templates/photo`、`/templates/video` | 3 | ✅ | photo/video 是独立 LivePage，服务端过滤 9/9 |
| facet 落地页 | `/industries/<slug>` ×8、`/platforms/<slug>` ×6、`/occasions/<slug>` ×3 | 17 | ✅ | 各带模板网格 + placement 示例媒体；有别名 301（near-slugs） |
| facet hub | `/industries`、`/platforms` | 2 | ✅ | `/occasions` **缺 hub** |
| 模板详情 | `/ai-image-generation/<tool>` ×9、`/ai-video-generation/<tool>` ×9 | 18 | ✅ | 卡片「查看模板」跳这里；页面 CTA 重写进工作台 |

另有不可索引层（noindex）：工具页 picker、媒体示例详情页、工作台案例页，与模板目录同
用 `/ai-image-generation|ai-video-generation/<slug>` 前缀，由 `resolveMediaDetail` 分发。
筛选组合 URL（如 `/templates/photo?industries=/industries/shoes`）一律 noindex，且单
facet 查询若结果集与对应 facet 页完全一致会被 308 到 facet 页——两套入口最终收敛。

## 3. 数据模型（全部在 `LivePage.contentJson`，无独立维度表）

| 数据 | 存放位置 | 内容 |
|---|---|---|
| mega menu | 首页 `contentJson.siteNavigation.menus`（version 2） | 三组入口 label+href、footerLink |
| 模板卡片定义 | 各模板详情页 `contentJson.sections.*.settings.data.templateDefinition` | `id/kind/path/name/description/card/industries[]/platforms[]/occasions[]` |
| 目录页清单 | 目录页 `data.templateDirectory = { paths[], links[] }` | 策展哪些模板进本页；chips 链接 |
| facet 页身份 | facet 页 `data.kind`（industry/platform/occasion）+ `data.label` | 下拉选项文案的来源 |
| facet 示例媒体 | 全站素材 section 的 `placement[]` 标签 | `media-placement.server.ts` 是唯一的标签注册表（无 tag 表） |

- `/templates` 筛选下拉选项 = 18 个模板 `templateDefinition` 三个数组的并集（去重），
  label 取 facet 页 `data.label ?? title`。**若某 facet 下模板清空，菜单仍列出它，
  但下拉会少一项**（facet 页仍 200，显示 0 模板 + 示例媒体空态）。
- 渲染链：catch-all `[...path]/page.tsx` → `storefront-render.tsx` →
  `aidreamcapes-v2/template-directory.server.tsx`（服务端读库/过滤）→
  `template-directory.tsx`（UI）。筛选是纯服务端 GET 表单，无客户端过滤。

## 4. 18 个模板与 facet 归属（生产读回，2026-10-30）

照片模板（详情在 `/ai-image-generation/`）：

| 卡片名 | slug | 行业 | 平台 | 场合 |
|---|---|---|---|---|
| 颜色变体 | colorway-variations | 服装、鞋类 | Amazon、Shopify | — |
| 模特佩戴珠宝 | jewelry-positioning | 美容、珠宝 | Instagram、Shopify | — |
| 包装预览 | packaging-mockup | 美容、珠宝、食品、家居 | Amazon、Shopify | — |
| 每个角度 | packshot-multi-angle | 鞋类、珠宝、电子、家居 | Amazon、Shopify | — |
| 团队形象照 | professional-headshot | **无** | **无** | **无** |
| 促销横幅 | sale-campaign-key-visual | 服装、鞋类 | Instagram、Facebook | 促销、黑五、假期 |
| Story 广告 | story-ad-vertical | 服装、健康 | Instagram、Facebook | 促销、黑五、假期 |
| 创作者风格照片 | ugc-still-ad | 美容、健康 | Instagram、Shopify | — |
| 虚拟试穿 | virtual-try-on | 服装 | Shopify | — |

视频模板（详情在 `/ai-video-generation/`）：

| 卡片名 | slug | 行业 | 平台 | 场合 |
|---|---|---|---|---|
| 美容日常 | beauty-routine | 美容 | TikTok、Instagram | — |
| 黑五倒计时 | black-friday-countdown | **无** | TikTok、Facebook | 促销、黑五 |
| 品牌大片 | cinematic-video | 鞋类、珠宝、电子 | YouTube Shorts | — |
| 试穿短片 | fashion-try-on-reel | 服装 | TikTok、Instagram | — |
| 饮品倾倒 | food-video | 食品 | TikTok、YouTube Shorts | — |
| 家居收纳 | home-organization | 家居 | Facebook、YouTube Shorts | — |
| 使用教程 | how-to-video | 电子、健康、家居 | YouTube Shorts | — |
| 上新促销 | promo-video | 电子、食品 | TikTok、Facebook | 促销、假期 |
| Spark Ads 风格 | spark-ads-style-video | **无** | TikTok | — |

覆盖校验：8 行业 / 6 平台 / 3 场合每个 facet 至少 1 个模板；`professional-headshot`
是唯一无任何归属的模板（只能从 `/templates`、`/templates/photo` 到达）。

## 5. 已知不一致点（"乱"的具体来源）

1. **标签文案双源**：菜单 label（nav manifest：Beauty & Personal Care / Clothing /
   Footwear…）与 facet 页 label（= 下拉选项：Beauty & Skincare / Fashion & Clothing /
   Shoes…）分两处维护，URL 相同但显示名不同。
2. **无 occasions hub**：菜单"按场合"组和 `/templates` chips 都没有场合总入口，
   `/occasions` 不存在；与行业/平台不对称。
3. **详情页文案与 facet 分叉**：模板详情页 "Best for / Popular with" 文案源自生成期
   master.json 的旧标签，与当前 DB facet 已不一致（例：how-to-video 旧标 Shopify，
   当前 Shopify facet 不含它；food-video 旧标 Instagram，当前是 YouTube Shorts）。
4. **1 个无归属模板**：professional-headshot 不属于任何行业/平台/场合。
5. **卡片图与 facet 无关**：facet 页模板卡沿用模板自身的通用产品图（如"每个角度"在
   鞋类页显示音箱图）——placement 标签只作用于「More examples」媒体网格，不作用于
   模板卡图。
6. **下拉取值是派生的**：选项来自模板标签并集而非固定维度表，数据变动会静默改变下拉。

## 6. 维护方式

| 改动 | 途径 | 禁止 |
|---|---|---|
| 菜单入口/文案 | 字段级 manifest（`scripts/plan-aidreamcapes-nav-items.mjs` → `apply-aidreamcapes-nav-items.mjs`，CAS + 读回断言） | 直接全站生成/改快照 |
| 模板 facet 标签 | 字段级 manifest 针对对应 LivePage 的 `templateDefinition` | 同上 |
| 筛选/路由逻辑 | 代码改动（`aidreamcapes-template-filter*.ts`），部署走预构建发布 | — |
| 回归 | `scripts/smoke-aidreamcapes-seo-paths.mjs`（含 `/platforms`、facet、筛选样例） | — |

## 7. 关键文件索引

| 主题 | 文件 |
|---|---|
| mega menu 渲染 | `src/components/storefront/aidreamcapes-v2/shell.tsx`（Header，~49-140）、`src/components/theme-renderer.tsx`（~340-371） |
| 菜单数据 | `scripts/manifests/aidreamcapes-nav-items-production-2026-10-24-b.json`、`src/lib/types.ts`（~80-121 类型） |
| 目录/筛选服务端 | `src/components/storefront/aidreamcapes-v2/template-directory.server.tsx`、`src/lib/aidreamcapes-template-filter.server.ts`、`src/lib/aidreamcapes-template-filter.ts` |
| 目录/筛选 UI | `src/components/storefront/aidreamcapes-v2/template-directory.tsx` |
| placement 媒体注册表 | `src/lib/aidreamcapes-workspace/media-placement.server.ts` |
| 路由分发 | `src/app/[...path]/page.tsx`（~723-740 重定向与详情分发） |
| 数据修复脚本 | `scripts/repair-aidreamcapes-template-relations-local.mjs`、`scripts/data/aidreamcapes-site-v2/master.json` |
| 历史审计 | `docs/plans/aidreamcapes-template-directory-data-chain-audit-2026-10-21.md` |
