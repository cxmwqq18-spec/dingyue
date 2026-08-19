import crypto from "node:crypto";

import type {
  PublishedCollectionRef,
  PublishedCreativePackProjection,
  PublishedFactsProjection,
  PublishedOfferProjection,
  PublishedPageCopyProjection,
  PublishedPageMediaProjection,
  PublishedRouteProjection,
  ThemePublication
} from "@/lib/types";

export type SnapshotIntegrity = "valid" | "invalid" | "legacy";

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function publicMediaUrl(value: unknown): value is string {
  return text(value) && (/^https:\/\//i.test(value) || value.startsWith("/"));
}

function route(value: unknown): value is PublishedRouteProjection {
  return record(value) && value.siteId === "site_dreamshoot" && value.routeKind === "ai-image-theme-leaf" &&
    text(value.canonicalSlug) && text(value.canonicalPath) && text(value.pageEntityId) && text(value.copyRevision) &&
    (value.copySource === "page-copy" || value.copySource === "missing") && value.fallbackUsed === false &&
    (value.status === "published" || value.status === "review_required") && typeof value.indexable === "boolean" &&
    typeof value.sitemapEligible === "boolean" && text(value.expectedPackId) && text(value.mediaEntityId);
}

function pageCopy(value: unknown): value is PublishedPageCopyProjection {
  return record(value) && text(value.pageEntityId) && text(value.copyRevision) && text(value.canonicalSlug) && record(value.copy);
}

function media(value: unknown): value is PublishedPageMediaProjection {
  return record(value) && text(value.mediaEntityId) && text(value.ownerPageEntityId) && text(value.sourcePackId) &&
    value.role === "hero" && text(value.pageEntityId) && text(value.entityRevision) && text(value.packId) &&
    typeof value.primaryImage === "string" && Array.isArray(value.galleryImages) && value.galleryImages.every(publicMediaUrl) &&
    Array.isArray(value.imageAlts) && value.imageAlts.every((item) => typeof item === "string") &&
    value.imageAlts.length === value.galleryImages.length + 1 &&
    (value.status === "ready" || value.status === "review_required") &&
    (value.status !== "ready" || (publicMediaUrl(value.primaryImage) && value.imageAlts.every(text)));
}

function offer(value: unknown): value is PublishedOfferProjection {
  return record(value) && text(value.productId) && text(value.priceId) && text(value.siteId) && text(value.productName) &&
    (value.productType === "subscription" || value.productType === "credit_pack") && text(value.priceLabel) &&
    ["month", "quarter", "half_year", "year", "one_time"].includes(String(value.interval)) &&
    Number.isInteger(value.amountCents) && Number(value.amountCents) > 0 && /^[a-z]{3}$/i.test(String(value.currency)) &&
    Number.isInteger(value.creditsGranted) && Number(value.creditsGranted) >= 0 && /^price_[a-zA-Z0-9_]+$/.test(String(value.stripePriceId)) &&
    typeof value.checkoutEnabled === "boolean" && text(value.revision);
}

function collection(value: unknown): value is PublishedCollectionRef {
  return record(value) && text(value.collectionSlug) && text(value.sourcePackId) && text(value.pageEntityId) &&
    text(value.canonicalPath) && text(value.label) && text(value.summary) && typeof value.image === "string" && typeof value.imageAlt === "string" &&
    text(value.mediaEntityId) && Number.isInteger(value.creditCost) && Number(value.creditCost) > 0 &&
    Number.isInteger(value.outputCount) && Number(value.outputCount) > 0 && text(value.entityRevision) &&
    (value.status === "published" || value.status === "review_required") &&
    (value.status !== "published" || (publicMediaUrl(value.image) && text(value.imageAlt)));
}

function creativePack(value: unknown): value is PublishedCreativePackProjection {
  return record(value) && text(value.packId) && text(value.pageEntityId) && text(value.collectionSlug) && text(value.label) &&
    text(value.summary) && Number.isInteger(value.creditCost) && Number(value.creditCost) > 0 &&
    Number.isInteger(value.outputCount) && Number(value.outputCount) > 0 && text(value.mediaEntityId) &&
    typeof value.image === "string" && typeof value.imageAlt === "string" && text(value.revision) &&
    (value.status === "published" || value.status === "review_required") &&
    (value.status !== "published" || (publicMediaUrl(value.image) && text(value.imageAlt)));
}

function facts(value: unknown): value is PublishedFactsProjection {
  return record(value) && text(value.claimRevision);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!record(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stable(item)]));
}

export function publicationSnapshotHash(snapshot: ThemePublication["snapshot"]): string {
  const unhashed = { ...snapshot, revisions: { ...(snapshot.revisions ?? {}), snapshotHash: undefined } };
  return crypto.createHash("sha256").update(JSON.stringify(stable(unhashed))).digest("hex");
}

export function publicationSnapshotIntegrity(snapshot: ThemePublication["snapshot"] | undefined): SnapshotIntegrity {
  if (!snapshot || snapshot.seoProjectionVersion !== 1) return "legacy";
  const arraysValid = Array.isArray(snapshot.pages) && record(snapshot.themeSettings) &&
    Array.isArray(snapshot.publishedRoutes) && snapshot.publishedRoutes.every(route) &&
    Array.isArray(snapshot.publishedPageCopy) && snapshot.publishedPageCopy.every(pageCopy) &&
    Array.isArray(snapshot.publishedPageMedia) && snapshot.publishedPageMedia.every(media) &&
    Array.isArray(snapshot.publishedPackFacts) && snapshot.publishedPackFacts.every((item) =>
      record(item) && text(item.packId) && Number.isInteger(item.creditCost) && Number(item.creditCost) > 0 &&
      Number.isInteger(item.outputCount) && Number(item.outputCount) > 0 && text(item.revision)) &&
    Array.isArray(snapshot.publishedOffers) && snapshot.publishedOffers.every(offer) &&
    facts(snapshot.publishedFacts) &&
    Array.isArray(snapshot.publishedCollectionRefs) && snapshot.publishedCollectionRefs.every(collection) &&
    Array.isArray(snapshot.publishedCreativePacks) && snapshot.publishedCreativePacks.every(creativePack);
  if (!arraysValid || !text(snapshot.revisions?.snapshotHash)) return "invalid";
  const mediaByPage = new Map(snapshot.publishedPageMedia?.map((item) => [item.pageEntityId, item]));
  const copyPages = new Set(snapshot.publishedPageCopy?.map((item) => item.pageEntityId));
  const collectionByPage = new Map(snapshot.publishedCollectionRefs?.map((item) => [item.pageEntityId, item]));
  const packByPage = new Map(snapshot.publishedCreativePacks?.map((item) => [item.pageEntityId, item]));
  const projectionsAgree = snapshot.publishedRoutes?.every((item) => {
    const mediaProjection = mediaByPage.get(item.pageEntityId);
    const collectionProjection = collectionByPage.get(item.pageEntityId);
    const packProjection = packByPage.get(item.pageEntityId);
    return copyPages.has(item.pageEntityId) && mediaProjection?.mediaEntityId === item.mediaEntityId &&
      collectionProjection?.mediaEntityId === item.mediaEntityId && collectionProjection.sourcePackId === item.expectedPackId &&
      packProjection?.mediaEntityId === item.mediaEntityId && packProjection.packId === item.expectedPackId &&
      (item.status !== "published" || (mediaProjection.status === "ready" && collectionProjection.status === "published" && packProjection.status === "published"));
  });
  if (!projectionsAgree) return "invalid";
  return publicationSnapshotHash(snapshot) === snapshot.revisions.snapshotHash ? "valid" : "invalid";
}
