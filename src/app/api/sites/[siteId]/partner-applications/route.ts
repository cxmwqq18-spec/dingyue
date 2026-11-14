import { NextResponse, type NextRequest } from "next/server";
import { RATE_LIMITS, checkRateLimitOrResponse } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import { createPartnerApplicationRelational } from "@/lib/stores/partner-application-store";

// Native form posts bounce back to the page with a flag instead of raw JSON;
// JSON callers keep the error body.
const formDataErrorFlags: Record<string, string> = {
  partner_application_already_applied: "duplicate",
  partner_application_ip_rate_limited: "limited"
};

/** First real client IP: Cloudflare's injected header, else the first XFF hop. */
function clientIp(request: NextRequest): string | undefined {
  const direct = request.headers.get("cf-connecting-ip")?.trim();
  if (direct) return direct.slice(0, 64);
  const first = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first ? first.slice(0, 64) : undefined;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ip = clientIp(request);
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.register, `${siteId}:partner:${ip ?? request.headers.get("x-forwarded-for") ?? "unknown"}`);
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
      source: typeof body.source === "string" ? body.source : undefined,
      submitIp: ip,
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
    const code = error instanceof Error ? error.message : "partner_application_submit_failed";
    if (!contentType.includes("application/json") && error instanceof StoreError) {
      const flag = formDataErrorFlags[code];
      const referer = request.headers.get("referer");
      if (flag && referer) return NextResponse.redirect(new URL(`${referer}${referer.includes("?") ? "&" : "?"}partner=${flag}`, request.url), 303);
    }
    return NextResponse.json({ error: code }, { status });
  }
}
