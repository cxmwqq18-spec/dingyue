#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const CONFIRMATION = "aidreamcapes-seo-content-cluster";
const BACKUP_ROOT = path.resolve("releases/backups/aidreamcapes");
const IMAGE_ROOT = "/assets/sites/site_aidreamcapes/public-editorial/20260918-v1";
const BLOG_HOME_SLUG = "/blog";
const BLOG_HOME_TITLE = "AI image and video guides";
const BLOG_HOME_SEO = {
  title: "AI Ecommerce, UGC & Talking Photo Guides | Aidreamcapes",
  description: "Practical guides for AI product photography, UGC video ads, talking photos, ecommerce workflows, video review, and safe AI content publishing.",
  keywords: "AI ecommerce guides, AI product photography, UGC video ads, talking photo video, AI content review"
};

const ARTICLES = [
  {
    slug: "/blog/ai-product-photography-guide",
    title: "AI Product Photography Workflow for Ecommerce | Aidreamcapes",
    description: "Learn how to plan AI product photography for ecommerce with a clear brief, clean source image, useful scene direction, and a review step before publishing.",
    keywords: "AI product photography, ecommerce product photos, product image workflow, AI ecommerce images",
    imageUrl: `${IMAGE_ROOT}/blog-upload-prep.png`,
    imageAlt: "A product photo brief and source image prepared for an ecommerce workflow.",
    summary: "A practical workflow for planning product photos that stay clear, consistent, and useful across product pages, ads, and campaigns.",
    entityName: "AI product photography workflow",
    userIntent: "Plan an ecommerce product photography workflow before creating or publishing AI images.",
    targetHref: "/ai-image-generation/ecommerce-main-image",
    targetLabel: "Open Ecommerce Main Image",
    primaryCta: "Start with a product image",
    primaryHref: "/ai-image-generation/ecommerce-main-image",
    relatedLinks: [
      ["/ai-image-generation/ecommerce-main-image", "Create an ecommerce main image"],
      ["/ai-image-generation/lifestyle-scene", "Explore lifestyle scenes"],
      ["/ai-image-generation/packaging-mockup", "Plan packaging mockups"]
    ],
    tags: "AI product photography|Ecommerce images|Product page workflow|Image review",
    body: "<p>AI product photography works best when the source image, scene direction, and publishing goal are decided before generation. Use this workflow for product pages, marketplace images, paid ads, and launch campaigns.</p><h2 id=\"product-photo-brief\">Start with the product brief</h2><p>Write down the product name, must-show details, intended crop, background preference, and where the image will appear. Keep claims and packaging text tied to approved product information so the generated image does not invent a feature or label.</p><h2 id=\"product-photo-source\">Prepare a clean source image</h2><p>Use a sharp reference with readable edges, materials, color, and scale. Remove unrelated objects from the frame and check that you have permission to use the product image. A focused source gives the image workflow fewer details to guess.</p><h2 id=\"product-photo-review\">Review for shopping accuracy</h2><ul><li>Compare shape, color, material, and important product details.</li><li>Check that hands, props, shadows, and reflections do not hide the product.</li><li>Review crop, contrast, and mobile readability.</li><li>Remove invented claims, logos, or text before publishing.</li></ul><p>Use the related Aidreamcapes tools to build the image set, then keep the approved source and final review notes with the campaign.</p>",
    readMinutes: "6"
  },
  {
    slug: "/blog/ai-ugc-video-ads-guide",
    title: "AI UGC Video Ads: A Review-Ready Workflow | Aidreamcapes",
    description: "Plan AI UGC video ads with a clear hook, approved product facts, creator-style scenes, and a review checklist for claims, pacing, captions, and delivery.",
    keywords: "AI UGC video ads, creator-style ads, product video ads, UGC ad review",
    imageUrl: `${IMAGE_ROOT}/creators-channel-studio.png`,
    imageAlt: "A creator-style video ad plan with product notes and a review checklist.",
    summary: "Build creator-style ad concepts with a clear hook, controlled product claims, and a review pass before a video reaches a paid campaign.",
    entityName: "AI UGC video ad workflow",
    userIntent: "Plan and review a creator-style AI video ad before publishing it to a campaign.",
    targetHref: "/ai-video-generation/ugc-ad-video",
    targetLabel: "Open UGC Ad Video",
    primaryCta: "Create a UGC ad concept",
    primaryHref: "/ai-video-generation/ugc-ad-video",
    relatedLinks: [
      ["/ai-video-generation/ugc-ad-video", "Create a UGC ad video"],
      ["/ai-video-generation/product-ad-video", "Build a product ad"],
      ["/ai-video-generation/tiktok-video", "Plan a vertical social video"]
    ],
    tags: "AI UGC ads|Video advertising|Creator-style content|Ad review",
    body: "<p>AI UGC video ads need the same discipline as other campaign creative: a useful hook, approved product facts, and a reviewable final cut. Use this guide to keep the creator-style treatment persuasive without losing control of what the ad claims.</p><h2 id=\"ugc-ad-hook\">Write one clear opening hook</h2><p>Choose one audience problem or product moment for the first seconds. Keep the opening specific enough to understand without sound, and avoid promises that the product team has not approved.</p><h2 id=\"ugc-ad-proof\">Give the scene real product proof</h2><p>Supply approved product images, feature notes, price or offer terms, and any required disclosure language. Ask the workflow to show the product in a believable context, but do not let generated scenes replace factual product photography where accuracy matters.</p><h2 id=\"ugc-ad-review\">Review before paid distribution</h2><ul><li>Check product shape, packaging, logo treatment, and stated benefits.</li><li>Read captions and voiceover with the sound off and on.</li><li>Review faces, hands, pacing, crop, and the call to action.</li><li>Confirm disclosure, landing page, offer, and audience settings.</li></ul><p>Use the linked video tools for different placements, then keep a final approval record for the version that enters the campaign.</p>",
    readMinutes: "6"
  },
  {
    slug: "/blog/ai-talking-photo-video-guide",
    title: "AI Talking Photo Video: Plan and Review Safely | Aidreamcapes",
    description: "Learn how to plan an AI talking photo video with permission-safe portraits, a focused script, clear audio, captions, and a face-and-timing review before sharing.",
    keywords: "AI talking photo, talking portrait video, AI avatar video, talking photo safety",
    imageUrl: `${IMAGE_ROOT}/article-motion-frames.png`,
    imageAlt: "A portrait frame prepared for a talking photo video review.",
    summary: "A permission-safe planning guide for talking photo videos, including source portraits, scripts, audio, captions, and final review.",
    entityName: "AI talking photo video workflow",
    userIntent: "Plan a talking photo video from an approved portrait and review its face, voice, captions, and timing.",
    targetHref: "/ai-video-generation/talking-photo",
    targetLabel: "Open Talking Photo",
    primaryCta: "Try a talking photo",
    primaryHref: "/ai-video-generation/talking-photo",
    relatedLinks: [
      ["/ai-video-generation/talking-photo", "Create a talking photo"],
      ["/ai-video-generation/talking-head-video", "Explore talking head video"],
      ["/ai-video-generation/multilingual-video", "Plan a multilingual version"]
    ],
    tags: "AI talking photo|Talking portrait video|Synthetic media|Video review",
    body: "<p>A talking photo video starts with a real person’s likeness, so permission and review should be part of the workflow from the first upload. Use an approved portrait, a short script, and a clear audience context before generating anything.</p><h2 id=\"talking-photo-permission\">Use a permission-safe portrait</h2><p>Only use a face you own or have permission to animate. Choose a recent, front-facing image with readable eyes, mouth, hairline, and lighting. Do not present a generated speaker as a real person saying something they did not approve.</p><h2 id=\"talking-photo-script\">Keep the script focused</h2><p>Write the exact words, names, pronunciation notes, and intended language. Short sentences are easier to review for lip movement, audio clarity, timing, and meaning.</p><h2 id=\"talking-photo-review\">Check the final video</h2><ul><li>Compare the face, mouth, eyes, hair, and skin tone across the clip.</li><li>Listen for pronunciation, timing, and unintended audio artifacts.</li><li>Read every caption and add disclosure when viewers could misunderstand the media.</li><li>Confirm that the final link and audience context match the approved use.</li></ul><p>Open the related tools when you need a different talking format or language, and keep the source permission with the private project record.</p>",
    readMinutes: "6"
  },
  {
    slug: "/blog/ecommerce-product-image-workflow",
    title: "Ecommerce Product Image Workflow | Aidreamcapes",
    description: "Build an ecommerce product image workflow from a source reference to main image, lifestyle scene, feature graphic, and comparison asset with review gates.",
    keywords: "ecommerce product image workflow, product page images, AI product content, PDP image checklist",
    imageUrl: `${IMAGE_ROOT}/workflow-source-to-gallery.png`,
    imageAlt: "An ecommerce product image workflow from source reference to approved gallery.",
    summary: "Map the image set a product page needs, choose the right Aidreamcapes workflow for each asset, and review the complete set before publishing.",
    entityName: "Ecommerce product image workflow",
    userIntent: "Plan a complete ecommerce product image set from an approved product reference.",
    targetHref: "/ai-image-generation/ecommerce-main-image",
    targetLabel: "Open Ecommerce Main Image",
    primaryCta: "Plan a product image set",
    primaryHref: "/workflow",
    relatedLinks: [
      ["/ai-image-generation/ecommerce-main-image", "Create the main image"],
      ["/ai-image-generation/feature-infographic", "Add a feature infographic"],
      ["/ai-image-generation/comparison-chart", "Build a comparison chart"]
    ],
    tags: "Ecommerce workflow|Product page images|PDP optimization|Image planning",
    body: "<p>A product page usually needs more than one image. Plan the asset set first, then use the right workflow for the main product view, context, feature explanation, and comparison. The goal is a consistent set that answers shopper questions without inventing product facts.</p><h2 id=\"ecommerce-image-map\">Map the product page image set</h2><p>List the main image, detail views, scale or use context, feature explanation, packaging, and comparison needs. Match each image to a question a shopper is likely to ask, such as size, material, use, or what is included.</p><h2 id=\"ecommerce-image-source\">Keep one approved source of truth</h2><p>Use the same approved product reference and fact sheet across the set. Record color, dimensions, materials, included items, and any text that must remain exact.</p><h2 id=\"ecommerce-image-review\">Review the set together</h2><ul><li>Check that the product remains recognizable across every scene.</li><li>Compare color, scale, packaging, and included items.</li><li>Read text and claims at mobile size.</li><li>Remove any asset that creates a misleading expectation.</li></ul><p>Use the linked tools to fill the gaps in the set, then send the full collection through one approval pass before it reaches a product page.</p>",
    readMinutes: "5"
  },
  {
    slug: "/blog/ai-video-review-checklist",
    title: "AI Video Review Checklist for Creators and Brands | Aidreamcapes",
    description: "Use this AI video review checklist to inspect identity, hands, objects, audio, captions, pacing, claims, crop, and disclosure before publishing a clip.",
    keywords: "AI video review checklist, AI video quality control, generated video review, video publishing checklist",
    imageUrl: `${IMAGE_ROOT}/article-motion-frames.png`,
    imageAlt: "A review checklist beside a motion-ready video frame.",
    summary: "A practical final-pass checklist for generated video, covering visual stability, audio, captions, claims, disclosure, and delivery format.",
    entityName: "AI video review checklist",
    userIntent: "Review a generated video for visual, audio, factual, and publishing issues before sharing it.",
    targetHref: "/ai-video-generation/explainer-video",
    targetLabel: "Open Explainer Video",
    primaryCta: "Choose a video workflow",
    primaryHref: "/ai-video-generation",
    relatedLinks: [
      ["/ai-video-generation/explainer-video", "Create an explainer video"],
      ["/ai-video-generation/social-media-video", "Plan social media video"],
      ["/ai-video-generation/talking-photo", "Review a talking photo"]
    ],
    tags: "AI video review|Video quality control|Generated media|Publishing checklist",
    body: "<p>Generated video can look convincing while still containing small errors that change meaning or reduce trust. Run this checklist after generation and before a clip is published, sent to a client, or placed in a paid campaign.</p><h2 id=\"video-review-visual\">Inspect visual stability</h2><p>Watch the full clip for face changes, hands, teeth, hair, text, product edges, object continuity, lighting shifts, and background geometry. Pause on transitions and close-ups where errors are easiest to miss at normal speed.</p><h2 id=\"video-review-audio\">Check audio and captions</h2><p>Listen for pronunciation, clipped words, timing drift, music rights, and unexpected sounds. Read captions against the audio and source script, then verify safe margins and mobile readability.</p><h2 id=\"video-review-publish\">Confirm the publishing context</h2><ul><li>Verify product claims, prices, dates, names, and calls to action.</li><li>Check aspect ratio, duration, crop, thumbnail, and destination link.</li><li>Add disclosure when generated media could be misunderstood.</li><li>Keep the approved source, script, and review record with the final export.</li></ul><p>Use the related Aidreamcapes workflows when the review identifies a different format or a more focused creative brief.</p>",
    readMinutes: "5"
  },
  {
    slug: "/blog/ai-content-disclosure-safe-usage",
    title: "AI Content Disclosure and Safe Usage Guide | Aidreamcapes",
    description: "Understand when AI content needs context or disclosure, how to use permission-safe source material, and how to review generated images and videos responsibly.",
    keywords: "AI content disclosure, safe AI usage, synthetic media policy, permission-safe AI content",
    imageUrl: `${IMAGE_ROOT}/about-private-workspace.png`,
    imageAlt: "A private workspace for reviewing AI content and source permissions.",
    summary: "A practical guide to permission-safe uploads, honest context, review records, and responsible sharing of AI-generated images and videos.",
    entityName: "AI content disclosure and safe usage",
    userIntent: "Understand how to review, label, and share AI-generated content responsibly.",
    targetHref: "/content",
    targetLabel: "Read the Content Policy",
    primaryCta: "Read the content policy",
    primaryHref: "/content",
    relatedLinks: [
      ["/ai-video-generation/talking-photo", "Review talking photo disclosure"],
      ["/ai-video-generation/brand-video", "Plan a brand video"],
      ["/ai-image-generation/professional-headshot", "Prepare a permission-safe portrait"]
    ],
    tags: "AI disclosure|Safe AI usage|Synthetic media|Content policy",
    body: "<p>Responsible AI content starts before generation and continues after export. Keep permission for source material, describe generated media honestly when context matters, and review the final result for claims, likeness, rights, and audience expectations.</p><h2 id=\"ai-safe-source\">Start with permission-safe source material</h2><p>Use photos, voices, products, logos, and text that you own or are authorized to use. Do not upload someone else’s likeness or private material without permission, and avoid using generated content to impersonate a real person.</p><h2 id=\"ai-disclosure-context\">Add the context viewers need</h2><p>Disclosure should be clear enough for the audience and placement to understand when an image or video is generated or substantially altered. Do not hide a material change when viewers could reasonably mistake the result for documentary footage, a real endorsement, or an unedited product view.</p><h2 id=\"ai-safe-review\">Keep a review record</h2><ul><li>Check factual claims, rights, names, faces, voices, and brand marks.</li><li>Confirm the destination, audience, caption, and disclosure language.</li><li>Keep the approved source and final export together.</li><li>Remove content that is misleading, unsafe, or outside the approved use.</li></ul><p>Use the policy and workflow links above as a starting point, then apply the same review standard to every channel where the content appears.</p>",
    readMinutes: "5"
  }
];

