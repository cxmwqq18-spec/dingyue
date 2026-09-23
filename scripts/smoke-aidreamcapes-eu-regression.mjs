#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium, request } from "playwright";

const argument = (name, fallback) => {
  const exact = process.argv.find((value) => value.startsWith(`${name}=`));
  return exact ? exact.slice(name.length + 1).replace(/\/$/, "") : fallback;
};

const baseUrl = argument("--base-url", "http://localhost:3002");
const sitePath = argument("--site-path", "/site/aidreamcapes-eu");
const origin = `${baseUrl}${sitePath}`.replace(/\/$/, "");
const routePaths = [
  "",
  "/workflow",
  "/best-packages",
  "/best-save-the-date",
  "/ai-video-generation",
  "/ai-video-generation/talking-photo",
  "/ai-save-the-date/valentines-day",
  "/ai-image-generation",
  "/ai-image-generation/headshot",
  "/blog",
  "/pricing",
  "/app/create"
];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function collectDiagnostics(page, label) {
  const diagnostics = { label, consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [] };
  const onConsole = (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  };
  const onPageError = (error) => diagnostics.pageErrors.push(String(error?.message ?? error));
  const onRequestFailed = (request) => {
    const failure = request.failure();
    if (!failure) return;
    const isExpectedNavigationAbort = failure.errorText === "net::ERR_ABORTED";
    if (!isExpectedNavigationAbort) diagnostics.requestFailures.push({ url: request.url(), type: request.resourceType(), error: failure.errorText });
  };
  const onResponse = (response) => {
    if (response.status() >= 400) diagnostics.badResponses.push({ status: response.status(), url: response.url(), type: response.request().resourceType() });
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);
  return {
    diagnostics,
    stop() {
      page.off("console", onConsole);
      page.off("pageerror", onPageError);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    }
  };
}

async function waitForImages(page) {
  await page.evaluate(async () => {
    const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
    const reviewImages = [...document.images].filter((image) => image.src.includes("/generated/public-media/reviews/"));
    for (const image of reviewImages) {
      image.scrollIntoView({ block: "center", inline: "nearest" });
      await sleep(35);
    }
    await sleep(1200);
  });
}

async function assertDiagnostics(diagnostics) {
  assert.equal(diagnostics.consoleErrors.length, 0, `${diagnostics.label}: console errors ${JSON.stringify(diagnostics.consoleErrors.slice(0, 3))}`);
  assert.equal(diagnostics.pageErrors.length, 0, `${diagnostics.label}: page errors ${JSON.stringify(diagnostics.pageErrors.slice(0, 3))}`);
  assert.equal(diagnostics.requestFailures.length, 0, `${diagnostics.label}: request failures ${JSON.stringify(diagnostics.requestFailures.slice(0, 3))}`);
  assert.equal(diagnostics.badResponses.length, 0, `${diagnostics.label}: bad responses ${JSON.stringify(diagnostics.badResponses.slice(0, 3))}`);
}

async function nextIssueState(page) {
  return page.evaluate(() => {
    const root = document.querySelector("nextjs-portal")?.shadowRoot;
    const badge = root?.querySelector("[data-next-badge]");
    const issueCount = root?.querySelector("[data-issues-count]")?.textContent?.trim() ?? null;
    return {
      available: Boolean(root),
      badge: Boolean(badge),
      error: badge?.getAttribute("data-error") ?? null,
      issueCount,
      visible: Boolean(badge && getComputedStyle(badge).display !== "none")
    };
  });
}

async function assertReviewMedia(page) {
  await waitForImages(page);
  const reviewImages = await page.evaluate(() => [...document.images]
    .map((image) => ({ src: image.currentSrc || image.src, alt: image.alt, width: image.naturalWidth, height: image.naturalHeight }))
    .filter((image) => image.src.includes("/generated/public-media/reviews/")));
  assert.equal(reviewImages.length, 16, `homepage: expected 16 review images, got ${reviewImages.length}`);
  assert.equal(reviewImages.filter((image) => image.width === 0 || image.height === 0).length, 0, "homepage: review image failed to load");
  const byReviewer = new Map();
  for (const image of reviewImages) {
    const match = image.src.match(/reviews\/(?:vendor-[^/]+\/)?review-([a-z]+)-(headshot|theme)\./i);
    assert(match, `homepage: unrecognized review image ${image.src}`);
    const [, reviewer, kind] = match;
    const entry = byReviewer.get(reviewer) ?? {};
    entry[kind] = image.src;
    byReviewer.set(reviewer, entry);
    assert(image.alt.trim(), `homepage: missing alt text for ${reviewer} ${kind}`);
  }
  assert.equal(byReviewer.size, 8, `homepage: expected 8 reviewers, got ${byReviewer.size}`);
  for (const [reviewer, media] of byReviewer) {
    assert(media.headshot && media.theme, `homepage: ${reviewer} is missing headshot or theme image`);
    assert.notEqual(media.headshot, media.theme, `homepage: ${reviewer} avatar and theme image must differ`);
    assert(media.headshot.includes(`review-${reviewer}-headshot.`), `homepage: ${reviewer} avatar does not match reviewer`);
    assert(media.theme.includes(`/vendor-`), `homepage: ${reviewer} theme image is not supplier-generated`);
  }
  return { total: reviewImages.length, reviewers: byReviewer.size };
}

