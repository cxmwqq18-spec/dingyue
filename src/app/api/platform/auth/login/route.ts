import { NextResponse } from "next/server";
import { StoreError } from "@/lib/server-store";
import { platformSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import { createPlatformAdminSessionRelational } from "@/lib/stores/platform-store";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.login, `platform:${request.headers.get("x-forwarded-for") ?? "local"}`);
  if (!limited.allowed) return limited.response;
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "missing_email_or_password" }, { status: 400 });
  }

  try {
    const result = await createPlatformAdminSessionRelational({ email: body.email, password: body.password });
    const response = NextResponse.json({
      ok: true,
      platformAdmin: result.platformAdmin,
      note: "Platform password verified and platform-scoped session created."
    });
    response.cookies.set(platformSessionCookie(), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    setCsrfCookie(response, "platform", result.session.id, result.session.expiresAt, request);
    return response;
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "platform_login_failed" }, { status });
  }
}
