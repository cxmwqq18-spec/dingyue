import { readStorefrontPlatformStateFromDatabase, readStorefrontPlatformStateFromLegacyJson } from "@/lib/storefront-state";
import { MYDREAMSHOOTS_POLICY_SEO_BY_PATH, getMydreamshootsPolicySeo } from "@/lib/theme/policy-seo";
import type { CreativePack, PlatformState, SectionBlockInstance, Site, ThemePage, ThemePageJson, ThemeSettingValue } from "@/lib/types";

export const MYDREAMSHOOTS_ORIGIN = "https://www.mydreamshoots.com";
export const MYDREAMSHOOTS_SITEMAP_URL = `${MYDREAMSHOOTS_ORIGIN}/sitemap.xml`;

const DREAMSHOOT_SITE_ID = "site_dreamshoot";
const DREAMSHOOT_SITE_SLUGS = new Set(["mydreamshoots", "dreamshoot"]);
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
  "/policies/content",
  "/policies/cookies",
  "/help",
  "/blog",
  "/blog/preparing-source-photos"
];

const BLOCKED_PAGE_TYPES = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
const BLOCKED_PATH_PREFIXES = ["/account", "/admin", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/search"];
const LEGACY_OR_DUPLICATE_PATHS = new Set(["/cookie-policy", "/privacy-policy", "/terms-of-service"]);
const NON_INDEXABLE_TOOL_PATHS = new Set(["/tools/image-studio", "/tools/ai-image-studio", "/tools/travel-portraits"]);
const REQUIRED_INDEXABLE_TOOL_PATHS = ["/tools/headshot", "/tools/background-changer", "/tools/image-to-video"];
const REQUIRED_INDEXABLE_POLICY_PATHS = ["/policies/privacy", "/policies/terms", "/policies/cookies"];

function normalizePath(slug: string): string {
  const value = slug.trim();
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function sitemapUrl(path: string): string {
  return path === "/" ? MYDREAMSHOOTS_ORIGIN : `${MYDREAMSHOOTS_ORIGIN}${path}`;
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

function findDreamshootSite(state: PlatformState): Site | undefined {
  return state.sites.find((site) => site.status === "active" && isDreamshootSite(site)) ?? state.sites.find(isDreamshootSite);
}

function isIndexablePage(page: ThemePage): boolean {
  const path = normalizePath(page.slug);
  if (LEGACY_OR_DUPLICATE_PATHS.has(path)) return false;
  if (NON_INDEXABLE_TOOL_PATHS.has(path)) return false;
  if (BLOCKED_PAGE_TYPES.has(page.pageType)) return false;
  return !BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isIndexableToolPath(path: string): boolean {
  const normalized = normalizePath(path);
  return normalized.startsWith("/tools/") && !NON_INDEXABLE_TOOL_PATHS.has(normalized);
}

function addToolPath(paths: Set<string>, path: string): void {
  const normalized = normalizePath(path);
  if (isIndexableToolPath(normalized)) paths.add(normalized);
}

function collectionPathForPack(pack: CreativePack): string {
  return pathFromSlug("/collections", pack.categoryRecord?.slug || pack.category || pack.name);
}

function collectDynamicIndexablePaths(state: PlatformState, site: Site): string[] {
  const paths = new Set<string>();
  const activePacks = state.creativePacks.filter((pack) => pack.siteId === site.id && pack.status === "active");

  for (const pack of activePacks) {
    const collectionPath = collectionPathForPack(pack);
    if (collectionPath) paths.add(collectionPath);
    addToolPath(paths, pathFromSlug("/tools", pack.aiAppSlug));
  }

  for (const siteApp of state.siteAiApps.filter((app) => app.siteId === site.id && app.enabled)) {
    addToolPath(paths, pathFromSlug("/tools", siteApp.aiApp.slug));
  }

  const toolBlocks = site.pages.flatMap((page) => blocksFromPage(page.publishedJson, new Set(["tool_card", "catalog_pack", "feature_tab", "occasion", "package"])));
  for (const block of toolBlocks) {
    const href = blockHref(block);
    if (href.startsWith("/tools/")) addToolPath(paths, href);
  }

  return Array.from(paths);
}

async function readDreamshootStateAndSite(): Promise<{ state: PlatformState; site: Site } | undefined> {
  try {
    const state = await readStorefrontPlatformStateFromDatabase();
    const site = findDreamshootSite(state);
    if (site) return { state, site };
  } catch {
    // Fall through to the legacy JSON state so robots/sitemap stay available during data migrations.
  }

  try {
    const state = await readStorefrontPlatformStateFromLegacyJson();
    const site = findDreamshootSite(state);
    return site ? { state, site } : undefined;
  } catch {
    return undefined;
  }
}

export async function getMydreamshootsSitemapUrls(): Promise<string[]> {
  const runtime = await readDreamshootStateAndSite();
  const site = runtime?.site;
  const paths = site?.pages.map((page) => {
    const pageSeo = site.themeSettings.publishedJson.seo?.pages?.[page.id];
    const policySeo = getMydreamshootsPolicySeo(page.slug);
    const canonicalPath = normalizePath(policySeo?.canonicalPath ?? pageSeo?.canonicalPath ?? page.slug);
    const isLegacyDuplicate = LEGACY_OR_DUPLICATE_PATHS.has(normalizePath(page.slug));
    return isIndexablePage(page) && !isLegacyDuplicate && pageSeo?.index !== false && policySeo?.index !== false ? canonicalPath : "";
  }).filter(Boolean) ?? FALLBACK_INDEXABLE_PATHS;

  if (runtime) {
    paths.push(...collectDynamicIndexablePaths(runtime.state, runtime.site));
  }

  for (const path of REQUIRED_INDEXABLE_TOOL_PATHS) {
    paths.push(path);
  }

  for (const path of REQUIRED_INDEXABLE_POLICY_PATHS) {
    const policySeo = MYDREAMSHOOTS_POLICY_SEO_BY_PATH[path];
    if (policySeo?.index !== false) paths.push(policySeo.canonicalPath);
  }

  return Array.from(new Set(paths.map(sitemapUrl))).sort((a, b) => {
    if (a === MYDREAMSHOOTS_ORIGIN) return -1;
    if (b === MYDREAMSHOOTS_ORIGIN) return 1;
    return a.localeCompare(b);
  });
}
