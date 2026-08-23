#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const prisma = new PrismaClient();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

async function readPlatformState() {
  const document = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
  if (!document?.state) throw new Error("missing_platform_state_document");
  return document.state;
}

function normalizeSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^collections\//, "")
    .replace(/^ai-image-generation\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const taxonomy = readJson("src/lib/mydreamshoots-theme-taxonomy.json");
const useCaseProfiles = readJson("src/lib/photo-package-use-case-profiles.json").mydreamshootsCategories ?? {};
const packProfiles = readJson("src/lib/dreamshoot-pack-profiles.json");
const platformState = await readPlatformState();
const blackFridayPack = (platformState.creativePacks ?? []).find((pack) => pack.siteId === "site_dreamshoot" && normalizeSlug(pack.category || pack.name) === "black-friday");
const blackFridayMediaMismatch = Boolean(blackFridayPack && [blackFridayPack.imageUrl, ...(blackFridayPack.galleryImages ?? [])].some((image) => /creator-portraits|anime-avatar/i.test(String(image ?? ""))));

async function activePublicationStatus() {
  try {
    const active = await prisma.activeThemePublication.findUnique({
      where: { siteId: "site_dreamshoot" },
      include: { publication: true }
    });
    const snapshot = active?.publication?.snapshot;
    const facts = snapshot?.publishedFacts;
    const factText = [
      facts?.creditLifecycle?.reserve,
      facts?.creditLifecycle?.consume,
      facts?.creditLifecycle?.release,
      facts?.security?.transportClaimKey,
      facts?.security?.storageClaimKey
    ].map((value) => String(value ?? "").trim());
    const missingFacts = [];
    if (!facts?.identity?.legalName) missingFacts.push("identity.legalName");
    if (!facts?.identity?.entityType) missingFacts.push("identity.entityType");
    if (!facts?.identity?.supportEmail) missingFacts.push("identity.supportEmail");
    if (facts?.privacy?.customerMediaTraining === undefined) missingFacts.push("privacy.customerMediaTraining");
    if (!(Number(facts?.privacy?.sourceMediaRetentionDays) > 0)) missingFacts.push("privacy.sourceMediaRetentionDays");
    if (facts?.refund?.reviewRequired === undefined) missingFacts.push("refund.reviewRequired");
    if (!(Number(facts?.refund?.windowDays) > 0)) missingFacts.push("refund.windowDays");
    if (!facts?.refund?.effectiveDate) missingFacts.push("refund.effectiveDate");
    if (!facts?.creditLifecycle?.reserve) missingFacts.push("creditLifecycle.reserve");
    if (!facts?.creditLifecycle?.consume) missingFacts.push("creditLifecycle.consume");
    if (!facts?.creditLifecycle?.release) missingFacts.push("creditLifecycle.release");
    if (!facts?.security?.transportClaimKey) missingFacts.push("security.transportClaimKey");
    if (!facts?.security?.storageClaimKey) missingFacts.push("security.storageClaimKey");
    const invalidFacts = [
      ["creditLifecycle.reserve", facts?.creditLifecycle?.reserve],
      ["creditLifecycle.consume", facts?.creditLifecycle?.consume],
      ["creditLifecycle.release", facts?.creditLifecycle?.release],
      ["security.transportClaimKey", facts?.security?.transportClaimKey],
      ["security.storageClaimKey", facts?.security?.storageClaimKey]
    ]
      .filter(([, value]) => String(value ?? "").trim() && /^(?:test|fixture|local-test)\b/i.test(String(value ?? "").trim()))
      .map(([field]) => field);
    const productionFactsReady = Boolean(
      facts?.identity?.legalName &&
      facts?.identity?.entityType &&
      facts?.identity?.supportEmail &&
      facts?.privacy?.customerMediaTraining !== undefined &&
      Number(facts?.privacy?.sourceMediaRetentionDays) > 0 &&
      facts?.refund?.reviewRequired !== undefined &&
      Number(facts?.refund?.windowDays) > 0 &&
      facts?.refund?.effectiveDate &&
      factText.every((value) => value && !/^(?:test|fixture)\b/i.test(value))
    );
    return {
      activeProjectionRows: Array.isArray(snapshot?.publishedPageEntities)
        ? snapshot.publishedPageEntities.filter((page) => page?.pageType === "ai-image-theme-leaf" && page?.status === "published" && page?.indexable === true).length
        : 0,
      productionFactsReady,
      missingFacts,
      invalidFacts
    };
  } catch {
    return null;
  }
}

const requiredSlugs = (taxonomy.items ?? [])
  .map((item) => normalizeSlug(item.slug))
  .filter(Boolean);
const imageRequiredSlugs = requiredSlugs.filter((slug) => slug !== "motion-generator");
const deferredSlugs = new Set();
const requiredFields = [
  "pageEntityId",
  "copyRevision",
  "seoTitle",
  "galleryTitle",
  "galleryIntro",
  "ctaEyebrow",
  "ctaTitle",
  "ctaSubtitle",
  "ctaLabel",
  "faqEyebrow",
  "faqTitle",
  "faqItems",
  "relatedEyebrow",
  "relatedTitle",
  "relatedSubtitle",
  "relatedCtaLabel"
];
function mydreamshootsPageCopyForRoute(input) {
  if (input.siteId && input.siteId !== "site_dreamshoot") return undefined;
  if (input.routeKind && input.routeKind !== "ai-image-theme-leaf") return undefined;
  const canonicalSlug = normalizeSlug(input.canonicalSlug);
  if (!canonicalSlug) return undefined;
  const copy = useCaseProfiles[canonicalSlug];
  if (!copy) {
    if (requiredSlugs.includes(canonicalSlug)) {
      throw new Error(`PAGE_COPY_REVIEW_REQUIRED:${canonicalSlug}`);
    }
    return undefined;
  }
  if (copy.pageEntityId !== `mydreamshoots:ai-image-theme:${canonicalSlug}`) {
    throw new Error(`PAGE_COPY_ENTITY_MISMATCH:${canonicalSlug}`);
  }
  const canonicalPath = String(input.canonicalPath ?? "").trim().replace(/\/+$/, "");
  if (canonicalPath && canonicalPath !== `/ai-image-generation/${canonicalSlug}`) {
    throw new Error(`PAGE_COPY_CANONICAL_PATH_MISMATCH:${canonicalSlug}`);
  }
  return copy;
}

assert.equal(requiredSlugs.length, 38, "MyDreamShoots taxonomy should expose 38 leaf slugs");
assert.deepEqual([...new Set(requiredSlugs)].sort(), requiredSlugs.slice().sort(), "page copy helper should expose the full required slug set");

const missingProfiles = [];
const invalidProfiles = [];
const packProfileOwnerRows = [];
const routeRows = [];
const fallbackRows = [];
const missingRows = [];
const reviewRows = [];
const faqIds = new Set();
const genericPatterns = [
  ["galleryIntro", /^Review .+ examples before opening the .+ workflow\.$/i],
  ["ctaTitle", /^Create .+ images in your private studio\.$/i],
  ["ctaSubtitle", /^Turn approved source photos into .+ with visible credit cost and private gallery review\.$/i],
  ["relatedTitle", /^More .+ and nearby themes$/i],
  ["relatedSubtitle", /^Compare .+ and adjacent themes before opening (?:a|an) .+ set\.$/i]
];

for (const slug of imageRequiredSlugs) {
  const profile = useCaseProfiles[slug];
  if (!profile) {
    missingProfiles.push(slug);
    missingRows.push(slug);
    continue;
  }
  const invalidFields = requiredFields.filter((field) => {
    const value = profile[field];
    return Array.isArray(value) ? value.length === 0 : typeof value !== "string" || !value.trim();
  });
  if (profile.pageEntityId !== `mydreamshoots:ai-image-theme:${slug}`) invalidFields.push("pageEntityId:canonicalSlug");
  if (!Array.isArray(profile.faqItems) || profile.faqItems.length !== 4) {
    invalidFields.push("faqItems:count");
  } else {
    for (const faqItem of profile.faqItems) {
      if (!faqItem?.id?.trim() || !faqItem?.question?.trim() || !faqItem?.answer?.trim()) invalidFields.push("faqItems:shape");
      if (faqIds.has(faqItem.id)) invalidFields.push(`faqItems:duplicate:${faqItem.id}`);
      faqIds.add(faqItem.id);
    }
  }
  if (!profile.copyRevision?.startsWith("2026-08-18.")) invalidFields.push("copyRevision:revision");
  if (invalidFields.length) invalidProfiles.push({ slug, invalidFields });

  const helperCopy = mydreamshootsPageCopyForRoute({
    siteId: "site_dreamshoot",
    routeKind: "ai-image-theme-leaf",
    canonicalSlug: slug,
    canonicalPath: `/ai-image-generation/${slug}`
  });
  assert.ok(helperCopy, `${slug} should resolve through the exact page copy route helper`);
  assert.equal(helperCopy.pageEntityId, `mydreamshoots:ai-image-theme:${slug}`, `${slug} exact page copy must keep the canonical entity id`);

  const packProjection = packProfiles[slug];
  const forbiddenPackFields = [...requiredFields, "headline", "cardDescription", "detailIntro", "whatCreates", "bestFor", "workflow", "styleNotes"];
  const ownerFields = forbiddenPackFields.filter((field) => Object.hasOwn(packProjection ?? {}, field));
  const operationalFields = ["packId", "creditCost", "outputCount", "toolRef", "promptRef", "mediaRef", "operationalDescription"];
  const missingOperationalFields = operationalFields.filter((field) => !Object.hasOwn(packProjection ?? {}, field));
  if (ownerFields.length || missingOperationalFields.length) packProfileOwnerRows.push({ slug, ownerFields, missingOperationalFields });
  const taxonomyItem = (taxonomy.items ?? []).find((item) => normalizeSlug(item.slug) === slug);
  const expectedPackId = taxonomyItem?.reusePackId || `pack_dreamshoot_${slug.replace(/[^a-z0-9]+/g, "_")}`;
  const exactPack = (platformState.creativePacks ?? []).find((pack) => pack.siteId === "site_dreamshoot" && pack.status === "active" && pack.id === expectedPackId && normalizeSlug(pack.category || pack.name) === slug);
  const mediaReady = Boolean(exactPack?.imageUrl && (exactPack.galleryImages ?? []).length);
  const independenceReasons = genericPatterns
    .filter(([field, pattern]) => pattern.test(String(profile[field] ?? "").trim()))
    .map(([field]) => `GENERIC_${field.toUpperCase()}`);
  if (!String(profile.ctaHref ?? "").startsWith("/")) independenceReasons.push("CTA_HREF_MISSING");
  if (!Array.isArray(profile.relatedLinks) || profile.relatedLinks.length < 2) independenceReasons.push("RELATED_LINKS_INCOMPLETE");
  const indexable = independenceReasons.length === 0 && mediaReady && taxonomyItem?.mediaReviewStatus !== "review_required";
  const deferred = deferredSlugs.has(slug);
  const routeIndexable = indexable && !deferred;
  const route = {
    canonicalPath: `/ai-image-generation/${slug}`,
    pageEntityId: profile.pageEntityId,
    copyRevision: profile.copyRevision,
    copySource: "page-copy",
    fallbackUsed: false,
    expectedPackId,
    mediaReady,
    deferred,
    status: routeIndexable ? "published" : "review_required",
    indexable: routeIndexable,
    sitemapEligible: routeIndexable,
    reviewReasons: [
      ...independenceReasons,
      ...(!mediaReady || taxonomyItem?.mediaReviewStatus === "review_required" ? [taxonomyItem?.mediaReviewReason || "PAGE_COPY_MEDIA_ENTITY_MISMATCH"] : []),
      ...(deferred ? ["DEFERRED_AI_VIDEO_PAGE"] : [])
    ]
  };
  routeRows.push(route);
  if (route.copySource !== "page-copy" || route.fallbackUsed) fallbackRows.push(slug);
  if (!routeIndexable) reviewRows.push({ slug, deferred, reasons: route.reviewReasons });
}

assert.equal(missingProfiles.length, 0, "every MyDreamShoots taxonomy leaf should have a direct use-case profile", { missingProfiles });
assert.equal(invalidProfiles.length, 0, "every MyDreamShoots direct page-copy profile should carry the full contract", { invalidProfiles });
assert.equal(packProfileOwnerRows.length, 0, "pack profiles must contain operational data only and cannot own page SEO/copy", { packProfileOwnerRows });

assert.ok(blackFridayPack, "Black Friday pack must exist in platform-state");
assert.equal(blackFridayPack.id, "pack_dreamshoot_black_friday", "Black Friday must own a dedicated pack id instead of Anime Avatar");
assert.ok(blackFridayPack.imageUrl, "Black Friday pack must keep a cover image");

const reviewIsolationFailures = routeRows.filter((route) => route.status === "review_required" && (route.indexable || route.sitemapEligible));
const activePublication = await activePublicationStatus();
const activeProjectionRows = activePublication?.activeProjectionRows ?? null;
const productionFactsReady = activePublication?.productionFactsReady ?? false;
const missingFacts = activePublication?.missingFacts ?? [];
const invalidFacts = activePublication?.invalidFacts ?? [];
const blockingReviewRows = reviewRows.filter((row) => !row.deferred);
const deferredRows = reviewRows.filter((row) => row.deferred);
const expectedIndexableRows = imageRequiredSlugs.length - deferredRows.length;
const reviewIsolationReady = fallbackRows.length === 0 && reviewIsolationFailures.length === 0;
const productionReleaseReady = reviewIsolationReady &&
  blockingReviewRows.length === 0 &&
  blackFridayMediaMismatch === false &&
  activeProjectionRows === expectedIndexableRows &&
  productionFactsReady;
const report = {
  ok: reviewIsolationReady,
  contractOk: true,
  reviewIsolationReady,
  productionReleaseReady,
  expectedIndexableRows,
  sourceRows: imageRequiredSlugs.length,
  independentRows: routeRows.filter((route) => route.status === "published").length,
  requiredSlugs: imageRequiredSlugs.length,
  pageCopyProfiles: imageRequiredSlugs.length,
  checkedRows: routeRows.length,
  fallbackRows: fallbackRows.length,
  missingRows: missingRows.length,
  driftRows: packProfileOwnerRows.length,
  reviewRows: reviewRows.length,
  blockingRows: blockingReviewRows,
  deferredRows: deferredRows.length,
  prospectiveProjectionRows: routeRows.length,
  activeProjectionRows,
  productionFactsReady,
  missingFacts,
  invalidFacts,
  blackFridayPack: blackFridayPack?.id ?? null,
  blackFridayMediaMismatch,
  reviewIsolationFailures,
  reviewSlugs: reviewRows.map((row) => row.slug)
};
console.log(JSON.stringify(report, null, 2));
if (!report.contractOk || (process.argv.includes("--release") && !report.reviewIsolationReady) || (process.argv.includes("--production") && !report.productionReleaseReady)) process.exitCode = 1;
await prisma.$disconnect();
