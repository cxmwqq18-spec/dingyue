#!/usr/bin/env node
// Image module step 1 (2026-11-22):
// - surface the existing color / angle / packaging example strips and the
//   packaging gallery on their template pages
// - remove packaging strip items that are not packaging examples
// - remove the duplicated running-jacket card from the photo hub
// - make the Social Ad review titles name the product actually shown
// - make the Change Background step prompt name the product actually shown
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-image-module-step1-2026-11-22.mjs
//   node scripts/apply-aidreamcapes-image-module-step1-2026-11-22.mjs --apply-production \
//     --confirm=image-module-step1-2026-11-22
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=image-module-step1-2026-11-22");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = [
  "/ai-image-generation",
  "/ai-image-generation/change-background",
  "/ai-image-generation/colorway-variations",
  "/ai-image-generation/packshot-multi-angle",
  "/ai-image-generation/packaging-mockup",
  "/ai-image-generation/social-ad-photos"
];

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

const edits = [];
const record = (slug, fieldPath, before, after) => {
  edits.push({ slug, path: fieldPath, beforeHash: hash(before), afterHash: hash(after) });
};
const setField = (slug, obj, key, oldValue, newValue) => {
  assert.deepEqual(obj[key], oldValue, `${slug}: ${key} drifted`);
  record(slug, key, obj[key], newValue);
  obj[key] = newValue;
};
const insertAfter = (slug, obj, key, anchor, value) => {
  const before = obj[key];
  assert.ok(Array.isArray(before), `${slug}: ${key} is not an array`);
  assert.ok(before.includes(anchor), `${slug}: ${key} is missing ${anchor}`);
  assert.ok(!before.includes(value), `${slug}: ${key} already contains ${value}`);
  const after = [...before];
  after.splice(after.indexOf(anchor) + 1, 0, value);
  record(slug, key, before, after);
  obj[key] = after;
};
const removeStripItems = (slug, visual, sources) => {
  const before = visual.strip;
  assert.ok(Array.isArray(before), `${slug}: strip is not an array`);
  for (const src of sources) assert.ok(before.some((item) => item.src === src), `${slug}: strip is missing ${src}`);
  const after = before.filter((item) => !sources.includes(item.src));
  record(slug, "visual/strip", before, after);
  visual.strip = after;
};

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: SLUGS } },
    orderBy: { slug: "asc" }
  });
  assert.equal(rows.length, SLUGS.length, `expected ${SLUGS.length} rows, found ${rows.length}`);

  const nextById = new Map();
  for (const row of rows) {
    const next = structuredClone(row.contentJson);
    const data = next.sections?.v2_main?.settings?.data;
    assert.ok(data, `${row.slug}: data block is missing`);
    const slug = row.slug;

    if (slug === "/ai-image-generation") {
      const group = data.examples?.groups?.find((entry) => entry.label === "More photo examples");
      assert.ok(group, "photo hub: More photo examples group is missing");
      const duplicateSrc = "/ai-image-generation/q20-occ-sale-example-04-640.webp";
      const first = group.items.find((item) => item.image?.src === duplicateSrc);
      assert.ok(first, "photo hub: running jacket card is missing");
      const before = group.items;
      let seen = false;
      const after = before.filter((item) => {
        if (item.image?.src !== duplicateSrc) return true;
        if (seen) return false;
        seen = true;
        return true;
      });
      assert.ok(after.length < before.length, "photo hub: running jacket duplicate was not found");
      record(slug, "examples/groups/More photo examples/items", before, after);
      group.items = after;

      const story = group.items.find((item) => item.image?.src === "/ai-image-generation/t33-tpl-story-og-r2.webp");
      assert.ok(story, "photo hub: Instagram Story card is missing");
      assert.equal(story.image.alt, "Instagram Story Image Maker | AIVideosUGC", "photo hub: story alt drifted");
      story.image.alt = "Screenshot-style Instagram Story image with a product and space for an offer";
      record(slug, "examples/groups/More photo examples/items/Instagram Story Image Maker/image/alt", "Instagram Story Image Maker | AIVideosUGC", story.image.alt);
    } else if (slug === "/ai-image-generation/social-ad-photos") {
      assert.equal(data.reviews?.items?.[1]?.t, "Cream Tote in a Square", "social: review 1 title drifted");
      assert.equal(data.reviews?.items?.[2]?.t, "Two Mug Squares Before You Pay", "social: review 2 title drifted");
      setField(slug, data.reviews.items[1], "t", "Cream Tote in a Square", "Sage Thermos in a Square");
      setField(slug, data.reviews.items[2], "t", "Two Mug Squares Before You Pay", "Two Hiking Shoe Squares Before You Pay");
    } else if (slug === "/ai-image-generation/change-background") {
      const oldPrompt = "Place this blue ceramic vase on a shaded garden table with a light cloth and soft green plants behind it.";
      assert.equal(data.visual?.steps?.prompt, oldPrompt, "change-background: step prompt drifted");
      const newPrompt = "Place this mint cleanser tube on a quiet gray backdrop with a pale wall behind it. Keep the tube shape, label, and cap unchanged.";
      record(slug, "visual/steps/prompt", oldPrompt, newPrompt);
      data.visual.steps.prompt = newPrompt;
    } else if (slug === "/ai-image-generation/colorway-variations") {
      insertAfter(slug, data, "blockOrder", "picker", "strip");
    } else if (slug === "/ai-image-generation/packshot-multi-angle") {
      insertAfter(slug, data, "blockOrder", "picker", "strip");
      removeStripItems(slug, data.visual, [
        "/ai-image-generation/q7-angle-strip-2-640.webp",
        "/ai-image-generation/q7-angle-strip-5-640.webp"
      ]);
    } else if (slug === "/ai-image-generation/packaging-mockup") {
      insertAfter(slug, data, "blockOrder", "picker", "strip");
      insertAfter(slug, data, "blockOrder", "strip", "examples");
      removeStripItems(slug, data.visual, [
        "/ai-image-generation/actors/gen2guide-b1-spokesperson-videos-source-640.webp",
        "/ai-image-generation/gen2guide-c4-occ-holidays-post-gift-640.webp"
      ]);
    }

    nextById.set(row.id, next);
  }

  const manifestDoc = {
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    editCount: edits.length,
    pages: SLUGS,
    edits
  };
  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, "aidreamcapes-image-module-step1-2026-11-22.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestDoc, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: SLUGS, editCount: edits.length, manifestPath }, null, 2));
    process.exit(0);
  }

  const otherBefore = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({
      where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed`);
    const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
    assert.equal(hash(readback.contentJson), hash(next), `${row.slug}: readback does not match the manifest`);
  }
  const otherAfter = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  assert.equal(otherBefore, otherAfter, "a row outside site_aidreamcapes changed during the apply");

  console.log(JSON.stringify({ applied: rows.length, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
