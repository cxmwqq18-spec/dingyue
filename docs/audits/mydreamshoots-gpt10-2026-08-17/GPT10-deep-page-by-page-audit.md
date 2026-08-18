# myDreamshoots GPT10 深度逐页审计与整体整改方案

审计日期：2026-08-17（Asia/Shanghai）
审计范围：`GPT10_PROMPT_STRICT.md` 指定的 9 个 Blog URL，以及各页 DOM 中的全部 `<a href>`（包含默认可见链接、展开式导航、正文、CTA 与页脚）。
证据方式：Playwright Chromium 以 1440×1000 视口按 URL 1→9 严格串行访问；记录主文档 HTTP 响应、最终 URL、head、正文结构、图片、CTA、FAQ、所有链接、锚点与 JSON-LD。共享模板链接在逐页保留出现关系，在“全链接审计”中去重检查目标状态与语义。

优先级口径：

- **P0**：页面核心搜索意图、事实可信度或独立索引价值不成立；应先修再继续扩量。
- **P1**：不阻断索引，但明显削弱理解、信任、相关性、可访问性或转化。
- 纯风格偏好不列入整改。

> 限制：公开页面只能验证公开呈现与响应，不能验证后台生成质量、训练/删除流程、供应商执行或真实转化数据。相关项目会明确写“无法从当前公开访问确认”，不会据此猜测。

## 先看结论

- **9/9 页都需要重大重写，不是补几个关键词。** 全部页面 HTTP 200、self-canonical、`index, follow`，技术上具备索引资格；但正文独立价值不足，不能因为技术信号正常就判为合格。
- **模板重复已量化。** 36 对页面的归一化正文连续 5 词组 Jaccard 相似度为 0.9363–1.0000，平均 0.9819；9 页都使用同一个 37 内容块序列和同一标题层级序列。该数值只证明共享措辞程度，不等同于 Google 惩罚结论。
- **链接没有“死链”，但存在严重语义错链。** 1,179 次链接出现记录共对应 73 个去重 HTTP(S) 目标，73/73 返回 200；72/72 个同页锚点命中。Magic Upscaler → Photo Enhancer、Nature → Travel、Outdoor Creator Scenes → Urban 都能打开，却没有解释实体关系。
- **当前最危险的不是字数或 H1 数量，而是实体、事实与 Trust。** World Cup URL 与 Soccer 页面实体冲突；Virtual Try-On、Wedding 与 Soccer 博客遗漏了产品页已经公开的使用边界；About 的绝对退款承诺与 Refund Policy 条件不一致；myDreamshoots 与 BLYDEY/BLYDEYUS 社交主体关系未公开解释。
- **默认处理策略：** Cyberpunk、Mafia、Valentine's Day、Virtual Try-On、Wedding 保留 URL 并重写；Magic Upscaler、Nature、Outdoor Creator Scenes 先解决产品实体映射再决定保留或 301；World Cup URL 在品牌/法律审核后优先迁移到通用 Soccer URL。任何删除、合并或重定向前都应补看 Search Console、外链和转化数据。

## 1. Cyberpunk

URL：<https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide>

**页面类型 / 搜索意图：** Cyberpunk AI 人像主题的选购与准备指南；用户需要看到风格特征、适用场景、输入要求、相邻风格差异、结果检查方法与真实示例。

**本页实际核验：**

- HTTP 200，无跳转，最终 URL 与提交 URL 一致。
- Title：`Cyberpunk private AI photo guide | myDreamshoots`；Meta Description：`Turn your selfie into a neon city portrait with night lights, futuristic styling. Review credit cost, source quality, and private downloads.`
- self-canonical 正确；`robots=index, follow`；未见 `X-Robots-Tag` 阻止索引；HTML `lang=en`、`translate=yes`。
- 1 个 H1：`Cyberpunk: how to plan this myDreamshoots photo package category`；8 个 H2、3 个 FAQ H3；约 1,080 个英文词。
- Hero 有 Cyberpunk 成片、主题 CTA `Open Cyberpunk theme`；正文目录 8 个锚点均存在且能命中。
- 页面有 1 张正文图；自然尺寸 1024×1024，公开 ALT 为 `Neon cyberpunk portrait in a city scene, polished event lighting with directional window light.`
- DOM 共 131 个链接：Header 97、Article 12、Footer 22；Article 中 8 个目录链接、1 个产品链接、3 个相关文章链接。默认视图可见 42 个，其余主要来自折叠菜单。
- JSON-LD 可解析，含 `Organization`、`WebSite`、`BreadcrumbList`、`BlogPosting`；headline、description、URL、发布日期与页面基本一致。
- 可见事实信息只要求生成前查看动态 credit cost，没有给固定价格/credits 数量、结果数量、退款比例或效果保证。公开页面无法确认实际生成质量、私密相册控制或后台数据处理是否与描述一致。

**结论：重大整改。** 技术索引基础可保留，但正文多数是可套用到任意主题的模板，无法兑现 Meta 中“neon city portrait / night lights / futuristic styling”的具体承诺，独立价值不足。

### 可保留

- 当前 Title 和 Meta Description 比正文更具体，准确表达“Cyberpunk + private AI photo guide”意图；在正文改好前不要先删掉其中的 neon/night/futuristic 信息。
- 200、self-canonical、`index, follow`、单 H1、可用目录锚点与可解析的 BlogPosting/Breadcrumb 基础。
- Hero 实际展示 Cyberpunk 成片，主 CTA 指向 `/ai-image-generation/cyberpunk`，方向正确。
- “使用清晰、近期、无重滤镜且有使用权限的源照片”“生成前查看实时 credit cost”“下载前检查脸、手、头发和服装边缘”这些建议合理；应保留但改写到 Cyberpunk 场景中。

### 需要整改

1. **H1 与 Hero 首段没有直说用户能学到什么**
   - 原文案：`Cyberpunk: how to plan this myDreamshoots photo package category`
   - 替代文案：`Cyberpunk AI Photos: Neon Styles, Source Photos, and a Review Checklist`
   - 原文案：`Use this myDreamshoots guide to decide when Cyberpunk fits, which source photos or references help, what to compare before spending credits, and how to review finished images privately.`
   - 替代文案：`Learn how to plan a cyberpunk portrait with neon city lighting, futuristic wardrobe cues, and a focused set of source photos. Compare Cyberpunk with nearby city styles, then use the review checklist before you download your final images.`
   - 原因：当前 H1 是站内分类管理语言，“photo package category”不自然；Hero 首段没有兑现 Meta 的具体风格。属于搜索意图与自然度问题。
   - 优先级：**P0**

2. **“适合谁”段落是关键词占位，不是 Cyberpunk 判断标准**
   - 原文案：`Use Cyberpunk when Cyberpunk, cyberpunk, and Creative are the nearest match for the next photo set.`
   - 替代文案：`Choose Cyberpunk when you want a high-contrast futuristic portrait built around neon signs, rain-lit streets, metallic textures, holographic accents, or dramatic magenta-and-cyan lighting. For a natural professional portrait or a daylight lifestyle image, choose a less stylized package.`
   - 原因：大小写重复同一关键词并加上宽泛的 `Creative`，没有提供选择依据，且呈现明显模板/AI 痕迹。
   - 优先级：**P0**

3. **准备建议混入 fan、holiday、card、motion 等无关模板变量**
   - 原文案：`Prepare clear approved source portraits, then add one cue that belongs to Cyberpunk: light, scene texture, outfit tone, occasion, group size, or card-ready crop... Style references, outfit notes, fan details, holiday cues, or movement ideas should support the request...`
   - 替代文案：`Start with current, unfiltered portraits that clearly show your face from useful angles. Then choose one cyberpunk direction: neon alley, futuristic skyline, techwear portrait, holographic studio, or cinematic night scene. Add one lighting reference and one wardrobe cue only when they support that direction.`
   - 原因：当前段落没有说明 Cyberpunk 所需输入，反而暴露跨主题复用。替代文案不虚构固定上传数量，也更接近用户任务。
   - 优先级：**P0**

4. **比较表声称比较“nearby choices”，实际没有任何相邻主题**
   - 原文案：`Category examples: Cyberpunk, cyberpunk, and Creative`
   - 替代文案：`Cyberpunk — futuristic city scenes, neon color contrast, and techwear details. Urban — contemporary street portraits without the science-fiction layer. Nightlife — club or event lighting with a present-day look. Headshot — clean professional framing with minimal scene styling.`
   - 原因：当前表格把同一个词列两次，不能帮助决策。应基于真实在售主题写出边界，并链接相应产品页；上线前由产品负责人确认这些差异与实际生成能力一致。
   - 优先级：**P0**

5. **结果检查段落再次混入季节、球迷、卡片等不相关标准**
   - 原文案：`Cyberpunk should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy, or private keepsake mood.`
   - 替代文案：`A convincing cyberpunk result should keep the person recognizable while making the chosen futuristic direction visible. Check neon spill on the face, reflections, signage, eyewear and accessories, garment edges, hands, and whether background text or architecture contains distracting artifacts.`
   - 原因：原文无法证明本页独立撰写，也遗漏 Cyberpunk 成片最常见的检查点。
   - 优先级：**P0**

6. **“Mistakes to avoid”列出的场景与本主题不符**
   - 原文案：`Avoid asking Cyberpunk to cover several unrelated fan, game-day, premiere, or holiday scenes at once...`
   - 替代文案：`Avoid combining several competing worlds in one request, such as neon streetwear, corporate headshots, fantasy armor, and vintage film. Do not use heavily filtered source photos, and do not add multiple lighting references that pull the scene in different directions.`
   - 原因：fan、game-day、holiday 是其他文章意图；保留“一次只做一个清晰方向”的有效原则，但必须主题化。
   - 优先级：**P0**

7. **正文末尾把 Headshot 写成默认起点，用户路径不相关**
   - 原文案：`Start with Headshot Photo Package, then compare Cyberpunk with nearby categories before generating.`
   - 替代文案：`Compare Cyberpunk with Urban and Nightlife if you want a city setting but are unsure how futuristic the final look should be. Choose Headshot only when professional framing matters more than the scene.`
   - 原因：Cyberpunk 用户不应被无条件导向 Headshot；锚文本和路径应解释为什么点击。
   - 优先级：**P1**

8. **相关文章锚文本重复且不能描述目的页**
   - 原文案：`Open Avatar theme` → `/blog/anime-avatar-photo-package-guide`
   - 替代文案：`Read the Anime Avatar photo guide`
   - 原文案：`Open Avatar theme` → `/blog/profile-cards-photo-package-guide`
   - 替代文案：`Read the Profile Cards photo guide`
   - 原因：两个不同 URL 使用相同泛锚文本，第二个甚至不是 Avatar；影响可理解性、内部链接语义和无障碍体验。
   - 优先级：**P1**

9. **Hero ALT 后半句与可见图像不一致**
   - 原文案：`Neon cyberpunk portrait in a city scene, polished event lighting with directional window light.`
   - 替代文案：`Neon-lit cyberpunk portrait with magenta and cyan city lighting.`
   - 原因：图中主要是夜间霓虹光，不是可辨认的 directional window light；ALT 应描述图像，不应拼入灯光模板。
   - 优先级：**P1**

10. **作者与审核责任不可追溯**
    - 原文案：`myDreamshoots editorial team`
    - 替代文案：`Written by [full name], [relevant role]. Reviewed by [full name or accountable team] on [Month Day, Year].`
    - 原因：页面没有作者资料页、相关经验、编辑方法或事实审核说明。不要编造姓名；只有真实负责人完成审核后才能替换。公开访问无法确认当前团队的实际审核流程。
    - 优先级：**P1**

11. **BlogPosting 把“editorial team”声明为 Person**
    - 原文案：`"author":{"@type":"Person","name":"myDreamshoots editorial team"}`
    - 替代文案：若确为团队，使用 `"author":{"@type":"Organization","name":"myDreamshoots editorial team","url":"[真实编辑说明页 URL]"}`；若有真实署名作者，则保留 `Person` 并提供与页面一致的姓名和作者 URL。
    - 原因：团队不是 Person；Schema 应与页面可见作者身份一致，且不能用结构化数据补造页面没有的信任信息。
    - 优先级：**P1**

### 真正 SEO 大问题

