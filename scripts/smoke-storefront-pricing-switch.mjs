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

  const quarterlyTab = page.locator('nav[aria-label="Billing periods"] button[data-storefront-instant-filter="true"]').filter({ hasText: "Quarterly" }).first();
  await quarterlyTab.waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await page.getByText("$24.50", { exact: true }).count(), 1, "monthly Starter price must be rendered");
  assert.equal(await page.getByText("200 monthly credits balance", { exact: true }).count(), 1, "monthly credit allowance must be rendered");
  assert.equal(await page.getByText("AI photo editor with prompts", { exact: true }).count(), 3, "all pricing cards must retain their feature lists");
  assert.equal(await page.getByText("No watermark", { exact: true }).count(), 3, "all pricing cards must retain the final feature");
  requestsAfterClick.length = 0;
  page.on("request", (request) => requestsAfterClick.push(request.url()));

  await page.evaluate(() => window.scrollTo(0, 640));
  const scrollBeforeClick = await page.evaluate(() => window.scrollY);
  // Trigger the real click handler without Playwright scrolling the off-screen tab into view first.
  await quarterlyTab.evaluate((button) => button.click());
  await page.waitForTimeout(250);

  assert.match(page.url(), /[?&]billing=quarter(?:#|$)/, "billing switch must update the URL");
  assert(!page.url().includes("#pricing-quarter"), "billing switch must not add a scrolling pricing anchor");
  assert(
    !requestsAfterClick.some((url) => /[?&]billing=quarter(?:#|$)/.test(url)),
    `billing switch must not navigate to a new document: ${requestsAfterClick.join(" | ")}`
  );
  assert(
    !requestsAfterClick.some((url) => /\/api\//.test(url)),
    `billing switch must not fetch pricing from a browser API: ${requestsAfterClick.join(" | ")}`
  );
  assert(
    !requestsAfterClick.some((url) => new URL(url).pathname === "/site/mydreamshoots"),
    `billing switch must not request the storefront document: ${requestsAfterClick.join(" | ")}`
  );
  assert.equal(await page.locator('[data-active-billing-cycle="quarter"]').count(), 1, "quarterly pricing must be rendered in place");
  assert.equal(await page.getByText("$45", { exact: true }).count(), 1, "quarterly Starter price must be rendered");
  assert.equal(await page.getByText("600 quarterly credits balance", { exact: true }).count(), 1, "quarterly credit allowance must be rendered");
  assert.equal(await page.getByText("AI photo editor with prompts", { exact: true }).count(), 3, "quarterly cards must retain their feature lists");
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
    documentNavigation: false,
    requestsAfterClick,
    loadingIndicatorVisible: false,
    browserErrors
  }, null, 2));
} finally {
  await browser.close();
}
