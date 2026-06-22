import { NextResponse } from "next/server";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { updateCustomerModelRelational } from "@/lib/stores/asset-store";
import type { CustomerModel } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ siteId: string; modelId: string }> }
) {
  const { siteId, modelId } = await params;
  if (!(await hasSiteAdminSession(siteId))) {
    return NextResponse.json({ error: "site_admin_login_required" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as Partial<CustomerModel>;
  try {
    const result = await updateCustomerModelRelational({
      siteId,
      modelId,
      status: body.status ?? "collecting_uploads",
      providerModelId: body.providerModelId,
      failureReason: body.failureReason,
      inputAssetCount: body.inputAssetCount
    });
    return NextResponse.json({ ok: true, model: result.model });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "customer_model_update_failed" }, { status });
  }
}
