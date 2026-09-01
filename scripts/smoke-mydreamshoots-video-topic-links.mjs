#!/usr/bin/env node
import assert from "node:assert/strict";
import createJiti from "jiti";

const publicTopicSlugs = [
  "talking-photo",
  "motion-generator",
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
  "pet-video",
  "explainer-video",
  "how-to-video",
  "talking-head-video"
];

const publicTopicPaths = new Set([
  "/ai-video-generation",
  ...publicTopicSlugs.map((slug) => `/ai-video-generation/${slug}`)
]);

const jiti = createJiti(import.meta.url);
const { aiVideoTopicLandingContentByKey } = jiti("./seed-mydreamshoots-ai-video-topic-content.ts");
const invalidLinks = [];

for (const [slug, content] of Object.entries(aiVideoTopicLandingContentByKey)) {
  for (const [index, item] of (content.comparison?.items ?? []).entries()) {
    const href = typeof item?.href === "string" ? item.href.split(/[?#]/)[0] : "";
    if (href.startsWith("/ai-video-generation/") && !publicTopicPaths.has(href)) {
      invalidLinks.push(`${slug}: comparison.items[${index}].href -> ${href}`);
    }
  }
}

assert.equal(invalidLinks.length, 0, `comparison cards point to unpublished video topic routes:\n${invalidLinks.join("\n")}`);
console.log(`Checked ${Object.keys(aiVideoTopicLandingContentByKey).length} video topic seeds.`);