- **独立索引价值不足：** 约 1,080 词看似完整，但核心段落可替换主题名后复用；`fan / game-day / holiday / card / motion` 等泄漏证明内容并非围绕 Cyberpunk。应在保留 URL 的前提下重写主要正文，而不是 canonical 到产品页。
- **内部链接语义错误：** 两个不同相关文章都用 `Open Avatar theme`，且 Profile Cards 目的页与锚文本不符。
- **结构化作者类型不匹配：** `editorial team` 被建模为 `Person`。其余 canonical、robots、状态码、单 H1、Breadcrumb/BlogPosting 解析未发现结构性故障。

### 本页不要改

- 不要把动态 credits 猜成固定价格或固定生成张数；本项无法从当前公开文章确认。
- 不要添加未经真实业务验证的 `guaranteed`、`instant`、效果成功率、评分或退款承诺。
- 不要删除目录与有效锚点，也不要为了关键词密度重复 “cyberpunk”。
- 不建议合并到产品页：指南意图与交易页可以共存，前提是本页补足真实示例、风格边界和专属检查方法。

## 2. Mafia

URL：<https://www.mydreamshoots.com/blog/mafia-photo-package-guide>

**页面类型 / 搜索意图：** 电影化 Mafia/noir 角色人像的主题指南；用户需要判断这种叙事风格是否适合，并了解服装、低调光、室内场景、道具克制、源照片和成片检查。

**本页实际核验：**

- HTTP 200，无跳转；self-canonical、`index, follow`、单一 Title 和单 H1 均正常，未见响应头级 noindex。
- Title：`Mafia AI photo planning guide | myDreamshoots`；Meta：`Create a private character-led album with moody interiors, tailored wardrobe cues. Review credit cost, source quality, and private downloads.`
- H1：`Mafia: how to plan this myDreamshoots photo package category`；8 个 H2、3 个 FAQ H3；约 1,077 词。
- Hero CTA 正确指向 `/ai-image-generation/mafia`；1 张可见主题图；8 个目录锚点全部命中。
- 图片 ALT：`Noir character portrait with dramatic contrast, close facial crop with natural daylight.`；可见图像是深色室内、百叶窗光、正装与手持道具，`natural daylight` 过于笼统。
- DOM 链接布局与第 1 页相同：Header 97、Article 12、Footer 22。正文仍是 8 个目录链接、Headshot 产品链接及同样 3 个相关文章链接。
- JSON-LD 可解析，含 Organization/WebSite/BreadcrumbList/BlogPosting；BlogPosting 的 headline、URL、日期与页面一致，但同样把 editorial team 建模为 Person。
- 与第 1 页归一化主题词后，正文 5-gram Jaccard 相似度约 **0.980**（共享 1,025 个、并集 1,046 个），属于逐段 near-duplicate，而非仅共享版式。
- 页面未给固定价格、credits、张数、退款或保证；实际生成效果、私密相册和后台处理无法从公开访问确认。

**结论：重大整改。** Meta 和 Hero 已建立 noir/Mafia 预期，但正文几乎只把第 1 页的 Cyberpunk 替换为 Mafia，无法形成独立索引价值。

### 可保留

- Title、Meta 中 `character-led album / moody interiors / tailored wardrobe cues` 是正确的主题方向。
- Hero 图和主题 CTA 与页面意图一致；200、self-canonical、robots、目录锚点及 Breadcrumb/BlogPosting 基础可保留。
- 清晰、近期、获授权的源照片，以及下载前检查脸、手、衣物边缘的通用建议可以保留，但必须加入本主题细节。

### 需要整改

1. **H1 和 Hero 首段仍是分类模板语言**
   - 原文案：`Mafia: how to plan this myDreamshoots photo package category`
   - 替代文案：`Mafia-Style AI Photos: Wardrobe, Lighting, and Scene Guide`
   - 原文案：`Use this myDreamshoots guide to decide when Mafia fits, which source photos or references help, what to compare before spending credits, and how to review finished images privately.`
   - 替代文案：`Plan a cinematic character portrait with tailored wardrobe, low-key interior lighting, and a restrained noir scene. Use this guide to prepare source photos, compare nearby styles, and review the details that make the final image believable.`
   - 原因：当前 Hero 没有兑现 Meta 的 moody interiors 和 wardrobe cues，搜索意图过泛。
   - 优先级：**P0**

2. **适用场景只写 “Mafia and Creative”，没有具体选择标准**
   - 原文案：`Use Mafia when Mafia and Creative are the nearest match for the next photo set.`
   - 替代文案：`Choose the Mafia style when you want a fictional, cinematic character portrait built around tailored suits, dark interiors, controlled window light, and a serious noir mood. Choose a professional Headshot for a neutral business image, or Rich Lifestyle when the goal is contemporary luxury rather than a period crime-film look.`
   - 原因：原文是分类名复读，用户无法据此选择；替代文案也明确这是 fictional style，避免把人物描述成真实犯罪成员。
   - 优先级：**P0**

3. **源照片建议泄漏其他主题变量**
   - 原文案：`...light, scene texture, outfit tone, occasion, group size, or card-ready crop... fan details, holiday cues, or movement ideas...`
   - 替代文案：`Use current, unfiltered portraits with a clear view of the face and hairline. Then choose one wardrobe direction—three-piece suit, overcoat, or understated evening tailoring—and one interior cue such as wood paneling, window blinds, or a dim private room. Keep props secondary to the person.`
   - 原因：fan、holiday、movement 与 Mafia/noir 输入无关；应提供主题专属且不虚构上传数量的准备方法。
   - 优先级：**P0**

4. **“nearby choices”表没有真实比较**
   - 原文案：`Category examples: Mafia and Creative`
   - 替代文案：`Mafia — fictional noir character, tailored wardrobe, and moody interiors. Rich Lifestyle — contemporary luxury without the crime-film framing. Nightlife — modern club or event lighting. Headshot — neutral professional portrait with minimal scene narrative.`
   - 原因：当前表格未履行标题承诺，且与第 1 页仅替换主题名。实际主题边界须在上线前由产品负责人确认。
   - 优先级：**P0**

5. **成片检查标准出现 seasonal cues、supporter energy、card framing**
   - 原文案：`Mafia should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy, or private keepsake mood.`
   - 替代文案：`Review whether the portrait keeps the person recognizable and the noir direction coherent. Check lapels, ties, hat brims, fingers around any prop, smoke or glass reflections, shadow detail around the eyes, and background objects that may be warped or repeated.`
   - 原因：原文来自跨主题模板；替代内容能直接帮助用户判断这类成片。
   - 优先级：**P0**

6. **风险与误用提示缺失**
   - 原文案：`Avoid asking Mafia to cover several unrelated fan, game-day, premiere, or holiday scenes at once...`
   - 替代文案：`Keep the request fictional and style-led. Use source photos only with permission, and do not present the finished image as evidence that a real person belongs to a criminal organization. Avoid combining several eras, competing wardrobe references, or multiple hero props in one brief.`
   - 原因：现有段落既不相关，也没有处理“给可识别真人套上犯罪身份”的信任风险。这是本主题应有的独立价值。
   - 优先级：**P0**

7. **Hero ALT 未准确描述可见光线与场景**
   - 原文案：`Noir character portrait with dramatic contrast, close facial crop with natural daylight.`
   - 替代文案：`Moody noir portrait of a man in a dark suit seated beside window blinds.`
   - 原因：可见图像的核心是深色室内与百叶窗定向光，不是泛化的 natural daylight；ALT 应客观描述，不堆风格词。
   - 优先级：**P1**

8. **正文内链仍把 Headshot 当默认起点，相关文章锚文本沿用错误**
   - 原文案：`Start with Headshot Photo Package, then compare Mafia with nearby categories before generating.`
   - 替代文案：`Compare Mafia with Rich Lifestyle and Nightlife when you are deciding between a fictional period mood, modern luxury, and contemporary event lighting.`
   - 原文案：两条 `Open Avatar theme`
   - 替代文案：分别改为 `Read the Anime Avatar photo guide` 与 `Read the Profile Cards photo guide`。
   - 原因：Headshot 不是该意图的默认路径；重复且错误的 Avatar 锚文本不能说明目的页。
   - 优先级：**P1**

9. **作者和 Article author 类型不可追溯**
   - 原文案：可见 `myDreamshoots editorial team`；JSON-LD 为 `@type: Person`。
   - 替代文案：`Written by [full name], [relevant role]. Reviewed by [accountable reviewer/team] on [Month Day, Year].`；团队署名在 JSON-LD 中用 `Organization`，真实个人署名才用 `Person`，并链接真实作者/编辑说明页。
   - 原因：不能用泛团队名和错误类型替代真实责任信息；姓名、资格和审核日期必须真实后再发布。
   - 优先级：**P1**

### 真正 SEO 大问题

- **与 URL 1 的 near-duplicate：** 归一化主题词后的 5-gram Jaccard 约 0.980，段落、表格、FAQ 和链接骨架几乎完全一致。self-canonical 不能为近重复页面创造独立价值。
- **正文与 Meta 意图脱节：** Meta 承诺 moody interiors 和 tailored wardrobe，正文却主要谈 credits/private gallery 和跨主题占位词。
- **内部链接锚文本错误、Article author 类型不匹配：** 与第 1 页相同。其余 HTTP、canonical、robots、单 H1 和结构化数据解析未见故障。

### 本页不要改

- 不要把 fictional cinematic style 写成真实 Mafia 身份，也不要加入未经验证的历史/犯罪组织事实。
- 不要无依据承诺固定 credits、结果张数、隐私实现、成功率或退款。
- 不要删除 Hero、目录和有效锚点；不要把这篇直接 canonical 到产品页。完成独立重写后，信息型指南和交易型主题页可以并存。

## 3. Magic Upscaler

URL：<https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide>

**页面类型 / 搜索意图：** 图片增强/放大工具指南；用户需要知道适用输入、可改善与不可恢复的细节、与去模糊/修复/润饰工具的边界、当前 credits/输出入口和增强后伪影检查。

**本页实际核验：**

- HTTP 200，无跳转；Title、Meta、self-canonical、`index, follow` 正常；未见响应头 noindex。
- Title：`Magic Upscaler private AI photo guide | myDreamshoots`；Meta：`Sharpen a favorite generated image for cleaner downloads, profile use, and larger display sizes. Review credit cost, source quality, and private downloads.`
- H1：`Magic Upscaler: how to plan this myDreamshoots photo package category`；8 个 H2、3 个 FAQ H3；约 1,111 词。
- Hero CTA `Open Magic Upscaler theme` 实际指向 `/ai-image-generation/photo-enhancer`。目标页返回 200，但公开产品名和 Title 均为 **Photo Enhancer**，不是 Magic Upscaler；目标页首个内容标题为 H2，没有 H1。
- 目标产品页公开展示 `10 Photos / 10 credits`，并把输入描述为 soft、dark、compressed 或 low-detail image；博客没有给这些关键操作信息，反而要求多张人像、服装和场景参考。
- Hero 图是增强前后对照概念；ALT 为 `Enhanced portrait preview with crisp detail, open group framing with directional window light.`，其中 `open group framing` 与单人对照图不符。
- 8 个目录锚点全部命中；链接数量/布局仍为 Header 97、Article 12、Footer 22；正文同样导向 Headshot 和 3 篇固定相关文章。
- JSON-LD 可解析；BlogPosting 与页面 URL/日期对应，但 author 仍把 editorial team 声明为 Person。
- 把 `Magic Upscaler/Mafia` 和 `Utility/Creative` 归一后，第 2、3 页正文 5-gram 集合完全相同（1,034/1,034，Jaccard **1.000**）。
- 页面无法证明算法是否只恢复真实细节、是否会生成新细节、最大尺寸/格式、处理时长及后台隐私执行；不能据公开文案猜测。

**结论：重大整改。** 这是工具意图与主题包模板的根本错配，同时存在 Magic Upscaler/Photo Enhancer 命名与 CTA 目的页不一致。

### 可保留

- Meta 中的 `sharpen / cleaner downloads / larger display sizes` 抓住了增强工具意图。
- 200、self-canonical、robots、目录锚点、Hero 对照概念及 CTA 的目标功能类别可以保留。
- “原图必须有足够真实细节”“对比增强前后”“避免过度锐化”这些信息目前出现在目标产品页，适合迁入本指南并由产品负责人确认。

### 需要整改

