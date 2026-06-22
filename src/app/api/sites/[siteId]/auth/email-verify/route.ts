import { NextResponse } from "next/server";
import { verifyCustomerEmailCode } from "@/lib/customer-email-auth";
import { StoreError, readPlatformState } from "@/lib/server-store";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.login, `customer-email-verify:${siteId}:${request.headers.get("x-forwarded-for") ?? "local"}`);
  if (!limited.allowed) return limited.response;

  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string; name?: string };
  if (!body.email || !body.code) return NextResponse.json({ error: "missing_email_or_code" }, { status: 400 });

  try {
    const state = readPlatformState({ fresh: true });
    const site = state.sites.find((item) => item.id === siteId);
    if (!site) return NextResponse.json({ error: "site_not_found" }, { status: 404 });
    const result = await verifyCustomerEmailCode({ site, email: body.email, code: body.code, name: body.name });
    const response = NextResponse.json({
      ok: true,
      customer: result.customer,
      createdCustomer: result.createdCustomer
    });
    response.cookies.set(customerSessionCookie(siteId), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    setCsrfCookie(response, `customer:${siteId}`, result.session.id, result.session.expiresAt, request);
    return response;
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "email_code_verify_failed" }, { status });
  }
}
