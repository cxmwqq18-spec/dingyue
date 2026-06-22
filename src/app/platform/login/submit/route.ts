import { NextResponse } from "next/server";
import { createPlatformAdminSession, StoreError } from "@/lib/server-store";
import { platformSessionCookie, publicUrlForRequest, shouldUseSecureCookie } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  try {
    const result = createPlatformAdminSession({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "")
    });
    const response = NextResponse.redirect(publicUrlForRequest(request, "/platform"), 303);
    response.cookies.set(platformSessionCookie(), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const code = error instanceof StoreError ? error.message : "platform_login_failed";
    return NextResponse.redirect(publicUrlForRequest(request, `/platform/login?error=${encodeURIComponent(code)}`), 303);
  }
}
