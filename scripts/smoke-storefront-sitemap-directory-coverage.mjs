import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const repoRoot = process.cwd();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const statePath = path.join(repoRoot, "data", "platform-state.json");
const seoContentPath = path.join(repoRoot, "src", "lib", "dreamshoot-seo-content.ts");
const mydreamshootsTaxonomyPath = path.join(repoRoot, "src", "lib", "mydreamshoots-theme-taxonomy.json");
const sitemapRequestTimeoutMs = Number(process.env.SITEMAP_SMOKE_SITEMAP_TIMEOUT_MS ?? 120_000);

const siteChecks = [
  {
    siteId: "site_dreamshoot",
    slug: "mydreamshoots",
    host: "www.mydreamshoots.com",
    requiredPaths: [
      "/",
      "/workflow",
      "/best-packages",
      "/best-ai-image",
      "/best-ai-video",
      "/ai-image-generation",
      "/ai-image-generation/headshot",
      "/ai-image-generation/avatar",
      "/ai-image-generation/background-changer",
      "/ai-image-generation/motion-generator",
      "/ai-image-generation/soccer",
      "/ai-video-generation",
      "/ai-video-generation/talking-photo",
      "/ai-video-generation/cinematic-video",
      "/ai-video-generation/tiktok-video",
      "/ai-video-generation/instagram-reels",
      "/ai-video-generation/social-media-video",
      "/ai-video-generation/youtube-video",
      "/ai-video-generation/story-video",
      "/ai-video-generation/meme-video",
      "/ai-video-generation/product-video",
      "/blog",
      "/privacy",
      "/terms",
      "/cookies",
      "/refunds",
      "/content",
      "/shipping",
      "/children-privacy",
      "/state-privacy"
    ],
    oldPaths: [
      "/collections/wedding-portraits",
      "/collections/profile-cards",
      "/collections/headshots",
      "/collections/professional-headshots",
      "/collections/ai-video-add-ons",
      "/collections/world-cup-fan-photos",
      "/ai-photoshoot",
      "/ai-photoshoot/professional/headshot",
      "/ai-image-generation/professional",
      "/ai-image-generation/professional/headshot",
      "/ai-video-generation/text-to-video",
      "/ai-video-generation/image-to-video",
      "/tools",
      "/tools/image-to-video",
      "/tools/headshot-generator",
      "/tools/wedding-portraits"
    ]
  },
  {
    siteId: "site_aidreamcapes",
    slug: "aidreamcapes",
    host: "www.aidreamcapes.com",
    requiredPaths: [
      "/",
      "/workflow",
      "/best-packages",
      "/best-ai-image",
      "/best-ai-video",
      "/collections",
      "/collections/fan-scene-albums",
      "/collections/game-day-group-photos",
      "/collections/premiere-style-portraits",
      "/collections/christmas-group-albums",
      "/collections/thanksgiving-memory-sets",
      "/collections/halloween-party-portraits",
      "/collections/seasonal-celebration-photos",
      "/tools",
      "/tools/fan-scene-album-builder",
      "/tools/game-day-group-portrait-maker",
      "/tools/premiere-portrait-set-builder",
      "/tools/christmas-group-album-studio",
      "/tools/thanksgiving-keepsake-set-maker",
      "/tools/halloween-party-portrait-maker",
      "/tools/new-year-countdown-album-maker",
      "/tools/permission-safe-photo-planner",
      "/blog",
      "/privacy",
      "/terms",
      "/cookies",
      "/refunds",
      "/content",
      "/shipping",
      "/children-privacy",
      "/state-privacy"
    ],
    oldPaths: [
      "/tools/route-portrait-engine",
      "/tools/desert-road-portraits",
      "/tools/golden-hour-route-story",
      "/tools/lagoon-portrait-mixer",
      "/tools/lake-house-weekend",
      "/tools/market-morning-portraits",
      "/tools/private-album-curator",
      "/tools/private-villa-portraits",
      "/tools/rail-journey-frames",
      "/tools/rainy-city-album",
      "/tools/rooftop-skyline-set",
      "/tools/seasonal-celebration-album-maker",
      "/tools/shared-route-album",
      "/tools/snow-lodge-portraits",
      "/tools/solo-traveler-profile-set",
      "/tools/wellness-retreat-scenes",
      "/blog/adventure-tools-guide",
      "/blog/route-portrait-engine-tool-guide",
      "/blog/alpine-trail-frames-photo-package-guide",
      "/blog/cafe-street-stories-photo-package-guide"
    ]
  }
];

