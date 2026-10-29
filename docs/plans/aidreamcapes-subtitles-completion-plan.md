# 字幕补全（Subtitle Completion）模块执行计划

日期：2026-10-29。站点：`site_aidreamcapes`（aivideosugc.com）。范围：私有登录工作台 `/app/create/*`，不涉及公开 storefront 页面。

## 1. 目标

1. 工作台侧边栏「创作」组（人工智能助手之后）新增 **字幕补全** 模块。
2. 模块页：选择一个已完成视频 → 点选操作标签（生成字幕 / 宣传语句 / 文案 等，后端硬编码）→ 后端把对应硬编码指令 + 视频上下文发给对话模型（GPT）→ 结果驱动一次视频后处理 → 新视频回到用户的图书馆列表。
3. 图书馆卡片（查看详情旁）新增「补全字幕」按钮，点击跳转到字幕补全页并预选该视频。

## 2. 两个必须先对齐的技术判断

### 2.1 GPT 不能直接改视频像素

对话模型只能产出**结构化编辑指令**（字幕文本/样式、覆盖文字、CTA、口播文案、分镜建议）。真正的视频变动由后端已有的 FFmpeg 后处理管线执行：

- 字幕烧录：`media-render.ts` + `editor.ts`（`remapCaptions` + FFmpeg `subtitles=` 滤镜）。
- 覆盖文字 / CTA：`editor.ts` `outputVideoFilter`（drawtext）。
- 渲染产出：`renderEditedVideo` → `videoHistory`，原视频保留为历史版本，`task.video.finalUrl` 更新 → 图书馆卡片直接显示新版本，下载地址 `/output?kind=video` 不变。

因此"发送给 GPT 执行调整"落地为：**硬编码指令 → GPT 返回 JSON 编辑方案 → 后端按方案渲染**。

### 2.2 "生成字幕"依赖语音识别

系统已具备 ASR：`media-render.ts` `measuredSpeechCues`（whisper-1，`AIVIDEOSUGC_ASR_PROVIDER_ID`）。"生成字幕"分两种：

- **A. 视频有台词/脚本**：先把 ASR 识别出的分段时间轴交给 GPT 润色/纠错/翻译成文案字幕，再烧录。
- **B. 无台词依靠画面**：GPT 只能基于产品信息/分镜写营销字幕（overlay 形式），不是"听写"。

上线前需确认生产环境 ASR provider 是否已配置（`workspaceAsrAvailable` 能力位会如实暴露；未配置时按钮灰置并给出说明，而不是假装生成）。

## 3. 现状结论（调研要点，均已核对代码）

| 需求点 | 现状与接入点 |
| --- | --- |
| 新侧边栏项 | `navigation.ts` `WORKSPACE_MODULES`（create 组末尾）+ `workspace.tsx` `moduleIcons` + 内容区 `view === "<id>"` 分支；`/app/create/<id>` 无需新 page.tsx（静态段解析按 view id 兜底） |
| 图书馆卡片按钮 | `library-task-card.tsx` 底部动作区（查看详情/删除旁）加一个动作；`workspace.tsx` `renderTaskCards` 传入回调 |
| 深链预选视频 | 现有 `?task=` 只在 agent 视图被消费（workspace.tsx L478/L560）；需在挂载 effect 为新视图补充 `?task=` 处理 |
| 对话模型调用 | 复用 `provider.ts` `structuredDecision`（JSON mode、mock 分支已有）；异步任务模板参照 `video-prompt-optimizations`（幂等键 + 每日限额 + job 轮询） |
| 字幕能力 | `captions.ts`（读/写 captionLines，revision CAS）+ ASR cue + `captionEdits` 用户确认草稿 |
| 渲染与入库 | `editor.ts` `renderEditedVideo` 同步渲染到不可变渲染目录，PATCH edit 已演示 `videoHistory` 入库模式，库卡片无需改动即可显示 |
| 任务模型 | 任务是单行 JSONB（`AidreamcapesVideoTask`）+ revision CAS，新增可选字段（如 `subtitleCompletion` 历史）无需迁移 |

## 4. 后端设计

### 4.1 操作注册表（硬编码，服务端 only）

新文件 `src/lib/aidreamcapes-workspace/subtitle-ops.ts`：

```ts
export type SubtitleOpId = "captions_polish" | "promo_lines" | "marketing_copy" | ...;
export interface SubtitleOp {
  id: SubtitleOpId;
  label: string;            // 公共文案（按钮标签）
  resultKind: "captions" | "overlay" | "text";
  buildMessages(ctx): ChatMessage[];  // 硬编码系统指令 + 用户提供上下文
}
```

- 所有指令文本只存在此文件（服务端），前端仅展示 label 与结果 — 满足前端文案边界（内部提示词不进 DOM）。
- 上下文组装：任务脚本（fields）、分镜台词、场景名、语言、时长、既有字幕（ASR/captionLines）、产品信息；注入位置与 `video-prompt-optimizer.ts` 相同的防注入清理。

### 4.2 API

`POST /api/sites/[siteId]/aivideosugc/tasks/[taskId]/subtitle-ops`（workspaceAuth + CSRF + 幂等键 + 每日限额，模式照抄 `video-prompt-optimizations`）：

1. 校验任务属于当前客户、状态 completed、`video.finalUrl` 存在。
2. `structuredDecision(op.buildMessages(ctx))` → 解析 JSON。
3. 按 `resultKind` 执行：
   - `captions`：写 `captionEdits`（确认态）→ 复用烧录渲染 → `videoHistory` 入库。
   - `overlay`：生成 overlay/CTA 设置 → 复用 `renderEditedVideo` 入库。
   - `text`：纯文案，仅存任务（`task.revisions` 记录 + 返回给前端复制/下载 txt），不渲染视频。
