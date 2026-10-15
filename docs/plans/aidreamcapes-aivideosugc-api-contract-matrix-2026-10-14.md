# Aidreamcapes AIVideosUGC API 契约矩阵

- 日期：2026-10-14
- 状态：基于当前工作区源码，并已由 Aidreamcapes 定向 smoke、隔离 PostgreSQL 与 mock 浏览器验收复核；没有连接生产数据库、调用真实供应商或读取生产运行时配置。
- 范围：`site_aidreamcapes` 的私有 AIVideosUGC 后端 API 与相关 workspace helpers。
- 依据：`src/app/api/sites/[siteId]/aivideosugc/`、`src/lib/aidreamcapes-workspace/`，以及同日实施状态、差距审计、整改计划和总计划。代码状态与验收状态分别记录。
- 此文档为内部工程材料，不属于前端文案或公开内容。

## 1. 契约约定

所有路径以下列前缀为基准：`/api/sites/{siteId}/aivideosugc`。`{siteId}` 必须是 `site_aidreamcapes`；不接受通过请求体指定另一个站点。

### 身份验证与所有权

| 路由范围 | 身份验证 | 所有权边界 |
|---|---|---|
| 除目录读取和 developer API 外的工作台路由 | Aidreamcapes 客户登录态；修改请求还经过客户 mutation/CSRF guard | 客户 ID 从当前会话取得，不信任请求体传入的 customer ID。任务、角色、资产、品牌、团队、发布、克隆、指标和 webhook 查询均带 Aidreamcapes 站点与客户/团队 owner 过滤。 |
| `GET /catalog` | 只校验固定站点；可选读取当前登录客户 | 匿名响应不包含客户自定义角色；登录时目录可合并该客户自己的角色。 |
| `/developer/v1/tasks` | `Authorization: Bearer <developer key>`；密钥绑定 Aidreamcapes 客户并要求 `read` 或 `write` scope | API key 的 owner customer 是数据 owner；路径 `siteId`、密钥 owner、客户站点三者必须匹配。每个 key 按 helper 规则限为 60 秒 120 次。 |
| `/developer-keys` | 客户登录态与 mutation guard | 只能列出、撤销当前客户在本站点的 key。新密钥只在创建响应中返回一次；数据库保存 hash。 |

工作台任务读取使用 `(siteId, customerId, taskId)`；跨客户任务按 `task_not_found` 处理。自定义角色、图片、音乐、片段及导出文件也必须属于同一 Aidreamcapes 站点和当前客户。团队资源另要求当前客户是该团队成员，并按 owner/admin/editor/viewer 权限做操作判断。内置角色目录可共享，但自定义角色引用的图片/音频仍须校验客户资产归属。

除 `/catalog` 外的列表和详情 API 均为客户私有。成功的 JSON 响应使用 `Cache-Control: private, no-store`。developer API 同样设置 `private, no-store`。

### 修订与幂等

| 操作 | 契约 |
|---|---|
| 任务 PATCH、DELETE、动作队列、字幕 PATCH、编辑 PATCH、克隆授权撤销、团队/品牌/事实更新、批次取消/恢复 | 使用 `If-Match` 或对应请求体 `revision`。缺少或无效修订号返回 `revision_required`（428）；并发版本不匹配返回 `revision_conflict`（409）。任务保存按当前 revision 做条件更新，成功后递增。 |
| `POST /tasks` | `Idempotency-Key` 可选。提供时按站点、客户和 key 形成稳定任务 ID；相同 key 与相同请求 hash 回放既有任务，不同请求 hash 返回 `idempotency_conflict`。不提供时创建新任务。 |
| `POST /tasks/{taskId}/actions` | `Idempotency-Key` 可选。相同活动 operation key 与相同 action/shot/version/language 返回当前任务；key 被不同操作复用时返回 `idempotency_conflict`。队列操作仍需匹配任务 revision。 |
| `POST /tasks/batch` | 必须提供 `Idempotency-Key`，每批 1–10 条；用 key 和请求 hash 稳定标识批次。重复相同内容回放批次，不同内容返回 `idempotency_conflict`。校验失败为全批拒绝，不留下部分批次。 |
| `POST /developer/v1/tasks` | 必须提供 `Idempotency-Key`；key 进一步绑定 API key ID 后创建客户任务。该 API 只创建 draft，不发起生成。 |
| 克隆 job、发布队列 | 克隆队列要求 idempotency key，并绑定 consent revision/source/task；发布队列以 idempotency key 和请求 hash 判重。相同 key 对应不同请求按冲突拒绝。 |
| webhook event | `task.created` 使用稳定 event key；同一 subscription/event key 的重复 enqueue 由唯一约束跳过。 |

