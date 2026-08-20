import crypto from "node:crypto";

import type {
  PublishedCollectionRef,
  PublishedFactsProjection,
  PublishedLinkRef,
  PublishedOfferProjection,
  PublishedPageCopyProjection,
  PublishedPageEntityProjection,
  PublishedPageMediaProjection,
  PublishedStandardPageMediaProjection,
  PublishedRouteProjection,
  ThemePublicationSnapshot,
  PublishedSeoSnapshot
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
  if (!record(value) || value.siteId !== "site_dreamshoot") return false;
  if (value.disposition === "redirect") {
    return value.routeKind === "policy-alias" && text(value.aliasPath) && text(value.targetPath) &&
      value.statusCode === 308 && value.indexable === false && value.sitemapEligible === false && text(value.routeRevision);
  }
  if (value.disposition !== "render") return false;
  if (value.routeKind === "policy") {
    return (value.canonicalPath === "/privacy" || value.canonicalPath === "/terms") && text(value.pageEntityId) &&
      text(value.pageId) && text(value.pageRevision) && value.status === "published" && value.indexable === true && value.sitemapEligible === true;
  }
  return value.routeKind === "ai-image-theme-leaf" && text(value.canonicalSlug) && text(value.canonicalPath) &&
    text(value.pageEntityId) && text(value.pageRevision) && text(value.copyRevision) &&
    (value.copySource === "page-copy" || value.copySource === "missing") && value.fallbackUsed === false && typeof value.deferred === "boolean" &&
    (value.status === "published" || value.status === "review_required") && typeof value.indexable === "boolean" &&
    typeof value.sitemapEligible === "boolean" && text(value.expectedPackId) && text(value.mediaEntityId) &&
    (value.status === "published" ? value.indexable && value.sitemapEligible && value.deferred === false : !value.indexable && !value.sitemapEligible);
}

function textArray(value: unknown, minimum = 0): value is string[] {
  return Array.isArray(value) && value.length >= minimum && value.every(text);
}

function pageEntity(value: unknown): value is PublishedPageEntityProjection {
  if (!(record(value) && text(value.pageEntityId) && text(value.canonicalPath) && text(value.pageType) &&
    (value.status === "published" || value.status === "review_required") && typeof value.indexable === "boolean" &&
    typeof value.sitemapEligible === "boolean" && record(value.metadata) && record(value.content) &&
    text(value.mediaEntityId) && text(value.pageRevision) && text(value.copyRevision) && Array.isArray(value.reviewReasons))) return false;
  const metadata = value.metadata;
  const content = value.content;
  return text(metadata.title) && text(metadata.description) && metadata.canonicalPath === value.canonicalPath && record(metadata.robots) &&
    typeof metadata.robots.index === "boolean" && typeof metadata.robots.follow === "boolean" &&
    text(content.h1) && text(content.heroIntro) && text(content.metaLabel) && textArray(content.tags) && textArray(content.detailTags) &&
    text(content.detailIntro) && text(content.whatCreates) && textArray(content.bestFor, 3) && textArray(content.workflow, 3) &&
    textArray(content.styleNotes, 3) && textArray(content.reviewCriteria, 3) && text(content.coverNote) &&
    text(content.galleryTitle) && text(content.galleryIntro) && text(content.ctaEyebrow) && text(content.ctaTitle) &&
    text(content.ctaSubtitle) && text(content.ctaLinkEntityId) && text(content.faqEyebrow) && text(content.faqTitle) &&
    Array.isArray(content.faqItems) && content.faqItems.length >= 4 && content.faqItems.every((item) => record(item) && text(item.id) && text(item.question) && text(item.answer)) &&
    text(content.relatedEyebrow) && text(content.relatedTitle) && text(content.relatedSubtitle) && text(content.relatedCtaLabel) &&
    textArray(content.relatedLinkEntityIds) &&
    (value.status === "published" ? value.indexable && value.sitemapEligible && metadata.robots.index === true : !value.indexable && !value.sitemapEligible && metadata.robots.index === false);
}

