#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { aidreamcapesBlogArticles } from "./lib/aidreamcapes-blog-content.mjs";
import { aidreamcapesBlogCoverSourceHref, aidreamcapesThemeCoverAlt, aidreamcapesThemeCoverImage, assertUniqueAidreamcapesBlogCovers } from "./lib/aidreamcapes-blog-cover-media.mjs";
import { LEGACY_ARTICLE_PATH, MIGRATED_ARTICLE_PATH, validateAidreamcapesBlogArticle } from "./lib/aidreamcapes-blog-route-contract.mjs";

const SITE_ID = "site_aidreamcapes";
const CONFIRMATION = "aidreamcapes-seo-content-cluster";
const BACKUP_ROOT = path.resolve("releases/backups/aidreamcapes");
const BLOG_HOME_SLUG = "/blog";
const BLOG_HOME_TITLE = "AI image and video guides";
const BLOG_HOME_SEO = {
  title: "AI Ecommerce, UGC & Talking Photo Guides | Aidreamcapes",
  description: "Practical guides for AI product photography, UGC video ads, talking photos, ecommerce workflows, video review, and safe AI content publishing.",
  keywords: "AI ecommerce guides, AI product photography, UGC video ads, talking photo video, AI content review"
};


const ARTICLES = aidreamcapesBlogArticles();
const EXISTING_ARTICLE_SLUG = LEGACY_ARTICLE_PATH;
const MIGRATED_ARTICLE_SLUG = MIGRATED_ARTICLE_PATH;

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
  const updatedAt = "2026-09-29";
  const publishedAt = "2026-09-29";
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
          coverThemeHref: article.coverThemeHref,
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
  validateAidreamcapesBlogArticle(article);
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
    const [site, existingArticles, legacyLivePage, legacyThemePage, blogLivePage, blogThemePage, beforeOtherSites] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: ARTICLES.map((article) => article.slug) } }, select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true } }),
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: EXISTING_ARTICLE_SLUG } }, select: { id: true, siteId: true, slug: true, title: true, contentJson: true } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: EXISTING_ARTICLE_SLUG } }, select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true } }),
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: BLOG_HOME_SLUG } }, select: { id: true, siteId: true, slug: true, title: true, contentJson: true } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: BLOG_HOME_SLUG } }, select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true } }),
      otherSiteSentinel(prisma)
    ]);
    assert.equal(site?.slug, "aidreamcapes", `${SITE_ID}: unexpected site.`);
    assert.equal(site?.primaryDomain?.toLowerCase(), "www.aidreamcapes.com", `${SITE_ID}: unexpected primary domain.`);
    const migrationSourcePresent = Boolean(legacyLivePage || legacyThemePage);
    const migrationAlreadyApplied = existingArticles.some((row) => row.slug === MIGRATED_ARTICLE_SLUG);
    assert(migrationSourcePresent || migrationAlreadyApplied, `${EXISTING_ARTICLE_SLUG}: migration source is missing and migrated article is not present.`);
    assert(blogLivePage, `${BLOG_HOME_SLUG}: LivePage missing.`);
    assert(blogThemePage, `${BLOG_HOME_SLUG}: ThemePage missing.`);

    const coverThemeHrefs = [...new Set(ARTICLES.map(aidreamcapesBlogCoverSourceHref))];
    const [coverLivePages, coverThemePages] = await Promise.all([
      prisma.livePage.findMany({
        where: { siteId: SITE_ID, slug: { in: coverThemeHrefs } },
        select: { slug: true, contentJson: true }
      }),
      prisma.themePage.findMany({
        where: { siteId: SITE_ID, slug: { in: coverThemeHrefs } },
        select: { slug: true, publishedJson: true }
      })
    ]);
    const coverPageJsonByHref = new Map(coverLivePages.map((page) => [page.slug, page.contentJson]));
    for (const page of coverThemePages) {
      if (!coverPageJsonByHref.has(page.slug)) coverPageJsonByHref.set(page.slug, page.publishedJson);
    }
    const resolvedArticles = ARTICLES.map((article) => {
      const sourceHref = aidreamcapesBlogCoverSourceHref(article);
      const sourcePageJson = coverPageJsonByHref.get(sourceHref);
      assert(sourcePageJson, `${article.slug}: cover theme page ${sourceHref} is missing.`);
      const imageUrl = aidreamcapesThemeCoverImage(sourcePageJson);
      assert(imageUrl, `${article.slug}: cover theme page ${sourceHref} has no Aidreamcapes image asset.`);
      return {
        ...article,
        imageUrl,
        imageAlt: aidreamcapesThemeCoverAlt(sourcePageJson, article.imageAlt)
      };
    });
    assertUniqueAidreamcapesBlogCovers(resolvedArticles);
    const existingBySlug = new Map(existingArticles.map((row) => [row.slug, row]));
    const creates = resolvedArticles.filter((article) => !existingBySlug.has(article.slug));
    const updates = resolvedArticles.filter((article) => {
      const row = existingBySlug.get(article.slug);
      if (!row) return false;
      const next = articlePageJson(article);
      return row.title !== article.title || hash(row.contentJson) !== hash(next);
    });
    const blogHomeUpdate = hasBlogHomeChanges(blogLivePage, blogThemePage);
    const summary = {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      target,
      createdSlugs: creates.map((article) => article.slug),
      updatedSlugs: updates.map((article) => article.slug),
      migratedFromSlug: EXISTING_ARTICLE_SLUG,
      migratedToSlug: MIGRATED_ARTICLE_SLUG,
      removedSlugs: migrationSourcePresent ? [EXISTING_ARTICLE_SLUG] : [],
      blogHomeUpdate,
      articleCountAfter: existingArticles.length + creates.length,
      otherSiteSentinelHash: beforeOtherSites
    };
    if (!apply) {
      console.log(JSON.stringify({ ...summary, applyCommand: `node scripts/seed-aidreamcapes-seo-content-cluster.mjs --db-target=${target} --apply --confirm=${CONFIRMATION}` }, null, 2));
      return;
    }

    const backupPath = writeBackup({ createdAt: new Date().toISOString(), site, existingArticles, legacyLivePage, legacyThemePage, blogLivePage, blogThemePage, otherSiteSentinelHash: beforeOtherSites });
    await prisma.$transaction(async (tx) => {
      for (const article of resolvedArticles) {
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
      if (legacyLivePage) {
        await tx.livePage.delete({ where: { id: legacyLivePage.id } });
      }
      if (legacyThemePage) {
        await tx.themePage.delete({ where: { id: legacyThemePage.id } });
      }
      if (blogHomeUpdate) {
        await tx.livePage.update({ where: { id: blogLivePage.id }, data: { title: BLOG_HOME_TITLE, contentJson: blogHomeJsonPatch(blogLivePage.contentJson) } });
        await tx.themePage.update({ where: { id: blogThemePage.id }, data: { title: BLOG_HOME_TITLE, draftJson: blogHomeJsonPatch(blogThemePage.draftJson), publishedJson: blogHomeJsonPatch(blogThemePage.publishedJson) } });
      }
    }, { maxWait: 10000, timeout: 120000 });

    const [afterLive, afterTheme, afterLegacyLive, afterLegacyTheme, afterBlogLive, afterBlogTheme, afterOtherSites] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: ARTICLES.map((article) => article.slug) } }, select: { slug: true, title: true, contentJson: true } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: ARTICLES.map((article) => article.slug) } }, select: { slug: true, title: true, draftJson: true, publishedJson: true } }),
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: EXISTING_ARTICLE_SLUG } }, select: { id: true } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: EXISTING_ARTICLE_SLUG } }, select: { id: true } }),
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: BLOG_HOME_SLUG } }, select: { title: true, contentJson: true } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: BLOG_HOME_SLUG } }, select: { title: true, draftJson: true, publishedJson: true } }),
      otherSiteSentinel(prisma)
    ]);
    assert.equal(afterLive.length, ARTICLES.length, "content-cluster LivePage count mismatch.");
    assert.equal(afterTheme.length, ARTICLES.length, "content-cluster ThemePage count mismatch.");
    assert.equal(afterLegacyLive, null, `${EXISTING_ARTICLE_SLUG}: legacy LivePage still exists after migration.`);
    assert.equal(afterLegacyTheme, null, `${EXISTING_ARTICLE_SLUG}: legacy ThemePage still exists after migration.`);
    for (const article of resolvedArticles) {
      const expected = articlePageJson(article);
      const live = afterLive.find((row) => row.slug === article.slug);
      const theme = afterTheme.find((row) => row.slug === article.slug);
      assert(live && theme, `${article.slug}: readback missing.`);
      assert.equal(hash(live.contentJson), hash(expected), `${article.slug}: LivePage readback mismatch.`);
      assert.equal(hash(theme.draftJson), hash(expected), `${article.slug}: ThemePage draft readback mismatch.`);
      assert.equal(hash(theme.publishedJson), hash(expected), `${article.slug}: ThemePage published readback mismatch.`);
    }
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
