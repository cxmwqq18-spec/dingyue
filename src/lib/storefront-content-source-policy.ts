import { publicSiteSlug } from "@/lib/domain-routing";
import { usesAiGenerationPublicSlug } from "@/lib/storefront-context/capabilities";

const databasePreferences = new Set(["database", "db", "relational"]);
const mydreamshootsSiteIds = new Set(["site_dreamshoot", "site_aidreamcapes", "site_grownstride_test"]);
const mydreamshootsPublicSlugs = new Set(["mydreamshoots", "dreamshoot", "aidreamcapes", "grownstride"]);

export function normalizeStorefrontReadPreference(value: string | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isDatabaseStorefrontReadPreference(value: string | undefined): boolean {
  return databasePreferences.has(normalizeStorefrontReadPreference(value));
}

export function isLegacyLocalStorefrontReadPreference(value: string | undefined): boolean {
  void value;
  return false;
}

export function isExplicitLocalPreviewReadPreference(value: string | undefined): boolean {
  void value;
  return false;
}

export function isAnyLocalStorefrontReadPreference(value: string | undefined): boolean {
  return isLegacyLocalStorefrontReadPreference(value) || isExplicitLocalPreviewReadPreference(value);
}

export function isMydreamshootsContentSourceSlug(siteSlug: string | undefined): boolean {
  if (!siteSlug) return false;
  const slug = publicSiteSlug(siteSlug);
  return mydreamshootsPublicSlugs.has(slug);
}

export function isMydreamshootsContentSourceSiteId(siteId: string | undefined): boolean {
  if (!siteId) return false;
  return mydreamshootsSiteIds.has(siteId);
}

export function isMydreamshootsContentSourceSite(site: {
  id?: string;
  slug?: string;
  name?: string;
  primaryDomain?: string | null;
  branding?: { logoText?: string | null } | null;
} | undefined): boolean {
  if (!site) return false;
  if (isMydreamshootsContentSourceSiteId(site.id)) return true;
  if (isMydreamshootsContentSourceSlug(site.slug)) return true;
  return usesAiGenerationPublicSlug(publicSiteSlug(site.slug ?? ""));
}

export function requiresMydreamshootsPublishedSource(siteSlug: string | undefined, preference: string | undefined): boolean {
  void preference;
  return isMydreamshootsContentSourceSlug(siteSlug);
}
