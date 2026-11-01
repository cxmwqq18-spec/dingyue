# 视频详情页归类计划（2026-11-01）

> 状态：**纯计划文档，未动任何代码或数据**。按 google-indexed-url-safety 规范编制：本计划不删除、不改名任何已收录 URL；后续执行每步带 manifest 仅含 placement/展示引用字段级修正 + CAS + 门禁（第 9 节）。

## 1. 目标与约束

1. **工具唯一**：每个视频详情页在工具维度只归一个工具页：图片转视频 / 视频链接 / 视频广告 / 产品视频 / 前后对比视频 / 文字转视频 / 发言人视频 / AI孪生。同一视频不得同时出现在两个工具页的示例画廊。
2. **分类覆盖**：19 个行业 + 3 场合 + 6 平台的 facet 页每个都应有视频示例（硬性 ≥1，目标 ≥3）。
3. **真实产品归类**：行业归属按视频中的真实产品实体判定，禁止为凑数硬塞。
4. **收录安全红线**：不删除任何已收录详情页；不改任何 publicSlug；卡片调整不改变详情页 URL；全部 manifest（含 removed/rollback）+ CAS + 门禁。

## 2. 现状快照（2026-11-01 生产库 + 线上 sitemap）

| 指标 | 数值 |
|---|---|
| 详情页总数（sitemap 规范 URL） | **358**（视频类 250 + 图片类 108） |
| 唯一成片视频 | **171** 个 mp4，逐一对应详情页，无复用 → 视频维度天然唯一 ✓ |
| 视频类详情页带片比例 | **171/250（68%）**，92 个纯图待生成 |
| facet 页 | 19 行业 + 3 场合 + 6 平台 = 28 |
| 归属机制 | 详情页=属主页卡片投影；工具归属=工具页引用关系（渲染时反查）；行业=卡片 placement 字段（编译器按产品身份去重） |

## 3. 工具维度：现状与唯一性

| 页面 | 带片视频数 | 角色 |
|---|---|---|
| /ai-video-generation/spokesperson-video | 53 | 发言人视频 |
| /ai-video-generation/video-ads | 39 | 视频广告 |
| /ai-video-generation | 36 | 图片转视频 (hub picker) |
| /ai-video-generation/product-video | 13 | 产品视频 |
| /ai-video-generation/fashion-try-on-reel | 11 | [模板页] 试穿/试戴 Reel |
| /ai-video-generation/beauty-routine | 7 | [模板页] 护肤 Routine |
| /ai-video-generation/before-after-video | 4 | 前后对比视频 |
| /ai-video-generation/image-to-video | 4 | 图片转视频 (工具页) |
| /ai-video-generation/food-video | 4 | [模板页] 食品饮品 |

**唯一性冲突：仅 2 条**——`lifestyle-app-recommendation`、`streamer-reaction-app` 同时被 hub（图片转视频）与 video-ads（视频广告）引用；真实工具应为**视频广告**（App 演示广告）。执行时从 hub picker 移除这 2 张卡（removed 入 manifest 可回滚）。

**模板页 22 个视频**（试穿 Reel 11、护肤 Routine 7、食品 4）属分类示范页不占工具槽位；如需主工具归属建议统一记「图片转视频」（其真实来源均为单图转视频），仅记录、不强行建引用。

**空缺工具**：视频链接 / 文字转视频 / AI孪生 = 0 视频——保持现状，待真实案例，**不硬凑**。

## 4. 行业维度：覆盖现状与补齐

