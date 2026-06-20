import { NextResponse } from "next/server";
import { createPlatformAdminSession, StoreError } from "@/lib/server-store";
import { platformSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "missing_email_or_password" }, { status: 400 });
  }

  try {
    const result = createPlatformAdminSession({ email: body.email, password: body.password });
    const response = NextResponse.json({
      ok: true,
      platformAdmin: result.platformAdmin,
      note: "Platform password verified and platform-scoped session created."
    });
    response.cookies.set(platformSessionCookie(), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "platform_login_failed" }, { status });
  }
}
