import { NextResponse } from "next/server";
import { hasCustomerSession } from "@/lib/api-auth";
import { createGenerationJob, StoreError, toPublicCustomer } from "@/lib/server-store";
import { buildWorkerPayload } from "@/lib/worker";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    customerId?: string;
    aiAppSlug?: string;
    params?: Record<string, unknown>;
  };
  if (!body.customerId || !body.aiAppSlug) {
    return NextResponse.json({ error: "missing_customer_or_ai_app" }, { status: 400 });
  }
  if (!(await hasCustomerSession(siteId, body.customerId))) {
    return NextResponse.json({ error: "customer_login_required" }, { status: 401 });
  }
  const baseUrl = new URL(request.url).origin;
  try {
    const { job, siteAiApp, ledger, customer } = createGenerationJob({
      siteId,
      customerId: body.customerId,
      aiAppSlug: body.aiAppSlug,
      requestJson: {
        ...(body.params ?? {}),
        creativePackId: typeof body.params?.creativePackId === "string" ? body.params.creativePackId : undefined,
        customerModelId: typeof body.params?.customerModelId === "string" ? body.params.customerModelId : undefined
      }
    });
    return NextResponse.json({
      ok: true,
      job,
      customer: toPublicCustomer(customer),
      customerBalance: customer.balance,
      ledgerAction: ledger,
      workerPayload: buildWorkerPayload({ job, siteAiApp, baseUrl }),
      note: "Persisted job and reserved credits before worker dispatch."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "job_create_failed" }, { status });
  }
}
