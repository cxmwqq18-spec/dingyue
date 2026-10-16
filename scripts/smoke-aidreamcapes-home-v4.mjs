#!/usr/bin/env node
/** Read-only integrated acceptance. No fixtures, customer mutations or supplier calls. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const base = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const expectedLanguage = process.env.SMOKE_EXPECT_LANGUAGE || "zh";
assert(["zh", "en"].includes(expectedLanguage), "SMOKE_EXPECT_LANGUAGE must be zh or en");
const englishMode = expectedLanguage === "en";
const artifactDir = resolve(process.env.SMOKE_ARTIFACT_DIR || (englishMode ? "releases/aidreamcapes-home-v4-english-fix" : "releases/aidreamcapes-home-v4-implementation"));
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/Users/a1/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const homepage = `${base}/site/aidreamcapes`;
const kinds = ["hero", "picker", "steps", "features", "audience", "reviews"];
const baseline = {
  originalSections: 13,
  sceneCards: 38,
  categoryChips: 20,
  myDreamShootsMainSha256: "6d7417a73d32ac317ab17c8ecd2f9473bfdb15b9902db56ce013e116fe35a01d"
};
const socialLinks = [
  ["Facebook", "https://www.facebook.com/AiVideosUGC/"],
  ["Instagram", "https://www.instagram.com/aivideosugc/"],
  ["Pinterest", "https://www.pinterest.com/AiVideosUGC/"],
  ["X", "https://x.com/AiVideosUGC"],
  ["YouTube", "https://www.youtube.com/@AiVideosUGC"],
  ["TikTok", "https://www.tiktok.com/@aivideosugc"],
  ["Reddit", "https://www.reddit.com/user/AiVideosUGC/"],
  ["WhatsApp", "https://whatsapp.com/channel/0029VbEAEkJKbYMG01djdZ36"],
  ["Discord", "https://discord.gg/F52827j3Nm"]
];
const report = { ok: false, homepage, expectedLanguage, baseline, runs: [], pageErrors: [], serverErrors: [], publicDataRequests: [], blockedRequests: [], guestReads: [], failures: [], screenshots: [], overviewScreenshots: [] };
const check = (label, callback) => { try { callback(); } catch (error) { report.failures.push(`${label}: ${error.message}`); } };
const chinese = /[\u3400-\u9fff]/;
// Hide only the floating navigation while isolating lower-page sections for visual review.
const screenshotStyle = ".adc2 header.site{visibility:hidden!important}";

function monitor(page, phase) {
  page.on("pageerror", error => report.pageErrors.push({ phase, message: error.message }));
  page.on("response", response => {
    if (response.status() >= 500) report.serverErrors.push({ phase, status: response.status(), url: response.url() });
  });
  page.on("request", request => {
    const url = new URL(request.url());
    const api = url.pathname.startsWith("/api/");
    if (phase.startsWith("public") && (["fetch", "xhr", "eventsource"].includes(request.resourceType()) || request.headers().rsc || url.searchParams.has("_rsc") || api && request.resourceType() !== "image")) {
      report.publicDataRequests.push({ phase, url: request.url(), type: request.resourceType() });
    }
    if (phase === "guest" && api) report.guestReads.push({ url: request.url(), method: request.method() });
  });
  return page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    const supplier = /(^|\.)(openai\.com|anthropic\.com|fal\.ai|replicate\.com|runwayml\.com|heygen\.com|elevenlabs\.io|stripe\.com|paypal\.com)$/i.test(url.hostname);
    const dangerous = /\/api\/.*(?:generate|generation|quote|reserve|billing|checkout|supplier|provider)(?:\/|\?|$)/i.test(url.pathname);
    if (!["GET", "HEAD"].includes(request.method()) || supplier || dangerous) {
      report.blockedRequests.push({ phase, url: request.url(), method: request.method() });
      await route.abort("blockedbyclient");
    } else await route.continue();
  });
}

async function inspect(page, phase) {
  const facts = await page.evaluate(() => {
    const main = document.querySelector(".home-v2");
    const originals = [...(main?.children || [])].filter(element => element.tagName === "SECTION" && !element.hasAttribute("data-home-experience"));
    const han = /[\u3400-\u9fff]/;
    const languageAttributes = ["alt", "title", "aria-label", "aria-description", "aria-valuetext", "placeholder"];
    const rect = selector => document.querySelector(selector)?.getBoundingClientRect().toJSON();
    return {
      h1: [...document.querySelectorAll("h1")].map(element => element.textContent.trim()),
      originals: originals.map(element => ({ heading: element.querySelector("h2")?.textContent.trim() || "", class: element.className })),
      ctaBands: document.querySelectorAll(".home-v2 > .wrap").length,
      additions: [...document.querySelectorAll("[data-home-experience]")].map(element => ({ kind: element.getAttribute("data-home-experience"), heading: element.querySelector("h2")?.textContent.trim() || "", images: element.querySelectorAll("img").length })),
      scenes: document.querySelectorAll(".v-picker-grid .v-pick-card").length,
      categories: document.querySelectorAll(".v-picker-chips > label").length,
      faqItems: document.querySelectorAll("#faq details").length,
      layout: { viewport: innerWidth, document: document.documentElement.scrollWidth },
      geometry: {
        selectedImage: rect(".hx-selected img"),
        selectedText: rect(".hx-selected > div"),
        selectorButton: rect(".hx-selector-footer > .hx-button"),
        heroCaption: rect(".hx-phone .hx-caption"),
        heroVersion: rect(".hx-mini-version")
      },
      footer: [...document.querySelectorAll("footer a")].map(element => ({ label: element.textContent.trim(), href: element.getAttribute("href"), target: element.target, rel: element.rel, logo: !!element.querySelector("svg") })),
      templateLinks: [...document.querySelectorAll('a[href*="templates=1"]')].map(element => ({ label: element.textContent.trim(), href: element.getAttribute("href") })),
      monthly: [...document.querySelectorAll(".v2-pricing-amount strong")].map(element => element.textContent.trim()),
      headings: [...document.querySelectorAll(".home-v2 h2")].map(element => element.textContent.trim()),
      englishAudit: {
        htmlLanguage: document.documentElement.lang,
        title: document.title,
        visibleHan: document.body.innerText.split("\n").map(value => value.trim()).filter(value => han.test(value)),
        attributeHan: [...document.querySelectorAll(languageAttributes.map(name => `[${name}]`).join(","))].flatMap(element => languageAttributes.filter(name => han.test(element.getAttribute(name) || "")).map(name => ({ tag: element.tagName, attribute: name, value: element.getAttribute(name) }))),
        seoHan: [...document.head.querySelectorAll("title,meta[content]")].map(element => ({ tag: element.tagName, name: element.getAttribute("name") || element.getAttribute("property") || "title", value: element.getAttribute("content") || element.textContent })).filter(item => han.test(item.value)),
        structuredDataHan: [...document.querySelectorAll('script[type="application/ld+json"]')].map((element, index) => ({ index, value: element.textContent })).filter(item => han.test(item.value))
      },
      sequenceMarkers: {
        definition: [...document.querySelectorAll(".home-v4 .ideas.v-numbered-cards .v-card-number")].map(element => element.textContent.trim()),
        workflow: [...document.querySelectorAll(".home-v4 .ben.v-numbered-cards .v-card-number")].map(element => element.textContent.trim())
      },
      media: [...new Set([...document.querySelectorAll(".home-v2 img,.home-v2 video,.home-v2 source")].flatMap(element => [element.getAttribute("src"), element.getAttribute("poster"), ...(element.getAttribute("srcset") || "").split(",").map(source => source.trim().split(/\s+/)[0])]).filter(Boolean))]
    };
  });
  check(`${phase} H1`, () => {
    assert.equal(facts.h1.length, 1);
    if (englishMode) assert.equal(facts.h1[0], process.env.SMOKE_EXPECT_H1 || "Create AI UGC Videos from Your Product Photos");
    else assert(chinese.test(facts.h1[0]));
  });
  check(`${phase} original sections retained`, () => { assert.equal(facts.originals.length, baseline.originalSections); assert(facts.ctaBands >= 1); });
  check(`${phase} six SSR additions`, () => assert.deepEqual(facts.additions.map(item => item.kind), kinds));
  check(`${phase} original scenes retained`, () => assert.equal(facts.scenes, baseline.sceneCards));
  check(`${phase} original scene filters retained`, () => assert.equal(facts.categories, baseline.categoryChips));
  if (englishMode) {
    check(`${phase} English section copy`, () => assert(facts.headings.every(heading => !chinese.test(heading) && /[A-Za-z]/.test(heading)), `Non-English headings: ${facts.headings.filter(heading => chinese.test(heading) || !/[A-Za-z]/.test(heading)).join(" | ")}`));
    check(`${phase} English document language`, () => assert(/^en(?:-|$)/i.test(facts.englishAudit.htmlLanguage), facts.englishAudit.htmlLanguage));
    for (const field of ["visibleHan", "attributeHan", "seoHan", "structuredDataHan"]) {
      check(`${phase} no Chinese in ${field}`, () => assert.deepEqual(facts.englishAudit[field], []));
    }
    check(`${phase} six English addition headings`, () => assert(facts.additions.every(item => /[A-Za-z]/.test(item.heading) && !chinese.test(item.heading))));
  } else {
    check(`${phase} Chinese section copy`, () => assert(facts.headings.every(heading => chinese.test(heading)), `Untranslated headings: ${facts.headings.filter(heading => !chinese.test(heading)).join(" | ")}`));
  }
  check(`${phase} horizontal overflow`, () => assert(facts.layout.document <= facts.layout.viewport + 1, JSON.stringify(facts.layout)));
  const overlap = (a, b) => a && b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : Infinity;
  check(`${phase} template selected product thumbnail`, () => { assert(facts.geometry.selectedImage.width <= 96); assert(facts.geometry.selectedImage.height <= 96); });
  check(`${phase} template selected text has readable width`, () => assert(facts.geometry.selectedText.width >= 110));
  check(`${phase} template CTA does not cover selected text`, () => assert(overlap(facts.geometry.selectedText, facts.geometry.selectorButton) <= 1, JSON.stringify(facts.geometry)));
  check(`${phase} hero version card does not cover caption`, () => assert(overlap(facts.geometry.heroCaption, facts.geometry.heroVersion) <= 1, JSON.stringify(facts.geometry)));
  check(`${phase} monthly prices`, () => assert.deepEqual(facts.monthly, ["$24.50", "$35", "$63"]));
  check(`${phase} definition sequence markers`, () => assert.deepEqual(facts.sequenceMarkers.definition, ["01", "02", "03", "04"]));
  check(`${phase} workflow sequence markers`, () => assert.deepEqual(facts.sequenceMarkers.workflow, ["01", "02", "03", "04", "05", "06"]));
  check(`${phase} template dialog links`, () => assert(facts.templateLinks.some(link => link.href.includes("/app/create?view=home&templates=1"))));
  for (const [label, href] of socialLinks) check(`${phase} ${label} footer`, () => {
    const links = facts.footer.filter(link => link.href === href);
    assert.equal(links.length, 1, `Expected one link to ${href}`);
    assert(links[0].logo, "Missing media SVG logo");
    assert.equal(links[0].target, "_blank");
    assert(links[0].rel.split(/\s+/).includes("noopener"));
  });
  check(`${phase} nine social media icons`, () => assert.equal(facts.footer.filter(link => socialLinks.some(([, href]) => href === link.href) && link.logo).length, 9));
  facts.staticMediaAudit = [];
  for (const source of facts.media) {
    const url = new URL(source, homepage);
    const localFile = resolve("public", `.${decodeURIComponent(url.pathname)}`);
    let localExists = false;
    try { localExists = (await stat(localFile)).isFile(); } catch {}
    const result = { source, pathname: url.pathname, query: url.search, localFile, localExists };
    facts.staticMediaAudit.push(result);
    check(`${phase} site-owned static media ${source}`, () => {
      assert(url.pathname.startsWith("/assets/sites/site_aidreamcapes/"), "Homepage media must use site-owned /assets paths");
      assert(!url.pathname.startsWith("/api/"), "Dynamic/proxy media is forbidden");
      assert(localExists, `Missing static media ${localFile}`);
    });
  }
  return facts;
}

async function loadImages(page) {
  for (let y = 0; y < await page.evaluate(() => document.documentElement.scrollHeight); y += 700) {
    await page.evaluate(value => scrollTo(0, value), y);
    await page.waitForTimeout(65);
  }
  await page.evaluate(async () => {
    await Promise.race([Promise.all([...document.images].map(image => image.decode().catch(() => {}))), new Promise(resolve => setTimeout(resolve, 15000))]);
    scrollTo(0, 0);
  });
  return page.evaluate(() => [...document.images].filter(image => image.getClientRects().length && !image.naturalWidth).map(image => ({ src: image.currentSrc || image.src, alt: image.alt })));
}

await mkdir(artifactDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath });
try {
  // Read-only cross-store regression: content hash ignores headers/dev bootstrap scripts.
  const mds = await browser.newPage({ javaScriptEnabled: false });
  const mdsResponse = await mds.goto(`${base}/site/mydreamshoots`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const mdsMain = await mds.locator("main").innerHTML();
  report.myDreamShoots = { status: mdsResponse.status(), mainSha256: createHash("sha256").update(mdsMain).digest("hex") };
  check("MyDreamShoots unchanged", () => { assert.equal(report.myDreamShoots.status, 200); assert.equal(report.myDreamShoots.mainSha256, baseline.myDreamShootsMainSha256); });
  await mds.close();

  const noJs = await browser.newPage({ javaScriptEnabled: false, viewport: { width: 1440, height: 1000 } });
  await monitor(noJs, "public-no-js");
  const ssrResponse = await noJs.goto(homepage, { waitUntil: "domcontentloaded", timeout: 90000 });
  check("SSR response", () => assert.equal(ssrResponse.status(), 200));
  report.runs.push({ phase: "public-no-js", ...await inspect(noJs, "public-no-js") });
  await noJs.close();

  for (const width of [1440, 390]) {
    const phase = `public-${width}`;
    const page = await browser.newPage({ viewport: { width, height: width === 390 ? 844 : 1000 } });
    await monitor(page, phase);
    const response = await page.goto(homepage, { waitUntil: "networkidle", timeout: 90000 });
    check(`${phase} HTTP status`, () => assert.equal(response.status(), 200));
    const brokenImages = await loadImages(page);
    check(`${phase} images loaded`, () => assert.deepEqual(brokenImages, []));
    const facts = await inspect(page, phase);
    report.runs.push({ phase, ...facts, brokenImages });
    const screenshot = resolve(artifactDir, `home-v4-${width}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    report.overviewScreenshots.push(screenshot);
    for (const kind of kinds) {
      const sectionScreenshot = resolve(artifactDir, `home-v4-${kind}-${width}.png`);
      await page.locator(`[data-home-experience="${kind}"]`).screenshot({ path: sectionScreenshot, style: screenshotStyle });
      report.screenshots.push(sectionScreenshot);
    }
    for (const [name, selector] of [["numbered-definition", ".ideas.v-numbered-cards"], ["numbered-workflow", ".ben.v-numbered-cards"]]) {
      const numberedScreenshot = resolve(artifactDir, `home-v4-${name}-${width}.png`);
      await page.locator(selector).locator("xpath=ancestor::section[1]").screenshot({ path: numberedScreenshot, style: screenshotStyle });
      report.screenshots.push(numberedScreenshot);
    }
    const footerScreenshot = resolve(artifactDir, `home-v4-footer-${width}.png`);
    await page.locator("footer").screenshot({ path: footerScreenshot, style: screenshotStyle });
    report.screenshots.push(footerScreenshot);
    const pricing = page.locator("#pricing");
    const buttons = pricing.locator(".v2-pricing-periods button");
    check(`${phase} three billing plans`, () => assert.equal(facts.monthly.length, 3));
    const buttonTexts = await buttons.allTextContents();
    check(`${phase} billing controls language`, () => {
      assert.equal(buttonTexts.length, 2);
      if (englishMode) assert.deepEqual(buttonTexts, ["Monthly", "Yearly"]);
      else assert(buttonTexts.every(value => chinese.test(value)));
    });
    await buttons.nth(1).click();
    await page.waitForFunction(() => document.querySelector(".v2-pricing-content")?.getAttribute("data-active-billing-period") === "year");
    const yearly = await pricing.locator(".v2-pricing-amount strong").allTextContents();
    check(`${phase} annual prices preserved`, () => assert.deepEqual(yearly, ["$147", "$210", "$378"]));
    const pricingText = await pricing.innerText();
    check(`${phase} pricing language`, () => {
      if (englishMode) { assert(!chinese.test(pricingText)); assert(/credits/.test(pricingText)); }
      else { assert(chinese.test(pricingText)); assert(!/credits|billed yearly|Checkout coming soon|Plan details/.test(pricingText)); }
    });
    await pricing.screenshot({ path: resolve(artifactDir, `home-v4-pricing-year-${width}.png`) });
    await page.close();
  }

  const guest = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await monitor(guest, "guest");
  await guest.goto(`${base}/site/aidreamcapes/app/create?view=home&templates=1`, { waitUntil: "networkidle", timeout: 90000 });
  const dialog = guest.getByRole("dialog");
  await dialog.waitFor({ state: "visible", timeout: 30000 });
  const templateDialog = { url: guest.url(), text: (await dialog.innerText()).slice(0, 1000), images: await dialog.locator("img").count(), buttons: await dialog.getByRole("button").allTextContents() };
  check("guest template dialog displays scenes", () => assert(templateDialog.images > 0));
  report.templateDialog = templateDialog;
  const guestScreenshot = resolve(artifactDir, "home-v4-template-dialog.png");
  await guest.screenshot({ path: guestScreenshot, fullPage: false });
  report.screenshots.push(guestScreenshot);
  await guest.close();
} catch (error) {
  report.failures.push(`${error.stack || error}`);
} finally {
  await browser.close();
  check("zero browser errors", () => assert.deepEqual(report.pageErrors, []));
  check("zero HTTP 5xx", () => assert.deepEqual(report.serverErrors, []));
  check("public SSR has no browser data requests", () => assert.deepEqual(report.publicDataRequests, []));
  check("no mutation/provider/generation attempts", () => assert.deepEqual(report.blockedRequests, []));
  report.ok = report.failures.length === 0;
  await writeFile(resolve(artifactDir, "browser-acceptance.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ok: report.ok, evidence: resolve(artifactDir, "browser-acceptance.json"), screenshots: report.screenshots, failures: report.failures }, null, 2));
  if (!report.ok) process.exitCode = 1;
}
