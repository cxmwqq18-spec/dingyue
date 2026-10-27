# Aidreamcapes 工作台视频任务状态与积分时序全局整改计划

日期：2026-10-27 · 状态：待确认后分阶段实施 · 范围：仅 `site_aidreamcapes` 工作台（aivideosugc.com，aidreamcapes.service:3013）

## 背景与问题清单

用户在库列表（/app/create/library）观察到：

1. 卡片状态标签混乱：同一任务在不同位置（卡片 badge、详情弹窗、编辑页）显示不一致的状态。
2. 已经收到视频文件的卡片仍然显示"需要关注"+报错文案（截图：6 张 wan-1080p 30s 产品演示卡，媒体区有 30s 视频在播，卡片却压着失败文案）。
3. 轮询等待阶段的状态不是始终"生成中"；只有轮询失败/真报错才应显示失败并退回积分。
4. 积分时序：确认生成后总余额应立刻刷新反映冻结（冻结机制已于 2026-10-26 上线：`89aba326b` + `6d392f78a`）。

代码层根因（已核实）：

- **状态推导四套并存**：`statusLabels[task.status]`（非 direct）、`taskStatusLabel()`（direct 特判 + `taskNeedsAttention`）、卡片 `badgeLabel`（`itemRunning` 优先）、详情弹窗 `statusWord`。四处独立推导，无单一事实源。
- **失败标记传染**：卡片失败判定 `shots.find(shot => shot.genStatus === "fail" && shot.error)` —— 任一镜头带历史失败标记即整卡"需要关注"，不看该镜头当前版本是否已成功、也不看是否还有其他镜头在跑。
- **旧失败标记不清理**：镜头重试成功后 `genStatus` 会翻转，但部分路径（operation 失败后的 `task.error`、`video.status === "fail"`、早期版本残留）不会随后续成功清除。
- **余额刷新滞后**：余额 15s 轮询（任务 4s），确认生成后无立即拉取；用户感知"不马上变"。

## 目标状态机（唯一事实源）

新增服务端共享的 `deriveTaskStatus(task)`，列表、卡片、详情弹窗、编辑页全部消费同一结果。判定顺序（先命中先生效）：

| 优先级 | 状态 | 条件 | 标签（zh / en） |
|---|---|---|---|
| 1 | cancelled | `task.status === "cancelled"` | 已取消 / Cancelled |
| 2 | completed | `task.status === "completed"` 且 `task.video?.finalUrl` | 已完成 / Completed |
| 3 | rendering | render operation pending/run 或 `task.status === "rendering"` | 渲染中 / Rendering |
| 4 | generating | 任一镜头 `genStatus === "run"` 或 `compositeStatus === "run"`，或 operation 为 generate_shot/compose_shot 的 pending/run | 生成中 / Generating |
| 5 | planning | operation 为 storyboard/reroll/rewrite 的 pending/run | 规划中 / Planning |
| 6 | failed | 无在途工作，且：operation fail（终态失败）或 status==="failed"，或某镜头**当前版本**失败 | 需要关注 / Needs attention（附原因分类 + 重试入口） |
| 7 | ready | 分镜就绪、无在途、无失败（direct 为 "Ready to render"） | 待确认渲染 / Ready to render |
| 8 | draft | 无分镜且无在途 | 草稿 / Draft |

**失败判定收紧规则（核心修复）**：

- 镜头只按**当前版本**（`curVer` / 最新 version）判失败；旧版本失败、当前版本成功 → 该镜头不算失败。
- 任一镜头/合成在途（run）时，任务整体不得显示为 failed（在途优先于失败标记）。
- `task.error` / `operation.error` / `video.status==="fail"` 在后续操作成功时必须清除（server 侧 `queueAction` 已清 `task.error`；补齐 shot/video 路径）。
- 失败必须带**原因分类**（规划失败 / 镜头生成失败 / 合成失败 / 渲染失败 / 上游超时）与**积分处置说明**（已退回 / 无扣除）。

