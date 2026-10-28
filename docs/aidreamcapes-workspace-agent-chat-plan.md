# 工作台 Agent 对话功能方案（aidreamcapes）

日期：2026-10-28 · 状态：已批准（免费+限额；模型由站长稍后在网关配置；入口名「AI 助手」）

## 目标

在 aivideosugc 工作台左侧「创造」组新增一个 **AI 助手（Agent 对话）** 入口，
登录客户可以与对话模型进行多轮对话（流式回复、历史持久化、可删除会话）。
上游 API 走 DreamOps AI 网关已配置的 OpenAI 兼容渠道
（`https://www.mysub2api.top`，providerType=text），**API-key 由站長在网关后台自行维护**，
任何 key 都不进前端、不进代码仓库。

## 现有基础设施（调研结论，全部只读核实）

| 组件 | 现状 | 复用方式 |
|---|---|---|
| `PlatformAiProvider` 表 | DreamOps AI 网关的供应商注册表，含 `providerType`（image/video/**text**…）、`aiUrl`、`apiKey`、`enabled`、`priority` | 新增一条 providerType=text 的记录即可，key 存这里 |
| `generatePlatformText`（`src/lib/platform-text-provider.ts`） | 已实现 OpenAI 兼容 chat/completions 客户端 + text 类型供应商选择（按 enabled→runnable 取第一个） | 直接复用；另写流式变体 |
| DreamOps 网关 UI（`mydreamshoots.xyz/platform?module=gateway`） | 已支持增删改 provider、设优先级、禁用；text 类型协议白名单已含 `openai-compatible` | 站长自行维护 key/模型，无需改网关 |
| 工作台模块体系（`WORKSPACE_MODULES` + 动态 import workbench 模式） | 左侧导航分组渲染、每个功能一个独立 workbench 组件（参照 analytics/twin/ad-clone） | 新增 `chat` 模块与 `agent-chat-workbench.tsx` |
| 客户鉴权 | `/app` 路由均为登录态客户 API（customer session + CSRF） | 沿用 `customerJsonHeaders`/`request` 封装 |

> 结论：**不需要**引入新的 SDK 或直连 mysub2api；一切经网关配置解析，换 key/换模型零代码改动。

## 功能设计

### 入口与信息架构
- 左侧「创造」组新增模块 `chat`，英文源码名 **AI Assistant**（浏览器翻译为"AI 助手"），图标用 lucide `MessageSquare`。
- 路由：`/app/create/ai-assistant`（沿用 static-routes 映射模式）。
- 页面结构（参照既有 workbench 布局）：
  - 左栏：会话列表（标题 + 最近时间），「新建对话」按钮，删除会话。
  - 右栏：消息流（用户/助手气泡，markdown 渲染，流式逐字），底部输入框（Enter 发送 / Shift+Enter 换行），生成中可停止。
  - 空态：3-4 个示例引导问题（真实用户文案，如"帮我把这个产品卖点写成短视频脚本"）。

### Agent 能力边界（分期）
- **Phase 1（本次）**：纯多轮对话 + 系统提示词（定位：短视频创作助手，可用中文/英文回答）。
  可选注入轻上下文：客户最近 5 个任务的标题/状态摘要，让助手能谈及"你的库里的视频"（只读、脱敏、不含积分数据）。
- **Phase 2（另行排期）**：工具调用——由助手发起"创建视频任务/查库/跳转"等动作（需单独评审动作白名单与确认弹窗）。

### 数据模型（新增 2 张表，字段级新增，不动现有表）

```
model AiChatConversation {
  id          String   @id            // conv_<uid>
  siteId      String                  // CHECK = site_aidreamcapes（沿用站点隔离模式）
  customerId  String
  title       String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([siteId, customerId, updatedAt])
}
model AiChatMessage {
  id             String   @id        // msg_<uid>
  conversationId String
  siteId         String
  customerId     String              // 冗余存储，查询与审计不 join
  role           String              // user | assistant
  content        String
  providerId     String?             // 审计：来自哪个网关供应商
  createdAt      DateTime @default(now())
  @@index([conversationId, createdAt])
  @@index([siteId, customerId])
}
```

### 后端 API（全部登录客户态，挂在既有 aivideosugc API 域下）

| 路由 | 方法 | 说明 |
|---|---|---|
| `/chat/conversations` | GET / POST | 列表（≤50）/ 新建 |
| `/chat/conversations/[id]` | GET / DELETE | 取会话全部消息 / 删除 |
| `/chat/conversations/[id]/messages` | POST | 发送消息；**流式返回**（SSE 透传 upstream delta），落库后返回完整记录 |

- 供应商解析：复用 `generatePlatformText` 的选择逻辑（providerType=text、enabled、runnable），并**新增流式函数** `streamPlatformTextProvider`（同 URL，`stream: true`，SSE 逐 delta 透传 + 服务端聚合落库）。
- 错误处理：`text_provider_not_configured` → humanError「AI 助手暂未开放，请稍后再试」；upstream 4xx/5xx → 统一文案，不暴露 key/URL 细节。
- 停止生成：客户端 abort → 服务端 AbortController 级联，已生成部分照常落库。

### 限额与安全
- 速率：每客户 10 条/分钟、200 条/天（进程内计数即可，Phase 1 不引入新依赖）；超限返回明确文案。
- 单条输入 ≤ 8000 字符；会话窗口裁剪：只带最近 20 条消息进 upstream，防止上下文超长。
- key 只存在于 `PlatformAiProvider.apiKey`（网关后台维护），服务端读取；日志/错误信息一律不含 key。
- 审计：每次调用记录 providerId + 消息 id（表内字段），复用站点隔离 CHECK 约束模式。
- 隐私：会话归属 customerId，删除会话物理删除消息；不做任何跨客户读取。

### 前端要点
- 动态 import `AgentChatWorkbench`（不进首屏 bundle，参照 DeveloperWorkbench 的 loading 模式）。
- markdown 渲染用轻量方案（已有依赖优先；无则引 `marked`+ sanitize，禁 raw HTML）。
- 上传图片控件规范沿用刚统一的 UI 基线（本功能 Phase 1 不涉及上传）。
- 界面文案为英文源码 + 浏览器翻译，遵守公开文案边界：示例问题、按钮、空态全部是面向终端用户的真实文案；系统提示词是服务端内部配置，不进前端。

## 实施阶段

| 阶段 | 内容 | 产出 |
|---|---|---|
| P1 数据层 | Prisma 2 表 + 迁移（ aidreamcapes 专用 CHECK） | schema + migration |
| P2 后端 | 会话 CRUD + 消息发送（先非流式跑通，再上 SSE 流式）+ 限额 + 错误映射 | 4 个 route.ts + `agent-chat.ts` service |
| P3 前端 | 导航模块 + workbench（会话列表/消息流/流式渲染/停止/删除） | `agent-chat-workbench.tsx` + css |
| P4 回归 | smoke：未登录 401、限流、供应商缺失文案、删除隔离、站点隔离（site_aidreamcapes 之外的 site 不可见） | 扩展 smoke 脚本 |
| P5 部署 | 3013 prebuilt 管线；网关后台由站长添加 text 供应商后线上即通 | 上线验证 |

## 需要站长拍板的 3 个决定

1. **计费**：Phase 1 建议**免费 + 限额**（10 条/分、200 条/天），不接积分冻结（对话成本与视频不同量级）。
   若要扣积分，告知每条消息扣多少，P2 加入 ledger 记录。
2. **模型**：网关里这条 text 供应商用哪个模型（如 gpt-5.5）？填好后 P2 联调直接用。
3. **入口名称**：「AI 助手」是否合适？（源码 AI Assistant，中文由浏览器翻译呈现）

## 验收清单（P4 通过标准）

- [ ] 未登录调用全部 401；跨客户/跨站点不可见（SQL 级隔离）。
- [ ] 对话流式输出可见、可停止、刷新后历史完整。
- [ ] 网关禁用 text 供应商后，前端得到友好文案而非报错堆栈。
- [ ] 限流生效且文案明确。
- [ ] 站长在网关改 key/换模型，无需改代码，下次请求即生效。
