export const DEFAULT_VIDEO_FRAME_LIMIT = 30;
export const MAX_VIDEO_FRAME_LIMIT = 30;
export const MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT = 7;
export const CUSTOMER_VIDEO_FRAME_LIMIT = MAX_MULTI_REFERENCE_VIDEO_FRAME_LIMIT;
export const MAX_VIDEO_DURATION_SECONDS = 15;
export const MAX_GROK_VIDEO_DURATION_SECONDS = MAX_VIDEO_DURATION_SECONDS;
export const VIDEO_MODEL_FAMILIES = ["grok", "gemini"] as const;
export type VideoModelFamily = typeof VIDEO_MODEL_FAMILIES[number];
export const AUTO_VIDEO_MODEL_FAMILY = "auto";
export type VideoModelPreference = VideoModelFamily | typeof AUTO_VIDEO_MODEL_FAMILY;
export const DEFAULT_VIDEO_MODEL_FAMILY: VideoModelFamily = "grok";
export const DEFAULT_VIDEO_RESOLUTION = "720p";
export const VIDEO_RESOLUTIONS = ["480p", DEFAULT_VIDEO_RESOLUTION, "1080p"] as const;
export type VideoResolution = typeof VIDEO_RESOLUTIONS[number];
export const VIDEO_RESOLUTION_CREDIT_MULTIPLIERS: Record<VideoResolution, number> = {
  "480p": 0.8,
  "720p": 1,
  "1080p": 1.5
};
const STANDARD_VIDEO_DURATION_MODEL_FAMILIES: readonly VideoModelFamily[] = VIDEO_MODEL_FAMILIES;
export const VIDEO_DURATION_OPTIONS = [
  { seconds: 6, creditMultiplier: 1, modelFamilies: STANDARD_VIDEO_DURATION_MODEL_FAMILIES },
  { seconds: 10, creditMultiplier: 10 / 6, modelFamilies: STANDARD_VIDEO_DURATION_MODEL_FAMILIES },
  { seconds: 15, creditMultiplier: 15 / 6, modelFamilies: STANDARD_VIDEO_DURATION_MODEL_FAMILIES }
] as const;
export const DEFAULT_VIDEO_DURATION_SECONDS = VIDEO_DURATION_OPTIONS[2].seconds;
export const MAX_MULTI_REFERENCE_VIDEO_DURATION_SECONDS = MAX_VIDEO_DURATION_SECONDS;

export type VideoDurationSeconds = typeof VIDEO_DURATION_OPTIONS[number]["seconds"];
export type VideoDurationOption = typeof VIDEO_DURATION_OPTIONS[number];
export type VideoModelPricing = Partial<Record<VideoModelFamily, Partial<Record<VideoDurationSeconds, number>>>>;

export function normalizeVideoModelFamily(value: unknown, fallback: VideoModelFamily = DEFAULT_VIDEO_MODEL_FAMILY): VideoModelFamily {
  return value === "gemini" || value === "grok" ? value : fallback;
}

export function normalizeVideoModelPreference(
  value: unknown,
  fallback: VideoModelPreference = DEFAULT_VIDEO_MODEL_FAMILY
): VideoModelPreference {
  if (value === AUTO_VIDEO_MODEL_FAMILY) return AUTO_VIDEO_MODEL_FAMILY;
  if (value === "gemini" || value === "grok") return value;
  return fallback;
}

export function isAutoVideoModelPreference(value: unknown): value is typeof AUTO_VIDEO_MODEL_FAMILY {
  return value === AUTO_VIDEO_MODEL_FAMILY;
}

export function normalizeVideoResolution(value: unknown): VideoResolution {
  return typeof value === "string" && VIDEO_RESOLUTIONS.some((resolution) => resolution === value.toLowerCase())
    ? value.toLowerCase() as VideoResolution
    : DEFAULT_VIDEO_RESOLUTION;
}

