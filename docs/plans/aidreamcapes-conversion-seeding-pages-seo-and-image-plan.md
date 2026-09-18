# Aidreamcapes Conversion / Seeding 主题详情页 SEO、文案与生图实施方案

状态：`PLAN_READY / IMPLEMENTATION_NOT_STARTED`

日期：2026-09-13

适用 storefront：`site_aidreamcapes`（`www.aidreamcapes.com`）

## 1. 目标与边界

本方案针对 ZIP 已定稿的 `Video → Conversion / Seeding` 分组，逐页重建以下 8 个主题详情页：

1. Product Demo
2. Unboxing Experience
3. How-to Tutorial
4. Feature Callout
5. Competitor Comparison
6. Social Proof Animation
7. Duet / Reaction
8. Green Screen Speaking

ZIP 继续决定用户看到的菜单标签、分组和顺序；当前项目只负责把每个入口绑定到真实可渲染的页面。

本阶段约束：

- 只修改 `site_aidreamcapes`；不修改 MyDreamShoots、`.eu` 或其他 storefront。
- 详情页使用 Aidreamcapes 首页的 ZIP 主题：黑色背景、紫蓝粉渐变、玻璃卡片、Outfit 字体、共享 Header/Footer。
- 不把 8 个主题继续指向同一个旧通用页面。
- 不删除旧路由；旧通用页只作为兼容或历史 SEO 页面，是否 `REDIRECT` 另行确认。
- 页面正文、CTA、FAQ、图片 URL、alt、尺寸、加载策略和 SEO 全部写入 `LivePage.contentJson`。
- SSR 直接从 SQL 读取；浏览器不通过 JavaScript 请求正文数据。
- 供应商图片尚未生成。本方案批准后，首次供应商生图前仍需确认供应商费用/额度和最大生成次数。

## 2. 入口与 canonical route 矩阵

目标是让每个 ZIP 菜单项都有独立语义、独立页面和独立素材。现有页面不再作为多个菜单项的最终落点。

| ZIP Label | 当前入口 | 目标 canonical route | Action | 页面主题意图 |
|---|---|---|---|---|
| Product Demo | `/ai-video-generation/product-video` | `/ai-video-generation/product-video` | `KEEP_URL + REBUILD` | 展示产品如何工作，重视动作、反馈和结果 |
| Unboxing Experience | `/ai-video-generation/product-video` | `/ai-video-generation/unboxing-experience` | `CREATE_PAGE_AND_ADD` | 第一印象、拆包顺序、期待感和真实使用前的体验 |
| How-to Tutorial | `/ai-video-generation/how-to-video` | `/ai-video-generation/how-to-video` | `KEEP_URL + REBUILD` | 可执行的分步教学，不做泛泛产品介绍 |
| Feature Callout | `/ai-video-generation/product-video` | `/ai-video-generation/feature-callout` | `CREATE_PAGE_AND_ADD` | 一次只讲一个功能，并用可观察画面证明 |
| Competitor Comparison | `/ai-video-generation/product-ad-video` | `/ai-video-generation/competitor-comparison` | `CREATE_PAGE_AND_ADD` | 中性维度对比、决策帮助和可验证差异 |
| Social Proof Animation | `/ai-video-generation/video-ad` | `/ai-video-generation/social-proof-animation` | `CREATE_PAGE_AND_ADD` | 将已批准的评价、数据或使用反馈做成动态证据 |
| Duet / Reaction | `/ai-video-generation/social-media-video` | `/ai-video-generation/duet-reaction` | `CREATE_PAGE_AND_ADD` | 双人回应、观点接力、反应节奏和上下文 |
| Green Screen Speaking | `/ai-video-generation/talking-head-video` | `/ai-video-generation/green-screen-speaking` | `CREATE_PAGE_AND_ADD` | 主播/演员在绿幕前讲解，后置产品画面或背景 |

新版 Video Mega Menu 的 `Conversion / Seeding` 仍保持 ZIP 的 Label 和顺序，但每个新建项绑定上表中的真实 route。旧入口不因页面仍存在而自动回到新版菜单。

## 3. 统一 SEO 数据规范

