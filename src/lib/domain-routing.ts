import type { PlatformState, Site } from "@/lib/types";

const PLATFORM_DOMAINS = new Set(["www.mydreamshoots.xyz", "mydreamshoots.xyz"]);

export function cleanHost(host: string | null | undefined): string {
  return String(host ?? "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
}

export function isPlatformHost(host: string | null | undefined): boolean {
  const value = cleanHost(host);
  return PLATFORM_DOMAINS.has(value);
}

export function getSiteByHostFromState(state: PlatformState, host: string | null | undefined): Site | undefined {
  const value = cleanHost(host);
  if (!value || isPlatformHost(value) || value === "localhost" || value === "127.0.0.1") return undefined;

  const activeDomain = state.siteDomains.find((domain) => domain.status === "active" && cleanHost(domain.domain) === value);
  if (activeDomain) return state.sites.find((site) => site.id === activeDomain.siteId);

  const anyDomain = state.siteDomains.find((domain) => cleanHost(domain.domain) === value);
  if (anyDomain) return state.sites.find((site) => site.id === anyDomain.siteId);

  return state.sites.find((site) => cleanHost(site.primaryDomain) === value);
}

export function hostAwareSitePath(site: Site, path = "/"): string {
  const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const primaryHost = cleanHost(site.primaryDomain);
  const hasProductionDomain = Boolean(primaryHost && primaryHost !== "localhost" && primaryHost !== "127.0.0.1" && !primaryHost.endsWith(".localhost"));
  if (hasProductionDomain) return normalizedPath;
  if (normalizedPath === "/") return `/site/${site.slug}`;
  return `/site/${site.slug}${normalizedPath}`;
}

export function publicSiteUrl(site: Site, path = "/"): string {
  return publicSiteUrlFromParts({ slug: site.slug, primaryDomain: site.primaryDomain }, path);
}

export function publicSiteUrlFromParts(site: { slug: string; primaryDomain: string }, path = "/"): string {
  const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const primaryHost = cleanHost(site.primaryDomain);
  const hasProductionDomain = Boolean(primaryHost && primaryHost !== "localhost" && primaryHost !== "127.0.0.1" && !primaryHost.endsWith(".localhost"));
  if (hasProductionDomain) return `https://${primaryHost}${normalizedPath === "/" ? "" : normalizedPath}`;
  return normalizedPath === "/" ? `/site/${site.slug}` : `/site/${site.slug}${normalizedPath}`;
}
