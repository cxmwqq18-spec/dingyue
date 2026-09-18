#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const siteId = "site_mydreamshoots_xby";
const pageSlug = "/ai-video-generation/talking-photo";
const sectionId = "talking_photo_landing_1";
const publicPrefix = "/assets/sites/site_aidreamshoots/generated/regenerated/";

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function fileFor(publicUrl) {
  return path.join(repoRoot, "public", publicUrl.replace(/^\//, "").split(/[?#]/)[0]);
}

const prisma = new PrismaClient();
try {
  const [site, page, theme] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId, slug: pageSlug } }, select: { contentJson: true } }),
    prisma.videoTheme.findUnique({ where: { siteId_slug: { siteId, slug: "talking-photo" } }, select: { imageUrl: true, galleryImages: true } })
  ]);
  assert.deepEqual(site, { id: siteId, slug: "aidreamshoots", primaryDomain: "aidreamshoots.eu" });
  const pageJson = record(page?.contentJson);
  const content = record(pageJson?.sections?.[sectionId]?.settings?.content);
  assert(content, "Talking Photo page content is missing.");
  const hero = record(content.hero);
  const items = Array.isArray(content.useCases?.items) ? content.useCases.items : [];
  const images = [hero?.image, ...items.map((item) => item?.image)].filter(Boolean);
  assert.equal(images.length, 7, "Talking Photo must expose seven content images.");
  const urls = images.map((image) => image.src);
  assert.equal(new Set(urls).size, urls.length, "Talking Photo content images must be unique.");
  assert(urls.every((url) => typeof url === "string" && url.startsWith(publicPrefix)), "Every content image must use the AIdreamshoots regenerated namespace.");
  assert(images.every((image) => typeof image.alt === "string" && image.alt.length >= 30 && image.alt.length <= 150), "Every content image needs descriptive alt text.");
  for (const url of urls) assert(fs.existsSync(fileFor(url)), `Missing public image: ${url}`);
  assert(hero.video?.src && !hero.video.src.startsWith(publicPrefix), "The video source must remain unchanged by the image-only replacement.");
  assert.equal(hero.video?.poster, hero.image.src, "The hero poster must match the new hero image.");
  if (theme) {
    assert.equal(theme.imageUrl, hero.image.src, "VideoTheme hero preview must match the new hero image.");
    const galleryImages = Array.isArray(theme.galleryImages) ? theme.galleryImages : [];
    assert(galleryImages.some((value) => /\.(?:mp4|webm)(?:[?#]|$)/i.test(String(value))), "VideoTheme video asset must remain present.");
    assert(galleryImages.filter((value) => !/\.(?:mp4|webm)(?:[?#]|$)/i.test(String(value))).every((value) => String(value).startsWith(publicPrefix)), "VideoTheme image previews must use the regenerated namespace.");
  }
  console.log(JSON.stringify({ ok: true, site: site.slug, pageSlug, images: urls.length, namespace: publicPrefix, videoSourcePreserved: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
