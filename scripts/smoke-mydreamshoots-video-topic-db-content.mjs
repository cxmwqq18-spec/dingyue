#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

import { PrismaClient } from "@prisma/client";

const SITE_ID = process.env.SITE_ID?.trim() || "site_dreamshoot";
assertDatabaseTarget({ expectedTarget: String(process.env.DATABASE_TARGET || "local").trim().toLowerCase() });
const topicSlugs = [
  "talking-photo", "cinematic-video", "tiktok-video", "instagram-reels", "social-media-video", "youtube-video",
  "story-video", "meme-video", "product-video", "product-ad-video", "promo-video", "ugc-ad-video",
  "video-ad", "brand-video", "music-video", "fashion-video", "food-video", "pet-video", "explainer-video", "how-to-video", "talking-head-video"
];

function record(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function topicSection(pageJson, slug) {
  const sectionType = slug === "talking-photo" ? "talking_photo_landing" : "ai_video_topic_landing";
  return Object.values(pageJson.sections ?? {}).find((section) => section?.type === sectionType);
}

function topicContent(pageJson, slug) {
  const section = topicSection(pageJson, slug);
  assert(section, `${slug} must keep its dedicated landing section`);
  const content = section.settings?.content;
  assert(record(content), `${slug} must keep database topic content in its section`);
  assert(record(content.seo), `${slug} must keep SEO data in its section content`);
  assert(record(content.hero) && record(content.hero.image), `${slug} must keep hero media metadata in its section content`);
  assert(typeof content.hero.image.src === "string" && typeof content.hero.image.alt === "string", `${slug} hero image needs source and alt text`);
  assert(record(content.faq) && Array.isArray(content.faq.items) && content.faq.items.length > 0, `${slug} must keep FAQ data in its section content`);
  return content;
}

function publicationContracts() {
  const sourceRoot = path.resolve("src");
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
  try {
    const jiti = createJiti(import.meta.url);
    return {
      resolvePublishedRouteDisposition: jiti("../src/lib/storefront-context/snapshot.ts").resolvePublishedRouteDisposition,
      parsePublicVideoGenerationRouteForSite: jiti("../src/lib/photo-package-taxonomy.ts").parsePublicVideoGenerationRouteForSite,
      createPublishedSiteSnapshot: jiti("../src/lib/storefront-context/snapshot.ts").createPublishedSiteSnapshot,
      readStorefrontPublicRuntimeStateForSite: jiti("../src/lib/storefront-state.ts").readStorefrontPublicRuntimeStateForSiteFromDatabase
    };
  } finally {
    Module._resolveFilename = originalResolveFilename;
    Module._load = originalLoad;
  }
}

function assertPublishedTopicProjection(snapshot, sourcePage, slug) {
  const canonicalPath = `/ai-video-generation/${slug}`;
  const content = topicContent(sourcePage.draftJson, slug);
  const snapshotPage = snapshot.pages.find((page) => page.slug === canonicalPath);
  assert(snapshotPage, `${slug} must be included in the active publication pages`);
  assert.deepEqual(snapshotPage.publishedJson, sourcePage.draftJson, `${slug} active publication must be compiled from its database draft content`);

  const route = snapshot.publishedRoutes.find((item) => item.routeKind === "ai-video-topic-leaf" && item.canonicalPath === canonicalPath);
  assert(route, `${slug} must have a published route projection`);
  const entity = snapshot.publishedPageEntities.find((item) => item.pageEntityId === route.pageEntityId);
  assert(entity, `${slug} route must own a page entity`);
  assert.equal(entity.metadata.title, content.seo.title, `${slug} entity title must come from the published page content`);
  assert.equal(entity.metadata.description, content.seo.description, `${slug} entity description must come from the published page content`);
  assert.equal(entity.metadata.canonicalPath, content.seo.canonicalPath, `${slug} entity canonical must come from the published page content`);

  const media = snapshot.publishedPageMedia.find((item) => item.pageEntityId === route.pageEntityId);
  assert(media, `${slug} must own published media`);
  assert.equal(media.primaryImage, content.hero.image.src, `${slug} hero media must come from the published page content`);
  assert(typeof media.imageAlts[0] === "string" && media.imageAlts[0].trim().length > 0, `${slug} hero media must include alt text`);
  assert(snapshot.publishedPageCopy.some((item) => item.pageEntityId === route.pageEntityId), `${slug} must own a page-copy projection`);

  const navigation = snapshot.publishedVideoNavigation.find((item) => item.pageEntityId === route.pageEntityId);
  assert(navigation, `${slug} must be present in the published video navigation`);
  assert.equal(navigation.canonicalPath, canonicalPath, `${slug} navigation must use the canonical published route`);
  assert.equal(navigation.description, content.seo.description, `${slug} directory summary must come from published content`);

  if (["explainer-video", "how-to-video", "talking-head-video"].includes(slug)) {
    assert.equal(route.status, "review_required", `${slug} must remain review-gated until first-party evidence exists`);
    assert.equal(route.indexable, false);
    assert.equal(route.sitemapEligible, false);
    assert.equal(entity.status, "review_required");
    assert.equal(entity.indexable, false);
    assert.equal(entity.sitemapEligible, false);
    assert.equal(entity.reviewReasons.includes("FIRST_PARTY_PRODUCT_EVIDENCE_REQUIRED"), true);
    assert.equal(media.status, "review_required");
    return;
  }
  assert(route.status === "published" && route.indexable && route.sitemapEligible, `${slug} must have an indexable published route`);
  assert.equal(entity.status, "published");
  assert.equal(media.status, "ready");
  const links = snapshot.publishedLinkRefs.filter((item) => item.ownerPageEntityId === route.pageEntityId);
  assert(links.some((item) => item.kind === "cta" && item.targetType === "private_action"), `${slug} must own a validated CTA link`);
  assert.equal(links.filter((item) => item.kind === "related" && item.targetType === "published_render").length, 2, `${slug} must own two validated related links`);
}

const repoRoot = process.cwd();
const landingSource = fs.readFileSync(path.join(repoRoot, "src/components/storefront/video-topic-landing.tsx"), "utf8");
const jsonLdSource = fs.readFileSync(path.join(repoRoot, "src/lib/theme/json-ld.ts"), "utf8");
const directorySource = fs.readFileSync(path.join(repoRoot, "src/components/theme-renderer.tsx"), "utf8");
const renderSource = fs.readFileSync(path.join(repoRoot, "src/lib/storefront-render.tsx"), "utf8");
const routeSource = fs.readFileSync(path.join(repoRoot, "src/app/[...path]/page.tsx"), "utf8");
const syncSource = fs.readFileSync(path.join(repoRoot, "scripts/sync-mydreamshoots-video-topic-pages.mjs"), "utf8");
assert.match(landingSource, /aiVideoTopicLandingContentFromSection/, "video topic renderer must read section content from the publication page");
assert.doesNotMatch(landingSource, /aiVideoTopicLandingContentByKey/, "video topic renderer must not use a frontend topic-content map");
assert.match(jsonLdSource, /aiVideoTopicLandingContentFromSection/, "video topic FAQ JSON-LD must read the publication page section content");
assert.doesNotMatch(jsonLdSource, /aiVideoTopicLandingContentByKey/, "video topic JSON-LD must not use a frontend topic-content map");
assert.match(directorySource, /topic\.description/, "video directory cards must consume the published navigation description");
assert.doesNotMatch(directorySource, /topicDescriptions/, "video directory cards must not use a frontend description map");
assert.doesNotMatch(directorySource, /Open this AI video theme guide/, "video directory cards must not use static topic copy fallbacks");
assert.match(renderSource, /publishedVideoGenerationTopics/, "public video navigation must be derived from the immutable publication snapshot");
assert.match(routeSource, /resolvePublishedRouteDisposition/, "public video routes must resolve from the immutable publication snapshot");
assert.doesNotMatch(routeSource, /getVideoThemeSlugRedirectRelational/, "public video routes must not use relational redirect fallbacks");
assert.match(syncSource, /draftJson:\s*toPrismaJson\(page\.draftJson\)/, "video sync must write editable content only to ThemePage draftJson");
assert.doesNotMatch(syncSource, /publishedJson:\s*toPrismaJson\(page\.(?:draftJson|publishedJson)/, "video sync must not write public content directly to ThemePage publishedJson");

const prisma = new PrismaClient();
try {
  const {
    resolvePublishedRouteDisposition,
    parsePublicVideoGenerationRouteForSite,
    createPublishedSiteSnapshot,
    readStorefrontPublicRuntimeStateForSite
  } = publicationContracts();
  const liveState = await readStorefrontPublicRuntimeStateForSite(SITE_ID);
  const liveSite = liveState?.sites.find((site) => site.id === SITE_ID);
  assert(liveState && liveSite, "MyDreamShoots must have a live relational storefront state");
  const snapshot = createPublishedSiteSnapshot(liveState, liveSite, { source: "postgres" });
  assert.equal(snapshot.snapshotIntegrity, "valid", "live relational storefront projection must satisfy the snapshot contract");
  const videoDirectoryPage = snapshot.pages.find((page) => page.slug === "/ai-video-generation");
  assert(videoDirectoryPage, "AI Video Generation root must be included in the active publication pages");
  assert.deepEqual(videoDirectoryPage.publishedJson.sectionsOrder, ["video_theme_directory_1"], "AI Video Generation root must publish the dedicated directory section");
  assert.equal(videoDirectoryPage.publishedJson.sections.video_theme_directory_1?.settings?.layout, "video_theme_grid", "AI Video Generation root must publish the video theme grid layout");
  const routeSnapshot = {
    site: { id: SITE_ID, slug: "mydreamshoots" },
    pages: snapshot.pages,
    publishedRoutes: snapshot.publishedRoutes
  };

  const pages = await prisma.themePage.findMany({
    where: { siteId: SITE_ID, slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } },
    select: { id: true, slug: true, draftJson: true },
    orderBy: { slug: "asc" }
  });
  const themes = await prisma.videoTheme.findMany({
    where: { siteId: SITE_ID, slug: { in: topicSlugs } },
    select: { slug: true, imageUrl: true, galleryImages: true },
  });
  assert.equal(themes.length, topicSlugs.length, "every public video topic must have a database VideoTheme cover");
  const themeBySlug = new Map(themes.map((theme) => [theme.slug, theme]));
  const coverOwners = new Map();
  const mediaOwners = new Map();
  assert.equal(pages.length, topicSlugs.length, "every public video topic must have a database ThemePage draft");
  const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
  for (const slug of topicSlugs) {
    const page = pageBySlug.get(`/ai-video-generation/${slug}`);
    assert(page, `missing ThemePage draft for ${slug}`);
    const content = topicContent(page.draftJson, slug);
    const theme = themeBySlug.get(slug);
    assert(theme, `missing VideoTheme for ${slug}`);
    assert.equal(theme.imageUrl, content.hero.image.src, `${slug} directory/detail/theme covers must use one image`);
    if (Array.isArray(content.hero.images) && content.hero.images.length > 0) {
      assert.equal(content.hero.images[0].src, content.hero.image.src, `${slug} detail hero carousel must start with its cover`);
    }
    if (theme.imageUrl) {
      const owners = coverOwners.get(theme.imageUrl) ?? [];
      owners.push(slug);
      coverOwners.set(theme.imageUrl, owners);
    }
    for (const imageUrl of [theme.imageUrl, ...(Array.isArray(theme.galleryImages) ? theme.galleryImages : [])].filter((value) => typeof value === "string" && value.trim().length > 0)) {
      const owners = mediaOwners.get(imageUrl) ?? [];
      owners.push(slug);
      mediaOwners.set(imageUrl, owners);
    }
    assertPublishedTopicProjection(snapshot, page, slug);
    const canonicalPath = `/ai-video-generation/${slug}`;
    const parsedRoute = parsePublicVideoGenerationRouteForSite(routeSnapshot.site, canonicalPath);
    assert.equal(parsedRoute?.canonicalPath, canonicalPath, `${slug} must be accepted by the public video route parser`);
    const disposition = resolvePublishedRouteDisposition(routeSnapshot, canonicalPath);
    assert.equal(disposition.kind, "render", `${slug} must render when linked from published video navigation`);
    assert.equal(disposition.status, 200, `${slug} must resolve with HTTP 200 when linked from published video navigation`);
  }
  assert([...coverOwners.values()].every((owners) => owners.length === 1), "video topic cover images must not be reused across themes");
  assert([...mediaOwners.values()].every((owners) => new Set(owners).size === 1), "video topic gallery media must not be reused across themes");
  console.log(JSON.stringify({
    ok: true,
    siteId: SITE_ID,
    publicationId: snapshot.publicationId,
    version: snapshot.publicationVersion,
    checkedTopics: topicSlugs.length
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
