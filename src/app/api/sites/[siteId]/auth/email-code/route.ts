import { NextResponse } from "next/server";
import { requestCustomerEmailCode } from "@/lib/customer-email-auth";
import { StoreError } from "@/lib/server-store";
import { checkRateLimitOrResponse, RATE_LIMITS } from "@/lib/security/rate-limit";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.register, `customer-email:${siteId}:${request.headers.get("x-forwarded-for") ?? "local"}`);
  if (!limited.allowed) return limited.response;

  const body = (await request.json().catch(() => ({}))) as { email?: string; purpose?: "register" | "password_reset" };
  if (!body.email) return NextResponse.json({ error: "missing_email" }, { status: 400 });

  try {
    const result = await requestCustomerEmailCode({ siteId, email: body.email, purpose: body.purpose });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "email_code_send_failed" }, { status });
  }
}
