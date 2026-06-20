import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deletePlatformAdminSession } from "@/lib/server-store";
import { platformSessionCookie } from "@/lib/session";

export async function POST() {
  const cookieName = platformSessionCookie();
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (sessionId) {
    deletePlatformAdminSession(sessionId);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}
