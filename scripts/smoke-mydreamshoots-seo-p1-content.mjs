#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const slugs = ["/", "/creators-circle", "/ai-image-generation", "/about-us", "/contact-us", "/pricing", "/workflow", "/ai-save-the-date/christmas"];
const prisma = new PrismaClient();
try {
  const [themePages, livePages] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId, slug: { in: slugs } }, select: { slug: true, publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId, slug: { in: slugs } }, select: { slug: true, contentJson: true } })
  ]);
  assert.equal(themePages.length, slugs.length, "all P1 ThemePage rows must exist");
  assert.equal(livePages.length, slugs.length, "all P1 LivePage rows must exist");
  const all = [...themePages.map((row) => row.publishedJson), ...livePages.map((row) => row.contentJson)];
  const serialized = JSON.stringify(all);
  assert(!serialized.includes("myDreamshoots's"), "P1 public content must not contain the possessive typo");
  assert(!serialized.includes("Our plans starts"), "P1 public pricing content must use the corrected plans-start wording");
  for (const json of all) {
    if (json?.sections?.christmas_hero) continue;
    const conversion = json?.sections?.conversion_1?.settings;
    assert.equal(conversion?.title, "Ready to try myDreamshoots?", "conversion CTA title must be canonical");
  }
  const christmas = themePages.find((row) => row.slug === "/ai-save-the-date/christmas");
  assert.equal(
    christmas?.publishedJson?.sections?.christmas_hero?.settings?.title,
    "Create AI Christmas Photos and Videos"
  );
  assert.equal(
    christmas?.publishedJson?.sections?.christmas_hero?.settings?.h1,
    "Create AI Christmas Photos and Videos"
  );
  const homepage = themePages.find((row) => row.slug === "/");
  assert.equal(homepage?.publishedJson?.sections?.generation_showcase_1?.settings?.embeddedPricingSectionId, "pricing_1");
  const imagePage = themePages.find((row) => row.slug === "/ai-image-generation");
  assert.equal(
    imagePage?.publishedJson?.sections?.taxonomy_1?.settings?.subtitle,
    "Browse all 37 myDreamshoots themes across professional, lifestyle, creative, magic, and photo tools before spending credits."
  );
  const pricingPage = themePages.find((row) => row.slug === "/pricing");
  assert.equal(pricingPage?.publishedJson?.seo?.title, "myDreamshoots Pricing | AI Photo and Video Credits");
  assert.equal(
    pricingPage?.publishedJson?.sections?.pricing_1?.settings?.sidePanelTitle,
    "Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}, with the current credit allowance and billing interval shown for each option."
  );
  const creators = themePages.find((row) => row.slug === "/creators-circle")?.publishedJson?.sections;
  for (const sectionId of ["creators_intro_1", "creators_fit_1"]) {
    assert.equal(creators?.[sectionId]?.settings?.primaryHref, "/contact-us");
    assert.equal(creators?.[sectionId]?.settings?.primaryCta, "Contact us about the Creators Circle");
  }
  assert.equal(
    creators?.pricing_1?.settings?.sidePanelTitle,
    "Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}, with the current credit allowance and billing interval shown for each option."
  );
  const bestVideo = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId, slug: "/best-ai-video" } }, select: { contentJson: true } });
  assert.equal(bestVideo?.contentJson?.sections?.best_ai_video_1?.settings?.title, "Best AI Video Generation", "Best AI Video must remain unchanged");
  console.log(JSON.stringify({ ok: true, siteId, checkedPages: slugs.length, bestAiVideo: "unchanged" }));
} finally {
  await prisma.$disconnect();
}
