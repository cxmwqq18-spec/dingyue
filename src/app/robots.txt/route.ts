import { storefrontSitemapUrlForHost } from "@/lib/seo-indexing";

export const dynamic = "force-dynamic";

function normalizeHost(value: string | null | undefined): string {
  return String(value ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
}

function isGrownstrideHost(value: string | null | undefined): boolean {
  const host = normalizeHost(value);
  return host === "grownstride.com" || host === "www.grownstride.com" || host === "test.grownstride.com";
}

function isNonProductionHost(value: string | null | undefined): boolean {
  const host = normalizeHost(value);
  return /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(host)
    || /(?:^|\.)(?:localhost)$/i.test(host)
    || /(?:^|[.-])(staging|preview)(?:[.-]|$)/i.test(host);
}

export async function GET(request: Request): Promise<Response> {
  const hostCandidates = [request.headers.get("x-forwarded-host"), request.headers.get("host")];
  const grownstride = hostCandidates.some(isGrownstrideHost);
  const localOrStaging = hostCandidates.some(isNonProductionHost);
  const sitemap = storefrontSitemapUrlForHost(hostCandidates);
  // The Aidreamcapes storefront keeps its private routes out of the crawl
  // budget. Every other storefront keeps the behaviour it had, so this
  // change cannot reach another store.
  const aidreamcapes = (sitemap ?? "").includes("aivideosugc.com");
  const privateRules = aidreamcapes ? ["Disallow: /app/", "Disallow: /api/", "Disallow: /login", "Disallow: /site/"] : [];
  const body = grownstride || localOrStaging
    ? ["User-agent: *", "Disallow: /"]
    : sitemap
      ? ["User-agent: *", "Allow: /", ...privateRules, `Sitemap: ${sitemap}`]
      : ["User-agent: *", "Disallow: /"];

  return new Response(`${body.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "vary": "Host, X-Forwarded-Host",
      ...((grownstride || localOrStaging) ? { "x-robots-tag": "noindex, nofollow" } : {})
    }
  });
}
