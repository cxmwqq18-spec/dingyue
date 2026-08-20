import { readStorefrontPlatformStateFromDatabase, readStorefrontPlatformStateFromLegacyJson } from "@/lib/storefront-state";
import { getSiteByHostCandidatesFromState } from "@/lib/domain-routing";
import { canonicalSeoDirectoryPathForSite, canonicalSeoDirectorySlugForSite, getExplicitSeoDirectorySlugsForSite, isExplicitSeoDirectoryContentForSite, withSeoDirectorySeo } from "@/lib/dreamshoot-seo-content";
import {
  MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS,
  creativePackCollectionHref,
  isMydreamshootsVideoGenerationSlug,
  parsePublicCollectionRouteForSite,
  parsePublicVideoGenerationRouteForSite,
  publicCollectionPathForSite,
  publicVideoGenerationPathForSite
} from "@/lib/photo-package-taxonomy";
import { resolveMediaAssetUrl } from "@/lib/media";
import { storefrontCreativePackImageAlt, storefrontMediaAltLocaleForSite, storefrontMediaBrandName } from "@/lib/storefront-media-alt";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { createPublishedSiteSnapshot, resolveEffectivePublishedPage, resolvePublishedRouteDisposition, resolvePublishedSeoEntity, resolvePublishedStorefrontContext, resolvePublicCollectionItems } from "@/lib/storefront-context";
import { publicationSnapshotIntegrity } from "@/lib/publication-snapshot-integrity";
import { pageCopyFromPublishedPageEntity } from "@/lib/mydreamshoots-published-contract";
import type { CreativePack, PlatformState, PublishedLeafRouteProjection, PublishedSeoSnapshot, SectionBlockInstance, Site, ThemePage, ThemePageJson, ThemeSettingValue } from "@/lib/types";

export const MYDREAMSHOOTS_ORIGIN = "https://www.mydreamshoots.com";
export const MYDREAMSHOOTS_SITEMAP_URL = `${MYDREAMSHOOTS_ORIGIN}/sitemap.xml`;
export const AIDREAMCAPES_ORIGIN = "https://www.aidreamcapes.com";
export const AIDREAMCAPES_SITEMAP_URL = `${AIDREAMCAPES_ORIGIN}/sitemap.xml`;
export const AIDREAMSHOOTS_EU_ORIGIN = "https://aidreamshoots.eu";
export const AIDREAMSHOOTS_EU_SITEMAP_URL = `${AIDREAMSHOOTS_EU_ORIGIN}/sitemap.xml`;
export const AIDREAMCAPES_EU_ORIGIN = "https://aidreamcapes.eu";
export const AIDREAMCAPES_EU_SITEMAP_URL = `${AIDREAMCAPES_EU_ORIGIN}/sitemap.xml`;

const DREAMSHOOT_SITE_ID = "site_dreamshoot";
const DREAMSHOOT_SITE_SLUGS = new Set(["mydreamshoots", "dreamshoot"]);
const AIDREAMCAPES_SITE_ID = "site_aidreamcapes";
const AIDREAMCAPES_SITE_SLUGS = new Set(["aidreamcapes"]);
const GROWNSTRIDE_HOSTS = new Set(["grownstride.com", "www.grownstride.com", "test.grownstride.com"]);
const GROWNSTRIDE_RESERVED_HOSTS = new Set(["grownstride.com", "www.grownstride.com"]);

function cleanText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() || fallback : fallback;
}

