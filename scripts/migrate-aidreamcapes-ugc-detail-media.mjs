#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_SLUG = "/ai-video-generation/ugc-ad-video";
const repoRoot = process.cwd();
const cardSizes = "(max-width: 1024px) 100vw, 760px";
const replacementImages = [
  {
    title: "Lead with the product in frame",
    oldSrc: "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/ugc-ad-video/ai-ugc-video-creator-lip-product-hook.jpg",
    src: "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-hook.webp",
    alt: "Creator holding an unbranded lip-care product close to camera while filming a UGC product ad"
  },
  {
    title: "Show the use moment",
    oldSrc: "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/ugc-ad-video/ugc-ad-video-kitchen-product-demo.jpg",
    src: "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-demo.webp",
    alt: "Creator demonstrating an unbranded compact coffee maker during a real morning kitchen routine"
  },
  {
    title: "Make the opinion clear",
    oldSrc: "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/ugc-ad-video/ugc-ad-video-product-review-direct-to-camera.jpg",
    src: "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-review.webp",
    alt: "Creator speaking to a smartphone camera while holding an unbranded consumer product in a living room"
  },
  {
    title: "Put the product in a lived-in context",
    oldSrc: "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/ugc-ad-video/ugc-ad-video-fashion-try-on-creator.jpg",
    src: "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-try-on.webp",
    alt: "Creator checking an unbranded fashion garment in a bedroom mirror while filming a try-on moment"
  },
  {
    title: "Break up the talking head",
    oldSrc: "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/ugc-ad-video/ugc-ad-video-broll-phone-recording-food.jpg",
    src: "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-broll.webp",
    alt: "Hands filming a bowl of food and an unbranded product detail with a smartphone for UGC B-roll"
  },
  {
    title: "Keep the message focused",
    oldSrc: "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/ugc-ad-video/ugc-ad-video-scripted-talking-points.jpg",
    src: "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-script.webp",
    alt: "Creator recording one focused product explanation at a desk with an unbranded smart device"
  },
  {
    title: "Let the first reaction do the work",
    oldSrc: "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/ugc-ad-video/ugc-ad-video-unboxing-first-impression.jpg",
    src: "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-unboxing.webp",
    alt: "Creator opening a parcel and reacting to an unbranded skincare product during a first impression"
  }
].map((image) => ({
  ...image,
  width: 1586,
  height: 992,
  loading: "lazy",
  fetchPriority: "auto",
  sizes: cardSizes
}));
const heroImage = {
  src: "/assets/sites/site_aidreamcapes/homepage-seo/ai-product-image-to-video-ugc-creator-smartwatch.webp",
  alt: "Creator holding a white smartwatch toward the camera in a casual UGC-style scene",
  width: 720,
  height: 1280,
  loading: "eager",
  fetchPriority: "high"
};
const productImage = {
  src: "/assets/sites/site_aidreamcapes/homepage-seo/ai-product-image-to-video-smartwatch-product-shot.webp",
  alt: "White smartwatch product photo on a mint studio background",
  width: 800,
  height: 1000,
  loading: "eager",
  fetchPriority: "high"
};
const ogImage = {
  src: "/assets/sites/site_aidreamcapes/homepage-seo/ai-product-url-to-ugc-ad-workflow.webp",
  alt: "Product page transforming into several vertical UGC ad concepts"
};

