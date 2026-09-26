import {
  assessMydreamshootsPageIndependence,
  mydreamshootsPageCopyForSlug,
  type MyDreamshootsPageCopy
} from "@/lib/mydreamshoots-page-copy";
import mydreamshootsThemeTaxonomy from "@/lib/mydreamshoots-theme-taxonomy.json";
import { mydreamshootsKeywordsForPath } from "@/lib/mydreamshoots-tdk";
import type { CreativePack, PublishedLinkRef, PublishedPageEntityProjection } from "@/lib/types";

export type MyDreamshootsSiteId = "site_dreamshoot" | "site_grownstride_test" | "site_aidreamcapes";
const SITE_ID: MyDreamshootsSiteId = "site_dreamshoot";
const ROUTE_KIND = "ai-image-theme-leaf";
const DEFERRED_LEAF_SLUGS = new Set<string>();

type TaxonomyItem = {
  slug: string;
  label: string;
  reusePackId?: string;
  sourcePackId?: string;
  mediaReviewStatus?: "ready" | "review_required";
  mediaReviewReason?: string;
};

const taxonomyItems = (mydreamshootsThemeTaxonomy.items ?? []) as TaxonomyItem[];

export type MyDreamshootsPublishedRouteStatus = "published" | "review_required";

export type MyDreamshootsPublishedRouteManifestRow = {
  disposition: "render";
  siteId: MyDreamshootsSiteId;
  routeKind: typeof ROUTE_KIND;
  canonicalSlug: string;
  canonicalPath: string;
  pageEntityId: string;
  pageRevision: string;
  copyRevision: string;
  copySource: "page-copy" | "missing";
  fallbackUsed: false;
  deferred: boolean;
  status: MyDreamshootsPublishedRouteStatus;
  indexable: boolean;
  sitemapEligible: boolean;
  expectedPackId: string;
  mediaEntityId: string;
  reviewReason?: string;
};

export type MyDreamshootsPublishedPageEntity = PublishedPageEntityProjection & {
  pageType: "ai-image-theme-leaf";
};

export type MyDreamshootsPublishedPageMediaProjection = {
  siteId: MyDreamshootsSiteId;
  routeKind: typeof ROUTE_KIND;
  canonicalSlug: string;
  canonicalPath: string;
  pageEntityId: string;
  mediaEntityId: string;
  ownerPageEntityId: string;
  sourcePackId: string;
  role: "hero";
  entityRevision: string;
  packId: string;
  primaryImage: string;
  galleryImages: string[];
  imageAlts: string[];
  status: "ready" | "review_required";
  reviewReason?: string;
};

type PublishedMediaPack = Pick<CreativePack, "id" | "status" | "imageUrl" | "galleryImages" | "galleryImageAlts">;

