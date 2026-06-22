import { NextResponse } from "next/server";
import { StoreError } from "@/lib/server-store";
import { publicUrlForRequest, shouldUseSecureCookie, siteAdminSessionCookie } from "@/lib/session";
import { setCsrfCookie } from "@/lib/security/csrf";
import { createSiteAdminSessionRelational, getSiteBySlugRelational } from "@/lib/stores/site-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const site = await getSiteBySlugRelational(siteSlug);
  if (!site) return NextResponse.redirect(publicUrlForRequest(request, "/"), 303);

  const form = await request.formData();
  try {
    const result = await createSiteAdminSessionRelational({
      siteId: site.id,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? "")
    });
    const response = NextResponse.redirect(publicUrlForRequest(request, `/site/${site.slug}/admin`), 303);
    response.cookies.set(siteAdminSessionCookie(site.id), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookie(request),
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    setCsrfCookie(response, `site-admin:${site.id}`, result.session.id, result.session.expiresAt, request);
    return response;
  } catch (error) {
    const code = error instanceof StoreError ? error.message : "site_admin_login_failed";
    return NextResponse.redirect(publicUrlForRequest(request, `/site/${site.slug}/admin/login?error=${encodeURIComponent(code)}`), 303);
  }
}
