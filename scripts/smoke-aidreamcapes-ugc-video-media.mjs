#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_aidreamcapes";
const manifest = JSON.parse(readFileSync(new URL("../src/lib/aidreamcapes-ugc-video-media.json", import.meta.url), "utf8"));
const videoPathFor = (item) => `/assets/sites/site_aidreamcapes/ugc-video-themes/${item.slug}.mp4`;
const imageRoutes = [
  "/ai-image-generation/ecommerce-main-image",
  "/ai-image-generation/on-model-generation",
  "/ai-image-generation/professional-headshot",
  "/ai-image-generation/macro-details",
  "/ai-image-generation/lookbook-cover",
  "/ai-image-generation/lifestyle-scene",
  "/ai-image-generation/feed-ad-still",
  "/ai-image-generation/background-remove-replace",
  "/ai-image-generation/virtual-try-on",
  "/ai-image-generation/fashion-editorial"
];
const expectedHomepageVideoRoutes = new Map([
  ["video_ugc", "/ai-video-generation/ugc-ad-video"],
  ["video_url_ad", "/ai-video-generation/url-to-ad"],
  ["video_hooks", "/ai-video-generation/hook-lab"],
  ["video_talking", "/ai-video-generation/talking-photo-recs"],
  ["video_demo", "/ai-video-generation/product-video"],
  ["video_unboxing", "/ai-video-generation/unboxing-experience"],
  ["video_before_after", "/ai-video-generation/before-after-showcases"],
  ["video_promo", "/ai-video-generation/promo-video"]
]);

function contentEntry(page, type) {
  return Object.values(page.contentJson?.sections ?? {}).find((entry) => entry?.type === type);
}

function detailHero(content) {
  if (content.layoutVariant === "ugc-ad-detail" && content.ugcAdDetail?.hero) return content.ugcAdDetail.hero;
  if (content.layoutVariant === "ads-testing-detail" && content.adsTestingDetail?.hero && !content.hero?.productImage) return content.adsTestingDetail.hero;
  return content.hero;
}

for (const item of manifest) {
  assert(existsSync(path.resolve("public", videoPathFor(item).slice(1))), `Missing video file: ${item.slug}`);
}
assert.equal(manifest.length, 35, "Expected 35 video mappings.");
assert.equal(new Set(manifest.map((item) => item.slug)).size, 35, "Video slugs are not unique.");

const prisma = new PrismaClient();
try {
  const routes = ["/", ...manifest.map((item) => item.route), ...imageRoutes];
  const pages = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: routes } }, select: { slug: true, contentJson: true } });
  assert.equal(pages.length, routes.length, "Targeted LivePage coverage is incomplete.");
  const bySlug = new Map(pages.map((page) => [page.slug, page]));

  for (const item of manifest) {
    const page = bySlug.get(item.route);
    const content = contentEntry(page, "ai_video_topic_landing")?.settings?.content;
    const hero = detailHero(content);
    assert.equal(hero.video?.src, videoPathFor(item), `Wrong video mapping for ${item.route}`);
    assert(hero.video?.poster, `Missing poster for ${item.route}`);
    assert.equal(hero.video?.width, 1344, `Wrong video width for ${item.route}`);
    assert.equal(hero.video?.height, 768, `Wrong video height for ${item.route}`);
    assert.equal(hero.video?.loading, "eager", `Wrong video loading priority for ${item.route}`);
    assert.equal(hero.video?.fetchPriority, "high", `Wrong video fetch priority for ${item.route}`);
    assert(hero.video?.sizes, `Missing video sizes for ${item.route}`);
  }

  const home = bySlug.get("/");
  const heroSection = home.contentJson.sections.aidreamcapes_hero;
  assert.equal(heroSection.settings.outputVideoUrl, videoPathFor(manifest.find((item) => item.slug === "ugc-ad-video")));
  const videoGrid = home.contentJson.sections.aidreamcapes_video_grid;
  for (const block of videoGrid.blocks) {
    const expectedRoute = expectedHomepageVideoRoutes.get(block.id);
    assert.equal(block.settings.href, expectedRoute, `Homepage video href drifted for ${block.id}`);
    assert(block.settings.videoUrl, `Homepage video URL missing for ${block.id}`);
    assert(block.settings.videoPosterUrl, `Homepage video poster missing for ${block.id}`);
  }
  const photoGrid = home.contentJson.sections.aidreamcapes_photo_grid;
  assert.equal(photoGrid.blocks.length, 10, "Homepage photo grid should contain the supplemental theme image.");
  for (const block of photoGrid.blocks) {
    const imagePage = bySlug.get(block.settings.href);
    const imageContent = contentEntry(imagePage, "ai_image_theme_landing")?.settings?.content;
    const image = imageContent?.hero?.outputImage || imageContent?.hero?.image;
    assert.equal(block.settings.imageUrl, image?.src, `Homepage image source drifted for ${block.id}`);
  }
  const adTesting = home.contentJson.sections.aidreamcapes_ad_testing;
  for (const block of adTesting.blocks) {
    assert(!block.settings.videoUrl, `Ad testing workflow should remain image-led: ${block.id}`);
    if (block.settings.href?.startsWith("/ai-video-generation/")) {
      const detail = bySlug.get(block.settings.href);
      const detailContent = contentEntry(detail, "ai_video_topic_landing")?.settings?.content;
      const detailImage = detailHero(detailContent)?.outputImage || detailHero(detailContent)?.output?.image;
      if (block.id !== "url_to_ad") assert.equal(block.settings.imageUrl, detailImage?.src, `Ad testing image source drifted for ${block.id}`);
    }
  }
  console.log(`Aidreamcapes UGC video smoke passed: ${manifest.length} detail videos, ${videoGrid.blocks.length} homepage video cards, ${photoGrid.blocks.length} homepage photo cards, image-led ad testing workflow.`);
} finally {
  await prisma.$disconnect();
}
