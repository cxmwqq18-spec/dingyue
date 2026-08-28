import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const browserErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") browserErrors.push(message.text());
});
page.on("pageerror", (error) => browserErrors.push(error.message));

try {
  const response = await page.goto(`${baseUrl}/site/mydreamshoots`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000
  });
  assert.equal(response?.status(), 200, "MyDreamShoots homepage must render successfully");
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);

  const trigger = page.locator('nav button[aria-haspopup="dialog"]').filter({ hasText: /AI Video Generation|AI Image Generation|Save the Date/i }).first();
  await trigger.waitFor({ state: "visible", timeout: 30_000 });
  assert.equal(await trigger.evaluate((node) => node.parentElement?.getAttribute("data-native-mega-menu")), "true", "mega menu trigger must remain inside the storefront menu container");
  await trigger.click();
  const panel = page.locator('[data-storefront-mega-menu-panel][aria-hidden="false"]').first();
  await panel.waitFor({ state: "visible", timeout: 10_000 });

  const panelText = await panel.innerText();
  assert.match(panelText, /5 CATEGORIES · 22 THEMES/i, "video mega menu must expose all published themes");
  for (const theme of ["Explainer Video", "How-to Video", "Talking Head Video"]) {
    assert.match(panelText, new RegExp(theme.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${theme} must be visible in the video mega menu`);
  }

  await page.mouse.click(40, 520);
  await page.waitForFunction(() => !document.querySelector('[data-storefront-mega-menu-panel][aria-hidden="false"]'));

  assert(
    !browserErrors.some((message) => /hydration|didn.t match|Cannot access .* before initialization/i.test(message)),
    `browser reported a hydration/runtime error: ${browserErrors.join(" | ")}`
  );
  console.log(JSON.stringify({ ok: true, status: response.status(), outsideClickClosed: true, browserErrors }, null, 2));
} finally {
  await browser.close();
}
