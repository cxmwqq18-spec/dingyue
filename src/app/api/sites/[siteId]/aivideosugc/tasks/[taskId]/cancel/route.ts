import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { expectedRevision, jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { getTask, publicTask } from "@/lib/aidreamcapes-workspace/store";
import { cancelTaskOperation } from "@/lib/aidreamcapes-workspace/runner";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = request.headers.has("if-match") ? undefined : await jsonBody(request);
    const revision = expectedRevision(request, body);
    const customerId = auth.current.customer.id;
    const task = await getTask(siteId, customerId, taskId);
    const cancelled = await cancelTaskOperation(task, revision);
    return workspaceResponse({ task: publicTask(cancelled) });
  } catch (error) {
    return workspaceFailure(error);
  }
}
