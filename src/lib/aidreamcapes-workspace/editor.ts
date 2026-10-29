import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readClip, readTaskMusic } from "./media-render";
import { assertTaskMusicSelectionRights } from "./music-catalog";
import { isWorkspaceStabilityMockMode } from "./stability";
import { readMockShotClip } from "./mock-runtime";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type SubtitleBackdrop, type SubtitleCue, type SubtitleStyle, type SubtitleTextColor, type SubtitleTextPosition, type SubtitleTextSize, type VideoAspect, type VideoRender, type WorkspaceTask } from "./types";

const run = promisify(execFile);
const SAFE_ID = /^[a-zA-Z0-9_-]{1,180}$/;
const MAX_CLIP_BYTES = 250 * 1024 * 1024;
const MAX_RENDER_BYTES = 500 * 1024 * 1024;
const MIN_CLIP_SECONDS = 0.1;
const MIN_OUTPUT_SECONDS = 0.5;
const MAX_OUTPUT_SECONDS = 30;
const SPEED_MIN = 0.5;
const SPEED_MAX = 2;
const ALLOWED_ASPECTS = new Set<VideoAspect>(["9:16", "1:1", "16:9"]);
const OUTPUT_URL = (task: WorkspaceTask, kind: "video" | "subtitles") =>
  `/api/sites/${task.siteId}/aivideosugc/tasks/${task.taskId}/output?kind=${kind}`;

export interface ClipEditSetting {
  shotId: string;
  inPoint: number;
  outPoint: number;
  speed: number;
}

export interface VideoEditSettings {
  clips: ClipEditSetting[];
  order: string[];
  subtitleStyle: SubtitleStyle;
  /** Optional caption presentation overrides; absent fields keep the style default. */
  subtitleSize?: SubtitleTextSize;
  subtitlePosition?: SubtitleTextPosition;
  subtitleColor?: SubtitleTextColor;
  subtitleBackdrop?: SubtitleBackdrop;
  overlay: { text: string; cta: string };
  audio: { nativeGain: number; musicGain: number; mixMusic: boolean };
}

export type EditedVideoRender = VideoRender & {
  mock?: boolean;
  sourceRenderId?: string;
  editSettings?: VideoEditSettings;
  editDuration?: number;
  editAspect?: VideoAspect;
};

export type EditedWorkspaceTask = WorkspaceTask & { videoHistory: EditedVideoRender[] };

export interface CompiledVideoEdit {
  sourceRenderId: string;
  settings: VideoEditSettings;
  clips: Array<ClipEditSetting & { vid: string; clipUrl: string; sourceDuration: number }>;
  duration: number;
  aspect: VideoAspect;
  width: number;
  height: number;
}

function safeId(value: string): string {
  if (!SAFE_ID.test(value)) throw new WorkspaceError("workspace_render_identifier_invalid", 400);
  return value;
}

