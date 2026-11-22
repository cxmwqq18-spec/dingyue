#!/usr/bin/env node
// Guides Subtitle Studio: add a focused workspace-controls section (Style,
// Size, Position, Color, Backdrop) so readers see the actual editing options,
// not a full workspace screenshot.
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-subtitle-controls.mjs
//   node scripts/apply-aidreamcapes-guides-subtitle-controls.mjs --apply-production \
//     --confirm=guides-subtitle-controls
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-subtitle-controls");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUG = "/guides/how-do-subtitle-studio";

const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const hash = (value) => crypto.createHash("sha256")
  .update(value === undefined ? "<undefined>" : JSON.stringify(stable(value)))
  .digest("hex");

const edits = [];
const record = (fieldPath, before, after) => {
  edits.push({ slug: SLUG, path: fieldPath, beforeHash: hash(before), afterHash: hash(after) });
};

const SECTION = {
  h2: "Set the caption look in the workspace",
  paras: ["The picture stays untouched; the workspace adds a caption layer. These are the controls you use before generating:"],
  media: {
    image: {
      alt: "Subtitle Studio caption controls: style, size, position, color, and backdrop.",
      src: "/ai-image-generation/subtitle-studio-controls.webp",
      width: 680,
      height: 840
    },
    caption: "The caption controls in Subtitle Studio: style, size, position, color, and backdrop."
  },
  bullets: [
    "**Style:** Auto, Classic, Bold, or Minimal.",
    "**Size:** Small, Medium, or Large.",
    "**Position:** Bottom, Middle, or Top.",
    "**Color:** White, Yellow, Cyan, or Black.",
    "**Backdrop:** Auto, None, Box, or Outline."
  ]
};
const STEP3 = "Select **Generate subtitles**, then set Style, Size, Position, Color, and Backdrop in the workspace. Check the preview on a frame with a face and a product label; the controls are shown above.";

const db = new PrismaClient();
try {
  const row = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, slug: SLUG } });
  const next = structuredClone(row.contentJson);
  const howto = next.sections.v2_main.settings.data.howto;
  const seo = next.seo;

  assert.equal(Array.isArray(howto.sections) && howto.sections.length, 0, "subtitle sections are not empty");
  record("howto/sections", howto.sections, [SECTION]);
  howto.sections = [structuredClone(SECTION)];

  assert.equal(howto.steps[2].title, "Choose Generate subtitles and set the look", "subtitle steps[2] drifted");
  record("howto/steps/2/body", howto.steps[2].body, STEP3);
  howto.steps[2].body = STEP3;

  const howTo = seo.jsonLd["@graph"].find((node) => node["@type"] === "HowTo");
  assert.ok(howTo, "subtitle HowTo JSON-LD missing");
  record("seo/jsonLd/HowTo/step/2/text", howTo.step[2].text, STEP3);
  howTo.step[2].text = STEP3;

  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-subtitle-controls-${new Date().toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify({
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    editCount: edits.length,
    pages: [SLUG],
    edits
  }, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: [SLUG], editCount: edits.length, manifestPath }, null, 2));
    process.exit(0);
  }

  const result = await db.livePage.updateMany({
    where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
    data: { contentJson: next }
  });
  assert.equal(result.count, 1, `${SLUG}: compare-and-set failed`);
  const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
  assert.equal(hash(readback.contentJson), hash(next), `${SLUG}: readback does not match the manifest`);

  console.log(JSON.stringify({ applied: 1, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
