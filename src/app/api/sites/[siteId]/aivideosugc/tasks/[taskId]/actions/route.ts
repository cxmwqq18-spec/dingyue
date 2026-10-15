import { after, type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody, expectedRevision } from "@/lib/aidreamcapes-workspace/api";
import { getTask, publicTask } from "@/lib/aidreamcapes-workspace/store";
import { queueAction, executeAction, refreshTask } from "@/lib/aidreamcapes-workspace/runner";
import { publicUrlForRequest } from "@/lib/session";
import { resolveWorkerBaseUrls } from "@/lib/worker";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string; taskId: string }> }) {
  try {
    const { siteId, taskId } = await params; const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response;
    const body = await jsonBody(request); const revision = expectedRevision(request, body);
    let task = await getTask(siteId, auth.current.customer.id, taskId);
    const bases = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);
    if (body.action === "resume") {
      if (task.status === "cancelled") throw new WorkspaceError("operation_not_cancellable", 409);
      if (task.revision !== revision) return workspaceResponse({ error: "revision_conflict" }, 409);
      task = await refreshTask(task);
    } else {
      task = await queueAction(task, body, revision, request.headers.get("idempotency-key") || undefined);
    }
    const queued = task;
    after(async () => {
      try { await executeAction(await getTask(siteId, auth.current.customer.id, taskId), bases); }
      catch (error) { console.error("[aivideosugc-workspace] durable operation", error); }
    });
    return workspaceResponse({ task: publicTask(queued) }, 202);
  } catch (error) { return workspaceFailure(error); }
}