并非所有写操作都带资源 revision：新建、上传、邀请等操作各按相应业务校验。API 客户端应只将实现明确支持 revision 的字段视为乐观并发契约。

### 错误响应与稳定错误族

Workspace helper 错误以 `{ "error": "<stable_code>", "details"?: ... }` 返回，并带该错误对应的 HTTP 状态。数据库原始错误 `P2010` 映射为 `workspace_database_unavailable`（503）；未识别服务端错误返回通用 `workspace_request_failed`。部分登录态/CSRF guard 直接返回 auth helper 的响应。

| 错误族 | 代表码 | 常见状态/含义 |
|---|---|---|
| 登录与站点 | `customer_login_required`, `customer_site_mismatch`, `workspace_site_not_found` | 401/403/404；缺少登录态、客户不属本站点、站点不在 Aidreamcapes scope。 |
| 资源与归属 | `task_not_found`, `asset_not_owned`, `music_asset_not_owned`, `workspace_clip_not_owned`, `team_not_found`, `brand_not_found` | 404 或 403；不暴露其他客户资源。 |
| 请求格式与字段 | `invalid_json`, `request_too_large`, `invalid_input`, `invalid_options`, `invalid_shots`, `workspace_caption_patch_invalid` | 400/413/422；结构、字段、枚举或大小不合法。 |
| 修订与幂等 | `revision_required`, `revision_conflict`, `idempotency_key_required`, `idempotency_conflict`, `idempotency_key_mismatch` | 428/409/400；并发版本或同 key 请求内容冲突。 |
| 队列/任务状态 | `task_busy`, `shot_busy`, `storyboard_required`, `storyboard_stale`, `workspace_video_not_ready`, `workspace_operation_not_cancellable` | 409；当前状态不允许动作或结果尚未可用。 |
| 供应商/能力/计费配置 | `workspace_video_provider_unavailable`, `workspace_native_speech_unsupported`, `workspace_shot_duration_unsupported`, `workspace_composition_provider_unavailable`, `workspace_billing_configuration_required`, `platform_not_configured` | 503 表示未配置/不可用；422 表示所选选项与已声明能力不兼容；外部 provider 失败通常为 502。 |
| 媒体与路径 | `workspace_output_kind_invalid`, `workspace_output_stale`, `workspace_output_missing`, `workspace_output_path_invalid`, `workspace_mock_output_unpublishable`, `workspace_ffmpeg_unavailable` | 400/404/409/503；输出类型、版本、文件或处理工具不符合约束。 |
| 开发者密钥 | `developer_key_invalid`, `developer_key_scope_required`, `developer_key_rate_limited` | 401/403/429；无效/过期/撤销密钥、scope 不足或达到 120 次/60 秒。 |
| 团队/品牌权限 | `team_permission_denied`, `team_invite_role_denied`, `brand_fact_confirmation_requires_review`, `revision_conflict` | 403/409/422；角色不允许操作、邀请规则或确认审查失败。 |
| 克隆授权 | `clone_consent_required`, `clone_consent_revoked`, `clone_rights_confirmation_required`, `clone_consent_revision_conflict`, `clone_source_asset_not_owned` | 403/409；授权范围、有效期、revision 或来源归属不匹配。 |
| Webhook 安全/配置 | `webhook_target_invalid`, `webhook_target_private`, `webhook_encryption_not_configured`, `webhook_secret_unavailable` | 400/503；仅允许经过公网地址检查的 HTTPS endpoint，密钥加密配置缺失时拒绝创建/解密。 |
| 单项任务取消 | `workspace_operation_not_cancellable`, `workspace_stability_mock_video_dispatch_disabled`, `task_busy`, `revision_required`, `revision_conflict` | 409/428/503；只能取消当前 owner 的可取消操作，版本冲突与真实 provider 已派发状态均 fail-closed。 |
| 高级 feature gate | `workspace_feature_request_invalid`, `workspace_output_4k_unavailable`, `workspace_video_extension_unavailable`, `workspace_actor_replacement_unavailable`, `workspace_advanced_shot_tools_unavailable`, `workspace_feature_job_not_cancellable` | 400/409/422/503；未配置或未明确开启的 4K、延长、替换演员及镜头工具不可排队执行。 |
| 音乐权利/生成 | `music_license_required`, `music_license_not_owned`, `music_license_expired`, `music_territory_not_covered`, `music_ads_not_permitted`, `music_generation_not_configured`, `music_generation_unlicensed_ack_required`, `music_generation_attachment_disabled`, `music_generation_unlicensed` | 403/409/422/503；试听、任务附件按客户、地区、用途、期限和许可 revision 校验；AI 音乐默认关闭，mock WAV 不授予商业权利。 |