function pageCopy(value: unknown): value is PublishedPageCopyProjection {
  return record(value) && text(value.pageEntityId) && text(value.copyRevision) && text(value.canonicalSlug) && text(value.sourceHash);
}

function media(value: unknown): value is PublishedPageMediaProjection {
  return record(value) && text(value.mediaEntityId) && text(value.ownerPageEntityId) && text(value.sourcePackId) &&
    value.role === "hero" && text(value.pageEntityId) && text(value.entityRevision) && text(value.packId) &&
    typeof value.primaryImage === "string" && Array.isArray(value.galleryImages) && value.galleryImages.every(publicMediaUrl) &&
    Array.isArray(value.imageAlts) && value.imageAlts.every((item) => typeof item === "string") &&
    value.imageAlts.length === value.galleryImages.length + 1 &&
    (value.status === "ready" || value.status === "review_required") &&
    (value.status !== "ready" || (publicMediaUrl(value.primaryImage) && value.galleryImages.length === 12 && value.imageAlts.length === 13 && value.imageAlts.every(text)));
}

function standardMedia(value: unknown): value is PublishedStandardPageMediaProjection {
  return record(value) && text(value.pageEntityId) && text(value.pageId) && text(value.canonicalPath) &&
    text(value.mediaEntityId) && publicMediaUrl(value.primaryImage) && text(value.primaryImageAlt) &&
    value.ogImage === value.primaryImage && value.twitterImage === value.primaryImage && value.jsonLdImage === value.primaryImage &&
    Array.isArray(value.sitemapImages) && value.sitemapImages.length > 0 && value.sitemapImages.every(publicMediaUrl) &&
    (value.status === "ready" || value.status === "review_required") && text(value.revision);
}

function offer(value: unknown): value is PublishedOfferProjection {
  return record(value) && text(value.productId) && text(value.priceId) && text(value.siteId) && text(value.productName) &&
    (value.productType === "subscription" || value.productType === "credit_pack") && text(value.priceLabel) &&
    ["month", "quarter", "half_year", "year", "one_time"].includes(String(value.interval)) &&
    Number.isInteger(value.amountCents) && Number(value.amountCents) > 0 && /^[a-z]{3}$/i.test(String(value.currency)) &&
    Number.isInteger(value.creditsGranted) && Number(value.creditsGranted) >= 0 &&
    /^price_[a-zA-Z0-9_]+$/.test(String(value.stripePriceId)) && typeof value.checkoutEnabled === "boolean" && text(value.revision);
}

function collection(value: unknown): value is PublishedCollectionRef {
  return record(value) && text(value.ownerPageEntityId) && text(value.collectionEntityId) && text(value.collectionSlug) &&
    text(value.sourcePackId) && text(value.pageEntityId) && text(value.canonicalPath) && text(value.label) &&
    text(value.summary) && typeof value.image === "string" && typeof value.imageAlt === "string" &&
    text(value.imageMediaEntityId) && text(value.mediaEntityId) && Number.isInteger(value.creditCost) &&
    Number(value.creditCost) >= 0 && Number.isInteger(value.outputCount) && Number(value.outputCount) >= 0 &&
    text(value.revision) && text(value.entityRevision) && (value.status === "published" || value.status === "review_required") &&
    (value.status !== "published" || (Number(value.creditCost) > 0 && Number(value.outputCount) > 0 && publicMediaUrl(value.image) && text(value.imageAlt)));
}

function link(value: unknown): value is PublishedLinkRef {
  return record(value) && text(value.linkEntityId) && text(value.ownerPageEntityId) &&
    (value.targetType === "private_action" || (value.targetType === "published_render" && text(value.targetPageEntityId))) &&
    (value.kind === "cta" || value.kind === "related") &&
    text(value.label) && text(value.href) && text(value.revision);
}

function facts(value: unknown): value is PublishedFactsProjection {
  return record(value) && text(value.claimRevision);
}

