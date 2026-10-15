# Aidreamcapes AIVideosUGC 前后端功能与竞品差距审计

- 日期：2026-10-14
- 状态：代码与仓库文案审计，并于 2026-10-14 补充 mock 回归及一次公开商品页抓取；不代表生产页面、生产数据库或供应商已完成运行验收
- 范围：Aidreamcapes AIVideosUGC 私有工作台、相关后端 API/渲染代码、仓库内 Aidreamcapes 视频营销文案，以及 Creatify、Arcads 官方公开功能资料
- 站点隔离：只审阅 `site_aidreamcapes`。没有修改 MyDreamShoots 或公共站点内容。
- 配套计划：`docs/plans/aidreamcapes-aivideosugc-latest-remediation-plan-2026-10-14.md`

## 1. 核心结论

工作台已经具备任务、分镜、镜头版本、角色卡、图片生成、音乐上传、字幕合成等代码路径，但仍有关键运行链路缺口；“代码存在”不能当作“客户可以完整使用”。本轮未连接生产数据库、调用真实供应商或浏览器验收。

首要发现：

1. **下载路由已补齐，生产媒体存储仍待验证。** `tasks/{taskId}/output/route.ts` 已实现视频、字幕及镜头片段读取；此前记录的 mock 任务闭环覆盖 MP4/SRT 下载和 Library 回读。当前未启动本工作区应用或生产数据库，因此 worker/web 间文件持久性与生产读回仍不能仅凭 mock 通过结论。
2. **URL 导入不是完整 URL-to-Video。** 安全抓取可预览标题、价格候选和图片来源，用户确认前保留未确认状态；导入 helper 可处理商品标题与一张主图，但不自动创建视频任务/脚本/分镜，也不抽取评价或完整图库。本轮用 BAGGU 公共商品页验证解析和图片下载，描述字段为空；导入结果未写入数据库或资产目录。
3. **字幕是部分接通的渲染能力。** 有 ASR→SRT→FFmpeg 烧录代码和三种样式；字幕只适用于有 spoken line 的角色场景，且依赖 ASR provider。字幕文本/分段时间没有单独编辑界面，最终字幕文件也受下载路由缺失影响。
4. **试听资产人工听审已完成，真实视频精确音色仍未接通。** 53 张角色卡和 speech-2.8 试听 MP3 已由用户人工听审；任务/镜头 mock 快照与性别匹配有离线 smoke 覆盖，但真实视频生成未验证会使用对应 Buming `voiceId`，也没有已验收的 TTS→口型同步链路。
5. **营销文案范围大于当前可用范围。** 仓库文案提到完整 URL 自动成片、选声/克隆声纹、字幕编辑、音乐库、批量视频、社媒一键发布、AI Twin、广告克隆、外部 API 等。当前工作台中部分明确显示未开放，其余需要收敛文案或完成真实功能后再宣称。

当前 generation 还受数据库结构、供应商配置、ASR 配置和 `AIVIDEOSUGC_PER_SHOT_BILLING_APPROVED` / `AIVIDEOSUGC_VIDEO_THEME_ID` 等服务端运行条件约束。供应商迁移未在真实数据库验收；这轮仅静态阅读代码，没有做请求或扣费验证。

## 2. 审计口径

状态解释：

- **代码已具备**：仓库有 UI/API/服务端实现；仍不等于真实环境可运行。
- **部分具备**：实现覆盖有限输入、场景或交互，不能满足前端完整承诺。
- **未接通/未实现**：当前路由/服务端链路不存在，或 UI 明确显示不可用。
- **待验证**：是否受供应商、套餐、生产配置或账户能力影响，不能仅靠仓库定论。

前端分两层审计：

1. 工作台 UI：`src/components/aidreamcapes-workspace/workspace.tsx` 及其子组件。
2. 公开页面仓库文案：`scripts/data/aidreamcapes-site-v2/content/*.json`。仓库文案只是本地内容源；根据仓库规则，正式页面的权威内容仍是 `LivePage.contentJson`。本轮没有连接生产数据库核对这些文案当前是否在线展示。

