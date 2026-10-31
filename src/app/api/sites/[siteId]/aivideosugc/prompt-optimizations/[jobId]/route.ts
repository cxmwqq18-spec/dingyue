import type { NextRequest } from "next/server";
import { getAsyncJob } from "@/lib/async-jobs";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

const JOB_KIND = "wan30_video_prompt_optimization";

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string; jobId: string }> }) {
  try {
    const { siteId, jobId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const job = await getAsyncJob(jobId);
    if (!job || job.kind !== JOB_KIND || job.actorId !== auth.current.customer.id || job.metadata.siteId !== siteId) {
      throw new WorkspaceError("wan30_prompt_optimization_job_not_found", 404);
    }
    return workspaceResponse({
      ok: true,
      job: {
        id: job.id,
        status: job.status,
        result: job.result,
        error: job.error,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      }
    });
  } catch (error) { return workspaceFailure(error); }
}

export const dynamic = "force-dynamic";
