import { readStorefrontPlatformStateFromDatabase, readStorefrontPublicIndexingStateByHostFromDatabase } from "@/lib/storefront-state";
import fs from "node:fs";
import nodePath from "node:path";
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
import { isAidreamshootsStorefrontSite, isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import {
  AIDREAMSHOOTS_HOMEPAGE_VIDEO_MEDIA,
  AIDREAMSHOOTS_HOMEPAGE_VIDEO_SUBTITLES,
  AIDREAMSHOOTS_HOMEPAGE_VIDEO_TITLES,
  aidreamshootsVideoTopicSlugForPath
} from "@/lib/aidreamshoots-video-media";
import { AIDREAMCAPES_IMAGE_THEME_DEFINITIONS, aidreamcapesLegacyGalleryRedirectForPath, isAidreamcapesImageThemePath, isRetiredAidreamcapesPublicPath } from "@/lib/aidreamcapes-image-theme-routes";
import { AIDREAMCAPES_EU_PUBLIC_DETAIL_PATHS, canonicalAidreamcapesEuPublicPath, isAidreamcapesEuRetiredPublicPath } from "@/lib/aidreamcapes-eu-retired-routes";
import { isPrimaryMydreamshootsSite } from "@/lib/storefront-context/capabilities";
import storefrontSourcePageMap from "../../scripts/data/storefront-source-page-map-2026-09-27.json";
import { imageThemeDetailContentFromPage } from "@/lib/aidreamcapes-image-theme-content";
import { MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS, MYDREAMSHOOTS_RETIRED_PUBLIC_PATHS } from "@/lib/mydreamshoots-legacy-public-redirects";
import { createPublishedSiteSnapshot, resolveEffectivePublishedPage, resolvePublishedRouteDisposition, resolvePublishedSeoEntity, resolvePublishedStorefrontContext, resolvePublicCollectionItems } from "@/lib/storefront-context";
import { pageCopyFromPublishedPageEntity } from "@/lib/mydreamshoots-published-contract";
import type { CreativePack, PlatformState, PublishedLeafRouteProjection, PublishedSeoSnapshot, SectionBlockInstance, Site, ThemePage, ThemePageJson, ThemeSettingValue } from "@/lib/types";
import { AIDREAMSHOOTS_VIDEO_SAVE_THE_DATE_ALIASES, aidreamcapesLegacyVideoSaveTheDatePath, aidreamshootsLegacyVideoSaveTheDatePath, canonicalSaveTheDatePath, MYDREAMSHOOTS_WEDDING_INVITATION_PATH, MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH } from "@/lib/save-the-date-routes";
import {
  mydreamshootsVideoWatchPagesForState,
  isStorefrontVideoHost,
  type MyDreamShootsVideoWatchPage
} from "@/lib/mydreamshoots-video-watch";

export const MYDREAMSHOOTS_ORIGIN = "https://www.mydreamshoots.com";
export const MYDREAMSHOOTS_SITEMAP_URL = `${MYDREAMSHOOTS_ORIGIN}/sitemap.xml`;
export const AIDREAMCAPES_ORIGIN = "https://aidreamcapes.com";
export const AIDREAMCAPES_SITEMAP_URL = `${AIDREAMCAPES_ORIGIN}/sitemap.xml`;
export const AIDREAMSHOOTS_EU_ORIGIN = "https://aidreamshoots.eu";
export const AIDREAMSHOOTS_EU_SITEMAP_URL = `${AIDREAMSHOOTS_EU_ORIGIN}/sitemap.xml`;
export const AIDREAMCAPES_EU_ORIGIN = "https://aidreamcapes.eu";
export const AIDREAMCAPES_EU_SITEMAP_URL = `${AIDREAMCAPES_EU_ORIGIN}/sitemap.xml`;

const DREAMSHOOT_SITE_ID = "site_dreamshoot";
const DREAMSHOOT_SITE_SLUGS = new Set(["mydreamshoots", "dreamshoot", "grownstride"]);
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
const LEGACY_OR_DUPLICATE_PATHS = new Set(["/cookie-policy", "/privacy-policy", "/terms-of-service", "/shipping-policy", "/delivery-policy", "/policies/shipping", "/policies/delivery", "/policies/delivery-policy", "/engagement-photo", "/ai-image-generation/profile-cards", "/ai-image-generation/motion-generator", "/ai-video-generation/wedding-invitation", "/holidays-events/wedding-invitation"]);
const AIDREAMSHOOTS_LEGACY_ALIAS_PATHS = new Set(["/policies/state-privacy"]);
const MYDREAMSHOOTS_LEGACY_PUBLIC_PATHS = new Set<string>(MYDREAMSHOOTS_LEGACY_PUBLIC_REDIRECTS.map(({ aliasPath }) => aliasPath));
const MYDREAMSHOOTS_RETIRED_PUBLIC_PATH_SET = new Set<string>(MYDREAMSHOOTS_RETIRED_PUBLIC_PATHS);
const NON_INDEXABLE_TOOL_PATHS = new Set(["/tools/image-studio", "/tools/ai-image-studio", "/tools/image-generator", "/tools/image_generator", "/tools/travel-portraits"]);
const REQUIRED_INDEXABLE_TOOL_PATHS = [
  "/tools/photo-ai",
  "/tools/video-ai",
  "/tools/ai-photo-edit",
  "/tools/headshot",
  "/tools/background-changer",
  "/tools/background-remover",
  "/tools/photo-enhancer",
  "/tools/magic-upscaler",
  "/tools/virtual-try-on"
];
const DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS = [
  ...MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS.map((slug) => `/ai-video-generation/${slug}`)
];
const DREAMSHOOT_DEFAULT_PUBLIC_TOOL_SLUGS = new Set<string>(MYDREAMSHOOTS_PUBLIC_AI_VIDEO_GENERATION_SLUGS);
const REQUIRED_INDEXABLE_CONTENT_PATHS = ["/about-us", "/contact-us", "/creators-circle", "/best-packages", "/best-ai-image", "/best-save-the-date", "/faq", "/pricing", "/workflow"];
const REQUIRED_INDEXABLE_AIDREAMCAPES_EU_PATHS = [...REQUIRED_INDEXABLE_CONTENT_PATHS];
const REQUIRED_INDEXABLE_EU_PARITY_PATHS = ["/best-ai-video", "/blog/cinematic-video-guide", "/blog/motion-generator-video-guide", "/blog/talking-photo-video-guide"];
const REQUIRED_INDEXABLE_AIDREAMSHOOTS_PATHS = [
  "/ai-image-generation/motion-generator",
  ...Object.keys(AIDREAMSHOOTS_VIDEO_SAVE_THE_DATE_ALIASES).map((slug) => `/ai-save-the-date/${slug}`)
];
const REQUIRED_INDEXABLE_POLICY_PATHS = ["/privacy", "/terms", "/cookies", "/refunds", "/content", "/digital-delivery", "/children-privacy", "/state-privacy"];
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
  ["/shipping", "/shipping"],
  ["/shipping-policy", "/shipping"],
  ["/delivery-policy", "/shipping"],
  ["/policies/shipping", "/shipping"],
  ["/policies/delivery", "/shipping"],
  ["/policies/delivery-policy", "/shipping"],
  ["/children-privacy-policy", "/children-privacy"],
  ["/childrens-privacy", "/children-privacy"],
  ["/policies/children-privacy", "/children-privacy"],
  ["/state-privacy-rights", "/state-privacy"],
  ["/california-privacy", "/state-privacy"],
  ["/ccpa", "/state-privacy"],
  ["/policies/state-privacy", "/state-privacy"],
  ["/engagement-photo", "/ai-image-generation/engagement-photo"],
  ["/ai-image-generation/profile-cards", "/ai-image-generation/avatar"],
  ["/ai-image-generation/motion-generator", "/ai-video-generation/motion-generator"]
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
  ["/tools/image-studio", "/tools"],
  ["/tools/portrait-generator", "/tools/fan-scene-album-builder"],
  ["/tools/portrait-maker", "/tools/fan-scene-album-builder"],
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
  "video-photo-package-guide": "/blog/motion-generator-video-guide",
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
  const origin = site.id === AIDREAMCAPES_SITE_ID ? AIDREAMCAPES_ORIGIN : siteOrigin(site) || MYDREAMSHOOTS_ORIGIN;
  return path === "/" ? `${origin}/` : `${origin}${path}`;
}

