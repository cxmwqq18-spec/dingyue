#!/usr/bin/env node
// Browser regression for the public card -> detail page -> workspace handoff.
//
// Contract (media detail remediation, 2026-10-21):
//   * a public card opens that item's own detail page and carries no workspace
//     payload;
//   * the detail page owns the single workspace CTA, which carries the inert
//     `data-workspace-entry` identity;
//   * clicking that CTA lands on the canonical workspace URL (no query string)
//     with the item already resolved.
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

function pathOf(value) {
  const url = new URL(value, `${origin}/`);
  const prefix = url.pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0] ?? "";
  return { pathname: url.pathname.slice(prefix.length) || "/", search: url.search };
}

async function clickCard(page, selector, { expect, label }) {
  const card = page.locator(selector).first();
  await card.waitFor({ state: "visible", timeout: 60_000 });
  const href = await card.getAttribute("href");
  assert.ok(href, `${label}: card has an href`);
  const entry = await card.getAttribute("data-workspace-entry");
  assert.equal(entry, null, `${label}: media card must not carry a workspace entry payload`);
  const parsed = pathOf(href);
  assert.equal(parsed.search, "", `${label}: card href must be a plain path (${href})`);
  assert.match(parsed.pathname, expect, `${label}: card must open its own detail page (${href})`);
  await Promise.all([
    page.waitForURL((url) => {
      const value = new URL(url);
      const prefix = value.pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0] ?? "";
      return expect.test(value.pathname.slice(prefix.length) || "/");
    }, { timeout: 180_000 }),
    card.click({ timeout: 180_000, noWaitAfter: true })
  ]);
  await page.waitForLoadState("domcontentloaded", { timeout: 180_000 });
  assert.match(pathOf(page.url()).pathname, expect, `${label}: navigation must stay on the detail page`);
  return { detailPath: pathOf(page.url()).pathname, text: await card.innerText().catch(() => "") };
}

async function openDetailHandoff(page, { expect, label }) {
  await hydrated(page);
  const cta = page.locator(`a[href$="${expect}"][data-workspace-entry]`).first();
  await cta.waitFor({ state: "visible", timeout: 60_000 });
  const entry = JSON.parse(await cta.getAttribute("data-workspace-entry"));
  // The workspace page is a heavy dev-mode render; never let the default 30s
  // click-navigation wait fail the run.
  await Promise.all([
    page.waitForURL(`**${expect}`, { timeout: 180_000 }),
    cta.click({ timeout: 180_000, noWaitAfter: true })
  ]);
  await page.waitForLoadState("domcontentloaded", { timeout: 180_000 });
  assert.equal(new URL(page.url()).search, "", `${label}: workspace URL must stay canonical`);
  return entry;
}

