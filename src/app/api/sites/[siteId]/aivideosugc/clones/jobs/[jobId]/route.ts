import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { expectedRevision, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { deleteCloneJob, getCloneJob } from "@/lib/aidreamcapes-workspace/clones";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; jobId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ job: await getCloneJob(siteId, auth.current.customer.id, jobId) });
  } catch (error) { return workspaceFailure(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { siteId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ job: await deleteCloneJob(siteId, auth.current.customer.id, jobId, expectedRevision(request)) });
  } catch (error) { return workspaceFailure(error); }
}
