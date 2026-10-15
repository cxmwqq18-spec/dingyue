import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { listCloneJobs } from "@/lib/aidreamcapes-workspace/clones";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ jobs: await listCloneJobs(siteId, auth.current.customer.id) });
  } catch (error) { return workspaceFailure(error); }
}
