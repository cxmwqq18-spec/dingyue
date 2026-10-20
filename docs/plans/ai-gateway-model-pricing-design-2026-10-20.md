# AI 网关：模型级价格维护与多模态计费设计

- 日期：2026-10-20
- 状态：已实现（本地库已应用迁移并通过 smoke 验收）；线上发布需随 release 执行 `prisma migrate deploy`
- 适用范围：平台后台 AI 网关（共享层），影响 `PlatformAiProvider` 派发与所有消费积分的生成入口
- 前置整改：已完成「中转平台 + 一键同步模型」与 5 个派发缺陷修复

## 0. 实施结果速览

| 项 | 落地位置 |
|---|---|
| 价格字段 | `PlatformAiProvider` 新增 12 列（`priceEnabled` / `priceCredits` / 4 个维度价格矩阵 / 5 个输入计费标量） |
| 迁移 | `20261020160000_add_platform_ai_provider_pricing` |
| 计价核心 | `src/lib/ai-provider-pricing.ts`（纯函数）+ `src/lib/ai-provider-billing.ts`（通道选择与同源入口） |
| 扣费接入 | `src/lib/stores/job-store.ts` 预扣费 |
| 报价接入 | `src/lib/aidreamcapes-workspace/provider.ts`（`workspaceShotCredits`） |
| 后台 UI | `platform-ai-provider-panel.tsx` 新增「03 价格与计费」，模型 ID 改为下拉，调度策略顺延为 04 |
| 验收 | `smoke-ai-provider-pricing.mjs`（12 项单测）+ `smoke-ai-provider-pricing-api.mjs`（5 步端到端） |

## 1. 现状：积分到底定义在哪

用户提问「工作台消耗积分，积分是在哪里定义的」。实测结论：**当前积分是分散定义的，共 5 个来源，没有任何单一事实源**。

| # | 位置 | 内容 | 粒度 | 谁能改 |
|---|---|---|---|---|
| 1 | `SiteAiApp.creditCost` | 图片/文本等应用的基础积分（如 24、8、108） | 站点 × 应用 | 站点后台 |
| 2 | `VideoTheme.creditCost` | 视频主题基础积分（当前全是 24） | 站点 × 主题 | 站点后台 |
| 3 | `VideoTheme.modelPricing` (JSON) | `{grok:{6:24,10:40,15:60}, gemini:{...}}` | 站点 × 主题 × 模型族 × 时长 | 站点后台 |
| 4 | `src/lib/video-frame-config.ts` | 时长倍率（6s=1、10s=10/6、15s=15/6）、分辨率倍率（480p=0.8、720p=1、1080p=1.5） | **代码常量** | 改代码 |
| 5 | `aidreamcapes-workspace/provider.ts:119` | 工作台展示价 `6s→24 / 10s→40 / 15s→60 / 30s→120` | **代码硬编码** | 改代码 |

关键结论：
- **模型（provider）层没有任何价格字段**。同一个模型在不同主题/应用下价格可能不同，同一主题下换模型价格也可能不同。
- 第 4、5 项是硬编码：换一套价格必须改代码 + 重新部署，运营无法自助。
- 现有计价链路（`job-store.ts:1290-1300`）：`时长价 → 分辨率倍率 → × 输出份数 = 实际扣费`。音频、参考图数量、图片质量**均不参与计价**。

## 2. 目标

1. 价格下沉到**模型通道**（`PlatformAiProvider`）层，成为模型的唯一价格事实源。
2. 支持按 **时长 / 分辨率 / 画质 / 音轨** 分别定价。
3. 支持 **图片输入 / 视频输入 / 音频输入** 分别计价（是否附加、附加多少）。
4. 主题级、应用级价格保留为**可选覆盖**，未配置时自动回落模型价（不破坏现有站点）。
5. 后台模型页可直接编辑价格，无需改代码。

## 3. 数据模型

### 3.1 新增 `PlatformAiProvider` 字段

```prisma
model PlatformAiProvider {
  // ... 现有字段

  priceCredits        Int      @default(0)   // 基础积分（每次生成的底价）
  priceEnabled        Boolean  @default(false)// 是否启用模型级计价
  priceVideoDurations Json?    // { "6": 24, "10": 40, "15": 60 }
  priceVideoResolutions Json?  // { "480p": 20, "720p": 30, "1080p": 45 }
  priceImageQualities Json?    // { "auto": 24, "low": 20, "medium": 28, "high": 40 }
  priceImageResolutions Json?  // { "1K": 24, "2K": 48, "4K": 96 }
  priceAudioPerSecond  Int      @default(0)   // 音频输入每秒计费
  priceVideoInputPerSecond Int @default(0)    // 视频输入每秒计费
  priceImageInput     Int      @default(0)    // 每张图片输入计费
  priceAudioInput     Int      @default(0)    // 每条音频输入计费
}
```

