# Aidreamcapes AI Twin 页面文案设计

- 日期：2026-10-20
- 页面：`https://www.aivideosugc.com/ai-video-generation/ai-twin`
- 数据源：`LivePage.contentJson`（`site_aidreamcapes`，页面 id `site_aidreamcapes_ai_twin`）
- 状态：**A 版已确认，按字段级 manifest 写入；不涉及发布快照或历史恢复**
- 已确认：采用 A 版，保留 preview notice，并将 `twin-presenters` 替换为可信度四点。
- 参考页面：Tagshop `https://tagshop.ai/ai-twin`（只参考信息结构、搜索意图和表达角度，不复制原文）

## 1. 先确认一个边界

当前产品的 AI Twin 仍是预览/模拟能力：

- `src/lib/aidreamcapes-workspace/navigation.ts` 将 `twin` 标为 `simulation`；
- `src/lib/aidreamcapes-workspace/clones.ts` 的 `cloneCapabilities()` 仍返回 `productionReady: false`，声音克隆、肖像克隆和完整视频复用均未开放；
- 当前公开页还明确写着“Face and voice cloning are not available here”。

因此不能把 Tagshop 的“上传照片即可克隆、无限生成、24 小时可用”直接写成已交付能力。文案分成两版：

| 版本 | 用途 | 发布条件 |
|---|---|---|
| A. Preview-safe | 现在就可以替换当前偏弱的“概念说明”文案 | 仍保留预览声明，不声称已完成克隆 |
| B. Launch-ready | 真实肖像/声音克隆、授权、撤销和视频消费链路验收后使用 | 需 capability、授权和真实样片全部通过 |

建议先上 A 版。B 版先作为后续上线文案储备，不在本轮写入线上。

## 2. SEO 目标

| 项目 | 建议 |
|---|---|
| 主关键词 | `AI Twin` |
| 辅助关键词 | `AI twin for brand videos`, `digital twin presenter`, `AI brand ambassador`, `AI presenter for product videos`, `authorized AI twin` |
| 搜索意图 | 商业调研 + 方案比较：用户想知道 AI Twin 是什么、和 AI avatar 的区别、能否用于品牌视频、授权怎么处理 |
| 内容角度 | 不自称“最好的 AI Twin 工具”，而是把“品牌一致性、授权、可复用”讲清楚；用可验证的能力状态建立信任 |
| 内链 | `/ai-video-generation/ai-actors`、`/ai-video-generation/text-to-video`、`/ai-video-generation/image-to-video` |
| 结构化数据 | 页面现有 WebPage JSON-LD 保留；A 版发布时可补 FAQPage，但只使用页面真实可见的问答 |

注意：`AI Twin` 与 `AI avatar` 不是同义词。页面需要明确“AI Twin 代表一个真实、已授权的人；AI presenter 是可用角色库”。这是与竞品形成差异、也是避免误导的关键。

## 3. A 版：Preview-safe 文案（建议现在使用）

### 3.1 SEO 字段

```json
{
  "seo.title": "AI Twin Generator for Brand Videos | AIVideosUGC",
  "seo.description": "Explore an authorized AI Twin for brand videos. Preview the likeness, voice, consent and review workflow, and create with available AI presenters today.",
  "seo.keywords": "AI Twin, AI twin for brand videos, digital twin presenter, AI brand ambassador, AI presenter for product videos",
  "seo.primaryKeyword": "AI Twin",
  "seo.ogImageAlt": "Presenter concept for an AI Twin brand video"
}
```

- Title 长度：48 字符。
- Description 长度：152 字符，包含主关键词和“preview”限定。
- `ogImage`、`canonical` 保持当前值，不新增图片。

### 3.2 Hero

