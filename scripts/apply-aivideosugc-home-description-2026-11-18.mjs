#!/usr/bin/env node
// AIVideosUGC homepage description update — 2026-11-18.
// Owner supplied a new homepage description. Only the three page-description
// fields change; title, keywords, canonical, robots, images and every other
// stored JSON-LD node remain byte-identical.
//   dry run:  node scripts/apply-aivideosugc-home-description-2026-11-18.mjs --target=production
//   apply:    ... --target=production --confirm=aivideosugc-home-description-2026-11-18 --apply
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-home-description-2026-11-18";
const manifest = JSON.parse(fs.readFileSync(new URL("./manifests/aivideosugc-home-description-2026-11-18.json", import.meta.url), "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const page = manifest.page;
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const baseHash = argumentValue("--base-hash");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);

assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

assert.equal(manifest.descriptionLength, manifest.description.length, "Manifest description length is stale.");
assert(Array.isArray(manifest.previousDescriptions) && manifest.previousDescriptions.length > 0, "Manifest must record the reviewed previous descriptions.");
assert(!manifest.previousDescriptions.includes(manifest.description), "The new description must differ from every reviewed previous value.");

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
// Every seo field except the description fields and the stored graph stays
// identical across the write.
function seoRestHash(seo) {
  const rest = { ...seo };
  delete rest.description;
  delete rest.twitterDescription;
  delete rest.jsonLd;
  return hash(rest);
}
// Every stored JSON-LD node except WebPage.description stays identical.
function graphRestHash(graph) {
  return hash(graph.map((node) => {
    if (!node || node["@type"] !== "WebPage") return node;
    const copy = { ...node };
    delete copy.description;
    return copy;
  }));
}

const db = new PrismaClient();
try {
  const row = await db.livePage.findUnique({
    where: { siteId_slug: { siteId, slug: page.slug } },
    select: { id: true, slug: true, contentJson: true, updatedAt: true }
  });
  assert(row, `LivePage ${page.slug} does not exist on ${target}.`);
  assert.equal(row.id, page.id, `LivePage ${page.slug} id changed; refusing to apply.`);
  if (baseHash) assert.equal(hash(row.contentJson), baseHash, `${page.slug} contentJson changed since the reviewed dry run; refusing to apply.`);

  const contentJson = structuredClone(row.contentJson);
  const seo = contentJson.seo;
  assert(seo && typeof seo === "object", "Homepage seo shape changed.");

  const graph = seo.jsonLd?.["@graph"];
  assert(Array.isArray(graph), "Homepage stored JSON-LD graph is missing.");
  const webPages = graph.filter((node) => node && node["@type"] === "WebPage");
  assert.equal(webPages.length, 1, `Expected exactly one stored WebPage node; found ${webPages.length}.`);
  const webPage = webPages[0];

  assert(manifest.previousDescriptions.includes(seo.description), "Homepage seo.description is not a reviewed previous value; refusing to apply.");
  assert(manifest.previousDescriptions.includes(seo.twitterDescription), "Homepage seo.twitterDescription is not a reviewed previous value; refusing to apply.");
  assert.equal(webPage.description, manifest.expectedCurrentWebPageDescription, "Stored WebPage.description is not the reviewed value; refusing to apply.");
  assert(
    webPage.name === manifest.expectedCurrentWebPageName || webPage.name === "AI UGC Video and Image Ads Generator | AIVideosUGC",
    "Stored WebPage.name changed; refusing to apply."
  );

  const titleBefore = seo.title;
  const keywordsBefore = seo.keywords;
  const seoRestBefore = seoRestHash(seo);
  const graphRestBefore = graphRestHash(graph);
  const previousDescriptionLength = seo.description.length;

  const alreadyApplied = seo.description === manifest.description
    && seo.twitterDescription === manifest.description
    && webPage.description === manifest.description;
  if (alreadyApplied) {
    console.log(JSON.stringify({
      ok: true,
      slug: page.slug,
      noop: true,
      descriptionLength: manifest.description.length,
      seoRestHash: seoRestBefore,
      graphRestHash: graphRestBefore
    }, null, 2));
    process.exit(0);
  }

  seo.description = manifest.description;
  seo.twitterDescription = manifest.description;
  webPage.description = manifest.description;

  if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      slug: page.slug,
      baseHash: hash(row.contentJson),
      previousDescriptionLength,
      nextDescriptionLength: manifest.description.length,
      plannedPaths: ["seo.description", "seo.twitterDescription", "seo.jsonLd.@graph[WebPage].description"],
      seoRestHash: seoRestBefore,
      graphRestHash: graphRestBefore
    }, null, 2));
    process.exit(0);
  }

  const updated = await db.livePage.update({
    where: { id: row.id },
    data: { contentJson },
    select: { id: true, slug: true, updatedAt: true }
  });
  const reread = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true } });
  const after = reread?.contentJson;
  assert(after, "Readback returned no row.");
  assert.equal(after.seo.description, manifest.description, "Readback mismatch on seo.description.");
  assert.equal(after.seo.twitterDescription, manifest.description, "Readback mismatch on seo.twitterDescription.");
  assert.equal(after.seo.title, titleBefore, "Readback changed seo.title.");
  assert.equal(after.seo.keywords, keywordsBefore, "Readback changed seo.keywords.");
  assert.equal(seoRestHash(after.seo), seoRestBefore, "Other seo fields changed; refusing to report success.");

  const afterGraph = after.seo.jsonLd?.["@graph"];
  assert(Array.isArray(afterGraph), "Readback lost the stored JSON-LD graph.");
  const afterWebPages = afterGraph.filter((node) => node && node["@type"] === "WebPage");
  assert.equal(afterWebPages.length, 1, "Readback lost the stored WebPage node.");
  assert.equal(afterWebPages[0].description, manifest.description, "Readback mismatch on stored WebPage.description.");
  assert.equal(afterWebPages[0].name, webPage.name, "Readback changed stored WebPage.name.");
  assert.equal(graphRestHash(afterGraph), graphRestBefore, "Other JSON-LD nodes changed; refusing to report success.");

  console.log(JSON.stringify({
    ok: true,
    applied: true,
    slug: page.slug,
    updatedAt: updated.updatedAt,
    previousDescriptionLength,
    nextDescriptionLength: manifest.description.length,
    nextContentHash: hash(after),
    seoRestHash: seoRestBefore,
    graphRestHash: graphRestBefore
  }, null, 2));
} finally {
  await db.$disconnect();
}
