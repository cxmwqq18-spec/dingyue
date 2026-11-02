# 视频详情页归类计划（2026-11-01，rev4 三源定稿）

> 状态：**已于 2026-11-02 在生产执行完毕**（apply report：`scripts/manifests/aidreamcapes-categorization-fixes-production-2026-11-02-apply-report.json`，revision 3516→3549，33 页 / 204 处变更 / 22 张引用卡；回滚清单同目录 `-rollback.json`）。复核方法为三源交叉：**标题(label) × 提示词(产品实体) × 原始图片(52 张逐张肉眼查验)**。最终修正 76 条（图片实证 32 条；高置信 57 / 待确认 19）。

## 1. 三源一致性结论（本轮核心交付）

| 检查维度 | 范围 | 结果 |
|---|---|---|
| label(线上标题来源) vs 提示词产品实体 | 全部 328 页 | **0 处不一致**（有 label 的卡全部吻合；无 label 的 8 张见 1.2） |
| 提示词产品实体 vs 行业 placement | 全部 328 页 | 关键词交叉标 120 疑似 → 逐条人工判定，错标已列入修正（62 处行业变化） |
| 原始图片 vs slug/label/行业 | 52 张（8 张无 label 高风险卡全查 + 全部黑五/节日卡 + 模板命名嫌疑卡） | **8 张标题与画面完全不符**；其余全部吻合 |

### 1.1 内容型 facet 澄清（口径修正）

线上核实：`/industries/education`="Course and Lesson Promos"（课程教学）、`/industries/explainer`="Explain the Product"、`/industries/apps`="App Promos"，ugc/viral 为内容风格页。**how-to 教学、产品走查、UGC 卡挂这些 facet 属真实内容匹配，不算行业错标**——本计划对这类卡「保留内容型标签 + 补真实行业标签」（如咖啡机 how-to = education + home-living）。

### 1.2 标题与画面不符的 8 个页面（slug 编造内容）

| 线上标题(=slug) | 原图真实内容 | 处置 |
|---|---|---|
| Lunch Box on the Last Day | 藏青棒球帽（桌面棚拍） | 行业→配饰；补 label="Navy Baseball Cap on Wooden Table" |
| Suitcase With Room for the Offer | 白色皮面球鞋 | 行业→鞋靴；补 label="White Leather Sneaker Studio" |
| Tote With Space for the Offer | 米色针织衫模特像 | 行业→服装（保留）；补 label="Beige Knit Top Studio Portrait" |
| Wallet Unboxing With Offer Space | 牛仔裤配白球鞋上脚 | 行业→鞋靴；补 label="White Sneakers With Denim, On-Foot" |
| Cardigan Ready for Season End | 米白羊毛大衣 | 行业→服装（保留）；补 label="Cream Wool Coat Street Look" |
| Sandals Tried On at the Market | 白球鞋（无凉鞋） | 行业→鞋靴；补 label="White Sneaker on Green Backdrop" |
| Running Shoes Before the Jog | 藏青棒球帽 | 行业→配饰；补 label="Navy Baseball Cap, White Studio" |
| Gift Box Ready for a Black-Friday Offer | 棕色皮革旅行袋 | 行业→配饰；补 label="Brown Leather Duffel"（BF/sale 场合留） |

> 本期修复=补 label（不改 slug/URL，正常内容更新）；彻底改 slug 需走 308 流程，本期不做。

## 2. 目标与约束

1. **工具唯一**：每个视频详情页只归一个工具页；同一视频不得重复出现在两个工具页示例。
2. **分类覆盖**：28 个 facet 每个都有示例（硬性 ≥1 视频）；场合/平台标签在视觉语境属实时保留、无据不硬标。
3. **真实产品归类**：以画面/提示词中的真实产品实体为准。
4. **收录安全红线**：不删已收录页、不改 publicSlug、不搬属主；placement/label 字段级 manifest + CAS + 门禁。

## 3. 现状与已定决策（不变）

358 详情页（视频 250 + 图 108）；171 个唯一 mp4；facet=19 行业+3 场合+6 平台；工具页带片：发言人 53 / 广告 39 / hub 36 / 产品 13 / 试穿 11 / 护肤 7 / 前后对比 4 / 图转视频页 4 / 食品 4；模板页 22 视频走方案 B（图片转视频工具页补 22 张引用卡）；首页 38 v1 页保留待替换；App 冲突卡摘 hub 零收录影响待确认；视频链接/文字转视频/AI孪生 0 片不硬凑。

