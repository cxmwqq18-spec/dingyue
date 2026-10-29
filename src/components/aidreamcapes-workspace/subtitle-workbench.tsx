"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import { WORKSPACE_LANGUAGES } from "@/lib/aidreamcapes-workspace/catalogs";
import { deriveTaskStatus } from "@/lib/aidreamcapes-workspace/task-status";
import { SUBTITLE_OPS, type SubtitleOpId } from "@/lib/aidreamcapes-workspace/subtitle-ops";
import type { WorkspaceTask } from "@/lib/aidreamcapes-workspace/types";
import styles from "./subtitle-workbench.module.css";

type SubtitleOpJobResult = { taskId: string; renderId: string; finalUrl: string; opId: string; style: string; linesCount: number };
type JobView = { id: string; status: string; result?: SubtitleOpJobResult | null; error?: string | null };

const dayFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function humanError(code: string): string {
  if (code === "workspace_subtitle_op_invalid") return "Choose one of the available subtitle actions.";
  if (code === "workspace_subtitle_op_not_ready") return "This video isn't ready for subtitle actions yet. Pick a completed video.";
  if (code === "workspace_subtitle_op_not_found") return "This action could not be found. Refresh the page and try again.";
  if (code === "workspace_subtitle_op_limit_reached") return "You've reached today's limit for subtitle actions. Please try again tomorrow.";
  if (code === "workspace_subtitle_op_idempotency_invalid") return "The request couldn't be identified. Refresh the page and try again.";
  if (code === "workspace_subtitle_op_plan_invalid") return "The AI returned an unusable plan for this video. Please try again.";
  if (code === "workspace_subtitle_op_failed") return "This action didn't finish. Please try again.";
  if (code === "task_busy") return "This video is busy. Wait for the current step to finish and try again.";
  if (code === "task_not_found") return "This video no longer exists in your library.";
  if (code === "revision_conflict") return "This video changed while we worked. Please try again.";
  if (code.startsWith("workspace_storyboard_provider")) return "The AI service isn't available right now. Please try again later.";
  if (code === "workspace_video_processing_failed") return "The new version couldn't be rendered. Please try again.";
  if (code.startsWith("workspace_caption_")) return "The planned subtitles didn't fit this video. Please try again.";
  if (code === "http_401" || code === "customer_login_required") return "Please log in again.";
  return "This request couldn't be completed. Please try again.";
}

export function SubtitleWorkbench({ siteId, csrfToken, tasks, onTaskUpdated }: {
  siteId: string;
  csrfToken?: string;
  tasks: WorkspaceTask[];
  onTaskUpdated: (task: WorkspaceTask) => void;
}) {
  const requestRoot = `/api/sites/${encodeURIComponent(siteId)}/aivideosugc`;
  const [selectedId, setSelectedId] = useState("");
  const [runningOp, setRunningOp] = useState<SubtitleOpId | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
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

  const selected = completed.find((item) => item.taskId === selectedId) ?? null;

  const headers = useCallback(() => ({
    ...customerJsonHeaders(siteId),
    ...(csrfToken ? { "x-csrf-token": csrfToken } : {})
  }), [siteId, csrfToken]);

  const runOp = useCallback(async (opId: SubtitleOpId) => {
    if (!selected || runningOp) return;
    setRunningOp(opId); setError(""); setNotice(""); setPreviewUrl("");
    try {
      const response = await fetch(`${requestRoot}/tasks/${encodeURIComponent(selected.taskId)}/subtitle-ops`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { ...headers(), "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ opId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || `http_${response.status}`));
      const jobId = String(payload.job?.id ?? "");
      if (!jobId) throw new Error("workspace_subtitle_op_not_found");

      // The burn-in runs as a background job; poll until the new version is committed.
      for (;;) {
        await sleep(2000);
        if (!aliveRef.current) return;
        const poll = await fetch(`${requestRoot}/subtitle-ops/${encodeURIComponent(jobId)}`, { credentials: "same-origin", cache: "no-store", headers: headers() });
        const pollPayload = await poll.json().catch(() => ({}));
        if (!poll.ok) throw new Error(String(pollPayload.error || `http_${poll.status}`));
        const job = pollPayload.job as JobView | undefined;
        if (!job) throw new Error("workspace_subtitle_op_not_found");
        if (job.status === "succeeded") {
          const detail = await fetch(`${requestRoot}/tasks/${encodeURIComponent(selected.taskId)}`, { credentials: "same-origin", cache: "no-store", headers: headers() });
          const detailPayload = await detail.json().catch(() => ({}));
          if (detail.ok && detailPayload.task) onTaskUpdated(detailPayload.task as WorkspaceTask);
          setPreviewUrl(String(job.result?.finalUrl ?? ""));
          setNotice(`A new version with ${job.result?.linesCount ?? 0} caption lines was added to your library.`);
          return;
        }
        if (job.status === "failed") throw new Error(String(job.error || "workspace_subtitle_op_failed"));
      }
    } catch (caught) {
      if (aliveRef.current) setError(humanError((caught as Error).message));
    } finally {
      if (aliveRef.current) setRunningOp(null);
    }
  }, [selected, runningOp, requestRoot, headers, onTaskUpdated]);

  const languageLabel = selected
    ? WORKSPACE_LANGUAGES.find((item) => item.value === (selected.storyboard?.lang ?? selected.input.options.language))?.label ?? ""
    : "";

  return (
    <section className={styles.root} aria-label="Subtitle Studio">
      <div className={styles.list}>
        <header className={styles.listHead}>
          <h2>Your finished videos</h2>
          <span>{completed.length}</span>
        </header>
        <div className={styles.items} role="list">
          {completed.map((item) => (
            <button key={item.taskId} type="button" role="listitem"
              className={`${styles.item} ${item.taskId === selectedId ? styles.itemActive : ""}`}
              onClick={() => { setSelectedId(item.taskId); setNotice(""); setError(""); setPreviewUrl(""); }}>
              <span className={styles.itemTitle}>{item.title}</span>
              <span className={styles.itemMeta}>{item.input.options.duration}s · {item.input.options.aspect} · {dayFormat.format(new Date(item.createdAt))}</span>
            </button>
          ))}
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
            {previewUrl && <video className={styles.preview} src={previewUrl} controls preload="metadata" />}
            {notice && <p className={styles.notice} role="status">{notice}</p>}
            {error && <p className={styles.error} role="alert">{error}</p>}
            <div className={styles.ops}>
              {SUBTITLE_OPS.map((op) => (
                <button key={op.id} type="button" className={styles.op} disabled={Boolean(runningOp)} onClick={() => void runOp(op.id)}>
                  <span className={styles.opLabel}>
                    {runningOp === op.id && <Loader2 className={styles.spin} size={15} aria-hidden />}
                    {op.label}
                  </span>
                  <span className={styles.opSummary}>{op.summary}</span>
                </button>
              ))}
            </div>
            {runningOp && (
              <p className={styles.running} role="status">
                <Loader2 className={styles.spin} size={14} aria-hidden />
                Burning your new version — the original stays saved in your library.
              </p>
            )}
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
