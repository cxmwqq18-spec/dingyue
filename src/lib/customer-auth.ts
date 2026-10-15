import { NextResponse } from "next/server";
import { StoreError } from "@/lib/server-store";
import { customerSessionCookie, publicUrlForRequest, shouldUseSecureCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";
import { createExistingCustomerSessionRelational } from "@/lib/stores/customer-store";
import type { Site } from "@/lib/types";

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return ["P1001", "P1008", "P1017", "P2024", "P2028"].includes(code);
}

export async function handleCustomerLoginForm(request: Request, site: Site, successPath: string, failurePath: string) {
  const form = await request.formData();
  if (!form.get("email") || !form.get("password")) {
    return NextResponse.redirect(publicUrlForRequest(request, `${failurePath}?error=${encodeURIComponent("missing_email_or_password")}`), 303);
  }
  try {
    const result = await createExistingCustomerSessionRelational({
      siteId: site.id,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "")
    });
    const response = NextResponse.redirect(publicUrlForRequest(request, successPath), 303);
    response.cookies.set(customerSessionCookie(site.id), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    setCsrfCookie(response, `customer:${site.id}`, result.session.id, result.session.expiresAt, request);
    return response;
  } catch (error) {
    const code = error instanceof StoreError
      ? error.message
      : isDatabaseUnavailableError(error)
        ? "database_unavailable"
        : "customer_login_failed";
    return NextResponse.redirect(publicUrlForRequest(request, `${failurePath}?error=${encodeURIComponent(code)}`), 303);
  }
}
