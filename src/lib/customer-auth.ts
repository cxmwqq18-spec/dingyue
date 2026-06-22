import { NextResponse } from "next/server";
import { StoreError } from "@/lib/server-store";
import { customerSessionCookie, publicUrlForRequest, shouldUseSecureCookie } from "@/lib/session";
import { createCustomerSessionRelational } from "@/lib/stores/customer-store";
import type { Site } from "@/lib/types";

export async function handleCustomerLoginForm(request: Request, site: Site, successPath: string, failurePath: string) {
  const form = await request.formData();
  if (!form.get("password")) {
    return NextResponse.redirect(publicUrlForRequest(request, `${failurePath}?error=${encodeURIComponent("missing_email_or_code")}`), 303);
  }
  try {
    const result = await createCustomerSessionRelational({
      siteId: site.id,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      name: String(form.get("name") ?? "")
    });
    const response = NextResponse.redirect(publicUrlForRequest(request, successPath), 303);
    response.cookies.set(customerSessionCookie(site.id), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const code = error instanceof StoreError ? error.message : "customer_login_failed";
    return NextResponse.redirect(publicUrlForRequest(request, `${failurePath}?error=${encodeURIComponent(code)}`), 303);
  }
}
