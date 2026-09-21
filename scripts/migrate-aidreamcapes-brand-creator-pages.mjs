#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesBrandCreatorPagesForMigration, validateAidreamcapesBrandCreatorContent } from "./lib/aidreamcapes-brand-creator-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const pages = aidreamcapesBrandCreatorPagesForMigration();
const targetIdsByKey = {
  "founder-update": "aidreamcapes_brand_creator_founder_update",
  "multilingual-video": "aidreamcapes_brand_creator_multilingual_video",
  "cinematic-product-film": "aidreamcapes_mirror_page_e8ac6b19a0213b0d",
  "trending-audio-sync": "aidreamcapes_mirror_page_6a41c9686fb0a21c"
};
const expectedPageIds = pages.map((page) => targetIdsByKey[page.key]);
const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
assert.equal(!(applyLocal && applyProduction), true, "Choose exactly one database apply target.");
const apply = applyLocal || applyProduction;
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const requestedPageIds = argumentValue("--page-ids") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
assert.equal(expectedPageIds.every(Boolean), true, "Every Brand / Creator page must have an explicit target page ID.");
assertDatabaseTarget({
  expectedTarget: applyProduction ? "production" : "local",
  requireProductionConfirmation: applyProduction,
  productionConfirmed: confirmation === "production"
});
await validateAidreamcapesBrandCreatorContent({ log: (line) => console.log(`[content] ${line}`), requireAssets: apply });
if (apply) {
  assert.equal(confirmation, applyProduction ? "production" : SITE_ID, `Applying requires --confirm=${applyProduction ? "production" : SITE_ID}.`);
  assert.equal(requestedPageIds, expectedPageIds.join(","), "Applying requires the exact four target page IDs in --page-ids.");
  if (applyLocal) assertNonProductionWriteTarget();
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
    role: index === 0 ? "product-source" : index === 1 ? "hero-output" : "example",
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
        settings: { anchor: page.key, contentKey: content.contentKey, content }
      }
    },
    mediaManifest: media,
    sectionsOrder: ["ai_video_topic_landing_1"],
    contentContract: {
      schema: "editorial-page-v1",
      pageKey: `aidreamcapes/brand-creator/${page.key}`,
      faqCount: content.faq.items.length,
      seoSource: "LivePage.contentJson",
      mediaSource: "LivePage.contentJson",
      mediaCount: media.length,
      sectionTypes: ["ai_video_topic_landing"],
      sourceRevision: "aidreamcapes-brand-creator-v1-provider-image4",
      requiredSections: ["ai_video_topic_landing_1"]
    }
  };
}

const targetHrefByLabel = new Map([
  ["Founder Update", "/ai-video-generation/founder-update"],
  ["Localization (Multi-language)", "/ai-video-generation/multilingual-video"],
  ["Cinematic Product Film", "/ai-video-generation/cinematic-video"],
  ["Trending Audio Sync", "/ai-video-generation/music-video"]
]);

function updateNavigation(source) {
  const next = structuredClone(source ?? {});
  const groups = next.aidreamcapesZipNavigation?.video?.groups;
  assert(Array.isArray(groups), "Aidreamcapes ZIP video navigation groups are missing.");
  const group = groups.find((item) => item?.label === "Brand / Creator");
  assert(group && Array.isArray(group.items), "Brand / Creator navigation group is missing.");
  assert.deepEqual(group.items.map((item) => item.label), [...targetHrefByLabel.keys()], "Brand / Creator labels/order changed unexpectedly.");
  let changed = 0;
  for (const item of group.items) {
    const finalHref = targetHrefByLabel.get(item.label);
    assert(finalHref, `${item.label}: unexpected Brand / Creator navigation item`);
    assert.equal(typeof item.href, "string", `${item.label}: current navigation item has no href`);
    if (item.href !== finalHref) { item.href = finalHref; changed += 1; }
  }
  assert.deepEqual(group.items.map((item) => item.href), [...targetHrefByLabel.values()], "Brand / Creator navigation href readback does not match target routes.");
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
  const navigationDraft = updateNavigation(settings.draftJson);
  const navigationPublished = updateNavigation(settings.publishedJson);
  const nextPages = pages.map((page) => ({
    id: targetIdsByKey[page.key],
    siteId: SITE_ID,
    pageType: "ai_tool",
    templateKey: `ai-video-topic-brand-creator-${page.key}`,
    slug: page.slug,
    title: page.title,
    contentJson: pageContent(page)
  }));
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
    const backupPath = path.resolve(backupRoot, `brand-creator-pages-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ site, existingPages, existingTargetIds, settings }, null, 2)}\n`, "utf8");
    await prisma.$transaction(async (tx) => {
      for (const page of nextPages) {
        await tx.livePage.upsert({
          where: { id: page.id },
          create: page,
          update: { pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, contentJson: page.contentJson }
        });
      }
      await tx.themeSettings.update({ where: { siteId: SITE_ID }, data: { draftJson: navigationDraft.next, publishedJson: navigationPublished.next } });
    });
    const readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID, id: { in: expectedPageIds } }, select: { id: true, slug: true, contentJson: true } });
    assert.equal(readback.length, nextPages.length, "LivePage readback count");
    const readbackById = new Map(readback.map((page) => [page.id, page]));
    for (const page of nextPages) {
      assert.equal(hashJson(readbackById.get(page.id)?.contentJson), hashJson(page.contentJson), `${page.id}: content hash readback`);
      assert.equal(readbackById.get(page.id)?.contentJson?.sections?.ai_video_topic_landing_1?.settings?.content?.layoutVariant, "brand-creator-detail", `${page.id}: layout readback`);
    }
    const settingsReadback = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } });
    const checkDraft = updateNavigation(settingsReadback?.draftJson);
    const checkPublished = updateNavigation(settingsReadback?.publishedJson);
    assert.equal(checkDraft.changed, 0, "Draft navigation readback drift");
    assert.equal(checkPublished.changed, 0, "Published navigation readback drift");
    report.forEach((item) => { item.readback = "PASS"; });
    console.log(JSON.stringify({ ok: true, mode: applyProduction ? "production-applied" : "applied", siteId: SITE_ID, backupPath, navigationChanges: navigationDraft.changed + navigationPublished.changed, pages: report }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", siteId: SITE_ID, existingPageCount: existingPages.length, navigationChanges: navigationDraft.changed + navigationPublished.changed, pages: report, applyCommand: `node scripts/migrate-aidreamcapes-brand-creator-pages.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID} --page-ids=${expectedPageIds.join(",")}` }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