竞品部分只依据 Creatify、Arcads 官方网站和 Help Center 的公开说明；这是功能对标，不是对竞品内部实现、质量或实际账户权限的独立审计。公开功能可能受订阅等级或实验发布影响。

## 3. 前端表述与后端实际能力对照

| 前端可见能力/宣称 | 当前 UI 与后端实现 | 结论与差距 |
|---|---|---|
| 粘贴商品链接，导入商品并生成视频 | `ProductUrlImport` 调用客户资产 `import-url`。服务端抓取公开 HTTPS 页面，抽取标题和一张商品图，存成客户图片资产；导入后交给用户继续选场景和填写资料。抓取过程有重定向、私网地址、字节数和超时限制。 | **部分具备。** 导入不创建视频任务，也不自动解析卖点、价格、评价和页面图库。UI 当前已较准确地写为“Import a product photo and name”；公开 `url-to-video.json` 等文案仍有“页面事实/照片进项目、自动建议脚本、整页到视频”等更强承诺。商品评价明确不导入。 |
| AI Agent 了解品牌/产品并自动写脚本、拆镜头 | 工作台有服务端结构化文本模型调用、三种场景 schema、逐镜头 storyboard 和用户事实校验；URL 导入只提供标题/图片，未提供产品描述、品牌知识库或评价作为生成事实。 | **部分具备。** 用户手填事实后可生成/编辑分镜；没有品牌记忆或从 URL 自动提取事实的完整链路。营销中的品牌研究、竞品调研和自动策略能力没有实现证据。 |
| 选择 AI 演员并生成口播 | 53 张内置 actor 和自定义头像卡可选；工作台显示角色卡关联的音色标签及试听 MP3。服务端要求支持原生语音的视频模型。 | **部分具备。** 可选角色、可播放试听、提示词包含声音描述；目前不保证合成音轨使用该卡对应的精确 Buming `voiceId`。自定义头像不是已训练的个人数字人。 |
| 选音色/克隆自己的声音 | UI 采用角色卡带默认音色的设计；没有单独音色目录。自定义角色保存通用声音描述，没有语音克隆提交/轮询 API。 | **未实现精确选声/克隆。** 53 张预设音色 ID 只在映射清单中；生成任务和镜头快照没有 voice ID。工作台文案正确提示声音描述不保证克隆，但仓库 FAQ/行业页存在“上传声样后克隆声音”等宣称。 |
| 自动字幕、字幕样式、导出 SRT | `media-render.ts` 对最终镜头音轨调用配置的 ASR，生成 SRT 并以 FFmpeg 烧录；有三种固定样式。字幕设置和样式可在任务中选择，caption revision API 有独立 smoke。 | **部分具备。** mock 烧录与 SRT 导出通过；真实 ASR/口播逐语言校验未完成。工作台没有逐句字幕文字和时间轴编辑控件；最终文件生产读回也未在本轮运行环境复验。 |
| 逐镜头剪辑、改台词、换参考图、生成新版本 | 工作台可编辑镜头视觉描述、台词、环境、参考图、镜头时间；可锁定、重写、重抽并存版本，支持选中版本后合片。 | **已实现代码，验收未完成。** 属于镜头配置和版本迭代，不是完整多轨时间轴剪辑器。无通用 trim/speed/fade/overlay/CTA/素材图层编辑。 |
| 批量生成不同演员/开场/语言版本 | Batch 对话框 1–10 个名称草稿；API `tasks/batch` 做原子校验并创建草稿。UI 明示“drafts only; nothing will be generated or published.” | **只实现批量建草稿。** 没有批次级执行、并发控制、逐项进度/取消/失败重试、批量扣费或组合演员/语言的自动 variation。营销中的“批量出片/多版本测试”目前超前。 |
| 上传背景音乐/音乐库 | 可上传客户自己的音频文件，限制大小/MIME/文件签名，按客户保存；渲染时将其与视频原生音轨混合。 | **部分具备。** 有上传和混音，没有内置授权音乐库、音乐搜索/试听或生成音乐。版权来源和用户使用权没有产品级检查。 |
| 6/10/15/30 秒、比例和语言 | API 校验 6/10/15/30 秒、9:16/1:1/16:9、9 种语言；目录显示供应商模型、时长、画幅和报价；30 秒拆为两段 15 秒。 | **代码已具备，能力依赖配置/供应商。** 没有 4:3、3:4 和平台专用导出预设；九种语言的实际语音/口型质量未验收。模型在 provider config 的能力声明不等于供应商真实成功率。 |
| 成片、镜头片段、字幕、脚本下载 | UI 提供视频、镜头片段、TXT/JSON 与 SRT 下载；输出路由校验客户/站点归属、输出种类、版本和路径。 | **代码与 mock 验收通过；生产读回待验。** 当前不是路由缺失；仍要在真实部署拓扑确认渲染产物的持久化、Content-Type 和 owner 隔离。 |
| 不加水印、可商用 | 渲染代码未主动叠加 AIVideosUGC 水印；供应商输出、用户套餐权益、商业授权和水印去除权限不能由本地代码单独证明。 | **待验证。** 需查供应商套餐和实际文件，并按用户订阅/授权控制公开承诺；不能以“本地没有 watermark filter”推断所有文件无水印且可商用。 |
| 直接发布 TikTok/Meta/Instagram/YouTube | 当前交付 UI 以下载成片为主；AIVideosUGC API 没有 OAuth 账号连接、发布、定时排期或社媒结果回读路由。 | **未实现。** 仓库营销文案中有“one click publish”“Send it to TikTok”等内容，属于功能宣称与后端差距。 |
| AI Twin/自定义数字人、Ad Clone | 2026-10-15 复核：已有 clones 授权、排队、状态、取消/删除和 run-mock API，工作台仍为说明与替代入口；真实训练和广告解析未接通。 | **后端基础已实现，真实业务链路未完成。** 当前本地克隆专用表未落地；不得把已有模拟 API 描述为“完全没做过”。后续按[专项计划](aidreamcapes-ai-twin-ad-clone-remediation-2026-10-15.md)整改，本次不更改公开文案。 |
| 客户 API、自动化接入 | 有供工作台使用的登录态、CSRF 保护的内部站点 API；没有公开 API key、开发者配置、文档、webhook 或客户级任务 API 访问控制。 | **未实现客户 API。** 内部前端 API 不等于对外 API。营销 FAQ 声称软件可通过 API 发起任务需撤回或排期完成。 |
| Library/任务历史/角色资产 | 有客户任务列表、任务恢复、版本历史、角色卡和图片生成结果列表 API/UI。 | **代码已具备、数据依赖待验收。** 任务/角色存储使用专用 SQL 表；应先确定并验收表结构迁移。成片文件长期存储及多实例服务读写也需核对。 |

