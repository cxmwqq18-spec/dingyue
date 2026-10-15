import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { expectedRevision, jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { getTask, saveTask, type StoredTask } from "@/lib/aidreamcapes-workspace/store";
import { compileVideoEdit, removeEditedRender, renderEditedVideo, type EditedVideoRender, type EditedWorkspaceTask } from "@/lib/aidreamcapes-workspace/editor";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string }> };

function validateTaskId(taskId: string) {
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(taskId)) throw new WorkspaceError("task_id_invalid", 400);
}

function assertTaskOwner(task: EditedWorkspaceTask, siteId: string, customerId: string, taskId: string) {
  if (task.siteId !== siteId || task.siteId !== "site_aidreamcapes" || task.customerId !== customerId || task.taskId !== taskId) {
    throw new WorkspaceError("task_not_found", 404);
  }
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    validateTaskId(taskId);
    const task = await getTask(siteId, auth.current.customer.id, taskId) as EditedWorkspaceTask;
    assertTaskOwner(task, siteId, auth.current.customer.id, taskId);
    const compiled = compileVideoEdit(task, {});
    const video = task.video as EditedVideoRender;
    return workspaceResponse({ taskId, revision: task.revision, renderId: video.renderId,
      sourceRenderId: video.sourceRenderId || video.renderId, settings: compiled.settings, duration: video.editDuration ?? compiled.duration,
      aspect: video.editAspect ?? compiled.aspect });
  } catch (error) {
    return workspaceFailure(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  let taskForCleanup: EditedWorkspaceTask | undefined;
  let uncommittedRenderId: string | undefined;
  let saveStarted = false;
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    validateTaskId(taskId);
    const body = await jsonBody(request);
    if (Object.keys(body).some((key) => !["revision", "edits"].includes(key)) || !Object.hasOwn(body, "edits")) {
      throw new WorkspaceError("workspace_edit_patch_invalid", 400);
    }
    const revision = expectedRevision(request, body);
    const task = await getTask(siteId, auth.current.customer.id, taskId) as EditedWorkspaceTask;
    assertTaskOwner(task, siteId, auth.current.customer.id, taskId);
    if (task.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
    taskForCleanup = task;

    const compiled = compileVideoEdit(task, body.edits);
    const video = await renderEditedVideo(task, compiled);
    uncommittedRenderId = video.renderId;

    const previous = task.video!;
    if (!task.videoHistory.some((entry) => entry.renderId === previous.renderId)) {
      task.videoHistory.push(structuredClone(previous));
    }
    task.video = video;
    task.captionEdits = undefined;
    task.status = "completed";
    task.revisions.push({ at: new Date().toISOString(), field: "videoEdit", before: (previous as typeof video).editSettings ?? null,
      after: { renderId: video.renderId, sourceRenderId: video.sourceRenderId, settings: video.editSettings, duration: video.editDuration, aspect: video.editAspect } });
    task.revisions = task.revisions.slice(-100);
    saveStarted = true;
    const saved = await saveTask(task as unknown as StoredTask, revision);
    uncommittedRenderId = undefined;
    return workspaceResponse({ taskId, revision: saved.revision, renderId: saved.video?.renderId,
      sourceRenderId: (saved.video as typeof video | undefined)?.sourceRenderId, duration: (saved.video as typeof video | undefined)?.editDuration,
      aspect: (saved.video as typeof video | undefined)?.editAspect, settings: (saved.video as typeof video | undefined)?.editSettings,
      priorRenderIds: saved.videoHistory.map((entry) => entry.renderId) });
  } catch (error) {
    const knownConflict = error instanceof WorkspaceError && error.code === "revision_conflict";
    if (taskForCleanup && uncommittedRenderId && (!saveStarted || knownConflict)) {
      await removeEditedRender(taskForCleanup, uncommittedRenderId).catch(() => undefined);
    }
    return workspaceFailure(error);
  }
}
