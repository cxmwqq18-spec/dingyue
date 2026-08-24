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
  PublishedRedirectRouteProjection,
  PublishedVideoNavigationProjection,
  PublishedHomepageShowcaseItem,
  ThemePublicationSnapshot,
  PublishedSeoSnapshot
} from "@/lib/types";
import { MYDREAMSHOOTS_STANDARD_SEO_ROUTES } from "@/lib/mydreamshoots-editorial-routes";

export type SnapshotIntegrity = "valid" | "invalid" | "legacy";

const policyRouteSpecs = [
  { canonicalPath: "/privacy", aliases: ["/privacy-policy", "/policies/privacy", "/policies/privacy-policy"] },
  { canonicalPath: "/terms", aliases: ["/terms-of-service", "/policies/terms", "/policies/terms-of-service"] },
  { canonicalPath: "/cookies", aliases: ["/cookie-policy", "/policies/cookies"] },
  { canonicalPath: "/refunds", aliases: ["/refund-policy", "/policies/refund", "/policies/refunds"] },
  { canonicalPath: "/content", aliases: ["/content-policy", "/policies/content"] },
  { canonicalPath: "/shipping", aliases: ["/shipping-policy", "/delivery-policy", "/policies/shipping"] },
  { canonicalPath: "/children-privacy", aliases: ["/children-privacy-policy", "/childrens-privacy", "/policies/children-privacy"] },
  { canonicalPath: "/state-privacy", aliases: ["/state-privacy-rights", "/california-privacy", "/ccpa", "/policies/state-privacy"] }
] as const;
const legacyMotionAlias = { aliasPath: "/ai-image-generation/motion-generator", targetPath: "/ai-video-generation/motion-generator" } as const;
const policyCanonicalPaths = new Set(policyRouteSpecs.map((spec) => spec.canonicalPath));

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
  if (!record(value) || (value.siteId !== "site_dreamshoot" && value.siteId !== "site_grownstride_test")) return false;
  if (value.disposition === "redirect") {
    if (value.routeKind === "policy-alias") {
      return text(value.aliasPath) && text(value.targetPath) && value.statusCode === 308 &&
        value.indexable === false && value.sitemapEligible === false && text(value.routeRevision);
    }
    return value.routeKind === "legacy-topic-alias" && value.aliasPath === legacyMotionAlias.aliasPath &&
      value.targetPath === legacyMotionAlias.targetPath && value.statusCode === 308 &&
      value.indexable === false && value.sitemapEligible === false && text(value.routeRevision);
  }
  if (value.disposition !== "render") return false;
  if (value.routeKind === "policy") {
    return policyCanonicalPaths.has(value.canonicalPath as typeof policyRouteSpecs[number]["canonicalPath"]) && text(value.pageEntityId) &&
      text(value.pageId) && text(value.pageRevision) && value.status === "published" && value.indexable === true && value.sitemapEligible === true;
  }
  if (value.routeKind === "standard-content") {
    return text(value.canonicalPath) && text(value.pageEntityId) && text(value.pageId) && text(value.pageRevision) && text(value.mediaEntityId) &&
      (value.status === "published" || value.status === "review_required") && typeof value.indexable === "boolean" && typeof value.sitemapEligible === "boolean" &&
      (value.status === "published" ? value.indexable && value.sitemapEligible : !value.indexable && !value.sitemapEligible);
  }
  if (value.routeKind === "ai-video-topic-leaf") {
    return text(value.canonicalSlug) && text(value.canonicalPath) && text(value.pageId) && text(value.pageEntityId) &&
      text(value.pageRevision) && text(value.copyRevision) && value.copySource === "theme-page" &&
      value.fallbackUsed === false && value.deferred === false && (value.status === "published" || value.status === "review_required") &&
      typeof value.indexable === "boolean" && typeof value.sitemapEligible === "boolean" && text(value.mediaEntityId) &&
      (value.status === "published" ? value.indexable && value.sitemapEligible : !value.indexable && !value.sitemapEligible);
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
    (metadata.robots.maxImagePreview === undefined || ["none", "standard", "large"].includes(String(metadata.robots.maxImagePreview))) &&
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
  const videoTopic = record(value) && value.routeKind === "ai-video-topic-leaf";
  return record(value) && text(value.mediaEntityId) && text(value.ownerPageEntityId) && text(value.sourcePackId) &&
    value.role === "hero" && text(value.pageEntityId) && text(value.entityRevision) && text(value.packId) &&
    typeof value.primaryImage === "string" && Array.isArray(value.galleryImages) && value.galleryImages.every(publicMediaUrl) &&
    Array.isArray(value.imageAlts) && value.imageAlts.every((item) => typeof item === "string") &&
    value.imageAlts.length === value.galleryImages.length + 1 &&
    (value.status === "ready" || value.status === "review_required") &&
    (value.status !== "ready" || (publicMediaUrl(value.primaryImage) &&
      (videoTopic ? value.imageAlts.every(text) : value.galleryImages.length === 12 && value.imageAlts.length === 13 && value.imageAlts.every(text))));
}

