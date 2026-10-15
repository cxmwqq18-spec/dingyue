import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { expectedRevision, jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { retryCloneJob } from "@/lib/aidreamcapes-workspace/clones";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; jobId: string }> };
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await jsonBody(request);
    const result = await retryCloneJob(siteId, auth.current.customer.id, jobId, expectedRevision(request, body), body);
    return workspaceResponse({ ...result, capabilityState: "mock_only", productionReady: false }, result.created ? 201 : 200);
  } catch (error) { return workspaceFailure(error); }
}
