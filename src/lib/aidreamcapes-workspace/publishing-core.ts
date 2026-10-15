import { createHash } from "node:crypto";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type WorkspaceTask } from "./types";

export const PUBLISHING_TARGETS = ["tiktok", "instagram", "youtube"] as const;
export type PublishingTarget = typeof PUBLISHING_TARGETS[number];
export type PublishingStatus = "queued" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";

export type PublishingCapability = {
  target: PublishingTarget;
  connection: "not_configured" | "connected";
  posting: "disabled" | "enabled";
  reason: string | null;
};

export type PublishingJob = {
  id: string;
  siteId: string;
  customerId: string;
  taskId: string;
  renderId: string;
  target: PublishingTarget;
  status: PublishingStatus;
  scheduledAt: Date | null;
  idempotencyKey: string;
  requestHash: string;
  capabilityState: "not_configured" | "mock";
  attemptCount: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  queuedAt: Date;
  publishedAt: Date | null;
  cancelledAt: Date | null;
  retriedAt: Date | null;
};

export function normalizePublishingTarget(value: unknown): PublishingTarget {
  if (typeof value !== "string" || !PUBLISHING_TARGETS.includes(value as PublishingTarget)) {
    throw new WorkspaceError("publishing_target_invalid", 400, { allowed: PUBLISHING_TARGETS });
  }
  return value as PublishingTarget;
}

export function assertPublishingOwner(siteId: string, customerSiteId: string) {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  if (customerSiteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("customer_site_mismatch", 403);
}

export function normalizeIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) {
    throw new WorkspaceError("idempotency_key_required", 400);
  }
  return value;
}

export function hashQueueRequest(value: { taskId: string; target: PublishingTarget; scheduledAt: Date | null }): string {
  // Stable field ordering means the hash is deterministic across retries and instances.
  const normalized = JSON.stringify({ taskId: value.taskId, target: value.target, scheduledAt: value.scheduledAt?.toISOString() ?? null });
  return createHash("sha256").update(normalized).digest("hex");
}

export function parsePublishingSchedule(value: unknown, now = Date.now()): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new WorkspaceError("publishing_schedule_invalid", 400);
  }
  const scheduledAt = new Date(value);
  const timestamp = scheduledAt.getTime();
  const canonical = value.includes(".") ? value : value.replace("Z", ".000Z");
  if (!Number.isFinite(timestamp) || scheduledAt.toISOString() !== canonical || timestamp <= now || timestamp > now + 90 * 24 * 60 * 60 * 1000) {
    throw new WorkspaceError("publishing_schedule_invalid", 400, { maxDays: 90 });
  }
  return scheduledAt;
}

export function assertPublishableTask(task: WorkspaceTask, customerId: string) {
  if (task.siteId !== AIVIDEOSUGC_SITE_ID || task.customerId !== customerId) {
    throw new WorkspaceError("publishing_task_not_found", 404);
  }
  if (task.status !== "completed" || !task.video || task.video.status !== "done" || !task.video.renderId || !task.video.finalUrl) {
    throw new WorkspaceError("publishing_output_not_ready", 409);
  }
  if (task.video.stale || task.storyboardStale) throw new WorkspaceError("publishing_output_stale", 409);
  return { taskId: task.taskId, renderId: task.video.renderId, outputUrl: task.video.finalUrl };
}

export function decideIdempotentQueue(existing: Pick<PublishingJob, "requestHash"> | null, requestHash: string) {
  if (!existing) return "create" as const;
  if (existing.requestHash !== requestHash) throw new WorkspaceError("idempotency_conflict", 409);
  return "return_existing" as const;
}

export function queuedStatus(scheduledAt: Date | null): "queued" | "scheduled" {
  return scheduledAt ? "scheduled" : "queued";
}

export function cancelPublishingJob(job: PublishingJob, now = new Date()): PublishingJob {
  if (job.status === "cancelled") return job;
  if (job.status !== "queued" && job.status !== "scheduled" && job.status !== "failed") {
    throw new WorkspaceError("publishing_job_not_cancellable", 409);
  }
  return { ...job, status: "cancelled", cancelledAt: now, updatedAt: now };
}

export function retryPublishingJob(job: PublishingJob, now = new Date()): PublishingJob {
  if (job.status !== "failed") throw new WorkspaceError("publishing_job_not_retryable", 409);
  const futureSchedule = job.scheduledAt && job.scheduledAt.getTime() > now.getTime() ? job.scheduledAt : null;
  return {
    ...job,
    status: queuedStatus(futureSchedule),
    lastError: null,
    cancelledAt: null,
    retriedAt: now,
    updatedAt: now
  };
}

export function releaseScheduledPublishingJob(job: PublishingJob, now = new Date()): PublishingJob {
  if (job.status !== "scheduled" || !job.scheduledAt || job.scheduledAt.getTime() > now.getTime()) return job;
  return { ...job, status: "queued", updatedAt: now };
}

export function publishingCapabilities(): PublishingCapability[] {
  return PUBLISHING_TARGETS.map((target) => ({
    target,
    connection: "not_configured",
    posting: "disabled",
    reason: "platform_oauth_and_review_required"
  }));
}

export type PublishingAdapter = {
  capability(target: PublishingTarget): PublishingCapability;
  publish(job: Pick<PublishingJob, "id" | "target" | "taskId" | "renderId">): Promise<{ platformPostId: string }>;
};

/** Test-only, deterministic adapter. It has no network, OAuth, or billing behavior. */
export function createDeterministicMockAdapter(): PublishingAdapter & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    capability: (target) => ({ target, connection: "connected", posting: "enabled", reason: null }),
    async publish(job) {
      calls.push(job.id);
      return { platformPostId: `mock_${job.target}_${job.id}` };
    }
  };
}

/** The production route uses this unconfigured state and never calls a platform. */
export function assertAdapterConfigured(adapter: PublishingAdapter, target: PublishingTarget) {
  const capability = adapter.capability(target);
  if (capability.connection !== "connected" || capability.posting !== "enabled") {
    throw new WorkspaceError("platform_not_configured", 503, { capability });
  }
  return capability;
}

/** Runs a job only with an explicitly supplied adapter; production routes pass none. */
export async function runPublishingJobWithAdapter(job: PublishingJob, adapter: PublishingAdapter, now = new Date()) {
  const released = releaseScheduledPublishingJob(job, now);
  if (released.status !== "queued") return { job: released, platformPostId: null as string | null };
  const capability = assertAdapterConfigured(adapter, released.target);
  const attempting = { ...released, status: "publishing" as const, attemptCount: released.attemptCount + 1, updatedAt: now };
  try {
    const result = await adapter.publish(attempting);
    const finishedAt = new Date(now);
    return {
      job: { ...attempting, status: "published" as const, publishedAt: finishedAt, lastError: null, updatedAt: finishedAt },
      platformPostId: result.platformPostId,
      capability
    };
  } catch {
    return {
      job: { ...attempting, status: "failed" as const, lastError: "platform_publish_failed", updatedAt: now },
      platformPostId: null as string | null,
      capability
    };
  }
}
