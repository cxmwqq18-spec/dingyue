import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteAdminSessionCookie } from "@/lib/session";
import { deleteSiteAdminSessionRelational } from "@/lib/stores/site-store";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const cookieName = siteAdminSessionCookie(siteId);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (sessionId) {
    await deleteSiteAdminSessionRelational(sessionId);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}
