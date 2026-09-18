# Aidreamcapes Promo / Category 主题详情页 SEO、文案与生图实施方案

状态：`IMPLEMENTED_LOCALLY / AWAITING_SEPARATE_RELEASE`

本方案已完成本地 SQL、SSR、素材和浏览器验收；线上发布尚未执行，必须另行备份、灰度和回滚验证。

日期：2026-09-13

适用 storefront：`site_aidreamcapes`（`www.aidreamcapes.com`）

## 1. 目标与执行边界

本方案针对 ZIP 已定稿的 `Video → Promo / Category` 分组，规划并逐页重建以下 11 个主题详情页：

1. Promo / Launch / Sale
2. Black Friday Countdown
3. Limited Drop Alert
4. Discount & Free Shipping
5. Beauty Routine
6. Supplement Highlight
7. Fashion Try-On Reel
8. Food & Beverage
9. Home Organization
10. App / SaaS Demo
11. Local Service Ad

ZIP 继续决定用户看到的菜单 Label、分组和顺序；当前项目只负责：

- 为每个入口绑定精准、真实、可渲染的 canonical route；
- 保留现有有效 URL 的 SEO 价值；
- 为缺少精准页面的入口创建独立页面；
- 将每页独立的 TDK、正文、FAQ、CTA 和媒体写入目标 Aidreamcapes `LivePage.contentJson`。

本阶段计划已按下方实施顺序执行到本地验收；不包含线上发布。

硬性边界：

- 只允许修改 `site_aidreamcapes`；不修改 MyDreamShoots、`aidreamcapes.eu`、`aidreamshoots.eu` 或其他 storefront。
- 不重新设计 ZIP Header、Top-level Navigation、Mega Menu 分组、Label 或顺序。
- 不把所有页面继续指向旧的 `/product-video`、`/product-ad-video` 或 `/video-ad` 通用页面。
- 不删除旧路由。旧页面是否 redirect、remove from sitemap 或 retire，必须在迁移审计中单独确认。
- 页面运行时数据唯一来自 SQL `LivePage.contentJson`；不使用 `ThemePage.draftJson` 作为公开运行时正文来源。
- 浏览器不通过 JavaScript 请求正文数据；详情页由 SSR 直接读取 SQL。
- 不触发真实 AI 生成、付费生成、Checkout、Payment、Credits 扣除或外部 Provider create，直到用户确认供应商额度和生成次数。

## 2. ZIP 入口与 canonical route 矩阵

每个 ZIP 入口必须有独立的主题意图。菜单入口不能因为旧页面仍存在，就继续绑定到语义不匹配的 generic 页面。

| ZIP Label | 当前主要 route / 状态 | 目标 canonical route | Action | 主题意图 |
|---|---|---|---|---|
| Promo / Launch / Sale | `/ai-video-generation/promo-video`，旧通用 Promo Video | `/ai-video-generation/promo-video` | `KEEP_URL + REBUILD` | 发布、新品、促销和 Sale 信息的清晰层级 |
| Black Friday Countdown | 当前无精准 Video route；存在其他图片类 Black Friday 页面 | `/ai-video-generation/black-friday-countdown` | `CREATE_PAGE_AND_ADD` | 日期、倒计时、优惠条件和行动节点 |
| Limited Drop Alert | 当前无精准 route | `/ai-video-generation/limited-drop-alert` | `CREATE_PAGE_AND_ADD` | 限量发售、开放时间、库存事实和提醒 |
| Discount & Free Shipping | 当前常落到旧 Product Ad generic route | `/ai-video-generation/discount-free-shipping` | `CREATE_PAGE_AND_ADD` | 折扣、免邮条件、期限和 CTA 的可读表达 |
| Beauty Routine | 当前常落到 UGC / Product Demo 旧 route | `/ai-video-generation/beauty-routine` | `CREATE_PAGE_AND_ADD` | 护肤/美妆步骤、质地、使用顺序和合规表达 |
| Supplement Highlight | 当前常落到旧 Product Demo route | `/ai-video-generation/supplement-highlight` | `CREATE_PAGE_AND_ADD` | 成分、使用场景、产品事实和非医疗化说明 |
| Fashion Try-On Reel | `/ai-video-generation/fashion-video`，旧 Fashion Video | `/ai-video-generation/fashion-try-on-reel` | `CREATE_PAGE_AND_ADD` | 穿着、版型、动作、材质和竖屏试穿叙事 |
| Food & Beverage | `/ai-video-generation/food-video`，旧 Food Video | `/ai-video-generation/food-video` | `KEEP_URL + REBUILD` | 准备、食用/饮用、质感和消费场景 |
| Home Organization | 当前常落到旧 Product Demo route | `/ai-video-generation/home-organization` | `CREATE_PAGE_AND_ADD` | 混乱到整理、收纳动作、容量和可见结果 |
| App / SaaS Demo | 当前常落到旧 `/video-ad` generic route | `/ai-video-generation/app-saas-demo` | `CREATE_PAGE_AND_ADD` | 界面流程、任务完成、产品价值和真实数据边界 |
| Local Service Ad | 当前无精准 route；存在旧 Video Ad generic 页面 | `/ai-video-generation/local-service-ad` | `CREATE_PAGE_AND_ADD` | 服务区域、预约流程、到场过程和可信 CTA |

