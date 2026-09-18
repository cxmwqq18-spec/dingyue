# Aidreamcapes Brand / Creator 主题详情页 SEO、文案与生图实施方案

状态：`IMPLEMENTED_LOCALLY / SQL_READBACK_PASS / SSR_SMOKE_PASS / AWAITING_RELEASE_APPROVAL`

日期：2026-09-13

适用 storefront：`site_aidreamcapes`（`www.aidreamcapes.com`）

## 1. 方案目的

本方案针对 ZIP 首页已经定稿的 `Video → Brand / Creator` 分组，规划 4 个独立主题详情页：

1. Founder Update
2. Localization (Multi-language)
3. Cinematic Product Film
4. Trending Audio Sync

ZIP 文件中的 `index.html` 与 `index-seo-final.html` 在 Brand / Creator 分组给出的 Label 和顺序是本方案的唯一菜单目标：

```text
Founder Update
Localization (Multi-language)
Cinematic Product Film
Trending Audio Sync
```

ZIP 当前给出的入口为：

```text
Founder Update              → /ai-video-generation/talking-head-video
Localization (Multi-language) → /ai-video-generation/talking-head-video
Cinematic Product Film      → /ai-video-generation/cinematic-video
Trending Audio Sync         → /ai-video-generation/music-video
```

执行原则：

```text
ZIP = WHAT USERS SHOULD SEE
CURRENT PROJECT = WHERE EACH APPROVED ITEM REALLY GOES
```

但“当前存在旧 route”不代表可以继续共用语义不匹配的页面。`Founder Update` 与 `Localization` 不能继续共用 `talking-head-video` generic 页面，因此需要创建独立 canonical route，并将旧 route 作为兼容/legacy 页面处理。

本阶段已完成本地实现与验收：4 个页面已写入 Aidreamcapes 目标 `LivePage.contentJson`，供应商素材已生成并接入，未发布线上。

## 2. 当前审计结论

### 2.1 当前 SQL 页面状态

当前 `site_aidreamcapes` 的公开导航读取结果：

| ZIP Label | 当前 href | 当前 LivePage | 当前模板/变体 | 当前媒体情况 | 初步判断 |
|---|---|---|---|---:|---|
| Founder Update | `/ai-video-generation/talking-head-video` | `aidreamcapes_mirror_page_bb4060fef1647507` | `ai-video-topic-talking-head-video`，旧 standard topic | `mediaManifest=0` | 不能与 Localization 共用；CREATE |
| Localization (Multi-language) | `/ai-video-generation/talking-head-video` | 与 Founder 共用 | `ai-video-topic-talking-head-video`，旧 standard topic | `mediaManifest=0` | 需要独立页面；CREATE |
| Cinematic Product Film | `/ai-video-generation/cinematic-video` | `aidreamcapes_mirror_page_e8ac6b19a0213b0d` | `ai-video-topic-cinematic-video`，旧 standard topic | `mediaManifest=0` | KEEP URL + REBUILD |
| Trending Audio Sync | `/ai-video-generation/music-video` | `aidreamcapes_mirror_page_6a41c9686fb0a21c` | `ai-video-topic-music-video`，旧 standard topic | `mediaManifest=0` | KEEP URL + REBUILD |

当前旧页面的主要问题：

- `Founder Update` 与 `Localization (Multi-language)` 只显示同一个 talking-head 页面，主题意图、TDK、正文、FAQ 和图片无法区分。
- `Cinematic Product Film` 目前是旧的通用 Cinematic Video 页面，缺少品牌产品电影的独立内容合同和媒体 manifest。
- `Trending Audio Sync` 目前是旧 Music Video 页面，未围绕音频授权、节拍剪辑、平台版本和趋势内容安全建立独立 SEO 主题。
- 当前 4 个页面都不是 `brand-creator-detail` 专用变体，正文不能满足本次“重新设计布局”的要求。
- 当前页面媒体不在 `LivePage.contentJson.mediaManifest` 中，无法保证每个主题拥有独立 Hero 输入图、输出图和 7 张示例图。

### 2.2 ZIP 导航目标

新版导航不得因为旧页面仍存在而重新加入旧入口，也不得把两个不同 Label 继续绑定到同一个 generic 页面。

执行后的目标导航数据：

