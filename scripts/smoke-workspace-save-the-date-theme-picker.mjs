#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const storefrontPrefix = /^https:\/\/(?:www\.)?mydreamshoots\.com$/i.test(baseUrl) ? "" : "/site/mydreamshoots";
const storefrontUrl = (path) => `${baseUrl}${storefrontPrefix}${path}`;
const browser = await chromium.launch({ headless: true });

async function saveTheDateMenuSignature(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const trigger = page.locator("header nav").getByRole("button", { name: "Save the Date", exact: true }).first();
  await trigger.waitFor({ state: "visible", timeout: 30_000 });
  await trigger.click();
  const controlId = await trigger.getAttribute("aria-controls");
  const signature = await page.evaluate((id) => {
    const panel = id ? document.getElementById(id) : document.querySelector('[data-storefront-mega-menu-panel][aria-hidden="false"]');
    return [...(panel?.querySelectorAll("a[href]") ?? [])]
      .map((anchor) => anchor.getAttribute("href") || "")
      .filter((href) => href.includes("/ai-save-the-date/"))
      .filter((href) => href !== "/best-save-the-date")
      .sort();
  }, controlId);
  assert.equal(signature.length, 12, `${url} Save the Date menu must contain 12 published topics`);
  await page.keyboard.press("Escape").catch(() => undefined);
  return signature;
}

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
  await page.goto(storefrontUrl("/best-save-the-date"), { waitUntil: "domcontentloaded", timeout: 60_000 });
  const directory = page.locator("[data-save-the-date-directory]");
  assert.equal(await directory.locator("[data-save-the-date-category]").count(), 2, "signed-in Save the Date directory must contain 2 published categories");
  assert.equal(await directory.locator("[data-save-the-date-card]").count(), 12, "signed-in Save the Date directory must contain 12 published themes");
  const publicHeaderSignature = await saveTheDateMenuSignature(page, storefrontUrl("/ai-save-the-date/engagement"));
  const accountHeaderSignature = await saveTheDateMenuSignature(page, storefrontUrl("/account"));
  assert.deepEqual(accountHeaderSignature, publicHeaderSignature, "account and public Save the Date menus must be identical");
  await page.goto(storefrontUrl("/app/create#step-video"), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("button", { name: "Choose a video theme" }).waitFor({ state: "visible", timeout: 30_000 });
  assert.match((await page.locator("header").innerText()).replace(/\s+/g, " "), /Save the Date/, "workspace desktop header is missing Save the Date");
  const workspaceHeaderSignature = await saveTheDateMenuSignature(page, storefrontUrl("/app/create#step-video"));
  assert.deepEqual(workspaceHeaderSignature, publicHeaderSignature, "workspace and public Save the Date menus must be identical");

  await page.getByRole("button", { name: "Choose a video theme" }).click();
  const dialog = page.getByRole("dialog", { name: /Choose a theme and reference case/i });
  await dialog.waitFor({ state: "visible" });
  const dialogBox = await dialog.locator("> div").boundingBox();
  assert.ok(dialogBox && dialogBox.width >= 1300, `theme picker should use the enlarged desktop width: ${dialogBox?.width ?? "missing"}`);
  assert.equal(await dialog.getByRole("textbox", { name: "Search video themes" }).count(), 0, "theme picker search should be removed");
  const saveTheDateButton = dialog.getByRole("button", { name: /Save the Date\s*12/i }).first();
  if ((await saveTheDateButton.getAttribute("aria-expanded")) !== "true") {
    await saveTheDateButton.click();
  }
  await dialog.getByText("Love & Wedding", { exact: true }).waitFor({ state: "visible" });
  await dialog.getByText("Seasonal Holidays", { exact: true }).waitFor({ state: "visible" });
  const seasonalRow = dialog.getByText("Seasonal Holidays", { exact: true }).locator("../..");
  await seasonalRow.getByRole("button").first().click();
  const christmas = dialog.getByRole("button", { name: /^Christmas$/i });
  await christmas.waitFor({ state: "visible" });
  await christmas.click();
  const prompt = await dialog.locator("textarea").inputValue();
  assert.match(prompt, /Subject \/ Character:/);
  assert.match(prompt, /Duration \/ Aspect Ratio \/ Resolution: 15 seconds/i);
  assert.match(prompt, /first-frame reference/i);
  assert.match(await dialog.locator("img").last().getAttribute("src"), /hero-ai-christmas-family-gift\.jpg/);
  await page.screenshot({ path: "/tmp/mydreamshoots-save-the-date-picker-desktop.png", fullPage: true });
  await dialog.getByRole("button", { name: "Cancel" }).click();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(storefrontUrl("/app/create#step-video"), { waitUntil: "domcontentloaded", timeout: 60_000 });
  const mobileMenu = page.locator("details[data-storefront-mobile-menu]");
  await mobileMenu.locator("summary").click();
  await mobileMenu.getByRole("link", { name: "Save the Date" }).waitFor({ state: "visible" });
  assert.ok(await mobileMenu.getByRole("link", { name: "Save the Date" }).isVisible(), "workspace mobile menu is missing Save the Date");
  await page.screenshot({ path: "/tmp/mydreamshoots-save-the-date-picker-mobile.png", fullPage: false });

  console.log(JSON.stringify({ ok: true, apiThemes: apiPayload.themes.length, categories: [root.slug, love.slug, seasonal.slug], directoryThemes: 12, headerTopics: publicHeaderSignature.length, desktopPromptLength: prompt.length, mobileMenu: true }, null, 2));
  await context.close();
} finally {
  await browser.close();
}