兼容策略：

- `/ai-video-generation/fashion-video` 暂不删除；在确认后作为 legacy route 处理，可 redirect 到 `/ai-video-generation/fashion-try-on-reel`，或保留为独立 SEO 页面，但不得继续作为 ZIP `Fashion Try-On Reel` 的最终菜单落点。
- `/ai-video-generation/video-ad` 暂不删除；不再作为 `App / SaaS Demo` 或 `Local Service Ad` 的 generic fallback。后续根据现有 SEO 价值决定 redirect 或独立保留。
- `/ai-video-generation/black-friday` 等图片生成页面不自动改成 Video canonical，也不因同名关键词而进入本组页面。

## 3. 统一 SEO 数据规范

所有页面 customer-facing 文案使用自然英文。每页独立写 TDK，不复制 UGC Ads 或 Conversion / Seeding 页的句式，不混入婚礼、节日 Save-the-Date、portrait package 等无关主题词。

| Route | Title | Description | Primary keyword intent |
|---|---|---|---|
| `/ai-video-generation/promo-video` | `AI Promo & Launch Video Generator \| Aidreamcapes` | `Create an AI promo or launch video that introduces an offer, product release, or seasonal sale with clear proof, useful context, and a next step.` | AI promo video, product launch video generator |
| `/ai-video-generation/black-friday-countdown` | `AI Black Friday Countdown Video Generator \| Aidreamcapes` | `Build an AI Black Friday countdown video with a verified date, offer terms, product focus, and a clear reason to act before the sale window closes.` | Black Friday countdown video, sale video generator |
| `/ai-video-generation/limited-drop-alert` | `AI Limited Drop Alert Video Generator \| Aidreamcapes` | `Create a limited drop alert video that makes the release time, available product, real urgency, and next action easy for shoppers to understand.` | limited drop video, product drop announcement |
| `/ai-video-generation/discount-free-shipping` | `AI Discount & Free Shipping Ad Video \| Aidreamcapes` | `Turn a real discount or free-shipping offer into an AI ad video with readable conditions, product context, a deadline, and a focused call to action.` | discount ad video, free shipping ad video |
| `/ai-video-generation/beauty-routine` | `AI Beauty Routine Video Generator \| Aidreamcapes` | `Create a beauty routine video that shows product order, application texture, usage context, and a careful result without unsupported skincare claims.` | AI beauty routine video, skincare video generator |
| `/ai-video-generation/supplement-highlight` | `AI Supplement Highlight Video Generator \| Aidreamcapes` | `Explain a supplement product with an AI highlight video focused on ingredients, format, usage context, and compliant product information—not medical promises.` | supplement product video, supplement ad generator |
| `/ai-video-generation/fashion-try-on-reel` | `AI Fashion Try-On Reel Generator \| Aidreamcapes` | `Create an AI fashion try-on reel that shows fit, movement, styling, and garment details in a vertical format built for confident product discovery.` | AI fashion try-on reel, virtual try-on video |
| `/ai-video-generation/food-video` | `AI Food & Beverage Video Generator \| Aidreamcapes` | `Create an AI food and beverage video with preparation, texture, serving context, and a clear product moment for menus, social content, or campaigns.` | AI food video, beverage video generator |
| `/ai-video-generation/home-organization` | `AI Home Organization Video Generator \| Aidreamcapes` | `Show a home organization idea from clutter to a usable system with an AI video that makes the steps, storage logic, and visible result easy to follow.` | home organization video, storage video generator |
| `/ai-video-generation/app-saas-demo` | `AI App & SaaS Demo Video Generator \| Aidreamcapes` | `Turn a real app or SaaS workflow into an AI demo video with focused screens, clear actions, visible outcomes, and claims your team can verify.` | AI SaaS demo video, app demo video generator |
| `/ai-video-generation/local-service-ad` | `AI Local Service Ad Video Generator \| Aidreamcapes` | `Create a local service ad video that explains the service area, customer problem, visit or booking process, proof point, and next step without fake reviews.` | local service ad video, service business video |

