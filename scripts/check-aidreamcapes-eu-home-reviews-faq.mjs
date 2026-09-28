#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv.find((value) => value.startsWith("--url="))?.slice("--url=".length)
  ?? "http://localhost:3002/site/aidreamcapes-eu";
const screenshotPath = process.argv.find((value) => value.startsWith("--screenshot="))?.slice("--screenshot=".length)
  ?? "/tmp/aidreamcapes-eu-home-reviews-faq.png";

const failedRequests = [];
const badResponses = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on("requestfailed", (request) => {
  const error = request.failure()?.errorText;
  if (error !== "net::ERR_ABORTED") failedRequests.push({ url: request.url(), type: request.resourceType(), error });
});
page.on("response", (response) => {
  if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status(), type: response.request().resourceType() });
});

async function waitForImages(locator) {
  for (let index = 0; index < await locator.count(); index += 1) {
    const image = locator.nth(index);
    await image.scrollIntoViewIfNeeded();
    await image.evaluate((element) => {
      element.loading = "eager";
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          element.removeEventListener("load", loaded);
          element.removeEventListener("error", failed);
        };
        const loaded = () => {
          cleanup();
          resolve();
        };
        const failed = () => {
          cleanup();
          reject(new Error(`image failed to load: ${element.currentSrc || element.src}`));
        };
        if (element.complete && element.naturalWidth > 0 && element.naturalHeight > 0) {
          resolve();
          return;
        }
        element.addEventListener("load", loaded, { once: true });
        element.addEventListener("error", failed, { once: true });
      });
    });
  }
}

try {
  const response = await page.goto(baseUrl, { waitUntil: "commit", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 120_000 });
  await waitForImages(page.locator("#faq [data-faq-feature-gallery] img"));
  await page.screenshot({ path: screenshotPath, fullPage: true });

  const reviewLayout = await page.locator("#reviews > div > div").evaluate((element) => ({
    className: element.className,
    cardsClassName: element.children[1]?.className ?? "",
    cardCount: element.querySelectorAll(":scope > div:nth-child(2) > article").length
  }));
  const faqImages = await page.locator("#faq [data-faq-feature-gallery] img").evaluateAll((images) => images.map((image) => ({
    src: image.currentSrc || image.src,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight
  })));
  const report = {
    status: response?.status() ?? null,
    reviewLayout,
    faqImages,
    failedRequests,
    badResponses,
    screenshot: screenshotPath
  };
  console.log(JSON.stringify(report, null, 2));
  assert.equal(report.status, 200, "homepage must return HTTP 200");
  assert.match(reviewLayout.className, /flex flex-col/, "French homepage reviews must use the current stacked review layout");
  assert.match(reviewLayout.cardsClassName, /xl:grid-cols-4/, "French homepage reviews must render four cards per row at desktop width");
  assert.equal(reviewLayout.cardCount, 8, "French homepage reviews must render all eight customer cards");
  assert.equal(faqImages.length, 6, "French homepage FAQ must render six feature images");
  assert.ok(faqImages.every((image) => image.src.includes("/restored/originals/aidreamcapes-eu-no-crop-v1/")), "FAQ feature images must use the no-crop source set");
  assert.ok(faqImages.every((image) => image.naturalWidth > 0 && image.naturalHeight > 0), "FAQ feature images must load");
  assert.ok(faqImages.every((image) => image.naturalHeight / image.naturalWidth >= 1.4), "FAQ feature images must preserve the full portrait source framing");
  assert.equal(failedRequests.length, 0, "homepage must not contain failed resource requests");
  assert.equal(badResponses.length, 0, "homepage must not contain 4xx/5xx responses");
} finally {
  await browser.close();
}
