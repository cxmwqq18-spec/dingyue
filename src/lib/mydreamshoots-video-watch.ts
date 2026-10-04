import type { ContextualLink, PlatformState, PublishedHomepageShowcaseItem, Site } from "@/lib/types";
import { contextualLinksFromValue } from "@/lib/contextual-links";
import type { StorefrontLocale } from "@/lib/storefront-locale";
import { isBlockedPublicVideoThemeSlugForSite } from "@/lib/video-theme-public-scope";

export const MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN = "https://www.mydreamshoots.com";

export type MyDreamShootsVideoWatchPage = {
  siteId: string;
  locale: StorefrontLocale;
  origin: string;
  brand: string;
  slug: string;
  watchPath: string;
  canonicalUrl: string;
  sourcePath: string;
  sourcePaths: readonly string[];
  sourceLabel?: string;
  contextualLinks?: ContextualLink[];
  name: string;
  description: string;
  thumbnailPath: string;
  contentPath: string;
  uploadDate: string;
  durationSeconds: number;
};

const VIDEO_PATH_PATTERN = /\.(?:mp4|webm)(?:[?#]|$)/i;
const IMAGE_PATH_PATTERN = /\.(?:avif|jpe?g|png|webp)(?:[?#]|$)/i;

type VideoWatchSiteConfig = {
  siteId: string;
  origin: string;
  brand: string;
  locale: StorefrontLocale;
  assetRoots: readonly string[];
  slugAliases?: ReadonlyMap<string, string>;
};

const AIDREAMCAPES_EU_VIDEO_SLUG_ALIASES = new Map([
  [
    "/assets/sites/site_aidreamcapes_eu/visuals/tutorial/aidreamcapes-ai-image-tutorial-20260814.mp4",
    "portrait-parlant"
  ],
  [
    "/assets/sites/site_aidreamcapes_eu/visuals/tutorial/aidreamcapes-ai-video-tutorial-20260814.mp4",
    "video-cinematographique"
  ]
]);

const VIDEO_WATCH_SITE_CONFIGS: readonly VideoWatchSiteConfig[] = [
  {
    siteId: "site_dreamshoot",
    origin: MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN,
    brand: "myDreamshoots",
    locale: "en",
    assetRoots: ["/assets/dreamshoot/", "/assets/sites/site_dreamshoot/"]
  },
  {
    siteId: "site_mydreamshoots_xby",
    origin: "https://aidreamshoots.eu",
    brand: "Aidreamshoots",
    locale: "es",
    assetRoots: ["/assets/sites/site_aidreamshoots/"]
  },
  {
    siteId: "site_aidreamcapes_xby",
    origin: "https://aidreamcapes.eu",
    brand: "Aidreamcapes",
    locale: "fr",
    assetRoots: ["/assets/sites/site_aidreamcapes_eu/"],
    slugAliases: AIDREAMCAPES_EU_VIDEO_SLUG_ALIASES
  }
];

function videoWatchSiteConfig(site: Pick<Site, "id" | "primaryDomain" | "slug">): VideoWatchSiteConfig | undefined {
  const byId = VIDEO_WATCH_SITE_CONFIGS.find((config) => config.siteId === site.id);
  if (byId) return byId;
  const identity = `${site.slug} ${site.primaryDomain}`.toLowerCase();
  if (identity.includes("aidreamshoots")) return VIDEO_WATCH_SITE_CONFIGS.find((config) => config.siteId === "site_mydreamshoots_xby");
  if (identity.includes("aidreamcapes")) return VIDEO_WATCH_SITE_CONFIGS.find((config) => config.siteId === "site_aidreamcapes_xby");
  if (identity.includes("mydreamshoots") || identity.includes("dreamshoot")) return VIDEO_WATCH_SITE_CONFIGS.find((config) => config.siteId === "site_dreamshoot");
  return undefined;
}

function isAllowedAssetPath(path: string, config: VideoWatchSiteConfig): boolean {
  if (!config.assetRoots.some((root) => path.startsWith(root))) return false;
  // The EU publication may keep historical mirror rows for rollback, but a
  // public watch page must never promote a mirror path as its canonical media.
  if (config.siteId === "site_aidreamcapes_xby" && path.includes("/mirror/")) return false;
  return true;
}

// These aliases preserve the three URLs that were previously published while
// allowing their metadata to come from the current published runtime data.
const LEGACY_VIDEO_SLUG_ALIASES = new Map([
  ["/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-20260814.mp4", "ai-video-creation-tutorial"],
  ["/assets/dreamshoot/seasonal/christmas/christmas-hero-family-gift.mp4", "christmas-family-gift"],
  ["/assets/dreamshoot/save-the-date/valentines-day/valentines-day-save-the-date.mp4", "valentines-day-save-the-date"]
]);

const LEGACY_VIDEO_WATCH_SLUG_ALIASES = new Map([
  ["turn-photos-and-ideas-into-tiktok-first-videos", "/assets/dreamshoot/tiktok-video/turn-your-photos-and-ideas-into-tiktok-first-videos.mp4"]
]);

// These public videos predate the relational watch-page metadata contract.
// Keep their known editorial facts as fallback data so an older homepage or
// workflow record cannot publish a link that resolves to a 404 merely because
// its ThemePage JSON has no videoDurationSeconds field.
type LegacyVideoCatalogEntry = {
  sourcePath: string;
  name: string;
  description: string;
  thumbnailPath: string;
  uploadDate: string;
  durationSeconds: number;
};

const MYDREAMSHOOTS_LEGACY_VIDEO_CATALOG = new Map<string, LegacyVideoCatalogEntry>([
  [
    "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-20260814.mp4",
    {
      sourcePath: "/workflow",
      name: "Create an AI photo set from source photos.",
      description: "Watch the signed-in flow: choose a photo package, upload a clear source photo, review audience, credits, and selected uploads, start generation, refresh the workspace, and open the finished image.",
      thumbnailPath: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-tutorial-20260814-cover-v2.jpg",
      uploadDate: "2026-08-14T00:00:00.000Z",
      durationSeconds: 61
    }
  ],
  [
    "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-video-tutorial-20260814.mp4",
    {
      sourcePath: "/workflow",
      name: "Turn selected images into a private AI video.",
      description: "Watch the image-to-video flow: upload frame images, choose the video mode, set the aspect ratio and duration, generate the clip, and preview the finished motion result.",
      thumbnailPath: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-video-tutorial-20260814-cover-v2.jpg",
      uploadDate: "2026-08-14T00:00:00.000Z",
      durationSeconds: 58
    }
  ],
  [
    "/assets/dreamshoot/tiktok-video/turn-your-photos-and-ideas-into-tiktok-first-videos.mp4",
    {
      sourcePath: "/ai-video-generation/tiktok-video",
      name: "TikTok Video",
      description: "Turn photos and ideas into TikTok-first vertical videos with clearer hooks, mobile-safe framing, captions, sound-aware structure, and one focused close.",
      thumbnailPath: "/assets/dreamshoot/generated/video-topic-clean/tiktok-video/ai-tiktok-video-creator-phone-portrait.webp",
      uploadDate: "2026-08-19T10:09:23.619Z",
      durationSeconds: 15
    }
  ]
]);

type VideoWatchSourcePage = {
  slug: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedJson?: unknown;
};

type VideoCandidate = {
  contentPath: string;
  sourcePath: string;
  name?: string;
  description?: string;
  thumbnailPath?: string;
  uploadDate?: string;
  durationSeconds?: number;
  preferredSourcePath?: string;
  sourceLabel?: string;
  contextualLinks?: ContextualLink[];
};

function normalizePath(value: string): string {
  const clean = value.trim().split("?")[0]?.split("#")[0] ?? "";
  if (!clean) return "";
  return clean === "/" ? "/" : `/${clean.replace(/^\/+|\/+$/g, "")}`;
}

function normalizeAssetPath(value: unknown, pattern: RegExp, config = VIDEO_WATCH_SITE_CONFIGS[0]): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const raw = value.trim();
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const allowedHost = new URL(config.origin).hostname.toLowerCase();
      const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname);
      if (url.hostname && url.hostname.toLowerCase() !== allowedHost && !localHost) return "";
      path = url.pathname;
    } catch {
      return "";
    }
  }
  const normalized = normalizePath(path);
  return pattern.test(normalized) ? normalized : "";
}

