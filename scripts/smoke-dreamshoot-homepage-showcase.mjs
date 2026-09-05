#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

// PostgreSQL is the only runtime/release source. data/platform-state.json is retired.
const prisma = new PrismaClient();
const repoRoot = process.cwd();
const copy = JSON.parse(fs.readFileSync(path.join(repoRoot, "src/lib/mydreamshoots-homepage-copy.json"), "utf8"));
const origin = String(process.env.MYDREAMSHOOTS_SMOKE_ORIGIN ?? "https://www.mydreamshoots.com").replace(/\/$/, "");

function assertText(value, expected, label) {
  assert.equal(String(value ?? "").replace(/[—–]/g, "-"), String(expected).replace(/[—–]/g, "-"), label);
}

async function main() {
  assert.ok(process.env.DATABASE_URL?.trim(), "DATABASE_URL is required; data/platform-state.json has been retired");
  const site = await prisma.site.findFirst({
    where: { OR: [{ id: "site_dreamshoot" }, { primaryDomain: "www.mydreamshoots.com" }] },
    select: {
      id: true,
      livePages: { where: { slug: "/" }, select: { contentJson: true } }
    }
  });
  assert.ok(site, "site_dreamshoot must exist in PostgreSQL");
  const page = site.livePages[0]?.contentJson;
  assert.ok(page, "published MyDreamShoots homepage LivePage must exist");
  const sections = page.sections ?? {};
  const order = page.sectionsOrder ?? [];
  assert.deepEqual(order, ["hero_1", "generation_showcase_1", "tutorial_video_1", "proof_1", "faq_1", "conversion_1", "brand_strip_1"], "homepage order must use the current Phase B contract");
  assert.equal(sections.generation_showcase_1?.type, "dreamshoot_generation_showcase");
  assert.equal(sections.package_catalog_1, undefined, "homepage must not retain the removed package catalog section");
  assert.equal(sections.tutorial_video_1?.settings?.showEyebrow, false, "homepage how-it-works eyebrow must be hidden");
  assert.equal(sections.proof_1?.settings?.title, copy.reviewTitle);
  assert.equal(sections.conversion_1?.settings?.title, copy.conversionTitle);
  assertText(sections.conversion_1?.settings?.subtitle, copy.conversionSubtitle, "conversion subtitle drifted");
  assert.equal(sections.pricing_1?.settings?.description, "Use credits across eligible AI photo and video workflows. The required credit cost is shown before generation.");

  const proofMedia = (sections.proof_1?.blocks ?? [])
    .map((block) => block?.settings?.resultImageUrl)
    .filter((value) => typeof value === "string" && value.startsWith("/assets/"));
  const expectedProofMedia = {
    review_ava: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03-20260830.webp",
    review_lucas: "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-02-20260830.webp",
    review_mia: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/christmas-holiday-card-couple-photo.webp",
    review_noah: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/private-photo-gallery-review.webp",
    review_chloe: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/fresh-social-content-creator-scene.webp",
    review_eli: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/polished-professional-headshot.webp",
    review_jordan: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/team-page-professional-portrait.webp",
    review_riley: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/instagram-social-content-creator-photo.webp"
  };
  for (const block of sections.proof_1?.blocks ?? []) {
    if (expectedProofMedia[block?.id]) assert.equal(block.settings?.resultImageUrl, expectedProofMedia[block.id], `${block.id} must use the approved current result image`);
  }
  for (const mediaPath of [...new Set(proofMedia)]) {
    const mediaResponse = await fetch(`${origin}${mediaPath}`);
    assert.equal(mediaResponse.status, 200, `homepage proof media must return 200: ${mediaPath}`);
  }

  const response = await fetch(`${origin}/`, { headers: { accept: "text/html,*/*" } });
  assert.equal(response.status, 200, "production homepage must return 200");
  const html = await response.text();
  for (const mediaPath of [...new Set(proofMedia)]) {
    const renderedPath = mediaPath.endsWith(".png") ? mediaPath.replace(/\.png$/, ".webp") : mediaPath;
    assert.ok(html.includes(mediaPath) || html.includes(renderedPath), `production homepage must render synced proof media: ${mediaPath}`);
  }
  assert.ok(html.includes("20260830-homepage-review-replacements"), "production homepage must render the approved review media set");
  assert.ok(html.includes("world-cup-fan-photos-03-20260830.webp"), "production homepage must render the approved world cup review media");
  assert.ok(html.includes("gala-photos-02-20260830.webp"), "production homepage must render the approved gala review media");
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, "homepage must contain exactly one H1");
  assert.ok(!/<h2\b[^>]*>[^<]*Creative workflow examples built with myDreamshoots/i.test(html), "workflow examples must not render as an H2");
  assert.ok(!/<h2\b[^>]*>\s*(?:Soccer|Portrait Photo|Christmas Photo)\s*<\/h2>/i.test(html), "photo package cards must not render as H2");
  if (sections.package_catalog_1) {
    assert.ok(html.includes(copy.packageVideoLinkLabel), "photo packages must link to AI Video Generation");
  }
  assert.ok(html.includes(copy.reviewTitle), "production homepage must expose the approved review heading");
  assert.ok(html.includes(copy.videoTitle) && html.includes(copy.saveTheDateTitle) && html.includes(copy.photoTitle), "production gallery headings must use the Phase B contract");
  const tutorialMarker = 'id="xfcart-section-tutorial_video_1"';
  const tutorialStart = html.indexOf(tutorialMarker);
  const tutorialEnd = tutorialStart >= 0 ? html.indexOf('id="xfcart-section-', tutorialStart + tutorialMarker.length) : -1;
  const tutorialHtml = tutorialStart >= 0 ? html.slice(tutorialStart, tutorialEnd > tutorialStart ? tutorialEnd : undefined) : "";
  assert.ok(!/font-mono[^>]*uppercase[^>]*>\s*How it works\s*<\/p>/i.test(tutorialHtml), "homepage how-it-works eyebrow must not render");
  const photoSectionStart = html.indexOf('data-dreamshoot-homepage-showcase-kind="photo"');
  const photoShowcaseHtml = photoSectionStart >= 0 ? html.slice(photoSectionStart) : "";
  assert.ok(
    photoShowcaseHtml.includes('data-dreamshoot-homepage-showcase-kind="photo"') || photoShowcaseHtml.includes('data-dreamshoot-showcase-preview="image"'),
    "production photo showcase must contain at least one rendered photo card"
  );

  console.log(JSON.stringify({ ok: true, production: { origin, status: response.status } }, null, 2));
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