const EXISTING_ARTICLE_SLUG = "/blog/video-photo-package-guide";
const EXISTING_RELATED_LINK = { href: "/ai-video-generation/talking-photo", label: "Compare Talking Photo" };

function clone(value) {
  return structuredClone(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function pageIdForSlug(slug) {
  const suffix = crypto.createHash("sha1").update(slug).digest("hex").slice(0, 24);
  return `aidreamcapes_seo_cluster_${suffix}`;
}

function articlePageJson(article) {
  const updatedAt = "2026-09-24";
  const publishedAt = "2026-09-24";
  const relatedLinks = article.relatedLinks.map(([href, label]) => ({ href, label }));
  return {
    seo: {
      title: article.title,
      description: article.description,
      keywords: article.keywords,
      ogImage: article.imageUrl,
      canonicalPath: article.slug,
      robots: { index: true, follow: true }
    },
    version: 1,
    pageType: "article",
    sections: {
      blog_detail_1: {
        type: "blog_article",
        blocks: [],
        settings: {
          body: article.body,
          tags: article.tags,
          title: article.title,
          author: "Aidreamcapes editorial team",
          eyebrow: "Guide",
          summary: article.summary,
          imageAlt: article.imageAlt,
          imageUrl: article.imageUrl,
          authorUrl: "/about-us",
          updatedAt,
          publishedAt,
          authorType: "Organization",
          entityName: article.entityName,
          primaryCta: article.primaryCta,
          targetHref: article.targetHref,
          targetLabel: article.targetLabel,
          userIntent: article.userIntent,
          primaryHref: article.primaryHref,
          secondaryCta: "View pricing",
          secondaryHref: "/pricing",
          relatedLinks,
          readMinutes: article.readMinutes,
          reviewOwner: "Aidreamcapes editorial team",
          reviewedAt: updatedAt,
          evidenceDate: updatedAt,
          evidenceType: "editorial-guidance",
          headingLevel: "h1",
          rightsWarnings: ["Use only approved source material and review generated results before publishing."],
          inputRequirements: ["clear brief", "permission-safe source material", "final review checklist"],
          reviewChecklist: ["source permissions", "visual and audio stability", "claims and disclosure"],
          verifiedLimitations: ["Generated results require human review for accuracy, rights, and publishing context."]
        }
      }
    },
    draftMeta: { revision: 1, updatedAt: `${updatedAt}T00:00:00.000Z` },
    sectionsOrder: ["blog_detail_1"]
  };
}

function validateArticle(article) {
  assert(article.title.length >= 45 && article.title.length <= 70, `${article.slug}: title length ${article.title.length} is outside 45-70.`);
  assert(article.description.length >= 140 && article.description.length <= 170, `${article.slug}: description length ${article.description.length} is outside 140-170.`);
  assert.equal(article.relatedLinks.length, 3, `${article.slug}: expected three related tool links.`);
}

function existingArticlePatch(row) {
  const draftJson = clone(row.draftJson);
  const publishedJson = clone(row.publishedJson);
  for (const pageJson of [draftJson, publishedJson]) {
    const settings = pageJson?.sections?.blog_detail_1?.settings;
    if (!settings) continue;
    const relatedLinks = Array.isArray(settings.relatedLinks) ? settings.relatedLinks : [];
    if (!relatedLinks.some((link) => link?.href === EXISTING_RELATED_LINK.href)) relatedLinks.push(EXISTING_RELATED_LINK);
    settings.relatedLinks = relatedLinks.slice(0, 3);
  }
  return { draftJson, publishedJson };
}

function blogHomeJsonPatch(pageJson) {
  const next = clone(pageJson);
  next.seo = {
    ...(next.seo || {}),
    title: BLOG_HOME_SEO.title,
    description: BLOG_HOME_SEO.description,
    keywords: BLOG_HOME_SEO.keywords,
    canonicalPath: BLOG_HOME_SLUG,
    twitterDescription: BLOG_HOME_SEO.description,
    robots: { index: true, follow: true }
  };
  const intro = next.sections?.blog_intro_1?.settings;
  if (intro) {
    intro.title = "AI guides for ecommerce images, UGC video, and talking photos";
    intro.body = "Use Aidreamcapes guides to plan product images, creator-style ads, talking photo videos, ecommerce workflows, video reviews, and responsible AI content publishing.";
    intro.eyebrow = "Guides";
    intro.headingLevel = "h1";
  }
  const list = next.sections?.blog_list_1?.settings;
  if (list) {
    list.title = "AI image and video guides";
    list.body = "Practical guidance for AI product photography, UGC video ads, talking photo videos, ecommerce image workflows, final video reviews, and safe AI publishing.";
    list.guideType = "AI content guide";
    list.headingLevel = "h2";
  }
  return next;
}

function hasBlogHomeChanges(livePage, themePage) {
  return livePage.title !== BLOG_HOME_TITLE
    || themePage.title !== BLOG_HOME_TITLE
    || hash(livePage.contentJson) !== hash(blogHomeJsonPatch(livePage.contentJson))
    || hash(themePage.draftJson) !== hash(blogHomeJsonPatch(themePage.draftJson))
    || hash(themePage.publishedJson) !== hash(blogHomeJsonPatch(themePage.publishedJson));
}

function writeBackup(payload) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true, mode: 0o700 });
  const file = path.join(BACKUP_ROOT, `seo-content-cluster-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

async function otherSiteSentinel(prisma) {
  const [livePages, themePages] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: { not: SITE_ID } }, select: { id: true, siteId: true, slug: true, title: true, contentJson: true }, orderBy: [{ siteId: "asc" }, { slug: "asc" }] }),
    prisma.themePage.findMany({ where: { siteId: { not: SITE_ID } }, select: { id: true, siteId: true, slug: true, draftJson: true, publishedJson: true }, orderBy: [{ siteId: "asc" }, { slug: "asc" }] })
  ]);
  return hash({ livePages, themePages });
}

async function main() {
  const target = String(argumentValue("--db-target") || process.env.DATABASE_TARGET || "local").trim().toLowerCase();
  const apply = hasArgument("--apply");
  const confirmation = argumentValue("--confirm") || "";
  assertDatabaseTarget({ expectedTarget: target });
  if (apply) assert.equal(confirmation, CONFIRMATION, `Applying requires --confirm=${CONFIRMATION}.`);
  ARTICLES.forEach(validateArticle);

  const prisma = new PrismaClient();
  try {
    const [site, existingArticles, existingPage, blogLivePage, blogThemePage, beforeOtherSites] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: ARTICLES.map((article) => article.slug) } }, select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: EXISTING_ARTICLE_SLUG } }, select: { id: true, siteId: true, slug: true, draftJson: true, publishedJson: true } }),
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: BLOG_HOME_SLUG } }, select: { id: true, siteId: true, slug: true, title: true, contentJson: true } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: BLOG_HOME_SLUG } }, select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true } }),
      otherSiteSentinel(prisma)
    ]);
    assert.equal(site?.slug, "aidreamcapes", `${SITE_ID}: unexpected site.`);
    assert.equal(site?.primaryDomain?.toLowerCase(), "www.aidreamcapes.com", `${SITE_ID}: unexpected primary domain.`);
    assert(existingPage, `${EXISTING_ARTICLE_SLUG}: existing article missing.`);
    assert(blogLivePage, `${BLOG_HOME_SLUG}: LivePage missing.`);
    assert(blogThemePage, `${BLOG_HOME_SLUG}: ThemePage missing.`);

    const existingBySlug = new Map(existingArticles.map((row) => [row.slug, row]));
    const creates = ARTICLES.filter((article) => !existingBySlug.has(article.slug));
    const updates = ARTICLES.filter((article) => {
      const row = existingBySlug.get(article.slug);
      if (!row) return false;
      const next = articlePageJson(article);
      return row.title !== article.title || hash(row.contentJson) !== hash(next);
    });
    const existingPatch = existingArticlePatch(existingPage);
    const existingArticleChanged = hash(existingPage.draftJson) !== hash(existingPatch.draftJson) || hash(existingPage.publishedJson) !== hash(existingPatch.publishedJson);
    const blogHomeUpdate = hasBlogHomeChanges(blogLivePage, blogThemePage);
    const summary = {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      target,
      createdSlugs: creates.map((article) => article.slug),
      updatedSlugs: updates.map((article) => article.slug),
      existingArticleRelatedLinkUpdate: existingArticleChanged,
      blogHomeUpdate,
      articleCountAfter: existingArticles.length + creates.length,
      otherSiteSentinelHash: beforeOtherSites
    };
    if (!apply) {
      console.log(JSON.stringify({ ...summary, applyCommand: `node scripts/seed-aidreamcapes-seo-content-cluster.mjs --db-target=${target} --apply --confirm=${CONFIRMATION}` }, null, 2));
      return;
    }

    const backupPath = writeBackup({ createdAt: new Date().toISOString(), site, existingArticles, existingPage, blogLivePage, blogThemePage, otherSiteSentinelHash: beforeOtherSites });
    await prisma.$transaction(async (tx) => {
      for (const article of ARTICLES) {
        const pageJson = articlePageJson(article);
        const id = pageIdForSlug(article.slug);
        await tx.livePage.upsert({
          where: { siteId_slug: { siteId: SITE_ID, slug: article.slug } },
          create: { id, siteId: SITE_ID, pageType: "article", templateKey: "blog-detail", slug: article.slug, title: article.title, contentJson: pageJson },
          update: { pageType: "article", templateKey: "blog-detail", title: article.title, contentJson: pageJson }
        });
        await tx.themePage.upsert({
          where: { siteId_slug: { siteId: SITE_ID, slug: article.slug } },
          create: { id, siteId: SITE_ID, pageType: "article", templateKey: "blog-detail", slug: article.slug, title: article.title, draftJson: pageJson, publishedJson: pageJson },
          update: { pageType: "article", templateKey: "blog-detail", title: article.title, draftJson: pageJson, publishedJson: pageJson }
        });
      }
      if (existingArticleChanged) {
        await tx.themePage.update({ where: { id: existingPage.id }, data: { draftJson: existingPatch.draftJson, publishedJson: existingPatch.publishedJson } });
        const liveExisting = await tx.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: EXISTING_ARTICLE_SLUG } }, select: { id: true, contentJson: true } });
        assert(liveExisting, `${EXISTING_ARTICLE_SLUG}: LivePage missing during update.`);
        const liveJson = clone(liveExisting.contentJson);
        const settings = liveJson?.sections?.blog_detail_1?.settings;
        if (settings) {
          const relatedLinks = Array.isArray(settings.relatedLinks) ? settings.relatedLinks : [];
          if (!relatedLinks.some((link) => link?.href === EXISTING_RELATED_LINK.href)) relatedLinks.push(EXISTING_RELATED_LINK);
          settings.relatedLinks = relatedLinks.slice(0, 3);
          await tx.livePage.update({ where: { id: liveExisting.id }, data: { contentJson: liveJson } });
        }
      }
      if (blogHomeUpdate) {
        await tx.livePage.update({ where: { id: blogLivePage.id }, data: { title: BLOG_HOME_TITLE, contentJson: blogHomeJsonPatch(blogLivePage.contentJson) } });
        await tx.themePage.update({ where: { id: blogThemePage.id }, data: { title: BLOG_HOME_TITLE, draftJson: blogHomeJsonPatch(blogThemePage.draftJson), publishedJson: blogHomeJsonPatch(blogThemePage.publishedJson) } });
      }
    }, { maxWait: 10000, timeout: 120000 });

    const [afterLive, afterTheme, afterExisting, afterBlogLive, afterBlogTheme, afterOtherSites] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: ARTICLES.map((article) => article.slug) } }, select: { slug: true, title: true, contentJson: true } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: ARTICLES.map((article) => article.slug) } }, select: { slug: true, title: true, draftJson: true, publishedJson: true } }),
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: EXISTING_ARTICLE_SLUG } }, select: { contentJson: true } }),
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: BLOG_HOME_SLUG } }, select: { title: true, contentJson: true } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: BLOG_HOME_SLUG } }, select: { title: true, draftJson: true, publishedJson: true } }),
      otherSiteSentinel(prisma)
    ]);
    assert.equal(afterLive.length, ARTICLES.length, "content-cluster LivePage count mismatch.");
    assert.equal(afterTheme.length, ARTICLES.length, "content-cluster ThemePage count mismatch.");
    assert(afterExisting, `${EXISTING_ARTICLE_SLUG}: LivePage readback missing.`);
    for (const article of ARTICLES) {
      const expected = articlePageJson(article);
      const live = afterLive.find((row) => row.slug === article.slug);
      const theme = afterTheme.find((row) => row.slug === article.slug);
      assert(live && theme, `${article.slug}: readback missing.`);
      assert.equal(hash(live.contentJson), hash(expected), `${article.slug}: LivePage readback mismatch.`);
      assert.equal(hash(theme.draftJson), hash(expected), `${article.slug}: ThemePage draft readback mismatch.`);
      assert.equal(hash(theme.publishedJson), hash(expected), `${article.slug}: ThemePage published readback mismatch.`);
    }
    assert(afterExisting.contentJson?.sections?.blog_detail_1?.settings?.relatedLinks?.some((link) => link?.href === EXISTING_RELATED_LINK.href), `${EXISTING_ARTICLE_SLUG}: related tool link readback missing.`);
    assert(afterBlogLive && afterBlogTheme, `${BLOG_HOME_SLUG}: readback missing.`);
    assert.equal(afterBlogLive.title, BLOG_HOME_TITLE, `${BLOG_HOME_SLUG}: LivePage title readback mismatch.`);
    assert.equal(afterBlogTheme.title, BLOG_HOME_TITLE, `${BLOG_HOME_SLUG}: ThemePage title readback mismatch.`);
    assert.deepEqual(afterBlogLive.contentJson, blogHomeJsonPatch(blogLivePage.contentJson), `${BLOG_HOME_SLUG}: LivePage readback mismatch.`);
    assert.deepEqual(afterBlogTheme.draftJson, blogHomeJsonPatch(blogThemePage.draftJson), `${BLOG_HOME_SLUG}: ThemePage draft readback mismatch.`);
    assert.deepEqual(afterBlogTheme.publishedJson, blogHomeJsonPatch(blogThemePage.publishedJson), `${BLOG_HOME_SLUG}: ThemePage published readback mismatch.`);
    assert.equal(afterOtherSites, beforeOtherSites, "A non-target site's data changed; seed is not considered safe.");
    console.log(JSON.stringify({ ...summary, mode: "applied", backupPath, afterOtherSiteSentinelHash: afterOtherSites }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
