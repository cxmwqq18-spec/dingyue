#!/usr/bin/env node
// AIVideosUGC document-style blog apply — 2026-11-22.
// Adds two owner-provided articles to site_aidreamcapes: the AIVideosUGC launch
// press release and the company knowledge base. Creates the article LivePage
// rows in the shape the other articles use (layout: blog-document) and appends
// their cards to the /blog hub. Field-level, idempotent, site-scoped.
//
//   dry run:  node scripts/apply-aivideosugc-blog-press-kb-2026-11-22.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-blog-press-kb-2026-11-22.mjs --target=local --apply
//   production apply additionally requires the explicit confirm name and the
//   base hashes printed by the reviewed dry run.
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { APPLY_DATE, APPLY_DATETIME, ARTICLES, BLOG_HUB_COPY, BLOG_TUTORIAL_HREFS } from "./lib/aivideosugc-blog-press-kb-2026-11-22.mjs";

const CONFIRM_NAME = "aivideosugc-blog-press-kb-2026-11-22";
const MANIFEST_PATH = new URL(`./manifests/aivideosugc-blog-press-kb-${APPLY_DATE}.json`, import.meta.url);
const BLOG_HUB_SLUG = "/blog";
const ORIGIN = "https://www.aivideosugc.com";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") {
  assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
}

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function assertDocumentData(article) {
  const data = article.data;
  assert.match(article.slug, /^\/blog\/[a-z0-9-]+$/, `Article slug must be a /blog/ path: ${article.slug}`);
  assert.equal(article.pageType, "article", `Article pageType must be article: ${article.slug}`);
  assert.ok(data?.h1 && data?.variant, `Article ${article.slug} is missing its document data.`);
  assert.ok(Array.isArray(data.sections) && data.sections.length, `Article ${article.slug} has no sections.`);
  assert.ok(data.cover?.src && data.cover?.alt, `Article ${article.slug} needs a cover with src and alt.`);
  assert.equal(article.card?.href, article.slug, `Hub card must point at ${article.slug}.`);
  for (const section of data.sections) {
    assert.ok(section.h2, `Article ${article.slug} has a section without a heading.`);
    assert.ok(Array.isArray(section.blocks) && section.blocks.length, `Section "${section.h2}" has no blocks.`);
  }
}

function contentJsonFor(article, organization) {
  const description = article.seoDescription;
  const canonical = `${ORIGIN}${article.slug}`;
  const graph = [];
  if (organization) graph.push(organization);
  graph.push({
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${ORIGIN}/` },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${ORIGIN}/blog` },
      { "@type": "ListItem", position: 3, name: article.data.h1, item: canonical }
    ]
  });
  graph.push({
    "@type": "BlogPosting",
    image: article.data.cover.src,
    author: organization?.["@id"] ? { "@id": organization["@id"] } : { "@id": `${ORIGIN}/#organization` },
    publisher: organization?.["@id"] ? { "@id": organization["@id"] } : { "@id": `${ORIGIN}/#organization` },
    inLanguage: "en",
    headline: article.data.h1,
    description,
    dateModified: APPLY_DATETIME,
    datePublished: APPLY_DATETIME,
    mainEntityOfPage: canonical
  });
  return {
    version: 2,
    pageType: "article",
    sectionsOrder: ["v2_main"],
    contentContract: {
      seoSource: "LivePage.contentJson",
      mediaSource: "LivePage.contentJson",
      sourceRevision: "aidreamcapes-site-v2"
    },
    mediaManifest: [article.data.cover],
    seo: {
      index: true,
      title: article.seoTitle,
      description,
      keywords: article.keywords,
      primaryKeyword: article.keywords.split(",")[0].trim(),
      canonical,
      canonicalPath: article.slug,
      ogImage: article.data.cover.src,
      ogImageAlt: article.data.cover.alt,
      robots: { index: true, follow: true, maxImagePreview: "large" },
      twitterDescription: description,
      jsonLd: { "@graph": graph }
    },
    sections: {
      v2_main: {
        type: "aidreamcapes_v2_page",
        blocks: [],
        settings: { layout: "blog-document", data: article.data }
      }
    }
  };
}

for (const article of ARTICLES) assertDocumentData(article);

