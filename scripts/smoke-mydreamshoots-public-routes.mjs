#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const DEFAULT_VIDEO_SLUGS = [
  "image-to-video",
  "profile-clip",
  "fan-poster-motion",
  "creator-intro-video",
  "product-teaser-clip",
  "animated-avatar",
  "fashion-reel",
  "album-story-video"
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
  if (!value) throw new Error("Missing --base-url");
  return String(value).replace(/\/+$/, "");
}

function readTaxonomySlugs() {
  const taxonomyPath = path.join(process.cwd(), "src", "lib", "mydreamshoots-theme-taxonomy.json");
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, "utf8"));
  return Array.from(new Set((taxonomy.items ?? []).map((item) => item.slug).filter(Boolean))).sort();
}

function urlFor(baseUrl, route) {
  return `${baseUrl}${route.startsWith("/") ? route : `/${route}`}`;
}

async function fetchRoute(baseUrl, route, options = {}) {
  const url = urlFor(baseUrl, route);
  const response = await fetch(url, {
    method: "GET",
    redirect: options.redirect ?? "follow",
    headers: {
      "user-agent": "codex-route-smoke/1.0",
      accept: options.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
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

function hasOldCollectionLink(text) {
  return /(?:href|content|url|@id|loc)=["'][^"']*\/collections(?:\/|[?#"']|$)/i.test(text)
    || /https?:\/\/(?:www\.)?mydreamshoots\.com\/collections(?:\/|[?#<\s]|$)/i.test(text)
    || /<loc>[^<]*\/collections(?:\/|[?#<]|$)/i.test(text);
}

function hasOldVideoToolLink(text) {
  return /(?:href|content|url|@id|loc)=["'][^"']*\/tools\/(?:image-to-video|profile-clip|fan-poster-motion|creator-intro-video|product-teaser-clip|animated-avatar|fashion-reel|album-story-video)(?:[?#"']|$)/i.test(text)
    || /https?:\/\/(?:www\.)?mydreamshoots\.com\/tools\/(?:image-to-video|profile-clip|fan-poster-motion|creator-intro-video|product-teaser-clip|animated-avatar|fashion-reel|album-story-video)(?:[?#<\s]|$)/i.test(text)
    || /<loc>[^<]*\/tools\/(?:image-to-video|profile-clip|fan-poster-motion|creator-intro-video|product-teaser-clip|animated-avatar|fashion-reel|album-story-video)(?:[?#<]|$)/i.test(text);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args["base-url"]);
  const imageSlugs = readTaxonomySlugs();
  const canonicalImageRoutes = ["/ai-image-generation", ...imageSlugs.map((slug) => `/ai-image-generation/${slug}`)];
  const legacyImageRoutes = ["/collections", ...imageSlugs.map((slug) => `/collections/${slug}`)];
  const videoRoutes = ["/ai-video-generation", ...DEFAULT_VIDEO_SLUGS.map((slug) => `/ai-video-generation/${slug}`)];
  const legacyVideoRoutes = ["/tools", ...DEFAULT_VIDEO_SLUGS.map((slug) => `/tools/${slug}`)];
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

  for (const route of legacyVideoRoutes) {
    const first = await fetchRoute(baseUrl, route, { redirect: "manual", readBody: false });
    if (![301, 302, 307, 308].includes(first.status)) {
      failures.push({ kind: "legacy_video_redirect_status", route, expected: "301/302/307/308", actual: first.status });
      continue;
    }
    if (!String(first.location ?? "").includes("/ai-video-generation")) {
      failures.push({ kind: "legacy_video_redirect_location", route, location: first.location });
      continue;
    }
    const final = await fetchRoute(baseUrl, route, { readBody: false });
    if (final.status !== 200) {
      failures.push({ kind: "legacy_video_final_status", route, expected: 200, actual: final.status, finalUrl: final.finalUrl });
    }
  }

  for (const route of htmlScanRoutes) {
    const result = await fetchRoute(baseUrl, route);
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
      legacyVideoRoutes: legacyVideoRoutes.length,
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
