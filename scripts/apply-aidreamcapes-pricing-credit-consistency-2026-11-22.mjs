#!/usr/bin/env node
// Pricing credit consistency (2026-11-22):
// - the 30-second video card said 20 credits while the credit note and live billing use 40
// - the credit-pack notes still used the retired 24-credit photo / 60-credit video math
// - the package paragraph listed Pro and Studio together, so its output count was ambiguous
//
// Run from the current production release directory:
//   node scripts/apply-aidreamcapes-pricing-credit-consistency-2026-11-22.mjs
//   node scripts/apply-aidreamcapes-pricing-credit-consistency-2026-11-22.mjs --apply-production \
//     --confirm=pricing-credit-consistency-2026-11-22
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

loadRuntimeEnv();
const applying = process.argv.includes("--apply-production");
const confirmed = process.argv.includes("--confirm=pricing-credit-consistency-2026-11-22");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: applying,
  productionConfirmed: applying && confirmed
});

const SITE_ID = "site_aidreamcapes";
const SLUG = "/pricing";

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
  const row = await db.livePage.findFirstOrThrow({
    where: { siteId: SITE_ID, slug: SLUG }
  });
  const next = structuredClone(row.contentJson);
  const data = next.sections?.v2_main?.settings?.data;
  assert.ok(data, "pricing data block is missing");

  const expectedCosts = [
    ["Product photo", "1 credit"],
    ["Video, 15 seconds", "20 credits"],
    ["Video, 30 seconds", "20 credits"]
  ];
  assert.deepEqual(data.costs, expectedCosts, "pricing cost cards drifted");
  record("costs/2/1", data.costs[2][1], "40 credits");
  data.costs[2][1] = "40 credits";

  const expectedPacks = [
    {
      note: "A small top-up when a campaign runs long. About 4 product photos or 1 short video.",
      next: "A small top-up when a campaign runs long. About 100 product photos, 5 fifteen-second videos, or 2 thirty-second videos."
    },
    {
      note: "The standard top-up for active stores. About 12 product photos or 5 short videos.",
      next: "The standard top-up for active stores. About 300 product photos, 15 fifteen-second videos, or 7 thirty-second videos."
    },
    {
      note: "Our lowest list price. About 40 product photos or 16 short videos.",
      next: "Our lowest list price. About 1,000 product photos, 50 fifteen-second videos, or 25 thirty-second videos."
    }
  ];
  assert.equal(data.packs?.length, expectedPacks.length, "pricing pack count drifted");
  expectedPacks.forEach((pack, index) => {
    assert.equal(data.packs[index].note, pack.note, `pricing pack ${index} note drifted`);
    record(`packs/${index}/note`, pack.note, pack.next);
    data.packs[index].note = pack.next;
  });

  const oldPackageCopy = "Every package is a one-time purchase, and its credits arrive at the start of each month of the term. Starter is $24 for one month with 200 credits — 200 product photos or about 10 fifteen-second videos. Pro is $59 with 500 credits, and Studio is $129 with 1,200 credits — 1,200 photos or about 60 of those videos. Six- and twelve-month terms cost less per month, and one-time credit packs from $14 cover a month that runs short.";
  const newPackageCopy = "Every package is a one-time purchase, and its credits arrive at the start of each month of the term. Starter is $24 for one month with 200 credits — 200 product photos, about 10 fifteen-second videos, or 5 thirty-second videos. Pro is $59 with 500 credits — 500 product photos, about 25 fifteen-second videos, or 12 thirty-second videos. Studio is $129 with 1,200 credits — 1,200 product photos, about 60 fifteen-second videos, or 30 thirty-second videos. Six- and twelve-month terms cost less per month, and one-time credit packs from $14 cover a month that runs short.";
  assert.equal(data.credits?.[2], oldPackageCopy, "pricing package paragraph drifted");
  record("credits/2", oldPackageCopy, newPackageCopy);
  data.credits[2] = newPackageCopy;

  const manifestDoc = {
    siteId: SITE_ID,
    generatedAt: new Date().toISOString(),
    applying,
    editCount: edits.length,
    pages: [SLUG],
    edits
  };
  const manifestDir = process.env.MANIFEST_DIR
    ? path.resolve(process.env.MANIFEST_DIR)
    : path.join(process.cwd(), "scripts", "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestPath = path.join(
    manifestDir,
    "aidreamcapes-pricing-credit-consistency-2026-11-22.json"
  );
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifestDoc, null, 2)}\n`);

  if (!applying) {
    console.log(JSON.stringify({ pages: [SLUG], editCount: edits.length, manifestPath }, null, 2));
    process.exit(0);
  }

  const otherBefore = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  const result = await db.livePage.updateMany({
    where: { siteId: SITE_ID, id: row.id, updatedAt: row.updatedAt },
    data: { contentJson: next }
  });
  assert.equal(result.count, 1, `${SLUG}: compare-and-set failed`);
  const readback = await db.livePage.findFirstOrThrow({ where: { siteId: SITE_ID, id: row.id } });
  assert.equal(hash(readback.contentJson), hash(next), `${SLUG}: readback does not match the manifest`);
  const otherAfter = hash(await db.livePage.findMany({
    where: { siteId: { not: SITE_ID } },
    orderBy: { id: "asc" },
    select: { id: true, contentJson: true }
  }));
  assert.equal(otherBefore, otherAfter, "a row outside site_aidreamcapes changed during the apply");

  console.log(JSON.stringify({ applied: 1, editCount: edits.length, manifestPath }, null, 2));
} finally {
  await db.$disconnect();
}
