"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import { WORKSPACE_LANGUAGES } from "@/lib/aidreamcapes-workspace/catalogs";
import {
  SUBTITLE_ASS_BASE_FONT_SIZE,
  SUBTITLE_ASS_BOTTOM_MARGIN,
  SUBTITLE_ASS_FLOATING_MARGIN,
  SUBTITLE_ASS_PLAY_RES_Y,
  SUBTITLE_ASS_SIZE_SCALE,
  SUBTITLE_OPS,
  subtitleOpErrorText,
  subtitleOpLabel,
  type SubtitleOpId,
  type SubtitleOpSettings
} from "@/lib/aidreamcapes-workspace/subtitle-ops";
import type { SubtitleBackdrop, SubtitleStyle, SubtitleTextColor, SubtitleTextPosition, SubtitleTextSize, WorkspaceTask } from "@/lib/aidreamcapes-workspace/types";
import styles from "./subtitle-workbench.module.css";

/** A burn-in job tracked by the workspace so it survives view switches. */
export interface SubtitleActiveJob {
  jobId: string;
  taskId: string;
  taskTitle: string;
  opId: SubtitleOpId;
  startedAt: number;
}

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const PAGE_SIZE = 10;
const CUSTOM_TEXT_MAX = 800;

type StyleChoice = "auto" | SubtitleStyle;
type BackdropChoice = "auto" | SubtitleBackdrop;

const STYLE_CHOICES: { value: StyleChoice; label: string; sub?: string }[] = [
  { value: "auto", label: "Auto", sub: "AI picks" },
  { value: "classic", label: "Classic" },
  { value: "bold", label: "Bold" },
  { value: "minimal", label: "Minimal" }
];
const SIZE_CHOICES: { value: SubtitleTextSize; label: string; sample: number }[] = [
  { value: "small", label: "Small", sample: 10 },
  { value: "medium", label: "Medium", sample: 13 },
  { value: "large", label: "Large", sample: 17 }
];
const POSITION_CHOICES: { value: SubtitleTextPosition; label: string }[] = [
  { value: "bottom", label: "Bottom" },
  { value: "middle", label: "Middle" },
  { value: "top", label: "Top" }
];
const COLOR_CHOICES: { value: SubtitleTextColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "yellow", label: "Yellow", swatch: "#ffe14d" },
  { value: "cyan", label: "Cyan", swatch: "#4dffff" },
  { value: "black", label: "Black", swatch: "#1a1a1a" }
];
const BACKDROP_CHOICES: { value: BackdropChoice; label: string; sub?: string }[] = [
  { value: "auto", label: "Auto", sub: "Follows style" },
  { value: "none", label: "None" },
  { value: "box", label: "Box" },
  { value: "outline", label: "Outline" }
];

/** Card cover: the reference image first, otherwise the finished video's first frame. */
function taskCover(item: WorkspaceTask): { kind: "image" | "video"; url: string } | null {
  const firstImage = Object.values(item.input.images ?? {}).flat().find(Boolean);
  if (firstImage) return { kind: "image", url: firstImage };
  if (item.video?.status === "done" && item.video.finalUrl && !item.video.stale) return { kind: "video", url: item.video.finalUrl };
  return null;
}

interface SubtitleVersion {
  renderId: string;
  url: string;
  number: number;
  hasCaptions: boolean;
  isCurrent: boolean;
}

/** Every kept render of the task, newest last; the original stays playable and nothing is overwritten. */
function taskVersions(task: WorkspaceTask): SubtitleVersion[] {
  // finalUrl is task-scoped and always serves the current version, so history
  // entries need the renderId-scoped output URL to play their own file.
  const versionUrl = (renderId: string) =>
    `/api/sites/${task.siteId}/aivideosugc/tasks/${task.taskId}/output?kind=video&renderId=${encodeURIComponent(renderId)}`;
  const versions: SubtitleVersion[] = [];
  task.videoHistory.forEach((entry, index) => {
    if (entry.status === "done" && entry.finalUrl && entry.renderId !== task.video?.renderId) {
      versions.push({ renderId: entry.renderId, url: versionUrl(entry.renderId), number: index + 1, hasCaptions: Boolean(entry.captionLines?.length), isCurrent: false });
    }
  });
  if (task.video?.status === "done" && task.video.finalUrl) {
    versions.push({ renderId: task.video.renderId, url: task.video.finalUrl, number: versions.length + 1, hasCaptions: Boolean(task.video.captionLines?.length), isCurrent: true });
  }
  return versions;
}

