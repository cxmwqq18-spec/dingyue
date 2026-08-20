import { getStorefrontPublicationIdentityForHost, storefrontSitemapUrlForHost } from "@/lib/seo-indexing";

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
  const identity = await getStorefrontPublicationIdentityForHost(hostCandidates);
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
      "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      "vary": "Host, X-Forwarded-Host",
      ...(grownstride ? { "x-robots-tag": "noindex, nofollow" } : {}),
      ...(identity?.publicationId ? { "x-storefront-publication": identity.publicationId } : {}),
      ...(identity?.publicationVersion !== undefined ? { "x-storefront-publication-version": String(identity.publicationVersion) } : {}),
      ...(identity?.snapshotHash ? { "x-storefront-snapshot-hash": identity.snapshotHash } : {}),
      ...(identity?.buildId ? { "x-storefront-build": identity.buildId } : {}),
      ...(identity?.routeRevision ? { "x-storefront-route-revision": identity.routeRevision } : {}),
      ...(identity?.pageRevision ? { "x-storefront-page-revision": identity.pageRevision } : {}),
      ...(identity?.copyRevision ? { "x-storefront-copy-revision": identity.copyRevision } : {}),
      ...(identity?.mediaRevision ? { "x-storefront-media-revision": identity.mediaRevision } : {}),
      ...(identity?.factsRevision ? { "x-storefront-facts-revision": identity.factsRevision } : {}),
      ...(identity?.offerRevision ? { "x-storefront-offer-revision": identity.offerRevision } : {}),
      ...(identity?.collectionRevision ? { "x-storefront-collection-revision": identity.collectionRevision } : {}),
      ...(identity?.linkRevision ? { "x-storefront-link-revision": identity.linkRevision } : {}),
      ...(identity?.policyRevision ? { "x-storefront-policy-revision": identity.policyRevision } : {})
    }
  });
}