## 2. 核心任务与媒体状态

### Task、operation、shot、render

| 对象 | 当前枚举/转移 |
|---|---|
| Task | `draft` → 成功 storyboard 后 `storyboard_ready`；render 开始为 `rendering`，成功为 `completed`，render 失败为 `failed`；允许符合状态/revision 条件的任务转入 `cancelled`。分镜/镜头生成本身通过 `operation` 和 shot 状态表达，不必改变 task 状态。 |
| Operation | `pending` → `run` → `done` 或 `fail`。动作包括 `storyboard`、`reroll`、`rewrite`、`generate_shot`、`compose_shot`、`restore_version`、`render`；另支持 `resume` 恢复中断 operation。operation 有 lease/attempt 信息，最多自动尝试 3 次，之后标为 `operation_interrupted`。 |
| Shot / shot version | `pending`、`run`、`done`、`fail`。重生成保留版本历史并更新当前 `curVer`；合片只接受每个镜头当前选中且完成的版本。合成参考图状态沿用同一状态词。 |
| Render | `pending`、`run`、`done`、`fail`；处理步骤 `confirm`、`concat`、`subtitles`、`audio` 分别为 `pending`、`run`、`done`、`skipped`、`fail`。新 render 保留旧 render history，输入/分镜变化会使旧输出 stale。 |
| Batch item / batch | item：`draft`、`queued`、`running`、`completed`、`failed`、`cancelled`；batch 汇总：`draft`、`queued`、`running`、`cancelling`、`completed`、`partial`、`failed`、`cancelled`。最多 10 项、并发上限 3。 |
| Clone job / consent | job：`queued` → `mock_complete`，也可 `cancelled` / `deleted`；consent：`granted` → `revoked`。job 固定标记 `capabilityState: mock_only`。 |
| Publishing job | `queued`、`scheduled`、`publishing`、`published`、`failed`、`cancelled`。生产 route 当前没有已配置平台 adapter，队列状态不证明内容已发到平台。 |
| Webhook delivery | `pending` → `delivered` 或 `failed`；可重试响应最多 5 次，使用递增退避。交付功能默认关闭。 |

单项任务通过独立 `POST /tasks/{taskId}/cancel` 请求取消；取消要求 owner 和当前 revision 匹配，并区分仍可取消的排队/mock operation 与已经派发到真实 provider 的操作。动作队列不接受 `cancel` action。批次取消仍由 batch 专属路由管理。

### 输出 kind、版本与文件路径

`GET /tasks/{taskId}/output` 只接受 `kind=video|subtitles|clip`。video/subtitles 不允许附加其他 query；clip 必须且只能提供一个 `shotId` 与一个 `versionId`。task ID、shot ID、version ID 使用限制字符/长度校验；task 必须属于当前 session customer。

输出必须来自当前 `completed` task 的 `done` render，且 render 未 stale、storyboard 未 stale、hash 与当前 task 输入/分镜一致。video URL 和 subtitles URL 必须精确匹配当前 render URL；clip 只从该任务中匹配的 mock shot/version 读取。路径被限制在 render root 下的 `siteId/customerId/taskId/renderId` 或 mock `shotId/versionId` 目录；实现还校验规范化路径、realpath、普通文件、拒绝 symlink，并以 `O_NOFOLLOW` 打开文件。

`video` 返回 `video/mp4` 并 inline，SRT/clip 为下载附件；响应包含内容长度、private/no-store 与 `nosniff`。该 route 显式允许 mock 下载以支持隔离验收；发布 helper 拒绝 mock render。系统只读取当前选中版本，不静默回退到旧成功版本。

## 3. Endpoint route inventory