每页 SQL SEO 对象必须包含：

- `title`：建议 45–70 个字符；
- `description`：建议 140–170 个字符；
- 5–10 个主题相关关键词；
- `canonicalPath` 与真实 route 完全一致；
- `canonical` 使用 `https://www.aidreamcapes.com` 绝对 URL；
- `robots.index=true`、`robots.follow=true`，除非后续审计明确要求 noindex；
- 与正文一致的 `twitterDescription`；
- 本页面独立的横向 `ogImage` 和描述性 `ogImageAlt`；
- BreadcrumbList、Service、SoftwareApplication、FAQPage JSON-LD；
- 不输出虚假价格、库存、折扣期限、客户评价、服务区域或产品功效。

SEO 语义限制：

- Black Friday、Limited Drop、Discount、Free Shipping 必须从 SQL 读取真实活动条件；没有真实条件时，页面只能使用“review your offer details”类说明，不得编造日期、金额或库存。
- Beauty、Supplement 不得输出医疗诊断、治疗、减重、保证功效等未经验证的内容。
- Competitor-style、service proof、testimonials 等内容不得伪造客户、评价、认证、实时数据或真实服务结果。

## 4. 各页面主题文案设计

所有页面采用与 `/ai-video-generation/ugc-ad-video` 一致的 Aidreamcapes 深色详情页视觉和信息密度，但每页的主题任务、Hero、流程、示例和 FAQ 必须独立。以下文案为实施基准，正式版本写入 SQL。

### 4.1 Promo / Launch / Sale

- Hero title：`Give the launch a clear moment to act.`
- Hero promise：把新品、促销或 Sale 的“是什么、为什么现在、下一步做什么”放在同一条视频里。
- Workflow：define the release → frame the offer → show product proof → state the timing → close with CTA。
- Creative directions：launch reveal、offer-first、product-in-use、seasonal visual、single-message sale。
- Examples：产品揭幕、关键功能、优惠条件、使用场景、截止时间、CTA 安全区。
- FAQ 重点：新品发布与常规产品广告的区别；如何避免虚假优惠；如何检查活动时间和 landing page。

### 4.2 Black Friday Countdown

- Hero title：`Make the Black Friday window impossible to misunderstand.`
- Hero promise：突出真实日期、真实优惠条件、产品焦点和倒计时节奏，而不是只堆叠节日装饰。
- Workflow：confirm date → confirm offer → choose countdown beat → show product value → publish the next action。
- Creative directions：calendar countdown、offer reveal、last-hours reminder、bundle focus、shipping cutoff。
- Examples：日期节点、优惠展示、产品组合、剩余时间视觉、结尾购买入口。
- 合规约束：HTML/SQL 叠加真实数字；生图禁止生成可读倒计时、价格和品牌文字。

### 4.3 Limited Drop Alert

- Hero title：`Turn a limited release into a clear reason to return.`
- Hero promise：让用户知道何时开放、发布什么、稀缺性来自哪里以及应该采取什么行动。
- Workflow：verify availability → reveal the item → mark the release time → explain access → close with reminder CTA。
- Creative directions：sealed reveal、drop time、small-batch detail、waitlist reminder、restock-safe message。
- Examples：包装揭示、产品细节、上线时间、访问路径、提醒动作。
- 合规约束：只有真实库存/批次/时间才能写 scarcity；禁止生成“only 3 left”等虚假数字。

### 4.4 Discount & Free Shipping

