import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { deleteCustomerSessionRelational } from "@/lib/stores/customer-store";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import { getSiteBySlugForPublicAuth } from "@/lib/stores/site-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const site = await getSiteBySlugForPublicAuth(siteSlug);
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);

  const cookieName = customerSessionCookie(site.id);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (sessionId) {
    try {
      await deleteCustomerSessionRelational(sessionId);
    } catch (error) {
      if (!shouldFallbackRelationalRead(error)) throw error;
      warnRelationalFallback("customer logout session cleanup", error);
    }
  }

  const response = NextResponse.redirect(new URL(`/site/${site.slug}/login`, request.url), 303);
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    expires: new Date(0)
  });
  response.cookies.set(`customer_csrf_${site.id}`, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    expires: new Date(0)
  });
  return response;
}
