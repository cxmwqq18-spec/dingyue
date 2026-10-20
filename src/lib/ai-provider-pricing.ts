/**
 * 模型通道级价格计算（平台 AI 网关的唯一价格事实源）。
 *
 * 纯函数、无 IO、可单测。调用方在两个地方必须使用同一个函数：
 *   1. 任务预扣费（src/lib/stores/job-store.ts）
 *   2. 工作台报价（src/lib/aidreamcapes-workspace/provider.ts）
 * 否则会出现报价与扣费不一致，导致 workspace_price_quote_changed 409。
 */

export type AiProviderPriceCapability = "image" | "video" | "audio" | "text";

export type AiProviderPriceInput = {
  /** 是否启用模型级计价；未启用返回 null 表示"本模型未定价" */
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
  priceAudioInputPerSecond?: number | null;
  priceVideoInput?: number | null;
  capabilityType: AiProviderPriceCapability;
  durationSeconds?: number | null;
  resolution?: string | null;
  quality?: string | null;
  imageInputCount?: number | null;
  videoInputCount?: number | null;
  videoInputSeconds?: number | null;
  audioInputCount?: number | null;
  audioInputSeconds?: number | null;
  outputCount?: number | null;
};

export type AiProviderPriceBreakdown = {
  /** null 表示该模型未启用模型级计价，调用方应回落到主题价/应用价 */
  credits: number | null;
  baseCredits: number;
  /** 命中的维度价来源，用于后台展示与审计 */
  appliedDimension: "base" | "duration" | "resolution" | "quality" | "image_resolution";
  inputSurcharge: number;
  unitCredits: number;
  outputCount: number;
};

function safeCount(value: unknown): number {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function nonNegative(value: unknown): number {
  return safeCount(value);
}

/** 读取 { "6": 24, "10": 40 } 这类维度价格表。 */
export function readAiProviderPriceMatrix(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const matrix: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const trimmed = key.trim();
    if (!trimmed) continue;
    const parsed = typeof raw === "number" || typeof raw === "string" ? Number(raw) : Number.NaN;
    if (!Number.isFinite(parsed) || parsed < 0) continue;
    matrix[trimmed] = Math.trunc(parsed);
  }
  return matrix;
}

function lookupMatrixPrice(matrix: Record<string, number>, key: string | number | null | undefined): number | undefined {
  if (key === null || key === undefined) return undefined;
  const normalized = String(key).trim();
  if (!normalized) return undefined;
  const direct = matrix[normalized];
  if (typeof direct === "number") return direct;
  // 时长类键位允许 "6" 与 6 等价，浮点秒数按整数秒匹配。
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) {
    const integerKey = String(Math.trunc(numeric));
    const byInteger = matrix[integerKey];
    if (typeof byInteger === "number") return byInteger;
  }
  return undefined;
}

/**
 * 计算模型级价格。
 * 返回 credits = null 表示该模型未启用模型级计价，调用方必须回落到主题价/应用价。
 */
export function resolveAiProviderPrice(input: AiProviderPriceInput): AiProviderPriceBreakdown {
  const outputCount = Math.max(1, safeCount(input.outputCount) || 1);
  const baseCredits = nonNegative(input.priceCredits);
  if (!input.priceEnabled) {
    return { credits: null, baseCredits, appliedDimension: "base", inputSurcharge: 0, unitCredits: baseCredits, outputCount };
  }

  const durationMatrix = readAiProviderPriceMatrix(input.priceVideoDurations);
  const videoResolutionMatrix = readAiProviderPriceMatrix(input.priceVideoResolutions);
  const imageQualityMatrix = readAiProviderPriceMatrix(input.priceImageQualities);
  const imageResolutionMatrix = readAiProviderPriceMatrix(input.priceImageResolutions);

  let unitCredits = baseCredits;
  let appliedDimension: AiProviderPriceBreakdown["appliedDimension"] = "base";

  if (input.capabilityType === "video") {
    const durationPrice = lookupMatrixPrice(durationMatrix, input.durationSeconds);
    if (durationPrice !== undefined) {
      unitCredits = durationPrice;
      appliedDimension = "duration";
    }
    const resolutionPrice = lookupMatrixPrice(videoResolutionMatrix, input.resolution);
    if (resolutionPrice !== undefined) {
      unitCredits = resolutionPrice;
      appliedDimension = "resolution";
    }
  }

  if (input.capabilityType === "image") {
    const qualityPrice = lookupMatrixPrice(imageQualityMatrix, input.quality);
    if (qualityPrice !== undefined) {
      unitCredits = qualityPrice;
      appliedDimension = "quality";
    }
    const resolutionPrice = lookupMatrixPrice(imageResolutionMatrix, input.resolution);
    if (resolutionPrice !== undefined) {
      unitCredits = resolutionPrice;
      appliedDimension = "image_resolution";
    }
  }

  if (input.capabilityType === "audio") {
    const audioSeconds = nonNegative(input.audioInputSeconds);
    const perSecond = nonNegative(input.priceAudioPerSecond);
    if (perSecond > 0 && audioSeconds > 0) {
      unitCredits += perSecond * audioSeconds;
    }
  }

  // 输入模态一律为附加项，不覆盖基础价。
  let inputSurcharge = 0;
  inputSurcharge += nonNegative(input.priceImageInput) * nonNegative(input.imageInputCount);
  inputSurcharge += nonNegative(input.priceVideoInput) * nonNegative(input.videoInputCount);
  inputSurcharge += nonNegative(input.priceVideoInputPerSecond) * nonNegative(input.videoInputSeconds);
  inputSurcharge += nonNegative(input.priceAudioInput) * nonNegative(input.audioInputCount);
  inputSurcharge += nonNegative(input.priceAudioInputPerSecond) * nonNegative(input.audioInputSeconds);

  const finalUnit = Math.max(0, unitCredits + inputSurcharge);
  return {
    credits: finalUnit * outputCount,
    baseCredits,
    appliedDimension,
    inputSurcharge,
    unitCredits: finalUnit,
    outputCount
  };
}

/** 便捷封装：只关心最终积分。 */
export function resolveAiProviderCredits(input: AiProviderPriceInput): number | null {
  return resolveAiProviderPrice(input).credits;
}

/** 汇总通道上已配置的维度，供后台展示可编辑的价格档位。 */
export function summarizeAiProviderPriceDimensions(source: {
  priceVideoDurations?: unknown;
  priceVideoResolutions?: unknown;
  priceImageQualities?: unknown;
  priceImageResolutions?: unknown;
}) {
  return {
    videoDurations: readAiProviderPriceMatrix(source.priceVideoDurations),
    videoResolutions: readAiProviderPriceMatrix(source.priceVideoResolutions),
    imageQualities: readAiProviderPriceMatrix(source.priceImageQualities),
    imageResolutions: readAiProviderPriceMatrix(source.priceImageResolutions)
  };
}