每个页面独立编写 TDK，不复制 UGC Product Ad 的整段文案。标题和描述全部为 customer-facing English。

| Route | Title | Description | Primary keyword intent |
|---|---|---|---|
| `/ai-video-generation/product-video` | `AI Product Demo Video Generator \| Aidreamcapes` | `Show how a product works with an AI product demo video that captures the setup, action, visible result, and next step for clear customer understanding.` | AI product demo video, product demo video generator |
| `/ai-video-generation/unboxing-experience` | `AI Unboxing Experience Video Generator \| Aidreamcapes` | `Create an AI unboxing experience video that builds anticipation, reveals the product in sequence, and turns a first impression into a useful story.` | AI unboxing video, unboxing experience video |
| `/ai-video-generation/how-to-video` | `AI How-to Tutorial Video Generator \| Aidreamcapes` | `Turn product instructions into a clear AI how-to tutorial with numbered actions, visible feedback, and a finish the viewer can follow.` | AI tutorial video, how-to video generator |
| `/ai-video-generation/feature-callout` | `AI Product Feature Callout Video Generator \| Aidreamcapes` | `Explain one product feature at a time with an AI feature callout video that pairs a focused claim with a clear visual demonstration.` | product feature video, feature callout video |
| `/ai-video-generation/competitor-comparison` | `AI Competitor Comparison Video Generator \| Aidreamcapes` | `Build a balanced AI competitor comparison video around approved criteria, observable product differences, and a decision the viewer can evaluate.` | AI comparison video, competitor comparison video |
| `/ai-video-generation/social-proof-animation` | `AI Social Proof Animation Video Generator \| Aidreamcapes` | `Turn approved reviews, ratings, or usage signals into an AI social proof animation that adds context without inventing customer evidence.` | social proof animation, review video generator |
| `/ai-video-generation/duet-reaction` | `AI Duet & Reaction Video Generator \| Aidreamcapes` | `Create an AI duet or reaction video with two clear points of view, timed responses, and enough product context for the conversation to make sense.` | AI duet video, reaction video generator |
| `/ai-video-generation/green-screen-speaking` | `AI Green Screen Speaking Video Generator \| Aidreamcapes` | `Create a speaking video with a green-screen presenter, a controlled product backdrop, and clean composition for explainers, demos, and social clips.` | green screen speaking video, AI presenter video |

实现时每个页面还必须写入：

- 8–12 个与本页意图匹配的 keywords，不堆叠无关 `UGC`, wedding, holiday, portrait package 词。
- `canonicalPath` 与 route 完全一致。
- `canonical` 使用 `https://www.aidreamcapes.com` 绝对地址。
- `robots.index=true`、`robots.follow=true`，除非后续 SEO 审计明确要求改变。
- `twitterDescription` 与本页主题一致。
- `ogImage` 和 `ogImageAlt` 使用本页独立横向素材。
- Breadcrumb、Service、SoftwareApplication、FAQPage JSON-LD 与页面正文保持一致。

## 4. 8 个页面的主题文案设计

所有页面沿用 UGC Ad Video 已验收的深色详情页结构，但每个页面的内容任务不同。组件只渲染 SQL 数据，不在组件内写正式文案。

### 4.1 Product Demo

核心问题：用户如何理解产品的动作、反馈和结果？

- Hero：`Show the product working, not just sitting in frame.`
- Workflow output：setup → action → feedback → result。
- Creative directions：close-up proof、use moment、before action / after action、one benefit per shot。
- Examples：开机、操作、细节反馈、完成结果、真实使用环境。
- FAQ：与广告页区分，强调 Product Demo 是解释产品工作的页面，不是只做销售口号。

### 4.2 Unboxing Experience

核心问题：拆包和第一次接触产品的体验如何形成完整叙事？

- Hero：`Make the first reveal feel worth watching.`
- Workflow output：arrival → opening → reveal → first touch。
- Creative directions：package texture、ordered reveal、reaction beat、what is included。
- Examples：外包装、打开盒盖、取出产品、配件平铺、第一次拿在手上。
- 约束：不伪造真实客户评价，不把拆包页写成产品规格页。

### 4.3 How-to Tutorial

核心问题：观众能否照着画面完成一个具体任务？