- Hero title：`Make the offer easy to read before the click.`
- Hero promise：把产品、折扣/免邮条件、适用范围、期限和 CTA 清晰拆开，减少误解。
- Workflow：verify terms → choose the product frame → explain the saving → show shipping condition → close with CTA。
- Creative directions：price-to-value、shipping unlock、cart threshold、offer stack、simple offer card。
- Examples：产品主画面、折扣条件、免邮门槛、适用地区、截止时间和 CTA。
- 合规约束：不生成价格、货币、百分比或运费文字；实际条件由 SQL 文案渲染并经业务确认。

### 4.5 Beauty Routine

- Hero title：`Show the routine, texture, and order that make the product useful.`
- Hero promise：围绕步骤、用量、质地、工具和使用上下文组织内容，不把页面写成泛泛护肤广告。
- Workflow：choose routine goal → show product order → capture application → reveal texture or finish → add careful next step。
- Creative directions：morning routine、night routine、texture macro、hands-only tutorial、bathroom shelf sequence。
- Examples：产品摆放、取用、涂抹、质地近景、使用后场景、步骤间过渡。
- 合规约束：不生成医学/治疗功效、绝对化 before-after 或未经验证的皮肤结果。

### 4.6 Supplement Highlight

- Hero title：`Put the product facts in a format people can check.`
- Hero promise：围绕形态、成分、食用/使用方式、包装和日常场景传递信息，不制造医疗承诺。
- Workflow：verify label facts → choose one highlight → show format → place it in routine → direct to approved details。
- Creative directions：ingredient focus、mixing moment、daily carry、packaging detail、routine reminder。
- Examples：包装材质、粉末/胶囊形态、准备过程、日常携带、成分信息区。
- 合规约束：不得生成营养数字、认证、疾病治疗、减重保证或“医生推荐”等未经确认信息。

### 4.7 Fashion Try-On Reel

- Hero title：`Let the garment move before the viewer decides.`
- Hero promise：展示版型、长度、材质、动作和搭配，而不是只展示静态商品图。
- Workflow：select garment → set fit context → show movement → reveal details → close with styling or product CTA。
- Creative directions：walk-through、mirror try-on、detail-to-full-look、layering change、day-to-night styling。
- Examples：正面穿着、侧面轮廓、走动、面料细节、搭配变化、全身结尾。
- 合规约束：使用授权人物/原创成人角色；不宣称不真实的尺码适配、身材效果或材质性能。

### 4.8 Food & Beverage

- Hero title：`Make the serving moment carry the appetite.`
- Hero promise：用准备、倒取、切开、蒸汽、质地和真实消费场景建立画面叙事。
- Workflow：set the serving context → show preparation → capture texture → place the product in use → close with menu or purchase CTA。
- Creative directions：prep-to-plate、pour shot、table share、quick recipe、packaging-to-serving。
- Examples：包装、准备、烹饪/倒取、质地近景、桌面分享、菜单/购买结尾。
- 合规约束：不虚构营养、健康、产地、口味评价或真实顾客体验。

### 4.9 Home Organization

- Hero title：`Turn the before-and-after into a system people can copy.`
- Hero promise：解释收纳逻辑、动作顺序、空间利用和整理后的可见结果，而非仅制作“整洁房间”画面。
- Workflow：show the problem → sort the items → install or place the organizer → label the logic in copy → reveal the usable result。
- Creative directions：drawer reset、small-space vertical storage、pantry flow、closet edit、desk cable control。
- Examples：整理前、分类、安装/摆放、容量细节、取用动作、整理后。
- 合规约束：不生成不符合尺寸或容量的夸张结果；尺寸和承重等事实必须来自已核验资料。

### 4.10 App / SaaS Demo

- Hero title：`Show the workflow, not a wall of interface screens.`
- Hero promise：围绕一个真实任务展示输入、操作、反馈和结果，避免虚构实时用户、数据或业务指标。
- Workflow：choose one task → prepare the input → show the key action → reveal the outcome → explain the next step。
- Creative directions：screen-plus-presenter、cursor-led task、before/after workflow、mobile-to-desktop handoff、feature proof。
- Examples：登录后任务、关键操作、状态反馈、结果界面、导出/分享、CTA。
- 合规约束：生图禁止生成可读 UI、品牌 logo、客户数据或虚假 KPI；正式界面可在产品录屏/真实素材中补充。

