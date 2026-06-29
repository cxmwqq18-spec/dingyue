import { readStorefrontPlatformStateFromDatabase, readStorefrontPlatformStateFromLegacyJson } from "@/lib/storefront-state";
import { isExplicitSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { MYDREAMSHOOTS_POLICY_SEO_BY_PATH, getMydreamshootsPolicySeo } from "@/lib/theme/policy-seo";
import type { CreativePack, PlatformState, SectionBlockInstance, Site, ThemePage, ThemePageJson, ThemeSettingValue } from "@/lib/types";

export const MYDREAMSHOOTS_ORIGIN = "https://www.mydreamshoots.com";
export const MYDREAMSHOOTS_SITEMAP_URL = `${MYDREAMSHOOTS_ORIGIN}/sitemap.xml`;
export const AIDREAMCAPES_ORIGIN = "https://www.aidreamcapes.com";
export const AIDREAMCAPES_SITEMAP_URL = `${AIDREAMCAPES_ORIGIN}/sitemap.xml`;

const DREAMSHOOT_SITE_ID = "site_dreamshoot";
const DREAMSHOOT_SITE_SLUGS = new Set(["mydreamshoots", "dreamshoot"]);
const AIDREAMCAPES_SITE_ID = "site_aidreamcapes";
const AIDREAMCAPES_SITE_SLUGS = new Set(["aidreamcapes"]);
const FALLBACK_INDEXABLE_PATHS = [
  "/",
  "/pricing",
  "/collections",
  "/tools",
  "/tools/headshot",
  "/tools/background-changer",
  "/tools/image-to-video",
  "/policies/privacy",
  "/policies/terms",
  "/policies/refunds",
  "/policies/shipping",
  "/policies/content",
  "/policies/cookies",
  "/help",
  "/blog",
  "/blog/preparing-source-photos"
];
const AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS = [
  "/",
  "/pricing",
  "/collections",
  "/tools",
  "/policies/privacy",
  "/policies/terms",
  "/policies/refunds",
  "/policies/shipping",
  "/policies/content",
  "/policies/cookies",
  "/help"
];

const BLOCKED_PAGE_TYPES = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
const BLOCKED_PATH_PREFIXES = ["/account", "/admin", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/search"];
const LEGACY_OR_DUPLICATE_PATHS = new Set(["/cookie-policy", "/privacy-policy", "/terms-of-service", "/shipping-policy", "/delivery-policy"]);
const NON_INDEXABLE_TOOL_PATHS = new Set(["/tools/image-studio", "/tools/ai-image-studio", "/tools/travel-portraits"]);
const REQUIRED_INDEXABLE_TOOL_PATHS = ["/tools/headshot", "/tools/background-changer", "/tools/image-to-video"];
const REQUIRED_INDEXABLE_POLICY_PATHS = ["/policies/privacy", "/policies/terms", "/policies/cookies", "/policies/shipping"];

function normalizePath(slug: string): string {
  const value = slug.trim();
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function siteOrigin(site: Site): string {
  const domain = site.primaryDomain.trim();
  if (!domain || domain.includes("localhost")) return "";
  if (domain.startsWith("http://") || domain.startsWith("https://")) return domain.replace(/\/$/, "");
  return `https://${domain}`;
}

function originHost(origin: string): string {
  try {
    return new URL(origin).host.toLowerCase();
  } catch {
    return "";
  }
}

function sitemapUrl(site: Site, path: string): string {
  const origin = siteOrigin(site) || MYDREAMSHOOTS_ORIGIN;
  return path === "/" ? origin : `${origin}${path}`;
}

function slugifySegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pathFromSlug(prefix: "/collections" | "/tools", slug: string): string {
  const normalized = slugifySegment(slug.replace(/^\/?(collections|tools)\//, ""));
  return normalized ? `${prefix}/${normalized}` : "";
}

function stringSetting(value: ThemeSettingValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function blockHref(block: SectionBlockInstance): string {
  return stringSetting(block.settings.href).split("?")[0]?.split("#")[0] ?? "";
}

function blocksFromPage(page: ThemePageJson, types: Set<string>): SectionBlockInstance[] {
  return Object.values(page.sections).flatMap((section) => section.blocks ?? []).filter((block) => types.has(block.type));
}

function isDreamshootSite(site: Site): boolean {
  return site.id === DREAMSHOOT_SITE_ID || DREAMSHOOT_SITE_SLUGS.has(site.slug) || site.primaryDomain === "www.mydreamshoots.com";
}

function isAidreamcapesSite(site: Site): boolean {
  return site.id === AIDREAMCAPES_SITE_ID || AIDREAMCAPES_SITE_SLUGS.has(site.slug) || site.primaryDomain === "www.aidreamcapes.com";
}

function isHostForSite(site: Site, host: string): boolean {
  const normalizedHost = host.trim().toLowerCase().split(":")[0];
  if (!normalizedHost) return false;
  return normalizedHost === site.primaryDomain.trim().toLowerCase() ||
    normalizedHost === originHost(siteOrigin(site)) ||
    (normalizedHost === "www.mydreamshoots.com" && isDreamshootSite(site)) ||
    (normalizedHost === "mydreamshoots.com" && isDreamshootSite(site)) ||
    (normalizedHost === "www.aidreamcapes.com" && isAidreamcapesSite(site)) ||
    (normalizedHost === "aidreamcapes.com" && isAidreamcapesSite(site));
}

function isMydreamshootsHost(host: string): boolean {
  return host === "www.mydreamshoots.com" || host === "mydreamshoots.com";
}

function isAidreamcapesHost(host: string): boolean {
  return host === "www.aidreamcapes.com" || host === "aidreamcapes.com";
}

function mydreamshootsPolicySeoForSite(site: Site, slug: string) {
  return isDreamshootSite(site) ? getMydreamshootsPolicySeo(slug) : undefined;
}

function findIndexableSites(state: PlatformState): Site[] {
  const candidates = state.sites.filter((site) => isDreamshootSite(site) || isAidreamcapesSite(site));
  const activeFirst = [...candidates].sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
  return Array.from(new Map(activeFirst.map((site) => [site.id, site])).values());
}

function isIndexablePage(page: ThemePage): boolean {
  const path = normalizePath(page.slug);
  if (LEGACY_OR_DUPLICATE_PATHS.has(path)) return false;
  if (NON_INDEXABLE_TOOL_PATHS.has(path)) return false;
  if (BLOCKED_PAGE_TYPES.has(page.pageType)) return false;
  return !BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isIndexableToolPath(site: Site, path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.startsWith("/tools/") && !NON_INDEXABLE_TOOL_PATHS.has(normalized) && isExplicitSeoDirectoryContentForSite(site, "tool", normalized);
}

function addToolPath(site: Site, paths: Set<string>, path: string): void {
  const normalized = normalizePath(path);
  if (isIndexableToolPath(site, normalized)) paths.add(normalized);
}

function collectionPathForPack(pack: CreativePack): string {
  return pathFromSlug("/collections", pack.categoryRecord?.slug || pack.category || pack.name);
}

function addCollectionPath(site: Site, paths: Set<string>, path: string): void {
  const normalized = normalizePath(path);
  if (normalized.startsWith("/collections/") && isExplicitSeoDirectoryContentForSite(site, "collection", normalized)) paths.add(normalized);
}

function collectDynamicIndexablePaths(state: PlatformState, site: Site): string[] {
  const paths = new Set<string>();
  const activePacks = state.creativePacks.filter((pack) => pack.siteId === site.id && pack.status === "active");

  for (const pack of activePacks) {
    const collectionPath = collectionPathForPack(pack);
    if (collectionPath) addCollectionPath(site, paths, collectionPath);
    addToolPath(site, paths, pathFromSlug("/tools", pack.aiAppSlug));
  }

  for (const siteApp of state.siteAiApps.filter((app) => app.siteId === site.id && app.enabled)) {
    addToolPath(site, paths, pathFromSlug("/tools", siteApp.aiApp.slug));
  }

  const toolBlocks = site.pages.flatMap((page) => blocksFromPage(page.publishedJson, new Set(["tool_card", "catalog_pack", "feature_tab", "occasion", "package"])));
  for (const block of toolBlocks) {
    const href = blockHref(block);
    if (href.startsWith("/tools/")) addToolPath(site, paths, href);
  }

  return Array.from(paths);
}

async function readIndexableStateAndSites(): Promise<{ state: PlatformState; sites: Site[] } | undefined> {
  try {
    const state = await readStorefrontPlatformStateFromDatabase();
    const sites = findIndexableSites(state);
    if (sites.length) return { state, sites };
  } catch {
    // Fall through to the legacy JSON state so robots/sitemap stay available during data migrations.
  }

  try {
    const state = await readStorefrontPlatformStateFromLegacyJson();
    const sites = findIndexableSites(state);
    return sites.length ? { state, sites } : undefined;
  } catch {
    return undefined;
  }
}

export async function getMydreamshootsSitemapUrls(): Promise<string[]> {
  const runtime = await readIndexableStateAndSites();
  if (!runtime) return FALLBACK_INDEXABLE_PATHS.map((path) => (path === "/" ? MYDREAMSHOOTS_ORIGIN : `${MYDREAMSHOOTS_ORIGIN}${path}`));
  const site = runtime?.sites.find(isDreamshootSite);
  if (!site) return FALLBACK_INDEXABLE_PATHS.map((path) => (path === "/" ? MYDREAMSHOOTS_ORIGIN : `${MYDREAMSHOOTS_ORIGIN}${path}`));
  return getSitemapUrlsForSite(runtime.state, site);
}

export async function getAidreamcapesSitemapUrls(): Promise<string[]> {
  const fallback = AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS.map((path) => (path === "/" ? AIDREAMCAPES_ORIGIN : `${AIDREAMCAPES_ORIGIN}${path}`));
  const runtime = await readIndexableStateAndSites();
  if (!runtime) return fallback;
  const site = runtime.sites.find(isAidreamcapesSite);
  return site ? getSitemapUrlsForSite(runtime.state, site) : fallback;
}

function getSitemapUrlsForSite(state: PlatformState, site: Site): string[] {
  const paths = site?.pages.map((page) => {
    const pageSeo = site.themeSettings.publishedJson.seo?.pages?.[page.id];
    const policySeo = mydreamshootsPolicySeoForSite(site, page.slug);
    const canonicalPath = normalizePath(policySeo?.canonicalPath ?? pageSeo?.canonicalPath ?? page.slug);
    const isLegacyDuplicate = LEGACY_OR_DUPLICATE_PATHS.has(normalizePath(page.slug));
    return isIndexablePage(page) && !isLegacyDuplicate && pageSeo?.index !== false && policySeo?.index !== false ? canonicalPath : "";
  }).filter(Boolean) ?? FALLBACK_INDEXABLE_PATHS;

  paths.push(...collectDynamicIndexablePaths(state, site));

  for (const path of REQUIRED_INDEXABLE_TOOL_PATHS) {
    if (isExplicitSeoDirectoryContentForSite(site, "tool", path)) paths.push(path);
  }

  for (const path of REQUIRED_INDEXABLE_POLICY_PATHS) {
    const policySeo = MYDREAMSHOOTS_POLICY_SEO_BY_PATH[path];
    if ((isDreamshootSite(site) || isAidreamcapesSite(site)) && policySeo?.index !== false) paths.push(policySeo.canonicalPath);
  }

  return Array.from(new Set(paths.map((path) => sitemapUrl(site, path)))).sort((a, b) => {
    const origin = siteOrigin(site) || MYDREAMSHOOTS_ORIGIN;
    if (a === origin) return -1;
    if (b === origin) return 1;
    return a.localeCompare(b);
  });
}

export async function getStorefrontSitemapUrls(): Promise<string[]> {
  const runtime = await readIndexableStateAndSites();
  if (!runtime) return FALLBACK_INDEXABLE_PATHS.map((path) => (path === "/" ? MYDREAMSHOOTS_ORIGIN : `${MYDREAMSHOOTS_ORIGIN}${path}`));
  return runtime.sites.flatMap((site) => getSitemapUrlsForSite(runtime.state, site));
}

function normalizeHostCandidate(host: string | null | undefined): string {
  return String(host ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
}

function normalizeFirstHost(hosts: string | null | undefined | Array<string | null | undefined>): string {
  return normalizeHostCandidates(hosts)[0] ?? "";
}

function normalizeHostCandidates(hosts: string | null | undefined | Array<string | null | undefined>): string[] {
  const candidates = Array.isArray(hosts) ? hosts : [hosts];
  return candidates.map(normalizeHostCandidate).filter(Boolean);
}

export async function getStorefrontSitemapUrlsForHost(hosts: string | null | undefined | Array<string | null | undefined>): Promise<string[]> {
  const normalizedHosts = normalizeHostCandidates(hosts);
  const normalizedHost = normalizedHosts[0] ?? "";
  if (!normalizedHost) return [];
  const runtime = await readIndexableStateAndSites();
  if (!runtime) {
    if (normalizedHosts.some(isAidreamcapesHost)) return getAidreamcapesSitemapUrls();
    if (normalizedHosts.some(isMydreamshootsHost)) return getMydreamshootsSitemapUrls();
    return [];
  }
  const site = runtime.sites.find((item) => normalizedHosts.some((host) => isHostForSite(item, host)));
  if (site) return getSitemapUrlsForSite(runtime.state, site);
  if (normalizedHosts.some(isAidreamcapesHost)) return getAidreamcapesSitemapUrls();
  if (normalizedHosts.some(isMydreamshootsHost)) return getMydreamshootsSitemapUrls();
  return [];
}

export function storefrontSitemapUrlForHost(hosts: string | null | undefined | Array<string | null | undefined>): string | undefined {
  const normalizedHost = normalizeFirstHost(hosts);
  if (isAidreamcapesHost(normalizedHost)) return AIDREAMCAPES_SITEMAP_URL;
  if (isMydreamshootsHost(normalizedHost)) return MYDREAMSHOOTS_SITEMAP_URL;
  return undefined;
}
