import {
  WorkspaceError,
  type SubtitleBackdrop,
  type SubtitleCue,
  type SubtitleStyle,
  type SubtitleTextColor,
  type SubtitleTextPosition,
  type SubtitleTextSize
} from "./types";

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

/** Customer style overrides sent alongside an operation request. Absent fields keep defaults. */
export interface SubtitleOpSettings {
  style?: SubtitleStyle;
  size?: SubtitleTextSize;
  position?: SubtitleTextPosition;
  color?: SubtitleTextColor;
  backdrop?: SubtitleBackdrop;
  /** Customer-written copy for the promo/marketing operations; captions always come from the video's speech. */
  text?: string;
  /**
   * Measured caption lines (start/end/text) supplied by the caller. When present
   * for captions_polish the plan uses these timings verbatim instead of asking
   * the text model to guess them.
   */
  lines?: SubtitleCue[];
}

export const SUBTITLE_SIZES = ["small", "medium", "large"] as const;
export const SUBTITLE_POSITIONS = ["bottom", "middle", "top"] as const;
export const SUBTITLE_COLORS = ["white", "yellow", "cyan", "black"] as const;
export const SUBTITLE_BACKDROPS = ["none", "box", "outline"] as const;

/**
 * Caption metrics shared by the renderer and the live preview, expressed in
 * libass script units. The SRT provider renders at PlayResY=288 and libass
 * scales everything by videoHeight/288, so these values are fractions of the
 * video height: medium ≈ 4.5%, small ≈ 3.4%, large ≈ 6%. The preview divides
 * them by 288 and multiplies by its own pixel height to reproduce the exact
 * proportions of the burned-in video.
 */
export const SUBTITLE_ASS_PLAY_RES_Y = 288;
export const SUBTITLE_ASS_BASE_FONT_SIZE = { classic: 13, bold: 15, minimal: 12 } as const;
export const SUBTITLE_ASS_SIZE_SCALE = { small: 0.75, medium: 1, large: 1.3 } as const;
export const SUBTITLE_ASS_BOTTOM_MARGIN = { classic: 16, bold: 18, minimal: 14 } as const;
export const SUBTITLE_ASS_FLOATING_MARGIN = 22;

const SUBTITLE_STYLE_VALUES = ["classic", "bold", "minimal"] as const;

/** Whitelist validator for the style overrides in an operation request body. */
export function parseSubtitleOpSettings(value: unknown): SubtitleOpSettings {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("workspace_subtitle_op_settings_invalid", 422);
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !["style", "size", "position", "color", "backdrop", "text", "lines"].includes(key))) {
    throw new WorkspaceError("workspace_subtitle_op_settings_invalid", 422);
  }
  const pick = <T extends string>(candidate: unknown, allowed: readonly T[]): T => {
    if (typeof candidate === "string" && (allowed as readonly string[]).includes(candidate)) return candidate as T;
    throw new WorkspaceError("workspace_subtitle_op_settings_invalid", 422);
  };
  const settings: SubtitleOpSettings = {};
  if (raw.style !== undefined) settings.style = pick(raw.style, SUBTITLE_STYLE_VALUES);
  if (raw.size !== undefined) settings.size = pick(raw.size, SUBTITLE_SIZES);
  if (raw.position !== undefined) settings.position = pick(raw.position, SUBTITLE_POSITIONS);
  if (raw.color !== undefined) settings.color = pick(raw.color, SUBTITLE_COLORS);
  if (raw.backdrop !== undefined) settings.backdrop = pick(raw.backdrop, SUBTITLE_BACKDROPS);
  if (raw.text !== undefined) {
    if (typeof raw.text !== "string") throw new WorkspaceError("workspace_subtitle_op_settings_invalid", 422);
    const text = raw.text.trim().replace(/\s*\n+\s*/g, "\n").slice(0, 800);
    if (!text) throw new WorkspaceError("workspace_subtitle_op_settings_invalid", 422);
    settings.text = text;
  }
  if (raw.lines !== undefined) {
    if (!Array.isArray(raw.lines) || raw.lines.length === 0 || raw.lines.length > 500) {
      throw new WorkspaceError("workspace_subtitle_op_settings_invalid", 422);
    }
    settings.lines = raw.lines.map((candidate) => {
      const line = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : null;
      if (!line || Object.keys(line).some((key) => !["start", "end", "text"].includes(key)) ||
          typeof line.text !== "string" || !Number.isFinite(line.start) || !Number.isFinite(line.end)) {
        throw new WorkspaceError("workspace_subtitle_op_settings_invalid", 422);
      }
      return { start: Number(line.start), end: Number(line.end), text: String(line.text) };
    });
  }
  return settings;
}

/** Structured plan the text model returns for a subtitle operation. */
export interface SubtitleOpPlan {
  style: SubtitleStyle;
  lines: SubtitleCue[];
}

export function subtitleOpLabel(id: SubtitleOpId): string {
  return SUBTITLE_OPS.find((op) => op.id === id)?.label ?? "Subtitle action";
}

/** Human copy for a failed operation. Job errors may arrive as strings or structured objects. */
export function subtitleOpErrorText(error: unknown): string {
  const code = typeof error === "string" ? error : error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code === "revision_conflict") return "This video changed while we worked. Please try again.";
  if (code === "task_busy") return "This video is busy. Wait for the current step to finish and try again.";
  if (code === "workspace_subtitle_op_not_ready") return "This video isn't ready for subtitle actions yet.";
  if (code === "workspace_subtitle_op_plan_invalid") return "The AI returned an unusable plan for this video. Please try again.";
  if (code.startsWith("workspace_storyboard_provider")) return "The AI service isn't available right now. Please try again later.";
  if (code === "workspace_video_processing_failed") return "The new version couldn't be rendered. Please try again.";
  if (code.startsWith("workspace_caption_")) return "The planned subtitles didn't fit this video. Please try again.";
  if (code.startsWith("workspace_subtitle_op")) return "This action didn't finish. Please try again.";
  if (code) return "This action didn't finish. Please try again.";
  return "This action didn't finish. Please try again.";
}
