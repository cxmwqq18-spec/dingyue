import "server-only";
import { sceneSchema, WORKSPACE_LANGUAGES } from "./catalogs";
import { validateCaptionLines } from "./captions";
import { compileVideoEdit, removeEditedRender, renderEditedVideo } from "./editor";
import { resolveTaskRenderFile } from "./media-render";
import { clampCuesToSpeech, measureSpeechWindows } from "./speech-windows";
import { structuredDecision } from "./provider";
import { getTask, saveTask, type StoredTask } from "./store";
import { isSubtitleOpId, type SubtitleOpId, type SubtitleOpPlan, type SubtitleOpSettings } from "./subtitle-ops";
import { WorkspaceError, type SubtitleCue, type WorkspaceTask } from "./types";

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
  "- Base the caption text on the actual spoken dialogue of the video — voiceover narration included — sentence by sentence; fix obvious speech-to-text mistakes and do not copy filler words.",
  "- Sync with the speech is mandatory: a line may only be on screen while its speech is spoken, appearing exactly when the words start and disappearing when they end — never earlier.",
  "- When measuredSpeechCues are supplied they are ground truth measured from the rendered audio: give each cue exactly one caption line and copy the cue's start and end verbatim. Split a cue into two consecutive lines only if its text exceeds 60 characters, dividing the cue's time window. Never show a line before its speech starts, never keep it on screen after the speech ends, and never place lines inside silent gaps.",
  "- When measuredSpeechCues are missing and shots are supplied, time the lines along the shot boundaries.",
  "- Use the style supplied in the context when present; otherwise choose the style that fits the video.",
  "- The renderer always preserves the original audio track; never plan anything that replaces it."
].join("\n");

const SUBTITLE_OP_INTENT: Record<SubtitleOpId, string> = {
  captions_polish: "Operation: generate subtitles. Caption the actual spoken dialogue sentence by sentence, synchronised with the speech so lines match the speaker's mouth. Follow the measured speech timings exactly when they are supplied.",
  promo_lines: "Operation: promo lines. Write short promotional lines (a hook, one or two benefits, and a closing call to action) that sell the product shown in the video.",
  marketing_copy: "Operation: product copy. Write on-screen copy built from the supplied product details: concrete feature phrases and one closing call to action."
};

/** Custom promo/copy text is burned verbatim, so it never reaches a text model. */
const CUSTOM_TEXT_MAX_LINES = 12;
const CUSTOM_TEXT_MAX_CHARS = 60;

/**
 * Turn customer-written promo/copy text into evenly timed caption lines: the
 * customer's own sentences shown one after another across the whole video.
 * Blank input is the caller's concern; this only shapes what is already there.
 */
function planLinesFromCustomText(text: string, duration: number): SubtitleCue[] {
  const paragraphs = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const sentences = (paragraphs.length > 1 ? paragraphs : text.split(/(?<=[。！？!?；;.])\s*/))
    .map((sentence) => sentence.trim()).filter(Boolean)
    .flatMap((sentence) => {
      const chunks: string[] = [];
      for (let at = 0; at < sentence.length; at += CUSTOM_TEXT_MAX_CHARS) chunks.push(sentence.slice(at, at + CUSTOM_TEXT_MAX_CHARS).trim());
      return chunks.filter(Boolean);
    })
    .slice(0, CUSTOM_TEXT_MAX_LINES);
  if (!sentences.length) throw new WorkspaceError("workspace_subtitle_op_settings_invalid", 422);
  const share = duration / sentences.length;
  return sentences.map((line, index) => ({
    start: round3(index * share),
    end: round3(Math.min((index + 1) * share, duration)),
    text: line
  }));
}

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

/**
 * Ground-truth speech timing on the video timeline, measured when the task was
 * generated: the current render's caption cues first, otherwise the verified
 * per-shot speech cues offset to the timeline. These drive lip-sync: captions
 * must match when the words are actually spoken, not when a text model guesses.
 */