## 4. 最终修正清单（76 条）

| # | slug | 现行业 | 修正后 | 置信 | 证据 |
|---|---|---|---|---|---|
| 1 | `an-avatar-holds-the-shaker` | industries | health-wellness,sports-gym | high | 【图片】健身房摇摇杯→健康+运动，替换other |
| 2 | `bag-on-a-cafe-table` | industries | jewelry-accessories | medium | 包→配饰，替换fashion |
| 3 | `bathroom-robe-mirror-selfie` | industries | beauty-skincare | medium | 早晚泵瓶→美妆，替换home |
| 4 | `berry-bowl-first-bite-reel` | industries | food-drinks,health-wellness | high | 莓果碗→+食品 |
| 5 | `bottle-ad-with-a-person` | industries | health-wellness,sports-gym | high | 【图片】健身房+水瓶→健康+运动，替换food |
| 6 | `brand-film` | industries,platforms | electronics | high | 【图片】蓝牙音箱→数码 |
| 7 | `camel-weekender-on-a-car-seat` | industries | jewelry-accessories | medium | 旅行袋→配饰，替换fashion |
| 8 | `canvas-tote-sidewalk` | industries | jewelry-accessories | medium | 托特包→配饰，替换fashion |
| 9 | `cardigan-ready-for-season-end` | industries,occasions,platforms | fashion-clothing | high | 【图片】羊毛大衣→服装，摘shoes |
| 10 | `close-shot-of-a-silver-ring` | industries,platforms | jewelry-accessories | high | 【图片】银戒指→珠宝 |
| 11 | `coffee-maker-how-to-demo` | industries | education,home-living | high | 咖啡机；保留内容型 education，补真实行业 home-living |
| 12 | `color-variants` | industries,platforms | home-living | high | 【图片】皂液器→家居 |
| 13 | `cream-blouse-in-a-studio` | industries | fashion-clothing | high | 衬衫→服装，摘beauty |
| 14 | `cream-bowl-sauce-demo` | industries | food-drinks | high | 酱料碗→食品，摘beauty |
| 15 | `cream-candle-jar` | industries | home-living | medium | 蜡烛罐→家居，摘beauty |
| 16 | `cream-lamp-desk` | industries | home-living | high | 台灯→家居，摘beauty |
| 17 | `cream-mug-desk` | industries | food-drinks,home-living | medium | 马克杯→食品+家居，摘beauty |
| 18 | `creator-style-photo` | industries,platforms | health-wellness | high | 运动后水瓶→健康，摘beauty |
| 19 | `crossbody-try-on-fabric-messenger-bag` | industries | jewelry-accessories | medium | 邮差包→配饰，替换fashion |
| 20 | `deal-day-product-demo` | industries,occasions | home-living | high | 【图片】挂烫机+圣诞树→家居(留sale、补holidays)，替换other |
| 21 | `desk-lamp-product-demo-ugc` | industries | home-living,ugc | high | 台灯；保留 ugc，补 home-living |
| 22 | `earbud-box-reveal` | industries | electronics | high | 耳机开箱→数码 |
| 23 | `every-angle` | industries,platforms | electronics | high | 【图片】音箱多视角→数码 |
| 24 | `fabric-cleaner-lesson-demo` | industries | education,home-living | high | 织物清洁剂；保留 education，补 home-living |
| 25 | `first-person-discovery-court-gear` | industries | explainer,health-wellness,sports-gym | medium | 球场握力带→+运动 |
| 26 | `folding-bike-commute` | industries | e-commerce,sports-gym | high | 折叠自行车→运动出行 |
| 27 | `gift-bottle-held-in-both-hands` | industries,occasions | health-wellness | high | 【图片】圣诞礼盒+水瓶→行业改health；holidays留 |
| 28 | `gift-box-ready-for-a-black-friday-offer` | industries,occasions | jewelry-accessories | high | 【图片】皮革旅行袋(非礼盒!)→配饰；BF/sale留、摘holidays |
| 29 | `gift-guide-product-pack` | industries,occasions | home-living | high | 【图片】礼盒+蜡烛→家居(留holidays)，替换other |
| 30 | `gift-reveal-product-bundle` | industries,occasions | beauty-skincare | high | 【图片】护肤礼盒→美妆(留holidays)，替换other |
| 31 | `green-notebook-desk-ritual` | industries,platforms | home-living | high | 桌面文具→家居生活 |
| 32 | `hand-demo-open-a-leather-wallet` | industries | jewelry-accessories | high | 真皮钱包→配饰，替换fashion |
| 33 | `handbag-on-a-marble-cafe-table` | industries | jewelry-accessories | medium | 手提包→配饰，替换fashion |
| 34 | `headphone-creator-review` | industries | electronics,ugc | high | 耳机创作者测评；保留 ugc，补 electronics |
| 35 | `how-to-product-video` | industries,platforms | electronics,home-living | medium | 手持挂烫机→家居衣物护理，摘health |
| 36 | `jar-on-white-for-catalog-match` | industries | e-commerce,home-living | high | 【图片】储物罐→家居(留e-comm) |
| 37 | `jewelry-on-model` | industries,platforms | jewelry-accessories | high | 银项链→珠宝，摘beauty |
| 38 | `linen-tote-at-a-farmers-market` | industries | jewelry-accessories | medium | 托特包→配饰，替换fashion |
| 39 | `lunch-bag-packed-for-a-black-friday-deal` | industries,occasions | home-living | high | 【图片】保温午餐包→家居；BF/sale场合留，替换fashion/food |
| 40 | `lunch-box-on-the-last-day` | industries,occasions,platforms | jewelry-accessories | high | 【图片】棒球帽→配饰；slug不可信 |
| 41 | `lunchbox-latch-clicks-shut` | industries | home-living | high | 午餐盒→家居，替换electronics |
| 42 | `magnetic-power-bank-snap-on-unboxing` | industries,occasions,platforms | electronics,sale-discount | high | 磁吸充电宝→数码 |
| 43 | `matcha-bowl-set-on-linen` | industries | food-drinks | high | 抹茶碗组→食品饮品，替换fashion |
| 44 | `packaging-preview` | industries,platforms | food-drinks | high | 【图片】咖啡包装袋→食品 |
| 45 | `perfume-bottle-in-a-room` | industries | beauty-skincare | high | 香水→美妆，摘food |
| 46 | `phone-first-sale-post` | industries,occasions | black-friday,electronics | medium | 【图片】黑机身+黑色礼盒丝带→补BF场合 |
| 47 | `phone-ring-grip-one-hand-demo` | industries,platforms | electronics | high | 手机指环支架→数码 |
| 48 | `quiet-unboxing-makeup-tools` | industries | beauty-skincare | high | 化妆刷具→美妆个护 |
| 49 | `resistance-band-home-demo` | industries | health-wellness,sports-gym | high | 阻力带→+运动健身 |
| 50 | `running-shoes-before-the-jog` | industries,occasions,platforms | jewelry-accessories | high | 【图片】棒球帽→配饰；slug不可信 |
| 51 | `sage-bottle-desk-detail` | industries | health-wellness | high | 【图片】桌面开盖水瓶→健康，替换sports-gym |
| 52 | `sage-bottle-front-hall` | industries | health-wellness | medium | 保温瓶→健康，替换food |
| 53 | `sage-soap-dispenser-on-white` | industries | home-living | high | 【图片】皂液器→家居，替换beauty |
| 54 | `sale-banner` | industries,occasions,platforms | home-living | high | 【图片】拉杆箱→家居/旅行 |
| 55 | `sandals-tried-on-at-the-market` | industries,occasions,platforms | shoes | high | 【图片】白球鞋→鞋靴，摘fashion |
| 56 | `sea-glass-kettle-on-white` | industries | home-living | high | 【图片】烧水壶→家居厨房，替换food |
| 57 | `seasonal-product-use` | industries,occasions | beauty-skincare | high | 【图片】圣诞窗前涂唇膏→美妆(留holidays)，替换other |
| 58 | `show-the-canister-on-white` | industries | home-living | high | 【图片】陶瓷储物罐→家居，替换beauty |
| 59 | `show-the-pump-bottle-on-white` | industries | beauty-skincare | medium | 【图片】粉色泵瓶→美妆，替换food |
| 60 | `silicone-case-compare-ad` | industries | e-commerce,electronics | high | 手机壳→+数码 |
| 61 | `speaker-feature-walkthrough` | industries | electronics,explainer | high | 音箱功能走查；保留 explainer，补 electronics |
| 62 | `steam-the-ceramic-canister` | industries | food-drinks,home-living | high | 【图片】咖啡罐冒蒸汽→家居+食品，替换beauty |
| 63 | `steel-bottle-on-white` | industries | health-wellness | high | 【图片】钢水瓶→健康，替换food |
| 64 | `story-ad` | industries,occasions,platforms | food-drinks | high | 【图片】辣酱→食品 |
| 65 | `street-interview-fitness-gear` | industries | e-commerce,health-wellness,sports-gym | high | 运动装备→+运动健身 |
| 66 | `study-room-desk-study-chat` | industries | education,food-drinks,home-living | medium | 冻干零食袋；补 food-drinks |
| 67 | `suitcase-with-room-for-the-offer` | industries,occasions,platforms | shoes | high | 【图片】白色球鞋→鞋靴 |
| 68 | `thin-magnetic-power-bank-unboxing` | industries,occasions,platforms | electronics,sale-discount | high | 磁吸充电宝→数码 |
| 69 | `tote-at-a-farmers-market` | industries | jewelry-accessories | medium | 托特包→配饰，替换fashion |
| 70 | `tote-on-white-for-a-marketplace` | industries | e-commerce,jewelry-accessories | medium | 托特包白底图→配饰(留e-comm)，替换fashion |
| 71 | `tote-with-space-for-the-offer` | industries,occasions,platforms | fashion-clothing | high | 【图片】针织衫模特像→服装 |
| 72 | `umbrella-opens-for-coverage` | industries | home-living | medium | 伞→家居日用，替换other |
| 73 | `wallet-unboxing-with-offer-space` | industries,occasions,platforms | shoes | high | 【图片】牛仔裤白球鞋→鞋靴 |
| 74 | `water-bottle-demo-cap-twists-open` | industries | health-wellness | medium | 水瓶→健康饮水 |
| 75 | `yoga-mat-stretch-ugc` | industries | health-wellness,sports-gym | high | 瑜伽垫→+运动健身 |
| 76 | `yogurt-demo-spoonful-tasted` | industries | food-drinks | high | 酸奶→食品饮品 |

