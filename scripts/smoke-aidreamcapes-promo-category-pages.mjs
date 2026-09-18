import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const base = "http://127.0.0.1:3002/site/aidreamcapes";
const routes = [
  "promo-video", "black-friday-countdown", "limited-drop-alert", "discount-free-shipping", "beauty-routine",
  "supplement-highlight", "fashion-try-on-reel", "food-video", "home-organization", "app-saas-demo", "local-service-ad"
];
const screenshotDir = path.resolve("reports/aidreamcapes-promo-category-browser");

function parseJsonLd(page) {
  return page.locator('script[type="application/ld+json"]').allTextContents().then((blocks) => blocks.map((block) => JSON.parse(block)));
}

function hasJsonLdType(value, type) {
  if (Array.isArray(value)) return value.some((item) => hasJsonLdType(item, type));
  if (!value || typeof value !== "object") return false;
  return value["@type"] === type || Object.values(value).some((item) => hasJsonLdType(item, type));
}

async function assertPage(page, slug, screenshot = false) {
  const requests = [];
  const requestHandler = (request) => requests.push(request.url());
  page.on("request", requestHandler);
  const response = await page.goto(`${base}/ai-video-generation/${slug}`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  assert.equal(response?.status(), 200, `${slug}: HTTP status`);
  const detail = page.locator('[data-aidreamcapes-detail-variant="promo-category-detail"]');
  assert.equal(await detail.count(), 1, `${slug}: detail variant`);
  assert.equal(await page.locator("header").count(), 1, `${slug}: shared header`);
  assert.equal(await page.locator("footer").count(), 1, `${slug}: shared footer`);
  assert.equal(await detail.locator('img[src*="/assets/sites/site_aidreamcapes/promo-category-v1/"]').count(), 9, `${slug}: image count`);
  assert.equal(await page.locator("[data-ads-testing-gallery] article").count(), 7, `${slug}: example card count`);
  assert.equal(await page.locator('[data-ads-testing-section="faq"] details').count(), 5, `${slug}: FAQ count`);
  assert.equal(await page.locator('a[href="#"]').count(), 0, `${slug}: hash-only link`);
  assert.equal(await page.locator("a[aria-disabled='true'], button[disabled]").count(), 0, `${slug}: disabled CTA`);
  const hrefs = await page.locator("a").evaluateAll((items) => items.map((item) => item.href));
  for (const href of hrefs) {
    assert.ok(!/site_(?:mydreamshoots|aidreamshoots|aidreamcapes_eu)/i.test(href), `${slug}: cross-store link ${href}`);
    assert.ok(!/(?:mydreamshoots|aidreamshoots)\.(?:com|eu)/i.test(href), `${slug}: cross-domain link ${href}`);
  }
  assert.equal(requests.some((url) => /\/api\/|_next\/data/i.test(url)), false, `${slug}: browser body API request`);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://www.aidreamcapes.com/ai-video-generation/${slug}`, `${slug}: canonical`);
  assert.ok(await page.locator('meta[name="description"]').getAttribute("content"), `${slug}: description`);
  assert.ok(await page.locator('meta[name="robots"]').getAttribute("content"), `${slug}: robots`);
  const ld = await parseJsonLd(page);
  assert.ok(ld.some((item) => hasJsonLdType(item, "FAQPage")), `${slug}: FAQ JSON-LD`);
  if (screenshot) {
    await mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, `${slug}-1440.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(screenshotDir, `${slug}-390.png`), fullPage: true });
    assert.ok(await page.locator("body").evaluate((node) => node.scrollWidth <= window.innerWidth), `${slug}: mobile overflow`);
    await page.setViewportSize({ width: 1440, height: 900 });
  }
  page.off("request", requestHandler);
}

async function assertGalleryModal(page) {
  await page.goto(`${base}/ai-video-generation/beauty-routine`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const before = page.url();
  await page.locator("[data-ads-testing-gallery] button").first().click();
  await page.locator('[role="dialog"][aria-modal="true"]').waitFor({ state: "visible" });
  assert.equal(page.url(), before, "gallery preview changed route");
  assert.equal(await page.locator('[role="dialog"][aria-modal="true"] img').count(), 1, "gallery modal image");
  await page.locator('[role="dialog"][aria-modal="true"] button[aria-label="Close image preview"]').click();
  assert.equal(await page.locator('[role="dialog"][aria-modal="true"]').count(), 0, "gallery modal did not close");
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const slug of routes) await assertPage(page, slug, ["promo-video", "beauty-routine", "app-saas-demo"].includes(slug));
  await assertGalleryModal(page);
  console.log(JSON.stringify({ ok: true, routes: routes.length, screenshots: screenshotDir }, null, 2));
} finally {
  await browser.close();
}
