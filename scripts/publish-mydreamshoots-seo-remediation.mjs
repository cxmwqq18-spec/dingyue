#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { mydreamshootsBlogSeoRemediationArticles } from "./mydreamshoots-blog-seo-remediation-articles.mjs";

const SITE_ID = "site_dreamshoot";
const VIDEO_SLUGS = ["music-video", "promo-video", "social-media-video", "ugc-ad-video"];
const BLOG_SLUGS = ["/blog/anime-avatar-photo-package-guide", "/blog/profile-cards-photo-package-guide"];
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply") && !hasArgument("--dry-run");
const productionConfirmed = hasArgument("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-seo-remediation";

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed
});
if (target === "production" && apply && !productionConfirmed) {
  throw new Error("Production remediation requires --confirm-production --confirm=mydreamshoots-seo-remediation.");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toPrismaJson(value) {
  return clone(value);
}

function isolateVideoTopicImages(content) {
  const next = clone(content);
  const source = (image) => image && typeof image === "object" && typeof image.src === "string" ? image.src : "";
  const heroSource = source(next.hero?.image);
  if (Array.isArray(next.hero?.images)) {
    const seen = new Set([heroSource]);
    next.hero.images = next.hero.images.filter((image) => {
      const imageSource = source(image);
      if (!imageSource || seen.has(imageSource)) return false;
      seen.add(imageSource);
      return true;
    });
  }
  const reserved = new Set([heroSource, ...(next.useCases?.items ?? []).map((item) => source(item?.image))].filter(Boolean));
  if (Array.isArray(next.gallery?.items)) {
    next.gallery.items = next.gallery.items.filter((item) => {
      const imageSource = source(item?.image);
      return !imageSource || !reserved.has(imageSource);
    });
  }
  return next;
}

function videoPageJson(page, slug, content) {
  const canonicalPath = content.seo?.canonicalPath || `/ai-video-generation/${slug}`;
  return {
    pageType: "ai_tool",
    version: page.draftJson?.version ?? 1,
    sectionsOrder: ["ai_video_topic_landing_1"],
    sections: {
      ai_video_topic_landing_1: {
        type: "ai_video_topic_landing",
        settings: {
          anchor: slug,
          contentKey: slug,
          content: isolateVideoTopicImages(content)
        },
        blocks: []
      }
    },
    seo: {
      title: content.seo?.title || page.title,
      description: content.seo?.description || "",
      keywords: content.seo?.keywords || "",
      canonicalPath,
      canonical: canonicalPath,
      robots: { index: true, follow: true },
      index: true,
      follow: true
    }
  };
}

function articlePageJson(page, article) {
  const sourceJson = page.draftJson ?? {};
  const sections = clone(sourceJson.sections ?? {});
  sections.blog_detail_1 = {
    type: "blog_article",
    settings: {
      eyebrow: "Guide",
      title: article.title,
      headingLevel: "h1",
      summary: article.summary,
      author: article.author,
      authorType: article.authorType,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      readMinutes: article.readMinutes,
      imageUrl: article.imageUrl,
      imageAlt: article.imageAlt,
      tags: article.tags,
      primaryCta: article.primaryCta,
      primaryHref: article.primaryHref,
      secondaryCta: article.secondaryCta,
      secondaryHref: article.secondaryHref,
      targetLabel: article.targetLabel ?? article.secondaryCta ?? article.primaryCta ?? "Open related page",
      targetHref: article.targetHref ?? article.secondaryHref ?? article.primaryHref ?? "/collections",
      secondaryTargetLabel: article.secondaryTargetLabel,
      secondaryTargetHref: article.secondaryTargetHref,
      entityName: article.entityName,
      primaryKeyword: article.primaryKeyword,
      searchIntent: article.searchIntent,
      productSlug: article.productSlug,
      userIntent: article.userIntent,
      suitableUses: clone(article.suitableUses ?? []),
      unsuitableUses: clone(article.unsuitableUses ?? []),
      inputRequirements: clone(article.inputRequirements ?? []),
      verifiedLimitations: clone(article.verifiedLimitations ?? []),
      comparisonTargets: clone(article.comparisonTargets ?? []),
      reviewChecklist: clone(article.reviewChecklist ?? []),
      rightsWarnings: clone(article.rightsWarnings ?? []),
      relatedGuides: clone(article.relatedGuides ?? []),
      authorUrl: article.authorUrl,
      reviewOwner: article.reviewOwner,
      reviewedAt: article.reviewedAt,
      evidenceDate: article.evidenceDate,
      evidenceType: article.evidenceType,
      relatedLinks: clone(article.relatedLinks ?? []),
      body: article.body
    },
    blocks: []
  };
  for (const sectionId of ["packages_1", "packages_strip_1", "blog_list_1", "conversion_1"]) delete sections[sectionId];
  return {
    pageType: "article",
    version: sourceJson.version ?? 1,
    sectionsOrder: ["blog_detail_1"],
    sections,
    seo: {
      title: article.seoTitle,
      description: article.seoDescription,
      keywords: article.seoKeywords,
      canonicalPath: article.slug,
      ogImage: article.imageUrl,
      robots: { index: true, follow: true }
    }
  };
}

const jiti = createJiti(import.meta.url);
const { aiVideoTopicLandingContentByKey } = jiti("./seed-mydreamshoots-ai-video-topic-content.ts");
const articleBySlug = new Map(mydreamshootsBlogSeoRemediationArticles.map((article) => [article.slug, article]));
const targets = [
  ...VIDEO_SLUGS.map((slug) => `/ai-video-generation/${slug}`),
  ...BLOG_SLUGS
];

const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({
    where: { siteId: SITE_ID, slug: { in: targets } },
    orderBy: { slug: "asc" }
  });
  assert.equal(pages.length, targets.length, "all scoped remediation pages must exist before publishing");

  const updates = pages.map((page) => {
    if (page.slug.startsWith("/ai-video-generation/")) {
      const slug = page.slug.slice("/ai-video-generation/".length);
      const content = aiVideoTopicLandingContentByKey[slug];
      assert(content, `missing video seed: ${slug}`);
      return { id: page.id, slug: page.slug, title: page.title, draftJson: videoPageJson(page, slug, content) };
    }
    const article = articleBySlug.get(page.slug);
    assert(article, `missing blog remediation source: ${page.slug}`);
    return { id: page.id, slug: page.slug, title: article.pageTitle, draftJson: articlePageJson(page, article) };
  });

  const report = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    target,
    siteId: SITE_ID,
    pages: updates.map((update) => ({
      slug: update.slug,
      title: update.title,
      h1: update.draftJson.sections.blog_detail_1?.settings?.title ?? update.draftJson.sections.ai_video_topic_landing_1?.settings?.content?.hero?.title,
      contentHash: crypto.createHash("sha256").update(JSON.stringify(update.draftJson)).digest("hex").slice(0, 20)
    }))
  };

  if (apply) {
    const backupDir = path.join(process.cwd(), "releases", "backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `mydreamshoots-seo-remediation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ siteId: SITE_ID, createdAt: new Date().toISOString(), pages }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.themePage.update({
          where: { id: update.id },
          data: { title: update.title, draftJson: toPrismaJson(update.draftJson) }
        });
      }
    }, { timeout: 120_000 });
    const readback = await prisma.themePage.findMany({
      where: { siteId: SITE_ID, slug: { in: targets } },
      select: { slug: true, title: true, draftJson: true }
    });
    assert.equal(readback.length, updates.length, "scoped remediation database readback count mismatch");
    for (const update of updates) {
      const saved = readback.find((page) => page.slug === update.slug);
      assert(saved, `missing scoped remediation readback: ${update.slug}`);
      assert.deepEqual(saved.draftJson, update.draftJson, `scoped remediation readback mismatch: ${update.slug}`);
    }
    report.backupPath = backupPath;
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
