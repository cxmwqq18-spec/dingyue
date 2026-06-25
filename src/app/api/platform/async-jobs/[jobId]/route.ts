import { NextRequest, NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/api-auth";
import { getAsyncJob } from "@/lib/async-jobs";

function asyncJobErrorResponse(error: unknown, fallback: string) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export async function GET(_request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  try {
    const current = await getCurrentPlatformAdmin();
    if (!current) return NextResponse.json({ error: "platform_login_required" }, { status: 401 });

    const { jobId } = await context.params;
    const job = await getAsyncJob(jobId);
    if (!job) return NextResponse.json({ error: "async_job_not_found" }, { status: 404 });
    if (current.platformAdmin.role !== "super_admin" && job.actorId && job.actorId !== current.platformAdmin.id) {
      return NextResponse.json({ error: "platform_forbidden" }, { status: 403 });
    }

    return NextResponse.json({ ok: true, job });
  } catch (error) {
    return asyncJobErrorResponse(error, "async_job_read_failed");
  }
}
