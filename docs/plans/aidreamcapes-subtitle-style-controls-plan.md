# 字幕样式可控化整改计划（Subtitle Studio 样式选择器 + 案例预览）

日期：2026-10-29。站点：`site_aidreamcapes`。上游计划：`docs/plans/aidreamcapes-subtitles-completion-plan.md`（操作注册表 / GPT 出时间轴 / FFmpeg 烧录链路已上线，commit `09b12b4ad`）。

## 1. 目标

把字幕烧录从「GPT 自动选三档预设」升级为**前端可控 + 案例预览**：

1. 用户在字幕工作室用选项标签（chips）选择：样式、字号、位置、颜色、底框形态。
2. 每个选项配**案例预览**（CSS 复刻的迷你画面叠加字幕条，见 §4），选择即所见。
3. 用户未指定的维度仍由 GPT 自动决定（`Auto`），指定项覆盖 GPT。
4. 渲染端按结构化参数生成 libass `force_style`，不引入自由文本输入（安全边界）。

## 2. 现状与已完成部分

| 能力 | 状态 |
| --- | --- |
| GPT 产出时间轴字幕 → FFmpeg 烧录 → videoHistory 入库 | ✅ 已上线 |
| 三档预设 classic / bold / minimal（字号、边距、底框随之固定） | ✅ 已上线 |
| `VideoEditSettings.subtitleSize`（small/medium/large）、`subtitlePosition`（bottom/middle/top）进入编辑管线，`subtitleAssStyle()` 参数化 ASS 字符串 | ✅ 本工作树已改，随本次一起发布 |
| 颜色 / 底框形态独立可控 | ❌ 未做（本期） |
| 前端选项 UI + 案例预览 | ❌ 未做（本期） |
| 用户覆盖 GPT 的传递链（POST body.settings → 路由 → 服务端覆盖 plan） | 🔶 契约已设计，路由/服务端/UI 待接 |

## 3. 样式契约（预设字典，不做自由输入）

自由输入（任意色值/字体文件）会让 libass 注入与渲染回归失控，因此**全部走受控枚举**，每个枚举映射到确定的 ASS 参数：

| 维度 | 枚举 | ASS 映射 |
| --- | --- | --- |
| 样式 style | `classic` / `bold` / `minimal` | 既有三档（字体粗细、描边、底框） |
| 字号 size | `small` / `medium` / `large` | 基准字号 × 0.8 / 1.0 / 1.3（四舍五入） |
| 位置 position | `bottom` / `middle` / `top` | `Alignment=2/5/8` + MarginV 分档 |
| 文字颜色 color | `white` / `yellow` / `cyan` / `black` | `PrimaryColour=&H00FFFFFF` 等（本期新增） |
| 底框 backdrop | `none` / `box` / `outline` | `BorderStyle=1,Outline=2` / `BorderStyle=3,BackColour` / 仅描边（本期新增，与 style 解耦） |

规则：

- `style` 仍是整体基调；`color`、`backdrop` 为独立覆盖项，未指定时跟随 style 默认（bold=box、classic=outline、minimal=细描边）。
- 合法性组合校验：`backdrop=box` 时 `color=black` 自动把底框换浅色（否则黑字黑框不可读）→ 直接在映射表里定义，不允许运行时组合出不可读结果。
- 全部枚举常量放在客户端安全模块 `subtitle-ops.ts`，UI 与服务端共用同一份字典；服务端对 body 里的 settings 逐项白名单校验。

## 4. 前端交互设计（字幕工作室右栏）

在操作按钮上方新增「Caption style」设置区：

```
样式   [Classic] [Bold] [Minimal] [Auto ✨]
字号   [S] [M] [L]
位置   [底部] [居中] [顶部]
颜色   ●白 ●黄 ●青 ●黑
底框   [无] [半透明底框] [描边]   （跟随样式 / 显式覆盖）
```

- **每个 chip 内嵌案例预览**：chip 本身就是一块 16:9 迷你画面（CSS 渐变模拟视频画面），内部按当前维度渲染一条示例字幕（例如样式 chips 各自展示同一段示例文字在三种风格下的样子）。选中的 chip 高亮。
- **实时大预览**：设置区右侧（或下方）一个 9:16 迷你舞台，按当前全部所选维度用 CSS 复刻字幕效果（字体加粗/描边/-webkit-text-stroke 模拟描边、半透明底框、字号比例、垂直位置）。烧录以 ASS 为准，预览是高保真近似，页面注明 "Preview is approximate; the burned-in video is the final look."（该句为用户可见文案）。
- **Auto 语义**：样式默认 `Auto`（GPT 按视频内容挑），其余维度默认值与现行渲染默认一致（M / 底部 / 白 / 跟随样式），用户不动 = 现状不变。
- 设置随操作一起提交（`POST body.settings`），并保存在工作台本地（tab 内记忆，不落库；后端每次渲染以请求里的 settings 为准）。

### 4.1 版本展示（不覆盖原片，显式可见）

