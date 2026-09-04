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
const retiredRelatedTopicHrefs = new Set([
  "/ai-video-generation/ai-avatar-video",
  "/ai-video-generation/corporate-video",
  "/ai-video-generation/fitness-video"
]);
const retiredPublicTopicSlugs = new Set(["ai-avatar-video", "corporate-video", "fitness-video"]);
const internalProductionCopyPattern = /FIRST-PARTY PRODUCT EVIDENCE|V2\s*-\s*REAL EXAMPLES|pending capture|pending product record|pending review|PAGE DIFFERENTIATION \/ INTERNAL LINKING/i;

for (const [slug, content] of Object.entries(aiVideoTopicLandingContentByKey)) {
  const serialized = JSON.stringify(content);
  assert.doesNotMatch(serialized, internalProductionCopyPattern, `${slug} seed must not expose internal production copy`);
  if (["brand-video", "fashion-video", "food-video", "music-video", "pet-video", "explainer-video", "how-to-video", "promo-video", "talking-head-video", "ugc-ad-video"].includes(slug)) {
    assert.equal(content.evidence, undefined, `${slug} must not publish an evidence section`);
  }
  if (["promo-video", "ugc-ad-video"].includes(slug)) {
    assert.equal(content.examples, undefined, `${slug} must not publish an examples section`);
    assert.equal(content.comparison?.eyebrow, "Which video format fits", `${slug} comparison eyebrow must be customer-facing`);
    assert.equal(content.hero?.secondaryCta, slug === "promo-video" ? "See the promo workflow" : "See the UGC workflow", `${slug} secondary CTA must point to the workflow`);
  }
  if (["how-to-video", "talking-head-video"].includes(slug)) {
    const relatedHrefs = (content.comparison?.items ?? []).map((item) => item.href).filter(Boolean);
    assert.equal(relatedHrefs.some((href) => retiredRelatedTopicHrefs.has(href)), false, `${slug} must not link to retired video topic pages`);
  }
  for (const [index, item] of (content.comparison?.items ?? []).entries()) {
    const href = typeof item?.href === "string" ? item.href.split(/[?#]/)[0] : "";
    if (href.startsWith("/ai-video-generation/") && !publicTopicPaths.has(href)) {
      invalidLinks.push(`${slug}: comparison.items[${index}].href -> ${href}`);
    }
  }
}

const framework = jiti("../src/lib/mydreamshoots-video-framework.ts");
const frameworkCategories = framework.mydreamshootsVideoGenerationCategoriesForSite("site_dreamshoot");
for (const slug of retiredPublicTopicSlugs) {
  assert.equal(frameworkCategories.some((category) => category.slug === slug), false, `${slug} must not be in the active MyDreamShoots video category seed`);
}

assert.equal(invalidLinks.length, 0, `comparison cards point to unpublished video topic routes:\n${invalidLinks.join("\n")}`);
console.log(`Checked ${Object.keys(aiVideoTopicLandingContentByKey).length} video topic seeds.`);
