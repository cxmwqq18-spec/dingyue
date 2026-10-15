import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { queueCloneJob } from "@/lib/aidreamcapes-workspace/clones";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const result = await queueCloneJob(siteId, auth.current.customer.id, "voice_twin", await jsonBody(request), request.headers.get("idempotency-key"));
    return workspaceResponse({ ...result, capabilityState: "mock_only", productionReady: false }, result.created ? 202 : 200);
  } catch (error) { return workspaceFailure(error); }
}
