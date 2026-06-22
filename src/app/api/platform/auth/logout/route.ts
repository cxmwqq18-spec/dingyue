import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { platformSessionCookie } from "@/lib/session";
import { deletePlatformAdminSessionRelational } from "@/lib/stores/platform-store";

export async function POST() {
  const cookieName = platformSessionCookie();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (sessionId) {
    await deletePlatformAdminSessionRelational(sessionId);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}
