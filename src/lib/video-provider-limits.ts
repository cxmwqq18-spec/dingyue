import {
  CUSTOMER_VIDEO_FRAME_LIMIT,
  MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT,
  MAX_VIDEO_FRAME_LIMIT
} from "@/lib/video-frame-config";

export type VideoProviderFrameLimitSource = {
  aiUrl?: string | null;
  modelType?: string | null;
  providerType?: string | null;
  enabled?: boolean | null;
  maxImagesPerRequest?: number | null;
};

export function isVideoProviderModel(modelType: unknown): boolean {
  if (typeof modelType !== "string") return false;
  const normalized = modelType.trim().toLowerCase();
  return normalized.includes("video") ||
    normalized.includes("grok-imagine") ||
    /^veo[-.]?\d/.test(normalized) ||
    normalized.startsWith("sora-") ||
    normalized.startsWith("seedance-") ||
    normalized.startsWith("doubao-seedance-") ||
    normalized.startsWith("kling-") ||
    normalized.startsWith("vidu") ||
    normalized.startsWith("pixverse-") ||
    /^wan.*-video$/.test(normalized) ||
    normalized.startsWith("minimax-hailuo-") ||
    normalized.startsWith("happyhorse-") ||
    normalized === "wanneng-video";
}

function providerFrameLimit(provider: VideoProviderFrameLimitSource): number {
  const value = Number(provider.maxImagesPerRequest);
  const configured = Number.isFinite(value) ? Math.trunc(value) : 1;
  const normalized = Math.max(1, Math.min(configured, MAX_VIDEO_FRAME_LIMIT));
  if (typeof provider.modelType === "string" && provider.modelType.toLowerCase().includes("grok-imagine-video")) {
    return Math.min(normalized, MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT);
  }
  return normalized;
}

export function configuredVideoProviderFrameLimit(providers: VideoProviderFrameLimitSource[]): number | undefined {
  const limits = providers.filter((provider) => isVideoProviderModel(provider.modelType)).map(providerFrameLimit);
  return limits.length ? Math.min(...limits) : undefined;
}

export function effectiveVideoFrameLimit(providers: VideoProviderFrameLimitSource[], themeMaxFrames: unknown): number {
  void providers;
  void themeMaxFrames;
  return CUSTOMER_VIDEO_FRAME_LIMIT;
}
