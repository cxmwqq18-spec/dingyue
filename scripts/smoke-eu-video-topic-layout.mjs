#!/usr/bin/env node
import assert from "node:assert/strict";
import { chromium } from "playwright";

const production = process.env.SMOKE_PRODUCTION === "1";
const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
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
  "promo-video",
  "ugc-ad-video",
  "video-ad",
  "brand-video",
  "music-video",
  "fashion-video",
  "food-video",
  "pet-video"
];
const stores = [
  { name: "spanish", basePath: "/site/aidreamshoots", host: "aidreamshoots.eu" },
  { name: "french", basePath: "/site/aidreamcapes-eu", host: "aidreamcapes.eu" }
];
const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 }
];

function closeTo(actual, expected, tolerance = 0.04) {
  return Math.abs(actual - expected) <= tolerance;
}

async function loadLazyMedia(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(window.innerHeight, 1)) {
      window.scrollTo(0, y);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll("[data-video-topic-hero-media] img, [data-video-topic-use-case-card] img, [data-video-ad-scene] img, [data-brand-video-scene] img, [data-scene-topic-scene] img")].every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: 30_000 }
  );
  await page.waitForFunction(
    () => [...document.querySelectorAll("[data-video-topic-hero-media] video")].every((video) => video.readyState >= 1),
    undefined,
    { timeout: 15_000 }
  ).catch(() => {});
}

function assertCardMedia(result, label) {
  assert(result.cards.length > 0, `${label} should render image cards`);
  assert(result.cards.every((card) => card.frameWidth > 0 && card.frameHeight > 0), `${label} cards must have visible media frames`);
  assert(result.cards.every((card) => closeTo(card.frameWidth / card.frameHeight, 4 / 3)), `${label} cards must use 4:3 frames`);
  assert(result.cards.every((card) => card.loaded && card.alt.trim()), `${label} card images must load with alt text`);
  assert(result.cards.every((card) => card.objectFit === "cover"), `${label} card images must use object-fit: cover`);
  assert(result.cards.every((card) => card.objectFit !== "fill"), `${label} card images must not use object-fit: fill`);
  assert(result.cards.every((card) => card.alignSelf === "flex-start"), `${label} cards must keep natural height`);
  assert(result.cards.every((card) => card.bottomGap <= 3), `${label} cards must not contain trailing blank space`);
}

const browser = await chromium.launch({ headless: true });
let checked = 0;
try {
  for (const store of stores) {
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        for (const topic of topics) {
          const page = await context.newPage();
          try {
            const origin = production ? `https://${store.host}` : baseUrl;
            const routePrefix = production ? "" : store.basePath;
            const response = await page.goto(`${origin}${routePrefix}/ai-video-generation/${topic}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
            assert.equal(response?.status(), 200, `${store.name}/${topic} ${viewport.name} should return HTTP 200`);
            await page.waitForSelector("[data-video-topic-page]", { timeout: 15_000 });
            await loadLazyMedia(page);
            const result = await page.evaluate((expectedTopic) => {
              const cardNodes = [
                ...document.querySelectorAll("[data-video-topic-use-case-card]"),
                ...document.querySelectorAll("[data-video-ad-scene]"),
                ...document.querySelectorAll("[data-brand-video-scene]"),
                ...document.querySelectorAll("[data-scene-topic-scene]")
              ];
              const cards = cardNodes.map((card) => {
                const frame = card.querySelector("[data-video-topic-media]") || card.querySelector(":scope > div");
                const image = frame?.querySelector("img") || card.querySelector("img");
                const cardRect = card.getBoundingClientRect();
                const lastChildRect = card.lastElementChild?.getBoundingClientRect();
                const frameRect = frame?.getBoundingClientRect();
                return {
                  frameWidth: frameRect?.width ?? 0,
                  frameHeight: frameRect?.height ?? 0,
                  objectFit: image ? getComputedStyle(image).objectFit : "",
                  alignSelf: getComputedStyle(card).alignSelf,
                  bottomGap: lastChildRect ? cardRect.bottom - lastChildRect.bottom : Infinity,
                  src: image?.currentSrc || image?.getAttribute("src") || "",
                  alt: image?.getAttribute("alt") || "",
                  loaded: Boolean(image?.complete && image.naturalWidth > 0)
                };
              });
              const videoHeroes = [...document.querySelectorAll("[data-video-topic-hero-media] video")].map((video) => {
                const frame = video.parentElement?.getBoundingClientRect();
                return {
                  ratio: frame && frame.height > 0 ? frame.width / frame.height : 0,
                  sourceRatio: Number(video.getAttribute("width")) / Number(video.getAttribute("height")),
                  objectFit: getComputedStyle(video).objectFit,
                  loaded: video.readyState >= 1
                };
              });
              const pageMarker = document.querySelector("[data-video-topic-page]");
              return {
                pageTopic: pageMarker?.getAttribute("data-video-topic-page") || "",
                cards,
                videoHeroes,
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth,
                brokenImages: [...document.querySelectorAll("[data-video-topic-hero-media] img, [data-video-topic-use-case-card] img, [data-video-ad-scene] img, [data-brand-video-scene] img, [data-scene-topic-scene] img")].filter((image) => !image.complete || image.naturalWidth === 0).length,
                hasTranslateExclusion: Boolean(document.documentElement.getAttribute("translate") === "no" || document.body?.classList.contains("notranslate"))
              };
            }, topic);
            const label = `${store.name}/${topic} ${viewport.name}`;
            assert.equal(result.pageTopic, topic, `${label} should use the canonical topic layout`);
            assertCardMedia(result, label);
            assert.equal(new Set(result.cards.map((card) => card.src)).size, result.cards.length, `${label} card images should be unique`);
            assert.equal(result.videoHeroes.every((hero) => hero.loaded && hero.objectFit === "contain"), true, `${label} video heroes must remain contained and load`);
            assert.equal(result.videoHeroes.every((hero) => closeTo(hero.ratio, hero.sourceRatio > 1 ? 16 / 9 : 9 / 16, 0.06)), true, `${label} video heroes must preserve 16:9 or 9:16 framing`);
            assert.equal(result.brokenImages, 0, `${label} must not contain broken images`);
            assert.equal(result.hasTranslateExclusion, false, `${label} must not opt the page out of translation`);
            assert(result.scrollWidth - result.clientWidth <= 1, `${label} must not overflow horizontally`);
            checked += 1;
          } finally {
            await page.close();
          }
        }
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ ok: true, checked, stores: stores.length, topics: topics.length, viewports: viewports.length }, null, 2));
