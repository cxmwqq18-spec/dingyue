# 视频详情页归类计划（2026-11-01，第二轮复核修订）

> 状态：**纯计划文档，未动任何代码或数据**。按 google-indexed-url-safety 规范编制。第二轮已对全部 328 个详情页按完整提示词的产品实体逐条复核（行业关键词交叉校验 + 人工判定），修正清单见第 5 节（共 52 条：高置信 30 条 / 待确认 22 条）。

## 1. 目标与约束

1. **工具唯一**：每个视频详情页在工具维度只归一个工具页（图片转视频/视频链接/视频广告/产品视频/前后对比视频/文字转视频/发言人视频/AI孪生），同一视频不得同时出现在两个工具页示例画廊。
2. **分类覆盖**：19 行业 + 3 场合 + 6 平台的 facet 页每个都应有视频示例（硬性 ≥1，目标 ≥3）。
3. **真实产品归类**：行业归属按视频里真实产品实体判定，禁止凑数硬塞。
4. **收录安全红线**：不删除任何已收录详情页、不改任何 publicSlug、不移动属主；所有变更=字段级 placement + 工具页引用卡（方案 B），manifest 含 removed/rollback + 生产 CAS + 门禁。

## 2. 现状快照（生产库 + sitemap 复核一致）

| 指标 | 数值 |
|---|---|
| 详情页总数 | **358**（视频类 250 + 图片类 108） |
| 唯一成片视频 | **171** 个 mp4 一一对应详情页，无复用 |
| 视频类带片 | 171/250（68%），92 个纯图待生成 |
| facet 页 | 19 行业 + 3 场合 + 6 平台 = 28 |
| 归属机制 | 详情页=属主页卡片投影；工具归属=工具页引用关系（渲染反查）；行业=卡片 placement（编译器按产品身份去重） |

## 3. 工具维度：现状与已定决策

| 页面 | 带片视频数 | 角色 |
|---|---|---|
| /ai-video-generation/spokesperson-video | 53 | 发言人视频 |
| /ai-video-generation/video-ads | 39 | 视频广告 |
| /ai-video-generation（hub picker） | 36 | 图片转视频 |
| /ai-video-generation/product-video | 13 | 产品视频 |
| /ai-video-generation/fashion-try-on-reel | 11 | [模板页] 试穿 Reel → 方案 B |
| /ai-video-generation/beauty-routine | 7 | [模板页] 护肤 Routine → 方案 B |
| /ai-video-generation/before-after-video | 4 | 前后对比视频 |
| /ai-video-generation/image-to-video | 4 | 图片转视频工具页（方案 B 承接 22 张引用卡） |
| /ai-video-generation/food-video | 4 | [模板页] 食品饮品 → 方案 B |

**已定决策（2026-11-02 用户确认）**：
1. **方案 B（真建引用）**：模板页 22 个视频（试穿 11 / 护肤 7 / 食品 4）将在「图片转视频」工具页画廊补建 22 张引用卡（引向既有详情页，不进 hub picker）。仅加引用，不移动属主、不改 URL。
2. **App 冲突卡**（lifestyle-app-recommendation / streamer-reaction-app）：技术结论=从 hub picker 摘除对已收录页面零影响（详情页属主在 video-ads，URL/sitemap/VideoObject 全不动，仅 hub 页展示层少 2 个入口）。**等待用户最终确认**。
3. **首页 38 个 v1 旧演示详情页**：保留待替换（用户已确认），列为本世代生成候选池。
4. 视频链接/文字转视频/AI孪生 = 0 视频：保持现状，待真实案例，不硬凑。

## 4. 行业维度：覆盖现状与结论

