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
  "promo-video",
  "ugc-ad-video",
  "video-ad",
  "brand-video",
  "music-video",
  "fashion-video",
  "food-video",
  "pet-video"
];
const viewports = [
  { name: "mobile", width: 390, height: 844, columns: 1, videoAdColumns: 1 },
  { name: "tablet", width: 768, height: 1024, columns: 2, videoAdColumns: 2 },
  { name: "desktop", width: 1280, height: 900, columns: 3, videoAdColumns: 4 },
  { name: "wide", width: 1440, height: 900, columns: 3, videoAdColumns: 4 }
];
const sectionOrder = ["hero", "use-cases", "foundation", "guidance", "steps", "value", "trust", "faq", "final-cta"];

function sectionOrderForTopic(topic) {
  if (topic === "ugc-ad-video") {
    return ["hero", "quick-answer", "use-cases", "evidence", "examples", "foundation", "guidance", "creator-native-framing", "how-it-works", "value", "comparison", "trust", "faq", "final-cta"];
  }
  if (topic === "promo-video") {
    return ["hero", "quick-answer", "use-cases", "evidence", "examples", "foundation", "guidance", "urgency", "how-it-works", "comparison", "trust", "faq", "final-cta"];
  }
  if (topic === "video-ad") {
    return ["hero", "what-this-creates", "style-cues", "how-it-works", "scene-gallery", "guide", "workflow", "faq", "related-pages", "final-cta"];
  }
  if (topic === "brand-video") {
    return ["hero", "what-this-creates", "brand-story-map", "brand-signals", "how-it-works", "scene-gallery", "brand-consistency-guide", "product-evidence", "workflow", "brand-integrity-review", "faq", "related-pages", "final-cta"];
  }
  if (topic === "music-video" || topic === "fashion-video" || topic === "food-video" || topic === "pet-video") {
    return ["hero", "what-this-creates", "visual-map", "how-it-works", "scene-gallery", "sequence-guide", "product-boundary", "product-evidence", "workflow", "integrity-review", "faq", "related-pages", "final-cta"];
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
          const response = await page.goto(`${baseUrl}/ai-video-generation/${topic}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
          assert.equal(response?.status(), 200, `${topic} ${viewport.name} should return HTTP 200`);
          if (topic === "video-ad") {
            await page.locator("[data-video-topic-section=\"scene-gallery\"]").scrollIntoViewIfNeeded();
            await page.waitForFunction(
              () => [...document.querySelectorAll("[data-video-ad-scene] img")].every((image) => image.complete && image.naturalWidth > 0),
              undefined,
              { timeout: 15_000 }
            );
            const result = await page.evaluate(() => {
              const scenes = [...document.querySelectorAll("[data-video-ad-scene]")];
              const sceneRects = scenes.map((card) => card.getBoundingClientRect());
              const firstRowTop = sceneRects[0]?.top ?? 0;
              const firstRow = sceneRects.filter((rect) => Math.abs(rect.top - firstRowTop) < 2);
              const workspaceCtas = [...document.querySelectorAll('a[href*="/app/create?videoMode="]')];
              const sectionNames = [...document.querySelectorAll("[data-video-topic-section]")].map((section) => section.getAttribute("data-video-topic-section"));
              const media = scenes.map((card) => {
                const frame = card.querySelector("div");
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
                heroImages: document.querySelectorAll("[data-video-topic-hero-media] img").length,
                scenes: scenes.length,
                guideCards: document.querySelectorAll("[data-video-ad-guide-card]").length,
                steps: document.querySelectorAll("[data-video-ad-step]").length,
                hasWorkspacePanel: Boolean(document.querySelector("[data-video-ad-workspace]")),
                columns: firstRow.length,
                firstRowWidthDelta: firstRow.length ? Math.max(...firstRow.map((rect) => rect.width)) - Math.min(...firstRow.map((rect) => rect.width)) : Infinity,
                media,
                workspaceCtaCount: workspaceCtas.length,
                workspaceCtaHrefs: workspaceCtas.map((link) => link.getAttribute("href")),
                workspaceCtaNoWrap: workspaceCtas.every((link) => getComputedStyle(link).whiteSpace === "nowrap"),
                sectionNames,
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth
              };
            });
            assert.equal(result.pageMarker, 1, `${topic} ${viewport.name} should render one shared page marker`);
            assert.equal(result.heroImages >= 1, true, `${topic} ${viewport.name} hero should render at least one preview image`);
            assert.equal(result.scenes >= 1, true, `${topic} ${viewport.name} should render scene cards`);
            assert.equal(result.guideCards >= 1, true, `${topic} ${viewport.name} should render guide cards`);
            assert.equal(result.steps >= 1, true, `${topic} ${viewport.name} should render workflow steps`);
            assert.equal(result.hasWorkspacePanel, true, `${topic} ${viewport.name} should render the workspace evidence panel`);
            assert.equal(result.columns, Math.min(viewport.videoAdColumns, result.scenes), `${topic} ${viewport.name} should use all available scene columns`);
            assert.equal(result.firstRowWidthDelta < 2, true, `${topic} ${viewport.name} first-row scene cards must have equal widths`);
            assert.equal(result.media.length, result.scenes, `${topic} ${viewport.name} should render media for every scene card`);
            assert.equal(new Set(result.media.map((media) => media.src)).size, result.scenes, `${topic} ${viewport.name} scene images must be unique`);
            assert.equal(result.media.every((media) => media.loaded && media.alt.trim()), true, `${topic} ${viewport.name} scene images must load with alt text`);
            assert.equal(result.media.every((media) => media.objectFit === "cover"), true, `${topic} ${viewport.name} scene images must use the shared scene framing`);
            assert.equal(result.media.every((media) => media.width > 0 && media.height > 0), true, `${topic} ${viewport.name} scene media must use visible frames`);
            assert.equal(result.workspaceCtaCount >= 1, true, `${topic} ${viewport.name} should expose workspace CTAs`);
            assert.equal(new Set(result.workspaceCtaHrefs).size, 1, `${topic} ${viewport.name} workspace CTAs must share one destination`);
            assert.equal(result.workspaceCtaNoWrap, true, `${topic} ${viewport.name} workspace CTA labels must not wrap`);
            assert.equal(result.scrollWidth, result.clientWidth, `${topic} ${viewport.name} must not overflow horizontally`);
            assertOrderedSections(topic, result.sectionNames);
            checked.push({ topic, viewport: viewport.name });
            continue;
          }
          if (topic === "brand-video") {
            await page.locator('[data-video-topic-section="scene-gallery"]').scrollIntoViewIfNeeded();
            await page.waitForFunction(
              () => [...document.querySelectorAll("[data-brand-video-scene] img")].every((image) => image.complete && image.naturalWidth > 0),
              undefined,
              { timeout: 15_000 }
            );
            const result = await page.evaluate(() => {
              const scenes = [...document.querySelectorAll("[data-brand-video-scene]")];
              const sceneRects = scenes.map((card) => card.getBoundingClientRect());
              const firstRowTop = sceneRects[0]?.top ?? 0;
              const firstRow = sceneRects.filter((rect) => Math.abs(rect.top - firstRowTop) < 2);
              const workspaceCtas = [...document.querySelectorAll('a[href*="/app/create?videoMode="]')];
              const sectionNames = [...document.querySelectorAll("[data-video-topic-section]")].map((section) => section.getAttribute("data-video-topic-section"));
              return {
                pageMarker: document.querySelectorAll('[data-video-topic-page="brand-video"]').length,
                heroImages: document.querySelectorAll("[data-video-topic-hero-media] img").length,
                scenes: scenes.length,
                beats: document.querySelectorAll("[data-brand-video-beat]").length,
                guideCards: document.querySelectorAll("[data-brand-video-guide-card]").length,
                evidenceCards: document.querySelectorAll("[data-brand-video-evidence] article").length,
                steps: document.querySelectorAll("[data-brand-video-step]").length,
                reviewCards: document.querySelectorAll("[data-brand-video-review-card]").length,
                hasWorkspacePanel: Boolean(document.querySelector("[data-brand-video-workspace]")),
                columns: firstRow.length,
                sceneSources: scenes.map((card) => card.querySelector("img")?.getAttribute("src") || ""),
                sceneImagesLoaded: scenes.every((card) => {
                  const image = card.querySelector("img");
                  return Boolean(image?.complete && image.naturalWidth > 0 && image.alt.trim());
                }),
                workspaceCtaCount: workspaceCtas.length,
                workspaceCtaHrefs: workspaceCtas.map((link) => link.getAttribute("href")),
                sectionNames,
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth
              };
            });
            assert.equal(result.pageMarker, 1, `${topic} ${viewport.name} should render one shared page marker`);
            assert.equal(result.heroImages >= 1, true, `${topic} ${viewport.name} hero should render preview images`);
            assert.equal(result.scenes >= 1, true, `${topic} ${viewport.name} should render scene cards`);
            assert.equal(result.beats >= 1, true, `${topic} ${viewport.name} should render story beats`);
            assert.equal(result.guideCards >= 1, true, `${topic} ${viewport.name} should render guide cards`);
            assert.equal(result.evidenceCards >= 1, true, `${topic} ${viewport.name} should render evidence cards`);
            assert.equal(result.steps >= 1, true, `${topic} ${viewport.name} should render workflow steps`);
            assert.equal(result.reviewCards >= 1, true, `${topic} ${viewport.name} should render review cards`);
            assert.equal(result.hasWorkspacePanel, true, `${topic} ${viewport.name} should render the workspace review panel`);
            assert.equal(result.sceneImagesLoaded, true, `${topic} ${viewport.name} scene images must load with alt text`);
            assert.equal(new Set(result.sceneSources).size, result.scenes, `${topic} ${viewport.name} scene images must be unique`);
            assert.equal(result.workspaceCtaCount >= 1, true, `${topic} ${viewport.name} should expose workspace CTAs`);
            assert.equal(new Set(result.workspaceCtaHrefs).size, 1, `${topic} ${viewport.name} workspace CTAs must share one destination`);
            assert.equal(result.scrollWidth, result.clientWidth, `${topic} ${viewport.name} must not overflow horizontally`);
            assertOrderedSections(topic, result.sectionNames);
            checked.push({ topic, viewport: viewport.name });
            continue;
          }
          if (topic === "music-video" || topic === "fashion-video" || topic === "food-video" || topic === "pet-video") {
            await page.locator('[data-video-topic-section="scene-gallery"]').scrollIntoViewIfNeeded();
            await page.waitForFunction(
              () => [...document.querySelectorAll("[data-scene-topic-scene] img")].every((image) => image.complete && image.naturalWidth > 0),
              undefined,
              { timeout: 15_000 }
            );
            const result = await page.evaluate(() => {
              const gallery = document.querySelector("[data-scene-topic-gallery]");
              const scenes = [...document.querySelectorAll("[data-scene-topic-scene]")];
              const heroHeading = document.querySelector('[data-video-topic-section="hero"] h1');
              const workspaceCtas = [...document.querySelectorAll('a[href*="/app/create?videoMode="]')];
              const sectionNames = [...document.querySelectorAll("[data-video-topic-section]")].map((section) => section.getAttribute("data-video-topic-section"));
              return {
                pageMarker: document.querySelectorAll("[data-video-topic-page]").length,
                heroImages: document.querySelectorAll("[data-video-topic-hero-media] img").length,
                heroImageFits: [...document.querySelectorAll("[data-video-topic-hero-media] img")].map((image) => getComputedStyle(image).objectFit),
                heroImageSources: [...document.querySelectorAll("[data-video-topic-hero-media] img")].map((image) => image.getAttribute("src") || ""),
                heroImageFrameRatios: [...document.querySelectorAll("[data-video-topic-hero-media] img")].map((image) => {
                  const frame = image.parentElement;
                  const rect = frame?.getBoundingClientRect();
                return rect && rect.height > 0 ? rect.width / rect.height : 0;
                }),
                heroImageNaturalRatios: [...document.querySelectorAll("[data-video-topic-hero-media] img")].map((image) => image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 0),
                heroHeadingWithinViewport: Boolean(heroHeading && heroHeading.getBoundingClientRect().left >= 0 && heroHeading.getBoundingClientRect().right <= document.documentElement.clientWidth + 1),
                scenes: scenes.length,
                mapItems: document.querySelectorAll("[data-scene-topic-map-item]").length,
                steps: document.querySelectorAll("[data-scene-topic-step]").length,
                guideCards: document.querySelectorAll('[data-video-topic-section="sequence-guide"] article').length,
                evidenceCards: document.querySelectorAll('[data-video-topic-section="product-evidence"] [data-video-topic-supporting-cards] > article').length,
                workflowCards: document.querySelectorAll("[data-scene-topic-workflow]").length,
                reviewCards: document.querySelectorAll("[data-scene-topic-review-card]").length,
                sceneSources: scenes.map((card) => card.querySelector("img")?.getAttribute("src") || ""),
                sceneImagesLoaded: scenes.every((card) => {
                  const image = card.querySelector("img");
                  return Boolean(image?.complete && image.naturalWidth > 0 && image.alt.trim());
                }),
                galleryColumns: gallery ? getComputedStyle(gallery).gridTemplateColumns.split(" ").length : 0,
                workspaceCtaCount: workspaceCtas.length,
                workspaceCtaHrefs: workspaceCtas.map((link) => link.getAttribute("href")),
                sectionNames,
                scrollWidth: document.documentElement.scrollWidth,
                clientWidth: document.documentElement.clientWidth
              };
            });
            assert.equal(result.pageMarker, 1, `${topic} ${viewport.name} should render one shared page marker`);
            assert.equal(result.heroHeadingWithinViewport, true, `${topic} ${viewport.name} hero heading must fit within the viewport`);
            assert.equal(result.heroImages >= 1, true, `${topic} ${viewport.name} hero should render images`);
            if (topic === "music-video" || topic === "fashion-video" || topic === "food-video" || topic === "pet-video") {
              assert.equal(result.heroImageFits.slice(-2).every((fit) => fit === "contain"), true, `${topic} ${viewport.name} secondary hero images must show without cropping`);
              assert.equal(result.heroImageFrameRatios.slice(-2).every((ratio, index) => Math.abs(ratio - result.heroImageNaturalRatios.slice(-2)[index]) < 0.04), true, `${topic} ${viewport.name} secondary hero frames must preserve their source ratios`);
            }
            if (topic === "music-video") {
              assert.equal(result.heroImageSources[0].includes("hero-music-video-performance.jpg"), true, `${topic} ${viewport.name} should use the performance reference in the lower-left hero frame`);
            }
            if (topic === "pet-video") {
              assert.equal(result.heroImageSources[0].includes("hero-pet-video-owner-frame.jpg"), true, `${topic} ${viewport.name} should lead with the owner-and-pet frame`);
              assert.equal(result.heroImageSources[1].includes("hero-pet-video-training-frame.jpg"), true, `${topic} ${viewport.name} should place the training frame in the lower-left hero frame`);
            }
            assert.equal(result.scenes >= 1, true, `${topic} ${viewport.name} should render scene cards`);
            assert.equal(result.mapItems >= 1, true, `${topic} ${viewport.name} should render visual-map items`);
            assert.equal(result.steps >= 1, true, `${topic} ${viewport.name} should render workflow steps`);
            assert.equal(result.guideCards >= 1, true, `${topic} ${viewport.name} should render sequence-guide cards`);
            assert.equal(result.evidenceCards >= 1, true, `${topic} ${viewport.name} should render evidence cards`);
            assert.equal(result.workflowCards >= 1, true, `${topic} ${viewport.name} should render workflow cards`);
            assert.equal(result.reviewCards >= 1, true, `${topic} ${viewport.name} should render review cards`);
            assert.equal(result.sceneImagesLoaded, true, `${topic} ${viewport.name} scene images must load with alt text`);
            assert.equal(new Set(result.sceneSources).size, result.scenes, `${topic} ${viewport.name} scene images must be unique`);
            assert.equal(result.galleryColumns, viewport.name === "mobile" ? 1 : viewport.name === "tablet" ? 2 : 4, `${topic} ${viewport.name} gallery columns should match the responsive layout`);
            assert.equal(result.workspaceCtaCount >= 1, true, `${topic} ${viewport.name} should expose workspace CTAs`);
            assert.equal(new Set(result.workspaceCtaHrefs).size, 1, `${topic} ${viewport.name} workspace CTAs must share one destination`);
            assert.equal(result.scrollWidth, result.clientWidth, `${topic} ${viewport.name} must not overflow horizontally`);
            assertOrderedSections(topic, result.sectionNames);
            checked.push({ topic, viewport: viewport.name });
            continue;
          }
          await page.locator("[data-video-topic-section=\"use-cases\"]").scrollIntoViewIfNeeded();
          await page.waitForFunction(
            () => [...document.querySelectorAll("[data-video-topic-use-case-card] img")].every((image) => image.complete && image.naturalWidth > 0),
            undefined,
            { timeout: 15_000 }
          );
          const result = await page.evaluate(() => {
            const legacyBlurredMediaPattern = /\/assets\/dreamshoot\/(?:tiktok-video|instagram-reels|social-media-video|story-video)\//;
            const approvedVideoPosterPattern = /\/(?:turn-your-photos-and-ideas-into-tiktok-first-videos|turn-photos-and-ideas-into-reels-that-fit-your-feed)\.webp(?:[?#]|$)/;
            const isLegacyBlurredMedia = (src) => legacyBlurredMediaPattern.test(src) && !approvedVideoPosterPattern.test(src);
            const cards = [...document.querySelectorAll("[data-video-topic-use-case-card]")];
            const heroFrame = document.querySelector("[data-video-topic-hero-media]");
            const heroImage = heroFrame?.querySelector("img");
            const heroVideo = heroFrame?.querySelector("video");
            const heroMedia = heroImage || heroVideo;
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
                loaded: Boolean(image?.complete && image.naturalWidth > 0),
                legacyBlurredMedia: Boolean(image && isLegacyBlurredMedia(image.getAttribute("src") || ""))
              };
            });
            return {
              pageMarker: document.querySelectorAll("[data-video-topic-page]").length,
              hero: {
                width: heroFrame ? Math.round(heroFrame.getBoundingClientRect().width) : 0,
                height: heroFrame ? Math.round(heroFrame.getBoundingClientRect().height) : 0,
                mediaType: heroVideo ? "video" : heroImage ? "image" : "",
                objectFit: heroMedia ? getComputedStyle(heroMedia).objectFit : "",
                imageWidth: heroMedia ? Math.round(heroMedia.getBoundingClientRect().width) : 0,
                imageHeight: heroMedia ? Math.round(heroMedia.getBoundingClientRect().height) : 0,
                legacyBlurredMedia: Boolean(heroImage && isLegacyBlurredMedia(heroImage.getAttribute("src") || ""))
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
          const usesCleanTopicMedia = ["tiktok-video", "instagram-reels", "social-media-video", "story-video"].includes(topic);
          const usesPortraitTopicVideo = ["tiktok-video", "instagram-reels", "product-video", "product-ad-video"].includes(topic);
          const expectedHeroObjectFit = ["tiktok-video", "instagram-reels"].includes(topic) ? "contain" : "cover";
          const expectedCardObjectFit = "cover";
          assert.equal(result.hero.objectFit, expectedHeroObjectFit, `${topic} ${viewport.name} hero media must preserve its intended framing`);
          if (topic === "product-video" || topic === "product-ad-video") {
            assert.equal(result.hero.mediaType, "video", `${topic} ${viewport.name} hero should render the source video directly`);
          }
          assert.equal(result.hero.legacyBlurredMedia, false, `${topic} ${viewport.name} hero must not use a legacy blurred-bleed asset`);
          assert.equal(result.hero.width > 0 && result.hero.height > 0, true, `${topic} ${viewport.name} hero media must have a visible frame`);
          if (topic === "product-video" || topic === "product-ad-video") {
            assert.equal(Math.abs(result.hero.imageWidth / result.hero.imageHeight - 9 / 16) < 0.01, true, `${topic} ${viewport.name} portrait hero video must use a 9:16 frame`);
          } else if (usesPortraitTopicVideo) {
            assert.equal(Math.abs(result.hero.imageWidth / result.hero.imageHeight - 496 / 864) < 0.04, true, `${topic} ${viewport.name} portrait hero video must preserve its source ratio`);
          } else if (usesCleanTopicMedia) {
            assert.equal(Math.abs(result.hero.imageWidth / result.hero.imageHeight - 16 / 9) < 0.04, true, `${topic} ${viewport.name} clean hero media must use a 16:9 frame`);
          }
          assert.equal(result.cards, 6, `${topic} ${viewport.name} should render six use-case cards`);
          assert.equal(result.columns, viewport.columns, `${topic} ${viewport.name} should render ${viewport.columns} use-case columns`);
          assert.equal(result.firstRowWidthDelta < 2, true, `${topic} ${viewport.name} first-row cards must have equal widths`);
          assert.equal(result.firstRowBottomDelta < 2, true, `${topic} ${viewport.name} first-row cards must align at the bottom`);
          assert.equal(result.media.length, 6, `${topic} ${viewport.name} should render six use-case media frames`);
          assert.equal(new Set(result.media.map((media) => media.src)).size, 6, `${topic} ${viewport.name} use-case images must be unique`);
          assert.equal(result.media.every((media) => media.loaded && media.alt.trim()), true, `${topic} ${viewport.name} use-case images must load with alt text`);
          assert.equal(result.media.every((media) => !media.legacyBlurredMedia), true, `${topic} ${viewport.name} use-case images must not use legacy blurred-bleed assets`);
          assert.equal(result.media.every((media) => media.objectFit === expectedCardObjectFit), true, `${topic} ${viewport.name} use-case images must preserve their intended framing`);
          assert.equal(result.media.every((media) => media.width > 0 && media.height > 0), true, `${topic} ${viewport.name} media must have visible frames`);
          if (usesCleanTopicMedia) {
            assert.equal(
              result.media.every((media) => [16 / 9, 4 / 3].some((ratio) => Math.abs(media.width / media.height - ratio) < 0.04)),
              true,
              `${topic} ${viewport.name} clean media must use stable 16:9 or 4:3 frames`
            );
          }
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
