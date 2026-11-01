# 视频详情页归类计划（2026-11-01，第三轮图片真值定稿）

> 状态：**纯计划文档，未动任何代码或数据**。三轮复核：R1 提示词实体 → R2 全量交叉校验+人工 → **R3 下载 25 张卡片原图肉眼查验（硬证据）**。最终修正 57 条（高置信 41 / 待你确认 16）。

## 1. 目标与约束

1. **工具唯一**：每个视频详情页在工具维度只归一个工具页（图片转视频/视频链接/视频广告/产品视频/前后对比视频/文字转视频/发言人视频/AI孪生）。
2. **分类覆盖**：19 行业 + 3 场合 + 6 平台 facet 页每个都应有视频示例（硬性 ≥1，目标 ≥3）。
3. **真实产品归类**：按画面/提示词中的真实产品实体判定。
4. **收录安全红线**：不删除已收录页、不改 publicSlug、不移动属主；变更=placement 字段 + 工具页引用卡（方案B），manifest+CAS+门禁。

## 2. 重大发现（R3 图片真值）

### 2.1 七个详情页标题与画面完全不符

下表 7 个 KV 模板示例卡（属主 `/ai-image-generation/sale-campaign-key-visual`，label 为空、线上标题由 slug 生成），**slug 文字与画面是两个世界**——已逐张下载原图确认：

| slug（=现线上标题） | 画面真实内容（原图已查验） | 分类结论 |
|---|---|---|| lunch-box-on-the-last-day | **藏青色棒球帽** 桌面棚拍 | 棒球帽→珠宝配饰（帽=配饰） || suitcase-with-room-for-the-offer | **白色皮面球鞋** 蓝灰棚拍 | 球鞋→鞋靴 || tote-with-space-for-the-offer | **米色针织衫模特半身像** | 模特时装→服装 || wallet-unboxing-with-offer-space | **牛仔裤+白球鞋上脚** | 上脚鞋→鞋靴 || cardigan-ready-for-season-end | **米白羊毛大衣** 穿着照 | 大衣→服装 || sandals-tried-on-at-the-market | **白色球鞋** 绿慕斯棚拍 | 球鞋→鞋靴 || running-shoes-before-the-jog | **藏青棒球帽** 白棚拍（与 lunch-box 同款帽不同角度） | 棒球帽→珠宝配饰 |
**影响**：这 7 个已收录页存在「标题说午餐盒/鞋，画面是帽子/球鞋」的内容完整性问题（Google 抓取标题与图片不符是不好的信号）。且这些卡挂着一刀切模板标签（fashion+shoes+BF+holidays+sale+fb+ig）。

### 2.2 处置建议（本周内动作，字段级）
1. **分类**按画面改（本计划第 4 节已含这 7 条）。
2. **标题修复**：这些卡 label 为空、标题取自 slug。修复=给卡补 `label` 字段为画面真实产品名（如 "Navy Baseball Cap on Wooden Table"），**不改 slug/URL**——线上 `<title>` 需确认随 label 渲染后生效（执行时验证），属正常内容更新。
3. 若想彻底把 slug 也改对（URL 层改名），必须走 308 别名迁移流程（google-indexed-url-safety），**建议本期不做**，只修 label。

## 3. 工具维度（不变，含已确认决策）

| 页面 | 带片视频 | 备注 |
|---|---|---|
| spokesperson-video | 53 | 发言人 |
| video-ads | 39 | 视频广告 |
| hub picker | 36 | 图片转视频 |
| product-video | 13 | 产品视频 |
| fashion-try-on-reel | 11 | 模板页→方案B |
| beauty-routine | 7 | 模板页→方案B |
| before-after-video | 4 | 前后对比 |
| image-to-video | 4 | 方案B 承接22张引用卡 |
| food-video | 4 | 模板页→方案B |

