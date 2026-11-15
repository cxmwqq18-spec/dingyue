#!/usr/bin/env node
// Guides portal release for site_aidreamcapes:
//   1. /guides is rewritten from the 12-chapter tutorial into the portal hub
//      (layout "guides-hub"), a field-level change to the single row:
//        - LivePage.title
//        - contentJson.sections.v2_main  (old value in manifest)
//        - contentJson.seo               (old value in manifest)
//   2. /guides/workspace-guide is created, carrying the untouched 12-chapter
//      section from the old /guides row plus its own SEO + JSON-LD graph.
//   3. Eight /guides/how-do-* tutorial rows are created (one per workspace
//      CREATE tool, layout "guides-howto").
// The old /guides slug never 404s: it becomes the hub and links to the moved
// guide. Sitemap entries follow the LivePage rows automatically.
// Restore: --restore reverts /guides from the manifest and deletes created
// rows that still carry this release's contentContract.sourceRevision.
// Dry run by default. Apply with:
//   DATABASE_TARGET=production node scripts/apply-aidreamcapes-guides-hub-release.mjs \
//     --apply --confirm=site_aidreamcapes-guides-hub-release --base-hash=<hash from dry run>
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, hasArgument } from "./lib/database-target.mjs";

const siteId = "site_aidreamcapes";
const hubSlug = "/guides";
const releaseDate = "2026-11-15";
const sourceRevision = `aidreamcapes-guides-hub-release-${releaseDate}`;
const confirmToken = "site_aidreamcapes-guides-hub-release";
const manifestPath = `scripts/manifests/aidreamcapes-guides-hub-production-${releaseDate}.json`;
const origin = "https://www.aivideosugc.com";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert.ok(target === "local" || target === "production", "Set DATABASE_TARGET=local or DATABASE_TARGET=production.");
const production = target === "production";
const apply = hasArgument("--apply");
const restore = hasArgument("--restore");
const confirm = argumentValue("--confirm");
if (apply) {
  assert.equal(confirm, confirmToken, `Apply requires --confirm=${confirmToken}.`);
  assert.ok(argumentValue("--base-hash"), "Apply requires --base-hash=<hash from dry run>.");
}

const payload = JSON.parse(fs.readFileSync("scripts/data/aidreamcapes-guides-hub-release.json", "utf8"));
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
// jsonb does not preserve key order, so content equality is compared over a
// canonical (recursively key-sorted) form instead of the raw stringify.
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, entry]) => [key, canonical(entry)]));
  }
  return value;
};
const contentHash = (value) => hash(canonical(value ?? null));
const schemaName = (title) => title.replace(/ \| AIVideosUGC$/, "");
const withoutTrailingPeriod = (value) => value.replace(/\.$/, "");

const organizationRef = { "@id": `${origin}/#organization` };
const websiteRef = { "@id": `${origin}/#website` };

function articleNode(url, name, description) {
  return {
    "@type": "Article",
    "@id": `${url}#article`,
    headline: schemaName(name),
    description,
    url,
    inLanguage: "en",
    author: organizationRef,
    publisher: organizationRef,
    mainEntityOfPage: { "@id": `${url}#webpage` }
  };
}

function faqNode(url, faq) {
  if (!faq?.length) return undefined;
  return {
    "@type": "FAQPage",
    "@id": `${url}#faq`,
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a }
    }))
  };
}

function howtoGraph(item) {
  const url = origin + item.slug;
  const howto = item.data.howto;
  const graph = [
    articleNode(url, item.title, howto.lead),
    {
      "@type": "HowTo",
      "@id": `${url}#howto`,
      name: withoutTrailingPeriod(howto.h1),
      description: howto.lead,
      url,
      inLanguage: "en",
      image: { "@type": "ImageObject", url: origin + item.seo.ogImage, caption: item.seo.ogImageAlt },
      step: howto.steps.map((step) => ({
        "@type": "HowToStep",
        name: step.title,
        text: step.body
      }))
    },
    faqNode(url, howto.faq)
  ].filter(Boolean);
  return graph;
}