### 4.11 Local Service Ad

- Hero title：`Make the service, area, and next step feel local.`
- Hero promise：让用户快速理解服务解决什么问题、覆盖哪里、如何预约、到场如何进行以及下一步联系谁。
- Workflow：define service area → show the customer problem → explain booking → show the service process → close with verified CTA。
- Creative directions：neighborhood arrival、before-service detail、technician process、booking walkthrough、finished check。
- Examples：街区/住宅环境、问题特写、预约界面、服务过程、完成检查、电话/表单 CTA。
- 合规约束：不生成虚假客户、评价、证照、团队姓名、地址或服务区域；真实信息由 SQL 与业务资料提供。

## 5. 统一 UI 页面架构

新增 `promo-category-detail` 页面变体。视觉上复用已验收的 UGC Ad Video 详情页规范，但不复用 UGC 主题内容和旧 generic 页面布局。

固定 section 顺序：

1. Hero：主题专属产品/服务输入图 → 主题专属输出图
2. What this campaign makes clear：该促销或类别真实要传达的结果
3. The campaign flow：4–6 步活动/内容制作流程
4. Creative directions：该主题独有的镜头和叙事方向
5. Examples：7 张独立主题示例图，可点击放大查看
6. Format / placement：适用 TikTok、Reels、Shorts、Product Page 或本地服务入口
7. Before you publish：活动条件、产品事实、授权、区域、合规和 credits 检查
8. Continue the workflow：相关真实页面链接
9. FAQ：SSR `<details>`；同一份 SQL FAQ 输出 FAQPage JSON-LD
10. Final CTA：绑定真实 `/app/create` 或已批准的工作区入口
11. 共享 Footer：使用 SQL 驱动的 Aidreamcapes ZIP Footer

视觉规则：

- Header 高度、Header 数据、Mega Menu、Mobile Navigation、Footer 与首页共享，不创建 Promo 专属 Header/Footer。
- 背景 `#050505`，次级背景 `#0a0a0a / #141414`，边框 `rgba(255,255,255,0.10)`。
- 紫色 `#8b5cf6`、蓝色 `#3b82f6`、粉色 `#ec4899`，Outfit 字体，最大宽度 1400px。
- 桌面端 Hero 双栏，移动端单栏；卡片使用深色玻璃处理、大圆角、细边框和渐变光晕。
- 图片点击打开详情查看，不跳转到 `#` 或页面顶部；不使用空链接、disabled CTA 或 generic fallback。
- 组件只渲染 SQL 数据，不在组件中写正式文案、CTA URL、图片路径、价格/优惠条件或 FAQ fallback。

## 6. 图片生图策略

### 6.1 数量和隔离

每个页面固定 9 张独立 WebP：

1. `product` 或 `service-input`：主题相关产品/服务输入图；
2. `hero-output`：主题核心输出图；
3. `example-01` 至 `example-07`：七张主题示例图。

建议目录：

```text
/public/assets/sites/site_aidreamcapes/promo-category-v1/<topic-key>/
```

本组预计：11 个主题、99 个正式 WebP、99 个对应裁切源/PNG 备份（是否保留 PNG 由发布包策略决定）。

必须建立 Aidreamcapes 全局媒体 ledger：

- 与 `conversion-seeding-v1`、`ads-testing-v3` 比较 product signature；
- 不允许同一套产品图、同一张 hero output 或相同 contact-sheet crop 跨主题复用；
- 不仅比较 URL，也比较文件 hash 和人工审核的产品类别；
- 如果只是同品类但视觉上明显不同，必须在报告中说明；如果是同一产品，必须重新生成。

### 6.2 主题产品和场景规划

每个主题使用不同主产品/服务视觉，避免不同分类都出现同一套产品：

