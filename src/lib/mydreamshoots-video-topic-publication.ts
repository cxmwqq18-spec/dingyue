import crypto from "node:crypto";

import { aiVideoTopicLandingContentFromSection, type AiVideoTopicLandingContent } from "@/lib/ai-video-topic-content";
import {
  isMydreamshootsPublicVideoGenerationTopicSlug,
  mydreamshootsVideoGenerationCategories,
  mydreamshootsVideoGenerationParentCategories,
  parentVideoGenerationCategorySlugForChild
} from "@/lib/mydreamshoots-video-framework";
import { talkingPhotoContentFromSection, type TalkingPhotoContent } from "@/lib/talking-photo-content";
import { mydreamshootsKeywordsForPath } from "@/lib/mydreamshoots-tdk";
import { storefrontSourceImageAlt } from "@/lib/storefront-media-alt";
import type {
  PublishedLinkRef,
  PublishedPageCopyProjection,
  PublishedPageEntityContent,
  PublishedPageEntityProjection,
  PublishedPageMediaProjection,
  PublishedRouteProjection,
  PublishedSeoSnapshot,
  PublishedVideoNavigationProjection,
  ThemePage,
  ThemePageJson
} from "@/lib/types";

type VideoTopicContent = AiVideoTopicLandingContent | TalkingPhotoContent;

export type MyDreamshootsVideoTopicPublication = {
  routes: PublishedRouteProjection[];
  pageEntities: PublishedPageEntityProjection[];
  pageCopy: PublishedPageCopyProjection[];
  pageMedia: PublishedPageMediaProjection[];
  linkRefs: PublishedLinkRef[];
  navigation: PublishedVideoNavigationProjection[];
};

type TopicSource = {
  page: Pick<ThemePage, "id" | "pageType" | "slug" | "title" | "draftJson" | "publishedJson">;
  slug: string;
  content: VideoTopicContent;
};

type TopicImage = {
  src: string;
  alt: string;
};

const videoTopicReviewRequiredSlugs = new Set(["explainer-video", "how-to-video", "talking-head-video"]);

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stable(item)]));
}

function revision(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 20);
}

function sourceHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function textList(values: Array<string | undefined>, fallback: string): string[] {
  const unique = Array.from(new Set(values.map((value) => text(value)).filter(Boolean)));
  while (unique.length < 3 && fallback) unique.push(fallback);
  return unique.slice(0, Math.max(3, unique.length));
}

