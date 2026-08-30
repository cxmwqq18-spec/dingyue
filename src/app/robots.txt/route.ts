import { storefrontSitemapUrlForHost } from "@/lib/seo-indexing";

export const dynamic = "force-dynamic";

function normalizeHost(value: string | null | undefined): string {
  return String(value ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
}

function isGrownstrideHost(value: string | null | undefined): boolean {
  const host = normalizeHost(value);
  return host === "grownstride.com" || host === "www.grownstride.com" || host === "test.grownstride.com";
}

export async function GET(request: Request): Promise<Response> {
  const hostCandidates = [request.headers.get("x-forwarded-host"), request.headers.get("host")];
  const grownstride = hostCandidates.some(isGrownstrideHost);
  const sitemap = storefrontSitemapUrlForHost(hostCandidates);
  const body = grownstride
    ? ["User-agent: *", "Disallow: /"]
    : sitemap
      ? ["User-agent: *", "Allow: /", `Sitemap: ${sitemap}`]
      : ["User-agent: *", "Disallow: /"];

  return new Response(`${body.join("\n")}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "vary": "Host, X-Forwarded-Host",
      ...(grownstride ? { "x-robots-tag": "noindex, nofollow" } : {})
    }
  });
}
