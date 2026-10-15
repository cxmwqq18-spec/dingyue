import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getTask } from "@/lib/aidreamcapes-workspace/store";
import { getWorkspaceFeatureJob } from "@/lib/aidreamcapes-workspace/features";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string; jobId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const customerId = auth.current.customer.id;
    const task = await getTask(siteId, customerId, taskId);
    const job = getWorkspaceFeatureJob(task, customerId, jobId);
    return workspaceResponse({ job, revision: task.revision });
  } catch (error) {
    return workspaceFailure(error);
  }
}