const BLOCKED_PAGE_TYPES = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
const BLOCKED_PATH_PREFIXES = ["/404", "/account", "/admin", "/album", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/platform", "/search", "/site"];
const NON_PAGE_PATH_PREFIXES = ["/_next", "/assets", "/fonts", "/images", "/media", "/robots.txt", "/sitemap.xml", "/videos"];
const LEGACY_OR_DUPLICATE_PATHS = new Set(["/cookie-policy", "/privacy-policy", "/terms-of-service", "/shipping-policy", "/delivery-policy"]);
const NON_INDEXABLE_TOOL_PATHS = new Set(["/tools/image-studio", "/tools/ai-image-studio", "/tools/image-generator", "/tools/image_generator", "/tools/travel-portraits"]);
const REQUIRED_INDEXABLE_TOOL_PATHS = [
  "/tools/photo-ai",
  "/tools/video-ai",
  "/tools/ai-photo-edit",
  "/tools/headshot",
  "/tools/background-changer",
  "/tools/image-to-video",
  "/tools/background-remover",
  "/tools/photo-enhancer",
  "/tools/magic-upscaler",
  "/tools/virtual-try-on"
];
const DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS = [
  ...MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS.map((slug) => `/ai-video-generation/${slug}`)
];
const DREAMSHOOT_DEFAULT_PUBLIC_TOOL_SLUGS = new Set<string>(MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS);
const REQUIRED_INDEXABLE_CONTENT_PATHS = ["/about-us", "/contact-us", "/best-packages", "/best-ai-image", "/best-ai-video"];
const REQUIRED_INDEXABLE_POLICY_PATHS = ["/privacy", "/terms", "/cookies", "/refunds", "/content", "/shipping", "/children-privacy", "/state-privacy"];
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
const AIDREAMCAPES_LEGACY_BLOG_CATEGORY_CANONICAL_PATHS: Record<string, string> = {
  "fan-scene-albums": "/blog/private-fan-scene-album-photo-package-guide",
  "private-fan-scene-albums": "/blog/private-fan-scene-album-photo-package-guide",
  "backstage-meetup-portraits": "/blog/backstage-meetup-portraits-photo-package-guide",
  "supporter-photo-walls": "/blog/creator-supporter-photo-wall-photo-package-guide",
  "fan-keepsake-card-sets": "/blog/fan-keepsake-card-set-photo-package-guide",
  "game-day-group-photos": "/blog/game-day-group-portraits-photo-package-guide",
  "game-day-group-portraits": "/blog/game-day-group-portraits-photo-package-guide",
  "stadium-night-fan-sets": "/blog/stadium-night-fan-set-photo-package-guide",
  "watch-party-albums": "/blog/championship-watch-party-album-photo-package-guide",
  "premiere-style-portraits": "/blog/premiere-flash-portraits-photo-package-guide",
  "premiere-flash-portraits": "/blog/premiere-flash-portraits-photo-package-guide",
  "vip-arrival-photo-sets": "/blog/vip-arrival-photo-set-photo-package-guide",
  "award-night-keepsake-albums": "/blog/award-night-keepsake-album-photo-package-guide",
  "christmas-holiday-albums": "/blog/christmas-group-album-photo-package-guide",
  "christmas-group-albums": "/blog/christmas-group-album-photo-package-guide",
  "cozy-card-portrait-sets": "/blog/cozy-card-portrait-set-photo-package-guide",
  "winter-fan-greeting-albums": "/blog/winter-fan-greeting-album-photo-package-guide",
  "thanksgiving-memory-sets": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "thanksgiving-table-keepsakes": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "gratitude-group-portraits": "/blog/gratitude-group-portrait-album-photo-package-guide",
  "friendsgiving-memory-sets": "/blog/friendsgiving-memory-set-photo-package-guide",
  "halloween-party-portraits": "/blog/halloween-party-portrait-set-photo-package-guide",
  "halloween-party-portrait-sets": "/blog/halloween-party-portrait-set-photo-package-guide",
  "costume-cast-photo-albums": "/blog/costume-cast-photo-album-photo-package-guide",
  "seasonal-celebration-photos": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "birthday-fan-moment-sets": "/blog/birthday-fan-moment-set-photo-package-guide",
  "new-year-countdown-albums": "/blog/new-year-countdown-group-album-photo-package-guide"
};
const AIDREAMCAPES_LEGACY_BLOG_DIRECT_CANONICAL_PATHS: Record<string, string> = {
  "fan-scene-photo-albums-guide": "/blog/private-fan-scene-album-photo-package-guide",
  "game-day-group-portraits-guide": "/blog/game-day-group-portraits-photo-package-guide",
  "premiere-style-photo-sets-guide": "/blog/premiere-flash-portraits-photo-package-guide",
  "holiday-memory-albums-guide": "/blog/christmas-group-album-photo-package-guide",
  "thanksgiving-keepsake-sets-category-guide": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "halloween-party-portraits-category-guide": "/blog/halloween-party-portrait-set-photo-package-guide",
  "seasonal-celebration-photos-category-guide": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "permission-safe-fan-scene-references": "/blog/family-occasion-portrait-album-photo-package-guide",
  "private-album-credit-planning": "/blog/private-fan-scene-album-photo-package-guide"
};
const AIDREAMCAPES_LEGACY_BLOG_TOOL_CANONICAL_PATHS: Record<string, string> = {
  "fan-scene-builders-guide": "/blog/private-fan-scene-album-photo-package-guide",
  "game-day-builders-guide": "/blog/game-day-group-portraits-photo-package-guide",
  "premiere-creator-tools-guide": "/blog/premiere-flash-portraits-photo-package-guide",
  "holiday-album-tools-guide": "/blog/christmas-group-album-photo-package-guide",
  "occasion-card-tools-guide": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "safety-prep-tools-guide": "/blog/family-occasion-portrait-album-photo-package-guide",
  "fan-scene-album-builder": "/blog/private-fan-scene-album-photo-package-guide",
  "backstage-meetup-scene-builder": "/blog/backstage-meetup-portraits-photo-package-guide",
  "supporter-photo-wall-maker": "/blog/creator-supporter-photo-wall-photo-package-guide",
  "fan-keepsake-card-maker": "/blog/fan-keepsake-card-set-photo-package-guide",
  "game-day-group-portrait-maker": "/blog/game-day-group-portraits-photo-package-guide",
  "stadium-night-fan-set-maker": "/blog/stadium-night-fan-set-photo-package-guide",
  "watch-party-album-builder": "/blog/championship-watch-party-album-photo-package-guide",
  "premiere-portrait-set-builder": "/blog/premiere-flash-portraits-photo-package-guide",
  "vip-arrival-photo-maker": "/blog/vip-arrival-photo-set-photo-package-guide",
  "award-night-album-studio": "/blog/award-night-keepsake-album-photo-package-guide",
  "new-year-countdown-album-maker": "/blog/new-year-countdown-group-album-photo-package-guide",
  "christmas-group-album-studio": "/blog/christmas-group-album-photo-package-guide",
  "cozy-card-portrait-maker": "/blog/cozy-card-portrait-set-photo-package-guide",
  "winter-fan-greeting-maker": "/blog/winter-fan-greeting-album-photo-package-guide",
  "thanksgiving-keepsake-set-maker": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "friendsgiving-memory-maker": "/blog/friendsgiving-memory-set-photo-package-guide",
  "halloween-party-portrait-maker": "/blog/halloween-party-portrait-set-photo-package-guide",
  "costume-cast-album-builder": "/blog/costume-cast-photo-album-photo-package-guide",
  "birthday-fan-moment-maker": "/blog/birthday-fan-moment-set-photo-package-guide",
  "permission-safe-photo-planner": "/blog/family-occasion-portrait-album-photo-package-guide"
};
const AIDREAMCAPES_LEGACY_BLOG_VIDEO_CANONICAL_PATHS: Record<string, string> = {
  "coastal-motion": "/blog/private-fan-scene-album-photo-package-guide",
  "memory-film": "/blog/private-fan-scene-album-photo-package-guide",
  "profile-travel": "/blog/private-fan-scene-album-photo-package-guide",
  "route-motion": "/blog/private-fan-scene-album-photo-package-guide"
};

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

type SitemapImageEntry = {
  loc: string;
  title?: string;
  caption?: string;
};

type SitemapEntry = {
  loc: string;
  images: SitemapImageEntry[];
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
};

function normalizeSitemapDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function pageContentLastModified(page: ThemePage, fallback: unknown): string | undefined {
  const articleUpdatedAt = page.publishedJson.sections?.blog_detail_1?.settings?.updatedAt;
  return normalizeSitemapDate(articleUpdatedAt ?? page.updatedAt ?? fallback);
}

function isCollectionDirectoryPath(path: string): boolean {
  return path === "/collections" || path.startsWith("/collections/") || path === "/ai-image-generation" || path.startsWith("/ai-image-generation/");
}

function isVideoGenerationDirectoryPath(site: Site, path: string): boolean {
  return Boolean(parsePublicVideoGenerationRouteForSite(site, path));
}

function sitemapChangeFrequencyForPath(path: string): SitemapEntry["changefreq"] {
  const normalized = normalizePath(path);
  if (normalized === "/" || normalized === "/collections" || normalized === "/ai-image-generation" || normalized === "/ai-video-generation" || normalized === "/tools" || normalized === "/blog") return "daily";
  if (REQUIRED_INDEXABLE_POLICY_PATHS.includes(normalized)) return "monthly";
  return "weekly";
}

function sitemapPriorityForPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") return "1.0";
  if (normalized === "/tools" || normalized === "/collections" || normalized === "/ai-image-generation" || normalized === "/ai-video-generation" || normalized === "/blog") return "0.9";
  if (normalized.startsWith("/tools/") || normalized.startsWith("/collections/") || normalized.startsWith("/ai-image-generation/") || normalized.startsWith("/ai-video-generation/")) return "0.8";
  return "0.7";
}

function isSitemapImageKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return Boolean(
    normalized &&
      (
        normalized === "src" ||
        normalized === "image" ||
        normalized === "images" ||
        normalized === "imageurl" ||
        normalized === "imageurls" ||
        normalized === "ogimage" ||
        normalized === "backgroundimage" ||
        normalized === "backgroundimageurl" ||
        normalized === "bgimage" ||
        normalized === "bgimageurl" ||
        normalized === "poster" ||
        normalized === "posterurl" ||
        normalized === "thumbnail" ||
        normalized === "thumbnailurl" ||
        normalized === "avatar" ||
        normalized === "avatarurl" ||
        normalized === "logo" ||
        normalized === "logourl" ||
        normalized === "cover" ||
        normalized === "coverurl" ||
        normalized === "hero" ||
        normalized === "heroimage" ||
        normalized === "heroimageurl" ||
        normalized === "photo" ||
        normalized === "photourl" ||
        normalized === "picture" ||
        normalized === "pictureurl" ||
        /(?:image|images|imageurl|img|logo|avatar|cover|poster|thumbnail|banner|hero|photo|picture|src|url)$/i.test(normalized)
      )
  );
}

function splitSitemapImageCandidates(value: string): string[] {
  return value
    .split(/\n|\|/)
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function absoluteMediaUrl(site: Site, value: string | undefined): string {
  const resolved = cleanText(resolveMediaAssetUrl(site, value));
  if (!resolved) return "";
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) return resolved;
  const origin = siteOrigin(site) || MYDREAMSHOOTS_ORIGIN;
  return `${origin}${resolved.startsWith("/") ? resolved : `/${resolved}`}`;
}

