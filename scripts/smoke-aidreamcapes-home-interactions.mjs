#!/usr/bin/env node
/** Real integrated guest UI only. Never creates customers, drafts, quotes or generations. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const origin = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const home = `${origin}/site/aidreamcapes`;
const directory = resolve(process.env.SMOKE_ARTIFACT_DIR || "releases/aidreamcapes-home-interactions");
const expectedH1 = process.env.SMOKE_EXPECT_H1 || "Create AI UGC Videos from Your Product Photos";
const widths = (process.env.SMOKE_INTERACTION_VIEWPORTS || "1440,390").split(",").map(Number);
const actionMatch = process.env.SMOKE_ACTION_MATCH;
const reportFile = process.env.SMOKE_REPORT_FILE || "interaction-acceptance.json";
const report = { ok: false, home, expectedH1, widths, inventories: [], actions: [], inheritedActions: [], translations: [], screenshots: [], failures: [], pageErrors: [], serverErrors: [], publicDataRequests: [], blockedRequests: [], guestReads: [] };
const check = (label, operation) => { try { operation(); } catch (error) { report.failures.push(`${label}: ${error.message}`); } };
const flush = () => writeFile(resolve(directory, reportFile), `${JSON.stringify(report, null, 2)}\n`);
const han = /[\u3400-\u9fff]/;

// Chrome translation replaces text nodes with nested font nodes; preserve wording
// so role locators can exercise the real translated DOM structure deterministically.
function translatedDom(selector = "body") {
  const root = document.querySelector(selector);
  if (!root) return { replaced: 0, wrapped: 0 };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.textContent.trim() && !node.parentElement.closest('script,style,textarea,option,input,svg,font,[translate="no"]')) nodes.push(node);
  }
  for (const node of nodes) {
    const outer = document.createElement("font");
    const inner = document.createElement("font");
    outer.style.verticalAlign = inner.style.verticalAlign = "inherit";
    inner.textContent = node.textContent;
    outer.appendChild(inner);
    node.parentNode.replaceChild(outer, node);
  }
  return { replaced: nodes.length, wrapped: root.querySelectorAll("font font").length };
}

async function guardedPage(browser, width) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } });
  const state = { phase: "public", action: "initial" };
  page.on("pageerror", error => report.pageErrors.push({ width, ...state, message: error.message }));
  page.on("response", response => { if (response.status() >= 500) report.serverErrors.push({ width, ...state, url: response.url(), status: response.status() }); });
  page.on("request", request => {
    const url = new URL(request.url());
    const publicDocument = new URL(page.url()).pathname === "/site/aidreamcapes";
    if (state.phase === "public" && publicDocument && !url.pathname.startsWith("/_next/static/") && (["fetch", "xhr", "eventsource"].includes(request.resourceType()) || request.headers().rsc || url.searchParams.has("_rsc") || url.pathname.startsWith("/api/") && request.resourceType() !== "image")) {
      report.publicDataRequests.push({ width, ...state, document: page.url(), url: request.url(), type: request.resourceType() });
    }
    if (state.phase === "guest" && url.pathname.startsWith("/api/")) report.guestReads.push({ width, ...state, url: request.url(), method: request.method() });
  });
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const supplier = /(^|\.)(openai\.com|anthropic\.com|fal\.ai|replicate\.com|runwayml\.com|heygen\.com|elevenlabs\.io|stripe\.com|paypal\.com)$/i.test(url.hostname);
    const forbiddenApi = /\/api\/.*(?:quote|reserve|generat|billing|checkout|supplier|provider)/i.test(url.pathname);
    if (!["GET", "HEAD"].includes(request.method()) || supplier || forbiddenApi) {
      report.blockedRequests.push({ width, ...state, method: request.method(), url: request.url() });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return { page, state };
}

async function publicHydrationReady(page) {
  // A server-rendered pricing button acquires React props only after hydration.
  // Waiting for this marker tests a user's normal post-hydration translation,
  // rather than deliberately changing the SSR tree before React attaches.
  await page.waitForFunction(() => {
    const button = document.querySelector(".v2-pricing-periods button");
    return button && Object.keys(button).some(key => key.startsWith("__reactProps$"));
  }, null, { timeout: 30000 });
}

async function homepageFacts(page, width) {
  const facts = await page.evaluate(() => {
    const root = document.querySelector(".home-v4");
    const han = /[\u3400-\u9fff]/;
    const visible = element => !!element.getClientRects().length;
    const attrs = ["alt", "title", "aria-label", "aria-description", "placeholder"];
    const controls = ".hx-points>*[class],.hx-filters>*,.hx-editor-tabs>*,.hx-versions>*,.hx-library-filter>*,.hx-formats-foot>*";
    const expectedControls = [...root.querySelectorAll(controls)].filter(visible);
    return {
      h1: [...document.querySelectorAll("h1")].map(element => element.textContent.trim()),
      modules: [...root.querySelectorAll("[data-home-experience]")].map(element => element.getAttribute("data-home-experience")),
      actions: [...root.querySelectorAll("a[data-home-action]")].map((element, index) => ({ index, block: element.getAttribute("data-action-block"), key: element.getAttribute("data-home-action"), label: element.textContent.trim().replace(/\s+/g, " "), href: element.getAttribute("href"), images: element.querySelectorAll("img").length })),
      missingImageActions: [...root.querySelectorAll("[data-home-experience] img")].filter(image => !image.closest("a[data-home-action],button[data-home-action]")).map(image => image.alt),
      missingControlActions: expectedControls.filter(element => !element.matches("a[data-home-action],button[data-home-action]") && !element.closest("a[data-home-action],button[data-home-action]")).map(element => element.textContent.trim()),
      untrackedModuleAnchors: [...root.querySelectorAll("[data-home-experience] a")].filter(element => !element.hasAttribute("data-home-action")).map(element => element.textContent.trim()),
      chinese: {
        body: document.body.innerText.split("\n").filter(value => han.test(value)),
        attributes: [...document.querySelectorAll(attrs.map(attribute => `[${attribute}]`).join(","))].flatMap(element => attrs.filter(attribute => han.test(element.getAttribute(attribute) || "")).map(attribute => ({ attribute, value: element.getAttribute(attribute) }))),
        seo: [...document.querySelectorAll('head title,head meta[content],script[type="application/ld+json"]')].map(element => element.getAttribute("content") || element.textContent).filter(value => han.test(value))
      },
      layout: { viewport: innerWidth, document: document.documentElement.scrollWidth },
      numbers: [...root.querySelectorAll(".v-card-number")].map(element => ({ text: element.textContent.trim(), size: parseFloat(getComputedStyle(element).fontSize) }))
    };
  });
  check(`${width} original English H1`, () => assert.deepEqual(facts.h1, [expectedH1]));
  check(`${width} six modules`, () => assert.deepEqual(facts.modules, ["hero", "picker", "steps", "features", "audience", "reviews"]));
  check(`${width} all module images clickable`, () => assert.deepEqual(facts.missingImageActions, []));
  check(`${width} all visual pills actionable`, () => assert.deepEqual(facts.missingControlActions, []));
  check(`${width} all module anchors tracked`, () => assert.deepEqual(facts.untrackedModuleAnchors, []));
  check(`${width} English body`, () => assert.deepEqual(facts.chinese.body, []));
  check(`${width} English text attributes`, () => assert.deepEqual(facts.chinese.attributes, []));
  check(`${width} English SEO`, () => assert.deepEqual(facts.chinese.seo, []));
  check(`${width} no horizontal overflow`, () => assert.equal(facts.layout.document, facts.layout.viewport));
  check(`${width} compact 4+6 numbers`, () => { assert.equal(facts.numbers.length, 10); assert(facts.numbers.every(number => number.size <= 20)); });
  check(`${width} at least one action per module`, () => assert(facts.modules.every(kind => facts.actions.some(action => action.block === kind))));
  for (const action of facts.actions) check(`${width} safe action ${action.block}/${action.key}/${action.index}`, () => {
    const url = new URL(action.href, home);
    assert.equal(url.origin, new URL(home).origin);
    assert.equal(url.pathname, "/site/aidreamcapes/app/create");
    assert(!url.searchParams.has("task"), "Public demonstrations cannot reference private tasks");
  });
  return facts;
}

async function arrival(page, action, width) {
  const expected = new URL(action.href, home);
  const prompt = expected.searchParams.get("prompt");
  const templates = expected.searchParams.get("templates") === "1";
  if (templates) await page.getByRole("dialog", { name: "Choose a product template", exact: true }).waitFor({ timeout: 15000 });
  if (prompt) await page.waitForFunction(value => [...document.querySelectorAll("textarea")].some(element => element.value === value), prompt, { timeout: 10000 });
  await page.locator("main h1").first().waitFor({ timeout: 15000 });
  const facts = await page.evaluate(() => ({
    url: location.href,
    headings: [...document.querySelectorAll("main h1")].map(element => element.textContent.trim()),
    activeView: document.querySelector('aside a[aria-current="page"]')?.getAttribute("href"),
    textareas: [...document.querySelectorAll("textarea")].map(element => ({ label: element.getAttribute("aria-label") || element.placeholder, value: element.value })),
    selects: [...document.querySelectorAll("select")].map(element => ({ label: element.getAttribute("aria-label") || element.closest("label")?.textContent.trim(), value: element.value, options: [...element.options].map(option => option.value) })),
    selectedButtons: [...document.querySelectorAll('main button[aria-pressed="true"],main button[class*="selected"], [role="dialog"] button[aria-pressed="true"]')].map(element => element.textContent.trim()),
    templateCount: document.querySelectorAll('[role="dialog"] img').length,
    templateVisible: !!document.querySelector('[role="dialog"][aria-label="Choose a product template"]'),
    presetBanner: [...document.querySelectorAll("main h3,main h2")].map(element => element.textContent.trim()),
    layout: { viewport: innerWidth, document: document.documentElement.scrollWidth },
    bodyText: document.body.innerText.slice(0, 10000)
  }));
  const label = `${width} ${action.block}/${action.key}/${action.index}`;
  check(`${label} workspace target`, () => assert.equal(new URL(facts.url).pathname, expected.pathname));
  const requestedView = expected.searchParams.get("preset") ? expected.searchParams.get("view") || "home" : expected.searchParams.get("view") || "agent";
  check(`${label} correct workspace view`, () => assert.equal(new URL(facts.activeView, home).searchParams.get("view"), requestedView));
  check(`${label} guest no horizontal overflow`, () => assert(facts.layout.document <= facts.layout.viewport + 1));
  check(`${label} English workspace copy`, () => assert(!han.test(facts.bodyText)));
  if (prompt) check(`${label} prompt populated exactly`, () => assert(facts.textareas.some(element => element.value === prompt)));
  if (expected.searchParams.has("preset")) {
    check(`${label} resolved preset kept`, () => assert.equal(new URL(facts.url).searchParams.get("preset"), expected.searchParams.get("preset")));
    check(`${label} current preset prompt populated`, () => assert(facts.textareas.some(element => element.value.trim().length > 20)));
  }
  if (templates) {
    check(`${label} template dialog`, () => { assert(facts.templateVisible); assert(facts.templateCount > 0); });
    check(`${label} one-time dialog query consumed`, () => assert(!new URL(facts.url).searchParams.has("templates")));
    if (expected.searchParams.has("category")) check(`${label} category filter applied`, () => assert(facts.selectedButtons.some(value => !["All", "All categories", "Video", "Photo"].includes(value))));
  }
  const aspect = expected.searchParams.get("aspect") || expected.searchParams.get("size");
  const duration = expected.searchParams.get("duration") || expected.searchParams.get("length");
  if (aspect && facts.selects.some(select => select.options.includes(aspect))) check(`${label} aspect populated`, () => assert(facts.selects.some(select => select.value === aspect)));
  if (duration && facts.selects.some(select => select.options.includes(duration))) check(`${label} duration populated`, () => assert(facts.selects.some(select => select.value === duration)));
  if (requestedView === "images" && expected.searchParams.has("tool")) check(`${label} image style populated`, () => assert(facts.selects.some(select => select.label === "Image style" && select.value === expected.searchParams.get("tool"))));
  if (requestedView === "batch" && expected.searchParams.has("scene")) check(`${label} batch scene populated`, () => assert(facts.selects.some(select => select.value === expected.searchParams.get("scene"))));
  if (requestedView === "library" && expected.searchParams.has("filter")) {
    const filterLabel = { all: "All videos", draft: "In progress", completed: "Completed" }[expected.searchParams.get("filter")];
    check(`${label} Library filter populated`, () => assert(facts.selectedButtons.includes(filterLabel)));
  }
  delete facts.bodyText;
  return facts;
}

async function translationTransitions(page, state, width) {
  state.phase = "public"; state.action = "translation-pricing";
  await page.goto(home, { waitUntil: "networkidle", timeout: 90000 });
  await publicHydrationReady(page);
  const mutation = await page.evaluate(translatedDom);
  const periods = page.locator(".v2-pricing-periods button");
  await periods.nth(1).click();
  await page.waitForFunction(() => document.querySelector(".v2-pricing-content")?.getAttribute("data-active-billing-period") === "year");
  await page.evaluate(translatedDom);
  await periods.nth(0).click();
  await page.waitForFunction(() => document.querySelector(".v2-pricing-content")?.getAttribute("data-active-billing-period") === "month");
  report.translations.push({ width, kind: "public pricing month/year", mutation });
  state.phase = "guest"; state.action = "translation-template-picker";
  await page.goto(`${home}/app/create?view=home&templates=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const dialog = page.getByRole("dialog", { name: "Choose a product template", exact: true });
  await dialog.waitFor();
  await page.evaluate(translatedDom);
  await dialog.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.evaluate(translatedDom);
  await page.locator("header").getByRole("button", { name: "Choose a template", exact: true }).click();
  await dialog.waitFor();
  await page.evaluate(translatedDom);
  await dialog.locator("button").filter({ has: page.locator("img") }).first().click();
  await dialog.waitFor({ state: "hidden" });
  const selectedPreset = new URL(page.url()).searchParams.get("preset");
  check(`${width} translated template selection`, () => assert(/^p_[a-f0-9]{24}$/.test(selectedPreset || "")));
  await page.evaluate(translatedDom);
  const tabs = page.getByRole("tab");
  if (await tabs.count()) {
    await tabs.filter({ hasText: "AI Image" }).click();
    await page.getByLabel("Describe your image idea", { exact: true }).waitFor();
    await page.evaluate(translatedDom);
    await tabs.filter({ hasText: "AI Video" }).filter({ hasText: /Video$/ }).click();
    await page.getByLabel("Describe your video idea", { exact: true }).waitFor();
  }
  report.translations.push({ width, kind: "guest template close/reopen/select and tabs", selectedPreset });
  const headerBrand = page.locator('aside a[aria-label="AIVideosUGC storefront"]');
  // Its href and navigation must return to the actual storefront for this route mode.
  assert.equal(await headerBrand.count(), 1, "Workspace must expose one storefront brand link");
  assert.equal(await headerBrand.getAttribute("href"), "/site/aidreamcapes");
  const brandInViewport = await headerBrand.evaluate(element => { const rect = element.getBoundingClientRect(); return rect.right > 0 && rect.left < innerWidth; });
  if (!brandInViewport) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  state.phase = "public"; state.action = "workspace-brand-return";
  if (width === 1440) { await headerBrand.focus(); await headerBrand.press("Enter"); }
  else await headerBrand.click();
  await page.waitForURL(home, { timeout: 15000 });
  await page.locator(".home-v4 h1").waitFor();
  report.translations.push({ width, kind: "workspace sidebar brand returns home", url: page.url() });
}

await mkdir(directory, { recursive: true });
let previous;
if (process.env.SMOKE_RESUME_FROM) {
  const previousPath = resolve(process.env.SMOKE_RESUME_FROM);
  previous = JSON.parse(await readFile(previousPath, "utf8"));
  report.previousEvidence = previousPath;
  report.previousFailuresRechecked = previous.failures;
  // Carry only actual successful clicks whose own assertions passed. Fresh
  // inventories, translation transitions and network assertions run again.
  const hadHotUpdate = previous.publicDataRequests.some(item => /\/_next\/static\/webpack\/.*hot-update/.test(item.url));
  report.previousDevelopmentRequests = previous.publicDataRequests.filter(item => /\/_next\/static\//.test(item.url) || hadHotUpdate && new URL(item.url).pathname.startsWith("/site/aidreamcapes/app/") && new URL(item.url).searchParams.has("_rsc"));
  report.previousDevelopmentRequestNote = "Prior run overlapped a CSS hot update while returning from guest workspace; raw historical records are retained here. Final public-page accounting checks the active document URL and excludes static dev build assets.";
  report.previousRunDiagnostics = { pageErrors: previous.pageErrors, serverErrors: previous.serverErrors, publicDataRequests: previous.publicDataRequests, blockedRequests: previous.blockedRequests };
  report.translationScope = "Chrome-like text-node replacement after explicit React hydration readiness; pre-hydration injected recoverable errors remain in the previous raw evidence.";
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" });
try {
  for (const width of widths) {
    const { page, state } = await guardedPage(browser, width);
    await page.goto(home, { waitUntil: "networkidle", timeout: 90000 });
    const inventory = await homepageFacts(page, width);
    report.inventories.push({ width, ...inventory });
    for (const kind of inventory.modules) {
      const section = page.locator(`[data-home-experience="${kind}"]`);
      await section.scrollIntoViewIfNeeded();
      for (const image of await section.locator("img").all()) await image.scrollIntoViewIfNeeded();
      await section.evaluate(element => Promise.all([...element.querySelectorAll("img")].map(image => image.decode().catch(() => {}))));
      const screenshot = resolve(directory, `interactions-${kind}-${width}.png`);
      await section.screenshot({ path: screenshot, style: ".adc2 header.site{visibility:hidden!important}" });
      report.screenshots.push(screenshot);
    }
    for (const [kind, selector] of [["numbered-definition", ".ideas.v-numbered-cards"], ["numbered-workflow", ".ben.v-numbered-cards"]]) {
      const screenshot = resolve(directory, `interactions-${kind}-${width}.png`);
      await page.locator(selector).locator("xpath=ancestor::section[1]").screenshot({ path: screenshot, style: ".adc2 header.site{visibility:hidden!important}" });
      report.screenshots.push(screenshot);
    }
    const requestedActions = inventory.actions.filter(action => !actionMatch || `${action.block}/${action.key}`.includes(actionMatch));
    const actions = requestedActions.filter(action => {
      const prior = [...(previous?.actions || []), ...(previous?.inheritedActions || [])].find(item => item.width === width && item.index === action.index && item.block === action.block && item.key === action.key && item.href === action.href && item.result && !item.error);
      const prefix = `${width} ${action.block}/${action.key}/${action.index}`;
      const priorActionErrors = previous?.pageErrors.some(item => item.width === width && item.action === `${action.block}/${action.key}/${action.index}`) || previous?.blockedRequests.some(item => item.width === width && item.action === `${action.block}/${action.key}/${action.index}`);
      if (prior && !priorActionErrors && !previous.failures.some(failure => failure.startsWith(`${prefix} `) || failure.startsWith(`${prefix}:`))) {
        report.inheritedActions.push({ ...prior, inheritedFrom: report.previousEvidence });
        return false;
      }
      return true;
    });
    console.log(`${width}: ${actions.length} live actions to click; ${requestedActions.length - actions.length} verified clicks retained from prior evidence`);
    for (const action of actions) {
      state.phase = "public"; state.action = `${action.block}/${action.key}/${action.index}`;
      if (!page.url().startsWith(home) || await page.locator(".home-v4").count() === 0) await page.goto(home, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.locator(".home-v4").waitFor();
      let translation;
      if (width === 390) { await publicHydrationReady(page); translation = await page.evaluate(translatedDom); }
      const anchor = page.locator(".home-v4 a[data-home-action]").nth(action.index);
      assert.equal(await anchor.getAttribute("href"), action.href, "Live action inventory changed during acceptance");
      state.phase = "guest";
      try {
        const keyboard = width === 1440 && action.index % 7 === 0 && action.block !== "visualSteps";
        if (keyboard) { await anchor.scrollIntoViewIfNeeded(); await anchor.focus(); }
        await Promise.all([page.waitForURL(url => url.pathname === "/site/aidreamcapes/app/create", { timeout: 30000 }), keyboard ? anchor.press("Enter") : anchor.click()]);
        await page.waitForLoadState("domcontentloaded");
        report.actions.push({ width, ...action, keyboard, translation, result: await arrival(page, action, width) });
      } catch (error) {
        report.failures.push(`${width} ${state.action}: ${error.message}`);
        report.actions.push({ width, ...action, error: error.message });
      }
      if (report.actions.length % 10 === 0) console.log(`${width}: clicked ${report.actions.length} actions total; failures=${report.failures.length}`);
      await flush();
      state.phase = "public";
      await page.goBack({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => {});
    }
    await translationTransitions(page, state, width);
    check(`${width} every requested visible action verified`, () => assert.equal(report.actions.filter(item => item.width === width).length + report.inheritedActions.filter(item => item.width === width).length, requestedActions.length));
    await page.close();
  }
} catch (error) {
  report.failures.push(error.stack || String(error));
} finally {
  await browser.close();
  check("zero page errors", () => assert.deepEqual(report.pageErrors, []));
  check("zero HTTP 5xx", () => assert.deepEqual(report.serverErrors, []));
  check("no public browser data requests", () => assert.deepEqual(report.publicDataRequests, []));
  check("no mutation/quote/generation/billing/provider attempts", () => assert.deepEqual(report.blockedRequests, []));
  if (report.previousRunDiagnostics) {
    const inherited = new Set(report.inheritedActions.map(item => `${item.width}/${item.block}/${item.key}/${item.index}`));
    report.previousNetworkEvidence = Object.fromEntries(Object.entries(report.previousRunDiagnostics).map(([name, values]) => [name, values.filter(item => inherited.has(`${item.width}/${item.action}`) && !report.previousDevelopmentRequests.includes(item))]));
    for (const [name, values] of Object.entries(report.previousNetworkEvidence)) check(`inherited clicks ${name}`, () => assert.deepEqual(values, []));
  }
  report.ok = report.failures.length === 0;
  await flush();
  console.log(JSON.stringify({ ok: report.ok, actionsClicked: report.actions.length, inheritedVerifiedClicks: report.inheritedActions.length, evidence: resolve(directory, reportFile), screenshots: report.screenshots, failures: report.failures }, null, 2));
  if (!report.ok) process.exitCode = 1;
}
