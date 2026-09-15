#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
const publicPrefix = "/assets/sites/site_aidreamshoots/generated/regenerated/";
const topics = [
  "brand-video", "cinematic-video", "explainer-video", "fashion-video", "food-video",
  "how-to-video", "instagram-reels", "meme-video", "music-video", "pet-video",
  "product-ad-video", "product-video", "promo-video", "social-media-video", "story-video",
  "talking-head-video", "tiktok-video", "ugc-ad-video", "video-ad", "youtube-video"
];
const genericAltPattern = /variaci[oó]n|ejemplo visual|creado con ia|fotos propias|resultados de/i;
const cropTolerance = 0.02;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const pages = [];
try {
  for (const topic of topics) {
    const page = await context.newPage();
    const response = await page.goto(`${baseUrl}/site/aidreamshoots/ai-video-generation/${topic}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
    assert.equal(response?.status(), 200, `${topic} must return HTTP 200`);
    const imageCount = await page.locator("[data-video-topic-page] img").count();
    for (let index = 0; index < imageCount; index += 1) {
      await page.locator("[data-video-topic-page] img").nth(index).scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(60);
    }
    await page.waitForFunction(
      (prefix) => [...document.querySelectorAll("[data-video-topic-page] img")]
        .filter((image) => (image.currentSrc || image.src).includes(prefix))
        .every((image) => image.complete && image.naturalWidth > 0),
      publicPrefix,
      { timeout: 12_000 }
    ).catch(() => {});
    await page.waitForFunction(
      () => [...document.querySelectorAll("[data-video-topic-page] video")]
        .every((video) => video.readyState >= 1 || !video.currentSrc),
      { timeout: 12_000 }
    ).catch(() => {});
    const result = await page.evaluate((prefix) => {
      const round = (value) => Number(value.toFixed(3));
      const images = [...document.querySelectorAll("[data-video-topic-page] img")].map((image) => {
        const frame = image.parentElement;
        const imageRect = image.getBoundingClientRect();
        const frameRect = frame?.getBoundingClientRect();
        const sourceRatio = image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 0;
        const frameRatio = frameRect?.height ? frameRect.width / frameRect.height : 0;
        const renderedRatio = imageRect?.height ? imageRect.width / imageRect.height : 0;
        const cropFraction = sourceRatio && frameRatio ? 1 - Math.min(sourceRatio / frameRatio, frameRatio / sourceRatio) : 1;
        const renderedRatioMismatch = sourceRatio && renderedRatio ? 1 - Math.min(sourceRatio / renderedRatio, renderedRatio / sourceRatio) : 1;
        const src = image.currentSrc || image.src;
        return {
          src,
          generated: src.includes(prefix),
          alt: image.alt,
          loaded: image.complete && image.naturalWidth > 0,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          sourceRatio: round(sourceRatio),
          frameRatio: round(frameRatio),
          renderedRatio: round(renderedRatio),
          cropFraction: round(cropFraction),
          renderedRatioMismatch: round(renderedRatioMismatch),
          frameWidth: Math.round(frameRect?.width || 0),
          frameHeight: Math.round(frameRect?.height || 0),
          objectFit: getComputedStyle(image).objectFit
        };
      });
      const videos = [...document.querySelectorAll("[data-video-topic-page] video")].map((video) => {
        const frame = video.parentElement?.parentElement;
        const videoRect = video.getBoundingClientRect();
        const frameRect = frame?.getBoundingClientRect();
        const sourceRatio = video.videoHeight > 0 ? video.videoWidth / video.videoHeight : 0;
        const frameRatio = frameRect?.height ? frameRect.width / frameRect.height : 0;
        const renderedRatio = videoRect?.height ? videoRect.width / videoRect.height : 0;
        const ratioMismatch = sourceRatio && frameRatio ? 1 - Math.min(sourceRatio / frameRatio, frameRatio / sourceRatio) : 1;
        const portraitSource = sourceRatio > 0 && sourceRatio < 1;
        const expectedRatio = portraitSource ? 9 / 16 : 16 / 9;
        const expectedRatioMismatch = frameRatio ? 1 - Math.min(expectedRatio / frameRatio, frameRatio / expectedRatio) : 1;
        return {
          src: video.currentSrc || video.src,
          loaded: video.readyState >= 1 && video.videoWidth > 0 && video.videoHeight > 0,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          sourceRatio: round(sourceRatio),
          frameRatio: round(frameRatio),
          renderedRatio: round(renderedRatio),
          ratioMismatch: round(ratioMismatch),
          expectedRatio: round(expectedRatio),
          expectedRatioMismatch: round(expectedRatioMismatch),
          frameWidth: Math.round(frameRect?.width || 0),
          frameHeight: Math.round(frameRect?.height || 0),
          objectFit: getComputedStyle(video).objectFit
        };
      });
      const heroMarker = document.querySelector("[data-video-topic-hero-media]");
      const heroFrame = heroMarker?.querySelector(":scope > div") || heroMarker;
      const heroRect = heroFrame?.getBoundingClientRect();
      return {
        images,
        videos,
        heroRatio: heroRect?.height ? round(heroRect.width / heroRect.height) : 0,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth
      };
    }, publicPrefix);
    const generated = result.images.filter((image) => image.generated);
    const oldAssets = result.images.filter((image) => !image.generated).map((image) => image.src);
    pages.push({
      topic,
      imageCount: result.images.length,
      generatedImageCount: generated.length,
      oldAssets,
      broken: generated.filter((image) => !image.loaded).length,
      invalidAlt: generated.filter((image) => image.alt.length < 30 || image.alt.length > 150 || genericAltPattern.test(image.alt)).length,
      portraitFrameForLandscape: generated.filter((image) => image.sourceRatio > 1.1 && image.frameRatio < 0.9).length,
      highCrop: generated.filter((image) => image.cropFraction > 0.3).length,
      crop: generated.filter((image) => image.cropFraction > cropTolerance || image.renderedRatioMismatch > cropTolerance).length,
      objectFitIssues: generated.filter((image) => ["cover", "contain"].includes(image.objectFit)).length,
      videos: result.videos,
      videoBroken: result.videos.filter((video) => !video.loaded).length,
      videoRatioIssues: result.videos.filter((video) => video.ratioMismatch > cropTolerance).length,
      videoExpectedRatioIssues: result.videos.filter((video) => video.expectedRatioMismatch > cropTolerance).length,
      videoObjectFitIssues: result.videos.filter((video) => video.objectFit !== "contain").length,
      horizontalOverflow: result.horizontalOverflow,
      heroRatio: result.heroRatio,
      samples: generated.filter((image) => !image.loaded || image.sourceRatio > 1.1 && image.frameRatio < 0.9 || image.cropFraction > cropTolerance || image.renderedRatioMismatch > cropTolerance || ["cover", "contain"].includes(image.objectFit)).slice(0, 3),
      videoSamples: result.videos.filter((video) => !video.loaded || video.ratioMismatch > cropTolerance || video.expectedRatioMismatch > cropTolerance || video.objectFit !== "contain").slice(0, 3)
    });
    await page.close();
  }
  const totals = pages.reduce((sum, page) => ({
    images: sum.images + page.generatedImageCount,
    broken: sum.broken + page.broken,
    invalidAlt: sum.invalidAlt + page.invalidAlt,
    portraitFrameForLandscape: sum.portraitFrameForLandscape + page.portraitFrameForLandscape,
    highCrop: sum.highCrop + page.highCrop,
    crop: sum.crop + page.crop,
    objectFitIssues: sum.objectFitIssues + page.objectFitIssues,
    oldAssets: sum.oldAssets + page.oldAssets.length,
    videos: sum.videos + page.videos.length,
    videoBroken: sum.videoBroken + page.videoBroken,
    videoRatioIssues: sum.videoRatioIssues + page.videoRatioIssues,
    videoExpectedRatioIssues: sum.videoExpectedRatioIssues + page.videoExpectedRatioIssues,
    videoObjectFitIssues: sum.videoObjectFitIssues + page.videoObjectFitIssues
  }), { images: 0, broken: 0, invalidAlt: 0, portraitFrameForLandscape: 0, highCrop: 0, crop: 0, objectFitIssues: 0, oldAssets: 0, videos: 0, videoBroken: 0, videoRatioIssues: 0, videoExpectedRatioIssues: 0, videoObjectFitIssues: 0 });
  console.log(JSON.stringify({
    // The regeneration manifest contains 180 image assets, but several hero
    // slots are intentionally represented by their preserved <video> element
    // on the detail page. The browser therefore renders 177 image nodes while
    // the database/smoke audit covers all 180 generated files separately.
    ok: totals.images > 0 && totals.broken === 0 && totals.invalidAlt === 0 && totals.portraitFrameForLandscape === 0 && totals.crop === 0 && totals.objectFitIssues === 0 && totals.oldAssets === 0 && totals.videoBroken === 0 && totals.videoRatioIssues === 0 && totals.videoExpectedRatioIssues === 0 && totals.videoObjectFitIssues === 0 && pages.every((page) => page.generatedImageCount > 0 && page.horizontalOverflow === 0),
    totals,
    pages
  }, null, 2));
} finally {
  await context.close();
  await browser.close();
}
