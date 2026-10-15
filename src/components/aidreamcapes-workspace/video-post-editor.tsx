"use client";

import { useEffect, useRef, useState } from "react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import type { SubtitleCue, SubtitleStyle, WorkspaceTask } from "@/lib/aidreamcapes-workspace/types";
import styles from "./video-post-editor.module.css";

type ClipSetting = { shotId: string; inPoint: number; outPoint: number; speed: number };
type EditSettings = {
  clips: ClipSetting[];
  order: string[];
  subtitleStyle: SubtitleStyle;
  overlay: { text: string; cta: string };
  audio: { nativeGain: number; musicGain: number; mixMusic: boolean };
};
type EditResponse = { revision: number; renderId: string; sourceRenderId: string; settings: EditSettings; duration: number; aspect: string };
type CaptionResponse = { revision: number; renderId: string; lines: SubtitleCue[]; edited: boolean };
type ClipDraft = { shotId: string; inPoint: string; outPoint: string; speed: string; sourceDuration: number };
type CueDraft = { start: string; end: string; text: string };
type EditDraft = {
  clips: ClipDraft[]; order: string[]; subtitleStyle: SubtitleStyle;
  overlay: { text: string; cta: string };
  audio: { nativeGain: string; musicGain: string; mixMusic: boolean };
};

export type VideoPostEditorProps = {
  siteId: string;
  task: WorkspaceTask;
  csrfToken?: string;
  disabled?: boolean;
  onTaskUpdated: (task: WorkspaceTask) => void;
};

const SITE_ID = "site_aidreamcapes";
const SAFE_ID = /^[a-zA-Z0-9_-]{1,180}$/;
const STYLE_OPTIONS: { value: SubtitleStyle; label: string }[] = [
  { value: "classic", label: "Classic" }, { value: "bold", label: "Bold" }, { value: "minimal", label: "Minimal" },
];

function parseNumber(value: string, min: number, max: number): number | undefined {
  if (!value.trim()) return;
  const result = Number(value);
  return Number.isFinite(result) && result >= min && result <= max ? result : undefined;
}

function captionDraft(lines: SubtitleCue[]): CueDraft[] {
  return lines.map((line) => ({ start: String(line.start), end: String(line.end), text: line.text }));
}

function toEditDraft(response: EditResponse, task: WorkspaceTask): EditDraft {
  const durations = new Map(task.storyboard?.shots.map((shot) => [shot.shotId, shot.versions.find((version) => version.vid === task.video?.clips.find((clip) => clip.shotId === shot.shotId)?.vid)?.duration ?? shot.duration]) ?? []);
  return {
    clips: response.settings.clips.map((clip) => ({ shotId: clip.shotId, inPoint: String(clip.inPoint), outPoint: String(clip.outPoint), speed: String(clip.speed), sourceDuration: durations.get(clip.shotId) ?? clip.outPoint })),
    order: [...response.settings.order],
    subtitleStyle: response.settings.subtitleStyle ?? task.input.options.subtitleStyle ?? "classic",
    overlay: { ...response.settings.overlay },
    audio: { nativeGain: String(response.settings.audio.nativeGain), musicGain: String(response.settings.audio.musicGain), mixMusic: response.settings.audio.mixMusic },
  };
}

function validateCues(draft: CueDraft[], duration: number): { lines?: SubtitleCue[]; errors: string[] } {
  const errors: string[] = [];
  if (!draft.length || draft.length > 500) return { errors: ["Captions need between 1 and 500 lines."] };
  let previousEnd = 0;
  const lines: SubtitleCue[] = [];
  for (const [index, cue] of draft.entries()) {
    const start = parseNumber(cue.start, 0, duration);
    const end = parseNumber(cue.end, 0, duration);
    const text = cue.text.trim().replace(/\s+/gu, " ");
    if (start === undefined || end === undefined || end <= start || start < previousEnd || !text || text.length > 2000 || /[\u0000-\u001f\u007f-\u009f]/u.test(text)) {
      errors.push(`Caption ${index + 1}: enter text and a nonoverlapping time within ${duration.toFixed(2)} seconds.`);
      continue;
    }
    const roundedStart = Math.round(start * 1000) / 1000;
    const roundedEnd = Math.round(end * 1000) / 1000;
    if (roundedEnd <= roundedStart || roundedStart < previousEnd) {
      errors.push(`Caption ${index + 1}: the timing is too short or overlaps the previous line.`);
      continue;
    }
    lines.push({ start: roundedStart, end: roundedEnd, text });
    previousEnd = roundedEnd;
  }
  return { lines: errors.length ? undefined : lines, errors };
}

