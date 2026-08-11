import { publicSiteSlug } from "@/lib/domain-routing";

const databasePreferences = new Set(["database", "db", "relational"]);
const legacyLocalPreferences = new Set(["local", "json", "legacy", "file"]);
const explicitLocalPreviewPreferences = new Set(["local-preview", "json-preview", "legacy-preview", "file-preview"]);
const mydreamshootsSiteIds = new Set(["site_dreamshoot", "site_aidreamcapes"]);
const mydreamshootsPublicSlugs = new Set(["mydreamshoots", "dreamshoot", "aidreamcapes"]);

export function normalizeStorefrontReadPreference(value: string | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isDatabaseStorefrontReadPreference(value: string | undefined): boolean {
  return databasePreferences.has(normalizeStorefrontReadPreference(value));
}

export function isLegacyLocalStorefrontReadPreference(value: string | undefined): boolean {
  return legacyLocalPreferences.has(normalizeStorefrontReadPreference(value));
}

export function isExplicitLocalPreviewReadPreference(value: string | undefined): boolean {
  return explicitLocalPreviewPreferences.has(normalizeStorefrontReadPreference(value));
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
  const identity = `${site.slug ?? ""} ${site.name ?? ""} ${site.primaryDomain ?? ""} ${site.branding?.logoText ?? ""}`.toLowerCase();
  return identity.includes("mydreamshoots") || identity.includes("mydreamshoots.com") || identity.includes("aidreamcapes") || identity.includes("aidreamcapes.com");
}

export function requiresMydreamshootsPublishedSource(siteSlug: string | undefined, preference: string | undefined): boolean {
  return isMydreamshootsContentSourceSlug(siteSlug) && !isExplicitLocalPreviewReadPreference(preference);
}
