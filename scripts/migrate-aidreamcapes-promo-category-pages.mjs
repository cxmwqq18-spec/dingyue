#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesPromoCategoryPagesForMigration, validateAidreamcapesPromoCategoryContent } from "./lib/aidreamcapes-promo-category-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const pages = aidreamcapesPromoCategoryPagesForMigration();
const targetIdsByKey = {
  "promo-video": "aidreamcapes_mirror_page_1401be87d175029e",
  "black-friday-countdown": "aidreamcapes_promo_category_black_friday_countdown",
  "limited-drop-alert": "aidreamcapes_promo_category_limited_drop_alert",
  "discount-free-shipping": "aidreamcapes_promo_category_discount_free_shipping",
  "beauty-routine": "aidreamcapes_promo_category_beauty_routine",
  "supplement-highlight": "aidreamcapes_promo_category_supplement_highlight",
  "fashion-try-on-reel": "aidreamcapes_promo_category_fashion_try_on_reel",
  "food-video": "aidreamcapes_mirror_page_10138ed3e374b09c",
  "home-organization": "aidreamcapes_promo_category_home_organization",
  "app-saas-demo": "aidreamcapes_promo_category_app_saas_demo",
  "local-service-ad": "aidreamcapes_promo_category_local_service_ad"
};
const expectedPageIds = pages.map((page) => targetIdsByKey[page.key]);
const apply = hasArgument("--apply-local");
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const requestedPageIds = argumentValue("--page-ids") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
assert.equal(expectedPageIds.every(Boolean), true, "Every Promo / Category page must have an explicit target page ID.");
assertDatabaseTarget({ expectedTarget: "local" });
validateAidreamcapesPromoCategoryContent({ log: (line) => console.log(`[content] ${line}`), requireAssets: false });
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
        settings: { anchor: page.key, contentKey: `promo-category-${page.key}`, content }
      }
    },
    mediaManifest: media,
    sectionsOrder: ["ai_video_topic_landing_1"],
    contentContract: {
      schema: "editorial-page-v1",
      pageKey: `aidreamcapes/promo-category/${page.key}`,
      faqCount: content.faq.items.length,
      seoSource: "LivePage.contentJson",
      mediaSource: "LivePage.contentJson",
      mediaCount: media.length,
      sectionTypes: ["ai_video_topic_landing"],
      sourceRevision: "aidreamcapes-promo-category-v1-provider-image4",
      requiredSections: ["ai_video_topic_landing_1"]
    }
  };
}

const hrefByLabel = new Map([
  ["Promo / Launch / Sale", "/ai-video-generation/promo-video"],
  ["Black Friday Countdown", "/ai-video-generation/black-friday-countdown"],
  ["Limited Drop Alert", "/ai-video-generation/limited-drop-alert"],
  ["Discount & Free Shipping", "/ai-video-generation/discount-free-shipping"],
  ["Beauty Routine", "/ai-video-generation/beauty-routine"],
  ["Supplement Highlight", "/ai-video-generation/supplement-highlight"],
  ["Fashion Try-On Reel", "/ai-video-generation/fashion-try-on-reel"],
  ["Food & Beverage", "/ai-video-generation/food-video"],
  ["Home Organization", "/ai-video-generation/home-organization"],
  ["App / SaaS Demo", "/ai-video-generation/app-saas-demo"],
  ["Local Service Ad", "/ai-video-generation/local-service-ad"]
]);

function updateNavigation(source) {
  const next = structuredClone(source ?? {});
  const groups = [
    next.aidreamcapesZipNavigation?.video?.groups,
    next.video?.groups
  ].filter(Array.isArray);
  const targetGroups = groups.filter((items) => items.some((group) => group?.label === "Promo / Category"));
  assert.equal(targetGroups.length > 0, true, "Promo / Category group not found in Aidreamcapes navigation data.");
  let changed = 0;
  for (const items of targetGroups) {
    const group = items.find((item) => item?.label === "Promo / Category");
    assert(group && Array.isArray(group.items), "Promo / Category navigation group has no items.");
    for (const item of group.items) {
      const finalHref = hrefByLabel.get(item?.label);
      if (!finalHref) continue;
      assert.equal(typeof item.href, "string", `${item.label}: current navigation item has no href`);
      if (item.href !== finalHref) { item.href = finalHref; changed += 1; }
    }
    assert.deepEqual(group.items.map((item) => item.label), [...hrefByLabel.keys()], "Promo / Category labels/order changed unexpectedly.");
    assert.deepEqual(group.items.map((item) => item.href), [...hrefByLabel.values()], "Promo / Category href readback does not match target routes.");
  }
  return { next, changed };
}