function assertEditTask(task: WorkspaceTask): asserts task is EditedWorkspaceTask {
  if (task.siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  if (task.status !== "completed" || task.storyboardStale || !task.storyboard?.shots.length || !task.video ||
      task.video.status !== "done" || !task.video.renderId || task.video.stale) {
    throw new WorkspaceError("workspace_edit_render_not_ready", 409);
  }
  if (task.operation?.state === "pending" || task.operation?.state === "run") throw new WorkspaceError("task_busy", 409);
}

function sourceRenderFor(task: EditedWorkspaceTask): { renderId: string; render: EditedVideoRender } {
  const current = task.video as EditedVideoRender;
  const renderId = current.sourceRenderId || current.renderId;
  const render = renderId === current.renderId
    ? current
    : task.videoHistory.find((entry) => entry.renderId === renderId);
  if (!render || render.status !== "done" || !render.renderId || render.stale || !Array.isArray(render.clips) || !render.clips.length) {
    throw new WorkspaceError("workspace_edit_source_missing", 409);
  }
  return { renderId, render };
}

function plainObject(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError(code, 422);
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, keys: string[], code: string) {
  if (Object.keys(value).some((key) => !keys.includes(key))) throw new WorkspaceError(code, 422);
}

function finiteNumber(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new WorkspaceError(code, 422);
  return value;
}

function bounded(value: number, min: number, max: number, code: string): number {
  if (value < min || value > max) throw new WorkspaceError(code, 422);
  return Math.round(value * 1000) / 1000;
}

function cleanOverlayText(value: unknown, max: number, code: string): string {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw new WorkspaceError(code, 422);
  const text = value.trim().replace(/\s+/gu, " ");
  if ([...text].length > max) throw new WorkspaceError(code, 422);
  return text;
}

/** Pure compiler for persisted edit settings. It performs no filesystem, provider, or ledger work. */
export function compileVideoEdit(task: WorkspaceTask, value: unknown): CompiledVideoEdit {
  assertEditTask(task);
  const current = task.video as EditedVideoRender;
  const { renderId: sourceRenderId, render: source } = sourceRenderFor(task);
  const aspect = task.input.options.aspect;
  if (!ALLOWED_ASPECTS.has(aspect)) throw new WorkspaceError("workspace_edit_aspect_invalid", 422);

  const clipByShot = new Map<string, { vid: string; clipUrl: string; sourceDuration: number }>();
  for (const clip of source.clips) {
    if (!clip || typeof clip.shotId !== "string" || !SAFE_ID.test(clip.shotId) || clipByShot.has(clip.shotId) ||
        typeof clip.vid !== "string" || !SAFE_ID.test(clip.vid) || typeof clip.clipUrl !== "string") {
      throw new WorkspaceError("workspace_edit_source_invalid", 409);
    }
    const shot = task.storyboard!.shots.find((candidate) => candidate.shotId === clip.shotId);
    const version = shot?.versions.find((candidate) => candidate.vid === clip.vid);
    if (!shot || !version || version.status !== "done" || version.clipUrl !== clip.clipUrl || shot.curVer !== version.vid ||
        !Number.isFinite(version.duration) || version.duration <= 0) {
      throw new WorkspaceError("workspace_edit_source_stale", 409, { shotId: clip.shotId });
    }
    clipByShot.set(clip.shotId, { vid: clip.vid, clipUrl: clip.clipUrl, sourceDuration: version.duration });
  }
  if (clipByShot.size !== task.storyboard!.shots.length) throw new WorkspaceError("workspace_edit_source_incomplete", 409);

  const prior = current.editSettings;
  const priorByShot = new Map((prior?.clips || []).map((entry) => [entry.shotId, entry]));
  const clipSettings = new Map<string, ClipEditSetting>();
  for (const [shotId, sourceClip] of clipByShot) {
    const previous = priorByShot.get(shotId);
    const defaultSetting: ClipEditSetting = previous
      ? { shotId, inPoint: previous.inPoint, outPoint: previous.outPoint, speed: previous.speed }
      : { shotId, inPoint: 0, outPoint: sourceClip.sourceDuration, speed: 1 };
    clipSettings.set(shotId, defaultSetting);
  }

  const patch = value === undefined ? {} : plainObject(value, "workspace_edit_patch_invalid");
  assertExactKeys(patch, ["clips", "order", "subtitleStyle", "subtitleSize", "subtitlePosition", "subtitleColor", "subtitleBackdrop", "overlay", "audio"], "workspace_edit_patch_invalid");
  if (patch.clips !== undefined) {
    if (!Array.isArray(patch.clips) || patch.clips.length > clipByShot.size) throw new WorkspaceError("workspace_edit_clips_invalid", 422);
    const seen = new Set<string>();
    for (const candidate of patch.clips) {
      const raw = plainObject(candidate, "workspace_edit_clip_invalid");
      assertExactKeys(raw, ["shotId", "inPoint", "outPoint", "speed"], "workspace_edit_clip_invalid");
      const shotId = raw.shotId;
      if (typeof shotId !== "string" || !clipByShot.has(shotId) || seen.has(shotId)) throw new WorkspaceError("workspace_edit_clip_invalid", 422);
      seen.add(shotId);
      const previous = clipSettings.get(shotId)!;
      clipSettings.set(shotId, {
        shotId,
        inPoint: raw.inPoint === undefined ? previous.inPoint : finiteNumber(raw.inPoint, "workspace_edit_clip_range_invalid"),
        outPoint: raw.outPoint === undefined ? previous.outPoint : finiteNumber(raw.outPoint, "workspace_edit_clip_range_invalid"),
        speed: raw.speed === undefined ? previous.speed : finiteNumber(raw.speed, "workspace_edit_speed_invalid"),
      });
    }
  }

  const clipsInSourceOrder = [...clipByShot.keys()].map((shotId) => {
    const setting = clipSettings.get(shotId)!;
    const sourceClip = clipByShot.get(shotId)!;
    const inPoint = bounded(setting.inPoint, 0, sourceClip.sourceDuration, "workspace_edit_clip_range_invalid");
    const outPoint = bounded(setting.outPoint, 0, sourceClip.sourceDuration, "workspace_edit_clip_range_invalid");
    const speed = bounded(setting.speed, SPEED_MIN, SPEED_MAX, "workspace_edit_speed_invalid");
    if (outPoint - inPoint < MIN_CLIP_SECONDS) throw new WorkspaceError("workspace_edit_clip_range_invalid", 422);
    return { shotId, inPoint, outPoint, speed, ...sourceClip };
  });

  let order = prior?.order ? [...prior.order] : [...clipByShot.keys()];
  if (patch.order !== undefined) {
    if (!Array.isArray(patch.order) || patch.order.some((entry) => typeof entry !== "string")) throw new WorkspaceError("workspace_edit_order_invalid", 422);
    order = [...patch.order] as string[];
  }
  if (order.length !== clipByShot.size || new Set(order).size !== order.length || order.some((shotId) => !clipByShot.has(shotId))) {
    throw new WorkspaceError("workspace_edit_order_invalid", 422);
  }

  const previousOverlay = prior?.overlay || { text: "", cta: "" };
  const subtitleStyle = patch.subtitleStyle === undefined ? prior?.subtitleStyle ?? task.input.options.subtitleStyle ?? "classic" : patch.subtitleStyle;
  if (subtitleStyle !== "classic" && subtitleStyle !== "bold" && subtitleStyle !== "minimal") {
    throw new WorkspaceError("workspace_edit_subtitle_style_invalid", 422);
  }
  const subtitleSize = patch.subtitleSize === undefined ? prior?.subtitleSize : patch.subtitleSize;
  if (subtitleSize !== undefined && subtitleSize !== "small" && subtitleSize !== "medium" && subtitleSize !== "large") {
    throw new WorkspaceError("workspace_edit_subtitle_style_invalid", 422);
  }
  const subtitlePosition = patch.subtitlePosition === undefined ? prior?.subtitlePosition : patch.subtitlePosition;
  if (subtitlePosition !== undefined && subtitlePosition !== "bottom" && subtitlePosition !== "middle" && subtitlePosition !== "top") {
    throw new WorkspaceError("workspace_edit_subtitle_style_invalid", 422);
  }
  const subtitleColor = patch.subtitleColor === undefined ? prior?.subtitleColor : patch.subtitleColor;
  if (subtitleColor !== undefined && subtitleColor !== "white" && subtitleColor !== "yellow" && subtitleColor !== "cyan" && subtitleColor !== "black") {
    throw new WorkspaceError("workspace_edit_subtitle_style_invalid", 422);
  }
  const subtitleBackdrop = patch.subtitleBackdrop === undefined ? prior?.subtitleBackdrop : patch.subtitleBackdrop;
  if (subtitleBackdrop !== undefined && subtitleBackdrop !== "none" && subtitleBackdrop !== "box" && subtitleBackdrop !== "outline") {
    throw new WorkspaceError("workspace_edit_subtitle_style_invalid", 422);
  }
  const overlayPatch = patch.overlay === undefined ? {} : plainObject(patch.overlay, "workspace_edit_overlay_invalid");
  assertExactKeys(overlayPatch, ["text", "cta"], "workspace_edit_overlay_invalid");
  const overlay = {
    text: cleanOverlayText(overlayPatch.text === undefined ? previousOverlay.text : overlayPatch.text, 140, "workspace_edit_text_invalid"),
    cta: cleanOverlayText(overlayPatch.cta === undefined ? previousOverlay.cta : overlayPatch.cta, 100, "workspace_edit_cta_invalid"),
  };

  const previousAudio = prior?.audio || { nativeGain: 1, musicGain: 0, mixMusic: false };
  const audioPatch = patch.audio === undefined ? {} : plainObject(patch.audio, "workspace_edit_audio_invalid");
  assertExactKeys(audioPatch, ["nativeGain", "musicGain", "mixMusic"], "workspace_edit_audio_invalid");
  const nativeGain = audioPatch.nativeGain === undefined ? previousAudio.nativeGain : finiteNumber(audioPatch.nativeGain, "workspace_edit_audio_invalid");
  const musicGain = audioPatch.musicGain === undefined ? previousAudio.musicGain : finiteNumber(audioPatch.musicGain, "workspace_edit_audio_invalid");
  const mixMusic = audioPatch.mixMusic === undefined ? previousAudio.mixMusic : audioPatch.mixMusic;
  if (typeof mixMusic !== "boolean" || nativeGain < 0 || nativeGain > 2 || musicGain < 0 || musicGain > 2 ||
      (mixMusic && !task.input.musicUrl && !task.musicSelection)) throw new WorkspaceError("workspace_edit_audio_invalid", 422);
  const audio = { nativeGain: Math.round(nativeGain * 1000) / 1000, musicGain: Math.round(musicGain * 1000) / 1000, mixMusic };

  const orderedClips = order.map((shotId) => clipsInSourceOrder.find((clip) => clip.shotId === shotId)!);
  const duration = Math.round(orderedClips.reduce((total, clip) => total + (clip.outPoint - clip.inPoint) / clip.speed, 0) * 1000) / 1000;
  if (!Number.isFinite(duration) || duration < MIN_OUTPUT_SECONDS || duration > MAX_OUTPUT_SECONDS) {
    throw new WorkspaceError("workspace_edit_duration_invalid", 422, { duration, minimum: MIN_OUTPUT_SECONDS, maximum: MAX_OUTPUT_SECONDS });
  }
  const [width, height] = aspect === "9:16" ? [720, 1280] : aspect === "1:1" ? [720, 720] : [1280, 720];
  return {
    sourceRenderId,
    settings: { clips: clipsInSourceOrder.map(({ shotId, inPoint, outPoint, speed }) => ({ shotId, inPoint, outPoint, speed })), order, subtitleStyle, ...(subtitleSize ? { subtitleSize } : {}), ...(subtitlePosition ? { subtitlePosition } : {}), ...(subtitleColor ? { subtitleColor } : {}), ...(subtitleBackdrop ? { subtitleBackdrop } : {}), overlay, audio },
    clips: orderedClips.map(({ shotId, inPoint, outPoint, speed, vid, clipUrl, sourceDuration }) => ({ shotId, inPoint, outPoint, speed, vid, clipUrl, sourceDuration })),
    duration,
    aspect,
    width,
    height,
  };
}

function renderRoot() {
  return path.resolve(process.env.AIVIDEOSUGC_RENDER_ROOT?.trim() || path.join(process.cwd(), "data", "aidreamcapes-workspace-render"));
}

export function editedRenderDirectory(task: Pick<WorkspaceTask, "siteId" | "customerId" | "taskId">, renderId: string) {
  if (task.siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  return path.resolve(renderRoot(), task.siteId, safeId(task.customerId), safeId(task.taskId), safeId(renderId));
}

function assertContained(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new WorkspaceError("workspace_edit_path_invalid", 404);
}

async function mkdirContained(directory: string) {
  const root = renderRoot();
  assertContained(root, directory);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const rootReal = await fs.realpath(root);
  const directoryReal = await fs.realpath(directory);
  const expected = path.join(rootReal, path.relative(root, directory));
  if (directoryReal !== expected) throw new WorkspaceError("workspace_edit_path_invalid", 404);
}

async function readContainedFile(file: string, maxBytes: number): Promise<Buffer> {
  const root = renderRoot();
  assertContained(root, file);
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const rootReal = await fs.realpath(root);
    const directoryReal = await fs.realpath(path.dirname(file));
    const expectedDirectory = path.join(rootReal, path.relative(root, path.dirname(file)));
    if (directoryReal !== expectedDirectory) throw new WorkspaceError("workspace_edit_path_invalid", 404);
    const [entry, realFile] = await Promise.all([fs.lstat(file), fs.realpath(file)]);
    if (!entry.isFile() || entry.isSymbolicLink() || entry.size <= 0 || entry.size > maxBytes ||
        realFile !== path.join(directoryReal, path.basename(file))) throw new WorkspaceError("workspace_edit_source_missing", 409);
    handle = await fs.open(realFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size !== entry.size || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      throw new WorkspaceError("workspace_edit_source_missing", 409);
    }
    const bytes = await handle.readFile();
    await handle.close();
    handle = undefined;
    return bytes;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    if (error instanceof WorkspaceError) throw error;
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") throw new WorkspaceError("workspace_edit_source_missing", 409);
    throw new WorkspaceError("workspace_edit_source_unavailable", 503);
  }
}

async function ffmpeg(args: string[]) {
  try {
    await run(process.env.AIVIDEOSUGC_FFMPEG_BIN?.trim() || "ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], { timeout: 300_000, maxBuffer: 2 * 1024 * 1024 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WorkspaceError("workspace_ffmpeg_unavailable", 503);
    throw new WorkspaceError("workspace_video_processing_failed", 502);
  }
}

async function inspectVideo(file: string) {
  try {
    const result = await run(process.env.AIVIDEOSUGC_FFPROBE_BIN?.trim() || "ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { timeout: 20_000, maxBuffer: 512 * 1024 });
    const value = JSON.parse(result.stdout) as { streams: Array<{ codec_type: string; width?: number; height?: number }>; format: { duration: string } };
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WorkspaceError("workspace_ffprobe_unavailable", 503);
    throw new WorkspaceError("workspace_clip_media_invalid", 422);
  }
}

function fixed(value: number) { return String(Math.round(value * 1000) / 1000); }

function escapeFilterPath(value: string) {
  if (/[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw new WorkspaceError("workspace_edit_path_invalid", 404);
  return value.replace(/\\/gu, "\\\\").replace(/:/gu, "\\:").replace(/'/gu, "'\\''")
    .replace(/,/gu, "\\,").replace(/;/gu, "\\;").replace(/\[/gu, "\\[").replace(/\]/gu, "\\]");
}

function srtTime(seconds: number) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const ms = milliseconds % 1000;
  const totalSeconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(totalSeconds / 3600)).padStart(2, "0")}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function cleanCaptionLines(value: unknown, duration: number): SubtitleCue[] {
  if (!Array.isArray(value)) return [];
  const lines: SubtitleCue[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const cue = candidate as Record<string, unknown>;
    if (typeof cue.text !== "string" || !Number.isFinite(cue.start) || !Number.isFinite(cue.end)) continue;
    const text = cue.text.trim().replace(/\s+/gu, " ");
    const start = Number(cue.start), end = Number(cue.end);
    if (!text || /[\u0000-\u001f\u007f-\u009f]/u.test(text) || [...text].length > 2000 || start < 0 || end <= start || end > duration) continue;
    lines.push({ start, end, text });
  }
  return lines.sort((a, b) => a.start - b.start || a.end - b.end);
}

function timeline(settings: VideoEditSettings, clips: Array<{ shotId: string; duration: number }>) {
  const byId = new Map(settings.clips.map((clip) => [clip.shotId, clip]));
  let offset = 0;
  return settings.order.map((shotId) => {
    const setting = byId.get(shotId)!;
    const duration = (setting.outPoint - setting.inPoint) / setting.speed;
    const entry = { shotId, inPoint: setting.inPoint, outPoint: setting.outPoint, speed: setting.speed, start: offset, end: offset + duration };
    offset += duration;
    return entry;
  }).filter((entry) => clips.some((clip) => clip.shotId === entry.shotId));
}

function remapCaptions(task: EditedWorkspaceTask, compiled: CompiledVideoEdit, current: EditedVideoRender): SubtitleCue[] {
  const currentCueSource = task.captionEdits?.renderId === current.renderId ? task.captionEdits.lines : current.captionLines;
  if (!currentCueSource) return [];
  const currentSettings = current.editSettings || {
    clips: compiled.clips.map((clip) => ({ shotId: clip.shotId, inPoint: 0, outPoint: clip.sourceDuration, speed: 1 })),
    order: current.clips.map((clip) => clip.shotId),
    subtitleStyle: task.input.options.subtitleStyle ?? "classic",
    overlay: { text: "", cta: "" },
    audio: { nativeGain: 1, musicGain: 0, mixMusic: false },
  };
  const currentDuration = current.editDuration || currentSettings.clips.reduce((total, clip) => total + (clip.outPoint - clip.inPoint) / clip.speed, 0);
  const currentCues = cleanCaptionLines(currentCueSource, currentDuration);
  const oldTimeline = timeline(currentSettings, compiled.clips.map((clip) => ({ shotId: clip.shotId, duration: clip.sourceDuration })));
  const nextTimeline = timeline(compiled.settings, compiled.clips.map((clip) => ({ shotId: clip.shotId, duration: clip.sourceDuration })));
  const mapped: SubtitleCue[] = [];
  for (const cue of currentCues) {
    for (const oldClip of oldTimeline) {
      const start = Math.max(cue.start, oldClip.start);
      const end = Math.min(cue.end, oldClip.end);
      if (end <= start) continue;
      const sourceStart = oldClip.inPoint + (start - oldClip.start) * oldClip.speed;
      const sourceEnd = oldClip.inPoint + (end - oldClip.start) * oldClip.speed;
      for (const nextClip of nextTimeline) {
        if (nextClip.shotId !== oldClip.shotId) continue;
        const nextStart = Math.max(sourceStart, nextClip.inPoint);
        const nextEnd = Math.min(sourceEnd, nextClip.outPoint);
        if (nextEnd <= nextStart) continue;
        mapped.push({
          start: nextClip.start + (nextStart - nextClip.inPoint) / nextClip.speed,
          end: nextClip.start + (nextEnd - nextClip.inPoint) / nextClip.speed,
          text: cue.text,
        });
      }
    }
  }
  mapped.sort((a, b) => a.start - b.start || a.end - b.end);
  const safe: SubtitleCue[] = [];
  for (const cue of mapped) {
    const previous = safe[safe.length - 1];
    if (previous && cue.start < previous.end) cue.start = previous.end;
    if (cue.end - cue.start >= 0.05 && cue.end <= compiled.duration + 0.02) safe.push(cue);
  }
  return safe;
}

function subtitleFile(cues: SubtitleCue[]) {
  return cues.map((cue, index) => `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text.replace(/[{}]/gu, "\\$&")}\n`).join("\n");
}

function taskStoryboardHash(task: WorkspaceTask) {
  return crypto.createHash("sha256").update(JSON.stringify({ input: task.input, musicSelection: task.musicSelection ?? null, storyboard: task.storyboard })).digest("hex");
}

/** Base caption font size per style, before the customer size override. */
const SUBTITLE_BASE_FONT_SIZE = { classic: 22, bold: 26, minimal: 20 } as const;
const SUBTITLE_SIZE_SCALE = { small: 0.8, medium: 1, large: 1.3 } as const;
const SUBTITLE_ALIGNMENT = { bottom: 2, middle: 5, top: 8 } as const;
/** ASS colours are &HAABBGGRR. */
const SUBTITLE_PRIMARY_COLOURS = { white: "&H00FFFFFF", yellow: "&H0000FFFF", cyan: "&H00FFFF00", black: "&H00000000" } as const;

/** libass force_style string for the style preset with the size, position, colour and backdrop overrides applied. */
function subtitleAssStyle(settings: VideoEditSettings): string {
  const fontSize = Math.round(SUBTITLE_BASE_FONT_SIZE[settings.subtitleStyle] * SUBTITLE_SIZE_SCALE[settings.subtitleSize ?? "medium"]);
  const alignment = SUBTITLE_ALIGNMENT[settings.subtitlePosition ?? "bottom"];
  const marginV = settings.subtitlePosition === undefined || settings.subtitlePosition === "bottom"
    ? settings.subtitleStyle === "bold" ? 48 : settings.subtitleStyle === "minimal" ? 36 : 44
    : 56;
  const colour = settings.subtitleColor ?? "white";
  const backdrop = settings.subtitleBackdrop ?? (settings.subtitleStyle === "bold" ? "box" : "outline");
  // Black text stays readable by swapping the dark box for a translucent light one.
  const boxColour = colour === "black" ? "&H80FFFFFF" : "&H80000000";
  const outlineWidth = settings.subtitleBackdrop === undefined && settings.subtitleStyle === "minimal" ? 1 : 2;
  const boxParams = backdrop === "box"
    ? `BackColour=${boxColour},BorderStyle=3,Outline=0,Shadow=0`
    : backdrop === "none"
      ? "BorderStyle=1,Outline=0,Shadow=1"
      : `BorderStyle=1,Outline=${outlineWidth},Shadow=${settings.subtitleBackdrop === undefined && settings.subtitleStyle === "minimal" ? 1 : 0}`;
  return `FontName=Arial,FontSize=${fontSize},Bold=${settings.subtitleStyle === "bold" ? 1 : 0},PrimaryColour=${SUBTITLE_PRIMARY_COLOURS[colour]},OutlineColour=&H80000000,${boxParams},Alignment=${alignment},MarginV=${marginV}`;
}

function outputVideoFilter(dir: string, compiled: CompiledVideoEdit, cues: SubtitleCue[], style: string) {  const filters: string[] = [];
  if (cues.length) {
    const filename = escapeFilterPath(path.join(dir, "subtitles.srt"));
    filters.push(`subtitles=filename='${filename}':force_style='${style}'`);
  }
  if (compiled.settings.overlay.text) {
    const filename = escapeFilterPath(path.join(dir, "overlay-text.txt"));
    filters.push(`drawtext=textfile='${filename}':expansion=none:fontcolor=white:fontsize=36:borderw=2:bordercolor=black:x=(w-text_w)/2:y=42`);
  }
  if (compiled.settings.overlay.cta) {
    const filename = escapeFilterPath(path.join(dir, "overlay-cta.txt"));
    filters.push(`drawtext=textfile='${filename}':expansion=none:fontcolor=white:fontsize=32:box=1:boxcolor=black@0.65:boxborderw=16:x=(w-text_w)/2:y=h-th-56`);
  }
  return filters.join(",");
}

/** Re-render a completed task with local FFmpeg only. Every output gets a new immutable render directory. */
export async function renderEditedVideo(task: WorkspaceTask, compiled: CompiledVideoEdit): Promise<EditedVideoRender> {
  assertEditTask(task);
  if (compiled.settings.audio.mixMusic && task.musicSelection) await assertTaskMusicSelectionRights(task);
  const editedTask = task as EditedWorkspaceTask;
  const source = sourceRenderFor(editedTask);
  if (source.renderId !== compiled.sourceRenderId) throw new WorkspaceError("workspace_edit_source_changed", 409);
  const sourceFinalPath = path.join(editedRenderDirectory(task, source.renderId), "final.mp4");
  const renderId = `edit-${crypto.randomUUID()}`;
  const dir = editedRenderDirectory(task, renderId);
  await mkdirContained(dir);
  let completed = false;
  try {
    const sourceFinalBytes = await readContainedFile(sourceFinalPath, MAX_RENDER_BYTES);
    const sourceProofPath = path.join(dir, "source-render.mp4");
    await fs.writeFile(sourceProofPath, sourceFinalBytes, { mode: 0o600, flag: "wx" });
    const sourceInfo = await inspectVideo(sourceProofPath);
    const sourceVideo = sourceInfo.streams.find((stream) => stream.codec_type === "video");
    if (!sourceVideo?.width || !sourceVideo.height || !sourceInfo.streams.some((stream) => stream.codec_type === "audio")) {
      throw new WorkspaceError("workspace_edit_source_invalid", 422);
    }
    const sourceAspect = sourceVideo.width / sourceVideo.height;
    const targetAspect = compiled.width / compiled.height;
    if (Math.abs(sourceAspect - targetAspect) > 0.02) throw new WorkspaceError("workspace_edit_aspect_mismatch", 422);

    for (let index = 0; index < compiled.clips.length; index++) {
      const clip = compiled.clips[index];
      const mock = isWorkspaceStabilityMockMode();
      const shot = task.storyboard!.shots.find((candidate) => candidate.shotId === clip.shotId)!;
      const version = shot.versions.find((candidate) => candidate.vid === clip.vid)!;
      if (mock && ((version as typeof version & { mock?: boolean }).mock !== true || version.modelId !== "aivideosugc-stability-mock")) {
        throw new WorkspaceError("workspace_stability_mock_video_dispatch_disabled", 503, { shotId: clip.shotId });
      }
      if (!mock && (version as typeof version & { mock?: boolean }).mock === true) throw new WorkspaceError("workspace_mock_output_mode_required", 409);
      const bytes = mock
        ? await readMockShotClip(task, clip.clipUrl, clip.shotId, clip.vid)
        : await readClip(task, clip.clipUrl);
      if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_CLIP_BYTES) throw new WorkspaceError("workspace_clip_size_invalid", 422);
      const sourcePath = path.join(dir, `source-${index}.mp4`);
      await fs.writeFile(sourcePath, bytes, { mode: 0o600, flag: "wx" });
      const info = await inspectVideo(sourcePath);
      const video = info.streams.find((stream) => stream.codec_type === "video");
      const audio = info.streams.some((stream) => stream.codec_type === "audio");
      const actualDuration = Number(info.format.duration);
      if (!video || !audio || !Number.isFinite(actualDuration) || clip.outPoint > actualDuration + 0.03) {
        throw new WorkspaceError("workspace_edit_clip_range_invalid", 422, { shotId: clip.shotId });
      }
      const filters = `[0:v:0]trim=start=${fixed(clip.inPoint)}:end=${fixed(clip.outPoint)},setpts=(PTS-STARTPTS)/${fixed(clip.speed)},scale=${compiled.width}:${compiled.height}:force_original_aspect_ratio=decrease,pad=${compiled.width}:${compiled.height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v];[0:a:0]atrim=start=${fixed(clip.inPoint)}:end=${fixed(clip.outPoint)},asetpts=PTS-STARTPTS,atempo=${fixed(clip.speed)},volume=${fixed(compiled.settings.audio.nativeGain)}[a]`;
      await ffmpeg(["-i", sourcePath, "-filter_complex", filters, "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", path.join(dir, `normalized-${index}.mp4`)]);
    }

    await fs.writeFile(path.join(dir, "concat.txt"), compiled.clips.map((_, index) => `file 'normalized-${index}.mp4'`).join("\n"), { mode: 0o600, flag: "wx" });
    await ffmpeg(["-f", "concat", "-safe", "1", "-i", path.join(dir, "concat.txt"), "-c", "copy", path.join(dir, "joined.mp4")]);

    const current = task.video as EditedVideoRender;
    const cues = remapCaptions(editedTask, compiled, current);
    if (cues.length) await fs.writeFile(path.join(dir, "subtitles.srt"), subtitleFile(cues), { mode: 0o600, flag: "wx" });
    if (compiled.settings.overlay.text) await fs.writeFile(path.join(dir, "overlay-text.txt"), compiled.settings.overlay.text, { mode: 0o600, flag: "wx" });
    if (compiled.settings.overlay.cta) await fs.writeFile(path.join(dir, "overlay-cta.txt"), compiled.settings.overlay.cta, { mode: 0o600, flag: "wx" });

    const style = subtitleAssStyle(compiled.settings);
    const videoFilter = outputVideoFilter(dir, compiled, cues, style);
    const finalPath = path.join(dir, "final.mp4");
    if (compiled.settings.audio.mixMusic) {
      if (!task.input.musicUrl && !task.musicSelection) throw new WorkspaceError("workspace_edit_music_source_missing", 422);
      const music = await readTaskMusic(task);
      if (!music.length || music.length > 20 * 1024 * 1024) throw new WorkspaceError("workspace_music_size_invalid", 422);
      const musicPath = path.join(dir, "music-source");
      await fs.writeFile(musicPath, music, { mode: 0o600, flag: "wx" });
      const videoChain = videoFilter ? `[0:v:0]${videoFilter}[v];` : "[0:v:0]null[v];";
      const audioChain = `[1:a:0]volume=${fixed(compiled.settings.audio.musicGain)}[music];[0:a:0][music]amix=inputs=2:duration=first:dropout_transition=2[a]`;
      await ffmpeg(["-i", path.join(dir, "joined.mp4"), "-stream_loop", "-1", "-i", musicPath, "-filter_complex", `${videoChain}${audioChain}`, "-map", "[v]", "-map", "[a]", "-t", fixed(compiled.duration), "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", finalPath]);
    } else if (videoFilter) {
      await ffmpeg(["-i", path.join(dir, "joined.mp4"), "-vf", videoFilter, "-map", "0:v:0", "-map", "0:a:0", "-t", fixed(compiled.duration), "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", finalPath]);
    } else {
      await ffmpeg(["-i", path.join(dir, "joined.mp4"), "-map", "0:v:0", "-map", "0:a:0", "-t", fixed(compiled.duration), "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", finalPath]);
    }

    const finalInfo = await inspectVideo(finalPath);
    const finalStream = finalInfo.streams.find((stream) => stream.codec_type === "video");
    const finalDuration = Number(finalInfo.format.duration);
    if (!finalStream || finalStream.width !== compiled.width || finalStream.height !== compiled.height ||
        !Number.isFinite(finalDuration) || Math.abs(finalDuration - compiled.duration) > 0.12) {
      throw new WorkspaceError("workspace_edit_output_validation_failed", 422, { expectedDuration: compiled.duration, actualDuration: finalDuration,
        expectedWidth: compiled.width, expectedHeight: compiled.height, actualWidth: finalStream?.width, actualHeight: finalStream?.height });
    }
    if (!finalInfo.streams.some((stream) => stream.codec_type === "audio")) throw new WorkspaceError("workspace_edit_output_audio_missing", 422);

    const timestamp = new Date().toISOString();
    const video: EditedVideoRender = {
      renderId,
      sourceRenderId: source.renderId,
      editSettings: structuredClone(compiled.settings),
      editDuration: compiled.duration,
      editAspect: compiled.aspect,
      storyboardHash: taskStoryboardHash(task),
      clips: compiled.clips.map((clip) => ({ shotId: clip.shotId, vid: clip.vid, clipUrl: clip.clipUrl })),
      status: "done",
      steps: [
        { id: "confirm", status: "done" },
        { id: "concat", status: "done" },
        { id: "subtitles", status: cues.length ? "done" : "skipped", ...(!cues.length ? { reason: "No source captions overlap the edited clip ranges." } : {}) },
        { id: "audio", status: "done" },
      ],
      finalUrl: OUTPUT_URL(task, "video"),
      ...(cues.length ? { subtitleUrl: OUTPUT_URL(task, "subtitles"), captionLines: cues } : {}),
      stale: false,
      createdAt: timestamp,
      completedAt: timestamp,
      ...(source.render.mock ? { mock: true } : {}),
    };

    for (const entry of await fs.readdir(dir)) {
      if (!["final.mp4", "subtitles.srt"].includes(entry)) await fs.rm(path.join(dir, entry), { force: true });
    }
    completed = true;
    return video;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError("workspace_video_processing_failed", 502);
  } finally {
    if (!completed) await fs.rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function removeEditedRender(task: Pick<WorkspaceTask, "siteId" | "customerId" | "taskId">, renderId: string) {
  const directory = editedRenderDirectory(task, renderId);
  const root = renderRoot();
  assertContained(root, directory);
  try {
    const rootReal = await fs.realpath(root);
    const directoryReal = await fs.realpath(directory);
    const relative = path.relative(rootReal, directoryReal);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new WorkspaceError("workspace_edit_path_invalid", 404);
    await fs.rm(directoryReal, { recursive: true, force: true });
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code || "")) return;
    throw new WorkspaceError("workspace_edit_output_unavailable", 503);
  }
}

export function isEditedRender(task: WorkspaceTask): boolean {
  const video = task.video as EditedVideoRender | undefined;
  return !!video?.editSettings && !!video.sourceRenderId;
}