const BLOCKED_PAGE_TYPES = new Set(["account", "album", "cart", "job_detail", "job_progress", "login", "search", "workspace", "404"]);
const BLOCKED_PATH_PREFIXES = ["/404", "/account", "/admin", "/album", "/api", "/app", "/cart", "/dashboard", "/job", "/login", "/platform", "/search", "/site"];
const NON_PAGE_PATH_PREFIXES = ["/_next", "/assets", "/fonts", "/images", "/media", "/robots.txt", "/sitemap.xml", "/videos"];
const LEGACY_OR_DUPLICATE_PATHS = new Set(["/cookie-policy", "/privacy-policy", "/terms-of-service", "/shipping-policy", "/delivery-policy"]);
const NON_INDEXABLE_TOOL_PATHS = new Set(["/tools/image-studio", "/tools/ai-image-studio", "/tools/image-generator", "/tools/image_generator", "/tools/travel-portraits"]);
const REQUIRED_INDEXABLE_POLICY_PATHS = ["/privacy", "/terms", "/cookies", "/refunds", "/content", "/shipping", "/children-privacy", "/state-privacy"];
const REQUIRED_INDEXABLE_CONTENT_PATHS = ["/about-us", "/contact-us"];
const DIRECTORY_KEY_RE = /(?:^|\n)\s*(?:"([^"]+)"|'([^']+)'|([a-z][a-z0-9-]*))\s*:\s*\{/gi;
const DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS = [
  "/ai-video-generation/talking-photo",
  "/ai-video-generation/cinematic-video",
  "/ai-video-generation/tiktok-video",
  "/ai-video-generation/instagram-reels",
  "/ai-video-generation/social-media-video",
  "/ai-video-generation/youtube-video",
  "/ai-video-generation/story-video",
  "/ai-video-generation/meme-video",
  "/ai-video-generation/product-video"
];
const DREAMSHOOT_VIDEO_GENERATION_SLUGS = new Set(DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS.map((pathName) => pathName.split("/").pop()));

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

function extractObjectBody(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) fail("SEO directory source marker missing", { marker });
  const open = source.indexOf("{", start);
  if (open < 0) fail("SEO directory object opening brace missing", { marker });
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  fail("SEO directory object closing brace missing", { marker });
}

function extractDirectorySlugs(source, marker) {
  const body = extractObjectBody(source, marker);
  return new Set(Array.from(body.matchAll(DIRECTORY_KEY_RE)).map((match) => match[1] ?? match[2] ?? match[3]).filter(Boolean));
}

