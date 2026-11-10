#!/usr/bin/env node
// AIVideosUGC blog tutorials apply — 2026-11-11.
// Rebuilds the five published blog articles around the five workspace modules
// (tutorial + editorial copy, real template-wall prompt cards, one real
// example clip per article) and refreshes the /blog index cards to the new
// tutorial titles. Slugs, covers and canonical URLs stay as published;
// h1/seo titles move to the tutorial keywords (content decision, reviewed in
// the v3 design draft) — no URL changes, no redirects (URL-safety: same-slug
// content rewrite only).
//
//   dry run:  node scripts/apply-aivideosugc-blog-tutorials-2026-11-11.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-blog-tutorials-2026-11-11.mjs --target=local --apply
//   production apply additionally requires the combined --base-hash printed
//   by the reviewed dry run and the explicit confirm name.
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { ARTICLES, INDEX_PATCH, APPLY_DATE, VIDEO_UPLOAD_DATE, CLIPS } from "./lib/aivideosugc-blog-tutorials-2026-11-11.mjs";

const CONFIRM_NAME = "aivideosugc-blog-tutorials-2026-11-11";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
if (apply && target === "production") {
  assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
}

const SLUGS = [...ARTICLES.map((a) => a.slug), INDEX_PATCH.slug];

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId, slug: { in: SLUGS } },
    select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, updatedAt: true }
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  for (const slug of SLUGS) {
    assert(bySlug.has(slug), `LivePage ${slug} does not exist on ${target}.`);
  }

  // Harvest every published V2Image by src so rewritten sections reuse the
  // exact same media contract (alt/sizes/srcSet) as the live rows.
  const imageBySrc = new Map();
  for (const row of rows) {
    const data = row.contentJson?.sections?.v2_main?.settings?.data;
    if (!data) continue;
    if (data.image?.src) imageBySrc.set(data.image.src, data.image);
    for (const section of Array.isArray(data.sections) ? data.sections : []) {
      if (section?.img?.src) imageBySrc.set(section.img.src, section.img);
    }
  }
  function img(src) {
    const image = imageBySrc.get(src);
    assert(image, `Published image ${src} is missing from the live rows; media contract would change.`);
    return image;
  }

  function seoFor(article, currentSeo, data) {
    const graph = [];
    const previous = currentSeo?.jsonLd?.["@graph"];
    const previousList = Array.isArray(previous) ? previous : [];
    const organization = previousList.find((node) => node?.["@type"] === "Organization");
    if (organization) graph.push(organization);
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: data.breadcrumbs.map((crumb, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: crumb.label,
        item: `https://www.aivideosugc.com${crumb.href}`
      }))
    });
    const previousBlog = previousList.find((node) => node?.["@type"] === "BlogPosting");
    graph.push({
      "@type": "BlogPosting",
      image: data.image?.src,
      author: previousBlog?.author ?? { "@id": "https://www.aivideosugc.com/#organization" },
      headline: data.h1,
      publisher: previousBlog?.publisher ?? { "@id": "https://www.aivideosugc.com/#organization" },
      inLanguage: "en",
      description: article.seo.description,
      dateModified: APPLY_DATE,
      datePublished: previousBlog?.datePublished ?? APPLY_DATE,
      mainEntityOfPage: `https://www.aivideosugc.com${article.slug}`
    });
    graph.push({
      "@type": "FAQPage",
      mainEntity: data.faq.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a }
      }))
    });
    for (const key of article.videos) {
      const clip = CLIPS[key];
      assert(clip, `Article ${article.slug} references unknown video key ${key}.`);
      graph.push({
        "@type": "VideoObject",
        name: `${clip.label} — AIVideosUGC example`,
        description: clip.alt,
        thumbnailUrl: clip.poster,
        contentUrl: clip.src,
        duration: `PT${clip.duration}S`,
        uploadDate: VIDEO_UPLOAD_DATE
      });
    }
    return {
      ...currentSeo,
      title: article.seo.title,
      description: article.seo.description,
      primaryKeyword: article.seo.primaryKeyword,
      keywords: article.seo.keywords,
      jsonLd: { "@graph": graph }
    };
  }

  function articleDataFor(article, row) {
    const current = row.contentJson.sections.v2_main.settings.data;
    const breadcrumbs = (current.breadcrumbs ?? []).map((crumb, index) =>
      index === (current.breadcrumbs?.length ?? 0) - 1 ? { ...crumb, label: article.label } : crumb
    );
    for (const section of article.data.sections) {
      for (const para of section.paras ?? []) {
        assert(!/\[[^\]]+\]\(https?:/.test(para), `Article ${article.slug} carries an external markdown link: ${para.slice(0, 80)}`);
      }
      if (section.prompt) {
        assert(section.prompt.label && section.prompt.title && section.prompt.body, `Prompt card incomplete on ${article.slug} / ${section.h2}.`);
        assert(!section.prompt.body.includes("${"), `Prompt body must not contain template literals: ${article.slug}.`);
      }
    }
    const sections = article.data.sections.map((section) => {
      const next = { h2: section.h2, paras: section.paras };
      if (section.img) next.img = img(section.img);
      if (section.video) next.video = section.video;
      if (section.prompt) next.prompt = section.prompt;
      return next;
    });
    const data = {
      ...current,
      label: article.label,
      eyebrow: article.data.eyebrow,
      lead: article.data.lead,
      minutes: article.data.minutes,
      h1: article.h1,
      sections,
      related: article.data.related,
      relatedLinks: article.data.related,
      tryBox: article.data.tryBox,
      faq: article.data.faq,
      ctaTitle: article.data.ctaTitle,
      ctaLead: article.data.ctaLead,
      startNote: article.data.startNote,
      breadcrumbs
    };
    if (article.data.checklist) data.checklist = article.data.checklist;
    else delete data.checklist;
    return data;
  }

  function indexDataFor(row) {
    const current = row.contentJson.sections.v2_main.settings.data;
    const articles = (current.articles ?? []).map((card) => {
      const patch = INDEX_PATCH.data.articles[card.href];
      assert(patch, `Index card ${card.href} has no rewrite in INDEX_PATCH.`);
      return { ...card, title: patch.title, summary: patch.summary };
    });
    assert.equal(articles.length, 5, "The blog index must keep its five published cards.");
    return {
      ...current,
      eyebrow: INDEX_PATCH.data.eyebrow,
      lead: INDEX_PATCH.data.lead,
      intro: INDEX_PATCH.data.intro,
      steps: INDEX_PATCH.data.steps,
      articles
    };
  }

  const plans = [];
  for (const article of ARTICLES) {
    const row = bySlug.get(article.slug);
    const data = articleDataFor(article, row);
    const seo = seoFor(article, row.contentJson.seo, data);
    const nextContentJson = structuredClone(row.contentJson);
    nextContentJson.sections.v2_main.settings.data = data;
    nextContentJson.seo = seo;
    plans.push({
      slug: article.slug,
      row,
      nextContentJson,
      nextTitle: seo.title,
      embeddedVideos: article.data.sections.filter((s) => s.video).length,
      promptCards: article.data.sections.filter((s) => s.prompt).length
    });
  }
  {
    const row = bySlug.get(INDEX_PATCH.slug);
    const nextContentJson = structuredClone(row.contentJson);
    nextContentJson.sections.v2_main.settings.data = indexDataFor(row);
    plans.push({ slug: INDEX_PATCH.slug, row, nextContentJson, nextTitle: row.title, embeddedVideos: 0, promptCards: 0 });
  }

  const baseHash = hash(plans.map((plan) => ({ slug: plan.slug, hash: hash(plan.row) })).sort((a, b) => (a.slug < b.slug ? -1 : 1)));
  const expectedHash = argumentValue("--base-hash");
  if (apply) assert.equal(expectedHash, baseHash, "The blog rows changed since the reviewed dry run; rerun the dry run and apply the new base hash.");

  const planReport = plans.map((plan) => {
    const currentData = plan.row.contentJson.sections.v2_main.settings.data;
    const nextData = plan.nextContentJson.sections.v2_main.settings.data;
    const changed = {
      data: stable(currentData) !== stable(nextData),
      seo: stable(plan.row.contentJson.seo) !== stable(plan.nextContentJson.seo),
      title: plan.row.title !== plan.nextTitle
    };
    return {
      slug: plan.slug,
      changed,
      nextTitle: plan.nextTitle,
      h1: nextData.h1 ?? undefined,
      sections: nextData.sections?.length ?? undefined,
      faqItems: nextData.faq?.length ?? undefined,
      embeddedVideos: plan.embeddedVideos,
      promptCards: plan.promptCards,
      nextHash: hash({ ...plan.row, contentJson: plan.nextContentJson, title: plan.nextTitle, updatedAt: plan.row.updatedAt })
    };
  });

  let writes = 0;
  if (apply) {
    for (const plan of plans) {
      const update = await db.livePage.updateMany({
        where: { id: plan.row.id, siteId, slug: plan.slug, updatedAt: plan.row.updatedAt },
        data: {
          contentJson: plan.nextContentJson,
          ...(plan.nextTitle && plan.row.title !== plan.nextTitle ? { title: plan.nextTitle } : {})
        }
      });
      assert.equal(update.count, 1, `Row changed during apply: ${plan.slug}.`);
      writes += update.count;
    }
    const readback = await db.livePage.findMany({
      where: { siteId, slug: { in: SLUGS } },
      select: { slug: true, contentJson: true, title: true, updatedAt: true }
    });
    for (const plan of plans) {
      const row = readback.find((candidate) => candidate.slug === plan.slug);
      const matches = row && stable(row.contentJson) === stable(plan.nextContentJson) && row.title === plan.nextTitle;
      assert(matches, `Readback mismatch on ${plan.slug}.`);
    }
  }

  const manifestDir = new URL("./manifests/", import.meta.url);
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = new URL(`./manifests/aivideosugc-blog-tutorials-${APPLY_DATE}.json`, import.meta.url);
  const manifest = {
    date: APPLY_DATE,
    siteId,
    target,
    mode: apply ? "applied" : "plan",
    baseHash,
    slugs: SLUGS,
    changes: plans.map((plan) => ({
      slug: plan.slug,
      originalContentJson: apply ? undefined : plan.row.contentJson
    })),
    note: "Tutorial rewrite; slugs, covers, inline images and canonicals unchanged. h1/seo titles move to the tutorial keywords per the reviewed v3 design draft. Originals for applied targets live in SiteContentRevision history and the committed v1 manifests."
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    baseHash,
    writes,
    manifest: manifestPath.pathname,
    pages: planReport
  }, null, 2));
} finally {
  await db.$disconnect();
}
