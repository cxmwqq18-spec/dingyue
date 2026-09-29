#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, request } from "playwright";

const baseUrl = String(process.env.SMOKE_AIDREAMCAPES_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const host = process.env.SMOKE_AIDREAMCAPES_HOST || "aidreamcapes.com";
const headers = {
  "x-forwarded-host": host,
  "x-forwarded-proto": "https",
  "user-agent": "aidreamcapes-ugc-video-browser-smoke"
};
const manifest = JSON.parse(readFileSync(new URL("../src/lib/aidreamcapes-ugc-video-media.json", import.meta.url), "utf8"));

async function goto(page, url) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }
  throw lastError;
}

async function assertVideo(video, { sourceRequired = true } = {}) {
  assert(await video.getAttribute("autoplay") !== null, "video autoplay missing");
  assert(await video.getAttribute("loop") !== null, "video loop missing");
  assert(await video.evaluate((element) => element.muted), "video muted property missing");
  assert(await video.getAttribute("playsinline") !== null, "video playsinline missing");
  assert(await video.getAttribute("poster"), "video poster missing");
  const sources = video.locator("source");
  const sourceCount = await sources.count();
  assert(sourceRequired ? sourceCount === 1 : sourceCount <= 1, "video source count");
  if (sourceCount === 1) {
    assert((await sources.first().getAttribute("src"))?.startsWith("/assets/sites/site_aidreamcapes/ugc-video-themes/"), "video source path");
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ extraHTTPHeaders: headers, viewport: { width: 1440, height: 1000 } });
const routeRequest = await request.newContext({ extraHTTPHeaders: headers });

try {
  const home = await context.newPage();
  await goto(home, `${baseUrl}/`);
  const hero = home.locator('[data-aidreamcapes-section="hero"]');
  assert.equal(await hero.locator("video").count(), 1, "homepage hero video count");
  await assertVideo(hero.locator("video").first());

  const videoGrid = home.locator('[data-aidreamcapes-section="video-grid"]');
  await videoGrid.scrollIntoViewIfNeeded();
  await home.waitForTimeout(1_000);
  assert.equal(await videoGrid.locator("video").count(), 8, "homepage video grid count");
  for (let index = 0; index < await videoGrid.locator("video").count(); index += 1) {
    await assertVideo(videoGrid.locator("video").nth(index), { sourceRequired: false });
  }
  for (const route of ["/ai-video-generation/url-to-ad", "/ai-video-generation/unboxing-experience", "/ai-video-generation/before-after-showcases"]) {
    assert.equal(await videoGrid.locator(`a[href="${route}"]`).count(), 1, `homepage link ${route}`);
  }

  const photoGrid = home.locator('[data-aidreamcapes-section="photo-grid"]');
  await photoGrid.scrollIntoViewIfNeeded();
  assert.equal(await photoGrid.locator("img").count(), 9, "homepage photo grid count");
  for (const image of await photoGrid.locator("img").all()) {
    const src = await image.getAttribute("src");
    assert(src?.includes("/assets/sites/site_aidreamcapes/") && !src.includes("homepage-seo"), "homepage photo card still uses old placeholder");
  }

  const detail = await context.newPage();
  await goto(detail, `${baseUrl}/ai-video-generation/ugc-ad-video`);
  const detailMedia = detail.locator("[data-aidreamcapes-detail-hero-media]");
  assert.equal(await detailMedia.count(), 1, "detail hero media marker");
  await assertVideo(detailMedia.locator("video").first());
  const carouselTabs = detailMedia.getByRole("tab");
  assert.equal(await carouselTabs.count(), 2, "detail carousel tab count");
  await detail.getByRole("button", { name: "Next hero image" }).click();
  assert.equal(await carouselTabs.nth(1).getAttribute("aria-selected"), "true", "detail carousel did not advance");

  for (const item of manifest) {
    const response = await routeRequest.get(`${baseUrl}${item.route}`);
    const html = await response.text();
    const videoPath = `/assets/sites/site_aidreamcapes/ugc-video-themes/${item.slug}.mp4`;
    assert.equal(response.status(), 200, `${item.route}: status`);
    assert(html.includes("data-aidreamcapes-detail-hero-media"), `${item.route}: hero marker missing`);
    assert(html.includes("<video"), `${item.route}: video element missing`);
    assert(html.includes(`src="${videoPath}"`), `${item.route}: video source mismatch`);
    assert(html.includes("poster="), `${item.route}: poster missing`);
  }

  const mobileContext = await browser.newContext({ extraHTTPHeaders: headers, viewport: { width: 390, height: 844 } });
  try {
    const mobile = await mobileContext.newPage();
    await goto(mobile, `${baseUrl}/ai-video-generation/product-video`);
    const mobileMedia = mobile.locator("[data-aidreamcapes-detail-hero-media]");
    await mobileMedia.waitFor({ state: "visible", timeout: 20_000 });
    assert.equal(await mobileMedia.locator("video").count(), 1, "mobile detail video count");
    const box = await mobileMedia.boundingBox();
    assert(box && box.width <= 390, "mobile detail hero overflow");
  } finally {
    await mobileContext.close();
  }

  console.log(`Aidreamcapes UGC browser smoke passed: homepage media, carousel, mobile layout, and ${manifest.length} detail videos.`);
} finally {
  await routeRequest.dispose();
  await context.close();
  await browser.close();
}
