import "server-only";

import { prisma } from "@/lib/prisma";
import { dispatchWorkspaceJob } from "@/lib/aidreamcapes-workspace/dispatch";
import { settleGenerationJobRelational } from "@/lib/stores/job-store";
import { mapGenerationJob, mapSiteAiApp } from "@/lib/stores/prisma-mappers";
import { resolveWorkerBaseUrls } from "@/lib/worker";

// When the storefront/worker process crashes (heap exhaustion, segfault) or is
// restarted by a release, video jobs whose dispatch claim was already accepted
// lose their in-process runner. Jobs whose provider task was already created
// keep that taskId in their result, so the recovery resets the claim and
// re-dispatches them: the worker resumes polling the still-executing upstream
// task instead of abandoning it. Jobs without a provider task have nothing to
// resume (the create never completed), so they settle immediately with an
// honest failure code and a credit refund, ready for a cheap retry.
const WORKSPACE_RECOVERY_SITE_ID = "site_aidreamcapes";
const WORKSPACE_RECOVERY_ERROR = "local_worker_restarted_mid_generation";
// A claim accepted within the last two minutes may still belong to a process
// that is draining from an overlapping release. Never settle those on boot.
const WORKSPACE_RECOVERY_MIN_AGE_MS = 2 * 60_000;
// The dispatch endpoint is this same process, which is not listening yet while
// instrumentation runs; re-dispatch shortly after boot instead.
const WORKSPACE_RECOVERY_REDISPATCH_DELAY_MS = 30_000;

function providerTaskIdFromResult(resultJson: unknown): string {
  if (!resultJson || typeof resultJson !== "object" || Array.isArray(resultJson)) return "";
  const result = resultJson as Record<string, unknown>;
  if (typeof result.providerTaskId === "string" && result.providerTaskId.trim()) return result.providerTaskId.trim();
  const slots = Array.isArray(result.outputSlots) ? result.outputSlots : [];
  for (const slot of slots) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
    const slotTaskId = (slot as Record<string, unknown>).providerTaskId;
    if (typeof slotTaskId === "string" && slotTaskId.trim()) return slotTaskId.trim();
  }
  return "";
}

// Settle refuses to move credits when the customer's reserved pool no longer
// holds the job's reservation (already released by an earlier watchdog or a
// manual repair). The reservation is gone either way, so marking the job
// failed without touching the ledger is the honest terminal state — a second
// release here would corrupt the balance instead.
async function markOrphanFailedWithoutLedger(jobId: string): Promise<void> {
  const job = await prisma.generationJob.findFirst({
    where: {
      id: jobId,
      siteId: WORKSPACE_RECOVERY_SITE_ID,
      status: { in: ["queued", "running"] }
    },
    select: { resultJson: true }
  });
  if (!job) throw new Error("orphan_job_state_changed_during_recovery");
  const previousResult = job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson)
    ? job.resultJson as Record<string, unknown>
    : {};
  const updated = await prisma.generationJob.updateMany({
    where: {
      id: jobId,
      siteId: WORKSPACE_RECOVERY_SITE_ID,
      status: { in: ["queued", "running"] }
    },
    data: {
      status: "failed",
      resultJson: {
        ...previousResult,
        error: WORKSPACE_RECOVERY_ERROR,
        lastWorkerStatus: "failed",
        lastWorkerStage: "local_worker_recovery_without_ledger",
        requestId: `req_${jobId}`
      }
    }
  });
  if (updated.count !== 1) throw new Error("orphan_job_state_changed_during_recovery");
}

async function settleOrphanFailed(jobId: string): Promise<void> {
  try {
    const settled = await settleGenerationJobRelational({
      siteId: WORKSPACE_RECOVERY_SITE_ID,
      jobId,
      requestId: `req_${jobId}`,
      status: "failed",
      error: WORKSPACE_RECOVERY_ERROR
    });
    console.warn("workspace_worker_recovery_settled_interrupted_job", {
      jobId,
      alreadyProcessed: settled.alreadyProcessed,
      creditsReleased: Math.abs(settled.ledger?.amount ?? 0)
    });
  } catch (settleError) {
    const settleCode = settleError instanceof Error ? settleError.message : String(settleError);
    if (!settleCode.includes("reserved_credits_not_available")) throw settleError;
    await markOrphanFailedWithoutLedger(jobId);
    console.warn("workspace_worker_recovery_marked_interrupted_job_without_ledger", {
      jobId,
      reason: "reservation_already_released"
    });
  }
}

