#!/usr/bin/env node
// Plan the ItemList repair for the eight original Aidreamcapes industry facet
// pages (2026-10-30, round 2 of the template-facet rectification).
//
// The stored SEO graph of these pages hardcodes an ItemList of the template
// paths they listed before the demo-card rectification. After
// aidreamcapes-template-facets-2026-10-30-v1 the visible template grids follow
// templateDirectory.paths, so the stored ItemList would describe templates the
// page no longer lists. This plan rebuilds each ItemList from the current
// templateDirectory.paths (name = the template page label) and drops the node
// entirely where no templates remain (shoes).
//
//   node --env-file=.env.production scripts/plan-aidreamcapes-facet-itemlist.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-facet-itemlist-2026-10-30-v1";
const ORIGIN = "https://www.aivideosugc.com";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
assert.equal(target, process.env.DATABASE_TARGET, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-facet-itemlist-${target}-2026-10-30.json`
);

// The reviewed outcome of aidreamcapes-template-facets-2026-10-30-v1.
const EXPECTED_PATHS = {
  "/industries/beauty-skincare": ["/ai-video-generation/beauty-routine", "/ai-video-generation/black-friday-countdown"],
  "/industries/fashion-clothing": ["/ai-image-generation/virtual-try-on", "/ai-video-generation/fashion-try-on-reel", "/ai-video-generation/how-to-video", "/ai-video-generation/promo-video"],
  "/industries/shoes": [],
  "/industries/jewelry-accessories": ["/ai-image-generation/jewelry-positioning"],
  "/industries/electronics": ["/ai-image-generation/packshot-multi-angle", "/ai-video-generation/cinematic-video"],
  "/industries/health-wellness": ["/ai-image-generation/ugc-still-ad"],
  "/industries/food-drinks": ["/ai-image-generation/packaging-mockup", "/ai-image-generation/story-ad-vertical", "/ai-video-generation/food-video"],
  "/industries/home-living": ["/ai-video-generation/home-organization"]
};

function stable(value) {
  if (value === undefined) return '"<undefined>"';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function pageHash(row) {
  return hash({
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    title: row.title,
    pageType: row.pageType,
    templateKey: row.templateKey,
    contentJson: row.contentJson,
    updatedAt: row.updatedAt
  });
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const facetSlugs = Object.keys(EXPECTED_PATHS);
  const templatePaths = [...new Set(Object.values(EXPECTED_PATHS).flat())];
  const [facetRows, templateRows] = await Promise.all([
    db.livePage.findMany({
      where: { siteId: SITE_ID, slug: { in: facetSlugs } },
      select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
    }),
    db.livePage.findMany({
      where: { siteId: SITE_ID, slug: { in: templatePaths } },
      select: { slug: true, title: true, contentJson: true }
    })
  ]);
  assert.equal(facetRows.length, facetSlugs.length, `Expected ${facetSlugs.length} facet rows, found ${facetRows.length}.`);
  assert.equal(templateRows.length, templatePaths.length, `Expected ${templatePaths.length} template rows, found ${templateRows.length}.`);

  const templateLabel = new Map(templateRows.map((row) => {
    const sections = row.contentJson?.sections ?? {};
    const data = Object.values(sections).map((section) => section?.settings?.data).find((entry) => entry?.templateDefinition);
    return [row.slug, (typeof data?.label === "string" && data.label.trim()) || row.title];
  }));

  const pages = [];
  for (const slug of facetSlugs) {
    const row = facetRows.find((entry) => entry.slug === slug);
    const sections = row.contentJson?.sections ?? {};
    const keys = Object.keys(sections).filter((key) => sections[key]?.settings?.data?.templateDirectory);
    assert.equal(keys.length, 1, `Expected exactly one templateDirectory section on ${slug}, found ${keys.length}.`);
    const currentPaths = sections[keys[0]].settings.data.templateDirectory.paths;
    assert.deepEqual(
      [...currentPaths].sort(),
      [...EXPECTED_PATHS[slug]].sort(),
      `templateDirectory.paths on ${slug} differs from the reviewed rectification outcome; re-run the round-1 plan or resolve the online edit first.`
    );
    const graph = row.contentJson?.seo?.jsonLd?.["@graph"];
    assert(Array.isArray(graph) && graph.some((node) => node?.["@type"] === "ItemList"), `Stored jsonLd @graph with an ItemList is missing on ${slug}.`);
    const index = graph.findIndex((node) => node?.["@type"] === "ItemList");
    const nextGraph = EXPECTED_PATHS[slug].length
      ? graph.map((node, position) => position === index ? {
          "@type": "ItemList",
          numberOfItems: EXPECTED_PATHS[slug].length,
          itemListElement: EXPECTED_PATHS[slug].map((templatePath, itemPosition) => ({
            "@type": "ListItem",
            position: itemPosition + 1,
            url: `${ORIGIN}${templatePath}`,
            name: templateLabel.get(templatePath)
          }))
        } : node)
      : graph.filter((_, position) => position !== index);
    if (stable(nextGraph) === stable(graph)) continue;
    pages.push({
      slug,
      baseHash: pageHash(row),
      operations: [{
        jsonPath: "seo.jsonLd.@graph",
        field: "itemList",
        before: graph,
        after: nextGraph,
        beforeHash: hash(graph),
        afterHash: hash(nextGraph)
      }]
    });
  }

  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    rule: "stored facet ItemList follows templateDirectory.paths; dropped when no templates remain",
    summary: { pages: pages.length, itemListsRebuilt: pages.filter((page) => page.operations[0].after.some((node) => node?.["@type"] === "ItemList")).length, itemListsDropped: pages.filter((page) => !page.operations[0].after.some((node) => node?.["@type"] === "ItemList")).length },
    pages,
    operations: [],
    addresses: []
  };
  manifest.planHash = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    summary: manifest.summary,
    pages: manifest.pages,
    operations: manifest.operations,
    addresses: manifest.addresses
  });

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    mode: "plan",
    contract: CONTRACT,
    target,
    manifestPath,
    planHash: manifest.planHash,
    summary: manifest.summary
  }, null, 2));
} finally {
  await db.$disconnect();
}
