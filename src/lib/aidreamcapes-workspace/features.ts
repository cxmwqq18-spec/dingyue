import { randomUUID } from "node:crypto";
import { sceneSchema } from "./catalogs";
import {
  AIVIDEOSUGC_SITE_ID,
  WorkspaceError,
  type ActorAsset,
  type ModelCapability,
  type WorkspaceFeatureId,
  type WorkspaceFeatureJob,
  type WorkspaceFeatureRequest,
  type WorkspaceTask,
} from "./types";

const FEATURE_MODEL_FIELD: Record<WorkspaceFeatureId, keyof ModelCapability["features"]> = {
  output_4k: "output4k",
  video_extension: "videoExtension",
  actor_replacement: "actorReplacement",
  advanced_shot_tools: "advancedShotTools",
};

const FEATURE_UNAVAILABLE_ERROR: Record<WorkspaceFeatureId, string> = {
  output_4k: "workspace_output_4k_unavailable",
  video_extension: "workspace_video_extension_unavailable",
  actor_replacement: "workspace_actor_replacement_unavailable",
  advanced_shot_tools: "workspace_advanced_shot_tools_unavailable",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function exactKeys(value: Record<string, unknown>, allowed: string[], error: string) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new WorkspaceError(error, 400);
}

function requiredShot(task: WorkspaceTask, shotId: unknown) {
  if (typeof shotId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(shotId)) {
    throw new WorkspaceError("workspace_feature_shot_invalid", 400);
  }
  if (!task.storyboard) throw new WorkspaceError("storyboard_required", 409);
  const shot = task.storyboard.shots.find((candidate) => candidate.shotId === shotId);
  if (!shot) throw new WorkspaceError("shot_not_found", 404);
  return shot;
}

function parseAdvancedControls(value: unknown) {
  if (!isRecord(value)) throw new WorkspaceError("workspace_advanced_shot_tools_invalid", 400);
  exactKeys(value, ["cameraMotion", "lens", "motionStrength"], "workspace_advanced_shot_tools_invalid");
  const controls: NonNullable<Extract<WorkspaceFeatureRequest, { feature: "advanced_shot_tools" }>["controls"]> = {};
  if (value.cameraMotion !== undefined) {
    if (!["static", "pan_left", "pan_right", "tilt_up", "tilt_down", "dolly_in", "dolly_out"].includes(String(value.cameraMotion))) {
      throw new WorkspaceError("workspace_advanced_shot_tools_invalid", 400);
    }
    controls.cameraMotion = value.cameraMotion as typeof controls.cameraMotion;
  }
  if (value.lens !== undefined) {
    if (!["wide", "normal", "telephoto"].includes(String(value.lens))) throw new WorkspaceError("workspace_advanced_shot_tools_invalid", 400);
    controls.lens = value.lens as typeof controls.lens;
  }
  if (value.motionStrength !== undefined) {
    if (typeof value.motionStrength !== "number" || !Number.isFinite(value.motionStrength) || value.motionStrength < 0 || value.motionStrength > 1) {
      throw new WorkspaceError("workspace_advanced_shot_tools_invalid", 400);
    }
    controls.motionStrength = value.motionStrength;
  }
  if (!Object.keys(controls).length) throw new WorkspaceError("workspace_advanced_shot_tools_invalid", 400);
  return controls;
}

/** Strictly validate the public feature request before applying capability gates. */
export function parseWorkspaceFeatureRequest(task: WorkspaceTask, body: unknown, actors: ActorAsset[] = []): WorkspaceFeatureRequest {
  if (!isRecord(body)) throw new WorkspaceError("workspace_feature_request_invalid", 400);
  const feature = body.feature;
  const shot = requiredShot(task, body.shotId);
  if (feature === "output_4k") {
    exactKeys(body, ["feature", "shotId", "resolution"], "workspace_feature_request_invalid");
    if (body.resolution !== "4k") throw new WorkspaceError("workspace_output_4k_request_invalid", 400);
    return { feature, shotId: shot.shotId, resolution: "4k" };
  }
  if (feature === "video_extension") {
    exactKeys(body, ["feature", "shotId", "extendBySeconds"], "workspace_feature_request_invalid");
    const seconds = body.extendBySeconds;
    if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds < 1 || seconds > 15 || shot.duration + seconds > 30) {
      throw new WorkspaceError("workspace_video_extension_request_invalid", 400);
    }
    return { feature, shotId: shot.shotId, extendBySeconds: seconds };
  }
  if (feature === "actor_replacement") {
    exactKeys(body, ["feature", "shotId", "replacementActorId"], "workspace_feature_request_invalid");
    if (!sceneSchema(task.sceneId).needsActor) throw new WorkspaceError("workspace_scene_has_no_actor", 422);
    const actorId = body.replacementActorId;
    if (typeof actorId !== "string" || !/^[a-zA-Z0-9_-]{1,180}$/.test(actorId)) {
      throw new WorkspaceError("workspace_actor_replacement_request_invalid", 400);
    }
    if (actorId === task.input.actorId) throw new WorkspaceError("workspace_actor_replacement_unchanged", 422);
    if (!actors.some((actor) => actor.actorId === actorId)) throw new WorkspaceError("workspace_actor_selection_required", 403);
    return { feature, shotId: shot.shotId, replacementActorId: actorId };
  }
  if (feature === "advanced_shot_tools") {
    exactKeys(body, ["feature", "shotId", "controls"], "workspace_feature_request_invalid");
    return { feature, shotId: shot.shotId, controls: parseAdvancedControls(body.controls) };
  }
  throw new WorkspaceError("workspace_feature_request_invalid", 400);
}

