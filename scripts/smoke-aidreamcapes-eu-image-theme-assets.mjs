#!/usr/bin/env node

import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const sitePrefix = "/site/aidreamcapes-eu/ai-image-generation";
const directoryUrl = `${baseUrl}${sitePrefix}`;
const expectedThemeSlugs = [
  "avatar", "background-changer", "background-remover", "bikini", "black-friday", "boudoir", "cannes",
  "christmas-photo", "color-correction", "cyberpunk", "edit-by-prompt", "engagement-photo", "gala-photo",
  "hairstyle-generator", "halloween-photo", "headshot", "holiday", "mafia", "magic-eraser", "motion-generator",
  "nightlife", "old-photo-restoration", "only-fans", "photo-enhancer", "portrait-photo", "portrait-retouch",
  "rich-lifestyle", "singles-awareness-day", "soccer", "social-cards", "street-style", "swimsuit",
  "thanksgiving-photo", "travel", "unblur-image", "urban", "valentines-photo", "virtual-try-on", "wedding-photo"
];

function unique(values) {
  return [...new Set(values)];
}

function isLegacyMirrorCover(url) {
  return /\/assets\/sites\/site_aidreamcapes_eu\/mirror\/aidreamcapes\/dreamshoot\/generated\/pack-covers\//i.test(url);
}