1. **先统一 Magic Upscaler 与 Photo Enhancer 的产品命名**
   - 原文案：`Open Magic Upscaler theme` → `/ai-image-generation/photo-enhancer`
   - 替代文案：若正式产品名是 Photo Enhancer，改为 `Open Photo Enhancer`，Hero 补一句 `Magic Upscaler is available in myDreamshoots as the Photo Enhancer package.`；若正式名是 Magic Upscaler，则产品页 Title、H1、卡片和 category 参数也必须统一，不能只改博客。
   - 原因：链接可达不等于语义正确。当前 CTA 文字、博客实体和落地产品实体不同，用户无法判断是否到了正确工具。
   - 优先级：**P0**

2. **H1/首段把工具误写成主题分类**
   - 原文案：`Magic Upscaler: how to plan this myDreamshoots photo package category`
   - 替代文案：`Magic Upscaler Guide: Improve Clarity Without Overprocessing Your Photo`
   - 原文案：`Use this myDreamshoots guide to decide when Magic Upscaler fits, which source photos or references help...`
   - 替代文案：`Use Magic Upscaler when a valuable photo is soft, dark, compressed, or too small for its intended display. This guide explains which file to start with, what enhancement can and cannot fix, and how to spot halos, false texture, or distorted details before downloading.`
   - 原因：用户寻找的是工具决策与质量控制，不是场景/风格包规划。
   - 优先级：**P0**

3. **输入建议要求无关的服装、节日与动作参考**
   - 原文案：`Prepare clear approved source portraits, then add one cue that belongs to Magic Upscaler: light, scene texture, outfit tone, occasion, group size, or card-ready crop...`
   - 替代文案：`Choose the cleanest available original rather than a screenshot or repeatedly compressed copy. Check that the face or subject still contains real edges and tonal detail. Crop only when the final use requires it, and keep an untouched copy for side-by-side review.`
   - 原因：Upscaler 的输入核心是单个源文件质量，不是角色造型与主题参考；原文会误导用户准备材料。
   - 优先级：**P0**

4. **没有说明增强能力边界，Trust 不足**
   - 原文案：`The strongest magic upscaler requests keep the brief and the result aligned.`
   - 替代文案：`Enhancement can improve perceived clarity and readability, but it cannot guarantee recovery of detail that is absent from the source. Treat newly sharpened facial features, text, jewelry, hair, and background patterns as generated interpretation until you compare them with the original.`
   - 原因：这是增强工具最重要的预期管理；页面当前暗示“更清晰”但不解释生成细节可能不真实。具体算法行为仍需产品核验。
   - 优先级：**P0**

5. **比较表仍没有比较相邻工具**
   - 原文案：`Category examples: Magic Upscaler and Utility`
   - 替代文案：`Photo Enhancer — general clarity, brightness, and download quality. Unblur Image — use when blur is the main defect. Old Photo Restoration — use for age-related damage or missing areas. Portrait Retouch — use when the original is already sharp and the goal is controlled portrait cleanup.`
   - 原因：`Utility` 是内部宽类，不是用户可执行的选择。各工具边界须与真实产品能力核对后发布。
   - 优先级：**P0**

6. **结果检查标准仍是场景主题模板**
   - 原文案：`Magic Upscaler should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy...`
   - 替代文案：`Compare the enhanced image at 100% with the original. Check skin texture, eyelashes, teeth, hair strands, text, straight edges, repeating background patterns, noise, ringing halos, and whether sharpening changed the person’s identity or expression.`
   - 原因：seasonal/supporter/mood 与增强质量无关；替代内容直接覆盖常见伪影。
   - 优先级：**P0**

7. **FAQ 问错了任务**
   - 原文案：`Is Magic Upscaler good for a first request?` / `How many source photos should I prepare?`
   - 替代文案：`When is a photo suitable for upscaling?` / `Should I upload the original file or a social-media copy?` / `What details should I compare after enhancement?`
   - 替代回答示例：`Upload the highest-quality original you have. A social-media download or screenshot may contain compression artifacts that become more visible after sharpening. Keep the original unchanged and compare both files before replacing it.`
   - 原因：当前 FAQ 是主题包模板，不能解决图片增强用户的实际问题。
   - 优先级：**P0**

8. **credits/输出信息与目标页没有形成可维护口径**
   - 原文案：`Before the job starts, review the visible credit cost...`
   - 替代文案：`The live Photo Enhancer package card shows the current output count and credit cost. Review both before starting; do not rely on a number copied into an older guide.`
   - 原因：审计时目标页显示 10 Photos/10 credits，但价格与配置可能变化。应从同一 catalog 数据源渲染或只链接实时卡片，避免文章硬编码漂移。
   - 优先级：**P1**

9. **Hero ALT 包含错误的 group framing**
   - 原文案：`Enhanced portrait preview with crisp detail, open group framing with directional window light.`
   - 替代文案：`Before-and-after portrait preview comparing a softer source image with an enhanced result.`
   - 原因：可见图像是单人增强对照，不是 group framing；ALT 应解释图像用途。
   - 优先级：**P1**

10. **正文内链与相关文章继续使用固定错误骨架**
    - 原文案：`Start with Headshot Photo Package...`
    - 替代文案：`Compare Photo Enhancer with Unblur Image and Old Photo Restoration before spending credits; choose the tool that matches the source defect.`
    - 原文案：两条 `Open Avatar theme`
    - 替代文案：分别使用 `Read the Anime Avatar photo guide` 和 `Read the Profile Cards photo guide`；更优方案是换成真正相关的 enhancement/unblur/restoration 指南。
    - 原因：Headshot、Avatar 与增强任务关系弱，且现有重复锚文本不准确。
    - 优先级：**P1**

11. **作者与 Article author 类型问题重复存在**
    - 原文案：`myDreamshoots editorial team` + `@type: Person`
    - 替代文案：`Written by [full name], [product or imaging role]. Reviewed against the live Photo Enhancer package on [Month Day, Year].`；Schema 与真实可见作者保持一致，团队用 Organization，个人才用 Person。
    - 原因：工具能力和 credits 口径需要可追溯的产品审核；不得编造姓名或审核日期。
    - 优先级：**P1**

### 真正 SEO 大问题

- **实体/链接不一致：** “Magic Upscaler” CTA 落到名为 “Photo Enhancer” 的产品页；应先确定唯一产品实体与命名策略。
- **与 URL 2 实质完全重复：** 归一化主题词与宽类词后 5-gram Jaccard 为 1.000。
- **搜索意图错位：** 工具页正文却使用主题包的场景、服装、相册与 FAQ 模板；继续独立索引会形成低价值入口。
- **CTA 目标页自身无 H1：** 目标页返回 200 且 canonical/robots 正常，但 heading 从 H2 开始。这不是“一页必须恰好一个 H1”的机械规则问题，而是主标题层级不清；应把可见主标题标记为 H1。
- canonical、robots、主文档状态码和本页 JSON-LD 解析本身未见故障；不要用 canonical 掩盖内容错位。

### 本页不要改

- 不要宣称“恢复真实细节”“无损放大”或固定最大分辨率，除非有可公开验证的产品规格。
- 不要把审计时看到的 10 Photos/10 credits 永久硬编码进文章；优先由 catalog 同源展示并保留核验日期。
- 不要为 FAQ 富结果而添加 FAQPage Schema。Google 已在 2026-06 移除 FAQ 富结果文档；FAQ 应只为真实用户问题服务。

## 4. Nature

URL：<https://www.mydreamshoots.com/blog/nature-photo-package-guide>

**页面类型 / 搜索意图：** 自然环境 AI 人像指南；用户需要明确它是户外人像而非风景摄影，并了解山地/森林/湖泊场景选择、户外服装与光线、真实地点表述边界及成片检查。

**本页实际核验：**

- HTTP 200，无跳转；Title、Meta、self-canonical、`index, follow` 正常。
- Title：`Nature private AI photo guide | myDreamshoots`；Meta：`Create outdoor portraits with alpine trails, forest paths, mountain lakes. Review credit cost, source quality, and private downloads.`
- H1：`Nature: how to plan this myDreamshoots photo package category`；8 个 H2、3 个 FAQ H3；约 1,077 词。
- Hero CTA `Open Nature theme` 实际指向 `/ai-image-generation/travel`。目标返回 200，但公开实体是 Travel，Title 为 `Travel photos for Destination Portraits and Route Stories | myDreamshoots`；目标页同样从 H2 开始，没有 H1。
- Travel 目标页公开包含 coast、city、resort、mountain route、scenic route 等方向，并明确生成图不可作为真实到访证据；本博客没有解释 Nature 与 Travel 的关系，也没有这项关键使用边界。
- Hero 图清楚展示山地金色时段人像；ALT 为 `Travel portrait in a scenic setting, polished event lighting with high-contrast rim light.`，其中 `event lighting` 不符合可见自然户外光。
- 8 个目录锚点均命中；链接结构仍为 Header 97、Article 12、Footer 22，正文仍导向 Headshot 和相同 3 篇相关文章。
- JSON-LD 可解析；BlogPosting URL/headline/date 对应，author 仍把 editorial team 声明为 Person。
- 与第 3 页归一化主题词和宽类词后，5-gram 集合完全相同（Jaccard **1.000**）。
- 固定价格/credits/输出数量未在博客出现。目标 Travel 页审计时展示 24 Photos/22 credits，但未来配置、生成真实性和隐私执行不能由本博客公开访问确认。

**结论：重大整改。** Meta/图片建立了明确户外意图，但正文没有 alpine、forest、lake 或自然光的专属方法，并与 Travel 产品实体命名不一致。

### 可保留

- Meta 中 `alpine trails / forest paths / mountain lakes` 对 Nature 户外人像意图具体且自然。
- Hero 主题图、200、self-canonical、robots、目录锚点及可解析 Schema 基础。
- 清晰源照片、避免重滤镜、下载前检查脸/手/衣物边缘等通用建议可保留并户外化。

### 需要整改

1. **先说明 Nature 与 Travel 的真实产品关系**
   - 原文案：`Open Nature theme` → `/ai-image-generation/travel`
   - 替代文案：若 Nature 是 Travel 的场景方向，改为 `Open Travel and choose a nature setting`，并在 Hero 写 `Nature scenes are available through the Travel package.`；若 Nature 是独立产品，则创建真实 Nature 产品页并让 CTA、catalog、Title 与 category 参数一致。
   - 原因：当前锚文本承诺 Nature 实体，目的页却是 Travel；用户需要在点击前知道关系。
   - 优先级：**P0**

2. **H1/首段没有区分户外人像与风景/旅行意图**
   - 原文案：`Nature: how to plan this myDreamshoots photo package category`
   - 替代文案：`Nature AI Portraits: Plan Forest, Mountain, and Lakeside Scenes`
   - 原文案：`Use this myDreamshoots guide to decide when Nature fits...`
   - 替代文案：`Plan an outdoor portrait around one natural setting—forest path, alpine trail, mountain lake, or open meadow. Prepare source photos that support the intended light and clothing, then review whether the person and generated landscape remain believable together.`
   - 原因：当前主标题是内部分类语言；替代文案直接界定是人像与自然场景的组合。
   - 优先级：**P0**

3. **适用与输入段落是模板，没有户外条件**
   - 原文案：`Use Nature when Nature and Creative are the nearest match...` / `...fan details, holiday cues, or movement ideas...`
   - 替代文案：`Choose Nature when the setting should lead the mood without turning the image into a destination claim. Use clear, current portraits, then choose one landscape, one season, one time of day, and clothing that makes sense for the terrain and weather.`
   - 原因：原文不能帮助用户选 forest/alpine/lake，也混入其他文章变量。
   - 优先级：**P0**

4. **相邻选择表没有处理 Nature、Travel 与 Outdoor Creator Scenes 的边界**
   - 原文案：`Category examples: Nature and Creative`
   - 替代文案：`Nature — the landscape and outdoor mood are the main visual idea. Travel — the image tells a destination or route story across city, coast, resort, or scenic locations. Outdoor Creator Scenes — the setting supports creator or personal-brand content, with space for platform-ready crops and props.`
   - 原因：这三页是本组最可能互相争夺意图的入口；必须用真实功能与使用场景区分，而不是列内部大类。
   - 优先级：**P0**