- 烧录永远产出新的不可变渲染目录；原视频保留在 `task.videoHistory`（磁盘文件与记录都在），任务"当前版本"指向最新烧录结果 —— **原片不会被覆盖**。
- 字幕工作室右栏增加**版本切换**：`原版` 与 `带字幕新版`（以及历次操作版本）以可播放的版本 chip 列出，点击切换播放器内容；最新版本默认选中。
- 每个版本 chip 标注是否含字幕（`With subtitles` / `Original`），让"生成了新视频、原片仍在"在界面可见。

## 5. 后端改动清单

| 文件 | 改动 |
| --- | --- |
| `src/lib/aidreamcapes-workspace/types.ts` | 已加 `SubtitleTextSize` / `SubtitleTextPosition`；再加 `SubtitleTextColor = "white"\|"yellow"\|"cyan"\|"black"`、`SubtitleBackdrop = "none"\|"box"\|"outline"` |
| `src/lib/aidreamcapes-workspace/subtitle-ops.ts` | 字典常量（`SUBTITLE_COLORS`、`SUBTITLE_BACKDROPS` 等）、`SubtitleOpSettings` 接口、`parseSubtitleOpSettings()` 白名单校验、错误文案映射（上轮已加） |
| `src/lib/aidreamcapes-workspace/editor.ts` | `VideoEditSettings` 增加 `subtitleColor?` / `subtitleBackdrop?`；`compileVideoEdit` patch 键与白名单扩展；`subtitleAssStyle()` 扩展颜色/底框映射与可读性兜底 |
| `src/app/.../tasks/[taskId]/subtitle-ops/route.ts` | body 校验接受 `settings`；单飞行查询（已改，待冒烟覆盖） |
| `src/lib/aidreamcapes-workspace/subtitle-ops.server.ts` | `runSubtitleOp` 接收 settings：`style` 覆盖 plan.style，`size/position/color/backdrop` 透传给 `compileVideoEdit` patch；结果返回实际生效的 style |
| `src/components/aidreamcapes-workspace/subtitle-workbench.tsx/.module.css` | 设置区 chips + 案例预览 + 大预览；列表视频卡片（上轮已重写，待接 workspace） |
| `scripts/aidreamcapes-workspace/smoke-subtitle-ops.mjs` | 覆盖：settings 校验、覆盖 plan.style、非法枚举 422、单飞行复用在跑作业、revision 冲突重试 |

## 6. 同时收尾的体验修复（上轮已定位，随本次一起发）

1. **同任务单飞行**：点击已生成中的视频时，POST 复用同一个在跑作业（平台作业表按 kind+actor 查 queued/running 且 metadata.taskId 匹配），不再叠加并发渲染 —— 消除 `revision_conflict` 报错根源。
2. **revision 冲突重试**：作业落库冲突时基于最新渲染重烧一次（`runSubtitleOp` 已改）。
3. **跨页面进度**：作业跟踪提升到 workspace 级（轮询、完成自动刷新图书馆、sessionStorage 恢复），顶栏全局进度胶囊「正在生成… 可随时离开」，任何页面可见，点击回到字幕工作室；切页不停轮询。
4. **列表视频卡片**：字幕工作室左列表改为迷你视频卡（可播放），右栏展示所选视频大预览。
5. **错误文案健壮化**：作业 error 可能是结构化对象，统一经 `subtitleOpErrorText()` 转人类文案。

## 7. 阶段与验收

| 阶段 | 内容 | 验收 |
| --- | --- | --- |
| P1 管线可控（本工作树） | size/position 进管线 + 服务端 settings 覆盖 + 单飞行 + 重试 | tsc/build 绿；smoke 覆盖 settings、单飞行、重试、非法枚举 |
| P2 前端选择器 | chips + 案例预览 + 大预览 + 跨页进度胶囊 + 视频卡片列表 | 浏览器实测：改字号/位置/颜色后新版本字幕肉眼可见变化；切页进度不丢；重复点击不叠加作业 |
| P3 回归与发布 | `npm run build`、离线冒烟、预构建部署（纯代码）、线上验证 | 部署门禁 `failures: []`；线上 SSR 200；未登录 401 |
| P4（可选后续） | 更多预设样式（描边色、字体族、逐字动画）、把同套选择器复用到 AI 视频生成时的初始字幕样式 | 另行确认 |

## 8. 风险与边界

- **预览与实物的偏差**：CSS 复刻 ≠ libass 渲染（描边/底框细节），文案注明以烧录结果为准。
- **可读性兜底**：黑字+深底框等组合在映射表内直接规避，不依赖用户判断。
- **旧渲染兼容**：新字段全部可选，旧 `editSettings` 缺省时回退现行默认（medium / bottom / 跟随样式）。
- **post-editor 兼容**：编辑器 PATCH 不发新键，行为不变；后续可在编辑器复用同一选择器。
- **前端文案边界**：所有 chip/提示均为面向用户的公共文案；ASS 参数映射只存在服务端。