- Hero：`Turn a product task into steps someone can follow.`
- Workflow output：goal → setup → action 1 → action 2 → check → finished state。
- Creative directions：numbered sequence、hands-on framing、visible feedback、common mistake check。
- Examples：准备、第一步、关键动作、反馈状态、完成状态。
- 约束：步骤必须可执行；不使用含糊的“AI 会自动完成一切”式文案。

### 4.4 Feature Callout

核心问题：一个具体功能如何被看见、理解和验证？

- Hero：`Give one feature the screen time it deserves.`
- Workflow output：feature → action → visible effect → customer relevance。
- Creative directions：macro detail、split state、motion cue、one claim / one proof。
- Examples：按钮或接口细节、工作状态、前后反馈、应用场景、限制说明。
- 约束：一页只突出一个功能；生成图片不放不可控的可读文字，说明文字由 HTML/SQL 渲染。

### 4.5 Competitor Comparison

核心问题：用户怎样在公平、可验证的维度上做选择？

- Hero：`Make the buying decision easier to compare.`
- Workflow output：criteria → side-by-side evidence → trade-off → fit。
- Creative directions：same task / two approaches、speed vs control、setup difference、best-fit conclusion。
- Examples：两个无品牌产品的同场对比、相同任务、尺寸/流程/结果差异、适用人群。
- 约束：不生成竞品 logo、商标、虚假性能数字或未经证实的贬低性结论；页面必须支持中性比较。

### 4.6 Social Proof Animation

核心问题：已批准的评价和使用信号如何变成可理解的证据？

- Hero：`Give approved proof a clearer rhythm.`
- Workflow output：source proof → context → highlight → product tie-in → next step。
- Creative directions：review highlight、rating context、usage signal、proof-before-promise。
- Examples：匿名评价卡、评分趋势的抽象视觉、产品使用反馈、复购/使用场景、结论 CTA。
- 约束：不得生成虚假客户姓名、头像、引号评价或“verified buyer”标签；只有 SQL 中已批准内容才可呈现为事实。

### 4.7 Duet / Reaction

核心问题：两种观点如何在同一条视频中形成有上下文的回应？

- Hero：`Let the response carry the story forward.`
- Workflow output：source moment → reaction → response → product context → conclusion。
- Creative directions：split-screen response、agree / challenge、try-and-react、question-and-answer。
- Examples：左/右画面、表情反应、产品试用回应、观点补充、收束结论。
- 约束：使用原创虚构成人角色，不模仿真实公众人物，不把未经授权的原视频呈现为真实来源。

### 4.8 Green Screen Speaking

核心问题：主播或演员如何在绿幕前清楚讲解产品，同时保留后置画面空间？

- Hero：`Put the presenter in front of the proof.`
- Workflow output：speaker role → script beat → background cue → product proof → CTA。
- Creative directions：corner presenter、full-height explainer、background swap、point-and-explain。
- Examples：主播正面讲解、侧身指向、产品功能背景、步骤背景、结尾 CTA 安全区。
- 约束：人物必须是原创虚构成人；背景由页面主题控制；不生成品牌 logo、新闻画面或误导性权威背书。

## 5. 统一 UI 页面架构

实现为新的 `conversion-seeding-detail` 页面变体，视觉参考现有 `/ai-video-generation/ugc-ad-video`，但文案、图片、FAQ 和相关链接由每页 SQL 数据独立提供。

固定 section 顺序：

1. Hero：独立产品输入图 → 独立主题输出图
2. What this workflow creates：该主题真实产出
3. The workflow：该主题的 4–6 步流程
4. Creative directions：该主题的创意方向
5. Examples：7 张独立主题示例图
6. Format / placement：适用视频格式和观看场景
7. Before you create：素材、授权、事实核验和 credits 检查
8. Continue the workflow：相关真实页面链接
9. FAQ：SSR `<details>` 与 FAQPage JSON-LD
10. Final CTA：绑定真实 `/app/create` 或已批准工作区入口
11. 共享 Footer

视觉约束：

