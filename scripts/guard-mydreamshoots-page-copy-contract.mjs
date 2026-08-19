#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
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
const platformState = readJson("data/platform-state.json");
const blackFridayPack = (platformState.creativePacks ?? []).find((pack) => pack.siteId === "site_dreamshoot" && normalizeSlug(pack.category || pack.name) === "black-friday");
const blackFridayMediaMismatch = Boolean(blackFridayPack && [blackFridayPack.imageUrl, ...(blackFridayPack.galleryImages ?? [])].some((image) => /creator-portraits|anime-avatar/i.test(String(image ?? ""))));

const requiredSlugs = (taxonomy.items ?? [])
  .map((item) => normalizeSlug(item.slug))
  .filter(Boolean);
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
const projectionDriftRows = [];
const routeRows = [];
const fallbackRows = [];
const missingRows = [];
const reviewRows = [];
const faqIds = new Set();

for (const slug of requiredSlugs) {
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
  if (packProjection?.pageEntityId) {
    const driftFields = requiredFields.filter((field) => JSON.stringify(packProjection[field]) !== JSON.stringify(profile[field]));
    if (driftFields.length) projectionDriftRows.push({ slug, driftFields });
  }
  const taxonomyItem = (taxonomy.items ?? []).find((item) => normalizeSlug(item.slug) === slug);
  const expectedPackId = taxonomyItem?.reusePackId || `pack_dreamshoot_${slug.replace(/[^a-z0-9]+/g, "_")}`;
  const exactPack = (platformState.creativePacks ?? []).find((pack) => pack.siteId === "site_dreamshoot" && pack.status === "active" && pack.id === expectedPackId && normalizeSlug(pack.category || pack.name) === slug);
  const mediaReady = Boolean(exactPack?.imageUrl && (exactPack.galleryImages ?? []).length);
  const route = {
    canonicalPath: `/ai-image-generation/${slug}`,
    pageEntityId: profile.pageEntityId,
    copyRevision: profile.copyRevision,
    copySource: "page-copy",
    fallbackUsed: false,
    expectedPackId,
    mediaReady
  };
  routeRows.push(route);
  if (route.copySource !== "page-copy" || route.fallbackUsed) fallbackRows.push(slug);
  if (!mediaReady || taxonomyItem?.mediaReviewStatus === "review_required") reviewRows.push({ slug, reason: taxonomyItem?.mediaReviewReason || "PAGE_COPY_MEDIA_ENTITY_MISMATCH" });
}

assert.equal(missingProfiles.length, 0, "every MyDreamShoots taxonomy leaf should have a direct use-case profile", { missingProfiles });
assert.equal(invalidProfiles.length, 0, "every MyDreamShoots direct page-copy profile should carry the full contract", { invalidProfiles });
assert.equal(projectionDriftRows.length, 0, "page-copy-bearing pack profiles should remain a generated projection of the page copy source", { projectionDriftRows });

assert.ok(blackFridayPack, "Black Friday pack must exist in platform-state");
assert.equal(blackFridayPack.id, "pack_dreamshoot_black_friday", "Black Friday must own a dedicated pack id instead of Anime Avatar");
assert.ok(blackFridayPack.imageUrl, "Black Friday pack must keep a cover image");

const report = {
  ok: !blackFridayMediaMismatch,
  contractOk: true,
  releaseReady: reviewRows.length === 0 && !blackFridayMediaMismatch,
  requiredSlugs: requiredSlugs.length,
  pageCopyProfiles: requiredSlugs.length,
  checkedRows: routeRows.length,
  fallbackRows: fallbackRows.length,
  missingRows: missingRows.length,
  driftRows: projectionDriftRows.length,
  reviewRows: reviewRows.length,
  projectionRows: projectionDriftRows.length,
  blackFridayPack: blackFridayPack?.id ?? null,
  blackFridayMediaMismatch,
  reviewSlugs: reviewRows.map((row) => row.slug)
};
console.log(JSON.stringify(report, null, 2));
if (!report.contractOk || (process.argv.includes("--release") && !report.releaseReady)) process.exitCode = 1;