| facet | 产品数 | 带片数 | 处置 |
|---|---|---|---|
| `/industries/apps` | 6 | 3 | 维持 3（达标） |
| `/industries/beauty-skincare` | 36 | 14 | 修正后 more 准（makeup-tools 类目 +1） |
| `/industries/e-commerce` | 12 | 7 | 维持，修正后更准 |
| `/industries/education` | 9 | 7 | 维持 7 |
| `/industries/electronics` | 33 | 20 | — |
| `/industries/explainer` | 6 | 4 | 维持 4（达标） |
| `/industries/fashion-clothing` | 62 | 22 | 保持（带片足） |
| `/industries/financial-services` | 8 | 6 | 修正 -2（power bank 迁出），仍余 6 带片 ✓ |
| `/industries/food-drinks` | 35 | 8 | 维持 8；生成队列优先 |
| `/industries/health-wellness` | 18 | 13 | 修正 +water-bottle → 15 |
| `/industries/home-living` | 43 | 26 | 保持（带片足） |
| `/industries/jewelry-accessories` | 25 | 14 | 修正后 14→13 但准确性提升 |
| `/industries/kids-toy` | 6 | 3 | 维持 3（达标） |
| `/industries/other` | 42 | 26 | 剔除错误标签后数量下降属正常清理 |
| `/industries/pet` | 9 | 6 | 维持 6 |
| `/industries/shoes` | 24 | 4 | 维持 4 ✓ |
| `/industries/sports-gym` | 17 | 13 | 修正 +folding-bike → 15 |
| `/industries/ugc` | 6 | 4 | 维持 4-6 |
| `/industries/viral` | 4 | 4 | — |
| `/occasions/black-friday` | 15 | 2 | 维持 2（短片匹配） |
| `/occasions/holidays` | 21 | 1 | **1 → ≤2（候选待确认）**，仍薄弱：生成队列优先 |
| `/occasions/sale-discount` | 24 | 5 | 维持 5（+1 候选） |
| `/platforms/amazon-product-photos` | 4 | 0 | **0 → ≤2（候选待确认，不足不硬塞）** |
| `/platforms/facebook-ads` | 18 | 6 | 维持 6 |
| `/platforms/instagram-ads` | 41 | 28 | 保持 |
| `/platforms/shopify-product-photos` | 7 | 0 | **0 → ≤2（候选待确认，不足不硬塞）** |
| `/platforms/tiktok-ads` | 51 | 45 | 保持 |
| `/platforms/youtube-shorts-ads` | 19 | 15 | 保持 |

**离“每分类 ≥1 视频”仅差 3 处**：occasions/holidays(1)、platforms/amazon(0)、platforms/shopify(0)。候选全部真实匹配、一致性 medium，待确认；若认为不真实则维持现状转生成队列。

## 5. 错分类修正清单（真实产品依据）

| # | slug | 现属 | 修正后 | 依据 | 置信度 |
|---|---|---|---|---|---|
| 1 | `folding-bike-commute` | jewelry-accessories | sports-gym,e-commerce | 真实产品=折叠自行车，与珠宝无关；jewelry-accessories 为错标 | high |
| 2 | `earbud-box-reveal` | jewelry-accessories | electronics | 真实产品=耳机开箱，非珠宝 | high |
| 3 | `green-notebook-desk-ritual` | home-living,jewelry-accessories,instagram-ads,tiktok-ads | home-living | 真实产品=桌面笔记本/文具，非珠宝 | high |
| 4 | `quiet-unboxing-makeup-tools` | jewelry-accessories | beauty-skincare | 真实产品=化妆刷具，应归美妆个护 | high |
| 5 | `phone-ring-grip-one-hand-demo` | electronics,jewelry-accessories,tiktok-ads,youtube-shorts-ads | electronics | 手机指环支架，归数码配件 | high |
| 6 | `magnetic-power-bank-snap-on-unboxing` | electronics,financial-services,sale-discount,tiktok-ads,youtube-shorts-ads | electronics,sale-discount | 磁吸充电宝，financial-services 为误标 | high |
| 7 | `thin-magnetic-power-bank-unboxing` | electronics,financial-services,sale-discount,tiktok-ads,youtube-shorts-ads | electronics,sale-discount | 同上 | high |
| 8 | `water-bottle-demo-cap-twists-open` | fashion-clothing,food-drinks | health-wellness | 水瓶随行杯，fashion-clothing 为误标；sports-gym 亦可 | medium |
| 9 | `yogurt-demo-spoonful-tasted` | other | food-drinks | 酸奶试吃，归食品饮品 | high |
| 10 | `street-interview-fitness-gear` | e-commerce,health-wellness | sports-gym,e-commerce | 街头采访运动装备，补 sports-gym | high |
| 11 | `perfume-bottle-in-a-room` | beauty-skincare,food-drinks | beauty-skincare | 香水归美妆，去除误加的 food-drinks | high |
| 12 | `product-listing-screen-demo` | e-commerce | e-commerce,shopify-product-photos | 商品列表操作演示；补 shopify（现 0 视频） | medium |
| 13 | `night-serum-order-packing` | beauty-skincare,e-commerce,instagram-ads,tiktok-ads | beauty-skincare,e-commerce,amazon-product-photos | 打包发货场景；补 amazon（现 0），存疑待确认 | medium |
| 14 | `sealed-box-order-unboxing` | e-commerce,home-living,facebook-ads,tiktok-ads | e-commerce,home-living,amazon-product-photos | 快递箱开箱；补 amazon，存疑待确认 | medium |
| 15 | `silicone-case-compare-ad` | e-commerce | e-commerce,shopify-product-photos | 手机壳对比广告适合电商位，存疑待确认 | medium |
| 16 | `silk-scarf-unboxing` | jewelry-accessories | jewelry-accessories,holidays,fashion-clothing | 礼盒开箱贴节日送礼；holidays 现仅 1 | medium |
| 17 | `sage-overshirt-unboxing` | fashion-clothing,ugc | fashion-clothing,ugc,sale-discount | 服饰开箱支撑折扣位 | medium |