4. 返回 `{ opId, resultKind, video?: {finalUrl, renderId}, text?: string }`。

可选：调用改为 `runner.ts` `ACTIONS` 新增异步动作 + 任务 `featureJobs`，若渲染耗时超请求上限则采用；Phase 1 先同步（FFmpeg 重渲单条 30s 视频通常 < 30s，编辑器现有同步渲染已验证此路径），超时再加异步。

### 4.3 存储与回滚语义

- 派生视频 = 同任务新 render + `videoHistory`（编辑器既有模式），不新建任务 → 图书馆"1/2"徽标与详情不受影响。
- 任务 JSONB 上新增 `subtitleCompletion: { at, opId, resultKind, renderId?, textDigest? }[]` 记录（审计/重复执行判断）。
- 在线编辑胜出：写入前按 revision CAS；与用户手动编辑字幕冲突时，以最新提交为准。

## 5. 前端设计

### 5.1 新视图 `subtitles`

- `navigation.ts`：`WORKSPACE_VIEWS` 加 `"subtitles"`；`WORKSPACE_MODULES` create 组在 `chat` 后插入 `{ id: "subtitles", title: "Subtitle Studio", summary: … , group: "create" }`（最终中文由站点翻译层渲染，英文为唯一 source）。
- `workspace.tsx`：`moduleIcons` 补图标（Captions/ClosedCaption）；内容区加 `{view === "subtitles" && <SubtitleWorkbench …/>}`；未登录渲染"Log in"面板（与 chat 一致）。
- 新组件 `subtitles-workbench.tsx`：
  - 左：视频选择列表（复用 `tasks` + `deriveTaskStatus` 过滤 completed；首屏自动选中 `?task=` 指定视频，不存在/不属于本人则提示）。
  - 右：操作标签按钮组（来自后端 catalog 接口返回的 `{id,label,resultKind}` 白名单，前端不写死指令）、结果预览、渲染进度（轮询或挂起态）、失败重试。
  - 结果区：视频预览播放器 + "下载"；文案类结果提供复制与 txt 下载。

### 5.2 图书馆卡片按钮

- `library-task-card.tsx`：动作区新增 "补全字幕"（仅 completed + `video.finalUrl` 存在时可用），prop `onSubtitleStudio`。
- `workspace.tsx` 调用处传入：`navigate("subtitles")` + `window.history.replaceState`/URL 带 `?task=<id>`（沿用现有 `updateUrl` 模式），挂载 effect 里为 subtitles 视图读取 `?task=`。

### 5.3 合规检查点

- 新增可见字符串全部是面向用户的公共文案。
- 深链参数仅 `view`/`task`，不扩 handoff 白名单（subtitles 优先走静态路径 + query，不走 entry cookie）。
- 仅写 `site_aidreamcapes` 关系行；不触 LivePage/快照。

## 6. 分阶段执行

| 阶段 | 内容 | 涉及文件 |
| --- | --- | --- |
| P0 决策 | 操作标签清单与各自产出（见 §7 开放问题）；确认生产 ASR provider 可用 | — |
| P1 后端 | `subtitle-ops.ts` 注册表 + API route + 执行链（structuredDecision → captions/overlay 渲染）+ mock 分支 + 类型扩展 | subtitle-ops.ts, api.ts（输入校验）, editor/captions 复用, 新 route.ts, types.ts |
| P2 前端 | 新 view + `subtitles-workbench` + 挂载 effect `?task=` 处理 + 库卡片按钮 | navigation.ts, workspace.tsx, library-task-card.tsx, subtitles-workbench.tsx, module 样式 |
| P3 回归 | offline contract 冒烟（仿 `smoke-template-presets` 的 compileModule 模式：指令不落 DOM、限额、幂等、CAS 冲突）；`smoke:aidreamcapes-release-routes` 回归；浏览器级 smoke（Playwright 选视频→执行→videoHistory 长度+1） | scripts/aidreamcapes-workspace/* |
| P4 发布 | commit → push → `build-aidreamcapes-prebuilt` → `deploy-aidreamcapes-release --verify-media-details`（无需内容级 manifest，纯代码发布） | — |

## 7. 已确认决策（2026-10-29）

1. 首批操作标签：**生成字幕、宣传语句、产品文案**。三个操作统一执行链：GPT 生成带时间轴的字幕分段（`[{start,end,text}]` + 样式）→ FFmpeg 烧录进视频。
2. 宣传语句 / 产品文案同样**烧录进视频**：走字幕轨道（bold 样式为主），时间轴优先对齐分镜镜头边界；无语音时按镜头切换或均匀分段。
3. **免费**，不扣积分；保留每客户每日次数限额（防止滥用）。
4. 生成字幕在无语音时间轴时降级为"基于脚本/分镜由 GPT 分配时间轴"，并在结果区注明字幕为文案生成而非逐句听写。生产 ASR provider 可用性上线前实测一次。

执行形态说明：对话模型（GPT）承担全部创作决策并输出结构化 JSON 方案；后端 FFmpeg 只做机械烧录执行。这与 Codex"生成 srt 文件 + 调用 ffmpeg"的组合等效，不需要为请求开沙箱。

## 8. 验收标准

1. 侧边栏出现新模块（创作组、人工智能助手之后），未登录提示登录。
2. 字幕补全页可从列表选视频；从图书馆卡片点击可直达且视频已选中。
3. 任一操作执行后：GPT 结果落地为字幕/overlay/文本；视频类操作产生新版本且图书馆即时可见，下载可用；原版本保留在 videoHistory。
4. 越权（他人任务/未完成视频/外部 URL）全部 4xx；同请求重复提交幂等；限额生效。
5. `npm run typecheck`、发布冒烟全绿；不改任何 MyDreamShoots 数据；不改公开页面。
