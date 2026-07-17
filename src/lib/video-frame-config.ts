export const DEFAULT_VIDEO_FRAME_LIMIT = 30;
export const MAX_VIDEO_FRAME_LIMIT = 30;
export const MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT = 7;
export const MAX_VIDEO_DURATION_SECONDS = 10;
export const VIDEO_DURATION_OPTIONS = [
  { seconds: 6, creditMultiplier: 1 },
  { seconds: 10, creditMultiplier: 1.6 }
] as const;
export const DEFAULT_VIDEO_DURATION_SECONDS = VIDEO_DURATION_OPTIONS[0].seconds;
export const MAX_MULTI_REFERENCE_VIDEO_DURATION_SECONDS = MAX_VIDEO_DURATION_SECONDS;

export type VideoDurationSeconds = typeof VIDEO_DURATION_OPTIONS[number]["seconds"];

export function normalizeVideoFrameLimit(value: unknown, fallback = DEFAULT_VIDEO_FRAME_LIMIT): number {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  const fallbackNumber = Number(fallback);
  const fallbackCount = Number.isFinite(fallbackNumber) ? Math.trunc(fallbackNumber) : DEFAULT_VIDEO_FRAME_LIMIT;
  const count = Number.isFinite(parsed) ? Math.trunc(parsed) : fallbackCount;
  return Math.max(1, Math.min(MAX_VIDEO_FRAME_LIMIT, count));
}

export function trimVideoFrameSelection(frameIds: string[], maxFrames: unknown): string[] {
  const limit = normalizeVideoFrameLimit(maxFrames);
  return frameIds.length > limit ? frameIds.slice(-limit) : frameIds;
}

export function normalizeVideoDurationSeconds(value: unknown, fallback: unknown = DEFAULT_VIDEO_DURATION_SECONDS): VideoDurationSeconds {
  const fallbackNumber = typeof fallback === "number" || typeof fallback === "string" ? Number(fallback) : DEFAULT_VIDEO_DURATION_SECONDS;
  const fallbackOption = VIDEO_DURATION_OPTIONS.find((option) => option.seconds === Math.trunc(fallbackNumber)) ?? VIDEO_DURATION_OPTIONS[0];
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallbackOption.seconds;
  const seconds = Math.trunc(parsed);
  if (seconds > MAX_VIDEO_DURATION_SECONDS) return MAX_VIDEO_DURATION_SECONDS;
  return VIDEO_DURATION_OPTIONS.find((option) => option.seconds === seconds)?.seconds ?? fallbackOption.seconds;
}

export function videoDurationOptionsForFrameCount(frameCount: unknown): typeof VIDEO_DURATION_OPTIONS[number][] {
  void frameCount;
  return VIDEO_DURATION_OPTIONS.filter((option) => option.seconds <= MAX_VIDEO_DURATION_SECONDS);
}

export function normalizeVideoDurationSecondsForFrameCount(
  value: unknown,
  frameCount: unknown,
  fallback: unknown = DEFAULT_VIDEO_DURATION_SECONDS
): VideoDurationSeconds {
  const normalized = normalizeVideoDurationSeconds(value, fallback);
  const options = videoDurationOptionsForFrameCount(frameCount);
  if (options.some((option) => option.seconds === normalized)) return normalized;
  return options[options.length - 1]?.seconds ?? DEFAULT_VIDEO_DURATION_SECONDS;
}

export function videoDurationCreditCost(baseCreditCost: unknown, seconds: unknown): number {
  const parsedBase = typeof baseCreditCost === "number" || typeof baseCreditCost === "string" ? Number(baseCreditCost) : 0;
  const base = Number.isFinite(parsedBase) ? Math.max(0, Math.trunc(parsedBase)) : 0;
  const duration = normalizeVideoDurationSeconds(seconds);
  const option = VIDEO_DURATION_OPTIONS.find((item) => item.seconds === duration) ?? VIDEO_DURATION_OPTIONS[0];
  return Math.max(0, Math.ceil(base * option.creditMultiplier));
}
