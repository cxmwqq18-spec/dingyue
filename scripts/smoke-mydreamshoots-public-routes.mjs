#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_VIDEO_SLUGS = [
  "talking-photo",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "ugc-ad-video"
];
const HIDDEN_VIDEO_SLUGS = [
  "text-to-video",
  "image-to-video"
];
const LEGACY_VIDEO_GONE_SLUGS = [
  ...HIDDEN_VIDEO_SLUGS,
  "talking-photo",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "ugc-ad-video"
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const raw = arg.slice(2);
    const equals = raw.indexOf("=");
    if (equals !== -1) {
      args[raw.slice(0, equals)] = raw.slice(equals + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[raw] = next;
      index += 1;
    } else {
      args[raw] = true;
    }
  }
  return args;
}

function normalizeBaseUrl(value) {
  return String(value || process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
}

function isLocalBaseUrl(baseUrl) {
  try {
    return ["localhost", "127.0.0.1", "::1"].includes(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

function routeUrl(baseUrl, route, options = {}) {
  const localSitePrefix = isLocalBaseUrl(baseUrl) && !options.publicHost ? "/site/mydreamshoots" : "";
  return `${baseUrl}${localSitePrefix}${route.startsWith("/") ? route : `/${route}`}`;
}

function readTaxonomySlugs() {
  const taxonomyPath = path.join(process.cwd(), "src", "lib", "mydreamshoots-theme-taxonomy.json");
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  return Array.from(new Set((taxonomy.items ?? []).map((item) => item.slug).filter(Boolean))).sort();
}

async function fetchRouteOnce(baseUrl, route, options = {}) {
  const url = routeUrl(baseUrl, route, options);
  const response = await fetch(url, {
    method: "GET",
    redirect: options.redirect ?? "follow",
    headers: {
      "user-agent": "codex-route-smoke/1.0",
      accept: options.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(options.publicHost ? { host: options.publicHost, "x-forwarded-host": options.publicHost } : {})
    }
  });
  const text = options.readBody === false ? "" : await response.text();
  return {
    route,
    url,
    status: response.status,
    location: response.headers.get("location"),
    finalUrl: response.url,
    text
  };
}

async function fetchRoute(baseUrl, route, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await fetchRouteOnce(baseUrl, route, options);
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
  throw lastError;
}

function hasOldCollectionLink(text) {
  return /(?:href|content|url|@id|loc)=["'](?:https?:\/\/(?:www\.)?mydreamshoots\.com)?\/collections(?:\/|[?#"']|$)/i.test(text)
    || /<loc>(?:https?:\/\/(?:www\.)?mydreamshoots\.com)?\/collections(?:\/|[?#<]|$)/i.test(text);
}

function hasOldVideoToolLink(text) {
  const slugs = [...DEFAULT_VIDEO_SLUGS, ...HIDDEN_VIDEO_SLUGS].join("|");
  const routePattern = new RegExp(`(?:href|content|url|@id|loc)=["'](?:https?:\\/\\/(?:www\\.)?mydreamshoots\\.com)?\\/tools\\/(?:${slugs})(?:[?#"']|$)`, "i");
  const locPattern = new RegExp(`<loc>(?:https?:\\/\\/(?:www\\.)?mydreamshoots\\.com)?\\/tools\\/(?:${slugs})(?:[?#<]|$)`, "i");
  return routePattern.test(text) || locPattern.test(text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args["base-url"]);
  const imageSlugs = readTaxonomySlugs();
  const canonicalImageRoutes = ["/ai-image-generation", ...imageSlugs.map((slug) => `/ai-image-generation/${slug}`)];
  const legacyImageRoutes = ["/collections", ...imageSlugs.map((slug) => `/collections/${slug}`)];
  const videoRoutes = ["/ai-video-generation", ...DEFAULT_VIDEO_SLUGS.map((slug) => `/ai-video-generation/${slug}`)];
  const hiddenVideoRoutes = HIDDEN_VIDEO_SLUGS.map((slug) => `/ai-video-generation/${slug}`);
  const legacyVideoGoneRoutes = ["/tools", ...LEGACY_VIDEO_GONE_SLUGS.map((slug) => `/tools/${slug}`)];
  const keyRoutes = ["/", "/login", "/pricing", "/workflow", "/faq", "/best-packages", "/best-ai-image", "/best-ai-video", "/blog"];
  const htmlScanRoutes = ["/", "/best-packages", "/best-ai-image", "/best-ai-video", "/blog", "/sitemap.xml"];
  const failures = [];

  for (const route of Array.from(new Set([...keyRoutes, ...canonicalImageRoutes, ...videoRoutes]))) {
    const result = await fetchRoute(baseUrl, route, { readBody: false });
    if (result.status !== 200) {
      failures.push({ kind: "canonical_status", route, expected: 200, actual: result.status, finalUrl: result.finalUrl });
    }
  }

  for (const route of legacyImageRoutes) {
    const first = await fetchRoute(baseUrl, route, { redirect: "manual", readBody: false });
    if (![301, 302, 307, 308].includes(first.status)) {
      failures.push({ kind: "legacy_redirect_status", route, expected: "301/302/307/308", actual: first.status });
      continue;
    }
    if (!String(first.location ?? "").includes("/ai-image-generation")) {
      failures.push({ kind: "legacy_redirect_location", route, location: first.location });
      continue;
    }
    const final = await fetchRoute(baseUrl, route, { readBody: false });
    if (final.status !== 200) {
      failures.push({ kind: "legacy_final_status", route, expected: 200, actual: final.status, finalUrl: final.finalUrl });
    }
  }

  for (const route of legacyVideoGoneRoutes) {
    const result = await fetchRoute(baseUrl, route, { redirect: "manual", readBody: false });
    if (result.status !== 404) {
      failures.push({ kind: "legacy_video_gone_status", route, expected: 404, actual: result.status, location: result.location });
    }
  }

  for (const route of hiddenVideoRoutes) {
    const result = await fetchRoute(baseUrl, route, { redirect: "manual", readBody: false });
    if (result.status !== 404) {
      failures.push({ kind: "hidden_video_public_status", route, expected: 404, actual: result.status, location: result.location });
    }
  }

  for (const route of htmlScanRoutes) {
    const result = await fetchRoute(baseUrl, route, route === "/sitemap.xml" ? { publicHost: "www.mydreamshoots.com" } : {});
    if (result.status !== 200) {
      failures.push({ kind: "html_scan_status", route, expected: 200, actual: result.status });
      continue;
    }
    if (hasOldCollectionLink(result.text)) {
      failures.push({ kind: "html_old_collections_link", route });
    }
    if (hasOldVideoToolLink(result.text)) {
      failures.push({ kind: "html_old_video_tool_link", route });
    }
    if (route === "/sitemap.xml" && !result.text.includes("/ai-image-generation")) {
      failures.push({ kind: "sitemap_missing_ai_image_generation", route });
    }
  }

  const summary = {
    ok: failures.length === 0,
    baseUrl,
    checked: {
      keyRoutes: keyRoutes.length,
      canonicalImageRoutes: canonicalImageRoutes.length,
      legacyImageRoutes: legacyImageRoutes.length,
      videoRoutes: videoRoutes.length,
      hiddenVideoRoutes: hiddenVideoRoutes.length,
      legacyVideoGoneRoutes: legacyVideoGoneRoutes.length,
      htmlScanRoutes: htmlScanRoutes.length
    },
    failures
  };
  console.log(JSON.stringify(summary, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
