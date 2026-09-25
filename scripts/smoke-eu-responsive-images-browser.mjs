#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const argument = (name, fallback) => {
  const exact = process.argv.find((value) => value.startsWith(`${name}=`));
  return exact ? exact.slice(name.length + 1).replace(/\/$/, "") : fallback;
};

const baseUrl = argument("--base-url", "http://127.0.0.1:3002");
const sites = [
  {
    key: "aidreamcapes-eu",
    path: "/site/aidreamcapes-eu",
    lang: "fr",
    assetPrefix: "/assets/sites/site_aidreamcapes_eu/",
    pages: ["/", "/ai-save-the-date/engagement", "/ai-save-the-date/wedding-invitation", "/faq", "/ai-image-generation/headshot", "/tools"],
    pagesWithSiteImages: new Set(["/", "/ai-save-the-date/engagement", "/ai-save-the-date/wedding-invitation"])
  },
  {
    key: "aidreamshoots-eu",
    path: "/site/aidreamshoots",
    lang: "es",
    assetPrefix: "/assets/sites/site_aidreamshoots/",
    // The Spanish storefront publishes engagement, but not the French-only
    // wedding-invitation route used by the other EU site.
    pages: ["/", "/ai-save-the-date/engagement", "/faq", "/ai-image-generation/headshot", "/tools"],
    pagesWithSiteImages: new Set(["/", "/ai-save-the-date/engagement"])
  }
];
const imageRequestPattern = /\.(?:avif|webp|jpe?g|png)(?:[?#]|$)/i;
const browser = await chromium.launch({ headless: true });
const reports = [];

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const site of sites) {
    for (const pathname of site.pages) {
      const requestFailures = [];
      const imageHttpFailures = [];
      const onRequestFailed = (request) => {
        if (imageRequestPattern.test(request.url())) requestFailures.push({ url: request.url(), error: request.failure()?.errorText ?? "" });
      };
      const onResponse = (response) => {
        if (imageRequestPattern.test(response.url()) && response.status() >= 400) {
          imageHttpFailures.push({ url: response.url(), status: response.status() });
        }
      };
      page.on("requestfailed", onRequestFailed);
      page.on("response", onResponse);
      const url = `${baseUrl}${site.path}${pathname}?responsive-browser-smoke=20260921`;
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.evaluate(async () => {
        for (const image of [...document.images]) {
          if (!image.getClientRects().length) continue;
          image.scrollIntoView({ block: "center", inline: "nearest" });
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      });
      await page.waitForFunction(
        () => [...document.images].filter((image) => image.getClientRects().length).every((image) => image.complete),
        { timeout: 15_000 }
      ).catch(() => {});
      const data = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        images: [...document.images].map((image) => ({
          src: image.currentSrc || image.src,
          preview: image.getAttribute("data-dreamshoot-preview-src") || "",
          loading: image.loading,
          responsive: Boolean(image.closest("picture")?.querySelector("source[srcset]")),
          hasAvif: Boolean(image.closest("picture")?.querySelector('source[type="image/avif"][srcset]')),
          hasWebp: Boolean(image.closest("picture")?.querySelector('source[type="image/webp"][srcset]'))
        }))
      }));
      const siteImages = data.images.filter((image) => image.src.includes("/assets/sites/") || image.preview.includes("/assets/sites/"));
      const responsiveImages = siteImages.filter((image) => /\/_responsive\//i.test(image.src));
      assert.equal(response?.status(), 200, `${site.key}${pathname}: HTTP status`);
      assert.equal(data.lang, site.lang, `${site.key}${pathname}: language`);
      assert.equal(requestFailures.length, 0, `${site.key}${pathname}: image request failures ${JSON.stringify(requestFailures)}`);
      assert.equal(imageHttpFailures.length, 0, `${site.key}${pathname}: image HTTP failures ${JSON.stringify(imageHttpFailures)}`);
      if (site.pagesWithSiteImages.has(pathname)) assert(responsiveImages.length > 0, `${site.key}${pathname}: no responsive site image selected`);
      assert(responsiveImages.every((image) => image.responsive && image.hasAvif && image.hasWebp), `${site.key}${pathname}: missing AVIF/WebP picture sources`);
      assert(siteImages.every((image) => !image.src.includes("/assets/sites/") || image.src.includes(site.assetPrefix)), `${site.key}${pathname}: cross-site image asset selected`);
      assert(siteImages.every((image) => !image.preview.includes("/_responsive/")), `${site.key}${pathname}: preview points to responsive derivative`);
      reports.push({ site: site.key, pathname, images: data.images.length, siteImages: siteImages.length, responsiveImages: responsiveImages.length, eagerImages: data.images.filter((image) => image.loading === "eager").length });
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, baseUrl, reports }, null, 2));