5. **缺少生成地点真实性边界**
   - 原文案：`Nature should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy...`
   - 替代文案：`Treat the landscape as generated unless it is based on a verified location workflow. Do not present a generated mountain, trail, lake, or wildlife encounter as proof that the person visited a real place. For documentary or commercial location claims, use a real photograph and disclose material AI edits.`
   - 原因：目标 Travel 产品页已有同类提示，本指南却遗漏；这是 Nature/Travel 内容的关键信任价值。
   - 优先级：**P0**

6. **成片检查与错误提示没有自然场景细节**
   - 原文案：`Avoid asking Nature to cover several unrelated fan, game-day, premiere, or holiday scenes at once...`
   - 替代文案：`Keep one landscape and one lighting direction per request. After generation, check the horizon, trail continuity, tree and rock repetition, reflections in water, shadows under the person, hair against foliage, hands around outdoor gear, and whether clothing matches the apparent weather.`
   - 原因：原文属于其他主题；替代清单可直接用于户外成片。
   - 优先级：**P0**

7. **Hero ALT 错把自然光描述成 event lighting**
   - 原文案：`Travel portrait in a scenic setting, polished event lighting with high-contrast rim light.`
   - 替代文案：`Outdoor portrait on a mountain trail with warm backlight at golden hour.`
   - 原因：ALT 应描述可见山地与自然背光，不应拼入 event lighting 模板。
   - 优先级：**P1**

8. **正文产品/相关文章链接不相关或锚文本错误**
   - 原文案：`Start with Headshot Photo Package...`
   - 替代文案：`Compare Nature with Travel and Outdoor Creator Scenes before generating; choose based on whether the landscape, destination story, or creator use is primary.`
   - 原文案：两条 `Open Avatar theme`
   - 替代文案：分别改为准确标题；更优先替换成 Travel、Outdoor Creator Scenes 与相邻户外指南。
   - 原因：Headshot/Avatar 没有形成 Nature 用户的下一步，重复锚文本也不描述目的地。
   - 优先级：**P1**

9. **作者与 BlogPosting author 仍不可追溯**
   - 原文案：`myDreamshoots editorial team` + `@type: Person`
   - 替代文案：`Written by [full name], [relevant role]. Reviewed against the live Travel/Nature package on [Month Day, Year].`；Schema 与真实署名一致，团队用 Organization。
   - 原因：需要有人对 Nature/Travel 关系与真实性提示负责；不得编造身份。
   - 优先级：**P1**

### 真正 SEO 大问题

- **Nature/Travel 实体混淆：** CTA 可达但锚文本与目的页产品名不同；应明确子方向关系或统一成一个实体。
- **与 URL 3 实质完全重复：** 归一化后 Jaccard 1.000；self-canonical 不能解决独立价值不足。
- **潜在意图内耗：** Nature、Travel 产品页和 URL 5 Outdoor Creator Scenes 都覆盖户外人像；必须分别定义 landscape-led、destination-led、creator-led 意图。
- **目标产品页主标题层级不清：** Travel 页无 H1。除此之外本页 HTTP、canonical、robots 与 JSON-LD 解析未见故障。

### 本页不要改

- 不要把生成场景命名为具体真实地点，除非工作流和素材能验证；不要暗示真实到访。
- 不要硬编码审计时看到的 24 Photos/22 credits；使用实时 catalog 数据或引导用户查看当前卡片。
- 不要因为 “Nature” 宽泛就立刻 noindex；先以明确的 landscape-led 独立内容验证是否值得保留，跨页策略在横向结论统一决定。

## 5. Outdoor Creator Scenes

URL：<https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide>

**页面类型 / 搜索意图：** 面向创作者/个人品牌的户外场景选择指南；用户需要按发布渠道、城市或自然背景、横竖裁切、品牌安全和真实性边界选择合适产品。

**本页实际核验：**

- HTTP 200，无跳转；Title、Meta、self-canonical、`index, follow` 正常。
- Title：`Outdoor Creator Scenes private AI photo guide | myDreamshoots`；Meta：`Compare creator-ready outdoor moods before spending credits: city streets, scenic cliffs. Review credit cost, source quality, and private downloads.`
- H1：`Outdoor Creator Scenes: how to plan this myDreamshoots photo package category`；8 个 H2、3 个 FAQ H3；约 1,145 词。
- Hero 图是海滩、海崖与海面背景的竖幅人物；ALT：`Creator profile portrait with polished styling, clean vertical framing with bright editorial light.`，没有描述页面最重要的海岸场景。
- 唯一 Hero CTA `Open Outdoor Creator Scenes theme` 实际指向 `/ai-image-generation/urban`。目标页返回 200，产品实体是 Urban，公开用途为 city streets、rooftop、subway、alley 和 creator visuals，并不覆盖 Hero/Meta 的 scenic cliffs。
- Urban 目标页公开提示不要暗示真实场馆、品牌或城市机构背书；本文没有这项 creator 场景应有的 Trust 边界。
- 8 个目录锚点均命中；链接仍为 Header 97、Article 12、Footer 22，正文固定导向 Headshot 与同样 3 篇相关文章。
- JSON-LD 可解析；headline/URL/date 对应，author 类型问题与前页相同。
- 正文与 URL 4 仍是主题名替换级 near-duplicate；结构、表格、FAQ、段落与相关链接完全同骨架。
- 页面未给固定价格/credits/结果数量；目标 Urban 页审计时显示 24 Photos/22 credits，但配置与后台执行不能由本文确认。

**结论：重大整改。** 当前名称像独立产品，实则 CTA 只通往 Urban，而 Hero/Meta 又承诺 Travel/Nature 场景。应重定位为 Urban 与 Travel 的 creator-use 比较指南。

### 可保留

- Meta 的 `city streets / scenic cliffs` 已经隐含“比较两种户外方向”，比正文更接近可成立的独立意图。
- 海岸 Hero 图适合展示 scenic creator scene；200、self-canonical、robots、目录锚点和 Schema 基础可保留。
- 先确定最终发布用途、使用获授权源图、下载前检查裁切与背景等原则可保留，但要改为 creator workflow。

### 需要整改

1. **不要继续把 Outdoor Creator Scenes 伪装成单一产品实体**
   - 原文案：`Open Outdoor Creator Scenes theme` → `/ai-image-generation/urban`
   - 替代文案：将 Hero 改为双路径：`Explore Urban creator scenes` → `/ai-image-generation/urban`；`Explore scenic Travel portraits` → `/ai-image-generation/travel`。
   - 原因：Meta/图片同时覆盖城市与海岸，而 Urban 不能代表全部承诺。比较指南比虚构一个 catalog 中不存在的主题更可信，也能产生独立价值。
   - 优先级：**P0**

2. **H1/首段应直接声明比较任务和发布用途**
   - 原文案：`Outdoor Creator Scenes: how to plan this myDreamshoots photo package category`
   - 替代文案：`Outdoor Creator Photos: Urban Streets vs Scenic Locations`
   - 原文案：`Use this myDreamshoots guide to decide when Outdoor Creator Scenes fits...`
   - 替代文案：`Choose an outdoor direction based on the content you need: Urban for city streets and modern creator profiles, or Travel for coast, mountain, resort, and route-story scenes. Plan the crop, background space, wardrobe, and disclosure before you spend credits.`
   - 原因：当前是内部分类语言；替代文案明确该页不是单一包，而是 creator-use 决策页。
   - 优先级：**P0**

3. **缺少创作者渠道与构图规划**
   - 原文案：`If the goal is still vague, start by naming the final use: profile update, creator album, keepsake, announcement, social draft, or a short motion test.`
   - 替代文案：`Name the destination before choosing a scene: profile avatar, vertical story, feed portrait, newsletter header, landing-page hero, or campaign draft. Decide whether the frame needs face-forward impact, full-body context, or negative space for approved copy.`
   - 原因：原文只是罗列用途；creator 用户真正需要的是渠道、裁切和留白决策。
   - 优先级：**P0**

4. **输入建议混入 fan/holiday/motion，未处理服装和品牌元素**
   - 原文案：`...fan details, holiday cues, or movement ideas...`
   - 替代文案：`Use current portraits with the expressions and body framing needed for the final channel. Choose one outdoor setting and simple wardrobe that separates clearly from the background. Remove unlicensed logos, venue marks, or campaign claims from references unless you have permission to use them.`
   - 原因：Creator 场景有明确的品牌安全需求；现有模板没有覆盖。
   - 优先级：**P0**

5. **比较表没有实际可点击的产品选择**
   - 原文案：`Category examples: Outdoor Creator Scenes and Creative`
   - 替代文案：`Urban — city street, rooftop, subway, alley, and modern creator profile. Travel — coast, mountain route, resort, old city, and destination-story framing. Nature guide — landscape-led planning when the environment matters more than a creator campaign format.`
   - 原因：应比较真实产品/内容实体，并与 URL 4 建立清晰层级，而不是使用宽泛的 Creative 标签。
   - 优先级：**P0**

6. **缺少生成地点、品牌与背书边界**
   - 原文案：`Outdoor Creator Scenes should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy...`
   - 替代文案：`Do not imply that a generated scene documents a real trip, venue booking, brand partnership, or city endorsement. Review signs, logos, landmarks, product labels, and background text before publishing, and follow the destination platform’s AI disclosure rules.`
   - 原因：这是 creator/commercial-use 的核心 Trust 信息；目标 Urban 页已有部分提示，本指南应统一口径。
   - 优先级：**P0**

7. **成片检查应围绕平台可用性，而不是通用 mood**
   - 原文案：`Avoid asking Outdoor Creator Scenes to cover several unrelated fan, game-day, premiere, or holiday scenes at once...`
   - 替代文案：`Review the selected crop at its real publishing size. Check face and hand detail, subject-to-background scale, horizon and perspective, shadows, hair edges, repeated architecture or foliage, safe space for copy, and whether the scene remains legible behind interface overlays.`
   - 原因：原文是跨主题模板；替代清单对应 creator 用户的发布任务。
   - 优先级：**P0**

8. **Hero ALT 没有描述海岸背景**
   - 原文案：`Creator profile portrait with polished styling, clean vertical framing with bright editorial light.`
   - 替代文案：`Outdoor creator portrait of a woman on a beach with sea and cliffs behind her.`
   - 原因：当前 ALT 只有抽象风格词，遗漏图像区分 Urban/Travel 的主要信息。
   - 优先级：**P1**

9. **正文 Headshot/Avatar 链接没有支持本页决策**
   - 原文案：`Start with Headshot Photo Package...` 与两条 `Open Avatar theme`
   - 替代文案：`Compare Urban and Travel for your intended channel, then review the Nature guide when a landscape-led scene is the priority.`；相关文章改链 Urban、Travel、Nature 或 creator usage/disclosure 指南，并使用各自准确标题。
   - 原因：内部链接应形成 topic cluster，不应让所有主题页重复指向 Headshot 和 Avatar。
   - 优先级：**P1**

10. **作者/审核与 BlogPosting author 类型问题**
    - 原文案：`myDreamshoots editorial team` + `@type: Person`
    - 替代文案：`Written by [full name], [creator or product role]. Reviewed against the live Urban and Travel packages on [Month Day, Year].`；真实团队在 JSON-LD 用 Organization。
    - 原因：双产品比较和商业使用边界需要可追溯审核；不得编造负责人。
    - 优先级：**P1**

### 真正 SEO 大问题

- **标题实体与 CTA 目的地冲突：** 页面承诺 Outdoor Creator Scenes，唯一 CTA 却只到 Urban；scenic cliffs 内容无入口。
- **与 URL 4 near-duplicate 且意图重叠：** 应把 URL 4 固定为 landscape-led，把本页改成 Urban-vs-Travel creator-use 决策页。
- **内部链接集群失效：** 正文仍统一导向 Headshot/Avatar，没有连接本组最相关的 Nature、Urban、Travel。
- 本页 HTTP、canonical、robots、目录锚点与 JSON-LD 解析未见故障；目标 Urban 页同样缺 H1。

### 本页不要改

- 不要把 Hero 海滩替换成泛城市图；它正好能帮助建立双路径比较，建议新增一张真实 Urban 示例形成并排证据。
- 不要暗示生成图记录真实旅行、真实场馆或品牌合作。
- 不要硬编码 24 Photos/22 credits；使用实时产品数据或带日期的核验说明。

## 6. Valentine Photos

URL：<https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide>