> 只改卡片的 `placement` 数组（行业/平台/场合标牌），**不改 slug、不改 URL、不动工具页展示**——虽然 wrapper 无 Red Code，执行仍走 manifest+CAS。

## 6. 数据缺口与生成建议

### 6.1 待生成视频（视频类 92 个无片）

集中在：首页38 个 v1 模板 demo（无片）、occasions 页 15 个（BF/节日礼盒为主）、product-video 页 10 个（抽屉/旅行充/伞等微距）。“分类薄弱位”（holidays / food-drinks / fashion）从这批中挑选故事真实的产品生成，而非给已有视频错标。

### 6.2 首页旧演示条 38 个

v1 时代模板 demo，详情页均在线。**不删除**（已收录、删需单独 308 下线流程）；列为本世代生成候选池/待替换。

### 6.3 建议生成队列

holidays 礼盒 > food-drinks 饮品 > amazon/shopify 平台演示 > apps 应用演示 —— 每类 3-5 条。

## 7. 工具×预期（执行后）

| 工具 | 现状 | 微调后 |
|---|---|---|
| 图片转视频 | 42（hub 38 + 工具页 4） | 40（-2 App 冲突卡） |
| 视频广告 | 39 | 41（+2） |
| 产品视频 | 13 | 13 |
| 前后对比 | 4 | 4 |
| 发言人视频 | 53 | 53 |
| 视频链接/文字转视频/AI孪生 | 0 | 0（待真实案例） |
| 模板页示范（不计工具） | 22 | 22 |

## 8. 完整分配表

全量分配明细见同仓附录文件（生成时同步入 docs/），字段：slug / owner / hasVideo / placement_now / placement_after / tool_primary / note / confidence。保持不变项不在文档逐条列出。

## 9. 执行计划（文档确认后另行开工）

| 阶段 | 内容 | 安全门禁 |
|---|---|---|
| P0 | 本文档评审（确认冲突裁决、15 处错分类修正、holidays/amazon/shopify 候选） | 逐条确认 low/medium 项 |
| P1 | manifest：placement/tool 字段 before-after + removed[]（hub 2卡全量原数据）+ rollback | dry-run diff 人工核对 |
| P2 | 生产执行：Prisma 单行 CAS 更新（site_aidreamcapes 过滤） | base-hash 乐观锁 |
| P3 | 验证：alias smoke（全部旧地址仍 308）、`audit:aivideosugc-media-integrity`、sitemap 契约（无 URL 增减、video:video 仍 171）、facet 抽查 | 门禁失败即回滚 |
| P4 | CDN 精准 purge 受影响 facet + 公网复测（源站 200 ≠ 用户 200） | — |

**红线对照**：全程 0 URL 消失；0 新增 308 需求；所有变更仅字段级（placement/tool/展示引用），详情 URL 集不变；每次变更 manifest+rollback。

## 10. 待确认问题

1. 2 个 App 冲突卡：确认从「图片转视频」hub picker 移除，仅保留视频广告？
2. amazon / shopify 平台位：候选（快递开箱/店铺演示）真实贴合，但要不要计到平台页？也可改为只入行业位（e-commerce）、平台位走生成队列。
3. holidays 拟增 silk-scarf-unboxing（丝巾礼盒开箱）作为礼物场景，可否？
4. 模板页 22 个视频主工具=图片转视频：仅记录，还是要在工具页补展示？
5. 首页 38 个 v1 旧演示详情页：保留待替换（建议），还是单独走 308 下线清退？