### 仓库文案中高风险的具体承诺

本轮在下列内容源看到与当前代码不匹配或尚未有验收证据的描述：

- `content/url-to-video.json`：页面事实自动进入项目、自动建议脚本、使用评价、选择声音、字幕烧录、跨渠道发布等。
- `content/video-hub.json`：预览多种声音、直接发布、AI Twin/声音克隆、逐词口型对应、信用点生成前展示等。
- `content/image-to-video.json`：4:3 和 3:4 比例、音乐库、内置编辑器、脚本翻译/配音、TikTok/Meta 一键发布等。
- `content/faq.json`、`content/industries.json`：声纹克隆、直接社媒发布、字幕和语音多语言、团队/自有声音复用等。
- `content/tpl-spark-ads-style-video.json`：批量变体、公开 API、caption/口播支持、完整编辑器等。

这些是仓库内容源中的可见文案样本，不是本轮对线上 `LivePage.contentJson` 的证明。根据仓库公开数据规则，改文案前应先核对 Aidreamcapes relational owner 和当前 LivePage 内容；文案只保留终端用户可用、可核实的能力。

## 4. 竞品后台功能对标

| 能力 | 当前 Aidreamcapes AIVideosUGC | Creatify 官方公开功能 | Arcads 官方公开功能 | 产品差距 |
|---|---|---|---|---|
| 商品 URL 启动创作 | 只导入标题和一张主图，后续手工填场景/事实。 | URL-to-Video 可用商品 URL 开始创作；没有 URL 时可手动上传资产/填写产品信息。Ad Agent 可用 URL、素材或已保存产品开始，并支持先审概念/脚本、再用对话迭代。([URL-to-Video](https://help.creatify.ai/en/articles/12435455-url-to-video), [Ad Agent](https://help.creatify.ai/en/articles/17323796-ad-agent)) | Mark/Agent 的公开产品说明把 product website、product image、品牌资料和竞品广告列为输入，目标是输出完整广告。([Mark](https://agent.arcads.ai/), [AI Video Ads](https://help.arcads.ai/en/articles/17349897-ai-video-ads)) | 我们缺商品资料提取、产品知识确认、生成前的完整 brief preview 和“导入到草稿”闭环。 |
| 剧本/创意策略 | 有三类场景分镜生成和事实约束，没有品牌记忆/竞品研究。 | Ad Agent 支持自然语言创作和评论式迭代。 | Mark 描述包含产品研究、受众/定位、异议与创意角度，并记忆品牌上下文。 | 缺可复用品牌资料和创意策略层；但这是扩展项，先确保基础信息正确。 |
| 角色语音与口型 | 53 张角色卡与试听素材；运行时没有固定 voice ID，当前视频 provider 不接受音频参考。 | 公开工具覆盖角色、AI voice、custom avatar、批量创意；需按具体模型/套餐验收。([Creatify features](https://creatify.ai/features)) | AI actors talking-to-camera、audio-driven model、custom actor/clone、跨语言配音与 lip-sync。([AI Video Ads](https://help.arcads.ai/en/articles/17349897-ai-video-ads), [What is Arcads](https://help.arcads.ai/en/articles/17594889-what-is-arcads)) | 我们最关键缺口是“样音 voice ID → 口播合成 → 口型同步”的执行链，而非再扩角色卡数量。 |
| 字幕与剪辑 | ASR 自动时间轴、三种固定样式、FFmpeg 烧录/SRT 代码；无单句编辑、位置/字体调节和时间轴工具。 | 可编辑 caption 样式（字体、装饰、字号、行距、颜色）；官方说明其时间不能手动调整。([Manage Caption](https://help.creatify.ai/en/articles/9360011-manage-caption)) | 可后改字幕文字、位置和尺寸，支持文本覆盖、剪辑、变速、裁切比例、拼接等。([Caption Styles](https://help.arcads.ai/en/articles/16780221-caption-styles-for-videos), [Meta and TikTok Ads](https://help.arcads.ai/en/articles/17350005-meta-and-tiktok-ads)) | 先修复我们的字幕成片/SRT下载；之后增加台词/字幕人工纠正、位置/字体和时间轴编辑。 |
| 批量生产 | 最多十条任务草稿，没有自动生成批次。 | 有 Batch Mode 和广告变体产品；当前帮助页提示其曾从 dashboard 下架但仍可经入口访问，功能状态需注意账户权限。([Batch Mode](https://help.creatify.ai/en/articles/9413002-batch-mode)) | Workflows 可连接模型和资产，自动生成多视频；官方举例单台词 × 10 个 actor × 2 个语言产生 20 条。([Workflow](https://help.arcads.ai/en/articles/15393713-what-is-the-workflow-feature)) | 工作流/批量执行是明显差距；要补任务组、参数矩阵、并发限额、逐项计费和失败续跑。 |
| 音乐、格式、交付 | 可上传自有音乐、导出三种画幅；无授权音乐库/社媒发布；下载 endpoint 有缺口。 | Creatify 的产品说明涉及 URL、广告视频、声音、编辑与发布入口；具体平台发布需对照账户计划。([AI Reel Maker](https://creatify.ai/features/ai-reel-maker)) | Arcads 支持音乐、社媒尺寸、字幕样式，定位为 ready-to-upload 文件。([AI Video Ads](https://help.arcads.ai/en/articles/17349897-ai-video-ads), [Meta and TikTok Ads](https://help.arcads.ai/en/articles/17350005-meta-and-tiktok-ads)) | 先保障下载成片稳定；再考虑授权音乐目录、各平台导出 preset 与社媒账号发布。 |
| 创意测试、团队/品牌记忆 | 暂无品牌空间、团队、广告效果分析或素材表现回流。 | Creatify 高阶产品公开提及 competitor tracker、winning ads、creative analytics 和广告测试套件。([Creatify 4.0](https://help.creatify.ai/en/articles/11475769-what-is-creatify-4-0)) | Arcads 公开工作流和 Brand Memory 强调复用品牌/受众/创意上下文。([Mark](https://agent.arcads.ai/), [Workflow](https://help.arcads.ai/en/articles/15393713-what-is-the-workflow-feature)) | 属于规模化阶段差异，当前优先级低于 URL、音画、字幕和下载可靠性。 |

## 5. 建议补齐项与优先级

### P0：先让已展示的核心流程真正闭环

1. **在部署拓扑复验 output/download。** 输出路由和 mock owner/path/version 检查已实现；应用启动后确认 render 文件跨 worker/web 进程持久可读，MP4、SRT、clip 返回正确文件头和内容。
2. **补 URL-to-Video 的商品信息闭环。** 在当前安全抓取基础上先返回已核验字段（标题、主图、可抽到的描述/价格/多图及来源），逐字段由用户确认后写入任务；生成草稿和分镜需由用户明确继续，不能把页面抓取结果未经审阅就当作事实。处理无图、JS 页面、反爬、电商特定格式及原始链接审计。
3. **让字幕端到端可用。** 明确 ASR 可用性，补 final/SRT 下载；测实际口播与识别文本、分段和多镜头偏移；增加用户修改识别错误和字幕行的能力。无 ASR 或文本核验失败时保持不可用并给出明确原因。
4. **完成角色默认音色与实际口播的绑定策略。** 固化 actor→voiceId、台词语言和 shot snapshot；先做一个角色短片验证 exact voice 和 lip-sync。如果当前 provider 做不到，则将“选择/预览角色卡声音”与“成片语音模式”在 UI/公开文案上区分，不承诺未实现的克隆声线。
5. **通过真实环境启动门槛。** 固化 AIVideosUGC 专用表结构迁移；应用供应商配置迁移；配置文本/图像/视频/ASR provider 和账务开关；检查客户/站点隔离、幂等、扣费和错误恢复。
6. **校准公共功能文案。** 先核对 Aidreamcapes 的 `LivePage.contentJson`，对不能演示的“一键发布、voice clone、批量出片、音乐库、自动导入全部商品信息”等文案降到已验收范围。不要用 manifest 文案覆盖关系数据，也不操作历史发布快照。

### P1：形成有竞争力的制作工作流

- 批次实体与“按演员/开场/语言/比例展开”的变体矩阵；支持并发上限、取消、逐项状态、失败重跑、预算预估、每条审阅及导出。
- 字幕编辑：修订文案、拖动位置、字号/字体/颜色/背景、逐段时间轴；保留 SRT 导出和重新烧录。
- 基础时间轴编辑：trim、速度、镜头排序/切分、转场、文字/CTA overlay、音量轨道；每项操作可预览并生成新版本。
- 商品资料归一化与品牌 brief：图片集、标题、用户确认的产品事实、CTA、品牌语气和限制用语可复用。
- 语言真实验收：每种语言至少一条配音样片；验证 voice 支持、文本长度、断句、字幕字体、口型和当地化表达。
- 授权音乐曲库/AI 音乐需包含许可范围、曲目元数据、搜索试听和使用记录；没有许可把关时只提供用户自有音频上传。
- 平台导出 preset：TikTok/Reels/Shorts/Feed 的比例、安全区、字幕位置和时长限制，以下载文件交付为第一阶段。

### P2：按业务价值再评估

- OAuth 连接 TikTok/Meta/YouTube，直接发布、定时排期和发布结果同步。
- AI Twin/个人数字人、声音克隆、授权记录/撤销、训练状态和删除流程。
- Ad Clone：上传参考广告、提取结构/节奏/字幕位置，再生成原创版本，并保留授权与相似性检查。
- 团队/品牌 workspace、品牌素材库与 Brand Memory。
- 广告表现回流、创意对比和胜出版本建议。
- 对外客户 API、webhook、开发者密钥与用量配额。
- 更多模型能力（4K、扩图、视频延长、背景擦除、角色替换、镜头角度等）。

这些项目用于产品路线排序，不代表应无条件复制竞品功能；是否纳入需根据 Aidreamcapes 用户和运营目标决策。

## 6. 通过标准

- URL 输入后明确展示抽取结果及其来源；用户确认前不生成未经核验的产品事实。
- 一条真实任务从创建、分镜、镜头提交、状态轮询、成片渲染到 MP4/SRT/镜头下载完整通过；所有产物只对所属 Aidreamcapes 客户开放。
- 有字幕时使用最终音轨时间戳，实际文本通过确认或允许用户修正；无字幕/ASR 失败不会伪报成功。
- 角色卡映射在 task 和 shot 版本内固定；若宣称使用指定 voice ID，则样片实际使用该 ID 且口型通过验收。
- 批次功能只有在真实完成多条生成和逐条结算后才称为“批量生成”；社媒发布只有在真实 OAuth、提交与回执通过后才能宣称“一键发布”。
- 对外文案逐项对应可用 UI、API、权限、价格与支持区域；未完成能力显示计划/不可用，或从当前公开内容中移除。
- Aidreamcapes 工作不改变 MyDreamShoots 的运行数据、页面、SEO、媒体、路由或导航；不调用历史快照作为发布或回滚来源。

## 7. 审计代码入口

- URL 导入 UI：`src/components/aidreamcapes-workspace/product-url-import.tsx`
- URL 导入 API：`src/app/api/sites/[siteId]/customers/[customerId]/assets/import-url/route.ts`
- 安全抓取与页面解析：`src/lib/product-url-import.ts`
- 工作台：`src/components/aidreamcapes-workspace/workspace.tsx`
- 分镜/台词及输入校验：`src/lib/aidreamcapes-workspace/pipeline.ts`、`api.ts`、`catalogs.ts`
- 供应商能力/ASR：`src/lib/aidreamcapes-workspace/provider.ts`
- 角色音色目录和类型：`src/lib/aidreamcapes-workspace/actors.json`、`scripts/aidreamcapes-workspace/actor-voice-assets.json`、`src/lib/aidreamcapes-workspace/types.ts`
- 字幕、音频混合、合片及下载 URL：`src/lib/aidreamcapes-workspace/media-render.ts`
- 当前 API 路由：`src/app/api/sites/[siteId]/aivideosugc/`
- 公开页面内容源样本：`scripts/data/aidreamcapes-site-v2/content/url-to-video.json`、`video-hub.json`、`image-to-video.json`、`faq.json`、`industries.json`、`tpl-spark-ads-style-video.json`
