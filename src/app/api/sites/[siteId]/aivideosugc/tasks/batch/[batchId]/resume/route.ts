import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { resumeBatch } from "@/lib/aidreamcapes-workspace/batch";
import { expectedRevision, jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { publicTask } from "@/lib/aidreamcapes-workspace/store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; batchId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, batchId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = request.headers.has("if-match") ? undefined : await jsonBody(request);
    const snapshot = await resumeBatch({ siteId, customerId: auth.current.customer.id, batchId, expectedRevision: expectedRevision(request, body) });
    return workspaceResponse({ batch: snapshot.batch, tasks: snapshot.tasks.map(task => ({ ...publicTask(task), batch: task.batch })) });
  } catch (error) {
    return workspaceFailure(error);
  }
}
