import "server-only";
import { constants } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type WorkspaceTask } from "./types";
import {
  assertPublishableTask,
  assertPublishingOwner,
  cancelPublishingJob,
  decideIdempotentQueue,
  hashQueueRequest,
  normalizeIdempotencyKey,
  normalizePublishingTarget,
  parsePublishingSchedule,
  publishingCapabilities,
  queuedStatus,
  retryPublishingJob,
  type PublishingJob,
  type PublishingTarget
} from "./publishing-core";

type JobRow = {
  id: string; siteId: string; customerId: string; taskId: string; renderId: string;
  target: PublishingTarget; status: PublishingJob["status"]; scheduledAt: Date | null;
  idempotencyKey: string; requestHash: string; capabilityState: PublishingJob["capabilityState"];
  attemptCount: number; lastError: string | null; createdAt: Date; updatedAt: Date; queuedAt: Date;
  publishedAt: Date | null; cancelledAt: Date | null; retriedAt: Date | null;
};

function assertSite(siteId: string) {
  assertPublishingOwner(siteId, AIVIDEOSUGC_SITE_ID);
}

async function validateCompletedOutput(siteId: string, customerId: string, taskId: unknown) {
  assertSite(siteId);
  if (typeof taskId !== "string" || taskId.length < 1 || taskId.length > 160) throw new WorkspaceError("publishing_task_invalid", 400);
  const rows = await prisma.$queryRaw<{ data: WorkspaceTask }[]>`
    SELECT "data" FROM "AidreamcapesVideoTask"
    WHERE "id" = ${taskId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}
    LIMIT 1
  `;
  const task = rows[0]?.data;
  if (!task) throw new WorkspaceError("publishing_task_not_found", 404);
  const output = assertPublishableTask(task, customerId);
  const renderId = task.video!.renderId;
  const safeId = (value: string) => {
    if (!/^[a-zA-Z0-9_-]{1,180}$/.test(value)) throw new WorkspaceError("workspace_output_path_invalid", 404);
    return value;
  };
  if (task.video!.finalUrl !== `/api/sites/${AIVIDEOSUGC_SITE_ID}/aivideosugc/tasks/${task.taskId}/output?kind=video` ||
      task.video!.storyboardHash !== createHash("sha256").update(JSON.stringify({ input: task.input, storyboard: task.storyboard })).digest("hex")) {
    throw new WorkspaceError("publishing_output_stale", 409);
  }
  const root = path.resolve(process.env.AIVIDEOSUGC_RENDER_ROOT?.trim() || path.join(process.cwd(), "data", "aidreamcapes-workspace-render"));
  const expectedDirectory = path.resolve(root, AIVIDEOSUGC_SITE_ID, safeId(customerId), safeId(task.taskId), safeId(renderId));
  const filePath = path.join(expectedDirectory, "final.mp4");
  let handle: Awaited<ReturnType<typeof fs.open>> | undefined;
  try {
    const [rootReal, directoryReal, entry, fileReal] = await Promise.all([
      fs.realpath(root), fs.realpath(expectedDirectory), fs.lstat(filePath), fs.realpath(filePath)
    ]);
    const expectedRealDirectory = path.join(rootReal, AIVIDEOSUGC_SITE_ID, customerId, task.taskId, renderId);
    if (directoryReal !== expectedRealDirectory || !entry.isFile() || entry.isSymbolicLink() || entry.size === 0 || fileReal !== path.join(directoryReal, "final.mp4")) {
      throw new WorkspaceError("publishing_output_not_ready", 409);
    }
    handle = await fs.open(fileReal, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = await handle.stat();
    if (!opened.isFile() || opened.size === 0 || opened.dev !== entry.dev || opened.ino !== entry.ino) {
      throw new WorkspaceError("publishing_output_not_ready", 409);
    }
    return output;
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT" || code === "ENOTDIR") throw new WorkspaceError("publishing_output_not_ready", 409);
    throw new WorkspaceError("workspace_output_unavailable", 503);
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

export function getPublishingCapabilities(siteId: string) {
  assertSite(siteId);
  return { platforms: publishingCapabilities(), postingEnabled: false as const, mode: "not_configured" as const };
}

export async function previewPublishing(siteId: string, customerId: string, input: { taskId?: unknown; target?: unknown; scheduledAt?: unknown }) {
  assertSite(siteId);
  const target = normalizePublishingTarget(input.target);
  const scheduledAt = parsePublishingSchedule(input.scheduledAt);
  const output = await validateCompletedOutput(siteId, customerId, input.taskId);
  const capability = publishingCapabilities().find((entry) => entry.target === target)!;
  return {
    taskId: output.taskId,
    renderId: output.renderId,
    target,
    schedule: scheduledAt ? { kind: "scheduled" as const, scheduledAt: scheduledAt.toISOString() } : { kind: "immediate" as const },
    capability,
    canPublish: false as const,
    status: "not_configured" as const
  };
}

export async function queuePublishingJob(siteId: string, customerId: string, input: { taskId?: unknown; target?: unknown; scheduledAt?: unknown; idempotencyKey?: unknown }) {
  assertSite(siteId);
  const target = normalizePublishingTarget(input.target);
  const scheduledAt = parsePublishingSchedule(input.scheduledAt);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  if (typeof input.taskId !== "string" || input.taskId.length < 1 || input.taskId.length > 160) throw new WorkspaceError("publishing_task_invalid", 400);
  const requestHash = hashQueueRequest({ taskId: input.taskId, target, scheduledAt });
  const prior = await prisma.$queryRaw<JobRow[]>`
    SELECT "id", "siteId", "customerId", "taskId", "renderId", "target", "status", "scheduledAt", "idempotencyKey", "requestHash", "capabilityState", "attemptCount", "lastError", "createdAt", "updatedAt", "queuedAt", "publishedAt", "cancelledAt", "retriedAt"
    FROM "AidreamcapesPublishingJob"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "idempotencyKey" = ${idempotencyKey}
    LIMIT 1
  `;
  if (prior[0]) {
    decideIdempotentQueue(prior[0], requestHash);
    return { job: prior[0], capability: publishingCapabilities().find((entry) => entry.target === prior[0].target)!, canPublish: false as const };
  }
  const output = await validateCompletedOutput(siteId, customerId, input.taskId);
  const id = randomUUID();
  const status = queuedStatus(scheduledAt);
  const rows = await prisma.$queryRaw<JobRow[]>`
    INSERT INTO "AidreamcapesPublishingJob" (
      "id", "siteId", "customerId", "taskId", "renderId", "target", "status", "scheduledAt",
      "idempotencyKey", "requestHash", "capabilityState", "queuedAt"
    )
    SELECT ${id}, ${AIVIDEOSUGC_SITE_ID}, c."id", t."id", ${output.renderId}, ${target}, ${status}, ${scheduledAt},
      ${idempotencyKey}, ${requestHash}, 'not_configured', now()
    FROM "Customer" c
    JOIN "AidreamcapesVideoTask" t ON t."customerId" = c."id" AND t."siteId" = ${AIVIDEOSUGC_SITE_ID}
    WHERE c."id" = ${customerId} AND c."siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND t."id" = ${output.taskId} AND t."data"->>'status' = 'completed'
      AND t."data"->'video'->>'status' = 'done' AND t."data"->'video'->>'renderId' = ${output.renderId}
      AND t."data"->'video'->>'stale' = 'false' AND t."data"->>'storyboardStale' = 'false'
    ON CONFLICT ("siteId", "customerId", "idempotencyKey") DO NOTHING
    RETURNING "id", "siteId", "customerId", "taskId", "renderId", "target", "status", "scheduledAt", "idempotencyKey", "requestHash", "capabilityState", "attemptCount", "lastError", "createdAt", "updatedAt", "queuedAt", "publishedAt", "cancelledAt", "retriedAt"
  `;
  let job = rows[0];
  if (!job) {
    const existing = await prisma.$queryRaw<JobRow[]>`
      SELECT "id", "siteId", "customerId", "taskId", "renderId", "target", "status", "scheduledAt", "idempotencyKey", "requestHash", "capabilityState", "attemptCount", "lastError", "createdAt", "updatedAt", "queuedAt", "publishedAt", "cancelledAt", "retriedAt"
      FROM "AidreamcapesPublishingJob"
      WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "idempotencyKey" = ${idempotencyKey}
      LIMIT 1
    `;
    job = existing[0];
    if (!job) throw new WorkspaceError("publishing_task_not_found", 404);
    decideIdempotentQueue(job, requestHash);
  }
  return { job, capability: publishingCapabilities().find((entry) => entry.target === target)!, canPublish: false as const };
}

export async function getPublishingJob(siteId: string, customerId: string, jobId: string) {
  assertSite(siteId);
  const rows = await prisma.$queryRaw<JobRow[]>`
    SELECT "id", "siteId", "customerId", "taskId", "renderId", "target", "status", "scheduledAt", "idempotencyKey", "requestHash", "capabilityState", "attemptCount", "lastError", "createdAt", "updatedAt", "queuedAt", "publishedAt", "cancelledAt", "retriedAt"
    FROM "AidreamcapesPublishingJob"
    WHERE "id" = ${jobId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}
    LIMIT 1
  `;
  if (!rows[0]) throw new WorkspaceError("publishing_job_not_found", 404);
  return rows[0];
}

export async function listPublishingJobs(siteId: string, customerId: string) {
  assertSite(siteId);
  return prisma.$queryRaw<JobRow[]>`
    SELECT "id", "siteId", "customerId", "taskId", "renderId", "target", "status", "scheduledAt", "idempotencyKey", "requestHash", "capabilityState", "attemptCount", "lastError", "createdAt", "updatedAt", "queuedAt", "publishedAt", "cancelledAt", "retriedAt"
    FROM "AidreamcapesPublishingJob"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}
    ORDER BY "createdAt" DESC LIMIT 100
  `;
}

function hydrated(row: JobRow): PublishingJob {
  return { ...row, scheduledAt: row.scheduledAt ? new Date(row.scheduledAt) : null };
}

export async function cancelPublishingJobForCustomer(siteId: string, customerId: string, jobId: string) {
  const current = hydrated(await getPublishingJob(siteId, customerId, jobId));
  const next = cancelPublishingJob(current);
  if (next === current) return current;
  const rows = await prisma.$queryRaw<JobRow[]>`
    UPDATE "AidreamcapesPublishingJob" SET "status" = 'cancelled', "cancelledAt" = ${next.cancelledAt}, "updatedAt" = now()
    WHERE "id" = ${jobId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}
      AND "status" IN ('queued', 'scheduled', 'failed')
    RETURNING "id", "siteId", "customerId", "taskId", "renderId", "target", "status", "scheduledAt", "idempotencyKey", "requestHash", "capabilityState", "attemptCount", "lastError", "createdAt", "updatedAt", "queuedAt", "publishedAt", "cancelledAt", "retriedAt"
  `;
  if (!rows[0]) throw new WorkspaceError("publishing_job_state_conflict", 409);
  return rows[0];
}

export async function retryPublishingJobForCustomer(siteId: string, customerId: string, jobId: string) {
  const current = hydrated(await getPublishingJob(siteId, customerId, jobId));
  const next = retryPublishingJob(current);
  const output = await validateCompletedOutput(siteId, customerId, current.taskId);
  if (output.renderId !== current.renderId) throw new WorkspaceError("publishing_output_stale", 409);
  const rows = await prisma.$queryRaw<JobRow[]>`
    UPDATE "AidreamcapesPublishingJob" SET "status" = ${next.status},
      "lastError" = NULL, "cancelledAt" = NULL, "retriedAt" = ${next.retriedAt}, "updatedAt" = now()
    WHERE "id" = ${jobId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "status" = 'failed'
    RETURNING "id", "siteId", "customerId", "taskId", "renderId", "target", "status", "scheduledAt", "idempotencyKey", "requestHash", "capabilityState", "attemptCount", "lastError", "createdAt", "updatedAt", "queuedAt", "publishedAt", "cancelledAt", "retriedAt"
  `;
  if (!rows[0]) throw new WorkspaceError("publishing_job_state_conflict", 409);
  return { job: rows[0], capability: publishingCapabilities().find((entry) => entry.target === current.target)!, canPublish: false as const };
}