以下优先级按同日实施计划/总计划归类。括号中的“待完成”表示计划文件在本次写作时记录的实现或验收状态，不代表本次运行验证。

### P0：核心工作台与任务/素材闭环

| 方法 | 路径（前缀已省略） | 契约摘要 |
|---|---|---|
| `GET` | `/catalog` | 场景、内置角色、模型/时长/画幅/语言能力、字幕与合成可用性。可匿名读取固定站点目录；登录时可含本客户自定义角色。 |
| `GET` | `/balance` | 当前客户余额摘要。 |
| `GET`, `POST` | `/tasks` | 列出当前客户最近任务；创建 draft。创建时校验场景、选项、actor、图片/音乐资产 owner，可附已确认 product brief。 |
| `GET`, `PATCH`, `DELETE` | `/tasks/{taskId}` | 读任务；按 revision 修改输入、brief、actor/voice snapshot、分镜；删除只允许无活动 operation/镜头的任务。 |
| `POST` | `/tasks/{taskId}/actions` | 排队 storyboard/reroll/rewrite、生成/合成 shot、恢复版本、render；`resume` 恢复未完成 operation。返回 `202`，后台继续执行；取消使用独立 endpoint。 |
| `POST` | `/tasks/{taskId}/cancel` | 按 task revision 取消可取消的当前 operation；重复取消保持幂等状态，已派发真实 provider 的 operation fail-closed。 |
| `GET` | `/tasks/{taskId}/quote` | 查询任务/镜头生成 quote；需要已归属任务与镜头，并受 model/provider、能力、账务批准和价格绑定约束。 |
| `GET` | `/tasks/{taskId}/events` | 当前客户任务的 SSE 进度流；约每 2 秒读一次最新 revision，最长连接约 50 秒。 |
| `GET` | `/tasks/{taskId}/output` | 读取当前完成且新鲜的 MP4、SRT 或允许的 mock clip；路径约束见上节。 |
| `GET`, `POST` | `/actors` | 列出当前客户自定义 actor；创建含用户资产引用的 actor。 |
| `DELETE` | `/actors/{actorId}` | 删除当前客户 actor；被任务引用时返回 `actor_in_use`。 |
| `POST` | `/images/quote` | 为图片生成请求计算 quote，不提交 job。 |
| `GET`, `POST` | `/images` | 查询客户图片生成 jobs/output assets；提交图片生成 job，需 quote token、客户图片和 idempotency key。稳定性 mock 模式禁用真实 image dispatch。 |
| `GET`, `POST` | `/music` | 列出/上传客户自己的音乐；上传不超过 20 MiB 的受支持音频并检查文件签名。授权目录和 AI 音乐走下方独立路由。 |

### P0/P1：产品资料导入与确认

| 方法 | 路径 | 契约摘要与状态 |
|---|---|---|
| `POST` | `/tasks/product-brief` | 受 SSRF/重定向/响应大小/超时限制的商品页预览，不把未经用户确认的价格/描述提升为事实。确认后的 brief 可随新任务创建或通过现有 task PATCH 回填，并保留 URL、来源、置信度和确认时间；本接口本身不自动生成 storyboard 或视频。 |

### P1：字幕、成片编辑与批次

| 方法 | 路径 | 契约摘要与状态 |
|---|---|---|
| `GET`, `PATCH` | `/tasks/{taskId}/captions` | 读取字幕 cues；PATCH 按 task revision 验证 cue 文本和时间并保存新 caption edit draft。重新渲染以新 render version 保留历史。最终 ASR/字幕/SRT 端到端验收待重跑。 |
| `GET`, `PATCH` | `/tasks/{taskId}/edit` | 读取编辑设置；PATCH 校验剪辑输入并创建新编辑 render，保存 revision 与旧 render history。**实施状态表将“基础视频编辑”记为进行中，功能范围/完成度仍需后续更新。** |
| `POST` | `/tasks/batch` | 原子创建 1–10 个 draft，强制 `Idempotency-Key`；不会因一条无效输入留下部分批次。 |
| `GET` | `/tasks/batch/{batchId}` | 读取当前客户拥有的批次与 item 状态。 |
| `POST` | `/tasks/batch/{batchId}/cancel` | 按 batch revision 设置取消；运行中的 item 归并为 `cancelling`，排队项随后取消。 |
| `POST` | `/tasks/batch/{batchId}/resume` | 按 batch revision 将可恢复项排队，并最多 3 项并发。当前默认 `mockBatchRunner` 是 no-op，不调用生成供应商、不扣账；**批量真实生成/逐项计费仍待实现**。 |

