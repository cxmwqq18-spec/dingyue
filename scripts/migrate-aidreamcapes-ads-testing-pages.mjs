#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesAdsTestingPagesForMigration, validateAidreamcapesAdsTestingContent } from "./lib/aidreamcapes-ads-testing-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const pages = aidreamcapesAdsTestingPagesForMigration();
const fallbackPageId = (page) => `aidreamcapes_ads_testing_${page.key.replace(/[^a-z0-9]+/g, "_")}`;
const expectedPageIds = pages.map(fallbackPageId);
const apply = hasArgument("--apply-local");
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const requestedPageIds = argumentValue("--page-ids") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
assertDatabaseTarget({ expectedTarget: "local" });
validateAidreamcapesAdsTestingContent({ log: (line) => console.log(`[content] ${line}`) });
if (apply) {
  assert.equal(confirmation, SITE_ID, `Applying requires --confirm=${SITE_ID}.`);
  assert.equal(requestedPageIds, expectedPageIds.join(","), "Applying requires the exact 11 target page IDs in --page-ids.");
  assertNonProductionWriteTarget();
}

function hashJson(value) {
  const stable = (current) => {
    if (Array.isArray(current)) return current.map(stable);
    if (current && typeof current === "object") return Object.fromEntries(Object.keys(current).sort().map((key) => [key, stable(current[key])]));
    return current;
  };
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function pageContent(page) {
  const content = page.content;
  const media = [content.hero.productImage, content.hero.outputImage, ...content.examples.items.map((item) => item.image)].map((image, index) => ({
    src: image.src,
    alt: image.alt,
    width: image.width,
    height: image.height,
    role: index < 2 ? "hero" : "content",
    loading: image.loading,
    fetchPriority: image.fetchPriority,
    sizes: image.sizes
  }));
  return {
    seo: { ...content.seo, index: true, follow: true },
    version: 1,
    pageType: "ai_tool",
    sections: {
      ai_video_topic_landing_1: {
        type: "ai_video_topic_landing",
        blocks: [],
        settings: {
          anchor: page.key,
          contentKey: `ads-testing-${page.key}`,
          content
        }
      }
    },
    mediaManifest: media,
    sectionsOrder: ["ai_video_topic_landing_1"],
    contentContract: {
      schema: "editorial-page-v1",
      pageKey: `aidreamcapes/${page.key}`,
      faqCount: content.faq.items.length,
      seoSource: "LivePage.contentJson",
      mediaCount: media.length,
      sectionTypes: ["ai_video_topic_landing"],
      sourceRevision: "aidreamcapes-ads-testing-v3-topic-specific-image-sets",
      requiredSections: ["ai_video_topic_landing_1"]
    }
  };
}

function updateNavigation(source) {
  const next = structuredClone(source ?? {});
  const hrefByLabel = new Map([
    ["URL to Ad", "/ai-video-generation/url-to-ad"],
    ["Hook Lab (First 3s)", "/ai-video-generation/hook-lab"],
    ["Hook Lab", "/ai-video-generation/hook-lab"],
    ["PAS Formula Ads", "/ai-video-generation/pas-formula-ads"],
    ["Testimonial Ads", "/ai-video-generation/testimonial-ads"],
    ["Before-After Showcases", "/ai-video-generation/before-after-showcases"],
    ["Before-After Ads", "/ai-video-generation/before-after-showcases"],
    ["Talking Photo Recs", "/ai-video-generation/talking-photo-recs"],
    ["AI Actor Product Ads", "/ai-video-generation/ai-actor-product-ads"],
    ["Actors & Talking", "/ai-video-generation/ai-actor-product-ads"],
    ["TikTok / Reels / Shorts", "/ai-video-generation/tiktok-reels-shorts"],
    ["Native Spark Ads", "/ai-video-generation/native-spark-ads"],
    ["Carousel Storytelling", "/ai-video-generation/carousel-storytelling"],
    ["Retargeting / Urgency", "/ai-video-generation/retargeting-urgency"],
    ["Marketing Hub", "/ai-video-generation/ugc-ad-video"],
    ["Open Marketing Hub →", "/ai-video-generation/ugc-ad-video"]
  ]);
  let changed = 0;
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.label === "string" && hrefByLabel.has(value.label) && typeof value.href === "string" && value.href !== hrefByLabel.get(value.label)) {
      value.href = hrefByLabel.get(value.label);
      changed += 1;
    }
    Object.values(value).forEach(visit);
  };
  visit(next.video);
  visit(next.marketing);
  visit(next.footerGroups);
  return { next, changed };
}

const prisma = new PrismaClient();
try {
  const [site, existingPages, settings] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: pages.map((page) => page.slug) } }, select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert(site, `${SITE_ID}: site not found`);
  assert(settings, `${SITE_ID}: theme settings not found`);
  const existingBySlug = new Map(existingPages.map((page) => [page.slug, page]));
  const nextPages = pages.map((page) => ({
    id: existingBySlug.get(page.slug)?.id ?? fallbackPageId(page),
    siteId: SITE_ID,
    pageType: "ai_tool",
    templateKey: `ai-video-topic-ads-testing-${page.key}`,
    slug: page.slug,
    title: page.title,
    contentJson: pageContent(page)
  }));
  const navigationDraft = updateNavigation(settings.draftJson);
  const navigationPublished = updateNavigation(settings.publishedJson);
  const report = nextPages.map((page) => ({
    id: page.id,
    slug: page.slug,
    action: existingBySlug.has(page.slug) ? "UPDATE" : "CREATE",
    sections: page.contentJson.sectionsOrder.length,
    media: page.contentJson.mediaManifest.length,
    contentHash: hashJson(page.contentJson),
    previousHash: existingBySlug.has(page.slug) ? hashJson(existingBySlug.get(page.slug).contentJson) : null
  }));

  if (apply) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `ads-testing-pages-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, JSON.stringify({ site, existingPages, settings }, null, 2) + "\n", "utf8");
    await prisma.$transaction(async (tx) => {
      for (const page of nextPages) {
        await tx.livePage.upsert({
          where: { id: page.id },
          create: page,
          update: { pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, contentJson: page.contentJson }
        });
      }
      if (navigationDraft.changed || navigationPublished.changed) {
        await tx.themeSettings.update({
          where: { siteId: SITE_ID },
          data: { draftJson: navigationDraft.next, publishedJson: navigationPublished.next }
        });
      }
    });
    const readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID, id: { in: expectedPageIds } }, select: { id: true, slug: true, contentJson: true } });
    assert.equal(readback.length, nextPages.length, "LivePage readback count");
    const readbackById = new Map(readback.map((page) => [page.id, page]));
    for (const page of nextPages) assert.equal(hashJson(readbackById.get(page.id)?.contentJson), hashJson(page.contentJson), `${page.id}: content hash readback`);
    report.forEach((item) => { item.readback = "PASS"; });
    console.log(JSON.stringify({ ok: true, mode: "applied", siteId: SITE_ID, backupPath, navigationChanges: navigationDraft.changed + navigationPublished.changed, pages: report }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", siteId: SITE_ID, existingPageCount: existingPages.length, navigationChanges: navigationDraft.changed + navigationPublished.changed, pages: report, applyCommand: `node scripts/migrate-aidreamcapes-ads-testing-pages.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID} --page-ids=${expectedPageIds.join(",")}` }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
