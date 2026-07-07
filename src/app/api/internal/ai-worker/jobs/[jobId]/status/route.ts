import { NextResponse } from "next/server";
import { StoreError } from "@/lib/server-store";
import { updateGenerationJobStatusRelational } from "@/lib/stores/job-store";
import { verifyWorkerCallbackSignature, type WorkerOutputSlot } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { siteId?: string; requestId?: string; status?: string; stage?: string; outputSlots?: WorkerOutputSlot[]; signature?: string };
  if (!body.siteId || !body.requestId || !body.status) {
    return NextResponse.json({ error: "invalid_worker_status_payload" }, { status: 400 });
  }
  if (!verifyWorkerCallbackSignature(body as Record<string, unknown>)) {
    return NextResponse.json({ error: "invalid_worker_signature" }, { status: 401 });
  }
  if (body.status !== "queued" && body.status !== "running" && body.status !== "failed") {
    return NextResponse.json({ error: "invalid_worker_status" }, { status: 400 });
  }
  try {
    const result = await updateGenerationJobStatusRelational({
      jobId,
      siteId: body.siteId,
      requestId: body.requestId,
      status: body.status,
      stage: body.stage,
      outputSlots: Array.isArray(body.outputSlots) ? body.outputSlots : undefined
    });
    return NextResponse.json({
      accepted: true,
      job: result.job,
      alreadyFinal: result.alreadyFinal,
      note: "Persisted worker status without changing credits."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "worker_status_update_failed" }, { status });
  }
}
