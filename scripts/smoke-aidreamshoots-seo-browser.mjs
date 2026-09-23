#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.AIDREAMSHOOTS_BROWSER_ORIGIN || "http://127.0.0.1:3002").replace(/\/$/, "");
const productionHost = process.env.AIDREAMSHOOTS_SMOKE_HOST || "aidreamshoots.eu";
const productionOrigin = `https://${productionHost}`;
const expectedResidualTitles = new Map([
  ["/ai-image-generation/futbol", "Fotos de fútbol con IA para aficionados | AIdreamshoots"],
  ["/ai-image-generation/magic", "Edición mágica de fotos con IA | AIdreamshoots"],
  ["/ai-image-generation/urbano", "Fotos urbanas con IA | AIdreamshoots"],
  ["/ai-image-generation/viaje", "Fotos de viaje con IA: retratos y destinos | AIdreamshoots"]
]);
const timeoutMs = Number(process.env.AIDREAMSHOOTS_BROWSER_TIMEOUT_MS || 60000);
const baseHost = new URL(baseUrl).hostname;
const localBrowserOrigin = /^(?:localhost|127\.0\.0\.1|::1)$/i.test(baseHost);

function normalizePath(value) {
  const raw = String(value || "/").split(/[?#]/, 1)[0] || "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

function decodeHtml(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function canonicalFor(pathname) {
  const path = normalizePath(pathname);
  return `${productionOrigin}${path}`.replace(/\/$/, "");
}

function browserRequestPath(pathname) {
  const normalized = normalizePath(pathname);
  return localBrowserOrigin
    ? `/site/aidreamshoots${normalized === "/" ? "" : normalized}`
    : normalized;
}

function sitemapPaths(xml) {
  return [...String(xml).matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => {
      try { return normalizePath(new URL(decodeHtml(match[1])).pathname); } catch { return ""; }
    })
    .filter(Boolean);
}

async function getSitemapPaths() {
  const response = await fetch(`${baseUrl}/sitemap.xml`, {
    headers: { "x-forwarded-host": productionHost, "user-agent": "aidreamshoots-seo-browser-smoke" }
  });
  assert.equal(response.status, 200, "sitemap.xml must return HTTP 200");
  return sitemapPaths(await response.text());
}

function typeSet(jsonLd) {
  return new Set(jsonLd.flatMap((item) => {
    const nodes = Array.isArray(item?.["@graph"]) ? item["@graph"] : [item];
    return nodes.flatMap((node) => Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]);
  }).filter(Boolean));
}

function duplicateMetadataValues(results, key) {
  const pathsByValue = new Map();
  for (const result of results) {
    const value = String(result[key] || "").trim();
    if (!value) continue;
    const paths = pathsByValue.get(value) || [];
    paths.push(result.pathname);
    pathsByValue.set(value, paths);
  }
  return [...pathsByValue.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([value, paths]) => ({ value, paths }));
}

async function inspectPage(page, pathname, { expectIndexable = true, expectedStatus = 200 } = {}) {
  let response;
  let lastNavigationError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      response = await page.goto(`${baseUrl}${browserRequestPath(pathname)}`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      lastNavigationError = undefined;
      break;
    } catch (error) {
      lastNavigationError = error;
      if (attempt === 2) throw error;
      await page.waitForTimeout(750);
    }
  }
  if (lastNavigationError && !response) throw lastNavigationError;
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const result = await page.evaluate(() => {
    const jsonLd = [];
    const jsonLdErrors = [];
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { jsonLd.push(JSON.parse(script.textContent || "")); } catch (error) { jsonLdErrors.push(String(error?.message || error)); }
    }
    const images = [...document.images].map((image) => ({
      src: image.currentSrc || image.src,
      rawSrc: image.getAttribute("src") || "",
      alt: image.getAttribute("alt"),
      width: image.getAttribute("width"),
      height: image.getAttribute("height"),
      loading: image.getAttribute("loading"),
      fetchPriority: image.getAttribute("fetchpriority"),
      decorative: image.getAttribute("aria-hidden") === "true" || ["presentation", "none"].includes(image.getAttribute("role") || "")
    }));
    const links = [...document.querySelectorAll("a[href]")].map((link) => link.getAttribute("href") || "");
    const badSources = [...images.map((image) => image.rawSrc), ...links].filter((value) => {
      try {
        const url = new URL(value, window.location.href);
        const absoluteLocal = /^(?:https?:)?\/\//i.test(value) && (url.hostname.includes("localhost") || url.hostname === "127.0.0.1");
        return /^http:\/\//i.test(value) || absoluteLocal || /^\/?collections(?:\/|$)/i.test(url.pathname) || /^\/ai-image-generation\/collections-/i.test(url.pathname);
      } catch { return true; }
    });
    return {
      lang: document.documentElement.lang,
      title: document.title.trim(),
      description: document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || "",
      ogType: document.querySelector('meta[property="og:type"]')?.getAttribute("content")?.trim().toLowerCase() || "",
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content")?.toLowerCase() || "",
      canonical: document.querySelector('link[rel="canonical"]')?.href?.replace(/\/$/, "") || "",
      h1Count: document.querySelectorAll("main h1, body > h1").length,
      images,
      badSources,
      jsonLd,
      jsonLdErrors,
      topicMediaIssues: [...document.querySelectorAll("[data-video-topic-media], [data-video-topic-hero-media]")].flatMap((container) => {
        const image = container.querySelector("img");
        const video = container.querySelector("video");
        if (!image && video) {
          const source = video.getAttribute("src") || video.querySelector("source[src]")?.getAttribute("src") || "";
          return [!source.trim() ? "empty video source" : ""].filter(Boolean);
        }
        if (!image) return ["media container without an image or video"];
        const width = Number(image.getAttribute("width"));
        const height = Number(image.getAttribute("height"));
        return [
          !image.getAttribute("src")?.trim() ? "empty image source" : "",
          !(width > 0 && height > 0) ? "image dimensions missing" : "",
          !image.getAttribute("loading") ? "image loading strategy missing" : ""
        ].filter(Boolean);
      })
    };
  });
  const responseRobots = response?.headers()["x-robots-tag"] || "";
  result.robots = `${result.robots} ${responseRobots}`.trim().toLowerCase();
  const types = typeSet(result.jsonLd);
  assert.equal(response?.status(), expectedStatus, `${pathname} must return HTTP ${expectedStatus}`);
  assert.equal(result.lang, "es", `${pathname} must use lang=es`);
  if (expectIndexable) {
    assert(result.title, `${pathname} needs a title`);
    assert(result.title.length >= 30 && result.title.length <= 60, `${pathname} title length must be 30-60 characters`);
    if (expectedResidualTitles.has(pathname)) assert.equal(result.title, expectedResidualTitles.get(pathname), `${pathname} has the wrong residual SEO title`);
    assert(result.description, `${pathname} needs a meta description`);
    assert(result.description.length >= 70 && result.description.length <= 160, `${pathname} description length must be 70-160 characters`);
    assert(["website", "article"].includes(result.ogType), `${pathname} needs an explicit og:type`);
    assert.equal(result.canonical, canonicalFor(pathname), `${pathname} has the wrong canonical`);
    assert.match(result.robots, /\bindex\b/, `${pathname} must be indexable`);
    assert.match(result.robots, /\bfollow\b/, `${pathname} must be followable`);
    assert.equal(result.h1Count, 1, `${pathname} must have one H1`);
    assert.equal(result.jsonLdErrors.length, 0, `${pathname} has invalid JSON-LD: ${result.jsonLdErrors.join("; ")}`);
    assert.equal(result.images.filter((image) => !image.alt?.trim() && !image.decorative).length, 0, `${pathname} has an accidental empty image alt`);
    assert.equal(result.images.filter((image) => !image.decorative && !(Number(image.width) > 0 && Number(image.height) > 0)).length, 0, `${pathname} has content images without intrinsic dimensions`);
    assert.deepEqual(result.topicMediaIssues, [], `${pathname} has invalid or empty topic media: ${result.topicMediaIssues.join("; ")}`);
    assert.equal(result.badSources.length, 0, `${pathname} contains legacy, local, or HTTP media/link URLs: ${result.badSources.slice(0, 3).join(", ")}`);
    if (pathname === "/") {
      assert(types.has("Organization"), "homepage needs Organization JSON-LD");
      assert(types.has("WebSite"), "homepage needs WebSite JSON-LD");
    }
    if (pathname.startsWith("/blog/")) {
      assert(types.has("Article") || types.has("BlogPosting"), `${pathname} needs Article/BlogPosting JSON-LD`);
      assert(types.has("BreadcrumbList"), `${pathname} needs BreadcrumbList JSON-LD`);
    }
    if (pathname === "/blog") assert(types.has("BreadcrumbList"), `${pathname} needs BreadcrumbList JSON-LD`);
    if (/^\/ai-image-generation\/[^/]+$/i.test(pathname)) assert(types.has("BreadcrumbList"), `${pathname} needs BreadcrumbList JSON-LD`);
  } else {
    assert.match(result.robots, /\bnoindex\b/, `${pathname} must be noindex`);
    if (pathname !== "/404") assert.match(result.robots, /\bnofollow\b/, `${pathname} must be nofollow`);
  }
  return {
    pathname,
    status: response?.status(),
    title: result.title,
    description: result.description,
    imageCount: result.images.length,
    jsonLdTypes: [...types]
  };
}

const paths = process.env.AIDREAMSHOOTS_BROWSER_PATHS
  ? process.env.AIDREAMSHOOTS_BROWSER_PATHS.split(",").map((value) => normalizePath(value.trim())).filter(Boolean)
  : await getSitemapPaths();
assert(paths.length > 0, "AIdreamshoots sitemap must expose browser-checkable URLs");

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const browserHeaders = { "user-agent": "aidreamshoots-seo-browser-smoke" };
if (!localBrowserOrigin) browserHeaders["x-forwarded-host"] = productionHost;
await context.setExtraHTTPHeaders(browserHeaders);
const page = await context.newPage();
const results = [];
try {
  for (const pathname of paths) {
    results.push(await inspectPage(page, pathname, { expectIndexable: !localBrowserOrigin }));
  }
  for (const pathname of ["/login", "/account", "/app/create", "/404"]) {
    results.push(await inspectPage(page, pathname, { expectIndexable: false, expectedStatus: pathname === "/404" ? 404 : 200 }));
  }
} finally {
  await page.close();
  await context.close();
  await browser.close();
}

const indexableResults = localBrowserOrigin ? [] : results.filter((result) => paths.includes(result.pathname));
assert.deepEqual(duplicateMetadataValues(indexableResults, "title"), [], "indexable pages must have unique titles");
assert.deepEqual(duplicateMetadataValues(indexableResults, "description"), [], "indexable pages must have unique meta descriptions");

console.log(JSON.stringify({ ok: true, origin: baseUrl, productionHost, sitemapUrls: paths.length, checkedPages: results.length, results }, null, 2));
