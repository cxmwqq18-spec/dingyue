import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteId = process.env.SMOKE_SITE_ID || "site_dreamshoot";
const email = process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_EMAIL || process.env.SMOKE_CUSTOMER_EMAIL || "nora@mydreamshoots.localhost";
const password = process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_PASSWORD || process.env.SMOKE_CUSTOMER_PASSWORD || "nora123";
const homeLinkName = process.env.SMOKE_HOME_LINK_NAME || /myDreamshoots home/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1536, height: 960 } });
    try {
      const login = await context.request.post(`${baseUrl}/api/sites/${siteId}/auth/login`, {
        data: { email, password },
        failOnStatusCode: false
      });
      const loginPayload = await login.json().catch(() => ({}));
      assert(login.ok() && loginPayload.ok, `customer login failed: ${login.status()} ${loginPayload.error || "unknown"}`);

      const page = await context.newPage();
      await page.goto(`${baseUrl}/?logout_smoke=${Date.now()}`, { waitUntil: "networkidle", timeout: 60_000 });
      await page.getByRole("button", { name: /^Sign out$/ }).waitFor({ state: "visible", timeout: 20_000 });
      await page.getByRole("button", { name: /^Sign out$/ }).click();
      await page.waitForURL((url) => url.pathname === "/login", { timeout: 30_000 });

      const customerCookies = (await context.cookies(baseUrl)).filter((cookie) => cookie.name.startsWith("customer_session_") || cookie.name.startsWith("customer_csrf_"));
      assert(!customerCookies.length, "customer session cookies remained after logout");

      await page.getByRole("link", { name: homeLinkName }).click();
      await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
      const headerText = await page.locator("header").innerText();
      assert(!/Sign out/.test(headerText), "signed-in customer controls returned after logout and home navigation");
      console.log("PASS: logout clears the session and the home header remains signed out");
    } finally {
      await context.request.post(`${baseUrl}/api/sites/${siteId}/auth/logout`, { failOnStatusCode: false }).catch(() => undefined);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