function keyForSlug(slug: string): string {
  return slug.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function pageEntityId(slug: string): string {
  return `mydreamshoots:video-topic:${keyForSlug(slug)}`;
}

function mediaEntityId(slug: string): string {
  return `${pageEntityId(slug)}:media`;
}

function linkEntityId(slug: string, kind: "cta" | "related", index?: number): string {
  return `${pageEntityId(slug)}:link:${kind}${typeof index === "number" ? `:${index}` : ""}`;
}

function isPublicVideoTopicPath(path: string): boolean {
  const match = path.match(/^\/ai-video-generation\/([^/?#]+)$/);
  return Boolean(match && isMydreamshootsPublicVideoGenerationTopicSlug(match[1]));
}

export function dedicatedVideoTopicContentFromPageJson(pageJson: ThemePageJson): VideoTopicContent | undefined {
  for (const sectionId of pageJson.sectionsOrder) {
    const section = pageJson.sections[sectionId];
    if (section?.type === "ai_video_topic_landing") {
      const content = aiVideoTopicLandingContentFromSection(section);
      if (content) return content;
    }
    if (section?.type === "talking_photo_landing") {
      const content = talkingPhotoContentFromSection(section);
      if (content) return content;
    }
  }
  return undefined;
}

export function isDedicatedMydreamshootsVideoTopicPage(page: Pick<ThemePage, "slug" | "draftJson" | "publishedJson">): boolean {
  return isPublicVideoTopicPath(page.slug) && Boolean(dedicatedVideoTopicContentFromPageJson(page.draftJson));
}

function sourcesFromPages(pages: Array<Pick<ThemePage, "id" | "pageType" | "slug" | "title" | "draftJson" | "publishedJson">>): TopicSource[] {
  return pages.flatMap((page) => {
    if (!isPublicVideoTopicPath(page.slug)) return [];
    const slug = page.slug.slice("/ai-video-generation/".length);
    const content = dedicatedVideoTopicContentFromPageJson(page.draftJson);
    return content ? [{ page, slug, content }] : [];
  });
}

function topicImages(value: unknown, output: TopicImage[] = []): TopicImage[] {
  if (Array.isArray(value)) {
    value.forEach((item) => topicImages(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const record = value as Record<string, unknown>;
  const src = text(record.src);
  const alt = text(record.alt);
  if (src && alt && !output.some((image) => image.src === src)) {
    output.push({ src, alt: storefrontSourceImageAlt({ imageUrl: src, fallback: alt }) });
  }
  Object.values(record).forEach((item) => topicImages(item, output));
  return output;
}

function isAiTopic(content: VideoTopicContent): content is AiVideoTopicLandingContent {
  return "foundation" in content && "guidance" in content;
}

function contentItems(items: Array<{ title: string; body: string }> | undefined): string[] {
  return (items ?? []).map((item) => text(item.title) || text(item.body)).filter(Boolean);
}

function pageEntityContent(source: TopicSource): PublishedPageEntityContent {
  const { content, slug } = source;
  const image = content.hero.image;
  const useCases = content.useCases.items;
  const faqItems = content.faq.items.map((item, index) => ({
    id: `${keyForSlug(slug)}-faq-${index + 1}`,
    question: text(item.question),
    answer: text(item.answer)
  }));
  // Review-required topic drafts still need a schema-valid immutable entity.
  // These explicit review questions are non-indexable placeholders; they are
  // never exposed as public copy until the source package supplies real FAQs.
  while (faqItems.length < 4) {
    const index = faqItems.length + 1;
    faqItems.push({
      id: `${keyForSlug(slug)}-faq-review-${index}`,
      question: "What is still under review on this video page?",
      answer: "This page remains unavailable for indexing until its first-party content and evidence package is complete."
    });
  }
  const common = {
    h1: text(content.hero.title),
    heroIntro: text(content.hero.body),
    metaLabel: text(content.hero.eyebrow),
    tags: text(content.seo.keywords).split(",").map((item) => item.trim()).filter(Boolean),
    detailTags: textList(useCases.map((item) => item.title), text(content.hero.title)),
    detailIntro: text(content.useCases.intro),
    whatCreates: text(content.useCases.title),
    bestFor: textList(useCases.map((item) => item.problem || item.body || item.title), text(content.hero.body)),
    workflow: textList(contentItems(content.steps.items), text(content.steps.title)),
    coverNote: text(("imageNote" in content.hero ? content.hero.imageNote : content.hero.caption) || content.hero.rightsCopy || image.alt),
    safetyNote: text(content.hero.rightsCopy),
    galleryTitle: text(("gallery" in content && content.gallery?.title) || content.useCases.title),
    galleryIntro: text(("gallery" in content && content.gallery?.intro) || content.useCases.intro),
    ctaEyebrow: text(content.finalCta.eyebrow),
    ctaTitle: text(content.finalCta.title),
    ctaSubtitle: text(content.finalCta.body),
    ctaLinkEntityId: linkEntityId(slug, "cta"),
    faqEyebrow: text(content.faq.eyebrow),
    faqTitle: text(content.faq.title),
    faqItems,
    relatedEyebrow: text(content.finalCta.eyebrow),
    relatedTitle: text(content.value.title),
    relatedSubtitle: text(("intro" in content.value ? content.value.intro : undefined) || content.hero.body),
    relatedCtaLabel: text(content.finalCta.cta),
    relatedLinkEntityIds: []
  };
  if (isAiTopic(content)) {
    return {
      ...common,
      styleNotes: textList([
        ...content.guidance.cards.map((item) => item.title || item.body),
        ...(content.foundation.cards ?? []).map((item) => item.title || item.body),
        content.foundation.expertTip
      ], text(content.foundation.title)),
      reviewCriteria: textList(contentItems(content.trust.items), text(content.trust.title))
    };
  }
  return {
    ...common,
    styleNotes: textList([
      ...content.script.rules.map((item) => item.title || item.body),
      ...content.sourcePhoto.useItems,
      content.sourcePhoto.expertTip
    ], text(content.script.title)),
    reviewCriteria: textList(contentItems(content.trust.items), text(content.trust.title))
  };
}

function parentForSlug(slug: string) {
  const parentSlug = parentVideoGenerationCategorySlugForChild(slug) ?? "ai-video-generation";
  const parent = mydreamshootsVideoGenerationParentCategories.find((candidate) => candidate.slug === parentSlug);
  return {
    parentSlug,
    parentLabel: parent?.label ?? "AI Video Generation",
    parentSortOrder: parent?.sortOrder ?? 999
  };
}

function topicSortOrder(slug: string): number {
  return mydreamshootsVideoGenerationCategories.find((candidate) => candidate.slug === slug)?.sortOrder ?? 999;
}

function topicLabel(source: TopicSource): string {
  return text(source.page.title) || text(source.content.hero.title) || source.slug;
}

function topicReady(entity: PublishedPageEntityProjection, media: PublishedPageMediaProjection): boolean {
  const content = entity.content;
  return Boolean(
    entity.canonicalPath && entity.metadata.title && entity.metadata.description &&
    content.h1 && content.heroIntro && content.tags.length && content.detailTags.length &&
    content.bestFor.length >= 3 && content.workflow.length >= 3 && content.styleNotes.length >= 3 &&
    content.reviewCriteria.length >= 3 && content.faqItems.length >= 4 && media.primaryImage && media.imageAlts.every(Boolean)
  );
}

/**
 * Compile the only SEO/runtime projection for published MyDreamShoots video
 * topic pages. The source is ThemePage draft content; callers publish this
 * output as part of an immutable ThemePublication snapshot.
 */
export function compileMydreamshootsVideoTopicPublication(
  pages: Array<Pick<ThemePage, "id" | "pageType" | "slug" | "title" | "draftJson" | "publishedJson">>,
  siteId: "site_dreamshoot" | "site_grownstride_test" = "site_dreamshoot"
): MyDreamshootsVideoTopicPublication {
  const sources = sourcesFromPages(pages)
    .sort((left, right) => topicSortOrder(left.slug) - topicSortOrder(right.slug) || left.slug.localeCompare(right.slug));
  const pageEntities: PublishedPageEntityProjection[] = [];
  const pageMedia: PublishedPageMediaProjection[] = [];
  const routes: PublishedRouteProjection[] = [];
  const pageCopy: PublishedPageCopyProjection[] = [];
  const navigation: PublishedVideoNavigationProjection[] = [];

  for (const source of sources) {
    const canonicalPath = source.content.seo.canonicalPath;
    if (canonicalPath !== source.page.slug) continue;
    const entityId = pageEntityId(source.slug);
    const images = topicImages(source.content);
    const hero = source.content.hero.image;
    const orderedImages = [{ src: hero.src, alt: hero.alt }, ...images.filter((image) => image.src !== hero.src)];
    const content = pageEntityContent(source);
    const pageRevision = revision(source.page.draftJson);
    const copyRevision = revision(content);
    const sourceSeo = source.page.draftJson.seo ?? {};
    const sourceIndexable = sourceSeo.index !== false && sourceSeo.robots?.index !== false;
    const media: PublishedPageMediaProjection = {
      mediaEntityId: mediaEntityId(source.slug),
      ownerPageEntityId: entityId,
      sourcePackId: source.page.id,
      role: "hero",
      routeKind: "ai-video-topic-leaf",
      pageEntityId: entityId,
      entityRevision: revision(orderedImages),
      packId: source.page.id,
      primaryImage: hero.src,
      galleryImages: orderedImages.slice(1).map((image) => image.src),
      imageAlts: orderedImages.map((image) => image.alt),
      status: "ready"
    };
    const entity: PublishedPageEntityProjection = {
      pageEntityId: entityId,
      canonicalPath,
      pageType: "ai-video-topic-leaf",
      status: "published",
      indexable: true,
      sitemapEligible: true,
      metadata: {
        title: source.content.seo.title,
        description: source.content.seo.description,
        keywords: mydreamshootsKeywordsForPath(canonicalPath, source.content.seo.title, source.content.seo.description),
        canonicalPath,
        robots: { index: sourceIndexable, follow: true }
      },
      content,
      mediaEntityId: media.mediaEntityId,
      pageRevision,
      copyRevision,
      reviewReasons: []
    };
    const ready = topicReady(entity, media) && sourceIndexable && !videoTopicReviewRequiredSlugs.has(source.slug);
    const status = ready ? "published" as const : "review_required" as const;
    const reviewReason = ready ? undefined : videoTopicReviewRequiredSlugs.has(source.slug)
      ? "FIRST_PARTY_PRODUCT_EVIDENCE_REQUIRED"
      : sourceIndexable
        ? "VIDEO_TOPIC_CONTENT_OR_MEDIA_REQUIRED"
        : "PAGE_SEO_REVIEW_REQUIRED";
    const finalizedEntity: PublishedPageEntityProjection = ready ? entity : {
      ...entity,
      status,
      indexable: false,
      sitemapEligible: false,
      metadata: { ...entity.metadata, robots: { index: false, follow: true } },
      reviewReasons: [reviewReason!]
    };
    const finalizedMedia: PublishedPageMediaProjection = ready ? media : {
      ...media,
      status: "review_required",
      reviewReason
    };
    pageEntities.push(finalizedEntity);
    pageMedia.push(finalizedMedia);
    routes.push({
      disposition: "render",
      siteId,
      routeKind: "ai-video-topic-leaf",
      canonicalSlug: source.slug,
      canonicalPath,
      pageId: source.page.id,
      pageEntityId: entityId,
      pageRevision,
      copyRevision,
      copySource: "theme-page",
      fallbackUsed: false,
      deferred: false,
      status,
      indexable: ready,
      sitemapEligible: ready,
      mediaEntityId: finalizedMedia.mediaEntityId,
      ...(reviewReason ? { reviewReason } : {})
    });
    pageCopy.push({
      pageEntityId: entityId,
      copyRevision,
      canonicalSlug: source.slug,
      sourceHash: sourceHash(source.content)
    });
    const parent = parentForSlug(source.slug);
    navigation.push({
      id: source.page.id,
      pageEntityId: entityId,
      canonicalPath,
      slug: source.slug,
      label: topicLabel(source),
      description: finalizedEntity.metadata.description,
      imageUrl: finalizedMedia.primaryImage,
      ...parent,
      sortOrder: topicSortOrder(source.slug),
      revision: revision([source.page.id, source.slug, topicLabel(source), finalizedEntity.metadata.description, finalizedMedia.primaryImage, parent, topicSortOrder(source.slug)])
    });
  }

  const linkRefs: PublishedLinkRef[] = [];
  for (const entity of pageEntities) {
    if (entity.status !== "published") continue;
    const slug = entity.canonicalPath.slice("/ai-video-generation/".length);
    const ctaHref = `/app/create?videoMode=${encodeURIComponent(slug)}#step-video`;
    linkRefs.push({
      linkEntityId: linkEntityId(slug, "cta"),
      ownerPageEntityId: entity.pageEntityId,
      kind: "cta",
      targetType: "private_action",
      label: entity.content.relatedCtaLabel,
      href: ctaHref,
      revision: revision([entity.pageEntityId, "cta", entity.content.relatedCtaLabel, ctaHref])
    });
    const relatedTargets = pageEntities
      .filter((candidate) => candidate.status === "published" && candidate.pageEntityId !== entity.pageEntityId)
      .sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath))
      .slice(0, 2);
    const relatedIds = relatedTargets.map((target, index) => {
      const id = linkEntityId(slug, "related", index);
      linkRefs.push({
        linkEntityId: id,
        ownerPageEntityId: entity.pageEntityId,
        kind: "related",
        targetType: "published_render",
        targetPageEntityId: target.pageEntityId,
        label: target.content.h1,
        href: target.canonicalPath,
        revision: revision([entity.pageEntityId, target.pageEntityId, "related", target.content.h1, target.canonicalPath])
      });
      return id;
    });
    entity.content.relatedLinkEntityIds = relatedIds;
  }

  return { routes, pageEntities, pageCopy, pageMedia, linkRefs, navigation };
}

/**
 * Recompile just the video-topic projection after a draft-only topic sync.
 * This preserves the separately compiled image, policy, pricing, and fact
 * projections already present in the immutable snapshot.
 */
export function applyMydreamshootsVideoTopicPublication(
  snapshot: PublishedSeoSnapshot,
  siteId: "site_dreamshoot" | "site_grownstride_test" = "site_dreamshoot"
): PublishedSeoSnapshot {
  const pages = snapshot.pages.map((page) => ({
    id: page.id,
    pageType: page.pageType ?? "page",
    slug: page.slug,
    title: page.title ?? page.slug,
    draftJson: page.publishedJson,
    publishedJson: page.publishedJson
  }));
  const video = compileMydreamshootsVideoTopicPublication(pages, siteId);
  const isVideoEntity = (pageEntityId: string) => pageEntityId.startsWith("mydreamshoots:video-topic:");
  const publishedRoutes = [
    ...snapshot.publishedRoutes.filter((route) => route.routeKind !== "ai-video-topic-leaf"),
    ...video.routes
  ];
  const publishedPageEntities = [
    ...snapshot.publishedPageEntities.filter((entity) => !isVideoEntity(entity.pageEntityId)),
    ...video.pageEntities
  ];
  const publishedPageCopy = [
    ...snapshot.publishedPageCopy.filter((copy) => !isVideoEntity(copy.pageEntityId)),
    ...video.pageCopy
  ];
  const publishedPageMedia = [
    ...snapshot.publishedPageMedia.filter((media) => !isVideoEntity(media.pageEntityId)),
    ...video.pageMedia
  ];
  const publishedLinkRefs = [
    ...snapshot.publishedLinkRefs.filter((link) => !isVideoEntity(link.ownerPageEntityId)),
    ...video.linkRefs
  ];
  return {
    ...snapshot,
    publishedRoutes,
    publishedPageEntities,
    publishedPageCopy,
    publishedPageMedia,
    publishedLinkRefs,
    publishedVideoNavigation: video.navigation,
    revisions: {
      ...snapshot.revisions,
      routeRevision: revision(publishedRoutes),
      pageRevision: revision(publishedPageEntities),
      copyRevision: revision(publishedPageCopy),
      mediaRevision: revision({ leaf: publishedPageMedia, standard: snapshot.publishedStandardPageMedia }),
      linkRevision: revision(publishedLinkRefs),
      navigationRevision: revision(video.navigation)
    }
  };
}
