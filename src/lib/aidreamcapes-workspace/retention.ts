import "server-only";

import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";
import { getTask, saveTask } from "@/lib/aidreamcapes-workspace/store";
import { deleteCustomerAssetFileShared } from "@/lib/customer-asset-storage";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

// Generated shot clips are customer data with a bounded retention window: the
// generation page and library tell creators to download what they want to
// keep, and this sweep physically removes video files once that window has
// passed. Only Aidreamcapes shot-clip assets are touched; finished renders
// live in the render root outside this store and keep working.
const DEFAULT_RETENTION_DAYS = 15;
const RETENTION_ERROR = "workspace_clip_retention_expired";
const BATCH_LIMIT = 100;
const MAX_BATCHES_PER_SWEEP = 20;
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;
// Run in the low-traffic night window instead of right after a deploy boot.
const SWEEP_HOUR = 3;
const SWEEP_MINUTE = 30;

export function videoRetentionDays(): number {
  const raw = Number(process.env.AIVIDEOSUGC_VIDEO_RETENTION_DAYS?.trim() ?? "");
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_RETENTION_DAYS;
  return Math.floor(raw);
}

function retentionDryRun(): boolean {
  return process.env.AIVIDEOSUGC_VIDEO_RETENTION_DRY_RUN?.trim() === "1";
}

function clipUrlMatches(clipUrl: string | undefined, assetId: string): boolean {
  return typeof clipUrl === "string" && clipUrl.includes(`/assets/${assetId}/download`);
}

async function taskIdForJob(jobId: string): Promise<string> {
  const job = await prisma.generationJob.findUnique({
    where: { id: jobId },
    select: { requestJson: true }
  });
  const workspace = job?.requestJson && typeof job.requestJson === "object" && !Array.isArray(job.requestJson)
    ? (job.requestJson as Record<string, unknown>).workspace
    : undefined;
  const taskId = workspace && typeof workspace === "object" && !Array.isArray(workspace)
    ? (workspace as Record<string, unknown>).taskId
    : undefined;
  return typeof taskId === "string" ? taskId : "";
}

// Flips every version that still points at the purged asset to "expired" so
// the interface explains the missing clip instead of failing to play it.
// Runs before the asset row is soft-deleted: if this update cannot land, the
// asset stays for the next sweep and the clip keeps working.
async function markTaskVersionsExpired(params: { customerId: string; taskId: string; assetId: string }): Promise<boolean> {
  const task = await getTask(AIVIDEOSUGC_SITE_ID, params.customerId, params.taskId);
  let changed = false;
  for (const shot of task.storyboard?.shots ?? []) {
    let shotTouched = false;
    for (const version of shot.versions) {
      if (!clipUrlMatches(version.clipUrl, params.assetId)) continue;
      version.status = "expired";
      version.error = RETENTION_ERROR;
      delete version.clipUrl;
      shotTouched = true;
    }
    if (shotTouched && shot.curVer && shot.versions.some((version) => version.vid === shot.curVer && version.status === "expired")) {
      shot.genStatus = "expired";
      shot.error = RETENTION_ERROR;
    }
    changed = changed || shotTouched;
  }
  if (!changed) return false;
  await saveTask(task, task.revision);
  return true;
}

