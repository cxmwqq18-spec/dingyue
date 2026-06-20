import { NextResponse } from "next/server";
import { createCustomerSession, StoreError } from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = (await request.json().catch(() => ({}))) as { email?: string; password?: string; name?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "missing_email_or_password" }, { status: 400 });
  }

  try {
    const result = createCustomerSession({ siteId, email: body.email, password: body.password, name: body.name });
    const response = NextResponse.json({
      ok: true,
      customer: result.customer,
      createdCustomer: result.createdCustomer,
      note: result.createdCustomer
        ? "Customer account created for this site with a password-backed session."
        : "Customer password verified and site-scoped session created."
    });
    response.cookies.set(customerSessionCookie(siteId), result.session.id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      expires: new Date(result.session.expiresAt)
    });
    return response;
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "login_failed" }, { status });
  }
}