function subtitleSpeechCues(task: StoredTask): SubtitleCue[] | undefined {
  const video = task.video!;
  if (Array.isArray(video.captionLines) && video.captionLines.length) {
    return video.captionLines.map((cue) => ({ start: cue.start, end: cue.end, text: cue.text }));
  }
  const shotCues: SubtitleCue[] = [];
  for (const shot of task.storyboard?.shots ?? []) {
    const version = shot.versions.find((candidate) => candidate.vid === shot.curVer);
    if (!version?.speechTimingVerified || !version.speechCues?.length) continue;
    for (const cue of version.speechCues) {
      shotCues.push({ start: round3(cue.start + shot.start), end: round3(Math.min(cue.end + shot.start, shot.end)), text: cue.text });
    }
  }
  return shotCues.length ? shotCues : undefined;
}

/**
 * Snap the model's caption lines onto the measured speech cues. The text model
 * writes the wording but cannot hear the video, so its timings drift from the
 * audio; clamping every line to the cue it overlaps makes lip-sync hold even
 * when the model ignores the instruction. Lines outside any speech are dropped
 * and speech without a matching line keeps its own measured text.
 */
function snapPlanLinesToSpeech(lines: SubtitleCue[], cues: SubtitleCue[]): SubtitleCue[] {
  const ordered = [...cues].sort((a, b) => a.start - b.start);
  const mapped = ordered.map((cue) => {
    const overlapping = lines.filter((line) => Math.min(line.end, cue.end) - Math.max(line.start, cue.start) > 0.3);
    if (!overlapping.length) return [cue];
    const weight = overlapping.reduce((sum, line) => sum + Math.max(line.text.length, 1), 0);
    const snapped: SubtitleCue[] = [];
    let cursor = cue.start;
    for (let lineIndex = 0; lineIndex < overlapping.length; lineIndex++) {
      const line = overlapping[lineIndex];
      const span = (cue.end - cue.start) * (Math.max(line.text.length, 1) / weight);
      const end = lineIndex === overlapping.length - 1 ? cue.end : Math.min(cue.end, Math.max(cursor + 0.2, cursor + span));
      if (end <= cursor) continue;
      snapped.push({ start: round3(cursor), end: round3(end), text: line.text });
      cursor = end;
    }
    return snapped;
  }).flat();
  // Keep cues sequential and non-overlapping after snapping.
  for (let index = 1; index < mapped.length; index++) {
    if (mapped[index].start < mapped[index - 1].end) mapped[index - 1].end = Math.max(mapped[index - 1].start + 0.2, mapped[index].start - 0.01);
  }
  return mapped;
}