### P1/P2 与 P2：协作、分析、克隆、开发者接入、webhook 与发布

团队/品牌在同日实施状态表中归为 P1/P2；总计划将其纳入 P2 扩展范围。下表也收录同组的 P2 API。

| 方法 | 路径 | 契约摘要 |
|---|---|---|
| `GET`, `POST` | `/teams` | 列出当前客户所在团队；创建 Aidreamcapes 团队及 owner membership。 |
| `GET`, `PATCH` | `/teams/{teamId}` | 读取/修订团队资料；PATCH 要求 manage_team 权限及 revision。 |
| `GET` | `/teams/{teamId}/members` | 按团队成员关系列出成员。 |
| `DELETE` | `/teams/{teamId}/members/{customerId}` | 按角色规则移除成员。 |
| `GET`, `POST` | `/teams/{teamId}/invites` | 列出/邀请本站点现有客户加入团队。 |
| `GET` | `/teams/invites` | 列出当前客户待处理邀请。 |
| `POST` | `/teams/invites/{inviteId}/accept` | 被邀请客户接受邀请；校验 site、目标客户、pending 状态。 |
| `GET`, `POST` | `/brands` | 列出/创建当前客户可访问的团队品牌。 |
| `GET`, `PATCH` | `/brands/{brandId}` | 读取/修订品牌资料，依赖 team role 与 revision。 |
| `GET`, `POST` | `/brands/{brandId}/facts` | 列出/添加品牌事实及来源信息。 |
| `GET`, `PATCH` | `/brands/{brandId}/facts/{factId}` | 读取/修订品牌事实；确认需要来源、review 与 revision 校验。 |
| `GET`, `POST` | `/analytics` | 查询指标摘要；POST 导入客户提供的广告平台报表行，不执行广告平台 OAuth/拉取。查询按 customer/team owner、日期、币种和 provider 过滤。 |
| `POST` | `/analytics/events` | 记录受限的分析事件。 |
| `GET` | `/clones` | 返回 voice twin/ad reference capability 与当前客户 clone jobs。 |
| `GET`, `POST` | `/clones/consents` | 列出/授予绑定 workflow、source、rights confirmation、可选 task 和 expiry 的授权。 |
| `GET`, `PATCH`, `DELETE` | `/clones/consents/{consentId}` | 读取或按 revision 撤销授权；PATCH action 为 `revoke`，DELETE 同样撤销。 |
| `GET` | `/clones/jobs` | 列出当前客户 clone jobs。 |
| `GET`, `DELETE` | `/clones/jobs/{jobId}` | 读取/逻辑删除当前客户 job；写操作需 revision。 |
| `POST` | `/clones/jobs/{jobId}/cancel` | 按 revision 取消尚可取消的 job。 |
| `POST` | `/clones/jobs/{jobId}/run-mock` | 校验 job、consent revision、来源与任务后产生 `mock_complete`；不读取/转换源媒体。 |
| `POST` | `/clones/voice-twins/queue` | 排队 mock-only voice twin job，要求有效授权和客户自有音频。 |
| `POST` | `/clones/ad-references/queue` | 排队 mock-only ad reference job；不抓取外部广告媒体。 |
| `GET`, `POST` | `/developer-keys` | 登录态创建/列出当前客户开发者 key；只在创建时返回一次明文 secret。POST 允许 scopes、名称、expiry。 |
| `DELETE` | `/developer-keys/{keyId}` | 撤销当前客户 key。 |
| `GET`, `POST` | `/developer/v1/tasks` | Key `read` scope 列任务；`write` scope 创建 draft。暂不提供生成/渲染动作。POST 必须 idempotency key。 |
| `GET`, `POST` | `/webhooks` | 列出/创建当前客户订阅；当前仅接受 `task.created` 事件和经过公网校验的 HTTPS endpoint。创建响应返回一次性签名 secret。 |
| `DELETE` | `/webhooks/{subscriptionId}` | 禁用当前客户订阅。 |
| `POST` | `/webhooks/deliveries` | 处理当前客户到期 delivery。当前可见的 `task.created` enqueue 调用来自 developer task create 路径。投递开关默认关闭；启用时会经固定 DNS 解析与 IP pinning 的 HTTPS transport 发出真实 webhook 请求。 |
| `GET` | `/publishing/capabilities` | 返回 TikTok、Instagram、YouTube 的连接/发布 capability。当前静态 capability 为 `not_configured` / `disabled`。 |
| `POST` | `/publishing/preview` | 校验当前完成输出与发布目标并生成队列 preview，不代表已发布。 |
| `GET`, `POST` | `/publishing/queue` | 列出/排队当前客户发布任务；POST 支持 idempotency key 和 scheduledAt。 |
| `GET` | `/publishing/jobs/{jobId}` | 读取当前客户 job。 |
| `POST` | `/publishing/jobs/{jobId}/cancel` | 取消可取消的 job。 |
| `POST` | `/publishing/jobs/{jobId}/retry` | 重试可恢复 job。 |