| facet | 产品数 | 带片数 | 处置 |
|---|---|---|---|
| `/industries/apps` | 6 | 3 | 维持（达标） |
| `/industries/beauty-skincare` | 36 | 14 | 清理误挂（烛/灯/杯/罐）后更准 |
| `/industries/e-commerce` | 12 | 7 | 维持 |
| `/industries/education` | 9 | 7 | 维持 |
| `/industries/electronics` | 33 | 20 | 承接耳机/充电宝/手机壳等 |
| `/industries/explainer` | 6 | 4 | 维持 |
| `/industries/fashion-clothing` | 62 | 22 | 清理误挂后全部为真实服装 |
| `/industries/financial-services` | 8 | 6 | power bank 迁出；realtor 留（无房产分类，最接近的既有分类） |
| `/industries/food-drinks` | 35 | 8 | 补 berry-bowl/story-ad 等真实项 |
| `/industries/health-wellness` | 18 | 13 | 承接水瓶/保温瓶类 |
| `/industries/home-living` | 43 | 26 | 承接文具/餐盒/行李箱类修正 |
| `/industries/jewelry-accessories` | 25 | 14 | 统一承接包袋/钱包类配饰修正 |
| `/industries/kids-toy` | 6 | 3 | 维持（积木/木火车等真实玩具） |
| `/industries/other` | 42 | 26 | 正常清理（yogurt/story-ad 等迁出） |
| `/industries/pet` | 9 | 6 | 维持 |
| `/industries/shoes` | 24 | 4 | 清理误挂后全部为真实鞋靴 |
| `/industries/sports-gym` | 17 | 13 | 补阻力带/瑜伽垫/握力带 |
| `/industries/ugc` | 6 | 4 | 维持 |
| `/industries/viral` | 4 | 4 | 维持 |
| `/occasions/black-friday` | 15 | 2 | 维持 2 视频 |
| `/occasions/holidays` | 21 | 1 | 维持 1 视频（silk-scarf 候选拒绝），生成队列优先 |
| `/occasions/sale-discount` | 24 | 5 | 维持 |
| `/platforms/amazon-product-photos` | 4 | 0 | 维持 0 视频（候选经复核拒绝，走生成队列） |
| `/platforms/facebook-ads` | 18 | 6 | 维持 |
| `/platforms/instagram-ads` | 41 | 28 | 维持 |
| `/platforms/shopify-product-photos` | 7 | 0 | 维持 0 视频（同上） |
| `/platforms/tiktok-ads` | 51 | 45 | 维持 |
| `/platforms/youtube-shorts-ads` | 19 | 15 | 维持 |

## 5. 第二轮复核：完整修正清单（主要交付，共 52 条）

复核方法：导出全部卡片完整提示词 → 提取真实产品实体 → 行业关键词交叉自动校验（标记 120 个疑似）→ 逐条人工判定。修正只改 placement，不改 slug/URL/属主：

