import { NextResponse } from "next/server";
import { verifyCustomerEmailCode } from "@/lib/customer-email-auth";
import { StoreError } from "@/lib/server-store";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.login, `customer-email-verify:${siteId}:${request.headers.get("x-forwarded-for") ?? "local"}`);
  if (!limited.allowed) return limited.response;

  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string; password?: string; purpose?: "register" | "password_reset"; name?: string };
  if (!body.email || !body.code) return NextResponse.json({ error: "missing_email_or_code" }, { status: 400 });

  try {
    const result = await verifyCustomerEmailCode({ siteId, email: body.email, code: body.code, password: body.password, purpose: body.purpose, name: body.name });
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
