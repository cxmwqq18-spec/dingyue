import { after, type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { resumeBatch, mockBatchRunner } from "@/lib/aidreamcapes-workspace/batch";
import { productionBatchRunner } from "@/lib/aidreamcapes-workspace/batch-executor";
import { expectedRevision, jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";

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
    // deterministic no-op fixture runner. Execution runs inside after(): a
    // batch takes minutes to hours, so the HTTP response must not hold the
    // connection open (and a browser navigating away must not kill the run).
    const runner = productionBatchRunner() ?? mockBatchRunner;
    const expectedRevision = expectedRevision(request, body);
    const customerId = auth.current.customer.id;
    after(async () => {
      try {
        await resumeBatch({ siteId, customerId, batchId, expectedRevision, runner });
      } catch (error) {
        console.error("[aivideosugc-workspace] batch resume execution", error);
      }
    });
    return workspaceResponse({ accepted: true, batchId });
  } catch (error) {
    return workspaceFailure(error);
  }
}
