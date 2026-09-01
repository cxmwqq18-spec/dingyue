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

export function resolveWeddingInvitationTopicContent(page: Pick<ThemePage, "slug" | "title" | "draftJson">, canonicalPath = page.slug): AiVideoTopicLandingContent | undefined {
  if (page.slug !== "/ai-video-generation/wedding-invitation") return undefined;
  const dedicated = dedicatedVideoTopicContentFromPageJson(page.draftJson);
  if (dedicated && "foundation" in dedicated && "guidance" in dedicated) {
    return {
      ...dedicated,
      seo: {
        ...dedicated.seo,
        canonicalPath
      }
    };
  }
  const seo = page.draftJson.seo ?? {};
  const entry = Object.values(page.draftJson.sections ?? {}).find((section) => section.type === "ai_tool_entry")?.settings ?? {};
  const imageUrl = typeof entry.imageUrl === "string" && entry.imageUrl.trim()
    ? entry.imageUrl
    : "/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-couple-reviewing.jpg";
  const title = typeof seo.title === "string" && seo.title.trim() ? seo.title : page.title || "Wedding Invitation";
  const description = typeof seo.description === "string" && seo.description.trim()
    ? seo.description
    : "Create a private wedding invitation reveal video with readable names, dates, venue details, and paper texture.";
  const image = { src: imageUrl, alt: "Couple reviewing wedding invitation cards at a reception table.", width: 1800, height: 1200 };
  return {
    seo: { title, description, keywords: typeof seo.keywords === "string" ? seo.keywords : "AI wedding invitation video maker, wedding invitation reveal video, save the date video", canonicalPath },
    hero: { eyebrow: "AI VIDEO THEME", title: "Create a Wedding Invitation Reveal Video", body: description, primaryCta: "Create Wedding Invitation Video", secondaryCta: "Browse AI Video Generation", availabilityNote: "Private workspace review before sharing.", rightsCopy: "Use invitation artwork and event details you own or have permission to use.", imageNote: "Keep names, dates, venue details, and supplied wording readable.", image },
    useCases: { eyebrow: "INVITATION VIDEO JOBS", title: "Turn Stationery Into a Clear Event Moment", intro: "Build a short reveal around the details guests need to see.", items: [
      { title: "Invitation suite reveal", body: "Show the envelope, card, liner, seal, and complete suite in a readable sequence.", problem: "Guests need the full invitation context.", cta: "Reveal the suite", image },
      { title: "Save-the-date announcement", body: "Lead with the couple names and event date, then finish on the approved design.", problem: "The date should remain the visual anchor.", cta: "Create a save-the-date", image },
      { title: "Private guest preview", body: "Review the finished video privately before sending it to guests or posting it.", problem: "Details must be checked before sharing.", cta: "Review a private draft", image }
    ] },
    foundation: { eyebrow: "START WITH ACCURATE DETAILS", title: "Give the Reveal a Reliable Source", intro: "Use approved artwork and exact event information.", leftTitle: "Provide", leftItems: ["Approved invitation artwork", "Exact names, date, and venue", "Preferred pacing and visual direction"], rightTitle: "Check", rightItems: ["Text remains unchanged", "Paper and print details stay legible", "No unsupported event details are added"], expertTip: "Treat the supplied invitation as the source of truth." },
    guidance: { eyebrow: "REVEAL DIRECTION", title: "Let Material Detail Carry the Story", intro: "Use movement to reveal paper, print, ribbon, seal, and final wording.", cards: [{ title: "Envelope to card", body: "Open with the envelope, then reveal the main card in reading order." }, { title: "Macro paper detail", body: "Use a close view for embossing, ink, fiber, or foil without glare." }, { title: "Complete suite", body: "End with the full approved suite visible and correctly arranged." }] },
    steps: { eyebrow: "HOW IT WORKS", title: "From Approved Suite to Private Draft", items: [{ title: "Upload the source", body: "Add invitation artwork or reference photos you can use." }, { title: "Add exact event text", body: "Provide the couple names, date, venue, and wording that must stay accurate." }, { title: "Choose the reveal", body: "Set the pacing and visual direction for the stationery sequence." }, { title: "Review before sharing", body: "Check every name, date, venue detail, crop, and final frame." }], cta: "Create Wedding Invitation Video" },
    value: { eyebrow: "PRIVATE REVIEW", title: "Make Every Detail Easy to Verify", intro: "A focused reveal helps guests read the information that matters.", items: [{ title: "Readable details", body: "Keep names, date, venue, and supplied wording clear." }, { title: "Tactile material", body: "Use paper texture, embossing, ribbon, and seal as visual anchors." }, { title: "Confident sharing", body: "Review the finished draft privately before sending it." }] },
    trust: { eyebrow: "RESPONSIBLE USE", title: "Keep the Invitation Accurate", intro: "Before sharing:", items: [{ title: "Use approved artwork", body: "Only upload invitation designs and references you own or have permission to use." }, { title: "Check every event detail", body: "Verify names, dates, venue, addresses, and wording against the approved source." }, { title: "Do not invent information", body: "Do not add unsupported times, locations, hosts, dress codes, or registry details." }] },
    faq: { eyebrow: "FAQ", title: "Wedding Invitation Video Questions", items: [{ question: "What should I upload?", answer: "Use clear photos or artwork of the approved invitation suite and provide the exact event details." }, { question: "Can the names and date change?", answer: "They should remain exactly as supplied. Review the finished video before sharing." }, { question: "Can I share the video with guests?", answer: "Yes, after checking the private draft for readable and accurate event information." }, { question: "What makes a good reveal?", answer: "A clear sequence from envelope to card to complete suite, with paper details and wording easy to read." }] },
    finalCta: { eyebrow: "CREATE WITH APPROVED DETAILS", title: "Build a Wedding Invitation Reveal", body: "Turn your approved invitation suite into a short, readable video and review it privately before sharing.", cta: "Create Wedding Invitation Video", microcopy: "Approved source. Readable details. Private review." }
  };
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
    const content = dedicatedVideoTopicContentFromPageJson(page.draftJson) ?? resolveWeddingInvitationTopicContent(page);
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
  if (src && alt && !/\.(?:mp4|webm)(?:[?#]|$)/i.test(src) && !output.some((image) => image.src === src)) {
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

function topicVideoUrl(content: VideoTopicContent): string | undefined {
  const video = content.hero.video;
  return video && /\.(?:mp4|webm)(?:[?#]|$)/i.test(video.src) ? video.src : undefined;
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
    const orderedImages = [
      {
        src: hero.src,
        alt: storefrontSourceImageAlt({ imageUrl: hero.src, fallback: hero.alt })
      },
      ...images.filter((image) => image.src !== hero.src)
    ];
    const content = pageEntityContent(source);
    const pageRevision = revision(source.page.draftJson);
    const copyRevision = revision(content);
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
        robots: { index: true, follow: true }
      },
      content,
      mediaEntityId: media.mediaEntityId,
      pageRevision,
      copyRevision,
      reviewReasons: []
    };
    const ready = topicReady(entity, media);
    const status = ready ? "published" as const : "review_required" as const;
    const reviewReason = ready ? undefined : "VIDEO_TOPIC_CONTENT_OR_MEDIA_REQUIRED";
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
    const videoUrl = topicVideoUrl(source.content);
    navigation.push({
      id: source.page.id,
      pageEntityId: entityId,
      canonicalPath,
      slug: source.slug,
      label: topicLabel(source),
      description: finalizedEntity.metadata.description,
      imageUrl: finalizedMedia.primaryImage,
      ...(videoUrl ? { videoUrl } : {}),
      ...parent,
      sortOrder: topicSortOrder(source.slug),
      revision: revision([source.page.id, source.slug, topicLabel(source), finalizedEntity.metadata.description, finalizedMedia.primaryImage, videoUrl, parent, topicSortOrder(source.slug)])
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