export async function purgeExpiredWorkspaceVideoAssets(): Promise<{ purged: number; dryRun: boolean; remainingDays: number }> {
  const retentionDays = videoRetentionDays();
  const dryRun = retentionDryRun();
  if (retentionDays === 0) return { purged: 0, dryRun, remainingDays: 0 };
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  let purged = 0;
  // Skipped rows (non-workspace assets, conflicts) never leave the due set, so
  // each following batch must exclude them to keep advancing.
  const skippedIds: string[] = [];

  for (let batch = 0; batch < MAX_BATCHES_PER_SWEEP; batch += 1) {
    const assets = await prisma.assetUpload.findMany({
      where: {
        siteId: AIVIDEOSUGC_SITE_ID,
        role: "output",
        mimeType: { startsWith: "video/" },
        deletedAt: null,
        createdAt: { lt: cutoff },
        ...(skippedIds.length ? { id: { notIn: skippedIds } } : {})
      },
      orderBy: { createdAt: "asc" },
      take: BATCH_LIMIT
    });
    if (!assets.length) break;

    for (const asset of assets) {
      try {
        if (dryRun) {
          console.warn("workspace_video_retention_dry_run_asset", {
            assetId: asset.id, jobId: asset.jobId, storageKey: asset.storageKey, createdAt: asset.createdAt.toISOString()
          });
          purged += 1;
          continue;
        }
        if (asset.jobId) {
          const taskId = await taskIdForJob(asset.jobId);
          if (!taskId) {
            // Retention applies to workspace-generated shot clips only. Site
            // content previews and non-workspace uploads stay untouched.
            console.warn("workspace_video_retention_skipped_non_workspace_asset", { assetId: asset.id, jobId: asset.jobId });
            skippedIds.push(asset.id);
            continue;
          }
          try {
            await markTaskVersionsExpired({ customerId: asset.customerId, taskId, assetId: asset.id });
          } catch (error) {
            if (error instanceof WorkspaceError && error.code === "revision_conflict") {
              // The customer is editing this task right now; keep the asset
              // and the clip working, the next sweep retries them together.
              console.warn("workspace_video_retention_task_conflict", { assetId: asset.id, taskId });
              skippedIds.push(asset.id);
              continue;
            }
            throw error;
          }
        } else {
          console.warn("workspace_video_retention_skipped_non_workspace_asset", { assetId: asset.id });
          skippedIds.push(asset.id);
          continue;
        }
        const removed = await deleteCustomerAssetFileShared(asset.storageKey);
        const updated = await prisma.assetUpload.updateMany({
          where: { id: asset.id, siteId: AIVIDEOSUGC_SITE_ID, deletedAt: null },
          data: { deletedAt: new Date() }
        });
        if (updated.count === 1 && asset.jobId) {
          // Audit trail on the job: the clip was delivered successfully here,
          // then removed by retention — never a generation failure.
          const job = await prisma.generationJob.findUnique({ where: { id: asset.jobId }, select: { resultJson: true, status: true } });
          if (job?.status === "succeeded") {
            const previousResult = job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson)
              ? job.resultJson as Record<string, unknown>
              : {};
            await prisma.generationJob.updateMany({
              where: { id: asset.jobId, siteId: AIVIDEOSUGC_SITE_ID, status: "succeeded" },
              data: { resultJson: { ...previousResult, retentionPurgedAt: new Date().toISOString() } }
            });
          }
        }
        purged += 1;
        console.warn("workspace_video_retention_purged", {
          assetId: asset.id, jobId: asset.jobId, fileDeleted: removed.deleted, storageKey: asset.storageKey
        });
      } catch (error) {
        skippedIds.push(asset.id);
        console.error("workspace_video_retention_asset_failed", {
          assetId: asset.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    if (dryRun) break;
  }

  if (purged > 0) {
    console.warn(dryRun ? "workspace_video_retention_dry_run" : "workspace_video_retention_sweep_completed", {
      count: purged, retentionDays
    });
  }
  return { purged, dryRun, remainingDays: retentionDays };
}

function msUntilNextNightWindow(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(SWEEP_HOUR, SWEEP_MINUTE, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function scheduleWorkspaceVideoRetentionSweeps(): void {
  if (videoRetentionDays() === 0) return;
  const runSweep = () => {
    void purgeExpiredWorkspaceVideoAssets().catch((error) => {
      console.error("workspace_video_retention_sweep_failed", error instanceof Error ? error.message : String(error));
    });
  };
  // HTTP traffic keeps the process alive; timers must not hold it themselves.
  const first = setTimeout(runSweep, msUntilNextNightWindow());
  first.unref?.();
  const interval = setInterval(runSweep, SWEEP_INTERVAL_MS);
  interval.unref?.();
}
