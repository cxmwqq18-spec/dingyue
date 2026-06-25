import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearSiteAdminSessionAuthCache } from "@/lib/api-auth";
import { siteAdminSessionCookie } from "@/lib/session";
import { deleteSiteAdminSessionRelational } from "@/lib/stores/site-store";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const cookieName = siteAdminSessionCookie(siteId);
  let cleanupError: string | undefined;
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(cookieName)?.value;
    if (sessionId) {
      clearSiteAdminSessionAuthCache(siteId, sessionId);
      await deleteSiteAdminSessionRelational(sessionId);
    }
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : "site_admin_logout_cleanup_failed";
  }
  const response = NextResponse.json({ ok: true, ...(cleanupError ? { warning: "site_admin_logout_cleanup_failed" } : {}) });
  response.cookies.delete(cookieName);
  return response;
}