| Topic | 独立主产品/服务方向 | Hero 输出重点 | 7 张示例重点 |
|---|---|---|---|
| Promo / Launch / Sale | 无品牌便携桌面灯 | 新品揭幕 + offer context | reveal、feature、use moment、sale CTA |
| Black Friday Countdown | 无品牌折叠电动自行车 | 日期节点 + 产品焦点 | calendar beat、offer、product detail、closing window |
| Limited Drop Alert | 无品牌珊瑚色运动鞋 | 限量发售揭示 | sealed box、drop time、detail、reminder |
| Discount & Free Shipping | 无品牌模块化台灯 | 真实优惠条件和免邮提示区 | product、threshold、shipping、deadline |
| Beauty Routine | 无品牌琥珀色护肤精华瓶 | 取用、涂抹、质地和顺序 | shelf、dropper、texture、routine steps |
| Supplement Highlight | 无品牌电解质粉末袋 | 包装、形态、冲泡和日常携带 | label-safe pack、scoop、mixing、routine |
| Fashion Try-On Reel | 无品牌中性色外套 | 原创成人试穿和动态版型 | front、side、walk、fabric、styling |
| Food & Beverage | 无品牌气泡饮料瓶/餐桌饮品 | 倒取、气泡、分享和食用场景 | pack、pour、texture、table、serve |
| Home Organization | 无品牌透明抽屉收纳系统 | 混乱到可取用系统 | sort、install、capacity、before/after |
| App / SaaS Demo | 无品牌分析工作台设备/屏幕 | 一个真实任务的流程结果 | input、action、state、result、handoff |
| Local Service Ad | 无品牌住宅窗户清洁服务工具 | 到场、服务过程和预约 CTA | neighborhood、problem、booking、service、check |

图片提示词必须明确：

- 主题、产品/服务类别、场景、人物角色、动作、镜头和九宫格位置；
- 每格使用不同构图，但保持该主题的视觉连续性；
- 不生成品牌 logo、商标、水印、可读文字、UI、价格、日期、客户姓名、证书或虚假评价；
- Black Friday、Discount、Limited Drop 等文字/数字由 SQL/HTML 输出，不能让图片模型生成；
- Beauty/Supplement/Local Service 不生成医疗功效、认证、虚假顾客或权威背书；
- App/SaaS 不生成可读虚假界面和 KPI；
- Fashion 使用原创或获授权成人角色，不模仿真实公众人物。

### 6.3 供应商渠道和付费安全

继续使用已配置的供应商渠道：

- Provider label：`image4`；
- Model：`gpt-image-2`；
- Provider type：`image`；
- 目标站点：只允许 `site_aidreamcapes`。

实施前必须单独确认供应商额度。由于本组有 11 个主题，contact sheet 方案预计最多 11 次 paid create，默认每个主题 1 次、`attempts=1`，不自动重试、不自动 fallback。当前此前的 8 次额度确认不能自动扩展为本组 11 次。

如果供应商不支持一次生成九宫格，必须停止并重新报告预计 create 次数，不能静默扩大调用量。

### 6.4 图片 SEO 和性能

每张图片必须由 SQL 提供：

- `src`；
- `alt`；
- `width`；
- `height`；
- `loading`；
- `fetchPriority`；
- `sizes`，后续扩展时可增加 `srcSet`。

策略：

- `product/service-input` 和 `hero-output` 首屏 eager；只有输入图使用 `fetchPriority=high`；
- 七张示例图 lazy、`fetchPriority=auto`；
- 图片真实尺寸必须与 SQL 一致，禁止伪造尺寸；
- alt 描述主题、产品/服务、动作和使用场景，不写泛化的 `AI image`；
- 页面图片和 OG 图片只能来自 `/assets/sites/site_aidreamcapes/`；
- 禁止 `.eu` 资源、`/assets/dreamshoot/` 非隔离路径和 Unsplash 随机替代图。

## 7. SQL 数据合同和迁移脚本

计划新增：

- `scripts/lib/aidreamcapes-promo-category-content.mjs`：11 页独立 TDK、主题文案、FAQ、相关链接、媒体 manifest 和 provider prompt；
- `scripts/generate-aidreamcapes-promo-category-assets.mjs`：默认 dry-run；真实生成需要显式站点、主题、attempt cap 和用户确认；
- `scripts/migrate-aidreamcapes-promo-category-pages.mjs`：默认 dry-run；备份、只写目标 Aidreamcapes `LivePage`、readback/hash；
- `scripts/smoke-aidreamcapes-promo-category-pages.mjs`：检查菜单路由、页面变体、TDK、媒体隔离、FAQ 和 SSR。

目标数据结构：