function factsCompleteForIndexablePages(value: PublishedFactsProjection, pages: PublishedPageEntityProjection[]): boolean {
  if (!pages.some((page) => page.status === "published" && page.indexable)) return true;
  const identity = value.identity;
  const address = identity?.address;
  const privacy = value.privacy;
  const refund = value.refund;
  return text(identity?.legalName) && text(identity?.entityType) && text(address?.line1) && text(address?.city) &&
    text(address?.region) && text(address?.postalCode) && text(address?.country) && text(identity?.supportEmail) &&
    typeof privacy?.customerMediaTraining === "boolean" && Number.isInteger(privacy.sourceMediaRetentionDays) && Number(privacy.sourceMediaRetentionDays) > 0 &&
    typeof refund?.reviewRequired === "boolean" && Number.isInteger(refund.windowDays) && Number(refund.windowDays) > 0 && text(refund.effectiveDate) &&
    text(value.creditLifecycle?.reserve) && text(value.creditLifecycle?.consume) && text(value.creditLifecycle?.release) &&
    text(value.security?.transportClaimKey) && text(value.security?.storageClaimKey);
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!record(value)) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stable(item)]));
}

function projectionRevision(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 20);
}

function unique(values: string[]): boolean {
  return new Set(values).size === values.length;
}

export function publicationSnapshotHash(snapshot: ThemePublicationSnapshot): string {
  const unhashed = {
    ...snapshot,
    snapshotHash: undefined,
    revisions: { ...(snapshot.revisions ?? {}), snapshotHash: undefined }
  };
  return crypto.createHash("sha256").update(JSON.stringify(stable(unhashed))).digest("hex");
}