- Header 高度、Header 数据、Mega Menu、Footer 数据继续使用共享 Aidreamcapes 实现。
- 背景 `#050505`，次级背景 `#0a0a0a / #141414`，边框 `rgba(255,255,255,0.10)`。
- 紫色 `#8b5cf6`、蓝色 `#3b82f6`、粉色 `#ec4899`。
- 最大内容宽度 1400px；桌面 Hero 双栏；移动端单栏。
- 图片卡片可点击查看大图，不能使用 `href="#"` 或点击后跳回页面顶部。
- 不在每页复制 Header/Footer 组件，不在页面组件硬编码导航和正式文案。

## 6. 图片生图策略

### 6.1 素材数量与数据结构

每个页面固定 9 张主题独立 WebP：

1. `product`：主题相关产品输入图
2. `hero-output`：主题核心输出图
3. `example-01` 至 `example-07`：七张主题示例图

目录：

```text
/public/assets/sites/site_aidreamcapes/conversion-seeding-v1/<topic-key>/
```

不得复用 `ads-testing-v3` 的图片作为正式素材。每个主题的 9 张图片必须与其他主题完全不重复。

### 6.2 供应商渠道

统一使用 DreamOps 中已配置的：

- Provider label：`image4`
- Model：`gpt-image-2`
- Provider type：`image`
- 站点：只允许 `site_aidreamcapes`

不使用 Codex 内置 `image_gen`。不让浏览器或客户前端直接调用供应商。

### 6.3 推荐生成方式

优先为每个主题生成一张严格的 3×3 contact sheet，再本地裁切为 9 张独立图片。每张 contact sheet 的九格固定对应：

```text
product | hero-output | example-01
example-02 | example-03 | example-04
example-05 | example-06 | example-07
```

每个主题必须在提示词中明确：

- 主题名称和唯一内容任务；
- 产品类别、角色、场景、动作和镜头顺序；
- 不要生成文字、logo、商标、水印、UI 或可读 signage；
- 不同格子使用不同构图，但仍属于同一个主题；
- 生成后由本地脚本裁切、校验尺寸和转换 WebP。

各主题的生图重点：

| Topic | 产品输入 | Hero 输出 | 示例图重点 |
|---|---|---|---|
| Product Demo | 桌面咖啡机或便携设备 | 手部操作并显示结果 | setup、按钮、反馈、完成状态 |
| Unboxing Experience | 有包装的耳机或生活用品 | 打开包装后的第一眼 | 外包装、拆封、配件、第一次接触 |
| How-to Tutorial | 可操作的厨房/家居产品 | 分步使用画面 | 准备、动作、反馈、完成任务 |
| Feature Callout | 有明确结构细节的护肤或数码产品 | 单功能近景演示 | 一个功能、一个效果、一个场景 |
| Competitor Comparison | 两个无品牌同类产品 | 中性并排比较 | 相同任务、差异维度、适用场景 |
| Social Proof Animation | 可自然使用的消费产品 | 产品与反馈上下文 | 评价来源占位、使用信号、证据节奏 |
| Duet / Reaction | 可被两人讨论的消费产品 | 双人回应/试用 | split-screen、表情、回应、结论 |
| Green Screen Speaking | 可由主播讲解的产品 | 绿幕前原创成人主播 | 指向背景、讲解、产品证明、安全区 |

### 6.4 图片 SEO 和性能

每张图片由 SQL 提供：


- `src`
- `alt`
- `width`
- `height`
- `loading`
- `fetchPriority`
- `sizes`

策略：

- `product` 和 `hero-output` 首屏 eager；只有 `product` 使用 `fetchPriority=high`。
- 七张示例图 lazy、`fetchPriority=auto`。
- 所有图片固定 400×400 或按实际裁切尺寸写入真实值，不能伪造尺寸。
- alt 必须描述主题、产品、动作或证明场景，长度和语义不能只写 `AI image`。
- 页面图片、OG 图片只能来自 `/assets/sites/site_aidreamcapes/`。
- 禁止 `.eu`、`/assets/dreamshoot/` 或随机 Unsplash 素材。

## 7. SQL 实时数据和迁移方式

计划新增：