设计取舍：
- 用 `Json` 存维度价格矩阵，与既有 `VideoTheme.modelPricing` 保持同构，复用 `normalizeVideoModelPricing` 的成熟模式，避免为每个组合建行。
- 标量维度（音频/视频/图片输入计费）用独立列，便于索引与审计。
- `priceEnabled` 显式开关：默认关闭 → **现有站点行为逐字节不变**。

### 3.2 计价维度与输入模态

| 维度 | 取值来源 | 计价方式 |
|---|---|---|
| 基础价 | `priceCredits` | 每次生成固定收取 |
| 视频时长 | 客户选择（6/10/15/30） | `priceVideoDurations[秒]` 覆盖基础价 |
| 视频分辨率 | 客户选择（480p/720p/1080p） | `priceVideoResolutions[分辨率]` 覆盖上一项 |
| 图片画质 | 客户选择（auto/low/medium/high） | `priceImageQualities[画质]` 覆盖基础价 |
| 图片分辨率 | 客户选择（1K/2K/4K） | `priceImageResolutions[分辨率]` 覆盖上一项 |
| 图片输入 | 客户上传的参考图 | `priceImageInput × 张数` **附加** |
| 视频输入 | 客户上传的参考视频 | `priceVideoInputPerSecond × 秒数` **附加** |
| 音频输入 | 客户上传的音频 | `priceAudioInput × 条数` + `priceAudioPerSecond × 秒数` **附加** |
| 输出份数 | 任务 outputCount | `最终单价 × 份数` |

「覆盖」语义：视频链路是 `基础价 → 时长价 → 分辨率价`（取最具体的一个命中值）；图片链路是 `基础价 → 画质价 → 分辨率价`；输入模态一律在结果上**加价**。

## 4. 计价核心（单一事实源）

新增 `src/lib/ai-provider-pricing.ts`，纯函数、无 IO、可单测：

```ts
export type AiProviderPriceInput = {
  priceEnabled?: boolean | null;
  priceCredits?: number | null;
  priceVideoDurations?: unknown;
  priceVideoResolutions?: unknown;
  priceImageQualities?: unknown;
  priceImageResolutions?: unknown;
  priceAudioPerSecond?: number | null;
  priceVideoInputPerSecond?: number | null;
  priceImageInput?: number | null;
  priceAudioInput?: number | null;
  capabilityType: "image" | "video" | "audio" | "text";
  durationSeconds?: number | null;
  resolution?: string | null;
  quality?: string | null;
  imageInputCount?: number | null;
  videoInputSeconds?: number | null;
  audioInputCount?: number | null;
  audioInputSeconds?: number | null;
  outputCount?: number | null;
};

export function resolveAiProviderCredits(input: AiProviderPriceInput): number;
```

返回规则：
1. `priceEnabled` 为假 → 返回 `null`（表示"本模型未定价，交给上层回落"），**不是 0**。0 与"未定价"必须区分，否则会静默把现有站点价格打成免费。
2. 命中具体维度价则覆盖基础价；都没命中用 `priceCredits`。
3. 输入模态加价累加。
4. 最终 `× outputCount`，负值归零，取整。

## 5. 回退链（保证不破坏现有站点）

计价优先级，从上到下：

```
模型价（priceEnabled=true）
  ↓ 未定价
主题价 modelPricing[family][duration]     （现状：站点后台可配）
  ↓ 未配置
主题/应用 creditCost + 全局倍率           （现状：硬编码常量）
```

关键约束：**只有显式开启 `priceEnabled` 的模型才走模型价**。现有 3 条生图通道和所有 `VideoTheme` 行为完全不变。

## 6. 接入点

| 接入点 | 文件 | 改法 |
|---|---|---|
| 任务预扣费 | `src/lib/stores/job-store.ts:1290-1300` | 先算模型价；为 null 则走现有 `videoDurationCreditCost` 链路 |
| 工作台报价 | `src/lib/aidreamcapes-workspace/provider.ts:119,389` | 报价与扣费必须同源，否则会 409 `workspace_price_quote_changed` |
| 工作台展示价 | `src/lib/aidreamcapes-workspace/provider.ts:89` | 去掉硬编码 24/40/60/120，改为按选中模型查价 |
| 站点后台主题编辑器 | `src/components/admin/video-theme-editor.tsx` | 模型价优先时显示"由模型通道定价" |
| 平台后台模型页 | 新增 `src/components/platform/platform-ai-provider-price-editor.tsx` | 价格编辑 UI |

**一致性红线**：报价（`quoteWorkspaceAction`）与扣费（`createGenerationJobInTx`）必须调用同一个 `resolveAiProviderCredits`，否则会触发 `workspace_price_quote_changed` 409。