**共同规则**：包袋/钱包/帽子→珠宝配饰；水瓶/保温瓶→健康饮水；餐盒/烛灯/壶/文具/旅行箱→家居生活；包装袋/酱料/饮品→食品饮品；音箱/耳机/手机壳/充电宝→数码；场合标签只在画面有真实呼应时补/留。

## 5. 修正口径

- 内容型标签（education/explainer/apps/ugc）**只保留、不删除**，同时补真实行业 → facet 目录内容只增不减。
- 纯行业错标（如辣酱标 fashion）= 替换。
- tabular 一刀切模板组（sale-campaign 等）按每卡真实产品重写。

## 6. 执行计划

P0 本文档确认 → P1 manifest（placement/label before-after + 方案B 22 引用卡 + rollback）→ P2 生产 CAS → P3 门禁（alias smoke / 媒体完整性 / sitemap 契约 URL 集不变 / video:video 仍 171 / facet 抽查）→ P4 CDN purge + 公网复测。

### 6.1 执行记录（2026-11-02，全部通过）

- **脚本**：`scripts/plan-aidreamcapes-categorization-fixes.mjs`（只读规划）+ `scripts/apply-aidreamcapes-categorization-fixes.mjs`（双层 CAS + 事务内不变量 + 自动回滚清单）；目标常量 `scripts/lib/aidreamcapes-categorization-fix-targets.mjs`。
- **manifest**：33 页；180 张卡写入（76 条 placement 修正覆盖全部副本含 alias 副本 + 8 页 label）；hub 摘 2 张 app 别名卡；image-to-video 增 22 张 `detailAliasOf` 引用卡（**不带 publicSlug**，不破坏单属主规则）。
- **方案 B 实现口径**：22 个模板示范视频（试穿 11 + 护肤 7 + 食品 4）的引用卡挂在 `/ai-video-generation/image-to-video` 的 picker 末尾，href 指向原详情页；详情页属主不变、站点地图不受影响。
- **P3 门禁实测**：sitemap URL 集逐条 diff 零变化（516 loc / 251 视频详情 / 342 video:video）；8 个改 label 页全部 200 且 H1 为诚实标题；单属主校验 328 slug 全部恰 1 属主（0 违例）；唯一成片仍 171；facet 抽查（jewelry 错标清零、sports-gym/health/food 新成员、fashion 抹茶碗迁出）全部符合；公网经 Cloudflare 复测一致。
- **P4**：CDN purge 31 文件 + 8 前缀完成，公网复测通过。
- **6.2 rev5 收口（2026-11-02 下午，用户线上抽查发现残留错标后执行）**：用户在 shoes/beauty/e-commerce/food 四个 facet 页看到无关素材。根因：rev4 只复核了 76 条 slug，而墙页/案例条上**不在 76 名单内的副本**（colorway-variations、sale-campaign、hub、/templates 的别名卡与桶标签副本）从未逐条复核，旧打包标签（fashion/shoes/e-commerce/amazon/shopify）经 placement 并集灌进 facet 网格；另有 39 张「别名详情页」卡（publicSlug+detailAliasOf 双标，同一视频的第二 URL）带未复核标签。rev5 规则：**全站每张带标签副本 = 该 slug 评审终值；别名 slug 镜像其本尊**；另按提示词实证微调 18 条 canonical（如 studio-speaking-to-camera 实为咖啡豆→food-drinks；手机磁吸环→摘 jewelry；e-commerce 仅保留真实电商工作流片）。执行：12 页 / 36 卡，revision 3550→3562；门禁：四 facet stray 清零、真片保留、sitemap URL 集逐条一致（516/251/342）、328 slug 单属主 0 违例、171 唯一成片不变；CDN purge 后公网复测一致。脚本：`scripts/plan-aidreamcapes-placement-reconcile.mjs` + `scripts/lib/aidreamcapes-categorization-fix-targets-rev5.mjs`（apply 脚本已泛化为 manifest 驱动）。
- **6.3 rev6 修正（2026-11-02 晚，用户复验 6 个 facet 页截图后执行）**：两处问题。① 主题错标 11 条 canonical：studio-speaking-to-camera→other（对镜讲话非食品主体）；study-room-desk-study-chat 摘 food-drinks（零食只是道具）；education 口径收严——**教程包装的产品演示（咖啡机/厨房工具/织物清洁剂/午餐盒）全部迁 home-living，education 只留真实学习场景**（课堂/自习室×2/口头课程/tutor）；bento-box-walkthrough 摘 apps→home-living；stemless-earbud-product-detail 摘 jewelry→electronics；cufflink-detail-demo 按用户裁定 jewelry→fashion-clothing；canvas-tote-everyday-carry / canvas-tote-pack-with-me 摘 fashion-clothing（包袋留 jewelry-accessories）。② **facet 页同视频重复卡**：rev5 让 39 张别名卡镜像本尊标签，导致 facet 网格本尊+别名各占一格（viral 页薄荷喷雾/体育场补水各出现 2 次，两卡同指一个详情页）。rev6 规则：**别名 slug 一律清空 placement（[]），每个视频在 facet 网格只经本尊出现一次**；别名详情页保持 200，/templates 筛选不受影响（读 templateDefinition.industries，与卡片 placement 无关）。执行：10 页 / 50 卡（39 别名副本清空 + 11 微调副本），revision 3562→3572。门禁：6 个被框 facet 页 stray 清零且真片保留（每 slug 恰 1 卡，渲染层每卡固定输出 2 次链接）；/industries/viral 的 -templates 别名卡为 0；39 个别名 URL 全量复核——sitemap 设计上即排除 detailAliasOf 卡（media-cards.server.ts enumerateSingleOwnerDetailCards），URL 集零变化（516 loc / 251 视频详情 / 108 图片详情 / 171 video:video），39 页全部 200，**0 URL 消失、0 新增 308**；微调 slug 与别名无身份组交叉（非别名身份组 171 组 0 跨 slug）。脚本：`scripts/plan-aidreamcapes-placement-reconcile-rev6.mjs` + `scripts/lib/aidreamcapes-categorization-fix-targets-rev6.mjs`。
- **后续待办**：本地库按字段同步本次变更（`npm run db:sync:aidreamcapes` 流程）；生成队列（holidays 礼盒 > amazon/shopify 演示 > food-drinks > apps）另行开工。

