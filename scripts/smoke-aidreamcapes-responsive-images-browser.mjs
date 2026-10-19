#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_AIDREAMCAPES_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const host = process.env.SMOKE_AIDREAMCAPES_HOST || "www.aidreamcapes.com";
const defaultRoutes = [
  "/",
  "/workflow",
  "/collections",
  "/collections/fan-scene-albums",
  "/collections/private-fan-scene-albums",
  "/collections/game-day-group-photos",
  "/collections/game-day-group-portraits",
  "/collections/christmas-holiday-albums",
  "/collections/christmas-group-albums",
  "/collections/new-year-countdown-albums",
  "/tools",
  "/tools/fan-scene-album-builder",
  "/tools/game-day-group-portrait-maker",
  "/tools/christmas-group-album-studio",
  "/tools/new-year-countdown-album-maker",
  "/ai-image-generation",
  "/ai-image-generation/white-background-photos",
  "/ai-image-generation/lifestyle-photos",
  "/ai-image-generation/packshot-multi-angle",
  "/ai-image-generation/macro-details",
  "/ai-image-generation/bundle-sets",
  "/ai-image-generation/size-reference",
  "/ai-image-generation/feature-infographic",
  "/ai-image-generation/comparison-chart",
  "/ai-image-generation/social-ad-photos",
  "/ai-image-generation/ugc-still-ad",
  "/ai-image-generation/story-ad-vertical",
  "/ai-image-generation/carousel-set",
  "/ai-image-generation/sale-campaign-key-visual",
  "/ai-image-generation/lookbook-cover",
  "/ai-image-generation/model-photos",
  "/ai-image-generation/virtual-try-on",
  "/ai-image-generation/hair-makeup-preview",
  "/ai-image-generation/jewelry-positioning",
  "/ai-image-generation/ghost-mannequin",
  "/ai-image-generation/colorway-variations",
  "/ai-image-generation/change-background",
  "/ai-image-generation/enhance-upscale",
  "/ai-image-generation/old-photo-restore",
  "/ai-image-generation/commercial-lighting",
  "/ai-image-generation/packaging-mockup",
  "/ai-image-generation/professional-headshot",
  "/ai-image-generation/creator-portrait",
  "/ai-image-generation/team-directory",
  "/ai-image-generation/social-profile-photo",
  "/ai-image-generation/fashion-editorial",
  "/best-packages",
  "/best-ai-image",
  "/best-ai-video",
  "/blog/private-fan-scene-album-photo-package-guide",
  "/pricing",
  "/faq",
  "/about-us",
  "/contact-us",
  "/cookies",
  "/refunds",
  "/privacy",
  "/terms"
];
async function routesFromAidreamcapesSitemap() {
  if (process.env.SMOKE_AIDREAMCAPES_ROUTES) return undefined;
  try {
    const response = await fetch(`${baseUrl}/sitemap.xml`, {
      headers: { Host: host, "x-forwarded-host": host, "user-agent": "aidreamcapes-responsive-images-smoke" }
    });
    if (!response.ok) return undefined;
    const xml = await response.text();
    const sitemapRoutes = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
      .map((match) => {
        try {
          const url = new URL(match[1]);
          return /(?:^|\.)aidreamcapes\.com$/i.test(url.hostname) ? `${url.pathname}${url.search}` : undefined;
        } catch {
          return undefined;
        }
      })
      .filter((route) => route && route !== "/sitemap.xml" && route !== "/robots.txt");
    return sitemapRoutes.length ? sitemapRoutes : undefined;
  } catch {
    return undefined;
  }
}
// The published sitemap is the source of truth for the current public route set.
// Keep the curated list only as an offline fallback when the sitemap is unavailable.
const sitemapRoutes = process.env.SMOKE_AIDREAMCAPES_USE_SITEMAP === "0" ? undefined : await routesFromAidreamcapesSitemap();
const routes = [...new Set((process.env.SMOKE_AIDREAMCAPES_ROUTES ? process.env.SMOKE_AIDREAMCAPES_ROUTES.split(",") : (sitemapRoutes ?? defaultRoutes)).map((value) => value.trim()).filter(Boolean))];
const imagePattern = /\.(?:avif|webp|jpe?g|png)(?:[?#]|$)/i;

async function resolveLocalNavigationTarget(route) {
  let current = new URL(`${baseUrl}${route}`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(current, {
      headers: { host, "x-forwarded-host": host, "user-agent": "aidreamcapes-responsive-images-smoke" },
      redirect: "manual"
    });
    if (response.status < 300 || response.status >= 400) return current.toString();
    const location = response.headers.get("location");
    if (!location) return current.toString();
    const redirected = new URL(location, current);
    current = new URL(`${baseUrl}${redirected.pathname}${redirected.search}`);
  }
  throw new Error(`${route}: exceeded local redirect limit`);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  extraHTTPHeaders: { "x-forwarded-host": host, "user-agent": "aidreamcapes-responsive-images-smoke" }
});
const reports = [];

try {
  for (const route of routes) {
    const page = await context.newPage();
    const localNavigationTarget = new URL(await resolveLocalNavigationTarget(route));
    localNavigationTarget.searchParams.set("responsive-browser-smoke", "20260922");
    const requestFailures = [];
    const imageHttpFailures = [];
    const publicApiRequests = [];
    page.on("requestfailed", (request) => {
      if (imagePattern.test(request.url())) requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? "" });
    });
    page.on("response", (response) => {
      if (imagePattern.test(response.url()) && response.status() >= 400) imageHttpFailures.push({ url: response.url(), status: response.status() });
    });
    page.on("request", (request) => {
      if (["xhr", "fetch"].includes(request.resourceType()) && /\/api\//i.test(request.url())) publicApiRequests.push(request.url());
    });
    const response = await page.goto(localNavigationTarget.toString(), { waitUntil: "domcontentloaded", timeout: 120_000 });
    const initial = await page.evaluate(() => ({
      images: [...document.images].map((image) => ({
        src: image.currentSrc || image.src,
        loading: image.loading,
        fetchPriority: image.fetchPriority,
        width: image.getAttribute("width"),
        height: image.getAttribute("height"),
        sizes: image.getAttribute("sizes"),
        srcSet: image.getAttribute("srcset"),
        target: (image.currentSrc || image.src).includes("/assets/sites/site_aidreamcapes/") && !/\/brand\//i.test(image.currentSrc || image.src) && !/\.svg(?:[?#]|$)/i.test(image.currentSrc || image.src),
        responsive: Boolean(image.closest("picture")?.querySelector("source[srcset]"))
      })),
      preloads: [...document.querySelectorAll('link[rel="preload"][as="image"]')].map((link) => link.getAttribute("href") || "")
    }));
    await page.evaluate(async () => {
      const step = Math.max(500, Math.floor(window.innerHeight * 0.8));
      for (let y = 0; y <= document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 45));
      }
      window.scrollTo(0, 0);
    });
    await page.waitForFunction(() => [...document.images].filter((image) => image.getClientRects().length).every((image) => image.complete), { timeout: 20_000 }).catch(() => {});
    const final = await page.evaluate(() => ({
      images: [...document.images].map((image) => ({
        src: image.currentSrc || image.src,
        loading: image.loading,
        fetchPriority: image.fetchPriority,
        width: image.getAttribute("width"),
        height: image.getAttribute("height"),
        sizes: image.getAttribute("sizes"),
        srcSet: image.getAttribute("srcset"),
        target: (image.currentSrc || image.src).includes("/assets/sites/site_aidreamcapes/") && !/\/brand\//i.test(image.currentSrc || image.src) && !/\.svg(?:[?#]|$)/i.test(image.currentSrc || image.src),
        responsive: Boolean(image.closest("picture")?.querySelector("source[srcset]"))
      })),
      cls: [...performance.getEntriesByType("layout-shift")].reduce((sum, entry) => sum + (entry.hadRecentInput ? 0 : entry.value), 0),
      lcp: performance.getEntriesByType("largest-contentful-paint").at(-1)?.startTime ?? null
    }));
    const targetImages = final.images.filter((image) => image.target);
    const eagerTargetImages = targetImages.filter((image) => image.loading === "eager" || image.fetchPriority === "high");
    const targetPreloads = initial.preloads.filter((url) => url.includes("/assets/sites/site_aidreamcapes/") && !/\/brand\//i.test(url) && !/\.svg(?:[?#]|$)/i.test(url));
    assert.equal(response?.status(), 200, `${route}: HTTP status`);
    assert.equal(requestFailures.length, 0, `${route}: image request failures ${JSON.stringify(requestFailures)}`);
    assert.equal(imageHttpFailures.length, 0, `${route}: image HTTP failures ${JSON.stringify(imageHttpFailures)}`);
    assert.equal(publicApiRequests.length, 0, `${route}: public page made API requests ${JSON.stringify(publicApiRequests)}`);
    assert(eagerTargetImages.length <= 1, `${route}: expected at most one eager/high target image, got ${eagerTargetImages.length} ${JSON.stringify(eagerTargetImages)}`);
    assert(targetPreloads.length <= 1, `${route}: expected at most one target image preload, got ${targetPreloads.length}`);
    const missingTargetAttributes = targetImages.filter((image) => !(image.width && image.height && image.sizes && image.srcSet));
    assert.equal(missingTargetAttributes.length, 0, `${route}: target images need width, height, sizes, and srcSet ${JSON.stringify(missingTargetAttributes)}`);
    if (route === "/ai-image-generation") assert(targetImages.some((image) => image.responsive), `${route}: no responsive target image selected`);
    reports.push({ route, images: final.images.length, targetImages: targetImages.length, eagerTargetImages: eagerTargetImages.length, targetPreloads: targetPreloads.length, responsiveImages: targetImages.filter((image) => image.responsive).length, cls: final.cls, lcp: final.lcp });
    await page.close();
  }
} finally {
  await context.close();
  await browser.close();
}

console.log(JSON.stringify({ ok: true, baseUrl, host, routes: routes.length, reports }, null, 2));
