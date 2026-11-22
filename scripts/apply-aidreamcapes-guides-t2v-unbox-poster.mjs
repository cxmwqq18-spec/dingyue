#!/usr/bin/env node
// Guides Text to Video: use a 9:16 poster for the new TikTok unboxing demo so
// the poster and the video share the same aspect ratio (no layout shift when
// the video loads).
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-guides-t2v-unbox-poster.mjs
//   node scripts/apply-aidreamcapes-guides-t2v-unbox-poster.mjs --apply-production \
//     --confirm=guides-t2v-unbox-poster
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=guides-t2v-unbox-poster");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUG = "/guides/how-do-text-to-video";
const OLD_POSTER = "/ai-image-generation/skincare-gift-set-unbox-routine-640.webp";
const NEW_POSTER = "/assets/sites/site_aidreamcapes/guides/skincare-gift-set-unbox-routine-poster.jpg";

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

const db = new PrismaClient();
try {
  const row = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, slug: SLUG } });
  const next = structuredClone(row.contentJson);
  const video = next.sections.v2_main.settings.data.howto.demo.result.frames[0].video;
  assert.equal(video.poster, OLD_POSTER, "demo poster drifted");
  record("howto/demo/result/frames/0/video/poster", video.poster, NEW_POSTER);
  video.poster = NEW_POSTER;

  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    `aidreamcapes-guides-t2v-unbox-poster-${new Date().toISOString().slice(0, 10)}.json`
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
