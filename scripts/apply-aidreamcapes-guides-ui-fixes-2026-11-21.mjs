#!/usr/bin/env node
// Guides UI/content fixes (2026-11-21):
// - Subtitle Studio: swap the tall controls image for a compact 3+2 grid.
// - AI Image: make the demo description check the product against the source.
// - URL to Video: add the existing canvas-tote video as the generated example.
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-ui-fixes-2026-11-21.mjs
//   node scripts/apply-aidreamcapes-guides-ui-fixes-2026-11-21.mjs --apply-production \
//     --confirm=guides-ui-fixes-2026-11-21
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-ui-fixes-2026-11-21");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUGS = [
  "/guides/how-do-subtitle-studio",
  "/guides/how-do-ai-image",
  "/guides/how-do-url-to-video"
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

const AI_IMAGE_LEAD = "Check the mug's shape, lid, and matte navy finish against the product photo on the left. The car-scene image on the right was generated from that photo.";
const URL_LEAD = "The URL field in this example uses a real public product page. The imported photos and details populate the editable draft; the video below shows the kind of clip you can generate from the same product.";
const URL_STEP4 = "Continue to the video composer and review the prefilled brief and references (Reference photos are the product images you upload so the model knows exactly what your product looks like — its shape, color, label, and proportions.). Confirm that the same product is present and that the draft can still be edited. This walkthrough ends before video generation; the example video shows the kind of clip the same product can produce.";
const URL_FRAMES = [
  {
    tag: "Generated video · same tote · play with sound",
    video: {
      src: "/ai-video-generation/canvas-tote-everyday-carry.mp4",
      poster: "/ai-image-generation/canvas-tote-everyday-carry-640.webp"
    }
  }
];

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
    const data = next.sections.v2_main.settings.data;
    if (row.slug === "/guides/how-do-subtitle-studio") {
      const media = data.howto.sections[0].media;
      assert.equal(media.image.src, "/ai-image-generation/subtitle-studio-controls.webp", "subtitle controls image drifted");
      const image = {
        alt: "Subtitle Studio caption controls: style, size, position, color, and backdrop.",
        src: "/ai-image-generation/subtitle-studio-controls-compact.webp",
        width: 1060,
        height: 185
      };
      record(row.slug, "howto/sections/0/media/image", media.image, image);
      media.image = image;
    } else if (row.slug === "/guides/how-do-ai-image") {
      const howto = data.howto;
      assert.ok(howto.demo.lead.startsWith("Compare the mug's shape"), "ai-image demo lead drifted");
      record(row.slug, "howto/demo/lead", howto.demo.lead, AI_IMAGE_LEAD);
      howto.demo.lead = AI_IMAGE_LEAD;
    } else if (row.slug === "/guides/how-do-url-to-video") {
      const howto = data.howto;
      const seo = next.seo;
      assert.equal(howto.demo.frames, undefined, "url-to-video demo already has frames");
      record(row.slug, "howto/demo/lead", howto.demo.lead, URL_LEAD);
      howto.demo.lead = URL_LEAD;
      record(row.slug, "howto/demo/frames", howto.demo.frames, URL_FRAMES);
      howto.demo.frames = structuredClone(URL_FRAMES);
      assert.equal(howto.steps[4].title, "Open and inspect the editable draft", "url-to-video steps[4] drifted");
      record(row.slug, "howto/steps/4/body", howto.steps[4].body, URL_STEP4);
      howto.steps[4].body = URL_STEP4;
      const howTo = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
      assert.ok(howTo, "url-to-video HowTo JSON-LD missing");
      record(row.slug, "seo/jsonLd/HowTo/step/4/text", howTo.step[4].text, URL_STEP4);
      howTo.step[4].text = URL_STEP4;
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
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-ui-fixes-2026-11-21-${new Date().toISOString().slice(0, 10)}.json`
  );
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
  let applied = 0;
  for (const row of rows) {
    const next = nextById.get(row.id);
    const result = await db.livePage.updateMany({
      where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(result.count, 1, `${row.slug}: compare-and-set failed`);
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

  console.log(JSON.stringify({ applied, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