// Puts a resumed job back into the dispatch queue without touching credits:
// status returns to queued, the accepted/interrupted claim is deleted, and the
// dispatched marker is cleared so claimWorkspaceDispatch can grant a fresh
// lease. The dispatch then resumes the stored provider task.
async function resetOrphanForRedispatch(jobId: string): Promise<boolean> {
  const reset = await prisma.$executeRaw`
    UPDATE "GenerationJob"
    SET "status" = 'queued',
        "requestJson" = jsonb_set(("requestJson" #- '{workspace,dispatchClaim}'), '{workspace,dispatched}', 'false'::jsonb, true),
        "updatedAt" = now()
    WHERE "id" = ${jobId}
      AND "siteId" = ${WORKSPACE_RECOVERY_SITE_ID}
      AND "status" IN ('queued', 'running')
      AND "requestJson"->'workspace'->'dispatchClaim'->>'state' IN ('accepted', 'interrupted')`;
  return reset === 1;
}

async function redispatchOrphan(jobId: string): Promise<void> {
  try {
    const jobRow = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!jobRow || jobRow.status !== "queued") return;
    const siteAiAppRow = await prisma.siteAiApp.findFirst({
      where: { siteId: jobRow.siteId, aiAppId: jobRow.aiAppId },
      include: { aiApp: true }
    });
    if (!siteAiAppRow) throw new Error("ai_app_not_enabled_for_site");
    const baseUrls = resolveWorkerBaseUrls("http://127.0.0.1:3013");
    const dispatched = await dispatchWorkspaceJob({
      siteId: jobRow.siteId,
      customerId: jobRow.customerId,
      job: mapGenerationJob(jobRow),
      siteAiApp: mapSiteAiApp(siteAiAppRow),
      baseUrls,
      failureCode: "workspace_dispatch_resume_failed"
    });
    console.warn("workspace_worker_recovery_redispatched_interrupted_job", {
      jobId,
      admission: dispatched.admission.state,
      workerDispatch: dispatched.workerDispatch.status
    });
  } catch (error) {
    // The job keeps its reservation; if the re-dispatch could not even claim,
    // settle the honest restart failure so the creator is not stuck with a
    // frozen balance and a ghost task.
    console.error("workspace_worker_recovery_redispatch_failed", {
      jobId,
      error: error instanceof Error ? error.message : String(error)
    });
    const job = await prisma.generationJob.findUnique({ where: { id: jobId }, select: { status: true } });
    if (job && (job.status === "queued" || job.status === "running")) await settleOrphanFailed(jobId);
  }
}

function scheduleOrphanRedispatch(jobId: string): void {
  const timer = setTimeout(() => {
    void redispatchOrphan(jobId);
  }, WORKSPACE_RECOVERY_REDISPATCH_DELAY_MS);
  // The HTTP server keeps the process alive; do not let the timer hold it.
  timer.unref?.();
}

export async function recoverInterruptedWorkspaceJobs(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - WORKSPACE_RECOVERY_MIN_AGE_MS);
    const orphans = await prisma.generationJob.findMany({
      where: {
        siteId: WORKSPACE_RECOVERY_SITE_ID,
        status: { in: ["queued", "running"] },
        requestJson: { path: ["workspace", "dispatchClaim", "state"], equals: "accepted" },
        updatedAt: { lt: cutoff }
      },
      select: { id: true, resultJson: true }
    });
    if (!orphans.length) return;
    console.warn("workspace_worker_recovery_scanning_interrupted_jobs", { count: orphans.length });
    for (const orphan of orphans) {
      try {
        const providerTaskId = providerTaskIdFromResult(orphan.resultJson);
        if (!providerTaskId) {
          await settleOrphanFailed(orphan.id);
          continue;
        }
        // The provider task may still be executing upstream. Reset the claim
        // now (so any user-driven retry can also take over) and re-dispatch
        // shortly after boot, when the in-process worker endpoint listens.
        if (await resetOrphanForRedispatch(orphan.id)) {
          console.warn("workspace_worker_recovery_scheduled_redispatch", { jobId: orphan.id, providerTaskId });
          scheduleOrphanRedispatch(orphan.id);
          continue;
        }
        await settleOrphanFailed(orphan.id);
      } catch (error) {
        console.error("workspace_worker_recovery_settle_failed", {
          jobId: orphan.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  } catch (error) {
    console.error("workspace_worker_recovery_scan_failed", error instanceof Error ? error.message : String(error));
  }
}
