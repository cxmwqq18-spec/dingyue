import { NextResponse } from "next/server";
import { primeCustomerSessionAuthCache } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createExistingCustomerSessionRelational } from "@/lib/stores/customer-store";
import type { NextRequest } from "next/server";

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return ["P1001", "P1008", "P1017", "P2024", "P2028"].includes(code);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.login, `customer:${siteId}:${request.headers.get("x-forwarded-for") ?? "local"}`);
  if (!limited.allowed) return limited.response;
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; name?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "missing_email_or_password" }, { status: 400 });
  }

  try {
    const result = await createExistingCustomerSessionRelational({ siteId, email: body.email, password: body.password });
    primeCustomerSessionAuthCache({ customer: result.customer, session: result.session, sessionId: result.session.id });
    const response = NextResponse.json({
      ok: true,
      customer: result.customer,
      createdCustomer: result.createdCustomer,
      note: "Customer password verified and site-scoped session created."
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
    const databaseUnavailable = isDatabaseUnavailableError(error);
    const status = error instanceof StoreError ? error.status : databaseUnavailable ? 503 : 500;
    const code = error instanceof StoreError ? error.message : databaseUnavailable ? "database_unavailable" : "customer_login_failed";
    return NextResponse.json({ error: code }, { status });
  }
}
