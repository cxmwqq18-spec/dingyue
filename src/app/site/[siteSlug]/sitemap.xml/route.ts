import { getStorefrontSitemapPayloadForHost } from "@/lib/seo-indexing";
import { sitemapXml } from "@/lib/sitemap-xml";

type RouteParams = Promise<{ siteSlug: string }>;

const SITE_HOSTS: Record<string, string> = {
  aidreamshoots: "aidreamshoots.eu",
  "aidreamshoots-eu": "aidreamshoots.eu",
  "aidreamcapes-eu": "aidreamcapes.eu",
  aidreamcapes: "aidreamcapes.com",
  mydreamshoots: "mydreamshoots.com",
  grownstride: "grownstride.com"
};

export const dynamic = "force-dynamic";

function hostValue(request: Request, name: string): string {
  return String(request.headers.get(name) ?? "").split(",")[0].trim().toLowerCase();
}

function isNonProductionHost(host: string): boolean {
  const normalized = host.split(":")[0];
  return /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(normalized)
    || /(?:^|\.)(?:localhost)$/i.test(normalized)
    || /(?:^|[.-])(staging|preview)(?:[.-]|$)/i.test(normalized);
}

export async function GET(request: Request, { params }: { params: RouteParams }): Promise<Response> {
  const { siteSlug } = await params;
  const host = SITE_HOSTS[siteSlug.toLowerCase()];
  if (!host) return new Response("Not found\n", { status: 404 });
  const { entries } = await getStorefrontSitemapPayloadForHost([host]);
  const requestHosts = [hostValue(request, "x-forwarded-host"), hostValue(request, "host")].filter(Boolean);
  const localOrStaging = requestHosts.length > 0 && requestHosts.every(isNonProductionHost);
  return new Response(sitemapXml(entries), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=900, stale-while-revalidate=86400",
      "cdn-cache-control": "public, s-maxage=900, stale-while-revalidate=86400",
      "cloudflare-cdn-cache-control": "public, s-maxage=900, stale-while-revalidate=86400",
      "vary": "Host, X-Forwarded-Host",
      ...(localOrStaging ? { "x-robots-tag": "noindex, nofollow" } : {})
    }
  });
}

export async function HEAD(_request: Request, { params }: { params: RouteParams }): Promise<Response> {
  const response = await GET(_request, { params });
  return new Response(null, { status: response.status, headers: response.headers });
}