已确认：方案B（模板页 22 视频在图片转视频工具页建引用）；首页 38 v1 页保留待替换；App 冲突卡摘除（零收录影响）待你最终点头；视频链接/文字转视频/AI孪生 0 片不硬凑。

## 4. 最终修正清单（57 条，行业 placement）

| # | slug | 现行业 | 修正后 | 置信 | 依据 |
|---|---|---|---|---|---|| 1 | `bag-on-a-cafe-table` | industries | jewelry-accessories | medium | 包→配饰，替换fashion |
| 2 | `bathroom-robe-mirror-selfie` | industries | beauty-skincare | medium | 早晚护肤泵瓶→美妆个护，替换home-living |
| 3 | `berry-bowl-first-bite-reel` | industries | health-wellness,food-drinks | high | 莓果碗→补食品饮品 |
| 4 | `bottle-ad-with-a-person` | industries | health-wellness,sports-gym | high | 【图片真值】画面=健身房柜+水瓶出运动袋→健康+运动，替换food-drinks |
| 5 | `brand-film` | industries,industries,industries,platforms | electronics | high | 【图片真值】画面=黑色蓝牙音箱→数码，摘jewelry/shoes |
| 6 | `camel-weekender-on-a-car-seat` | industries | jewelry-accessories | medium | 周末旅行袋→配饰，替换fashion |
| 7 | `cardigan-ready-for-season-end` | industries,industries,occasions,occasions,occasions,platforms,platforms | fashion-clothing | high | 【图片真值】画面=米白羊毛大衣→服装（保留fashion，摘shoes） |
| 8 | `close-shot-of-a-silver-ring` | industries,industries,industries,platforms,platforms | jewelry-accessories | high | 【图片真值】画面=银印章戒→珠宝，摘fashion/shoes |
| 9 | `color-variants` | industries,industries,platforms,platforms | home-living | high | 【图片真值】画面=鼠尾草绿皂液器→家居生活，替换fashion/shoes |
| 10 | `cream-blouse-in-a-studio` | industries,industries | fashion-clothing | high | 衬衫→服装，摘beauty |
| 11 | `cream-bowl-sauce-demo` | industries,industries | food-drinks | high | 酱料碗演示→食品饮品，摘beauty |
| 12 | `cream-candle-jar` | industries,industries | home-living | medium | 蜡烛罐→家居生活，摘beauty |
| 13 | `cream-lamp-desk` | industries,industries | home-living | high | 【提示词】台灯→家居生活，摘beauty |
| 14 | `cream-mug-desk` | industries,industries,industries | food-drinks,home-living | medium | 马克杯→食品器皿+家居，摘beauty |
| 15 | `creator-style-photo` | industries,industries,platforms,platforms | health-wellness | high | 运动后水瓶→健康，摘beauty |
| 16 | `crossbody-try-on-fabric-messenger-bag` | industries | jewelry-accessories | medium | 邮差包→配饰，替换fashion |
| 17 | `earbud-box-reveal` | industries | electronics | high | 提示词：耳机开箱→数码 |
| 18 | `every-angle` | industries,industries,industries,industries,platforms,platforms | electronics | high | 【图片真值】画面=音箱前后多角度→数码，摘home/jewelry/shoes |
| 19 | `first-person-discovery-court-gear` | industries,industries | explainer,health-wellness,sports-gym | medium | 球场握力带→补运动健身 |
| 20 | `folding-bike-commute` | industries | sports-gym,e-commerce | high | 提示词+常识：折叠自行车→运动出行 |
| 21 | `gift-bottle-held-in-both-hands` | industries,occasions | health-wellness | high | 【图片真值】画面=圣诞礼盒+水瓶→保留holidays，行业food→health |
| 22 | `green-notebook-desk-ritual` | industries,industries,platforms,platforms | home-living | high | 提示词：桌面文具→家居生活 |
| 23 | `hand-demo-open-a-leather-wallet` | industries | jewelry-accessories | high | 真皮钱包→配饰，替换fashion |
| 24 | `handbag-on-a-marble-cafe-table` | industries | jewelry-accessories | medium | 手提包→配饰，替换fashion |
| 25 | `how-to-product-video` | industries,industries,industries,platforms | electronics,home-living | medium | 手持挂烫机→家居衣物护理，摘health-wellness |
| 26 | `jar-on-white-for-catalog-match` | industries,industries | home-living,e-commerce | high | 【图片真值】画面=玻璃储物罐→家居生活（保留e-commerce） |
| 27 | `jewelry-on-model` | industries,industries,platforms,platforms | jewelry-accessories | high | 银项链→珠宝，摘beauty |
| 28 | `linen-tote-at-a-farmers-market` | industries | jewelry-accessories | medium | 托特包→配饰，替换fashion |
| 29 | `lunch-bag-packed-for-a-black-friday-deal` | industries,industries,occasions,occasions | home-living | medium | 午餐包（无画面验证）→家居生活，替换fashion/food；保留BF/sale场合 |
| 30 | `lunch-box-on-the-last-day` | industries,industries,occasions,occasions,occasions,platforms,platforms | jewelry-accessories | high | 【图片真值】画面=藏青棒球帽→配饰；slug文字不可信 |
| 31 | `lunchbox-latch-clicks-shut` | industries | home-living | high | 午餐盒卡扣→家居生活，替换electronics |
| 32 | `magnetic-power-bank-snap-on-unboxing` | industries,industries,occasions,platforms,platforms | electronics,sale-discount | high | 磁吸充电宝→数码 |
| 33 | `packaging-preview` | industries,industries,industries,industries,platforms,platforms | food-drinks | high | 【图片真值】画面=咖啡包装袋→食品饮品，摘beauty/home/jewelry |
| 34 | `perfume-bottle-in-a-room` | industries,industries | beauty-skincare | high | 香水→美妆，摘food-drinks |
| 35 | `phone-ring-grip-one-hand-demo` | industries,industries,platforms,platforms | electronics | high | 手机指环支架→数码 |
| 36 | `quiet-unboxing-makeup-tools` | industries | beauty-skincare | high | 提示词：化妆刷具→美妆个护 |
| 37 | `resistance-band-home-demo` | industries | health-wellness,sports-gym | high | 阻力带→补运动健身 |
| 38 | `running-shoes-before-the-jog` | industries,industries,occasions,occasions,occasions,platforms,platforms | jewelry-accessories | high | 【图片真值】画面=藏青棒球帽白底→配饰；slug文字不可信 |
| 39 | `sage-bottle-front-hall` | industries | health-wellness | medium | 保温瓶→健康饮水，替换food-drinks |
| 40 | `sage-soap-dispenser-on-white` | industries | home-living | high | 【图片真值】画面=皂液器→家居生活，替换beauty |
| 41 | `sale-banner` | industries,industries,occasions,occasions,occasions,platforms,platforms | home-living | high | 【图片真值】画面=蓝色拉杆箱机场→家居/旅行 |
| 42 | `sandals-tried-on-at-the-market` | industries,industries,occasions,occasions,occasions,platforms,platforms | shoes | high | 【图片真值】画面=白球鞋绿背景→鞋靴（保留shoes，摘fashion） |
| 43 | `sea-glass-kettle-on-white` | industries | home-living | high | 【图片真值】画面=珐琅烧水壶→家居厨房，替换food-drinks |
| 44 | `show-the-pump-bottle-on-white` | industries | beauty-skincare | medium | 【图片真值】画面=无标签粉色泵瓶（洗护形态）→美妆个护，替换food-drinks |
| 45 | `silicone-case-compare-ad` | industries | e-commerce,electronics | high | 手机壳→补数码 |
| 46 | `steel-bottle-on-white` | industries | health-wellness | high | 【图片真值】画面=钢制水瓶→健康饮水，替换food-drinks |
| 47 | `story-ad` | industries,industries,occasions,occasions,occasions,platforms,platforms | food-drinks | high | 【图片真值】画面=辣酱瓶+辣椒→食品饮品，替换fashion/health |
| 48 | `street-interview-fitness-gear` | industries,industries | e-commerce,health-wellness,sports-gym | high | 运动装备→+运动健身 |
| 49 | `study-room-desk-study-chat` | industries,industries | education,home-living,food-drinks | medium | 冻干零食袋→补食品饮品 |
| 50 | `suitcase-with-room-for-the-offer` | industries,industries,occasions,occasions,occasions,platforms,platforms | shoes | high | 【图片真值】画面=白色皮面球鞋→鞋靴 |
| 51 | `thin-magnetic-power-bank-unboxing` | industries,industries,occasions,platforms,platforms | electronics,sale-discount | high | 磁吸充电宝→数码 |
| 52 | `tote-at-a-farmers-market` | industries | jewelry-accessories | medium | 托特包→配饰，替换fashion |
| 53 | `tote-with-space-for-the-offer` | industries,industries,occasions,occasions,occasions,platforms,platforms | fashion-clothing | high | 【图片真值】画面=米色针织衫模特肖像→服装 |
| 54 | `wallet-unboxing-with-offer-space` | industries,industries,occasions,occasions,occasions,platforms,platforms | shoes | high | 【图片真值】画面=牛仔裤配白球鞋→鞋靴 |
| 55 | `water-bottle-demo-cap-twists-open` | industries,industries | health-wellness | medium | 水瓶→健康饮水 |
| 56 | `yoga-mat-stretch-ugc` | industries | health-wellness,sports-gym | high | 瑜伽垫→补运动健身 |
| 57 | `yogurt-demo-spoonful-tasted` | industries | food-drinks | high | 酸奶试吃→食品饮品 |

