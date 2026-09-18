#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesBrandCreatorPagesForMigration } from "./lib/aidreamcapes-brand-creator-content.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const LOCAL_ORIGIN = "http://127.0.0.1:3002";
const targetIdsByKey = {
  "founder-update": "aidreamcapes_brand_creator_founder_update",
  "multilingual-video": "aidreamcapes_brand_creator_multilingual_video",
  "cinematic-product-film": "aidreamcapes_mirror_page_e8ac6b19a0213b0d",
  "trending-audio-sync": "aidreamcapes_mirror_page_6a41c9686fb0a21c"
};
const pages = aidreamcapesBrandCreatorPagesForMigration();
const componentPath = path.resolve("src/components/storefront/brand-creator-detail.tsx");

assertDatabaseTarget({ expectedTarget: "local" });

function jsonLdFromHtml(html) {
  return Array.from(html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => { try { return JSON.parse(match[1]); } catch { return undefined; } })
    .filter(Boolean);
}

function graphNodes(html) {
  return jsonLdFromHtml(html).flatMap((item) => Array.isArray(item?.["@graph"]) ? item["@graph"] : [item]);
}

const prisma = new PrismaClient();
try {
  const [livePages, settings, componentSource] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: SITE_ID, id: { in: Object.values(targetIdsByKey) } }, select: { id: true, siteId: true, slug: true, title: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { publishedJson: true } }),
    fs.readFile(componentPath, "utf8")
  ]);
  assert.equal(livePages.length, pages.length, "Brand / Creator LivePage rows are incomplete");
  assert(!componentSource.includes("fetch("), "Brand / Creator renderer must not fetch body data from the browser");
  const byId = new Map(livePages.map((page) => [page.id, page]));
  const seenMedia = new Set();
  const seenCanonical = new Set();
  for (const pageSpec of pages) {
    const page = byId.get(targetIdsByKey[pageSpec.key]);
    assert(page, `${pageSpec.key}: missing LivePage`);
    assert.equal(page.siteId, SITE_ID, `${pageSpec.key}: site isolation`);
    assert.equal(page.slug, pageSpec.slug, `${pageSpec.key}: route`);
    const content = page.contentJson?.sections?.ai_video_topic_landing_1?.settings?.content;
    assert.equal(content?.layoutVariant, "brand-creator-detail", `${pageSpec.key}: layout variant`);
    assert.equal(page.contentJson?.contentContract?.seoSource, "LivePage.contentJson", `${pageSpec.key}: SEO source`);
    assert.equal(page.contentJson?.contentContract?.mediaSource, "LivePage.contentJson", `${pageSpec.key}: media source`);
    assert.equal(page.contentJson?.contentContract?.mediaCount, 9, `${pageSpec.key}: media contract`);
    assert.equal(content?.faq?.items?.length, 5, `${pageSpec.key}: FAQ count`);
    const images = [content.hero.productImage, content.hero.outputImage, ...content.examples.items.map((item) => item.image)];
    assert.equal(images.length, 9, `${pageSpec.key}: image count`);
    assert.equal(new Set(images.map((image) => image.src)).size, 9, `${pageSpec.key}: page image uniqueness`);
    for (const image of images) {
      assert(image.src.startsWith("/assets/sites/site_aidreamcapes/brand-creator-v1/"), `${pageSpec.key}: storefront image isolation`);
      assert(!image.src.includes("/site_aidreamcapes.eu/") && !image.src.includes("/assets/dreamshoot/"), `${pageSpec.key}: cross-store image path`);
      assert(image.src.endsWith(".webp"), `${pageSpec.key}: WebP contract`);
      assert(image.alt && image.width === 400 && image.height === 400, `${pageSpec.key}: image metadata`);
      const filePath = path.resolve("public", image.src.slice(1));
      const metadata = await sharp(filePath).metadata();
      assert.equal(metadata.width, image.width, `${pageSpec.key}: ${image.src} width readback`);
      assert.equal(metadata.height, image.height, `${pageSpec.key}: ${image.src} height readback`);
      seenMedia.add(image.src);
    }
    const htmlResponse = await fetch(`${LOCAL_ORIGIN}/site/aidreamcapes${page.slug}`, { headers: { Accept: "text/html" }, cache: "no-store" });
    assert.equal(htmlResponse.status, 200, `${pageSpec.key}: SSR HTTP status`);
    const html = await htmlResponse.text();
    const renderedHtml = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    assert(html.includes('data-aidreamcapes-detail-variant="brand-creator-detail"'), `${pageSpec.key}: dedicated renderer marker`);
    assert(html.includes(`<link rel="canonical" href="https://www.aidreamcapes.com${page.slug}"`), `${pageSpec.key}: canonical in head`);
    assert(!html.includes('href="#"'), `${pageSpec.key}: href hash`);
    // Next development RSC payloads include compiled source text from shared
    // modules. Check the rendered document outside scripts for storefront
    // leakage, which is the user-visible surface.
    assert(!/mydreamshoots\.com/i.test(renderedHtml), `${pageSpec.key}: cross-store domain leak`);
    assert(html.includes(content.seo.title), `${pageSpec.key}: SQL title not rendered`);
    const nodes = graphNodes(html);
    assert(nodes.some((node) => node?.["@type"] === "FAQPage" && node.mainEntity?.length === content.faq.items.length), `${pageSpec.key}: FAQ JSON-LD`);
    assert(nodes.some((node) => node?.["@type"] === "Service" && /^AI .* service$/i.test(String(node.serviceType))), `${pageSpec.key}: Service JSON-LD`);
    assert(nodes.some((node) => node?.["@type"] === "SoftwareApplication" && /video/i.test(String(node.applicationCategory))), `${pageSpec.key}: SoftwareApplication JSON-LD`);
    seenCanonical.add(content.seo.canonical);
    console.log(`${pageSpec.key}: HTTP 200, SQL content, 9 image records, canonical, FAQ, Service and SoftwareApplication passed`);
  }
  assert.equal(seenMedia.size, 36, "Brand / Creator image URLs must be unique across pages");
  assert.equal(seenCanonical.size, 4, "Brand / Creator canonicals must be unique");
  const navigation = settings?.publishedJson?.aidreamcapesZipNavigation?.video?.groups;
  const group = navigation?.find((item) => item?.label === "Brand / Creator");
  assert(group, "Published Brand / Creator navigation group missing");
  assert.deepEqual(group.items.map((item) => item.label), ["Founder Update", "Localization (Multi-language)", "Cinematic Product Film", "Trending Audio Sync"]);
  assert.deepEqual(group.items.map((item) => item.href), pages.map((page) => page.slug));
  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, pages: pages.length, uniqueMedia: seenMedia.size, navigation: "PASS", browserBodyFetch: "PASS" }, null, 2));
} finally {
  await prisma.$disconnect();
}
