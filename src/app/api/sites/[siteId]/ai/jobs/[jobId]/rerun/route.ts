import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { submitRerunGenerationJob } from "@/lib/generation-submit";
import { StoreError } from "@/lib/server-store";
import { publicUrlForRequest } from "@/lib/session";
import { resolveWorkerBaseUrls } from "@/lib/worker";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; jobId: string }> }
) {
  const { siteId, jobId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:job-rerun` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  const workerBaseUrls = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);

  try {
    const result = await submitRerunGenerationJob({
      siteId,
      jobId,
      actor: body.actor,
      baseUrls: workerBaseUrls,
      includeWorkerPayload: true
    });
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.workerDispatch.error ?? "worker_dispatch_failed",
        sourceJob: result.sourceJob,
        job: result.job,
        customer: result.customer,
        customerBalance: result.customerBalance,
        workerDispatch: result.workerDispatch,
        note: result.note
      }, { status: result.workerDispatch.status === "skipped" ? 503 : 502 });
    }
    return NextResponse.json({
      ok: true,
      sourceJob: result.sourceJob,
      job: result.job,
      customer: result.customer,
      customerBalance: result.customerBalance,
      ledgerAction: result.ledgerAction,
      workerPayload: result.workerPayload,
      workerDispatch: result.workerDispatch,
      note: result.note
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "job_rerun_failed" }, { status });
  }
}