| Group | Label | 目标 href | 处理 |
|---|---|---|---|
| Brand / Creator | Founder Update | `/ai-video-generation/founder-update` | CREATE_PAGE_AND_ADD |
| Brand / Creator | Localization (Multi-language) | `/ai-video-generation/multilingual-video` | CREATE_PAGE_AND_ADD |
| Brand / Creator | Cinematic Product Film | `/ai-video-generation/cinematic-video` | KEEP_URL + REBUILD |
| Brand / Creator | Trending Audio Sync | `/ai-video-generation/music-video` | KEEP_URL + REBUILD |

旧 `talking-head-video` 页面继续保留为 legacy/SEO 兼容页面，但不再作为 Brand / Creator 两个新版菜单项的最终落点。是否执行 301 redirect、是否移出 sitemap，需要在后续 URL 审计和用户确认后单独执行。

## 3. 页面与 canonical route 矩阵

### 3.1 Founder Update

- Label：`Founder Update`
- 目标 canonical：`/ai-video-generation/founder-update`
- Action：`CREATE_PAGE_AND_ADD`
- 旧兼容页面：`/ai-video-generation/talking-head-video`
- 页面意图：用创始人的真实视角讲清公司里程碑、产品决定、幕后过程或下一步，而不是泛化的 talking-head 模板。
- 目标受众：创始人、品牌团队、产品团队、社区运营和需要发布公司更新的内容团队。
- 不允许：虚构融资、用户数量、收入、客户、增长率、认证、团队成员或“创始人真实背书”。

### 3.2 Localization (Multi-language)

- Label：`Localization (Multi-language)`
- 目标 canonical：`/ai-video-generation/multilingual-video`
- Action：`CREATE_PAGE_AND_ADD`
- 旧兼容页面：`/ai-video-generation/talking-head-video`
- 页面意图：把已批准的一条品牌或产品视频适配到不同语言和市场，强调语义、节奏、字幕安全区、声音/口型审核和本地化 CTA。
- 目标受众：全球营销团队、本地市场团队、跨境电商、教育和 SaaS 内容团队。
- 不允许：宣称“自动完美翻译”、虚构语言支持、未经审校的文化结论、模拟真实客户声音或伪造当地市场数据。

### 3.3 Cinematic Product Film

- Label：`Cinematic Product Film`
- 目标 canonical：`/ai-video-generation/cinematic-video`
- Action：`KEEP_URL + REBUILD`
- 旧页面 ID：`aidreamcapes_mirror_page_e8ac6b19a0213b0d`
- 页面意图：用镜头、光影、材质、空间和节奏建立产品世界，服务新品发布、品牌故事和高质感 campaign，不只是把产品放大展示。
- 目标受众：品牌创意、产品营销、设计团队、发布会和高端电商 campaign 团队。
- 不允许：虚构材质、性能、产地、认证、豪华品牌合作、真实客户结果或未经授权的品牌视觉识别。

### 3.4 Trending Audio Sync

- Label：`Trending Audio Sync`
- 目标 canonical：`/ai-video-generation/music-video`
- Action：`KEEP_URL + REBUILD`
- 旧页面 ID：`aidreamcapes_mirror_page_6a41c9686fb0a21c`
- 页面意图：将已批准、有权使用的音频节拍转化为短视频剪辑节奏、动作和产品/品牌画面，不承诺音频一定“trending”。
- 目标受众：社交内容团队、创作者、品牌账号、音乐推广和短视频编辑团队。
- 不允许：自动抓取或暗示平台热榜、未经授权使用音乐、伪造播放量、虚构艺人合作或通过视觉暗示版权许可。

## 4. 统一 SEO 数据规范

4 个页面分别拥有独立 TDK，不复制 UGC Ads、Promo / Category 或旧 talking-head 文案。页面 customer-facing 文案全部使用自然英文。

| Route | Title | Description | Primary keyword intent |
|---|---|---|---|
| `/ai-video-generation/founder-update` | `AI Founder Update Video Generator \| Aidreamcapes` | `Create a founder update video that turns a real company milestone, product decision, or behind-the-scenes moment into a clear message with credible proof and a next step.` | AI founder update video, founder announcement video |
| `/ai-video-generation/multilingual-video` | `AI Multilingual Video Generator for Localization \| Aidreamcapes` | `Adapt an approved video message for multiple languages and markets with clear presenter timing, subtitle-safe framing, localized context, and a reviewable final CTA.` | AI multilingual video, video localization generator |
| `/ai-video-generation/cinematic-video` | `AI Cinematic Product Film Generator \| Aidreamcapes` | `Create a cinematic product film with deliberate camera movement, light, texture, pacing, and product detail for launches, brand stories, and premium campaigns.` | AI cinematic product film, cinematic product video |
| `/ai-video-generation/music-video` | `AI Trending Audio Sync Video Generator \| Aidreamcapes` | `Build a short-form video that matches approved audio beats with deliberate cuts, movement, product moments, and safe publishing checks for social channels.` | audio sync video, AI music video editing |

