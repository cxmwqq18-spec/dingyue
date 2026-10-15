# Aidreamcapes AIVideosUGC P0–P2 实施与统一验收记录

- 日期：2026-10-14
- 范围：`site_aidreamcapes` AIVideosUGC 私有工作台后端、配套工作台交互、mock 浏览器验收，以及此前授权的平台 AI 供应商兼容回归。
- 目标：`INTERNAL_STABLE_WITH_MOCKS`
- 验收边界：不调用真实生成供应商、ASR/TTS/音乐服务或社媒平台；不执行生产数据库迁移，不发生真实交易、积分变更、OAuth 或发布。

## P0–P2 完成状态

| 优先级 | 任务 | 实施情况 | 统一验收 |
|---|---|---|---|
| P0 | 客户登录/注册与生成积分门槛 | 登录、注册、密码重置入口与站点客户会话仍存在；收费生成由客户会话、站点归属、CSRF、签名 quote 和积分余额共同保护 | 付费匿名门禁通过；92 个 API 方法离线矩阵中，91 个受保护方法均在下游副作用前返回 401。完整验收未通过：未计费的草稿、素材、商品预览及部分音乐预览也提前要求登录；另有验证码泄漏、尝试次数事务回滚、旧注册入口未验邮箱、封禁账户可登录、重置未撤销旧会话和弱密码哈希等问题 |
| P0 | 默认阻止真实外部生成和账务副作用 | 稳定模式默认 fail-closed；mock provider、mock quote/ledger、合成媒体与外部调用计数器已接通 | 通过；生成、provider、worker、真实 ledger、外网请求计数为 0 |
| P0 | Aidreamcapes 任务、角色及相关作业持久化 | 增加任务、角色、batch、team/brand、发布、clone、分析、音乐、webhook、feature 和取消所需结构与站点约束 | 通过；9 个 Aidreamcapes 专用迁移已在临时 PostgreSQL 18 合成库顺序应用；owner/revision/CAS/readback 测试通过 |
| P0 | 任务闭环、取消、恢复、输出下载与路径安全 | 新建/读取/修订/动作/取消/SSE、MP4/SRT/clip 下载与 owner/path/version 检查；取消状态持久化 | 通过；draft→mock storyboard→shot→本地 render→下载→Library 恢复，重复取消、并发 revision 和非法路径均有覆盖 |
| P0 | 53 张角色卡与角色音色快照 | 53 个角色数据完整；任务快照保存 actor/voice；服务端验证角色性别与音色性别一致；mock namespace 不触发 TTS；53 份 speech-2.8 试听 MP3 已由用户人工听审 | 通过；目录数量、唯一 ID、性别映射和 snapshot 绑定通过。人工试听不代表真实视频 TTS 或口型链路已接通 |
| P0/P1 | URL 商品预览、确认 brief 与草稿更新 | HTTPS 商品预览、来源/置信度、确认字段持久化；既有草稿可按 revision 修改 brief；未确认价格不作为生成事实 | 通过；预览 UI/API、确认、owner/revision、持久化与回读 smoke 通过；未抓取真实电商页面 |
| P0/P1 | 字幕调整、SRT、合成与历史版本 | 字幕 cue 编辑及时间校验、revision guard、SRT 导出、新 render version；本地 FFmpeg/libass 合成 | 通过；重叠/越界/旧 revision 拒绝，字幕烧录、MP4/SRT 和旧版本保留均通过 |
| P0 | 客户素材和站点归属 | 对输入图、角色资产、音乐、clip、render 和输出执行 Aidreamcapes/customer owner 校验 | 通过；跨站、跨客户、伪路径及符号链接测试通过 |
| P0 | 浏览器关键流程 | Playwright mock 覆盖角色列表/性别筛选/搜索、窄屏、创建任务、字幕状态、MP4/SRT 下载、Library 回读 | 通过；1440×1000 与 390×844 均通过，无应用 console error、失败本地请求或未处理异常 |
| P0 | storefront 写入隔离 | 本轮无公共 storefront、LivePage、SEO、媒体或导航数据写入；工作台保持私有路由/API | 通过文件范围复核；完整的营销文案承诺审计不属于本次后端验收，未在本轮改写或发布 |
| P1 | 批量草稿、并发、取消、失败恢复 | 1–10 项原子/幂等创建，owner/revision guard、并发上限、取消、部分失败和恢复；runner 保持 mock/no-op | 通过状态机 smoke；真实批量视频生成与逐项真实计费仍关闭 |
| P1 | 基础成片编辑 | clip 排序、裁切、速度、叠字/CTA、音轨/音乐混合；每次编辑保存新 render version | 通过；FFmpeg 合成、输出尺寸/时长、版本历史、音乐归属和路径检查通过 |
| P1 | provider 能力门控 | 时长、画幅、语言/语音及高级能力由配置派生；不可用选项服务端拒绝 | 通过能力目录/服务端校验 smoke；provider 实际生成未验收 |
| P1 | 产品 brief 和确认事实 | 来源 URL、置信度、用户确认状态及 task revision 持久化；价格等未确认字段隔离 | 通过 persistence、patch 与 UI smoke |
| P2 | 团队、成员、邀请、品牌与事实确认 | owner/admin/editor/viewer 权限，邀请归属、品牌修订和有来源事实审查 | 通过；跨站和权限边界 smoke 通过 |
| P2 | Developer API key、API task draft 与 webhook | 一次性 secret/hash、scope、撤销/过期/限流、idempotency；webhook 加密配置与投递开关 | 通过；injected transport、重试/签名/权限测试通过；测试网络请求计数为 0 |
| P2 | 社媒发布 | capability、预览、排队、调度、取消/重试状态已实现；无 OAuth/adapter 时保持 disabled/not_configured | 通过；mock contract 通过；无真实 OAuth 或发布 |
| P2 | 声纹克隆与广告参考 | consent revision、来源归属、撤销、删除/取消和 mock job 状态机 | 通过；mock-only；没有读取/训练真实声音或抓取外部广告 |
| P2 | 广告表现分析 | 客户导入报表，owner/team/date/currency 隔离、币种精度、CTR/CPA、素材汇总 | 通过纯逻辑与路由契约 smoke；未连接广告平台 OAuth |
| P2 | 授权音乐目录与权利检查 | 授权记录、地区/用途/期限/归属/署名检查、试听路径防穿越与任务附加 | 通过 rights、preview containment 和 task selection smoke |
| P2 | AI 音乐生成 | 默认 `not_configured`/关闭；显式 mock 可生成确定性 WAV 并测试状态、取消和附件规则 | 通过；mock WAV 不作为已授权商用音乐，真实音乐供应商调用未开放 |
| P2 | 4K、视频延长、替换演员等高级工具 | feature capability 与客户 job/state routes；未明确启用的能力 fail-closed | 通过 feature contract smoke；默认不可用，不触发真实 provider |
| 回归 | 既有平台视频供应商配置 | 保留已有 adapter；供应商协议选择、启用策略、priority-first fallback 与拒绝后的回退兼容 | 两个 provider availability/priority 回归 smoke 通过；全局供应商迁移未应用到临时 Aidreamcapes DB |
| 回归 | AI 供应商维护工作台 | 图片/视频/文本/音频类型可配置；音频配置目前不代表音频任务执行能力；Yingling 已有视频 adapter 路径 | 离线 audio CRUD/UI、Yingling 路由分类、视频优先级/worker fallback 回归通过；无 live connectivity 或生成请求 |

