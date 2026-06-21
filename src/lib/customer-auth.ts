import { NextResponse } from "next/server";
import { createCustomerSession, StoreError } from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import type { Site } from "@/lib/types";

export async function handleCustomerLoginForm(request: Request, site: Site, successPath: string, failurePath: string) {
  const form = await request.formData();
  try {
    const result = createCustomerSession({
      siteId: site.id,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      name: String(form.get("name") ?? "")
    });
    const response = NextResponse.redirect(new URL(successPath, request.url), 303);
    response.cookies.set(customerSessionCookie(site.id), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const code = error instanceof StoreError ? error.message : "customer_login_failed";
    return NextResponse.redirect(new URL(`${failurePath}?error=${encodeURIComponent(code)}`, request.url), 303);
  }
}