## 7. 待确认（已全部落定并执行）

1. ~~App 冲突卡摘 hub~~ — 已执行（2 张别名卡移除，video-ads 保留属主）。
2. ~~8 个标题≠画面页：本期只补 label~~ — 已执行（H1/title 换为诚实标题，slug/URL 不动）。
3. ~~medium 条目过目~~ — 已随 76 条清单一并执行。
4. ~~包袋/帽子→珠宝配饰、内容型 facet 保留口径~~ — 按此口径执行完毕。


## 9. 归类执行后的视频详情案例分布（模拟，基于 171 个唯一成片）

### 9.1 行业 facets（带片视频数）

| facet | 现在 | 归类后 | 变化 | 说明 |
|---|---|---|---|---|
| home-living 家居生活 | 26 | 26 | = | 最强，修正后更准 |
| other 其他（兜底） | 26 | 26 | = | 修正后渐进收窄（后续生成按类归） |
| fashion-clothing 服装 | 22 | 22 | = | 修正后全部真实服装 |
| tiktok-ads（平台） | 45 | 45 | = | — |
| electronics 数码 | 20 | 22 | +2 | 承接耳机/手机壳 |
| beauty-skincare 美妆个护 | 14 | 16 | +2 | 承接泵瓶/唇膏场景 |
| instagram-ads（平台） | 28 | 28 | = | — |
| jewelry-accessories 珠宝配饰 | 14 | 9 | -5 | 5 支错标视频迁出（音箱/耳机/自行车/文具/支架），包袋类为 v0 图片；
9 均为真实珠宝配饰 |
| sports-gym 运动健身 | 13 | 17 | +4 | 承接自行车/阻力带/瑜伽垫/健身包水瓶 |
| health-wellness 健康 | 13 | 13 | = | 准确 |
| financial-services 金融服务 | 6 | 4 | -2 | 充电宝错标迁出 |
| food-drinks 食品饮品 | 8 | 10 | +2 | 承接辣酱/酸奶/莓果 |
| e-commerce 电商 | 7 | 8 | +1 | — |
| education 教育（内容型） | 7 | 7 | = | how-to 类保留 |
| pet 宠物 | 6 | 6 | = | — |
| youtube-shorts-ads（平台） | 15 | 15 | = | — |
| facebook-ads（平台） | 6 | 6 | = | — |
| shoes 鞋靴 | 4 | 4 | = | 准确 |
| explainer 讲解（内容型） | 4 | 4 | = | — |
| ugc（内容型） | 4 | 4 | = | — |
| viral | 4 | 4 | = | — |
| apps 应用（内容型） | 3 | 3 | = | — |
| kids-toy 儿童玩具 | 3 | 3 | = | — |
| black-friday（场合） | 2 | 2 | = | 待生成补强 |
| sale-discount（场合） | 5 | 5 | = | — |
| **holidays（场合）** | **1** | **1** | = | **全站最薄弱**，生成队列第一优先 |
| amazon-product-photos（平台） | 0 | 0 | = | 生成队列 |
| shopify-product-photos（平台） | 0 | 0 | = | 生成队列 |

