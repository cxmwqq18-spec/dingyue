#!/usr/bin/env node
// P0: replace the two Black-presented guide/blog images with assets already in
// the media library. Field-level manifest with compare-and-set on updatedAt.
//
// Run from the current production release directory:
//
//   node scripts/replace-aidreamcapes-guide-black-assets.mjs
//   node scripts/replace-aidreamcapes-guide-black-assets.mjs --apply-production \
//     --confirm=replace-aidreamcapes-guide-black-assets
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=replace-aidreamcapes-guide-black-assets");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";

const MUG_ALT = "A plain cream mug centered in a square feed composition.";
const HOODIE_ALT = "Adult woman with short copper hair wearing a plain gray hoodie on an autumn city sidewalk.";

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: ["/guides/ad-sizes-by-platform", "/blog/model-photos-without-a-photoshoot"] } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, 2, `expected 2 rows, found ${rows.length}`);
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const operations = [];
  const nextById = new Map();

  {
    const row = bySlug.get("/guides/ad-sizes-by-platform");
    const next = structuredClone(row.contentJson);
    const section = next.sections.v2_main.settings.data.sections[8];
    assert.equal(section.img.src, "/ai-image-generation/fx05-guide-square-640.webp", "ad-sizes section 8 image changed since the audit");
    assert.match(`${section.alt} ${section.img.alt}`, /Black man/i, "ad-sizes section 8 no longer holds the audited Black asset");
    const before = { alt: section.alt, img: structuredClone(section.img) };
    section.alt = MUG_ALT;
    section.img.alt = MUG_ALT;
    section.img.src = "/ai-image-generation/office-desk-explanation-product.jpg";
    section.img.srcSet = "/ai-image-generation/office-desk-explanation-product.jpg 640w";
    const manifest = next.mediaManifest;
    const stale = manifest[5];
    assert.equal(stale.src, "/ai-image-generation/fx05-guide-square-640.webp", "mediaManifest[5] changed since the audit");
    manifest[5] = { alt: MUG_ALT, src: "/ai-image-generation/office-desk-explanation-product.jpg", width: 640, height: 640 };
    nextById.set(row.id, next);
    operations.push({
      entityType: "live_page", id: row.id, slug: row.slug, field: "contentJson",
      changes: [
        { path: "/sections/v2_main/settings/data/sections/8/alt", baseHash: hash(before.alt), nextHash: hash(MUG_ALT) },
        { path: "/sections/v2_main/settings/data/sections/8/img", baseHash: hash(before.img), nextHash: hash(section.img) },
        { path: "/mediaManifest/5", baseHash: hash(stale), nextHash: hash(manifest[5]) }
      ],
      removedAsset: { src: "/ai-image-generation/fx05-guide-square-640.webp", alt: before.alt }
    });
  }

  {
    const row = bySlug.get("/blog/model-photos-without-a-photoshoot");
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    const section = data.sections[7];
    assert.equal(section.img.src, "/ai-image-generation/fx05-model-setting-640.webp", "blog section 7 image changed since the audit");
    assert.match(section.img.alt, /Black woman/i, "blog section 7 no longer holds the audited Black asset");
    const before = { img: structuredClone(section.img) };
    section.img.alt = HOODIE_ALT;
    section.img.src = "/ai-image-generation/fx05-model-when-640.webp";
    section.img.srcSet = "/ai-image-generation/fx05-model-when-640.webp 640w, /ai-image-generation/fx05-model-when.webp 1024w";
    const manifest = next.mediaManifest;
    const staleIndex = manifest.findIndex((entry) => entry.src === "/ai-image-generation/fx05-model-setting-640.webp");
    assert.equal(staleIndex, 5, "the stale manifest entry moved since the audit");
    const stale = manifest[staleIndex];
    manifest.splice(staleIndex, 1);
    assert(manifest.some((entry) => entry.src === "/ai-image-generation/fx05-model-when-640.webp"), "replacement image missing from mediaManifest");
    nextById.set(row.id, next);
    operations.push({
      entityType: "live_page", id: row.id, slug: row.slug, field: "contentJson",
      changes: [
        { path: "/sections/v2_main/settings/data/sections/7/img", baseHash: hash(before.img), nextHash: hash(section.img) },
        { path: "/mediaManifest", baseHash: hash(row.contentJson.mediaManifest), nextHash: hash(manifest) }
      ],
      removedAsset: { src: "/ai-image-generation/fx05-model-setting-640.webp", alt: stale.alt }
    });
  }

  const manifestDoc = {
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    operations
  };
  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `aivideosugc-guide-black-asset-replacement-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestDoc, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify(manifestDoc, null, 2));
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
    pages: operations.map((operation) => ({ slug: operation.slug, removedAsset: operation.removedAsset.src }))
  }, null, 2));
} finally {
  await db.$disconnect();
}
