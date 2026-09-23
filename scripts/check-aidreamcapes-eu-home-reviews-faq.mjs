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

try {
  const response = await page.goto(baseUrl, { waitUntil: "commit", timeout: 120_000 });
  await page.waitForLoadState("networkidle", { timeout: 120_000 });
  await page.locator("img").evaluateAll(async (images) => {
    const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    for (const image of images) {
      image.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(40);
    }
  });
  await page.waitForTimeout(1_200);
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