const db = new PrismaClient();
try {
  const hubRow = await db.livePage.findFirst({ where: { siteId, slug: BLOG_HUB_SLUG }, select: { id: true, contentJson: true, updatedAt: true } });
  assert(hubRow, `Blog hub row ${BLOG_HUB_SLUG} does not exist on ${target}.`);
  const hubData = hubRow.contentJson.sections?.v2_main?.settings?.data;
  assert(Array.isArray(hubData?.articles), "Blog hub articles list is missing.");
  const hubGraph = hubRow.contentJson.seo?.jsonLd?.["@graph"];
  const organization = Array.isArray(hubGraph) ? hubGraph.find((node) => node?.["@type"] === "Organization") : undefined;

  const plans = [];
  for (const article of ARTICLES) {
    const existing = await db.livePage.findFirst({
      where: { siteId, slug: article.slug },
      select: { id: true, pageType: true, contentJson: true, updatedAt: true }
    });
    if (existing) {
      assert.equal(existing.pageType, article.pageType, `Existing ${article.slug} pageType mismatch; investigate before updating.`);
    }
    plans.push({ article, existing, nextContentJson: contentJsonFor(article, organization) });
  }

  const nextHub = structuredClone(hubRow.contentJson);
  const nextHubData = nextHub.sections.v2_main.settings.data;
  nextHubData.eyebrow = BLOG_HUB_COPY.eyebrow;
  nextHubData.lead = BLOG_HUB_COPY.lead;
  const tutorialHrefs = new Set(BLOG_TUTORIAL_HREFS);
  for (const card of nextHubData.articles) {
    if (tutorialHrefs.has(card?.href)) card.kind = "tutorial";
  }
  for (const plan of plans) {
    const list = nextHubData.articles;
    const index = list.findIndex((card) => card?.href === plan.article.slug);
    if (index >= 0) list[index] = plan.article.card;
    else list.push(plan.article.card);
    assert.equal(list.filter((card) => card?.href === plan.article.slug).length, 1, `Hub card for ${plan.article.slug} must appear exactly once.`);
  }
  const resolvedCounts = {
    articles: nextHubData.articles.length,
    tutorials: nextHubData.articles.filter((card) => card?.kind === "tutorial").length
  };
  const hubChanged = hash(nextHub) !== hash(hubRow.contentJson);

  const articleReport = [];
  const providedArticles = argumentValue("--base-hash-articles");
  for (const plan of plans) {
    const changed = plan.existing ? hash(plan.existing.contentJson) !== hash(plan.nextContentJson) : true;
    const baseHash = plan.existing ? hash(plan.existing.contentJson) : null;
    articleReport.push({
      slug: plan.article.slug,
      rowId: plan.existing?.id ?? plan.article.id,
      action: plan.existing ? (changed ? "update" : "unchanged") : "create",
      changed,
      baseHash,
      nextHash: hash(plan.nextContentJson)
    });
  }
  if (apply && providedArticles) {
    const expected = providedArticles.split(",").map((value) => value.trim()).filter(Boolean);
    const actual = articleReport.map((item) => item.baseHash).filter(Boolean);
    assert.deepEqual(actual, expected, "Article rows changed since the reviewed dry run; refusing to apply.");
  }

  const hubBaseHash = hash(hubRow.contentJson);
  const hubNextHash = hash(nextHub);
  const plan = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    confirm: CONFIRM_NAME,
    hub: { slug: BLOG_HUB_SLUG, action: hubChanged ? "update" : "unchanged", baseHash: hubBaseHash, nextHash: hubNextHash, resolvedCounts },
    articles: articleReport
  };

  if (apply) {
    const providedHub = argumentValue("--base-hash-hub");
    if (providedHub) assert.equal(hubBaseHash, providedHub, "Blog hub changed since the reviewed dry run; refusing to apply.");
    for (const item of plans) {
      const { article, existing, nextContentJson } = item;
      if (!existing) {
        await db.livePage.create({
          data: {
            id: article.id,
            siteId,
            pageType: article.pageType,
            templateKey: null,
            slug: article.slug,
            title: article.title,
            contentJson: nextContentJson
          }
        });
        continue;
      }
      const update = await db.livePage.updateMany({
        where: { id: existing.id, siteId, slug: article.slug, updatedAt: existing.updatedAt },
        data: { title: article.title, contentJson: nextContentJson }
      });
      assert.equal(update.count, 1, `Row changed during apply: ${article.slug}.`);
    }
    if (hubChanged) {
      const update = await db.livePage.updateMany({
        where: { id: hubRow.id, siteId, slug: BLOG_HUB_SLUG, updatedAt: hubRow.updatedAt },
        data: { contentJson: nextHub }
      });
      assert.equal(update.count, 1, "Blog hub row changed during apply.");
    }

    const readback = await db.livePage.findMany({
      where: { siteId, slug: { in: [BLOG_HUB_SLUG, ...ARTICLES.map((article) => article.slug)] } },
      select: { slug: true, contentJson: true }
    });
    const bySlug = new Map(readback.map((row) => [row.slug, row.contentJson]));
    for (const item of plans) {
      assert.equal(hash(bySlug.get(item.article.slug)), hash(item.nextContentJson), `Readback mismatch on ${item.article.slug}.`);
    }
    assert.equal(hash(bySlug.get(BLOG_HUB_SLUG)), hash(nextHub), "Readback mismatch on the blog hub.");
    plan.applied = true;
  }

  fs.mkdirSync(new URL("./manifests/", import.meta.url), { recursive: true });
  const manifest = {
    date: APPLY_DATE,
    siteId,
    target,
    mode: plan.mode,
    slugs: ARTICLES.map((article) => article.slug),
    hub: plan.hub,
    articles: articleReport,
    note: "Content-only addition. Covers are owner-provided posters provisioned under /assets/sites/site_aidreamcapes/blog/. Rollback is a field-level inverse: delete the two LivePage rows and remove their hub cards."
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  plan.manifest = MANIFEST_PATH.pathname;
  console.log(JSON.stringify(plan, null, 2));
} finally {
  await db.$disconnect();
}