| 字段 | 文案 |
|---|---|
| `eyebrow` | `AI TWIN PREVIEW` |
| `h1` | `Your AI Twin for brand videos.` |
| `lead` | `Turn your on-camera presence into a repeatable creative direction. Define how you look, sound and tell a product story, then explore new script variations without another studio day.` |
| `notice` | `AI Twin is in preview. Face and voice cloning are not available yet. Explore the concept and create with an available AI presenter today.` |
| `demoLabel` | `Illustrative AI Twin direction` |
| `heroChips` | `Authorized likeness`, `Consistent delivery`, `New script variations` |
| `primaryCta` | `Explore AI presenters` |
| `primaryHref` | `/ai-video-generation/ai-actors` |
| `secondaryCta` | `See the video workflow` |
| `secondaryHref` | `/ai-video-generation` |

Hero 先讲“可复用的品牌出镜方式”，再用 notice 明确预览状态。这样既覆盖 `AI Twin` 搜索词，也不把未来能力写成现成功能。

### 3.3 Statement

字段：`landingSections[id=twin-statement].items`

```json
[
  "One authorized identity.",
  "Many script directions.",
  "A consistent brand presence."
]
```

### 3.4 Why an AI Twin（6 张卡片）

| 字段 | 文案 |
|---|---|
| `eyebrow` | `WHY AN AI TWIN` |
| `title` | `A brand presence that can work beyond one shoot.` |
| `lead` | `An AI Twin is designed to keep the person your audience trusts consistent while the product, offer and script change.` |

| 卡片标题 | 正文 |
|---|---|
| `Stay camera-ready` | `Use an approved on-camera identity as the starting point for new product stories, without rebuilding the same setup each time.` |
| `Keep recognition consistent` | `Carry the same face, tone and delivery across launches, campaigns and markets.` |
| `Test more angles` | `Explore hooks, offers and product benefits in new script variations without booking a studio for every version.` |
| `Move with the campaign` | `Plan videos around launch dates and channel needs instead of production calendars.` |
| `Scale one identity` | `Keep the presenter consistent while products, scenes and formats change.` |
| `Review every claim` | `Keep scripts, product facts and disclosures visible in an editable storyboard before you publish.` |

### 3.5 Intended workflow（3 步）

| 字段 | 文案 |
|---|---|
| `eyebrow` | `THE INTENDED WORKFLOW` |
| `title` | `From an authorized identity to a new video.` |
| `lead` | `AI Twin is being designed around consent, review and reuse. Here is the workflow the concept is built for.` |

| 步骤标题 | 正文 |
|---|---|
| `Confirm the person and the rights` | `Record explicit permission for the likeness, voice and intended use. The person represented stays in control.` |
| `Create a reusable twin` | `Build a private presenter profile from approved reference material and keep its status visible.` |
| `Write the next script` | `Choose a product, scene and message, then review the generated video before it goes live.` |

### 3.6 One identity, many stories（Split）

| 字段 | 文案 |
|---|---|
| `eyebrow` | `ONE IDENTITY, MANY STORIES` |
| `title` | `A consistent presenter, without repeating the same shoot.` |
| `lead` | `The value of an AI Twin is not another avatar. It is a reliable on-camera presence you can return to as products, offers and channels change.` |
| `items` | `Keep the person your audience recognizes`; `Change the product, scene and message`; `Review each script and claim before publishing` |
| `button` | `Explore AI presenters` |
| `href` | `/ai-video-generation/ai-actors` |

### 3.7 Where an AI Twin fits（4 张场景卡）

| 字段 | 文案 |
|---|---|
| `eyebrow` | `WHERE AN AI TWIN FITS` |
| `title` | `One brand presence. Four content jobs.` |
| `lead` | `Use the same identity across the moments that usually require another filming day.` |

| 标题 | 正文 | 标签 |
|---|---|---|
| `Product launches` | `Introduce a new product with the same trusted face and a fresh script.` | `Launch` |
| `Founder-led ads` | `Put the founder's point of view in every campaign without another studio session.` | `Founder` |
| `Always-on social` | `Keep short-form content moving while the message changes.` | `Social` |
| `Market variations` | `Adapt the same offer for different audiences, languages and channels.` | `Scale` |

保留现有四张图片，只替换标题、正文和标签。

