#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const login = await context.request.post(`${baseUrl}/api/sites/site_dreamshoot/auth/login`, {
    data: {
      email: process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_EMAIL || "nora@mydreamshoots.localhost",
      password: process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_PASSWORD || "nora123"
    },
    failOnStatusCode: false
  });
  assert.equal(login.status(), 200, `customer login failed: ${login.status()} ${await login.text()}`);

  const api = await context.request.get(`${baseUrl}/api/sites/site_dreamshoot/video-themes?includeCategories=1&pageSize=5000&q=Save%20the%20Date`);
  const apiPayload = await api.json();
  assert.equal(api.status(), 200, "video theme search API failed");
  assert.equal(apiPayload.themes?.length, 12, "Save the Date search must return 12 leaf themes");
  const categories = apiPayload.categories ?? [];
  const root = categories.find((category) => category.slug === "save-the-date");
  const love = categories.find((category) => category.slug === "love-wedding");
  const seasonal = categories.find((category) => category.slug === "seasonal-holidays");
  assert.ok(root && love?.parentId === root.id && seasonal?.parentId === root.id, "Save the Date category hierarchy is invalid");

  const page = await context.newPage();
  await page.goto(`${baseUrl}/site/mydreamshoots/app/create#step-video`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Choose a video theme" }).waitFor({ state: "visible", timeout: 30_000 });
  assert.match((await page.locator("header").innerText()).replace(/\s+/g, " "), /Save the Date/, "workspace desktop header is missing Save the Date");

  await page.getByRole("button", { name: "Choose a video theme" }).click();
  const dialog = page.getByRole("dialog", { name: /Choose a theme and reference case/i });
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: /Save the Date\s+12/i }).click();
  await dialog.getByText("Love & Wedding", { exact: true }).waitFor({ state: "visible" });
  await dialog.getByText("Seasonal Holidays", { exact: true }).waitFor({ state: "visible" });

  const search = dialog.getByRole("textbox", { name: "Search video themes" });
  await search.fill("Christmas");
  const christmas = dialog.getByRole("button", { name: /^Christmas/i });
  await christmas.waitFor({ state: "visible" });
  await christmas.click();
  const prompt = await dialog.locator("textarea").inputValue();
  assert.match(prompt, /Subject \/ Character:/);
  assert.match(prompt, /Duration \/ Aspect Ratio \/ Resolution: 15 seconds/i);
  assert.match(prompt, /first-frame reference/i);
  assert.match(await dialog.locator("img").last().getAttribute("src"), /hero-ai-christmas-family-gift\.jpg/);
  await page.screenshot({ path: "/tmp/mydreamshoots-save-the-date-picker-desktop.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/site/mydreamshoots/app/create#step-video`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const mobileMenu = page.locator("details[data-storefront-mobile-menu]");
  await mobileMenu.locator("summary").click();
  await mobileMenu.getByRole("link", { name: "Save the Date" }).waitFor({ state: "visible" });
  assert.ok(await mobileMenu.getByRole("link", { name: "Save the Date" }).isVisible(), "workspace mobile menu is missing Save the Date");
  await page.screenshot({ path: "/tmp/mydreamshoots-save-the-date-picker-mobile.png", fullPage: false });

  console.log(JSON.stringify({ ok: true, apiThemes: apiPayload.themes.length, categories: [root.slug, love.slug, seasonal.slug], desktopPromptLength: prompt.length, mobileMenu: true }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
