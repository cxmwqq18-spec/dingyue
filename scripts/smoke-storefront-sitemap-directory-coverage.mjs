import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const repoRoot = process.cwd();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const statePath = path.join(repoRoot, "data", "platform-state.json");

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
      "/collections",
      "/collections/headshots",
      "/collections/thanksgiving-group-photos",
      "/collections/halloween-party-photos",
      "/tools",
      "/tools/headshot",
      "/tools/creator-portrait",
      "/tools/magic-upscaler",
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
      "/collections/premiere-style-portraits",
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

const DREAMSHOOT_COLLECTION_ALIASES = new Map([
  ["christmas", "christmas-photos"],
  ["deportes", "world-cup-fan-photos"],
  ["fan-photos", "world-cup-fan-photos"],
  ["halloween", "halloween-party-photos"],
  ["premiere-style-portraits", "gala-photos"],
  ["sports-stars", "world-cup-fan-photos"],
  ["sports", "world-cup-fan-photos"],
  ["thanksgiving", "thanksgiving-group-photos"],
  ["travel", "outdoor-creator-scenes"],
  ["viaje", "outdoor-creator-scenes"],
  ["travel-scene-pack", "outdoor-creator-scenes"],
  ["vip-looks", "gala-photos"],
  ["video", "ai-video-add-ons"],
  ["lifestyle", "outdoor-creator-scenes"],
  ["professional-headshots", "headshots"]
]);
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
  const slug = slugifySegment(String(pathName || "").replace(/^\/?collections\//, ""));
  if (!slug) return "/collections";
  const aliases = isAidreamcapesSite(siteCheck) ? AIDREAMCAPES_COLLECTION_ALIASES : DREAMSHOOT_COLLECTION_ALIASES;
  return `/collections/${aliases.get(slug) ?? slug}`;
}

function canonicalToolPath(siteCheck, pathName) {
  const normalized = normalizePath(pathName);
  const aliases = isAidreamcapesSite(siteCheck) ? AIDREAMCAPES_TOOL_ALIASES : DREAMSHOOT_TOOL_ALIASES;
  return aliases.get(normalized) ?? normalized;
}

function canonicalPublicPath(pathName) {
  const normalized = normalizePath(pathName);
  return CANONICAL_PUBLIC_PATHS.get(normalized) ?? normalized;
}

function canonicalDirectoryPath(siteCheck, pathName) {
  const normalized = canonicalPublicPath(pathName);
  if (normalized.startsWith("/collections/")) return canonicalCollectionPath(siteCheck, normalized);
  if (normalized.startsWith("/tools/")) return canonicalToolPath(siteCheck, normalized);
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
    const bucket = pathName.startsWith("/blog") ? "blog" : pathName.startsWith("/collections") ? "collections" : pathName.startsWith("/tools") ? "tools" : "public";
    addPath(buckets, pathName, bucket);
  }

  addPath(buckets, "/collections", "collections");
  for (const category of state.creativePackCategories || []) {
    if (category.siteId !== siteCheck.siteId || category.status !== "active") continue;
    addPath(buckets, canonicalCollectionPath(siteCheck, category.slug || category.label), "collections");
  }
  for (const pack of state.creativePacks || []) {
    if (pack.siteId !== siteCheck.siteId || pack.status !== "active") continue;
    const category = pack.categoryId ? byCategoryId.get(pack.categoryId) : undefined;
    for (const value of [category?.parent?.slug, category?.slug, pack.category, pack.name]) {
      if (value) addPath(buckets, canonicalCollectionPath(siteCheck, pathFromSlug("/collections", value)), "collections");
    }
  }

  addPath(buckets, "/tools", "tools");
  if (siteCheck.siteId === "site_dreamshoot") {
    for (const pathName of DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS) addPath(buckets, canonicalToolPath(siteCheck, pathName), "tools");
  }
  for (const item of state.toolMenuItems || []) {
    if (item.siteId !== siteCheck.siteId || item.status !== "active") continue;
    addPath(buckets, canonicalToolPath(siteCheck, item.href || pathFromSlug("/tools", item.slug)), "tools");
  }

  return buckets;
}

function flattenBuckets(buckets) {
  return new Set(Array.from(buckets.values()).flatMap((bucket) => Array.from(bucket)));
}

function requestText(host, pathname) {
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
    const result = {
      site: siteCheck.slug,
      host: siteCheck.host,
      sitemapCount: sitemapPaths.size,
      expectedDirectoryCount: expectedPaths.size,
      buckets: summarizeBuckets(expectedBuckets, sitemapPaths),
      missing: missing.slice(0, 40),
      oldInSitemap,
      foreignHosts: foreignHosts.slice(0, 20)
    };
    results.push(result);
    if (missing.length || oldInSitemap.length || foreignHosts.length) {
      failures.push(result);
      console.log(`✗ ${siteCheck.slug}: sitemap ${sitemapPaths.size}, expected ${expectedPaths.size}, missing ${missing.length}, old ${oldInSitemap.length}`);
    } else {
      console.log(`✓ ${siteCheck.slug}: sitemap ${sitemapPaths.size}, expected ${expectedPaths.size}, all directory buckets covered`);
    }
  }

  if (failures.length) fail("sitemap directory coverage mismatch", { failures });
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
