import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearCustomerSessionAuthCache } from "@/lib/api-auth";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { deleteCustomerSessionRelational } from "@/lib/stores/customer-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const cookieName = customerSessionCookie(siteId);
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(cookieName)?.value;
    if (sessionId) {
      clearCustomerSessionAuthCache(siteId, undefined, sessionId);
      void deleteCustomerSessionRelational(sessionId).catch(() => undefined);
    }
  } catch {
    // Cookie clearing below is the user-visible logout guarantee. Session cleanup is best-effort.
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    expires: new Date(0)
  });
  response.cookies.set(`customer_csrf_${siteId}`, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    expires: new Date(0)
  });
  return response;
}
