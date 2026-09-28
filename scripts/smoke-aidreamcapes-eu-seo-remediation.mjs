#!/usr/bin/env node

// HTTP/HTML SEO contract smoke for Aidreamcapes EU. This deliberately omits
// Lighthouse/PageSpeed and checks only crawlability, indexability, content,
// route hygiene, sitemap coverage and rendered image markup.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const smokeHost = process.env.SMOKE_HOST || "aidreamcapes.eu";
const productionOrigin = "https://aidreamcapes.eu";
const sitePrefix = /\/site\/aidreamcapes-eu$/i.test(baseUrl) ? "/site/aidreamcapes-eu" : "";
const reportRoot = path.resolve(".tmp", "aidreamcapes-eu-seo-remediation");
const RETIRED_PATHS = new Set([
  "/ai-save-the-date/easter",
  "/ai-save-the-date/wedding-anniversary",
  "/ai-image-generation/estilo-y-fantasia",
  "/ai-image-generation/urbano",
  "/collections/soccer",
  "/collections/christmas-photo",
  "/collections/thanksgiving-photo",
  "/tools/image-studio",
  "/tools/seasonal-celebration-album-maker"
]);
const PRIVATE_PATHS = new Set(["/account", "/album", "/app", "/cart", "/login", "/search"]);
const ALIAS_PATHS = new Set(["/collections", "/ai-video-generation/christmas", "/cookie-policy", "/privacy-policy", "/terms-of-service"]);
// These are taxonomy group facets emitted by the shared directory navigation,
// not page-backed EU documents. The fixed 117-page mapping intentionally does
// not index them; do not treat their links as missing sitemap coverage.
const NON_INDEXABLE_CATEGORY_GROUP_PATHS = new Set([
  "/ai-image-generation/best-themes-presets",
  "/ai-image-generation/lifestyle-creative",
  "/ai-image-generation/magic",
  "/ai-image-generation/motion-generator",
  "/ai-image-generation/photo-tools",
  "/ai-image-generation/professional",
  "/ai-image-generation/social-cards"
]);
const KNOWN_BROKEN_ASSETS = ["portrait-professionnel.webp", "virtuel-essai.webp", "noel-photo.webp"];
const SENTINEL_404_PATHS = ["/undefined", "/null", "/test", "/old"];
const REQUIRED_SHARED_PUBLIC_PATHS = [
  "/",
  "/about-us",
  "/contact-us",
  "/creators-circle",
  "/best-packages",
  "/best-ai-image",
  "/best-save-the-date",
  "/faq",
  "/pricing",
  "/workflow"
];

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function routeFromUrl(value) {
  try {
    const parsed = new URL(value, `${baseUrl}/`);
    let pathname = parsed.pathname;
    if (pathname === sitePrefix) pathname = "/";
    else if (pathname.startsWith(`${sitePrefix}/`)) pathname = pathname.slice(sitePrefix.length);
    return pathname || "/";
  } catch {
    return "";
  }
}

function absoluteLocalUrl(route) {
  if (route.startsWith("/assets/")) return `${new URL(baseUrl).origin}${route}`;
  return `${baseUrl}${route === "/" ? "" : route}`;
}

function expectedCanonical(route) {
  return `${productionOrigin}${route === "/" ? "/" : route}`;
}

function isDetailRoute(route) {
  return /^(?:\/ai-image-generation|\/ai-video-generation|\/ai-save-the-date|\/tools|\/collections)\/[^/]+$/.test(route);
}

function isEligibleDiscoveredRoute(route) {
  return Boolean(route) && isDetailRoute(route) && !RETIRED_PATHS.has(route) && !PRIVATE_PATHS.has(route) && !ALIAS_PATHS.has(route) && !NON_INDEXABLE_CATEGORY_GROUP_PATHS.has(route);
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tag = html.match(new RegExp(`<meta\\s+[^>]*name=["']${escaped}["'][^>]*>`, "i"))?.[0] ?? "";
  return tag.match(/content=["']([^"']*)/i)?.[1] ?? "";
}

function canonicalHref(html) {
  return html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i)?.[1] ?? "";
}

function stripMarkup(html) {
  return compact(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&"));
}

function imageProblems(html) {
  return [...html.matchAll(/<img\b[^>]*>/gi)].flatMap((match) => {
    const tag = match[0];
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1];
    return alt === undefined ? [{ tag: tag.slice(0, 240), reason: "missing-alt" }] : [];
  });
}

function imageSources(html) {
  return [...html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
}

function jsonLdTypes(html) {
  const types = new Set();
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(match[1]);
      const nodes = Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [parsed];
      for (const node of nodes) {
        for (const type of Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]) {
          if (type) types.add(type);
        }
      }
    } catch {
      // The per-page failure below reports a missing required type; malformed
      // JSON-LD must not make the smoke itself crash.
    }
  }
  return types;
}

