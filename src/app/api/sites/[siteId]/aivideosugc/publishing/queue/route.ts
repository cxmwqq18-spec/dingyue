import { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { queuePublishingJob, listPublishingJobs } from "@/lib/aidreamcapes-workspace/publishing";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ jobs: await listPublishingJobs(siteId, auth.current.customer.id) });
  } catch (error) { return developerFailure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await developerJsonBody(request);
    const headerKey = request.headers.get("idempotency-key");
    if (headerKey && body.idempotencyKey && headerKey !== body.idempotencyKey) throw new WorkspaceError("idempotency_key_mismatch");
    const result = await queuePublishingJob(siteId, auth.current.customer.id, {
      taskId: body.taskId,
      target: body.target,
      scheduledAt: body.scheduledAt,
      idempotencyKey: headerKey ?? body.idempotencyKey
    });
    return developerResponse(result, 202);
  } catch (error) { return developerFailure(error); }
}
