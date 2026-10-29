"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import { WORKSPACE_LANGUAGES } from "@/lib/aidreamcapes-workspace/catalogs";
import { deriveTaskStatus } from "@/lib/aidreamcapes-workspace/task-status";
import {
  SUBTITLE_OPS,
  subtitleOpErrorText,
  subtitleOpLabel,
  type SubtitleOpId,
  type SubtitleOpSettings
} from "@/lib/aidreamcapes-workspace/subtitle-ops";
import type { SubtitleBackdrop, SubtitleStyle, SubtitleTextColor, SubtitleTextPosition, SubtitleTextSize, WorkspaceTask } from "@/lib/aidreamcapes-workspace/types";
import type { LibraryCardMedia } from "./library-task-card";
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

function taskThumb(media: LibraryCardMedia[] | undefined) {
  return media?.find((item) => item.kind === "video") ?? media?.[0];
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
  const versions: SubtitleVersion[] = [];
  task.videoHistory.forEach((entry, index) => {
    if (entry.status === "done" && entry.finalUrl && entry.renderId !== task.video?.renderId) {
      versions.push({ renderId: entry.renderId, url: entry.finalUrl, number: index + 1, hasCaptions: Boolean(entry.captionLines?.length), isCurrent: false });
    }
  });
  if (task.video?.status === "done" && task.video.finalUrl) {
    versions.push({ renderId: task.video.renderId, url: task.video.finalUrl, number: versions.length + 1, hasCaptions: Boolean(task.video.captionLines?.length), isCurrent: true });
  }
  return versions;
}

