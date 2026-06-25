import { NextResponse } from "next/server";
import { primeSiteAdminSessionAuthCache } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { shouldUseSecureCookie, siteAdminSessionCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSiteAdminSessionRelational } from "@/lib/stores/site-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.login, `site-admin:${siteId}:${request.headers.get("x-forwarded-for") ?? "local"}`);
  if (!limited.allowed) return limited.response;
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "missing_email_or_password" }, { status: 400 });
  }

  try {
    const result = await createSiteAdminSessionRelational({ siteId, email: body.email, password: body.password });
    primeSiteAdminSessionAuthCache({
      siteAdmin: result.siteAdmin,
      session: result.session,
      sessionId: result.session.id
    });
    const response = NextResponse.json({
      ok: true,
      siteAdmin: result.siteAdmin,
      note: "Site admin password verified and site-scoped admin session created."
    });
    response.cookies.set(siteAdminSessionCookie(siteId), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    setCsrfCookie(response, `site-admin:${siteId}`, result.session.id, result.session.expiresAt, request);
    return response;
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "site_admin_login_failed" }, { status });
  }
}