function videoNavigation(value: unknown): value is PublishedVideoNavigationProjection {
  return record(value) && text(value.id) && text(value.pageEntityId) && text(value.canonicalPath) && text(value.slug) &&
    text(value.label) && text(value.description) && text(value.parentSlug) && text(value.parentLabel) && Number.isInteger(value.parentSortOrder) &&
    Number.isInteger(value.sortOrder) && text(value.revision) && (value.imageUrl === undefined || publicMediaUrl(value.imageUrl));
}

function homepageShowcase(value: unknown): value is PublishedHomepageShowcaseItem {
  return record(value) && text(value.id) && ["video", "save_the_date", "photo"].includes(String(value.kind)) &&
    text(value.pageEntityId) && text(value.canonicalPath) && text(value.title) && text(value.subtitle) &&
    Number.isInteger(value.sortOrder) && publicMediaUrl(value.imageUrl) && text(value.imageAlt) &&
    value.status === "published" && value.indexable === true && value.sitemapEligible === true &&
    text(value.entityRevision) && text(value.mediaRevision) &&
    (value.videoUrl === undefined || publicMediaUrl(value.videoUrl));
}

function standardMedia(value: unknown): value is PublishedStandardPageMediaProjection {
  if (!record(value)) return false;
  const primaryImage = String(value.primaryImage ?? "");
  const primaryAlt = String(value.primaryImageAlt ?? "");
  const sitemapImages = Array.isArray(value.sitemapImages) ? value.sitemapImages.map((item) => String(item ?? "")) : [];
  const result = text(value.pageEntityId) && text(value.pageId) && text(value.canonicalPath) &&
    text(value.mediaEntityId) && publicMediaUrl(primaryImage) && text(primaryAlt) &&
    value.ogImage === value.primaryImage && value.twitterImage === value.primaryImage && value.jsonLdImage === value.primaryImage &&
    sitemapImages.length > 0 && sitemapImages.every(publicMediaUrl) &&
    (value.status === "ready" || value.status === "review_required") && text(value.revision);
  if (!result && process.env.MYDREAMSHOOTS_SNAPSHOT_DEBUG === "1") console.error("standardMedia failed", JSON.stringify({ path: value.canonicalPath, primaryImage, primaryAlt, sitemapImages, og: value.ogImage, twitter: value.twitterImage, jsonLd: value.jsonLdImage, status: value.status, revision: value.revision }));
  return result;
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
    (v1.publishedVideoNavigation === undefined || Array.isArray(v1.publishedVideoNavigation) && v1.publishedVideoNavigation.every(videoNavigation)) &&
    (v1.publishedHomepageShowcases === undefined || Array.isArray(v1.publishedHomepageShowcases) && v1.publishedHomepageShowcases.every(homepageShowcase)) &&
    text(v1.snapshotHash) && text(v1.buildId) && text(v1.revisions?.snapshotHash) &&
    ["factsRevision", "routeRevision", "pageRevision", "copyRevision", "mediaRevision", "packRevision", "offerRevision", "collectionRevision", "policyRevision", "linkRevision", "navigationRevision"]
      .every((key) => text(v1.revisions?.[key as keyof typeof v1.revisions]));
  if (!valid) {
    if (process.env.MYDREAMSHOOTS_SNAPSHOT_DEBUG === "1") {
      console.error(JSON.stringify({
        pages: Array.isArray(v1.pages),
        themeSettings: record(v1.themeSettings),
        routes: Array.isArray(v1.publishedRoutes) && v1.publishedRoutes.every(route),
        pageEntities: Array.isArray(v1.publishedPageEntities) && v1.publishedPageEntities.every(pageEntity),
        pageCopy: Array.isArray(v1.publishedPageCopy) && v1.publishedPageCopy.every(pageCopy),
        pageMedia: Array.isArray(v1.publishedPageMedia) && v1.publishedPageMedia.every(media),
        standardPageMedia: Array.isArray(v1.publishedStandardPageMedia) && v1.publishedStandardPageMedia.every(standardMedia),
        packFacts: Array.isArray(v1.publishedPackFacts),
        offers: Array.isArray(v1.publishedOffers) && v1.publishedOffers.every(offer),
        facts: facts(v1.publishedFacts),
        collections: Array.isArray(v1.publishedCollectionRefs) && v1.publishedCollectionRefs.every(collection),
        links: Array.isArray(v1.publishedLinkRefs) && v1.publishedLinkRefs.every(link),
        videoNavigation: v1.publishedVideoNavigation === undefined || Array.isArray(v1.publishedVideoNavigation) && v1.publishedVideoNavigation.every(videoNavigation),
        homepageShowcases: v1.publishedHomepageShowcases === undefined || Array.isArray(v1.publishedHomepageShowcases) && v1.publishedHomepageShowcases.every(homepageShowcase),
        snapshotHash: text(v1.snapshotHash),
        buildId: text(v1.buildId),
        revisions: Object.fromEntries(["factsRevision", "routeRevision", "pageRevision", "copyRevision", "mediaRevision", "packRevision", "offerRevision", "collectionRevision", "policyRevision", "linkRevision", "navigationRevision"]
          .map((key) => [key, text(v1.revisions?.[key as keyof typeof v1.revisions])]))
      }, null, 2));
    }
    return "invalid";
  }

  const publishedPageEntities = v1.publishedPageEntities;
  const publishedPageMedia = v1.publishedPageMedia;
  const publishedStandardPageMedia = v1.publishedStandardPageMedia;
  const publishedRoutes = v1.publishedRoutes;
  const leafRoutes = publishedRoutes.filter((item) => item.disposition === "render" && item.routeKind === "ai-image-theme-leaf");
  const videoTopicRoutes = publishedRoutes.filter((item) => item.disposition === "render" && item.routeKind === "ai-video-topic-leaf");
  const policyRoutes = publishedRoutes.filter((item) => item.disposition === "render" && item.routeKind === "policy");
  const standardContentRoutes = publishedRoutes.filter((item) => item.disposition === "render" && item.routeKind === "standard-content");
  const redirectRoutes = publishedRoutes.filter((item): item is PublishedRedirectRouteProjection => item.disposition === "redirect" && item.routeKind === "policy-alias");
  const legacyRedirectRoutes = publishedRoutes.filter((item) => item.disposition === "redirect" && (item as { routeKind?: string }).routeKind === "legacy-topic-alias") as PublishedRedirectRouteProjection[];
  const expectedPolicyPaths = policyRouteSpecs.map((spec) => spec.canonicalPath);
  const expectedPolicyAliases = policyRouteSpecs.flatMap((spec) => spec.aliases);
  const pageCopyRows = v1.publishedPageCopy;
  const collections = v1.publishedCollectionRefs;
  const links = v1.publishedLinkRefs;
  const videoNavigationRows = v1.publishedVideoNavigation ?? [];
  const homepageShowcaseRows = v1.publishedHomepageShowcases ?? [];
  const revisions = v1.revisions;
  const pages = new Map(publishedPageEntities.map((item) => [item.pageEntityId, item]));
  const mediaByPage = new Map(publishedPageMedia.map((item) => [item.pageEntityId, item]));
  const copyByPage = new Map(pageCopyRows.map((item) => [item.pageEntityId, item]));
  const leafProjectionsAgree = [...leafRoutes, ...videoTopicRoutes].every((item) => {
    const page = pages.get(item.pageEntityId);
    const pageMedia = mediaByPage.get(item.pageEntityId);
    const copy = copyByPage.get(item.pageEntityId);
    return page?.canonicalPath === item.canonicalPath && page?.copyRevision === item.copyRevision &&
      page?.pageRevision === item.pageRevision && page?.mediaEntityId === item.mediaEntityId &&
      pageMedia?.mediaEntityId === item.mediaEntityId && copy?.copyRevision === item.copyRevision &&
      (item.status !== "published" || (page.status === "published" && pageMedia.status === "ready"));
  });
  const standardProjectionsAgree = standardContentRoutes.every((item) => {
    const page = pages.get(item.pageEntityId);
    const media = publishedStandardPageMedia.find((candidate) => candidate.mediaEntityId === item.mediaEntityId);
    return page?.canonicalPath === item.canonicalPath && page?.pageRevision === item.pageRevision &&
      page?.mediaEntityId === item.mediaEntityId && media?.pageEntityId === item.pageEntityId &&
      media?.pageId === item.pageId && media?.canonicalPath === item.canonicalPath &&
      (item.status !== "published" || (page.status === "published" && media.status === "ready"));
  });
  const projectionsAgree = leafProjectionsAgree && standardProjectionsAgree;
  const routePaths = publishedRoutes.map((item) => item.disposition === "redirect" ? item.aliasPath : item.canonicalPath);
  const entityIds = publishedPageEntities.map((item) => item.pageEntityId);
  const mediaIds = publishedPageMedia.map((item) => item.mediaEntityId);
  const standardMediaIds = publishedStandardPageMedia.map((item) => item.mediaEntityId);
  const linkIds = links.map((item) => item.linkEntityId);
  const expectedStandardPaths = Array.from(new Set([
    ...MYDREAMSHOOTS_STANDARD_SEO_ROUTES.filter((path) => publishedStandardPageMedia.some((candidate) => candidate.canonicalPath === path && candidate.status === "ready")),
    ...publishedStandardPageMedia.filter((candidate) => candidate.status === "ready").map((candidate) => candidate.canonicalPath)
  ]));
  const imagePageEntities = publishedPageEntities.filter((item) => item.pageType === "ai-image-theme-leaf");
  const videoPageEntities = publishedPageEntities.filter((item) => item.pageType === "ai-video-topic-leaf");
  const imagePageMedia = publishedPageMedia.filter((item) => item.routeKind !== "ai-video-topic-leaf");
  const videoPageMedia = publishedPageMedia.filter((item) => item.routeKind === "ai-video-topic-leaf");
  const imagePageCopy = pageCopyRows.filter((item) => leafRoutes.some((routeItem) => routeItem.pageEntityId === item.pageEntityId));
  const videoPageCopy = pageCopyRows.filter((item) => videoTopicRoutes.some((routeItem) => routeItem.pageEntityId === item.pageEntityId));
  const completeCoverage = leafRoutes.length === imagePageEntities.length && leafRoutes.length === imagePageMedia.length &&
    leafRoutes.length === imagePageCopy.length && leafRoutes.length === collections.length &&
    videoTopicRoutes.length === videoPageEntities.length && videoTopicRoutes.length === videoPageMedia.length &&
    videoTopicRoutes.length === videoPageCopy.length &&
    policyRoutes.length === expectedPolicyPaths.length &&
    expectedPolicyPaths.every((path) => policyRoutes.some((item) => item.canonicalPath === path)) &&
    redirectRoutes.length === expectedPolicyAliases.length &&
    expectedPolicyAliases.every((path) => redirectRoutes.some((item) => item.aliasPath === path)) &&
    legacyRedirectRoutes.length === 1 && legacyRedirectRoutes[0]?.aliasPath === legacyMotionAlias.aliasPath &&
    legacyRedirectRoutes[0]?.targetPath === legacyMotionAlias.targetPath &&
    [...pages.keys()].every((id) => [...leafRoutes, ...videoTopicRoutes, ...standardContentRoutes].some((routeItem) => routeItem.pageEntityId === id || snapshot.pages.some((page) => page.id === (routeItem as { pageId?: string }).pageId && page.id === id))) &&
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
  }) && videoTopicRoutes.every((item) => {
    const page = pages.get(item.pageEntityId);
    const pageMedia = mediaByPage.get(item.pageEntityId);
    return page?.mediaEntityId === item.mediaEntityId && pageMedia?.ownerPageEntityId === item.pageEntityId &&
      pageMedia?.sourcePackId === item.pageId && pageMedia?.packId === item.pageId && pageMedia.routeKind === "ai-video-topic-leaf";
  }) && standardContentRoutes.every((item) => {
    const page = pages.get(item.pageEntityId);
    const media = publishedStandardPageMedia.find((candidate) => candidate.mediaEntityId === item.mediaEntityId);
    return page?.mediaEntityId === item.mediaEntityId && media?.pageEntityId === item.pageEntityId &&
      media?.pageId === item.pageId && media?.canonicalPath === item.canonicalPath;
  });
  const videoNavigationAgree = videoTopicRoutes.length === 0
    ? videoNavigationRows.length === 0
    : videoNavigationRows.length === videoTopicRoutes.length &&
      text(v1.revisions.navigationRevision) &&
      videoNavigationRows.every((item) => {
        const route = videoTopicRoutes.find((candidate) => candidate.pageEntityId === item.pageEntityId);
        const pageMedia = mediaByPage.get(item.pageEntityId);
        return route?.canonicalPath === item.canonicalPath && route.canonicalSlug === item.slug &&
          pageMedia?.primaryImage === item.imageUrl && item.parentSortOrder >= 0 && item.sortOrder >= 0;
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
    (videoTopicRoutes.length === 0
      ? (v1.publishedVideoNavigation === undefined || revisions.navigationRevision === projectionRevision(videoNavigationRows))
      : revisions.navigationRevision === projectionRevision(videoNavigationRows)) &&
    (v1.publishedHomepageShowcases === undefined || revisions.homepageShowcaseRevision === projectionRevision(homepageShowcaseRows)) &&
    revisions.policyRevision === projectionRevision({ privacy: v1.publishedFacts.privacy, refund: v1.publishedFacts.refund, creditLifecycle: v1.publishedFacts.creditLifecycle, security: v1.publishedFacts.security });
  if (!factsCompleteForIndexablePages(v1.publishedFacts, publishedPageEntities) || !projectionsAgree || !completeCoverage || !standardMediaAgree || !mediaOwnershipAgree || !videoNavigationAgree || !linksAgree || !aggregateRevisionsAgree ||
      !unique(routePaths) || !unique(entityIds) || !unique(mediaIds) || !unique(standardMediaIds) || !unique(linkIds) || snapshot.snapshotHash !== revisions.snapshotHash) {
    if (process.env.MYDREAMSHOOTS_SNAPSHOT_DEBUG === "1") {
      console.error(JSON.stringify({
        projectionsAgree,
        leafProjectionsAgree,
        standardProjectionsAgree,
        factsCompleteForIndexablePages: factsCompleteForIndexablePages(v1.publishedFacts, publishedPageEntities),
        completeCoverage,
        standardMediaAgree,
        mediaOwnershipAgree,
        homepageShowcaseRows: homepageShowcaseRows.length,
        videoNavigationAgree,
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
