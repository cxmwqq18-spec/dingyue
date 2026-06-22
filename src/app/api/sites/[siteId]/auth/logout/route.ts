import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { customerSessionCookie, shouldUseSecureCookie } from "@/lib/session";
import { deleteCustomerSessionRelational } from "@/lib/stores/customer-store";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const cookieName = customerSessionCookie(siteId);
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(cookieName)?.value;
  if (sessionId) {
    await deleteCustomerSessionRelational(sessionId);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    path: "/",
    expires: new Date(0)
  });
  return response;
}
