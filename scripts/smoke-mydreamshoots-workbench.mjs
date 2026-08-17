import fs from "fs";
import { chromium, request } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL ?? "http://localhost:3002").replace(/\/$/, "");
const siteId = process.env.SMOKE_SITE_ID ?? "site_dreamshoot";
const siteSlug = process.env.SMOKE_SITE_SLUG ?? "mydreamshoots";
const adminEmail = process.env.SMOKE_SITE_ADMIN_EMAIL ?? "owner@mydreamshoots.localhost";
const adminPassword = process.env.SMOKE_SITE_ADMIN_PASSWORD ?? "mydreamshoots123";
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const browserOptions = fs.existsSync(chromePath) ? { headless: true, executablePath: chromePath } : { headless: true };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const api = await request.newContext({ baseURL: baseUrl });
  try {
    const loginResponse = await api.post(`/api/sites/${siteId}/admin/auth/login`, {
      data: { email: adminEmail, password: adminPassword }
    });
    const loginJson = await loginResponse.json().catch(() => ({}));
    assert(loginResponse.ok() && loginJson.ok, `site admin login failed: ${loginResponse.status()} ${JSON.stringify(loginJson)}`);

    const browser = await chromium.launch(browserOptions);
    try {
      const context = await browser.newContext({
        storageState: await api.storageState(),
        viewport: { width: 1600, height: 1200 }
      });
      try {
        const page = await context.newPage();
        const pageErrors = [];
        const consoleErrors = [];

        page.on("pageerror", (error) => pageErrors.push(String(error?.stack ?? error)));
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });

        await page.goto(`${baseUrl}/site/${siteSlug}/admin/design/workbench`, { waitUntil: "domcontentloaded" });
        try {
          await page.waitForLoadState("networkidle", { timeout: 20000 });
        } catch (error) {
          pageErrors.push(`WAIT:${error instanceof Error ? error.message : String(error)}`);
        }

        const bodyText = await page.locator("body").innerText();
        assert(pageErrors.length === 0, `workbench emitted a page error:\n${pageErrors.join("\n")}`);
        assert(consoleErrors.length === 0, `workbench logged a console error:\n${consoleErrors.join("\n")}`);
        assert(bodyText.includes("文案定位器"), "workbench did not render the copy locator panel");
        assert(bodyText.includes("全局页头/页脚"), "workbench did not render the global header/footer tab");
        assert(
          bodyText.includes("此页主体没有页面模块") || bodyText.includes("当前页面没有主体模块"),
          "workbench did not render the empty-page guidance"
        );

        console.log(`✓ ${siteSlug} workbench loads without client errors`);
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    await api.dispose();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
