import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { WorkerBaseUrls } from "@/lib/worker";
import { getTask, saveTask, type StoredTask } from "./store";
import { WorkspaceError, type ShotSnapshot, type StoryboardShot, type VideoRender } from "./types";
import { generateStoryboard, submitShotGeneration, refreshShotGeneration, submitActorProductComposite, refreshCompositeGeneration, getWorkspaceActors } from "./provider";
import { assertActorVoiceSnapshot, compileStoryboard } from "./pipeline";
import { sceneSchema } from "./catalogs";
import { renderTaskVideo } from "./media-render";
import { catalogForCustomer } from "./api";
import { verifyQuote } from "./quote";
import { cancelMockCredits, createMockShotClip, mockShotClipUrl, refundMockCredits, reserveMockCredits, settleMockCredits } from "./mock-runtime";
import { isWorkspaceStabilityMockMode } from "./stability";
import { assertTaskMusicSelectionRights } from "./music-catalog";

const ACTIONS = new Set(["storyboard", "reroll", "rewrite", "generate_shot", "compose_shot", "restore_version", "render"]);
export function shotSnapshot(shot: StoryboardShot): ShotSnapshot {
  const { visual, voiceover, refKinds, refImgs, firstFrame, lastFrame, actorId, voiceSnapshot, environment, start, end, duration, camera, framing, lighting, expression } = shot;
  return { visual, voiceover, refKinds: [...refKinds], refImgs: { ...refImgs }, firstFrame, lastFrame, actorId, voiceSnapshot: voiceSnapshot ? structuredClone(voiceSnapshot) : undefined,
    environment, start, end, duration, camera, framing, lighting, expression };
}
export async function queueAction(task: StoredTask, body: Record<string, unknown>, revision: number, idempotencyKey?: string): Promise<StoredTask> {
  const action = String(body.action); if (!ACTIONS.has(action)) throw new WorkspaceError("invalid_action");
  if (task.sourceAnalysis?.synthetic && !isWorkspaceStabilityMockMode() && action !== "restore_version") throw new WorkspaceError("workspace_clone_analysis_mock_only", 409);
  if (task.status === "cancelled") throw new WorkspaceError("operation_not_cancellable", 409);
  if (idempotencyKey && task.operation?.id === idempotencyKey) {
    if (task.operation.action !== action || task.operation.shotId !== body.shotId || task.operation.versionId !== body.versionId || task.operation.language !== body.language) throw new WorkspaceError("idempotency_conflict", 409);
    return task;
  }
  if (task.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
  if (task.operation?.state === "run" || task.operation?.state === "pending") throw new WorkspaceError("task_busy", 409);
  if (!["generate_shot", "compose_shot"].includes(action) && task.storyboard?.shots.some(s => s.genStatus === "run" || s.compositeStatus === "run")) throw new WorkspaceError("task_busy", 409);
  if (["generate_shot", "compose_shot", "restore_version"].includes(action) && !task.storyboard?.shots.some(s => s.shotId === body.shotId)) throw new WorkspaceError("shot_not_found", 404);
  if (!["storyboard", "reroll"].includes(action) && !task.storyboard) throw new WorkspaceError("storyboard_required");
  if (["generate_shot", "compose_shot"].includes(action) && task.storyboardStale) throw new WorkspaceError("storyboard_stale", 409);
  if (sceneSchema(task.sceneId).needsActor && task.input.actorId) assertActorVoiceSnapshot(task.voiceSnapshot, task.input.actorId);
  const target = task.storyboard?.shots.find(s => s.shotId === body.shotId);
  if (["generate_shot", "compose_shot"].includes(action) && (target?.genStatus === "run" || target?.compositeStatus === "run")) throw new WorkspaceError("shot_busy", 409);
  if (action === "render" && task.storyboardStale) throw new WorkspaceError("storyboard_stale", 409);
  if (action === "render" && task.musicSelection) await assertTaskMusicSelectionRights(task);
  const expectedCredits = ["generate_shot", "compose_shot"].includes(action)
    ? await verifyQuote(task, action as "generate_shot" | "compose_shot", typeof body.shotId === "string" ? body.shotId : undefined, body.quoteToken, revision)
    : undefined;
  const operationId = idempotencyKey?.slice(0, 180) || randomUUID();
  task.operation = { id: operationId, action,
    shotId: typeof body.shotId === "string" ? body.shotId : undefined, versionId: typeof body.versionId === "string" ? body.versionId : undefined,
    language: typeof body.language === "string" ? body.language : undefined, state: "pending", attempts: 0,
    quoteToken: typeof body.quoteToken === "string" ? body.quoteToken : undefined, quotedRevision: revision, expectedCredits };
  task.error = undefined;
  const mockPaidReservation = isWorkspaceStabilityMockMode() && expectedCredits !== undefined && ["generate_shot", "compose_shot"].includes(action);
  if (mockPaidReservation) reserveMockCredits({ siteId: task.siteId, customerId: task.customerId, taskId: task.taskId, operationId, credits: expectedCredits! });
  try { return await saveTask(task, revision); }
  catch (error) {
    if (mockPaidReservation) refundMockCredits({ siteId: task.siteId, customerId: task.customerId, taskId: task.taskId, operationId });
    throw error;
  }
}

/** Cancel queued work, or in-flight work only while execution is strictly mock-only. */
export async function cancelTaskOperation(task: StoredTask, expectedRevision: number): Promise<StoredTask> {
  if (task.status === "cancelled") {
    if (expectedRevision > task.revision) throw new WorkspaceError("revision_conflict", 409);
    return task;
  }
  if (task.revision !== expectedRevision) throw new WorkspaceError("revision_conflict", 409);
  const mockMode = isWorkspaceStabilityMockMode();
  if (!task.operation || !["pending", "run"].includes(task.operation.state) || (task.operation.state === "run" && !mockMode)) {
    throw new WorkspaceError("operation_not_cancellable", 409);
  }
  const operation = task.operation;
  const previousStatus = task.status;
  task.status = "cancelled";
  task.cancelledAt = new Date().toISOString();
  task.operation.state = "cancelled";
  task.operation.leaseUntil = undefined;
  task.operation.error = "workspace_operation_cancelled";
  task.error = "workspace_operation_cancelled";
  task.revisions = [...task.revisions, { at: task.cancelledAt, field: "status", before: previousStatus, after: "cancelled" }].slice(-100);
  const saved = await saveTask(task, expectedRevision);
  if (mockMode && operation.expectedCredits !== undefined) {
    cancelMockCredits({ siteId: task.siteId, customerId: task.customerId, taskId: task.taskId, operationId: operation.id });
  }
  return saved;
}

/** Backward-compatible helper name for the original queued-mock cancellation path. */
export async function cancelPendingMockOperation(task: StoredTask, expectedRevision: number): Promise<StoredTask> {
  if (!isWorkspaceStabilityMockMode()) throw new WorkspaceError("workspace_stability_mock_mode_required", 409);
  return cancelTaskOperation(task, expectedRevision);
}

// The lease and all results live in PostgreSQL. An interrupted request is retried
// explicitly by POST resume; paid dispatch uses the same generation idempotency key.
export async function executeAction(task: StoredTask, baseUrls: WorkerBaseUrls): Promise<StoredTask> {
  if (task.status === "cancelled" || !task.operation || ["done", "fail", "cancelled"].includes(task.operation.state)) return task;
  if (task.operation.state === "run" && Date.parse(task.operation.leaseUntil || "") > Date.now()) return task;
  if (task.operation.attempts >= 3) {
    task.operation.state = "fail"; task.operation.error = "operation_interrupted"; task.error = "operation_interrupted";
    if (isWorkspaceStabilityMockMode() && task.operation.expectedCredits !== undefined) {
      refundMockCredits({ siteId: task.siteId, customerId: task.customerId, taskId: task.taskId, operationId: task.operation.id });
    }
    return saveTask(task, task.revision);
  }
  task.operation.state = "run"; task.operation.leaseUntil = new Date(Date.now() + 300_000).toISOString(); task.operation.attempts++;
  task = await saveTask(task, task.revision);
  const operationId = task.operation!.id;
  try {
    const stabilityMock = isWorkspaceStabilityMockMode();
    if (task.sourceAnalysis?.synthetic && !stabilityMock && task.operation!.action !== "restore_version") throw new WorkspaceError("workspace_clone_analysis_mock_only", 409);
    const catalog = stabilityMock ? { actors: getWorkspaceActors() } : await catalogForCustomer(task.siteId, task.customerId);
    const action = task.operation!.action;
    if (["storyboard", "reroll", "rewrite"].includes(action)) {
      const before = task.storyboard;
      if (action === "rewrite" && task.operation!.language && task.operation!.language !== task.input.options.language) throw new WorkspaceError("language_input_mismatch");
      const generated = await generateStoryboard({ siteId: task.siteId, sceneId: task.sceneId, input: task.input, actors: catalog.actors,
        modelCapabilities: "models" in catalog ? catalog.models : undefined,
        productBrief: task.productBrief, sourceTemplate: task.sourceTemplate, sourceAnalysis: task.sourceAnalysis, existing: before, rewriteOnly: action === "rewrite" });
      const result = compileStoryboard({ sceneId: task.sceneId, input: task.input, storyboard: generated, actors: catalog.actors,
        voiceSnapshot: task.voiceSnapshot, requireVoiceSnapshot: true });
      if (before) task.storyboardHistory.push(before);
      task.storyboard = result; task.storyboardStale = false; if (task.status !== "completed") task.status = "storyboard_ready";
      if (task.video) task.video.stale = true;
      task.captionEdits = undefined;
    } else if (action === "compose_shot") {
      if (stabilityMock) throw new WorkspaceError("workspace_stability_mock_image_dispatch_disabled", 503);
      const shot = task.storyboard!.shots.find(s => s.shotId === task.operation!.shotId)!;
      const expectedCredits = await verifyQuote(task, "compose_shot", shot.shotId, task.operation!.quoteToken, task.operation!.quotedRevision);
      const submission = await submitActorProductComposite({ siteId: task.siteId, customerId: task.customerId, taskId: task.taskId, sceneId: task.sceneId,
        shot, input: task.input, storyboard: task.storyboard!, actors: catalog.actors, baseUrls, idempotencyKey: `ugc-composite:${task.taskId}:${operationId}`, expectedCredits });
      shot.compositeGenerationJobId = submission.job.id; shot.compositeStatus = submission.ok ? "run" : "fail";
      shot.compositeError = submission.ok ? undefined : submission.workerDispatch.error || "composition_dispatch_failed";
      shot.compositeInputHash = createHash("sha256").update(JSON.stringify({ actorId: task.input.actorId, images: task.input.images, aspect: task.input.options.aspect, scene: task.storyboard!.scenePlan.mainScene })).digest("hex");
      if (task.video) task.video.stale = true;
      task.captionEdits = undefined;
    } else if (action === "generate_shot") {
      task.storyboard = compileStoryboard({ sceneId: task.sceneId, input: task.input, storyboard: task.storyboard!, actors: catalog.actors,
        voiceSnapshot: task.voiceSnapshot, requireVoiceSnapshot: true });
      const shot = task.storyboard.shots.find(s => s.shotId === task.operation!.shotId)!;
      const versionId = stabilityMock ? `mock-${createHash("sha256").update(operationId).digest("hex").slice(0, 32)}` : operationId;
      const expectedCredits = await verifyQuote(task, "generate_shot", shot.shotId, task.operation!.quoteToken, task.operation!.quotedRevision);
      if (stabilityMock) {
        const clipUrl = mockShotClipUrl(task, shot.shotId, versionId);
        await createMockShotClip(task, shot.shotId, versionId, shot.duration);
        if (!shot.versions.some(v => v.vid === versionId)) shot.versions.push({ ...shotSnapshot(shot), inputSnapshot: structuredClone(task.input), vid: versionId, ts: new Date().toISOString(), prompt: shot.prompt, origin: "manual",
          clipUrl, modelId: "aivideosugc-stability-mock", status: "done", speechCues: shot.voiceover.trim() ? [{ start: 0, end: shot.duration, text: shot.voiceover.trim() }] : undefined,
          speechTimingVerified: Boolean(shot.voiceover.trim()), mock: true } as typeof shot.versions[number] & { mock: true });
        shot.curVer = versionId; shot.genStatus = "done"; shot.error = undefined;
      } else {
        const submission = await submitShotGeneration({ siteId: task.siteId, customerId: task.customerId, aiAppSlug: "video_generator", taskId: task.taskId,
          sceneId: task.sceneId, shot, input: task.input, storyboard: task.storyboard, actors: catalog.actors, baseUrls, idempotencyKey: `ugc:${task.taskId}:${versionId}`, expectedCredits });
        const submittedPrompt = submission.job.requestJson.prompt as { rendered?: string } | undefined;
        const submittedWorkspace = submission.job.requestJson.workspace as { providerId?: string } | undefined;
        if (!shot.versions.some(v => v.vid === versionId)) shot.versions.push({ ...shotSnapshot(shot), inputSnapshot: structuredClone(task.input), vid: versionId, ts: new Date().toISOString(), prompt: submittedPrompt?.rendered || shot.prompt, origin: "manual",
          generationJobId: submission.job.id, modelId: submittedWorkspace?.providerId || task.input.modelId, status: submission.ok ? "run" : "fail", error: submission.ok ? undefined : submission.workerDispatch.error || "generation_dispatch_failed" });
        shot.curVer = versionId; shot.genStatus = submission.ok ? "run" : "fail"; shot.error = submission.ok ? undefined : submission.workerDispatch.error;
      }
      if (task.video) task.video.stale = true;
      task.captionEdits = undefined;
    } else if (action === "restore_version") {
      const shot = task.storyboard!.shots.find(s => s.shotId === task.operation!.shotId)!;
      const version = shot.versions.find(v => v.vid === task.operation!.versionId);
      if (!version) throw new WorkspaceError("version_not_found", 404);
      task.revisions.push({ at: new Date().toISOString(), shotId: shot.shotId, field: "version", before: shotSnapshot(shot), after: version.vid });
      Object.assign(shot, shotSnapshot({ ...shot, ...version }), { curVer: version.vid, genStatus: version.status, error: version.error });
      const inputChanged = !!version.inputSnapshot && JSON.stringify(version.inputSnapshot) !== JSON.stringify(task.input);
      if (version.inputSnapshot && inputChanged) {
        task.revisions.push({ at: new Date().toISOString(), shotId: shot.shotId, field: "version_input", before: task.input, after: version.inputSnapshot });
        task.input = structuredClone(version.inputSnapshot);
      }
      // Restore exactly what produced this version. A task-wide identity change
      // needs an explicit reconciliation; compilation may not rewrite history.
      if (task.input.actorId) task.voiceSnapshot = assertActorVoiceSnapshot(version.voiceSnapshot, task.input.actorId);
      else task.voiceSnapshot = undefined;
      const identityChanged = shot.actorId !== task.input.actorId;
      shot.prompt = version.prompt;
      if (identityChanged || inputChanged) task.storyboardStale = true;
      else task.storyboard = compileStoryboard({ sceneId: task.sceneId, input: task.input, storyboard: task.storyboard!, actors: catalog.actors,
        voiceSnapshot: task.voiceSnapshot, requireVoiceSnapshot: true });
      if (task.video) task.video.stale = true;
      task.captionEdits = undefined;
    } else if (action === "render") {
      if (task.video) task.videoHistory.push(structuredClone(task.video));
      task.status = "rendering"; task = await saveTask(task, task.revision);
      const video = await renderTaskVideo({ task, onProgress: async (progress: VideoRender) => {
        const current = await getTask(task.siteId, task.customerId, task.taskId);
        if (current.operation?.id !== operationId || current.operation.state !== "run") throw new WorkspaceError("operation_superseded", 409);
        current.video = progress; task = await saveTask(current, current.revision);
      } });
      task.video = video;
      if (video.status !== "done") throw new WorkspaceError(video.error || "workspace_render_failed", 502);
      task.captionEdits = undefined;
      task.status = "completed";
    }
    task.operation!.state = "done"; task.operation!.leaseUntil = undefined; task.revisions = task.revisions.slice(-100);
    const saved = await saveTask(task, task.revision);
    if (stabilityMock && task.operation?.expectedCredits !== undefined) {
      settleMockCredits({ siteId: task.siteId, customerId: task.customerId, taskId: task.taskId, operationId: task.operation!.id });
    }
    return saved;
  } catch (error) {
    const current = await getTask(task.siteId, task.customerId, task.taskId);
    if (current.operation?.id !== operationId || current.operation.state !== "run") return current;
    const code = error instanceof WorkspaceError ? error.code : error instanceof Error ? error.message : "operation_failed";
    if (isWorkspaceStabilityMockMode() && current.operation.expectedCredits !== undefined) {
      try { refundMockCredits({ siteId: current.siteId, customerId: current.customerId, taskId: current.taskId, operationId: current.operation.id }); } catch { /* The operation may have been cancelled before execution. */ }
    }
    current.operation.state = "fail"; current.operation.error = code; current.operation.leaseUntil = undefined; current.error = code;
    if (current.status === "rendering") { current.status = "failed"; if (current.video) { current.video.status = "fail"; current.video.error = code; } }
    return saveTask(current, current.revision);
  }
}

export async function refreshTask(task: StoredTask): Promise<StoredTask> {
  if (task.status === "cancelled") return task;
  // The active action owns the aggregate revision until its durable result is
  // attached. Read-side job refresh must not race a paid job attachment.
  if (task.operation?.state === "pending" || task.operation?.state === "run") return task;
  if (isWorkspaceStabilityMockMode()) {
    let changed = false;
    for (const shot of task.storyboard?.shots || []) {
      if (shot.genStatus === "run" || shot.genStatus === "pending") {
        shot.genStatus = "fail"; shot.error = "workspace_stability_mock_video_dispatch_disabled"; changed = true;
      }
      if (shot.compositeStatus === "run" || shot.compositeStatus === "pending") {
        shot.compositeStatus = "fail"; shot.compositeError = "workspace_stability_mock_image_dispatch_disabled"; changed = true;
      }
    }
    if (!changed) return task;
    return saveTask(task, task.revision);
  }
  let changed = false;
  for (const shot of task.storyboard?.shots || []) {
    if (shot.compositeGenerationJobId && ["run", "pending"].includes(shot.compositeStatus || "")) {
      const result = await refreshCompositeGeneration({ siteId: task.siteId, customerId: task.customerId, generationJobId: shot.compositeGenerationJobId });
      if (result.status !== shot.compositeStatus || result.error !== shot.compositeError || (result.clipUrl && result.clipUrl !== shot.refImgs.composite)) {
        shot.compositeStatus = result.status; shot.compositeError = result.error; changed = true;
        if (result.status === "done" && result.clipUrl) shot.refImgs.composite = result.clipUrl;
      }
    }
    for (const version of shot.versions.filter(v => v.generationJobId && ["pending", "run"].includes(v.status))) {
      const result = await refreshShotGeneration({ siteId: task.siteId, customerId: task.customerId, generationJobId: version.generationJobId! });
      const before = JSON.stringify(version);
      Object.assign(version, result);
      if (JSON.stringify(version) !== before) {
        changed = true;
        if (shot.curVer === version.vid) { shot.genStatus = version.status; shot.error = version.error; }
      }
    }
  }
  if (!changed) return task;
  try { return await saveTask(task, task.revision); }
  catch (error) { if (error instanceof WorkspaceError && error.code === "revision_conflict") return getTask(task.siteId, task.customerId, task.taskId); throw error; }
}