export function normalizePublishedSlug(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^ai-image-generation\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function revision(value: unknown): string {
  const serialized = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function mediaSlugFromUrl(value: string): string {
  return String(value)
    .split(/[?#]/, 1)[0]
    .split("/")
    .filter(Boolean)
    .at(-2) || "";
}

export function publishedLinkEntityId(pageEntityId: string, kind: "cta" | "related", index = 0): string {
  return `${pageEntityId}:link:${kind}${kind === "related" ? `:${index + 1}` : ""}`;
}

export function publishedPageCopySourceHash(copy: MyDreamshootsPageCopy): string {
  return revision(copy);
}

function expectedPackId(item: TaxonomyItem): string {
  return item.reusePackId || `pack_dreamshoot_${item.slug.replace(/[^a-z0-9]+/g, "_")}`;
}

export function mydreamshootsPublishedRouteManifest(siteId: MyDreamshootsSiteId = SITE_ID): MyDreamshootsPublishedRouteManifestRow[] {
  return taxonomyItems.filter((item) => normalizePublishedSlug(item.slug) !== "motion-generator").map((item) => {
    const canonicalSlug = normalizePublishedSlug(item.slug);
    const canonicalPath = `/ai-image-generation/${canonicalSlug}`;
    const pageEntityId = `mydreamshoots:ai-image-theme:${canonicalSlug}`;
    const copy = mydreamshootsPageCopyForSlug(canonicalSlug);
    const copyReady = Boolean(copy?.copyRevision && copy.pageEntityId === pageEntityId && copy.faqItems.length >= 4);
    const independence = copy ? assessMydreamshootsPageIndependence(copy, canonicalSlug) : undefined;
    const copyIndependent = Boolean(independence?.independent);
    const mediaReady = item.mediaReviewStatus !== "review_required";
    const deferred = DEFERRED_LEAF_SLUGS.has(canonicalSlug);
    const indexable = copyReady && copyIndependent && mediaReady && !deferred;
    return {
      disposition: "render",
      siteId,
      routeKind: ROUTE_KIND,
      canonicalSlug,
      canonicalPath,
      pageEntityId,
      pageRevision: independence?.pageRevision ?? "",
      copyRevision: copy?.copyRevision ?? "",
      copySource: copyReady ? "page-copy" : "missing",
      fallbackUsed: false,
      deferred,
      status: indexable ? "published" : "review_required",
      indexable,
      sitemapEligible: indexable,
      expectedPackId: expectedPackId(item),
      mediaEntityId: `${pageEntityId}:media`,
      ...(!copyReady
        ? { reviewReason: "PAGE_COPY_REVIEW_REQUIRED" }
        : deferred
          ? { reviewReason: "DEFERRED_AI_VIDEO_PAGE" }
        : !copyIndependent
          ? { reviewReason: `PAGE_COPY_NOT_INDEPENDENT:${independence?.reasons.join("|") || "UNKNOWN"}` }
        : !mediaReady
          ? { reviewReason: item.mediaReviewReason || "PAGE_COPY_MEDIA_ENTITY_MISMATCH" }
          : {})
    };
  });
}

export function mydreamshootsPublishedPageEntities(siteId: MyDreamshootsSiteId = SITE_ID): MyDreamshootsPublishedPageEntity[] {
  return mydreamshootsPublishedRouteManifest(siteId).flatMap((route) => {
    const copy = mydreamshootsPageCopyForSlug(route.canonicalSlug);
    if (!copy) return [];
    const independence = assessMydreamshootsPageIndependence(copy, route.canonicalSlug);
    return [{
      pageEntityId: route.pageEntityId,
      canonicalPath: route.canonicalPath,
      pageType: "ai-image-theme-leaf" as const,
      status: route.status,
      indexable: route.indexable,
      sitemapEligible: route.sitemapEligible,
      metadata: {
        title: copy.seoTitle,
        description: copy.cardDescription,
        keywords: mydreamshootsKeywordsForPath(route.canonicalPath, copy.seoTitle, copy.cardDescription),
        canonicalPath: route.canonicalPath,
        robots: { index: route.indexable, follow: true }
      },
      content: {
        h1: copy.headline,
        heroIntro: copy.cardDescription,
        metaLabel: copy.metaLabel,
        tags: [...copy.tags],
        detailTags: [...copy.detailTags],
        detailIntro: copy.detailIntro,
        whatCreates: copy.whatCreates,
        bestFor: [...copy.bestFor],
        workflow: [...copy.workflow],
        styleNotes: [...copy.styleNotes],
        reviewCriteria: [...(copy.reviewPoints ?? copy.styleNotes)],
        coverNote: copy.coverNote,
        safetyNote: copy.safetyNote,
        galleryTitle: copy.galleryTitle,
        galleryIntro: copy.galleryIntro,
        ctaEyebrow: copy.ctaEyebrow,
        ctaTitle: copy.ctaTitle,
        ctaSubtitle: copy.ctaSubtitle,
        ctaLinkEntityId: publishedLinkEntityId(route.pageEntityId, "cta"),
        faqEyebrow: copy.faqEyebrow,
        faqTitle: copy.faqTitle,
        faqItems: copy.faqItems.map((item) => ({ ...item })),
        relatedEyebrow: copy.relatedEyebrow,
        relatedTitle: copy.relatedTitle,
        relatedSubtitle: copy.relatedSubtitle,
        relatedCtaLabel: copy.relatedCtaLabel,
        relatedLinkEntityIds: (copy.relatedLinks ?? []).map((_, index) => publishedLinkEntityId(route.pageEntityId, "related", index))
      },
      mediaEntityId: route.mediaEntityId,
      pageRevision: independence.pageRevision,
      copyRevision: copy.copyRevision,
      reviewReasons: independence.reasons
    }];
  });
}

export function pageCopyFromPublishedPageEntity(
  entity: PublishedPageEntityProjection,
  links: PublishedLinkRef[]
): MyDreamshootsPageCopy | undefined {
  if (entity.pageType !== "ai-image-theme-leaf") return undefined;
  const cta = links.find((link) => link.linkEntityId === entity.content.ctaLinkEntityId && link.kind === "cta");
  const related = entity.content.relatedLinkEntityIds
    .map((linkId) => links.find((link) => link.linkEntityId === linkId && link.kind === "related"))
    .filter((link): link is PublishedLinkRef => Boolean(link));
  if (!cta || related.length !== entity.content.relatedLinkEntityIds.length) return undefined;
  return {
    pageEntityId: entity.pageEntityId,
    copyRevision: entity.copyRevision,
    seoTitle: entity.metadata.title,
    headline: entity.content.h1,
    cardDescription: entity.content.heroIntro,
    metaLabel: entity.content.metaLabel,
    tags: [...entity.content.tags],
    detailTags: [...entity.content.detailTags],
    detailIntro: entity.content.detailIntro,
    whatCreates: entity.content.whatCreates,
    bestFor: [...entity.content.bestFor],
    workflow: [...entity.content.workflow],
    styleNotes: [...entity.content.styleNotes],
    reviewPoints: [...entity.content.reviewCriteria],
    coverNote: entity.content.coverNote,
    safetyNote: entity.content.safetyNote,
    galleryTitle: entity.content.galleryTitle,
    galleryIntro: entity.content.galleryIntro,
    ctaEyebrow: entity.content.ctaEyebrow,
    ctaTitle: entity.content.ctaTitle,
    ctaSubtitle: entity.content.ctaSubtitle,
    ctaLabel: cta.label,
    ctaHref: cta.href,
    faqEyebrow: entity.content.faqEyebrow,
    faqTitle: entity.content.faqTitle,
    faqItems: entity.content.faqItems.map((item) => ({ ...item })),
    relatedEyebrow: entity.content.relatedEyebrow,
    relatedTitle: entity.content.relatedTitle,
    relatedSubtitle: entity.content.relatedSubtitle,
    relatedCtaLabel: entity.content.relatedCtaLabel,
    relatedLinks: related.map((link) => ({ label: link.label, href: link.href }))
  };
}

export function mydreamshootsPublishedRouteForSlug(value: string | null | undefined): MyDreamshootsPublishedRouteManifestRow | undefined {
  const slug = normalizePublishedSlug(value);
  if (!slug) return undefined;
  return mydreamshootsPublishedRouteManifest().find((row) => row.canonicalSlug === slug);
}

export function mydreamshootsPublishedRouteForPath(value: string | null | undefined): MyDreamshootsPublishedRouteManifestRow | undefined {
  const path = String(value ?? "").trim().split(/[?#]/)[0]?.replace(/\/+$/, "") || "/";
  const slug = path.match(/^\/ai-image-generation\/([^/]+)$/)?.[1];
  return slug ? mydreamshootsPublishedRouteForSlug(slug) : undefined;
}

export function resolveMydreamshootsPublishedPageMedia(
  route: MyDreamshootsPublishedRouteManifestRow,
  creativePacks: CreativePack[]
): MyDreamshootsPublishedPageMediaProjection {
  const pack = creativePacks.find((candidate) => candidate.siteId === route.siteId && candidate.id === route.expectedPackId);
  return buildPublishedPageMediaProjection(route, pack);
}

export function buildPublishedPageMediaProjection(
  route: MyDreamshootsPublishedRouteManifestRow,
  pack: PublishedMediaPack | null | undefined
): MyDreamshootsPublishedPageMediaProjection {
  if (!pack || pack.status !== "active") {
    return {
      siteId: route.siteId,
      routeKind: route.routeKind,
      canonicalSlug: route.canonicalSlug,
      canonicalPath: route.canonicalPath,
      pageEntityId: route.pageEntityId,
      mediaEntityId: route.mediaEntityId,
      ownerPageEntityId: route.pageEntityId,
      sourcePackId: route.expectedPackId,
      role: "hero",
      entityRevision: revision([route.pageEntityId, route.expectedPackId, "missing"]),
      packId: route.expectedPackId,
      primaryImage: "",
      galleryImages: [],
      imageAlts: [""],
      status: "review_required",
      reviewReason: "PAGE_MEDIA_REQUIRED"
    };
  }

  const images = Array.from(new Set([pack.imageUrl, ...(pack.galleryImages ?? [])].map((value) => String(value ?? "").trim()).filter(Boolean)));
  const ownerMatches = pack.id === route.expectedPackId;
  const suppliedImageAlts = (pack.galleryImageAlts ?? []).map((value) => String(value ?? "").trim());
  // CreativePack stores gallery alts without the cover alt. The immutable
  // page-media contract includes the cover, so normalize both shapes here.
  const coverBrand = route.siteId === "site_aidreamcapes" ? "Aidreamcapes" : "MyDreamShoots";
  const coverAlt = `${coverBrand} ${route.canonicalSlug.replace(/-/g, " ")} hero cover for image generation planning`;
  const suppliedContractAlts = suppliedImageAlts.length === images.length - 1
    ? [coverAlt, ...suppliedImageAlts]
    : suppliedImageAlts;
  // Keep the immutable media projection structurally aligned even when a legacy pack
  // is missing alt text. Empty values leave the route review_required and non-indexable.
  const imageAlts = images.map((_, index) => suppliedContractAlts[index] ?? "");
  const altsReady = imageAlts.length === images.length && imageAlts.every(Boolean);
  const imageContractReady = images.length === 13 && imageAlts.length === 13;
  const imageNamespaceReady = route.canonicalSlug !== "edit-by-prompt" || images.every((image) => mediaSlugFromUrl(image) === route.canonicalSlug);
  const ready = route.status === "published" && ownerMatches && imageContractReady && altsReady && imageNamespaceReady;
  return {
    siteId: route.siteId,
    routeKind: route.routeKind,
    canonicalSlug: route.canonicalSlug,
    canonicalPath: route.canonicalPath,
    pageEntityId: route.pageEntityId,
    mediaEntityId: route.mediaEntityId,
    ownerPageEntityId: route.pageEntityId,
    sourcePackId: pack.id,
    role: "hero",
    entityRevision: revision([route.pageEntityId, pack.id, images, imageAlts]),
    packId: pack.id,
    primaryImage: images[0] ?? "",
    galleryImages: images.slice(1),
    imageAlts,
    status: ready ? "ready" : "review_required",
    ...(!ready
      ? { reviewReason: route.reviewReason || (!ownerMatches ? "PAGE_COPY_MEDIA_ENTITY_MISMATCH" : !imageNamespaceReady ? "PAGE_MEDIA_NAMESPACE_MISMATCH" : !imageContractReady ? "PAGE_MEDIA_IMAGE_CONTRACT_REQUIRED" : !altsReady ? "PAGE_MEDIA_ALT_REQUIRED" : "PAGE_MEDIA_REQUIRED") }
      : {})
  };
}

export function mydreamshootsPublishedPageMediaProjections(creativePacks: CreativePack[]): MyDreamshootsPublishedPageMediaProjection[] {
  return mydreamshootsPublishedRouteManifest()
    .map((route) => resolveMydreamshootsPublishedPageMedia(route, creativePacks));
}