**页面类型 / 搜索意图：** Valentine's Day AI 情侣/个人肖像、贺卡和礼物图片指南；用户需要选择单人或情侣输入、浪漫场景、卡片留白、双方同意、相邻订婚/婚礼主题及成片检查。

**本页实际核验：**

- HTTP 200，无跳转；Title、Meta、self-canonical、`index, follow` 正常。
- Title：`Valentines Photo private AI photo guide | myDreamshoots`；Meta：`Create Valentine-ready portraits and romantic card visuals with soft light, date-night energy. Review credit cost, source quality, and private downloads.`
- H1：`Valentines Photo: how to plan this myDreamshoots photo package category`；8 个 H2、3 个 FAQ H3；约 1,111 词。
- Hero CTA 正确到 `/ai-image-generation/valentines-photo`，目标返回 200；目标产品页审计时公开显示 20 Photos/20 credits，并说明可上传 person or couple、可生成 candlelit/floral/studio/outdoor/playful mood，以及 card/gift/social 场景。
- 全站可见英文混用 `Valentines Photo`、`Valentines Day` 和一次标准 `Valentine's Day`。URL/category slug 可用无标点形式，但普通显示文案缺少所有格撇号。
- Hero 是情侣近距离与心形灯光道具；ALT：`Couple keepsake portrait, polished event lighting with muted evening light.`，基本可辨但 `polished event lighting` 仍是模板风格词。
- 8 个目录锚点均命中；Header 97、Article 12、Footer 22；正文继续链接 Headshot 与固定 3 篇相关文章。
- JSON-LD 可解析，URL/headline/date 对应；author 仍将 editorial team 声明为 Person。
- 正文结构和绝大多数句子与前 5 页一致，仅将主题和宽类替换为 `Valentines Photo / Couple`。
- 博客没有固定数字承诺；目标页当前配置与后台实际交付、退款/隐私执行无法仅从公开访问确认。

**结论：重大整改。** 产品实体和 CTA 可用，但本指南没有情侣同意、双人输入、卡片构图或与 Engagement/Wedding 的边界，独立价值不足。

### 可保留

- Meta 中 `romantic card visuals / soft light / date-night energy` 与用户意图一致。
- Hero 情侣图、主题 CTA、200、self-canonical、robots、目录和 Schema 基础。
- 使用获授权清晰源图、预先确定 card/gift/social 用途、在私密相册检查后再分享等原则。

### 需要整改

1. **统一公开英文命名**
   - 原文案：`Valentines Photo private AI photo guide` / `Valentines Photo` / `Valentines Day`
   - 替代文案：普通英文统一为 `Valentine's Day AI Photo Guide`、`Valentine's Day Photos`、`Valentine's Day`。技术 slug `/valentines-photo` 和 category key 可不改。
   - 原因：`Valentines` 在普通英文中缺少所有格撇号；当前产品页内部也不一致。若 `Valentines Photo` 是刻意的注册产品名，应在品牌词表中明确，否则按标准英文修正。
   - 优先级：**P1**

2. **H1/首段仍是 photo package category 模板**
   - 原文案：`Valentines Photo: how to plan this myDreamshoots photo package category`
   - 替代文案：`Valentine's Day AI Photos: Couple Portraits, Cards, and Gifts`
   - 原文案：`Use this myDreamshoots guide to decide when Valentines Photo fits...`
   - 替代文案：`Plan a Valentine's Day portrait for a private gift, date-night card, anniversary note, or social post. Choose whether the image features one person or a couple, prepare approved source photos, and leave the right space for any message you will add later.`
   - 原因：应直接回答季节、人物数量和最终载体，不要让用户理解内部分类体系。
   - 优先级：**P0**

3. **输入建议没有处理双人身份与构图**
   - 原文案：`Prepare clear approved source portraits, then add one cue that belongs to Valentines Photo: light, scene texture, outfit tone, occasion, group size, or card-ready crop...`
   - 替代文案：`For a couple image, use clear, current photos of both people with compatible face angles and natural expressions. Confirm that each person approves the source images and intended use. Then choose one mood—candlelit, floral, studio, outdoor, or playful—and decide whether the final crop needs text space.`
   - 原因：产品页已经公开这些选项；本指南却没有给双人生成最关键的准备方法。
   - 优先级：**P0**

4. **缺少情侣图片的同意和关系表述边界**
   - 原文案：`The strongest valentine photos requests keep the brief and the result aligned.`
   - 替代文案：`Use and share a couple image only when every person shown is comfortable with the source photos, generated pairing, and final audience. Do not use a generated romantic image to imply a relationship, engagement, or endorsement that the other person has not approved.`
   - 原因：目标产品页已有“every person shown is comfortable”提示；本指南应把它升级为可执行的 Trust 规则。
   - 优先级：**P0**

5. **比较表没有区分 Valentine、Engagement 与 Wedding**
   - 原文案：`Category examples: Valentines Photo and Couple`
   - 替代文案：`Valentine's Day — seasonal cards, date-night portraits, romantic gifts, or a warm social post. Engagement — proposal or announcement imagery where ring and message details matter. Wedding — formal couple portraits and ceremony-led keepsakes. Choose the theme that matches the claim the image will make.`
   - 原因：`Couple` 不是当前可点击的清晰选择；相邻真实主题的边界能避免搜索意图和用户承诺混淆。
   - 优先级：**P0**

6. **成片检查遗漏双人/卡片常见错误**
   - 原文案：`Valentines Photo should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy...`
   - 替代文案：`Check both identities, eye direction, close-pose anatomy, overlapping arms and hands, fingers around gifts, jewelry, heart-shaped props, background text, and whether the card crop leaves usable space without covering either face.`
   - 原因：supporter energy 等词来自其他主题；替代清单对应情侣和卡片成片。
   - 优先级：**P0**

7. **Mistakes 段落继续列 fan/game-day/premiere**
   - 原文案：`Avoid asking Valentines Photo to cover several unrelated fan, game-day, premiere, or holiday scenes at once...`
   - 替代文案：`Do not combine a date-night portrait, engagement announcement, wedding keepsake, and generic holiday card in one brief. Pick one relationship context, one mood, and one final crop so the images do not make conflicting claims.`
   - 原因：现有内容不是 Valentine's Day 专属建议，且忽略关系语义。
   - 优先级：**P0**

8. **credits/输出数量应与实时产品数据同源**
   - 原文案：`Before the job starts, review the visible credit cost...`
   - 替代文案：`Review the live Valentine's Day package card for the current output count and credit cost before starting. The guide should not preserve an older number after the package configuration changes.`
   - 原因：审计时目标页显示 20/20，但应从 catalog 动态展示或明确核验日期，不能人工复制后失真。
   - 优先级：**P1**

9. **Hero ALT 可更客观具体**
   - 原文案：`Couple keepsake portrait, polished event lighting with muted evening light.`
   - 替代文案：`Close Valentine's Day portrait of a smiling couple with a glowing red heart decoration.`
   - 原因：替代文案描述可见人物、情绪和主题道具，避免抽象的 polished event lighting。
   - 优先级：**P1**

10. **Headshot/Avatar 内链不支持节日情侣决策**
    - 原文案：`Start with Headshot Photo Package...` 与两条 `Open Avatar theme`
    - 替代文案：`Compare Valentine's Day with Engagement and Wedding based on whether the image is seasonal, announcement-led, or ceremony-led.`；相关文章替换为这些真实相邻指南，并使用准确标题。
    - 原因：应建立 romance/couple topic cluster，而不是所有页面复用 Headshot/Avatar。
    - 优先级：**P1**

11. **作者/审核与 BlogPosting author 类型问题**
    - 原文案：`myDreamshoots editorial team` + `@type: Person`
    - 替代文案：`Written by [full name], [relevant role]. Reviewed against the live Valentine's Day package on [Month Day, Year].`；团队用 Organization，个人用 Person。
    - 原因：产品事实与同意规范需要真实责任人；不得编造。
    - 优先级：**P1**

### 真正 SEO 大问题

- **独立价值不足：** 与前页共享相同 8-H2/3-FAQ、表格和句子，只替换主题与宽类。
- **显示名称不一致：** `Valentines`/`Valentine's` 混用会削弱专业度和实体一致性；URL slug 不必因此改变。
- **相邻意图未区分：** Valentine's Day、Engagement、Wedding 都覆盖情侣图，需要 seasonal / announcement / ceremony 三分法。
- canonical、robots、状态码、目录锚点与本页 Schema 解析未见故障；目标产品页无 H1 的问题继续存在。

### 本页不要改

- 不要删除当前情侣 Hero 或主 CTA；它们与真实产品一致。
- 不要假设上传的人处于真实恋爱/婚姻关系，也不要用生成图制造未经同意的关系声明。
- 不要硬编码 20 Photos/20 credits；应同源呈现当前配置。

## 7. Virtual Try-On

URL：<https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide>

**页面类型 / 搜索意图：** AI 虚拟试衣/穿搭视觉规划工具指南；用户需要准备全身/半身人像与有权使用的服装参考，理解它不是精确尺码或商品保证，并检查服装、身体与品牌伪影。

**本页实际核验：**

- HTTP 200，无跳转；Title、Meta、self-canonical、`index, follow` 正常。
- Title：`Virtual Try-On private AI photo guide | myDreamshoots`；Meta：`Use AI try-on as a visual planning tool for outfits, creator looks, and fashion content directions. Review credit cost, source quality, and private downloads.`
- H1：`Virtual Try-On: how to plan this myDreamshoots photo package category`；8 个 H2、3 个 FAQ H3；约 1,111 词。
- Hero CTA 正确到 `/ai-image-generation/virtual-try-on`；目标返回 200，审计时公开显示 20 Photos/20 credits。
- 目标产品页明确：需要 clear body framing、simple lighting、specific outfit direction；服装参考必须有权使用；结果是 planning visuals，不是 exact garment fit guarantees；不得用结果误导产品、品牌或人物。博客没有这些核心限制。
- Hero 仅是衣架前的单人肖像，没有输入服装与结果的对照，无法展示 try-on 任务；ALT 为 `Beauty portrait with editorial lighting, polished event lighting with high-contrast rim light.`，完全没描述服装/试穿。
- 8 个目录锚点均命中；链接仍为 Header 97、Article 12、Footer 22，正文继续固定导向 Headshot 和 3 篇不相关指南。
- JSON-LD 可解析，URL/headline/date 对应；author 类型问题未变。
- 正文仍与前 6 页共享同一模板，`Virtual Try-On / Beauty` 只是变量；fixed price、真实尺码准确度、材质/颜色还原和后台隐私无法由本文确认。

**结论：重大整改。** Meta 已正确称它为 visual planning tool，但正文把它当 Beauty 主题相册，遗漏影响购买与品牌使用的关键限制。

### 可保留

- Meta 的 `visual planning tool` 定位准确，应保护并在正文首屏强化。
- CTA 与真实产品一致；200、self-canonical、robots、目录锚点和 Schema 基础可保留。
- 清晰源图、获授权素材、生成前查看实时 credit cost 和私密检查后再公开的原则。

### 需要整改

1. **H1/首段必须从“主题包”改为“穿搭规划工具”**
   - 原文案：`Virtual Try-On: how to plan this myDreamshoots photo package category`
   - 替代文案：`AI Virtual Try-On Guide: Plan Outfits Without Treating the Preview as Exact Fit`
   - 原文案：`Use this myDreamshoots guide to decide when Virtual Try-On fits...`
   - 替代文案：`Use Virtual Try-On to compare outfit direction, color, silhouette, and creator styling before shopping, packing, or planning a shoot. Prepare a clearly framed portrait and an approved clothing reference, then review the result as a visual concept—not a promise of exact size, fabric, or fit.`
   - 原因：当前正文没有兑现 Meta 的 planning tool 意图，也没有最重要的预期边界。
   - 优先级：**P0**

2. **输入建议与试衣任务无关**
   - 原文案：`...light, scene texture, outfit tone, occasion, group size, or card-ready crop... fan details, holiday cues, or movement ideas...`
   - 替代文案：`Use a clear front or three-quarter portrait with enough body framing to show the garment area. Prefer simple lighting and an unobstructed pose. Add one clothing reference that you own or have permission to use, and describe one direction such as casual, formal, streetwear, travel, or event styling.`
   - 原因：用户需要身体构图和服装参考，而不是 card/fan/holiday 变量。
   - 优先级：**P0**

