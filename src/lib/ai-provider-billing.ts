import "server-only";

import {
  resolveAiProviderPrice,
  type AiProviderPriceCapability,
  type AiProviderPriceBreakdown
} from "@/lib/ai-provider-pricing";
import { videoProviderModelFamilyForProvider } from "@/lib/video-provider-family";

/**
 * 计价的统一入口。
 *
 * 报价（工作台 quoteWorkspaceAction）与扣费（createGenerationJobInTx）必须调用本模块，
 * 否则同一请求会出现两个价格，触发 workspace_price_quote_changed 409。
 */

export type BillingProviderRow = {
  id: string;
  label?: string | null;
  aiUrl?: string | null;
  modelType: string;
  providerType?: string | null;
  enabled?: boolean | null;
  apiKey?: string | null;
  priority?: number | null;
  preferred?: boolean | null;
  videoModelFamily?: string | null;
  priceEnabled?: boolean | null;
  priceCredits?: number | null;
  priceVideoDurations?: unknown;
  priceVideoResolutions?: unknown;
  priceImageQualities?: unknown;
  priceImageResolutions?: unknown;
  priceImageInput?: number | null;
  priceVideoInputPerSecond?: number | null;
  priceAudioInput?: number | null;
  priceAudioInputPerSecond?: number | null;
  priceVideoInput?: number | null;
};

export type BillingRequestContext = {
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

/** 判断某个通道是否开启了模型级计价。 */
export function providerUsesModelPricing(provider?: Pick<BillingProviderRow, "priceEnabled"> | null): boolean {
  return Boolean(provider?.priceEnabled);
}

/**
 * 依据通道价格计算积分；通道未开启模型级计价时返回 null，由调用方回落主题价/应用价。
 */
export function providerCreditsForRequest(
  provider: BillingProviderRow | null | undefined,
  context: BillingRequestContext
): AiProviderPriceBreakdown | null {
  if (!provider) return null;
  const breakdown = resolveAiProviderPrice({
    priceEnabled: provider.priceEnabled,
    priceCredits: provider.priceCredits,
    priceVideoDurations: provider.priceVideoDurations,
    priceVideoResolutions: provider.priceVideoResolutions,
    priceImageQualities: provider.priceImageQualities,
    priceImageResolutions: provider.priceImageResolutions,
    priceImageInput: provider.priceImageInput,
    priceVideoInputPerSecond: provider.priceVideoInputPerSecond,
    priceAudioInput: provider.priceAudioInput,
    priceAudioInputPerSecond: provider.priceAudioInputPerSecond,
    priceVideoInput: provider.priceVideoInput,
    capabilityType: context.capabilityType,
    durationSeconds: context.durationSeconds,
    resolution: context.resolution,
    quality: context.quality,
    imageInputCount: context.imageInputCount,
    videoInputCount: context.videoInputCount,
    videoInputSeconds: context.videoInputSeconds,
    audioInputCount: context.audioInputCount,
    audioInputSeconds: context.audioInputSeconds,
    outputCount: context.outputCount
  });
  return breakdown.credits === null ? null : breakdown;
}

/**
 * 从候选通道里挑出用于计价的通道。
 * 优先使用请求显式指定的模型（modelOverride），否则按平台回退顺序取第一个可运行通道。
 */
export function selectBillingProvider(params: {
  providers: BillingProviderRow[];
  providerType: AiProviderPriceCapability;
  modelOverride?: string | null;
  modelFamily?: string | null;
}): BillingProviderRow | null {
  const candidates = params.providers.filter((provider) => {
    if (provider.enabled === false) return false;
    const type = (provider.providerType ?? "").toLowerCase();
    if (type && type !== params.providerType) return false;
    if (!provider.apiKey?.trim() && !provider.priceEnabled) return false;
    return true;
  });
  if (!candidates.length) return null;

  const override = params.modelOverride?.trim().toLowerCase();
  if (override) {
    const matched = candidates.find((provider) => provider.modelType.trim().toLowerCase() === override);
    if (matched) return matched;
  }

  const family = params.modelFamily;
  const familyMatched = family
    ? candidates.filter((provider) => videoProviderModelFamilyForProvider(provider) === family)
    : candidates;
  const pool = familyMatched.length ? familyMatched : candidates;

  return [...pool].sort((left, right) => {
    const priorityDelta = (left.priority ?? 0) - (right.priority ?? 0);
    if (priorityDelta) return priorityDelta;
    const preferredDelta = Number(Boolean(right.preferred)) - Number(Boolean(left.preferred));
    if (preferredDelta) return preferredDelta;
    return (left.label ?? left.id).localeCompare(right.label ?? right.id);
  })[0] ?? null;
}
