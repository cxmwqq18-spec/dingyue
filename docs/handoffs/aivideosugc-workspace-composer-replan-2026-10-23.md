# 工作台作曲家（Composer）交互整改方案

日期：2026-10-23 · 范围：site_aidreamcapes 工作台（/site/aidreamcapes/app）· 状态：待确认

## 背景与问题

当前作曲家三个标签页都沿用了旧的「场景表单」流程：点击提交会跳到
「产品演示」等场景表单页（要求上传产品照片、补字段、保存草稿、打开故事板），
与三类工具的真实用法不匹配：

| 标签页 | 用户预期 | 现状 |
| --- | --- | --- |
| 文字转视频（Text to Video） | 只写描述 → 点生成 → 二次确认积分 → 直接出片 | 跳场景表单页，强制要求产品照片 |
| 人工智能视频（Image to Video） | 必须上传参考图；模型支持时还可上传参考视频/参考音频（各带独立上传位） | 只有图片上传位；不强制；跳表单页 |
| 人工智能图像（AI Image） | 只支持图片；最大张数由后台控制；点生成直接出图（不弹窗、不跳页） | 上限写死 4 张；行为基本正确但入口会误开产品弹窗 |

## 目标交互（定稿口径）

1. **三个标签页都在 home 直接完成生成**，不再跳场景表单页；左侧目录页
   （/create/text-to-video、/create/ai-video-generation、/create/ai-image-generation）
   复用同一流程，也支持原地生成。
2. **统一的二次确认弹窗**：展示 模型 / 画幅 / 时长 / 清晰度 / 参考素材数量 /
   本次预计积分（走 generation-quote 实时价）与余额，确认后才创建任务并扣积分。
3. **按模型能力显示上传位**：参考图片（各页）、参考视频、参考音频三个独立上传位；
   视频/音频位仅当平台后台该供应商 `maxVideoInputs` / `maxAudioInputs` > 0 时显示，
   数量上限即后台维护值。生图上限取 `maxImagesPerRequest`。
4. **强制项**：人工智能视频至少 1 张参考图，否则不允许提交（按钮置灰 + 行内提示）；
   文字转视频只要求描述文字，不要求任何图片；生图仅接受图片文件。
5. 生成过程中停留在当前页，显示分阶段进度（规划分镜 → 逐镜生成 → 合成），
   完成后在 Library 查看；编辑器（故事板）保留为高级入口。

## 技术改动清单

### 阶段 1：交互与校验（本次主体）

| # | 改动 | 文件 |
| --- | --- | --- |
| 1.1 | 场景目录新增 `text_to_video` 纯文本场景（唯一必填项为描述，无产品图、无演员），作为文生视频的承载场景 | `src/lib/aidreamcapes-workspace/catalogs.ts` |
| 1.2 | 作曲家按标签页裁剪控件：文生视频隐藏 Product/Avatar/图片上传位；AI 视频显示 图片+视频+音频 三个上传位并强制 ≥1 图；生图上限改读模型能力 | `home-composer.tsx`、`workspace.tsx` |
| 1.3 | 上传位能力映射：`ModelCapability` 增加 `referenceImageMax`、`videoReferenceMax`、`audioReferenceMax`，取自供应商 `maxImagesPerRequest` / `maxVideoInputs` / `maxAudioInputs` | `capabilities.ts`、`types.ts` |
| 1.4 | 二次确认弹窗组件（积分预估 + 余额 + 参数摘要），确认后调用快速生成 | `workspace.tsx`（新组件 `generate-confirm.tsx`） |
| 1.5 | 快速生成流程保留（建稿 → 自动分镜 → 逐镜 → 合成），把「缺产品图开弹窗」的兜底改为各标签页自己的强制校验 | `workspace.tsx` `quickGenerateVideo` |
| 1.6 | 目录页复用同一作曲家行为（移除对场景表单的自动跳转） | `workspace.tsx` 各 mount 点 |

### 阶段 2：数据与计费

| # | 改动 | 文件 |
| --- | --- | --- |
| 2.1 | 任务输入扩展 `referenceVideos` / `referenceAudios`（URL 数组，按模型上限校验）；parseInput + validateTaskInput + 站点后台按工具 typeLimits 双重限制 | `api.ts`、`pipeline.ts`、`store.ts` |
| 2.2 | 报价含参考素材附加费（供应商 priceVideoInput/PerSecond、priceAudioInput/PerSecond 已配置，generation-quote 传入素材计数即可生效） | `provider.ts` `quoteComposerGeneration` |
| 2.3 | 落库 input 重建问题修复：确保 resolution/modelId/参考素材原样进入存储 | `store.ts`/route 输入链路（上轮遗留） |

### 阶段 3：派发适配

- 生成派发把参考视频/音频 URL 传入供应商 payload（按 `videoModelFamily` 适配），
  mock 通道先行，真实通道逐个接（依赖各模型 API 对多参考的支持）。
- 该阶段涉及真实出片效果，单独验证后上线。

## 明确不做 / 不变

- 不改故事板编辑器与 Library；不做 MyDreamShoots 任何改动。
- 不新增快照/发布动作；任务仍走 LivePage 无关的顾客任务链路。
- 前台文案全部为面向顾客的英文文案（确认弹窗、提示、占位符）。

## 待确认问题

1. 文生视频出片形态：按所选时长自动分镜再拼接（现流水线），还是固定单镜头？
2. 图生视频缺图时点击生成：按钮置灰（推荐）还是允许点击后弹提示？
3. 参考视频/音频第一阶段先做「上传 + 校验 + 计费」，实际派发第二阶段接（推荐）？
