#!/usr/bin/env node
// AIVideosUGC blog redesign apply — 2026-11-10.
// Rewrites the five published blog articles and the /blog index copy against
// the current workspace, embedding real example clips (section.video) and
// refreshed SEO metadata. Slugs, covers, inline images and canonical URLs all
// stay exactly as published (google-indexed-url-safety: content-only change).
//
//   dry run:  node scripts/apply-aivideosugc-blog-redesign.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-blog-redesign.mjs --target=local --apply
//   production apply additionally requires the combined --base-hash printed
//   by the reviewed dry run and the explicit confirm name.
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { ARTICLES, INDEX_PATCH, APPLY_DATE, VIDEO_UPLOAD_DATE, CLIPS } from "./lib/aivideosugc-blog-redesign-2026-11-10.mjs";

const CONFIRM_NAME = "aivideosugc-blog-redesign-2026-11-10";
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

  // Harvest every published V2Image by src so the rewritten sections reuse the
  // exact same media contract (alt/sizes/srcSet) as the live pages.
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

  function videoObject(key) {
    const clip = CLIPS[key];
    assert(clip, `Unknown video key ${key} in the content module.`);
    return clip;
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
        item: index === data.breadcrumbs.length - 1
          ? `https://www.aivideosugc.com${data.breadcrumbs[data.breadcrumbs.length - 1].href}`
          : `https://www.aivideosugc.com${crumb.href}`
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
      const clip = videoObject(key);
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
      jsonLd: { "@graph": graph }
    };
  }

  function articleDataFor(article, row) {
    const current = row.contentJson.sections.v2_main.settings.data;
    assert.equal(current.h1, article.h1, `H1 drift on ${row.slug}: the published headline must stay as indexed.`);
    const breadcrumbs = (current.breadcrumbs ?? []).map((crumb, index) =>
      index === (current.breadcrumbs?.length ?? 0) - 1 ? { ...crumb, label: article.label } : crumb
    );
    const sections = article.data.sections.map((section) => {
      const next = { h2: section.h2, paras: section.paras };
      if (section.img) next.img = img(section.img);
      if (section.video) next.video = section.video;
      return next;
    });
    const data = {
      ...current,
      label: article.label,
      eyebrow: article.data.eyebrow,
      lead: article.data.lead,
      minutes: article.data.minutes,
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
      const summary = INDEX_PATCH.data.articlesSummary[card.href];
      assert(summary, `Index card ${card.href} has no rewrite in INDEX_PATCH.`);
      return { ...card, summary };
    });
    assert.equal(articles.length, 5, "The blog index must keep its five published cards.");
    return {
      ...current,
      eyebrow: INDEX_PATCH.data.eyebrow,
      lead: INDEX_PATCH.data.lead,
      intro: INDEX_PATCH.data.intro,
      steps: [
        { t: "Pick the Article", d: "Choose the guide for the file you need, then follow its steps with your own product photo." },
        { t: "Watch a Real Example", d: "Every guide embeds real clips generated on the site, with the prompts behind them." },
        { t: "Make One File and Check It", d: "Open the workspace tool, make the file, review it against the real product, then publish." }
      ],
      articles
    };
  }

  const plans = [];
  for (const article of ARTICLES) {
    const row = bySlug.get(article.slug);
    const current = row.contentJson.sections.v2_main.settings.data;
    const data = articleDataFor(article, row);
    const seo = seoFor(article, row.contentJson.seo, data);
    const nextContentJson = structuredClone(row.contentJson);
    nextContentJson.sections.v2_main.settings.data = data;
    nextContentJson.seo = seo;
    plans.push({
      slug: article.slug,
      row,
      nextContentJson,
      embeddedVideos: article.data.sections.filter((s) => s.video).length
    });
  }
  {
    const row = bySlug.get(INDEX_PATCH.slug);
    const nextContentJson = structuredClone(row.contentJson);
    nextContentJson.sections.v2_main.settings.data = indexDataFor(row);
    plans.push({ slug: INDEX_PATCH.slug, row, nextContentJson, embeddedVideos: 0 });
  }

  const baseHash = hash(plans.map((plan) => ({ slug: plan.slug, hash: hash(plan.row) })).sort((a, b) => (a.slug < b.slug ? -1 : 1)));
  const expectedHash = argumentValue("--base-hash");
  if (apply) assert.equal(expectedHash, baseHash, "The blog rows changed since the reviewed dry run; rerun the dry run and apply the new base hash.");

  const planReport = plans.map((plan) => {
    const currentData = plan.row.contentJson.sections.v2_main.settings.data;
    const nextData = plan.nextContentJson.sections.v2_main.settings.data;
    const changed = {
      data: stable(currentData) !== stable(nextData),
      seo: stable(plan.row.contentJson.seo) !== stable(plan.nextContentJson.seo)
    };
    return {
      slug: plan.slug,
      changed,
      sections: nextData.sections?.length ?? undefined,
      faqItems: nextData.faq?.length ?? undefined,
      embeddedVideos: plan.embeddedVideos,
      nextHash: hash({ ...plan.row, contentJson: plan.nextContentJson, updatedAt: plan.row.updatedAt })
    };
  });

  let writes = 0;
  if (apply) {
    for (const plan of plans) {
      const update = await db.livePage.updateMany({
        where: { id: plan.row.id, siteId, slug: plan.slug, updatedAt: plan.row.updatedAt },
        data: { contentJson: plan.nextContentJson }
      });
      assert.equal(update.count, 1, `Row changed during apply: ${plan.slug}.`);
      writes += update.count;
    }
    const readback = await db.livePage.findMany({
      where: { siteId, slug: { in: SLUGS } },
      select: { slug: true, contentJson: true, updatedAt: true }
    });
    for (const plan of plans) {
      const row = readback.find((candidate) => candidate.slug === plan.slug);
      assert(row && stable(row.contentJson) === stable(plan.nextContentJson), `Readback mismatch on ${plan.slug}.`);
    }
  }

  const manifestDir = new URL("./manifests/", import.meta.url);
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = new URL(`./manifests/aivideosugc-blog-redesign-${APPLY_DATE}.json`, import.meta.url);
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
    note: "Content-only rewrite; slugs, covers, inline images and canonicals unchanged. Originals for applied targets live in SiteContentRevision history."
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