## 统一验收结果

通过的主要检查：

- `npm run typecheck -- --pretty false`
- `npm run lint`（退出码 0；仓库现存 warning 保留）
- `npx prisma validate --schema prisma/schema.prisma`
- Aidreamcapes isolated PostgreSQL `check-store.mjs --isolated-acceptance`：站点/客户归属、并发 revision、持久化恢复通过
- `smoke-stability`、`smoke-capabilities`、`smoke-feature-contracts`、`smoke-asset-contracts`
- `smoke-mock-workflow`、`smoke-task-cancel`、`smoke-editor`、`smoke-captions`、`smoke-workspace-render`、`smoke-workspace-pipeline`、`smoke-workspace-voice`、`smoke-workspace-batch`
- `smoke-product-brief-persistence`、`smoke-product-brief-patch`、`smoke-product-brief-ui`
- `smoke-teams-brands`、`smoke-developer-webhooks`、`smoke-publishing`、`smoke-clones`、`smoke-analytics`
- `smoke-music-catalog`、`smoke-music-generation`
- Playwright `smoke-browser-mock`：桌面/窄屏、任务与下载/Library 流程；应用 console errors、failed local requests、unhandled APIs 均为 0
- `smoke-video-provider-availability-runtime`、`smoke-video-provider-priority-fallback`
- `git diff --check`

