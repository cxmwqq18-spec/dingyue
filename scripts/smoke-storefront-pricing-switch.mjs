import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const browserErrors = [];
const requestsAfterClick = [];
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});
page.on("pageerror", (error) => browserErrors.push(error.message));

try {
  const response = await page.goto(`${baseUrl}/site/mydreamshoots?billing=month#pricing-month`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000
  });
  assert.equal(response?.status(), 200, "pricing page must render successfully");
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);

  const quarterlyTab = page.locator('nav[aria-label="Billing periods"] a[data-storefront-instant-filter="true"][href*="billing=quarter"]').first();
  await quarterlyTab.waitFor({ state: "visible", timeout: 30_000 });
  requestsAfterClick.length = 0;
  page.on("request", (request) => requestsAfterClick.push(request.url()));

  await page.evaluate(() => window.scrollTo(0, 640));
  const scrollBeforeClick = await page.evaluate(() => window.scrollY);
  await quarterlyTab.click();
  await page.waitForTimeout(250);

  assert.match(page.url(), /[?&]billing=quarter(?:#|$)/, "billing switch must update the URL");
  assert.match(page.url(), /#pricing-quarter$/, "billing switch must preserve the pricing anchor");
  assert(
    !requestsAfterClick.some((url) => /[?&]billing=quarter(?:#|$)/.test(url)),
    `billing switch must not navigate to a new document: ${requestsAfterClick.join(" | ")}`
  );
  assert(
    !requestsAfterClick.some((url) => /\/api\//.test(url)),
    `billing switch must not fetch pricing from a browser API: ${requestsAfterClick.join(" | ")}`
  );
  assert.equal(await page.locator('[data-active-billing-cycle="quarter"]').count(), 1, "quarterly pricing must be rendered in place");
  assert(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBeforeClick) <= 2, "billing switch must preserve scroll position");
  assert.equal(await page.locator('[aria-label="Loading page"]').count(), 0, "billing switch must not show the page loading indicator");
  assert(
    !browserErrors.some((message) => /hydration|didn.t match|Cannot access .* before initialization/i.test(message)),
    `browser reported a hydration/runtime error: ${browserErrors.join(" | ")}`
  );

  console.log(JSON.stringify({
    ok: true,
    status: response.status(),
    url: page.url(),
    documentNavigation: true,
    requestsAfterClick,
    loadingIndicatorVisible: false,
    browserErrors
  }, null, 2));
} finally {
  await browser.close();
}
