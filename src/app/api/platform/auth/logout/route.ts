import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { platformSessionCookie } from "@/lib/session";
import { clearPlatformSessionAuthCache } from "@/lib/api-auth";
import { deletePlatformAdminSessionRelational } from "@/lib/stores/platform-store";

export async function POST() {
  const cookieName = platformSessionCookie();
  let cleanupError: string | undefined;
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get(cookieName)?.value;
    if (sessionId) {
      clearPlatformSessionAuthCache(sessionId);
      await deletePlatformAdminSessionRelational(sessionId);
    }
  } catch (error) {
    cleanupError = error instanceof Error ? error.message : "platform_logout_cleanup_failed";
  }
  const response = NextResponse.json({ ok: true, ...(cleanupError ? { warning: "platform_logout_cleanup_failed" } : {}) });
  response.cookies.delete(cookieName);
  return response;
}