- `scripts/lib/aidreamcapes-conversion-seeding-content.mjs`：8 页独立英文内容、TDK、FAQ、媒体清单和 provider prompt。
- `scripts/generate-aidreamcapes-conversion-seeding-assets.mjs`：默认 dry-run，读取 `image4`，生成前显示 provider、模型、端点、最大次数和主题清单。
- `scripts/migrate-aidreamcapes-conversion-seeding-pages.mjs`：只更新 `site_aidreamcapes` 指定 `LivePage`，默认 dry-run，写入前备份，写入后 readback/hash 校验。

`LivePage.contentJson` contract：

```ts
{
  version: 1,
  pageType: "ai_tool",
  sectionsOrder: ["ai_video_topic_landing_1"],
  sections: {
    ai_video_topic_landing_1: {
      type: "ai_video_topic_landing",
      settings: {
        contentKey: "conversion-seeding-<topic-key>",
        content: {
          layoutVariant: "conversion-seeding-detail",
          seo: {},
          hero: {},
          workflowOutput: {},
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
    seoSource: "LivePage.contentJson",
    mediaSource: "LivePage.contentJson",
    sourceRevision: "aidreamcapes-conversion-seeding-v1"
  }
}
```

不得把运行时正文写入 `ThemePage.draftJson` 作为公开页面数据源。不得修改其他页面、其他站点、支付、Auth、Credits、Checkout、Generation 或 Subscription 数据。

## 8. 供应商生图安全门

供应商价格和计费规则在当前上下文中尚未确认，因此在第一次真实 `POST` 前必须执行：

1. 只读读取 SQL 中 `image4` 的 provider 配置，不输出 API key。
2. 只读确认模型、可用额度/计费说明和生成接口协议。
3. 运行图片脚本 dry-run，预计最多 8 个主题生成请求；每个主题默认 1 次 create，attempts=1，不自动重试。
4. 输出将要调用的 endpoint、model、主题数量、最大 paid creates 和停止条件。
5. 用户确认费用/额度上限后，才允许真实生成。

如果 contact sheet 接口不支持一次生成 9 格，不能静默扩大调用次数；必须重新报告预计最多 72 次单图 create，并重新获得明确额度确认。

## 9. 实施顺序

### Phase A：方案与内容合同

- 保存本方案文档。
- 读取当前 8 个页面和导航数据，生成 route/内容差异报告。
- 定义内容 schema、SEO validator 和图片 manifest validator。

### Phase B：内容与图片准备

- 编写 8 页独立英文 TDK、正文、FAQ 和 CTA。
- 编写每个主题的 provider prompt 和 9 张图片 alt。
- dry-run 供应商生图并等待费用/额度确认。
- 生成、裁切、转 WebP、检查真实尺寸和主题相关性。

### Phase C：页面与 SQL 实现

- 扩展详情页变体为 `conversion-seeding-detail`。
- 复用共享 Header/Footer 和详情页 UI 组件。
- 更新菜单项到独立真实 route。
- 备份并只写入目标 Aidreamcapes `LivePage.contentJson`。
- SQL readback、content hash 和媒体 hash 校验。

### Phase D：验收

- 1440px 桌面和 390px 移动端截图对比。
- 8 个页面 HTTP 200、无 404、无空链接、无 `href="#"`。
- 每页独立 9 张图片，8 页合计 72 张，跨页无复用。
- title、description、canonical、robots、OG、Twitter、JSON-LD 位于 head。
- FAQ 页面内容与 FAQPage JSON-LD 完全一致。
- 浏览器无正文 API fetch。
- `.com` / `.eu` 和其他 storefront 数据、文案、素材隔离。
- `npm run typecheck`、`npm run lint`、固定端口 `127.0.0.1:3002` SSR/browser smoke。

## 10. 完成标准

只有同时满足以下条件，才算本方案实施完成：

- 8 个菜单项不再共享同一个旧通用详情页。
- 每页的 Hero、workflow、examples、FAQ、CTA、TDK 与主题任务匹配。
- 每页使用独立 9 张供应商素材，图片不跨主题复用。
- 页面实时数据来自目标 `LivePage.contentJson`。
- 共享 Header/Footer 与首页一致。
- 旧路由未被误删，其他 storefront 未被修改。
- 供应商调用次数、结果、费用/额度状态可审计。
