#!/usr/bin/env node
// AIVideosUGC stored JSON-LD markdown strip — 2026-11-18.
// Ten stored graphs carry raw inline markdown inside HowTo step.text and
// FAQPage acceptedAnswer.text; search systems read those strings literally.
// Only string leaves under seo.jsonLd change; every other byte of
// contentJson stays identical.
//   dry run:  node scripts/apply-aivideosugc-jsonld-markdown-strip-2026-11-18.mjs --target=production
//   apply:    ... --target=production --confirm=aivideosugc-jsonld-markdown-strip-2026-11-18 --apply
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-jsonld-markdown-strip-2026-11-18";
const manifest = JSON.parse(fs.readFileSync(new URL("./manifests/aivideosugc-jsonld-markdown-strip-2026-11-18.json", import.meta.url), "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);

assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

const LINK_RE = /\[([^\]\n]+)\]\((?:https:\/\/[^)\s]+|mailto:[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|\/[^)\s]*)\)/gi;
const BOLD_RE = /\*\*([^*\n]+)\*\*/g;
const CODE_RE = /`([^`\n]+)`/g;

function countMarkdownHits(value) {
  return (value.match(LINK_RE)?.length ?? 0) + (value.match(BOLD_RE)?.length ?? 0) + (value.match(CODE_RE)?.length ?? 0);
}
// Same semantics as the storefront RichText renderer: a link degrades to its
// label text, bold and code markers unwrap to their contents.
function stripInlineMarkdown(value) {
  return value
    .replace(LINK_RE, "$1")
    .replace(BOLD_RE, "$1")
    .replace(CODE_RE, "$1");
}

function walkStrings(node, path, visit) {
  if (typeof node === "string") {
    visit(node, path);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((item, index) => walkStrings(item, [...path, String(index)], visit));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) walkStrings(value, [...path, key], visit);
  }
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
// Everything outside seo.jsonLd must stay byte-identical across the write.
function contentRestHash(contentJson) {
  const rest = structuredClone(contentJson);
  delete rest.seo?.jsonLd;
  return hash(rest);
}
// Non-string seo.jsonLd shape (node types, keys, arrays) must stay identical.
function graphShapeHash(graph) {
  return hash(graph.map((node) => {
    if (!node || typeof node !== "object") return node;
    const shape = {};
    for (const [key, value] of Object.entries(node)) shape[key] = typeof value === "string" ? "__string__" : Array.isArray(value) ? value.map((item) => typeof item === "string" ? "__string__" : (item && typeof item === "object" ? Object.fromEntries(Object.entries(item).map(([k, v]) => [k, typeof v === "string" ? "__string__" : v])) : v)) : value;
    return shape;
  }));
}

const db = new PrismaClient();
try {
  let totalHits = 0;
  const planned = [];
  for (const page of manifest.pages) {
    const row = await db.livePage.findUnique({
      where: { siteId_slug: { siteId, slug: page.slug } },
      select: { id: true, slug: true, contentJson: true }
    });
    assert(row, `LivePage ${page.slug} does not exist on ${target}.`);
    assert.equal(row.id, page.id, `LivePage ${page.slug} id changed; refusing to apply.`);

    const graph = row.contentJson?.seo?.jsonLd?.["@graph"];
    assert(Array.isArray(graph), `${page.slug}: stored seo.jsonLd.@graph is missing.`);
    const graphHashBefore = graphShapeHash(graph);
    const restHashBefore = contentRestHash(row.contentJson);

    let hits = 0;
    const contentJson = structuredClone(row.contentJson);
    const graphNext = contentJson.seo.jsonLd["@graph"];
    // Paths are relative to @graph; resolve leaf containers against graphNext.
    walkStrings(graph, [], (value, path) => {
      const found = countMarkdownHits(value);
      if (!found) return;
      const stripped = stripInlineMarkdown(value);
      assert(stripped.trim().length > 0, `${page.slug}: stripping ${path.join(".")} would empty the string.`);
      hits += found;
      let container = graphNext;
      for (const key of path.slice(0, -1)) container = Array.isArray(container) ? container[Number(key)] : container[key];
      const leaf = path[path.length - 1];
      if (Array.isArray(container)) container[Number(leaf)] = stripped;
      else container[leaf] = stripped;
    });
    assert.equal(hits, page.expectedMarkdownHits, `${page.slug}: found ${hits} markdown hits, manifest expects ${page.expectedMarkdownHits}; refusing to apply.`);
    assert.equal(graphShapeHash(graphNext), graphHashBefore, `${page.slug}: jsonLd shape would change; refusing to apply.`);
    assert.equal(contentRestHash(contentJson), restHashBefore, `${page.slug}: content outside seo.jsonLd would change; refusing to apply.`);

    totalHits += hits;
    planned.push({ slug: page.slug, id: row.id, hits, restHashBefore, graphHashBefore, contentJson });
  }
  assert.equal(totalHits, manifest.expectedTotalMarkdownHits, `Total hits ${totalHits} != manifest ${manifest.expectedTotalMarkdownHits}; refusing to apply.`);

  if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      pages: planned.map((p) => ({ slug: p.slug, hits: p.hits, restHash: p.restHashBefore }))
    }, null, 2));
    process.exit(0);
  }

  const results = [];
  for (const plan of planned) {
    const updated = await db.livePage.update({
      where: { id: plan.id },
      data: { contentJson: plan.contentJson },
      select: { id: true, slug: true, updatedAt: true }
    });
    const reread = await db.livePage.findUnique({ where: { id: plan.id }, select: { contentJson: true } });
    assert(reread, `${plan.slug}: readback returned no row.`);
    let remaining = 0;
    walkStrings(reread.contentJson?.seo?.jsonLd?.["@graph"] ?? [], [], (value) => { remaining += countMarkdownHits(value); });
    assert.equal(remaining, 0, `${plan.slug}: readback still contains markdown hits.`);
    assert.equal(contentRestHash(reread.contentJson), plan.restHashBefore, `${plan.slug}: readback changed content outside seo.jsonLd.`);
    results.push({ slug: plan.slug, updatedAt: updated.updatedAt });
  }

  console.log(JSON.stringify({ ok: true, applied: true, pages: results }, null, 2));
} finally {
  await db.$disconnect();
}
