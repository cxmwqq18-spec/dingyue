import { NextResponse, type NextRequest } from "next/server";
import { RATE_LIMITS, checkRateLimitOrResponse, getClientIP } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import { createPartnerApplicationRelational } from "@/lib/stores/partner-application-store";

// Native form posts bounce back to the page with a flag instead of raw JSON;
// JSON callers keep the error body. Validation problems map to one `invalid`
// state so a browser submission always ends on a page with a next step.
const formDataErrorFlags: Record<string, string> = {
  partner_application_already_applied: "duplicate",
  partner_application_ip_rate_limited: "limited",
  invalid_partner_email: "invalid",
  partner_name_required: "invalid",
  partner_audience_required: "invalid",
  partner_channel_required: "invalid"
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const ip = getClientIP(request);
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.register, `${siteId}:partner:${ip}`);
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
      return formRedirect(request, "partner=success");
    }
    return NextResponse.json({ ok: true, application: result.receipt });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    const code = error instanceof Error ? error.message : "partner_application_submit_failed";
    if (!contentType.includes("application/json") && error instanceof StoreError) {
      const flag = formDataErrorFlags[code];
      if (flag) return formRedirect(request, `partner=${flag}`);
    }
    return NextResponse.json({ error: code }, { status });
  }
}

/**
 * Send a native form submission back to the partner page with a state flag.
 *
 * A browser form post normally carries a Referer, but referrer policy, privacy
 * settings and automation can drop it, and the earlier fallback answered those
 * submissions with a bare `{"ok":true}` page. Always land on a real page instead.
 */
function formRedirect(request: NextRequest, query: string): NextResponse {
  const referer = request.headers.get("referer");
  let target: URL;
  try {
    const origin = new URL(request.url).origin;
    const fromReferer = referer ? new URL(referer) : null;
    target = new URL(fromReferer && fromReferer.origin === origin ? fromReferer : new URL("/partners", origin));
  } catch {
    target = new URL("/partners", request.url);
  }
  target.searchParams.delete("partner");
  target.searchParams.append("partner", query.slice("partner=".length));
  target.hash = "";
  return NextResponse.redirect(target, 303);
}
