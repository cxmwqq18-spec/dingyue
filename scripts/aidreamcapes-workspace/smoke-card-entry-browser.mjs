#!/usr/bin/env node
// Browser regression for the public-card handoff. This is deliberately small:
// it clicks one actor card and one image case card, then checks that the
// workspace received the identity and that the URL stayed canonical.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = String(process.env.AIDREAMCAPES_CARD_BROWSER_ORIGIN || process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3013").replace(/\/$/, "");
const mediaOrigin = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_MEDIA_ORIGIN || "https://www.aivideosugc.com").replace(/\/$/, "");
const headers = { "x-forwarded-host": new URL(mediaOrigin).host, "x-forwarded-proto": "https" };
const checks = [];
const browser = await chromium.launch({ headless: true });

async function newPage(context) {
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error("pageerror:", error.message.slice(0, 500)));
  await page.route("**/*", async (route) => {
    const type = route.request().resourceType();
    if (["image", "font", "media"].includes(type)) return route.abort();
    return route.continue();
  });
  return page;
}

async function hydrated(page) {
  await page.waitForLoadState("domcontentloaded");
  // WorkspaceEntryBehavior is attached in useEffect. Wait for its marker so
  // the test measures the real browser path, not a pre-hydration navigation.
  await page.waitForFunction(() => document.documentElement.dataset.workspaceEntryReady === "true", undefined, { timeout: 60_000 });
}

try {
  const context = await browser.newContext({ extraHTTPHeaders: headers });

  const actorPage = await newPage(context);
  await actorPage.goto(`${origin}/ai-actors`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await hydrated(actorPage);
  const actorLink = actorPage.locator('a[href="/app/create/ai-actors"][data-workspace-entry]').first();
  await actorLink.waitFor({ state: "visible", timeout: 60_000 });
  const actorEntry = JSON.parse(await actorLink.getAttribute("data-workspace-entry"));
  const actorName = (await actorLink.evaluate((node) => node.closest("article")?.querySelector("h3")?.textContent?.trim() || "")).trim();
  assert.equal(actorEntry.view, "actors", "actor entry view");
  assert.match(actorEntry.query.actor, /^[a-z0-9][a-z0-9-]{0,80}$/i, "actor entry id");
  await Promise.all([
    actorPage.waitForURL("**/app/create/ai-actors", { timeout: 120_000 }),
    actorLink.click(),
  ]);
  assert.equal(new URL(actorPage.url()).search, "", "actor URL must stay canonical");
  await actorPage.getByText("Presenter selected", { exact: false }).first().waitFor({ timeout: 60_000 });
  assert.ok((await actorPage.locator("body").innerText()).includes(actorName), `workspace must show selected actor ${actorName}`);
  checks.push(`/ai-actors: ${actorName} (${actorEntry.query.actor}) selected without query`);
  await actorPage.close();

  const imagePage = await newPage(context);
  await imagePage.goto(`${origin}/ai-image-generation`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await hydrated(imagePage);
  const imageLink = imagePage.locator('a.use[data-workspace-entry*="prompt"]').first();
  await imageLink.waitFor({ state: "visible", timeout: 60_000 });
  const imageEntry = JSON.parse(await imageLink.getAttribute("data-workspace-entry"));
  const expectedPrompt = String(imageEntry.query.prompt || "");
  assert.ok(expectedPrompt.length > 20, "image card prompt");
  assert.equal(imageEntry.view, "images", "image entry view");
  await Promise.all([
    imagePage.waitForURL("**/app/create/ai-image-generation", { timeout: 120_000 }),
    imageLink.click(),
  ]);
  assert.equal(new URL(imagePage.url()).search, "", "image URL must stay canonical");
  const textarea = imagePage.locator('textarea[aria-label="Describe your image idea"]');
  await textarea.waitFor({ state: "visible", timeout: 60_000 });
  await textarea.evaluate((node) => node.value);
  assert.equal(await textarea.inputValue(), expectedPrompt, "image prompt must be prefilled");
  checks.push(`/ai-image-generation: prompt prefilled (${expectedPrompt.length} chars) without query`);
  await imagePage.close();

  const templatePage = await newPage(context);
  await templatePage.goto(`${origin}/templates/photo`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await hydrated(templatePage);
  const templateLink = templatePage.locator('.tgrid article.tc a[href="/app/create/ai-image-generation"][data-workspace-entry]').first();
  await templateLink.waitFor({ state: "visible", timeout: 60_000 });
  const templateEntry = JSON.parse(await templateLink.getAttribute("data-workspace-entry"));
  assert.equal(templateEntry.view, "images", "template entry view");
  assert.ok(templateEntry.query.source && templateEntry.query.preset, "template entry must carry source and preset");
  await Promise.all([
    templatePage.waitForURL("**/app/create/ai-image-generation", { timeout: 120_000 }),
    templateLink.click(),
  ]);
  assert.equal(new URL(templatePage.url()).search, "", "template URL must stay canonical");
  const templateTextarea = templatePage.locator('textarea[aria-label="Describe your image idea"]');
  await templateTextarea.waitFor({ state: "visible", timeout: 60_000 });
  const templatePrompt = await templateTextarea.inputValue();
  assert.ok(templatePrompt.length > 20, "template prompt must be prefilled");
  checks.push(`/templates/photo: ${templateEntry.query.source} resolved with ${templatePrompt.length}-char prompt without query`);
  await templatePage.close();

  await context.close();
  console.log(JSON.stringify({ ok: true, origin, checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, origin, checks, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
