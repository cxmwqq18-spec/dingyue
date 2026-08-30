import { canonicalSiteSlug, cleanHost, isPlatformHost, publicSiteSlug } from "@/lib/domain-routing";

export type StorefrontRouteMode = "host" | "path";

type HeaderReader = {
  get(name: string): string | null;
};

function isLocalHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

function publicHostMatchesSite(host: string | null | undefined, siteSlug: string): boolean {
  const value = cleanHost(host);
  if (!value || isPlatformHost(value) || isLocalHost(value)) return false;

  const slug = canonicalSiteSlug(publicSiteSlug(siteSlug)).toLowerCase();
  const baseSlug = slug.replace(/-(?:eu|xby)$/i, "");
  const candidates = new Set([slug, baseSlug]);
  if (baseSlug === "aidreamcapes") candidates.add("aidreamcapes");
  if (baseSlug === "aidreamshoots") candidates.add("aidreamshoots");
  if (baseSlug === "mydreamshoots") candidates.add("mydreamshoots");

  return Array.from(candidates).some((candidate) => candidate && value.includes(candidate));
}

export function storefrontRouteModeForHeaders(headers: HeaderReader, siteSlug: string): StorefrontRouteMode {
  if (publicHostMatchesSite(headers.get("x-forwarded-host"), siteSlug)) return "host";
  if (publicHostMatchesSite(headers.get("host"), siteSlug)) return "host";
  return "path";
}

export function storefrontPathForRouteMode(siteSlug: string, path = "/", routeMode: StorefrontRouteMode): string {
  const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  if (routeMode === "host") return normalizedPath;
  const slug = publicSiteSlug(siteSlug);
  return normalizedPath === "/" ? `/site/${slug}` : `/site/${slug}${normalizedPath}`;
}
