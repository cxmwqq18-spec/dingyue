import { WorkspaceError, type CaptionEditDraft, type SubtitleCue, type WorkspaceTask } from "./types";

const MAX_CAPTION_LINES = 500;
const MAX_CAPTION_TEXT_LENGTH = 2000;

function captionRender(task: WorkspaceTask) {
  const video = task.video;
  if (!video || task.status !== "completed" || video.status !== "done" || !video.renderId || !video.subtitleUrl ||
      video.stale || task.storyboardStale || !Array.isArray(video.captionLines) || video.captionLines.length === 0) {
    throw new WorkspaceError("workspace_caption_data_missing", 409);
  }
  return video;
}

export function validateCaptionLines(value: unknown, duration: number): SubtitleCue[] {
  if (!Number.isFinite(duration) || duration <= 0 || !Array.isArray(value) || value.length === 0 || value.length > MAX_CAPTION_LINES) {
    throw new WorkspaceError("workspace_caption_lines_invalid", 422);
  }
  const lines: SubtitleCue[] = [];
  let previousEnd = 0;
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new WorkspaceError("workspace_caption_line_invalid", 422);
    const line = candidate as Record<string, unknown>;
    if (Object.keys(line).some((key) => !["start", "end", "text"].includes(key)) ||
        typeof line.text !== "string" || line.text.length > MAX_CAPTION_TEXT_LENGTH ||
        !Number.isFinite(line.start) || !Number.isFinite(line.end)) {
      throw new WorkspaceError("workspace_caption_line_invalid", 422);
    }
    const text = line.text.trim().replace(/\s+/gu, " ");
    if (!text || /[\u0000-\u001F\u007F-\u009F]/u.test(text)) throw new WorkspaceError("workspace_caption_line_invalid", 422);
    const rawStart = Number(line.start), rawEnd = Number(line.end);
    if (rawStart < 0 || rawEnd <= rawStart || rawEnd > duration || rawStart < previousEnd) {
      throw new WorkspaceError("workspace_caption_timing_invalid", 422);
    }
    const start = Math.round(rawStart * 1000) / 1000;
    const end = Math.round(rawEnd * 1000) / 1000;
    if (end <= start || start < previousEnd) throw new WorkspaceError("workspace_caption_timing_invalid", 422);
    lines.push({ start, end, text });
    previousEnd = end;
  }
  return lines;
}

function currentAsrLines(task: WorkspaceTask) {
  const video = captionRender(task);
  const lines = validateCaptionLines(video.captionLines, task.input.options.duration);
  return { video, lines };
}

export function readCaptionLines(task: WorkspaceTask) {
  const { video, lines: asrLines } = currentAsrLines(task);
  const draft = task.captionEdits;
  if (draft && draft.renderId !== video.renderId) throw new WorkspaceError("workspace_caption_render_stale", 409);
  return {
    renderId: video.renderId,
    lines: draft ? validateCaptionLines(draft.lines, task.input.options.duration) : asrLines,
    edited: Boolean(draft),
  };
}

export function updateCaptionLines(task: WorkspaceTask, value: unknown, expectedRevision: number): CaptionEditDraft {
  if (task.revision !== expectedRevision) throw new WorkspaceError("revision_conflict", 409);
  if (task.operation?.state === "pending" || task.operation?.state === "run") throw new WorkspaceError("task_busy", 409);
  const { video, lines: asrLines } = currentAsrLines(task);
  const before = task.captionEdits?.renderId === video.renderId ? structuredClone(task.captionEdits.lines) : asrLines;
  const lines = validateCaptionLines(value, task.input.options.duration);
  const draft: CaptionEditDraft = { renderId: video.renderId, lines, updatedAt: new Date().toISOString() };
  task.captionEdits = draft;
  task.revisions.push({ at: draft.updatedAt, field: "captions", before, after: lines });
  task.revisions = task.revisions.slice(-100);
  return draft;
}

/** Resolve only a confirmed correction for the exact completed render it edits. */
export function confirmedCaptionEdits(task: WorkspaceTask, currentStoryboardHash: string): SubtitleCue[] | undefined {
  const draft = task.captionEdits;
  if (!draft) return undefined;
  const video = task.video;
  if (!video || video.status !== "done" || video.stale || task.storyboardStale ||
      draft.renderId !== video.renderId || video.storyboardHash !== currentStoryboardHash) {
    throw new WorkspaceError("workspace_caption_render_stale", 409);
  }
  return validateCaptionLines(draft.lines, task.input.options.duration);
}