export function SubtitleWorkbench({ siteId, csrfToken, activeJob, onJobStarted }: {
  siteId: string;
  csrfToken?: string;
  activeJob: SubtitleActiveJob | null;
  onJobStarted: (job: SubtitleActiveJob) => void;
}) {
  const requestRoot = `/api/sites/${encodeURIComponent(siteId)}/aivideosugc`;
  const [items, setItems] = useState<WorkspaceTask[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [activeOp, setActiveOp] = useState<SubtitleOpId>("captions_polish");
  const [customText, setCustomText] = useState("");
  const [startingOp, setStartingOp] = useState<SubtitleOpId | null>(null);
  const [error, setError] = useState("");
  const [styleChoice, setStyleChoice] = useState<StyleChoice>("auto");
  const [sizeChoice, setSizeChoice] = useState<SubtitleTextSize>("medium");
  const [positionChoice, setPositionChoice] = useState<SubtitleTextPosition>("bottom");
  const [colorChoice, setColorChoice] = useState<SubtitleTextColor>("white");
  const [backdropChoice, setBackdropChoice] = useState<BackdropChoice>("auto");
  const aliveRef = useRef(true);
  // Keeps the editor stable while a search hides the selected video's card.
  const selectedCacheRef = useRef<WorkspaceTask | null>(null);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const headers = useCallback(() => ({
    ...customerJsonHeaders(siteId),
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {})
  }), [siteId, csrfToken]);

  const fetchPage = useCallback(async (offset: number) => {
    if (offset === 0) setListLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), filter: "subtitle_ready" });
      if (search) params.set("q", search);
      const response = await fetch(`${requestRoot}/tasks?${params.toString()}`, { credentials: "same-origin", cache: "no-store", headers: headers() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || `http_${response.status}`));
      const tasks = (payload.tasks ?? []) as WorkspaceTask[];
      if (aliveRef.current) {
        setItems((current) => offset === 0 ? tasks : [...current, ...tasks.filter((task) => !current.some((item) => item.taskId === task.taskId))]);
        setHasMore(Boolean(payload.hasMore));
        setListError("");
      }
    } catch (caught) {
      if (aliveRef.current) setListError(caught instanceof Error ? caught.message : "Couldn't load your videos.");
    } finally {
      if (aliveRef.current) { setListLoading(false); setLoadingMore(false); }
    }
  }, [requestRoot, headers, search]);

  // A fresh query restarts the pager from the first page.
  useEffect(() => { void fetchPage(0); }, [fetchPage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  // Scroll pagination: append the next page when the sentinel comes into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingMore || listLoading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void fetchPage(items.length);
    }, { rootMargin: "240px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, items.length, listLoading, loadingMore]);

  // A deep link can name the video to select even when it is outside the
  // first page; fetch it once and pin it to the top of the list.
  const deepLinkDoneRef = useRef(false);
  useEffect(() => {
    if (deepLinkDoneRef.current || listLoading) return;
    deepLinkDoneRef.current = true;
    const requested = new URLSearchParams(window.location.search).get("task");
    if (!requested) return;
    if (items.some((item) => item.taskId === requested)) return;
    void (async () => {
      try {
        const response = await fetch(`${requestRoot}/tasks/${encodeURIComponent(requested)}`, { credentials: "same-origin", cache: "no-store", headers: headers() });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        const task = payload.task as WorkspaceTask | undefined;
        if (aliveRef.current && task?.video?.status === "done" && task.video.finalUrl) {
          setItems((current) => current.some((item) => item.taskId === task.taskId) ? current : [task, ...current]);
        }
      } catch { /* deep links are best-effort */ }
    })();
  }, [items, listLoading, requestRoot, headers]);

  // Without a deep link the first finished video is selected.
  useEffect(() => {
    if (selectedId && items.some((item) => item.taskId === selectedId)) return;
    const requested = new URLSearchParams(window.location.search).get("task");
    const next = requested && items.some((item) => item.taskId === requested) ? requested : items[0]?.taskId ?? "";
    setSelectedId(next);
    setError("");
  }, [items, selectedId]);

  // When the workspace reports the burn-in job finished, refresh that task so
  // the new version appears in the tabs without a manual reload.
  const prevJobRef = useRef<SubtitleActiveJob | null>(null);
  useEffect(() => {
    const prev = prevJobRef.current;
    prevJobRef.current = activeJob;
    if (!prev || activeJob) return;
    const finishedId = prev.taskId;
    void (async () => {
      try {
        const response = await fetch(`${requestRoot}/tasks/${encodeURIComponent(finishedId)}`, { credentials: "same-origin", cache: "no-store", headers: headers() });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        const task = payload.task as WorkspaceTask | undefined;
        if (aliveRef.current && task) {
          setItems((current) => current.some((item) => item.taskId === task.taskId)
            ? current.map((item) => item.taskId === task.taskId ? task : item)
            : [task, ...current]);
        }
      } catch { /* the workspace notice covers the outcome */ }
    })();
  }, [activeJob, requestRoot, headers]);

  const selected = items.find((item) => item.taskId === selectedId) ?? null;
  if (selected) selectedCacheRef.current = selected;
  const selectedTask = selected ?? selectedCacheRef.current;
  const selectedBusy = Boolean(activeJob && activeJob.taskId === selectedId);

  // Only deviations from the defaults are sent; the server keeps automatic dimensions to the AI plan.
  const settings: SubtitleOpSettings = useMemo(() => ({
    ...(styleChoice !== "auto" ? { style: styleChoice } : {}),
    ...(sizeChoice !== "medium" ? { size: sizeChoice } : {}),
    ...(positionChoice !== "bottom" ? { position: positionChoice } : {}),
    ...(colorChoice !== "white" ? { color: colorChoice } : {}),
    ...(backdropChoice !== "auto" ? { backdrop: backdropChoice } : {})
  }), [styleChoice, sizeChoice, positionChoice, colorChoice, backdropChoice]);

  const runOp = useCallback(async (opId: SubtitleOpId) => {
    if (!selectedTask || startingOp || selectedBusy) return;
    setStartingOp(opId); setError("");
    try {
      // The workspace tracks the returned job, so progress keeps running when
      // this page is left and the single-flight endpoint replays the same job
      // if the action is triggered again.
      const response = await fetch(`${requestRoot}/tasks/${encodeURIComponent(selectedTask.taskId)}/subtitle-ops`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { ...headers(), "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          opId,
          settings: {
            ...settings,
            // Written content only applies to the promo/copy operations;
            // caption dialogue always comes from the video's own speech.
            ...(opId !== "captions_polish" && customText.trim() ? { text: customText.trim() } : {})
          }
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(subtitleOpErrorText(payload.error || `http_${response.status}`));
      const jobId = String(payload.job?.id ?? "");
      if (!jobId) throw new Error(subtitleOpErrorText("workspace_subtitle_op_failed"));
      if (aliveRef.current) onJobStarted({ jobId, taskId: selectedTask.taskId, taskTitle: selectedTask.title, opId, startedAt: Date.now() });
    } catch (caught) {
      if (aliveRef.current) setError(caught instanceof Error ? caught.message : subtitleOpErrorText(undefined));
    } finally {
      if (aliveRef.current) setStartingOp(null);
    }
  }, [selectedTask, startingOp, selectedBusy, requestRoot, headers, onJobStarted, settings, customText]);

  const languageLabel = selectedTask
    ? WORKSPACE_LANGUAGES.find((item) => item.value === (selectedTask.storyboard?.lang ?? selectedTask.input.options.language))?.label ?? ""
    : "";
  const versions = selectedTask ? taskVersions(selectedTask) : [];
  const activeVersion = versions.find((version) => version.renderId === versionId) ?? versions[versions.length - 1] ?? null;
  const aspectRatio = selectedTask?.input.options.aspect ? selectedTask.input.options.aspect.replace(":", " / ") : "16 / 9";

  const chipClass = (active: boolean) => `${styles.chip} ${active ? styles.chipActive : ""}`;
  // The preview stage is a scaled-down replica of the real video frame: the
  // same aspect ratio, and font/margins converted from libass script units
  // (PlayResY=288) with the same uniform scale, so size, position and line
  // wrapping match the burned-in result.
  const aspectValue = useMemo(() => {
    const [w, h] = (selectedTask?.input.options.aspect ?? "16:9").split(":").map(Number);
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : 16 / 9;
  }, [selectedTask?.input.options.aspect]);
  const stageHeight = aspectValue < 1 ? 200 : 150;
  const stageWidth = Math.round(stageHeight * aspectValue);
  const previewStyleBase = styleChoice === "auto" ? "classic" : styleChoice;
  const previewFontSize = (Math.round(SUBTITLE_ASS_BASE_FONT_SIZE[previewStyleBase] * SUBTITLE_ASS_SIZE_SCALE[sizeChoice]) / SUBTITLE_ASS_PLAY_RES_Y) * stageHeight;
  const previewMargin = positionChoice === "middle"
    ? 0
    : ((positionChoice === "top" ? SUBTITLE_ASS_FLOATING_MARGIN : SUBTITLE_ASS_BOTTOM_MARGIN[previewStyleBase]) / SUBTITLE_ASS_PLAY_RES_Y) * stageHeight;
  const liveLineClass = [
    styles.liveLine,
    styleChoice !== "auto" ? styles[`live_${styleChoice}`] : "",
    backdropChoice !== "auto" ? styles[`liveBack_${backdropChoice}`] : "",
    colorChoice !== "white" ? styles[`liveColor_${colorChoice}`] : ""
  ].filter(Boolean).join(" ");
  const isTextOp = activeOp !== "captions_polish";
  const typedFirstLine = customText.trim().split("\n").map((line) => line.trim()).filter(Boolean)[0] ?? "";
  const sampleText = isTextOp && typedFirstLine ? typedFirstLine.slice(0, 60) : "Sample caption preview";

  return (
    <section className={styles.root} aria-label="Subtitle Studio">
      <div className={styles.list}>
        <header className={styles.listHead}>
          <h2>Your finished videos</h2>
        </header>
        <label className={styles.searchBox}>
          <Search size={13} aria-hidden />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by prompt or title"
            aria-label="Search finished videos by prompt or title"
          />
        </label>
        <div className={styles.cards} role="list">
          {items.map((item) => {
            const cover = taskCover(item);
            return (
              <button key={item.taskId} type="button" role="listitem"
                className={`${styles.card} ${item.taskId === selectedId ? styles.cardActive : ""}`}
                onClick={() => { setSelectedId(item.taskId); setError(""); }}>
                <span className={styles.cardMedia}>
                  {cover?.kind === "image"
                    ? <img src={cover.url} alt="" loading="lazy" />
                    : cover?.kind === "video"
                      ? <video src={`${cover.url}#t=0.5`} preload="metadata" tabIndex={-1} aria-label={`Preview of ${item.title}`} />
                      : null}
                </span>
                <span className={styles.cardBody}>
                  <span className={styles.cardTitle}>{item.title}</span>
                  <span className={styles.cardMeta}>{item.input.options.duration}s · {item.input.options.aspect} · {dayFormat.format(new Date(item.createdAt))}</span>
                  {activeJob?.taskId === item.taskId && (
                    <span className={styles.cardBusy}><Loader2 className={styles.spin} size={11} aria-hidden /> {subtitleOpLabel(activeJob.opId)}…</span>
                  )}
                </span>
              </button>
            );
          })}
          {listLoading && <p className={styles.listStatus} role="status"><Loader2 className={styles.spin} size={14} aria-hidden /> Loading your videos…</p>}
          {!listLoading && listError && <p className={styles.error} role="alert">{listError}</p>}
          {!listLoading && !items.length && !listError && (
            <p className={styles.empty}>No finished videos yet. Create a video first, then come back to add subtitles.</p>
          )}
          <div ref={sentinelRef} aria-hidden="true" />
          {loadingMore && <p className={styles.listStatus} role="status"><Loader2 className={styles.spin} size={13} aria-hidden /> Loading more…</p>}
          {!hasMore && items.length > PAGE_SIZE && <p className={styles.listEnd}>All videos loaded</p>}
        </div>
      </div>
      {selectedTask ? (
        <>
          <div className={styles.editor}>
            <header className={styles.paneHead}>
              <h2>{selectedTask.title}</h2>
              <p>{[languageLabel, `${selectedTask.input.options.duration}s`, selectedTask.input.options.aspect].filter(Boolean).join(" · ")}</p>
            </header>
            <div className={styles.settings} role="group" aria-label="Action and caption style">
              <div className={styles.settingRow}>
                <span className={styles.settingName}>Action</span>
                <div className={styles.opPicker}>
                  {SUBTITLE_OPS.map((op) => (
                    <button key={op.id} type="button" className={`${styles.opPick} ${activeOp === op.id ? styles.opPickActive : ""}`}
                      aria-pressed={activeOp === op.id}
                      onClick={() => { setActiveOp(op.id); setError(""); }}>
                      <span className={styles.opPickLabel}>{op.label}</span>
                      <span className={styles.opPickSummary}>{op.id === "captions_polish"
                        ? "Smart captions from the actual speech"
                        : op.id === "promo_lines"
                          ? "Burn short promotional lines into a new version"
                          : "Turn product copy into on-screen text"}</span>
                    </button>
                  ))}
                </div>
              </div>
              {isTextOp && (
                <div className={styles.settingRow}>
                  <span className={styles.settingName}>Your content</span>
                  <textarea
                    className={styles.textArea}
                    value={customText}
                    onChange={(event) => setCustomText(event.target.value.slice(0, CUSTOM_TEXT_MAX))}
                    rows={5}
                    maxLength={CUSTOM_TEXT_MAX}
                    placeholder={"One line or sentence per screen, e.g.\nFresh looks for every morning\nShop the new collection today"}
                    aria-label="Content to burn into the video"
                  />
                  <p className={styles.settingNote}>{customText.length}/{CUSTOM_TEXT_MAX} · Each line or sentence becomes one timed screen across the video. Leave empty to let the AI write it. The text shows on the preview.</p>
                </div>
              )}
              <div className={styles.settingRow}>
                <span className={styles.settingName}>Style</span>
                <div className={styles.chipRow}>
                  {STYLE_CHOICES.map((choice) => (
                    <button key={choice.value} type="button" className={chipClass(styleChoice === choice.value)} aria-pressed={styleChoice === choice.value} onClick={() => setStyleChoice(choice.value)}>
                      {choice.value === "auto"
                        ? <span className={styles.chipSample}>✨</span>
                        : <span className={`${styles.chipSample} ${styles[`sample_${choice.value}`]}`}>Aa</span>}
                      <span className={styles.chipMain}>{choice.label}</span>
                      {choice.sub && <span className={styles.chipSub}>{choice.sub}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.settingRow}>
                <span className={styles.settingName}>Size</span>
                <div className={styles.chipRow}>
                  {SIZE_CHOICES.map((choice) => (
                    <button key={choice.value} type="button" className={chipClass(sizeChoice === choice.value)} aria-pressed={sizeChoice === choice.value} onClick={() => setSizeChoice(choice.value)}>
                      <span className={styles.chipSample} style={{ fontSize: choice.sample }}>Aa</span>
                      <span className={styles.chipMain}>{choice.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.settingRow}>
                <span className={styles.settingName}>Position</span>
                <div className={styles.chipRow}>
                  {POSITION_CHOICES.map((choice) => (
                    <button key={choice.value} type="button" className={chipClass(positionChoice === choice.value)} aria-pressed={positionChoice === choice.value} onClick={() => setPositionChoice(choice.value)}>
                      <span className={styles.miniFrame}><span className={`${styles.miniBar} ${styles[`mini_${choice.value}`]}`} /></span>
                      <span className={styles.chipMain}>{choice.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.settingRow}>
                <span className={styles.settingName}>Colour</span>
                <div className={styles.chipRow}>
                  {COLOR_CHOICES.map((choice) => (
                    <button key={choice.value} type="button" className={chipClass(colorChoice === choice.value)} aria-pressed={colorChoice === choice.value} onClick={() => setColorChoice(choice.value)}>
                      <span className={styles.swatch} style={{ background: choice.swatch }} />
                      <span className={styles.chipMain}>{choice.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.settingRow}>
                <span className={styles.settingName}>Backdrop</span>
                <div className={styles.chipRow}>
                  {BACKDROP_CHOICES.map((choice) => (
                    <button key={choice.value} type="button" className={chipClass(backdropChoice === choice.value)} aria-pressed={backdropChoice === choice.value} onClick={() => setBackdropChoice(choice.value)}>
                      {choice.value === "auto"
                        ? <span className={styles.chipSample}>✨</span>
                        : <span className={`${styles.backSample} ${styles[`back_${choice.value}`]}`}>Aa</span>}
                      <span className={styles.chipMain}>{choice.label}</span>
                      {choice.sub && <span className={styles.chipSub}>{choice.sub}</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.liveStageWrap}>
                <div
                  className={`${styles.liveStage} ${styles[`livePos_${positionChoice}`]}`}
                  style={{
                    width: stageWidth,
                    height: stageHeight,
                    ...(positionChoice === "top" ? { paddingTop: previewMargin } : {}),
                    ...(positionChoice === "bottom" ? { paddingBottom: previewMargin } : {})
                  }}
                  aria-hidden
                >
                  <span className={liveLineClass} style={{ fontSize: previewFontSize }}>
                    {sampleText}
                  </span>
                </div>
              </div>
              <p className={styles.settingNote}>Same size and position as the burned-in video; glyph edges may differ slightly.{styleChoice === "auto" ? " Auto lets the AI pick the exact style." : ""}</p>
            </div>
            <button type="button" className={styles.generateBtn} disabled={Boolean(startingOp) || selectedBusy} onClick={() => void runOp(activeOp)}>
              {startingOp === activeOp || selectedBusy
                ? <><Loader2 className={styles.spin} size={15} aria-hidden /> Generating {subtitleOpLabel(activeOp).toLowerCase()}…</>
                : <>{activeOp === "captions_polish" ? "Generate subtitles" : `Generate ${subtitleOpLabel(activeOp).toLowerCase()}`}</>}
            </button>
            <p className={styles.hint}>Each action creates a new version. Previous versions stay in the tabs above the player.</p>
          </div>
          <div className={styles.previewPane}>
            <div className={styles.versionTabs} role="tablist" aria-label="Video versions">
              {[...versions].reverse().map((version) => (
                <button key={version.renderId} type="button" role="tab"
                  aria-selected={activeVersion?.renderId === version.renderId}
                  className={`${styles.versionTab} ${activeVersion?.renderId === version.renderId ? styles.versionTabActive : ""}`}
                  onClick={() => setVersionId(version.renderId)}>
                  V{version.number} · {version.hasCaptions ? "With subtitles" : "Original"}
                </button>
              ))}
            </div>
            <div className={styles.previewStage}>
              {activeVersion && <video className={styles.preview} style={{ aspectRatio }} src={activeVersion.url} controls preload="metadata" aria-label={`Preview of ${selectedTask.title}`} />}
              {activeVersion && isTextOp && typedFirstLine && (
                <div className={`${styles.previewOverlay} ${styles[`livePos_${positionChoice}`]}`} aria-hidden>
                  <span className={liveLineClass}>{typedFirstLine.slice(0, 80)}</span>
                </div>
              )}
            </div>
            {error && <p className={styles.error} role="alert">{error}</p>}
            {selectedBusy && activeJob && (
              <p className={styles.running} role="status">
                <Loader2 className={styles.spin} size={14} aria-hidden />
                Generating {subtitleOpLabel(activeJob.opId).toLowerCase()} — this keeps running when you leave the page, and the new version appears in the tabs automatically.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className={styles.placeholder}>
          <h2>Subtitle Studio</h2>
          <p>Pick a finished video on the left, then choose an action.</p>
        </div>
      )}
    </section>
  );
}
