import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { RATE_LIMITS, checkRateLimitOrResponse } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import { createCreditApplicationRelational } from "@/lib/stores/credit-application-store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.register, `${siteId}:credit:${request.headers.get("x-forwarded-for") ?? "unknown"}`);
  if (!limited.allowed) return limited.response;

  const current = await getCurrentCustomerForSite(siteId);
  if (!current) return NextResponse.json({ error: "customer_login_required" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";
  const form = contentType.includes("application/json") ? undefined : await request.formData().catch(() => undefined);
  const body = form
    ? Object.fromEntries(Array.from(form.entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name]))
    : (await request.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.website_url === "string" && body.website_url.trim()) {
    return NextResponse.json({ ok: true });
  }
  const evidencePosts = form
    ? Array.from(form.getAll("evidencePosts")).map((value) => String(value)).filter((value) => value.trim())
    : Array.isArray(body.evidencePosts)
      ? body.evidencePosts.map(String)
      : typeof body.evidencePosts === "string"
        ? [body.evidencePosts]
        : [];

  try {
    const result = await createCreditApplicationRelational({
      siteId,
      customerId: current.customer.id,
      platform: String(body.platform ?? ""),
      profileUrl: String(body.profileUrl ?? ""),
      followerTier: String(body.followerTier ?? ""),
      evidencePosts,
      audience: typeof body.audience === "string" ? body.audience : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
      honeypot: typeof body.website_url === "string" ? body.website_url : undefined,
      submitIp: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      submitUa: request.headers.get("user-agent") ?? undefined
    });
    if (!contentType.includes("application/json")) {
      const referer = request.headers.get("referer");
      if (referer) return NextResponse.redirect(new URL(`${referer}${referer.includes("?") ? "&" : "?"}credits=applied`, request.url), 303);
    }
    return NextResponse.json({ ok: true, application: { id: result.application.id, status: result.application.status, createdAt: result.application.createdAt } }, { status: 201 });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "credit_application_submit_failed" }, { status });
  }
}
