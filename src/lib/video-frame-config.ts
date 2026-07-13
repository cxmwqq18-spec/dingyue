export const DEFAULT_VIDEO_FRAME_LIMIT = 30;
export const MAX_VIDEO_FRAME_LIMIT = 30;
export const VIDEO_DURATION_OPTIONS = [
  { seconds: 6, creditMultiplier: 1 },
  { seconds: 10, creditMultiplier: 1.6 },
  { seconds: 15, creditMultiplier: 2.2 }
] as const;
export const DEFAULT_VIDEO_DURATION_SECONDS = VIDEO_DURATION_OPTIONS[0].seconds;

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
  return VIDEO_DURATION_OPTIONS.find((option) => option.seconds === seconds)?.seconds ?? fallbackOption.seconds;
}

export function videoDurationCreditCost(baseCreditCost: unknown, seconds: unknown): number {
  const parsedBase = typeof baseCreditCost === "number" || typeof baseCreditCost === "string" ? Number(baseCreditCost) : 0;
  const base = Number.isFinite(parsedBase) ? Math.max(0, Math.trunc(parsedBase)) : 0;
  const duration = normalizeVideoDurationSeconds(seconds);
  const option = VIDEO_DURATION_OPTIONS.find((item) => item.seconds === duration) ?? VIDEO_DURATION_OPTIONS[0];
  return Math.max(0, Math.ceil(base * option.creditMultiplier));
}