实施时每页 SEO 对象必须包含：

- `title`：建议 45–70 个字符；不得使用旧 generic title。
- `description`：建议 140–175 个字符；自然说明页面任务、输入和结果。
- `keywords`：5–10 个主题相关词，不堆砌 `UGC`、wedding、holiday、portrait package 等无关词。
- `canonicalPath`：与真实目标 route 完全一致。
- `canonical`：`https://www.aidreamcapes.com` 绝对 URL。
- `robots.index=true`、`robots.follow=true`，除非后续审计决定 noindex。
- `twitterDescription`：与页面主题一致，不复制 title 或 UGC 页面描述。
- `ogImage`：本页独立横向 output 素材。
- `ogImageAlt`：描述具体主题和画面，不写泛化的 `AI image`。
- BreadcrumbList、Service、SoftwareApplication、FAQPage JSON-LD 与页面正文一致。

### 4.1 SEO 语义边界

Founder Update：

- 可以写 milestone、product decision、behind the scenes、founder perspective。
- 只能呈现 SQL/业务数据中已核验的公司事实。
- 不得生成融资、增长、客户、收入、团队规模或权威背书。

Localization：

- 可以写 multilingual、localized context、subtitle-safe framing、language review。
- 不得承诺所有语言自动达到母语质量。
- 不得把机器翻译结果直接表述为已审核的本地市场内容。

Cinematic Product Film：

- 可以写 camera movement、lighting、texture、pacing、visual language。
- 不得把电影感等同于真实产品性能或 premium quality 事实。

Trending Audio Sync：

- 可以写 approved audio、beat map、cut timing、platform variants。
- “Trending”只能作为主题名称和创作方向，不得作为实时流行度事实。
- 只有业务已确认拥有授权的音频才能进入真实发布流程。

## 5. 各页面主题文案设计

所有页面采用已验收的 Aidreamcapes 深色详情页主题和信息密度，但不复用旧 generic 页面布局、标题、图片或 FAQ。每个主题必须有自己的 Hero、工作流、创意方向、示例说明和 CTA。

### 5.1 Founder Update

Hero 基准文案：

- Eyebrow：`AI VIDEO · FOUNDER UPDATE`
- Title：`Make the founder’s point of view worth following.`
- Body：`Turn a real company update into a focused video with a clear point of view, one useful proof moment, and a next step the audience can understand.`
- Primary CTA：`Create Founder Update`
- Secondary CTA：`See Founder Update examples`

核心产出：

- Message：这次更新是什么。
- Context：为什么现在要说。
- Proof：观众能看到或核验的过程/产品/决定。
- Handoff：观众接下来可以做什么。

工作流：

1. Define the update：明确里程碑、决定、幕后过程或下一步。
2. Choose the proof：选择一个能被画面支持的真实证据。
3. Shape the delivery：确定创始人语气、节奏、镜头和重点。
4. Add context：补充产品、团队或用户场景，但不添加未经验证的数字。
5. Close with the next step：链接到真实产品、公告、社区或 signup 页面。

创意方向：

- Milestone reveal：用一个明确变化开启更新。
- Build in public：展示经过许可的制作、测试或迭代过程。
- Decision breakdown：说明一个决定如何影响产品或用户。
- Founder desk update：使用近距离、直接、克制的创始人表达。
- Product handoff：从创始人观点转到真实产品或下一步入口。

7 张示例图主题：

`MESSAGE`、`CONTEXT`、`PROOF`、`DECISION`、`BEHIND THE SCENES`、`HANDOFF`、`NEXT STEP`。

FAQ 重点：

- 什么是 Founder Update video？
- 如何避免把创始人视频写成虚假公司公告？
- 能否使用脚本或头像？
- 应该展示哪些 proof？
- 更新发布后如何处理旧版本？

### 5.2 Localization (Multi-language)

Hero 基准文案：

- Eyebrow：`AI VIDEO · LOCALIZATION`
- Title：`Make one message feel native in every market.`
- Body：`Adapt an approved video for different languages with intentional timing, subtitle-safe framing, localized context, and a review step before the next market sees it.`
- Primary CTA：`Create Multilingual Video`
- Secondary CTA：`See Localization examples`

