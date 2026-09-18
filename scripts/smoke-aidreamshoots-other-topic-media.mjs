#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const batchId = "aidreamshoots-other-topics-20260914-v1";
const manifestPath = path.resolve(`.tmp/aidreamshoots-other-topic-regeneration/${batchId}/manifest.json`);
const publicPrefix = `/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}/`;
const siteId = "site_mydreamshoots_xby";
const topicSlugs = [
  "brand-video", "cinematic-video", "explainer-video", "fashion-video", "food-video",
  "how-to-video", "instagram-reels", "meme-video", "music-video", "pet-video",
  "product-ad-video", "product-video", "promo-video", "social-media-video", "story-video",
  "talking-head-video", "tiktok-video", "ugc-ad-video", "video-ad", "youtube-video"
];
const imagePattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;
const videoPattern = /\.(?:mp4|webm|mov)(?:[?#]|$)/i;
const imageKeys = new Set(["src", "poster", "imageUrl", "url"]);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function collectImageRefs(value, output = []) {
  if (Array.isArray(value)) { value.forEach((item) => collectImageRefs(item, output)); return output; }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (imageKeys.has(key) && typeof child === "string" && imagePattern.test(child)) output.push({ value: child, alt: value.alt ?? null });
    collectImageRefs(child, output);
  }
  return output;
}

function collectVideoRefs(value, output = []) {
  if (Array.isArray(value)) { value.forEach((item) => collectVideoRefs(item, output)); return output; }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (["src", "poster", "url"].includes(key) && typeof child === "string" && videoPattern.test(child)) output.push(child);
    collectVideoRefs(child, output);
  }
  return output;
}

function fileFor(publicUrl) {
  return path.join(repoRoot, "public", publicUrl.replace(/^\//, "").split(/[?#]/)[0]);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.mode, "applied");
assert.equal(manifest.imageCount, 180);
assert(manifest.runtime?.paidCreateAttempts >= 180 && manifest.runtime?.paidCreateAttempts <= 250, "Paid create attempts must cover the 180 assets and remain within the 250 cap.");
assert.equal(manifest.runtime?.succeeded, 180);
assert.equal(manifest.diversityResult?.pass, true);

const expectedVideos = new Map(manifest.before.pages.map((page) => [page.slug, page.videoRefs]));
const prisma = new PrismaClient();
try {
  const [site, pages, themes, normalSitePages] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findMany({ where: { siteId, slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } }, select: { slug: true, contentJson: true }, orderBy: { slug: "asc" } }),
    prisma.videoTheme.findMany({ where: { siteId, slug: { in: topicSlugs } }, select: { slug: true, imageUrl: true, galleryImages: true }, orderBy: { slug: "asc" } }),
    prisma.livePage.findMany({ where: { siteId: "site_dreamshoot", slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } }, select: { slug: true, contentJson: true } })
  ]);
  assert.deepEqual(site, { id: siteId, slug: "aidreamshoots", primaryDomain: "aidreamshoots.eu" });
  assert.equal(pages.length, topicSlugs.length);
  assert.equal(themes.length, topicSlugs.length);
  const tasksBySource = new Map(manifest.tasks.map((task) => [task.sourceUrl, task]));
  const currentUrls = [];
  for (const page of pages) {
    const refs = collectImageRefs(page.contentJson);
    assert(refs.length > 0, `Missing images: ${page.slug}`);
    assert(refs.every((ref) => typeof ref.value === "string" && ref.value.startsWith(publicPrefix)), `Old image URL remains: ${page.slug}`);
    assert(refs.every((ref) => typeof ref.alt === "string" && ref.alt.length >= 30 && ref.alt.length <= 150), `Invalid alt text: ${page.slug}`);
    refs.forEach((ref) => { currentUrls.push(ref.value); assert(fs.existsSync(fileFor(ref.value)), `Missing public file: ${ref.value}`); });
    assert.deepEqual(collectVideoRefs(page.contentJson), (expectedVideos.get(page.slug) ?? []).map((ref) => ref.value), `Video source changed: ${page.slug}`);
  }
  assert.equal(new Set(currentUrls).size, 180);
  for (const theme of themes) {
    assert(theme.imageUrl?.startsWith(publicPrefix), `Theme hero image is old: ${theme.slug}`);
    const gallery = Array.isArray(theme.galleryImages) ? theme.galleryImages : [];
    assert(gallery.filter((value) => videoPattern.test(String(value))).length >= 0);
    assert(gallery.filter((value) => !videoPattern.test(String(value))).every((value) => String(value).startsWith(publicPrefix)), `Theme gallery image is old: ${theme.slug}`);
  }
  assert(normalSitePages.every((page) => !JSON.stringify(page.contentJson).includes(publicPrefix)), "Normal MyDreamShoots pages leaked AIdreamshoots regenerated media.");
  assert.equal(tasksBySource.size, 180);
  console.log(JSON.stringify({ ok: true, site: site.slug, topics: topicSlugs.length, images: 180, namespace: publicPrefix, videoSourcesPreserved: true, normalStoreIsolated: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
