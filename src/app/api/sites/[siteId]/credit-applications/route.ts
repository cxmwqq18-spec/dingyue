import { NextResponse, type NextRequest } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { RATE_LIMITS, checkRateLimitOrResponse, getClientIP } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import { createCreditApplicationRelational } from "@/lib/stores/credit-application-store";

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.register, `${siteId}:credit:${getClientIP(request)}`);
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
      submitIp: getClientIP(request),
      submitUa: request.headers.get("user-agent") ?? undefined
    });
    if (!contentType.includes("application/json")) {
      return formRedirect(request, "credits=applied");
    }
    return NextResponse.json({ ok: true, application: { id: result.application.id, status: result.application.status, createdAt: result.application.createdAt } }, { status: 201 });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    const code = error instanceof Error ? error.message : "credit_application_submit_failed";
    if (!contentType.includes("application/json") && error instanceof StoreError) {
      const flag = formErrorFlags[code];
      if (flag) return formRedirect(request, `credits=${flag}`);
    }
    return NextResponse.json({ error: code }, { status });
  }
}

// A native form submission must never land on a bare JSON body, so the states
// a creator can fix themselves come back to the page as a flag.
const formErrorFlags: Record<string, string> = {
  credit_application_already_applied: "duplicate",
  credit_application_already_approved: "duplicate",
  credit_application_ip_rate_limited: "limited",
  credit_application_post_already_used: "duplicate",
  credit_application_invalid_platform: "invalid",
  credit_application_invalid_follower_tier: "invalid",
  credit_application_profile_url_required: "invalid",
  credit_application_evidence_required: "invalid",
  credit_application_disposable_email: "invalid"
};

/**
 * Land a native form submission back on the partner page.
 *
 * The browser form post normally carries a Referer, but privacy settings and
 * automation can drop it, and a missing Referer used to produce a bare JSON
 * page with no way back into the product.
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
  target.searchParams.delete("credits");
  target.searchParams.append("credits", query.slice("credits=".length));
  target.hash = "";
  return NextResponse.redirect(target, 303);
}
