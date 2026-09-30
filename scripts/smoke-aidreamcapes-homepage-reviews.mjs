#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_AIDREAMCAPES_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const url = `${baseUrl}/site/aidreamcapes`;
const screenshotDir = process.env.SMOKE_AIDREAMCAPES_SCREENSHOT_DIR || "/tmp/aidreamcapes-homepage-reviews";

async function waitForImages(page, locator) {
  await locator.evaluateAll((images) => Promise.all(images.map((image) => {
    image.loading = "eager";
    image.scrollIntoView({ block: "center", inline: "nearest" });
    if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) return undefined;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        image.removeEventListener("load", loaded);
        image.removeEventListener("error", failed);
      };
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error(`image failed to load: ${image.currentSrc || image.src}`));
      };
      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", failed, { once: true });
    });
  })));
}

async function inspectViewport(page, viewport, screenshotName) {
  await page.setViewportSize(viewport);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-aidreamcapes-section="testimonials"]').waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);

  const cards = page.locator("[data-review-card]");
  const avatars = page.locator("[data-review-card] [data-review-avatar] img");
  const results = page.locator("[data-review-card] [data-review-result] img");
  assert.equal(await cards.count(), 6, `${screenshotName}: expected six example workflow cards`);
  assert.equal(await avatars.count(), 6, `${screenshotName}: expected six human avatars`);
  assert.equal(await results.count(), 6, `${screenshotName}: expected six generated result images`);
  assert.equal(await page.locator('[data-review-avatar="fallback"]').count(), 0, `${screenshotName}: a canonical review fell back to initials`);

  await waitForImages(page, avatars);
  await waitForImages(page, results);

  const imageReport = await page.locator("[data-review-card] img").evaluateAll((images) => images.map((image) => ({
    alt: image.alt.trim(),
    src: image.currentSrc || image.src,
    width: image.naturalWidth,
    height: image.naturalHeight
  })));
  assert.equal(imageReport.length, 12, `${screenshotName}: expected twelve review images`);
  assert.equal(imageReport.filter((image) => !image.alt || image.width === 0 || image.height === 0).length, 0, `${screenshotName}: review image has empty alt or zero dimensions`);
  assert.match(await page.locator("body").innerText(), /Example workflows/i);
  assert.match(await page.locator("body").innerText(), /Fan Scene Album/i);
  assert.equal(await page.getByText("Generated result", { exact: true }).count(), 6, `${screenshotName}: result labels`);
  const firstCardChildren = await cards.first().locator(":scope > *").evaluateAll((children) => children.map((child) => child.getAttribute("data-review-result") !== null ? "result" : "content"));
  assert.deepEqual(firstCardChildren.slice(0, 2), ["result", "content"], `${screenshotName}: result image must precede review content`);

  const layout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  assert(layout.scrollWidth <= layout.viewportWidth + 2, `${screenshotName}: horizontal overflow ${layout.scrollWidth} > ${layout.viewportWidth}`);

  await fs.mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, screenshotName), fullPage: true });
  return { cards: await cards.count(), images: imageReport.length, layout };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const consoleErrors = [];
const pageErrors = [];
const requestFailures = [];
const knownStorefrontJsonLdHydrationMismatch = (message) => /Hydration failed because the server rendered HTML didn't match the client/i.test(message) && /StorefrontJsonLd|data-storefront-json-ld/i.test(message);
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => {
  if (!knownStorefrontJsonLdHydrationMismatch(error.message)) pageErrors.push(error.message);
});
page.on("requestfailed", (request) => {
  if (request.failure()?.errorText !== "net::ERR_ABORTED") requestFailures.push({ url: request.url(), error: request.failure()?.errorText });
});

try {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.equal(response?.status(), 200, "Aidreamcapes homepage status");
  const desktop = await inspectViewport(page, { width: 1440, height: 1000 }, "desktop.png");
  const mobile = await inspectViewport(page, { width: 390, height: 844 }, "mobile.png");
  assert.deepEqual(consoleErrors, [], `browser console errors: ${consoleErrors.join(" | ")}`);
  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(requestFailures, [], `browser request failures: ${JSON.stringify(requestFailures.slice(0, 3))}`);
  console.log(JSON.stringify({ ok: true, url, desktop, mobile, screenshotDir }, null, 2));
} finally {
  await browser.close();
}
