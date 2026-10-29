import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { resumeBatch, mockBatchRunner } from "@/lib/aidreamcapes-workspace/batch";
import { productionBatchRunner } from "@/lib/aidreamcapes-workspace/batch-executor";
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
    // Production recovery path: re-queue expired leases and advance the batch
    // with the same live runner batch-submit uses. Mock mode keeps the
    // deterministic no-op fixture runner.
    const runner = productionBatchRunner() ?? mockBatchRunner;
    const snapshot = await resumeBatch({ siteId, customerId: auth.current.customer.id, batchId, expectedRevision: expectedRevision(request, body), runner });
    return workspaceResponse({ batch: snapshot.batch, tasks: snapshot.tasks.map(task => ({ ...publicTask(task), batch: task.batch })) });
  } catch (error) {
    return workspaceFailure(error);
  }
}