## 分阶段实施

### Phase 0 — 线上数据诊断（先只读）

- 用 base64 传输 SQL 的既定方案查 `AidreamcapesVideoTask`：截图 6 张卡（10-26 创建、wan-1080p、产品演示）的 status / operation / storyboard.shots 各 genStatus+error+versions / video.status / error 字段。
- 逐卡对照目标状态机分类：哪些是"标记残留"（数据真值正常，纯前端显示 bug），哪些是"真失败待重试"（镜头 2 确实没出片）。
- 产出：诊断记录 + 需要数据修缮的行清单（如需写操作，走字段级 compare-and-set manifest，遵守站点数据契约；预计多数行不需要写）。

### Phase 1 — 服务端状态机统一

- 新增 `deriveTaskStatus()`（`src/lib/aidreamcapes-workspace/`，server-only），`publicTask()` 附带派生状态，客户端不再自行拼状态。
- 清理四处旧推导，全部改为消费派生状态；保留 direct/非 direct 差异在状态机内部处理。
- 失败清理：镜头新版本派发时清旧 `error`；`refreshShotGeneration` 成功回填时确认 error 清空；任务完成时清残留 `video.status==="fail"` 之外的陈旧标记。
- 幂等与并发：派生函数纯函数化，无副作用；`publicTask` 只读。

### Phase 2 — 积分时序与余额显示

已上线（不变式，回归测试锁定）：

- 确认生成 → 冻结整任务预计成本（`workspace_task_hold` ledger）；每镜头派发同事务转出；计划失败立即退回；完成/取消/删除释放剩余；失败退款走 job 预留。

本阶段增量：

- 余额轮询 15s → 4s（与任务轮询同周期）。
- `runConfirmedGeneration` 成功后、`pollTaskUntil` 到达终态后**立即拉一次 /balance**，不等下个周期。
- 确认弹窗与失败提示中的积分文案统一：冻结、转出、退回三个动作都有对应反馈（弹窗已有，失败 toast 补"相关积分已退回"）。

### Phase 3 — 标签、文案与 UI

- 单一标签映射（zh/en）+ badge 色调：生成中=progress、渲染中=progress、失败=error、完成=done、草稿/就绪=idle。
- 卡片 CTA 按状态：查看详情始终可点（已上线）；failed 状态卡提供明确"重试"入口（跳详情页对应镜头）。
- 失败文案卫生：所有错误码必须有 humanError 映射；未映射码回退为通用文案，绝不上屏原始错误码。

### Phase 4 — 回归与验收

- 扩展 `scripts/smoke-video-workspace-regression.mjs`：状态机用例（规划失败→退回+失败；镜头1成功+镜头2失败→失败但媒体正常展示且可重试；重试成功→完成且无残留失败标记；direct 全 pending→待渲染）。
- 验收清单（对应用户四点诉求）：
  1. 确认生成后 ≤1 个轮询周期内余额下降；
  2. 派发上游→返回/轮询期间，状态始终为 生成中/渲染中；
  3. 仅轮询失败或真报错才显示失败，且积分处置明确；
  4. 有成片的卡片不再因陈旧失败标记显示报错。

### Phase 5 — 部署与验证

- 常规双线：3010 `deploy-release.mjs` + 3013 `build-aidreamcapes-prebuilt.mjs` + `deploy-aidreamcapes-release.mjs`（-seo 管线）。
- 验证：产物 grep 新状态机代码；DB readback Phase 0 行的新派生状态；页面探针 200。
- 工作区并发注意：另一 agent 同栈工作，提交前 `git status` 核对文件归属；部署用干净临时 worktree。

## 明确不做

- 不改计费金额规则（按镜头计价维持现状）。
- 不动 MyDreamShoots 数据/页面/路由。
- 不用快照/历史发布修复数据；如需数据修缮，仅字段级 manifest + CAS + 审计。
