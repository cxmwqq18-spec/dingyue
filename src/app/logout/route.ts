import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearCustomerSessionAuthCache } from "@/lib/api-auth";
import { cleanHost, getSiteByHostCandidatesFromState } from "@/lib/domain-routing";
import { customerSessionCookie, publicUrlForRequest, shouldUseSecureCookie } from "@/lib/session";
import { deleteCustomerSessionRelational } from "@/lib/stores/customer-store";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import { readStorefrontPlatformStateFromDatabase } from "@/lib/storefront-state";

async function logoutForHost(request: Request) {
  const rawHostCandidates = [request.headers.get("x-forwarded-host"), request.headers.get("host")];
  const hostCandidates = Array.from(new Set(rawHostCandidates.flatMap((host) => {
    const value = cleanHost(host);
    if (!value) return [];
    const counterpart = value.startsWith("www.") ? value.slice(4) : `www.${value}`;
    return [host, value, counterpart];
  })));
  const state = await readStorefrontPlatformStateFromDatabase();
  const site = getSiteByHostCandidatesFromState(state, hostCandidates);
  if (!site) return NextResponse.redirect(publicUrlForRequest(request, "/"), 303);

  const cookieName = customerSessionCookie(site.id);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (sessionId) {
    try {
      clearCustomerSessionAuthCache(site.id, undefined, sessionId);
      await deleteCustomerSessionRelational(sessionId);
    } catch (error) {
      if (!shouldFallbackRelationalRead(error)) throw error;
      warnRelationalFallback("host customer logout session cleanup", error);
    }
  }

  const response = NextResponse.redirect(publicUrlForRequest(request, "/login"), 303);
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

export async function GET(request: Request) {
  return logoutForHost(request);
}

export async function POST(request: Request) {
  return logoutForHost(request);
}