```ts
{
  version: 1,
  pageType: "ai_tool",
  sectionsOrder: ["ai_video_topic_landing_1"],
  sections: {
    ai_video_topic_landing_1: {
      type: "ai_video_topic_landing",
      blocks: [],
      settings: {
        contentKey: "promo-category-<topic-key>",
        content: {
          layoutVariant: "promo-category-detail",
          seo: {},
          hero: {},
          campaignOutput: {},
          campaignFlow: {},
          creativeDirections: {},
          examples: {},
          format: {},
          requirements: {},
          relatedWorkflows: {},
          faq: {},
          finalCta: {}
        }
      }
    }
  },
  mediaManifest: [],
  contentContract: {
    schema: "editorial-page-v1",
    seoSource: "LivePage.contentJson",
    mediaSource: "LivePage.contentJson",
    sourceRevision: "aidreamcapes-promo-category-v1",
    siteId: "site_aidreamcapes"
  }
}
```

迁移脚本要求：

- 默认 dry-run；`--apply-local` 必须同时提供精确 `--site-id=site_aidreamcapes`、确认参数和完整 page ID 列表；
- 写入前读取并保存目标页面原始 `LivePage`；
- 只更新目标 `LivePage.contentJson` 及经确认的 Aidreamcapes SQL 导航字段；
- 不能修改 `ThemePage.draftJson` 作为公开运行时数据；
- 不更新其他 storefront、旧无关页面、支付、Auth、Credits、Checkout、Generation 或 Subscription；
- 写入后执行 SQL readback、内容 hash、媒体数量、图片 hash、页面 ID 和菜单 URL 校验；
- 修复并复用实际 SQL 结构 `aidreamcapesZipNavigation.video.groups`，不能只修改静态 TS 默认值；
- 生产发布前必须单独备份、灰度和回滚验证。

## 8. 实施顺序

### Phase A：计划确认和只读审计

- 用户确认 11 个页面的 route、canonical、KEEP/CREATE/legacy 处理；
- 读取当前 `ThemeSettings.draftJson/publishedJson` 中 Promo / Category 菜单实际数据；
- 读取当前 11 个入口对应的 `LivePage`、页面变体、TDK、图片和旧模板；
- 建立全局 Aidreamcapes 产品/媒体 ledger，确认不会跨主题复用同一套产品；
- 输出 route diff 和未分类入口报告。

### Phase B：内容合同和图片准备

- 编写 11 页独立英文 TDK、Hero、流程、创意方向、Examples、FAQ、CTA；
- 为每页定义独立产品、服务、人物和镜头策略；
- 运行内容 validator、SEO validator、图片 manifest validator；
- 供应商 dry-run，报告 11 个 contact sheet 请求和最大 paid creates；
- 用户确认供应商额度后才允许生成图片；
- 生成、裁切、转 WebP，进行文件 hash、真实尺寸、主题相关性和 storefront 隔离检查。

### Phase C：详情页和 SQL 实现

- 扩展并注册 `promo-category-detail` 变体；
- 使用共享 Aidreamcapes Header/Footer 和现有详情页 Gallery；
- 为 11 个入口绑定真实 canonical route；
- 为缺少精准页面的主题创建 `LivePage`；
- 只写目标 Aidreamcapes `LivePage.contentJson` 和已确认导航字段；
- readback、hash、SSR、菜单点击和图片加载验证。

### Phase D：验收和发布准备

- 1440px 桌面端、390px 移动端截图验证；
- 11 个页面 HTTP 200，无 404、空链接、`href="#"` 或旧 generic fallback；
- 每页 9 张独立图片，11 页合计 99 张，跨本组和既有 Aidreamcapes 详情页不复用；
- title、description、canonical、robots、OG、Twitter、JSON-LD 均来自目标 `LivePage.contentJson`；
- FAQ `<details>` 与 FAQPage JSON-LD 完全一致；
- 浏览器无正文 API fetch；
- `.com` / `.eu` 和其他 storefront 文案、canonical、素材隔离；
- `npm run typecheck`、`npm run lint`、固定端口 `127.0.0.1:3002` SSR/browser smoke；
- 本阶段不自动上线，线上发布另行执行。

## 9. 完成标准

只有同时满足以下条件，才算 Promo / Category 页面实施完成：

