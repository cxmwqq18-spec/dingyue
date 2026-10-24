/**
 * 视频通道能力选项与归一化（后台编辑器、API 校验、关系存储共用）。
 *
 * 这里是唯一的能力事实源：UI 勾选项、接口校验、Prisma 写入与读取都使用
 * 同一套规则，避免"后台能选、保存被拒"或"保存成功、读回被裁剪"。
 */

export const AI_PROVIDER_VIDEO_DURATION_OPTIONS = [5, 6, 10, 15, 30] as const;
export const AI_PROVIDER_VIDEO_ASPECT_OPTIONS = ["9:16", "16:9", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"] as const;
export const AI_PROVIDER_VIDEO_RESOLUTION_OPTIONS = ["480p", "720p", "1080p"] as const;

export const AI_PROVIDER_VIDEO_DURATION_DEFAULTS = [6, 10, 15] as const;
export const AI_PROVIDER_VIDEO_ASPECT_DEFAULTS = ["9:16", "1:1", "16:9"] as const;
export const AI_PROVIDER_VIDEO_RESOLUTION_DEFAULTS = ["480p", "720p", "1080p"] as const;

/** 单次生成的参考素材上限（参考图 / 视频 / 音频）。 */
export const AI_PROVIDER_REFERENCE_LIMIT_MAX = 20;

const ASPECT_PATTERN = /^\d{1,2}:\d{1,2}$/;
const RESOLUTION_PATTERN = /^\d{3,4}p$/i;
const DURATION_MIN = 1;
const DURATION_MAX = 120;

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

/** 合法的视频时长：1–120 秒的整数。 */
export function isValidAiProviderVideoDuration(value: unknown): value is number {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= DURATION_MIN && numeric <= DURATION_MAX;
}

/** 合法的画幅：`宽:高`，例如 9:16、21:9。 */
export function isValidAiProviderVideoAspectRatio(value: unknown): value is string {
  return typeof value === "string" && ASPECT_PATTERN.test(value.trim());
}

/** 合法的视频分辨率：`720p` / `1080p` 这类档位。 */
export function isValidAiProviderVideoResolution(value: unknown): value is string {
  return typeof value === "string" && RESOLUTION_PATTERN.test(value.trim());
}

/** 合法的参考素材上限：0 表示不支持该模态，其余为 1–20。 */
export function isValidAiProviderReferenceLimit(value: unknown): value is number {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 && numeric <= AI_PROVIDER_REFERENCE_LIMIT_MAX;
}

export function normalizeAiProviderVideoDurations(
  value: unknown,
  fallback: readonly number[] = AI_PROVIDER_VIDEO_DURATION_DEFAULTS
): number[] {
  const normalized = Array.isArray(value) ? uniqueSorted(value.filter(isValidAiProviderVideoDuration).map(Number)) : [];
  return normalized.length ? normalized : [...fallback];
}

export function normalizeAiProviderVideoAspectRatios(
  value: unknown,
  fallback: readonly string[] = AI_PROVIDER_VIDEO_ASPECT_DEFAULTS
): string[] {
  const normalized = Array.isArray(value)
    ? [...new Set(value.filter(isValidAiProviderVideoAspectRatio).map((aspect) => aspect.trim()))]
    : [];
  return normalized.length ? normalized : [...fallback];
}

export function normalizeAiProviderVideoResolutions(
  value: unknown,
  fallback: readonly string[] = AI_PROVIDER_VIDEO_RESOLUTION_DEFAULTS
): string[] {
  const normalized = Array.isArray(value)
    ? [...new Set(value.filter(isValidAiProviderVideoResolution).map((resolution) => resolution.trim().toLowerCase()))]
    : [];
  return normalized.length ? normalized : [...fallback];
}

/** 参考素材上限归一化；`0` 是有效值，表示该模态不可用。 */
export function normalizeAiProviderReferenceLimit(value: unknown, fallback = 1): number {
  if (!isValidAiProviderReferenceLimit(value)) return Math.max(0, Math.min(Math.trunc(Number(fallback) || 0), AI_PROVIDER_REFERENCE_LIMIT_MAX));
  return Math.trunc(Number(value));
}
