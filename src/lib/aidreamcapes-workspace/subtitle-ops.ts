import type { SubtitleCue, SubtitleStyle } from "./types";

/**
 * Public catalog of the subtitle-completion operations. Safe to import from
 * client components: it only carries user-facing labels. The hardcoded model
 * instructions stay in the server-only companion module.
 */
export type SubtitleOpId = "captions_polish" | "promo_lines" | "marketing_copy";

export const SUBTITLE_OPS: { id: SubtitleOpId; label: string; summary: string }[] = [
  { id: "captions_polish", label: "Generate subtitles", summary: "Write timed subtitles for this video and burn them into a new version." },
  { id: "promo_lines", label: "Promo lines", summary: "Add short promotional lines timed to the video and burn them in." },
  { id: "marketing_copy", label: "Product copy", summary: "Turn your product details into on-screen copy and burn it in." }
];

export function isSubtitleOpId(value: unknown): value is SubtitleOpId {
  return typeof value === "string" && SUBTITLE_OPS.some((op) => op.id === value);
}

/** Structured plan the text model returns for a subtitle operation. */
export interface SubtitleOpPlan {
  style: SubtitleStyle;
  lines: SubtitleCue[];
}
