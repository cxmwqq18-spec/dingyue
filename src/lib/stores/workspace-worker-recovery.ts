import "server-only";

import { prisma } from "@/lib/prisma";
import { settleGenerationJobRelational } from "@/lib/stores/job-store";

// When the storefront/worker process crashes (heap exhaustion, segfault) or is
// restarted by a release, video jobs whose dispatch claim was already accepted
// lose their in-process runner. Until now those orphans sat in "generating"
// until the stale watchdog settled them much later with a misleading
// "provider did not respond in time" code. On boot we settle them immediately
// with an honest failure code and return the reserved credits, so the creator
// can retry right away and see the true cause.
const WORKSPACE_RECOVERY_SITE_ID = "site_aidreamcapes";
const WORKSPACE_RECOVERY_ERROR = "local_worker_restarted_mid_generation";
// A claim accepted within the last two minutes may still belong to a process
// that is draining from an overlapping release. Never settle those on boot.
const WORKSPACE_RECOVERY_MIN_AGE_MS = 2 * 60_000;

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
      select: { id: true }
    });
    if (!orphans.length) return;
    console.warn("workspace_worker_recovery_scanning_interrupted_jobs", { count: orphans.length });
    for (const orphan of orphans) {
      try {
        const settled = await settleGenerationJobRelational({
          siteId: WORKSPACE_RECOVERY_SITE_ID,
          jobId: orphan.id,
          requestId: `req_${orphan.id}`,
          status: "failed",
          error: WORKSPACE_RECOVERY_ERROR
        });
        console.warn("workspace_worker_recovery_settled_interrupted_job", {
          jobId: orphan.id,
          alreadyProcessed: settled.alreadyProcessed,
          creditsReleased: settled.ledger?.amount ?? 0
        });
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