核心产出：

- Source intent：原视频真正要表达的意思。
- Market fit：目标市场的语言、语境和 CTA。
- Delivery match：声音、口型、字幕、停顿和画面安全区。
- Review state：发布前的语言、事实和品牌审核。

工作流：

1. Lock the source message：确认原始视频、脚本、事实和 CTA。
2. Choose target markets：指定语言、地区和不应直译的内容。
3. Adapt the delivery：调整表达、节奏、字幕长度和镜头留白。
4. Review the voice and text：审核发音、口型、字幕、专有名词和品牌语气。
5. Export market versions：为每个渠道输出并记录版本、语言和审核状态。

创意方向：

- Same scene, new market：保留核心视觉，切换真实本地化信息。
- Subtitle-safe presenter：为字幕和翻译保留清晰安全区。
- Localized opening：只改开场语境，不改变未经核验的产品事实。
- Voiceover plus product proof：将配音与真实产品细节结合。
- Market-specific close：根据真实地区入口替换 CTA。

7 张示例图主题：

`SOURCE`、`LANGUAGE`、`TIMING`、`SUBTITLE SAFE`、`LOCAL CONTEXT`、`REVIEW`、`MARKET CTA`。

FAQ 重点：

- 什么是 AI video localization？
- AI 能否代替人工语言审核？
- 如何处理字幕长度和口型同步？
- 如何保证不同语言版本的产品事实一致？
- 目标市场 CTA 应该如何管理？

### 5.3 Cinematic Product Film

Hero 基准文案：

- Eyebrow：`AI VIDEO · CINEMATIC PRODUCT FILM`
- Title：`Give the product a world, not just a close-up.`
- Body：`Build a cinematic product film around light, texture, movement, and human scale so the viewer understands the product’s place in a story before the final frame.`
- Primary CTA：`Create Product Film`
- Secondary CTA：`See Cinematic examples`

核心产出：

- Visual language：光线、色调、镜头和空间规则。
- Product detail：材质、形态和可观察细节。
- Human scale：产品与真实使用环境的关系。
- Closing frame：品牌或 campaign 的真实下一步。

工作流：

1. Set the visual world：确定空间、光线、色彩和节奏。
2. Define the hero detail：选择一个真实可见的产品细节。
3. Design the movement：安排推进、环绕、拉远或静态停留。
4. Add human scale：用经过许可的成人角色或环境说明产品如何进入生活。
5. Hold the final frame：给真实 CTA、产品名或 campaign 入口留下安全空间。

创意方向：

- Material macro：用微距和光线让材质成为叙事的一部分。
- Moving reveal：通过遮挡、推进或旋转揭示产品。
- Environment as story：让空间表达使用场景，而非堆叠装饰。
- Human scale：通过手部、动作或人物比例解释产品存在感。
- Premium stillness：用克制的静止镜头传递品牌气质，不虚构性能。

7 张示例图主题：

`WORLD`、`MATERIAL`、`REVEAL`、`MOVEMENT`、`HUMAN SCALE`、`DETAIL`、`FINAL FRAME`。

FAQ 重点：

- Cinematic Product Film 与普通 Product Demo 有什么区别？
- 如何让 cinematic 画面不遮挡真实产品信息？
- 生图能否生成品牌 logo 或包装文字？
- 什么时候需要使用真实产品录制素材？
- 如何为不同投放尺寸保留构图安全区？

### 5.4 Trending Audio Sync

Hero 基准文案：

- Eyebrow：`AI VIDEO · AUDIO SYNC`
- Title：`Let the approved beat shape the cut.`
- Body：`Turn licensed or approved audio into a clear short-form edit with beat-aware cuts, purposeful movement, product context, and a publishing check for every channel.`
- Primary CTA：`Create Audio Sync Video`
- Secondary CTA：`See Audio Sync examples`

核心产出：

- Rights check：音频来源、许可范围和发布渠道。
- Beat map：节拍、停顿、转场和 loop 点。
- Visual match：动作、产品和画面变化跟随音乐但不失去主题。
- Platform cut：根据 TikTok、Reels、Shorts 或其他渠道导出版本。

工作流：

1. Verify the audio：确认音频拥有可发布的授权或来源。
2. Map the beats：标记开场、重拍、停顿、高潮和循环点。
3. Choose the visual anchor：确定人物动作、产品细节或场景变化。
4. Cut with intent：让节奏强化信息，不把视频变成无意义的快速闪切。
5. Review each platform version：检查时长、字幕、版权、CTA 和安全区域。

