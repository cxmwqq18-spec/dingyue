import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { catalogForCustomer } from "@/lib/aidreamcapes-workspace/api";
import { workspaceResponse, workspaceFailure, jsonBody, expectedRevision } from "@/lib/aidreamcapes-workspace/api";
import { getTask, saveTask } from "@/lib/aidreamcapes-workspace/store";
import { queueWorkspaceFeatureJob } from "@/lib/aidreamcapes-workspace/features";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const task = await getTask(siteId, auth.current.customer.id, taskId);
    return workspaceResponse({ jobs: task.featureJobs ?? [], revision: task.revision });
  } catch (error) {
    return workspaceFailure(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await jsonBody(request);
    const revision = expectedRevision(request, body);
    const task = await getTask(siteId, auth.current.customer.id, taskId);
    const catalog = await catalogForCustomer(siteId, auth.current.customer.id);
    const idempotencyKey = request.headers.get("idempotency-key") || undefined;
    const prior = idempotencyKey ? task.featureJobs?.find((candidate) => candidate.idempotencyKey === idempotencyKey) : undefined;
    const job = queueWorkspaceFeatureJob({
      task,
      customerId: auth.current.customer.id,
      body,
      revision,
      models: catalog.models,
      actors: catalog.actors,
      idempotencyKey,
    });
    if (prior) return workspaceResponse({ job, revision: task.revision }, 202);
    const saved = await saveTask(task, revision);
    return workspaceResponse({ job, revision: saved.revision }, 202);
  } catch (error) {
    return workspaceFailure(error);
  }
}
