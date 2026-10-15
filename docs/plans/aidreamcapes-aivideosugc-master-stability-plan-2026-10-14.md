# Aidreamcapes AIVideosUGC 总计划大纲：按优先级稳定系统

- 日期：2026-10-14
- 状态：总计划；2026-10-14 P0–P2 内部功能实现与 mock 验收已收敛。真实供应商和生产能力仍需独立授权与验收。
- 适用范围：`site_aidreamcapes` 私有 AIVideosUGC 工作台及此前批准的供应商配置界面
- 配套资料：`docs/plans/aidreamcapes-aivideosugc-latest-remediation-plan-2026-10-14.md`、`docs/plans/aidreamcapes-aivideosugc-feature-gap-audit-2026-10-14.md`

## 1. 目标

先把当前已有工作台变成一套内部流程稳定、错误可恢复、数据隔离正确的功能系统。首轮验收覆盖浏览器交互、服务端 API、数据库读写、后台任务、文件处理、字幕合成、下载和错误状态。

本阶段目标状态是 **`INTERNAL_STABLE_WITH_MOCKS`**：代码路径和状态流转可在本地/隔离测试环境验证；并不表示真实供应商生成质量、实际账务或生产环境已经验收。

## 1.1 当前执行状态

2026-10-15 AI Twin / Ad Clone 并行实施：两套私有工作台已接入授权/素材/模拟作业/角色绑定/草稿关联，本地 `dingyue_local.public` 两张克隆表及 taskless 增量迁移已安装。真实本地 HTTP 验收通过 68 项断言，合成客户及文件已清理，真实模型与账务调用为零。真实训练、ASR/视觉解析、广告外链和 P2 自动化仍未完成，生产未迁移。详见[专项整改计划第 8 节](aidreamcapes-ai-twin-ad-clone-remediation-2026-10-15.md#8-2026-10-15-并行实施与验收记录)。

| 优先级 | 当前结果 | 仍未宣称完成的外部能力 |
|---|---|---|
| P0 | 核心工作台、站点/客户隔离、持久化、任务取消、输出与字幕、编辑、角色音色快照及浏览器 mock 流程均已完成本地/隔离验收 | 生产 schema 发布、真实 provider 生成质量、生产 worker 跨进程拓扑 |
| P1 | URL brief 确认、字幕人工修订、batch 状态编排、基础编辑、能力门控与确认事实均完成 mock 验收 | 真实批量出片、TTS/ASR 质量与实时 provider 调用 |
| P2 | 团队/品牌、开发者 API、webhook、发布队列、克隆授权、分析、授权音乐目录、AI 音乐状态机及高级 feature gate 均具备后端流程和测试 | OAuth、真实社媒发布/回读、真实声音克隆、广告平台自动拉取、商业音乐生成、真实高级模型能力 |

具体代码状态、运行过的检查和数据库边界见 `aidreamcapes-aivideosugc-implementation-status-2026-10-14.md`；路由、认证、revision/idempotency、错误族和 mock/disabled 语义见 `aidreamcapes-aivideosugc-api-contract-matrix-2026-10-14.md`。

## 2. 本轮验收边界

- 不产生真实交易、扣费、积分冻结/结算或订阅变更。账务一律使用测试账户和模拟 ledger。
- 不发送真实视频、图片、语音、LLM、ASR、lip-sync 请求。所有生成供应商通过 mock/stub 或拦截的 HTTP transport 返回固定 fixture。
- 验收运行时默认阻止未知外网请求；浏览器请求由 Playwright route mock 接管，服务端供应商 client 使用 fake transport。测试中一旦发现真实 provider endpoint 或真实 key 被读取即判定失败。
- URL 导入只使用本地 HTML/商品页 fixture 和 SSRF 测试地址；不抓取真实电商页面。
- 媒体链路使用本地合成的短视频/音频 fixture 验证 ffprobe、FFmpeg、字幕、拼接、音量和下载；这不算真实 AI 视频生成。
- 数据库只使用隔离的本地/测试库和合成客户数据；所有任务、角色、素材读写限定 `site_aidreamcapes` 与当前客户，不触碰生产库。
- 不部署、不写线上数据库、不切换/恢复/导入历史发布快照。
- 该边界覆盖前述整改计划中“先发真实样片验证供应商”的建议；真实视频请求、真实语音请求和实际交易留待以后单独决定，不属于本轮验收。

## 3. 当前基线

- 已有 53 张内置角色卡、人物图、试听音频与供应商 voice 映射；精确 voice ID 尚未进入生成任务快照，真实成片声音质量也不在本轮验收范围。
- 已有三类视频场景、分镜/镜头版本编辑、图片生成入口、最多 10 个批量草稿、客户自有音乐上传、字幕合成和任务列表等代码。
- URL 导入目前返回商品页标题和一张主图，尚不是完整自动 URL-to-Video 流程。
- 字幕代码依赖 ASR 配置；字幕行编辑和时间轴编辑尚未实现。
- 渲染代码生成的 MP4/SRT URL 对应的 AIVideosUGC `output` 路由当前缺失，是首要闭环缺陷。
- 工作台专用存储表的正式结构/迁移来源仍需确认；供应商 runtime 配置迁移尚无真实数据库验收记录。
- 仓库营销内容中有超出当前工作台能力的承诺，需要单独核对关系数据 owner 后再修订。

## 4. 优先级总览

| 优先级 | 目标 | 交付状态 |
|---|---|---|
| **P0** | 内部稳定性与无真实调用验收：API、数据库、任务状态、模拟供应商、媒体管线、下载、权限、错误恢复 | 当前必须完成；未通过不得进入下一阶段 |
| **P1** | 补齐首发核心功能：URL 导入到草稿、角色卡音色 ID 快照、字幕可编辑、批量实际编排、基础成片编辑 | P0 稳定后按业务优先级逐项实现，仍先用 mock 验收 |
| **P2** | 竞品扩展：社媒直发、品牌/团队、AI Twin/克隆、广告克隆、客户 API、创意分析、更多模型工具 | 暂不进入首发稳定范围，完成需求/成本/权限评估再排期 |
| **后续独立阶段** | 真实供应商质量、生产数据库发布、真实账务、真实外部平台连接 | 不属于本轮验收，须另行定义授权和验收边界 |

## 5. P0：系统内部稳定性计划

### P0.1 建立“零真实调用”验收模式

- 建立明确的 mock provider transport，覆盖文本、图片、视频、TTS、ASR 和合成任务状态。
- 建立 fake quote/credit ledger；`quote → reserve → settle/refund` 只操作测试账本，所有记录均标记为 test。
- 将未知供应商、未配置供应商和绕过 mock 的调用默认失败关闭，不从环境中读取生产 key。
- 确认 mock 响应覆盖成功、排队、处理中、超时、429、供应商 5xx、内容无效、取消和重试场景。
- 在验收报告中证明真实供应商调用计数为 0、真实账务变动为 0。

**通过条件：** 所有 UI 和服务端路径均能在 mock 模式下完成预期状态流转；任何外网生成请求或账务写入立即失败并阻断验收。

### P0.2 补齐数据库结构和数据隔离

- 确认 `AidreamcapesVideoTask` 与 `AidreamcapesWorkspaceActor` 的正式 schema/migration 来源；避免只依赖未纳入迁移管理的临时初始化脚本。
- 在隔离测试数据库应用/回滚迁移，检查列、唯一约束、索引、revision 与 owner guard。
- 覆盖任务和自定义角色的创建、读取、更新、删除、重开、并发 revision 冲突与重试。
- 验证跨客户读取/修改返回拒绝；站点 ID 不是 `site_aidreamcapes` 时拒绝所有写入。
- 验证输入素材、合成素材、音乐、渲染产物的 asset owner 与 task owner 一致；删除任务/清理失败不得影响别的客户素材。

**通过条件：** 每项读写均能回读；跨站/跨客户测试全部拒绝；并发更新不会静默覆盖新版本。

### P0.3 修复任务、作业和下载 API 闭环

- 补齐受认证保护的 `tasks/[taskId]/output` API，支持 MP4/SRT（及 UI 实际使用的镜头片段），校验站点、当前客户、task owner、渲染完成状态和文件路径。
- 为 catalog、tasks、batch drafts、quote、actions、events、actors、images、music 和 output 建立 API 契约表：认证方式、请求字段、响应类型、错误码、幂等键和所有权要求。
- 明确任务状态转换：draft → queued/running → succeeded/failed/cancelled；非法转移返回稳定错误码，不留下半成功结果。
- 验证事件断线重连、页面刷新、离开后返回、重复提交、重复轮询、worker 重启和操作恢复。
- 使用 mock runner 测试 storyboard、shot generation、composite、render 等操作；同一 idempotency key 不得产生第二个逻辑任务。
- 确定渲染文件的共享持久化位置；用分离的 worker/web 测试进程读取同一测试资产，验证路径不会依赖单进程临时目录。

**通过条件：** 客户从 Library 打开任务能看到 mock 结果；MP4/SRT/镜头文件均可正确下载；未经授权的任务和路径无法读取。

### P0.4 验证工作流输入和生成编排

- 使用 mock 文本 provider 验证三类 scene 的输入校验、事实来源约束、语言规则、voiceover 长度、镜头数量、用户编辑、锁定、重写、重抽和版本恢复。
- 模拟图片/video provider 能力差异：支持/不支持原生语音、不同 clip duration、画幅、参考图数量及超时/失败。
- 确认 30 秒拆为两个 15 秒镜头时，mock quote、两个任务、合成时长及本地测试账本一致；本轮不真实扣费。
- 对缺少 provider、缺少模型、无报价、余额不足、能力不支持、引用素材无权访问等情况，UI 显示可读错误并保持输入/任务状态一致。
- 保留旧 provider adapter 的回归 fixture，验证新配置字段缺失时的默认值与既有解析结果兼容。

**通过条件：** 三类场景在成功/失败路径下都没有 unhandled rejection、未捕获 500 或状态卡死；错误任务能按设计恢复或结束。

### P0.5 URL 导入安全与功能边界

- 用本地固定 HTML/JSON-LD/OG fixture 验证标题、主图解析、图片格式/大小校验及失败提示。
- 单测阻止 loopback、私网、保留 IP、凭证 URL、非 HTTPS、非 443 端口、DNS 私网解析、重定向到私网、过大响应、超时和压缩炸弹。
- 验证 URL 导入只在当前客户的 Aidreamcapes 资产目录创建图片，不改任务字段之外的产品事实，不创建真实生成任务。
- 清楚区分现阶段“导入商品主图与标题”和未来“商品资料识别并创建草稿”；mock 验收不得把未实现的完整 URL-to-Video 当作通过。

**通过条件：** 所有导入测试只访问本地 fixture；恶意目标被拒绝；普通 fixture 能生成可预览且归属正确的测试资产。

### P0.6 字幕、合片与音频后处理

- 用本地合成音视频 fixture 和 mock ASR response 测试音轨检查、SRT 时间格式、多个 shot 的时间偏移、台词核对、三种字幕样式、背景音乐混合和最终时长。
- 覆盖无音轨、静音、空识别、ASR 错误/超时、台词不匹配、越界时间戳、字幕跨镜头、FFmpeg/ffprobe 不存在及中途磁盘写入失败。
- 验证失败时清理中间私有文件、不留下成功状态、不返回失效的最终 URL；重试创建新 render version，不破坏历史任务。
- 确认字幕只在支持的口播场景和 mock ASR 可用时开放；关闭字幕时仍能正常合片与下载。

**通过条件：** 每个成功 fixture 产生有效本地 MP4 与 SRT；每个失败 fixture 返回可恢复错误；所有下载通过 P0.3 output API 的所有权检查。

### P0.7 角色卡、资产和音乐功能

- 验证 53 张角色卡目录数量、ID 唯一性、男女分类及图片/试听路径存在；读取角色目录不调用生成供应商。
- 验证选择角色后 task、storyboard 和 shot version 的 actor ID 稳定；当前阶段 voice ID 作为服务端 mock 字段进行映射契约检查，不请求 TTS。
- 验证客户头像上传、年龄/性别/语言校验、删除保护及角色正在被任务引用时的错误处理。
- 用测试音频覆盖格式签名、大小上限、空文件、伪造 MIME、上传中断和跨客户访问；渲染仅消费当前客户自有音乐。
- 样音内容质量与真实声线听感不在无供应商请求的验收范围内；已有音频只检查文件、路由和映射，不重新生成。

**通过条件：** 角色/图像/音频清单完整；上传校验和所有权安全；无供应商调用。

### P0.8 前端页面与浏览器错误清零

- 用 Playwright 通过 mock API 覆盖登录态、创建任务、导入本地商品 fixture、上传素材、选 actor、生成 mock storyboard、编辑/锁定 shot、创建 batch drafts、mock render、下载视频/SRT、Library 恢复及删除。
- 覆盖窄屏/桌面、刷新、后退/前进、多个标签页 revision conflict、加载状态、空列表、错误提示、键盘和可访问性基本交互。
- 浏览器 console 不出现未处理异常；网络面板不向真实 AI/payment/provider endpoint 发请求；所有预期请求命中 mock。
- 检查界面文字不把预设试听样音说成成片音色，不把 batch draft 说成已批量生成，也不把下载误标为社媒直接发布。

**通过条件：** 关键用户流程从头到尾可操作；无 console error、无未处理拒绝、无错误 404/500；测试网络记录中真实生成/交易请求为 0。

### P0.9 内容和站点回归边界

- 将仓库营销文案中的 URL-to-Video、voice clone、字幕编辑、批量生成、音乐库、客户 API、社媒发布、AI Twin、Ad Clone 与当前实现逐项映射。
- 先只产出 owner 和差异清单；若要改公开文案，先核对 Aidreamcapes 当前 `LivePage.contentJson` relational owner 和 revision，不以静态 manifest 或历史 snapshot 为发布/回滚来源。
- 检查本轮变更文件和测试 DB 操作都在 Aidreamcapes 范围；不触碰 MyDreamShoots 公共输出或共享层。

**通过条件：** 每个公开功能承诺都有实现/权限/状态依据，未实现项已移入计划或标为不可用；Aidreamcapes 隔离范围通过审阅。

## 6. P0 完成定义

P0 全部通过后，交付：

1. 稳定的本地/测试 schema 与可重复迁移记录。
2. `INTERNAL_STABLE_WITH_MOCKS` 模式和默认阻止真实外部请求的机制。
3. API 契约、任务状态图、错误码及素材所有权清单。
4. 修复后的 MP4/SRT 下载路径和本地 fixture 渲染报告。
5. mock 供应商、mock 账务和浏览器自动化验收记录。
6. 未完成项、已知限制、营销文案差异及后续 P1/P2 排期输入。

P0 通过只证明内部逻辑稳定；不能据此宣称真实供应商生成、精确角色音色、口型质量、生产数据库迁移、真实扣费或一键发布已验证。

## 7. P1：核心产品功能补齐

P0 通过后按以下顺序继续；开发期间仍先用本地 fixture/mock 验收：

1. **URL-to-Video 草稿闭环：** 从商品页提取允许的字段，展示来源和置信度，由用户确认后写进任务 brief，再生成草稿和分镜；不自动把未核实价格/评价当成事实。
2. **角色卡音色快照：** 角色卡仍是唯一用户入口；稳定 actor→voice ID 只做服务端绑定，保存至 task/shot version。实现 provider adapter contract，但用 mock 检查请求参数，不在本阶段真实调用 TTS。
3. **字幕人工修订：** 增加识别文案改正、逐句时间/位置样式控制、重新烧录和 SRT 下载；字幕错误不强迫用户重生成视频。
4. **实际批量编排：** 在现有批量草稿上增加 batch/job group、组合参数、最大并发、逐项状态、取消、部分失败恢复和模拟费用预估；先通过 fake runner。
5. **基础编辑：** 排序/裁切时段/速度/叠字/CTA/音量；每次改动生成新 render version，保留原始 clip 与历史版本。
6. **格式与语言配置：** 从平台能力配置派生比例、时长、语言可选项；不展示未配置选项，不承诺超出 provider capabilities 的输出。
7. **产品事实与品牌 brief：** 保存用户确认的产品信息和品牌语气，复用到后续任务；提供字段来源和编辑记录。

## 8. P2：竞品差距和规模化功能

- 授权音乐目录与音乐生成。
- TikTok/Meta/YouTube OAuth、定时发布、状态回读和撤销。
- AI Twin/声纹克隆：复用已有授权、删除与审计后端，补齐运行库部署、私有工作台、真实声音与人物链路；见[专项计划](aidreamcapes-ai-twin-ad-clone-remediation-2026-10-15.md)。
- Ad Clone：复用已有 ad_reference 模拟作业，补齐 MP4 分析、商品替换与草稿回填；广告链接导入在 MP4 闭环后实施。
- 多人团队、品牌空间、角色与素材共享。
- 对外 API、webhook、key 管理和用量限额。
- 广告表现回流、素材对比和迭代建议。
- 4K、AI 视频延长、角色替换、更多镜头编辑与高级生成工具。

P2 每项进入开发前需单独定义权限、成本、风险、用户流程和维护责任；不因竞品具有该项就自动加入。

## 9. Bug 分级与验收门槛

- **S0 阻断：** 跨站/跨客户数据泄露、真实供应商/账务被 mock 测试触发、错误扣减测试外账户、数据不可逆损坏。出现即停止验收。
- **S1 高：** 核心流程 5xx/卡死、下载失效、任务状态错误、重复任务/重复账务、文件 owner 校验绕过、上传路径可读他人素材。P0 不通过。
- **S2 中：** 某场景或主要交互无法完成，但有清楚错误且无数据损坏；须修复或从本轮能力范围中关掉。
- **S3 低：** 不影响正确性/安全的视觉或非关键文案问题；登记后可进入 P1。

P0 要求所有 S0/S1 清零；S2 只可在功能明确关闭、文案真实且不会导致错误状态时暂存；S3 有负责人和后续项。

## 10. 依赖资料和主要代码入口

- 差距清单：`docs/plans/aidreamcapes-aivideosugc-feature-gap-audit-2026-10-14.md`
- 逐项整改计划：`docs/plans/aidreamcapes-aivideosugc-latest-remediation-plan-2026-10-14.md`
- UI：`src/components/aidreamcapes-workspace/workspace.tsx`
- URL 导入：`src/components/aidreamcapes-workspace/product-url-import.tsx`、`src/lib/product-url-import.ts`
- 工作台 API：`src/app/api/sites/[siteId]/aivideosugc/`
- 业务逻辑：`src/lib/aidreamcapes-workspace/api.ts`、`provider.ts`、`pipeline.ts`、`runner.ts`、`store.ts`
- 合片字幕：`src/lib/aidreamcapes-workspace/media-render.ts`
- 专用存储结构：`scripts/setup-aidreamcapes-workspace.mjs` 及对应迁移/schema
