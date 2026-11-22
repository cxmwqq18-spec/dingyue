#!/usr/bin/env node
// Guides AI Avatar: use 9:16-ish presenter stills so the Yara/Tara rows match
// the homepage three-panel proportions (presenter, product photo, video).
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-avatar-tall-stills.mjs
//   node scripts/apply-aidreamcapes-guides-avatar-tall-stills.mjs --apply-production \
//     --confirm=guides-avatar-tall-stills
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-avatar-tall-stills");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUG = "/guides/how-do-ai-avatar";

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

const YARA = "/ai-image-generation/avatar-yara-cafe-720x1160.webp";
const TARA = "/ai-image-generation/avatar-tara-pool-720x1160.webp";

const db = new PrismaClient();
try {
  const row = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, slug: SLUG } });
  const next = structuredClone(row.contentJson);
  const demo = next.sections.v2_main.settings.data.howto.demo;

  assert.equal(demo.frames[0].image.src, "/ai-image-generation/avatar-yara-cafe-720x828.webp", "yara still drifted");
  record("howto/demo/frames/0/image", demo.frames[0].image, { ...demo.frames[0].image, src: YARA, width: 720, height: 1160 });
  demo.frames[0].image = { ...demo.frames[0].image, src: YARA, width: 720, height: 1160 };

  assert.equal(demo.frames[2].video.src, "/ai-video-generation/cafe-counter-introduction.mp4", "yara video drifted");
  record("howto/demo/frames/2/image", demo.frames[2].image, { ...demo.frames[2].image, src: YARA, width: 720, height: 1160 });
  demo.frames[2].image = { ...demo.frames[2].image, src: YARA, width: 720, height: 1160 };
  record("howto/demo/frames/2/video/poster", demo.frames[2].video.poster, YARA);
  demo.frames[2].video.poster = YARA;

  assert.equal(demo.result.frames[0].image.src, "/ai-image-generation/avatar-tara-pool-720x828.webp", "tara still drifted");
  record("howto/demo/result/frames/0/image", demo.result.frames[0].image, { ...demo.result.frames[0].image, src: TARA, width: 720, height: 1160 });
  demo.result.frames[0].image = { ...demo.result.frames[0].image, src: TARA, width: 720, height: 1160 };

  assert.equal(demo.result.frames[2].video.src, "/ai-video-generation/pool-poolside-greeting.mp4", "tara video drifted");
  record("howto/demo/result/frames/2/image", demo.result.frames[2].image, { ...demo.result.frames[2].image, src: TARA, width: 720, height: 1160 });
  demo.result.frames[2].image = { ...demo.result.frames[2].image, src: TARA, width: 720, height: 1160 };
  record("howto/demo/result/frames/2/video/poster", demo.result.frames[2].video.poster, TARA);
  demo.result.frames[2].video.poster = TARA;

  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-avatar-tall-stills-${new Date().toISOString().slice(0, 10)}.json`
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
