import { NextResponse } from "next/server";
import { verifyCustomerEmailCode } from "@/lib/customer-email-auth";
import { clearCustomerSessionAuthCache, primeCustomerSessionAuthCache } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.login, `customer-email-verify:${siteId}:${request.headers.get("x-forwarded-for") ?? "local"}`);
  if (!limited.allowed) return limited.response;

  const body = (await request.json().catch(() => ({}))) as { email?: string; code?: string; password?: string; confirmPassword?: string; purpose?: "register" | "password_reset"; name?: string };
  if (!body.email || !body.code) return NextResponse.json({ error: "missing_email_or_code" }, { status: 400 });

  try {
    const result = await verifyCustomerEmailCode({
      siteId,
      email: body.email,
      code: body.code,
      password: body.password,
      confirmPassword: body.confirmPassword,
      purpose: body.purpose,
      name: body.name,
      signupIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      signupUa: request.headers.get("user-agent") ?? undefined
    });
    if (body.purpose === "password_reset") clearCustomerSessionAuthCache(siteId, result.customer.id);
    primeCustomerSessionAuthCache({ customer: result.customer, session: result.session, sessionId: result.session.id });
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
