import { NextResponse } from "next/server";
import { clearCustomerSessionAuthCache, getCurrentCustomerForSite, requireCustomerMutation } from "@/lib/api-auth";
import { clearCustomerRuntimeApiCacheForSessions } from "@/lib/customer-runtime-api-cache";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { StoreError } from "@/lib/server-store";
import { updateCustomerSelfPasswordRelational } from "@/lib/stores/customer-profile-store";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const current = await getCurrentCustomerForSite(siteId);
  if (!current) return NextResponse.json({ ok: false, error: "customer_login_required" }, { status: 401 });
  const guard = await requireCustomerMutation(request, siteId, current.customer.id, { key: `${siteId}:${current.customer.id}:password-update` });
  if (!guard.ok) return guard.response;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };
    const result = await updateCustomerSelfPasswordRelational({
      siteId,
      customerId: current.customer.id,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword
    });
    clearCustomerSessionAuthCache(siteId, current.customer.id);
    clearCustomerRuntimeApiCacheForSessions(siteId, result.deletedSessionIds.length ? result.deletedSessionIds : [current.sessionId]);
    const response = NextResponse.json({ ok: true, reauthRequired: true });
    response.cookies.set(customerSessionCookie(siteId), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(0)
    });
    response.cookies.set(`customer_csrf_${siteId}`, "", {
      httpOnly: false,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(0)
    });
    return response;
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "password_update_failed" }, { status });
  }
}