3. **没有说明不能用作尺码、材质或购买保证**
   - 原文案：`The strongest virtual try-on requests keep the brief and the result aligned.`
   - 替代文案：`Treat the output as a styling moodboard. It may not reproduce the garment's exact size, cut, fabric weight, texture, transparency, color, pattern placement, or drape. Confirm those details on the seller's product page or with the physical garment before making a purchase decision.`
   - 原因：这是 Virtual Try-On 的高风险 Trust 信息；目标产品页已有较短限制，本指南应展开为可执行说明。
   - 优先级：**P0**

4. **比较表错误地把 Virtual Try-On 归为 Beauty**
   - 原文案：`Category examples: Virtual Try-On and Beauty`
   - 替代文案：`Virtual Try-On — compare wardrobe ideas on a person. Street Style — create a complete fashion scene when the setting matters as much as the clothing. Portrait Retouch — refine an existing portrait without replacing the outfit. Hairstyle Generator — compare hair direction rather than wardrobe.`
   - 原因：Beauty 过宽且不解释任务边界；相邻真实工具应按“改变什么”比较，并由产品负责人确认能力。
   - 优先级：**P0**

5. **成片检查没有服装和身体伪影**
   - 原文案：`Virtual Try-On should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy...`
   - 替代文案：`Check neckline, shoulders, sleeves, cuffs, waist, hem, closures, pattern continuity, logos, jewelry overlap, fingers, hair over fabric, body shape, pose, shadows, and whether the outfit changes the person's identity or proportions.`
   - 原因：原文来自主题模板；替代清单直接对应试衣失败点。
   - 优先级：**P0**

6. **品牌/商品误导边界缺失**
   - 原文案：`Avoid asking Virtual Try-On to cover several unrelated fan, game-day, premiere, or holiday scenes at once...`
   - 替代文案：`Do not present a generated try-on as an exact image of a retailer's product, a verified brand collaboration, or proof of how a garment will fit. Avoid protected logos and branded garments unless you have permission, and disclose material AI changes where the publishing context requires it.`
   - 原因：目标产品页已有同类 usage note；博客遗漏会放大购买和品牌风险。
   - 优先级：**P0**

7. **Hero 不能证明 try-on 任务，ALT 也只写 Beauty portrait**
   - 原文案：当前单张衣架前肖像；ALT `Beauty portrait with editorial lighting, polished event lighting with high-contrast rim light.`
   - 替代方案：使用真实工作流的三联图：`person source / approved garment reference / generated try-on result`，并标记 `AI-generated preview`。
   - 替代 ALT：`Virtual try-on example showing a source portrait, clothing reference, and AI-generated outfit preview.`
   - 原因：一张普通肖像无法支持 first-hand/product evidence；ALT 与页面任务不符。
   - 优先级：**P0**

8. **FAQ 应回答购买前关键问题**
   - 原文案：`Is Virtual Try-On good for a first request?` / `How many source photos should I prepare?`
   - 替代文案：`Does Virtual Try-On show exact garment fit?` / `What person photo and garment reference work best?` / `Can I use a retailer's product image?`
   - 替代回答示例：`No. The result is a visual planning image, not a measurement or fit guarantee. Check the retailer's size chart, materials, product photos, and return policy before purchasing.`
   - 原因：当前 FAQ 不回应用户最可能误解的能力边界。
   - 优先级：**P0**

9. **credits/输出数量应实时同源**
   - 原文案：`Before the job starts, review the visible credit cost...`
   - 替代文案：`Review the live Virtual Try-On package card for the current output count and credit cost before starting. Keep those values synchronized with the catalog rather than copying them into the article.`
   - 原因：目标页审计时显示 20/20，但不能假定长期不变。
   - 优先级：**P1**

10. **正文内链与作者问题继续存在**
    - 原文案：`Start with Headshot Photo Package...`、两条 `Open Avatar theme`、`myDreamshoots editorial team` + Person Schema。
    - 替代文案：产品内链改为 `Compare Virtual Try-On with Street Style, Portrait Retouch, and Hairstyle Generator based on what you need to change.`；相关文章使用准确标题；署名使用真实产品/造型审核人，团队在 Schema 中用 Organization。
    - 原因：建立 fashion/tools 集群并让产品边界可追溯；不得编造审核身份。
    - 优先级：**P1**

### 真正 SEO 大问题

- **工具意图被主题模板覆盖：** Meta 说 planning tool，正文却围绕 generic Beauty album、credits 和 mood。
- **关键限制缺失：** 没有 exact fit/size/fabric/product limitation，降低页面可信度并可能误导购买。
- **缺少真实工作流证据：** Hero 不是 try-on 前后/参考对照；正文也无具体示例。
- **与前页 near-duplicate、内部链接错误、author 类型不匹配。** 本页 HTTP、canonical、robots、目录锚点和 Schema 解析本身正常；目标产品页仍缺 H1。

### 本页不要改

- 不要宣称精确尺码、面料、垂坠、颜色、库存或购买结果；这些均无法由公开页面确认。
- 不要添加服装品牌/零售商 logo 示例，除非有明确使用许可。
- 不要删除 Meta 中的 `visual planning tool`，这是当前最准确的页面定位。

## 8. Wedding Portraits

URL：<https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide>

**页面类型 / 搜索意图：** AI wedding-inspired couple portrait、save-the-date 概念图、仪式 moodboard、网站/邀请函视觉和私人纪念图指南；不是婚礼纪实摄影替代品。

**本页实际核验：**

- HTTP 200，无跳转；Title、Meta、self-canonical、`index, follow` 正常。
- Title：`Wedding Photo private AI photo guide | myDreamshoots`；Meta：`Build wedding-inspired portraits for planning, keepsakes, announcements, and couple albums. Review credit cost, source quality, and private downloads.`
- H1：`Wedding Photo: how to plan this myDreamshoots photo package category`；8 个 H2、3 个 FAQ H3；约 1,117 词。
- Hero CTA 正确到 `/ai-image-generation/wedding-photo`；目标返回 200，审计时公开显示 24 Photos/24 credits。
- 目标页明确用途包括 save-the-date concepts、ceremony moodboards、invitation visuals、wedding website headers、couple keepsakes；同时要求双方清晰近期照片，并提示不要把结果当真实婚礼记录、名字/日期/场地文字应后置到设计工具、文化/仪式细节需仔细检查。博客均未覆盖。
- Hero 是婚纱/礼服情侣近景；ALT `Couple keepsake portrait, open group framing with balanced front light.` 中 `open group framing` 与两人近景不符。
- 8 个目录锚点均命中；Header 97、Article 12、Footer 22；正文仍固定导向 Headshot 与 3 篇不相关指南。
- JSON-LD 可解析，URL/headline/date 对应；author 类型问题相同。
- 正文出现 `Wedding Photo, wedding Portraits, and wedding` 三次同义复读，并继续含 fan/game-day/premiere 等其他主题变量；与前 7 页同模板。
- 博客未写固定数字；公开页面无法验证结果质量、实际关系/仪式、后台隐私和未来配置。

**结论：重大整改。** Meta 与真实产品意图一致，但正文没有任何 wedding-specific planning、同意、文字处理、仪式真实性或双人成片检查。

### 可保留

- URL、Title/Meta 的 `wedding-inspired / planning / keepsakes / announcements` 方向和真实产品 CTA。
- 当前婚礼情侣 Hero、200、self-canonical、robots、目录锚点与 Schema 基础。
- 使用获授权照片、生成前看实时 credits、私密检查后再分享的原则。

### 需要整改

1. **H1/首段应明确是概念图与纪念图，不是真实婚礼记录**
   - 原文案：`Wedding Photo: how to plan this myDreamshoots photo package category`
   - 替代文案：`AI Wedding Portraits: Plan Save-the-Dates, Moodboards, and Keepsakes`
   - 原文案：`Use this myDreamshoots guide to decide when Wedding Photo fits...`
   - 替代文案：`Use Wedding Photo for save-the-date concepts, ceremony moodboards, invitation-friendly portraits, wedding website visuals, or private keepsakes. Prepare approved photos of both people, choose one ceremony direction, and treat every result as wedding-inspired creative imagery rather than proof of a real event.`
   - 原因：当前首屏没有说明最关键的用途与真实性边界。
   - 优先级：**P0**

2. **适用段落是同义关键词堆叠**
   - 原文案：`Use Wedding Photo when Wedding Photo, wedding Portraits, and wedding are the nearest match...`
   - 替代文案：`Choose Wedding Photo when formal couple styling, ceremony atmosphere, floral details, or card-ready framing is central to the image. Choose Engagement for a proposal or ring-led announcement, and Valentine's Day for a seasonal romantic card without ceremony claims.`
   - 原因：原文三次复读没有决策信息；替代内容建立与 URL 6 和 Engagement 产品的意图边界。
   - 优先级：**P0**

3. **双人源照片与仪式方向准备缺失**
   - 原文案：`Prepare clear approved source portraits, then add one cue that belongs to Wedding Photo: light, scene texture, outfit tone, occasion, group size, or card-ready crop...`
   - 替代文案：`Use recent, clear portraits of both people with similar lighting and useful face angles. Confirm that each person approves the source images and intended use. Then choose one direction: ceremony, formal studio, outdoor romance, or card-ready portrait, plus only the cultural, floral, wardrobe, and jewelry details that you can review accurately.`
   - 原因：当前输入段落含 fan/holiday/movement，无法指导 wedding couple generation。
   - 优先级：**P0**

4. **没有处理名字、日期、场地和生成文字**
   - 原文案：页面仅泛称 `card-ready crop`。
   - 替代文案：`Leave names, dates, venue details, and invitation copy out of the generated scene. Add verified text later in a design tool, where spelling, hierarchy, and date accuracy can be controlled.`
   - 原因：产品页已有明确提示；AI 图内文字可能错误，婚礼信息又具有真实承诺性质。
   - 优先级：**P0**

5. **比较表没有区分婚礼相邻用途**
   - 原文案：`Category examples: Wedding Photo, wedding Portraits, and wedding`
   - 替代文案：`Wedding Photo — ceremony-led concepts, formal couple portraits, save-the-dates, and wedding keepsakes. Engagement Photo — proposal, ring, and announcement-led imagery. Valentine's Day — seasonal romantic cards, date-night portraits, and gifts. Use the theme whose relationship claim matches the final publication.`
   - 原因：当前三项实为同一个关键词；应比较真实主题并避免关系声明混淆。
   - 优先级：**P0**

6. **真实性、同意与文化细节边界缺失**
   - 原文案：`Wedding Photo should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy...`
   - 替代文案：`Use generated wedding images as concepts or keepsakes, not as proof that a ceremony, venue booking, marriage, or cultural rite occurred. Share couple images only with both people's approval, and have knowledgeable participants review attire, symbols, rituals, and ceremonial details before publication.`
   - 原因：这是 wedding-inspired 图像最重要的 Trust 信息；supporter energy 明显来自其他主题。
   - 优先级：**P0**

7. **成片检查与 Mistakes 仍是通用模板**
   - 原文案：`Avoid asking Wedding Photo to cover several unrelated fan, game-day, premiere, or holiday scenes at once...`
   - 替代文案：`Review both faces, eye direction, overlapping hands and arms, rings and jewelry, bouquet stems, veil and hair edges, suit and dress fabric, floral repetition, ceremony objects, background guests, and text-safe spacing for the final card or website crop.`
   - 原因：替代清单直接对应双人婚礼图，而不是无关活动。
   - 优先级：**P0**

8. **Hero ALT 把情侣近景写成 open group framing**
   - 原文案：`Couple keepsake portrait, open group framing with balanced front light.`
   - 替代文案：`Close wedding portrait of a couple in formal attire with veil, bouquet, and soft daylight.`
   - 原因：图像是双人近景，不是开放式群像。
   - 优先级：**P1**

9. **credits/输出数量和内链需要实时/主题化**
   - 原文案：泛化的 `review the visible credit cost`；`Start with Headshot Photo Package`；两条 `Open Avatar theme`。
   - 替代文案：credits/outputs 从 live Wedding Photo catalog 同源展示；内链改为 `Compare Wedding Photo with Engagement and Valentine's Day based on the claim and final format.`，相关文章使用对应真实标题。
   - 原因：审计时目标页为 24/24，但不能长期硬编码；Headshot/Avatar 不是婚礼意图集群。
   - 优先级：**P1**

