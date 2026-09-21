#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesAdsTestingPagesForMigration } from "./lib/aidreamcapes-ads-testing-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_SLUG = "/ai-video-generation/product-ad-video";
const PAGE_ID = "aidreamcapes_mirror_page_e6fc13185afaa114";
const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
assert.equal(!(applyLocal && applyProduction), true, "Choose exactly one database apply target.");
const apply = applyLocal || applyProduction;
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const requestedPageId = argumentValue("--page-id") ?? PAGE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
assert.equal(requestedPageId, PAGE_ID, `This migration requires the exact page ID ${PAGE_ID}.`);
assertDatabaseTarget({
  expectedTarget: applyProduction ? "production" : "local",
  requireProductionConfirmation: applyProduction,
  productionConfirmed: confirmation === "production"
});
if (apply) {
  assert.equal(confirmation, applyProduction ? "production" : SITE_ID, `Applying requires --confirm=${applyProduction ? "production" : SITE_ID}.`);
  if (applyLocal) assertNonProductionWriteTarget();
}

const sourcePage = aidreamcapesAdsTestingPagesForMigration().find((page) => page.key === "url-to-ad");
assert(sourcePage, "The current URL-to-Ad generated image set is required.");
const sourceContent = sourcePage.content;
const latestImages = {
  product: sourceContent.hero.productImage,
  output: sourceContent.hero.outputImage,
  examples: sourceContent.examples.items.map((item) => item.image),
  ogImage: sourceContent.seo.ogImage
};
assert.equal(latestImages.examples.length, 7, "URL-to-Ad must provide seven example images.");

function hashJson(value) {
  const stable = (current) => {
    if (Array.isArray(current)) return current.map(stable);
    if (current && typeof current === "object") return Object.fromEntries(Object.keys(current).sort().map((key) => [key, stable(current[key])]));
    return current;
  };
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function cleanImage(image) {
  const { srcSet: _srcSet, avifSrcSet: _avifSrcSet, ...clean } = image ?? {};
  return structuredClone(clean);
}

function migrateContent(page) {
  const next = structuredClone(page.contentJson);
  const section = next.sections?.ai_video_topic_landing_1;
  const content = section?.settings?.content;
  assert(content && typeof content === "object", `${PAGE_SLUG}: missing topic content`);
  assert(content.hero?.image && typeof content.hero.image === "object", `${PAGE_SLUG}: missing hero image`);
  assert(content.value?.image && typeof content.value.image === "object", `${PAGE_SLUG}: missing value image`);
  assert(Array.isArray(content.useCases?.items) && content.useCases.items.length === 6, `${PAGE_SLUG}: unexpected use-case count`);

  content.seo = { ...(content.seo ?? {}), ogImage: latestImages.ogImage };
  next.seo = { ...(next.seo ?? {}), ogImage: latestImages.ogImage };
  content.hero.image = cleanImage(latestImages.output);
  if (content.hero.video && typeof content.hero.video === "object") content.hero.video.poster = latestImages.output.src;
  content.value.image = cleanImage(latestImages.examples[0]);
  content.useCases.items = content.useCases.items.map((item, index) => ({ ...item, image: cleanImage(latestImages.examples[index + 1]) }));
  next.mediaManifest = [
    { ...cleanImage(latestImages.product), role: "hero" },
    { ...cleanImage(latestImages.output), role: "hero" },
    ...latestImages.examples.map((image) => ({ ...cleanImage(image), role: "content" }))
  ];
  next.contentContract = {
    ...(next.contentContract ?? {}),
    sourceRevision: "aidreamcapes-product-ad-compat-media-v1-url-to-ad"
  };
  return next;
}

const prisma = new PrismaClient();
try {
  const page = await prisma.livePage.findUnique({
    where: { id: PAGE_ID },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(page, `${SITE_ID}: live page not found for ${PAGE_SLUG}`);
  assert.equal(page.siteId, SITE_ID, `${PAGE_ID}: page belongs to another site`);
  assert.equal(page.slug, PAGE_SLUG, `${PAGE_ID}: page slug is not ${PAGE_SLUG}`);
  const nextContent = migrateContent(page);
  const serialized = JSON.stringify(nextContent);
  assert.equal(serialized.includes("fan-holiday-theme"), false, `${PAGE_SLUG}: legacy fan-holiday asset remained`);
  assert.equal(serialized.includes("creative-packs"), false, `${PAGE_SLUG}: legacy creative-pack asset remained`);
  assert.equal(serialized.includes("homepage-showcase/posters"), false, `${PAGE_SLUG}: legacy homepage-showcase poster remained`);
  const report = {
    id: page.id,
    siteId: page.siteId,
    slug: page.slug,
    action: apply ? "UPDATE" : "DRY_RUN",
    oldHash: hashJson(page.contentJson),
    newHash: hashJson(nextContent),
    sourceRoute: sourcePage.slug,
    imageRoot: "/assets/sites/site_aidreamcapes/ads-testing-v3/url-to-ad/",
    imageCount: nextContent.mediaManifest.length
  };

  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", report, applyCommand: `node scripts/migrate-aidreamcapes-product-ad-compat-media.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID} --page-id=${PAGE_ID}` }, null, 2));
  } else {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `product-ad-compat-media-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ page }, null, 2)}\n`, "utf8");
    await prisma.livePage.update({ where: { id: PAGE_ID }, data: { contentJson: nextContent } });
    const readback = await prisma.livePage.findUnique({ where: { id: PAGE_ID }, select: { contentJson: true } });
    assert.equal(hashJson(readback?.contentJson), report.newHash, `${PAGE_SLUG}: content hash readback`);
    const readbackSerialized = JSON.stringify(readback?.contentJson);
    assert.equal(readbackSerialized.includes("fan-holiday-theme"), false, `${PAGE_SLUG}: legacy asset readback`);
    assert.equal(readbackSerialized.includes("homepage-showcase/posters"), false, `${PAGE_SLUG}: legacy poster readback`);
    console.log(JSON.stringify({ ok: true, mode: applyProduction ? "production-applied" : "applied", backupPath, report: { ...report, readback: "PASS" } }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
