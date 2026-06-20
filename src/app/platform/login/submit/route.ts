import { NextResponse } from "next/server";
import { createPlatformAdminSession, StoreError } from "@/lib/server-store";
import { platformSessionCookie } from "@/lib/session";

export async function POST(request: Request) {
  const form = await request.formData();
  try {
    const result = createPlatformAdminSession({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "")
    });
    const response = NextResponse.redirect(new URL("/platform", request.url), 303);
    response.cookies.set(platformSessionCookie(), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const code = error instanceof StoreError ? error.message : "platform_login_failed";
    return NextResponse.redirect(new URL(`/platform/login?error=${encodeURIComponent(code)}`, request.url), 303);
  }
}
