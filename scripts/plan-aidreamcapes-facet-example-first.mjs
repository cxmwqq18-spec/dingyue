#!/usr/bin/env node
// Plan the Aidreamcapes facet directory flip to example-first rendering
// (Step 4 of docs/aivideosugc-template-cases-navigation-plan.md).
//
// For every templateDirectory-bearing facet page:
//  1. templateDirectory.hideTemplates = true — the template registry (paths)
//     stays in the row (it is the only placement taxonomy source), but the
//     page renders no template grid and no template filter form.
//  2. The stored seo.jsonLd ItemList (template paths) is removed; example
//     detail URLs stay discoverable through the sitemap.
//
//   node --env-file=.env.local scripts/plan-aidreamcapes-facet-example-first.mjs --target=local
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
const CONTRACT = "aidreamcapes-facet-example-first-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || "local";
assert.ok(["local", "production"].includes(target), "--target must be local or production");

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
const select = { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true };

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { startsWith: "/" } },
    select
  });
  const operations = [];
  for (const row of rows) {
    const sections = row.contentJson?.sections;
    if (!sections || typeof sections !== "object") continue;
    const v2 = sections.v2_main;
    const directory = v2?.settings?.data?.templateDirectory;
    if (!directory || !Array.isArray(directory.paths)) continue;
    const graph = row.contentJson?.seo?.jsonLd?.["@graph"];
    assert(Array.isArray(graph), `${row.slug}: stored jsonLd @graph missing`);
    const hasItemList = graph.some((node) => node?.["@type"] === "ItemList");
    const needsFlag = directory.hideTemplates !== true;
    if (!needsFlag && !hasItemList) continue;
    const beforeHash = pageHash(row); // hash BEFORE any transform
    const removedItemList = graph
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => node?.["@type"] === "ItemList");
    const after = structuredClone(row.contentJson);
    after.sections.v2_main.settings.data.templateDirectory.hideTemplates = true;
    if (hasItemList) {
      after.seo.jsonLd["@graph"] = after.seo.jsonLd["@graph"].filter((node) => node?.["@type"] !== "ItemList");
    }
    operations.push({
      slug: row.slug,
      before: { hideTemplates: directory.hideTemplates ?? null, itemListNodes: graph.filter((node) => node?.["@type"] === "ItemList").length, pageHash: beforeHash },
      removedItemList,
      after: { contentJson: after }
    });
  }
  assert(operations.length > 0, "No templateDirectory rows need the example-first flip");

  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    operations
  };
  manifest.planHash = hash(operations.map(({ slug, before }) => ({ slug, before })));

  const manifestPath = path.resolve(process.cwd(), `scripts/manifests/aidreamcapes-facet-example-first-${target}-2026-10-30.json`);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, planHash: manifest.planHash, rows: operations.length }, null, 2));
} finally {
  await db.$disconnect();
}
