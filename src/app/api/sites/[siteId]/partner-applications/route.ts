import { NextResponse, type NextRequest } from "next/server";
import { RATE_LIMITS, checkRateLimitOrResponse } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import { createPartnerApplicationRelational } from "@/lib/stores/partner-application-store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.register, `${siteId}:partner:${request.headers.get("x-forwarded-for") ?? "unknown"}`);
  if (!limited.allowed) return limited.response;

  const contentType = request.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? (await request.json().catch(() => ({}))) as Record<string, unknown>
    : Object.fromEntries(Array.from((await request.formData()).entries()).map(([key, value]) => [key, typeof value === "string" ? value : value.name]));
  if (typeof body.website_url === "string" && body.website_url.trim()) {
    return NextResponse.json({ ok: true });
  }

  try {
    const result = await createPartnerApplicationRelational({
      siteId,
      name: String(body.name ?? ""),
      email: String(body.email ?? ""),
      company: typeof body.company === "string" ? body.company : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      socialLinks: Array.isArray(body.socialLinks) ? body.socialLinks.map(String) : typeof body.socialLinks === "string" ? [body.socialLinks] : [],
      audience: typeof body.audience === "string" ? body.audience : undefined,
      cadence: typeof body.cadence === "string" ? body.cadence : undefined,
      campaignIdeas: typeof body.campaignIdeas === "string" ? body.campaignIdeas : undefined,
      message: typeof body.message === "string" ? body.message : undefined,
      source: typeof body.source === "string" ? body.source : "partner-registration",
      metadata: {
        userAgent: request.headers.get("user-agent") ?? undefined,
        referer: request.headers.get("referer") ?? undefined
      }
    });
    if (!contentType.includes("application/json")) {
      const referer = request.headers.get("referer");
      if (referer) return NextResponse.redirect(new URL(`${referer}${referer.includes("?") ? "&" : "?"}partner=success`, request.url), 303);
    }
    return NextResponse.json({ ok: true, application: result.receipt });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "partner_application_submit_failed" }, { status });
  }
}
