import "server-only";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getCustomerAssetRelational, readCustomerAssetFileByStorageKey } from "@/lib/stores/asset-store";
import { assertWorkspaceSite } from "./catalogs";
import { workspaceAsrProvider } from "./provider";
import { confirmedCaptionEdits } from "./captions";
import { isWorkspaceStabilityMockMode, mockSpeechCues } from "./stability";
import { WorkspaceError, type SubtitleCue, type VideoRender, type WorkspaceTask } from "./types";
import { customerAssetIdFromDownloadUrl, workspaceAssetHasMedia } from "./asset-contracts";
import { mockShotClipUrl, readMockShotClip } from "./mock-runtime";
import { assertTaskMusicSelectionRights } from "./music-catalog";
import { aidreamcapesMusicPreviewRoot, MusicPreviewPathError, readContainedMusicPreviewFile } from "./music-catalog-preview";

const run = promisify(execFile);
const MAX_CLIP_BYTES = 250 * 1024 * 1024;
const MAX_MUSIC_BYTES = 20 * 1024 * 1024;
const SUBTITLE_STYLES = {
  classic: "FontName=Arial,FontSize=22,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=2,Shadow=0,Alignment=2,MarginV=44",
  bold: "FontName=Arial,FontSize=26,Bold=1,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BackColour=&H80000000,BorderStyle=3,Outline=0,Shadow=0,Alignment=2,MarginV=48",
  minimal: "FontName=Arial,FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=1,Shadow=1,Alignment=2,MarginV=36"
} as const;
const safeId = (value: string) => { if (!/^[a-zA-Z0-9_-]{1,180}$/.test(value)) throw new WorkspaceError("workspace_render_identifier_invalid"); return value; };
function renderDirectory(task: WorkspaceTask, renderId: string) {
  assertWorkspaceSite(task.siteId);
  const root = process.env.AIVIDEOSUGC_RENDER_ROOT?.trim() || path.join(process.cwd(), "data", "aidreamcapes-workspace-render");
  return path.join(root, task.siteId, safeId(task.customerId), safeId(task.taskId), safeId(renderId));
}
export function resolveTaskRenderFile(task: WorkspaceTask, kind: "video" | "subtitles", renderId?: string) {
  const targetRenderId = renderId ?? task.video?.renderId;
  if (!targetRenderId || task.video?.status !== "done") throw new WorkspaceError("workspace_video_not_ready", 404);
  if (kind === "subtitles" && !renderId && !task.video.subtitleUrl) throw new WorkspaceError("workspace_subtitles_not_available", 404);
  return { path: path.join(renderDirectory(task, targetRenderId), kind === "video" ? "final.mp4" : "subtitles.srt"),
    contentType: kind === "video" ? "video/mp4" : "application/x-subrip; charset=utf-8", filename: `${task.taskId}.${kind === "video" ? "mp4" : "srt"}` };
}
export function storyboardRenderHash(task: WorkspaceTask): string {
  return crypto.createHash("sha256").update(JSON.stringify({ input: task.input, musicSelection: task.musicSelection ?? null, storyboard: task.storyboard })).digest("hex");
}
async function ffmpeg(args: string[]) {
  try { return await run(process.env.AIVIDEOSUGC_FFMPEG_BIN?.trim() || "ffmpeg", ["-hide_banner", "-nostdin", "-y", ...args], { timeout: 300_000, maxBuffer: 2 * 1024 * 1024 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WorkspaceError("workspace_ffmpeg_unavailable", 503);
    throw new WorkspaceError("workspace_video_processing_failed", 502);
  }
}
async function inspectClip(file: string) {
  try {
    const result = await run(process.env.AIVIDEOSUGC_FFPROBE_BIN?.trim() || "ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { timeout: 20_000, maxBuffer: 512 * 1024 });
    return JSON.parse(result.stdout) as { streams: { codec_type: string; width?: number; height?: number }[]; format: { duration: string } };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WorkspaceError("workspace_ffprobe_unavailable", 503);
    throw new WorkspaceError("workspace_clip_media_invalid", 422);
  }
}
function assetIdFromUrl(url: string, task: WorkspaceTask) {
  const assetId = customerAssetIdFromDownloadUrl(url, { siteId: task.siteId, customerId: safeId(task.customerId) });
  if (!assetId) throw new WorkspaceError("workspace_clip_not_owned", 403);
  return assetId;
}
export async function readClip(task: WorkspaceTask, url: string): Promise<Buffer> {
  const assetId = assetIdFromUrl(url, task);
  const { asset } = await getCustomerAssetRelational({ siteId: task.siteId, customerId: task.customerId, assetId });
  if (!asset || asset.id !== assetId || !workspaceAssetHasMedia(asset, { siteId: task.siteId, customerId: task.customerId, kind: "video" })) throw new WorkspaceError("workspace_clip_not_owned", 403);
  const { bytes, mimeType } = await readCustomerAssetFileByStorageKey({ siteId: task.siteId, customerId: task.customerId, asset });
  if (mimeType.toLowerCase().split(";")[0].trim() !== "video/mp4") throw new WorkspaceError("workspace_clip_not_owned", 403);
  if (!bytes.length || bytes.length > MAX_CLIP_BYTES) throw new WorkspaceError("workspace_clip_size_invalid", 422);
  return bytes;
}
export async function readMusic(task: WorkspaceTask, url: string): Promise<Buffer> {
  const assetId = assetIdFromUrl(url, task);
  const { asset } = await getCustomerAssetRelational({ siteId: task.siteId, customerId: task.customerId, assetId });
  if (!asset || asset.id !== assetId || !workspaceAssetHasMedia(asset, { siteId: task.siteId, customerId: task.customerId, kind: "music" })) throw new WorkspaceError("workspace_music_not_owned", 403);
  const { bytes, mimeType } = await readCustomerAssetFileByStorageKey({ siteId: task.siteId, customerId: task.customerId, asset });
  if (!workspaceAssetHasMedia({ ...asset, mimeType }, { siteId: task.siteId, customerId: task.customerId, kind: "music" })) throw new WorkspaceError("workspace_music_not_owned", 403);
  if (!bytes.length || bytes.length > MAX_MUSIC_BYTES) throw new WorkspaceError("workspace_music_size_invalid", 422);
  return bytes;
}
export async function readTaskMusic(task: WorkspaceTask): Promise<Buffer> {
  if (task.musicSelection) {
    if (task.input.musicUrl) throw new WorkspaceError("music_source_conflict", 409);
    const track = await assertTaskMusicSelectionRights(task);
    if (!track?.previewAssetKey) throw new WorkspaceError("music_preview_missing", 404);
    try {
      const preview = await readContainedMusicPreviewFile(aidreamcapesMusicPreviewRoot(), track.previewAssetKey);
      if (!preview.bytes.length || preview.bytes.length > MAX_MUSIC_BYTES) throw new WorkspaceError("workspace_music_size_invalid", 422);
      return preview.bytes;
    } catch (error) {
      if (error instanceof MusicPreviewPathError) throw new WorkspaceError(error.code, error.code === "music_preview_missing" || error.code === "unsafe_music_preview_path" ? 404 : 503);
      throw error;
    }
  }
  if (!task.input.musicUrl) throw new WorkspaceError("workspace_music_source_missing", 422);
  return readMusic(task, task.input.musicUrl);
}
function srtTime(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000), ms = milliseconds % 1000, totalSeconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(totalSeconds / 3600)).padStart(2, "0")}:${String(Math.floor(totalSeconds / 60) % 60).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}
export function subtitleFile(cues: SubtitleCue[]): string {
  let previous = 0;
  return cues.map((cue, index) => {
    if (!Number.isFinite(cue.start) || !Number.isFinite(cue.end) || cue.start < previous || cue.end <= cue.start || !cue.text.trim()) throw new WorkspaceError("workspace_subtitle_timing_invalid", 422);
    previous = cue.end;
    return `${index + 1}\n${srtTime(cue.start)} --> ${srtTime(cue.end)}\n${cue.text.replace(/\r?\n/g, " ").trim()}\n`;
  }).join("\n");
}
export async function measuredSpeechCues(file: string, dialogue: string, language: WorkspaceTask["input"]["options"]["language"], duration: number): Promise<SubtitleCue[]> {
  if (isWorkspaceStabilityMockMode()) return mockSpeechCues(dialogue, duration);
  const provider = await workspaceAsrProvider();
  const audioFile = file.replace(/\.mp4$/, ".wav");
  await ffmpeg(["-i", file, "-t", String(duration), "-vn", "-ac", "1", "-ar", "16000", audioFile]);
  const bytes = await fs.readFile(audioFile);
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)], { type: "audio/wav" }), "clip.wav");
  form.set("model", process.env.AIVIDEOSUGC_ASR_MODEL?.trim() || "whisper-1");
  form.set("language", language); form.set("response_format", "verbose_json"); form.append("timestamp_granularities[]", "segment");
  const base = provider.aiUrl.replace(/\/+$/, "").replace(/\/(?:chat\/completions|audio\/transcriptions)$/, "");
  const response = await fetch(`${base.endsWith("/v1") ? base : `${base}/v1`}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${provider.apiKey}` }, body: form, signal: AbortSignal.timeout(120_000), cache: "no-store" });
  if (!response.ok) throw new WorkspaceError("workspace_speech_timing_failed", 502);
  const result = await response.json() as { text?: string; segments?: { start?: number; end?: number; text?: string }[] };
  const normalize = (value: string) => value.toLowerCase().replace(/[\s\p{P}\p{S}]/gu, "");
  if (!result.text || normalize(result.text) !== normalize(dialogue)) throw new WorkspaceError("workspace_generated_speech_differs_from_script", 422);
  const cues = result.segments?.map((segment) => ({ start: Number(segment.start), end: Math.min(duration, Number(segment.end)), text: String(segment.text ?? "").trim() })) ?? [];
  if (!cues.length || cues.some((cue) => cue.start < 0 || cue.start >= duration || cue.end <= cue.start)) throw new WorkspaceError("workspace_speech_timing_invalid", 422);
  return cues;
}
export async function renderTaskVideo(args: { task: WorkspaceTask; onProgress?: (video: VideoRender) => Promise<void> | void }): Promise<VideoRender> {
  const { task } = args;
  assertWorkspaceSite(task.siteId);
  if (task.musicSelection) await assertTaskMusicSelectionRights(task);
  if (!task.storyboard?.shots.length || task.storyboardStale) throw new WorkspaceError("workspace_storyboard_confirmation_required", 409);
  if (task.storyboard.lang !== task.input.options.language) throw new WorkspaceError("workspace_language_rewrite_required", 409);
  const confirmedEdits = confirmedCaptionEdits(task, storyboardRenderHash(task));
  // Resolve only the selected, current versions. Never silently substitute older successful versions.
  const clips = task.storyboard.shots.map((shot) => {
    const version = shot.versions.find((version) => version.vid === shot.curVer);
    if (!version || version.status !== "done" || !version.clipUrl) throw new WorkspaceError("workspace_shot_not_ready", 409, { shotId: shot.shotId });
    if (isWorkspaceStabilityMockMode()) {
      if ((version as typeof version & { mock?: boolean }).mock !== true || version.modelId !== "aivideosugc-stability-mock" ||
          version.clipUrl !== mockShotClipUrl(task, shot.shotId, version.vid)) {
        throw new WorkspaceError("workspace_stability_mock_video_dispatch_disabled", 503, { shotId: shot.shotId });
      }
    } else if ((version as typeof version & { mock?: boolean }).mock === true) {
      throw new WorkspaceError("workspace_mock_output_mode_required", 409, { shotId: shot.shotId });
    }
    if (shot.actorId && task.input.actorId !== shot.actorId) throw new WorkspaceError("workspace_actor_change_requires_storyboard", 409);
    if (version.inputSnapshot && ["style", "aspect", "language"].some((key) => version.inputSnapshot!.options[key as "style" | "aspect" | "language"] !== task.input.options[key as "style" | "aspect" | "language"])) throw new WorkspaceError("workspace_shot_version_stale", 409, { shotId: shot.shotId });
    if (version.visual !== shot.visual || version.voiceover !== shot.voiceover || JSON.stringify(version.refImgs) !== JSON.stringify(shot.refImgs) || JSON.stringify(version.refKinds) !== JSON.stringify(shot.refKinds) || version.actorId !== shot.actorId || version.firstFrame !== shot.firstFrame || version.lastFrame !== shot.lastFrame || version.environment !== shot.environment || version.camera !== shot.camera || version.framing !== shot.framing || version.lighting !== shot.lighting || version.expression !== shot.expression || version.duration !== shot.duration) throw new WorkspaceError("workspace_shot_version_stale", 409, { shotId: shot.shotId });
    return { shot, version };
  });
  const video = { renderId: crypto.randomUUID(), storyboardHash: storyboardRenderHash(task), clips: clips.map(({ shot, version }) => ({ shotId: shot.shotId, vid: version.vid, clipUrl: version.clipUrl! })),
    status: "run" as const, stale: false, createdAt: new Date().toISOString(), steps: ["confirm", "concat", "subtitles", "audio"].map((id) => ({ id: id as VideoRender["steps"][number]["id"], status: "pending" as const })),
    ...(isWorkspaceStabilityMockMode() ? { mock: true as const } : {}) } as VideoRender & { mock?: true };
  const dir = renderDirectory(task, video.renderId);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const progress = async (index: number, status: VideoRender["steps"][number]["status"], reason?: string) => {
    video.steps[index] = { ...video.steps[index], status, ...(reason ? { reason } : {}) };
    await args.onProgress?.(structuredClone(video));
  };
  let step = 0;
  try {
    await progress(0, "run");
    for (let index = 0; index < clips.length; index++) {
      const file = path.join(dir, `source-${index}.mp4`);
      const clipBytes = isWorkspaceStabilityMockMode()
        ? await readMockShotClip(task, clips[index].version.clipUrl!, clips[index].shot.shotId, clips[index].version.vid)
        : await readClip(task, clips[index].version.clipUrl!);
      await fs.writeFile(file, clipBytes, { mode: 0o600 });
      const info = await inspectClip(file);
      if (!info.streams.some((stream) => stream.codec_type === "video") || !info.streams.some((stream) => stream.codec_type === "audio")) throw new WorkspaceError("workspace_native_audio_missing", 422, { shotId: clips[index].shot.shotId });
      const actualDuration = Number(info.format.duration);
      if (!Number.isFinite(actualDuration) || actualDuration + 0.05 < clips[index].shot.duration) throw new WorkspaceError("workspace_clip_duration_too_short", 422, { shotId: clips[index].shot.shotId });
      const audio = await ffmpeg(["-i", file, "-t", String(clips[index].shot.duration), "-vn", "-af", "volumedetect", "-f", "null", "-"]);
      const peak = /max_volume:\s*(-?inf|[\d.-]+)\s*dB/i.exec(audio.stderr);
      if (!peak || !Number.isFinite(Number(peak[1])) || Number(peak[1]) < -80) throw new WorkspaceError("workspace_native_audio_silent", 422, { shotId: clips[index].shot.shotId });
    }
    await progress(0, "done"); step = 1; await progress(1, "run");
    const [width, height] = task.input.options.aspect === "9:16" ? [720, 1280] : task.input.options.aspect === "1:1" ? [720, 720] : [1280, 720];
    for (let index = 0; index < clips.length; index++) {
      await ffmpeg(["-i", path.join(dir, `source-${index}.mp4`), "-t", String(clips[index].shot.duration), "-map", "0:v:0", "-map", "0:a:0", "-vf", `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1`, "-r", "30", "-c:v", "libx264", "-preset", "fast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-ar", "48000", "-ac", "2", path.join(dir, `normalized-${index}.mp4`)]);
    }
    await fs.writeFile(path.join(dir, "concat.txt"), clips.map((_, index) => `file 'normalized-${index}.mp4'`).join("\n"));
    await ffmpeg(["-f", "concat", "-safe", "1", "-i", path.join(dir, "concat.txt"), "-c", "copy", path.join(dir, "joined.mp4")]);
    await progress(1, "done"); step = 2;
    let picture = path.join(dir, "joined.mp4");
    if (!task.input.options.subtitle || clips.every(({ shot }) => !shot.voiceover.trim())) await progress(2, "skipped", task.input.options.subtitle ? "This scene has no spoken dialogue." : "Subtitles are turned off.");
    else {
      await progress(2, "run");
      const cues: SubtitleCue[] = confirmedEdits ? structuredClone(confirmedEdits) : [];
      if (!confirmedEdits) {
        for (let index = 0; index < clips.length; index++) {
          const { shot, version } = clips[index];
          const actual = version.speechTimingVerified && version.speechCues?.length ? version.speechCues : await measuredSpeechCues(path.join(dir, `source-${index}.mp4`), shot.voiceover, task.input.options.language, shot.duration);
          for (const cue of actual) {
            if (cue.start < 0 || cue.end > shot.duration + 0.02) throw new WorkspaceError("workspace_subtitle_crosses_shot", 422);
            cues.push({ ...cue, start: cue.start + shot.start, end: cue.end + shot.start });
          }
        }
      }
      video.captionLines = structuredClone(cues);
      const subtitlePath = path.join(dir, "subtitles.srt");
      await fs.writeFile(subtitlePath, subtitleFile(cues));
      picture = path.join(dir, "captioned.mp4");
      // FFmpeg filter uses a path, never a shell command. Escape only its filter grammar.
      const escaped = subtitlePath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "'\\''");
      const subtitleStyle = SUBTITLE_STYLES[task.input.options.subtitleStyle ?? "classic"];
      await ffmpeg(["-i", path.join(dir, "joined.mp4"), "-vf", `subtitles=filename='${escaped}':force_style='${subtitleStyle}'`, "-c:v", "libx264", "-preset", "fast", "-c:a", "copy", picture]);
      video.subtitleUrl = `/api/sites/${task.siteId}/aivideosugc/tasks/${task.taskId}/output?kind=subtitles`;
      await progress(2, "done");
    }
    step = 3; await progress(3, "run");
    if (task.input.musicUrl || task.musicSelection) {
      if (isWorkspaceStabilityMockMode()) throw new WorkspaceError("workspace_stability_mock_music_disabled", 503);
      await fs.writeFile(path.join(dir, "music-source"), await readTaskMusic(task), { mode: 0o600 });
      await ffmpeg(["-i", picture, "-stream_loop", "-1", "-i", path.join(dir, "music-source"), "-t", String(task.input.options.duration), "-map", "0:v:0", "-filter_complex", "[0:a]volume=1[native];[1:a]volume=0.18[music];[native][music]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=11[aout]", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", path.join(dir, "final.mp4")]);
    } else {
      await ffmpeg(["-i", picture, "-t", String(task.input.options.duration), "-c:v", "copy", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-c:a", "aac", "-ar", "48000", "-movflags", "+faststart", path.join(dir, "final.mp4")]);
    }
    const final = await inspectClip(path.join(dir, "final.mp4"));
    if (Math.abs(Number(final.format.duration) - task.input.options.duration) > 0.05) throw new WorkspaceError("workspace_final_duration_mismatch", 422);
    await progress(3, "done");
    video.status = "done"; video.finalUrl = `/api/sites/${task.siteId}/aivideosugc/tasks/${task.taskId}/output?kind=video`; video.completedAt = new Date().toISOString();
    await args.onProgress?.(structuredClone(video));
    // Keep only customer deliverables. Intermediate files can contain uncaptioned and unnormalised private media.
    for (const entry of await fs.readdir(dir)) if (!["final.mp4", "subtitles.srt"].includes(entry)) await fs.rm(path.join(dir, entry), { force: true });
    return video;
  } catch (error) {
    video.status = "fail"; video.error = error instanceof WorkspaceError ? error.code : "workspace_render_failed";
    await progress(step, "fail", video.error);
    await fs.rm(dir, { recursive: true, force: true });
    return video;
  }
}