## 2026-10-14 复验补充

### 公开商品页导入

- 用无痕 Chrome 打开 BAGGU 商品页 `https://baggu.com/products/medium-nylon-crescent-bag-black-and-cream-polka-dot`，再调用本地真实 preview/import helper。
- Preview 从 JSON-LD 得到商品名 `Medium Nylon Crescent Bag`、未确认价格 USD 56.00 和一个主图候选；页面没有 description。导入 helper 下载并校验了 Shopify CDN JPEG（2048×2560，124171 bytes）。本次 `persisted: false`，没有调用本地客户 API、写数据库或保存资产。
- 同一轮商品 brief UI、persistence、patch 三项既有 smoke 均通过。该结果证明页面解析与图像获取可工作，不证明用户登录后的 UI→API→客户资产持久化端到端；商品页实测使用的 helper 按要求没有调用持久化 API。

### P0–P2 回归重跑

- `npm run typecheck -- --pretty false`、`npm run lint`、Prisma schema validate 通过；lint 退出码为 0，仓库有 268 条 warning、0 error。Prisma validate 通过时提供了仅用于校验的本地占位 `DATABASE_URL`，没有连接数据库。
- 稳定性、能力/资产/feature 契约、任务与 render、编辑、字幕、角色音色、批次、商品 brief、团队/品牌、developer/webhook、publishing、clones、analytics、music catalog/generation，以及现有视频 provider availability/priority 等离线 smoke 均通过；新加 audio provider smoke 也通过。Mock 测试未触发外部 provider、积分/ledger 或交易。
- 本轮在 `/tmp` 创建了独立 PostgreSQL acceptance 库，补入合成 Aidreamcapes 基表后顺序应用 9 个专用迁移；`check-store.mjs --isolated-acceptance` 的租户约束、并发 revision、owner readback 与恢复检查通过。临时 PostgreSQL 已停止，精确临时目录 `/tmp/aidreamcapes-acceptance.CYEcuR` 已删除。
- Playwright `smoke-browser-mock` 本轮仍**未能重跑**：脚本把应用数据库目标固定为 `127.0.0.1:15433/dingyue_local`，该端口被其他环境 SSH 隧道占用；安全校验阻止了指向 55439 测试库的覆盖，因此没有连接 15433、启动应用或发送 API 请求。此前统一验收记录中的浏览器 mock 通过结果仍保留，但本次没有重新确认。

### AI 供应商工作台现状

- 已补上独立音频类型的后台新增/筛选/编辑与 API/store 读写，数据继续使用字符串 `providerType`，无需 schema migration；空白 API Key 编辑保留旧密钥，列表响应仍只返回掩码。管理面明确写出音频任务 adapter 尚未接入，禁用音频生成暗示。
- Yingling 适配目前覆盖视频创建/状态轮询与只读 `/v1/models` 连通检查；本次只通过本地离线协议和回退 smoke 检查代码，没有读取线上 key、修改供应商配置或访问 Yingling 服务。图片/音频 Yingling adapter 与实际多图/音频协议均未验收。

