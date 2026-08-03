import { readStorefrontPlatformStateFromDatabase, readStorefrontPlatformStateFromLegacyJson } from "@/lib/storefront-state";
import { canonicalSeoDirectoryPathForSite, canonicalSeoDirectorySlugForSite, getExplicitSeoDirectorySlugsForSite, isExplicitSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { getAidreamcapesPolicySeo, getMydreamshootsPolicySeo } from "@/lib/theme/policy-seo";
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
  "/workflow",
  "/collections",
  "/tools",
  "/tools/photo-ai",
  "/tools/video-ai",
  "/tools/ai-photo-edit",
  "/tools/headshot",
  "/tools/background-changer",
  "/tools/image-to-video",
  "/privacy",
  "/terms",
  "/cookies",
  "/refunds",
  "/content",
  "/shipping",
  "/faq",
  "/blog",
  "/blog/preparing-source-photos",
  "/blog/choosing-ai-photo-packages",
  "/blog/private-gallery-and-credits-guide",
  "/blog/creator-photo-package-guide",
  "/blog/avatar-photo-package-guide",
  "/blog/wedding-photo-package-guide",
  "/blog/cultural-wedding-photo-guide",
  "/blog/couple-photo-package-guide",
  "/blog/creative-photo-package-guide",
  "/blog/beauty-style-photo-guide",
  "/blog/sports-fan-photo-guide",
  "/blog/video-photo-package-guide",
  "/blog/utility-image-prep-guide",
  "/blog/headshot-photo-package-guide",
  "/blog/seasonal-photo-package-guide"
];
const AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS = [
  "/",
  "/pricing",
  "/workflow",
  "/collections",
  "/tools",
  "/privacy",
  "/terms",
  "/cookies",
  "/refunds",
  "/content",
  "/shipping",
  "/faq",
  "/collections/fan-scene-albums",
  "/collections/game-day-group-photos",
  "/collections/premiere-style-portraits",
  "/collections/christmas-group-albums",
  "/collections/thanksgiving-memory-sets",
  "/collections/halloween-party-portraits",
  "/collections/seasonal-celebration-photos",
  "/tools/fan-scene-album-builder",
  "/tools/game-day-group-portrait-maker",
  "/tools/premiere-portrait-set-builder",
  "/tools/christmas-group-album-studio",
  "/tools/thanksgiving-keepsake-set-maker",
  "/tools/halloween-party-portrait-maker",
  "/tools/new-year-countdown-album-maker",
  "/tools/permission-safe-photo-planner",
  "/blog",
  "/blog/fan-scene-photo-albums-guide",
  "/blog/game-day-group-portraits-guide",
  "/blog/premiere-style-photo-sets-guide",
  "/blog/holiday-memory-albums-guide",
  "/blog/approved-source-photo-planning",
  "/blog/permission-safe-fan-scene-references",
  "/blog/private-album-credit-planning",
  "/blog/thanksgiving-keepsake-sets-category-guide",
  "/blog/halloween-party-portraits-category-guide",
  "/blog/seasonal-celebration-photos-category-guide"
];