### 3.8 What makes a credible AI Twin（4 张卡片）

| 字段 | 文案 |
|---|---|
| `eyebrow` | `WHAT MAKES IT CREDIBLE` |
| `title` | `A digital double needs more than a likeness.` |
| `lead` | `The useful version is the one people can recognize, trust and control.` |

| 标题 | 正文 | 标签 |
|---|---|---|
| `Likeness` | `An identity the audience recognizes, built from authorized references.` | `Identity` |
| `Voice` | `A delivery that sounds like the person, not a generic presenter.` | `Voice` |
| `Consent` | `Clear permission, scope and revocation for every use.` | `Consent` |
| `Review` | `A human check before any video is published.` | `Control` |

这一组可以替换当前较泛的 `twin-presenters` 图片组。

### 3.9 AI Twin vs AI presenter（对比表）

| 字段 | 文案 |
|---|---|
| `eyebrow` | `CHOOSE THE RIGHT STARTING POINT` |
| `title` | `AI Twin or an AI presenter?` |
| `lead` | `Both can carry a product story. The right choice depends on whether the identity itself is part of the message.` |
| `columns` | `["", "AI Twin (preview)", "AI presenters (available now)"]` |

| 行标签 | AI Twin | AI presenters |
|---|---|---|
| `Identity` | `The authorized person you choose` | `A presenter from the library` |
| `Voice` | `Designed around the person's own voice` | `Preset voice options` |
| `Best for` | `Founder-led and recurring brand content` | `Fast product ads and tests` |
| `Available now` | `Preview and concept` | `Yes, in the workspace` |
| `Control` | `Consent and review are central` | `Choose a presenter and script` |

`note`：`AI Twin is a preview. Face and voice cloning are not available yet.`

### 3.10 FAQ

| 问题 | 回答 |
|---|---|
| `What is an AI Twin?` | `An AI Twin is a digital version of a real person, designed to carry their likeness and voice into new videos. Unlike a generic AI presenter, the identity belongs to a specific authorized person.` |
| `Is AI Twin available now?` | `Not yet. This page previews the concept. Face cloning, voice cloning and a production-ready digital twin are not available here. You can create product videos today with the available AI presenters and video workflow.` |
| `How is an AI Twin different from an AI presenter?` | `An AI presenter is a library performer you choose for a video. An AI Twin is designed to represent one real person, with explicit consent and a consistent identity across videos.` |
| `What will I need to create one?` | `The intended workflow uses approved reference images and audio, explicit permission from the person represented, and a clear scope for how the twin can be used.` |
| `Can I use my own face and voice?` | `That is the goal of AI Twin, but the capability is not live on this page yet. Do not upload or use another person's likeness or voice without their permission.` |
| `What can I create today?` | `You can choose an AI presenter, write a product brief, edit a storyboard, generate selected shots and assemble a video in the workspace.` |
| `How will consent work?` | `The concept requires explicit authorization, a defined scope and the ability to revoke future use. A twin should never be created from someone else's likeness without their permission.` |

### 3.11 Related + final CTA

Related cards:

| 标题 | 正文 | 链接 |
|---|---|---|
| `AI presenters` | `Browse available presenters for product videos.` | `/ai-video-generation/ai-actors` |
| `Text to Video` | `Turn a product brief into an editable video plan.` | `/ai-video-generation/text-to-video` |
| `Image to Video` | `Start a product video from a still image.` | `/ai-video-generation/image-to-video` |

CTA：

| 字段 | 文案 |
|---|---|
| `eyebrow` | `START WITH WHAT IS AVAILABLE TODAY` |
| `title` | `Create your next product video with an AI presenter.` |
| `lead` | `AI Twin is in preview. Choose an available presenter, add your product facts and review an editable storyboard before you generate.` |
| `button` | `Explore AI presenters` |
| `href` | `/ai-video-generation/ai-actors` |

## 4. B 版：Launch-ready 文案（能力验收后再用）

仅当以下条件全部满足后使用：

