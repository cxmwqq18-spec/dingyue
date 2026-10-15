import { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { getPublishingJob } from "@/lib/aidreamcapes-workspace/publishing";

type Context = { params: Promise<{ siteId: string; jobId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ job: await getPublishingJob(siteId, auth.current.customer.id, jobId) });
  } catch (error) { return developerFailure(error); }
}