export function workspaceFeatureUnavailableError(feature: WorkspaceFeatureId): string {
  return FEATURE_UNAVAILABLE_ERROR[feature];
}

/** A capability is usable only when a runnable selected provider explicitly has its flag. */
export function workspaceFeatureCapabilityError(feature: WorkspaceFeatureId, models: ModelCapability[], modelId?: string): string | undefined {
  const field = FEATURE_MODEL_FIELD[feature];
  const candidates = modelId
    ? models.filter((model) => model.id === modelId && model.available)
    : models.filter((model) => model.available);
  return candidates.some((model) => model.features?.[field] === true) ? undefined : FEATURE_UNAVAILABLE_ERROR[feature];
}

function assertOwner(task: WorkspaceTask, customerId: string) {
  if (task.siteId !== AIVIDEOSUGC_SITE_ID || task.customerId !== customerId) throw new WorkspaceError("task_not_found", 404);
}

function assertRevision(task: WorkspaceTask, revision: number) {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new WorkspaceError("revision_required", 428);
  if (task.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
}

function validateIdempotencyKey(value?: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length < 1 || value.length > 180 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new WorkspaceError("workspace_feature_idempotency_key_invalid", 400);
  }
  return value;
}

/**
 * Queue a feature contract on the Aidreamcapes task only. This is metadata
 * lifecycle state; it never calls a provider, renderer, publisher, or ledger.
 */
export function queueWorkspaceFeatureJob(args: {
  task: WorkspaceTask;
  customerId: string;
  body: unknown;
  revision: number;
  models: ModelCapability[];
  actors?: ActorAsset[];
  idempotencyKey?: string;
}): WorkspaceFeatureJob {
  assertOwner(args.task, args.customerId);
  const request = parseWorkspaceFeatureRequest(args.task, args.body, args.actors);
  const idempotencyKey = validateIdempotencyKey(args.idempotencyKey);
  const featureJobs = args.task.featureJobs ?? [];
  const prior = idempotencyKey ? featureJobs.find((job) => job.idempotencyKey === idempotencyKey) : undefined;
  if (prior) {
    if (prior.feature !== request.feature || prior.shotId !== request.shotId || JSON.stringify(prior.request) !== JSON.stringify(request)) {
      throw new WorkspaceError("idempotency_conflict", 409);
    }
    return prior;
  }
  assertRevision(args.task, args.revision);
  if (args.task.operation?.state === "pending" || args.task.operation?.state === "run" || featureJobs.some((job) => job.status === "queued")) {
    throw new WorkspaceError("task_busy", 409);
  }
  const unavailable = workspaceFeatureCapabilityError(request.feature, args.models, args.task.input.modelId);
  if (unavailable) throw new WorkspaceError(unavailable, 422);

  const now = new Date().toISOString();
  const job: WorkspaceFeatureJob = {
    jobId: `feature-${randomUUID()}`,
    taskId: args.task.taskId,
    siteId: AIVIDEOSUGC_SITE_ID,
    customerId: args.customerId,
    feature: request.feature,
    shotId: request.shotId,
    request: structuredClone(request),
    status: "queued",
    createdAt: now,
    idempotencyKey,
  };
  args.task.featureJobs = [...featureJobs, job].slice(-100);
  args.task.revisions.push({ at: now, shotId: request.shotId, field: "feature_job", before: null,
    after: { jobId: job.jobId, feature: job.feature, status: job.status } });
  return job;
}

export function getWorkspaceFeatureJob(task: WorkspaceTask, customerId: string, jobId: string): WorkspaceFeatureJob {
  assertOwner(task, customerId);
  if (typeof jobId !== "string" || !/^feature-[a-zA-Z0-9_-]{1,180}$/.test(jobId)) throw new WorkspaceError("workspace_feature_job_not_found", 404);
  const job = task.featureJobs?.find((candidate) => candidate.jobId === jobId && candidate.siteId === task.siteId && candidate.customerId === customerId);
  if (!job) throw new WorkspaceError("workspace_feature_job_not_found", 404);
  return job;
}

export function cancelWorkspaceFeatureJob(args: { task: WorkspaceTask; customerId: string; jobId: string; revision: number }): WorkspaceFeatureJob {
  const job = getWorkspaceFeatureJob(args.task, args.customerId, args.jobId);
  assertRevision(args.task, args.revision);
  if (job.status !== "queued") throw new WorkspaceError("workspace_feature_job_not_cancellable", 409);
  const now = new Date().toISOString();
  job.status = "cancelled";
  job.error = "workspace_feature_job_cancelled";
  args.task.revisions.push({ at: now, shotId: job.shotId, field: "feature_job_status", before: "queued", after: "cancelled" });
  return job;
}
