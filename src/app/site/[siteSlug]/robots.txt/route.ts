type RouteParams = Promise<{ siteSlug: string }>;

const SITE_HOSTS: Record<string, string> = {
  aidreamshoots: "aidreamshoots.eu",
  "aidreamshoots-eu": "aidreamshoots.eu",
  "aidreamcapes-eu": "aidreamcapes.eu",
  aidreamcapes: "www.aivideosugc.com",
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
  const requestHosts = [hostValue(request, "x-forwarded-host"), hostValue(request, "host")].filter(Boolean);
  const localOrStaging = requestHosts.length > 0 && requestHosts.every(isNonProductionHost);
  const blocked = host === "grownstride.com" || localOrStaging;
  const body = blocked
    ? ["User-agent: *", "Disallow: /"]
    : ["User-agent: *", "Allow: /", `Sitemap: https://${host}/sitemap.xml`];
  return new Response(`${body.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "vary": "Host, X-Forwarded-Host",
      ...(blocked ? { "x-robots-tag": "noindex, nofollow" } : {})
    }
  });
}
