import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteCustomerSession, readPlatformState } from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) return NextResponse.redirect(new URL("/", request.url), 303);

  const cookieName = customerSessionCookie(site.id);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (sessionId) deleteCustomerSession(sessionId);

  const response = NextResponse.redirect(new URL(`/site/${site.slug}/login`, request.url), 303);
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
  response.cookies.set(`customer_csrf_${site.id}`, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0)
  });
  return response;
}
