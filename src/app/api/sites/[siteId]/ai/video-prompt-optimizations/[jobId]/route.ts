import { NextResponse } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { getAsyncJob } from "@/lib/async-jobs";

const JOB_KIND = "video_prompt_optimization";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "GET,OPTIONS" } });
}

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string; jobId: string }> }) {
  const { siteId, jobId } = await params;
  const current = await getCurrentCustomerForSite(siteId);
  if (!current) return NextResponse.json({ ok: false, error: "customer_login_required" }, { status: 401 });

  const job = await getAsyncJob(jobId);
  if (!job || job.kind !== JOB_KIND) {
    return NextResponse.json({ ok: false, error: "video_prompt_optimization_not_found" }, { status: 404 });
  }
  const metadataSiteId = typeof job.metadata.siteId === "string" ? job.metadata.siteId : "";
  const metadataCustomerId = typeof job.metadata.customerId === "string" ? job.metadata.customerId : "";
  if (metadataSiteId !== siteId || metadataCustomerId !== current.customer.id || job.actorId !== current.customer.id) {
    return NextResponse.json({ ok: false, error: "video_prompt_optimization_not_found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt
    }
  });
}