function internalHrefRoutes(html) {
  return [...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => routeFromUrl(match[1]))
    .filter(isEligibleDiscoveredRoute);
}

async function request(route, options = {}) {
  const timeoutMs = Number(process.env.SEO_SMOKE_REQUEST_TIMEOUT_MS || 20_000);
  const response = await fetch(absoluteLocalUrl(route), {
    redirect: options.redirect || "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      accept: "text/html,application/xml",
      ...(smokeHost ? { host: smokeHost, "x-forwarded-host": smokeHost } : {})
    }
  });
  const body = await response.text();
  return { route, status: response.status, url: response.url, headers: response.headers, body };
}

async function mapLimit(values, limit, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  const sitemapResponse = await request("/sitemap.xml");
  assert.equal(sitemapResponse.status, 200, `sitemap status ${sitemapResponse.status}`);
  const sitemapLocs = [...sitemapResponse.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
  const sitemapRoutes = sitemapLocs.map(routeFromUrl).filter(Boolean);
  const sitemapSet = new Set(sitemapRoutes);
  assert.equal(new Set(sitemapLocs).size, sitemapLocs.length, "sitemap has duplicate loc values");
  assert(sitemapLocs.every((loc) => new URL(loc).hostname === "aidreamcapes.eu"), "sitemap contains a foreign host");
  assert(!sitemapRoutes.some((route) => PRIVATE_PATHS.has(route) || RETIRED_PATHS.has(route) || ALIAS_PATHS.has(route)), "sitemap contains private, retired or alias route");
  const missingSharedPublicPaths = REQUIRED_SHARED_PUBLIC_PATHS.filter((route) => !sitemapSet.has(route));
  assert.equal(missingSharedPublicPaths.length, 0, `shared public routes missing from Aidreamcapes EU sitemap: ${missingSharedPublicPaths.join(", ")}`);

  const routeResults = [];
  const crawlRoutes = [...new Set(sitemapRoutes)];
  const pageBodies = new Map();
  await mapLimit(crawlRoutes, Number(process.env.SEO_SMOKE_CONCURRENCY || 2), async (route) => {
    let page;
    try {
      page = await request(route);
    } catch (error) {
      routeResults.push({ route, status: 0, canonical: "", robots: "", imageCount: 0, wordCount: 0, failures: [error instanceof Error ? error.name : "request-error"] });
      return;
    }
    pageBodies.set(route, page.body);
    const robots = metaContent(page.body, "robots").toLowerCase();
    const canonical = canonicalHref(page.body).replace(/\/$/, route === "/" ? "" : "/");
    const indexable = !PRIVATE_PATHS.has(route) && !RETIRED_PATHS.has(route) && !ALIAS_PATHS.has(route);
    const failures = [];
    if (page.status !== 200) failures.push(`http-${page.status}`);
    if (indexable && canonical !== expectedCanonical(route).replace(/\/$/, route === "/" ? "" : "/")) failures.push("canonical");
    if (indexable && !/(?:^|[ ,])index(?:$|[ ,])/.test(robots) || (indexable && !/(?:^|[ ,])follow(?:$|[ ,])/.test(robots))) failures.push("robots");
    if (indexable && !/<h1\b/i.test(page.body)) failures.push("missing-h1");
    if (indexable && !/<meta\s+name=["']description["'][^>]*content=["'][^"']+/.test(page.body)) failures.push("missing-description");
    const problems = imageProblems(page.body);
    if (problems.length) failures.push("image-alt");
    const sourceProblems = imageSources(page.body).filter((src) => KNOWN_BROKEN_ASSETS.some((name) => src.includes(name)));
    if (sourceProblems.length) failures.push("known-broken-image-source");
    const text = stripMarkup(page.body);
    if (/myDreamshoots|myDreamShoots|AIdreamshoots|aidreamshoots\.eu|aidreamcapes\.com/i.test(text)) failures.push("brand-leak");
    const schemaTypes = jsonLdTypes(page.body);
    const requiredSchemaTypes = isDetailRoute(route) || /^\/watch\//.test(route)
      ? ["BreadcrumbList"]
      : ["Organization", "WebSite", "BreadcrumbList"];
    if (requiredSchemaTypes.some((type) => !schemaTypes.has(type))) failures.push("incomplete-json-ld");
    routeResults.push({ route, status: page.status, canonical, robots, imageCount: imageSources(page.body).length, wordCount: text.split(/\s+/).filter(Boolean).length, failures });
  });

  const root = await request("/ai-video-generation");
  const rootText = stripMarkup(root.body);
  const rootWordCount = rootText.split(/\s+/).filter(Boolean).length;
  assert(root.status === 200, `AI video directory status ${root.status}`);
  assert(rootWordCount >= 350, `AI video directory has only ${rootWordCount} visible words`);
  assert(!/myDreamshoots|myDreamShoots|AIdreamshoots|aidreamcapes\.com/i.test(rootText), "AI video directory contains a brand leak");
  assert(/FAQ|Questions fréquentes|processus|étapes|workflow/i.test(rootText), "AI video directory lacks process/FAQ content");

  const best = await request("/best-save-the-date");
  const bestText = stripMarkup(best.body);
  assert(best.status === 200, `best-save-the-date status ${best.status}`);
  assert(!/myDreamshoots|myDreamShoots|AIdreamshoots|aidreamcapes\.com/i.test(bestText), "best-save-the-date contains a brand leak");
  assert(!/Save the Date gallery|Explore all Save the Date themes|Browse the full Save the Date gallery/i.test(bestText), "best-save-the-date contains English fallback copy");

  const knownAssetResults = await mapLimit(KNOWN_BROKEN_ASSETS, 3, async (name) => {
    const assetPath = `/assets/sites/site_aidreamcapes_eu/fan-holiday-theme/categories/${name}`;
    const result = await request(assetPath);
    const contentType = result.headers.get("content-type") || "";
    assert.equal(result.status, 200, `${assetPath} must be repaired, got ${result.status}`);
    assert(/^image\//i.test(contentType), `${assetPath} must return an image content type, got ${contentType}`);
    assert(result.body.length > 128, `${assetPath} returned an empty image body`);
    return { path: assetPath, status: result.status, contentType, bytes: result.body.length };
  });

  const retiredResults = await mapLimit([...RETIRED_PATHS, ...SENTINEL_404_PATHS], 4, async (route) => {
    const result = await request(route, { redirect: "manual" });
    assert.equal(result.status, 404, `${route} must return 404, got ${result.status}`);
    return { route, status: result.status, location: result.headers.get("location") || "", xRobotsTag: result.headers.get("x-robots-tag") || "" };
  });
  const alias = await request("/ai-video-generation/christmas", { redirect: "manual" });
  assert([301, 308].includes(alias.status), `seasonal alias must redirect, got ${alias.status}`);
  assert(alias.headers.get("location")?.includes("/ai-save-the-date/christmas"), "seasonal alias target is not canonical");

  const discoveredRoutes = new Set();
  for (const result of routeResults) {
    for (const route of internalHrefRoutes(pageBodies.get(result.route) || "")) discoveredRoutes.add(route);
  }
  const discoveredNotInSitemap = [...discoveredRoutes].filter((route) => !sitemapSet.has(route)).sort();
  const pageFailures = routeResults.filter((result) => result.failures.length);
  const sitemapImageCount = (sitemapResponse.body.match(/<image:loc>/g) || []).length;
  assert(sitemapImageCount > 0, "Aidreamcapes EU sitemap has no image entries");
  assert.equal(discoveredNotInSitemap.length, 0, `public detail routes missing from sitemap: ${discoveredNotInSitemap.join(", ")}`);
  assert.equal(pageFailures.length, 0, `sitemap page failures: ${JSON.stringify(pageFailures.slice(0, 8))}`);

  const report = {
    ok: true,
    baseUrl,
    sitemap: { status: sitemapResponse.status, count: sitemapRoutes.length, routes: sitemapRoutes },
    pages: routeResults,
    aiVideoDirectory: { status: root.status, wordCount: rootWordCount },
    bestSaveTheDate: { status: best.status, wordCount: bestText.split(/\s+/).filter(Boolean).length },
    knownAssetResults,
    retiredRoutes: retiredResults,
    discoveredNotInSitemap,
    skippedPerformanceChecks: ["Google PageSpeed", "Lighthouse"]
  };
  fs.mkdirSync(reportRoot, { recursive: true });
  const reportPath = path.join(reportRoot, `smoke-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