创意方向：

- Beat-led product reveal：在关键节拍揭示产品或核心画面。
- Movement sync：用原创成人角色的动作与节拍对齐。
- Reaction cut：使用真实有权限的反应镜头配合音频变化。
- Loop ending：设计首尾相接的循环，但不制造虚假观看数据。
- Trend-aware format：适配短视频格式，同时不宣称实时流行度。

7 张示例图主题：

`AUDIO`、`BEAT MAP`、`REVEAL`、`MOVEMENT`、`DROP`、`LOOP`、`PLATFORM CUT`。

FAQ 重点：

- 什么是 audio sync video？
- 是否可以自动使用热门音乐？
- 如何确认音乐版权和发布范围？
- 如何在保持节奏的同时保留产品信息？
- TikTok、Reels、Shorts 是否需要不同版本？

## 6. 统一 UI 页面架构

新增 `brand-creator-detail` 页面变体。页面视觉继承已验收的 `/ai-video-generation/ugc-ad-video` 详情页和 ZIP Homepage Design System，但不复制 UGC 页面内容，也不把首页布局直接复制成内页。

固定 section 顺序：

1. Hero：主题专属 creator/source input → 主题专属 brand/creator output
2. What this creator workflow makes clear：该主题真正帮助用户表达的结果
3. The workflow：4–6 步主题流程
4. Creative directions：主题独有的镜头、叙事或编辑方向
5. Examples：7 张独立主题示例图，点击打开详情预览，不跳转到页面顶部
6. Format / placement：短视频、产品页、品牌页、字幕版本或平台版本
7. Before you create：事实、授权、人物、音频、语言、品牌安全和 credits 检查
8. Continue the workflow：相关真实页面链接
9. FAQ：SSR `<details>`，同一份 SQL FAQ 输出 FAQPage JSON-LD
10. Final CTA：绑定真实 `/app/create` 或已批准的工作区入口
11. Shared Footer：使用 SQL 驱动的 Aidreamcapes ZIP Footer

### 6.1 视觉规则

- Header 高度、Logo、Top-level Navigation、Mega Menu、Mobile Navigation 和 Footer 继续使用共享 Aidreamcapes 实现。
- 不在页面组件内重写 Brand / Creator 专属 Header/Footer。
- 背景：`#050505`。
- 次级背景：`#0a0a0a`、`#141414`。
- Border：`rgba(255,255,255,0.10)`。
- Accent：`#8b5cf6`、`#3b82f6`、`#ec4899`。
- 字体：Outfit。
- 最大内容宽度：1400px。
- 桌面端 Hero 使用双栏；移动端单栏堆叠。
- 图片使用深色玻璃卡片、大圆角、细边框和紫蓝粉渐变光晕。
- Gallery 图片使用真实 button/modal 预览；不得使用 `href="#"`、空链接或仅跳转到锚点的图片点击行为。
- 页面正式文案、CTA URL、图片路径、FAQ 和 SEO 不能写死在组件中。

### 6.2 组件与数据责任

组件只负责：

- 语义 HTML 结构；
- 响应式布局；
- 卡片样式；
- 图片预览交互；
- FAQ `<details>`；
- 数字序号和主题数据映射。

SQL `LivePage.contentJson` 必须提供：

- Hero eyebrow、title、body、CTA 文案和真实 href；
- creator/source input 图、output 图；
- 所有 section 标题、正文、卡片文案和 FAQ；
- 每张图片的 `src`、`alt`、`width`、`height`、`loading`、`fetchPriority`、`sizes`；
- related workflow 的 label、body、href；
- SEO TDK、canonical、robots、OG/Twitter 和 JSON-LD 所需字段。

## 7. 图片生图策略

### 7.1 数量、目录和隔离

每个 Brand / Creator 页面固定 9 张独立 WebP：

1. `source-input`：主题专属 source/creator input
2. `hero-output`：主题核心输出画面
3. `example-01` 至 `example-07`：7 张主题示例

目录：

```text
/public/assets/sites/site_aidreamcapes/brand-creator-v1/<topic-key>/
```

4 个主题共计：

- 36 张正式 WebP；
- 36 张 PNG 裁切源/审计备份；
- 4 张供应商 contact sheet；
- 每页 9 个 SQL media manifest 项。

所有图片必须只服务于 `site_aidreamcapes`，禁止出现：

