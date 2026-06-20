import { NextResponse } from "next/server";
import { createCustomerSession, readPlatformState, StoreError } from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);

  const form = await request.formData();
  try {
    const result = createCustomerSession({
      siteId: site.id,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
      name: String(form.get("name") ?? "")
    });
    const response = NextResponse.redirect(new URL(`/site/${site.slug}/app`, request.url), 303);
    response.cookies.set(customerSessionCookie(site.id), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const code = error instanceof StoreError ? error.message : "customer_login_failed";
    return NextResponse.redirect(new URL(`/site/${site.slug}/login?error=${encodeURIComponent(code)}`, request.url), 303);
  }
}
