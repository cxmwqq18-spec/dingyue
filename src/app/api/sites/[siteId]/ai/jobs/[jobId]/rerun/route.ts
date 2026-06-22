import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { rerunGenerationJob, StoreError, toPublicCustomer } from "@/lib/server-store";
import { buildWorkerPayload } from "@/lib/worker";
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
    const result = rerunGenerationJob({ siteId, jobId, actor: body.actor });
    return NextResponse.json({
      ok: true,
      sourceJob: result.sourceJob,
      job: result.job,
      customer: toPublicCustomer(result.customer),
      customerBalance: result.customer.balance,
      ledgerAction: result.ledger,
      workerPayload: buildWorkerPayload({ job: result.job, siteAiApp: result.siteAiApp, baseUrl }),
      note: "Persisted rerun job and reserved credits before worker dispatch."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "job_rerun_failed" }, { status });
  }
}
