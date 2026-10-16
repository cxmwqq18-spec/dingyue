#!/usr/bin/env node
/** Local presentation controls and explicit guest handoffs; no fixtures or mutations. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const home = `${base}/site/aidreamcapes`;
const directory = resolve(process.env.SMOKE_ARTIFACT_DIR || "releases/aidreamcapes-home-local-interactions");
const widths = (process.env.SMOKE_INTERACTION_VIEWPORTS || "1440,390").split(",").map(Number);
const recheckDefaultCta = process.env.SMOKE_RECHECK_DEFAULT_CTA;
const report = { ok: false, home, scope: "Six added modules and original three-step demonstration; the original 38 scene preset links retain their existing navigation.", translationScope: "Chrome-like nested font replacement after explicit React hydration and local-controller readiness.", ssr: null, inventories: [], localControls: [], ctaHandoffs: [], inheritedLocalControls: [], inheritedCtaHandoffs: [], screenshots: [], failures: [], pageErrors: [], serverErrors: [], publicDataRequests: [], localAppRequests: [], blockedRequests: [] };
const q = value => JSON.stringify(value);
const rootFor = (page, name) => page.locator(name === "visualSteps" ? '[data-hx-root="visualSteps"]' : `[data-hx-root][data-home-experience=${q(name)}]`);
const check = (label, operation) => { try { operation(); } catch (error) { report.failures.push(`${label}: ${error.message}`); } };
const flush = () => writeFile(resolve(directory, "local-interaction-acceptance.json"), `${JSON.stringify(report, null, 2)}\n`);

function translateDom() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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
  return { replaced: nodes.length, wrapped: document.querySelectorAll("font font").length };
}

async function pageWithGuards(browser, width, noJs = false) {
  const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 }, javaScriptEnabled: !noJs });
  const state = { phase: "local", action: "initial", width };
  page.on("pageerror", error => report.pageErrors.push({ ...state, message: error.message }));
  page.on("response", response => { if (response.status() >= 500) report.serverErrors.push({ ...state, url: response.url(), status: response.status() }); });
  page.on("request", request => {
    const url = new URL(request.url());
    const publicDocument = new URL(page.url()).pathname === "/site/aidreamcapes";
    if (state.phase === "local" && publicDocument && !url.pathname.startsWith("/_next/static/") && (["fetch", "xhr", "eventsource"].includes(request.resourceType()) || request.headers().rsc || url.searchParams.has("_rsc") || url.pathname.startsWith("/api/") && request.resourceType() !== "image")) report.publicDataRequests.push({ ...state, url: request.url(), type: request.resourceType() });
    if (state.phase === "local" && /\/site\/aidreamcapes\/app(?:\/|$)/.test(url.pathname)) report.localAppRequests.push({ ...state, url: request.url(), type: request.resourceType() });
  });
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    const supplier = /(^|\.)(openai\.com|anthropic\.com|fal\.ai|replicate\.com|runwayml\.com|heygen\.com|elevenlabs\.io|stripe\.com|paypal\.com)$/i.test(url.hostname);
    const unsafeApi = /\/api\/.*(?:quote|reserve|generat|billing|checkout|supplier|provider)/i.test(url.pathname);
    if (!["GET", "HEAD"].includes(request.method()) || supplier || unsafeApi) {
      report.blockedRequests.push({ ...state, url: request.url(), method: request.method() });
      return route.abort("blockedbyclient");
    }
    return route.continue();
  });
  return { page, state };
}

async function ready(page) {
  await page.waitForFunction(() => {
    const pricing = document.querySelector(".v2-pricing-periods button");
    const roots = [...document.querySelectorAll("[data-hx-root]")];
    return pricing && Object.keys(pricing).some(key => key.startsWith("__reactProps$")) && roots.length === 7 && roots.every(root => root.getAttribute("data-hx-ready") === "true");
  }, null, { timeout: 30000 });
}

async function inventory(page, label) {
  const facts = await page.evaluate(() => {
    const han = /[\u3400-\u9fff]/;
    const roots = [...document.querySelectorAll("[data-hx-root]")];
    const attrs = ["alt", "title", "aria-label", "aria-description", "placeholder"];
    return {
      h1: [...document.querySelectorAll("h1")].map(element => element.textContent.trim()),
      scenes: document.querySelectorAll(".v-picker-grid .v-pick-card").length,
      modules: roots.map(root => ({ name: root.getAttribute("data-home-experience") || root.getAttribute("data-hx-root"), heading: root.querySelector("h2")?.textContent.trim(), local: root.querySelectorAll("[data-home-local]").length, ctas: root.querySelectorAll("a[data-home-cta]").length, incorrectLinks: [...root.querySelectorAll("a[href]")].filter(anchor => !anchor.hasAttribute("data-home-cta") && !anchor.getAttribute("href").startsWith("#")).map(anchor => ({ text: anchor.textContent.trim(), href: anchor.getAttribute("href") })), imageLinks: [...root.querySelectorAll("img")].filter(image => !image.closest("dialog") && image.closest("a[href]")) .map(image => image.alt) })),
      bodyHan: document.body.innerText.split("\n").filter(value => han.test(value)),
      attributeHan: [...document.querySelectorAll(attrs.map(name => `[${name}]`).join(","))].flatMap(element => attrs.filter(name => han.test(element.getAttribute(name) || "")).map(name => element.getAttribute(name))),
      seoHan: [...document.querySelectorAll('head title,head meta[content],script[type="application/ld+json"]')].map(element => element.getAttribute("content") || element.textContent).filter(value => han.test(value)),
      layout: { viewport: innerWidth, document: document.documentElement.scrollWidth }
    };
  });
  check(`${label} complete English SSR`, () => { assert.equal(facts.h1.length, 1); assert(/[A-Za-z]/.test(facts.h1[0])); assert.equal(facts.scenes, 38); assert.equal(facts.modules.length, 7); assert.deepEqual(facts.bodyHan, []); assert.deepEqual(facts.attributeHan, []); assert.deepEqual(facts.seoHan, []); });
  check(`${label} scoped images never link to workspace`, () => assert(facts.modules.every(root => root.imageLinks.length === 0), JSON.stringify(facts.modules.filter(root => root.imageLinks.length))));
  check(`${label} only explicit CTAs navigate`, () => assert(facts.modules.every(root => root.incorrectLinks.length === 0), JSON.stringify(facts.modules.filter(root => root.incorrectLinks.length))));
  check(`${label} no horizontal overflow`, () => assert(facts.layout.document <= facts.layout.viewport + 1));
  return facts;
}

async function snapshot(root) {
  return root.evaluate(element => ({
    selected: [...element.querySelectorAll('[data-hx-select-group][aria-pressed="true"]')].map(control => ({ group: control.getAttribute("data-hx-select-group"), value: control.getAttribute("data-hx-select-value") })),
    filters: [...element.querySelectorAll('[data-hx-filter][aria-pressed="true"]')].map(control => control.getAttribute("data-hx-filter")),
    panels: [...element.querySelectorAll("[data-hx-panel-group]")].filter(panel => !panel.hidden).map(panel => ({ group: panel.getAttribute("data-hx-panel-group"), value: panel.getAttribute("data-hx-panel-value") })),
    images: [...element.querySelectorAll("img")].filter(image => !image.closest("dialog") && image.getClientRects().length).map(image => image.currentSrc || image.src),
    text: element.innerText,
    ctas: [...element.querySelectorAll("a[data-home-cta]")].filter(anchor => anchor.getClientRects().length).map(anchor => ({ href: anchor.getAttribute("href"), text: anchor.textContent.trim(), index: [...element.querySelectorAll("a[data-home-cta]")].indexOf(anchor) }))
  }));
}

async function reveal(root, element) {
  const panels = await element.evaluate(node => {
    const result = [];
    for (let ancestor = node.parentElement; ancestor && !ancestor.hasAttribute("data-hx-root"); ancestor = ancestor.parentElement) if (ancestor.hidden && ancestor.hasAttribute("data-hx-panel-group")) result.unshift({ group: ancestor.getAttribute("data-hx-panel-group"), value: ancestor.getAttribute("data-hx-panel-value") });
    return result;
  });
  for (const panel of panels) {
    const group = panel.group.replace(/Cta$/, "");
    const trigger = root.locator(`[data-hx-select-group=${q(group)}][data-hx-select-value=${q(panel.value)}]`).first();
    if (await trigger.count()) {
      await trigger.click();
      if (await root.page().locator("dialog[open]").count()) await root.page().keyboard.press("Escape");
    }
  }
  if (!await element.isVisible()) {
    const all = root.locator('[data-hx-filter="all"]').first();
    if (await all.count()) await all.click();
  }
}

async function saveRootScreenshot(root, name, width) {
  for (const image of await root.locator("img").all()) if (await image.isVisible()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(element => element.decode().catch(() => {})); }
  const path = resolve(directory, `local-${name}-${width}.png`);
  await root.screenshot({ path, style: ".adc2 header.site{visibility:hidden!important}" });
  report.screenshots.push(path);
}

async function testLocalControls(page, state, width, ctaCases) {
  for (const root of await page.locator("[data-hx-root]").all()) {
    const name = await root.getAttribute("data-home-experience") || await root.getAttribute("data-hx-root");
    const controls = await root.locator("[data-home-local]:not([data-hx-close])").all();
    let lastCtaControl;
    const collect = async () => {
      const current = await snapshot(root);
      for (const cta of current.ctas) ctaCases.set(`${name}:${cta.href}`, { root: name, ...cta, selected: current.selected, filters: current.filters, lastCtaControl });
    };
    await collect();
    for (let index = 0; index < controls.length; index++) {
      const control = controls[index];
      const meta = await control.evaluate(element => ({ key: element.getAttribute("data-home-local"), tag: element.tagName, group: element.getAttribute("data-hx-select-group"), value: element.getAttribute("data-hx-select-value"), filter: element.getAttribute("data-hx-filter"), dialog: element.getAttribute("data-hx-dialog"), href: element.getAttribute("href"), ctaHref: element.getAttribute("data-hx-cta-href"), detailsOpen: element.tagName === "SUMMARY" ? element.closest("details").open : undefined }));
      const label = `${width} ${name}/${meta.key}/${index}`;
      state.action = label;
      await reveal(root, control);
      if (!await control.isVisible()) { report.failures.push(`${label}: local control cannot be revealed`); continue; }
      const before = await snapshot(root);
      const beforeUrl = new URL(page.url());
      const appRequestsBefore = report.localAppRequests.length;
      const keyboard = index % 5 === 0;
      try {
        if (keyboard) { await control.scrollIntoViewIfNeeded(); await control.focus(); await control.press("Enter"); }
        else await control.click();
        if (meta.dialog) {
          const dialog = page.locator(`dialog[id=${q(meta.dialog.replace(/^#/, ""))}]`);
          await dialog.waitFor({ state: "visible", timeout: 5000 });
          const dialogFacts = await dialog.evaluate(element => ({ name: element.getAttribute("aria-label") || (element.getAttribute("aria-labelledby") || "").split(/\s+/).map(id => document.getElementById(id)?.textContent || "").join(" ").trim(), focusedInside: element.contains(document.activeElement) }));
          check(`${label} named preview dialog`, () => { assert(dialogFacts.name); assert(dialogFacts.focusedInside); });
          if (!report.screenshots.some(path => path.endsWith(`dialog-${name}-${width}.png`))) {
            for (const image of await dialog.locator("img").all()) { await image.scrollIntoViewIfNeeded(); await image.evaluate(element => element.decode().catch(() => {})); }
            const path = resolve(directory, `dialog-${name}-${width}.png`);
            await dialog.screenshot({ path });
            report.screenshots.push(path);
          }
          await page.keyboard.press("Escape");
          await dialog.waitFor({ state: "hidden" });
          const restored = await control.evaluate(element => document.activeElement === element);
          check(`${label} preview focus returned`, () => assert(restored));
          await control.click();
          await dialog.waitFor({ state: "visible" });
          await dialog.locator("[data-hx-close]").click();
          await dialog.waitFor({ state: "hidden" });
        }
        if (meta.group) {
          await page.waitForFunction(({ rootName, group, value }) => {
            const root = [...document.querySelectorAll("[data-hx-root]")].find(element => (element.getAttribute("data-home-experience") || element.getAttribute("data-hx-root")) === rootName);
            return [...root.querySelectorAll("[data-hx-select-group]")].filter(button => button.getAttribute("data-hx-select-group") === group).every(button => button.getAttribute("aria-pressed") === String(button.getAttribute("data-hx-select-value") === value));
          }, { rootName: name, group: meta.group, value: meta.value }, { timeout: 5000 });
          const panels = await root.locator(`[data-hx-panel-group=${q(meta.group)}]`).evaluateAll(elements => elements.map(element => ({ value: element.getAttribute("data-hx-panel-value"), hidden: element.hidden })));
          check(`${label} matching panel visible`, () => assert(panels.every(panel => panel.hidden === (panel.value !== meta.value))));
          if (["presenter", "scene"].includes(meta.group)) {
            const selectedImage = await root.locator(`[data-hx-panel-group=${q(meta.group)}][data-hx-panel-value=${q(meta.value)}] img`).first().getAttribute("src");
            const controlImage = await control.locator("img").first().getAttribute("src");
            check(`${label} selected main/footer image matches thumbnail`, () => assert.equal(selectedImage, controlImage));
          }
        }
        if (meta.filter) {
          const cards = await root.locator("[data-hx-filter-tags]").evaluateAll(elements => elements.map(element => ({ tags: (element.getAttribute("data-hx-filter-tags") || "").split(/\s+/), hidden: element.hidden })));
          check(`${label} true category filtering`, () => assert(cards.every(card => card.hidden === (meta.filter !== "all" && !card.tags.includes(meta.filter)))));
          const pressed = await control.getAttribute("aria-pressed");
          check(`${label} category selected`, () => assert.equal(pressed, "true"));
        }
        const after = await snapshot(root);
        if (meta.tag === "SUMMARY") {
          const open = await control.evaluate(element => element.closest("details").open);
          check(`${label} voice details toggles locally`, () => assert.equal(open, !meta.detailsOpen));
        }
        if (meta.href?.startsWith("#")) {
          const hash = new URL(page.url()).hash;
          check(`${label} local section anchor`, () => assert.equal(hash, meta.href));
        }
        if (meta.ctaHref) { lastCtaControl = { index, key: meta.key }; check(`${label} selected state has corresponding CTA`, () => assert(after.ctas.some(cta => cta.href === meta.ctaHref))); }
        if (meta.group && !before.selected.some(selected => selected.group === meta.group && selected.value === meta.value)) check(`${label} visible selection feedback`, () => assert.notDeepEqual(after, before));
        const afterUrl = new URL(page.url());
        check(`${label} stays on homepage`, () => { assert.equal(afterUrl.origin, beforeUrl.origin); assert.equal(afterUrl.pathname, beforeUrl.pathname); assert.equal(afterUrl.search, beforeUrl.search); });
        check(`${label} zero app requests`, () => assert.equal(report.localAppRequests.length, appRequestsBefore));
        report.localControls.push({ width, root: name, index, ...meta, keyboard, before, after });
        await collect();
      } catch (error) { report.failures.push(`${label}: ${error.message}`); }
    }
    await saveRootScreenshot(root, name, width);
    console.log(`${width}: local ${name} (${controls.length} controls), failures=${report.failures.length}`);
    await flush();
  }
}

async function testCtas(page, state, width, cases) {
  for (const item of cases.values()) {
    state.phase = "local"; state.action = `restore CTA ${item.root}`;
    await page.goto(home, { waitUntil: "networkidle", timeout: 90000 });
    await ready(page);
    if (width === 390) await page.evaluate(translateDom);
    const root = rootFor(page, item.root);
    for (const selected of item.selected) {
      const button = root.locator(`[data-hx-select-group=${q(selected.group)}][data-hx-select-value=${q(selected.value)}]`).first();
      await reveal(root, button);
      if (await button.isVisible() && await button.getAttribute("aria-pressed") !== "true") { await button.click(); if (await page.locator("dialog[open]").count()) await page.keyboard.press("Escape"); }
    }
    for (const filter of item.filters) await root.locator(`[data-hx-filter=${q(filter)}]`).first().click();
    if (item.lastCtaControl) {
      const control = root.locator("[data-home-local]:not([data-hx-close])").nth(item.lastCtaControl.index);
      await reveal(root, control);
      await control.click();
      if (await page.locator("dialog[open]").count()) await page.keyboard.press("Escape");
    }
    const cta = root.locator("a[data-home-cta]").nth(item.index);
    await reveal(root, cta);
    const actualHref = await cta.getAttribute("href");
    const label = `${width} CTA ${item.root}/${item.text}`;
    check(`${label} selected destination retained`, () => assert.equal(actualHref, item.href));
    if (!await cta.isVisible()) { report.failures.push(`${label}: corresponding CTA is hidden`); continue; }
    state.phase = "guest"; state.action = label;
    try {
      await Promise.all([page.waitForURL(url => url.pathname === "/site/aidreamcapes/app/create", { timeout: 30000 }), cta.click()]);
      await page.waitForLoadState("domcontentloaded");
      const expected = new URL(item.href, home);
      const prompt = expected.searchParams.get("prompt");
      if (prompt) await page.waitForFunction(value => [...document.querySelectorAll("textarea")].some(element => element.value === value), prompt, { timeout: 10000 });
      if (expected.searchParams.get("templates") === "1") await page.getByRole("dialog", { name: "Choose a product template", exact: true }).waitFor();
      const result = await page.evaluate(() => ({ url: location.href, active: document.querySelector('aside a[aria-current="page"]')?.getAttribute("href"), inputs: [...document.querySelectorAll("textarea")].map(element => element.value), selects: [...document.querySelectorAll("select")].map(element => element.value), layout: { width: innerWidth, document: document.documentElement.scrollWidth } }));
      check(`${label} guest handoff`, () => assert.equal(new URL(result.url).pathname, expected.pathname));
      if (prompt) check(`${label} exact brief populated`, () => assert(result.inputs.includes(prompt)));
      if (expected.searchParams.has("preset")) check(`${label} current preset populated`, () => { assert.equal(new URL(result.url).searchParams.get("preset"), expected.searchParams.get("preset")); assert(result.inputs.some(value => value.length > 20)); });
      if (expected.searchParams.has("view") && !expected.searchParams.has("preset")) check(`${label} corresponding workspace view`, () => assert.equal(new URL(result.active, home).searchParams.get("view"), expected.searchParams.get("view")));
      check(`${label} guest responsive layout`, () => assert(result.layout.document <= result.layout.width + 1));
      report.ctaHandoffs.push({ width, root: item.root, href: item.href, text: item.text, result });
    } catch (error) { report.failures.push(`${label}: ${error.message}`); }
    await flush();
  }
}

await mkdir(directory, { recursive: true });
if (process.env.SMOKE_RESUME_FROM) {
  assert(recheckDefaultCta, "Resume mode requires an explicit default CTA target");
  const previousPath = resolve(process.env.SMOKE_RESUME_FROM);
  const previous = JSON.parse(await readFile(previousPath, "utf8"));
  report.previousEvidence = previousPath;
  report.inheritedScreenshots = previous.screenshots;
  report.previousFailuresRechecked = previous.failures;
  report.previousNetworkEvidence = Object.fromEntries(["pageErrors", "serverErrors", "publicDataRequests", "localAppRequests", "blockedRequests"].map(field => [field, previous[field]]));
  report.inheritedLocalControls = previous.localControls.filter(control => !previous.failures.some(failure => failure.startsWith(`${control.width} ${control.root}/${control.key}/${control.index}`)));
  report.inheritedCtaHandoffs = previous.ctaHandoffs.filter(item => {
    const expected = new URL(item.href, home), actual = new URL(item.result.url);
    const prompt = expected.searchParams.get("prompt");
    return actual.pathname === expected.pathname && (!prompt || item.result.inputs.includes(prompt));
  });
  report.defaultCtaRecheckReason = "Restore only controls whose aria-pressed state differs; clicking an already-selected example is itself an intentional local selection and can change its CTA destination.";
}
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" });
try {
  const { page: noJs } = await pageWithGuards(browser, 1440, true);
  const response = await noJs.goto(home, { waitUntil: "domcontentloaded", timeout: 90000 });
  check("SSR HTTP 200", () => assert.equal(response.status(), 200));
  report.ssr = await inventory(noJs, "no-JS");
  await noJs.close();
  for (const width of widths) {
    const { page, state } = await pageWithGuards(browser, width);
    await page.goto(home, { waitUntil: "networkidle", timeout: 90000 });
    await ready(page);
    report.inventories.push({ width, ...await inventory(page, `${width}`) });
    const translation = width === 390 ? await page.evaluate(translateDom) : undefined;
    const ctaCases = new Map();
    if (recheckDefaultCta) {
      const root = rootFor(page, recheckDefaultCta);
      const current = await snapshot(root);
      for (const cta of current.ctas) ctaCases.set(`${recheckDefaultCta}:${cta.href}`, { root: recheckDefaultCta, ...cta, selected: current.selected, filters: current.filters });
      await saveRootScreenshot(root, recheckDefaultCta, width);
    } else await testLocalControls(page, state, width, ctaCases);
    console.log(`${width}: ${ctaCases.size} explicit CTA states to verify`);
    await testCtas(page, state, width, ctaCases);
    report.inventories.at(-1).translation = translation;
    await page.close();
  }
} catch (error) { report.failures.push(error.stack || String(error)); }
finally {
  await browser.close();
  for (const field of ["pageErrors", "serverErrors", "publicDataRequests", "localAppRequests", "blockedRequests"]) check(`zero ${field}`, () => assert.deepEqual(report[field], []));
  if (report.previousNetworkEvidence) for (const [field, values] of Object.entries(report.previousNetworkEvidence)) check(`inherited zero ${field}`, () => assert.deepEqual(values, []));
  if (report.previousEvidence) {
    report.focusedRecheck = { localControls: report.localControls, ctaHandoffs: report.ctaHandoffs };
    report.localControls = [...report.inheritedLocalControls, ...report.localControls];
    report.ctaHandoffs = [...report.inheritedCtaHandoffs, ...report.ctaHandoffs];
    report.evidenceComposition = "Primary arrays combine verified prior records with focused rechecks; inherited arrays and focusedRecheck preserve provenance and are not additional test executions.";
  }
  report.verifiedLocalControlCount = report.localControls.length;
  report.verifiedCtaHandoffCount = report.ctaHandoffs.length;
  if (report.inheritedScreenshots) report.screenshots = [...new Set([...report.inheritedScreenshots, ...report.screenshots])];
  report.ok = report.failures.length === 0;
  await flush();
  console.log(JSON.stringify({ ok: report.ok, localControls: report.verifiedLocalControlCount, ctaHandoffs: report.verifiedCtaHandoffCount, evidence: resolve(directory, "local-interaction-acceptance.json"), screenshots: report.screenshots, failures: report.failures }, null, 2));
  if (!report.ok) process.exitCode = 1;
}
