import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { expectedRevision, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { runMusicGenerationJobMock } from "@/lib/aidreamcapes-workspace/music-generation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; jobId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const job = await runMusicGenerationJobMock(siteId, auth.current.customer.id, jobId, expectedRevision(request));
    return workspaceResponse({ job });
  } catch (error) {
    return workspaceFailure(error);
  }
}