function validateEdit(draft: EditDraft, hasMusic: boolean): { settings?: EditSettings; duration: number; errors: string[] } {
  const errors: string[] = [];
  const clips: ClipSetting[] = [];
  for (const [index, clip] of draft.clips.entries()) {
    const inPoint = parseNumber(clip.inPoint, 0, clip.sourceDuration);
    const outPoint = parseNumber(clip.outPoint, 0, clip.sourceDuration);
    const speed = parseNumber(clip.speed, 0.5, 2);
    if (inPoint === undefined || outPoint === undefined || speed === undefined || outPoint - inPoint < 0.1) {
      errors.push(`Clip ${index + 1}: use a valid in point, out point, and speed (0.5–2×).`);
      continue;
    }
    clips.push({ shotId: clip.shotId, inPoint, outPoint, speed });
  }
  const duration = clips.reduce((total, clip) => total + (clip.outPoint - clip.inPoint) / clip.speed, 0);
  if (clips.length !== draft.clips.length || duration < 0.5 || duration > 30) errors.push("The finished video must be between 0.5 and 30 seconds.");
  const nativeGain = parseNumber(draft.audio.nativeGain, 0, 2);
  const musicGain = parseNumber(draft.audio.musicGain, 0, 2);
  if (nativeGain === undefined || musicGain === undefined) errors.push("Audio levels must be between 0 and 2.");
  if (draft.audio.mixMusic && !hasMusic) errors.push("Select music before mixing it into this video.");
  if ([...draft.overlay.text].length > 140 || [...draft.overlay.cta].length > 100 || /[\u0000-\u001f\u007f-\u009f]/u.test(draft.overlay.text + draft.overlay.cta)) errors.push("Overlay text is too long or contains unsupported characters.");
  if (new Set(draft.order).size !== draft.clips.length || draft.order.some((id) => !draft.clips.some((clip) => clip.shotId === id))) errors.push("The clip order is incomplete.");
  return {
    duration,
    errors,
    settings: errors.length ? undefined : { clips, order: [...draft.order], subtitleStyle: draft.subtitleStyle,
      overlay: { text: draft.overlay.text.trim(), cta: draft.overlay.cta.trim() },
      audio: { nativeGain: nativeGain!, musicGain: musicGain!, mixMusic: draft.audio.mixMusic } },
  };
}

function responseError(code: string | undefined, status: number): string {
  if (code === "revision_conflict" || status === 409 && code === "workspace_caption_render_stale") return "This video changed in another window. Reload the latest version before saving.";
  if (code === "workspace_caption_timing_invalid" || code === "workspace_caption_line_invalid") return "Check the caption text and times, then try again.";
  if (code === "workspace_edit_duration_invalid" || code === "workspace_edit_clip_range_invalid") return "Check clip trim points and total video length.";
  if (code === "workspace_edit_subtitle_style_invalid") return "Choose a valid caption style.";
  if (code === "workspace_edit_audio_invalid") return "Check the audio levels and selected music.";
  if (code === "task_busy") return "This video is busy with another change. Wait for it to finish, then reload.";
  if (status === 401 || status === 403) return "Your session has expired. Sign in again to save changes.";
  if (status === 503 || status === 502) return "The local video renderer is unavailable. Your current version is safe; try again later.";
  return "We couldn’t save these changes. Your current version is safe; try again.";
}

class ApiError extends Error {
  constructor(message: string, public code: string | undefined, public status: number) { super(message); }
}

async function requestJson<T>(url: string, init: RequestInit, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { ...init, signal, credentials: "same-origin", cache: "no-store" });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : undefined;
    throw new ApiError(responseError(code, response.status), code, response.status);
  }
  return body as T;
}