| # | slug | 现行业 | 修正后 | 置信 | 依据 |
|---|---|---|---|---|---|| 1 | `bag-on-a-cafe-table` | fashion-clothing | jewelry-accessories | medium | 包→配饰，替换fashion |
| 2 | `bathroom-robe-mirror-selfie` | home-living | beauty-skincare | medium | 早晚护肤泵瓶→美妆个护，替换home-living |
| 3 | `berry-bowl-first-bite-reel` | health-wellness | health-wellness,food-drinks | high | 莓果碗→补食品饮品 |
| 4 | `brand-film` | electronics,jewelry-accessories,shoes,youtube-shorts-ads | electronics | high | 黑色蓝牙音箱→数码，摘jewelry/shoes |
| 5 | `camel-weekender-on-a-car-seat` | fashion-clothing | jewelry-accessories | medium | 周末旅行袋→配饰，替换fashion |
| 6 | `cardigan-ready-for-season-end` | fashion-clothing,shoes,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | fashion-clothing | high | 开衫→服装，摘shoes |
| 7 | `close-shot-of-a-silver-ring` | fashion-clothing,jewelry-accessories,shoes,amazon-product-photos,shopify-product-photos | jewelry-accessories | high | 银戒指→珠宝，摘fashion/shoes |
| 8 | `color-variants` | fashion-clothing,shoes,amazon-product-photos,shopify-product-photos | home-living | medium | 分装瓶/分配器→家居生活，替换fashion/shoes |
| 9 | `cream-blouse-in-a-studio` | beauty-skincare,fashion-clothing | fashion-clothing | high | 衬衫→服装，摘beauty |
| 10 | `cream-bowl-sauce-demo` | beauty-skincare,food-drinks | food-drinks | high | 酱料碗演示→食品饮品，摘beauty |
| 11 | `cream-candle-jar` | beauty-skincare,home-living | home-living | medium | 蜡烛罐→家居生活，摘beauty |
| 12 | `cream-lamp-desk` | beauty-skincare,home-living | home-living | high | 台灯→家居生活，摘beauty |
| 13 | `cream-mug-desk` | beauty-skincare,food-drinks,home-living | food-drinks,home-living | medium | 马克杯→食品器皿+家居，摘beauty |
| 14 | `creator-style-photo` | beauty-skincare,health-wellness,instagram-ads,shopify-product-photos | health-wellness | high | 运动后水瓶→健康，摘beauty |
| 15 | `crossbody-try-on-fabric-messenger-bag` | fashion-clothing | jewelry-accessories | medium | 邮差包→配饰，替换fashion |
| 16 | `earbud-box-reveal` | jewelry-accessories | electronics | high | 耳机开箱→数码 |
| 17 | `every-angle` | electronics,home-living,jewelry-accessories,shoes,amazon-product-photos,shopify-product-photos | electronics | high | 音箱多角度白底图→数码，摘home/jewelry/shoes |
| 18 | `first-person-discovery-court-gear` | explainer,health-wellness | explainer,health-wellness,sports-gym | medium | 球场握力带→补运动健身 |
| 19 | `folding-bike-commute` | jewelry-accessories | sports-gym,e-commerce | high | 折叠自行车→运动健身 |
| 20 | `green-notebook-desk-ritual` | home-living,jewelry-accessories,instagram-ads,tiktok-ads | home-living | high | 桌面文具→家居生活 |
| 21 | `hand-demo-open-a-leather-wallet` | fashion-clothing | jewelry-accessories | high | 真皮钱包→配饰，替换fashion |
| 22 | `handbag-on-a-marble-cafe-table` | fashion-clothing | jewelry-accessories | medium | 手提包→配饰，替换fashion |
| 23 | `how-to-product-video` | electronics,health-wellness,home-living,youtube-shorts-ads | electronics,home-living | medium | 手持挂烫机→家居衣物护理，摘health-wellness |
| 24 | `jar-on-white-for-catalog-match` | beauty-skincare,e-commerce | home-living,e-commerce | medium | 玻璃储物罐→家居生活，替换beauty |
| 25 | `jewelry-on-model` | beauty-skincare,jewelry-accessories,instagram-ads,shopify-product-photos | jewelry-accessories | high | 银项链→珠宝，摘beauty |
| 26 | `launch-promo` | electronics,food-drinks,holidays,sale-discount,facebook-ads,tiktok-ads | jewelry-accessories | medium | 鼠尾草绿帆布包→珠宝配饰，替换electronics/food |
| 27 | `linen-tote-at-a-farmers-market` | fashion-clothing | jewelry-accessories | medium | 托特包→配饰，替换fashion |
| 28 | `lunch-bag-packed-for-a-black-friday-deal` | fashion-clothing,food-drinks,black-friday,sale-discount | home-living | medium | 午餐包→家居生活，替换fashion/food |
| 29 | `lunch-box-on-the-last-day` | fashion-clothing,shoes,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | home-living | medium | 午餐盒→家居生活，替换fashion/shoes |
| 30 | `lunchbox-latch-clicks-shut` | electronics | home-living | high | 午餐盒卡扣→家居生活，替换electronics |
| 31 | `magnetic-power-bank-snap-on-unboxing` | electronics,financial-services,sale-discount,tiktok-ads,youtube-shorts-ads | electronics,sale-discount | high | 充电宝→数码 |
| 32 | `packaging-preview` | beauty-skincare,food-drinks,home-living,jewelry-accessories,amazon-product-photos,shopify-product-photos | food-drinks | high | 咖啡包装袋→食品饮品，摘beauty/home/jewelry |
| 33 | `perfume-bottle-in-a-room` | beauty-skincare,food-drinks | beauty-skincare | high | 香水→美妆，剔除误挂food-drinks |
| 34 | `phone-ring-grip-one-hand-demo` | electronics,jewelry-accessories,tiktok-ads,youtube-shorts-ads | electronics | high | 手机指环支架→数码 |
| 35 | `quiet-unboxing-makeup-tools` | jewelry-accessories | beauty-skincare | high | 化妆刷具→美妆个护 |
| 36 | `resistance-band-home-demo` | health-wellness | health-wellness,sports-gym | high | 阻力带→补运动健身 |
| 37 | `running-shoes-before-the-jog` | fashion-clothing,shoes,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | shoes | high | 跑鞋→鞋靴，摘fashion |
| 38 | `sage-bottle-front-hall` | food-drinks | health-wellness | medium | 保温瓶→健康饮水，替换food-drinks |
| 39 | `sale-banner` | fashion-clothing,shoes,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | home-living | medium | 行李箱季末海报→家居生活，替换fashion/shoes |
| 40 | `sandals-tried-on-at-the-market` | fashion-clothing,shoes,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | shoes | high | 凉鞋→鞋靴，摘fashion |
| 41 | `silicone-case-compare-ad` | e-commerce | e-commerce,electronics | high | 手机壳→补数码 |
| 42 | `story-ad` | fashion-clothing,health-wellness,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | food-drinks | high | 辣酱淋taco→食品饮品，替换fashion/health |
| 43 | `street-interview-fitness-gear` | e-commerce,health-wellness | e-commerce,health-wellness,sports-gym | high | 运动装备→+运动健身 |
| 44 | `study-room-desk-study-chat` | education,home-living | education,home-living,food-drinks | medium | 冻干零食袋→补食品饮品 |
| 45 | `suitcase-with-room-for-the-offer` | fashion-clothing,shoes,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | home-living | medium | 行李箱→家居生活(旅行收纳)，替换fashion/shoes |
| 46 | `thin-magnetic-power-bank-unboxing` | electronics,financial-services,sale-discount,tiktok-ads,youtube-shorts-ads | electronics,sale-discount | high | 充电宝→数码 |
| 47 | `tote-at-a-farmers-market` | fashion-clothing | jewelry-accessories | medium | 托特包→配饰，替换fashion |
| 48 | `tote-with-space-for-the-offer` | fashion-clothing,shoes,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | jewelry-accessories | medium | 帆布托特包→珠宝配饰(包袋配饰)，替换fashion/shoes |
| 49 | `wallet-unboxing-with-offer-space` | fashion-clothing,shoes,black-friday,holidays,sale-discount,facebook-ads,instagram-ads | jewelry-accessories | high | 钱包→珠宝配饰，替换fashion/shoes |
| 50 | `water-bottle-demo-cap-twists-open` | fashion-clothing,food-drinks | health-wellness | medium | 水瓶→健康饮水，替换误挂fashion/food |
| 51 | `yoga-mat-stretch-ugc` | health-wellness | health-wellness,sports-gym | high | 瑜伽垫→补运动健身 |
| 52 | `yogurt-demo-spoonful-tasted` | other | food-drinks | high | 酸奶→食品饮品 |

