import "server-only";
import { sceneSchema, WORKSPACE_LANGUAGES } from "./catalogs";
import { validateCaptionLines } from "./captions";
import { compileVideoEdit, removeEditedRender, renderEditedVideo } from "./editor";
import { structuredDecision } from "./provider";
import { getTask, saveTask, type StoredTask } from "./store";
import { isSubtitleOpId, type SubtitleOpId, type SubtitleOpPlan } from "./subtitle-ops";
import { WorkspaceError, type WorkspaceTask } from "./types";

/**
 * Hardcoded instructions for the subtitle-completion operations. This file is
 * server-only: the instruction text must never reach the browser bundle or
 * any user-visible surface.
 */
const SUBTITLE_OP_CONTRACT = [
  "You are the subtitle completion planner for a product video workspace. Plan the caption lines that will be burned into the finished video.",
  'Reply with STRICT JSON only: {"style":"classic"|"bold"|"minimal","lines":[{"start":number,"end":number,"text":string}]}',
  "Rules:",
  "- Write the caption text in the language given in the context.",
  "- Lines are sequential, never overlapping, and stay within durationSeconds.",
  "- Each line must be readable in 1-6 seconds and hold at most 60 characters.",
  "- When spokenLines are supplied, follow their timing closely and fix obvious speech-to-text mistakes; do not copy filler words.",
  "- When spokenLines are missing and shots are supplied, time the lines along the shot boundaries.",
  "- Use the style supplied in the context when present; otherwise choose the style that fits the video."
].join("\n");

const SUBTITLE_OP_INTENT: Record<SubtitleOpId, string> = {
  captions_polish: "Operation: generate subtitles. Follow what is said or shown in the video and phrase it as readable on-screen captions.",
  promo_lines: "Operation: promo lines. Write short promotional lines (a hook, one or two benefits, and a closing call to action) that sell the product shown in the video.",
  marketing_copy: "Operation: product copy. Write on-screen copy built from the supplied product details: concrete feature phrases and one closing call to action."
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function assertSubtitleOpTask(task: StoredTask, args: { siteId: string; customerId: string; taskId: string }): void {  if (task.siteId !== args.siteId || task.customerId !== args.customerId || task.taskId !== args.taskId) {
    throw new WorkspaceError("task_not_found", 404);
  }
  if (task.status !== "completed" || task.storyboardStale || !task.storyboard?.shots.length || !task.video ||
      task.video.status !== "done" || !task.video.renderId || task.video.stale || !task.video.finalUrl) {
    throw new WorkspaceError("workspace_subtitle_op_not_ready", 409);
  }
  if (task.operation?.state === "pending" || task.operation?.state === "run") {
    throw new WorkspaceError("task_busy", 409);
  }
}

function editedDuration(task: WorkspaceTask): number {
  const video = task.video!;
  const duration = (video as typeof video & { editDuration?: number }).editDuration ?? task.input.options.duration;
  if (!Number.isFinite(duration) || duration <= 0) throw new WorkspaceError("workspace_subtitle_op_not_ready", 409);
  return duration;
}

function buildSubtitleOpContext(task: StoredTask, opId: SubtitleOpId, duration: number): Record<string, unknown> {
  const video = task.video!;
  const schema = sceneSchema(task.sceneId);
  const language = task.storyboard?.lang ?? task.input.options.language;
  const scriptParts: string[] = [];
  for (const [key, value] of Object.entries(task.input.fields)) {
    const text = Array.isArray(value) ? value.join(", ") : value;
    if (typeof text === "string" && text.trim()) scriptParts.push(`${key}: ${text.trim().slice(0, 2000)}`);
  }
  const shots = (task.storyboard?.shots ?? []).map((shot, index) => ({
    index: index + 1,
    start: round3(shot.start),
    end: round3(shot.end),
    visual: shot.visual.slice(0, 400),
    voiceover: shot.voiceover.slice(0, 400)
  }));
  const spokenLines = Array.isArray(video.captionLines) && video.captionLines.length
    ? video.captionLines.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text }))
    : undefined;
  return {
    operation: opId,
    intent: SUBTITLE_OP_INTENT[opId],
    videoTitle: task.title.slice(0, 200),
    scene: schema.name,
    language: { code: language, label: WORKSPACE_LANGUAGES.find((item) => item.value === language)?.label ?? language },
    durationSeconds: round3(duration),
    aspect: task.input.options.aspect,
    style: task.input.options.subtitleStyle,
    script: scriptParts,
    creativeDirection: task.input.creativeDirection?.trim().slice(0, 2000) || undefined,
    shots: shots.length ? shots : undefined,
    spokenLines
  };
}

