#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.AIDREAMCAPES_BASE_URL || "http://localhost:3002/site/aidreamcapes-eu";
const homepageUrl = baseUrl.replace(/\/$/, "");
const engagementUrl = `${homepageUrl}/ai-image-generation/engagement-photo`;
const detailUrl = `${homepageUrl}/ai-image-generation/wedding-photo`;
const navigationTimeout = Number(process.env.AIDREAMCAPES_SMOKE_TIMEOUT_MS || 60000);
const knownBadSourceFragments = [];

function pathOf(value) {
  try {
    return new URL(value, homepageUrl).pathname;
  } catch {
    return value || "";
  }
}

function assertNaturalRatio(record, label) {
  assert(record.naturalWidth > 0 && record.naturalHeight > 0, `${label}: image did not decode`);
  assert(record.width > 0 && record.height > 0, `${label}: image has no rendered box`);
  // A fixed directory frame uses object-contain: the element box is the
  // layout frame, while the source pixels retain their natural ratio inside it.
  if (record.objectFit === "contain") return;
  const sourceRatio = record.naturalWidth / record.naturalHeight;
  const renderedRatio = record.width / record.height;
  const delta = Math.abs(sourceRatio - renderedRatio) / sourceRatio;
  assert(delta <= 0.02, `${label}: rendered ratio ${renderedRatio} differs from source ${sourceRatio}`);
}

function assertNoKnownBadSource(src, label) {
  const pathname = pathOf(src);
  assert(!knownBadSourceFragments.some((fragment) => pathname.includes(fragment)), `${label}: known cropped source still referenced: ${pathname}`);
}

