#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium, request } from "playwright";

const BASE_URL = "http://127.0.0.1:3002";
const SITE_HEADERS = {
  "x-forwarded-host": "aidreamcapes.com",
  "x-forwarded-proto": "https"
};

async function assertSeo(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "networkidle" });
  assert((await page.title()).trim(), `${path}: title missing`);
  assert.equal(await page.locator('link[rel="canonical"]').count(), 1, `${path}: canonical count`);
  assert.equal(await page.locator('meta[property="og:type"]').count(), 1, `${path}: og:type missing`);
  assert.equal(await page.locator('meta[property="og:image:alt"]').count(), 1, `${path}: og:image:alt missing`);
  assert.equal(await page.locator("h1").count(), 1, `${path}: H1 count`);
  assert(!/MyDreamShoots/i.test(await page.locator("body").innerText()), `${path}: brand residual`);
  assert.equal(await page.locator('script[type="application/ld+json"]').count(), 1, "JSON-LD must be emitted once");
  assert(!/MyDreamShoots/i.test(await page.content()), "brand residual in HTML");
  if (path === "/") {
    const headings = await page.locator("h1,h2,h3,h4,h5,h6").evaluateAll((elements) => elements.map((element) => Number(element.tagName.slice(1))));
    for (let index = 1; index < headings.length; index += 1) {
      assert(headings[index] <= headings[index - 1] + 1, `${path}: heading level jumps from H${headings[index - 1]} to H${headings[index]}`);
    }
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ extraHTTPHeaders: SITE_HEADERS });
const page = await context.newPage();

for (const path of ["/", "/about-us", "/ai-image-generation/professional-headshot", "/ai-video-generation/talking-photo", "/workflow"]) {
  await assertSeo(page, path);
}

await assertSeo(page, "/blog/ai-product-photography-guide");
assert((await page.locator('script[type="application/ld+json"]').allTextContents()).some((value) => /BlogPosting/.test(value)), "blog article: BlogPosting JSON-LD missing");
for (const href of ["/ai-image-generation/ecommerce-main-image", "/ai-image-generation/lifestyle-scene", "/ai-image-generation/packaging-mockup"]) {
  assert(await page.locator(`a[href="${href}"]`).count() >= 1, `blog article: related link missing ${href}`);
}

await page.goto(`${BASE_URL}/ai-video-generation/talking-photo`, { waitUntil: "networkidle" });
if (await page.locator("video").count() > 0) {
  const talkingPhoto = page.locator("video").first();
  assert(await talkingPhoto.getAttribute("poster"), "talking-photo: poster missing");
  assert(await talkingPhoto.getAttribute("width"), "talking-photo: width missing");
  assert(await talkingPhoto.getAttribute("height"), "talking-photo: height missing");
  assert((await talkingPhoto.locator("source").first().getAttribute("src"))?.match(/\.(?:mp4|webm)(?:[?#]|$)/i), "talking-photo: non-video source");
  assert.equal(await talkingPhoto.locator("source").first().getAttribute("type"), "video/mp4", "talking-photo: MIME missing");
} else {
  const talkingPhotoImage = page.locator('img[alt*="talking photo" i]').first();
  assert.equal(await talkingPhotoImage.count(), 1, "talking-photo: image fallback missing");
  assert(await talkingPhotoImage.getAttribute("alt"), "talking-photo: image fallback alt missing");
  assert(await talkingPhotoImage.getAttribute("width"), "talking-photo: image fallback width missing");
  assert(await talkingPhotoImage.getAttribute("height"), "talking-photo: image fallback height missing");
}

await page.goto(`${BASE_URL}/workflow`, { waitUntil: "networkidle" });
const workflowVideos = page.locator("video");
assert.equal(await workflowVideos.count() >= 2, true, "workflow: expected two videos");
for (let index = 0; index < await workflowVideos.count(); index += 1) {
  assert(await workflowVideos.nth(index).getAttribute("poster"), `workflow video ${index}: poster missing`);
  assert(await workflowVideos.nth(index).getAttribute("width"), `workflow video ${index}: width missing`);
  assert(await workflowVideos.nth(index).getAttribute("height"), `workflow video ${index}: height missing`);
  assert.equal(await workflowVideos.nth(index).locator("source").first().getAttribute("type"), "video/mp4", `workflow video ${index}: MIME missing`);
}

const goneRequest = await request.newContext({ extraHTTPHeaders: SITE_HEADERS });
const gone = await goneRequest.get(`${BASE_URL}/ai-image-generation/unblur-image`, { maxRedirects: 0 });
assert.equal(gone.status(), 410, `410 route returned ${gone.status()}`);

const wwwRequest = await request.newContext({ extraHTTPHeaders: { "x-forwarded-host": "www.aidreamcapes.com", "x-forwarded-proto": "https" } });
const www = await wwwRequest.get(`${BASE_URL}/ai-video-generation/talking-photo`, { maxRedirects: 0 });
assert.equal(www.status(), 301, `www route returned ${www.status()}`);
assert.equal(www.headers().location, "https://aidreamcapes.com/ai-video-generation/talking-photo", "www redirect target");

const httpRequest = await request.newContext({ extraHTTPHeaders: { "x-forwarded-host": "aidreamcapes.com", "x-forwarded-proto": "http" } });
const http = await httpRequest.get(`${BASE_URL}/ai-video-generation/talking-photo?utm_source=smoke`, { maxRedirects: 0 });
assert.equal(http.status(), 301, `HTTP route returned ${http.status()}`);
assert.equal(http.headers().location, "https://aidreamcapes.com/ai-video-generation/talking-photo?utm_source=smoke", "HTTP redirect target");

const staticPath = "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?utm_source=smoke";
const staticRequest = await wwwRequest.get(`${BASE_URL}${staticPath}`, { maxRedirects: 0 });
assert.equal(staticRequest.status(), 301, `www static route returned ${staticRequest.status()}`);
assert.equal(staticRequest.headers().location, `https://aidreamcapes.com${staticPath}`, "www static redirect target");

console.log(JSON.stringify({ ok: true, browser: "chromium", pages: 6, gone: 1, redirects: 3 }));
await httpRequest.dispose();
await wwwRequest.dispose();
await goneRequest.dispose();
await context.close();
await browser.close();