function buildSubtitleOpContext(task: StoredTask, opId: SubtitleOpId, duration: number): Record<string, unknown> {
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
  const speechCues = opId === "captions_polish" ? subtitleSpeechCues(task) : undefined;
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
    ...(speechCues ? { measuredSpeechCues: speechCues, measuredSpeechCuesNote: "Timings measured from the rendered audio — ground truth for lip sync. Copy each cue's start and end verbatim." } : {})
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
export async function runSubtitleOp(args: { siteId: string; customerId: string; taskId: string; opId: SubtitleOpId; settings?: SubtitleOpSettings }): Promise<SubtitleOpJobResult> {
  if (!isSubtitleOpId(args.opId)) throw new WorkspaceError("workspace_subtitle_op_invalid", 422);
  const settings = args.settings ?? {};
  let task = await getTask(args.siteId, args.customerId, args.taskId);
  assertSubtitleOpTask(task, args);
  const suppliedLines = Boolean(settings.lines?.length);
  const decision = suppliedLines || (settings.text && args.opId !== "captions_polish")
    ? null
    : await structuredDecision(`${SUBTITLE_OP_CONTRACT}\n\n${SUBTITLE_OP_INTENT[args.opId]}`, buildSubtitleOpContext(task, args.opId, editedDuration(task)));
  // Measured lines supplied by the caller win: their timings are already the
  // ground truth, so neither the text model nor the snapping pass may move them.
  // Customer-written promo/copy text replaces the text model entirely; caption
  // dialogue still comes from the model so it can follow the actual speech.
  let plan: SubtitleOpPlan = suppliedLines
    ? { style: "classic", lines: validateCaptionLines(settings.lines!, editedDuration(task)) }
    : decision
      ? validateSubtitleOpPlan(decision, editedDuration(task))
      : { style: "classic", lines: planLinesFromCustomText(settings.text!.trim(), editedDuration(task)) };
  // Lip-sync guarantee: for dialogue captions, clamp the plan onto the measured
  // speech timings so lines appear and disappear with the actual voice track.
  const speechCues = !suppliedLines && args.opId === "captions_polish" ? subtitleSpeechCues(task) : undefined;
  if (speechCues?.length) plan = { style: plan.style, lines: snapPlanLinesToSpeech(plan.lines, speechCues) };
  // No measured speech cues means the plan's timing is a guess (the text model
  // cannot hear the video, and a caller may hand over drifted timings). Trim it
  // against the rendered audio so a caption never hangs over a real silent gap.
  if (!speechCues?.length && args.opId === "captions_polish") {
    const current = resolveTaskRenderFile(task, "video", task.video!.renderId);
    const windows = await measureSpeechWindows(current.path, editedDuration(task));
    if (windows.length) plan = { style: plan.style, lines: clampCuesToSpeech(plan.lines, windows) };
  }
  // Customer overrides win over the plan's style choice; unchosen dimensions stay automatic.
  const style = settings.style ?? plan.style;

  let saved: StoredTask | undefined;
  let committed: Awaited<ReturnType<typeof renderEditedVideo>> | undefined;
  let uncommittedRenderId: string | undefined;
  try {
    // One conflict retry: another writer (an edit in another window) may bump
    // the revision while the burn-in runs. The plan is re-staged against the
    // fresh cut and the burn-in repeats once; two concurrent burns of the same
    // task cannot happen because the route runs single-flight per task.
    for (let attempt = 0; attempt < 2 && !saved; attempt++) {
      if (attempt > 0) {
        task = await getTask(args.siteId, args.customerId, args.taskId);
        assertSubtitleOpTask(task, args);
        plan = { style: plan.style, lines: validateCaptionLines(plan.lines, editedDuration(task)) };
      }
      // Stage the plan as a caption draft bound to the current render so the
      // edited render burns exactly these cues. Direct assignment mirrors
      // updateCaptionLines but does not require pre-existing caption lines.
      task.captionEdits = { renderId: task.video!.renderId, lines: plan.lines, updatedAt: new Date().toISOString() };
      const compiled = compileVideoEdit(task, { subtitleStyle: style, ...(settings.size ? { subtitleSize: settings.size } : {}), ...(settings.position ? { subtitlePosition: settings.position } : {}), ...(settings.color ? { subtitleColor: settings.color } : {}), ...(settings.backdrop ? { subtitleBackdrop: settings.backdrop } : {}) });
      const rendered = await renderEditedVideo(task, compiled);
      uncommittedRenderId = rendered.renderId;

      const previous = task.video!;
      // The subtitle operation adds a subtitled version WITHOUT replacing the
      // task's main video. The library keeps showing the original render; the
      // new version lives in the history and is served per-render so the
      // studio can switch between Original and With subtitles.
      if (!task.videoHistory.some((entry) => entry.renderId === rendered.renderId)) {
        task.videoHistory.push(rendered);
      }
      task.videoHistory = task.videoHistory.slice(-20);
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
      try {
        saved = await saveTask(task, task.revision);
        committed = rendered;
        uncommittedRenderId = undefined;
      } catch (caught) {
        await removeEditedRender(task, rendered.renderId).catch(() => undefined);
        uncommittedRenderId = undefined;
        const knownConflict = caught instanceof WorkspaceError && caught.code === "revision_conflict";
        if (!knownConflict || attempt === 1) throw caught;
      }
    }
  } catch (error) {
    if (uncommittedRenderId) await removeEditedRender(task, uncommittedRenderId).catch(() => undefined);
    throw error;
  }
  return {
    taskId: task.taskId,
    revision: saved!.revision,
    renderId: committed!.renderId,
    finalUrl: `/api/sites/${task.siteId}/aivideosugc/tasks/${task.taskId}/output?kind=video&renderId=${encodeURIComponent(committed!.renderId)}`,
    opId: args.opId,
    style,
    linesCount: plan.lines.length,
    priorRenderIds: saved!.videoHistory.map((entry) => entry.renderId)
  };
}