**共同原则**：包袋类（tote/handbag/weekender/messenger/钱包）统一归「珠宝配饰」；鞋靴归鞋靴；文具/餐盒/旅行箱归家居生活；包装袋归食品饮品。

**发现的一刀切模板问题**：v1 时代个别图片工具页建卡时给整页挂同一组 placement——`sale-campaign-key-visual` 8 张卡全标 fashion+shoes+3场合+2平台（午餐盒、行李箱都成了「服装+鞋」），`lifestyle-photos` 5 张包品全标服装，`packaging-mockup` 的咖啡袋标了 beauty+food+home+jewelry 四行业。本轮按产品实体逐卡重写。视频类的 placement 基本真实，只有批量模板标签与个别误标。

## 6. 一轮候选的复核结论（拒绝项，避免再「乱分类」）

| slug | 二轮结论 |
|---|---|| `night-serum-order-packing` | **拒绝**：真实产品=夜间精华；「打包发货」是场景不是品类，不补 amazon 平台位 |
| `sealed-box-order-unboxing` | **拒绝**：真实产品=普通快递箱开箱（TikTok Shop 场景），无 Amazon 属性，不补 |
| `silicone-case-compare-ad` | **拒绝**：真实产品=手机壳对比广告，无店铺演示内容，改为补 electronics |
| `silk-scarf-unboxing` | **拒绝**：真实产品=真丝方巾开箱，礼物场景解读牵强；holidays 维持 1 个视频，走生成队列 |
| `sage-overshirt-unboxing` | **拒绝**：真实产品=衬衫开箱，无折扣语境，不补 sale-discount |

**结论**：amazon/shopify 平台位（现 0 视频）与 holidays 补强不做错标，全部转生成队列（真实送货开箱/快递/店铺后台演示题材，每类 3-5 条）。

## 7. 执行计划（字段级，全 manifest）

| 阶段 | 内容 | 门禁 |
|---|---|---|| P0 | 本文档确认（第 5 节逐条 + 第 8 节待定点） | 用户确认 medium 项 || P1 | manifest：每卡 placement before/after + row 定位 + updatedAt CAS + rollback；方案 B 22 张引用卡 added 清单 | dry-run diff 人工核对 || P2 | 生产执行：Prisma 单行 CAS 更新 LivePage.contentJson（site_aidreamcapes） | base-hash 乐观锁冲突即中止 || P3 | 验证：alias smoke（旧地址仍 308）、媒体完整性审计、sitemap 契约（URL 集不变、video:video 仍 171）、28 facet 逐页抽查 | 失败即回滚 || P4 | CDN 精准 purge 受影响 facet/工具页；公网复测 | - |
全程 0 URL 消失、0 新增 308 需求、0 属主迁移；详情页 URL 集与 publicAliases 完全不变。

## 8. 待确认问题

1. **App 冲突卡（Q1）**：确认从 hub picker 摘除 2 张卡，只留视频广告？（技术结论已说明：零收录风险）
2. 第 5 节 medium 条目（约 15 条）逐条过目，尤其 `lunch-box-on-the-last-day`、`color-variants`、`suitcase-with-room-for-the-offer` 这类 v1 无提示词卡（依据 slug 判定）。
3. 包袋→「珠宝配饰」统一规则是否符合你的分类直觉？（另一选择=新增「箱包」facet 页，工程量大，不建议本期）
4. 生成队列优先级：holidays 礼盒 / amazon·shopify 平台演示 / apps 应用演示 / food-drinks 饮品，每类 3-5 条？

## 9. 全量分配表

全量 328 个详情页的明确归属见同目录 `media-categorization-assignments-20261101.json`（本轮已重新生成，rev=2，含 placement_after/no change/置信度）。
