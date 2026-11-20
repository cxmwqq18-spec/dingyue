#!/usr/bin/env node
// Remove stored VideoObject nodes from AIVideosUGC blog LivePage JSON-LD.
//
// The code release stopped generating VideoObject on non-watch pages, but five
// blog rows still carry a VideoObject in their stored
// `contentJson.seo.jsonLd["@graph"]`. Those nodes are content, not code: this
// manifest removes only the VideoObject entries, with a compare-and-set on the
// row's updatedAt so an online edit always wins.
//
// Run from the current production release directory (so loadRuntimeEnv reads
// the production .env.local):
//
//   node scripts/remove-aidreamcapes-blog-video-objects.mjs
//   node scripts/remove-aidreamcapes-blog-video-objects.mjs --apply-production \
//     --confirm=remove-aidreamcapes-blog-video-objects
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=remove-aidreamcapes-blog-video-objects");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = [
  "/blog/ai-product-photography-guide",
  "/blog/ai-ugc-video-ads-guide",
  "/blog/ai-video-review-checklist",
  "/blog/model-photos-without-a-photoshoot",
  "/blog/unboxing-videos-for-launches"
];

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

function isVideoObject(node) {
  const type = node?.["@type"];
  return type === "VideoObject" || (Array.isArray(type) && type.includes("VideoObject"));
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: SLUGS } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, SLUGS.length, `expected ${SLUGS.length} rows, found ${rows.length}`);

  const operations = [];
  const nextById = new Map();
  for (const row of rows) {
    const graph = row.contentJson?.seo?.jsonLd?.["@graph"];
    assert.ok(Array.isArray(graph), `${row.slug}: contentJson.seo.jsonLd["@graph"] is missing`);
    const removed = graph.filter(isVideoObject);
    assert.equal(removed.length, 1, `${row.slug}: expected exactly one VideoObject, found ${removed.length}`);
    const nextGraph = graph.filter((node) => !isVideoObject(node));
    const next = structuredClone(row.contentJson);
    next.seo.jsonLd["@graph"] = nextGraph;
    nextById.set(row.id, next);
    operations.push({
      entityType: "live_page",
      id: row.id,
      slug: row.slug,
      field: "contentJson",
      path: "/seo/jsonLd/@graph",
      baseUpdatedAt: row.updatedAt.toISOString(),
      baseGraphHash: hash(graph),
      nextGraphHash: hash(nextGraph),
      removed: removed.map((node) => ({
        name: node.name,
        contentUrl: node.contentUrl,
        uploadDate: node.uploadDate,
        duration: node.duration
      }))
    });
  }

  const manifest = {
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    operations
  };
  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `aivideosugc-blog-video-object-removal-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify(manifest, null, 2));
    console.error(`dry run: ${operations.length} page(s); manifest written to ${manifestPath}`);
    process.exit(0);
  }

  const otherBefore = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  let applied = 0;
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({
      where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed (the row changed after the manifest was read)`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback does not match the manifest`);
    applied += 1;
  }
  const otherAfter = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  assert.equal(otherBefore, otherAfter, "a row outside site_aidreamcapes changed during the apply");

  console.log(JSON.stringify({
    applied,
    manifestPath,
    removed: operations.map((operation) => ({ slug: operation.slug, videoObjects: operation.removed.length }))
  }, null, 2));
} finally {
  await db.$disconnect();
}
