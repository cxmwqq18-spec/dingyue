import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const pageErrors = [];
const serverErrors = [];
const requestsAfterToggle = [];
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
});

try {
  const response = await page.goto(`${baseUrl}/site/aidreamcapes`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  assert.equal(response?.status(), 200, "Aidreamcapes homepage should render");
  const pricing = page.locator("#pricing");
  await pricing.waitFor({ state: "visible", timeout: 30_000 });
  await pricing.scrollIntoViewIfNeeded();
  assert.equal(await pricing.locator(".v2-pricing-card").count(), 3, "all three Aidreamcapes subscription tiers should render");
  assert.equal(await pricing.getByText("$24.50", { exact: true }).count(), 1, "Starter monthly price should match the relational price record");
  assert.equal(await pricing.getByText("$35", { exact: true }).count(), 1, "Pro monthly price should match the relational price record");
  assert.equal(await pricing.getByText("$63", { exact: true }).count(), 1, "Premium monthly price should match the relational price record");
  assert.equal(await pricing.getByText("200 credits / month", { exact: true }).count(), 1);
  assert.equal(await pricing.getByText("300 credits / month", { exact: true }).count(), 1);
  assert.equal(await pricing.getByText("600 credits / month", { exact: true }).count(), 1);
  const monthlyCards = pricing.locator(".v2-pricing-card");
  assert.equal(await monthlyCards.nth(0).locator(".v2-pricing-usage").innerText().then((value) => value.includes("~8") && value.includes("~3")), true, "Starter should show both approximate monthly output paths");
  assert.equal(await monthlyCards.nth(1).locator(".v2-pricing-usage").innerText().then((value) => value.includes("~12") && value.includes("~5")), true, "Pro should show both approximate monthly output paths");
  assert.equal(await monthlyCards.nth(2).locator(".v2-pricing-usage").innerText().then((value) => value.includes("~25") && value.includes("~10")), true, "Premium should show both approximate monthly output paths");
  assert.equal(await pricing.getByText("These are alternative estimates from the same credit allowance. Exact costs vary by workflow and settings.", { exact: true }).count(), 1, "shared output estimate note should come from the plan data");
  assert.deepEqual(await monthlyCards.locator("ul").evaluateAll((lists) => lists.map((list) => list.querySelectorAll("li").length)), [7, 6, 6], "each plan should explain its benefits in detail");
  assert.equal(await pricing.locator("button.v2-pricing-cta[disabled]").count(), 3, "unverified draft price rows must remain read-only");
  await page.screenshot({ path: "/tmp/aidreamcapes-home-pricing-desktop.png", fullPage: false });

  page.on("request", (request) => requestsAfterToggle.push(request.url()));
  const yearly = pricing.getByRole("button", { name: "Yearly" });
  await yearly.click();
  await page.waitForFunction(() => document.querySelector(".v2-pricing-content")?.getAttribute("data-active-billing-period") === "year");
  assert.equal(await pricing.getByText("$147", { exact: true }).count(), 1, "Starter yearly amount should match its relational price record");
  assert.equal(await pricing.getByText("$210", { exact: true }).count(), 1, "Pro yearly amount should match its relational price record");
  assert.equal(await pricing.getByText("$378", { exact: true }).count(), 1, "Premium yearly amount should match its relational price record");
  assert.equal(await pricing.getByText("$12.25 / month, billed yearly", { exact: true }).count(), 1);
  assert.equal(await pricing.getByText("2,400 credits / year", { exact: true }).count(), 1);
  assert.equal(await pricing.getByText("Save 50%", { exact: true }).count(), 3);
  const yearlyCards = pricing.locator(".v2-pricing-card");
  assert.equal(await yearlyCards.nth(0).locator(".v2-pricing-usage").innerText().then((value) => value.includes("~96") && value.includes("~36")), true, "Starter should show approximate yearly output totals");
  assert.equal(await yearlyCards.nth(1).locator(".v2-pricing-usage").innerText().then((value) => value.includes("~144") && value.includes("~60")), true, "Pro should show approximate yearly output totals");
  assert.equal(await yearlyCards.nth(2).locator(".v2-pricing-usage").innerText().then((value) => value.includes("~300") && value.includes("~120")), true, "Premium should show approximate yearly output totals");
  assert(!await yearlyCards.nth(1).locator("ul").innerText().then((value) => value.includes("each month")), "Pro yearly details must not describe its yearly difference as monthly credits");
  assert(!await yearlyCards.nth(2).locator("ul").innerText().then((value) => value.includes("monthly credits")), "Premium yearly details must not describe its annual allowance as monthly credits");
  assert.equal(await page.locator("button.v2-pricing-cta[disabled]").count(), 3);
  assert(!requestsAfterToggle.some((url) => new URL(url).pathname.startsWith("/api/")), "billing toggle must not call a browser API");
  assert(!requestsAfterToggle.some((url) => new URL(url).pathname === "/site/aidreamcapes"), "billing toggle must not reload the storefront");

  await page.setViewportSize({ width: 390, height: 844 });
  await pricing.scrollIntoViewIfNeeded();
  const mobileLayout = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    pricingWidth: document.querySelector("#pricing")?.scrollWidth,
    pricingClientWidth: document.querySelector("#pricing")?.clientWidth
  }));
  assert(mobileLayout.documentWidth <= mobileLayout.viewportWidth, `mobile page has horizontal overflow: ${JSON.stringify(mobileLayout)}`);
  assert((mobileLayout.pricingWidth ?? 0) <= (mobileLayout.pricingClientWidth ?? 0) + 1, `pricing section has horizontal overflow: ${JSON.stringify(mobileLayout)}`);
  await pricing.screenshot({ path: "/tmp/aidreamcapes-home-pricing-mobile.png" });

  const noJsPage = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const noJsResponse = await noJsPage.goto(`${baseUrl}/site/aidreamcapes`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  assert.equal(noJsResponse?.status(), 200, "Aidreamcapes homepage should render without JavaScript");
  const noJsPricing = noJsPage.locator("#pricing");
  assert.equal(await noJsPricing.getByText("$24.50", { exact: true }).count(), 1, "monthly pricing content should be server-rendered");
  assert.equal(await noJsPricing.getByText("200 credits / month", { exact: true }).count(), 1, "monthly allowance should be server-rendered");
  assert.equal(await noJsPricing.locator(".v2-pricing-usage").first().getByText("~8", { exact: true }).count(), 1, "monthly output estimate should be server-rendered");
  await noJsPage.close();

  assert.deepEqual(pageErrors, [], `browser page errors: ${pageErrors.join(" | ")}`);
  assert.deepEqual(serverErrors, [], `HTTP 5xx responses: ${serverErrors.join(" | ")}`);
  console.log(JSON.stringify({
    ok: true,
    status: response.status(),
    monthlyAndYearlyPlans: true,
    checkoutReadOnly: true,
    requestsAfterToggle,
    mobileLayout,
    noJavaScriptRender: true,
    pageErrors,
    serverErrors,
    screenshots: ["/tmp/aidreamcapes-home-pricing-desktop.png", "/tmp/aidreamcapes-home-pricing-mobile.png"]
  }, null, 2));
} finally {
  await browser.close();
}
