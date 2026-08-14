import { NextResponse } from "next/server";
import { clearCustomerSessionAuthCache, getCurrentCustomerForSite, requireCustomerMutation } from "@/lib/api-auth";
import { clearCustomerRuntimeApiCacheForSessions } from "@/lib/customer-runtime-api-cache";
import { StoreError } from "@/lib/server-store";
import { updateCustomerSelfProfileRelational } from "@/lib/stores/customer-profile-store";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const current = await getCurrentCustomerForSite(siteId);
  if (!current) return NextResponse.json({ ok: false, error: "customer_login_required" }, { status: 401 });
  const guard = await requireCustomerMutation(request, siteId, current.customer.id, { key: `${siteId}:${current.customer.id}:profile-update` });
  if (!guard.ok) return guard.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { name?: unknown; avatarAssetId?: unknown };
    const result = await updateCustomerSelfProfileRelational({
      siteId,
      customerId: current.customer.id,
      name: body.name,
      avatarAssetId: typeof body.avatarAssetId === "string" ? body.avatarAssetId : body.avatarAssetId === null ? null : undefined
    });
    clearCustomerSessionAuthCache(siteId, current.customer.id, current.sessionId);
    clearCustomerRuntimeApiCacheForSessions(siteId, [current.sessionId]);
    return NextResponse.json({ ok: true, customer: result.customer, profile: result.customer.profile });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "profile_update_failed" }, { status });
  }
}