type SitemapImageEntry = {
  loc: string;
  title?: string;
  caption?: string;
};

type SitemapVideoEntry = {
  thumbnailLoc: string;
  title: string;
  description: string;
  contentLoc: string;
  publicationDate?: string;
  duration?: string;
};

export type SeoPageEntry = {
  path: string;
  canonicalPath: string;
  pageType: "home" | "theme" | "blog" | "marketing" | "auth" | "error";
  indexable: boolean;
  lastModified?: string;
};

export type SitemapEntry = {
  loc: string;
  images: SitemapImageEntry[];
  video?: SitemapVideoEntry;
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

function activePackForSitemapPath(state: PlatformState, site: Site, path: string): CreativePack | undefined {
  const route = parsePublicCollectionRouteForSite(site, path);
  if (route?.kind !== "item" || !route.collectionSlug) return undefined;
  const canonicalSlug = canonicalSeoDirectorySlugForSite(site, "collection", route.collectionSlug);
  return state.creativePacks.find((pack) =>
    pack.siteId === site.id
      && pack.status === "active"
      && collectionSlugsForPack(site, pack).includes(canonicalSlug)
  );
}

function latestPublishedContentDate(
  state: PlatformState,
  site: Site,
  snapshot: ReturnType<typeof createPublishedSiteSnapshot>
): string | undefined {
  const dates = [
    ...state.creativePacks
      .filter((pack) => pack.siteId === site.id && pack.status === "active")
      .flatMap((pack) => [pack.createdAt]),
    ...snapshot.pages.flatMap((page) => [page.updatedAt, page.createdAt]),
    snapshot.publication?.publishedAt
  ]
    .map(normalizeSitemapDate)
    .filter((value): value is string => Boolean(value))
    .sort();
  return dates.at(-1);
}

function sitemapLastModifiedForPath(
  state: PlatformState,
  site: Site,
  snapshot: ReturnType<typeof createPublishedSiteSnapshot>,
  path: string,
  page?: ThemePage
): string | undefined {
  const pack = isAidreamshootsStorefrontSite(site) ? activePackForSitemapPath(state, site, path) : undefined;
  return normalizeSitemapDate(pack?.createdAt)
    ?? (page ? pageContentLastModified(page, snapshot.publication?.publishedAt) : undefined)
    ?? latestPublishedContentDate(state, site, snapshot);
}

function sitemapVideoDuration(value: unknown, fallback = 15): string {
  const parsed = typeof value === "number" ? value : Number(cleanText(value));
  const totalSeconds = Math.max(1, Math.floor(Number.isFinite(parsed) && parsed > 0 ? parsed : fallback));
  return String(totalSeconds);
}

function pageSitemapVideoForSite(site: Site, page: ThemePage): SitemapVideoEntry | undefined {
  if (isAidreamshootsStorefrontSite(site)) {
    const path = canonicalDirectoryPathForSite(site, canonicalPathForSitemapPage(page));
    const slug = aidreamshootsVideoTopicSlugForPath(path);
    const media = slug ? AIDREAMSHOOTS_HOMEPAGE_VIDEO_MEDIA[slug] : undefined;
    if (!slug || !media) return undefined;
    const thumbnailLoc = aidreamshootsVideoSitemapMediaUrl(site, media.poster);
    const contentLoc = aidreamshootsVideoSitemapMediaUrl(site, media.video);
    if (!thumbnailLoc || !contentLoc) return undefined;
    const publicationDate = normalizeSitemapDate(page.updatedAt);
    return {
      thumbnailLoc,
      title: AIDREAMSHOOTS_HOMEPAGE_VIDEO_TITLES[slug],
      description: AIDREAMSHOOTS_HOMEPAGE_VIDEO_SUBTITLES[slug],
      contentLoc,
      ...(publicationDate ? { publicationDate } : {}),
      duration: String(media.durationSeconds)
    };
  }
  if (!isDreamshootSite(site)) return undefined;
  const hero = Object.values(page.publishedJson.sections ?? {}).find((section) => section?.type === "editorial_hero");
  if (!hero) return undefined;
  const firstVisual = hero.blocks?.find((block) => Boolean(cleanText(block.settings.imageUrl)));
  const videoUrl = cleanText(hero.settings.videoUrl) || cleanText(firstVisual?.settings.videoUrl);
  const thumbnailUrl = cleanText(hero.settings.videoPosterUrl) || cleanText(hero.settings.imageUrl) || cleanText(firstVisual?.settings.imageUrl);
  if (!/\.(?:mp4|webm)(?:[?#]|$)/i.test(videoUrl) || !/\.(?:avif|jpe?g|png|webp)(?:[?#]|$)/i.test(thumbnailUrl)) return undefined;
  const title = cleanText(hero.settings.videoTitle, cleanText(page.title, "AI Christmas family gift video"));
  const description = cleanText(hero.settings.videoDescription, "A family opens a glowing Christmas gift together beside a decorated tree and fireplace.");
  const publicationDate = normalizeSitemapDate(hero.settings.videoUploadDate ?? page.updatedAt);
  return {
    thumbnailLoc: absoluteMediaUrl(site, thumbnailUrl),
    title,
    description,
    contentLoc: absoluteMediaUrl(site, videoUrl),
    ...(publicationDate ? { publicationDate } : {}),
    duration: sitemapVideoDuration(hero.settings.videoDurationSeconds)
  };
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
  const origin = site.id === AIDREAMCAPES_SITE_ID
    ? AIDREAMCAPES_ORIGIN
    : siteOrigin(site) || MYDREAMSHOOTS_ORIGIN;
  return `${origin}${resolved.startsWith("/") ? resolved : `/${resolved}`}`;
}

function sitemapMediaUrl(site: Site, value: string | undefined): string {
  const resolved = absoluteMediaUrl(site, value);
  if (!resolved) return "";
  if (site.id === AIDREAMCAPES_SITE_ID) {
    try {
      const pathname = new URL(resolved).pathname;
      if (/\/assets\/sites\/site_aidreamcapes\/(?:creative-packs|fan-holiday-theme)(?:\/|$)/i.test(pathname)) return "";
    } catch {
      return "";
    }
  }
  const isAidreamcapesMediaSite = site.id === AIDREAMCAPES_SITE_ID || site.id === "site_aidreamcapes_xby";
  const isAidreamshootsEuMediaSite = site.id === "site_mydreamshoots_xby";
  if (isAidreamshootsEuMediaSite || site.id === "site_aidreamcapes_xby") {
    try {
      const parsed = new URL(resolved);
      const expectedHost = originHost(siteOrigin(site));
      const expectedRoot = site.id === "site_aidreamcapes_xby"
        ? "/assets/sites/site_aidreamcapes_eu/"
        : "/assets/sites/site_aidreamshoots/";
      if (!expectedHost || parsed.host.toLowerCase() !== expectedHost || !parsed.pathname.startsWith(expectedRoot) || parsed.pathname.includes("/mirror/")) return "";
      // AIdreamshoots' current relation rows already own these target-root
      // paths; some binary derivatives are supplied by the media release
      // rather than this source checkout. Keep the sitemap contract focused
      // on host/root ownership and let the HTTP release smoke verify files.
      if (site.id === "site_mydreamshoots_xby") return resolved;
      const localAsset = nodePath.join(process.cwd(), "public", parsed.pathname.replace(/^\/+/, ""));
      return fs.existsSync(localAsset) ? resolved : "";
    } catch {
      return "";
    }
  }
  if (!isAidreamcapesMediaSite) return resolved;
  try {
    const parsed = new URL(resolved);
    const expectedHost = originHost(site.id === AIDREAMCAPES_SITE_ID ? AIDREAMCAPES_ORIGIN : siteOrigin(site));
    if (!expectedHost || parsed.host.toLowerCase() !== expectedHost) return "";
    const allowedAssetRoots = site.id === "site_aidreamcapes_xby"
      ? ["site_aidreamcapes_eu", "site_aidreamcapes_xby"]
      : [site.id];
    if (!allowedAssetRoots.some((assetSiteId) => parsed.pathname.startsWith(`/assets/sites/${assetSiteId}/`))) return "";
    // Aidreamcapes publishes its sitemap media from the repository's public
    // asset namespace. Do not advertise a stale database reference when the
    // corresponding file is absent from the release being built.
    const localAsset = nodePath.join(process.cwd(), "public", parsed.pathname.replace(/^\/+/, ""));
    return fs.existsSync(localAsset) ? resolved : "";
  } catch {
    return "";
  }
}

function aidreamshootsVideoSitemapMediaUrl(site: Site, value: string | undefined): string {
  if (!isAidreamshootsStorefrontSite(site)) return "";
  const resolved = absoluteMediaUrl(site, value);
  if (!resolved) return "";
  try {
    const parsed = new URL(resolved);
    if (parsed.hostname.toLowerCase() !== new URL(AIDREAMSHOOTS_EU_ORIGIN).hostname) return "";
    if (!parsed.pathname.startsWith("/assets/sites/site_aidreamshoots/")) return "";
    const localAsset = nodePath.join(process.cwd(), "public", parsed.pathname.replace(/^\/+/, ""));
    return fs.existsSync(localAsset) ? resolved : "";
  } catch {
    return "";
  }
}

function comparableSitemapImageUrl(value: string): string {
  return cleanText(value).split(/[?#]/)[0];
}

function packSitemapImages(site: Site, pack: CreativePack, limit = 8): SitemapImageEntry[] {
  const imagePaths = [pack.imageUrl, ...(pack.galleryImages ?? [])]
    .map((value) => sitemapMediaUrl(site, value))
    .filter(Boolean);
  const seen = new Set<string>();
  const images: SitemapImageEntry[] = [];

  imagePaths.forEach((loc, index) => {
    if (images.length >= limit) return;
    const comparable = comparableSitemapImageUrl(loc);
    if (!comparable || seen.has(comparable)) return;
    seen.add(comparable);
    const galleryIndex = index - 1;
    const rawTitle = index === 0
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
    const title = sitemapImageTitleForPack(pack, rawTitle, index);
    const caption = cleanText(pack.headline || pack.description, `${pack.name} photo package preview`);
    images.push({
      loc,
      ...(title ? { title } : {}),
      ...(caption ? { caption } : {})
    });
  });

  return images;
}

function sitemapImageTitleForPack(pack: CreativePack, title: string, index: number): string {
  const cleaned = cleanText(title, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const weak = /^(?:.+\s)?(?:cover|gallery) portrait$/i.test(cleaned) || /\b(?:cover portrait|package image|gallery image)\b/i.test(cleaned);
  if (words.length >= 4 && !weak) return cleaned;
  const packName = cleanText(pack.name, "AI photo package");
  return `${packName} photo package ${index === 0 ? "cover" : "example"}`;
}

function sitemapImageTitleForMedia(page: ThemePage, title: string, index: number): string {
  const cleaned = cleanText(title, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const weak = /\b(?:cover portrait|package image|gallery image)\b/i.test(cleaned);
  if (words.length >= 4 && !weak) return cleaned;
  const pageTitle = cleanText(page.title, "AI photo theme");
  return `${pageTitle} photo theme ${index === 0 ? "cover" : "gallery example"}`;
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
  const resolved = sitemapMediaUrl(site, value);
  if (!resolved) return "";
  const pathname = cleanText(resolved).split(/[?#]/)[0].toLowerCase();
  return /\.(?:avif|jpe?g|png|webp)(?:$)/i.test(pathname) ? resolved : "";
}

function sitemapImageTitleForPage(page: ThemePage): string {
  const seoTitle = cleanText(page.publishedJson.seo?.title)
    .replace(/\s*[|-]\s*(?:myDreamshoots|MyDreamShoots|Aidreamcapes)\s*$/i, "")
    .trim();
  const title = cleanText(seoTitle, cleanText(page.title, "Aidreamcapes page image"));
  return title.split(/\s+/).length >= 4 ? title : `${title} image`;
}

const AIDREAMCAPES_HOMEPAGE_PRODUCT_IMAGE = "/ai-ecommerce-product-main-image-running-shoe.webp";
const AIDREAMCAPES_HOMEPAGE_PRODUCT_IMAGE_TITLE = "Running shoe ecommerce product image for AI-generated store creative";
const AIDREAMCAPES_HOMEPAGE_PRODUCT_IMAGE_CAPTION = "Clean running shoe product image showing an ecommerce-ready AI creative for online stores.";

function sitemapImageMatchesAsset(imageLoc: string, assetPath: string): boolean {
  const imagePath = cleanText(imageLoc).split(/[?#]/)[0].toLowerCase();
  const assetName = cleanText(assetPath).split("/").pop()?.toLowerCase();
  return Boolean(assetName && imagePath.endsWith(`/${assetName}`));
}

function overrideAidreamcapesHomepageSitemapImages(site: Site, entry: SitemapEntry): SitemapEntry {
  if (site.id !== AIDREAMCAPES_SITE_ID) return entry;
  let path = "";
  try {
    path = new URL(entry.loc).pathname;
  } catch {
    return entry;
  }
  if (path !== "/") return entry;
  return {
    ...entry,
    images: entry.images.map((image) => {
      if (sitemapImageMatchesAsset(image.loc, AIDREAMCAPES_HOMEPAGE_PRODUCT_IMAGE)) {
        return {
          ...image,
          title: AIDREAMCAPES_HOMEPAGE_PRODUCT_IMAGE_TITLE,
          caption: AIDREAMCAPES_HOMEPAGE_PRODUCT_IMAGE_CAPTION
        };
      }
      return image;
    })
  };
}

function collectPageSitemapImages(site: Site, page: ThemePage, limit = 6): SitemapImageEntry[] {
  const themeManifest = (site.id === AIDREAMCAPES_SITE_ID && normalizePath(page.slug) !== "/") || isAidreamcapesImageThemePath(site.slug, normalizePath(page.slug))
    ? page.publishedJson.mediaManifest
    : undefined;
  if (themeManifest?.length) {
    return themeManifest
      .map((image) => ({
        loc: imageSitemapUrl(site, image.src),
        ...(cleanText(image.alt) ? { title: cleanText(image.alt), caption: cleanText(image.alt) } : {})
      }))
      .filter((image) => image.loc)
      .slice(0, themeManifest.length);
  }
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

  // Share-card assets are not necessarily displayed in the current .com page.
  if (site.id !== AIDREAMCAPES_SITE_ID) pushImage(page.publishedJson.seo?.ogImage, title, caption);

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
      if (site.id === AIDREAMCAPES_SITE_ID && childKey === "seo") continue;
      visit(childValue, childKey);
    }
  };

  if (site.id === AIDREAMCAPES_SITE_ID) {
    for (const sectionId of page.publishedJson.sectionsOrder) {
      const section = page.publishedJson.sections[sectionId];
      if (!section) continue;
      if (section.type === "pricing_table") continue;
      if (normalizePath(page.slug) === "/contact-us" && section.type === "rich_text") continue;
      visit(section);
    }
  } else {
    visit(page.publishedJson);
  }
  return images.slice(0, limit);
}

function collectAidreamcapesImageDirectorySitemapImages(
  snapshot: ReturnType<typeof createPublishedSiteSnapshot>,
  site: Site
): SitemapImageEntry[] {
  if (site.id !== AIDREAMCAPES_SITE_ID) return [];
  const images: SitemapImageEntry[] = [];
  const seen = new Set<string>();
  for (const definition of AIDREAMCAPES_IMAGE_THEME_DEFINITIONS) {
    const path = `/ai-image-generation/${definition.slug}`;
    const page = pageForCanonicalSeoPath(snapshot, site, path);
    const manifest = page?.publishedJson.mediaManifest;
    // Directory cards display the generated output, not the source input.
    const image = manifest?.[1];
    if (!image) continue;
    const loc = imageSitemapUrl(site, image.src);
    const comparable = comparableSitemapImageUrl(loc);
    if (!loc || !comparable || seen.has(comparable)) continue;
    seen.add(comparable);
    const alt = cleanText(image.alt, `${definition.label} example image`);
    images.push({ loc, title: alt, caption: alt });
  }
  return images;
}

function pageSitemapPathForSite(site: Site, page: ThemePage): string {
  if (page.siteId !== site.id) return "";
  if (isAidreamcapesEuRetiredPublicPath(site.id, page.slug)) return "";
  const pageSeo = page.publishedJson.seo;
  const canonicalValue = pageSeo?.canonical ?? pageSeo?.canonicalPath ?? page.slug;
  const canonicalPath = canonicalPublicPath(normalizePath(/^https?:\/\//i.test(canonicalValue) ? new URL(canonicalValue).pathname : canonicalValue));
  if (site.id === "site_aidreamcapes_xby" && canonicalAidreamcapesEuPublicPath(canonicalPath) !== canonicalPath) return "";
  if (site.id === AIDREAMCAPES_SITE_ID && (canonicalPath === "/tools" || aidreamcapesLegacyVideoSaveTheDatePath(canonicalPath))) return "";
  if (isAidreamcapesEuRetiredPublicPath(site.id, canonicalPath)) return "";
  if (isRetiredAidreamcapesPublicPath(site.slug, normalizePath(page.slug)) || isRetiredAidreamcapesPublicPath(site.slug, canonicalPath)) return "";
  // Legacy video ThemePage rows can remain in relational data during a route
  // migration, but unsupported video slugs must not become sitemap URLs.
  if (isDreamshootSite(site) && canonicalPath.startsWith("/ai-video-generation/") && !isPublicVideoGenerationSitemapPath(site, canonicalPath)) return "";
  const isLegacyDuplicate = (LEGACY_OR_DUPLICATE_PATHS.has(normalizePath(page.slug)) && !(isAidreamshootsStorefrontSite(site) && normalizePath(page.slug) === "/ai-image-generation/motion-generator")) || (isDreamshootSite(site) && (MYDREAMSHOOTS_LEGACY_PUBLIC_PATHS.has(normalizePath(page.slug)) || MYDREAMSHOOTS_RETIRED_PUBLIC_PATH_SET.has(normalizePath(page.slug))));
  // SEO eligibility is resolved once below by resolveEffectivePublishedPage().
  // Reading raw page flags here creates a second owner that can disagree with
  // the published route projection used by metadata and page rendering.
  return isIndexablePage(page, site) && !isLegacyDuplicate && !isBlockedPublicPathForSite(site, canonicalPath)
    ? canonicalDirectoryPathForSite(site, canonicalPath)
    : "";
}

function mydreamshootsVideoWatchPagesForSnapshot(
  state: PlatformState,
  site: Site,
  snapshot: ReturnType<typeof createPublishedSiteSnapshot>
): readonly MyDreamShootsVideoWatchPage[] {
  return mydreamshootsVideoWatchPagesForState(state, site, {
    pages: snapshot.pages.map((page) => ({
      ...page,
      slug: page.publishedJson.seo?.canonicalPath ?? page.publishedJson.seo?.canonical ?? page.slug
    })),
    homepageShowcases: snapshot.publishedHomepageShowcases,
    themeSettingsJson: snapshot.themeSettings
  });
}

export function sitemapEntriesForSite(state: PlatformState, site: Site): SitemapEntry[] {
  const snapshot = createPublishedSiteSnapshot(state, site);
  const videoWatchPages = mydreamshootsVideoWatchPagesForSnapshot(state, site, snapshot);
  const videoWatchSourcePaths = new Set(videoWatchPages.flatMap((video) => video.sourcePaths));
  const collectionItems = resolvePublicCollectionItems(snapshot);
  const entries = new Map<string, SitemapEntry>();
  for (const page of snapshot.pages) {
    const isRegisteredImageTheme = isAidreamcapesImageThemePath(site.slug, page.slug);
    if (isRegisteredImageTheme && !imageThemeDetailContentFromPage(page)) continue;
    const sitemapPath = pageSitemapPathForSite(site, page);
    if (!sitemapPath) continue;
    const canonicalPath = canonicalDirectoryPathForSite(site, sitemapPath);
    // The Aidreamcapes image-theme registry owns these public routes. During
    // the migration a legacy publication may not yet have a matching route
    // projection, even though the LivePage is published and the page request
    // resolves correctly through the registry.
    if (!isRegisteredImageTheme && resolvePublishedRouteDisposition(snapshot, canonicalPath).kind !== "render") continue;
    const effective = resolveEffectivePublishedPage(snapshot, canonicalPath);
    if ((!isRegisteredImageTheme && effective.routeDisposition.kind !== "render") || (!isRegisteredImageTheme && !effective.indexability.sitemapEligible)) continue;
    const configuredCanonical = page.publishedJson.seo?.canonical?.trim();
    const path = isRegisteredImageTheme
      ? canonicalPath
      : effective.context.seo.canonicalPath;
    const loc = site.id === AIDREAMCAPES_SITE_ID
      ? sitemapUrl(site, path)
      : isAidreamcapesImageThemePath(site.slug, page.slug) && configuredCanonical && /^https?:\/\//i.test(configuredCanonical)
        ? configuredCanonical
        : effective.context.seo.canonicalUrl;
    const standardMedia = isPrimaryMydreamshootsSite(site)
      ? resolvePublishedSeoEntity(snapshot, path).standardPageMedia
      : undefined;
    const pageMedia = isPrimaryMydreamshootsSite(site)
      ? resolvePublishedSeoEntity(snapshot, path).pageMedia
      : undefined;
    entries.set(loc, {
      loc,
      images: standardMedia?.status === "ready"
        ? standardMedia.sitemapImages.map((image, index) => ({
            loc: sitemapMediaUrl(site, image),
            title: sitemapImageTitleForMedia(page, index === 0 ? standardMedia.primaryImageAlt : sitemapImageTitleForPage(page), index)
          })).filter((image) => image.loc)
        : pageMedia?.status === "ready"
          ? [pageMedia.primaryImage, ...pageMedia.galleryImages].map((image, index) => ({
              loc: sitemapMediaUrl(site, image),
              title: sitemapImageTitleForMedia(page, pageMedia.imageAlts[index] || sitemapImageTitleForPage(page), index)
            })).filter((image) => image.loc)
        : isPrimaryMydreamshootsSite(site)
          ? []
          : collectPageSitemapImages(site, page),
      video: videoWatchSourcePaths.has(path)
        ? undefined
        : pageSitemapVideoForSite(site, page),
      lastmod: sitemapLastModifiedForPath(state, site, snapshot, path, page),
      changefreq: sitemapChangeFrequencyForPath(path),
      priority: sitemapPriorityForPath(path)
      });
  }
  if (site.id === "site_aidreamcapes_xby") {
    // EU owns all 39 photo themes under /ai-image-generation. Remove stale
    // legacy video aliases that may still exist as relational ThemePage rows
    // so they cannot win the sitemap entry before the CreativePack pass.
    for (const [loc] of entries) {
      try {
        if (new URL(loc).pathname.startsWith("/ai-video-generation/")) entries.delete(loc);
      } catch {
        // Invalid entries are filtered by the normal sitemap serializer.
      }
    }
  }
  if (isPrimaryMydreamshootsSite(site) && snapshot.pages.some((page) => page.slug === MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH)) {
    const loc = `${siteOrigin(site) || MYDREAMSHOOTS_ORIGIN}${MYDREAMSHOOTS_WEDDING_INVITATION_PATH}`;
    entries.set(loc, {
      loc,
      images: [],
      lastmod: normalizeSitemapDate(snapshot.publication?.publishedAt),
      changefreq: sitemapChangeFrequencyForPath(MYDREAMSHOOTS_WEDDING_INVITATION_PATH),
      priority: sitemapPriorityForPath(MYDREAMSHOOTS_WEDDING_INVITATION_PATH)
    });
  }
  const collectionPath = publicCollectionPathForSite(site, "");
  const collectionPage = snapshot.pages.find((page) => canonicalDirectoryPathForSite(site, canonicalPathForSitemapPage(page)) === canonicalDirectoryPathForSite(site, collectionPath));
  if (collectionPage && collectionItems.length && !(site.id === AIDREAMCAPES_SITE_ID && collectionPath === "/ai-image-generation")) {
    const effective = resolveEffectivePublishedPage(snapshot, collectionPage.slug);
    if (effective.routeDisposition.kind === "render" && effective.indexability.sitemapEligible) {
      const loc = effective.context.seo.canonicalUrl;
      const entry = entries.get(loc);
      if (entry) entry.images = collectionItems.flatMap((item) => packSitemapImages(site, item.source, 1));
    }
  }
  if (site.id === AIDREAMCAPES_SITE_ID) {
    const directoryLoc = sitemapUrl(site, "/ai-image-generation");
    const directoryEntry = entries.get(directoryLoc);
    if (directoryEntry) directoryEntry.images = collectAidreamcapesImageDirectorySitemapImages(snapshot, site);
  }
  if (isPrimaryMydreamshootsSite(site) && collectionPage) {
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
          loc: sitemapMediaUrl(site, value),
          title: pack
            ? sitemapImageTitleForPack(pack, media.imageAlts[index] || "", index)
            : sitemapImageTitleForMedia(page, media.imageAlts[index] || "", index)
        }))
        .filter((image) => image.loc);
      entries.set(loc, {
        loc,
        images: mediaImages,
        lastmod: normalizeSitemapDate(snapshot.publication?.publishedAt),
        changefreq: sitemapChangeFrequencyForPath(route.canonicalPath),
        priority: sitemapPriorityForPath(route.canonicalPath)
      });
    }
  }
  if (isAidreamshootsStorefrontSite(site)) {
    // AIdreamshoots theme leaves are catalogue-backed. Build their sitemap
    // entries from the same canonical page index used by internal-link and
    // SEO eligibility checks, then attach the active pack's current media.
    for (const seoPage of indexableSeoPageEntriesForSite(state, site, snapshot)) {
      const path = seoPage.canonicalPath;
      const loc = sitemapUrl(site, path);
      if (entries.has(loc)) continue;
      const collectionRoute = parsePublicCollectionRouteForSite(site, path);
      const pack = collectionRoute?.collectionSlug
        ? state.creativePacks.find((candidate) => candidate.siteId === site.id && candidate.status === "active" &&
            canonicalDirectoryPathForSite(site, publicCollectionPathForSite(site, candidate.categoryRecord?.slug || candidate.category || candidate.name)) === path)
        : undefined;
      const page = pageForCanonicalSeoPath(snapshot, site, path);
      const images = pack
        ? packSitemapImages(site, pack)
        : page
          ? collectPageSitemapImages(site, page)
          : [];
      entries.set(loc, {
        loc,
        images,
        lastmod: seoPage.lastModified,
        changefreq: sitemapChangeFrequencyForPath(path),
        priority: sitemapPriorityForPath(path)
      });
    }
    // A legacy page row can still carry the alias as its stored SEO value.
    // Never serialize those aliases even if the row is otherwise indexable.
    for (const [loc] of entries) {
      try {
        const path = new URL(loc).pathname;
        const page = pageForCanonicalSeoPath(snapshot, site, path);
        const collectionRoute = parsePublicCollectionRouteForSite(site, path);
        const isUnbackedThemeLeaf = collectionRoute?.kind === "item" &&
          !page &&
          !hasAidreamshootsCatalogCollectionPath(state, site, path);
        if (path === "/collections" || path.startsWith("/collections/") || aidreamshootsLegacyVideoSaveTheDatePath(path) || isUnbackedThemeLeaf) {
          entries.delete(loc);
        }
      } catch {
        entries.delete(loc);
      }
    }
  }
  if (isAidreamcapesSite(site)) {
    // Aidreamcapes serves collection detail pages from the shared live
    // catalogue rather than the MyDreamShoots publication manifest. Keep
    // those canonical theme URLs discoverable without borrowing My's route
    // ownership or publication IDs.
    for (const pack of (state.creativePacks ?? []).filter((candidate) => candidate.siteId === site.id && candidate.status === "active" && candidate.creditCost > 0 && candidate.outputCount > 0)) {
      const rawSlug = pack.categoryRecord?.slug || pack.category || pack.name;
      const path = canonicalDirectoryPathForSite(site, publicCollectionPathForSite(site, rawSlug));
      const route = parsePublicCollectionRouteForSite(site, path);
      if (route?.kind !== "item") continue;
      const isAidreamcapesEu = site.id === "site_aidreamcapes_xby";
      if (isAidreamcapesImageThemePath(site.slug, path) || (!isAidreamcapesEu && isRetiredAidreamcapesPublicPath(site.slug, path)) || (!isAidreamcapesEu && aidreamcapesLegacyGalleryRedirectForPath(site.slug, path)) || (!isAidreamcapesEu && LEGACY_OR_DUPLICATE_PATHS.has(path)) || (!isAidreamcapesEu && (path === "/tools" || aidreamcapesLegacyVideoSaveTheDatePath(path))) || (path.endsWith("/social-cards") && !isAidreamcapesEu)) continue;
      // A catalogue pack without a published page is not a public SEO
      // document. Keeping this pass page-backed prevents stale collection
      // records from recreating retired URLs in the sitemap.
      if (!pageForCanonicalSeoPath(snapshot, site, path)) continue;
      const loc = sitemapUrl(site, path);
      if (entries.has(loc)) continue;
      entries.set(loc, {
        loc,
        images: packSitemapImages(site, pack),
        lastmod: pack.createdAt,
        changefreq: sitemapChangeFrequencyForPath(path),
        priority: sitemapPriorityForPath(path)
      });
    }
    for (const page of snapshot.pages.filter((candidate) => candidate.slug.startsWith("/ai-save-the-date/"))) {
      const path = canonicalDirectoryPathForSite(site, canonicalPathForSitemapPage(page));
      if (!path.startsWith("/ai-save-the-date/")) continue;
      if (isAidreamcapesEuRetiredPublicPath(site.id, path) || isRetiredAidreamcapesPublicPath(site.slug, path)) continue;
      const context = resolvePublishedStorefrontContext(snapshot, page);
      if (!context.seo.index || !context.seo.sitemapEligible) continue;
      const loc = sitemapUrl(site, path);
      if (entries.has(loc)) continue;
      entries.set(loc, {
        loc,
        images: collectPageSitemapImages(site, page),
        lastmod: pageContentLastModified(page, snapshot.publication?.publishedAt),
        changefreq: sitemapChangeFrequencyForPath(path),
        priority: sitemapPriorityForPath(path)
      });
    }
    // EU detail pages are served by the same published route projection as
    // the storefront, but historical sitemap generation only considered
    // page-backed CreativePacks and Save the Date rows. Reuse the canonical
    // SEO index here so active image, video, tool, and page-owned routes all
    // share one eligibility decision.
    for (const seoPage of indexableSeoPageEntriesForSite(state, site, snapshot)) {
      const path = seoPage.canonicalPath;
      if (!path || isAidreamcapesEuRetiredPublicPath(site.id, path) || aidreamcapesLegacyVideoSaveTheDatePath(path)) continue;
      const loc = sitemapUrl(site, path);
      if (entries.has(loc)) continue;
      const collectionRoute = parsePublicCollectionRouteForSite(site, path);
      const pack = collectionRoute?.collectionSlug
        ? state.creativePacks.find((candidate) => candidate.siteId === site.id && candidate.status === "active" &&
            [candidate.categoryRecord?.slug, candidate.category, candidate.name]
              .filter(Boolean)
              .some((value) => String(value).trim().toLowerCase() === collectionRoute.collectionSlug.toLowerCase()))
        : undefined;
      const page = pageForCanonicalSeoPath(snapshot, site, path);
      entries.set(loc, {
        loc,
        images: pack ? packSitemapImages(site, pack) : page ? collectPageSitemapImages(site, page) : [],
        lastmod: seoPage.lastModified,
        changefreq: sitemapChangeFrequencyForPath(path),
        priority: sitemapPriorityForPath(path)
      });
    }
  }
  if (isStorefrontVideoWatchSite(site)) {
    for (const video of videoWatchPages) {
      const loc = sitemapUrl(site, video.watchPath);
      const thumbnailLoc = sitemapMediaUrl(site, video.thumbnailPath);
      const contentLoc = sitemapMediaUrl(site, video.contentPath);
      if (!thumbnailLoc || !contentLoc) continue;
      entries.set(loc, {
        loc,
        images: [{ loc: thumbnailLoc, title: video.name }],
        video: {
          thumbnailLoc,
          title: video.name,
          description: video.description,
          contentLoc,
          publicationDate: video.uploadDate,
          duration: String(video.durationSeconds)
        },
        lastmod: video.uploadDate,
        changefreq: "monthly",
        priority: "0.8"
      });
    }
  }
  if (site.id === "site_mydreamshoots_xby" || site.primaryDomain.trim().toLowerCase() === "aidreamshoots.eu") {
    // The AIdreamshoots catalogue uses one slug segment below the canonical
    // image root. Filter malformed legacy projections even when they do not
    // parse as a collection route (for example /collections-avatar).
    for (const [loc] of entries) {
      try {
        const path = new URL(loc).pathname;
        const canonicalThemeLeaf = path.match(/^\/ai-image-generation\/([^/]+)$/i);
        const page = pageForCanonicalSeoPath(snapshot, site, path);
        const isUnbackedCanonicalThemeLeaf = Boolean(canonicalThemeLeaf && !page && !hasAidreamshootsCatalogCollectionPath(state, site, path));
        if (isUnbackedCanonicalThemeLeaf || path.startsWith("/ai-image-generation/collections-")) entries.delete(loc);
      } catch {
        entries.delete(loc);
      }
    }
  }
  if (site.id === AIDREAMCAPES_SITE_ID) {
    // Keep every Aidreamcapes page URL on the non-www canonical origin and
    // apply the same retirement rules to entries added by catalogue passes.
    // This final guard is intentionally scoped to the main Aidreamcapes site;
    // other storefront sitemap hosts and aliases remain untouched.
    for (const [loc, entry] of entries) {
      let path: string;
      try {
        path = new URL(loc).pathname;
      } catch {
        entries.delete(loc);
        continue;
      }
      if (path === "/tools" || aidreamcapesLegacyVideoSaveTheDatePath(path) || isRetiredAidreamcapesPublicPath(site.slug, path)) {
        entries.delete(loc);
        continue;
      }
      const canonicalLoc = sitemapUrl(site, path);
      if (canonicalLoc === loc) continue;
      entries.delete(loc);
      if (!entries.has(canonicalLoc)) entries.set(canonicalLoc, { ...entry, loc: canonicalLoc });
    }
  }
  if (site.id === "site_aidreamcapes_xby" || site.id === "site_mydreamshoots_xby") {
    const targetKey = site.id === "site_aidreamcapes_xby" ? "aidreamcapesPath" : "aidreamshootsPath";
    const allowedPaths = new Set(storefrontSourcePageMap.pages.map((page) => page[targetKey]));
    // A translated EU LivePage can be fully indexable while its historical
    // route projection is absent. Add the current relational page entity
    // directly so parity never depends on an old publication snapshot.
    for (const path of allowedPaths) {
      const loc = sitemapUrl(site, path);
      if (entries.has(loc) || path.startsWith("/watch/")) continue;
      const page = pageForCanonicalSeoPath(snapshot, site, path);
      if (!page || page.publishedJson.seo?.index === false || page.publishedJson.seo?.robots?.index === false) continue;
      entries.set(loc, {
        loc,
        images: collectPageSitemapImages(site, page),
        lastmod: pageContentLastModified(page, snapshot.publication?.publishedAt),
        changefreq: sitemapChangeFrequencyForPath(path),
        priority: sitemapPriorityForPath(path)
      });
    }
    for (const [loc] of entries) {
      try {
        if (!allowedPaths.has(new URL(loc).pathname)) entries.delete(loc);
      } catch {
        entries.delete(loc);
      }
    }
  }
  return [...entries.values()]
    .map((entry) => {
      if (site.id !== AIDREAMCAPES_SITE_ID) return entry;
      const path = new URL(entry.loc).pathname;
      if (path === "/ai-image-generation") return entry;
      // Match the renderer's current LivePage JSON, not media injected into
      // the legacy catalogue projection for a different layout.
      const page = site.pages.find((candidate) => normalizePath(candidate.slug) === path);
      return page ? { ...entry, images: collectPageSitemapImages(site, { ...page, publishedJson: page.draftJson }) } : entry;
    })
    .map((entry) => overrideAidreamcapesHomepageSitemapImages(site, entry))
    .sort((left, right) => left.loc.localeCompare(right.loc));
}

function canonicalPathForSitemapPage(page: ThemePage): string {
  const canonicalValue = page.publishedJson.seo?.canonical ?? page.publishedJson.seo?.canonicalPath ?? page.slug;
  return normalizePath(/^https?:\/\//i.test(canonicalValue) ? new URL(canonicalValue).pathname : canonicalValue);
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
  if (isDreamshootSite(site) && articleSlug === "ai-video-add-ons-photo-package-guide") {
    return "/blog/video-photo-package-guide";
  }
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
  if (site.id === "site_aidreamcapes_xby") {
    const euCanonicalPath = canonicalAidreamcapesEuPublicPath(normalized);
    if (euCanonicalPath !== normalized) return euCanonicalPath;
  }
  // A legacy EU catalogue serializer sometimes prefixed the image root twice
  // (for example `ai-image-generation-avatar`). Treat it as the same current
  // detail route so sitemap generation cannot publish a guaranteed 404.
  if (site.id === "site_aidreamcapes_xby" && normalized.startsWith("/ai-image-generation/ai-image-generation-")) {
    return `/ai-image-generation/${normalized.slice("/ai-image-generation/ai-image-generation-".length)}`;
  }
  // Registered Aidreamcapes image themes own their public route. Keep them
  // out of the legacy collection projection so sitemap entries, route
  // eligibility, and page metadata all resolve the same canonical path.
  if (isAidreamcapesImageThemePath(site.slug, normalized)) return normalized;
  if (isDreamshootSite(site) && ["/shipping", "/shipping-policy", "/delivery-policy", "/policies/shipping", "/policies/delivery", "/policies/delivery-policy"].includes(normalized)) {
    return "/digital-delivery";
  }
  if (isDreamshootSite(site)) {
    const canonicalSaveDate = canonicalSaveTheDatePath(normalized);
    if (canonicalSaveDate !== normalized) return canonicalSaveDate;
  }
  if (isCollectionDirectoryPath(normalized)) return publicCollectionPathForSite(site, collectionSlugFromDirectoryPath(site, normalized));
  if (isAidreamshootsStorefrontSite(site) && normalized.startsWith("/ai-video-generation/")) {
    const canonicalSaveDate = aidreamshootsLegacyVideoSaveTheDatePath(normalized);
    if (canonicalSaveDate) return canonicalSaveDate;
  }
  if (isVideoGenerationDirectoryPath(site, normalized)) return parsePublicVideoGenerationRouteForSite(site, normalized)?.canonicalPath ?? normalized;
  if (normalized.startsWith("/tools/")) return canonicalToolPathForSite(site, normalized);
  if (normalized === "/tools") return canonicalToolPathForSite(site, normalized);
  if (normalized.startsWith("/blog/")) return canonicalBlogPathForSite(site, normalized);
  return normalized;
}

function hasNonPageFileExtension(path: string): boolean {
  return /\.[a-z0-9]{2,5}$/i.test(path) && !path.endsWith(".html");
}

function isBlockedPublicPath(path: string, site?: Site): boolean {
  if (LEGACY_OR_DUPLICATE_PATHS.has(path) && !(site && (isAidreamshootsStorefrontSite(site) || site.id === "site_aidreamcapes_xby") && path === "/ai-image-generation/motion-generator")) return true;
  if (site && isDreamshootSite(site) && MYDREAMSHOOTS_LEGACY_PUBLIC_PATHS.has(path)) return true;
  if (site && isRetiredAidreamcapesPublicPath(site.slug, path)) return true;
  if (NON_INDEXABLE_TOOL_PATHS.has(path)) return true;
  if (hasNonPageFileExtension(path)) return true;
  if (BLOCKED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return true;
  return NON_PAGE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function isBlockedPublicPathForSite(site: Site, path: string): boolean {
  if (site.id === AIDREAMCAPES_SITE_ID && aidreamcapesLegacyGalleryRedirectForPath(site.slug, path)) return true;
  if ((site.id === "site_aidreamcapes" || site.id === "site_aidreamcapes_xby") && path.startsWith("/ai-image-generation/ai-image-generation-")) return true;
  if (isAidreamshootsStorefrontSite(site) && AIDREAMSHOOTS_LEGACY_ALIAS_PATHS.has(path)) return true;
  if (isAidreamshootsStorefrontSite(site) && path.startsWith("/ai-image-generation/collections-")) return true;
  if (isAidreamshootsStorefrontSite(site) && path.startsWith("/tools/")) return true;
  if (isDreamshootSite(site)) {
    if (path === "/collections" || path.startsWith("/collections/") || path === "/tools" || path.startsWith("/tools/") || path === "/ai-photoshoot" || path.startsWith("/ai-photoshoot/")) return true;
    if (path.startsWith("/ai-image-generation/") && !parsePublicCollectionRouteForSite(site, path)) return true;
    if (path.startsWith("/ai-video-generation/") && !isPublicVideoGenerationSitemapPath(site, path)) return true;
  }
  return isBlockedPublicPath(path, site);
}

function isPublicVideoGenerationSitemapPath(site: Site, path: string): boolean {
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
    if (isAidreamshootsStorefrontSite(site)) return false;
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
    if (!isIndexablePage(pageMatch.page, site)) return false;
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
  return site.id === DREAMSHOOT_SITE_ID || site.id === "site_grownstride_test" || DREAMSHOOT_SITE_SLUGS.has(site.slug) || site.primaryDomain === "www.mydreamshoots.com";
}

function isAidreamcapesSite(site: Site): boolean {
  return site.id === AIDREAMCAPES_SITE_ID ||
    site.id === "site_aidreamcapes_xby" ||
    AIDREAMCAPES_SITE_SLUGS.has(site.slug) ||
    site.primaryDomain === "www.aidreamcapes.com" ||
    site.primaryDomain === "aidreamcapes.eu" ||
    site.primaryDomain === "www.aidreamcapes.eu";
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

function isIndexablePage(page: ThemePage, site?: Site): boolean {
  const path = canonicalPublicPath(normalizePath(page.slug));
  if (site && isDreamshootSite(site) && path === "/shipping") return false;
  if (site && isAidreamshootsStorefrontSite(site) && AIDREAMSHOOTS_LEGACY_ALIAS_PATHS.has(path)) return false;
  // AIdreamshoots owns the motion-generator image collection route. The
  // same path is an alias only on the primary MyDreamShoots storefront.
  if (LEGACY_OR_DUPLICATE_PATHS.has(path) && !(site && isAidreamshootsStorefrontSite(site) && path === "/ai-image-generation/motion-generator")) return false;
  if (site && isDreamshootSite(site) && MYDREAMSHOOTS_LEGACY_PUBLIC_PATHS.has(path)) return false;
  if (NON_INDEXABLE_TOOL_PATHS.has(path)) return false;
  if (BLOCKED_PAGE_TYPES.has(page.pageType)) return false;
  return site ? !isBlockedPublicPathForSite(site, path) : !isBlockedPublicPath(path, site);
}

function isIndexableToolPath(site: Site, path: string): boolean {
  const normalized = canonicalToolPathForSite(site, path);
  if (isDreamshootSite(site) || isAidreamshootsStorefrontSite(site)) return false;
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

function hasAidreamshootsCatalogCollectionPath(state: PlatformState, site: Site, path: string): boolean {
  const normalized = canonicalDirectoryPathForSite(site, path);
  const route = parsePublicCollectionRouteForSite(site, normalized);
  if (!route?.collectionSlug) return route?.kind === "directory";
  const canonicalSlug = canonicalSeoDirectorySlugForSite(site, "collection", route.collectionSlug);
  return (state.creativePackCategories ?? []).some((category) =>
    category.siteId === site.id &&
    category.status === "active" &&
    canonicalSeoDirectorySlugForSite(site, "collection", category.slug || category.label) === canonicalSlug
  ) || state.creativePacks.some((pack) =>
    pack.siteId === site.id &&
    pack.status === "active" &&
    collectionSlugsForPack(site, pack).includes(canonicalSlug)
  );
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
  if (normalized === "/tools") {
    paths.add(normalized);
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

  // Keep the public editorial inventory in the same candidate set as dynamic
  // catalogue links. The final resolver below still requires a published
  // page/route, so a missing draft cannot become a sitemap URL by declaration.
  for (const path of [
    ...REQUIRED_INDEXABLE_CONTENT_PATHS,
    ...(isAidreamshootsStorefrontSite(site) || site.id === "site_aidreamcapes_xby" ? REQUIRED_INDEXABLE_EU_PARITY_PATHS : []),
    ...REQUIRED_INDEXABLE_POLICY_PATHS,
    ...(isAidreamshootsStorefrontSite(site) ? REQUIRED_INDEXABLE_AIDREAMSHOOTS_PATHS : []),
    ...(site.id === "site_aidreamcapes_xby" ? REQUIRED_INDEXABLE_AIDREAMCAPES_EU_PATHS : [])
  ]) {
    addPublicPath(state, site, paths, path);
  }
  if (site.id === "site_aidreamcapes_xby") {
    for (const path of AIDREAMCAPES_EU_PUBLIC_DETAIL_PATHS) addPublicPath(state, site, paths, path);
  }

  return Array.from(paths);
}

function seoPageTypeForPath(path: string, page?: ThemePage): SeoPageEntry["pageType"] {
  if (path === "/") return "home";
  if (path.startsWith("/blog")) return "blog";
  if (path.startsWith("/account") || path.startsWith("/app") || path.startsWith("/login")) return "auth";
  if (path === "/404" || page?.pageType === "404" || page?.pageType === "not_found") return "error";
  if (path.startsWith("/ai-image-generation/") || path.startsWith("/collections/") || path.startsWith("/ai-video-generation/") || path.startsWith("/tools/")) return "theme";
  return "marketing";
}

function pageForCanonicalSeoPath(snapshot: ReturnType<typeof createPublishedSiteSnapshot>, site: Site, path: string): ThemePage | undefined {
  return snapshot.pages.find((page) => canonicalDirectoryPathForSite(site, canonicalPathForSitemapPage(page)) === path)
    ?? snapshot.pages.find((page) => canonicalDirectoryPathForSite(site, normalizePath(page.slug)) === path);
}

/**
 * The canonical SEO page index is shared by sitemap discovery and the
 * dynamic catalogue pass. It deliberately resolves only published, reachable
 * paths; menu links alone are never enough to create an indexable URL.
 */
export function indexableSeoPageEntriesForSite(state: PlatformState, site: Site, snapshot = createPublishedSiteSnapshot(state, site)): SeoPageEntry[] {
  const candidates = new Set(collectDynamicIndexablePaths(state, site));
  const collectionRoot = publicCollectionPathForSite(site, "");
  const collectionPage = pageForCanonicalSeoPath(snapshot, site, collectionRoot);
  for (const route of snapshot.publishedRoutes) {
    if (route.disposition !== "render" || !route.status || !route.canonicalPath) continue;
    candidates.add(canonicalDirectoryPathForSite(site, route.canonicalPath));
  }

  const entries: SeoPageEntry[] = [];
  for (const candidate of candidates) {
    const canonicalPath = canonicalDirectoryPathForSite(site, candidate);
    if (!canonicalPath || isBlockedPublicPathForSite(site, canonicalPath)) continue;
    if (site.id === "site_aidreamcapes_xby" && isAidreamcapesEuRetiredPublicPath(site.id, canonicalPath)) continue;
    // These were generated by an old collection-card serializer and are not
    // real AIdreamshoots routes. Keep them out of both the canonical index and
    // the sitemap so the two sets cannot drift apart.
    if (isAidreamshootsStorefrontSite(site) && canonicalPath.startsWith("/ai-image-generation/collections-")) continue;
    const route = snapshot.publishedRoutes.find((item) => item.disposition === "render" && item.canonicalPath === canonicalPath);
    const page = pageForCanonicalSeoPath(snapshot, site, canonicalPath);
    const explicitEditorialPage = (
      isAidreamshootsStorefrontSite(site) &&
      [...REQUIRED_INDEXABLE_CONTENT_PATHS, ...REQUIRED_INDEXABLE_AIDREAMSHOOTS_PATHS, ...REQUIRED_INDEXABLE_EU_PARITY_PATHS].includes(canonicalPath)
    ) || (
      site.id === "site_aidreamcapes_xby" &&
      [...REQUIRED_INDEXABLE_AIDREAMCAPES_EU_PATHS, ...REQUIRED_INDEXABLE_EU_PARITY_PATHS].includes(canonicalPath)
    );
    let indexable = false;

    if (route && "status" in route) {
      indexable = route.status === "published" && route.indexable && route.sitemapEligible;
    } else if (parsePublicCollectionRouteForSite(site, canonicalPath)) {
      // AIdreamshoots collection leaves are generated from the active pack
      // catalogue rather than individual ThemePage rows.
      const collectionIsReachable = isAidreamshootsStorefrontSite(site)
        ? hasAidreamshootsCatalogCollectionPath(state, site, canonicalPath)
        : canResolveCollectionPath(state, site, canonicalPath);
      indexable = Boolean(collectionPage && collectionIsReachable && isIndexablePage(collectionPage, site));
    } else if (page) {
      try {
        const effective = resolveEffectivePublishedPage(snapshot, page.slug);
        indexable = isIndexablePage(page, site)
          && effective.routeDisposition.kind === "render"
          && effective.indexability.index
          && effective.indexability.sitemapEligible;
      } catch {
        indexable = false;
      }
    }
    // AIdreamshoots editorial rows are served from the current LivePage
    // projection and can legitimately exist without a historical publication
    // route entity. Their own SEO flags remain authoritative.
    if (!indexable && explicitEditorialPage && page && isIndexablePage(page, site)) {
      const seo = page.publishedJson.seo;
      indexable = seo?.index !== false && seo?.robots?.index !== false && canonicalDirectoryPathForSite(site, canonicalPathForSitemapPage(page)) === canonicalPath;
    }
    // These EU tool leaves are page-owned by the renderer. They intentionally
    // do not require one historical LivePage row per public URL, but remain a
    // closed allowlist so arbitrary internal links cannot enter the sitemap.
    if (!indexable && site.id === "site_aidreamcapes_xby" && AIDREAMCAPES_EU_PUBLIC_DETAIL_PATHS.has(canonicalPath)) {
      indexable = true;
    }
    if (!indexable) continue;
    entries.push({
      path: canonicalPath,
      canonicalPath,
      pageType: seoPageTypeForPath(canonicalPath, page),
      indexable: true,
      lastModified: sitemapLastModifiedForPath(state, site, snapshot, canonicalPath, page)
    });
  }
  return Array.from(new Map(entries.map((entry) => [entry.canonicalPath, entry])).values())
    .sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath));
}

async function readIndexableStateAndSites(): Promise<{ state: PlatformState; sites: Site[] } | undefined> {
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

async function readIndexableStateAndSitesForHosts(hosts: string[]): Promise<{ state: PlatformState; sites: Site[] } | undefined> {
  try {
    for (const host of hosts) {
      const state = await readStorefrontPublicIndexingStateByHostFromDatabase(host);
      if (!state) continue;
      const sites = findIndexableSites(state);
      if (sites.length) return { state, sites };
    }
  } catch {
    // Public indexing is fail-closed when the live relational projection is unavailable.
    return undefined;
  }
  return undefined;
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

export async function getMydreamshootsVideoWatchPagesForHost(
  hosts: string | null | undefined | Array<string | null | undefined>
): Promise<readonly MyDreamShootsVideoWatchPage[]> {
  return getStorefrontVideoWatchPagesForHost(hosts);
}

export async function getStorefrontVideoWatchPagesForHost(
  hosts: string | null | undefined | Array<string | null | undefined>
): Promise<readonly MyDreamShootsVideoWatchPage[]> {
  const normalizedHosts = normalizeHostCandidates(hosts);
  if (!normalizedHosts.some(isStorefrontVideoHost)) return [];

  // Reverse proxies can provide both a public x-forwarded-host and an
  // internal loopback host. A request is local only when every candidate is
  // local; otherwise the public host must use the same published projection
  // as the sitemap.
  const localRequest = normalizedHosts.length > 0 && normalizedHosts.every(isLocalDevelopmentHost);
  const runtime = localRequest
    ? await readIndexableStateAndSites()
    : await readIndexableStateAndSitesForHosts(normalizedHosts);
  if (!runtime) return [];
  // Keep the watch-page registry on the same host-resolved site as the
  // sitemap. In multi-site runtime snapshots, taking the first DreamShoot
  // site can silently produce watch pages from a different site's content.
  const site = getSiteByHostCandidatesFromState(runtime.state, normalizedHosts)
    ?? runtime.sites.find((candidate) => normalizedHosts.some((host) => isHostForVideoWatchSite(candidate, host)))
    ?? runtime.sites.find(isStorefrontVideoWatchSite);
  if (!site || !isStorefrontVideoWatchSite(site)) return [];
  const snapshot = createPublishedSiteSnapshot(runtime.state, site, { source: "postgres" });
  return mydreamshootsVideoWatchPagesForSnapshot(runtime.state, site, snapshot);
}

function isStorefrontVideoWatchSite(site: Site): boolean {
  return site.id === DREAMSHOOT_SITE_ID
    || site.id === "site_mydreamshoots_xby"
    || site.id === "site_aidreamcapes_xby"
    || site.primaryDomain.trim().toLowerCase() === "www.mydreamshoots.com"
    || site.primaryDomain.trim().toLowerCase() === "aidreamshoots.eu"
    || site.primaryDomain.trim().toLowerCase() === "www.aidreamshoots.eu"
    || site.primaryDomain.trim().toLowerCase() === "aidreamcapes.eu"
    || site.primaryDomain.trim().toLowerCase() === "www.aidreamcapes.eu";
}

function isHostForVideoWatchSite(site: Site, host: string): boolean {
  const normalized = host.trim().toLowerCase().split(":")[0];
  if (!normalized) return false;
  if (normalized.includes("aidreamshoots")) return site.id === "site_mydreamshoots_xby" || site.primaryDomain.toLowerCase().includes("aidreamshoots");
  if (normalized.includes("aidreamcapes")) return site.id === "site_aidreamcapes_xby" || site.primaryDomain.toLowerCase().includes("aidreamcapes");
  if (normalized.includes("mydreamshoots")) return isDreamshootSite(site);
  return false;
}

function isLocalDevelopmentHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export async function getStorefrontSitemapUrlsForHost(hosts: string | null | undefined | Array<string | null | undefined>): Promise<string[]> {
  const entries = await getStorefrontSitemapEntriesForHost(hosts);
  return entries.map((entry) => entry.loc);
}

export type StorefrontSitemapPayload = {
  entries: SitemapEntry[];
  /** Whether the requested host/site was resolved from the live database state. */
  resolved: boolean;
  siteId?: string;
  identity?: {
    publicationId?: string;
    publicationVersion?: number;
    currentRevision?: string;
    contentHash?: string;
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
  };
};

export async function getStorefrontSitemapPayloadForHost(hosts: string | null | undefined | Array<string | null | undefined>): Promise<StorefrontSitemapPayload> {
  const normalizedHosts = normalizeHostCandidates(hosts);
  const normalizedHost = normalizedHosts[0] ?? "";
  if (!normalizedHost) {
    return { entries: [], resolved: false };
  }
  const publicHostCandidates = normalizedHosts.filter((host) => !isLocalDevelopmentHost(host));
  const siteHostCandidates = publicHostCandidates.length ? publicHostCandidates : normalizedHosts;
  const isLocalHostRequest = !publicHostCandidates.length && normalizedHosts.some(isLocalDevelopmentHost);
  if (siteHostCandidates.some(isReservedGrownstrideHost)) return { entries: [], resolved: false };
  const runtime = publicHostCandidates.length
    ? await readIndexableStateAndSitesForHosts(siteHostCandidates)
    : await readIndexableStateAndSites();
  if (!runtime) return { entries: [], resolved: false };
  const site =
    isLocalHostRequest
      ? runtime.sites[0]
      : getSiteByHostCandidatesFromState(runtime.state, siteHostCandidates) ?? runtime.sites.find((item) => siteHostCandidates.some((host) => isHostForSite(item, host)));
  const entries = isLocalHostRequest
    ? runtime.sites.flatMap((item) => sitemapEntriesForSite(runtime.state, item))
    : site ? sitemapEntriesForSite(runtime.state, site) : [];
  if (!site) return { entries, resolved: false };
  const live = createPublishedSiteSnapshot(runtime.state, site, { source: "postgres" });
  const revisions = live.snapshotRevisions;
  return {
    entries,
    resolved: true,
    siteId: site.id,
    identity: {
      publicationId: undefined,
      publicationVersion: undefined,
      currentRevision: undefined,
      contentHash: undefined,
      snapshotHash: undefined,
      buildId: live.buildId,
      routeRevision: revisions.routeRevision,
      pageRevision: revisions.pageRevision,
      copyRevision: revisions.copyRevision,
      mediaRevision: revisions.mediaRevision,
      factsRevision: revisions.factsRevision,
      offerRevision: revisions.offerRevision,
      collectionRevision: revisions.collectionRevision,
      linkRevision: revisions.linkRevision,
      policyRevision: revisions.policyRevision
    }
  };
}

export async function getStorefrontSitemapEntriesForHost(hosts: string | null | undefined | Array<string | null | undefined>): Promise<SitemapEntry[]> {
  return (await getStorefrontSitemapPayloadForHost(hosts)).entries;
}

export async function getStorefrontPublicationIdentityForHost(
  hosts: string | null | undefined | Array<string | null | undefined>
): Promise<{
  publicationId?: string;
  publicationVersion?: number;
  currentRevision?: string;
  contentHash?: string;
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
  return (await getStorefrontSitemapPayloadForHost(hosts)).identity;
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
