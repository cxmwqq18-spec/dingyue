import type { PlatformState, Site } from "@/lib/types";
import { SPANISH_STOREFRONT_SLUG_ALIASES } from "@/lib/spanish-storefronts";

type SiteRoutingIdentity = Pick<Site, "slug" | "primaryDomain">;

const PLATFORM_DOMAINS = new Set<string>([
  "www.mydreamshoots.xyz",
  "mydreamshoots.xyz"
]);
const SITE_ADMIN_DOMAINS: Record<string, string> = {
  "www.aidreamcapes.xyz": "aidreamcapes",
  "aidreamcapes.xyz": "aidreamcapes"
};
const PUBLIC_SITE_SLUG_ALIASES: Record<string, string> = {
  dreamshoot: "mydreamshoots",
  ...SPANISH_STOREFRONT_SLUG_ALIASES
};

export function cleanHost(host: string | null | undefined): string {
  return String(host ?? "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
}

export function hostDomainCandidates(host: string | null | undefined): string[] {
  const value = cleanHost(host);
  if (!value) return [];
  const counterpart = value.startsWith("www.") ? value.slice(4) : `www.${value}`;
  return Array.from(new Set([value, counterpart]));
}

export function isPlatformHost(host: string | null | undefined): boolean {
  const value = cleanHost(host);
  return PLATFORM_DOMAINS.has(value);
}

export function siteAdminSlugForHost(host: string | null | undefined): string | undefined {
  const value = cleanHost(host);
  const slug = SITE_ADMIN_DOMAINS[value];
  return slug ? canonicalSiteSlug(slug) : undefined;
}

export function siteAdminPathForHost(host: string | null | undefined, path = "/admin"): string | undefined {
  const slug = siteAdminSlugForHost(host);
  if (!slug) return undefined;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `/site/${slug}${normalizedPath}`;
}

export function redirectMismatchedSiteAdminSlugForHost(host: string | null | undefined, siteSlug: string, path = "/admin"): string | undefined {
  const hostSlug = siteAdminSlugForHost(host);
  if (!hostSlug || hostSlug === canonicalSiteSlug(siteSlug)) return undefined;
  return siteAdminPathForHost(host, path);
}

export function publicSiteSlug(slug: string): string {
  return PUBLIC_SITE_SLUG_ALIASES[slug] ?? slug;
}

export function canonicalSiteSlug(slug: string): string {
  return publicSiteSlug(slug);
}

export function legacySiteSlugCandidates(slug: string): string[] {
  const publicSlug = publicSiteSlug(slug);
  return Array.from(new Set([publicSlug, slug, ...Object.entries(PUBLIC_SITE_SLUG_ALIASES).filter(([, current]) => current === publicSlug).map(([legacy]) => legacy)]));
}

export function getSiteByHostFromState(state: PlatformState, host: string | null | undefined): Site | undefined {
  const value = cleanHost(host);
  if (!value || isPlatformHost(value) || value === "localhost" || value === "127.0.0.1") return undefined;
  const candidates = hostDomainCandidates(value);

  const activeDomain = state.siteDomains.find((domain) => domain.status === "active" && candidates.includes(cleanHost(domain.domain)));
  if (activeDomain) return state.sites.find((site) => site.id === activeDomain.siteId);

  const anyDomain = state.siteDomains.find((domain) => candidates.includes(cleanHost(domain.domain)));
  if (anyDomain) return state.sites.find((site) => site.id === anyDomain.siteId);

  return state.sites.find((site) => candidates.includes(cleanHost(site.primaryDomain)));
}

export function getSiteByHostCandidatesFromState(state: PlatformState, hosts: Array<string | null | undefined>): Site | undefined {
  for (const host of hosts) {
    const site = getSiteByHostFromState(state, host);
    if (site) return site;
  }
  return undefined;
}

export function hostAwareSitePath(site: SiteRoutingIdentity, path = "/"): string {
  const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const primaryHost = cleanHost(site.primaryDomain);
  const hasProductionDomain = Boolean(primaryHost && primaryHost !== "localhost" && primaryHost !== "127.0.0.1" && !primaryHost.endsWith(".localhost"));
  if (hasProductionDomain) return normalizedPath;
  const slug = publicSiteSlug(site.slug);
  if (normalizedPath === "/") return `/site/${slug}`;
  return `/site/${slug}${normalizedPath}`;
}

export function publicSiteUrl(site: SiteRoutingIdentity, path = "/"): string {
  return publicSiteUrlFromParts({ slug: publicSiteSlug(site.slug), primaryDomain: site.primaryDomain }, path);
}

export function publicSiteUrlFromParts(site: { slug: string; primaryDomain: string }, path = "/"): string {
  const normalizedPath = !path || path === "/" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const primaryHost = cleanHost(site.primaryDomain);
  const hasProductionDomain = Boolean(primaryHost && primaryHost !== "localhost" && primaryHost !== "127.0.0.1" && !primaryHost.endsWith(".localhost"));
  if (hasProductionDomain) return `https://${primaryHost}${normalizedPath === "/" ? "" : normalizedPath}`;
  return normalizedPath === "/" ? `/site/${site.slug}` : `/site/${site.slug}${normalizedPath}`;
}