export function publicationSnapshotIntegrity(snapshot: ThemePublicationSnapshot | undefined): SnapshotIntegrity {
  if (!snapshot || snapshot.seoProjectionVersion !== 1) return "legacy";
  const v1 = snapshot as PublishedSeoSnapshot;
  const valid = Array.isArray(v1.pages) && record(v1.themeSettings) &&
    Array.isArray(v1.publishedRoutes) && v1.publishedRoutes.every(route) &&
    Array.isArray(v1.publishedPageEntities) && v1.publishedPageEntities.every(pageEntity) &&
    Array.isArray(v1.publishedPageCopy) && v1.publishedPageCopy.every(pageCopy) &&
    Array.isArray(v1.publishedPageMedia) && v1.publishedPageMedia.every(media) &&
    Array.isArray(v1.publishedStandardPageMedia) && v1.publishedStandardPageMedia.every(standardMedia) &&
    Array.isArray(v1.publishedPackFacts) &&
    Array.isArray(v1.publishedOffers) && v1.publishedOffers.every(offer) && facts(v1.publishedFacts) &&
    Array.isArray(v1.publishedCollectionRefs) && v1.publishedCollectionRefs.every(collection) &&
    Array.isArray(v1.publishedLinkRefs) && v1.publishedLinkRefs.every(link) &&
    text(v1.snapshotHash) && text(v1.buildId) && text(v1.revisions?.snapshotHash) &&
    ["factsRevision", "routeRevision", "pageRevision", "copyRevision", "mediaRevision", "packRevision", "offerRevision", "collectionRevision", "policyRevision", "linkRevision"]
      .every((key) => text(v1.revisions?.[key as keyof typeof v1.revisions]));
  if (!valid) return "invalid";

  const publishedPageEntities = v1.publishedPageEntities;
  const publishedPageMedia = v1.publishedPageMedia;
  const publishedStandardPageMedia = v1.publishedStandardPageMedia;
  const publishedRoutes = v1.publishedRoutes;
  const leafRoutes = publishedRoutes.filter((item) => item.disposition === "render" && item.routeKind === "ai-image-theme-leaf");
  const policyRoutes = publishedRoutes.filter((item) => item.disposition === "render" && item.routeKind === "policy");
  const redirectRoutes = publishedRoutes.filter((item) => item.disposition === "redirect");
  const expectedPolicyPaths = ["/privacy", "/terms"];
  const expectedPolicyAliases = [
    "/privacy-policy", "/policies/privacy", "/policies/privacy-policy",
    "/terms-of-service", "/policies/terms", "/policies/terms-of-service"
  ];
  const pageCopyRows = v1.publishedPageCopy;
  const collections = v1.publishedCollectionRefs;
  const links = v1.publishedLinkRefs;
  const revisions = v1.revisions;
  const pages = new Map(publishedPageEntities.map((item) => [item.pageEntityId, item]));
  const mediaByPage = new Map(publishedPageMedia.map((item) => [item.pageEntityId, item]));
  const copyByPage = new Map(pageCopyRows.map((item) => [item.pageEntityId, item]));
  const projectionsAgree = leafRoutes.every((item) => {
    const page = pages.get(item.pageEntityId);
    const pageMedia = mediaByPage.get(item.pageEntityId);
    const copy = copyByPage.get(item.pageEntityId);
    return page?.canonicalPath === item.canonicalPath && page?.copyRevision === item.copyRevision &&
      page?.pageRevision === item.pageRevision && page?.mediaEntityId === item.mediaEntityId &&
      pageMedia?.mediaEntityId === item.mediaEntityId && copy?.copyRevision === item.copyRevision &&
      (item.status !== "published" || (page.status === "published" && pageMedia.status === "ready"));
  });
  const routePaths = publishedRoutes.map((item) => item.disposition === "redirect" ? item.aliasPath : item.canonicalPath);
  const entityIds = publishedPageEntities.map((item) => item.pageEntityId);
  const mediaIds = publishedPageMedia.map((item) => item.mediaEntityId);
  const standardMediaIds = publishedStandardPageMedia.map((item) => item.mediaEntityId);
  const linkIds = links.map((item) => item.linkEntityId);
  const expectedStandardPaths = ["/about-us", "/best-packages", "/best-ai-image", "/pricing", "/faq", "/workflow"];
  const completeCoverage = leafRoutes.length === publishedPageEntities.length && leafRoutes.length === publishedPageMedia.length &&
    leafRoutes.length === pageCopyRows.length && leafRoutes.length === collections.length &&
    policyRoutes.length === expectedPolicyPaths.length &&
    expectedPolicyPaths.every((path) => policyRoutes.some((item) => item.canonicalPath === path)) &&
    redirectRoutes.length === expectedPolicyAliases.length &&
    expectedPolicyAliases.every((path) => redirectRoutes.some((item) => item.aliasPath === path)) &&
    [...pages.keys()].every((id) => leafRoutes.some((routeItem) => routeItem.pageEntityId === id)) &&
    collections.every((item) => pages.has(item.pageEntityId) && mediaByPage.get(item.pageEntityId)?.mediaEntityId === item.mediaEntityId) &&
    policyRoutes.every((item) => snapshot.pages.some((page) => page.id === item.pageId && page.slug === item.canonicalPath)) &&
    redirectRoutes.every((item) => policyRoutes.some((routeItem) => routeItem.canonicalPath === item.targetPath));
  const standardMediaAgree = publishedStandardPageMedia.length === expectedStandardPaths.length &&
    expectedStandardPaths.every((path) => publishedStandardPageMedia.some((item) => {
      const page = snapshot.pages.find((candidate) => candidate.id === item.pageId);
      return item.canonicalPath === path && item.status === "ready" && page?.slug === path;
    }));
  const mediaOwnershipAgree = leafRoutes.every((item) => {
    const page = pages.get(item.pageEntityId);
    const pageMedia = mediaByPage.get(item.pageEntityId);
    const collection = collections.find((candidate) => candidate.pageEntityId === item.pageEntityId);
    return page?.mediaEntityId === item.mediaEntityId &&
      pageMedia?.ownerPageEntityId === item.pageEntityId &&
      pageMedia?.sourcePackId === item.expectedPackId &&
      pageMedia?.packId === pageMedia.sourcePackId &&
      collection?.ownerPageEntityId === item.pageEntityId &&
      collection?.mediaEntityId === item.mediaEntityId &&
      collection?.imageMediaEntityId === item.mediaEntityId;
  });
  const linksAgree = links.every((item) => {
    const owner = pages.get(item.ownerPageEntityId);
    if (!owner) return false;
    if (item.kind === "cta" && owner.content.ctaLinkEntityId !== item.linkEntityId) return false;
    if (item.kind === "related" && !owner.content.relatedLinkEntityIds.includes(item.linkEntityId)) return false;
    const target = item.targetType === "published_render" ? pages.get(item.targetPageEntityId) : undefined;
    return item.targetType === "published_render"
      ? target?.canonicalPath === item.href && target.status === "published" && target.indexable && target.sitemapEligible
      : item.kind === "cta" && /^\/app\/create(?:[/?]|$)/.test(item.href);
  }) && publishedPageEntities.every((item) => item.status !== "published" || (
    links.some((linkItem) => linkItem.linkEntityId === item.content.ctaLinkEntityId) &&
    item.content.relatedLinkEntityIds.length >= 2 &&
    item.content.relatedLinkEntityIds.every((id) => links.some((linkItem) => linkItem.linkEntityId === id))
  ));
  const aggregateRevisionsAgree = revisions.routeRevision === projectionRevision(snapshot.publishedRoutes) &&
    revisions.pageRevision === projectionRevision(snapshot.publishedPageEntities) &&
    revisions.copyRevision === projectionRevision(snapshot.publishedPageCopy) &&
    revisions.mediaRevision === projectionRevision({ leaf: snapshot.publishedPageMedia, standard: snapshot.publishedStandardPageMedia }) &&
    revisions.packRevision === projectionRevision(snapshot.publishedPackFacts) &&
    revisions.offerRevision === projectionRevision(snapshot.publishedOffers) &&
    revisions.factsRevision === projectionRevision(v1.publishedFacts) &&
    revisions.collectionRevision === projectionRevision(v1.publishedCollectionRefs) &&
    revisions.linkRevision === projectionRevision(v1.publishedLinkRefs) &&
    revisions.policyRevision === projectionRevision({ privacy: v1.publishedFacts.privacy, refund: v1.publishedFacts.refund, creditLifecycle: v1.publishedFacts.creditLifecycle, security: v1.publishedFacts.security });
  if (!factsCompleteForIndexablePages(v1.publishedFacts, publishedPageEntities) || !projectionsAgree || !completeCoverage || !standardMediaAgree || !mediaOwnershipAgree || !linksAgree || !aggregateRevisionsAgree ||
      !unique(routePaths) || !unique(entityIds) || !unique(mediaIds) || !unique(standardMediaIds) || !unique(linkIds) || snapshot.snapshotHash !== revisions.snapshotHash) {
    if (process.env.MYDREAMSHOOTS_SNAPSHOT_DEBUG === "1") {
      console.error(JSON.stringify({
        projectionsAgree,
        factsCompleteForIndexablePages: factsCompleteForIndexablePages(v1.publishedFacts, publishedPageEntities),
        completeCoverage,
        standardMediaAgree,
        mediaOwnershipAgree,
        linksAgree,
        aggregateRevisionsAgree,
        uniqueRoutePaths: unique(routePaths),
        uniqueEntityIds: unique(entityIds),
        uniqueMediaIds: unique(mediaIds),
        uniqueLinkIds: unique(linkIds),
        snapshotRevisionHashMatches: snapshot.snapshotHash === revisions.snapshotHash,
        calculatedHashMatches: publicationSnapshotHash(v1) === v1.snapshotHash
      }, null, 2));
    }
    return "invalid";
  }
  return publicationSnapshotHash(v1) === v1.snapshotHash ? "valid" : "invalid";
}
