#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesConversionSeedingPagesForMigration, validateAidreamcapesConversionSeedingContent } from "./lib/aidreamcapes-conversion-seeding-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const pages = aidreamcapesConversionSeedingPagesForMigration();
const targetIdsByKey = {
  "product-demo": "aidreamcapes_mirror_page_bf80d4528b76f1ef",
  "unboxing-experience": "aidreamcapes_conversion_seeding_unboxing_experience",
  "how-to-tutorial": "aidreamcapes_mirror_page_efb8110df7c5b0e3",
  "feature-callout": "aidreamcapes_conversion_seeding_feature_callout",
  "competitor-comparison": "aidreamcapes_conversion_seeding_competitor_comparison",
  "social-proof-animation": "aidreamcapes_conversion_seeding_social_proof_animation",
  "duet-reaction": "aidreamcapes_conversion_seeding_duet_reaction",
  "green-screen-speaking": "aidreamcapes_conversion_seeding_green_screen_speaking"
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
assert.equal(expectedPageIds.every(Boolean), true, "Every conversion page must have an explicit target page ID.");
assertDatabaseTarget({
  expectedTarget: applyProduction ? "production" : "local",
  requireProductionConfirmation: applyProduction,
  productionConfirmed: confirmation === "production"
});
validateAidreamcapesConversionSeedingContent({ log: (line) => console.log(`[content] ${line}`,), requireAssets: apply });
if (apply) {
  assert.equal(confirmation, applyProduction ? "production" : SITE_ID, `Applying requires --confirm=${applyProduction ? "production" : SITE_ID}.`);
  assert.equal(requestedPageIds, expectedPageIds.join(","), "Applying requires the exact 8 target page IDs in --page-ids.");
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
          contentKey: `conversion-seeding-${page.key}`,
          content
        }
      }
    },
    mediaManifest: media,
    sectionsOrder: ["ai_video_topic_landing_1"],
    contentContract: {
      schema: "editorial-page-v1",
      pageKey: `aidreamcapes/conversion-seeding/${page.key}`,
      faqCount: content.faq.items.length,
      seoSource: "LivePage.contentJson",
      mediaSource: "LivePage.contentJson",
      mediaCount: media.length,
      sectionTypes: ["ai_video_topic_landing"],
      sourceRevision: "aidreamcapes-conversion-seeding-v1-provider-image4",
      requiredSections: ["ai_video_topic_landing_1"]
    }
  };
}

function updateNavigation(source) {
  const next = structuredClone(source ?? {});
  const hrefByLabel = new Map([
    ["Product Demo", "/ai-video-generation/product-video"],
    ["Unboxing Experience", "/ai-video-generation/unboxing-experience"],
    ["Unboxing", "/ai-video-generation/unboxing-experience"],
    ["How-to Tutorial", "/ai-video-generation/how-to-video"],
    ["How-to Guide", "/ai-video-generation/how-to-video"],
    ["Feature Callout", "/ai-video-generation/feature-callout"],
    ["Competitor Comparison", "/ai-video-generation/competitor-comparison"],
    ["Social Proof Animation", "/ai-video-generation/social-proof-animation"],
    ["Duet / Reaction", "/ai-video-generation/duet-reaction"],
    ["Green Screen Speaking", "/ai-video-generation/green-screen-speaking"]
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
  // Aidreamcapes ZIP navigation is stored below the storefront-specific
  // namespace. The previous implementation only visited top-level `video`
  // and `marketing` keys, so it could report zero changes while the runtime
  // header continued to serve stale routes from SQL.
  visit(next.aidreamcapesZipNavigation?.video);
  visit(next.aidreamcapesZipNavigation?.marketing);
  // Keep compatibility with older drafts that used the top-level shape.
  visit(next.video);
  visit(next.marketing);
  return { next, changed };
}

const prisma = new PrismaClient();
try {
  const slugs = pages.map((page) => page.slug);
  const [site, existingPages, settings] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, select: { id: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert(site, `${SITE_ID}: site not found`);
  assert(settings, `${SITE_ID}: theme settings not found`);
  const existingBySlug = new Map(existingPages.map((page) => [page.slug, page]));
  for (const page of pages) {
    const existing = existingBySlug.get(page.slug);
    if (existing) assert.equal(existing.id, targetIdsByKey[page.key], `${page.key}: existing route has an unexpected page ID`);
  }
  const nextPages = pages.map((page) => ({
    id: targetIdsByKey[page.key],
    siteId: SITE_ID,
    pageType: "ai_tool",
    templateKey: `ai-video-topic-conversion-seeding-${page.key}`,
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
    const backupPath = path.resolve(backupRoot, `conversion-seeding-pages-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ site, existingPages, settings }, null, 2)}\n`, "utf8");
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
    for (const page of nextPages) {
      assert.equal(hashJson(readbackById.get(page.id)?.contentJson), hashJson(page.contentJson), `${page.id}: content hash readback`);
      const actual = readbackById.get(page.id)?.contentJson;
      assert.equal(actual?.sections?.ai_video_topic_landing_1?.settings?.content?.layoutVariant, "conversion-seeding-detail", `${page.id}: layout readback`);
    }
    report.forEach((item) => { item.readback = "PASS"; });
    console.log(JSON.stringify({ ok: true, mode: applyProduction ? "production-applied" : "applied", siteId: SITE_ID, backupPath, navigationChanges: navigationDraft.changed + navigationPublished.changed, pages: report }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", siteId: SITE_ID, existingPageCount: existingPages.length, navigationChanges: navigationDraft.changed + navigationPublished.changed, pages: report, applyCommand: `node scripts/migrate-aidreamcapes-conversion-seeding-pages.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID} --page-ids=${expectedPageIds.join(",")}` }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