const prisma = new PrismaClient();
try {
  const [site, existingPages, existingTargetIds, settings] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: pages.map((page) => page.slug) } }, select: { id: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true } }),
    prisma.livePage.findMany({ where: { id: { in: expectedPageIds } }, select: { id: true, siteId: true, slug: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert(site, `${SITE_ID}: site not found`);
  assert(settings, `${SITE_ID}: theme settings not found`);
  assert.equal(existingTargetIds.every((page) => page.siteId === SITE_ID), true, "A target page ID belongs to another site.");
  const existingBySlug = new Map(existingPages.map((page) => [page.slug, page]));
  const existingById = new Map(existingTargetIds.map((page) => [page.id, page]));
  for (const page of pages) {
    const existing = existingBySlug.get(page.slug);
    if (existing) assert.equal(existing.id, targetIdsByKey[page.key], `${page.key}: existing route has an unexpected page ID`);
    const target = existingById.get(targetIdsByKey[page.key]);
    if (target) assert.equal(target.siteId, SITE_ID, `${page.key}: target ID is not scoped to ${SITE_ID}`);
  }
  const nextPages = pages.map((page) => ({ id: targetIdsByKey[page.key], siteId: SITE_ID, pageType: "ai_tool", templateKey: `ai-video-topic-promo-category-${page.key}`, slug: page.slug, title: page.title, contentJson: pageContent(page) }));
  const navigationDraft = updateNavigation(settings.draftJson);
  const navigationPublished = updateNavigation(settings.publishedJson);
  const report = nextPages.map((page) => ({ id: page.id, slug: page.slug, action: existingBySlug.has(page.slug) ? "UPDATE" : "CREATE", sections: page.contentJson.sectionsOrder.length, media: page.contentJson.mediaManifest.length, contentHash: hashJson(page.contentJson), previousHash: existingBySlug.has(page.slug) ? hashJson(existingBySlug.get(page.slug).contentJson) : null }));

  if (apply) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `promo-category-pages-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ site, existingPages, existingTargetIds, settings }, null, 2)}\n`, "utf8");
    await prisma.$transaction(async (tx) => {
      for (const page of nextPages) {
        await tx.livePage.upsert({ where: { id: page.id }, create: page, update: { pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, contentJson: page.contentJson } });
      }
      await tx.themeSettings.update({ where: { siteId: SITE_ID }, data: { draftJson: navigationDraft.next, publishedJson: navigationPublished.next } });
    });
    const readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID, id: { in: expectedPageIds } }, select: { id: true, slug: true, contentJson: true } });
    assert.equal(readback.length, nextPages.length, "LivePage readback count");
    const readbackById = new Map(readback.map((page) => [page.id, page]));
    for (const page of nextPages) {
      assert.equal(hashJson(readbackById.get(page.id)?.contentJson), hashJson(page.contentJson), `${page.id}: content hash readback`);
      assert.equal(readbackById.get(page.id)?.contentJson?.sections?.ai_video_topic_landing_1?.settings?.content?.layoutVariant, "promo-category-detail", `${page.id}: layout readback`);
    }
    const settingsReadback = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } });
    const checkDraft = updateNavigation(settingsReadback?.draftJson);
    const checkPublished = updateNavigation(settingsReadback?.publishedJson);
    assert.equal(checkDraft.changed, 0, "Draft navigation readback drift");
    assert.equal(checkPublished.changed, 0, "Published navigation readback drift");
    report.forEach((item) => { item.readback = "PASS"; });
    console.log(JSON.stringify({ ok: true, mode: "applied", siteId: SITE_ID, backupPath, navigationChanges: navigationDraft.changed + navigationPublished.changed, pages: report }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", siteId: SITE_ID, existingPageCount: existingPages.length, navigationChanges: navigationDraft.changed + navigationPublished.changed, pages: report, applyCommand: `node scripts/migrate-aidreamcapes-promo-category-pages.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID} --page-ids=${expectedPageIds.join(",")}` }, null, 2));
  }
} finally { await prisma.$disconnect(); }
