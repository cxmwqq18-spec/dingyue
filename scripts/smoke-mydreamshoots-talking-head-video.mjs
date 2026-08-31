#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
const host = process.env.MYDREAMSHOOTS_HOST || "www.mydreamshoots.com";
const url = `${baseUrl}/site/mydreamshoots/ai-video-generation/talking-head-video`;
const expectedSections = [
  "hero",
  "quick-answer",
  "use-cases",
  "evidence",
  "foundation",
  "guidance",
  "supporting",
  "steps",
  "value",
  "trust",
  "faq",
  "final-cta"
];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { "x-forwarded-host": host }
  });
  const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
  assert.equal(response?.status(), 200, "Talking Head Video should return HTTP 200");
  await page.locator('[data-video-topic-section="use-cases"]').scrollIntoViewIfNeeded();
  await page.waitForFunction(
    () => [...document.querySelectorAll("[data-video-topic-hero-media] img, [data-video-topic-use-case-card] img")].every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: 15_000 }
  );

  const result = await page.evaluate(() => {
    const sectionNames = [...document.querySelectorAll("[data-video-topic-section]")].map((section) => section.getAttribute("data-video-topic-section"));
    const heroImages = [...document.querySelectorAll("[data-video-topic-hero-media] img")];
    const useCaseCards = [...document.querySelectorAll("[data-video-topic-use-case-card]")];
    const faqQuestions = [...document.querySelectorAll('[data-video-topic-section="faq"] summary span')].map((item) => item.textContent?.trim() || "");
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
      try { return [JSON.parse(script.textContent || "")]; } catch { return []; }
    });
    const faqNode = jsonLd.flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (Array.isArray(value?.["@graph"])) return value["@graph"];
      return [value];
    }).find((node) => node?.["@type"] === "FAQPage");
    return {
      pageMarker: document.querySelectorAll('[data-video-topic-page="talking-head-video"]').length,
      heroImages: heroImages.length,
      heroSources: heroImages.map((image) => image.getAttribute("src") || ""),
      heroAlt: heroImages.map((image) => image.getAttribute("alt") || ""),
      useCases: useCaseCards.length,
      useCaseSources: useCaseCards.map((card) => card.querySelector("img")?.getAttribute("src") || ""),
      useCaseAlt: useCaseCards.map((card) => card.querySelector("img")?.getAttribute("alt") || ""),
      sectionNames,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") || "",
      faqQuestions,
      faqNodeQuestions: faqNode?.mainEntity?.map((item) => item.name) || [],
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    };
  });

  assert.equal(result.pageMarker, 1, "should render one Talking Head page marker");
  assert.equal(result.heroImages, 3, "hero should render three unique preview images");
  assert.equal(new Set(result.heroSources).size, 3, "hero image sources must be unique");
  assert.equal(result.heroAlt.every(Boolean), true, "hero images must have alt text");
  assert.equal(result.useCases, 8, "should render eight talking-head directions");
  assert.equal(new Set(result.useCaseSources).size, 8, "direction image sources must be unique");
  assert.equal(result.useCaseAlt.every(Boolean), true, "direction images must have alt text");
  assert.deepEqual(result.sectionNames, expectedSections, "Talking Head section order changed");
  assert.match(result.title, /AI Talking Head Video Generator for Business & Social/);
  assert.match(result.description, /AI talking head videos/);
  assert.match(result.canonical, /\/ai-video-generation\/talking-head-video$/);
  assert.match(result.robots, /(?:^|[ ,])index(?:$|[ ,])/i, "public topic page must be indexable");
  assert.match(result.robots, /(?:^|[ ,])follow(?:$|[ ,])/i, "public topic page must allow crawling");
  assert.doesNotMatch(result.robots, /noindex/i, "public topic page must never emit noindex");
  assert.equal(result.faqQuestions.length, 6, "visible FAQ should contain six questions");
  assert.equal(result.faqNodeQuestions.length, 6, "FAQ JSON-LD should contain six questions");
  assert.deepEqual(result.faqNodeQuestions, result.faqQuestions, "FAQ JSON-LD should match visible FAQ questions");
  assert.equal(result.scrollWidth, result.clientWidth, "page must not overflow horizontally");
  console.log(JSON.stringify({ ok: true, url, ...result }, null, 2));
} finally {
  await browser.close();
}
