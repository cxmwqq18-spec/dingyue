import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createGenerationJobRelational } from "@/lib/stores/job-store";
import { buildWorkerPayload } from "@/lib/worker";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    customerId?: string;
    aiAppSlug?: string;
    params?: Record<string, unknown> & { assetIds?: unknown };
  };
  if (!body.customerId || !body.aiAppSlug) {
    return NextResponse.json({ error: "missing_customer_or_ai_app" }, { status: 400 });
  }
  const guard = await requireCustomerMutation(request, siteId, body.customerId, { rateLimit: RATE_LIMITS.generation, key: `${siteId}:${body.customerId}:jobs` });
  if (!guard.ok) return guard.response;
  const baseUrl = new URL(request.url).origin;
  try {
    const { job, siteAiApp, ledger, customer } = await createGenerationJobRelational({
      siteId,
      customerId: body.customerId,
      aiAppSlug: body.aiAppSlug,
      requestJson: {
        ...(body.params ?? {}),
        assetIds: Array.isArray(body.params?.assetIds) ? body.params.assetIds.filter((item): item is string => typeof item === "string") : [],
        creativePackId: typeof body.params?.creativePackId === "string" ? body.params.creativePackId : undefined,
        customerModelId: typeof body.params?.customerModelId === "string" ? body.params.customerModelId : undefined
      }
    });
    return NextResponse.json({
      ok: true,
      job,
      customer,
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