> 同一视频可同时挂行业+场合+平台（多维展示）；工具维度唯一、行业维度去重后全站仍为 **171**。

### 9.2 工具维度（带片视频案例数，工具唯一）

| 工具页 | 现在 | 归类后 | 变化 |
|---|---|---|---|
| spokesperson-video 发言人视频 | 53 | 53 | = |
| video-ads 视频广告 | 39 | 41 | +2（app 冲突卡归一） |
| hub picker（图片转视频） | 36 | 36 | -2 |
| product-video 产品视频 | 13 | 13 | = |
| image-to-video 图片转视频工具页 | 4 | 26 | +22（方案 B 引用卡） |
| before-after-video 前后对比 | 4 | 4 | = |
| url-to-video 视频链接 | 0 | 0 | 待真实案例 |
| text-to-video 文字转视频 | 0 | 0 | 待真实案例 |
| ai-twin AI孪生 | 0 | 0 | 待真实案例 |
| **合计（唯一视频）** | **171** | **171** | 0 Loss |

### 9.3 覆盖结论

- **每个分类至少 1 个视频**：28 个 facet 中 26 个达标；唯二例外 = amazon/shopify 平台位（0）与 holidays 只有 1 —— 不硬凑，生成队列优先补：holidays 礼盒 > amazon/shopify 开箱/店铺演示 > food-drinks > apps。
- 修正后珠宝配饰从 14→9 是纯「准确性红利」：去掉的是音箱/自行车/文具等假珠宝；真实配饰（9 支）+ 包袋/帽子等新配饰类图片示例在分类模式下依旧可见。

## 10. 全量分配表

docs/media-categorization-assignments-20261101.json（rev4，全部 328 页含 now/after/置信度/证据类型）。