const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
assert.equal(!(applyLocal && applyProduction), true, "Choose exactly one database apply target.");
const apply = applyLocal || applyProduction;
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
assertDatabaseTarget({
  expectedTarget: applyProduction ? "production" : "local",
  requireProductionConfirmation: applyProduction,
  productionConfirmed: confirmation === "production"
});
for (const image of replacementImages) {
  assert.ok(existsSync(path.resolve(repoRoot, "public", image.src.slice(1))), `Missing generated image: ${image.src}`);
}
if (apply) {
  assert.equal(confirmation, applyProduction ? "production" : SITE_ID, `Applying requires --confirm=${applyProduction ? "production" : SITE_ID}.`);
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

function imagePayload(image) {
  return {
    src: image.src,
    alt: image.alt,
    width: image.width,
    height: image.height,
    loading: image.loading,
    fetchPriority: image.fetchPriority,
    sizes: image.sizes
  };
}

function replaceImage(existing, replacement) {
  const { srcSet: _srcSet, avifSrcSet: _avifSrcSet, ...stable } = existing ?? {};
  return { ...stable, ...imagePayload(replacement) };
}

function migrateContent(page) {
  const next = structuredClone(page.contentJson);
  const section = next.sections?.ai_video_topic_landing_1;
  const content = section?.settings?.content;
  assert(content && typeof content === "object", `${PAGE_SLUG}: missing topic content`);
  assert(content.hero && typeof content.hero === "object", `${PAGE_SLUG}: missing hero content`);
  content.hero.image = heroImage;
  content.seo = { ...(content.seo ?? {}), ogImage: ogImage.src };
  next.seo = { ...(next.seo ?? {}), ogImage: ogImage.src };
  const detail = content.ugcAdDetail ?? content.adsTestingDetail;
  assert(detail && typeof detail === "object", `${PAGE_SLUG}: missing legacy UGC detail content`);
  assert(Array.isArray(detail.examples?.items) && detail.examples.items.length === replacementImages.length, `${PAGE_SLUG}: unexpected example count`);
  assert(content.value?.image && typeof content.value.image === "object", `${PAGE_SLUG}: missing value image`);
  content.value.image = { ...content.value.image, ...heroImage };
  const useCaseReplacements = [replacementImages[6], replacementImages[2], replacementImages[1], replacementImages[3], replacementImages[5], replacementImages[4]];
  assert(Array.isArray(content.useCases?.items) && content.useCases.items.length === useCaseReplacements.length, `${PAGE_SLUG}: unexpected use-case count`);
  content.useCases.items = content.useCases.items.map((item, index) => ({
    ...item,
    image: replaceImage(item.image, useCaseReplacements[index])
  }));
  assert(detail.hero?.output?.image && detail.hero?.product?.image, `${PAGE_SLUG}: missing detail hero images`);
  detail.hero.output.image = heroImage;
  detail.hero.product.image = productImage;

  for (const replacement of replacementImages) {
    const item = detail.examples.items.find((candidate) => candidate.title === replacement.title);
    assert(item, `${PAGE_SLUG}: missing example ${replacement.title}`);
    assert(item.image && typeof item.image.src === "string", `${PAGE_SLUG}: missing existing image for ${replacement.title}`);
    assert(item.image.src === replacement.src || item.image.src.startsWith("/assets/sites/site_aidreamcapes/"), `${PAGE_SLUG}: unexpected existing image for ${replacement.title}`);
    item.image = replaceImage(item.image, replacement);
  }

  assert(Array.isArray(next.mediaManifest), `${PAGE_SLUG}: missing media manifest`);
  const replacementBySrc = new Map(replacementImages.flatMap((image) => [[image.oldSrc, image], [image.src, image]]));
  const replacementByAlt = new Map(replacementImages.map((image) => [image.alt, image]));
  let manifestChanges = 0;
  next.mediaManifest = next.mediaManifest.map((media, index) => {
    if (index === 0) return { ...productImage, role: "hero" };
    if (index === 1) return { ...heroImage, role: "hero" };
    const replacement = replacementBySrc.get(media.src) ?? replacementByAlt.get(media.alt);
    if (!replacement) return media;
    manifestChanges += 1;
    return { ...replaceImage(media, replacement), role: "content" };
  });
  assert.equal(manifestChanges, replacementImages.length, `${PAGE_SLUG}: media manifest replacement count`);
  next.contentContract = {
    ...(next.contentContract ?? {}),
    sourceRevision: "aidreamcapes-ugc-detail-media-v4-card-safe"
  };
  return next;
}

const prisma = new PrismaClient();
try {
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_SLUG } },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(page, `${SITE_ID}: live page not found for ${PAGE_SLUG}`);
  const nextContent = migrateContent(page);
  const report = {
    id: page.id,
    siteId: page.siteId,
    slug: page.slug,
    action: apply ? "UPDATE" : "DRY_RUN",
    imageCount: replacementImages.length,
    oldHash: hashJson(page.contentJson),
    newHash: hashJson(nextContent),
    images: replacementImages.map(({ title, src, width, height }) => ({ title, src, width, height }))
  };

  if (apply) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `ugc-detail-media-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, JSON.stringify({ page }, null, 2) + "\n", "utf8");
    await prisma.livePage.update({ where: { id: page.id }, data: { contentJson: nextContent } });
    const readback = await prisma.livePage.findUnique({ where: { id: page.id }, select: { contentJson: true } });
    assert.equal(hashJson(readback?.contentJson), report.newHash, `${PAGE_SLUG}: content hash readback`);
    console.log(JSON.stringify({ ok: true, mode: applyProduction ? "production-applied" : "applied", backupPath, report }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", report, applyCommand: `node scripts/migrate-aidreamcapes-ugc-detail-media.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID}` }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
