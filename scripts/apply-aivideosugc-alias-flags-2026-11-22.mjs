#!/usr/bin/env node
// AIVideosUGC alias routing flags — 2026-11-22 (approved by the site owner).
//
// 38 reviewed detail-alias cards answer 200 with a self-referencing canonical
// but are absent from the sitemap. They split into two kinds:
//
//   merge   (22) same-title placeholder copies of a live example. The card is a
//                generic template copy with the target's label and no video of
//                its own. Marking `detailAliasMerge` makes the resolver answer
//                308 to the target, consolidating duplicate signals.
//   publish (16) distinct examples with their own title, image and prompt.
//                Marking `detailAliasPublish` lists their existing 200 page in
//                the sitemap instead of filtering it out.
//
// Every operation is field-level: one boolean key is added to one card object.
// The manifest pins the owning row (updatedAt) and a content hash; a mismatch
// aborts before any write, so an online edit always wins.
//
//   summary:  node scripts/apply-aivideosugc-alias-flags-2026-11-22.mjs
//   dry run:  node scripts/apply-aivideosugc-alias-flags-2026-11-22.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-alias-flags-2026-11-22.mjs --target=production --apply --confirm=aivideosugc-alias-flags-2026-11-22
//   verify:   node scripts/apply-aivideosugc-alias-flags-2026-11-22.mjs --target=production --verify
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-alias-flags-2026-11-22";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-alias-flags-2026-11-22.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const verify = hasArgument("--verify");
assert.equal(manifest.operations.length, 38, "manifest must carry the 38 reviewed alias cards");
assert.equal(manifest.merge, 22);
assert.equal(manifest.publish, 16);

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function atPath(root, path) {
  let node = root;
  for (const key of path) {
    if (node == null) return undefined;
    node = node[key];
  }
  return node;
}

const groups = new Map();
for (const operation of manifest.operations) {
  const list = groups.get(operation.pageId) ?? [];
  list.push(operation);
  groups.set(operation.pageId, list);
}

console.log(JSON.stringify({
  mode: apply ? "apply" : verify ? "verify" : "summary",
  target,
  merge: manifest.merge,
  publish: manifest.publish,
  pages: [...new Set(manifest.operations.map((operation) => operation.pageSlug))].length
}, null, 2));
if (!apply && !verify) process.exit(0);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });

const prisma = new PrismaClient();
try {
  const failures = [];
  for (const [pageId, operations] of groups) {
    const row = await prisma.livePage.findFirst({
      where: { id: pageId, siteId },
      select: { id: true, slug: true, contentJson: true, updatedAt: true }
    });
    if (!row) {
      failures.push(`${operations[0].pageSlug}: row ${pageId} not found`);
      continue;
    }
    const rowHash = hash(row.contentJson);
    const expectedUpdatedAt = operations[0].rowUpdatedAt;
    const expectedRowHash = operations[0].rowHash;
    const timestampMatches = row.updatedAt.toISOString() === expectedUpdatedAt;
    const hashMatches = rowHash === expectedRowHash;

    if (verify) {
      for (const operation of operations) {
        const card = atPath(row.contentJson, operation.cardPath);
        const actual = card?.[operation.flag];
        if (actual !== true) failures.push(`${operation.publicSlug}: ${operation.flag} is ${JSON.stringify(actual)}`);
      }
      continue;
    }

    // The manifest was generated against this exact row. Any newer online edit
    // (updatedAt or content) wins and stops the whole run before a write.
    if (timestampMatches && hashMatches) {
      const content = structuredClone(row.contentJson);
      for (const operation of operations) {
        const card = atPath(content, operation.cardPath);
        assert(card && typeof card === "object", `${operation.publicSlug}: card path no longer resolves`);
        assert.equal(card.publicSlug, operation.publicSlug, `${operation.publicSlug}: card slug changed`);
        assert.equal(card.detailAliasOf, operation.aliasOf, `${operation.publicSlug}: alias target changed`);
        assert.equal(card[operation.flag], undefined, `${operation.publicSlug}: ${operation.flag} already present`);
        card[operation.flag] = true;
      }
      const update = await prisma.livePage.updateMany({
        where: { id: row.id, siteId, updatedAt: row.updatedAt },
        data: { contentJson: content }
      });
      if (update.count !== 1) failures.push(`${operations[0].pageSlug}: compare-and-set failed`);
    } else {
      // Already-applied rows are reported separately from drifted rows so a
      // retry after a partial success is safe.
      const flagsPresent = operations.every((operation) => atPath(row.contentJson, operation.cardPath)?.[operation.flag] === true);
      if (!flagsPresent) {
        failures.push(`${operations[0].pageSlug}: row changed since manifest (updatedAt=${timestampMatches}, hash=${hashMatches})`);
      }
    }
  }
  if (failures.length) {
    console.error(JSON.stringify({ ok: false, failures }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ ok: true, mode: verify ? "verified" : "applied", pages: groups.size }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