- `.eu` 图片；
- `/assets/dreamshoot/` 非隔离路径；
- Unsplash 或随机网络素材；
- 其他主题的 source、hero output 或 example crop；
- 生成图片中的 logo、品牌商标、可读 UI、可读字幕、虚假数据或水印。

### 7.2 各主题独立视觉产品/角色策略

| Topic | 独立 source/input 方向 | Hero output 方向 | 7 张示例重点 |
|---|---|---|---|
| Founder Update | 无品牌哑光银桌面无线麦克风 + 创始人工作桌 | 原创成人创始人在工作室进行真实更新表达 | message、context、proof、decision、behind-the-scenes、handoff、next step |
| Localization | 无品牌青绿色旅行产品作为跨市场发布载体 + 原创成人 presenter | 同一核心信息在不同语言市场的字幕安全构图 | source、language、timing、subtitle-safe、local-context、review、market-CTA |
| Cinematic Product Film | 无品牌黑曜石雕塑感无线音箱 | 低调电影光影、材质、空间和人类尺度的产品镜头 | world、material、reveal、movement、human-scale、detail、final-frame |
| Trending Audio Sync | 无品牌半透明便携合成器/音乐播放器 + 原创成人 creator | 原创成人角色在彩色工作室中按已批准节拍运动和剪辑 | audio、beat-map、reveal、movement、drop、loop、platform-cut |

不同主题即使属于同一 Brand / Creator 分组，也不得使用同一产品、同一人物、同一场景或同一 contact-sheet crop。素材 ledger 必须同时比较：

- URL；
- SHA-256 文件 hash；
- perceptual hash；
- 产品/角色类别；
- 人工主题相关性。

### 7.3 供应商生成方式

继续使用已经配置且经确认的供应商渠道：

- Provider label：`image4`；
- Model：`gpt-image-2`；
- Provider type：`image`；
- 目标站点：只允许 `site_aidreamcapes`；
- 生成方式：每个主题 1 张严格 3×3 contact sheet，再本地裁切为 9 张。

本组默认最多 4 次 paid create，每个主题 1 次，`attempts=1`，不自动重试、不自动 fallback。真实生成前必须重新执行：

1. 读取 provider 配置，不输出 API key；
2. 读取当前模型状态和额度/计费信息；
3. 运行 dry-run，显示主题清单、endpoint、model、最大 paid creates；
4. 获得用户对本组最多 4 次供应商调用的明确确认；
5. 生成后保存 request id、结果、生成次数和内容 hash。

如果供应商不支持严格 contact sheet 生成，必须停止并重新报告预计单图 create 次数，不能静默扩大调用额度。

本阶段不调用 Codex 内置 `image_gen`。

### 7.4 图片 SEO 与性能

每张图片由 SQL `LivePage.contentJson` 提供：

- `src`；
- `alt`；
- `width`；
- `height`；
- `loading`；
- `fetchPriority`；
- `sizes`，后续可扩展 `srcSet`。

策略：

- `source-input` 和 `hero-output` 首屏 `eager`；只有 `source-input` 使用 `fetchPriority=high`；
- 7 张示例图 `lazy`，`fetchPriority=auto`；
- 真实文件尺寸与 SQL 尺寸必须一致；
- alt 必须包含主题、角色/产品、动作或叙事上下文，不写 `AI image` 等泛化描述；
- OG 图使用本页横向 output 或独立横向裁切，不能引用其他主题图片；
- 图片点击打开 modal 详情查看，不能改变 URL 或跳到顶部。

## 8. SQL 数据合同

### 8.1 页面 JSON 结构