function workspaceGuideGraph(chapters) {
  const url = `${origin}/guides/workspace-guide`;
  const seo = payload.workspaceGuide.seo;
  return [
    articleNode(url, seo.title, seo.description),
    {
      "@type": "ItemList",
      "@id": `${url}#chapters`,
      name: "Workspace guide chapters",
      itemListElement: chapters.map((chapter, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: chapter.title,
        url: `${url}#${chapter.id}`
      }))
    }
  ];
}

function contentContract() {
  return { seoSource: "LivePage.contentJson", mediaSource: "LivePage.contentJson", sourceRevision };
}

function newRowJson(item, layout) {
  return {
    version: 2,
    pageType: "content",
    contentContract: contentContract(),
    seo: {
      index: true,
      robots: { index: true, follow: true, maxImagePreview: "large" },
      canonicalPath: item.slug,
      canonical: origin + item.slug,
      ...item.seo,
      jsonLd: { "@graph": howtoGraph(item) }
    },
    sectionsOrder: ["v2_main"],
    sections: { v2_main: { type: "aidreamcapes_v2_page", settings: { layout, data: item.data } } }
  };
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true } });
  assert.ok(site && site.slug === "aidreamcapes", "Aidreamcapes target not found; refusing a cross-store write.");

  const hubRow = await prisma.livePage.findFirst({
    where: { siteId, slug: hubSlug },
    select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true }
  });
  assert.ok(hubRow, `LivePage ${hubSlug} not found for ${siteId}.`);
  const baseHash = contentHash(hubRow.contentJson);
  const baseSection = hubRow.contentJson?.sections?.v2_main;
  const baseSeo = hubRow.contentJson?.seo;
  assert.equal(baseSection?.type, "aidreamcapes_v2_page", `Unexpected section type on ${hubSlug}.`);
  assert.ok(baseSeo, "contentJson.seo missing; refusing to guess the SEO shape.");

  if (restore) {
    assert.ok(production, "--restore is production-only.");
    const saved = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(saved.baseHashApplied, saved.baseHash, "Manifest base hash mismatch.");
    const revertedJson = {
      ...hubRow.contentJson,
      seo: saved.original.seo,
      sections: { ...hubRow.contentJson.sections, v2_main: saved.original.section }
    };
    const createdSlugs = [
      payload.workspaceGuide.slug,
      ...payload.howTos.map((item) => item.slug)
    ];
    const createdRows = await prisma.livePage.findMany({
      where: { siteId, slug: { in: createdSlugs } },
      select: { id: true, slug: true, contentJson: true }
    });
    const deletable = createdRows.filter((row) => row.contentJson?.contentContract?.sourceRevision === sourceRevision);
    const foreign = createdRows.filter((row) => row.contentJson?.contentContract?.sourceRevision !== sourceRevision);
    assert.equal(foreign.length, 0, `Refusing to restore: rows not created by this release: ${foreign.map((row) => row.slug).join(", ")}`);
    console.log(JSON.stringify({ ok: true, mode: "restore", reverts: { slug: hubSlug, title: saved.original.title }, deletes: deletable.map((row) => row.id) }, null, 2));
    if (apply) {
      await prisma.$transaction(async (tx) => {
        await tx.livePage.update({ where: { id: hubRow.id }, data: { title: saved.original.title, contentJson: revertedJson } });
        await tx.livePage.deleteMany({ where: { id: { in: deletable.map((row) => row.id) } } });
      }, { isolationLevel: "Serializable", timeout: 120_000, maxWait: 30_000 });
      console.log(JSON.stringify({ restored: true }, null, 2));
    }
    process.exit(0);
  }

  // Build the planned rows against the current relational state.
  const guideSection = baseSection.settings?.layout === "guides"
    ? baseSection
    : (await prisma.livePage.findFirst({
        where: { siteId, slug: payload.workspaceGuide.slug },
        select: { contentJson: true }
      }))?.contentJson?.sections?.v2_main;
  const chapters = guideSection?.settings?.data?.guide?.chapters ?? [];
  assert.ok(chapters.length === 12, `Expected 12 guide chapters, found ${chapters.length}.`);

  const workspaceGuideJson = {
    ...hubRow.contentJson,
    contentContract: contentContract(),
    seo: {
      ...baseSeo,
      ...payload.workspaceGuide.seo,
      canonicalPath: payload.workspaceGuide.slug,
      canonical: origin + payload.workspaceGuide.slug,
      jsonLd: { "@graph": workspaceGuideGraph(chapters) }
    },
    sections: {
      ...hubRow.contentJson.sections,
      v2_main: guideSection
    }
  };
  const hubJson = {
    ...hubRow.contentJson,
    seo: {
      ...baseSeo,
      ...payload.hub.seo,
      jsonLd: { "@graph": payload.hub.jsonLd }
    },
    sections: {
      ...hubRow.contentJson.sections,
      v2_main: { type: "aidreamcapes_v2_page", settings: { layout: "guides-hub", data: payload.hub.data } }
    }
  };
  const createdRows = [
    { id: payload.workspaceGuide.id, slug: payload.workspaceGuide.slug, title: payload.workspaceGuide.title, contentJson: workspaceGuideJson },
    ...payload.howTos.map((item) => ({ id: item.id, slug: item.slug, title: item.title, contentJson: newRowJson(item, "guides-howto") }))
  ];

  const hubAlreadyApplied = baseSection.settings?.layout === "guides-hub"
    && contentHash(hubRow.contentJson) === contentHash(hubJson)
    && hubRow.title === payload.hub.title;
  const manifestNeeded = !hubAlreadyApplied;

  const conflicting = await prisma.livePage.findMany({
    where: { siteId, slug: { in: createdRows.map((row) => row.slug) } },
    select: { slug: true, contentJson: true }
  });
  const conflictingBySlug = new Map(conflicting.map((row) => [row.slug, row.contentJson]));
  const pendingCreates = createdRows.filter((row) => {
    const existing = conflictingBySlug.get(row.slug);
    if (existing === undefined) return true;
    if (row.slug === payload.workspaceGuide.slug && !manifestNeeded) {
      // The workspace-guide row carries the pre-release /guides section, which
      // cannot be recomputed from the rewritten hub row. Verify by shape.
      assert.equal(existing?.sections?.v2_main?.settings?.layout, "guides", `Target route ${row.slug} exists but no longer carries the 12-chapter section; refusing to continue.`);
      return false;
    }
    if (existing?.contentContract?.sourceRevision === sourceRevision) {
      // Rows created by this same release can be refreshed in place while the
      // release is being iterated on; anything else is refused.
      return true;
    }
    assert.ok(
      contentHash(existing) === contentHash(row.contentJson),
      `Target route ${row.slug} already exists with different content and was not created by this release; refusing to overwrite.`
    );
    return false;
  });

  if (!hubAlreadyApplied) {
    const currentLayout = baseSection.settings?.layout;
    assert.ok(
      currentLayout === "guides" || currentLayout === "guides-hub",
      `Precondition failed: ${hubSlug} layout is "${currentLayout}", expected "guides" (the 12-chapter tutorial) or "guides-hub" (written by this release).`
    );
  }

  const manifest = manifestNeeded ? {
    siteId,
    release: sourceRevision,
    capturedAt: new Date().toISOString(),
    target: production ? "production" : "local",
    baseHash,
    baseHashApplied: apply ? argumentValue("--base-hash") : baseHash,
    original: {
      slug: hubSlug,
      title: hubRow.title,
      section: baseSection,
      seo: baseSeo
    },
    created: createdRows.map((row) => ({ id: row.id, slug: row.slug, title: row.title }))
  } : undefined;

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    target,
    site: { id: site.id, slug: site.slug },
    casBaseHash: baseHash,
    hubAlreadyApplied,
    rewrite: manifestNeeded ? { slug: hubSlug, title: payload.hub.title, layout: "guides-hub", newContentHash: contentHash(hubJson) } : null,
    create: pendingCreates.map((row) => ({ id: row.id, slug: row.slug, title: row.title, contentHash: contentHash(row.contentJson) })),
    alreadySatisfied: createdRows.length - pendingCreates.length,
    jsonLd: {
      hubGraph: hubJson.seo.jsonLd["@graph"].map((node) => node["@type"]),
      workspaceGuideGraph: workspaceGuideJson.seo.jsonLd["@graph"].map((node) => node["@type"]),
      howToGraphShapes: payload.howTos.map((item) => ({ slug: item.slug, types: howtoGraph(item).map((node) => node["@type"]) }))
    },
    manifestPath: manifestNeeded ? manifestPath : null,
    manifestWritten: false
  }, null, 2));

  if (apply) {
    assert.equal(argumentValue("--base-hash"), baseHash, "--base-hash does not match the current row state; rerun the dry run.");
    if (production && manifestNeeded) {
      // The manifest records the pre-release /guides row, which only exists once.
      // A later content revision of the same release must keep the original
      // capture instead of overwriting the rollback reference.
      if (fs.existsSync(manifestPath)) {
        console.log(`Manifest already captured, keeping the original rollback reference: ${manifestPath}`);
      } else {
        fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
        console.log(`Manifest written: ${manifestPath}`);
      }
    }
    await prisma.$transaction(async (tx) => {
      const current = await tx.livePage.findFirst({ where: { siteId, slug: hubSlug }, select: { id: true, contentJson: true } });
      assert.ok(current && contentHash(current.contentJson) === baseHash, "CAS check failed inside the transaction; /guides changed concurrently.");
      if (manifestNeeded) {
        await tx.livePage.update({ where: { id: hubRow.id }, data: { title: payload.hub.title, contentJson: hubJson } });
      }
      if (pendingCreates.length) {
        for (const row of pendingCreates) {
          await tx.livePage.upsert({
            where: { siteId_slug: { siteId, slug: row.slug } },
            create: { ...row, siteId, pageType: "content", templateKey: "aidreamcapes-v2" },
            update: { title: row.title, contentJson: row.contentJson }
          });
        }
      }
    }, { isolationLevel: "Serializable", timeout: 120_000, maxWait: 30_000 });

    const readback = await prisma.livePage.findMany({
      where: { siteId, slug: { in: [hubSlug, ...createdRows.map((row) => row.slug)] } },
      select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true },
      orderBy: { slug: "asc" }
    });
    const readbackMap = new Map(readback.map((row) => [row.slug, row]));
    const verification = {
      hub: { slug: hubSlug, layout: readbackMap.get(hubSlug)?.contentJson?.sections?.v2_main?.settings?.layout, hashMatches: contentHash(readbackMap.get(hubSlug)?.contentJson) === contentHash(hubJson), titleMatches: readbackMap.get(hubSlug)?.title === payload.hub.title },
      created: createdRows.map((row) => ({ slug: row.slug, exists: readbackMap.has(row.slug), hashMatches: contentHash(readbackMap.get(row.slug)?.contentJson) === contentHash(row.contentJson) }))
    };
    const allOk = verification.hub.layout === "guides-hub" && verification.hub.hashMatches && verification.hub.titleMatches
      && verification.created.every((entry) => entry.exists && entry.hashMatches);
    console.log(JSON.stringify({ applied: true, verified: allOk, readback: verification }, null, 2));
    if (!allOk) {
      console.error("Readback verification FAILED — inspect the rows before declaring the release complete.");
      process.exitCode = 1;
    }
  }
} finally {
  await prisma.$disconnect();
}
