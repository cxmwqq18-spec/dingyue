import type { PlatformState, PublishedHomepageShowcaseItem, Site } from "@/lib/types";

export const MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN = "https://www.mydreamshoots.com";

export type MyDreamShootsVideoWatchPage = {
  slug: string;
  watchPath: string;
  sourcePath: string;
  sourcePaths: readonly string[];
  name: string;
  description: string;
  thumbnailPath: string;
  contentPath: string;
  uploadDate: string;
  durationSeconds: number;
};

const VIDEO_PATH_PATTERN = /\.(?:mp4|webm)(?:[?#]|$)/i;
const IMAGE_PATH_PATTERN = /\.(?:avif|jpe?g|png|webp)(?:[?#]|$)/i;

// These aliases preserve the three URLs that were previously published while
// allowing their metadata to come from the current published runtime data.
const LEGACY_VIDEO_SLUG_ALIASES = new Map([
  ["/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-20260814.mp4", "ai-video-creation-tutorial"],
  ["/assets/dreamshoot/seasonal/christmas/christmas-hero-family-gift.mp4", "christmas-family-gift"],
  ["/assets/dreamshoot/save-the-date/valentines-day/valentines-day-save-the-date.mp4", "valentines-day-save-the-date"]
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
};

function normalizePath(value: string): string {
  const clean = value.trim().split("?")[0]?.split("#")[0] ?? "";
  if (!clean) return "";
  return clean === "/" ? "/" : `/${clean.replace(/^\/+|\/+$/g, "")}`;
}

function normalizeAssetPath(value: unknown, pattern: RegExp): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const raw = value.trim();
  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.hostname && !/(?:^|\.)mydreamshoots\.com$/i.test(url.hostname)) return "";
      path = url.pathname;
    } catch {
      return "";
    }
  }
  const normalized = normalizePath(path);
  return pattern.test(normalized) ? normalized : "";
}

export function isMydreamshootsVideoContentPath(value: unknown): value is string {
  const path = normalizeAssetPath(value, VIDEO_PATH_PATTERN);
  return path.startsWith("/assets/dreamshoot/");
}

function normalizeVideoContentPath(value: unknown): string {
  const path = normalizeAssetPath(value, VIDEO_PATH_PATTERN);
  return path.startsWith("/assets/dreamshoot/") ? path : "";
}

function normalizeThumbnailPath(value: unknown): string {
  const path = normalizeAssetPath(value, IMAGE_PATH_PATTERN);
  return path.startsWith("/assets/dreamshoot/") ? path : "";
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function firstText(values: unknown[]): string {
  return values.map(textValue).find(Boolean) ?? "";
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
  const filename = contentPath.split("/").pop()?.replace(/\.(?:mp4|webm)$/i, "") ?? "AI video";
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

function stableSlug(contentPath: string, usedSlugs: Set<string>): string {
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

function metadataFromObject(value: Record<string, unknown>, fallback: VideoCandidate): Omit<VideoCandidate, "contentPath" | "sourcePath"> {
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
  ].map(normalizeThumbnailPath));
  const durationSeconds = parseDuration(firstText([
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
    durationSeconds: durationSeconds ?? fallback.durationSeconds
  };
}

function collectVideoCandidates(value: unknown, fallback: VideoCandidate, onCandidate: (candidate: VideoCandidate) => void): void {
  if (Array.isArray(value)) {
    value.forEach((item) => collectVideoCandidates(item, fallback, onCandidate));
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  const metadata = metadataFromObject(object, fallback);
  for (const [key, child] of Object.entries(object)) {
    const contentPath = normalizeVideoContentPath(child);
    if (contentPath) {
      onCandidate({ contentPath, sourcePath: fallback.sourcePath, ...metadata });
      continue;
    }
    if (typeof child === "object" && child !== null) {
      collectVideoCandidates(child, { ...fallback, ...metadata }, onCandidate);
    }
    // Keeping this variable makes it explicit that only media-bearing values
    // are treated as video sources; arbitrary URLs in copy are ignored.
    void key;
  }
}

function addCandidate(records: Map<string, MyDreamShootsVideoWatchPage>, candidate: VideoCandidate, usedSlugs: Set<string>): void {
  const contentPath = normalizeVideoContentPath(candidate.contentPath);
  if (!contentPath) return;
  const sourcePath = sourcePathForPage(candidate.sourcePath);
  const existing = records.get(contentPath);
  if (existing) {
    const sourcePaths = Array.from(new Set([...existing.sourcePaths, sourcePath])).sort();
    records.set(contentPath, {
      ...existing,
      sourcePath: existing.sourcePath || sourcePath,
      sourcePaths,
      name: existing.name || candidate.name || humanizeFilename(contentPath),
      description: existing.description || candidate.description || `Watch ${humanizeFilename(contentPath)} on myDreamshoots.`,
      thumbnailPath: existing.thumbnailPath || candidate.thumbnailPath || "",
      uploadDate: existing.uploadDate || normalizeUploadDate(candidate.uploadDate),
      durationSeconds: existing.durationSeconds || candidate.durationSeconds || 15
    });
    return;
  }
  const thumbnailPath = candidate.thumbnailPath || "";
  const uploadDate = normalizeUploadDate(candidate.uploadDate);
  if (!thumbnailPath || !uploadDate) return;
  const slug = stableSlug(contentPath, usedSlugs);
  usedSlugs.add(slug);
  records.set(contentPath, {
    slug,
    watchPath: `/watch/${slug}`,
    sourcePath,
    sourcePaths: [sourcePath],
    name: candidate.name || humanizeFilename(contentPath),
    description: candidate.description || `Watch ${humanizeFilename(contentPath)} on myDreamshoots.`,
    thumbnailPath,
    contentPath,
    uploadDate,
    durationSeconds: Math.max(1, Math.floor(candidate.durationSeconds || 15))
  });
}

export function mydreamshootsVideoWatchPagesForState(
  state: Pick<PlatformState, "videoThemes">,
  site: Pick<Site, "id" | "primaryDomain" | "themeSettings" | "currentPublishedState">,
  options: {
    pages?: readonly VideoWatchSourcePage[];
    homepageShowcases?: readonly PublishedHomepageShowcaseItem[];
  } = {}
): readonly MyDreamShootsVideoWatchPage[] {
  const records = new Map<string, MyDreamShootsVideoWatchPage>();
  const usedSlugs = new Set(LEGACY_VIDEO_SLUG_ALIASES.values());
  const pages = options.pages ?? [];
  for (const page of pages) {
    const sourcePath = sourcePathForPage(page.slug);
    const fallback: VideoCandidate = {
      contentPath: "",
      sourcePath,
      name: page.title,
      description: page.description,
      uploadDate: page.updatedAt ?? page.createdAt ?? site.currentPublishedState?.publishedAt,
      durationSeconds: 15
    };
    collectVideoCandidates(page.publishedJson, fallback, (candidate) => addCandidate(records, candidate, usedSlugs));
  }
  collectVideoCandidates(site.themeSettings?.publishedJson, {
    contentPath: "",
    sourcePath: "/",
    name: "How myDreamshoots AI Video Creation Works",
    description: "See how myDreamshoots turns uploaded photos and ideas into AI videos and creative photo projects.",
    uploadDate: site.currentPublishedState?.publishedAt,
    durationSeconds: 15
  }, (candidate) => addCandidate(records, candidate, usedSlugs));

  for (const item of options.homepageShowcases ?? []) {
    const contentPath = normalizeVideoContentPath(item.videoUrl);
    if (!contentPath || item.status !== "published" || !item.indexable || !item.sitemapEligible) continue;
    const candidate: VideoCandidate = {
      contentPath,
      sourcePath: "/",
      name: item.title,
      description: item.subtitle,
      thumbnailPath: normalizeThumbnailPath(item.imageUrl),
      uploadDate: site.currentPublishedState?.publishedAt,
      durationSeconds: 15
    };
    addCandidate(records, candidate, usedSlugs);
    addCandidate(records, { ...candidate, sourcePath: item.canonicalPath }, usedSlugs);
  }

  for (const theme of state.videoThemes ?? []) {
    if (theme.siteId !== site.id || theme.status !== "active") continue;
    const contentPath = (theme.galleryImages ?? []).map(normalizeVideoContentPath).find(Boolean) ?? "";
    if (!contentPath) continue;
    addCandidate(records, {
      contentPath,
      sourcePath: `/ai-video-generation/${theme.slug}`,
      name: theme.name,
      description: theme.description || theme.headline,
      thumbnailPath: normalizeThumbnailPath(theme.imageUrl),
      uploadDate: theme.createdAt,
      durationSeconds: theme.durationSeconds
    }, usedSlugs);
    addCandidate(records, {
      contentPath,
      sourcePath: "/",
      name: theme.name,
      description: theme.description || theme.headline,
      thumbnailPath: normalizeThumbnailPath(theme.imageUrl),
      uploadDate: theme.createdAt,
      durationSeconds: theme.durationSeconds
    }, usedSlugs);
  }

  return [...records.values()].sort((left, right) => left.watchPath.localeCompare(right.watchPath));
}

export function mydreamshootsVideoWatchPageForSlug(
  slug: string,
  pages: readonly MyDreamShootsVideoWatchPage[] = []
): MyDreamShootsVideoWatchPage | undefined {
  return pages.find((page) => page.slug === slug);
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
  return `${MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN}${page.watchPath}`;
}

export function mydreamshootsVideoAssetUrl(path: string): string {
  return `${MYDREAMSHOOTS_VIDEO_WATCH_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function isMydreamshootsVideoHost(host: string | null | undefined): boolean {
  const normalized = String(host ?? "").split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";
  return normalized === "www.mydreamshoots.com"
    || normalized === "mydreamshoots.com"
    || normalized === "www.mydreamshoots.localhost"
    || normalized === "mydreamshoots.localhost";
}