try {
  const context = await browser.newContext({ extraHTTPHeaders: headers });

  // ---- 1. Actor card -> /ai-actors/<name> -> workspace --------------------
  const actorPage = await newPage(context);
  await actorPage.goto(`${origin}/ai-actors`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const actorCard = await clickCard(actorPage, "article.actor-card a[href]", {
    expect: /^\/ai-actors\/[a-z0-9][a-z0-9-]*$/i,
    label: "/ai-actors"
  });
  assert.doesNotMatch(actorCard.detailPath, /^\/ai-actors\/(?:men|women)\//, "actor detail URL must be flat");
  // The detail h1 reads "<Name> · <scene> AI Actor"; the workspace shows the name.
  const actorName = (await actorPage.locator("h1").first().innerText()).split("·")[0].trim();
  const actorEntry = await openDetailHandoff(actorPage, { expect: "/app/create/ai-actors", label: actorCard.detailPath });
  assert.equal(actorEntry.view, "actors", "actor entry view");
  assert.match(actorEntry.query.actor, /^[a-z0-9][a-z0-9-]{0,80}$/i, "actor entry id");
  await actorPage.getByText("Presenter selected", { exact: false }).first().waitFor({ timeout: 60_000 });
  assert.ok((await actorPage.locator("body").innerText()).includes(actorName), `workspace must show selected actor ${actorName}`);
  checks.push(`${actorCard.detailPath}: ${actorName} (${actorEntry.query.actor}) selected without query`);
  await actorPage.close();

  // ---- 2. Media card -> its own detail page -> workspace ------------------
  // Pick a card that really owns a derived media detail page (the home picker
  // also lists tool pages, which have their own multi-CTA shell).
  const homeHtml = await (await fetch(`${origin}/`, { headers })).text();
  const candidateHrefs = [...homeHtml.matchAll(/<a class="v-pick-card"[^>]*href="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((href) => /^(?:\/site\/(?:aidreamcapes|aivideosugc))?\/ai-(?:video|image)-generation\/[a-z0-9][a-z0-9-]*$/.test(href));
  let derivedHref;
  for (const href of candidateHrefs) {
    const target = new URL(href, `${origin}/`).href;
    const html = await (await fetch(target, { headers })).text();
    if (html.includes('id="media-detail"')) { derivedHref = href; break; }
  }
  assert.ok(derivedHref, "home page must render at least one media card that opens a derived detail page");

  const mediaPage = await newPage(context);
  await mediaPage.goto(`${origin}/`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const mediaCard = await clickCard(mediaPage, `a.v-pick-card[href="${derivedHref}"]`, {
    expect: /^\/ai-(?:video|image)-generation\/[a-z0-9][a-z0-9-]*$/i,
    label: "/"
  });
  const mediaTitle = (await mediaPage.locator("h1").first().innerText()).trim();
  const kind = mediaCard.detailPath.startsWith("/ai-image-generation") ? "photo" : "video";
  const mediaEntry = await openDetailHandoff(mediaPage, {
    expect: `/app/create/${kind === "photo" ? "ai-image-generation" : "ai-video-generation"}`,
    label: mediaCard.detailPath
  });
  assert.equal(mediaEntry.media?.kind, kind, `media entry kind must be ${kind}`);
  assert.equal(mediaEntry.media?.slug, mediaCard.detailPath.split("/").pop(), "media entry slug must match the detail page");
  await mediaPage.waitForLoadState("domcontentloaded");
  const workspaceText = await mediaPage.locator("body").innerText();
  assert.ok(workspaceText.includes(mediaTitle.split("·")[0].trim()), "workspace must show the media card that was clicked");
  checks.push(`${mediaCard.detailPath}: ${kind} "${mediaTitle}" resolved in the workspace without query`);
  await mediaPage.close();

  // ---- 3. Template card -> template page -> workspace --------------------
  const templatePage = await newPage(context);
  await templatePage.goto(`${origin}/templates/photo`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const templateCard = await clickCard(templatePage, "article.tc a.use[href]", {
    expect: /^\/ai-image-generation\/[a-z0-9][a-z0-9-]*$/i,
    label: "/templates/photo"
  });
  const templateEntry = await openDetailHandoff(templatePage, { expect: "/app/create/ai-image-generation", label: templateCard.detailPath });
  assert.equal(templateEntry.view, "images", "template entry view");
  assert.ok(templateEntry.query.source && templateEntry.query.preset, "template entry must carry source and preset");
  const templateTextarea = templatePage.locator('textarea[aria-label="Describe your image idea"]');
  await templateTextarea.waitFor({ state: "visible", timeout: 60_000 });
  const templatePrompt = await templateTextarea.inputValue();
  assert.ok(templatePrompt.length > 20, "template prompt must be prefilled");
  checks.push(`${templateCard.detailPath}: ${templateEntry.query.source} resolved with ${templatePrompt.length}-char prompt without query`);
  await templatePage.close();

  await context.close();
  console.log(JSON.stringify({ ok: true, origin, checks }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, origin, checks, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
