import { after, type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody, expectedRevision, parseInput, patchStoryboard, assertOwnedImages } from "@/lib/aidreamcapes-workspace/api";
import { getTask, saveTask, deleteTask, publicTask } from "@/lib/aidreamcapes-workspace/store";
import { assertActorVoiceSnapshot, createActorVoiceSnapshot, validateTaskInput } from "@/lib/aidreamcapes-workspace/pipeline";
import { catalogForCustomer } from "@/lib/aidreamcapes-workspace/api";
import { refreshTask, continueDirectTask, directTaskNeedsServerContinuation } from "@/lib/aidreamcapes-workspace/runner";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
import { normalizeConfirmedProductBrief } from "@/lib/aidreamcapes-workspace/product-brief-snapshot";
import { publicUrlForRequest } from "@/lib/session";
import { resolveWorkerBaseUrls } from "@/lib/worker";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    const task = await refreshTask(await getTask(siteId, auth.current.customer.id, taskId));
    // A direct task left mid-flow (for example the browser closed between
    // steps) is advanced by the server on the next read instead of waiting for
    // the customer to press retry.
    if (directTaskNeedsServerContinuation(task)) {
      const bases = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);
      after(async () => { try { await continueDirectTask(task, bases); } catch (error) { console.error("[aivideosugc-workspace] direct continuation", error); } });
    }
    return workspaceResponse({ task: publicTask(task) });
  }
  catch (error) { return workspaceFailure(error); }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params; const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response;
    const body = await jsonBody(request); const revision = expectedRevision(request, body); const task = await getTask(siteId, auth.current.customer.id, taskId);
    if (task.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
    if (task.operation?.state === "pending" || task.operation?.state === "run" || task.storyboard?.shots.some(s => s.genStatus === "run" || s.compositeStatus === "run")) throw new WorkspaceError("task_busy", 409);
    const catalog = await catalogForCustomer(siteId, auth.current.customer.id);
    if (body.input !== undefined) {
      const input = validateTaskInput(task.sceneId, parseInput(body.input), catalog.actors, false, catalog.models);
      if (JSON.stringify(input) !== JSON.stringify(task.input)) {
        const previousInput = task.input;
        if (input.actorId !== previousInput.actorId) {
          const previousVoice = task.voiceSnapshot;
          task.voiceSnapshot = input.actorId ? createActorVoiceSnapshot(catalog.actors.find((actor) => actor.actorId === input.actorId)) : undefined;
          task.revisions.push({ at: new Date().toISOString(), field: "voiceSnapshot", before: previousVoice, after: task.voiceSnapshot });
        } else if (input.actorId) {
          const snapshot = assertActorVoiceSnapshot(task.voiceSnapshot, input.actorId);
          if (!(snapshot.profile.languages ?? [snapshot.profile.language]).includes(input.options.language)) throw new WorkspaceError("workspace_actor_language_unsupported");
        } else {
          task.voiceSnapshot = undefined;
        }
        task.revisions.push({ at: new Date().toISOString(), field: "input", before: previousInput, after: input }); task.input = input;
        task.storyboardStale = !!task.storyboard;
      }
    }
    if (body.productBrief !== undefined) {
      const before = task.productBrief ?? null;
      const productBrief = normalizeConfirmedProductBrief(body.productBrief);
      task.productBrief = productBrief;
      task.revisions.push({ at: new Date().toISOString(), field: "productBrief", before, after: productBrief });
      task.storyboardStale = task.storyboardStale || Boolean(task.storyboard);
    }
    if (body.storyboard !== undefined) { const before = task.storyboard; if (before) task.storyboardHistory.push(before); task.storyboard = patchStoryboard(task, body.storyboard, catalog.actors); task.revisions.push({ at: new Date().toISOString(), field: "storyboard", before, after: task.storyboard }); }
    if (body.title !== undefined) { if (typeof body.title !== "string" || !body.title.trim()) throw new WorkspaceError("invalid_title"); task.title = body.title.trim().slice(0, 160); }
    await assertOwnedImages(siteId, auth.current.customer.id, task.input, catalog.actors, task.storyboard);
    if (task.video && (body.input !== undefined || body.storyboard !== undefined || body.productBrief !== undefined)) task.video.stale = true;
    task.revisions = task.revisions.slice(-100);
    return workspaceResponse({ task: publicTask(await saveTask(task, revision)) });
  } catch (error) { return workspaceFailure(error); }
}
export async function DELETE(request: NextRequest, { params }: Context) {
  try { const { siteId, taskId } = await params; const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response; await deleteTask(await getTask(siteId, auth.current.customer.id, taskId), expectedRevision(request)); return workspaceResponse({ ok: true }); }
  catch (error) { return workspaceFailure(error); }
}
