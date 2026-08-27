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

  await quarterlyTab.click();
  await page.waitForFunction(() => document.querySelector('[data-active-billing-cycle="quarter"]') !== null, null, { timeout: 10_000 });
  await page.waitForTimeout(500);

  assert.match(page.url(), /[?&]billing=quarter(?:#|$)/, "billing switch must update the URL without navigation");
  assert.match(page.url(), /#pricing-quarter$/, "billing switch must preserve the pricing anchor");
  assert.equal(requestsAfterClick.length, 0, `billing switch unexpectedly triggered requests: ${requestsAfterClick.join(" | ")}`);
  assert.equal(await page.locator('[aria-label="Loading page"]').count(), 0, "billing switch must not show the page loading indicator");
  assert(
    !browserErrors.some((message) => /hydration|didn.t match|Cannot access .* before initialization/i.test(message)),
    `browser reported a hydration/runtime error: ${browserErrors.join(" | ")}`
  );

  console.log(JSON.stringify({
    ok: true,
    status: response.status(),
    url: page.url(),
    requestsAfterClick,
    loadingIndicatorVisible: false,
    browserErrors
  }, null, 2));
} finally {
  await browser.close();
}
