import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearCustomerSessionAuthCache } from "@/lib/api-auth";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { deleteCustomerSessionRelational } from "@/lib/stores/customer-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const cookieName = customerSessionCookie(siteId);
  let cleanupError: string | undefined;
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(cookieName)?.value;
    if (sessionId) {
      clearCustomerSessionAuthCache(siteId, undefined, sessionId);
      await deleteCustomerSessionRelational(sessionId);
    }
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : "customer_logout_cleanup_failed";
  }
  const response = NextResponse.json({ ok: true, ...(cleanupError ? { warning: "customer_logout_cleanup_failed" } : {}) });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    expires: new Date(0)
  });
  return response;
}
