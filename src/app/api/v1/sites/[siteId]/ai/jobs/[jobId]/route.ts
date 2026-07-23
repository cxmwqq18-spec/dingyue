import { NextRequest, NextResponse } from "next/server";
import { StoreError } from "@/lib/server-store";
import { requireSiteApiKey } from "@/lib/site-api-keys";
import { getGenerationJobForCustomerRelational } from "@/lib/stores/job-store";

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string; jobId: string }> }) {
  const { siteId, jobId } = await params;
  const auth = await requireSiteApiKey(request, { siteId, scope: "generation:read" });
  if ("response" in auth) return auth.response;
  const customerId = new URL(request.url).searchParams.get("customerId")?.trim();
  if (!customerId) return NextResponse.json({ error: "customer_id_required" }, { status: 400 });
  try {
    const result = await getGenerationJobForCustomerRelational({ siteId, customerId, jobId });
    const resultJson = result.job.resultJson ?? {};
    return NextResponse.json({
      ok: true,
      job: result.job,
      outputs: Array.isArray(resultJson.outputs) ? resultJson.outputs : [],
      providerTrace: Array.isArray(resultJson.providerTrace) ? resultJson.providerTrace : [],
      billingSettlement: resultJson.billingSettlement ?? null,
      error: typeof resultJson.error === "string" ? resultJson.error : null
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "external_generation_read_failed" }, { status });
  }
}