## 7. 后台 UI 调整

### 7.1 编辑抽屉重新分区

当前抽屉（`platform-ai-provider-panel.tsx`）问题：模型 ID 是自由文本 + datalist；时长/画幅是固定三选一勾选框；画质只有图片有；没有任何价格入口。

改为 4 段：

| 段 | 内容 |
|---|---|
| 01 连接 | 名称、URL、Key、**模型下拉框**（数据源：中转同步来的模型列表 + 手工输入兜底）、协议 |
| 02 能力 | 类型相关：视频（时长/画幅/原生语音/参考图上限）、图片（比例/分辨率/质量/格式/多图） |
| 03 **价格** | 新增：基础分、时长价、分辨率价、画质价、输入模态加价、启用开关 |
| 04 调度 | 优先级、启用、设为优先（现有 03 顺延） |

### 7.2 模型下拉框数据源

`status.modelTypes` 现在是「写死默认值 + 已存在模型」的并集。改为：
1. 中转同步得到的模型（`relayId` 关联、`upstreamModelId`）优先；
2. 现有通道已用的模型；
3. 兜底保留手填（`datalist` 允许自由输入），避免新模型尚未同步时无法配置。

### 7.3 时长/画幅/画质改为可编辑

- 时长、画幅：从「写死 6/10/15、9:16/1:1/16:9」改为**通道自持的可编辑集合**（沿用 `videoDurations`/`videoAspectRatios` 字段，值域放开）。
- 画质：图片通道补 `imageQuality` 全量档位，并与价格矩阵联动（选中的档位必须能配价）。
- 分辨率：视频 `480p/720p/1080p`、图片 `1K/2K/4K` 两套独立集合。

## 8. 迁移与兼容

- 新增迁移 `2026xxxx_add_platform_ai_provider_pricing`，只做 `ADD COLUMN ... DEFAULT`，不改现有行。
- `priceEnabled` 默认 `false` → 现有计价链路逐字节不变。
- 现有 `VideoTheme.modelPricing` 与 `creditCost` 保留，继续作为回退层。

## 9. 验收（已执行）

1. `resolveAiProviderPrice` 单测 12 项：未定价返回 null；时长/分辨率/画质覆盖顺序正确；图片/视频/音频输入分别加价；outputCount 参与总价；负值归零；价格矩阵忽略空键位与非法值。→ `npm run smoke:ai-provider-pricing` 全通过。
2. 价格 API 端到端 5 步：创建带价通道 → 回读一致（基础分/时长矩阵/分辨率矩阵/三类输入价）→ 未定价通道不受影响 → 计价数学正确（15s+2 图 = 98 分，1080p = 120 分）→ 关闭 `priceEnabled` 后回落主题价口径。→ `scripts/smoke-ai-provider-pricing-api.mjs` 全通过。
3. 既有回归：`smoke-ai-providers`、`smoke-ai-relay-sync` 全通过；`tsc --noEmit` 与 `eslint` 零错误零警告。
4. 浏览器实测：抽屉内模型下拉可选中已同步模型，价格区字段齐全，保存后回读值一致（基础 36 / 图片输入 5 / 低画质 50），无 console 错误。

## 10. 遗留与注意事项

| 事项 | 说明 |
|---|---|
| 影灵时长档位 | 平台时长集合已放开为 5/6/10/15/30，但上游实际支持的档位需逐模型核对后再勾选 |
| 视频/音频输入时长 | 素材表不持久化时长，按秒计费依赖请求携带 `inputDurations[assetId]`；缺失时只按条计费，不会凭空估算 |
| 工作台 30s | 工作台 30 秒由 2 段 15 秒拼成，模型价按单段时长计算，与既有行为一致 |
| 主题价仍可覆盖 | 主题级 `creditCost` / `modelPricing` 保留为回落层，模型价优先级最高 |
| 硬编码残留 | `video-frame-config.ts` 的时长/分辨率倍率仍作为「未定价模型」的兜底口径，属预期保留 |

## 11. 风险

| 风险 | 缓解 |
|---|---|
| 报价与扣费不同源 → 409 | 强制共用 `resolveAiProviderCredits`，smoke 断言两处相等 |
| 模型价误开导致站点价格变化 | `priceEnabled` 默认 false；smoke 对比迁移前后扣费一致 |
| 硬编码展示价残留 | 删除 `provider.ts` 的 24/40/60/120 字面量，改为查价函数 |
| 音频/视频输入计费口径分歧 | 明确定义为「附加」，基础价不含输入 |
| MyDreamShoots 受影响 | 模型价仅对显式启用的通道生效，且只影响共用该通道的站点；上线前逐站点核对 |