新增页面统一使用：

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
        contentKey: "brand-creator-<topic-key>",
        content: {
          layoutVariant: "brand-creator-detail",
          seo: {},
          hero: {},
          creatorOutput: {},
          workflow: {},
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
    sourceRevision: "aidreamcapes-brand-creator-v1-provider-image4",
    siteId: "site_aidreamcapes"
  }
}
```

字段名称可以在实现时与现有 `AdsTestingDetail` 共享渲染接口，但 `layoutVariant`、`contentKey` 和页面内容必须保持 Brand / Creator 独立，不能回落到 UGC 或旧 standard topic。

### 8.2 迁移脚本要求

新增：

- `scripts/lib/aidreamcapes-brand-creator-content.mjs`：4 页独立英文内容、TDK、FAQ、媒体 manifest 和 provider prompt。
- `scripts/generate-aidreamcapes-brand-creator-assets.mjs`：默认 dry-run；显式供应商、站点、主题和生成上限。
- `scripts/migrate-aidreamcapes-brand-creator-pages.mjs`：默认 dry-run；精确备份、只写目标 Aidreamcapes `LivePage`、readback/hash。
- `scripts/smoke-aidreamcapes-brand-creator-pages.mjs`：检查 4 个页面、菜单、TDK、图片隔离、FAQ、SSR 和 modal。

迁移必须满足：

- `--site-id=site_aidreamcapes` 必须显式提供；
- 目标 page ID 必须显式列出；
- 默认 dry-run；
- 写入前读取并保存原始 `LivePage`；
- 只更新目标 4 个 `LivePage.contentJson` 及确认后的 Aidreamcapes Brand / Creator 导航字段；
- 不写入 `ThemePage.draftJson` 作为公开运行时数据；
- 写入后 SQL readback、页面 hash、media 数量和导航顺序校验；
- 不更新 MyDreamShoots、`aidreamcapes.eu`、`aidreamshoots.eu` 或其他 storefront；
- 不修改支付、Auth、Credits、Checkout、Generation、Subscription 或用户数据；
- 生产发布必须另行备份、灰度、readback 和回滚验证。

## 9. 实施顺序

### Phase A：计划确认与只读审计

- 用户确认 4 个页面的独立 route、保留 URL、legacy 处理和 SEO 方向。
- 读取 SQL 中 draft/published Brand / Creator 导航，确认 Label 和顺序不变。
- 读取 4 个当前入口对应的 LivePage、页面变体、TDK、媒体和旧模板。
- 生成 route 差异、共用页面差异和当前媒体 ledger 报告。
- 确认 `talking-head-video` 只作为 legacy/兼容页面存在，不继续承载两个新版菜单项。

### Phase B：内容合同与图片准备

- 写入 4 页独立英文 TDK、Hero、workflow、creative directions、examples、FAQ、CTA。
- 为 4 页定义不同 creator、产品、空间、动作和视觉语言。
- 运行内容 validator、TDK validator、FAQ validator 和图片 manifest validator。
- 运行供应商 dry-run，预计最多 4 个 contact-sheet paid create；等待用户确认后再生成。
- 生成图片后裁切、转换 WebP、检查真实尺寸、文件 hash 和跨主题唯一性。

### Phase C：详情页与 SQL 实现

- 扩展 `brand-creator-detail` 变体并注册 SSR renderer。
- 使用共享 Aidreamcapes Header/Footer，不创建页面专属导航。
- 创建 `founder-update`、`multilingual-video` 两个精准页面。
- 重建 `cinematic-video`、`music-video` 两个既有 URL 页面。
- 更新 Aidreamcapes Brand / Creator 菜单，使每个 Label 绑定对应真实 route。
- 只更新目标 `LivePage.contentJson` 和已批准的 Aidreamcapes 导航 SQL 字段。
- 保留 `talking-head-video` 旧 route，不删除、不自动 redirect，直到 legacy 审计确认。

### Phase D：本地验收

- 1440px 桌面端与 390px 移动端截图。
- 4 个目标页面 HTTP 200，页面变体均为 `brand-creator-detail`。
- 每页 9 张独立图片，合计 36 张 WebP，所有图片来自 `site_aidreamcapes` 隔离路径。
- Header、Mega Menu、Mobile Navigation、Footer 与首页保持一致。
- 所有图片点击打开 modal，不改变 URL、不跳顶部。
- title、description、canonical、robots、OG、Twitter、JSON-LD 位于 `<head>`。
- FAQ `<details>` 与 FAQPage JSON-LD 数量、问题和答案完全一致。
- 浏览器无正文 API fetch、无空链接、无 `href="#"`、无 disabled CTA、无跨 storefront href。
- 本地路径和 host-mode 均不跨站；`.eu` 不读取 `.com` 内容或素材。
- `npm run typecheck`、`npm run lint` 和专用 browser smoke 通过。

## 10. 验收变量与停止条件

目标验收变量：

```text
BRAND_CREATOR_ZIP_LABELS_ENUMERATED=PASS
BRAND_CREATOR_ROUTE_MATRIX_COMPLETE=PASS
FOUNDER_UPDATE_INDEPENDENT_PAGE=PASS
LOCALIZATION_INDEPENDENT_PAGE=PASS
CINEMATIC_PRODUCT_FILM_REBUILT=PASS
TRENDING_AUDIO_SYNC_REBUILT=PASS
BRAND_CREATOR_MENU_ORDER_PRESERVED=PASS
GENERIC_TALKING_HEAD_DUPLICATION_REMOVED_FROM_NAV=PASS
BRAND_CREATOR_TDK_COMPLETE=PASS
BRAND_CREATOR_MEDIA_MANIFEST_COMPLETE=PASS
BRAND_CREATOR_MEDIA_HASH_UNIQUE=PASS
BRAND_CREATOR_IMAGE_DIMENSIONS_VALID=PASS
BRAND_CREATOR_FAQ_SSR_AND_JSONLD_MATCH=PASS
BRAND_CREATOR_GALLERY_MODAL_PASS=PASS
BRAND_CREATOR_NO_BODY_DATA_FETCH=PASS
AIDREAMCAPES_ONLY_SQL_WRITE=PASS
OTHER_STOREFRONTS_UNCHANGED=PASS
CODE_CHANGED_BEFORE_APPROVAL=NO
SQL_WRITTEN_BEFORE_APPROVAL=NO
PROVIDER_CALLED_BEFORE_CONFIRMATION=NO
PRODUCTION_PUBLISHED_BEFORE_APPROVAL=NO
```

如果出现以下情况，必须停止并报告，不得自动继续：

- 供应商不支持 contact sheet，预计调用次数超过 4 次；
- 无法确认图片主题与页面内容一致；
- 发现目标 page ID 属于其他 storefront；
- 当前 SQL 读不到 `site_aidreamcapes` 的导航或 LivePage；
- 发现新页面仍然回落到 `talking-head-video`、旧 standard topic 或 generic image；
- canonical、robots、OG、Twitter 或 JSON-LD 无法从同一 `LivePage.contentJson` 读取；
- `.com` 资源泄漏到 `.eu`，或其他 storefront 内容 hash 发生变化。

## 11. 完成标准

只有同时满足以下条件，Brand / Creator 主题实施才算完成：

- ZIP 的 4 个 Label 和顺序保留；
- Founder Update、Localization 不再共用旧 talking-head 页面；
- Cinematic Product Film、Trending Audio Sync 已重建为新 `brand-creator-detail` 页面；
- 4 页每页拥有独立 TDK、正文、FAQ、CTA、canonical 和 9 张主题图片；
- 图片路径、alt、尺寸、加载策略和 OG 图全部由目标 `LivePage.contentJson` 提供；
- 4 个页面共 36 张图片跨页无 URL/hash/perceptual hash 重复；
- 图片与 creator、产品、场景和主题内容一致；
- 共享 Header、Mega Menu、Mobile Navigation、Footer 与 Aidreamcapes 首页一致；
- 旧 talking-head route 未误删，legacy 策略单独记录；
- 页面 SSR 直接读取 SQL，浏览器不请求正文 API；
- `site_aidreamcapes` 之外的数据库、代码路径、素材、SEO 和上线状态不变；
- 未完成本地视觉、SEO、路由和 storefront 隔离验收前，不得发布线上。

## 12. 执行状态与后续发布门槛

### 12.1 本轮执行结果

- `Founder Update` 已创建并绑定 `/ai-video-generation/founder-update`。
- `Localization (Multi-language)` 已创建并绑定 `/ai-video-generation/multilingual-video`。
- `Cinematic Product Film` 已按新变体重建并保留 `/ai-video-generation/cinematic-video`。
- `Trending Audio Sync` 已按新变体重建并保留 `/ai-video-generation/music-video`。
- 四页均使用 `brand-creator-detail` SSR renderer，页面正文、TDK、FAQ、CTA 与媒体 manifest 来自 SQL `LivePage.contentJson`。
- 每页 9 张独立 WebP，四页共 36 张；图片点击打开详情 modal，不改变 URL、不跳回顶部。
- 供应商图片生成使用 `image4 / gpt-image-2`，4 次请求、每个主题 1 次、无重试；未调用 Codex 生图。
- SQL 写入前已备份：
  `releases/backups/aidreamcapes/brand-creator-pages-20260913092502.json`
- 专用 smoke 结果：4 页 HTTP 200、导航 PASS、uniqueMedia=36、browserBodyFetch=PASS。
- `npm run typecheck` PASS；`npm run lint` PASS（仓库既有 185 条 warning，无 error）。
- 当前未执行线上发布、GitHub push 或生产数据库发布。

上述实现确认项已由用户确认并完成。本文件当前仅等待独立的生产发布授权；在获得该授权前，不执行线上发布、GitHub push 或生产数据库写入。
