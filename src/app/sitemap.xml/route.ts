import { getStorefrontSitemapPayloadForHost } from "@/lib/seo-indexing";
import { sitemapXml } from "@/lib/sitemap-xml";

export const dynamic = "force-dynamic";

const SITEMAP_CACHE_CONTROL = "public, max-age=300, s-maxage=900, stale-while-revalidate=86400";
const SITEMAP_CDN_CACHE_CONTROL = "public, s-maxage=900, stale-while-revalidate=86400";

function isGrownstrideHost(value: string | null | undefined): boolean {
  const host = String(value ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  return host === "grownstride.com" || host === "www.grownstride.com" || host === "test.grownstride.com";
}

function isNonProductionHost(value: string | null | undefined): boolean {
  const host = String(value ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  return /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(host)
    || /(?:^|\.)(?:localhost)$/i.test(host)
    || /(?:^|[.-])(staging|preview)(?:[.-]|$)/i.test(host);
}

function isAidreamcapesHost(value: string | null | undefined): boolean {
  const host = String(value ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  return host === "www.aivideosugc.com"
    || host === "aivideosugc.com"
    || host === "www.aidreamcapes.com"
    || host === "aidreamcapes.com";
}

export async function GET(request: Request): Promise<Response> {
  const host = request.headers.get("host");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const localOrStaging = [forwardedHost, host].some(isNonProductionHost);
  const payload = await getStorefrontSitemapPayloadForHost([forwardedHost, host]);
  if (!payload.resolved) {
    return new Response("Sitemap temporarily unavailable\n", {
      status: 503,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
        "retry-after": "60",
        "vary": "Host, X-Forwarded-Host",
        ...(localOrStaging ? { "x-robots-tag": "noindex, nofollow" } : {})
      }
    });
  }

  // Google ignores changefreq and priority, and both are guesses rather than
  // measured signals. Aidreamcapes stops publishing them; other stores keep
  // their existing sitemap bytes unchanged.
  const shedLegacyHints = isAidreamcapesHost(forwardedHost) || isAidreamcapesHost(host);
  const entries = shedLegacyHints
    ? payload.entries.map((entry) => {
        const next = { ...entry };
        delete next.changefreq;
        delete next.priority;
        return next;
      })
    : payload.entries;

  return new Response(sitemapXml(entries), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": SITEMAP_CACHE_CONTROL,
      "cdn-cache-control": SITEMAP_CDN_CACHE_CONTROL,
      "cloudflare-cdn-cache-control": SITEMAP_CDN_CACHE_CONTROL,
      "vary": "Host, X-Forwarded-Host, RSC, Next-Router-State-Tree, Next-Router-Prefetch, Next-Router-Segment-Prefetch",
      ...(isGrownstrideHost(forwardedHost) || isGrownstrideHost(host) || localOrStaging
        ? { "x-robots-tag": "noindex, nofollow" }
        : {})
    }
  });
}

export async function HEAD(request: Request): Promise<Response> {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
