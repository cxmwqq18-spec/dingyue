#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const read = (file) => fs.readFileSync(file, "utf8");
const types = read("src/lib/types.ts");
const themeStore = read("src/lib/stores/theme-store.ts");
const snapshot = read("src/lib/storefront-context/snapshot.ts");
const metadata = read("src/lib/storefront-metadata.ts");
const templates = read("src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");

for (const field of ["publishedRoutes", "publishedPageEntities", "publishedPageCopy", "publishedPageMedia", "publishedPackFacts", "publishedOffers", "publishedFacts", "publishedCollectionRefs", "publishedLinkRefs", "revisions", "snapshotHash", "buildId"]) {
  assert.match(types, new RegExp(`${field}[^?;]*:`), `ThemePublication snapshot must require ${field}`);
  assert.match(themeStore, new RegExp(field), `publication builder must write ${field}`);
}

assert.match(snapshot, /publication\?\.snapshot\?\.publishedRoutes/, "runtime route manifest must prefer the immutable publication snapshot");
assert.match(snapshot, /hasImmutableSeoProjection/, "current-format snapshots must have an explicit immutable projection boundary");
assert.match(snapshot, /publication\?\.snapshot\?\.publishedPageMedia/, "runtime media must prefer the immutable publication snapshot");
assert.match(metadata, /snapshot\?\.publishedPageMedia\.find/, "metadata must consume published media projection");
assert.match(snapshot, /route\.status !== "published"/, "review-required leaf routes must fail closed");
assert.match(snapshot, /publicationSnapshotIntegrity/, "published resolver must verify snapshot integrity before using SEO projections");
assert.doesNotMatch(snapshot, /mydreamshootsPublishedRouteManifest\(/, "published resolver must not rebuild routes from current taxonomy");
assert.doesNotMatch(snapshot, /mydreamshootsPublishedPageMediaProjections\(/, "published resolver must not rebuild media from current packs");

const soccerBlock = templates.slice(templates.indexOf('block("seasonal_worldcup_1"'), templates.indexOf('anchor: "christmas-holiday-pack"'));
assert.equal((soccerBlock.match(/collectionSlug: "soccer"/g) ?? []).length, 6, "all six Soccer cards must target the Soccer entity");
assert.doesNotMatch(soccerBlock, /collectionSlug: "(?:gala-photo|avatar|thanksgiving-photo|holiday)"/, "Soccer cards must not target unrelated entities");

const sourceRoot = path.join(process.cwd(), "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  let resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) resolved = `${resolved}.ts`;
  return originalResolveFilename.call(this, resolved, ...args);
};
const jiti = createJiti(import.meta.url);
const { createPublishedSiteSnapshot, resolvePublishedRouteDisposition } = jiti("../src/lib/storefront-context/snapshot.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stable(item)]))
    : value;
const projectionRevision = (value) => crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 20);
const state = JSON.parse(read("data/platform-state.json"));
const sourceSite = state.sites.find((site) => site.id === "site_dreamshoot");
assert.ok(sourceSite, "MyDreamShoots fixture site is required");
const policySpecs = [
  { canonicalPath: "/privacy", aliases: ["/privacy-policy", "/policies/privacy", "/policies/privacy-policy"] },
  { canonicalPath: "/terms", aliases: ["/terms-of-service", "/policies/terms", "/policies/terms-of-service"] }
];
const policyAliasPaths = new Set(policySpecs.flatMap((spec) => [spec.canonicalPath, ...spec.aliases]));
const policyPages = policySpecs.flatMap(({ canonicalPath, aliases }) => {
  const sourcePage = [canonicalPath, ...aliases]
    .map((slug) => sourceSite.pages.find((page) => page.slug === slug))
    .find(Boolean);
  return sourcePage ? [{ ...sourcePage, slug: canonicalPath }] : [];
});
assert.equal(policyPages.length, 2, "fixture must include canonical privacy and terms source pages");
const policyRoutes = policySpecs.flatMap(({ canonicalPath, aliases }) => {
  const page = policyPages.find((candidate) => candidate.slug === canonicalPath);
  const pageRevision = crypto.createHash("sha256").update(JSON.stringify(page.publishedJson)).digest("hex").slice(0, 20);
  return [{
    siteId: sourceSite.id,
    disposition: "render",
    routeKind: "policy",
    canonicalPath,
    pageEntityId: `mydreamshoots:policy:${canonicalPath.slice(1)}`,
    pageId: page.id,
    pageRevision,
    status: "published",
    indexable: true,
    sitemapEligible: true
  }, ...aliases.map((aliasPath) => ({
    siteId: sourceSite.id,
    disposition: "redirect",
    routeKind: "policy-alias",
    aliasPath,
    targetPath: canonicalPath,
    statusCode: 308,
    indexable: false,
    sitemapEligible: false,
    routeRevision: crypto.createHash("sha256").update(JSON.stringify([aliasPath, canonicalPath, 308])).digest("hex").slice(0, 20)
  }))];
});
const publicationSnapshot = {
  seoProjectionVersion: 1,
  pages: [...sourceSite.pages.filter((page) => !policyAliasPaths.has(page.slug)), ...policyPages].map((page) => ({
    id: page.id,
    siteId: page.siteId,
    pageType: page.pageType,
    templateKey: page.templateKey,
    slug: page.slug,
    title: page.title,
    publishedJson: page.publishedJson,
    createdAt: page.createdAt,
    updatedAt: page.updatedAt
  })),
  themeSettings: sourceSite.themeSettings.publishedJson,
  publishedRoutes: policyRoutes,
  publishedPageEntities: [],
  publishedPageCopy: [],
  publishedPageMedia: [],
  publishedPackFacts: [],
  publishedOffers: [],
  publishedFacts: {
    identity: {
      legalName: "MyDreamShoots LLC",
      entityType: "company",
      address: { line1: "1 Demo Way", city: "Demo City", region: "CA", postalCode: "00000", country: "US" },
      supportEmail: "support@example.com",
      sameAs: []
    },
    privacy: { customerMediaTraining: false, sourceMediaRetentionDays: 30 },
    refund: { reviewRequired: true, windowDays: 7, effectiveDate: "2026-08-19" },
    claimRevision: "facts-complete"
  },
  publishedCollectionRefs: [],
  publishedLinkRefs: [],
  revisions: {},
  buildId: "smoke-build"
};
publicationSnapshot.revisions = {
  factsRevision: projectionRevision(publicationSnapshot.publishedFacts),
  routeRevision: projectionRevision(publicationSnapshot.publishedRoutes),
  pageRevision: projectionRevision(publicationSnapshot.publishedPageEntities),
  copyRevision: projectionRevision(publicationSnapshot.publishedPageCopy),
  mediaRevision: projectionRevision(publicationSnapshot.publishedPageMedia),
  packRevision: projectionRevision(publicationSnapshot.publishedPackFacts),
  offerRevision: projectionRevision(publicationSnapshot.publishedOffers),
  collectionRevision: projectionRevision(publicationSnapshot.publishedCollectionRefs),
  policyRevision: projectionRevision({ privacy: publicationSnapshot.publishedFacts.privacy, refund: publicationSnapshot.publishedFacts.refund }),
  linkRevision: projectionRevision(publicationSnapshot.publishedLinkRefs)
};
publicationSnapshot.snapshotHash = publicationSnapshotHash(publicationSnapshot);
publicationSnapshot.revisions.snapshotHash = publicationSnapshot.snapshotHash;
assert.equal(publicationSnapshotIntegrity(publicationSnapshot), "valid", "complete immutable fixture snapshot must validate");
const publication = {
  id: "pub_immutable_empty_projection",
  siteId: sourceSite.id,
  version: 999,
  snapshot: publicationSnapshot,
  factsRevision: "facts-empty",
  publishedBy: "smoke",
  publishedAt: new Date(0).toISOString()
};
const site = { ...sourceSite, latestPublication: publication };
const isolatedState = { ...state, sites: [site], themePublications: [publication] };
const emptyProjectionSnapshot = createPublishedSiteSnapshot(isolatedState, site);
assert.deepEqual(
  emptyProjectionSnapshot.publishedRoutes.filter((route) => route.routeKind === "ai-image-theme-leaf"),
  [],
  "an intentional empty leaf projection must not repopulate from current taxonomy"
);
assert.deepEqual(emptyProjectionSnapshot.products, [], "current products must not repopulate an immutable published offer projection");
assert.deepEqual(emptyProjectionSnapshot.creativePacks, [], "current packs must not repopulate an immutable published collection projection");
assert.equal(resolvePublishedRouteDisposition(emptyProjectionSnapshot, "/ai-image-generation/headshot").kind, "not_found", "a route absent from the publication must fail closed");

const pageEntityId = "mydreamshoots:ai-image-theme:wedding-photo";
const mediaEntityId = `${pageEntityId}:media`;
const publishedRoute = {
  siteId: "site_dreamshoot",
  disposition: "render",
  routeKind: "ai-image-theme-leaf",
  canonicalSlug: "wedding-photo",
  canonicalPath: "/ai-image-generation/wedding-photo",
  pageEntityId,
  pageRevision: "page-wedding-v1",
  copyRevision: "copy-wedding-v1",
  copySource: "page-copy",
  fallbackUsed: false,
  status: "published",
  indexable: true,
  sitemapEligible: true,
  expectedPackId: "pack_published_wedding",
  mediaEntityId
};
const publishedMedia = {
  mediaEntityId,
  ownerPageEntityId: pageEntityId,
  sourcePackId: "pack_published_wedding",
  role: "hero",
  pageEntityId,
  entityRevision: "media-wedding-v1",
  packId: "pack_published_wedding",
  primaryImage: "/assets/snapshot/wedding-cover.jpg",
  galleryImages: ["/assets/snapshot/wedding-gallery.jpg"],
  imageAlts: ["Published wedding portrait cover", "Published wedding portrait gallery"],
  status: "ready"
};
const publishedContent = {
  h1: "Published Wedding Portraits",
  heroIntro: "Plan a wedding portrait set with a consistent visual direction.",
  metaLabel: "Wedding portrait planning",
  tags: ["wedding portraits", "ceremony portraits"],
  detailTags: ["formal portraits", "couple portraits"],
  detailIntro: "Use this page to prepare a wedding portrait brief before generating images.",
  whatCreates: "It creates a coordinated portrait direction for ceremony and couple references.",
  bestFor: ["ceremony portrait planning", "couple announcement drafts", "album concept reviews"],
  workflow: ["Choose approved references", "Describe the composition", "Review the generated set"],
  styleNotes: ["Keep the lighting consistent", "Check hands and clothing", "Review the crop before publishing"],
  reviewCriteria: ["Faces remain recognizable", "Garments and jewelry are coherent", "The crop serves the intended use"],
  coverNote: "Use source images you have permission to use.",
  safetyNote: "Avoid implying an official ceremony record when the image is a concept.",
  galleryTitle: "Wedding portrait examples",
  galleryIntro: "Review the cover and supporting images as one portrait set.",
  ctaEyebrow: "Create a set",
  ctaTitle: "Start wedding portrait planning",
  ctaSubtitle: "Open the published image generation workflow.",
  ctaLinkEntityId: `${pageEntityId}:link:cta`,
  faqEyebrow: "Questions",
  faqTitle: "Wedding portrait FAQ",
  faqItems: [
    { id: "faq-1", question: "What should I prepare?", answer: "Prepare approved reference portraits and a clear use case." },
    { id: "faq-2", question: "Can this represent a real ceremony?", answer: "Treat generated images as concepts unless the context is clearly labeled." },
    { id: "faq-3", question: "How should I review the output?", answer: "Check faces, hands, clothing, jewelry, crop and background continuity." },
    { id: "faq-4", question: "Can I use someone else's photo?", answer: "Only use source media and likenesses you are authorized to use." }
  ],
  relatedEyebrow: "Continue",
  relatedTitle: "Related planning",
  relatedSubtitle: "Keep the next references in the same published entity graph.",
  relatedCtaLabel: "View related planning",
  relatedLinkEntityIds: [`${pageEntityId}:link:related:0`, `${pageEntityId}:link:related:1`]
};
const immutableSnapshot = {
  ...publicationSnapshot,
  publishedRoutes: [publishedRoute, ...policyRoutes],
  publishedPageEntities: [{
    pageEntityId,
    canonicalPath: publishedRoute.canonicalPath,
    pageType: "ai-image-theme-leaf",
    status: "published",
    indexable: true,
    sitemapEligible: true,
    metadata: {
      title: "Published Wedding Portraits | MyDreamShoots",
      description: "Published wedding portrait snapshot description.",
      canonicalPath: publishedRoute.canonicalPath,
      robots: { index: true, follow: true }
    },
    content: publishedContent,
    mediaEntityId,
    pageRevision: publishedRoute.pageRevision,
    copyRevision: publishedRoute.copyRevision,
    reviewReasons: []
  }],
  publishedPageCopy: [{
    pageEntityId,
    canonicalSlug: publishedRoute.canonicalSlug,
    copyRevision: publishedRoute.copyRevision,
    sourceHash: "published-copy-source-hash"
  }],
  publishedPageMedia: [publishedMedia],
  publishedLinkRefs: [
    { linkEntityId: `${pageEntityId}:link:cta`, ownerPageEntityId: pageEntityId, targetType: "published_render", targetPageEntityId: pageEntityId, kind: "cta", label: "Open image generation", href: "/ai-image-generation/wedding-photo", revision: "link-cta-v1" },
    { linkEntityId: `${pageEntityId}:link:related:0`, ownerPageEntityId: pageEntityId, targetType: "published_render", targetPageEntityId: pageEntityId, kind: "related", label: "Review the portrait direction", href: "/ai-image-generation/wedding-photo", revision: "link-related-0-v1" },
    { linkEntityId: `${pageEntityId}:link:related:1`, ownerPageEntityId: pageEntityId, targetType: "published_render", targetPageEntityId: pageEntityId, kind: "related", label: "Check the wedding crop", href: "/ai-image-generation/wedding-photo", revision: "link-related-1-v1" }
  ],
  publishedCollectionRefs: [{
    ownerPageEntityId: pageEntityId,
    collectionEntityId: "mydreamshoots:collection:wedding-photo",
    collectionSlug: "wedding-photo",
    sourcePackId: "pack_published_wedding",
    pageEntityId,
    canonicalPath: publishedRoute.canonicalPath,
    label: "Published Wedding Portraits",
    summary: "Published collection summary.",
    image: publishedMedia.primaryImage,
    imageAlt: publishedMedia.imageAlts[0],
    imageMediaEntityId: mediaEntityId,
    mediaEntityId,
    categorySlug: "wedding-photo",
    creditCost: 20,
    outputCount: 20,
    revision: "collection-wedding-v1",
    entityRevision: "collection-wedding-v1",
    status: "published"
  }],
  revisions: { ...publicationSnapshot.revisions },
  snapshotHash: undefined
};
immutableSnapshot.revisions = {
  factsRevision: projectionRevision(immutableSnapshot.publishedFacts),
  routeRevision: projectionRevision(immutableSnapshot.publishedRoutes),
  pageRevision: projectionRevision(immutableSnapshot.publishedPageEntities),
  copyRevision: projectionRevision(immutableSnapshot.publishedPageCopy),
  mediaRevision: projectionRevision(immutableSnapshot.publishedPageMedia),
  packRevision: projectionRevision(immutableSnapshot.publishedPackFacts),
  offerRevision: projectionRevision(immutableSnapshot.publishedOffers),
  collectionRevision: projectionRevision(immutableSnapshot.publishedCollectionRefs),
  policyRevision: projectionRevision({ privacy: immutableSnapshot.publishedFacts.privacy, refund: immutableSnapshot.publishedFacts.refund }),
  linkRevision: projectionRevision(immutableSnapshot.publishedLinkRefs)
};
immutableSnapshot.snapshotHash = publicationSnapshotHash(immutableSnapshot);
immutableSnapshot.revisions.snapshotHash = immutableSnapshot.snapshotHash;
assert.equal(publicationSnapshotIntegrity(immutableSnapshot), "valid", "complete one-page immutable snapshot must validate");
const immutablePublication = { ...publication, id: "pub_immutable_wedding", version: 1000, snapshot: immutableSnapshot };
const driftedSite = { ...sourceSite, name: "Current state changed", pages: sourceSite.pages.map((page) => ({ ...page, title: `Current ${page.title}` })), latestPublication: immutablePublication };
const driftedState = { ...state, sites: [driftedSite], themePublications: [immutablePublication], products: [{ id: "current-only-product", siteId: sourceSite.id, name: "Current only", type: "credit_pack", status: "active", prices: [] }], creativePacks: [] };
const immutableReadback = createPublishedSiteSnapshot(driftedState, driftedSite);
assert.equal(resolvePublishedRouteDisposition(immutableReadback, publishedRoute.canonicalPath).kind, "render", "a valid published leaf must render");
assert.deepEqual(immutableReadback.products, [], "current products must not alter an immutable empty offer projection");
assert.equal(immutableReadback.creativePacks[0]?.name, "Published Wedding Portraits", "published collection labels must survive current-state drift");

console.log("MyDreamShoots immutable publication snapshot contract passed");
