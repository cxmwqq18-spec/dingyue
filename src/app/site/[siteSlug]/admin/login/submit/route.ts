import { NextResponse } from "next/server";
import { createSiteAdminSession, readPlatformState, StoreError } from "@/lib/server-store";
import { shouldUseSecureCookie, siteAdminSessionCookie } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);

  const form = await request.formData();
  try {
    const result = createSiteAdminSession({
      siteId: site.id,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "")
    });
    const response = NextResponse.redirect(new URL(`/site/${site.slug}/admin`, request.url), 303);
    response.cookies.set(siteAdminSessionCookie(site.id), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const code = error instanceof StoreError ? error.message : "site_admin_login_failed";
    return NextResponse.redirect(new URL(`/site/${site.slug}/admin/login?error=${encodeURIComponent(code)}`, request.url), 303);
  }
}