### 登录/注册与积分生成门槛

- 登录页仍提供登录、注册和密码重置模式。Aidreamcapes 入口为 `/site/aidreamcapes/login`；站点 JSON 登录、邮箱验证码、登出 API 分别是 `/api/sites/site_aidreamcapes/auth/login`、`/auth/email-code`、`/auth/email-verify`、`/auth/logout`。旧表单提交 `/site/aidreamcapes/login/submit` 仍会把不存在的邮箱直接创建为客户，因此旧入口可以绕过邮箱验证。
- 按用户授权，通过工作区配置的 `dingyue_local` 连接执行了限定 `siteId = site_aidreamcapes` 的只读聚合查询。查询到 3 条客户记录：3 条为 active、0 条非 active；3 条均有当前代码识别的 `sha256:` 密码哈希格式，0 条缺少哈希，0 条使用其他格式。未读取邮箱、密码哈希明文或会话，不做真实账户登录、密码猜测或重置；因此该结果只核实记录存在且格式匹配，不能证明某个账户的密码正确。实际数据库迁移版本未查询。
- 登录/注册/邮箱验证码/会话/CSRF 等实际 helper 与 route 源码通过 30 项离线合成检查。检查覆盖注册、正确/错误密码、站点与会话过期隔离、登出、邮箱码重放、积分赠送、密码重置、cookie 属性、CSRF、限流与无效凭据处理；没有真实数据库、邮件发送或客户会话副作用。
- 付费动作的 92 项 API 方法矩阵（67 个 route 文件）离线通过：91 个受保护方法在解析请求内容、quote、积分预留、账本、任务/素材存储、worker/provider 之前返回 401；唯一公开的目录 GET 返回 200 且只读。合成登录会话通过 owner、CSRF 与签名 quote 检查；图像提交返回 202 但由合成 submit/dispatch stub 处理，没有真实任务、供应商或积分请求。`reserveCreditsForJob` 合成事务测试中，余额不足返回 402 且不预留；余额 1000、费用 24 时产生 24 reserved，重放保持幂等。完整生产提交事务只做了静态检查，没有真实账务调用。
- 当前未登录用户可以打开工作台视图、浏览初始角色目录并切换 agent/images/actors/inspirations/library；需要改为可访客预览的非计费操作仍被挡住：新建/复制视频草稿和 batch 在发请求前跳登录（`workspace.tsx:321,344,571`，API `POST tasks`、`POST tasks/batch` 返回 401）；参考素材上传在文件准备前要求登录（`workspace.tsx:401,451,510`）；商品 URL 预览在没有 customerId 时提前退出（`product-url-import.tsx:133,282-306`，`POST tasks/product-brief` 返回 401）；音乐目录/试听/能力、clones 和 publishing capabilities 的 GET 也要求登录。角色卡浏览本身通过。
- 安全验收未通过的现存问题（只审查并复现，本轮没有改代码）：`customer-email-auth.ts:56-58,141-179` 在生产邮件发送失败时仍会把验证码放进 `devCode`；`customer-email-auth.ts:267-304` 对错误验证码的 attempts 更新后抛异常，事务回滚会撤销计数与消费；旧表单登录链路 `customer-auth.ts:20` → `customer-store.ts:75-92` 可未验邮箱自动注册；`customer-store.ts:168-174` 未检查客户 status，封禁账户仍可建立会话；邮箱密码重置 `customer-email-auth.ts:229-245` 不删除旧会话；`prisma-mappers.ts:270-275` 使用无盐 SHA-256 保存密码。需在作为完整客户认证功能验收前修复并复测。
- 本门禁矩阵只执行离线 route/client 抽取与合成 helper 测试，不是挂载浏览器的完整注册/登录流程。匿名请求的真实 provider/账务/worker/数据库/网络副作用均为 0；认证后路由使用合成 session、synthetic submit/dispatch 与预留 fixture，未运行延迟 callback。

