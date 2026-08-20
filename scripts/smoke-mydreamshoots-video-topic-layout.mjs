#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
const host = process.env.MYDREAMSHOOTS_HOST || "www.mydreamshoots.com";
const topics = [
  "talking-photo",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "ugc-ad-video"
];
const viewports = [
  { name: "mobile", width: 390, height: 844, columns: 1 },
  { name: "tablet", width: 768, height: 1024, columns: 2 },
  { name: "desktop", width: 1280, height: 900, columns: 3 },
  { name: "wide", width: 1440, height: 900, columns: 3 }
];
const sectionOrder = ["hero", "use-cases", "foundation", "guidance", "steps", "value", "trust", "faq", "final-cta"];

function sectionOrderForTopic(topic) {
  if (topic === "ugc-ad-video") {
    return ["hero", "quick-answer", "use-cases", "evidence", "examples", "foundation", "guidance", "creator-native-framing", "how-it-works", "value", "comparison", "trust", "faq", "final-cta"];
  }
  return sectionOrder;
}

function assertOrderedSections(topic, sections) {
  const orderedSections = sectionOrderForTopic(topic);
  const indexes = orderedSections.map((section) => sections.indexOf(section));
  assert(indexes.every((index) => index >= 0), `${topic} is missing a shared section`);
  assert(indexes.every((index, position, values) => position === 0 || index > values[position - 1]), `${topic} section order changed`);
}

const browser = await chromium.launch({ headless: true });
const checked = [];
try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      extraHTTPHeaders: { "x-forwarded-host": host }
    });
    try {
      for (const topic of topics) {
        const page = await context.newPage();
        try {
          const response = await page.goto(`${baseUrl}/ai-video-generation/${topic}`, { waitUntil: "networkidle", timeout: 30_000 });
          assert.equal(response?.status(), 200, `${topic} ${viewport.name} should return HTTP 200`);
          await page.locator("[data-video-topic-section=\"use-cases\"]").scrollIntoViewIfNeeded();
          await page.waitForFunction(
            () => [...document.querySelectorAll("[data-video-topic-use-case-card] img")].every((image) => image.complete && image.naturalWidth > 0),
            undefined,
            { timeout: 15_000 }
          );
          const result = await page.evaluate(() => {
            const cards = [...document.querySelectorAll("[data-video-topic-use-case-card]")];
            const heroFrame = document.querySelector("[data-video-topic-hero-media]");
            const heroImage = heroFrame?.querySelector("img");
            const cardRects = cards.map((card) => card.getBoundingClientRect());
            const firstRowTop = cardRects[0]?.top ?? 0;
            const firstRow = cardRects.filter((rect) => Math.abs(rect.top - firstRowTop) < 2);
            const workspaceCtas = [...document.querySelectorAll('a[href*="/app/create?videoMode="]')];
            const sectionNames = [...document.querySelectorAll("[data-video-topic-section]")].map((section) => section.getAttribute("data-video-topic-section"));
            const media = cards.map((card) => {
              const frame = card.querySelector("[data-video-topic-media]");
              const image = card.querySelector("img");
              const frameRect = frame?.getBoundingClientRect();
              return {
                width: frameRect ? Math.round(frameRect.width) : 0,
                height: frameRect ? Math.round(frameRect.height) : 0,
                objectFit: image ? getComputedStyle(image).objectFit : "",
                src: image?.getAttribute("src") || "",
                alt: image?.getAttribute("alt") || "",
                loaded: Boolean(image?.complete && image.naturalWidth > 0)
              };
            });
            return {
              pageMarker: document.querySelectorAll("[data-video-topic-page]").length,
              hero: {
                width: heroFrame ? Math.round(heroFrame.getBoundingClientRect().width) : 0,
                height: heroFrame ? Math.round(heroFrame.getBoundingClientRect().height) : 0,
                objectFit: heroImage ? getComputedStyle(heroImage).objectFit : ""
              },
              cards: cards.length,
              columns: firstRow.length,
              firstRowWidthDelta: firstRow.length ? Math.max(...firstRow.map((rect) => rect.width)) - Math.min(...firstRow.map((rect) => rect.width)) : Infinity,
              firstRowBottomDelta: firstRow.length ? Math.max(...firstRow.map((rect) => rect.bottom)) - Math.min(...firstRow.map((rect) => rect.bottom)) : Infinity,
              cardLinks: cards.flatMap((card) => [...card.querySelectorAll("a")].map((link) => link.getAttribute("href"))),
              media,
              workspaceCtaCount: workspaceCtas.length,
              workspaceCtaHrefs: workspaceCtas.map((link) => link.getAttribute("href")),
              workspaceCtaNoWrap: workspaceCtas.every((link) => getComputedStyle(link).whiteSpace === "nowrap"),
              sectionNames,
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              hasDuplicateGallery: document.body.innerText.includes("Meme Video Examples") || document.body.innerText.includes("See More Meme Examples")
            };
          });
          assert.equal(result.pageMarker, 1, `${topic} ${viewport.name} should render one shared page marker`);
          assert.equal(result.hero.objectFit, "cover", `${topic} ${viewport.name} hero image must use cover`);
          assert.equal(Math.abs(result.hero.width / result.hero.height - 16 / 9) < 0.04, true, `${topic} ${viewport.name} hero media must use a 16:9 frame`);
          assert.equal(result.cards, 6, `${topic} ${viewport.name} should render six use-case cards`);
          assert.equal(result.columns, viewport.columns, `${topic} ${viewport.name} should render ${viewport.columns} use-case columns`);
          assert.equal(result.firstRowWidthDelta < 2, true, `${topic} ${viewport.name} first-row cards must have equal widths`);
          assert.equal(result.firstRowBottomDelta < 2, true, `${topic} ${viewport.name} first-row cards must align at the bottom`);
          assert.equal(result.media.length, 6, `${topic} ${viewport.name} should render six use-case media frames`);
          assert.equal(new Set(result.media.map((media) => media.src)).size, 6, `${topic} ${viewport.name} use-case images must be unique`);
          assert.equal(result.media.every((media) => media.loaded && media.alt.trim()), true, `${topic} ${viewport.name} use-case images must load with alt text`);
          assert.equal(result.media.every((media) => media.objectFit === "cover"), true, `${topic} ${viewport.name} use-case images must use cover`);
          assert.equal(result.media.every((media) => Math.abs(media.width / media.height - 16 / 9) < 0.04), true, `${topic} ${viewport.name} media must use 16:9 frames`);
          assert.equal(result.cardLinks.length, 0, `${topic} ${viewport.name} use-case cards must not expose repeated actions`);
          assert.equal(result.workspaceCtaCount, 3, `${topic} ${viewport.name} should expose hero, steps, and final workspace CTAs`);
          assert.equal(new Set(result.workspaceCtaHrefs).size, 1, `${topic} ${viewport.name} workspace CTAs must share one destination`);
          assert.equal(result.workspaceCtaNoWrap, true, `${topic} ${viewport.name} workspace CTA labels must not wrap`);
          assert.equal(result.hasDuplicateGallery, false, `${topic} ${viewport.name} must not render the legacy Meme gallery`);
          assert.equal(result.scrollWidth, result.clientWidth, `${topic} ${viewport.name} must not overflow horizontally`);
          assertOrderedSections(topic, result.sectionNames);
          checked.push({ topic, viewport: viewport.name });
        } finally {
          await page.close();
        }
      }
    } finally {
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, checked: checked.length, topics: topics.length, viewports: viewports.length }, null, 2));