export function SubtitleWorkbench({ siteId, csrfToken, tasks, mediaByTask, activeJob, onJobStarted }: {
  siteId: string;
  csrfToken?: string;
  tasks: WorkspaceTask[];
  mediaByTask: Map<string, LibraryCardMedia[]>;
  activeJob: SubtitleActiveJob | null;
  onJobStarted: (job: SubtitleActiveJob) => void;
}) {
  const requestRoot = `/api/sites/${encodeURIComponent(siteId)}/aivideosugc`;
  const [selectedId, setSelectedId] = useState("");
  const [versionId, setVersionId] = useState("");
  const [startingOp, setStartingOp] = useState<SubtitleOpId | null>(null);
  const [error, setError] = useState("");
  const [styleChoice, setStyleChoice] = useState<StyleChoice>("auto");
  const [sizeChoice, setSizeChoice] = useState<SubtitleTextSize>("medium");
  const [positionChoice, setPositionChoice] = useState<SubtitleTextPosition>("bottom");
  const [colorChoice, setColorChoice] = useState<SubtitleTextColor>("white");
  const [backdropChoice, setBackdropChoice] = useState<BackdropChoice>("auto");
  const aliveRef = useRef(true);

  useEffect(() => () => { aliveRef.current = false; }, []);

  const completed = tasks.filter((item) =>
    deriveTaskStatus(item).status === "completed" && item.video?.status === "done" && Boolean(item.video.finalUrl));

  // A deep link can name the video to select. Without one, the first finished video is selected.
  useEffect(() => {
    if (selectedId || !completed.length) return;
    const requested = new URLSearchParams(window.location.search).get("task");
    setSelectedId(requested && completed.some((item) => item.taskId === requested) ? requested : completed[0].taskId);
  }, [completed, selectedId]);

  useEffect(() => { setVersionId(""); }, [selectedId]);

  const selected = completed.find((item) => item.taskId === selectedId) ?? null;
  const selectedBusy = Boolean(activeJob && activeJob.taskId === selectedId);

  // Only deviations from the defaults are sent; the server keeps automatic dimensions to the AI plan.
  const settings: SubtitleOpSettings = useMemo(() => ({
    ...(styleChoice !== "auto" ? { style: styleChoice } : {}),
    ...(sizeChoice !== "medium" ? { size: sizeChoice } : {}),
    ...(positionChoice !== "bottom" ? { position: positionChoice } : {}),
    ...(colorChoice !== "white" ? { color: colorChoice } : {}),
    ...(backdropChoice !== "auto" ? { backdrop: backdropChoice } : {})
  }), [styleChoice, sizeChoice, positionChoice, colorChoice, backdropChoice]);

  const headers = useCallback(() => ({
    ...customerJsonHeaders(siteId),
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {})
  }), [siteId, csrfToken]);

  const runOp = useCallback(async (opId: SubtitleOpId) => {
    if (!selected || startingOp || selectedBusy) return;
    setStartingOp(opId); setError("");
    try {
      // The workspace tracks the returned job, so progress keeps running when
      // this page is left and the single-flight endpoint replays the same job
      // if the action is triggered again.
      const response = await fetch(`${requestRoot}/tasks/${encodeURIComponent(selected.taskId)}/subtitle-ops`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { ...headers(), "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ opId, settings })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(subtitleOpErrorText(payload.error || `http_${response.status}`));
      const jobId = String(payload.job?.id ?? "");
      if (!jobId) throw new Error(subtitleOpErrorText("workspace_subtitle_op_failed"));
      if (aliveRef.current) onJobStarted({ jobId, taskId: selected.taskId, taskTitle: selected.title, opId, startedAt: Date.now() });
    } catch (caught) {
      if (aliveRef.current) setError(caught instanceof Error ? caught.message : subtitleOpErrorText(undefined));
    } finally {
      if (aliveRef.current) setStartingOp(null);
    }
  }, [selected, startingOp, selectedBusy, requestRoot, headers, onJobStarted, settings]);

  const languageLabel = selected
    ? WORKSPACE_LANGUAGES.find((item) => item.value === (selected.storyboard?.lang ?? selected.input.options.language))?.label ?? ""
    : "";
  const versions = selected ? taskVersions(selected) : [];
  const activeVersion = versions.find((version) => version.renderId === versionId) ?? versions[versions.length - 1] ?? null;
  const aspectRatio = selected?.input.options.aspect ? selected.input.options.aspect.replace(":", " / ") : "16 / 9";

  const chipClass = (active: boolean) => `${styles.chip} ${active ? styles.chipActive : ""}`;
  const liveFontSize = sizeChoice === "small" ? 11 : sizeChoice === "large" ? 19 : 14;
  const liveLineClass = [
    styles.liveLine,
    styleChoice !== "auto" ? styles[`live_${styleChoice}`] : "",
    backdropChoice !== "auto" ? styles[`liveBack_${backdropChoice}`] : "",
    colorChoice !== "white" ? styles[`liveColor_${colorChoice}`] : ""
  ].filter(Boolean).join(" ");

  return (
    <section className={styles.root} aria-label="Subtitle Studio">
      <div className={styles.list}>
        <header className={styles.listHead}>
          <h2>Your finished videos</h2>
          <span>{completed.length}</span>
        </header>
        <div className={styles.items} role="list">
          {completed.map((item) => {
            const thumb = taskThumb(mediaByTask.get(item.taskId));
            return (
              <button key={item.taskId} type="button" role="listitem"
                className={`${styles.item} ${item.taskId === selectedId ? styles.itemActive : ""}`}
                onClick={() => { setSelectedId(item.taskId); setError(""); }}>
                <span className={styles.itemMedia}>
                  {thumb?.kind === "video"
                    ? <video src={thumb.url} controls preload="metadata" tabIndex={-1} aria-label={`Play ${item.title}`} />
                    : thumb?.kind === "image"
                      ? <img src={thumb.url} alt="" />
                      : null}
                </span>
                <span className={styles.itemBody}>
                  <span className={styles.itemTitle}>{item.title}</span>
                  <span className={styles.itemMeta}>{item.input.options.duration}s · {item.input.options.aspect} · {dayFormat.format(new Date(item.createdAt))}</span>
                  {activeJob?.taskId === item.taskId && (
                    <span className={styles.itemBusy}><Loader2 className={styles.spin} size={11} aria-hidden /> {subtitleOpLabel(activeJob.opId)}…</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        {!completed.length && <p className={styles.empty}>No finished videos yet. Create a video first, then come back to add subtitles.</p>}
      </div>
      <div className={styles.pane}>
        {selected ? (
          <>
            <header className={styles.paneHead}>
              <h2>{selected.title}</h2>
              <p>{[languageLabel, `${selected.input.options.duration}s`, selected.input.options.aspect].filter(Boolean).join(" · ")}</p>
            </header>
            {activeVersion && (
              <>
                {versions.length > 1 && (
                  <div className={styles.versions} role="tablist" aria-label="Video versions">
                    {[...versions].reverse().map((version) => (
                      <button key={version.renderId} type="button" role="tab"
                        aria-selected={activeVersion.renderId === version.renderId}
                        className={`${styles.versionChip} ${activeVersion.renderId === version.renderId ? styles.versionChipActive : ""}`}
                        onClick={() => setVersionId(version.renderId)}>
                        V{version.number} · {version.hasCaptions ? "With subtitles" : "Original"}{version.isCurrent ? " · Latest" : ""}
                      </button>
                    ))}
                  </div>
                )}
                <video className={styles.preview} style={{ aspectRatio }} src={activeVersion.url} controls preload="metadata" />
              </>
            )}
            {error && <p className={styles.error} role="alert">{error}</p>}
            {selectedBusy && activeJob && (
              <p className={styles.running} role="status">
                <Loader2 className={styles.spin} size={14} aria-hidden />
                Generating {subtitleOpLabel(activeJob.opId).toLowerCase()} — this keeps running when you leave the page, and the new version appears in your library automatically.
              </p>
            )}
            <div className={styles.settings} role="group" aria-label="Caption style">
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
              <div className={`${styles.liveStage} ${styles[`livePos_${positionChoice}`]}`} style={{ aspectRatio }} aria-hidden>
                <span className={liveLineClass} style={{ fontSize: liveFontSize }}>
                  Sample caption preview
                </span>
              </div>
              <p className={styles.settingNote}>Preview is approximate — the burned-in video shows the final look.</p>
            </div>
            <div className={styles.ops}>
              {SUBTITLE_OPS.map((op) => (
                <button key={op.id} type="button" className={styles.op} disabled={Boolean(startingOp) || selectedBusy} onClick={() => void runOp(op.id)}>
                  <span className={styles.opLabel}>
                    {startingOp === op.id && <Loader2 className={styles.spin} size={15} aria-hidden />}
                    {op.label}
                  </span>
                  <span className={styles.opSummary}>{op.summary}</span>
                </button>
              ))}
            </div>
            <p className={styles.hint}>Each action creates a new version of this video. Previous versions stay in your library history.</p>
          </>
        ) : (
          <div className={styles.placeholder}>
            <h2>Subtitle Studio</h2>
            <p>Pick a finished video on the left, then choose an action.</p>
          </div>
        )}
      </div>
    </section>
  );
}
