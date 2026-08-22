#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

const SITE_ID = "site_dreamshoot";
const topicSlugs = [
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

function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function topicSection(pageJson, slug) {
  const sectionType = slug === "talking-photo" ? "talking_photo_landing" : "ai_video_topic_landing";
  return Object.values(pageJson.sections ?? {}).find((section) => section?.type === sectionType);
}

function assertTopicContent(page, slug) {
  const section = topicSection(page.publishedJson, slug);
  assert(section, `${slug} must keep its dedicated landing section`);
  const content = section.settings?.content;
  assert(record(content), `${slug} must store its published topic content in ThemePage JSON`);
  assert(record(content.seo), `${slug} must store SEO data with its published topic content`);
  assert.equal(page.publishedJson.seo?.title, content.seo.title, `${slug} page SEO title must match the published topic content`);
  assert.equal(page.publishedJson.seo?.description, content.seo.description, `${slug} page SEO description must match the published topic content`);
  assert.equal(page.publishedJson.seo?.keywords, content.seo.keywords, `${slug} page SEO keywords must match the published topic content`);
  assert.equal(page.publishedJson.seo?.canonicalPath, content.seo.canonicalPath, `${slug} page canonical must match the published topic content`);
  assert(record(content.hero) && record(content.hero.image), `${slug} must keep the hero image metadata in the database content`);
  assert(typeof content.hero.image.src === "string" && typeof content.hero.image.alt === "string", `${slug} hero image needs source and alt text`);
  assert(record(content.faq) && Array.isArray(content.faq.items) && content.faq.items.length > 0, `${slug} must store FAQ data in the database content`);
  const draftSection = topicSection(page.draftJson, slug);
  assert(record(draftSection?.settings?.content), `${slug} must keep editable draft topic content in ThemePage JSON`);
}

const repoRoot = process.cwd();
const landingSource = fs.readFileSync(path.join(repoRoot, "src/components/storefront/video-topic-landing.tsx"), "utf8");
const jsonLdSource = fs.readFileSync(path.join(repoRoot, "src/lib/theme/json-ld.ts"), "utf8");
assert.match(landingSource, /aiVideoTopicLandingContentFromSection/, "video topic renderer must read the published section content");
assert.doesNotMatch(landingSource, /aiVideoTopicLandingContentByKey/, "video topic renderer must not use the frontend topic-content map");
assert.match(jsonLdSource, /aiVideoTopicLandingContentFromSection/, "video topic FAQ JSON-LD must read published section content");
assert.doesNotMatch(jsonLdSource, /aiVideoTopicLandingContentByKey/, "video topic FAQ JSON-LD must not use the frontend topic-content map");

const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({
    where: {
      siteId: SITE_ID,
      slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) }
    },
    select: { slug: true, draftJson: true, publishedJson: true },
    orderBy: { slug: "asc" }
  });
  assert.equal(pages.length, topicSlugs.length, "every public video topic must have a ThemePage");
  const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
  for (const slug of topicSlugs) {
    const page = pageBySlug.get(`/ai-video-generation/${slug}`);
    assert(page, `missing ThemePage for ${slug}`);
    assertTopicContent(page, slug);
  }
  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, checkedTopics: topicSlugs.length }, null, 2));
} finally {
  await prisma.$disconnect();
}