function comparableSitemapImageUrl(value: string): string {
  return cleanText(value).split(/[?#]/)[0];
}

function packSitemapImages(site: Site, pack: CreativePack, limit = 8): SitemapImageEntry[] {
  const imagePaths = [pack.imageUrl, ...(pack.galleryImages ?? [])]
    .map((value) => absoluteMediaUrl(site, value))
    .filter(Boolean);
  const seen = new Set<string>();
  const images: SitemapImageEntry[] = [];

  imagePaths.forEach((loc, index) => {
    if (images.length >= limit) return;
    const comparable = comparableSitemapImageUrl(loc);
    if (!comparable || seen.has(comparable)) return;
    seen.add(comparable);
    const galleryIndex = index - 1;
    const title = index === 0
      ? storefrontCreativePackImageAlt({
          brand: storefrontMediaBrandName(site),
          imageUrl: loc,
          locale: storefrontMediaAltLocaleForSite(site),
          pack,
          role: "cover"
        })
      : storefrontCreativePackImageAlt({
          brand: storefrontMediaBrandName(site),
          imageUrl: loc,
          index: galleryIndex,
          locale: storefrontMediaAltLocaleForSite(site),
          pack,
          role: "gallery"
        });
    const caption = cleanText(pack.headline || pack.description, `${pack.name} photo package preview`);
    images.push({
      loc,
      ...(title ? { title } : {}),
      ...(caption ? { caption } : {})
    });
  });

  return images;
}

function appendSitemapImages(entry: SitemapEntry, images: SitemapImageEntry[]): void {
  const seen = new Set(entry.images.map((image) => comparableSitemapImageUrl(image.loc)).filter(Boolean));
  for (const image of images) {
    const comparable = comparableSitemapImageUrl(image.loc);
    if (!comparable || seen.has(comparable)) continue;
    seen.add(comparable);
    entry.images.push(image);
  }
}

function imageSitemapUrl(site: Site, value: string | undefined): string {
  const resolved = absoluteMediaUrl(site, value);
  if (!resolved) return "";
  const pathname = cleanText(resolved).split(/[?#]/)[0].toLowerCase();
  return /\.(?:avif|jpe?g|png|webp)(?:$)/i.test(pathname) ? resolved : "";
}

function sitemapImageTitleForPage(page: ThemePage): string {
  const seoTitle = cleanText(page.publishedJson.seo?.title)
    .replace(/\s*[|-]\s*(?:myDreamshoots|MyDreamShoots|Aidreamcapes)\s*$/i, "")
    .trim();
  const title = cleanText(seoTitle, cleanText(page.title, "MyDreamShoots page image"));
  return title.split(/\s+/).length >= 8
    ? title
    : `${title} for private AI photo creation workflows`;
}

function collectPageSitemapImages(site: Site, page: ThemePage, limit = 6): SitemapImageEntry[] {
  const images: SitemapImageEntry[] = [];
  const seen = new Set<string>();
  const title = sitemapImageTitleForPage(page);
  const caption = cleanText(page.publishedJson.seo?.description, title);

  const pushImage = (value: string | undefined, imageTitle = "", imageCaption = "") => {
    const loc = imageSitemapUrl(site, value);
    if (!loc) return;
    const comparable = comparableSitemapImageUrl(loc);
    if (!comparable || seen.has(comparable)) return;
    seen.add(comparable);
    const finalTitle = cleanText(imageTitle, title);
    const finalCaption = cleanText(imageCaption, caption);
    images.push({
      loc,
      ...(finalTitle ? { title: finalTitle } : {}),
      ...(finalCaption ? { caption: finalCaption } : {})
    });
  };

  pushImage(page.publishedJson.seo?.ogImage, title, caption);

  const visit = (value: unknown, key?: string): void => {
    if (images.length >= limit) return;
    if (typeof value === "string") {
      if (!key || !isSitemapImageKey(key)) return;
      for (const candidate of splitSitemapImageCandidates(value)) {
        pushImage(candidate, images.length === 0 ? title : "", images.length === 0 ? caption : "");
        if (images.length >= limit) return;
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (images.length >= limit) return;
        visit(item, key);
      }
      return;
    }
    if (!value || typeof value !== "object") return;
    for (const [childKey, childValue] of Object.entries(value)) {
      if (images.length >= limit) return;
      visit(childValue, childKey);
    }
  };

  visit(page.publishedJson);
  return images.slice(0, limit);
}

function pageSitemapPathForSite(site: Site, page: ThemePage): string {
  if (page.siteId !== site.id) return "";
  const pageSeo = page.publishedJson.seo;
  const canonicalPath = canonicalPublicPath(normalizePath(pageSeo?.canonical ?? pageSeo?.canonicalPath ?? page.slug));
  const isLegacyDuplicate = LEGACY_OR_DUPLICATE_PATHS.has(normalizePath(page.slug));
  return isIndexablePage(page) && !isLegacyDuplicate && !isBlockedPublicPathForSite(site, canonicalPath) && pageSeo?.robots?.index !== false && pageSeo?.index !== false
    ? canonicalDirectoryPathForSite(site, canonicalPath)
    : "";
}

export function sitemapEntriesForSite(state: PlatformState, site: Site): SitemapEntry[] {
  const snapshot = createPublishedSiteSnapshot(state, site);
  const collectionItems = resolvePublicCollectionItems(snapshot);
  const entries = new Map<string, SitemapEntry>();
  for (const page of snapshot.pages) {
    const canonicalPath = canonicalPathForSitemapPage(page);
    if (resolvePublishedRouteDisposition(snapshot, canonicalPath).kind !== "render") continue;
    const effective = resolveEffectivePublishedPage(snapshot, canonicalPath);
    if (effective.routeDisposition.kind !== "render" || !effective.indexability.sitemapEligible) continue;
    const loc = effective.context.seo.canonicalUrl;
    const path = effective.context.seo.canonicalPath;
    const standardMedia = site.id === "site_dreamshoot"
      ? resolvePublishedSeoEntity(snapshot, path).standardPageMedia
      : undefined;
    entries.set(loc, {
      loc,
      images: standardMedia?.status === "ready"
        ? standardMedia.sitemapImages.map((image, index) => ({
            loc: absoluteMediaUrl(site, image),
            title: index === 0 ? standardMedia.primaryImageAlt : sitemapImageTitleForPage(page)
          })).filter((image) => image.loc)
        : collectPageSitemapImages(site, page),
      lastmod: pageContentLastModified(page, snapshot.publication?.publishedAt),
      changefreq: sitemapChangeFrequencyForPath(path),
      priority: sitemapPriorityForPath(path)
      });
  }
  const collectionPath = publicCollectionPathForSite(site, "");
  const collectionPage = snapshot.pages.find((page) => canonicalDirectoryPathForSite(site, canonicalPathForSitemapPage(page)) === canonicalDirectoryPathForSite(site, collectionPath));
  if (collectionPage && collectionItems.length) {
    const effective = resolveEffectivePublishedPage(snapshot, collectionPage.slug);
    if (effective.routeDisposition.kind === "render" && effective.indexability.sitemapEligible) {
      const loc = effective.context.seo.canonicalUrl;
      const entry = entries.get(loc);
      if (entry) entry.images = collectionItems.flatMap((item) => packSitemapImages(site, item.source, 1));
    }
  }
  if (site.id === "site_dreamshoot" && collectionPage) {
    for (const route of snapshot.publishedRoutes.filter((candidate): candidate is PublishedLeafRouteProjection =>
      candidate.disposition === "render" && candidate.routeKind === "ai-image-theme-leaf" && candidate.indexable && candidate.sitemapEligible
    )) {
      const resolved = resolvePublishedSeoEntity(snapshot, route.canonicalPath);
      const media = resolved.pageMedia;
      if (!media || media.status !== "ready") continue;
      const pageEntity = resolved.pageEntity;
      const publishedCopy = pageEntity ? pageCopyFromPublishedPageEntity(pageEntity, snapshot.publishedLinkRefs) : undefined;
      if (!publishedCopy) continue;
      const page = {
        ...collectionPage,
        publishedJson: withSeoDirectorySeo(collectionPage.publishedJson, "collection", route.canonicalSlug, site, publishedCopy)
      };
      const context = resolvePublishedStorefrontContext(snapshot, page);
      const effective = {
        ...resolveEffectivePublishedPage(snapshot, collectionPage.slug),
        context,
        indexability: {
          index: true,
          follow: true,
          sitemapEligible: true
        }
      };
      const loc = context.seo.canonicalUrl;
      if (!effective.indexability.sitemapEligible || resolvePublishedRouteDisposition(snapshot, route.canonicalPath).kind !== "render") continue;
      const pack = snapshot.creativePacks.find((candidate) => candidate.id === media.packId);
      const mediaImages = [media.primaryImage, ...media.galleryImages]
        .map((value, index) => ({
          loc: absoluteMediaUrl(site, value),
          title: media.imageAlts[index]
        }))
        .filter((image) => image.loc);
      entries.set(loc, {
        loc,
        images: mediaImages.length ? mediaImages : pack ? packSitemapImages(site, pack) : [],
        lastmod: normalizeSitemapDate(snapshot.publication?.publishedAt),
        changefreq: sitemapChangeFrequencyForPath(route.canonicalPath),
        priority: sitemapPriorityForPath(route.canonicalPath)
      });
    }
  }
  return [...entries.values()].sort((left, right) => left.loc.localeCompare(right.loc));
}

function canonicalPathForSitemapPage(page: ThemePage): string {
  return normalizePath(page.publishedJson.seo?.canonical ?? page.publishedJson.seo?.canonicalPath ?? page.slug);
}

function slugifySegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pathFromSlug(prefix: "/collections" | "/tools", slug: string): string {
  const normalized = slugifySegment(slug.replace(/^\/?(collections|tools)\//, ""));
  return normalized ? `${prefix}/${normalized}` : "";
}

function collectionSlugFromDirectoryPath(site: Site, path: string): string {
  const route = parsePublicCollectionRouteForSite(site, path);
  if (route) return route.collectionSlug;
  const normalized = normalizePath(path);
  if (normalized === "/collections" || normalized === "/ai-image-generation") return "";
  if (normalized.startsWith("/collections/")) return slugifySegment(normalized.slice("/collections/".length));
  if (normalized.startsWith("/ai-image-generation/")) return slugifySegment(normalized.split("/").filter(Boolean).at(-1) ?? "");
  return "";
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
  const normalizedPath = normalizePath(path);
  if (isDreamshootSite(site) && (normalizedPath === "/tools" || normalizedPath.startsWith("/tools/"))) {
    const toolSlug = normalizedPath.startsWith("/tools/") ? normalizedPath.slice("/tools/".length) : "";
    if (!toolSlug) return publicVideoGenerationPathForSite(site, "");
    if (isMydreamshootsVideoGenerationSlug(toolSlug)) return publicVideoGenerationPathForSite(site, toolSlug);
  }
  const normalized = canonicalSeoDirectoryPathForSite(site, "tool", path);
  if (isAidreamcapesSite(site)) return AIDREAMCAPES_LEGACY_TOOL_CANONICAL_PATHS.get(normalized) ?? normalized;
  if (isDreamshootSite(site)) return DREAMSHOOT_LEGACY_TOOL_CANONICAL_PATHS.get(normalized) ?? normalized;
  return normalized;
}

function legacyBlogCanonicalPath(
  articleSlug: string,
  categoryPaths: Record<string, string>,
  toolPaths: Record<string, string>,
  videoPaths: Record<string, string>,
  directPaths: Record<string, string> = {}
): string | undefined {
  const normalizedSlug = articleSlug.trim().toLowerCase();
  const directPath = directPaths[normalizedSlug] ?? toolPaths[normalizedSlug];
  if (directPath) return directPath;
  if (normalizedSlug.endsWith("-photo-package-guide")) return categoryPaths[normalizedSlug.slice(0, -"-photo-package-guide".length)];
  if (normalizedSlug.endsWith("-tool-guide")) return toolPaths[normalizedSlug.slice(0, -"-tool-guide".length)];
  if (normalizedSlug.endsWith("-video-theme-guide")) return videoPaths[normalizedSlug.slice(0, -"-video-theme-guide".length)];
  return undefined;
}

function canonicalBlogPathForSite(site: Site, path: string): string {
  const normalized = normalizePath(path);
  if (!normalized.startsWith("/blog/")) return normalized;
  const articleSlug = normalized.slice("/blog/".length);
  const canonicalPath = isAidreamcapesSite(site)
    ? legacyBlogCanonicalPath(
      articleSlug,
      AIDREAMCAPES_LEGACY_BLOG_CATEGORY_CANONICAL_PATHS,
      AIDREAMCAPES_LEGACY_BLOG_TOOL_CANONICAL_PATHS,
      AIDREAMCAPES_LEGACY_BLOG_VIDEO_CANONICAL_PATHS,
      AIDREAMCAPES_LEGACY_BLOG_DIRECT_CANONICAL_PATHS
    )
    : undefined;
  return canonicalPath ?? normalized;
}

function canonicalDirectoryPathForSite(site: Site, path: string): string {
  const normalized = normalizePath(path);
  if (isCollectionDirectoryPath(normalized)) return publicCollectionPathForSite(site, collectionSlugFromDirectoryPath(site, normalized));
  if (isVideoGenerationDirectoryPath(site, normalized)) return parsePublicVideoGenerationRouteForSite(site, normalized)?.canonicalPath ?? normalized;
  if (normalized.startsWith("/tools/")) return canonicalToolPathForSite(site, normalized);
  if (normalized === "/tools") return canonicalToolPathForSite(site, normalized);
  if (normalized.startsWith("/blog/")) return canonicalBlogPathForSite(site, normalized);
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

function isBlockedPublicPathForSite(site: Site, path: string): boolean {
  if (isDreamshootSite(site)) {
    if (path === "/collections" || path.startsWith("/collections/") || path === "/tools" || path.startsWith("/tools/") || path === "/ai-photoshoot" || path.startsWith("/ai-photoshoot/")) return true;
    if (path.startsWith("/ai-image-generation/") && !parsePublicCollectionRouteForSite(site, path)) return true;
    if (path.startsWith("/ai-video-generation/") && !isPublicVideoGenerationSitemapPath(site, path)) return true;
  }
  return isBlockedPublicPath(path);
}

function isPublicVideoGenerationSitemapPath(site: Site, path: string): boolean {
  if (isDreamshootSite(site)) return false;
  return Boolean(parsePublicVideoGenerationRouteForSite(site, path));
}

function isIndexableSeoDirectoryPath(site: Site, path: string): boolean {
  const normalized = canonicalDirectoryPathForSite(site, path);
  if (isCollectionDirectoryPath(normalized)) {
    const route = parsePublicCollectionRouteForSite(site, normalized);
    if (route?.kind === "directory") return true;
    return isExplicitSeoDirectoryContentForSite(site, "collection", normalized);
  }
  if (isVideoGenerationDirectoryPath(site, normalized)) return isPublicVideoGenerationSitemapPath(site, normalized);
  if (normalized.startsWith("/tools/")) {
    if (isDreamshootSite(site)) return false;
    if (isExplicitSeoDirectoryContentForSite(site, "tool", normalized)) return true;
    return false;
  }
  return true;
}

function pageSeoForPath(site: Site, path: string) {
  const normalized = canonicalPublicPath(normalizePath(path));
  return pagesForSite(site)
    .map((page) => {
      const jsonSeo = page.publishedJson.seo;
      const canonicalPath = canonicalPublicPath(normalizePath(jsonSeo?.canonical ?? jsonSeo?.canonicalPath ?? page.slug));
      return canonicalDirectoryPathForSite(site, canonicalPath) === canonicalDirectoryPathForSite(site, normalized)
        ? { page, jsonSeo }
        : undefined;
    })
    .find((item): item is NonNullable<typeof item> => Boolean(item));
}

function isSitemapIndexablePath(site: Site, path: string): boolean {
  const normalized = canonicalDirectoryPathForSite(site, canonicalPublicPath(normalizePath(path)));
  if (isBlockedPublicPathForSite(site, normalized)) return false;

  const pageMatch = pageSeoForPath(site, normalized);
  if (pageMatch) {
    if (!isIndexablePage(pageMatch.page)) return false;
    if (pageMatch.jsonSeo?.robots?.index === false || pageMatch.jsonSeo?.index === false) return false;
  }

  return isIndexableSeoDirectoryPath(site, normalized);
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
  if ((normalized === "/collections" || normalized === "/ai-image-generation") && search) {
    const category = new URLSearchParams(search).get("category");
    if (category) normalized = publicCollectionPathForSite(site, category);
  }

  normalized = canonicalDirectoryPathForSite(site, canonicalPublicPath(normalized));
  return isBlockedPublicPathForSite(site, normalized) ? "" : normalized;
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

function pagesForSite(site: Site): ThemePage[] {
  return (site.pages ?? []).filter((page) => page.siteId === site.id);
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
    (normalizedHost === "aidreamcapes.com" && isAidreamcapesSite(site)) ||
    (normalizedHost === "aidreamshoots.eu" && site.id === "site_mydreamshoots_xby") ||
    (normalizedHost === "www.aidreamshoots.eu" && site.id === "site_mydreamshoots_xby") ||
    (normalizedHost === "aidreamcapes.eu" && site.id === "site_aidreamcapes_xby") ||
    (normalizedHost === "www.aidreamcapes.eu" && site.id === "site_aidreamcapes_xby");
}

function isMydreamshootsHost(host: string): boolean {
  return host === "www.mydreamshoots.com" || host === "mydreamshoots.com";
}

function isGrownstrideHost(host: string): boolean {
  return GROWNSTRIDE_HOSTS.has(host);
}

function isReservedGrownstrideHost(host: string): boolean {
  return GROWNSTRIDE_RESERVED_HOSTS.has(host);
}

function isAidreamcapesHost(host: string): boolean {
  return host === "www.aidreamcapes.com" || host === "aidreamcapes.com";
}

function isAidreamshootsEuHost(host: string): boolean {
  return host === "www.aidreamshoots.eu" || host === "aidreamshoots.eu";
}

function isAidreamcapesEuHost(host: string): boolean {
  return host === "www.aidreamcapes.eu" || host === "aidreamcapes.eu";
}

function findIndexableSites(state: PlatformState): Site[] {
  const candidates = state.sites.filter((site) => isDreamshootSite(site) || isAidreamcapesSite(site) || isSpanishStorefrontSite(site));
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
  if (isDreamshootSite(site)) return false;
  return (normalized === "/tools" || normalized.startsWith("/tools/")) && !isBlockedPublicPath(normalized);
}

function addToolPath(site: Site, paths: Set<string>, path: string): void {
  const normalized = canonicalToolPathForSite(site, path);
  if (isVideoGenerationDirectoryPath(site, normalized)) {
    if (isPublicVideoGenerationSitemapPath(site, normalized)) paths.add(normalized);
    return;
  }
  if (isIndexableToolPath(site, normalized)) paths.add(normalized);
}

function collectionPathsForPack(pack: CreativePack): string[] {
  return Array.from(new Set([
    creativePackCollectionHref(pack),
    pack.categoryRecord?.parent?.slug,
    pack.categoryRecord?.slug,
    pack.category,
    pack.name
  ].filter(Boolean).map((slug) => publicCollectionPathForSite(pack, String(slug))).filter(Boolean)));
}

function collectionSlugsForPack(site: Site, pack: CreativePack): string[] {
  return collectionPathsForPack(pack).map((path) => canonicalSeoDirectorySlugForSite(site, "collection", path));
}

function canResolveCollectionPath(state: PlatformState, site: Site, path: string): boolean {
  const normalized = canonicalDirectoryPathForSite(site, path);
  if (!isCollectionDirectoryPath(normalized)) return false;
  const route = parsePublicCollectionRouteForSite(site, normalized);
  if (route?.kind === "directory") return true;
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
  if (isCollectionDirectoryPath(normalized) && !isBlockedPublicPathForSite(site, normalized) && canResolveCollectionPath(state, site, normalized)) {
    paths.add(normalized);
  }
}

function addPublicPath(state: PlatformState, site: Site, paths: Set<string>, href: string): void {
  const normalized = sitePathFromHref(site, href);
  if (!normalized) return;
  if (isCollectionDirectoryPath(normalized)) {
    addCollectionPath(state, site, paths, normalized);
    return;
  }
  if (isVideoGenerationDirectoryPath(site, normalized)) {
    if (isPublicVideoGenerationSitemapPath(site, normalized)) paths.add(normalized);
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
  const tools = getExplicitSeoDirectorySlugsForSite(site, "tool")
    .map((slug) => canonicalToolPathForSite(site, `/tools/${slug}`))
    .filter((path) => !isDreamshootSite(site) || DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS.includes(path));
  return Array.from(new Set([...collections, ...tools]));
}

function collectDynamicIndexablePaths(state: PlatformState, site: Site): string[] {
  const paths = new Set<string>();
  const activePacks = state.creativePacks.filter((pack) => pack.siteId === site.id && pack.status === "active");
  const sitePages = pagesForSite(site);

  for (const pack of activePacks) {
    for (const collectionPath of collectionPathsForPack(pack)) {
      addCollectionPath(state, site, paths, collectionPath);
    }
  }

  for (const category of state.creativePackCategories ?? []) {
    if (category.siteId === site.id && category.status === "active") {
      addCollectionPath(state, site, paths, publicCollectionPathForSite(category, category.slug || category.label));
    }
  }

  for (const siteApp of state.siteAiApps.filter((app) => app.siteId === site.id && app.enabled)) {
    if (isDreamshootSite(site)) {
      if (DREAMSHOOT_DEFAULT_PUBLIC_TOOL_SLUGS.has(siteApp.aiApp.slug)) addToolPath(site, paths, publicVideoGenerationPathForSite(site, siteApp.aiApp.slug));
    } else if (isExplicitSeoDirectoryContentForSite(site, "tool", siteApp.aiApp.slug)) {
      addToolPath(site, paths, pathFromSlug("/tools", siteApp.aiApp.slug));
    }
  }

  for (const item of state.toolMenuItems ?? []) {
    if (item.siteId === site.id && item.status === "active") {
      addPublicPath(state, site, paths, item.href || pathFromSlug("/tools", item.slug));
    }
  }
  if (isDreamshootSite(site)) {
    for (const path of DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS) paths.add(path);
  }

  const toolBlocks = sitePages.flatMap((page) => blocksFromPage(page.publishedJson, new Set(["tool_card", "catalog_pack", "feature_tab", "occasion", "package"])));
  for (const block of toolBlocks) {
    const href = blockHref(block);
    addPublicPath(state, site, paths, href);
  }
  collectInternalHrefPaths(state, site, paths, site.themeSettings.publishedJson);
  for (const page of sitePages) collectInternalHrefPaths(state, site, paths, page.publishedJson);

  return Array.from(paths);
}

async function readIndexableStateAndSites(): Promise<{ state: PlatformState; sites: Site[] } | undefined> {
  if (prefersLegacyStateForPersistenceBackend()) return readLegacyIndexableStateAndSites();

  try {
    const state = await readStorefrontPlatformStateFromDatabase();
    const sites = findIndexableSites(state);
    if (sites.length) return { state, sites };
  } catch {
    // Production Postgres failures fail closed. Legacy JSON is an explicit local/test mode only.
    return undefined;
  }

  return undefined;
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
  if (!runtime) return [];
  const site = runtime?.sites.find(isDreamshootSite);
  if (!site) return [];
  return getSitemapUrlsForSite(runtime.state, site);
}

export async function getAidreamcapesSitemapUrls(): Promise<string[]> {
  const runtime = await readIndexableStateAndSites();
  if (!runtime) return [];
  const site = runtime.sites.find(isAidreamcapesSite);
  return site ? getSitemapUrlsForSite(runtime.state, site) : [];
}

function getSitemapUrlsForSite(state: PlatformState, site: Site): string[] {
  return sitemapEntriesForSite(state, site).map((entry) => entry.loc);
}

export async function getStorefrontSitemapUrls(): Promise<string[]> {
  const runtime = await readIndexableStateAndSites();
  if (!runtime) return [];
  return runtime.sites.flatMap((site) => getSitemapUrlsForSite(runtime.state, site));
}

export async function getStorefrontSitemapEntries(): Promise<SitemapEntry[]> {
  const runtime = await readIndexableStateAndSites();
  if (!runtime) return [];
  return runtime.sites.flatMap((site) => sitemapEntriesForSite(runtime.state, site));
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

function usesExplicitLegacySitemapPreview(): boolean {
  return (process.env.STOREFRONT_PATH_MODE_READS ?? "").trim().toLowerCase() === "local-preview";
}

export async function getStorefrontSitemapUrlsForHost(hosts: string | null | undefined | Array<string | null | undefined>): Promise<string[]> {
  const entries = await getStorefrontSitemapEntriesForHost(hosts);
  return entries.map((entry) => entry.loc);
}

export async function getStorefrontSitemapEntriesForHost(hosts: string | null | undefined | Array<string | null | undefined>): Promise<SitemapEntry[]> {
  const normalizedHosts = normalizeHostCandidates(hosts);
  const normalizedHost = normalizedHosts[0] ?? "";
  if (!normalizedHost) {
    return [];
  }
  const publicHostCandidates = normalizedHosts.filter((host) => !isLocalDevelopmentHost(host));
  const siteHostCandidates = publicHostCandidates.length ? publicHostCandidates : normalizedHosts;
  const isLocalHostRequest = !publicHostCandidates.length && normalizedHosts.some(isLocalDevelopmentHost);
  if (siteHostCandidates.some(isReservedGrownstrideHost)) return [];
  const shouldUseLegacyStateFirst = isLocalHostRequest || usesExplicitLegacySitemapPreview();
  const runtime = shouldUseLegacyStateFirst ? await readLegacyIndexableStateAndSites() : await readIndexableStateAndSites();
  if (!runtime) return [];
  if (isLocalHostRequest) return runtime.sites.flatMap((site) => sitemapEntriesForSite(runtime.state, site));
  const site =
    getSiteByHostCandidatesFromState(runtime.state, siteHostCandidates) ??
    runtime.sites.find((item) => siteHostCandidates.some((host) => isHostForSite(item, host)));
  if (site) return sitemapEntriesForSite(runtime.state, site);
  return [];
}

export async function getStorefrontPublicationIdentityForHost(
  hosts: string | null | undefined | Array<string | null | undefined>
): Promise<{
  publicationId?: string;
  publicationVersion?: number;
  snapshotHash?: string;
  buildId?: string;
  routeRevision?: string;
  pageRevision?: string;
  copyRevision?: string;
  mediaRevision?: string;
  factsRevision?: string;
  offerRevision?: string;
  collectionRevision?: string;
  linkRevision?: string;
  policyRevision?: string;
} | undefined> {
  const normalizedHosts = normalizeHostCandidates(hosts);
  const publicHostCandidates = normalizedHosts.filter((host) => !isLocalDevelopmentHost(host));
  const siteHostCandidates = publicHostCandidates.length ? publicHostCandidates : normalizedHosts;
  const isLocalHostRequest = !publicHostCandidates.length && normalizedHosts.some(isLocalDevelopmentHost);
  const runtime = (isLocalHostRequest || usesExplicitLegacySitemapPreview())
    ? await readLegacyIndexableStateAndSites()
    : await readIndexableStateAndSites();
  if (!runtime) return undefined;
  const site = isLocalHostRequest
    ? runtime.sites[0]
    : getSiteByHostCandidatesFromState(runtime.state, siteHostCandidates) ?? runtime.sites.find((item) => siteHostCandidates.some((host) => isHostForSite(item, host)));
  const publication = site?.latestPublication;
  if (!publication || publicationSnapshotIntegrity(publication.snapshot) !== "valid") return undefined;
  const revisions = (publication.snapshot as PublishedSeoSnapshot).revisions;
  return {
    publicationId: publication.id,
    publicationVersion: publication.version,
    snapshotHash: publication.snapshot.snapshotHash,
    buildId: publication.snapshot.buildId,
    routeRevision: revisions.routeRevision,
    pageRevision: revisions.pageRevision,
    copyRevision: revisions.copyRevision,
    mediaRevision: revisions.mediaRevision,
    factsRevision: revisions.factsRevision,
    offerRevision: revisions.offerRevision,
    collectionRevision: revisions.collectionRevision,
    linkRevision: revisions.linkRevision,
    policyRevision: revisions.policyRevision
  };
}

export function storefrontSitemapUrlForHost(hosts: string | null | undefined | Array<string | null | undefined>): string | undefined {
  const normalizedHost = normalizeFirstHost(hosts);
  if (isGrownstrideHost(normalizedHost)) return undefined;
  if (isAidreamshootsEuHost(normalizedHost)) return AIDREAMSHOOTS_EU_SITEMAP_URL;
  if (isAidreamcapesEuHost(normalizedHost)) return AIDREAMCAPES_EU_SITEMAP_URL;
  if (isAidreamcapesHost(normalizedHost)) return AIDREAMCAPES_SITEMAP_URL;
  if (isMydreamshootsHost(normalizedHost)) return MYDREAMSHOOTS_SITEMAP_URL;
  return undefined;
}