1. 真实肖像与声音克隆可以稳定创建、回读和复用；
2. 明示授权、范围、过期和撤销链路可用；
3. 克隆结果可以进入视频生成，并有人工审核与删除入口；
4. 真实样片、失败处理和费用边界完成独立验收。

### 4.1 Hero

```text
Eyebrow: AI TWIN GENERATOR
H1: Your AI Twin. Every script. No repeat shoot.
Lead: Digitize yourself, your founder or your brand ambassador into an authorized AI Twin. Keep your on-camera presence consistent while new product scripts become videos.
Notice: Create a twin only with explicit permission from the person represented.
Primary CTA: Create your AI Twin
```

### 4.2 内容顺序

1. `Why brands use an AI Twin`：always-on presence、consistent recognition、more script variations、less production friction、one identity across products、review and control。
2. `How it works`：authorize → upload approved references → create the twin → write a script → review and generate。
3. `What you can make`：product ads、founder videos、launch campaigns、social cuts、market/language variations。
4. `Built around consent`：explicit permission、scope、revocation、private assets、human review。
5. `AI Twin vs AI actor`：identity ownership、voice、use case、availability。
6. `FAQ`：what is an AI Twin、how long creation takes、can I use my voice、who can see my twin、how do I revoke consent、what happens to my footage。
7. `CTA`：`Create your AI Twin` → AI Twin workbench。

### 4.3 Launch-ready SEO

```json
{
  "title": "AI Twin Generator: Clone Yourself for Brand Videos",
  "description": "Create an authorized AI Twin of yourself, your founder or your brand ambassador. Generate new video scripts with a consistent face and voice, without another shoot.",
  "keywords": "AI Twin, AI twin generator, clone yourself for videos, AI brand ambassador, digital twin for brand videos",
  "primaryKeyword": "AI Twin generator"
}
```

## 5. 与 Tagshop 文案的差异

Tagshop 的页面重点是大规模、快速、照片生成、24 小时可用、无限视频。我们可以借鉴它的**信息顺序**：

1. 先讲结果（always camera-ready、scale、cost）；
2. 再讲三步流程；
3. 用使用场景承接；
4. 用 FAQ 处理“和 avatar 的区别、隐私、授权”。

但不能借用它未经我们验证的承诺。A 版把同样的价值改写成“designed to / intended workflow / preview”，并把“授权、撤销、人工审核”做成差异化卖点。这比单纯复制“克隆自己”更符合当前产品阶段，也能减少后续因能力未上线产生的误导和退款风险。

## 6. 建议的落库方式

A 版已按字段级增量写入，不使用整页快照。字段清单见
`scripts/manifests/aidreamcapes-ai-twin-copy-2026-10-20.json`，执行器见
`scripts/apply-aidreamcapes-ai-twin-copy.mjs`。

- 页面：`site_aidreamcapes_ai_twin`，slug `/ai-video-generation/ai-twin`；
- 字段：`LivePage.contentJson.sections.v2_main.settings.data.*` 与 `LivePage.contentJson.seo.*`；
- 保留：`heroImage`、`secondaryImage`、各 section 的 `image`、`canonical`、`ogImage`、现有 JSON-LD 基础；
- 写入前用当前 `updatedAt`/内容 hash 做 compare-and-set；
- 不读取 `ThemePage`、`draftJson`、`publishedJson` 或历史 publication；
- 写入后用无 JavaScript 的 SSR 回读检查 H1、meta title/description、FAQ 和 CTA 链接；
- 不修改 MyDreamShoots 或 Aidreamcapes EU 的任何数据。

## 7. 待确认

1. 先采用 A 版（预览安全），还是等真实克隆能力完成后直接使用 B 版？
2. A 版是否保留“AI Twin is in preview”的顶部 notice？我建议保留，至少在能力上线前保留。
3. 是否同意把当前页面 12 个 section 中的 `twin-presenters` 改为“credible AI Twin”四点（Likeness / Voice / Consent / Review）？