### P2：音乐目录、AI 音乐状态机与任务高级能力

| 方法 | 路径 | 契约摘要 |
|---|---|---|
| `GET` | `/music/catalog` | 返回本站点授权曲目及许可信息；试听 URL 由受限本地 asset route 提供，未授权的 demo fixture 不含可下载音频。 |
| `GET` | `/music/catalog/{trackId}/preview` | 当前 Aidreamcapes 曲目试听；校验受限存储路径、普通文件、大小和 MIME。 |
| `POST` | `/music/catalog/{trackId}/attach` | 按 task revision、用户地区、用途、license revision、有效期及 customer ownership 检查授权后附加曲目。 |
| `GET` | `/music/generation/capabilities` | AI 音乐能力默认 `not_configured`/关闭；只在显式稳定性 mock 下报告本地合成能力。 |
| `POST` | `/music/generations` | 创建默认不可执行的 music job；需明确 mock 模式与 idempotency。普通模式返回稳定未配置错误，不调用真实模型。 |
| `GET` | `/music/generations/{jobId}` | 读取当前 owner 的生成 job 状态。 |
| `POST` | `/music/generations/{jobId}/run-mock` | 执行确定性本地 WAV fixture 状态流转；产物带 mock 标记且不构成音乐授权。 |
| `POST` | `/music/generations/{jobId}/attach` | 只允许满足合同/许可检查的任务附件；合成 mock WAV 不得当作已授权商业音乐。 |
| `POST` | `/music/generations/{jobId}/cancel` | 按 revision 取消可取消 job。 |
| `GET`, `POST` | `/tasks/{taskId}/features` | 查询或申请 4K、延长、换演员等高级任务能力；服务端按 site/model capability 和 feature policy fail-closed。 |
| `GET` | `/tasks/{taskId}/features/{jobId}` | 读取当前任务下的 owner-scoped feature job。 |
| `POST` | `/tasks/{taskId}/features/{jobId}/cancel` | 按 revision 取消支持取消的高级能力 job。 |

## 4. 能力、外部集成与 mock 边界