function extractGeneratedDirectoryDefSlugs(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) fail("SEO generated directory source marker missing", { marker });
  const end = source.indexOf("] as const", start);
  if (end < 0) fail("SEO generated directory source closing marker missing", { marker });
  return new Set(Array.from(source.slice(start, end).matchAll(/\[\s*"([^"]+)"/g)).map((match) => match[1]).filter(Boolean));
}

function mergeSets(...sets) {
  return new Set(sets.flatMap((set) => Array.from(set)));
}

const seoDirectorySource = fs.readFileSync(seoContentPath, "utf8");
const mydreamshootsTaxonomy = JSON.parse(fs.readFileSync(mydreamshootsTaxonomyPath, "utf8"));
const mydreamshootsCollectionSlugs = new Set([
  ...(mydreamshootsTaxonomy.roots || []).map((root) => root.slug),
  ...(mydreamshootsTaxonomy.items || []).map((item) => item.slug)
]);
const mydreamshootsCollectionPaths = new Map([
  ["", "/ai-image-generation"],
  ...(mydreamshootsTaxonomy.roots || []).map((root) => [root.slug, "/ai-image-generation"]),
  ...(mydreamshootsTaxonomy.items || []).map((item) => [item.slug, `/ai-image-generation/${item.slug}`])
]);
const mydreamshootsCollectionPathSet = new Set(mydreamshootsCollectionPaths.values());
const explicitDirectorySlugs = {
  site_dreamshoot: {
    collections: mydreamshootsCollectionSlugs,
    tools: extractDirectorySlugs(seoDirectorySource, "const toolDirectory")
  },
  site_aidreamcapes: {
    collections: mergeSets(
      extractDirectorySlugs(seoDirectorySource, "const aidreamcapesCollectionDirectory"),
      extractGeneratedDirectoryDefSlugs(seoDirectorySource, "const aidreamcapesGeneratedCollectionDefs")
    ),
    tools: mergeSets(
      extractDirectorySlugs(seoDirectorySource, "const aidreamcapesToolDirectory"),
      extractGeneratedDirectoryDefSlugs(seoDirectorySource, "const aidreamcapesGeneratedToolDefs")
    )
  }
};

const DREAMSHOOT_COLLECTION_ALIASES = new Map([]);
const AIDREAMCAPES_COLLECTION_ALIASES = new Map([
  ["adventure", "game-day-group-photos"],
  ["city", "premiere-style-portraits"],
  ["coastal", "christmas-group-albums"],
  ["destination", "fan-scene-albums"],
  ["postcard", "seasonal-celebration-photos"],
  ["cafe-street-stories", "premiere-style-portraits"],
  ["professional-headshots", "premiere-style-portraits"],
  ["road-trip-frames", "game-day-group-photos"],
  ["route-portrait-albums", "fan-scene-albums"],
  ["destination-portrait-albums", "fan-scene-albums"],
  ["coastal-light-sets", "christmas-group-albums"],
  ["coastal-getaways", "christmas-group-albums"],
  ["old-quarter-walks", "premiere-style-portraits"],
  ["old-city-walks", "premiere-style-portraits"],
  ["island-resort-scenes", "seasonal-celebration-photos"],
  ["scenic-overlooks", "game-day-group-photos"],
  ["alpine-trail-frames", "seasonal-celebration-photos"],
  ["mountain-trails", "game-day-group-photos"],
  ["cinematic-travel", "game-day-group-photos"],
  ["itinerary-moodboards", "seasonal-celebration-photos"],
  ["route-moodboards", "seasonal-celebration-photos"],
  ["postcard-social-sets", "seasonal-celebration-photos"],
  ["postcard-story-sets", "seasonal-celebration-photos"],
  ["travel-profile-stories", "fan-scene-albums"],
  ["solo-traveler-profiles", "fan-scene-albums"],
  ["family-travel-keepsakes", "thanksgiving-memory-sets"],
  ["travel-journal-covers", "seasonal-celebration-photos"]
]);
const DREAMSHOOT_TOOL_ALIASES = new Map([
  ["/tools/headshot-generator", "/tools/headshot"],
  ["/tools/ai-image-studio", "/tools"],
  ["/tools/image-studio", "/tools"],
  ["/tools/travel-portraits", "/tools/nature-adventure"]
]);
const AIDREAMCAPES_TOOL_ALIASES = new Map([
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

function fail(message, details = {}) {
  console.error(`Storefront sitemap directory coverage smoke failed: ${message}`);
  if (Object.keys(details).length) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function normalizePath(value) {
  const raw = String(value || "").trim();
  if (!raw || raw === "/") return "/";
  return `/${raw.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function slugifySegment(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pathFromSlug(prefix, slug) {
  const normalized = slugifySegment(String(slug || "").replace(/^\/?(collections|tools)\//, ""));
  return normalized ? `${prefix}/${normalized}` : "";
}

function isAidreamcapesSite(siteCheck) {
  return siteCheck.siteId === "site_aidreamcapes";
}

function canonicalCollectionPath(siteCheck, pathName) {
  const normalized = normalizePath(pathName);
  if (siteCheck.siteId === "site_dreamshoot") {
    if (normalized === "/collections" || normalized === "/ai-image-generation") return "/ai-image-generation";
    const raw = normalized.replace(/^\/(?:collections|ai-image-generation)(?:\/|$)/, "");
    const slug = slugifySegment(raw.split("/").filter(Boolean).at(-1) || raw);
    return mydreamshootsCollectionPaths.get(slug) ?? `/ai-image-generation/${slug}`;
  }
  if (normalized === "/collections") return "/collections";
  const slug = slugifySegment(normalized.replace(/^\/collections\//, ""));
  if (!slug) return "/collections";
  const aliases = isAidreamcapesSite(siteCheck) ? AIDREAMCAPES_COLLECTION_ALIASES : DREAMSHOOT_COLLECTION_ALIASES;
  return `/collections/${aliases.get(slug) ?? slug}`;
}

function canonicalToolPath(siteCheck, pathName) {
  const normalized = normalizePath(pathName);
  if (siteCheck.siteId === "site_dreamshoot") {
    if (normalized === "/tools" || normalized === "/ai-video-generation") return "/ai-video-generation";
    const rawSlug = normalized.replace(/^\/(?:tools|ai-video-generation)\//, "");
    const slug = slugifySegment(rawSlug);
    return DREAMSHOOT_VIDEO_GENERATION_SLUGS.has(slug) ? `/ai-video-generation/${slug}` : normalized;
  }
  const toolPath = normalized === "/tools" || normalized.startsWith("/tools/") ? normalized : pathFromSlug("/tools", normalized);
  const aliases = isAidreamcapesSite(siteCheck) ? AIDREAMCAPES_TOOL_ALIASES : DREAMSHOOT_TOOL_ALIASES;
  return aliases.get(toolPath) ?? toolPath;
}

function canonicalPublicPath(pathName) {
  const normalized = normalizePath(pathName);
  return CANONICAL_PUBLIC_PATHS.get(normalized) ?? normalized;
}

function canonicalDirectoryPath(siteCheck, pathName) {
  const normalized = canonicalPublicPath(pathName);
  if (normalized === "/collections" || normalized.startsWith("/collections/") || normalized === "/ai-image-generation" || normalized.startsWith("/ai-image-generation/")) {
    return canonicalCollectionPath(siteCheck, normalized);
  }
  if (normalized === "/tools" || normalized.startsWith("/tools/") || normalized === "/ai-video-generation" || normalized.startsWith("/ai-video-generation/")) return canonicalToolPath(siteCheck, normalized);
  return normalized;
}

function isBlockedPublicPath(pathName) {
  if (LEGACY_OR_DUPLICATE_PATHS.has(pathName)) return true;
  if (NON_INDEXABLE_TOOL_PATHS.has(pathName)) return true;
  if (/\.[a-z0-9]{2,5}$/i.test(pathName) && !pathName.endsWith(".html")) return true;
  if (BLOCKED_PATH_PREFIXES.some((prefix) => pathName === prefix || pathName.startsWith(`${prefix}/`))) return true;
  return NON_PAGE_PATH_PREFIXES.some((prefix) => pathName === prefix || pathName.startsWith(`${prefix}/`));
}

function isIndexablePage(siteCheck, page) {
  const pathName = canonicalDirectoryPath(siteCheck, page.slug);
  if (LEGACY_OR_DUPLICATE_PATHS.has(pathName)) return false;
  if (BLOCKED_PAGE_TYPES.has(page.pageType)) return false;
  return !isBlockedPublicPath(pathName);
}

function isIndexableDirectoryPath(siteCheck, pathName) {
  const normalized = canonicalDirectoryPath(siteCheck, pathName);
  if (isBlockedPublicPath(normalized)) return false;
  const siteExplicitSlugs = explicitDirectorySlugs[siteCheck.siteId];
  if (siteCheck.siteId === "site_dreamshoot" && (normalized === "/ai-image-generation" || normalized.startsWith("/ai-image-generation/"))) {
    return mydreamshootsCollectionPathSet.has(normalized);
  }
  if (siteCheck.siteId === "site_dreamshoot" && (normalized === "/tools" || normalized.startsWith("/tools/"))) return false;
  if (siteCheck.siteId === "site_dreamshoot" && (normalized === "/ai-video-generation" || normalized.startsWith("/ai-video-generation/"))) {
    const slug = slugifySegment(normalized.replace(/^\/ai-video-generation\//, ""));
    return normalized === "/ai-video-generation" || DREAMSHOOT_VIDEO_GENERATION_SLUGS.has(slug);
  }
  if (normalized.startsWith("/collections/")) {
    const slug = slugifySegment(normalized.replace(/^\/collections\//, ""));
    return Boolean(siteExplicitSlugs?.collections.has(slug));
  }
  if (normalized.startsWith("/tools/")) {
    const slug = slugifySegment(normalized.replace(/^\/tools\//, ""));
    return Boolean(siteExplicitSlugs?.tools.has(slug)) || siteCheck.siteId === "site_dreamshoot" && DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS.includes(normalized);
  }
  return true;
}

function addPath(paths, pathName, bucket) {
  const normalized = normalizePath(pathName);
  if (!normalized || isBlockedPublicPath(normalized)) return;
  const current = paths.get(bucket) ?? new Set();
  current.add(normalized);
  paths.set(bucket, current);
}

function expectedDirectoryPaths(state, siteCheck) {
  const site = state.sites?.find((item) => item.id === siteCheck.siteId);
  if (!site) fail("site missing from platform state", { siteCheck });
  const byCategoryId = new Map((state.creativePackCategories || []).filter((category) => category.siteId === siteCheck.siteId).map((category) => [category.id, category]));
  const buckets = new Map();

  for (const pathName of siteCheck.requiredPaths) addPath(buckets, pathName, "required");
  for (const pathName of REQUIRED_INDEXABLE_POLICY_PATHS) addPath(buckets, pathName, "policies");
  for (const pathName of REQUIRED_INDEXABLE_CONTENT_PATHS) addPath(buckets, pathName, "public");

  for (const page of site.pages || []) {
    if (!isIndexablePage(siteCheck, page)) continue;
    const pathName = canonicalDirectoryPath(siteCheck, page.slug);
    const bucket = pathName.startsWith("/blog")
      ? "blog"
      : pathName.startsWith("/collections") || pathName.startsWith("/ai-image-generation")
        ? "collections"
        : pathName.startsWith("/tools")
          ? "tools"
          : "public";
    addPath(buckets, pathName, bucket);
  }

  addPath(buckets, siteCheck.siteId === "site_dreamshoot" ? "/ai-image-generation" : "/collections", "collections");
  for (const category of state.creativePackCategories || []) {
    if (category.siteId !== siteCheck.siteId || category.status !== "active") continue;
    const pathName = canonicalCollectionPath(siteCheck, category.slug || category.label);
    if (isIndexableDirectoryPath(siteCheck, pathName)) addPath(buckets, pathName, "collections");
  }
  for (const pack of state.creativePacks || []) {
    if (pack.siteId !== siteCheck.siteId || pack.status !== "active") continue;
    const category = pack.categoryId ? byCategoryId.get(pack.categoryId) : undefined;
    for (const value of [category?.parent?.slug, category?.slug, pack.category, pack.name]) {
      if (!value) continue;
      const pathName = canonicalCollectionPath(siteCheck, pathFromSlug("/collections", value));
      if (isIndexableDirectoryPath(siteCheck, pathName)) addPath(buckets, pathName, "collections");
    }
  }

  if (siteCheck.siteId === "site_dreamshoot") {
    addPath(buckets, "/ai-video-generation", "tools");
    for (const pathName of DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS) {
      const canonicalPath = canonicalToolPath(siteCheck, pathName);
      if (isIndexableDirectoryPath(siteCheck, canonicalPath)) addPath(buckets, canonicalPath, "tools");
    }
  } else {
    addPath(buckets, "/tools", "tools");
  }
  for (const item of state.toolMenuItems || []) {
    if (item.siteId !== siteCheck.siteId || item.status !== "active") continue;
    const pathName = canonicalToolPath(siteCheck, item.href || pathFromSlug("/tools", item.slug));
    if (isIndexableDirectoryPath(siteCheck, pathName)) addPath(buckets, pathName, "tools");
  }

  return buckets;
}

function flattenBuckets(buckets) {
  return new Set(Array.from(buckets.values()).flatMap((bucket) => Array.from(bucket)));
}

function requestText(host, pathname, timeoutMs = sitemapRequestTimeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, baseUrl);
    const client = url.protocol === "https:" ? https : http;
    const request = client.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: { Host: host }
      },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          resolve({ status: response.statusCode ?? 0, body, headers: response.headers });
        });
      }
    );
    request.on("error", reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`request_timeout_${timeoutMs}ms:${host}${pathname}`));
    });
    request.end();
  });
}

function sitemapPathsFromXml(xml, host) {
  const paths = new Set();
  const foreignHosts = [];
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const value = match[1];
    try {
      const url = new URL(value);
      if (url.host !== host) foreignHosts.push(value);
      paths.add(normalizePath(url.pathname));
    } catch {
      foreignHosts.push(value);
    }
  }
  return { paths, foreignHosts };
}

function summarizeBuckets(expectedBuckets, sitemapPaths) {
  return Object.fromEntries(
    Array.from(expectedBuckets.entries()).map(([bucket, paths]) => {
      const expected = Array.from(paths).sort();
      const missing = expected.filter((pathName) => !sitemapPaths.has(pathName));
      return [bucket, { expected: expected.length, missing: missing.length, missingExamples: missing.slice(0, 20) }];
    })
  );
}

function nonIndexableDirectoryPathsFromSitemap(siteCheck, sitemapPaths) {
  return Array.from(sitemapPaths)
    .filter((pathName) => (pathName.startsWith("/collections/") || pathName.startsWith("/ai-image-generation/") || pathName.startsWith("/tools/") || pathName.startsWith("/ai-video-generation/")) && !isIndexableDirectoryPath(siteCheck, pathName))
    .sort();
}

async function main() {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const results = [];
  const failures = [];

  for (const siteCheck of siteChecks) {
    const expectedBuckets = expectedDirectoryPaths(state, siteCheck);
    const expectedPaths = flattenBuckets(expectedBuckets);
    const response = await requestText(siteCheck.host, "/sitemap.xml");
    if (response.status >= 400) {
      failures.push({ site: siteCheck.slug, host: siteCheck.host, status: response.status });
      continue;
    }
    const { paths: sitemapPaths, foreignHosts } = sitemapPathsFromXml(response.body, siteCheck.host);
    const missing = Array.from(expectedPaths).filter((pathName) => !sitemapPaths.has(pathName)).sort();
    const oldInSitemap = siteCheck.oldPaths.filter((pathName) => sitemapPaths.has(pathName));
    const noindexInSitemap = nonIndexableDirectoryPathsFromSitemap(siteCheck, sitemapPaths);
    const result = {
      site: siteCheck.slug,
      host: siteCheck.host,
      sitemapCount: sitemapPaths.size,
      expectedDirectoryCount: expectedPaths.size,
      buckets: summarizeBuckets(expectedBuckets, sitemapPaths),
      missing: missing.slice(0, 40),
      oldInSitemap,
      noindexInSitemap: noindexInSitemap.slice(0, 40),
      foreignHosts: foreignHosts.slice(0, 20)
    };
    results.push(result);
    if (missing.length || oldInSitemap.length || noindexInSitemap.length || foreignHosts.length) {
      failures.push(result);
      console.log(`✗ ${siteCheck.slug}: sitemap ${sitemapPaths.size}, expected ${expectedPaths.size}, missing ${missing.length}, old ${oldInSitemap.length}, noindex ${noindexInSitemap.length}`);
    } else {
      console.log(`✓ ${siteCheck.slug}: sitemap ${sitemapPaths.size}, expected ${expectedPaths.size}, all indexable directory buckets covered`);
    }
  }

  if (failures.length) fail("sitemap directory coverage mismatch", { failures });
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
