import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody, expectedRevision } from "@/lib/aidreamcapes-workspace/api";
import { getTask, saveTask } from "@/lib/aidreamcapes-workspace/store";
import { cancelWorkspaceFeatureJob } from "@/lib/aidreamcapes-workspace/features";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string; jobId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await jsonBody(request);
    const revision = expectedRevision(request, body);
    const customerId = auth.current.customer.id;
    const task = await getTask(siteId, customerId, taskId);
    const job = cancelWorkspaceFeatureJob({ task, customerId, jobId, revision });
    const saved = await saveTask(task, revision);
    return workspaceResponse({ job, revision: saved.revision });
  } catch (error) {
    return workspaceFailure(error);
  }
}
