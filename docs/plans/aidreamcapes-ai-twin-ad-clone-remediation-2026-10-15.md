# Aidreamcapes AI Twin 与 Ad Clone 现状核查及整改计划

- 日期：2026-10-15
- 范围：`main-2` 的 `main` 分支、`site_aidreamcapes` 私有工作台和后端；竞品为用户此前指定的 Tagshop AI。
- 状态：专项 P0 运行基础及 P1 内部模拟流程已实施并完成本地接口验收；真实供应商 P1 与 P2 扩展待完成。执行进度见第 8 节。
- 总计划归属：这两项已在总大纲 P2 中列出。本计划细化既有事项，复用已实现部分，避免重做授权和任务系统。

## 1. 结论

**此前确实做过这两项功能的后端基础，但尚未完成客户可用的真实链路。** 本次已接通私有工作台表单、素材检查、授权与模拟任务、角色绑定和广告草稿关联；真实声音克隆、完整数字分身和广告解析仍未开放。

当前 3002 已运行 main-2，克隆专用表及增量任务顺序修复已安装到本地数据库；没有迁移生产数据库。真实 capability 继续保持不可用，模拟成功不能代替真实验收。

### 1.1 三种音色与人物能力的区别

| 能力 | 当前结果 | 与本次功能的关系 |
|---|---|---|
| 53 张内置角色卡及试听 | 已有固定角色音色映射、speech-2.8 MP3，用户已人工听审 | 已完成资产，不重新生成、不重新听审；属于预设音色 TTS 试听 |
| 自定义角色 | 可创建私有角色，保存客户肖像及可选的自有参考音频 | 可复用，但当前创建出的 voiceId 仍为 `mock:aidreamcapes:…`，不代表训练成功 |
| AI Twin | 已有 voice_twin 授权和模拟作业 | 没有完整的肖像身份、真实克隆 voiceId、训练结果、口型与视频复用链路 |
| Ad Clone | 已有 ad_reference 授权、任务归属和模拟作业 | 没有真实视频读取、广告链接抓取、ASR/镜头分析及分析结果写入分镜 |

证据：`scripts/aidreamcapes-workspace/generate-actor-voice-samples.mjs` 使用 `/v1/audio/speech` 和预设 voice；`actors/route.ts` 创建 mock voiceId；既有[音色计划](aidreamcapes-speech-28-voice-match-clone-plan.md)将预设试听标为完成，将克隆参考音频、克隆调用和克隆后验证列为未开始。试听资产不能证明视频已使用相同声纹；也不需要为了实现 TTS 再克隆已经可直接调用的预设音色。

## 2. 已实现代码与实际缺口

### 2.1 可直接复用的部分

| 已有实现 | 源码位置 | 复用方式 |
|---|---|---|
| 授权授予、读取、撤销、范围/过期/revision 检查 | `src/lib/aidreamcapes-workspace/clones.ts` 的 consent helpers | 延续既有所有权和审计规则，不新建平行授权体系 |
| 来源资产校验 | 同文件 `assertOwnedCloneAsset`、`assertCustomVoiceActor`、`resolveSource` | voice_twin 接受自有音频；ad_reference 接受自有 MP4；外部链接当前不是合法任务来源 |
| 队列、幂等、列表、详情、取消、软删除 | 同文件 `queueCloneJob`、`getCloneJob`、`transitionCloneJob` 等 | 扩展现有状态机和结果契约，保留旧 mock 记录 |
| 站点/客户隔离与修改请求鉴权 | `src/app/api/sites/[siteId]/aivideosugc/clones/**/route.ts` | 沿用 workspaceAuth，客户身份从会话取得 |
| 数据模型、索引与数据库约束 | `prisma/schema.prisma`；`20261014170000_add_aidreamcapes_clone_consent_jobs/migration.sql` | 审查后增量落地；不能仅修改 TypeScript 枚举 |
| 专项离线测试 | `scripts/smoke-aidreamcapes-clones.mjs` | 保留并扩展，已有覆盖不等于生产训练验收 |
| 下游视频任务、角色快照、分镜、输出 | workspace store/provider/runner 等 | 接入克隆输出，复用现有 Library、字幕及下载流程 |