10. **作者/审核与 BlogPosting author 类型问题**
    - 原文案：`myDreamshoots editorial team` + `@type: Person`
    - 替代文案：`Written by [full name], [relevant role]. Reviewed against the live Wedding Photo package and usage guidance on [Month Day, Year].`；团队在 Schema 中用 Organization。
    - 原因：关系、仪式和产品事实需要可追溯责任人；不得虚构专业背景。
    - 优先级：**P1**

### 真正 SEO 大问题

- **同义关键词堆叠与模板重复：** `Wedding Photo, wedding Portraits, and wedding` 不能构成独立内容，且正文保留其他主题变量。
- **搜索意图/Trust 缺口：** 未说明 save-the-date/moodboard/website/keepsake 工作流，也未区分生成概念图与真实婚礼记录。
- **相邻意图内耗：** Wedding、Engagement、Valentine's Day 必须分别对应 ceremony / announcement / seasonal romance。
- 本页 HTTP、canonical、robots、目录锚点和 Schema 解析正常；目标 Wedding 产品页仍没有 H1。

### 本页不要改

- 不要把生成图描述成真实仪式纪实、场地预订证明或婚姻证明。
- 不要在生成图中依赖姓名、日期和场地文字；保留后置设计建议。
- 不要硬编码 24 Photos/24 credits；与实时 catalog 同源。

## 9. World Cup Fan Photos / Soccer

URL：<https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide>

**页面类型 / 搜索意图：** 通用 soccer fan portrait、match-day poster、supporter avatar/banner 与私人球迷相册指南；避免官方赛事、球队、球员或品牌关联。

**本页实际核验：**