共同规则：包袋/钱包/帽子→珠宝配饰；鞋靴→鞋靴；餐盒/行李箱/烛灯/文具→家居生活；水瓶→健康饮水；包装袋→食品饮品。（场合/平台标签在视觉语境属实时保留：sale-wall 组保留 sale-discount+facebook/instagram，摘 black-friday/holidays）

## 5. 覆盖面影响（修正后模拟）

| facet | 修正前产品数 | 修正后 |
|---|---|---|| beauty-skincare | 0 | 4 |
| e-commerce | 0 | 4 |
| education | 0 | 1 |
| electronics | 0 | 8 |
| explainer | 0 | 1 |
| fashion-clothing | 0 | 3 |
| food-drinks | 0 | 7 |
| health-wellness | 0 | 11 |
| home-living | 0 | 13 |
| industries | 328 | 271 |
| jewelry-accessories | 0 | 11 |
| occasions | 33 | 20 |
| platforms | 70 | 49 |
| sale-discount | 0 | 2 |
| shoes | 0 | 3 |
| sports-gym | 0 | 6 |

> 修正前的视频覆盖率不变（28 个 facet 已全部满足 ≥1 视频，被拒的 amazon/shopify/holidays 候选走生成队列）。

## 6. 执行计划与红线（不变）

P0 本文档确认 → P1 manifest（before/after + label 补写 + 方案B 22 引用卡 + rollback）→ P2 生产 CAS → P3 门禁（alias smoke / 媒体完整性 / sitemap 契约 / facet 抽查）→ P4 CDN purge + 公网复测。全程 0 URL 消失、0 别名新增、0 属主迁移。

## 7. 待确认

1. App 冲突卡摘 hub（零收录影响，等你确认）。
2. medium 条目（约 12 条）过目：`lunch-bag-packed-for-a-black-friday-deal`、`show-the-pump-bottle-on-white`、`yogurt` family 已高置信。
3. 七个「标题≠画面」页：同意本期只补 label（不动 slug/URL）？
4. 包袋/帽子→珠宝配饰规则是否符合直觉？