现有 API 前缀为 `/api/sites/site_aidreamcapes/aivideosugc/clones`：

- `GET /`：能力声明。
- `GET/POST /consents`、`GET/PATCH/DELETE /consents/{consentId}`：授权管理；PATCH 的 revoke 和 DELETE 均执行撤销并保留审计。
- `POST /voice-twins/queue`、`POST /ad-references/queue`：创建模拟作业。
- `GET /jobs`、`GET/DELETE /jobs/{jobId}`、`POST /jobs/{jobId}/cancel`：状态与生命周期。
- `POST /jobs/{jobId}/run-mock`：显式执行模拟作业。

### 2.2 实施前真实链路缺口（历史核查）

1. `clones.ts:cloneCapabilities()` 固定返回 `productionReady: false`，两类功能均 `available: false`、`state: mock_only`。
2. `makeMockCloneResult()` 返回 `output: null`、`mediaRead: false`；广告作业另有 `remoteFetch: false`。这不是上游生成后的结果。
3. 两个 queue API 明确返回 `capabilityState: mock_only`。执行入口是 run-mock，没有对应真实训练/解析执行入口。
4. 数据库迁移限制状态为 `queued/mock_complete/cancelled/deleted`，并强制 capabilityState 为 mock_only；真实 running/succeeded/failed 等状态不能直接写入。
5. 该模块没有模型请求或账务依赖，现有 smoke 还专门断言不调用网络、不导入 provider/billing。
6. （整改前）工作台 twin/clone 视图仅显示能力说明与替代入口，没有接入授权和任务 API；本轮已接上私有业务表单与 mock 生命周期，当前列表及草稿可真实回读。
7. 检索到 voice_twin/ad_reference 的核心实现集中在 clones 模块和对应路由；未发现由现有 workspace runner 执行真实克隆训练、广告解析并消费结果的链路。

### 2.3 实施前本地数据库核查（历史记录）

只读连接已按 `DATABASE_TARGET=local` 校验；数据库为 `dingyue_local`、schema 为 public。`information_schema.tables` 以及当前 schema 下的 `to_regclass` 均确认：

| 数据表 | 2026-10-15 当前本地结果 |
|---|---|
| AidreamcapesCloneConsent | 实施前不存在；本轮已增量安装 |
| AidreamcapesCloneJob | 实施前不存在；本轮已增量安装 |

这解释了“仓库做过”与“当前工作台可用”之间的一部分差距。既有实施报告中的隔离验收库 `aidreamcapes_acceptance` 与当前本地库不是同一个环境；不能把前者的迁移结果当作后者已安装。初次核查没有运行迁移。后续本轮执行已通过专用 local-only 脚本安装两个克隆迁移；未连接生产数据库。

## 3. 对照 Tagshop AI

以下对比依据竞品官方公开页面和帮助中心，属于其公开提供的用户流程，未登录竞品后台实测，也不构成对生成质量、速度或供应商内部实现的验证。

| 用户流程 | Tagshop 官方说明 | 当前项目 | 需要补齐 |
|---|---|---|---|
| 创建个人分身 | 提交本人肖像，建立可复用数字分身，并可结合本人声音生成脚本视频 | 自定义肖像角色 + voice_twin 模拟作业相互独立 | 个人分身档案、肖像与声音绑定、真实能力状态、复用入口 |
| 复用分身做视频 | 更换脚本，持续使用同一分身 | 有角色/任务快照，无真实分身结果供选择 | 从分身卡片带入角色、可用 voiceId 与授权版本到新任务 |
| 输入广告参考 | 上传参考视频或提交广告链接 | 仅接受自有 MP4 资产 ID，不抓外链 | 先做自有视频上传解析，再做受支持平台链接导入 |
| 提取广告结构 | 参考 hook、节奏和结构，再替换成自己的商品 | result 为无媒体输出的 mock 对象 | 镜头与语音时间轴、结构化分析、可编辑分析预览 |
| 替换商品并生成 | 提交自己的商品/商品链接，生成新版本 | 已有商品导入、确认 brief、分镜和视频基础 | 让分析结构进入现有草稿，商品事实仍取用户确认 brief |
| 后续编辑与输出 | 工作流包含脚本审阅和视频导出 | 已有部分脚本、字幕、渲染和输出代码 | 按新来源保存 provenance，并验证整条任务可重开 |