const BLOCKED_PAGE_TYPES = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
const BLOCKED_PATH_PREFIXES = ["/404", "/account", "/admin", "/album", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/platform", "/search", "/site"];
const NON_PAGE_PATH_PREFIXES = ["/_next", "/assets", "/fonts", "/images", "/media", "/robots.txt", "/sitemap.xml", "/videos"];
const LEGACY_OR_DUPLICATE_PATHS = new Set(["/cookie-policy", "/privacy-policy", "/terms-of-service", "/shipping-policy", "/delivery-policy"]);
const NON_INDEXABLE_TOOL_PATHS = new Set(["/tools/image-studio", "/tools/ai-image-studio", "/tools/image-generator", "/tools/image_generator", "/tools/travel-portraits"]);
const REQUIRED_INDEXABLE_TOOL_PATHS = ["/tools/photo-ai", "/tools/video-ai", "/tools/ai-photo-edit", "/tools/headshot", "/tools/background-changer", "/tools/image-to-video"];
const DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS = [
  "/tools/headshot",
  "/tools/creator-portrait",
  "/tools/world-cup-fan-photos",
  "/tools/cyberpunk-portrait",
  "/tools/gala-photo",
  "/tools/noir-portrait",
  "/tools/anime-avatar",
  "/tools/nature-adventure",
  "/tools/fashion-editorial",
  "/tools/product-lifestyle",
  "/tools/image-to-video",
  "/tools/profile-clip",
  "/tools/fan-poster-motion",
  "/tools/creator-intro-video",
  "/tools/product-teaser-clip",
  "/tools/animated-avatar",
  "/tools/fashion-reel",
  "/tools/album-story-video",
  "/tools/background-changer",
  "/tools/background-remover",
  "/tools/magic-eraser",
  "/tools/photo-enhancer",
  "/tools/portrait-retouch",
  "/tools/unblur-image",
  "/tools/color-correction",
  "/tools/old-photo-restoration",
  "/tools/edit-by-prompt",
  "/tools/magic-upscaler"
];
const REQUIRED_INDEXABLE_CONTENT_PATHS = ["/about-us", "/contact-us"];
const REQUIRED_INDEXABLE_POLICY_PATHS = ["/privacy", "/terms", "/cookies", "/refunds", "/content", "/shipping", "/children-privacy", "/state-privacy"];
const DREAMSHOOT_FALLBACK_SITE = { id: DREAMSHOOT_SITE_ID, slug: "mydreamshoots", name: "MyDreamShoots", primaryDomain: "www.mydreamshoots.com" } as Site;
const AIDREAMCAPES_FALLBACK_SITE = { id: AIDREAMCAPES_SITE_ID, slug: "aidreamcapes", name: "Aidreamcapes", primaryDomain: "www.aidreamcapes.com" } as Site;
const CANONICAL_PUBLIC_PATHS = new Map([
  ["/about", "/about-us"],
  ["/contact", "/contact-us"],
  ["/help", "/faq"],
  ["/how-it-works", "/workflow"],
  ["/examples", "/collections"],
  ["/packages", "/collections"],
  ["/tool", "/tools"],
  ["/privacy-policy", "/privacy"],
  ["/policies/privacy", "/privacy"],
  ["/policies/privacy-policy", "/privacy"],
  ["/terms-of-service", "/terms"],
  ["/policies/terms", "/terms"],
  ["/policies/terms-of-service", "/terms"],
  ["/cookie-policy", "/cookies"],
  ["/policies/cookies", "/cookies"],
  ["/refund-policy", "/refunds"],
  ["/policies/refund", "/refunds"],
  ["/policies/refunds", "/refunds"],
  ["/content-policy", "/content"],
  ["/policies/content", "/content"],
  ["/shipping-policy", "/shipping"],
  ["/delivery-policy", "/shipping"],
  ["/policies/shipping", "/shipping"],
  ["/children-privacy-policy", "/children-privacy"],
  ["/childrens-privacy", "/children-privacy"],
  ["/policies/children-privacy", "/children-privacy"],
  ["/state-privacy-rights", "/state-privacy"],
  ["/california-privacy", "/state-privacy"],
  ["/ccpa", "/state-privacy"],
  ["/policies/state-privacy", "/state-privacy"]
]);
const DREAMSHOOT_LEGACY_TOOL_CANONICAL_PATHS = new Map([
  ["/tools/ai-image-studio", "/tools"],
  ["/tools/image-studio", "/tools"],
  ["/tools/travel-portraits", "/tools/nature-adventure"]
]);
const AIDREAMCAPES_LEGACY_TOOL_CANONICAL_PATHS = new Map([
  ["/tools/ai-image-studio", "/tools"],
  ["/tools/background-changer", "/tools/fan-scene-album-builder"],
  ["/tools/background-remover", "/tools/fan-scene-album-builder"],
  ["/tools/dreamscape-generator", "/tools/fan-scene-album-builder"],
  ["/tools/image-generator", "/tools/fan-scene-album-builder"],
  ["/tools/image-to-video", "/tools/new-year-countdown-album-maker"],
  ["/tools/image-studio", "/tools"],
  ["/tools/portrait-generator", "/tools/fan-scene-album-builder"],
  ["/tools/portrait-maker", "/tools/fan-scene-album-builder"],
  ["/tools/product-reverie", "/tools/permission-safe-photo-planner"],
  ["/tools/soft-glam", "/tools/premiere-portrait-set-builder"],
  ["/tools/couple-escape-album", "/tools/birthday-fan-moment-maker"],
  ["/tools/wedding-portraits", "/tools/birthday-fan-moment-maker"],
  ["/tools/world-cup-fan-photos", "/tools/game-day-group-portrait-maker"],
  ["/tools/headshot", "/tools/premiere-portrait-set-builder"],
  ["/tools/route-portrait-engine", "/tools/fan-scene-album-builder"],
  ["/tools/coastal-portrait", "/tools/christmas-group-album-studio"],
  ["/tools/island-resort-scenes", "/tools/new-year-countdown-album-maker"],
  ["/tools/scenic-overlook-story", "/tools/game-day-group-portrait-maker"],
  ["/tools/travel-profile-story", "/tools/fan-scene-album-builder"],
  ["/tools/editorial-getaway", "/tools/premiere-portrait-set-builder"],
  ["/tools/cafe-street-story", "/tools/premiere-portrait-set-builder"],
  ["/tools/cinematic-travel", "/tools/game-day-group-portrait-maker"],
  ["/tools/route-moodboard", "/tools/permission-safe-photo-planner"],
  ["/tools/social-keepsake", "/tools/birthday-fan-moment-maker"],
  ["/tools/family-travel-keepsakes", "/tools/thanksgiving-keepsake-set-maker"],
  ["/tools/seasonal-celebration-album-maker", "/tools/new-year-countdown-album-maker"],
  ["/tools/travel-journal-cover-maker", "/tools/new-year-countdown-album-maker"]
]);

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

function stripQueryAndHash(value: string): { pathname: string; search: string } {
  const hashIndex = value.indexOf("#");
  const beforeHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const queryIndex = beforeHash.indexOf("?");
  return {
    pathname: queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash,
    search: queryIndex >= 0 ? beforeHash.slice(queryIndex) : ""
  };
}

function canonicalPublicPath(path: string): string {
  const normalized = normalizePath(path);
  return CANONICAL_PUBLIC_PATHS.get(normalized) ?? normalized;
}

function canonicalToolPathForSite(site: Site, path: string): string {
  const normalized = canonicalSeoDirectoryPathForSite(site, "tool", path);
  if (isAidreamcapesSite(site)) return AIDREAMCAPES_LEGACY_TOOL_CANONICAL_PATHS.get(normalized) ?? normalized;
  if (isDreamshootSite(site)) return DREAMSHOOT_LEGACY_TOOL_CANONICAL_PATHS.get(normalized) ?? normalized;
  return normalized;
}

function canonicalDirectoryPathForSite(site: Site, path: string): string {
  const normalized = normalizePath(path);
  if (normalized.startsWith("/collections/")) return canonicalSeoDirectoryPathForSite(site, "collection", normalized);
  if (normalized.startsWith("/tools/")) return canonicalToolPathForSite(site, normalized);
  return normalized;
}

function hasNonPageFileExtension(path: string): boolean {
  return /\.[a-z0-9]{2,5}$/i.test(path) && !path.endsWith(".html");
}

function isBlockedPublicPath(path: string): boolean {
  if (LEGACY_OR_DUPLICATE_PATHS.has(path)) return true;
  if (NON_INDEXABLE_TOOL_PATHS.has(path)) return true;
  if (hasNonPageFileExtension(path)) return true;
  if (BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return true;
  return NON_PAGE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function sitePathFromHref(site: Site, href: string): string {
  const raw = href.trim();
  if (!raw || raw.startsWith("#") || /^(javascript|mailto|sms|tel):/i.test(raw)) return "";

  let pathname = "";
  let search = "";
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (!isHostForSite(site, url.host)) return "";
      pathname = url.pathname;
      search = url.search;
    } catch {
      return "";
    }
  } else {
    const parsed = stripQueryAndHash(raw);
    pathname = parsed.pathname;
    search = parsed.search;
  }

  if (!pathname.startsWith("/")) return "";
  let normalized = normalizePath(pathname);
  const sitePrefix = `/site/${site.slug}`;
  if (normalized === sitePrefix) normalized = "/";
  if (normalized.startsWith(`${sitePrefix}/`)) normalized = normalizePath(normalized.slice(sitePrefix.length));
  if (normalized === "/collections" && search) {
    const category = new URLSearchParams(search).get("category");
    if (category) normalized = pathFromSlug("/collections", category);
  }

  normalized = canonicalDirectoryPathForSite(site, canonicalPublicPath(normalized));
  return isBlockedPublicPath(normalized) ? "" : normalized;
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

function policySeoForSite(site: Site, slug: string) {
  if (isAidreamcapesSite(site)) return getAidreamcapesPolicySeo(slug);
  return mydreamshootsPolicySeoForSite(site, slug);
}

function findIndexableSites(state: PlatformState): Site[] {
  const candidates = state.sites.filter((site) => isDreamshootSite(site) || isAidreamcapesSite(site));
  const activeFirst = [...candidates].sort((a, b) => Number(b.status === "active") - Number(a.status === "active"));
  return Array.from(new Map(activeFirst.map((site) => [site.id, site])).values());
}

function isIndexablePage(page: ThemePage): boolean {
  const path = canonicalPublicPath(normalizePath(page.slug));
  if (LEGACY_OR_DUPLICATE_PATHS.has(path)) return false;
  if (NON_INDEXABLE_TOOL_PATHS.has(path)) return false;
  if (BLOCKED_PAGE_TYPES.has(page.pageType)) return false;
  return !isBlockedPublicPath(path);
}

function isIndexableToolPath(site: Site, path: string): boolean {
  const normalized = canonicalToolPathForSite(site, path);
  return (normalized === "/tools" || normalized.startsWith("/tools/")) && !isBlockedPublicPath(normalized);
}

function addToolPath(site: Site, paths: Set<string>, path: string): void {
  const normalized = canonicalToolPathForSite(site, path);
  if (isIndexableToolPath(site, normalized)) paths.add(normalized);
}

function collectionPathsForPack(pack: CreativePack): string[] {
  return Array.from(new Set([
    pack.categoryRecord?.parent?.slug,
    pack.categoryRecord?.slug,
    pack.category,
    pack.name
  ].filter(Boolean).map((slug) => pathFromSlug("/collections", String(slug))).filter(Boolean)));
}

function collectionSlugsForPack(site: Site, pack: CreativePack): string[] {
  return collectionPathsForPack(pack).map((path) => canonicalSeoDirectorySlugForSite(site, "collection", path));
}

function canResolveCollectionPath(state: PlatformState, site: Site, path: string): boolean {
  const normalized = canonicalDirectoryPathForSite(site, path);
  if (!normalized.startsWith("/collections/")) return false;
  if (isExplicitSeoDirectoryContentForSite(site, "collection", normalized)) return true;
  const canonicalSlug = canonicalSeoDirectorySlugForSite(site, "collection", normalized);
  if ((state.creativePackCategories ?? []).some((category) => {
    if (category.siteId !== site.id || category.status !== "active") return false;
    return canonicalSeoDirectorySlugForSite(site, "collection", category.slug || category.label) === canonicalSlug;
  })) return true;
  return state.creativePacks.some((pack) => pack.siteId === site.id && pack.status === "active" && collectionSlugsForPack(site, pack).includes(canonicalSlug));
}

function addCollectionPath(state: PlatformState, site: Site, paths: Set<string>, path: string): void {
  const normalized = canonicalDirectoryPathForSite(site, path);
  if (normalized.startsWith("/collections/") && !isBlockedPublicPath(normalized) && canResolveCollectionPath(state, site, normalized)) {
    paths.add(normalized);
  }
}

function addPublicPath(state: PlatformState, site: Site, paths: Set<string>, href: string): void {
  const normalized = sitePathFromHref(site, href);
  if (!normalized) return;
  if (normalized.startsWith("/collections/")) {
    addCollectionPath(state, site, paths, normalized);
    return;
  }
  if (normalized.startsWith("/tools/")) {
    addToolPath(site, paths, normalized);
    return;
  }
  paths.add(normalized);
}

function collectInternalHrefPaths(state: PlatformState, site: Site, paths: Set<string>, value: unknown): void {
  if (typeof value === "string") {
    addPublicPath(state, site, paths, value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectInternalHrefPaths(state, site, paths, item);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const item of Object.values(value)) {
    collectInternalHrefPaths(state, site, paths, item);
  }
}

function collectExplicitSeoDirectoryPaths(site: Site): string[] {
  const collections = getExplicitSeoDirectorySlugsForSite(site, "collection").map((slug) => canonicalSeoDirectoryPathForSite(site, "collection", slug));
  const tools = getExplicitSeoDirectorySlugsForSite(site, "tool").map((slug) => canonicalToolPathForSite(site, `/tools/${slug}`));
  return Array.from(new Set([...collections, ...tools]));
}

function collectDynamicIndexablePaths(state: PlatformState, site: Site): string[] {
  const paths = new Set<string>();
  const activePacks = state.creativePacks.filter((pack) => pack.siteId === site.id && pack.status === "active");

  for (const pack of activePacks) {
    for (const collectionPath of collectionPathsForPack(pack)) {
      addCollectionPath(state, site, paths, collectionPath);
    }
  }

  for (const category of state.creativePackCategories ?? []) {
    if (category.siteId === site.id && category.status === "active") {
      addCollectionPath(state, site, paths, pathFromSlug("/collections", category.slug || category.label));
    }
  }

  for (const siteApp of state.siteAiApps.filter((app) => app.siteId === site.id && app.enabled)) {
    if (isExplicitSeoDirectoryContentForSite(site, "tool", siteApp.aiApp.slug)) addToolPath(site, paths, pathFromSlug("/tools", siteApp.aiApp.slug));
  }

  for (const item of state.toolMenuItems ?? []) {
    if (item.siteId === site.id && item.status === "active") {
      addPublicPath(state, site, paths, item.href || pathFromSlug("/tools", item.slug));
    }
  }
  if (isDreamshootSite(site)) {
    for (const path of DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS) addToolPath(site, paths, path);
  }

  const toolBlocks = site.pages.flatMap((page) => blocksFromPage(page.publishedJson, new Set(["tool_card", "catalog_pack", "feature_tab", "occasion", "package"])));
  for (const block of toolBlocks) {
    const href = blockHref(block);
    addPublicPath(state, site, paths, href);
  }
  collectInternalHrefPaths(state, site, paths, site.themeSettings.publishedJson);
  for (const page of site.pages) collectInternalHrefPaths(state, site, paths, page.publishedJson);

  return Array.from(paths);
}

async function readIndexableStateAndSites(): Promise<{ state: PlatformState; sites: Site[] } | undefined> {
  if (prefersLegacyStateForPersistenceBackend()) return readLegacyIndexableStateAndSites();

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

async function readLegacyIndexableStateAndSites(): Promise<{ state: PlatformState; sites: Site[] } | undefined> {
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
  if (!runtime) return fallbackUrlsForSite(DREAMSHOOT_FALLBACK_SITE, FALLBACK_INDEXABLE_PATHS);
  const site = runtime?.sites.find(isDreamshootSite);
  if (!site) return fallbackUrlsForSite(DREAMSHOOT_FALLBACK_SITE, FALLBACK_INDEXABLE_PATHS);
  return getSitemapUrlsForSite(runtime.state, site);
}

export async function getAidreamcapesSitemapUrls(): Promise<string[]> {
  const fallback = fallbackUrlsForSite(AIDREAMCAPES_FALLBACK_SITE, AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS);
  const runtime = await readIndexableStateAndSites();
  if (!runtime) return fallback;
  const site = runtime.sites.find(isAidreamcapesSite);
  return site ? getSitemapUrlsForSite(runtime.state, site) : fallback;
}

function getSitemapUrlsForSite(state: PlatformState, site: Site): string[] {
  const paths = site?.pages.map((page) => {
    const pageSeo = site.themeSettings.publishedJson.seo?.pages?.[page.id];
    const policySeo = policySeoForSite(site, page.slug);
    const canonicalPath = canonicalPublicPath(normalizePath(policySeo?.canonicalPath ?? pageSeo?.canonicalPath ?? page.slug));
    const isLegacyDuplicate = LEGACY_OR_DUPLICATE_PATHS.has(normalizePath(page.slug));
    return isIndexablePage(page) && !isLegacyDuplicate && !isBlockedPublicPath(canonicalPath) && pageSeo?.index !== false && policySeo?.index !== false ? canonicalDirectoryPathForSite(site, canonicalPath) : "";
  }).filter(Boolean) ?? FALLBACK_INDEXABLE_PATHS;

  paths.push(...collectExplicitSeoDirectoryPaths(site));
  paths.push(...collectDynamicIndexablePaths(state, site));

  for (const path of REQUIRED_INDEXABLE_TOOL_PATHS) {
    if (isExplicitSeoDirectoryContentForSite(site, "tool", path)) paths.push(canonicalToolPathForSite(site, path));
  }

  if (isDreamshootSite(site) || isAidreamcapesSite(site)) {
    paths.push(...REQUIRED_INDEXABLE_CONTENT_PATHS);
  }

  for (const path of REQUIRED_INDEXABLE_POLICY_PATHS) {
    const policySeo = policySeoForSite(site, path);
    if (!policySeo || policySeo.index === false) continue;
    if (isDreamshootSite(site) || isAidreamcapesSite(site)) paths.push(policySeo.canonicalPath);
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

function isLocalDevelopmentHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function prefersLegacyStateForPersistenceBackend(): boolean {
  const backend = (process.env.PERSISTENCE_BACKEND ?? "").trim().toLowerCase();
  return Boolean(backend && backend !== "postgres");
}

function fallbackUrlsForOrigin(origin: string, paths: string[]): string[] {
  return paths.map((path) => (path === "/" ? origin : `${origin}${path}`));
}

function fallbackPathsForSite(site: Site, basePaths: string[]): string[] {
  return Array.from(new Set([
    ...basePaths,
    ...collectExplicitSeoDirectoryPaths(site),
    ...REQUIRED_INDEXABLE_POLICY_PATHS
  ]));
}

function fallbackUrlsForSite(site: Site, basePaths: string[]): string[] {
  return fallbackUrlsForOrigin(siteOrigin(site), fallbackPathsForSite(site, basePaths));
}

function publicFallbackSitemapUrlsForHost(hosts: string[]): string[] {
  if (hosts.some(isAidreamcapesHost)) return fallbackUrlsForSite(AIDREAMCAPES_FALLBACK_SITE, AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS);
  if (hosts.some(isMydreamshootsHost)) return fallbackUrlsForSite(DREAMSHOOT_FALLBACK_SITE, FALLBACK_INDEXABLE_PATHS);
  if (hosts.some(isLocalDevelopmentHost)) {
    return [
      ...fallbackUrlsForSite(DREAMSHOOT_FALLBACK_SITE, FALLBACK_INDEXABLE_PATHS),
      ...fallbackUrlsForSite(AIDREAMCAPES_FALLBACK_SITE, AIDREAMCAPES_FALLBACK_INDEXABLE_PATHS)
    ];
  }
  return fallbackUrlsForSite(DREAMSHOOT_FALLBACK_SITE, FALLBACK_INDEXABLE_PATHS);
}

export async function getStorefrontSitemapUrlsForHost(hosts: string | null | undefined | Array<string | null | undefined>): Promise<string[]> {
  const normalizedHosts = normalizeHostCandidates(hosts);
  const normalizedHost = normalizedHosts[0] ?? "";
  if (!normalizedHost) return fallbackUrlsForSite(DREAMSHOOT_FALLBACK_SITE, FALLBACK_INDEXABLE_PATHS);
  const isLocalHostRequest = normalizedHosts.some(isLocalDevelopmentHost);
  const shouldUseLegacyStateFirst = prefersLegacyStateForPersistenceBackend() || isLocalHostRequest || process.env.NODE_ENV !== "production";
  const runtime = shouldUseLegacyStateFirst ? await readLegacyIndexableStateAndSites() : await readIndexableStateAndSites();
  if (!runtime) {
    return publicFallbackSitemapUrlsForHost(normalizedHosts);
  }
  if (isLocalHostRequest) return runtime.sites.flatMap((site) => getSitemapUrlsForSite(runtime.state, site));
  const site = runtime.sites.find((item) => normalizedHosts.some((host) => isHostForSite(item, host)));
  if (site) return getSitemapUrlsForSite(runtime.state, site);
  if (normalizedHosts.some(isAidreamcapesHost)) return getAidreamcapesSitemapUrls();
  if (normalizedHosts.some(isMydreamshootsHost)) return getMydreamshootsSitemapUrls();
  return runtime.sites.flatMap((item) => getSitemapUrlsForSite(runtime.state, item));
}

export function storefrontSitemapUrlForHost(hosts: string | null | undefined | Array<string | null | undefined>): string | undefined {
  const normalizedHost = normalizeFirstHost(hosts);
  if (isAidreamcapesHost(normalizedHost)) return AIDREAMCAPES_SITEMAP_URL;
  if (isMydreamshootsHost(normalizedHost)) return MYDREAMSHOOTS_SITEMAP_URL;
  return undefined;
}