export function VideoPostEditor({ siteId, task, csrfToken, disabled = false, onTaskUpdated }: VideoPostEditorProps) {
  const identity = `${siteId}/${task.taskId}`;
  const identityRef = useRef(identity);
  identityRef.current = identity;
  const ownRevisionRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [baseRevision, setBaseRevision] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditDraft | null>(null);
  const [savedEdit, setSavedEdit] = useState<EditDraft | null>(null);
  const [cues, setCues] = useState<CueDraft[] | null>(null);
  const [savedCues, setSavedCues] = useState<CueDraft[] | null>(null);
  const [captionAvailable, setCaptionAvailable] = useState(true);
  const [busy, setBusy] = useState<"loading" | "captions" | "render" | null>(null);
  const [message, setMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  const allowed = siteId === SITE_ID && task.siteId === SITE_ID && SAFE_ID.test(task.taskId) && task.status === "completed" && task.video?.status === "done" && !task.video.stale && !task.storyboardStale;
  const url = `/api/sites/${SITE_ID}/aivideosugc/tasks/${encodeURIComponent(task.taskId)}`;
  const duration = (task.video as typeof task.video & { editDuration?: number } | undefined)?.editDuration ?? task.input.options.duration;
  const cueCheck = cues ? validateCues(cues, duration) : null;
  const editCheck = edit ? validateEdit(edit, Boolean(task.input.musicUrl || task.musicSelection)) : null;
  const cuesDirty = cues !== null && savedCues !== null && JSON.stringify(cues) !== JSON.stringify(savedCues);
  const editDirty = edit !== null && savedEdit !== null && JSON.stringify(edit) !== JSON.stringify(savedEdit);
  const ready = allowed && baseRevision !== null && !disabled && !busy && !conflict && task.revision === baseRevision;

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    ownRevisionRef.current = null;
    setBusy("loading"); setMessage(""); setConflict(false); setBaseRevision(null); setEdit(null); setSavedEdit(null); setCues(null); setSavedCues(null);
    void (async () => {
      try {
        const editResponse = await requestJson<EditResponse>(`${url}/edit`, { method: "GET" }, controller.signal);
        let captionResponse: CaptionResponse | null = null;
        try { captionResponse = await requestJson<CaptionResponse>(`${url}/captions`, { method: "GET" }, controller.signal); }
        catch (error) { if (controller.signal.aborted) return; if (!(error instanceof ApiError) || error.code !== "workspace_caption_data_missing") throw error; }
        if (controller.signal.aborted || identityRef.current !== identity) return;
        if (editResponse.revision !== task.revision || captionResponse && captionResponse.revision !== editResponse.revision) { setConflict(true); setMessage("This video changed in another window. Reload the latest version."); return; }
        const nextEdit = toEditDraft(editResponse, task);
        const nextCues = captionResponse ? captionDraft(captionResponse.lines) : null;
        setEdit(nextEdit); setSavedEdit(nextEdit); setCues(nextCues); setSavedCues(nextCues);
        setCaptionAvailable(Boolean(captionResponse)); setBaseRevision(editResponse.revision);
      } catch (error) {
        if (!controller.signal.aborted && identityRef.current === identity) setMessage(error instanceof Error ? error.message : "We couldn’t load the editor.");
      } finally { if (!controller.signal.aborted && identityRef.current === identity) setBusy(null); }
    })();
    return () => controller.abort();
    // Task changes are handled as a conflict so unsaved edits stay visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, reloadCount, allowed]);

  useEffect(() => {
    if (baseRevision !== null && task.revision === baseRevision) ownRevisionRef.current = null;
    if (baseRevision !== null && task.revision !== baseRevision && ownRevisionRef.current !== baseRevision) {
      setConflict(true);
      setMessage("This video changed in another window. Reload the latest version before saving.");
    }
  }, [baseRevision, task.revision]);

  async function refreshTask(signal: AbortSignal, startedIdentity: string): Promise<WorkspaceTask | null> {
    const result = await requestJson<{ task: WorkspaceTask }>(url, { method: "GET" }, signal);
    if (signal.aborted || identityRef.current !== startedIdentity) return null;
    onTaskUpdated(result.task);
    return result.task;
  }

  async function reloadLatest() {
    const startedIdentity = identity;
    const controller = new AbortController(); abortRef.current?.abort(); abortRef.current = controller;
    setBusy("loading"); setMessage("");
    try {
      const latest = await refreshTask(controller.signal, startedIdentity);
      if (!latest) return;
      setBaseRevision(null); setConflict(false); setReloadCount((value) => value + 1);
    } catch (error) {
      if (!controller.signal.aborted && identityRef.current === startedIdentity) setMessage(error instanceof Error ? error.message : "We couldn’t reload this video.");
    } finally { if (!controller.signal.aborted && identityRef.current === startedIdentity) setBusy(null); }
  }

  function headers(revision: number): HeadersInit {
    return { ...customerJsonHeaders(SITE_ID), ...(csrfToken ? { "x-csrf-token": csrfToken } : {}), "if-match": String(revision) };
  }

  async function saveCaptions() {
    if (!ready || !cueCheck?.lines || !cuesDirty) return;
    const startedIdentity = identity;
    const controller = new AbortController(); abortRef.current = controller;
    let patchCommitted = false;
    setBusy("captions"); setMessage("");
    try {
      const saved = await requestJson<CaptionResponse>(`${url}/captions`, { method: "PATCH", headers: headers(baseRevision!), body: JSON.stringify({ revision: baseRevision, lines: cueCheck.lines }) }, controller.signal);
      if (controller.signal.aborted || identityRef.current !== startedIdentity) return;
      patchCommitted = true;
      ownRevisionRef.current = saved.revision;
      setBaseRevision(saved.revision);
      const fullTask = await refreshTask(controller.signal, startedIdentity);
      if (!fullTask) return;
      const nextCues = captionDraft(saved.lines);
      setCues(nextCues); setSavedCues(nextCues); setBaseRevision(fullTask.revision);
      setMessage("Caption corrections saved. Render a new version to put them in the video.");
    } catch (error) {
      if (controller.signal.aborted || identityRef.current !== startedIdentity) return;
      const value = error instanceof Error ? error.message : "We couldn’t save captions.";
      setMessage(patchCommitted ? "Captions were saved, but the latest task could not be loaded. Reload to continue." : value);
      if (patchCommitted || value.includes("changed in another window")) setConflict(true);
    } finally { if (!controller.signal.aborted && identityRef.current === startedIdentity) setBusy(null); }
  }

  async function renderVersion() {
    if (!ready || !editCheck?.settings || cuesDirty) return;
    const startedIdentity = identity;
    const controller = new AbortController(); abortRef.current = controller;
    let patchCommitted = false;
    setBusy("render"); setMessage("");
    try {
      const result = await requestJson<{ revision: number }>(`${url}/edit`, { method: "PATCH", headers: headers(baseRevision!), body: JSON.stringify({ revision: baseRevision, edits: editCheck.settings }) }, controller.signal);
      if (controller.signal.aborted || identityRef.current !== startedIdentity) return;
      patchCommitted = true;
      ownRevisionRef.current = result.revision;
      setBaseRevision(result.revision);
      const fullTask = await refreshTask(controller.signal, startedIdentity);
      if (!fullTask) return;
      const [nextEdit, nextCaptions] = await Promise.all([
        requestJson<EditResponse>(`${url}/edit`, { method: "GET" }, controller.signal),
        requestJson<CaptionResponse>(`${url}/captions`, { method: "GET" }, controller.signal).catch((error) => {
          if (error instanceof ApiError && error.code === "workspace_caption_data_missing") return null;
          throw error;
        }),
      ]);
      if (controller.signal.aborted || identityRef.current !== startedIdentity) return;
      const normalized = toEditDraft(nextEdit, fullTask);
      const normalizedCues = nextCaptions ? captionDraft(nextCaptions.lines) : null;
      setEdit(normalized); setSavedEdit(normalized); setCues(normalizedCues); setSavedCues(normalizedCues);
      setCaptionAvailable(Boolean(nextCaptions)); setBaseRevision(result.revision);
      setMessage("New version rendered. Your previous version and source clips are preserved.");
    } catch (error) {
      if (controller.signal.aborted || identityRef.current !== startedIdentity) return;
      const value = error instanceof Error ? error.message : "We couldn’t render the new version.";
      setMessage(patchCommitted ? "The new version was rendered, but the latest task could not be loaded. Reload to continue." : value);
      if (patchCommitted || value.includes("changed in another window")) setConflict(true);
    } finally { if (!controller.signal.aborted && identityRef.current === startedIdentity) setBusy(null); }
  }

  function moveClip(shotId: string, direction: number) {
    setEdit((current) => {
      if (!current) return current;
      const order = [...current.order]; const index = order.indexOf(shotId); const target = index + direction;
      if (index < 0 || target < 0 || target >= order.length) return current;
      [order[index], order[target]] = [order[target], order[index]];
      return { ...current, order };
    });
  }

  const video = task.video;
  if (!allowed || !video) return <section className={styles.shell} aria-label="Video editor"><p className={styles.empty}>Finish rendering this video before editing the completed version.</p></section>;

  return <section className={styles.shell} aria-label="Video editor">
    <header className={styles.heading}><div><span className={styles.eyebrow}>FINISHED VIDEO · EDITION {task.videoHistory.length + 1}</span><h2>Fine-tune your video</h2><p>Correct captions, adjust clips, then render a new version.</p></div><span className={styles.revision}>Revision {task.revision}</span></header>
    <div className={styles.layout}>
      <aside className={styles.previewPanel} aria-label="Current video preview">
        <div className={styles.previewTop}><span className={styles.liveDot} /> Current saved version <span>{duration.toFixed(1)}s · {task.input.options.aspect}</span></div>
        <div className={styles.videoFrame}><video key={video.renderId} src={video.finalUrl} controls playsInline preload="metadata" aria-label="Current saved video" /></div>
        <p className={styles.previewNote}>This player shows the saved video. Caption and clip changes appear after you render a new version.</p>
        <div className={styles.sourceStrip}><strong>Source preserved</strong><span>{video.clips.length} source clip{video.clips.length === 1 ? "" : "s"}</span><span>{task.videoHistory.length} earlier version{task.videoHistory.length === 1 ? "" : "s"}</span></div>
        {edit && <div className={styles.timelinePreview}><strong>Planned cut</strong><span>{editCheck?.duration.toFixed(1)}s after trim and speed</span><ol>{edit.order.map((shotId) => <li key={shotId}>{`Clip ${video.clips.findIndex((clip) => clip.shotId === shotId) + 1}`}</li>)}</ol></div>}
      </aside>
      <div className={styles.controls}>
        {message && <div className={conflict || message.includes("couldn’t") ? styles.error : styles.success} role={conflict || message.includes("couldn’t") ? "alert" : "status"}>{message}{conflict && <button type="button" onClick={() => void reloadLatest()}>Reload latest</button>}</div>}
        {busy === "loading" && <p className={styles.loading} role="status">Loading edit settings…</p>}
        {edit && <>
          <section className={styles.card} aria-labelledby="post-caption-title"><div className={styles.cardHead}><span className={styles.number}>01</span><div><h3 id="post-caption-title">Captions</h3><p>Edit each line and its timing. Save corrections before rendering.</p></div></div>
            {captionAvailable && cues ? <><div className={styles.cueList}>{cues.map((cue, index) => <div className={styles.cue} key={index}><span className={styles.cueIndex}>{String(index + 1).padStart(2, "0")}</span><label className={styles.cueText}>Text<textarea aria-label={`Caption ${index + 1} text`} value={cue.text} maxLength={2000} rows={2} disabled={!ready} onChange={(event) => setCues((current) => current?.map((item, i) => i === index ? { ...item, text: event.target.value } : item) ?? null)} /></label><div className={styles.timePair}><label>Start (s)<input aria-label={`Caption ${index + 1} start`} type="number" min="0" max={duration} step="0.001" value={cue.start} disabled={!ready} onChange={(event) => setCues((current) => current?.map((item, i) => i === index ? { ...item, start: event.target.value } : item) ?? null)} /></label><label>End (s)<input aria-label={`Caption ${index + 1} end`} type="number" min="0" max={duration} step="0.001" value={cue.end} disabled={!ready} onChange={(event) => setCues((current) => current?.map((item, i) => i === index ? { ...item, end: event.target.value } : item) ?? null)} /></label></div></div>)}</div>
              {cueCheck?.errors.length ? <p className={styles.validation} role="alert">{cueCheck.errors[0]}</p> : null}
              <div className={styles.cardActions}><span>{cuesDirty ? "Unsaved caption changes" : "Captions saved"}</span><button type="button" className={styles.secondaryButton} disabled={!ready || !cuesDirty || !!cueCheck?.errors.length} onClick={() => void saveCaptions()}>{busy === "captions" ? "Saving…" : "Save captions"}</button></div></> : <p className={styles.emptyInline}>This video has no editable caption track. You can still edit its clips, text, and audio.</p>}
            <label className={styles.field}>Caption style<select value={edit.subtitleStyle} disabled={!ready || !captionAvailable} onChange={(event) => setEdit((current) => current ? { ...current, subtitleStyle: event.target.value as SubtitleStyle } : current)}>{STYLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </section>
          <section className={styles.card} aria-labelledby="post-clips-title"><div className={styles.cardHead}><span className={styles.number}>02</span><div><h3 id="post-clips-title">Clips and timing</h3><p>Reorder clips or set in, out, and speed for each source.</p></div></div><div className={styles.clipList}>{edit.order.map((shotId, index) => { const clip = edit.clips.find((item) => item.shotId === shotId)!; return <div className={styles.clip} key={shotId}><div className={styles.clipHead}><strong>Clip {task.video!.clips.findIndex((item) => item.shotId === shotId) + 1}</strong><span>{clip.sourceDuration.toFixed(1)}s source</span><div className={styles.reorder}><button type="button" aria-label={`Move clip ${index + 1} earlier`} disabled={!ready || index === 0} onClick={() => moveClip(shotId, -1)}>↑</button><button type="button" aria-label={`Move clip ${index + 1} later`} disabled={!ready || index === edit.order.length - 1} onClick={() => moveClip(shotId, 1)}>↓</button></div></div><div className={styles.clipFields}>{(["inPoint", "outPoint", "speed"] as const).map((field) => <label key={field}>{field === "inPoint" ? "In (s)" : field === "outPoint" ? "Out (s)" : "Speed (×)"}<input aria-label={`Clip ${index + 1} ${field === "inPoint" ? "in" : field === "outPoint" ? "out" : "speed"}`} type="number" min={field === "speed" ? 0.5 : 0} max={field === "speed" ? 2 : clip.sourceDuration} step="0.001" value={clip[field]} disabled={!ready} onChange={(event) => setEdit((current) => current ? { ...current, clips: current.clips.map((item) => item.shotId === shotId ? { ...item, [field]: event.target.value } : item) } : current)} /></label>)}</div></div>; })}</div></section>
          <section className={styles.card} aria-labelledby="post-finish-title"><div className={styles.cardHead}><span className={styles.number}>03</span><div><h3 id="post-finish-title">Text and sound</h3><p>Add short on-screen text and adjust the audio mix.</p></div></div><div className={styles.fields}><label className={styles.field}>On-screen text<input value={edit.overlay.text} maxLength={140} disabled={!ready} onChange={(event) => setEdit((current) => current ? { ...current, overlay: { ...current.overlay, text: event.target.value } } : current)} /></label><label className={styles.field}>Call to action<input value={edit.overlay.cta} maxLength={100} disabled={!ready} onChange={(event) => setEdit((current) => current ? { ...current, overlay: { ...current.overlay, cta: event.target.value } } : current)} /></label><div className={styles.gainFields}><label className={styles.field}>Original audio gain<input type="number" min="0" max="2" step="0.05" value={edit.audio.nativeGain} disabled={!ready} onChange={(event) => setEdit((current) => current ? { ...current, audio: { ...current.audio, nativeGain: event.target.value } } : current)} /></label><label className={styles.field}>Music gain<input type="number" min="0" max="2" step="0.05" value={edit.audio.musicGain} disabled={!ready || !edit.audio.mixMusic} onChange={(event) => setEdit((current) => current ? { ...current, audio: { ...current.audio, musicGain: event.target.value } } : current)} /></label></div><label className={styles.check}><input type="checkbox" checked={edit.audio.mixMusic} disabled={!ready || !Boolean(task.input.musicUrl || task.musicSelection)} onChange={(event) => setEdit((current) => current ? { ...current, audio: { ...current.audio, mixMusic: event.target.checked } } : current)} />Mix selected music</label></div></section>
          {editCheck?.errors.length ? <p className={styles.validation} role="alert">{editCheck.errors[0]}</p> : null}
          <footer className={styles.footer}><div><strong>{editDirty || cuesDirty ? "Changes ready for review" : "Current settings saved"}</strong><span>Rendering makes a new video version. Your source clips and earlier versions remain available.</span></div><button type="button" className={styles.renderButton} disabled={!ready || cuesDirty || !!editCheck?.errors.length} onClick={() => void renderVersion()}>{busy === "render" ? "Rendering…" : "Render new version"}</button></footer>
        </>}
      </div>
    </div>
  </section>;
}
