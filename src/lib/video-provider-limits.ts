import { DEFAULT_VIDEO_FRAME_LIMIT, MAX_VIDEO_FRAME_LIMIT, normalizeVideoFrameLimit } from "@/lib/video-frame-config";

export type VideoProviderFrameLimitSource = {
  modelType?: string | null;
  maxImagesPerRequest?: number | null;
};

export function isVideoProviderModel(modelType: unknown): boolean {
  if (typeof modelType !== "string") return false;
  const normalized = modelType.trim().toLowerCase();
  return normalized.includes("video") || normalized.includes("grok-imagine-video");
}

function providerFrameLimit(provider: VideoProviderFrameLimitSource): number {
  const value = Number(provider.maxImagesPerRequest);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(Math.trunc(value), MAX_VIDEO_FRAME_LIMIT));
}

export function configuredVideoProviderFrameLimit(providers: VideoProviderFrameLimitSource[]): number | undefined {
  const limits = providers.filter((provider) => isVideoProviderModel(provider.modelType)).map(providerFrameLimit);
  return limits.length ? Math.min(...limits) : undefined;
}

export function effectiveVideoFrameLimit(providers: VideoProviderFrameLimitSource[], themeMaxFrames: unknown): number {
  void providers;
  const themeLimit = normalizeVideoFrameLimit(themeMaxFrames);
  return Math.max(themeLimit, DEFAULT_VIDEO_FRAME_LIMIT);
}
