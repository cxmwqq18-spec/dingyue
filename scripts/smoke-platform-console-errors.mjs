import { chromium } from "playwright";

const origin = process.env.PLATFORM_ORIGIN || "http://127.0.0.1:3002";
const browser = await chromium.launch({ headless: true });
const failures = [];

try {
  for (const path of ["/", "/platform"]) {
    const page = await browser.newPage();
    let currentRoute = path;
    page.on("console", (message) => {
      if (message.type() === "error") {
        failures.push(`${currentRoute} console: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      failures.push(`${currentRoute} pageerror: ${error.message}`);
    });

    await page.goto(`${origin}${path}`, { waitUntil: "networkidle" });
    if (path === "/platform" && new URL(page.url()).pathname === "/platform/login") {
      await page.locator('input[type="email"]').fill("platform@local.test");
      await page.locator('input[type="password"]').fill("platform123");
      await page.getByRole("button", { name: "进入平台后台" }).click();
      await page.waitForURL((url) => url.pathname === "/platform");
      await page.waitForLoadState("networkidle").catch(() => undefined);
    }

    const routes = path === "/platform"
      ? [
          "/platform",
          "/platform?module=sites",
          "/platform?module=billing",
          "/platform?module=gateway",
          "/platform?module=email",
          "/platform?module=cloudflare",
          "/platform?module=audit",
        ]
      : [path];

    for (const route of routes) {
      currentRoute = route;
      if (route !== path) {
        await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
      }
      await page.waitForTimeout(300);

      const bodyText = await page.locator("body").innerText();
      const portalText = await page.locator("nextjs-portal").evaluateAll((portals) =>
        portals.map((portal) => portal.shadowRoot?.textContent ?? "").join("\n"),
      );
      const renderedText = `${bodyText}\n${portalText}`;
      if (/ThemePublication.*does not exist|PrismaClientKnownRequestError/s.test(renderedText)) {
        failures.push(`${route} rendered the ThemePublication database error`);
      }
    }
    await page.close();
  }

  if (failures.length > 0) {
    throw new Error(
      `Platform page emitted ${failures.length} browser error(s):\n${failures
        .map((failure, index) => `${index + 1}. ${failure}`)
        .join("\n")}`,
    );
  }

  console.log("PASS: / and all /platform modules emitted no browser console or page errors");
} finally {
  await browser.close();
}
