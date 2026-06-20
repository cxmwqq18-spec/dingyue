import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteCustomerSession } from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const cookieName = customerSessionCookie(siteId);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (sessionId) {
    deleteCustomerSession(sessionId);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(cookieName);
  return response;
}
