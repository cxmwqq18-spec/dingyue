import { mydreamshootsPageCopyForSlug } from "@/lib/mydreamshoots-page-copy";
import mydreamshootsThemeTaxonomy from "@/lib/mydreamshoots-theme-taxonomy.json";
import type { CreativePack, PublishedRouteProjection } from "@/lib/types";

const SITE_ID = "site_dreamshoot";
const ROUTE_KIND = "ai-image-theme-leaf";

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

export type MyDreamshootsPublishedRouteManifestRow = PublishedRouteProjection;

export type MyDreamshootsPublishedPageMediaProjection = {
  siteId: typeof SITE_ID;
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

export function publishedMediaEntityId(pageEntityId: string): string {
  return `${pageEntityId}:media`;
}

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

function expectedPackId(item: TaxonomyItem): string {
  return item.reusePackId || `pack_dreamshoot_${item.slug.replace(/[^a-z0-9]+/g, "_")}`;
}

export function mydreamshootsPublishedRouteManifest(): MyDreamshootsPublishedRouteManifestRow[] {
  return taxonomyItems.map((item) => {
    const canonicalSlug = normalizePublishedSlug(item.slug);
    const canonicalPath = `/ai-image-generation/${canonicalSlug}`;
    const pageEntityId = `mydreamshoots:ai-image-theme:${canonicalSlug}`;
    const copy = mydreamshootsPageCopyForSlug(canonicalSlug);
    const copyReady = Boolean(copy?.copyRevision && copy.pageEntityId === pageEntityId && copy.faqItems.length >= 4);
    const mediaReady = item.mediaReviewStatus !== "review_required";
    const indexable = copyReady && mediaReady;
    return {
      siteId: SITE_ID,
      routeKind: ROUTE_KIND,
      canonicalSlug,
      canonicalPath,
      pageEntityId,
      copyRevision: copy?.copyRevision ?? "",
      copySource: copyReady ? "page-copy" : "missing",
      fallbackUsed: false,
      status: indexable ? "published" : "review_required",
      indexable,
      sitemapEligible: indexable,
      expectedPackId: expectedPackId(item),
      mediaEntityId: publishedMediaEntityId(pageEntityId),
      ...(!copyReady
        ? { reviewReason: "PAGE_COPY_REVIEW_REQUIRED" }
        : !mediaReady
          ? { reviewReason: item.mediaReviewReason || "PAGE_COPY_MEDIA_ENTITY_MISMATCH" }
          : {})
    };
  });
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
): MyDreamshootsPublishedPageMediaProjection | undefined {
  const pack = creativePacks.find((candidate) => (
    candidate.siteId === route.siteId
    && candidate.status === "active"
    && normalizePublishedSlug(candidate.categoryRecord?.slug || candidate.category) === route.canonicalSlug
  ));
  return buildPublishedPageMediaProjection(route, pack);
}

export function buildPublishedPageMediaProjection(
  route: MyDreamshootsPublishedRouteManifestRow,
  pack: { id: string; status: string; category?: string | null; categoryRecord?: { slug?: string | null } | null; imageUrl?: string | null; galleryImages?: string[] | null; galleryImageAlts?: string[] | null } | undefined
): MyDreamshootsPublishedPageMediaProjection | undefined {
  if (!pack) return undefined;
  const images = Array.from(new Set([pack.imageUrl, ...(pack.galleryImages ?? [])]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)));
  const categorySlug = normalizePublishedSlug(pack.categoryRecord?.slug || pack.category);
  const ownerMatches = pack.id === route.expectedPackId && categorySlug === route.canonicalSlug;
  const alts = images.map((_, index) => String(pack.galleryImageAlts?.[index] ?? "").trim());
  const altsReady = alts.length === images.length && alts.every(Boolean);
  const ready = route.status === "published" && pack.status === "active" && ownerMatches && images.length >= 2 && altsReady;
  return {
    siteId: route.siteId,
    routeKind: route.routeKind,
    canonicalSlug: route.canonicalSlug,
    canonicalPath: route.canonicalPath,
    pageEntityId: route.pageEntityId,
    mediaEntityId: publishedMediaEntityId(route.pageEntityId),
    ownerPageEntityId: route.pageEntityId,
    sourcePackId: pack.id,
    role: "hero",
    entityRevision: revision([route.pageEntityId, pack.id, images, alts]),
    packId: pack.id,
    primaryImage: images[0] ?? "",
    galleryImages: images.slice(1),
    imageAlts: alts,
    status: ready ? "ready" : "review_required",
    ...(!ready ? { reviewReason: route.reviewReason || (!ownerMatches ? "PAGE_COPY_MEDIA_ENTITY_MISMATCH" : "PAGE_MEDIA_REQUIRED") } : {})
  };
}

export function mydreamshootsPublishedPageMediaProjections(creativePacks: CreativePack[]): MyDreamshootsPublishedPageMediaProjection[] {
  return mydreamshootsPublishedRouteManifest()
    .map((route) => resolveMydreamshootsPublishedPageMedia(route, creativePacks))
    .filter((projection): projection is MyDreamshootsPublishedPageMediaProjection => Boolean(projection));
}