function isLegacyMirrorGallery01(url) {
  return /\/assets\/sites\/site_aidreamcapes_eu\/mirror\/aidreamcapes\/dreamshoot\/generated\/pack-galleries\/[^/]+\/[^/]+-01\.(?:png|jpe?g|webp|avif)(?:[?#]|$)/i.test(url);
}

async function waitForImages(page) {
  await page.waitForTimeout(900);
  const count = await page.locator("img").count();
  for (let index = 0; index < count; index += 1) {
    const image = page.locator("img").nth(index);
    await image.evaluate((element) => {
      element.loading = "eager";
      element.setAttribute("loading", "eager");
    }).catch(() => {});
    await image.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(500);
  return page.locator("img").evaluateAll((images) => images
    .map((image) => ({
      src: image.currentSrc || image.getAttribute("src") || "",
      alt: image.getAttribute("alt") || "",
      width: image.naturalWidth,
      height: image.naturalHeight,
      complete: image.complete
    }))
    .filter((image) => image.src));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const failures = [];
  try {
    await page.goto(directoryUrl, { waitUntil: "commit", timeout: 30_000 });
    await page.waitForTimeout(900);
    await page.waitForFunction(({ prefix, slugs }) => {
      const hrefs = [...document.querySelectorAll("a[href]")]
        .map((link) => new URL(link.href).pathname)
        .filter((pathname) => pathname.startsWith(`${prefix}/`));
      return slugs.every((slug) => hrefs.includes(`${prefix}/${slug}`));
    }, { prefix: sitePrefix, slugs: expectedThemeSlugs }, { timeout: 10_000 });

    const menuLinks = await page.locator("a").evaluateAll((links) => links
      .filter((link) => (link.textContent || "").trim() === "Cartes sociales")
      .map((link) => link.getAttribute("href") || ""));
    const expectedSocialPath = `${sitePrefix}/social-cards`;
    if (!menuLinks.length || menuLinks.some((href) => href !== expectedSocialPath)) {
      failures.push({ kind: "menu-route", expected: expectedSocialPath, actual: menuLinks });
    }

    const linkedThemePaths = unique(await page.locator(`a[href^="${sitePrefix}/"]`).evaluateAll((links, prefix) => links
      .map((link) => new URL(link.href).pathname)
      .filter((pathname) => pathname.startsWith(`${prefix}/`))
      .filter((pathname) => pathname.slice(prefix.length + 1).split("/").length === 1), sitePrefix));
    const themePaths = expectedThemeSlugs.map((slug) => `${sitePrefix}/${slug}`);
    const missingThemeLinks = expectedThemeSlugs.filter((slug) => !linkedThemePaths.includes(`${sitePrefix}/${slug}`));
    if (missingThemeLinks.length) failures.push({ kind: "missing-theme-links", missing: missingThemeLinks });

    const detailPage = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const seenSeoTitles = new Map();
    const seenSeoDescriptions = new Map();
    let imageRequestFailures = [];
    let badImageResponses = [];
    detailPage.on("requestfailed", (request) => {
      if (request.resourceType() === "image") {
        imageRequestFailures.push({ url: request.url(), error: request.failure()?.errorText || "unknown" });
      }
    });
    detailPage.on("response", (response) => {
      if (response.request().resourceType() === "image" && response.status() >= 400) {
        badImageResponses.push({ url: response.url(), status: response.status() });
      }
    });
    for (const pathname of themePaths) {
      try {
        imageRequestFailures = [];
        badImageResponses = [];
        await detailPage.goto(`${baseUrl}${pathname}`, { waitUntil: "commit", timeout: 30_000 });
        await detailPage.locator("img").first().waitFor({ state: "attached", timeout: 10_000 });
        await detailPage.locator('html[lang="fr"]').waitFor({ state: "attached", timeout: 10_000 });
        const images = await waitForImages(detailPage);
        const broken = images.filter((image) => !image.complete || image.width === 0 || image.height === 0);
        if (broken.length) failures.push({ kind: "broken-image", pathname, broken });
        const genericFrenchAlt = images.filter((image) => /^(?:imagen de escaparate|image de présentation|storefront image)\.?$/i.test(image.alt.trim()));
        if (genericFrenchAlt.length) failures.push({ kind: "generic-alt", pathname, images: genericFrenchAlt });
        const alts = images.map((image) => image.alt.trim()).filter(Boolean);
        const hasLegacyCoverDerivative = images.some((image) => isLegacyMirrorCover(image.src)) && images.some((image) => isLegacyMirrorGallery01(image.src));
        const expectedImageCount = hasLegacyCoverDerivative ? 12 : 13;
        if (images.length !== expectedImageCount) failures.push({ kind: "image-count", pathname, expected: expectedImageCount, actual: images.length });
        if (hasLegacyCoverDerivative && images.some((image) => isLegacyMirrorGallery01(image.src))) {
          failures.push({ kind: "legacy-cover-derivative-rendered", pathname });
        }
        if (alts.length !== expectedImageCount || new Set(alts.map((alt) => alt.toLowerCase())).size !== alts.length) {
          failures.push({ kind: "alt-uniqueness", pathname, count: alts.length, unique: new Set(alts.map((alt) => alt.toLowerCase())).size });
        }
        const head = await detailPage.evaluate(() => ({
          lang: document.documentElement.lang,
          h1: document.querySelectorAll("h1").length,
          h1Text: document.querySelector("h1")?.textContent?.trim() || "",
          title: document.title.trim(),
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
          ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "",
          twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") || "",
          description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
          jsonLd: [...document.querySelectorAll('script[type="application/ld+json"][data-storefront-json-ld="body-marker"]')]
            .map((script) => {
              try {
                return JSON.parse(script.textContent || "{}");
              } catch {
                return { __parseError: true };
              }
            })
        }));
        const slug = pathname.slice(sitePrefix.length + 1);
        const expectedCanonical = `https://aidreamcapes.eu/ai-image-generation/${slug}`;
        const jsonLdNodes = head.jsonLd.flatMap((value) => Array.isArray(value?.["@graph"]) ? value["@graph"] : [value]);
        const webPage = jsonLdNodes.find((node) => node?.["@type"] === "WebPage");
        const breadcrumb = jsonLdNodes.find((node) => node?.["@type"] === "BreadcrumbList");
        const faq = jsonLdNodes.find((node) => node?.["@type"] === "FAQPage");
        const primaryImage = webPage?.primaryImageOfPage?.url || webPage?.primaryImageOfPage?.contentUrl || "";
        const jsonLdText = JSON.stringify(jsonLdNodes);
        const forbiddenJsonLdMarkers = /(?:What is|Which source|How many|Where do|What happens|This package|undefined|image de couverture|cover image)/i;
        const jsonLdProblems = [];
        if (head.jsonLd.length < 1 || head.jsonLd.some((value) => value?.__parseError)) jsonLdProblems.push("missing-or-invalid-json-ld");
        if (!webPage || !breadcrumb) jsonLdProblems.push("missing-webpage-or-breadcrumb");
        if (webPage?.url !== expectedCanonical || webPage?.inLanguage !== "fr-FR") jsonLdProblems.push("webpage-url-or-language");
        if (primaryImage && new URL(primaryImage, expectedCanonical).pathname !== new URL(head.ogImage, expectedCanonical).pathname) jsonLdProblems.push("json-ld-image-mismatch");
        if (forbiddenJsonLdMarkers.test(jsonLdText)) jsonLdProblems.push("english-or-template-json-ld");
        if (jsonLdNodes.some((node) => node?.["@type"] === "CollectionPage")) jsonLdProblems.push("leaf-collection-page");
        if (jsonLdProblems.length) failures.push({ kind: "json-ld", pathname, problems: jsonLdProblems, types: jsonLdNodes.map((node) => node?.["@type"]).filter(Boolean) });
        if (head.lang !== "fr" || head.h1 !== 1 || !head.h1Text || !head.title || head.canonical !== expectedCanonical || !head.description || head.jsonLd.length < 1) {
          failures.push({ kind: "seo-head", pathname, head: { ...head, jsonLd: head.jsonLd.length, faq: Boolean(faq) }, expectedCanonical });
        }
        for (const [field, value, seen] of [["title", head.title, seenSeoTitles], ["description", head.description, seenSeoDescriptions]]) {
          if (!value) continue;
          const previous = seen.get(value);
          if (previous) failures.push({ kind: "duplicate-seo-copy", field, pathname, duplicateOf: previous, value });
          else seen.set(value, pathname);
        }
        if (!head.ogImage || head.ogImage !== head.twitterImage || head.ogImage.includes("professional-headshots")) {
          failures.push({ kind: "social-image", pathname, ogImage: head.ogImage, twitterImage: head.twitterImage });
        }
        if (imageRequestFailures.length) failures.push({ kind: "image-request", pathname, failures: imageRequestFailures });
        if (badImageResponses.length) failures.push({ kind: "image-response", pathname, responses: badImageResponses });
        if (!detailPage.url().startsWith(`${baseUrl}${pathname}`)) {
          failures.push({ kind: "detail-route", pathname, actual: detailPage.url() });
        }
      } catch (error) {
        failures.push({ kind: "detail-request", pathname, error: error instanceof Error ? error.message : String(error) });
      }
    }

    try {
      imageRequestFailures = [];
      badImageResponses = [];
      await detailPage.goto(`${baseUrl}${expectedSocialPath}`, { waitUntil: "commit", timeout: 30_000 });
      await detailPage.locator("img").first().waitFor({ state: "attached", timeout: 10_000 });
      await detailPage.locator('html[lang="fr"]').waitFor({ state: "attached", timeout: 10_000 });
      if (!detailPage.url().includes(expectedSocialPath)) {
        failures.push({ kind: "social-detail-route", actual: detailPage.url() });
      }
      const socialImages = await waitForImages(detailPage);
      const brokenSocialImages = socialImages.filter((image) => !image.complete || image.width === 0 || image.height === 0);
      if (brokenSocialImages.length) failures.push({ kind: "social-broken-image", broken: brokenSocialImages });
      const genericSocialAlt = socialImages.filter((image) => /^(?:imagen de escaparate|image de présentation|storefront image)\.?$/i.test(image.alt.trim()));
      if (genericSocialAlt.length) failures.push({ kind: "social-generic-alt", images: genericSocialAlt });
    } finally {
      await detailPage.close();
    }

    console.log(JSON.stringify({
      ok: failures.length === 0,
      baseUrl,
      themeCount: themePaths.length,
      failures
    }, null, 2));
    process.exitCode = failures.length ? 1 : 0;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
