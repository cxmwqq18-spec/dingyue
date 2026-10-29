import "server-only";
import { WorkspaceError } from "./types";
import { getTask } from "./store";
import { queueAction, executeAction, refreshTask, continueDirectTask, directTaskNeedsServerContinuation } from "./runner";
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
const ITEM_TIMEOUT_MS = 60 * 60_000;
const POLL_INTERVAL_MS = 15_000;

function workerBaseUrls(): WorkerBaseUrls {
  // The ai-worker result route uses the same empty-origin resolution; worker
  // base urls come from environment config, not from an HTTP request.
  return resolveWorkerBaseUrls("");
}

/**
 * Batch bookkeeping (claimNext/finishItem) rewrites every row of the batch and
 * bumps each task revision, so any task CAS the runner holds can lose to a
 * sibling claim. Conflicts are benign: re-read and retry the step; the queue
 * guards make re-dispatch idempotent.
 */
const RETRYABLE_CODES = ["revision_conflict", "task_busy", "shot_busy"];

function retryable(error: unknown): boolean {
  return error instanceof WorkspaceError && RETRYABLE_CODES.includes(error.code);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  for (;;) {
    current = await refreshTask(await getTask(task.siteId, task.customerId, taskId));
    if (current.video?.finalUrl || current.status === "completed") return;
    if (current.status === "cancelled") throw new WorkspaceError("operation_cancelled", 409);
    if (current.status === "failed" || current.video?.status === "fail" ||
        current.operation?.state === "fail") {
      throw new WorkspaceError(current.operation?.error || current.error || "batch_item_failed", 502);
    }
    if (Date.now() > deadline) throw new WorkspaceError("batch_item_timeout", 504);
    if (directTaskNeedsServerContinuation(current)) {
      // Advances exactly one step per call: paid shot dispatch (with a fresh
      // server-side quote) or the final render once every clip is done.
      // Library reads and settlement hooks run the same continuation; their
      // losing races surface as 409 CAS guards — recheck and keep polling.
      try {
        current = await continueDirectTask(current, bases);
      } catch (error) {
        if (!retryable(error)) throw error;
        await sleep(POLL_INTERVAL_MS);
      }
    } else {
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

/** The runner `resumeBatch` should use in this environment. */
export function productionBatchRunner() {
  return isWorkspaceStabilityMockMode() ? undefined : runLiveBatchItem;
}
