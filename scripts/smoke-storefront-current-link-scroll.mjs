#!/usr/bin/env node
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteSlug = process.env.SMOKE_SITE_SLUG || "mydreamshoots";
const homePath = `/site/${siteSlug}`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForSettledPage(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => undefined);
}

async function smokeCurrentLinkScroll() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      baseURL: baseUrl,
      viewport: { width: 2048, height: 1244 }
    });

    await page.goto(homePath, { waitUntil: "domcontentloaded", timeout: 20000 });
    await waitForSettledPage(page);
    await page.locator(`a[href="${homePath}"]`).first().waitFor({ state: "attached", timeout: 10000 });

    await page.evaluate(() => window.scrollTo(0, 2600));
    await page.waitForTimeout(200);
    const beforeCurrentClick = await page.evaluate(() => Math.round(window.scrollY));
    assert(beforeCurrentClick > 2000, `home page did not scroll before same-page link check: ${beforeCurrentClick}`);

    await page.evaluate((href) => document.querySelector(`a[href="${href}"]`)?.click(), homePath);
    await page.waitForTimeout(700);
    const afterCurrentClick = await page.evaluate(() => ({
      pathname: window.location.pathname,
      scrollY: Math.round(window.scrollY)
    }));
    assert(afterCurrentClick.pathname === homePath, `same-page link changed path to ${afterCurrentClick.pathname}`);
    assert(
      afterCurrentClick.scrollY >= beforeCurrentClick - 80,
      `same-page link reset scroll from ${beforeCurrentClick} to ${afterCurrentClick.scrollY}`
    );

    await page.evaluate((href) => document.querySelector(`a[href="${href}/pricing"]`)?.click(), homePath);
    await page.waitForFunction((expectedPath) => window.location.pathname === expectedPath, `${homePath}/pricing`, { timeout: 20000 });
    console.log(`✓ current storefront links preserve scroll, while normal navigation still works for ${homePath}`);
  } finally {
    await browser.close();
  }
}

smokeCurrentLinkScroll().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