| 能力 | 当前代码声明 | 契约含义 |
|---|---|---|
| 视频生成 | `/catalog` 的 model capability 来自启用 provider、Aidreamcapes video app、provider capability 与计费/主题绑定。稳定性 mock 下 video dispatch unavailable。 | `available` 不等于已验收真实 provider。duration/aspect 按 provider 支持范围校验；`audioReference`、`firstFrame`、`lastFrame` 当前由 capability mapping 固定为 `false`。 |
| 文本/分镜 | stability mock 用本地结构化 fixture；非 mock 分支查服务端配置的 text provider。 | 未配置时返回 `workspace_storyboard_provider_unavailable`；本次未查询配置、未发送请求。 |
| 图片与 actor/product 合成 | 正常分支依赖 image app/provider、报价与 worker dispatch；stability mock 禁止 dispatch。 | 客户图片 asset 上传/所有权校验是独立的本地数据路径；mock 不代表真实图片生成。 |
| ASR/字幕 | mock 使用确定性 fixture cues；非 mock 需要 ASR provider 并提交服务端音频请求。 | stability mock catalog 可报告 fixture subtitles available；这不代表真实 ASR 已配置或验收。 |
| Actor voice | 角色目录及任务类型包含 voice profile/snapshot；当前目录中的 voice IDs 是 mock namespace，视频能力映射不支持 audio reference。 | 不承诺精确 TTS voice 或 lip sync。真实 voice ID adapter、精确声音与口型样片验收仍待完成。 |
| Music | `/music` 上传客户资产；`/music/catalog` 提供授权记录、地区/用途许可和受限试听；`/music/generations` 默认关闭，仅显式 mock 可产出带 mock 标记的本地合成 WAV。 | 目录试听与许可逻辑通过定向 smoke。mock WAV 不授予商用权，不绕过授权音乐 attach 校验；没有真实音乐模型 adapter。 |
| 社媒发布 | capability 固定为 connection `not_configured`、posting `disabled`；mock adapter 仅供确定性测试，生产 routes 不传 adapter。 | OAuth、平台审核、真实发帖与状态回读未配置；队列 job 不等同于 published。 |
| Voice twin / ad reference | capability `mock_only` 且 `available: false`；结果为无媒体读取/无外部抓取的 mock result。 | 没有真实克隆训练或广告解析 provider。必须已有相应 consent、rights confirmation 与所有权证明才可创建 mock job。 |
| 广告分析 | 指标导入来源为 `customer_supplied_provider_report`。 | 接受客户导入及 owner/team 隔离汇总，不含 Meta/TikTok 等 provider OAuth 拉取。指标验证、币种换算、CTR/CPA 与排序 smoke 已通过。 |
| Webhook | 创建订阅需配置可用的加密主密钥；delivery feature flag 默认关闭。只有显式启用后处理器才会执行经过公网 IP 校验的 HTTPS 投递。 | 不声称默认已投递。创建 webhook 的 one-time secret 不在此文件记录；目标 endpoint 不允许 localhost、私网、非 HTTPS 或重定向投递。 |

## 5. 统一验收状态与边界

本矩阵已与最终路由清单及实现状态对齐。P0–P2 内部逻辑的代表性验收包括：

| 范围 | 验收证据 | 当前结论 |
|---|---|---|
| 核心任务、取消、批次、输出、字幕、编辑 | 独立 route/helper smoke、FFmpeg fixture、owner/revision/readback checks | 通过；只执行本地/mock 路径 |
| 商品 brief、角色、素材 | UI、持久化/更新、53 角色快照及归属合同 smoke | 通过；无真实电商抓取、TTS/ASR 请求 |
| 团队、品牌、开发者 API、webhook、发布、clone、analytics | 各功能 owner 权限、状态、scope、idempotency 与 injected/mock adapter smoke | 通过；真实 OAuth、投递、发布、克隆、广告拉取未启用 |
| 授权音乐、AI 音乐、高级 feature gate | 许可/试听路径、任务附件、默认关闭、mock 生命周期和取消 smoke | 通过；mock 音频不能视为许可曲目；4K/延长/换演员默认不可用 |
| 浏览器交互 | Playwright 桌面/手机视口、创建、筛选、字幕状态、下载、Library 恢复 | 通过；应用级错误和失败本地请求为 0，浏览器拦截的 Google Fonts 与 dev HMR 单独记录 |
| 隔离数据库与迁移 | 临时 PostgreSQL 18 合成库顺序应用 9 个 Aidreamcapes 专用迁移；tenant/revision/CAS/readback smoke | 通过；不是生产库，也不是完整生产基表/上线迁移验收 |
| 工程检查 | TypeScript、Prisma validate、全仓 ESLint、provider compatibility smokes | 通过；全仓 lint 仍有既存 warning |

真实生产数据库 CRUD、生产迁移/回滚、真实供应商质量、真实积分/交易、外部 OAuth 与发布仍属于后续独立验收。全局平台 provider schema 的数据库迁移不在 Aidreamcapes 专用临时库迁移范围；已有 provider compatibility smoke 通过。

### 后续维护检查点

1. 代码中存在 route 不等于生产能力可用；继续区分已 mock 验收、not_configured、disabled 和已单独验收的 adapter。
2. 若实现或删除路由，重扫 `src/app/api/sites/[siteId]/aivideosugc/**/route.ts` 并同步 inventory、认证模式和错误/幂等说明。
3. 不将 mock job、合成音频、队列状态描述为真实生成、已授权音乐或已发布内容。
4. 任何未来 Aidreamcapes 公共 storefront 更改，仍须遵循仓库单一数据源、SSR 与发布契约，并验证 relational owner、derived-state revision、origin/public readback 和回归检查。