### 前端工作台页面缺口

2026-10-15 AI Twin / Ad Clone 实施补充：私有业务表单及授权/模拟任务、角色绑定、广告结构到确认商品草稿关联已接通；本地运行库两张克隆表与 taskless 增量迁移已安装。真实本地 HTTP 通过 68 项断言，未调用真实供应商或账务；真实人物/声音克隆、ASR/视觉广告解析仍未完成，生产未部署。详细证据与剩余项见[专项整改计划第 8 节](aidreamcapes-ai-twin-ad-clone-remediation-2026-10-15.md#8-2026-10-15-并行实施与验收记录)。

静态核对目标工作台 `/site/aivideosugc/app`、`/app/create` 和 `workspace.tsx` 的导航/视图，并对照 `src/app/api/sites/[siteId]/aivideosugc/` 路由：

| 能力 | 工作台页面现状 | 后端状态 |
|---|---|---|
| AI Image | 有生成视图，可从 Home 的 AI Image composer tab 进入；侧栏没有独立入口 | 有图片 quote/job API；真实供应商调用不在本轮验收范围 |
| AI Twin、Ad Clone | 已接入私有表单、授权/模拟作业、角色绑定与草稿回填 | 本地数据库及内部流程通过验收；真实训练/解析仍不可用 |
| Refer & Earn | 仍为未开放入口 | Referral 页面/API 未见可用实现 |
| 团队与品牌 | 没有对应客户工作台页面 | teams/brands/facts API 与数据规则已实现并有 mock smoke |
| 分析 | 没有分析看板页面 | analytics API 接受客户导入报表并可汇总；没有外部广告 OAuth/自动回流 |
| 开发者 API 与 webhooks | 没有密钥、scope、文档或 webhook 管理页 | key/task/webhook API 已实现，默认安全设置通过 mock smoke |
| 社媒发布 | 没有账号连接、排期或发布管理页 | preview/queue/job API 有限实现；OAuth 与平台 adapter disabled/not_configured |
| 音乐 | 视频编辑中只有选择/上传入口，没有音乐目录或生成管理页 | 音乐目录、授权和生成 API 有 mock 状态机；真实音乐供应商未接入 |
| 批次与高级任务 | 有批量草稿对话框，没有批次运行/监控工作台；高级 feature jobs 无独立页面 | API/state machine 已有；批次 runner mock/no-op，高级工具默认关闭 |

以上为仓库页面与 API 路由的静态对应，不代表线上菜单实时读回。`/app/create` 目前默认打开视频 agent 视图；AI Image 等视图通过 query/home composer 进入。

数据库检查在本机临时 PostgreSQL 18 实例执行，数据库为 `aidreamcapes_acceptance`，仅含合成 Aidreamcapes 站点、客户和必要资产基表。按顺序应用 9 个 `20261014130000` 至 `20261014210000` 的 Aidreamcapes 专用迁移；未连接或迁移共享/生产数据库。`20261014120000` 是平台级 provider 配置迁移，不属于这 9 个 Aidreamcapes 专用迁移，也未在该最小基表上执行。

## 验收边界和剩余限制

- `INTERNAL_STABLE_WITH_MOCKS` 只证明内部逻辑与 mock 状态流转，不证明真实视频输出中的声线/口型、生产 worker 拓扑或生产数据安全读回。53 份角色试听 MP3 已由用户人工听审，但这不等于真实视频 TTS adapter 已接通。
- 实际视频/图片/TTS/ASR/AI 音乐 provider、真实账务、真实批量生成、社媒 OAuth/发布、真实声纹训练和广告抓取均未启用或调用。
- 客户认证安全修复已通过本轮离线合成回归；真实客户密码和数据库登录未验证。未计费访客预览限制仍未满足“付费生成时才要求登录”的体验规范。匿名付费生成门禁此前通过。
- Batch 当前验证的是批次状态编排与 mock/no-op runner；不能宣传为已完成实际批量出片。
- AI 音乐生成的 WAV 是合成 mock 测试产物，默认不可用且不含商用授权；商用附件仍必须通过授权目录许可校验。
- 不部署、不写生产数据库、不修改公共页面。Aidreamcapes 与 MyDreamShoots 代码/内容隔离按最终 diff 清单复核；本轮未更改 LivePage 或 public storefront 输出。

## 2026-10-15 认证门禁与回归复测

- 重新运行 8 项 `scripts/aidreamcapes-workspace/smoke-*.mjs` 离线用例，以及 analytics、clones、developer/webhooks、music catalog/generation、product brief patch/persistence/UI、publishing、teams/brands、batch、pipeline、render、voice 和 audio provider 共 15 项用例。全部通过；mock 外部请求、真实供应商、真实账务/积分调用计数为 0。
- `npm run typecheck -- --pretty false` 通过；`npm run lint` 退出码为 0，仍有 268 条 warning、0 error；`git diff --check` 通过。工作区没有新增业务代码修改。
- 回归确认付费图片生成路由要求登录、站点客户会话、CSRF 与有效签名报价，并先检查可用能力和余额；离线模拟覆盖余额不足、预留、幂等重试。此前发现的未计费访客操作仍会提前跳登录，完整满足“付费生成时才登录”的 P0 验收仍未完成。
- 当时识别的登录/注册安全问题位于跨站共享模块；用户随后明确授权整改。本轮已修复这些问题并追加离线回归，详情见下方“认证整改后复测”。
- `npm run audit:store-isolation` 的默认比较对象为 Grownstride 测试站和 MyDreamShoots；该只读检查以媒体命名空间规则报告了两边已有资产不匹配（Grownstride 23 条、MyDreamShoots 750 条），且未发现共享记录 ID。该问题不属于本次 Aidreamcapes 认证/生成整改范围，未改动 MyDreamShoots 内容或资产。

### 2026-10-15 认证整改后复测

- 新密码改为带独立随机盐的 scrypt 哈希；旧 `sha256:` 密码仍可登录，成功后升级为 scrypt，避免现有客户凭据被整体失效。客户登录、站点管理员登录和平台管理员登录共用该兼容校验。
- 注册仍必须完成站点邮箱验证码验证；旧 HTML 表单仅允许已存在客户登录。生产环境验证码发送失败时不返回验证码或邮件供应商错误详情；错误验证码次数在事务提交后保留，连续 5 次失败会消费验证码。
- 被封禁客户不能登录或通过密码重置恢复；封禁操作删除现有客户会话。密码重置删除旧会话并保留原客户状态；客户会话改为每次根据数据库状态确认，覆盖多应用实例间的撤销。
- `node scripts/smoke-customer-auth-hardening.mjs` 通过；`npm run typecheck -- --pretty false` 通过；本次认证相关 ESLint 0 error、4 条 `site-store.ts` 既存 warning；`git diff --check` 通过。没有连接客户数据库、尝试真实客户登录、读真实密码或修改数据库。
- 只读 `smoke-customer-account-center.mjs` 因未修改的共享账户组件缺少该 smoke 要求的主题持久化标记而失败；该 UI 检查不属于此次认证修复，本轮未更改账户页面。未计费访客预览需要的登录放宽也仍待单独完成。
- 本轮仅改共享认证后端、认证离线 smoke 和本内部状态文档；工作台、账户页面、站点文案及公开 storefront 数据未修改。登录表单错误使用现有的邮箱/密码错误文案键。