export function videoResolutionCreditCost(baseCreditCost: unknown, resolution: unknown = DEFAULT_VIDEO_RESOLUTION): number {
  const parsedBase = typeof baseCreditCost === "number" || typeof baseCreditCost === "string" ? Number(baseCreditCost) : 0;
  const base = Number.isFinite(parsedBase) ? Math.max(0, Math.trunc(parsedBase)) : 0;
  return Math.max(0, Math.ceil(base * VIDEO_RESOLUTION_CREDIT_MULTIPLIERS[normalizeVideoResolution(resolution)]));
}

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

function videoDurationOptionsForModelPreference(modelPreference: VideoModelPreference): VideoDurationOption[] {
  if (isAutoVideoModelPreference(modelPreference)) {
    return VIDEO_DURATION_OPTIONS.filter((option) =>
      VIDEO_MODEL_FAMILIES.every((family) => option.modelFamilies.includes(family))
    );
  }
  return VIDEO_DURATION_OPTIONS.filter((option) => option.modelFamilies.includes(modelPreference));
}

function fallbackVideoDurationOption(modelPreference: VideoModelPreference, fallback: unknown): VideoDurationOption {
  const fallbackNumber = typeof fallback === "number" || typeof fallback === "string" ? Number(fallback) : DEFAULT_VIDEO_DURATION_SECONDS;
  const options = videoDurationOptionsForModelPreference(modelPreference);
  return options.find((option) => option.seconds === Math.trunc(fallbackNumber)) ?? options[0] ?? VIDEO_DURATION_OPTIONS[0];
}

export function normalizeVideoDurationSeconds(
  value: unknown,
  fallback: unknown = DEFAULT_VIDEO_DURATION_SECONDS,
  modelFamily: unknown = DEFAULT_VIDEO_MODEL_FAMILY
): VideoDurationSeconds {
  const normalizedPreference = normalizeVideoModelPreference(modelFamily);
  const options = videoDurationOptionsForModelPreference(normalizedPreference);
  const fallbackOption = fallbackVideoDurationOption(normalizedPreference, fallback);
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(parsed)) return fallbackOption.seconds;
  const seconds = Math.trunc(parsed);
  const maxSeconds = options[options.length - 1]?.seconds ?? fallbackOption.seconds;
  if (seconds > maxSeconds) return maxSeconds;
  return options.find((option) => option.seconds === seconds)?.seconds ?? fallbackOption.seconds;
}

export function videoDurationOptionsForFrameCount(
  frameCount: unknown,
  modelFamily: unknown = DEFAULT_VIDEO_MODEL_FAMILY
): VideoDurationOption[] {
  void frameCount;
  return videoDurationOptionsForModelPreference(normalizeVideoModelPreference(modelFamily));
}

export function normalizeVideoDurationSecondsForFrameCount(
  value: unknown,
  frameCount: unknown,
  fallback: unknown = DEFAULT_VIDEO_DURATION_SECONDS,
  modelFamily: unknown = DEFAULT_VIDEO_MODEL_FAMILY
): VideoDurationSeconds {
  const normalizedPreference = normalizeVideoModelPreference(modelFamily);
  const normalized = normalizeVideoDurationSeconds(value, fallback, normalizedPreference);
  const options = videoDurationOptionsForFrameCount(frameCount, normalizedPreference);
  if (options.some((option) => option.seconds === normalized)) return normalized;
  return options[0]?.seconds ?? DEFAULT_VIDEO_DURATION_SECONDS;
}

function normalizedBaseCreditCost(baseCreditCost: unknown): number {
  const parsedBase = typeof baseCreditCost === "number" || typeof baseCreditCost === "string" ? Number(baseCreditCost) : 0;
  return Number.isFinite(parsedBase) ? Math.max(0, Math.trunc(parsedBase)) : 0;
}