来源：[Tagshop AI Twin](https://tagshop.ai/ai-twin/)、[Tagshop Ad Clone](https://tagshop.ai/ad-clone/)、[官方工作流说明](https://help.tagshop.ai/en/articles/16901769-how-tagshop-ai-works)。AI Twin 页面同时出现“单张照片”“视频处理”和不同耗时表述，不能据此确定训练素材规格；本项目须按实际选定供应商文档定义规格。

## 4. 整改优先级与执行顺序

整体仍归属总大纲的 P2 扩展。下列 P0/P1/P2 是本专项内部的先后顺序：本轮已完成本地运行基础与 mock 端到端表单；真实供应商链路和自动化扩展仍在后续阶段。

### 4.1 专项 P0：运行环境与能力契约

| 编号 | 工作内容 | 完成条件 |
|---|---|---|
| TC-01 | 审查克隆迁移的依赖、站点/客户外键、索引、trigger 和当前数据库差异；准备本地增量部署步骤 | 在隔离库验证安装与当前数据保留，再按目标环境部署；不能用自动启动脚本悄悄迁移共享/生产库 |
| TC-02 | 能力分项声明：数据库、素材读取、声音克隆、肖像生成、口型、ASR、广告解析、视频输出 | 每项给出 available/state/reason；未配置与服务故障可区分；数据库缺表不能误报为任务成功 |
| TC-03 | 定义真实 provider 契约和执行状态；优先核对 Yingling 对上述能力的实际支持 | 有提交、轮询或回调、结果读取、取消、超时、幂等和失败码契约；模型名称或通用音视频接口不能视为支持训练 |
| TC-04 | 为真实状态准备新增迁移；保留 mock_only/mock_complete 和历史授权审计 | 旧模拟记录仍可读，不自动改为真实成功；新增状态与结果字段同时通过应用与 DB 约束 |
| TC-05 | 完整划分免费预览、草稿/素材隐私和 credit 操作 | 访客可浏览功能说明；私有资产/训练提交须校验登录；所有收费提交必须服务端验登录与 quote；沿用现有非计费私有写入规则 |

供应商字段若必须改变共享平台配置，则列为单独依赖，在明确批准共享层改造后实施；本专项不直接修改影响 MyDreamShoots 的注册表或配置。

### 4.2 专项 P1 A：AI Twin 最小可用流程

1. **工作台表单**：新增我的分身列表、创建、素材检查、授权、作业进度、失败恢复、预览与删除入口。区分自定义肖像角色、克隆声音、完整数字分身的真实状态。
2. **素材与授权**：关联客户肖像/音频或视频资产；检查真实容器、时长、采样信息与可解码性。既有 voice_twin scope 仅覆盖音频流程，肖像使用与身份确认需要明确的数据契约，不能把普通角色上传视为已完成本人验证。
3. **真实声音适配器**：向已确认支持克隆的上游提交合格参考素材，持久化 provider/job/voice 标识，异步等待成功，再允许用于 TTS。需要抽音轨时生成新的客户私有派生资产，并保留来源关联。
4. **分身与角色合并使用**：复用私有 custom actor；将 ready 的声音绑定在该角色/分身档案内，不再增加独立音色选择页。任务和版本保存稳定身份/音色/授权版本，避免供应商默认声音替换。
5. **视频消费结果**：按供应商能力走音频参考视频或 TTS + 口型链路；缺少相应能力时只开放已完成的声音预览，不宣称完整 AI Twin 已可用。
6. **撤销与删除**：撤销后禁止新的生成请求；删除上游声纹/分身和本地派生资产分别记录结果。作业取消、失败重试和保留审计沿用现有生命周期。

对内置 53 张卡优先直接使用已选预设 voiceId。个人声音克隆面向用户提供的声音；不把 53 份短试听素材自动提交为训练音频，也不重新安排已完成的人工听审。

### 4.3 专项 P1 B：Ad Clone 最小可用流程

1. **参考素材输入**：先支持自有 MP4，复用现有资产所有权检查；审查通用上传是否能原样保存视频，必要时增加 Aidreamcapes 专用上传/检查路由，避免改动共享图片处理行为。
2. **媒体准备**：使用 ffprobe 获取时长/画幅/音轨；受控 FFmpeg 抽帧、抽音频，保留来源资产与处理版本。损坏、超限、无音轨素材分别返回可处理状态。
3. **结构化分析**：真实 ASR 产生带时间的文本，具备视觉能力的模型分析镜头、hook/主体/CTA 与节奏；输出带时间范围和证据来源的分析对象。无音轨时可走纯视觉分析，不伪造转写。
4. **用户审阅**：展示参考预览、分析结果、可编辑结构；显示步骤和失败原因。分析是风格/结构来源，不能充当自己商品的规格、价格、评价或功效证据。
5. **商品替换与回填**：复用 ProductUrlImport、确认 brief、53 张角色卡/客户私有分身和 sourceTemplate 思路；仅在确认后创建目标草稿，并记录 referenceAnalysisId/sourceAssetId/analysisRevision。
6. **生成与交付**：将编辑后的结构转为现有 Storyboard，复用镜头生成、字幕、render、Library 与 output；不直接复制参考广告素材或对所有输出承诺“版权无风险”。
7. **修复任务创建顺序**：现有 ad_reference 在建授权/作业时要求已有 taskId，而目标流程是先分析再建草稿。选择先建空草稿再关联，或允许分析作业暂不关联 task；后者需增量调整 API/DB 校验并补旧行为兼容测试。不能让用户因缺 taskId 无法开始。

### 4.4 专项 P2：自动化和管理能力

- **广告链接导入**：在 MP4 流程稳定后，逐平台实现有权限的媒体获取；沿用 URL 导入的地址与跳转检查，返回明确的未支持、需登录或不可访问状态。不能把商品页 HTML 导入视为广告视频下载能力。
- **变体批次**：在同一已确认结构上组合角色、语言、比例和文案版本；复用 batch 幂等、取消、部分失败恢复，逐项显示费用。
- **后台维护页**：在 Aidreamcapes 管理范围展示 capability、供应商作业状态、错误码、耗时、取消/清理结果与脱敏审计；密钥只由服务端配置管理。
- **质量与性能**：记录分析/训练/渲染阶段耗时和失败率；避免全片/所有帧同时送模，限制任务并发，长耗时交给 worker；列表使用已有 owner/status/updatedAt 索引并按实际查询计划再优化。

## 5. 数据与接口改造边界

- **复用**：CloneConsent、CloneJob、现有私有 Actor、客户 Asset、视频 Task、Storyboard、task/shot version、quote 与输出基础。
- **扩展**：CloneJob 的模式/阶段、providerJobId、失败与重试信息、进度及经过验证的结果引用；需要时增加分身档案与广告分析记录，全部限定 Aidreamcapes/customer owner。
- **独立保存**：源媒体、派生音轨/帧、结构分析、商品事实；只通过 ID 和 revision 关联，不把分析全文或授权说明写进公共 LivePage。
- **真实执行路由**：在现有 queue/job 路由基础上新增 worker 执行或内部 dispatch；run-mock 保持显式测试语义，不能在生产静默退回 mock。
- **回调规则**：供应商回调须验来源、重复/乱序处理和 owner 绑定；取消或撤销后到达的成功回调不得自动重新启用档案或重复扣费。

## 6. 验收分层

### A 层：内部稳定性，先执行

延续用户“先不真实交易、不真实生成”的要求：使用合成素材、隔离数据库、fixture transport 和模拟 ledger，不读取真实供应商密钥。

- 数据库：当前目标缺表有明确部署检查；隔离库验证增量迁移、旧 mock 记录可读、索引与约束、站点/客户隔离。
- 界面/API：表单与后端连接，上传/校验/授权/排队/进度/失败/取消/重开/删除全程无未处理异常；空列表、刷新和窄屏可用。
- 状态：并发 revision、相同幂等键、超时、429/5xx、重试、重复/乱序回调、worker 重启、撤销后回调均有确定结果。
- 结果回填：分身绑定回对应角色；广告分析回填正确草稿；商品事实只取用户确认字段；Library 重开保持相同关联。
- 登录/费用：匿名收费请求拒绝；预览不扣费；fake quote/reserve/settle/refund 不重复、不可绕过；真实生成和真实账务调用数为 0。
- 资产：参考图/试听图不当作用户上传；旧 53 张卡及试听映射不变；删除仅限当前客户和本站点。

通过 A 层只可标为 `INTERNAL_STABLE_WITH_MOCKS`，不能把真实能力改为 ready。

### B 层：真实供应商，后续独立验收

另行确定供应商、素材、预算和样本后，再验证真实 voiceId 可复用、肖像一致性、声音与口型、广告结构准确性、实际 MP4 输出及失败退款。只有相应分项通过后才开放其真实 capability。数据库部署、上游支持及真实样片是独立门槛，不能互相替代。

## 7. 交付顺序与责任

1. **已完成本地范围**：TC-01 的本地表结构、TC-02 诊断、TC-04 taskless 分析兼容和 TC-05 会话/CSRF/owner/模拟生成边界；以真实 localhost HTTP 和真实浏览器合成客户回归。
2. **已完成内部流程**：两套工作台接入授权、素材、任务、刷新回读、AI Twin 角色绑定，以及 Ad Clone 到确认商品草稿的结构关联；53 张内置卡不变。
3. **等待供应商资料**：按 Yingling 官方接口能力完成 TC-03，再拆分声音训练/预览、ASR/视觉分析、口型及视频输出适配；每项独立验证。
4. **后续 P2**：在真实解析/生成能力已证明后再开发广告链接导入、批次、管理诊断与 SQL 性能观测；生产 schema 另行发布并回读。

本轮实施不修改公共页面、营销文案或 MyDreamShoots；只安装本地克隆专用增量迁移，不调用真实模型，不产生交易或 credit 变动。


## 8. 2026-10-15 并行实施与验收记录

### 8.1 已交付

三路智能体在同一 `main-2/main` 工作区分别完成后端契约、AI Twin 表单、Ad Clone 表单；协调者完成媒体路由、本地迁移、整页集成及生成门禁。

| 专项 | 当前交付 | 验收范围 |
|---|---|---|
| TC-01、TC-02 | local-only 迁移安装脚本、缺表能力诊断、分项能力状态 | `dingyue_local` 两张克隆表已安装；脚本再次 dry-run pending 为空；生产未部署 |
| TC-03 | 注入式 provider 提交/轮询/回调/取消契约、幂等、乱序、撤销及超时处理 | fixture transport 通过；尚无 Yingling 真实适配器，不能据此启用 capability |
| TC-04 | 新增 `20261015130000_aidreamcapes_clone_taskless_analysis` | 支持先分析后建草稿；保留 mock 状态约束。真实状态迁移须等上游契约确定，仍待做 |
| TC-05 | 私有接口会话/CSRF/所有权校验，模拟来源生成门禁 | 模拟分析草稿不能进入真实生成/quote；匿名、跨客户、撤销后请求拒绝；真实账务调用为零 |
| P1 AI Twin 内部流程 | 私有肖像+音频、授权、队列、显式模拟、重试/取消/撤销/删除、mock 音色回绑定同一私有角色 | 刷新可恢复；同意声明不冒充身份核验；未训练真实 voiceId；53 张内置卡保持原样 |
| P1 Ad Clone 内部流程 | 自有 MP4 上传检查、模拟时间轴编辑、确认自有商品信息、创建并关联草稿、重开与删除 | 商品事实与 sourceAnalysis 分开；编辑后的结构独立进入分镜输入；模拟草稿允许编辑保存但禁真实生成 |
| 本地媒体准备 | ffprobe 检测实际格式/时长/音轨，受限 FFmpeg 抽 WAV/帧，私有 owner 资产列表 | 合成音视频实测；格式/超限/损坏输入和无音轨处理；未做 ASR 或供应商上传 |

新增 API（沿用 `/api/sites/site_aidreamcapes/aivideosugc/clones`）：`GET/POST /assets`、`POST /jobs/{id}/retry`、`POST /jobs/{id}/bind-actor`、`POST /jobs/{id}/attach-draft`。

工作台入口：`/site/aidreamcapes/app/create?view=twin`、`?view=clone`，组件按需加载。登录返回保留对应视图。

### 8.2 已验证和已修复

- 本地真实 HTTP：**68 项断言、35 次请求、10 次预期权限/CSRF/跨客户/撤销拒绝**。覆盖真实上传与探测、角色创建与绑定回读、无 task 授权/排队/幂等、模拟结果持久化、确认商品后关联草稿及 attachedTaskId 回读、重试/取消/撤销/删除。仅使用两名合成客户、三份合成上传，结束后逐项清理 DB 与文件；CreditLedger 和 GenerationJob 为零。
- 修复数据库 JSON null 检查：原 guard 的 `->>` 比较使合法 `output:null` 被误拒绝；新增迁移使用 JSONB 比较，保留历史迁移不变。
- 修复角色绑定 SQL：Actor 没有 updatedAt 列，原 UPDATE 会 503；已删除该不存在字段并通过真实接口复测。
- 单项通过：clones、clone-runtime、clone-schema、clone-media、clone-generation-boundary、twin-ui、ad-clone-workbench、template-entry、client-performance、workspace-pipeline、dom-translation。
- `npm run typecheck -- --pretty false` 通过。访客真实整页 Twin/Ad Clone 返回 200，登录返回视图和 390px 无横向溢出通过。真实登录整页浏览器另通过 **25 项检查**：桌面/390px Twin 与 Ad Clone、角色/任务 API 刷新回读、0 页面错误、0 个 5xx、0 非允许请求；外部字体只在浏览器拦截并替代。4 张页面截图已保存于 `/var/folders/_w/l7qb3zvn2m70p3qtmkphxp580000gn/T/aidreamcapes-clone-browser-evidence-evk0b5`。合成客户、素材、任务和会话清理完成，CreditLedger/GenerationJob 均为 0。
- UI fixture 覆盖加载失败/缺表、上传、重复点击、部分失败恢复、刷新、窄屏及翻译 DOM 场景；这是内部稳定性验收，不是实际供应商质量证明。

对应测试位于 `scripts/aidreamcapes-workspace/smoke-clone-*.mjs`、`smoke-twin-ui.mjs`、`smoke-ad-clone-workbench.mjs`、`scripts/smoke-aidreamcapes-clone-runtime.mjs`。本轮状态为 `INTERNAL_STABLE_WITH_MOCKS`，未宣称生产训练或广告解析已完成。

### 8.3 未完成项与下一批顺序

1. **真实供应商 P1**：等待 Yingling 开放 API 文档，逐项证明声音训练、voiceId 查询/删除、TTS、ASR、视觉解析、口型及视频接口支持。确认后再实现适配器、真实状态迁移、受验签回调、私有结果保存及独立预算验收；不能用通用 speech 接口推断支持训练。
2. **AI Twin 完整链路**：身份核验（如果上游要求）、真实声音训练与预览、真实声音/肖像用于视频、上游声纹删除和撤销后的结果处理。当前肖像可用于现有角色流程，但 mock 声音不进入真实生成。
3. **Ad Clone 真实解析**：实际 ASR/视觉分析、带证据时间轴、分析 worker 和真实输出复用；当前合成结构不包含真实媒体理解。
4. **P2**：受支持广告平台链接导入、变体批次、站点管理诊断页、阶段耗时/错误率观测与基于实际 SQL 计划的调优。当前只限制本地媒体并发，未声称这些扩展已交付。
5. **上线**：生产增量迁移与当前数据读回尚未执行；不得以本地通过代替生产可用。
