import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { getAsyncJob } from "@/lib/async-jobs";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; jobId: string }> };

const JOB_KIND = "aivideosugc_subtitle_op";

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    if (!/^[a-zA-Z0-9_-]{1,200}$/.test(jobId)) return workspaceResponse({ error: "workspace_subtitle_op_not_found" }, 404);

    const job = await getAsyncJob(jobId);
    if (!job || job.kind !== JOB_KIND) return workspaceResponse({ error: "workspace_subtitle_op_not_found" }, 404);
    const metadataCustomerId = typeof job.metadata.customerId === "string" ? job.metadata.customerId : "";
    const metadataSiteId = typeof job.metadata.siteId === "string" ? job.metadata.siteId : "";
    if (metadataSiteId !== siteId || metadataCustomerId !== auth.current.customer.id || job.actorId !== auth.current.customer.id) {
      return workspaceResponse({ error: "workspace_subtitle_op_not_found" }, 404);
    }

    return workspaceResponse({
      job: { id: job.id, status: job.status, result: job.result, error: job.error, createdAt: job.createdAt, updatedAt: job.updatedAt }
    });
  } catch (error) {
    return workspaceFailure(error);
  }
}
