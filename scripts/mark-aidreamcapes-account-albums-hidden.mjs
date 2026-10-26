#!/usr/bin/env node
// Mark AIVideosUGC (site_aidreamcapes) account albums as hidden.
//
// The albums card in the AIVideosUGC account center is fed by legacy Album
// rows that were auto-created from historical generation jobs. The site owner
// retired that surface: the card is hidden in the account UI, and this script
// marks the relational rows `status = "hidden"` so no other surface keeps
// listing them either. Rows are never deleted; the manifest records every
// change so the operation can be inverted field by field.
//
// Scope rules:
//   - only site_aidreamcapes Album rows are read or written;
//   - only the status field changes, and only to the store-legal "hidden";
//   - compare-and-set: a row is written only while its stored status still
//     matches the value recorded when the plan was built, so an online edit
//     always wins;
//   - the run is a dry report unless --apply is passed.
//
// Usage:
//   DATABASE_URL=... DATABASE_TARGET=local DINGYUE_ENV=local \
//     node scripts/mark-aidreamcapes-account-albums-hidden.mjs
//   ... --apply
//   ... --apply --manifest=<path>

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { argumentValue, hasArgument, assertAllowedSite, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const TARGET_STATUS = "hidden";
const APPLY = hasArgument("--apply");
const MANIFEST = argumentValue("--manifest");
const sha = (value) => crypto.createHash("sha256").update(String(value ?? "")).digest("hex");

assertAllowedSite(SITE_ID);
if (APPLY) assertNonProductionWriteTarget(process.env);

const prisma = new PrismaClient();

async function buildPlan() {
  const rows = await prisma.album.findMany({
    where: { siteId: SITE_ID, status: { not: TARGET_STATUS } },
    select: { id: true, title: true, status: true, updatedAt: true },
    orderBy: { id: "asc" }
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    from: row.status,
    to: TARGET_STATUS,
    recordedUpdatedAt: row.updatedAt.toISOString()
  }));
}

async function applyPlan(operations) {
  const results = { applied: 0, skipped: 0, details: [] };
  for (const operation of operations) {
    const updated = await prisma.album.updateMany({
      where: { id: operation.id, siteId: SITE_ID, status: operation.from },
      data: { status: operation.to }
    });
    if (updated.count) {
      results.applied += updated.count;
      results.details.push({ id: operation.id, result: "applied", from: operation.from, to: operation.to });
    } else {
      const stored = await prisma.album.findUnique({ where: { id: operation.id }, select: { status: true } });
      results.skipped += 1;
      results.details.push({ id: operation.id, result: "skipped", storedStatus: stored?.status ?? null, expected: operation.from });
    }
  }
  return results;
}

async function readback() {
  const grouped = await prisma.album.groupBy({
    by: ["status"],
    where: { siteId: SITE_ID },
    _count: { _all: true }
  });
  return grouped.map((group) => ({ status: group.status, count: group._count._all }));
}

const operations = await buildPlan();
const plan = {
  siteId: SITE_ID,
  model: "Album",
  field: "status",
  generatedAt: new Date().toISOString(),
  targetStatus: TARGET_STATUS,
  count: operations.length,
  digest: sha(JSON.stringify(operations.map((operation) => `${operation.id}:${operation.from}`))),
  operations
};

if (MANIFEST) {
  const manifestPath = path.resolve(MANIFEST);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(`manifest: ${manifestPath}`);
}

console.log(`plan: ${operations.length} album row(s) on ${SITE_ID} -> status "${TARGET_STATUS}" (dry=${!APPLY})`);

if (APPLY) {
  const results = await applyPlan(operations);
  const after = await readback();
  console.log(`applied=${results.applied} skipped=${results.skipped}`);
  for (const detail of results.details.filter((entry) => entry.result === "skipped")) {
    console.log(`skipped ${detail.id}: stored=${detail.storedStatus ?? "(missing)"} expected=${detail.expected}`);
  }
  console.log("album status counts after apply:", JSON.stringify(after));
  if (results.skipped > 0) {
    console.log("drift detected; re-run the dry report to rebuild the plan before applying again.");
  }
} else {
  for (const operation of operations.slice(0, 12)) {
    console.log(`  ${operation.id} ${operation.from} -> ${operation.to} (${operation.title})`);
  }
  if (operations.length > 12) console.log(`  ... and ${operations.length - 12} more`);
}

await prisma.$disconnect();