/** Validate the model plan: strict shape, known style, caption lines inside the video duration. */
function validateSubtitleOpPlan(value: unknown, duration: number): SubtitleOpPlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("workspace_subtitle_op_plan_invalid", 502);
  const raw = value as Record<string, unknown>;
  if (Object.keys(raw).some((key) => !["style", "lines"].includes(key))) throw new WorkspaceError("workspace_subtitle_op_plan_invalid", 502);
  const style = raw.style === "classic" || raw.style === "bold" || raw.style === "minimal" ? raw.style : undefined;
  if (!style) throw new WorkspaceError("workspace_subtitle_op_plan_invalid", 502);
  const lines = validateCaptionLines(raw.lines, duration);
  return { style, lines };
}

export type SubtitleOpJobResult = {
  taskId: string;
  revision: number;
  renderId: string;
  finalUrl: string;
  opId: SubtitleOpId;
  style: string;
  linesCount: number;
  priorRenderIds: string[];
};

/**
 * One subtitle operation against one completed task: hardcoded instruction →
 * text model plan → caption draft bound to the current render → FFmpeg burn-in
 * → new version committed to the task's video history.
 */
export async function runSubtitleOp(args: { siteId: string; customerId: string; taskId: string; opId: SubtitleOpId }): Promise<SubtitleOpJobResult> {
  if (!isSubtitleOpId(args.opId)) throw new WorkspaceError("workspace_subtitle_op_invalid", 422);
  const task = await getTask(args.siteId, args.customerId, args.taskId);
  assertSubtitleOpTask(task, args);
  const video = task.video!;
  const duration = editedDuration(task);
  const decision = await structuredDecision(`${SUBTITLE_OP_CONTRACT}\n\n${SUBTITLE_OP_INTENT[args.opId]}`, buildSubtitleOpContext(task, args.opId, duration));
  const plan = validateSubtitleOpPlan(decision, duration);

  let uncommittedRenderId: string | undefined;
  try {
    // Stage the plan as a caption draft bound to the current render so the
    // edited render burns exactly these cues. Direct assignment mirrors
    // updateCaptionLines but does not require pre-existing caption lines.
    task.captionEdits = { renderId: video.renderId, lines: plan.lines, updatedAt: new Date().toISOString() };
    const compiled = compileVideoEdit(task, { subtitleStyle: plan.style });
    const rendered = await renderEditedVideo(task, compiled);
    uncommittedRenderId = rendered.renderId;

    const previous = task.video!;
    if (!task.videoHistory.some((entry) => entry.renderId === previous.renderId)) {
      task.videoHistory.push(structuredClone(previous));
    }
    task.video = rendered;
    task.captionEdits = undefined;
    task.status = "completed";
    const at = new Date().toISOString();
    task.subtitleCompletion = [...(task.subtitleCompletion ?? []), { at, opId: args.opId, renderId: rendered.renderId }].slice(-20);
    task.revisions.push({
      at,
      field: `subtitleOp:${args.opId}`,
      before: { renderId: previous.renderId, lines: previous.captionLines ?? [] },
      after: { renderId: rendered.renderId, lines: rendered.captionLines ?? [] }
    });
    task.revisions = task.revisions.slice(-100);
    const saved = await saveTask(task, task.revision);
    uncommittedRenderId = undefined;
    return {
      taskId: task.taskId,
      revision: saved.revision,
      renderId: rendered.renderId,
      finalUrl: rendered.finalUrl ?? "",
      opId: args.opId,
      style: plan.style,
      linesCount: plan.lines.length,
      priorRenderIds: saved.videoHistory.map((entry) => entry.renderId)
    };
  } catch (error) {
    if (uncommittedRenderId) await removeEditedRender(task, uncommittedRenderId).catch(() => undefined);
    throw error;
  }
}