function fallbackDurationCreditCost(baseCreditCost: unknown, seconds: VideoDurationSeconds): number {
  const base = normalizedBaseCreditCost(baseCreditCost);
  const option = VIDEO_DURATION_OPTIONS.find((item) => item.seconds === seconds) ?? VIDEO_DURATION_OPTIONS[0];
  return Math.max(0, Math.ceil(base * option.creditMultiplier));
}

function configuredDurationCreditCost(pricing: unknown, modelFamily: VideoModelFamily, seconds: VideoDurationSeconds): number | undefined {
  if (!pricing || typeof pricing !== "object" || Array.isArray(pricing)) return undefined;
  const familyPricing = (pricing as Record<string, unknown>)[modelFamily];
  if (!familyPricing || typeof familyPricing !== "object" || Array.isArray(familyPricing)) return undefined;
  const raw = (familyPricing as Record<string, unknown>)[String(seconds)] ?? (familyPricing as Record<number, unknown>)[seconds];
  const parsed = typeof raw === "number" || typeof raw === "string" ? Number(raw) : Number.NaN;
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, Math.trunc(parsed));
}

export function videoDurationCreditCost(
  baseCreditCost: unknown,
  seconds: unknown,
  modelFamily: unknown = DEFAULT_VIDEO_MODEL_FAMILY,
  pricing?: unknown
): number {
  const normalizedPreference = normalizeVideoModelPreference(modelFamily);
  const duration = normalizeVideoDurationSeconds(seconds, undefined, normalizedPreference);
  if (isAutoVideoModelPreference(normalizedPreference)) {
    return Math.max(...VIDEO_MODEL_FAMILIES.map((family) =>
      configuredDurationCreditCost(pricing, family, duration) ?? fallbackDurationCreditCost(baseCreditCost, duration)
    ));
  }
  return configuredDurationCreditCost(pricing, normalizedPreference, duration) ?? fallbackDurationCreditCost(baseCreditCost, duration);
}

export function videoDurationCreditCostForModelFamilies(
  baseCreditCost: unknown,
  seconds: unknown,
  modelFamilies: unknown,
  pricing?: unknown
): number {
  const families = Array.isArray(modelFamilies)
    ? Array.from(new Set(modelFamilies.map((family) => normalizeVideoModelPreference(family)).filter((family): family is VideoModelFamily => family === "grok" || family === "gemini")))
    : [];
  if (!families.length) return videoDurationCreditCost(baseCreditCost, seconds, AUTO_VIDEO_MODEL_FAMILY, pricing);
  return Math.max(...families.map((family) => videoDurationCreditCost(baseCreditCost, seconds, family, pricing)));
}

export function defaultVideoModelPricing(baseCreditCost: unknown): VideoModelPricing {
  const pricing: VideoModelPricing = {};
  for (const family of VIDEO_MODEL_FAMILIES) {
    pricing[family] = {};
    for (const option of videoDurationOptionsForFrameCount(0, family)) {
      pricing[family]![option.seconds] = fallbackDurationCreditCost(baseCreditCost, option.seconds);
    }
  }
  return pricing;
}

export function normalizeVideoModelPricing(value: unknown, baseCreditCost: unknown): VideoModelPricing {
  const fallback = defaultVideoModelPricing(baseCreditCost);
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const source = value as Record<string, unknown>;
  const pricing: VideoModelPricing = {};
  for (const family of VIDEO_MODEL_FAMILIES) {
    pricing[family] = {};
    const familySource = source[family];
    const familyRecord = familySource && typeof familySource === "object" && !Array.isArray(familySource)
      ? familySource as Record<string, unknown>
      : {};
    for (const option of videoDurationOptionsForFrameCount(0, family)) {
      const configured = configuredDurationCreditCost({ [family]: familyRecord }, family, option.seconds);
      pricing[family]![option.seconds] = configured ?? fallback[family]?.[option.seconds] ?? fallbackDurationCreditCost(baseCreditCost, option.seconds);
    }
  }
  return pricing;
}
