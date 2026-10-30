#!/usr/bin/env node
// Plan the Aidreamcapes templateDefinition facet rectification (2026-10-30).
//
// Principle (拍板): a template's industry tag = the industry its demo card
// visibly demonstrates. Industry filters are visual browsing tools; the card
// is the evidence. This removes mismatches like the coffee-pouch packaging
// card appearing under Beauty & Personal Care.
//
// Operations in one manifest, applied by scripts/apply-aidreamcapes-template-facets.mjs:
//   1. set templateDefinition.industries on 12 template pages (reviewed table
//      below; platforms/occasions untouched);
//   2. set templateDirectory.paths on the existing facet pages so their
//      template grids match the rectified ownership (beauty-skincare,
//      fashion-clothing, shoes, jewelry-accessories, electronics,
//      health-wellness, food-drinks, home-living).
//
// professional-headshot keeps all three facet lists empty on purpose: team
// headshots are a B2B service, not a product industry.
//
//   node --env-file=.env.production scripts/plan-aidreamcapes-template-facets.mjs --target=production
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
const CONTRACT = "aidreamcapes-template-facets-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
assert.equal(target, process.env.DATABASE_TARGET, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-template-facets-${target}-2026-10-30.json`
);

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

// Reviewed mapping (2026-10-30). Card evidence in the comment.
const INDUSTRIES_SET = [
  // sage ceramic soap dispenser card
  { path: "/ai-image-generation/colorway-variations", after: ["/industries/home-living"] },
  // jewelry flat-lay card
  { path: "/ai-image-generation/jewelry-positioning", after: ["/industries/jewelry-accessories"] },
  // kraft coffee pouch card
  { path: "/ai-image-generation/packaging-mockup", after: ["/industries/food-drinks"] },
  // black speaker card
  { path: "/ai-image-generation/packshot-multi-angle", after: ["/industries/electronics"] },
  // suitcase-in-airport card: no luggage facet exists; leave industries empty
  { path: "/ai-image-generation/sale-campaign-key-visual", after: [] },
  // hot-sauce bottle card
  { path: "/ai-image-generation/story-ad-vertical", after: ["/industries/food-drinks"] },
  // after-workout water bottle card
  { path: "/ai-image-generation/ugc-still-ad", after: ["/industries/health-wellness", "/industries/sports-gym"] },
  // sage pump bottle with holiday lights card (fills the reviewed gap)
  { path: "/ai-video-generation/black-friday-countdown", after: ["/industries/beauty-skincare"] },
  // speaker-on-sideboard card
  { path: "/ai-video-generation/cinematic-video", after: ["/industries/electronics"] },
  // garment steamer pressing a shirt card
  { path: "/ai-video-generation/how-to-video", after: ["/industries/fashion-clothing"] },
  // canvas crossbody bag card
  { path: "/ai-video-generation/promo-video", after: ["/industries/fashion-clothing"] },
  // hiker with insulated bottle card (fills the reviewed gap)
  { path: "/ai-video-generation/spark-ads-style-video", after: ["/industries/sports-gym"] }
];

// Facet template grids re-derived from the rectified ownership.
const PATHS_SET = [
  { path: "/industries/beauty-skincare", after: ["/ai-video-generation/beauty-routine", "/ai-video-generation/black-friday-countdown"] },
  { path: "/industries/fashion-clothing", after: ["/ai-image-generation/virtual-try-on", "/ai-video-generation/fashion-try-on-reel", "/ai-video-generation/how-to-video", "/ai-video-generation/promo-video"] },
  { path: "/industries/shoes", after: [] },
  { path: "/industries/jewelry-accessories", after: ["/ai-image-generation/jewelry-positioning"] },
  { path: "/industries/electronics", after: ["/ai-image-generation/packshot-multi-angle", "/ai-video-generation/cinematic-video"] },
  { path: "/industries/health-wellness", after: ["/ai-image-generation/ugc-still-ad"] },
  { path: "/industries/food-drinks", after: ["/ai-image-generation/packaging-mockup", "/ai-image-generation/story-ad-vertical", "/ai-video-generation/food-video"] },
  { path: "/industries/home-living", after: ["/ai-video-generation/home-organization"] }
];

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const slugs = [...new Set([...INDUSTRIES_SET, ...PATHS_SET].map((entry) => entry.path))];
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: slugs } },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert.equal(rows.length, slugs.length, `Expected ${slugs.length} rows, found ${rows.length}.`);

  const pages = new Map();
  const entryOf = (slug) => {
    const row = rows.find((entry) => entry.slug === slug);
    assert(row, `LivePage ${slug} is missing.`);
    const entry = pages.get(slug) ?? { slug, baseHash: pageHash(row), sections: new Map() };
    pages.set(slug, entry);
    return entry;
  };

  for (const set of INDUSTRIES_SET) {
    const row = rows.find((entry) => entry.slug === set.path);
    const sections = row.contentJson?.sections ?? {};
    const keys = Object.keys(sections).filter((key) => sections[key]?.settings?.data?.templateDefinition);
    assert.equal(keys.length, 1, `Expected exactly one templateDefinition section on ${set.path}, found ${keys.length}.`);
    const key = keys[0];
    const definition = sections[key].settings.data.templateDefinition;
    const before = Array.isArray(definition.industries) ? [...definition.industries] : [];
    if (JSON.stringify(before) === JSON.stringify(set.after)) continue;
    const entry = entryOf(set.path);
    entry.sections.set(`${key}.settings.data.templateDefinition.industries`, {
      jsonPath: `sections.${key}.settings.data.templateDefinition.industries`,
      field: "industries",
      before,
      after: [...set.after],
      beforeHash: hash(before),
      afterHash: hash(set.after)
    });
  }
  for (const set of PATHS_SET) {
    const row = rows.find((entry) => entry.slug === set.path);
    const sections = row.contentJson?.sections ?? {};
    const keys = Object.keys(sections).filter((key) => sections[key]?.settings?.data?.templateDirectory);
    assert.equal(keys.length, 1, `Expected exactly one templateDirectory section on ${set.path}, found ${keys.length}.`);
    const key = keys[0];
    const directory = sections[key].settings.data.templateDirectory;
    const before = Array.isArray(directory.paths) ? [...directory.paths] : [];
    if (JSON.stringify(before) === JSON.stringify(set.after)) continue;
    const entry = entryOf(set.path);
    entry.sections.set(`${key}.settings.data.templateDirectory.paths`, {
      jsonPath: `sections.${key}.settings.data.templateDirectory.paths`,
      field: "paths",
      before,
      after: [...set.after],
      beforeHash: hash(before),
      afterHash: hash(set.after)
    });
  }

  const manifestPages = [...pages.values()].map((entry) => ({
    slug: entry.slug,
    baseHash: entry.baseHash,
    operations: [...entry.sections.values()].sort((a, b) => a.jsonPath.localeCompare(b.jsonPath))
  })).sort((a, b) => a.slug.localeCompare(b.slug));

  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    rule: "template industry tag = the industry its demo card demonstrates; facet template grids re-derived from the rectified ownership",
    summary: {
      pages: manifestPages.length,
      industriesOps: manifestPages.reduce((total, page) => total + page.operations.filter((op) => op.field === "industries").length, 0),
      pathsOps: manifestPages.reduce((total, page) => total + page.operations.filter((op) => op.field === "paths").length, 0)
    },
    pages: manifestPages,
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
