import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody, expectedRevision } from "@/lib/aidreamcapes-workspace/api";
import { getTask, saveTask } from "@/lib/aidreamcapes-workspace/store";
import { readCaptionLines, updateCaptionLines } from "@/lib/aidreamcapes-workspace/captions";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string }> };

function validateTaskId(taskId: string) {
  if (!/^[a-zA-Z0-9_-]{1,180}$/.test(taskId)) throw new WorkspaceError("task_id_invalid", 400);
}

function readRevisionGuard(request: NextRequest): number | undefined {
  const header = request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', "");
  const raw = header || request.nextUrl.searchParams.get("revision");
  if (raw === null || raw === undefined) return undefined;
  const revision = Number(raw);
  if (!Number.isSafeInteger(revision) || revision < 1) throw new WorkspaceError("revision_required", 428);
  return revision;
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    validateTaskId(taskId);
    const task = await getTask(siteId, auth.current.customer.id, taskId);
    if (task.siteId !== siteId || task.taskId !== taskId || task.customerId !== auth.current.customer.id) {
      throw new WorkspaceError("task_not_found", 404);
    }
    const expected = readRevisionGuard(request);
    if (expected !== undefined && task.revision !== expected) throw new WorkspaceError("revision_conflict", 409);
    return workspaceResponse({ taskId, revision: task.revision, ...readCaptionLines(task) });
  } catch (error) {
    return workspaceFailure(error);
  }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    validateTaskId(taskId);
    const body = await jsonBody(request);
    if (Object.keys(body).some((key) => !["revision", "lines"].includes(key)) || !Object.hasOwn(body, "lines")) {
      throw new WorkspaceError("workspace_caption_patch_invalid", 400);
    }
    const revision = expectedRevision(request, body);
    const task = await getTask(siteId, auth.current.customer.id, taskId);
    if (task.siteId !== siteId || task.taskId !== taskId || task.customerId !== auth.current.customer.id) {
      throw new WorkspaceError("task_not_found", 404);
    }
    const draft = updateCaptionLines(task, body.lines, revision);
    const saved = await saveTask(task, revision);
    return workspaceResponse({ taskId, revision: saved.revision, renderId: draft.renderId, lines: draft.lines, edited: true });
  } catch (error) {
    return workspaceFailure(error);
  }
}
