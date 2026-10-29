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

export async function runLiveBatchItem(task: BatchTask): Promise<void> {
  const bases = workerBaseUrls();
  let current = await getTask(task.siteId, task.customerId, task.taskId);
  if (!current.storyboard?.shots.length) {
    const queued = await queueAction(current, { action: "storyboard" }, current.revision);
    current = await executeAction(queued, bases);
  }
  const deadline = Date.now() + ITEM_TIMEOUT_MS;
  for (;;) {
    current = await refreshTask(await getTask(task.siteId, task.customerId, task.taskId));
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
        const code = error instanceof WorkspaceError ? error.code : "";
        if (!["task_busy", "shot_busy", "revision_conflict"].includes(code)) throw error;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

/** The runner `resumeBatch` should use in this environment. */
export function productionBatchRunner() {
  return isWorkspaceStabilityMockMode() ? undefined : runLiveBatchItem;
}