- ZIP 的 11 个入口全部存在，并绑定精准真实 route；
- 每页的 Hero、流程、创意方向、示例、FAQ、CTA 和 TDK 与主题一致；
- 每页使用独立产品/服务视觉和 9 张独立媒体，不能因菜单错误回到同一旧页面；
- 真实活动条件、折扣、日期、库存、服务区域和产品事实来自 SQL/业务数据，不由前端写死；
- 页面实时正文和 SEO 来自目标 `LivePage.contentJson`，浏览器不请求正文 API；
- 共享 Header/Footer 与首页一致，未复制专属旧导航；
- 旧路由未被误删，legacy route 的 redirect/保留策略有记录；
- `site_aidreamcapes` 之外的数据库、代码路径、素材和上线状态不变；
- 供应商调用次数、request id、结果、费用/额度状态可审计；
- 未确认供应商额度、未通过 SSR/SEO/图片隔离验收前，不发布线上。

## 10. 实施结果（2026-09-13）

已完成：

- 11 个 Promo / Category 页面全部生成独立 `LivePage.contentJson`，保留既有精准 URL，并为缺失入口创建真实页面。
- 每页独立 TDK、正文、FAQ、相关 CTA 和 9 张主题媒体；合计 99 张 WebP 与 99 张 PNG 源文件。
- 每个主题使用不同产品或服务视觉；跨 `conversion-seeding-v1`、`ads-testing-v3`、`ads-testing-v2` 的 WebP hash 重复数为 0。
- `site_aidreamcapes` 的 SQL 导航中 `Promo / Category` 分组已更新为 11 个精准 route；其他 storefront 未写入。
- 页面运行时来源为 `LivePage.contentJson`；迁移脚本未写入 `ThemePage.draftJson` 作为公开正文来源。
- 11 个本地路径均 HTTP 200；共享 Header/Footer、详情页变体、9 张媒体、7 张示例卡、5 条 SSR FAQ 均通过检查。
- 浏览器无正文 API fetch、无 `href="#"`、无 disabled CTA、无跨 storefront/domain 链接；移动端无横向溢出；示例图可打开并关闭详情查看。
- `.com` host-mode sitemap 已包含 11 个新 canonical URL；`.eu` 与其他 storefront 未做发布修改。
- 供应商生图使用已配置的 `image4 / gpt-image-2` 渠道，11 次 contact-sheet 请求、99 张裁切媒体均有生成报告和 request 审计记录。
- `npm run typecheck`、`npm run lint` 已通过；Lint 保留 185 条既有 warning，0 errors。

补充说明：仓库级 `smoke:storefront-image-isolation` 仍会报告执行本方案前就存在的 `.eu` 缺失素材及历史跨 storefront 近重复素材；本次新增 `promo-category-v1` 素材自身已通过站点路径、文件存在、hash 唯一和跨既有 Aidreamcapes 主题重复检查。仓库级 navigation smoke 的默认配置会访问 `localhost` 或外部 TLS 端点，未作为本组页面验收依据；本组专用 browser smoke 与 Aidreamcapes Footer route smoke 均通过。

验收产物：

- 供应商报告：`releases/provider-results/aidreamcapes/promo-category-v1/generation-report.json`
- SQL 备份：`releases/backups/aidreamcapes/promo-category-pages-20260913081815.json`
- 浏览器截图：`reports/aidreamcapes-promo-category-browser/`
- 本地 smoke：`scripts/smoke-aidreamcapes-promo-category-pages.mjs`

尚未执行：

- 线上数据库写入、线上发布、DNS/CDN 刷新、生产灰度和回滚演练。
- `fashion-video`、`video-ad` 等 legacy URL 的最终 redirect/retire 决策；它们未被删除，也未继续作为本组新版菜单落点。

## 11. 当前等待确认项

实施前只需要确认以下事项：

1. 是否按本方案为 11 个 Promo / Category 入口创建独立 canonical 页面；
2. 是否接受 `fashion-video`、`video-ad` 等旧 generic route 只作为兼容/legacy 处理，不再作为新版菜单最终落点；
3. 是否批准最多 11 次供应商 contact sheet paid create，每主题 1 次、`attempts=1`，无自动重试；
4. 是否接受每主题使用不同产品/服务视觉，并以全局媒体 ledger 阻止跨主题重复。

本地实施已获得确认并完成；线上发布仍需单独授权，不在本方案中自动执行。