async function assertFavicon(page, label) {
  const iconLinks = await page.locator('link[rel="icon"]').evaluateAll((links) => links.map((link) => ({
    href: link.getAttribute("href")
  })));
  assert.equal(iconLinks.length, 1, `${label}: browser favicon must have one canonical icon`);
  assert.equal(iconLinks[0]?.href, "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-logo-refined.svg?v=20260920favicon", `${label}: browser favicon source`);
  assert.equal(await page.locator('link[rel="shortcut icon"]').count(), 0, `${label}: legacy duplicate shortcut icon`);
  assert.equal(await page.locator('link[rel="icon"][href*="logo-refined.svg"]').count(), 1, `${label}: site logo favicon`);
  assert.equal(await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"), "/assets/sites/site_aidreamcapes_eu/brand/aidreamcapes-icon-180.png?v=20260919original", `${label}: Apple icon`);
  return iconLinks[0];
}

async function assertHomepage(page) {
  const issueState = await nextIssueState(page);
  if (issueState.badge) {
    assert.equal(issueState.error, "false", `homepage: Next dev overlay reports an error (${JSON.stringify(issueState)})`);
    assert.equal(issueState.issueCount, "0", `homepage: Next dev overlay reports issues (${JSON.stringify(issueState)})`);
  }
  assert.equal(await page.locator("html").getAttribute("lang"), "fr", "homepage: document language");
  await assertFavicon(page, "homepage");
  assert.match(await page.title(), /AIdreamcapes/i, "homepage: title");
  assert.equal(await page.locator("h1").count(), 1, "homepage: exactly one H1");
  assert.match(await page.locator("body").innerText(), /Créez des vidéos, portraits professionnels/i, "homepage: French hero copy");
  assert.equal(await page.getByPlaceholder("Adresse e-mail", { exact: true }).count(), 1, "homepage: email sign-up input");
  assert.equal(await page.getByRole("button", { name: "Créer un compte avec votre e-mail", exact: true }).count(), 1, "homepage: email sign-up button");

  for (const menuName of ["Création vidéo IA", "Annonces Save the Date", "Création photo IA"]) {
    const menuButton = page.getByRole("button", { name: menuName, exact: true });
    assert.equal(await menuButton.getAttribute("aria-expanded"), "false", `homepage: ${menuName} starts closed`);
    await menuButton.click();
    assert.equal(await menuButton.getAttribute("aria-expanded"), "true", `homepage: ${menuName} opens`);
    const menuPanel = page.locator('[data-storefront-mega-menu-panel]:visible').last();
    if (menuName === "Création vidéo IA") {
      assert.equal(await menuPanel.getByText("AI Video Generation", { exact: true }).count(), 0, "homepage: video mega menu leaked English title");
      assert.equal(await menuPanel.getByText(/catégories · .* thèmes/i).count(), 1, "homepage: video mega menu French count label");
    }
    if (menuName === "Création photo IA") {
      assert.equal(await menuPanel.getByText("Motion GéNéRateur", { exact: true }).count(), 0, "homepage: photo mega menu leaked malformed capitalization");
      assert.equal(await menuPanel.getByText("Générateur de mouvement", { exact: true }).count(), 1, "homepage: photo mega menu French motion label");
    }
    await menuButton.click();
    assert.equal(await menuButton.getAttribute("aria-expanded"), "false", `homepage: ${menuName} closes`);
  }

  return { issueState, reviewMedia: await assertReviewMedia(page) };
}

async function assertPricing(page) {
  const billing = [
    ["Mensuel", "month"],
    ["Trimestriel", "quarter"],
    ["Semestriel", "half_year"]
  ];
  for (const [label, cycle] of billing) {
    const tab = page.getByRole("tab", { name: label, exact: true });
    assert.equal(await tab.count(), 1, `pricing: missing ${label} tab`);
    await tab.click();
    await wait(180);
    assert.equal(await page.locator(`[data-active-billing-cycle="${cycle}"]`).count(), 1, `pricing: ${cycle} cycle is not active`);
    assert.equal(await tab.getAttribute("aria-selected"), "true", `pricing: ${label} tab is not selected`);
  }
  return { cycles: billing.map(([, cycle]) => cycle) };
}

async function assertVideoGeneration(page) {
  assert.match(await page.title(), /Génération de vidéos avec l’IA/i, "video generation: title semantics");
  assert.match(await page.locator("h1").first().innerText(), /Génération de vidéos/i, "video generation: H1 semantics");
  assert.equal(await page.getByText("Outils IA pour créer vos photos", { exact: true }).count(), 0, "video generation: stale photo copy");
  const cards = await page.locator("[data-video-theme-card]").count();
  assert(cards > 0, "video generation: no theme cards rendered");
  assert.equal(await page.getByText("Ouvrir le thème", { exact: true }).count(), cards, "video generation: French theme CTAs");
  return { cards };
}

async function assertLegacyRoutes() {
  const api = await request.newContext({ maxRedirects: 0 });
  try {
    const response = await api.get(`${origin}/ai-video-generation/wedding-invitation`, { timeout: 30_000 });
    assert.equal(response.status(), 308, "legacy wedding invitation route: expected permanent redirect");
    const location = response.headers().location;
    assert(location, "legacy wedding invitation route: missing Location header");
    assert.equal(new URL(location, origin).pathname, `${sitePath}/ai-save-the-date/wedding-invitation`, "legacy wedding invitation route: canonical target");
    return { status: response.status(), location };
  } finally {
    await api.dispose();
  }
}

const browser = await chromium.launch({ headless: true });
const reports = [];
try {
  for (const routePath of routePaths) {
    const label = routePath || "/";
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const collector = collectDiagnostics(page, label);
    try {
      const response = await page.goto(`${origin}${routePath}`, { waitUntil: "commit", timeout: 120_000 });
      // Commit only guarantees that the HTML shell arrived. The mega-menu
      // controls are hydrated afterward, so wait for the client shell before
      // exercising click behavior in a memory-heavy dev server.
      await page.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => undefined);
      await wait(1_200);
      assert.equal(response?.status(), 200, `${label}: HTTP status`);
      assert.doesNotMatch(await page.title(), /404|not found/i, `${label}: 404 page title`);
      assert(!/404: This page could not be found|This page could not be found/i.test(await page.locator("body").innerText()), `${label}: 404 body`);
      if (routePath !== "") await assertFavicon(page, label);
      if (routePath === "") reports.push({ route: label, status: response.status(), ...(await assertHomepage(page)) });
      if (routePath === "/ai-video-generation") reports.push({ route: label, status: response.status(), ...(await assertVideoGeneration(page)) });
      if (routePath === "/pricing") reports.push({ route: label, status: response.status(), ...(await assertPricing(page)) });
      await assertDiagnostics(collector.diagnostics);
      if (!reports.some((report) => report.route === label)) reports.push({ route: label, status: response.status() });
    } finally {
      collector.stop();
      await page.close();
    }
  }

  const navigationPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const navigationCollector = collectDiagnostics(navigationPage, "client navigation / -> /workflow");
  try {
    await navigationPage.goto(origin, { waitUntil: "commit", timeout: 120_000 });
    await navigationPage.waitForLoadState("networkidle", { timeout: 120_000 }).catch(() => undefined);
    await wait(1_200);
    await navigationPage.getByRole("link", { name: "Comment ça marche", exact: true }).click();
    await navigationPage.waitForURL(`${origin}/workflow`, { waitUntil: "commit", timeout: 120_000 });
    await wait(1_200);
    assert.equal(await navigationPage.locator("h1").count(), 1, "client navigation: workflow H1");
    await assertDiagnostics(navigationCollector.diagnostics);
    reports.push({ route: "client navigation / -> /workflow", status: 200 });
  } finally {
    navigationCollector.stop();
    await navigationPage.close();
  }
  reports.push({ route: "legacy wedding invitation redirect", ...(await assertLegacyRoutes()) });
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, origin, routes: reports, browser: "playwright-chromium" }, null, 2));
