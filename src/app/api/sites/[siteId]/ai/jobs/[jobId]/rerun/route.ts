import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { rerunGenerationJobRelational } from "@/lib/stores/job-store";
import { buildWorkerPayload, dispatchWorkerPayload } from "@/lib/worker";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; jobId: string }> }
) {
  const { siteId, jobId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:job-rerun` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  const baseUrl = new URL(request.url).origin;

  try {
    const result = await rerunGenerationJobRelational({ siteId, jobId, actor: body.actor });
    const workerPayload = await buildWorkerPayload({ job: result.job, siteAiApp: result.siteAiApp, baseUrl });
    const workerDispatch = await dispatchWorkerPayload(workerPayload);
    return NextResponse.json({
      ok: true,
      sourceJob: result.sourceJob,
      job: result.job,
      customer: result.customer,
      customerBalance: result.customer.balance,
      ledgerAction: result.ledger,
      workerPayload,
      workerDispatch,
      note: workerDispatch.status === "skipped" ? "Persisted rerun job and reserved credits. Worker dispatch is not configured." : "Persisted rerun job, reserved credits, and attempted worker dispatch."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "job_rerun_failed" }, { status });
  }
}
