import "server-only";
import { WorkspaceError, type StoryboardShot } from "./types";
import { getTask, type StoredTask } from "./store";
import { queueAction, executeAction, refreshTask, continueDirectTask, directTaskNeedsServerContinuation } from "./runner";
import { createQuote } from "./quote";
import { resolveWorkerBaseUrls, type WorkerBaseUrls } from "@/lib/worker";
import type { BatchTask } from "./batch";
import { isWorkspaceStabilityMockMode } from "./stability";

/**
 * Production batch executor (P1 批量生成).
 *
 * The batch state machine in `batch.ts` always had claim/lease/finish plumbing,
 * but no production runner was wired (`workspace_batch_execution_unavailable`).
 * This module supplies the missing runner: it drives each claimed task through
 * the exact same server-side primitives the interactive composer uses —
 * storyboard, server-quoted generate_shot dispatch, and direct-task
 * continuation up to the final stitched video. No new billing path: quotes,
 * holds and refunds all go through the existing quote/hold helpers inside
 * queueAction/executeAction.
 *
 * All steps are idempotent; a crashed worker leaves the item's lease to expire
 * and `resumeBatch` (now wired to this runner) re-queues it.
 */

/** Generous ceiling for one direct 30s clip (dispatch + provider render + stitch). */
const ITEM_TIMEOUT_MS = 90 * 60_000;
const POLL_INTERVAL_MS = 15_000;

function workerBaseUrls(): WorkerBaseUrls {
  // The ai-worker result route uses the same empty-origin resolution; worker
  // base urls come from environment config, not from an HTTP request.
  return resolveWorkerBaseUrls("");
}

/**
 * Batch bookkeeping (claimNext/finishItem) rewrites batch rows and bumps
 * revisions, so any task CAS the runner holds can lose to a sibling claim.
 * Conflicts are benign: re-read and retry the step; the queue guards make
 * re-dispatch idempotent.
 */
const RETRYABLE_CODES = ["revision_conflict", "task_busy", "shot_busy"];

function retryable(error: unknown): boolean {
  return error instanceof WorkspaceError && RETRYABLE_CODES.includes(error.code);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A shot the provider rejected (fail/expired) stays failed for interactive
 * continuation on purpose — automatic retries must not re-bill work the
 * customer has not asked for again. A batch run IS that mandate: the owner
 * submitted the item for generation, so the executor re-dispatches a rejected
 * shot with a fresh server-side quote, bounded per claim.
 */
function rejectedShot(task: StoredTask): StoryboardShot | undefined {
  const shot = task.storyboard?.shots[0];
  if (!shot || !["fail", "expired"].includes(shot.genStatus)) return undefined;
  if ((shot.versions ?? []).some((version: { status?: string }) => ["pending", "run"].includes(version.status ?? ""))) return undefined;
  return shot;
}

export async function runLiveBatchItem(task: BatchTask): Promise<void> {
  const bases = workerBaseUrls();
  const taskId = task.taskId;
  // Storyboard step: retry CAS conflicts against fresh state until the
  // storyboard exists or the operation fails terminally.
  let current = await getTask(task.siteId, task.customerId, taskId);
  for (let attempt = 0; !current.storyboard?.shots.length; attempt++) {
    if (attempt >= 8) throw new WorkspaceError("batch_item_failed", 500);
    if (current.operation?.state === "fail") {
      throw new WorkspaceError(current.operation.error || "batch_item_failed", 502);
    }
    if (current.operation?.state === "pending" || current.operation?.state === "run") {
      await sleep(3_000);
    } else {
      try {
        const queued = await queueAction(current, { action: "storyboard" }, current.revision);
        current = await executeAction(queued, bases);
      } catch (error) {
        if (!retryable(error)) throw error;
        await sleep(1_500);
      }
    }
    current = await getTask(task.siteId, task.customerId, taskId);
  }
  const deadline = Date.now() + ITEM_TIMEOUT_MS;
  let redispatchLeft = 2;
  for (;;) {
    current = await refreshTask(await getTask(task.siteId, task.customerId, taskId));
    if (current.video?.finalUrl || current.status === "completed") return;
    if (current.status === "cancelled") throw new WorkspaceError("operation_cancelled", 409);
    if (current.status === "failed" || current.video?.status === "fail") {
      throw new WorkspaceError(current.error || "batch_item_failed", 502);
    }
    if (Date.now() > deadline) throw new WorkspaceError("batch_item_timeout", 504);
    const busy = current.operation?.state === "pending" || current.operation?.state === "run";
    const rejected = busy ? undefined : rejectedShot(current);
    try {
      if (rejected && redispatchLeft > 0) {
        redispatchLeft--;
        const quote = await createQuote(current, "generate_shot", rejected.shotId);
        if (!quote.available) throw new WorkspaceError(quote.reason || "workspace_video_provider_unavailable", 503);
        const queued = await queueAction(current, { action: "generate_shot", shotId: rejected.shotId, quoteToken: quote.quoteToken }, current.revision);
        current = await executeAction(queued, bases);
      } else if (rejected) {
        // Retry budget exhausted while the shot is still rejected: surface the
        // provider refusal instead of polling a dead item to the timeout.
        throw new WorkspaceError("batch_item_provider_rejected", 502);
      } else if (directTaskNeedsServerContinuation(current)) {
        // Advances exactly one step per call: paid shot dispatch (with a fresh
        // server-side quote) or the final render once every clip is done.
        // Library reads and settlement hooks run the same continuation; their
        // losing races surface as 409 CAS guards — recheck and keep polling.
        current = await continueDirectTask(current, bases);
      } else {
        await sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      if (!retryable(error)) throw error;
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

/** The runner `resumeBatch` should use in this environment. */
export function productionBatchRunner() {
  return isWorkspaceStabilityMockMode() ? undefined : runLiveBatchItem;
}
