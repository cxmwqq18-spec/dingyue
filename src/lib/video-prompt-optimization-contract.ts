import {
  CUSTOMER_VIDEO_FRAME_LIMIT,
  DEFAULT_VIDEO_RESOLUTION,
  VIDEO_DURATION_OPTIONS,
  type VideoDurationSeconds,
  type VideoResolution
} from "@/lib/video-frame-config";

export const VIDEO_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH = 5000;
export const VIDEO_PROMPT_OPTIMIZATION_MAX_REFERENCES = CUSTOMER_VIDEO_FRAME_LIMIT;
export const VIDEO_PROMPT_OPTIMIZATION_DURATIONS: readonly VideoDurationSeconds[] = VIDEO_DURATION_OPTIONS.map((option) => option.seconds);
export const VIDEO_PROMPT_OPTIMIZATION_ASPECT_RATIOS = ["16:9", "4:3", "1:1", "3:4", "9:16"] as const;
export type VideoPromptOptimizationAspectRatio = typeof VIDEO_PROMPT_OPTIMIZATION_ASPECT_RATIOS[number];
export const VIDEO_PROMPT_OPTIMIZATION_RESOLUTIONS: readonly VideoResolution[] = [DEFAULT_VIDEO_RESOLUTION];

export function isVideoPromptOptimizationDuration(value: number): value is VideoDurationSeconds {
  return VIDEO_PROMPT_OPTIMIZATION_DURATIONS.some((candidate) => candidate === value);
}

export function isVideoPromptOptimizationAspectRatio(value: string): value is VideoPromptOptimizationAspectRatio {
  return VIDEO_PROMPT_OPTIMIZATION_ASPECT_RATIOS.some((candidate) => candidate === value);
}

export function isVideoPromptOptimizationResolution(value: string): value is VideoResolution {
  return VIDEO_PROMPT_OPTIMIZATION_RESOLUTIONS.some((candidate) => candidate === value);
}
