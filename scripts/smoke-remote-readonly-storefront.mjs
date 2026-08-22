#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002";
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const response = await page.goto(`${baseUrl}/site/mydreamshoots`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  assert.equal(response?.status(), 200, "remote-readonly storefront must render the MyDreamShoots homepage");
  await page.waitForSelector("#packages[data-dreamshoot-catalog-count]", { timeout: 30_000 });
  const result = await page.evaluate(() => ({
    catalogCount: Number(document.querySelector("#packages")?.getAttribute("data-dreamshoot-catalog-count") || 0),
    h1: document.querySelector("h1")?.textContent?.trim() || "",
    hasOnlineContentMarker: /Soccer|Gala Photo|Headshot/.test(document.body.textContent || "")
  }));
  assert(result.catalogCount >= 12, `expected the remote catalog, received ${result.catalogCount}`);
  assert(result.hasOnlineContentMarker, "expected online catalog content markers");
  console.log(JSON.stringify({ ok: true, status: response.status(), ...result }, null, 2));
} finally {
  await browser.close();
}