export function isMydreamshootsVideoContentPath(value: unknown): value is string {
  const config = VIDEO_WATCH_SITE_CONFIGS[0];
  return isAllowedAssetPath(normalizeAssetPath(value, VIDEO_PATH_PATTERN, config), config);
}

export function isStorefrontVideoContentPath(value: unknown, site?: Pick<Site, "id" | "primaryDomain" | "slug">): value is string {
  const config = site ? videoWatchSiteConfig(site) : undefined;
  if (!config) return false;
  const path = normalizeAssetPath(value, VIDEO_PATH_PATTERN, config);
  return isAllowedAssetPath(path, config);
}

function normalizeVideoContentPath(value: unknown, config = VIDEO_WATCH_SITE_CONFIGS[0]): string {
  const path = normalizeAssetPath(value, VIDEO_PATH_PATTERN, config);
  return isAllowedAssetPath(path, config) ? path : "";
}

function normalizeThumbnailPath(value: unknown, config = VIDEO_WATCH_SITE_CONFIGS[0]): string {
  const path = normalizeAssetPath(value, IMAGE_PATH_PATTERN, config);
  return isAllowedAssetPath(path, config) ? path : "";
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function firstText(values: unknown[]): string {
  return values.map(textValue).find(Boolean) ?? "";
}

function firstValue(values: unknown[]): unknown {
  return values.find((value) => {
    if (typeof value === "number") return Number.isFinite(value) && value > 0;
    return Boolean(textValue(value));
  });
}

function parseDuration(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.floor(value);
  const raw = textValue(value);
  if (!raw) return undefined;
  const isoMatch = raw.match(/^PT(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (isoMatch) {
    const seconds = Number(isoMatch[1] ?? 0) * 60 + Number(isoMatch[2] ?? 0);
    return seconds > 0 ? Math.floor(seconds) : undefined;
  }
  const parsed = Number(raw.replace(/s$/i, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
}

function normalizeUploadDate(value: unknown, fallback = ""): string {
  const raw = textValue(value);
  const timestamp = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function humanizeFilename(contentPath: string): string {
  const filename = contentPath.split("/").pop()?.replace(/\.(?:mp4|webm)$/i, "") ?? "video";
  return filename.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "video";
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).slice(0, 6);
}

function stableSlug(contentPath: string, usedSlugs: Set<string>, config?: VideoWatchSiteConfig): string {
  const configuredSlug = config?.slugAliases?.get(contentPath);
  if (configuredSlug && !usedSlugs.has(configuredSlug)) return configuredSlug;
  const legacySlug = LEGACY_VIDEO_SLUG_ALIASES.get(contentPath);
  if (legacySlug) return legacySlug;
  const base = slugify(humanizeFilename(contentPath));
  if (!usedSlugs.has(base)) return base;
  return `${base}-${shortHash(contentPath)}`;
}

function sourcePathForPage(sourcePath: unknown): string {
  const raw = textValue(sourcePath);
  if (/^https?:\/\//i.test(raw)) {
    try {
      return normalizePath(new URL(raw).pathname) || "/";
    } catch {
      return "/";
    }
  }
  const normalized = normalizePath(raw);
  return normalized || "/";
}

function metadataFromObject(value: Record<string, unknown>, fallback: VideoCandidate, config: VideoWatchSiteConfig): Omit<VideoCandidate, "contentPath" | "sourcePath"> {
  const thumbnailPath = firstText([
    value.videoPosterUrl,
    value.videoPoster,
    value.posterUrl,
    value.poster,
    value.thumbnailUrl,
    value.thumbnail,
    value.imageUrl,
    value.coverImage,
    value.image
  ].map((item) => normalizeThumbnailPath(item, config)));
  const durationSeconds = parseDuration(firstValue([
    value.videoDurationSeconds,
    value.durationSeconds,
    value.videoDuration,
    value.duration
  ]));
  return {
    name: firstText([value.videoTitle, value.title, value.name, fallback.name]),
    description: firstText([value.videoDescription, value.description, value.subtitle, fallback.description]),
    thumbnailPath: thumbnailPath || fallback.thumbnailPath,
    uploadDate: normalizeUploadDate(value.videoUploadDate ?? value.uploadDate ?? value.createdAt ?? value.updatedAt ?? fallback.uploadDate),
    durationSeconds: durationSeconds ?? fallback.durationSeconds,
    preferredSourcePath: config.siteId === "site_dreamshoot" && typeof value.sourcePath === "string" && /^\/(?!\/)/.test(value.sourcePath)
      ? sourcePathForPage(value.sourcePath)
      : fallback.preferredSourcePath,
    sourceLabel: (config.siteId === "site_dreamshoot" ? textValue(value.sourceLabel) : "") || fallback.sourceLabel,
    contextualLinks: config.siteId === "site_dreamshoot" && contextualLinksFromValue(value.contextualLinks).length
      ? contextualLinksFromValue(value.contextualLinks)
      : fallback.contextualLinks
  };
}

function collectVideoCandidates(value: unknown, fallback: VideoCandidate, config: VideoWatchSiteConfig, onCandidate: (candidate: VideoCandidate) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectVideoCandidates(item, fallback, config, onCandidate));
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  const metadata = metadataFromObject(object, fallback, config);
  for (const [key, child] of Object.entries(object)) {
    const contentPath = normalizeVideoContentPath(child, config);
    if (contentPath) {
      onCandidate({ contentPath, sourcePath: metadata.preferredSourcePath ?? fallback.sourcePath, ...metadata });
      continue;
    }
    if (typeof child === "object" && child !== null) {
      collectVideoCandidates(child, { ...fallback, ...metadata }, config, onCandidate);
    }
    // Keeping this variable makes it explicit that only media-bearing values
    // are treated as video sources; arbitrary URLs in copy are ignored.
    void key;
  }
}

function addCandidate(records: Map<string, MyDreamShootsVideoWatchPage>, candidate: VideoCandidate, config: VideoWatchSiteConfig, usedSlugs: Set<string>): void {
  const contentPath = normalizeVideoContentPath(candidate.contentPath, config);
  if (!contentPath) return;
  const sourcePath = sourcePathForPage(candidate.sourcePath);
  const existing = records.get(contentPath);
  if (existing) {
    const sourcePaths = Array.from(new Set([...existing.sourcePaths, sourcePath])).sort();
    const next = {
      ...existing,
      sourcePath: candidate.preferredSourcePath ?? (existing.sourcePath || sourcePath),
      sourcePaths,
      sourceLabel: candidate.sourceLabel || existing.sourceLabel,
      contextualLinks: candidate.contextualLinks?.length ? candidate.contextualLinks : existing.contextualLinks,
      name: existing.name || textValue(candidate.name),
      description: existing.description || textValue(candidate.description),
      thumbnailPath: existing.thumbnailPath || candidate.thumbnailPath || "",
      uploadDate: existing.uploadDate || normalizeUploadDate(candidate.uploadDate),
      durationSeconds: existing.durationSeconds || candidate.durationSeconds || 0
    };
    if (!next.name || !next.description || !next.thumbnailPath || !next.uploadDate || next.durationSeconds <= 0) return;
    records.set(contentPath, next);
    return;
  }
  const name = textValue(candidate.name);
  const description = textValue(candidate.description);
  const thumbnailPath = textValue(candidate.thumbnailPath);
  const uploadDate = normalizeUploadDate(candidate.uploadDate);
  const durationSeconds = candidate.durationSeconds && candidate.durationSeconds > 0
    ? Math.floor(candidate.durationSeconds)
    : 0;
  // A watch page is indexable only when the current relational source has a
  // complete editorial record. Do not invent a title, description, date, or
  // duration from a filename or a historical/runtime fallback.
  if (!name || !description || !thumbnailPath || !uploadDate || durationSeconds <= 0) return;
  const slug = stableSlug(contentPath, usedSlugs, config);
  usedSlugs.add(slug);
  records.set(contentPath, {
    slug,
    watchPath: `/watch/${slug}`,
    sourcePath,
    sourcePaths: [sourcePath],
    sourceLabel: candidate.sourceLabel,
    contextualLinks: candidate.contextualLinks,
    name,
    description,
    siteId: config.siteId,
    locale: config.locale,
    origin: config.origin,
    brand: config.brand,
    thumbnailPath,
    contentPath,
    uploadDate,
    durationSeconds,
    canonicalUrl: `${config.origin}/watch/${slug}`
  });
}

function addLegacyCatalogEntries(
  records: Map<string, MyDreamShootsVideoWatchPage>,
  config: VideoWatchSiteConfig,
  usedSlugs: Set<string>
): void {
  if (config.siteId !== "site_dreamshoot") return;
  for (const [contentPath, entry] of MYDREAMSHOOTS_LEGACY_VIDEO_CATALOG) {
    addCandidate(records, { contentPath, ...entry }, config, usedSlugs);
  }
}

export function mydreamshootsVideoWatchPagesForState(
  state: Pick<PlatformState, "videoThemes">,
  site: Pick<Site, "id" | "slug" | "primaryDomain" | "themeSettings">,
  options: {
    pages?: readonly VideoWatchSourcePage[];
    homepageShowcases?: readonly PublishedHomepageShowcaseItem[];
    themeSettingsJson?: unknown;
  } = {}
): readonly MyDreamShootsVideoWatchPage[] {
  const config = videoWatchSiteConfig(site);
  if (!config) return [];
  const records = new Map<string, MyDreamShootsVideoWatchPage>();
  // Source aliases are part of the MyDreamShoots compatibility contract. EU
  // stores own their watch namespace and must not inherit those reservations,
  // otherwise an otherwise stable localized slug gets an accidental hash
  // suffix (for example the Valentine page on Aidreamshoots).
  const usedSlugs = config.siteId === "site_dreamshoot" ? new Set(LEGACY_VIDEO_SLUG_ALIASES.values()) : new Set<string>();
  const pages = options.pages ?? [];
  for (const page of pages) {
    const sourcePath = sourcePathForPage(page.slug);
    const fallback: VideoCandidate = {
      contentPath: "",
      sourcePath,
      name: page.title,
      description: page.description,
      uploadDate: page.updatedAt ?? page.createdAt,
      durationSeconds: undefined
    };
    collectVideoCandidates(page.publishedJson, fallback, config, (candidate) => addCandidate(records, candidate, config, usedSlugs));
  }
  collectVideoCandidates(options.themeSettingsJson ?? site.themeSettings?.publishedJson, {
    contentPath: "",
    sourcePath: "/",
    name: "",
    description: "",
    uploadDate: "",
    durationSeconds: undefined
  }, config, (candidate) => addCandidate(records, candidate, config, usedSlugs));

  for (const item of options.homepageShowcases ?? []) {
    const contentPath = normalizeVideoContentPath(item.videoUrl, config);
    if (!contentPath || item.status !== "published" || !item.indexable || !item.sitemapEligible) continue;
    const candidate: VideoCandidate = {
      contentPath,
      sourcePath: "/",
      name: item.title,
      description: item.subtitle,
      thumbnailPath: normalizeThumbnailPath(item.imageUrl, config),
      uploadDate: "",
      durationSeconds: undefined
    };
    addCandidate(records, candidate, config, usedSlugs);
    addCandidate(records, { ...candidate, sourcePath: item.canonicalPath }, config, usedSlugs);
  }

  for (const theme of state.videoThemes ?? []) {
    if (theme.siteId !== site.id || theme.status !== "active") continue;
    const contentPath = (theme.galleryImages ?? []).map((item) => normalizeVideoContentPath(item, config)).find(Boolean) ?? "";
    if (!contentPath) continue;
    const relatedSourcePath = isBlockedPublicVideoThemeSlugForSite(site.id, theme.slug)
      ? "/ai-video-generation"
      : `/ai-video-generation/${theme.slug}`;
    addCandidate(records, {
      contentPath,
      sourcePath: relatedSourcePath,
      name: theme.name,
      description: theme.description || theme.headline,
      thumbnailPath: normalizeThumbnailPath(theme.imageUrl, config),
      uploadDate: theme.createdAt,
      durationSeconds: theme.durationSeconds
    }, config, usedSlugs);
    addCandidate(records, {
      contentPath,
      sourcePath: "/",
      name: theme.name,
      description: theme.description || theme.headline,
      thumbnailPath: normalizeThumbnailPath(theme.imageUrl, config),
      uploadDate: theme.createdAt,
      durationSeconds: theme.durationSeconds
    }, config, usedSlugs);
  }

  // Runtime relational and published metadata wins; the catalog only fills gaps.
  addLegacyCatalogEntries(records, config, usedSlugs);

  // The current video index owns its watch-page links. Generic links inherited
  // from a source page must not replace that authored sequence.
  if (config.siteId === "site_dreamshoot") {
    for (const page of pages) {
      if (page.slug !== "/best-ai-video") continue;
      const json = page.publishedJson;
      if (!json || typeof json !== "object" || !("videoWatchEntries" in json)) continue;
      const entries = (json as { videoWatchEntries?: unknown }).videoWatchEntries;
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const value = entry as Record<string, unknown>;
        const contentPath = normalizeVideoContentPath(value.videoUrl, config);
        const links = contextualLinksFromValue(value.contextualLinks);
        const current = records.get(contentPath);
        if (current && links.length) records.set(contentPath, { ...current, contextualLinks: links });
      }
    }
  }

  return [...records.values()].sort((left, right) => left.watchPath.localeCompare(right.watchPath));
}

export function mydreamshootsVideoWatchPageForSlug(
  slug: string,
  pages: readonly MyDreamShootsVideoWatchPage[] = []
): MyDreamShootsVideoWatchPage | undefined {
  const exact = pages.find((page) => page.slug === slug);
  if (exact) return exact;
  const aliasedContentPath = LEGACY_VIDEO_WATCH_SLUG_ALIASES.get(slug);
  return aliasedContentPath ? pages.find((page) => page.contentPath === aliasedContentPath) : undefined;
}

export function mydreamshootsVideoWatchPathForContentPath(
  contentPath: string,
  pages: readonly MyDreamShootsVideoWatchPage[] = []
): string | undefined {
  const normalized = normalizeVideoContentPath(contentPath);
  const existing = pages.find((page) => page.contentPath === normalized)?.watchPath;
  if (existing) return existing;
  if (!normalized) return undefined;
  const usedSlugs = new Set(LEGACY_VIDEO_SLUG_ALIASES.values());
  return `/watch/${stableSlug(normalized, usedSlugs)}`;
}

export function mydreamshootsVideoWatchUrl(page: MyDreamShootsVideoWatchPage): string {
  return page.canonicalUrl || `${page.origin}${page.watchPath}`;
}

export function mydreamshootsVideoAssetUrl(path: string): string {
  return `${MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function storefrontVideoAssetUrl(video: Pick<MyDreamShootsVideoWatchPage, "origin">, path: string): string {
  return `${video.origin}${path.startsWith("/") ? path : `/${path}`}`;
}

export function storefrontVideoBrand(video: Pick<MyDreamShootsVideoWatchPage, "brand">): string {
  return video.brand;
}

export function isMydreamshootsVideoHost(host: string | null | undefined): boolean {
  const normalized = String(host ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  return normalized === "www.mydreamshoots.com"
    || normalized === "mydreamshoots.com"
    || normalized === "www.mydreamshoots.localhost"
    || normalized === "mydreamshoots.localhost";
}

export function isStorefrontVideoHost(host: string | null | undefined): boolean {
  const normalized = String(host ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  return [
    "www.mydreamshoots.com",
    "mydreamshoots.com",
    "www.mydreamshoots.localhost",
    "mydreamshoots.localhost",
    "aidreamshoots.eu",
    "www.aidreamshoots.eu",
    "aidreamshoots.localhost",
    "www.aidreamshoots.localhost",
    "aidreamcapes.eu",
    "www.aidreamcapes.eu",
    "aidreamcapes.localhost",
    "www.aidreamcapes.localhost"
  ].includes(normalized);
}
