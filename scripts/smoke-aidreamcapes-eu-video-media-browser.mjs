#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.AIDREAMCAPES_EU_BASE_URL || "http://localhost:3002/site/aidreamcapes-eu";
const topics = [
  ["talking-photo", "Vidéo de photo parlante montrant un portrait qui s’adresse à la caméra."],
  ["cinematic-video", "Vidéo cinématographique illustrant une scène narrative avec une lumière dramatique."],
  ["music-video", "Clip vidéo musical montrant une interprétation d’artiste sous des lumières de scène."],
  ["tiktok-video", "Vidéo TikTok horizontale présentant une création courte pensée pour le format mobile."],
  ["product-video", "Vidéo produit montrant un article dans une présentation commerciale soignée."],
  ["promo-video", "Vidéo promotionnelle annonçant un lancement ou une offre avec un appel à l’action."],
  ["product-ad-video", "Publicité vidéo produit mettant en scène une démonstration orientée vers une décision d’achat."],
  ["instagram-reels", "Instagram Reel horizontal présentant une histoire visuelle conçue pour le fil mobile."],
];

const expectedAsset = (slug) => `/assets/sites/site_aidreamcapes_eu/visuals/${slug}/${slug}.mp4`;
const diagnostics = { consoleErrors: [], pageErrors: [], requestFailures: [], badResponses: [] };
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(String(error?.message ?? error)));
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    if (failure && failure.errorText !== "net::ERR_ABORTED") {
      diagnostics.requestFailures.push({ url: request.url(), error: failure.errorText });
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/assets/sites/site_aidreamcapes_eu/visuals/")) {
      diagnostics.badResponses.push({ status: response.status(), url: response.url() });
    }
  });

  const reports = [];
  for (const [path, slug, alt] of [["/", null, null], ...topics.map(([topic, topicAlt]) => [`/ai-video-generation/${topic}`, topic, topicAlt])]) {
    let response;
    let navigationError;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await page.goto(`${baseUrl}${path}`, { waitUntil: "commit", timeout: 60_000 });
        navigationError = undefined;
        break;
      } catch (error) {
        navigationError = error;
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
    if (navigationError) throw navigationError;
    assert(response && response.status() < 400, `${path}: HTTP ${response?.status()}`);
    await page.locator("body").waitFor({ state: "attached", timeout: 60_000 });
    if (!slug) {
      await page.evaluate(async () => {
        const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
        for (let y = 0; y <= document.body.scrollHeight; y += Math.max(window.innerHeight * 0.75, 400)) {
          window.scrollTo(0, y);
          await sleep(120);
        }
        window.scrollTo(0, 0);
      });
    }
    await page.waitForTimeout(800);
    const videos = await page.locator("video").evaluateAll((elements) => elements.map((video) => ({
      src: video.currentSrc || video.getAttribute("src") || "",
      ariaLabel: video.getAttribute("aria-label") || "",
      title: video.getAttribute("title") || "",
      alt: video.getAttribute("alt") || "",
    })));
    const normalized = videos.map((video) => ({ ...video, src: video.src.split("?")[0] }));
    const showcaseCards = await page.locator('[data-showcase-card-kind="video"] [data-dreamshoot-preview-src]').evaluateAll((elements) => elements.map((element) => ({
      src: (element.getAttribute("data-dreamshoot-preview-src") || "").split("?")[0],
      label: element.getAttribute("aria-label") || element.getAttribute("data-dreamshoot-preview-title") || "",
    })));
    assert(normalized.length > 0 || showcaseCards.length > 0, `${path}: no video element or showcase video card rendered`);
    if (slug) {
      const matches = [...normalized, ...showcaseCards].filter((video) => video.src.includes(expectedAsset(slug)));
      assert(matches.length > 0, `${path}: expected video asset missing`);
      assert(
        matches.some((video) => video.title === alt || video.alt === alt || video.ariaLabel?.includes(alt) || video.label === alt || video.label?.includes(alt)),
        `${path}: expected French video label missing`,
      );
    } else {
      for (const [topic, topicAlt] of topics) {
        const matches = [...normalized, ...showcaseCards].filter((video) => video.src.includes(expectedAsset(topic)));
        assert(
          matches.length > 0,
          `homepage: ${topic} video missing; rendered=${JSON.stringify({ videos: normalized, showcaseCards })}`,
        );
        assert(matches.some((video) => video.title === topicAlt || video.alt === topicAlt || video.ariaLabel?.includes(topicAlt) || video.label === topicAlt || video.label?.includes(topicAlt)), `${path}: ${topic} French video label missing`);
      }
    }
    reports.push({ path, status: response.status(), videoCount: normalized.length, showcaseCardCount: showcaseCards.length, videos: normalized, showcaseCards });
  }

  assert.equal(diagnostics.consoleErrors.length, 0, `console errors: ${JSON.stringify(diagnostics.consoleErrors.slice(0, 3))}`);
  assert.equal(diagnostics.pageErrors.length, 0, `page errors: ${JSON.stringify(diagnostics.pageErrors.slice(0, 3))}`);
  assert.equal(diagnostics.requestFailures.length, 0, `request failures: ${JSON.stringify(diagnostics.requestFailures.slice(0, 3))}`);
  assert.equal(diagnostics.badResponses.length, 0, `bad video responses: ${JSON.stringify(diagnostics.badResponses.slice(0, 3))}`);
  console.log(JSON.stringify({ ok: true, checkedPages: reports.length, reports }, null, 2));
} finally {
  await browser.close();
}
