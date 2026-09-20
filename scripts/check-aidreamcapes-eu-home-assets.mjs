#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.argv.find((value) => value.startsWith("--url="))?.slice("--url=".length)
  ?? "http://localhost:3002/site/aidreamcapes-eu";
const screenshotPath = process.argv.find((value) => value.startsWith("--screenshot="))?.slice("--screenshot=".length)
  ?? "/tmp/aidreamcapes-eu-home-assets.png";

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
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const images = await page.locator("img").evaluateAll((elements) => elements.map((image) => ({
    src: image.currentSrc || image.src,
    alt: image.alt,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight
  })));
  const generationShowcase = await page.locator('#xfcart-section-generation_showcase_1 [data-dreamshoot-homepage-showcase-kind="photo"] [data-showcase-card-kind="image"] img').evaluateAll((elements) => elements.map((image) => image.currentSrc || image.src));
  const pageText = await page.locator("body").innerText();
  const brokenImages = images.filter((image) => image.complete && (image.naturalWidth === 0 || image.naturalHeight === 0));
  const report = {
    status: response?.status() ?? null,
    url: page.url(),
    imageCount: images.length,
    generationShowcaseImageCount: generationShowcase.length,
    generationShowcaseImages: generationShowcase,
    brokenImages,
    failedRequests,
    badResponses,
    screenshot: screenshotPath
  };
  console.log(JSON.stringify(report, null, 2));
  assert.equal(report.status, 200, "homepage must return HTTP 200");
  assert.match(pageText, /Générateurs photo IA à découvrir/i, "homepage must use the current French showcase copy");
  assert.doesNotMatch(pageText, /Générateurs de photos IA à la une/i, "homepage must not use the retired showcase copy");
  assert.equal(generationShowcase.length, 8, "homepage must render eight current photo showcase cards");
  assert.equal(generationShowcase.filter((src) => src.includes("fan-holiday-theme/categories/")).length, 0, "homepage must not use retired fan-holiday category assets");
  assert.equal(brokenImages.length, 0, "homepage must not contain broken images");
  assert.equal(failedRequests.length, 0, "homepage must not contain failed resource requests");
  assert.equal(badResponses.length, 0, "homepage must not contain 4xx/5xx responses");
} finally {
  await browser.close();
}