- HTTP 200，无跳转；self-canonical 指向含 `world-cup` 的当前 URL；`index, follow` 正常。
- URL/图片目录仍使用 `world-cup-fan-photos`，但 Title 已是 `Soccer private AI photo guide | myDreamshoots`，H1 是 `Soccer: how to plan this myDreamshoots photo package category`，Breadcrumb/BlogPosting 也使用 Soccer；实体信号不一致。
- Meta：`Create personal fan portraits, match-day posters, and profile avatars from your own selfies. Review credit cost, source quality, and private downloads.`；方向准确但没有品牌/官方关联限制。
- 8 个 H2、3 个 FAQ H3；约 1,077 词；Hero CTA `Open Soccer theme` 正确到 `/ai-image-generation/soccer`。
- Soccer 目标页返回 200，审计时公开显示 24 Photos/26 credits，并明确：使用 generic colors，不依赖 official team crests/tournament marks；避免 player/celebrity likenesses 与 protected logos；个人球迷使用以外需要相应权利；下载前检查 implied affiliation。
- FIFA 官方 Brand Protection 页面说明，其与赛事有关的 logos、words、titles、symbols 等 IP 在全球受版权、商标和其他相关法律保护，并提供 2026 赛事 IP 指引。这里只能确认存在权利风险，不能替代针对具体国家/使用方式的法律意见。[FIFA Brand Protection](https://www.inside.fifa.com/tournament-organisation/brand-protection)
- Hero 是国家颜色球迷服装、脸部彩绘和体育场氛围；ALT `Supporter portrait for a fan album, clean vertical framing with directional window light.` 中 `directional window light` 与体育场/庆祝场景不符。
- 8 个目录锚点均命中；链接仍为 Header 97、Article 12、Footer 22；正文固定导向 Headshot 与同样 3 篇相关文章。
- JSON-LD 可解析；URL/headline/date 对应当前混合命名，author 类型问题相同。
- 正文与前 8 页同模板，仅使用 Soccer/Sports 变量；本页反而出现适合本主题的 `fan / game-day` 词，但没有商标、球员肖像、虚构官方关联等关键内容。

**结论：重大整改。** 建议保留 Soccer 产品实体，重写为品牌安全的通用球迷创作指南；`world-cup` URL 是否继续使用必须经过法律/品牌审核，不能靠页面内 disclaimer 自动消除风险。

### 可保留

- Title/H1/CTA 使用通用 Soccer 而非官方赛事名的方向；Meta 中 `personal fan portraits / match-day posters / profile avatars` 具体。
- Hero 的球迷庆祝氛围、真实 Soccer 产品 CTA、200、robots、目录和 Schema 基础。
- 使用自有/获授权自拍、下载前检查人物与背景、私密相册中先审后发的原则。

### 需要整改

1. **统一 URL、Title、H1、图片目录和实体命名，并先做法律审核**
   - 原文案：URL `/blog/world-cup-fan-photos-photo-package-guide`，Title/H1/Product 却是 Soccer。
   - 替代方案：公开页面统一为 `Soccer Fan Photo Guide`；若法律/品牌审核不批准使用 `world-cup`，建立 `/blog/soccer-fan-photo-guide` 并从旧 URL 做单跳 301，更新 canonical、Breadcrumb、BlogPosting、站内链接与 sitemap。不要让两个 URL 同时 200。
   - 原因：当前 URL 暗示具体赛事，正文实体却是通用 Soccer；同时存在官方赛事知识产权与误认关联风险。是否构成侵权需专业法律意见。
   - 优先级：**P0**

2. **H1/首段仍是分类模板，没有品牌安全定位**
   - 原文案：`Soccer: how to plan this myDreamshoots photo package category`
   - 替代文案：`AI Soccer Fan Photos: Match-Day Posters Without Official Marks`
   - 原文案：`Use this myDreamshoots guide to decide when Soccer fits...`
   - 替代文案：`Create a personal soccer supporter portrait, match-day poster, profile avatar, social banner, or watch-party image from approved photos. Plan the crop and fan mood without using official tournament marks, team crests, player likenesses, or language that implies an official partnership.`
   - 原因：替代文案同时满足用户任务与 Trust/品牌边界。
   - 优先级：**P0**

3. **适用/输入段落只写 Soccer and Sports**
   - 原文案：`Use Soccer when Soccer and Sports are the nearest match...`
   - 替代文案：`Choose Soccer for personal fan creativity: stadium mood, supporter portraits, posters, square avatars, wide banners, or watch-party scenes. Upload personal portraits or group references that you have permission to use, then choose one format and one generic color direction.`
   - 原因：Sports 是内部宽类，不能指导具体产物和素材权限。
   - 优先级：**P0**

4. **没有官方标志、球员肖像和 implied affiliation 边界**
   - 原文案：页面只泛称 `fan details` 和 `supporter energy`。
   - 替代文案：`Use generic supporter colors and invented stadium details. Do not include official competition names or marks, team crests, sponsor logos, player or celebrity likenesses, trophy designs, tickets, or branded venue assets unless you hold the required rights. Do not describe the output as official, licensed, sponsored, or affiliated.`
   - 原因：这是产品页与 FIFA 官方证据共同支持的核心风险控制；具体权利判断仍须法律审核。
   - 优先级：**P0**

5. **“nearby choices”表不需要强行比较不存在的 Sports 类**
   - 原文案：`Category examples: Soccer and Sports`
   - 替代文案：改成输出格式决策：`Profile avatar — square, face-led, minimal background. Match-day poster — vertical, dramatic lighting, text added later. Social banner — wide, subject placed away from interface overlays. Supporter group — only approved people, with extra attention to faces and hands.`
   - 原因：本页只有一个真实 Soccer 产品；最有用的独立价值是帮助选择格式，而不是虚构相邻包。
   - 优先级：**P0**

6. **成片检查遗漏球衣、标志、文字和体育场伪影**
   - 原文案：`Soccer should be recognizable through visible details such as color, posture, card framing, scene texture, seasonal cues, supporter energy...`
   - 替代文案：`Check every face and hand, jersey numbers and names, stripes and seams, flags, face paint, balls, goal lines, crowd repetition, stadium geometry, signs, sponsor-like marks, and any detail that could imply a real team, player, tournament, or venue.`
   - 原因：原文只描述情绪，没有可执行的品牌/质量审查。
   - 优先级：**P0**

7. **文字应后置到设计工具**
   - 原文案：Meta 提到 `match-day posters`，正文没有文字处理说明。
   - 替代文案：`Generate a clean poster image first. Add verified match names, dates, scores, and other copy later in a design tool; do not rely on generated text, and do not use protected event branding without permission.`
   - 原因：体育海报中的日期/比分/赛事名具有事实与权利风险，AI 图内文字也不可靠。
   - 优先级：**P0**

8. **Hero ALT 错写 window light**
   - 原文案：`Supporter portrait for a fan album, clean vertical framing with directional window light.`
   - 替代文案：`Excited soccer supporter in generic blue, white, and red fan colors with a stadium crowd behind her.`
   - 原因：可见环境是比赛/庆祝氛围，不是室内窗光；`generic` 也帮助说明无官方标志的设计意图。
   - 优先级：**P1**

9. **credits、内链和作者应与真实 Soccer 集群一致**
   - 原文案：泛化 credit 说明；`Start with Headshot Photo Package`；两条 `Open Avatar theme`；editorial team 被建模为 Person。
   - 替代文案：credits/outputs 从 Soccer catalog 同源；内链改为 Soccer 产品、品牌安全/肖像许可说明、poster/avatar 格式指南；相关文章使用准确标题；真实团队在 Schema 中用 Organization。
   - 原因：审计时目标页为 24 outputs/26 credits，但不能硬编码；现有链接与作者结构不能建立本主题信任。
   - 优先级：**P1**

### 真正 SEO 大问题

- **URL 与页面实体冲突：** URL/canonical 是 world-cup，Title/H1/Product 是 Soccer；需要品牌/法律决策后统一，必要时 301 迁移。
- **品牌安全内容缺失：** 目标产品已有官方 marks、logos、likenesses 和 affiliation 限制，博客没有；FIFA 官方也明确保护与赛事相关的文字、标题、标志等 IP。
- **near-duplicate：** 正文继续使用全组模板，没有形成 Soccer fan guide 的独立价值。
- **内链集群错误、author 类型不匹配。** 本页 HTTP、robots、目录锚点和 JSON-LD 解析未见技术故障；目标 Soccer 产品页没有 H1。

### 本页不要改

- 不要添加 FIFA、World Cup、球队、球员、奖杯、赞助商或场馆标志来“增强相关性”。
- 不要把通用球迷图描述为官方、授权、合作或真实比赛记录。
- 不要硬编码 24 Photos/26 credits；同源展示当前配置。
- 不要仅把 canonical 改到一个新 URL 而保留旧 URL 200；若迁移，应使用单跳 301 并同步全部信号。

## 跨页总审计

### 9 页的实体与处理决策

| # | Blog 实体 | CTA 实际目标 | 一致性 | 建议索引决策 | 优先级 |
|---:|---|---|---|---|---|
| 1 | Cyberpunk | `/ai-image-generation/cyberpunk` | 一致 | 保留 URL/self-canonical，全文重写为 Cyberpunk 专属指南 | P0 |
| 2 | Mafia | `/ai-image-generation/mafia` | 一致 | 保留 URL/self-canonical，全文重写为虚构 noir/mafia 风格指南 | P0 |
| 3 | Magic Upscaler | `/ai-image-generation/photo-enhancer` | **不一致** | 先确定 Magic Upscaler 是否是正式别名；若不是，改用 Photo Enhancer 命名 URL 并从旧 Blog 单跳 301 | P0 |
| 4 | Nature | `/ai-image-generation/travel` | **不一致** | 仅在能写成独立的自然场景/Travel 使用指南时保留；否则合并到 Travel 指南并 301 | P0 |
| 5 | Outdoor Creator Scenes | `/ai-image-generation/urban` | **部分不一致** | 推荐改为 Urban vs Travel 的 creator scene 决策指南；做不到则合并到最匹配页面并 301 | P0 |
| 6 | Valentines Photo | `/ai-image-generation/valentines-photo` | 实体一致，英文命名不统一 | 保留 URL；可见英文统一为 `Valentine's Day`，旧 slug 可不动 | P0 |
| 7 | Virtual Try-On | `/ai-image-generation/virtual-try-on` | 一致 | 保留 URL；重写为规划可视化而非精确合身保证的工具指南 | P0 |
| 8 | Wedding Photo | `/ai-image-generation/wedding-photo` | 一致 | 保留 URL；重写为概念图/moodboard/announcement，而非真实婚礼纪实 | P0 |
| 9 | Soccer，当前 URL 含 World Cup | `/ai-image-generation/soccer` | **URL 与实体不一致** | 品牌/法律审核后，默认迁移到通用 Soccer Fan Guide URL，旧 URL 单跳 301 | P0 |

上述是基于公开页面的默认建议。正式执行 301 前，必须导出旧 URL 的查询、点击、外链、收入/CTA 转化和历史索引数据；若数据证明旧词有真实价值，应由 SEO、品牌与法律共同决定命名和迁移方式。不能为了“去重”盲删有价值 URL。

### 跨页重复与蚕食风险

- 9 页都是 8 个 H2、3 个 FAQ H3、37 个有序正文块，正文约 1,077–1,145 词；结构本身可以复用，但目前主要段落也只是主题词与大类词替换。
- 归一化后的 36 对正文 5 词组相似度平均为 0.9819。Mafia、Magic Upscaler、Nature、Outdoor Creator Scenes、Valentines Photo、Virtual Try-On、Soccer 多组比较达到 1.0000；Cyberpunk 仅因少量额外主题词略低，Wedding 因同义词堆叠略低。
- 所有页面都出现跨主题变量：`fan`、`game-day`、`holiday`、`card`、`motion` 等。相同词在 Soccer 中可能合理，但在 Cyberpunk、Magic Upscaler、Wedding 等页暴露了模板泄漏。
- 固定 H2/FAQ、固定 Headshot 起点、固定 AI Video Add-ons + 两条 Avatar 相关文章，使 9 页形成不了独立主题集群。
- Google 官方标准关注原创信息、实质增量、第一手经验与用户是否解决目标；没有偏好的固定字数，E-E-A-T 也不是一个单一排名因子。[People-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)
- self-canonical 不是薄内容或不同意图冲突的修复。保留的页面应有独立价值；实质同一问题且淘汰的页面才通过 301 合并信号。[Canonicalization](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

### 全部链接审计结论

- 9 页共 1,179 次 `<a href>`，138 个精确 href，去除 fragment 后 73 个 HTTP(S) 目标；73/73 返回 200。9 次 `mailto:` 语法有效但没有发送邮件测试。
- 72 个同页 fragment 全部命中现有 ID。唯一跨流程 fragment `/app/create#step-video` 未登录时到 `login?next=/app/create#step-video` 的实际表现是 fragment 留在 login 页面，而 `next` 参数只保留 `/app/create`；登录后是否回到 video step 无法从公开访问确认。
- 38 个 `/ai-image-generation/*` 产品目标页都没有 H1，首个可见标题是 H2。整改目标是给用户和搜索系统一个明确的主视觉标题，不是机械追求“恰好一个 H1”；Google 没有一页只能一个 H1 的硬规则。
- 16 个正常站内 Footer 目标被加了 `nofollow`，包括 Image Generation、Blog、Pricing、About、Contact、Refund、Privacy、Terms 等。应移除正常站内导航的 `nofollow`；外部社交链接可保留 `nofollow noopener noreferrer`。
- `/ai-video-generation` 的 Title/锚文本是 AI Video Generation，但 H1 是 `Paid AI photo tools for better source images`；必须修正页面主意图。
- `/blog/profile-cards-photo-package-guide` 与 Anime Avatar 页面都返回 200，但 Profile Cards 的 Title/H1/正文仍是 Avatar。应独立重写或 301 合并，不能维持两个 self-canonical 的近重复目标。
- 两个不同目标都使用 `Open Avatar theme`，9 页又都固定链接同一组三篇文章。锚文本应准确描述目标，相关文章应按主题动态选择。[Google link best practices](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)

### 全站 Trust 与事实口径

1. About 写 `100% money-back guarantee` 和 `If the shoot doesn't look like you, refund.`；Refund Policy 实际要求 review、30 天窗口、账户历史与任务细节，补救可能是 refund、returned credits 或 rerun。建议统一为：

   `If a completed shoot does not resemble you, submit the affected job for review under our Refund Policy. Eligible requests may receive a refund, returned credits, or a rerun.`

2. Footer 社交锚文本称 `for myDreamshoots`，目标公开品牌却是 BLYDEY INC/BLYDEYUS/blydey；About、Contact、Privacy、Refunds、Terms 没有解释关系。若 BLYDEY 是真实运营主体，应以真实法定全名披露：

   `myDreamshoots is operated by [full legal entity name], doing business as myDreamshoots.`

   占位符不能直接发布，必须由公司/法律确认真实主体。

3. `No AI training`、`30-day auto-delete`、`AES-256`、`TLS 256-bit` 是公开承诺，公开页面无法独立验证后台、日志、供应商或删除执行。应由工程、安全与法律提供架构/供应商/留存证据后保持；无法证实时应把绝对表述改成与真实流程一致的准确措辞。

4. `myDreamshoots editorial team` 被 BlogPosting 标为 `Person`。有真实署名作者时使用 `Person` 并链接作者页；确为团队时使用 `Organization`，并让 Schema 与可见署名一致。结构化数据必须代表可见主内容，且不保证富结果。[Article structured data](https://developers.google.com/search/docs/appearance/structured-data/article)

5. 可见 FAQ 可作为用户内容保留，但不要把新增 `FAQPage` 当作 Google 富结果收益。Google 已于 2026 年 6 月移除 FAQ 富结果文档和功能说明。[Google Search documentation updates](https://developers.google.com/search/updates#removing-faq-rich-result)

## 整体整改方案

### 阶段 A：立即止损（0–3 个工作日，P0）

| 动作 | 负责人建议 | 可验收产物 |
|---|---|---|
| 暂停用当前主题替换模板继续发布 Blog | 内容/SEO | 发布队列停止新增同模板页面，已有页面清单冻结 |
| 建立 9 页 `Blog entity → Product entity → CTA URL` 真值表 | 产品 + SEO | 每个页面只有一个主实体；3 个错配有书面保留/迁移决定 |
| 决定 World Cup/Soccer 命名和迁移 | 品牌 + 法律 + SEO | 通用命名、允许使用的词/图形清单、301 与 canonical 方案 |
| 对齐 About 与 Refund 文案 | 客服 + 法律 + 内容 | 两页条件、窗口、补救方式完全一致，无绝对化承诺冲突 |
| 确认 myDreamshoots 与 BLYDEY/BLYDEYUS 关系 | 公司/法律 | Contact/About/Terms/Footer 使用同一真实运营主体 |
| 修正 Profile Cards 与 AI Video 目标页 | 产品 + 内容 | Profile Cards 独立内容或 301；AI Video 主标题和正文同一意图 |

不要在此阶段批量改 canonical 或 noindex。9 个页面当前都可访问、可索引；若要合并，先完成数据核对和目标页内容，再做单跳 301。`robots.txt`、URL Removal 或 `noindex` 都不是 canonical 替代品。

### 阶段 B：逐页重写（4–14 个工作日，P0）

建议按风险与转化意图排序：Virtual Try-On → Wedding → Soccer → Magic Upscaler/Photo Enhancer → Valentine's Day → Nature/Outdoor → Cyberpunk → Mafia。每页不再沿用“只替换主题词”的 37 块正文，而是至少具备以下独立模块：

- 用户要完成的具体任务与不适用场景；
- 与真实产品一致的输入、输出、实时 credits/结果数量来源；
- 2–4 个主题专属用例或第一方演示，说明测试条件；
- 与真正相邻产品的决策差异，不使用虚构大类；
- 主题专属检查清单、失败模式和限制；
- 肖像、商标、授权、真实事件/商品等适用边界；
- 3 个真正相关且锚文本准确的下一步链接；
- 可追溯作者/审核责任、实质更新日期与匹配的 BlogPosting。

共享原则可以存在，但不能逐字铺满 9 页。每页的主价值段落必须由产品实测、真实示例、创作过程或经确认的限制支撑；没有证据时写清限制，不得制造“亲测”或效果保证。

### 阶段 C：模板与链接系统修复（第 2–3 周，P1）

把内容数据模型从 `topic + category` 扩展为至少这些受控字段：

```text
entityName, productSlug, userIntent, suitableUses, unsuitableUses,
inputRequirements, outputFormats, verifiedLimitations, comparisonTargets,
reviewChecklist, rightsWarnings, liveCatalogFacts, relatedGuides,
authorOrReviewOwner, evidenceDate
```

发布门禁应检查：CTA 目标实体一致、Title/H1/Meta 同意图、无其他主题变量泄漏、产品数字同源、比较对象真实存在、限制与权利提示齐全、作者可追溯、三个相关文章各不相同且相关。相似度只作为人工复核预警，不作为 Google 排名阈值；建议任何两页实质正文相似度异常高时阻止自动发布并要求编辑说明。

链接/模板层同时完成：

- 给 38 个产品页增加明确的主视觉标题并校验 Title/Meta/CTA；
- 移除 16 个正常站内 Footer 链接的 `nofollow`；
- 保留外部社交安全属性，同时公开品牌/运营主体关系；
- 让 `/app/create#step-video` 的 fragment 或等价状态写入 `next`，补登录前后端到端测试；
- 将相关文章从固定三条改成主题标签 + 编辑白名单选择；
- 修正图片 ALT，只描述实际可见内容，不拼接 `directional window light` 等模板词；
- 从 catalog/API 同源显示 credits 和 outputs，不在文章手写易漂移数字。

### 阶段 D：上线验证与观察（发布当日、+7、+28、+56 天）

发布前逐 URL 验收：

1. 保留页返回 200/self-canonical/可索引；迁移页单跳 301 到唯一 200 目标，旧 URL 不再同时输出 self-canonical 内容。
2. Title、主视觉标题、Meta、Breadcrumb、BlogPosting、Hero CTA 使用同一实体；Title 独特、描述性、简洁，不以固定字符数作为硬门槛。[Title links](https://developers.google.com/search/docs/appearance/title-link)
3. 每个目录链接命中 ID；所有内部/外部目标重新跑状态、最终 URL、锚文本与目标语义检查。
4. JSON-LD 可解析且与页面可见作者、日期、headline、image、canonical 一致；不要承诺 Article 或 FAQ 富结果。
5. 桌面与移动端检查首屏、菜单、表格、CTA、图片裁切、ALT、键盘焦点和文字溢出；本次证据只做了 1440×1000 桌面抓取，移动端需在实施 QA 补测。
6. 由产品确认实时 catalog facts；由安全/法律确认隐私、删除、训练、加密、退款、商标与肖像文案。
7. Search Console 提交更新 URL/重定向，检查 Google 选择的 canonical、索引、查询与抓取；记录发布前基线，+28/+56 天比较 impressions、clicks、CTR、目标查询覆盖和 CTA 点击。无基线时不要宣称整改带来排名提升。

### 完成定义

- 9 页都有明确的保留、改名或合并决定，且不再存在 Blog/Product 实体错配。
- 9 页核心正文不再由同一批段落做主题词替换；每页具备可核验的主题专属信息和限制。
- 73 个当前网络目标及新增目标都可达，语义错链、固定相关文章、内部 nofollow、登录后 video step 问题完成复测。
- Refund/Guarantee、运营主体、社交品牌、数据处理/加密承诺形成一套经责任人确认的统一事实口径。
- 保留页的 Title/主标题/Meta/CTA/Schema 一致；合并页采用单跳 301，canonical、Breadcrumb、Sitemap 和站内链接同步更新。
- 有上线前基线和 +7/+28/+56 天观察记录；只报告实际数据，不保证排名或富结果。

## 证据文件

- `page-evidence.json`：9 页原始页面、正文、图片、CTA、链接和 JSON-LD 证据。
- `screenshots/`：9 页 1440×1000 全页截图。
- `link-evidence.json`：全部链接出现关系、HTTP/跳转、锚点、目标页面标题和主标题证据。
- `GPT10-link-audit.md`：73 个网络目标、72 个页内锚点和 mailto 的逐项人类可读评估。
- `similarity-analysis.json` / `GPT10-similarity-analysis.md`：36 对正文的可复跑相似度证据。
- `supporting-evidence.md`：Google Search Central 官方标准与访问记录。

原始抓取发生于 2026-08-17，报告整理完成于 2026-08-18（Asia/Shanghai）。网站内容可能随后变化；执行前应对准备修改的 URL 做一次短复核。
