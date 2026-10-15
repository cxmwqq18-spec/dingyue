import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { getMusicGenerationJob } from "@/lib/aidreamcapes-workspace/music-generation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; jobId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ job: await getMusicGenerationJob(siteId, auth.current.customer.id, jobId) });
  } catch (error) {
    return workspaceFailure(error);
  }
}