async function waitForImages(page) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const step = Math.max(480, Math.floor(window.innerHeight * 0.8));
    for (let top = 0; top < document.documentElement.scrollHeight; top += step) {
      window.scrollTo(0, top);
      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(homepageUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
    await waitForImages(page);

    const homepageImages = page.locator('img[src*="/restored/originals/aidreamcapes-eu-no-crop-v1/"], img[src*="/generated/recovered/aidreamcapes-eu-image-pack-4k-"]');
    const homepageSources = [];
    for (let index = 0; index < await homepageImages.count(); index += 1) {
      const image = homepageImages.nth(index);
      if (await image.evaluate((element) => Boolean(element.closest("[data-package-card-media]")))) continue;
      const src = await image.getAttribute("src") || "";
      const pathname = pathOf(src);
      if (!/(engagement-photo|wedding-photo|valentines-photo|christmas-photo|halloween-photo|thanksgiving-photo|avatar|gala-photo)/.test(pathname)) continue;
      const record = await image.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, width: box.width, height: box.height, objectFit: style.objectFit };
      });
      if (record.width === 0 || record.height === 0) continue;
      homepageSources.push(pathname);
      assertNaturalRatio(record, `homepage image ${index}`);
      assert.notEqual(record.objectFit, "cover", `homepage image ${index}: object-fit: cover still crops the source`);
      assertNoKnownBadSource(src, `homepage image ${index}`);
    }
    assert(homepageSources.length >= 2, "homepage: expected themed photo cards were not rendered");

    const directoryMedia = page.locator("[data-package-card-media]");
    for (let index = 0; index < await directoryMedia.count(); index += 1) {
      const frame = directoryMedia.nth(index);
      const record = await frame.evaluate((element) => {
        const box = element.querySelector("div")?.getBoundingClientRect() || element.getBoundingClientRect();
        return { width: box.width, height: box.height };
      });
      if (record.width === 0 || record.height === 0) continue;
      assert(Math.abs(record.width / record.height - 4 / 3) <= 0.02, `directory card ${index}: cover frame must stay 4:3`);
    }

    await page.goto(engagementUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
    await waitForImages(page);
    const engagementGallery = page.locator('[data-aidreamcapes-eu-theme-gallery] img');
    const engagementGalleryCount = await engagementGallery.count();
    assert.equal(engagementGalleryCount, 12, "engagement detail: expected exactly 12 gallery images");
    const engagementGallerySources = [];
    for (let index = 0; index < engagementGalleryCount; index += 1) {
      const image = engagementGallery.nth(index);
      const src = await image.getAttribute("src") || "";
      engagementGallerySources.push(pathOf(src));
      const record = await image.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, width: box.width, height: box.height, objectFit: style.objectFit };
      });
      assertNaturalRatio(record, `engagement gallery image ${index}`);
      assert.equal(record.objectFit, "contain", `engagement gallery image ${index}: natural gallery images must use object-fit: contain`);
      assertNoKnownBadSource(src, `engagement gallery image ${index}`);
    }
    assert.equal(new Set(engagementGallerySources).size, engagementGalleryCount, "engagement detail: gallery slots must use unique source URLs");

    const engagementOpener = engagementGallery.nth(1);
    const engagementSource = pathOf(await engagementOpener.getAttribute("src") || "");
    await engagementOpener.click();
    const engagementModalImage = page.locator('[role="dialog"] img').first();
    await engagementModalImage.waitFor({ state: "visible", timeout: 5000 });
    const engagementModalSrc = pathOf(await engagementModalImage.evaluate((element) => element.currentSrc || element.getAttribute("src") || ""));
    assert.equal(engagementModalSrc, engagementSource, "engagement preview: preview must use the clicked image source URL");
    const engagementModalRecord = await engagementModalImage.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, width: box.width, height: box.height, objectFit: style.objectFit };
    });
    assertNaturalRatio(engagementModalRecord, "engagement detail preview");
    assert.equal(engagementModalRecord.objectFit, "contain", "engagement detail preview: preview must show the complete source");
    await page.keyboard.press("Escape").catch(() => {});

    await page.goto(detailUrl, { waitUntil: "domcontentloaded", timeout: navigationTimeout });
    await waitForImages(page);
    const detailImages = page.locator('img[data-dreamshoot-showcase-preview="image"], img[src*="/wedding-photo/"], img[src*="/restored/originals/aidreamcapes-eu-no-crop-v1/"]');
    assert(await detailImages.count() >= 8, "wedding detail: expected the complete cover/gallery set to be rendered");
    const detailSourceSet = new Set();
    for (let index = 0; index < await detailImages.count(); index += 1) {
      const image = detailImages.nth(index);
      const src = await image.getAttribute("src") || "";
      detailSourceSet.add(pathOf(src));
      const record = await image.evaluate((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, width: box.width, height: box.height, objectFit: style.objectFit };
      });
      assertNaturalRatio(record, `wedding detail image ${index}`);
      assert.notEqual(record.objectFit, "cover", `wedding detail image ${index}: object-fit: cover still crops the source`);
      assertNoKnownBadSource(src, `wedding detail image ${index}`);
    }
    assert.equal(detailSourceSet.size, await detailImages.count(), "wedding detail: duplicate image URLs are visible in the gallery");

    const opener = page.locator('img[data-dreamshoot-showcase-preview="image"]').first();
    await opener.click();
    const modalImage = page.locator('[role="dialog"] img').first();
    await modalImage.waitFor({ state: "visible", timeout: 5000 });
    const modalRecord = await modalImage.evaluate((element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, width: box.width, height: box.height, objectFit: style.objectFit, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
    });
    assertNaturalRatio(modalRecord, "wedding detail preview");
    assert.equal(modalRecord.objectFit, "contain", "wedding detail preview: preview must show the complete source");
    assert(modalRecord.width <= modalRecord.viewportWidth - 32 && modalRecord.height <= modalRecord.viewportHeight - 144, "wedding detail preview exceeds its available viewport");
    console.log(JSON.stringify({ homepageImages: homepageSources.length, engagementGalleryImages: engagementGalleryCount, detailImages: await detailImages.count(), preview: "complete-source-fit" }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
