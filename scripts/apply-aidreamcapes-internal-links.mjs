// Apply the reviewed Aidreamcapes internal-link field manifest to the current
// relational rows. No imports, snapshots, page generation, deletion, redirect
// configuration change or cross-store update is supported.
//
//   node --env-file=<production env> scripts/apply-aidreamcapes-internal-links.mjs \
//     --manifest=scripts/manifests/aidreamcapes-internal-links-production-2026-10-23.json \
//     --target=production
//
// Apply (production):
//   ... --apply --base-hash=<planHash> --confirm=aidreamcapes-internal-links-production
// Apply (rollback manifest produced by a previous apply):
//   ... --apply --base-hash=<rollbackPlanHash> --confirm=aidreamcapes-internal-links-rollback

import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import {
  HOME_DESCRIPTION_AFTER,
  HOME_DESCRIPTION_BEFORE,
  HOME_DESCRIPTION_PATHS,
  hashValue as hash,
  isLinkField,
  repointField,
} from "./lib/aidreamcapes-internal-links.mjs";

const manifestPath = argumentValue("--manifest");
assert(manifestPath, "--manifest is required");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const target = argumentValue("--target") || "local";
const apply = hasArgument("--apply");
const rollback = manifest.contract === "aidreamcapes-internal-links-rollback-v1";
assert(
  manifest.contract === "aidreamcapes-internal-links-v1" || rollback,
  `Unsupported manifest contract ${manifest.contract}`,
);
assert.equal(manifest.siteId, "site_aidreamcapes");
assert.equal(manifest.target, target);
assert(["local", "production"].includes(target));
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: rollback
    ? argumentValue("--confirm") === "aidreamcapes-internal-links-rollback"
    : argumentValue("--confirm") === `aidreamcapes-internal-links-${target}`,
});
assert.equal(
  hash({ contract: manifest.contract, siteId: manifest.siteId, target, operations: manifest.operations }),
  manifest.planHash,
  "Manifest plan hash mismatch",
);
if (apply) {
  assert.equal(argumentValue("--base-hash"), manifest.planHash, "Explicit reviewed plan hash is required");
  if (rollback) assert.equal(argumentValue("--confirm"), "aidreamcapes-internal-links-rollback");
  else assert.equal(argumentValue("--confirm"), `aidreamcapes-internal-links-${target}`);
  if (target === "production") {
    const commit = argumentValue("--deployed-commit");
    assert(/^[a-f0-9]{40}$/.test(commit || ""), "Production content apply requires the exact deployed commit");
    assert.equal(fs.readFileSync(".deployed-commit", "utf8").trim(), commit, "Run production apply only from the verified deployed release");
  }
}

const parts = (pointer) => pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
const read = (content, pointer) => parts(pointer).reduce((value, key) => value?.[key], content);
function field(content, pointer) {
  const keys = parts(pointer);
  const key = keys.pop();
  const parent = keys.reduce((value, part) => value?.[part], content);
  return { parent, key, exists: Boolean(parent && Object.hasOwn(parent, key)), value: parent?.[key] };
}

// Field level guard rails: a manifest may only repoint link destinations and
// may only fix the reviewed homepage description string. Everything else is
// rejected before the transaction opens.
for (const op of manifest.operations) {
  assert(op.path.startsWith("/") && !parts(op.path).some((part) => ["__proto__", "constructor", "prototype"].includes(part)));
  assert.equal(op.before?.exists, true, `Only existing fields may be changed (${op.path})`);
  assert.equal(typeof op.before?.value, "string", `Field ${op.path} must hold a string`);
  assert.equal(typeof op.after, "string", `Field ${op.path} must stay a string`);
  const descriptionOp = HOME_DESCRIPTION_PATHS.has(op.path);
  if (descriptionOp) {
    assert.equal(op.pageSlug, "/", `Description field ${op.path} may only change on the homepage`);
    if (rollback) {
      assert.equal(op.before.value, HOME_DESCRIPTION_AFTER, `Unexpected homepage description pre-image at ${op.path}`);
      assert.equal(op.after, HOME_DESCRIPTION_BEFORE, `Unexpected homepage description post-image at ${op.path}`);
    } else {
      assert.equal(op.before.value, HOME_DESCRIPTION_BEFORE, `Unexpected homepage description pre-image at ${op.path}`);
      assert.equal(op.after, HOME_DESCRIPTION_AFTER, `Unexpected homepage description post-image at ${op.path}`);
    }
  } else {
    assert(isLinkField(op.path), `Unapproved field ${op.path}`);
    if (rollback) {
      assert.equal(repointField(op.after), op.before.value, `Field ${op.path} is not the reviewed inverse repoint`);
      assert.notEqual(op.before.value, op.after, `Field ${op.path} has no change`);
    } else {
      assert.equal(repointField(op.before.value), op.after, `Field ${op.path} is not a pure link-destination repoint`);
      assert.notEqual(op.before.value, op.after, `Field ${op.path} has no change`);
    }
  }
}

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
try {
  const report = await db.$transaction(
    async (tx) => {
      if (apply) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('aidreamcapes-internal-links-v1'))`;
        const trigger = await tx.$queryRaw`SELECT tgname FROM pg_trigger WHERE tgrelid = 'public."LivePage"'::regclass AND tgname = 'SiteContentRevision_LivePage' AND tgenabled != 'D'`;
        assert.equal(trigger.length, 1, "Revision trigger required");
      }
      const protectedHash = async () =>
        hash(
          await tx.livePage.findMany({
            where: { siteId: "site_dreamshoot" },
            orderBy: { id: "asc" },
            select: { id: true, contentJson: true, updatedAt: true },
          }),
        );
      const revision = async () =>
        (await tx.$queryRaw`SELECT revision::text FROM "SiteContentRevision" WHERE "siteId" = 'site_aidreamcapes'`)[0]?.revision || "0";
      const protectedBefore = await protectedHash();
      const revisionBefore = await revision();
      const rows = await tx.livePage.findMany({
        where: { siteId: "site_aidreamcapes" },
        select: { id: true, slug: true, contentJson: true, updatedAt: true },
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      const patches = new Map();
      const conflicts = [];
      const skipped = [];
      const applied = [];
      const inverse = [];
      const duplicates = new Set();
      for (const op of manifest.operations) {
        const identity = `${op.pageId}:${op.path}`;
        assert(!duplicates.has(identity), `Duplicate manifest field ${identity}`);
        duplicates.add(identity);
        const row = byId.get(op.pageId);
        const current = row && field(row.contentJson, op.path);
        if (!row || row.slug !== op.pageSlug || !current?.parent) {
          conflicts.push({ page: op.pageSlug, path: op.path, reason: "owner-or-parent-changed" });
          continue;
        }
        if (current.exists && hash(current.value) === hash(op.after)) {
          skipped.push({ page: row.slug, path: op.path });
          continue;
        }
        if (
          current.exists !== op.before.exists ||
          (current.exists && hash(current.value) !== hash(op.before.value)) ||
          op.guards.some(
            (guard) =>
              !byId.has(guard.pageId) ||
              hash(read(byId.get(guard.pageId).contentJson, guard.path)) !== guard.hash,
          )
        ) {
          conflicts.push({ page: row.slug, path: op.path, reason: "online-field-or-generation-edited" });
          continue;
        }
        const patch = patches.get(row.id) || { row, next: structuredClone(row.contentJson), operations: [] };
        const destination = field(patch.next, op.path);
        destination.parent[destination.key] = structuredClone(op.after);
        patch.operations.push(op);
        patches.set(row.id, patch);
      }
      for (const patch of patches.values()) {
        if (apply) {
          const result = await tx.livePage.updateMany({
            where: { id: patch.row.id, siteId: "site_aidreamcapes", updatedAt: patch.row.updatedAt },
            data: { contentJson: patch.next },
          });
          assert.equal(result.count, 1, `Concurrent edit to ${patch.row.slug}; transaction aborted`);
          const readback = await tx.livePage.findFirstOrThrow({
            where: { id: patch.row.id, siteId: "site_aidreamcapes" },
            select: { contentJson: true },
          });
          assert.equal(hash(readback.contentJson), hash(patch.next));
        }
        for (const op of patch.operations) {
          applied.push({ page: patch.row.slug, path: op.path, after: op.after });
          inverse.push({ pageId: op.pageId, pageSlug: op.pageSlug, path: op.path, expected: op.after, restore: op.before });
        }
      }
      const revisionAfter = await revision();
      const protectedAfter = await protectedHash();
      assert.equal(protectedBefore, protectedAfter, "Protected store changed");
      if (apply) assert.equal(BigInt(revisionAfter) - BigInt(revisionBefore), BigInt(patches.size), "Revision did not advance by the number of changed rows");
      return {
        ok: conflicts.length === 0,
        mode: apply ? "apply" : "dry-run",
        contract: manifest.contract,
        siteId: "site_aidreamcapes",
        target,
        planHash: manifest.planHash,
        deployedCommit: argumentValue("--deployed-commit") || null,
        pages: patches.size,
        fields: applied.length,
        revisionBefore,
        revisionAfter,
        myDreamShootsUnchanged: true,
        conflicts,
        skipped,
        applied,
        inverse,
        completedAt: new Date().toISOString(),
      };
    },
    { timeout: 120000 },
  );

  const suffix = apply ? "-apply" : "-dry-run";
  const reportPath = argumentValue("--report") || manifestPath.replace(/\.json$/, `${suffix}.json`);
  fs.mkdirSync(path.dirname(path.resolve(reportPath)), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  const rollbackPath =
    argumentValue("--rollback") || manifestPath.replace(/\.json$/, `${apply ? "-apply" : "-dry-run"}-rollback.json`);
  const rollbackContract = "aidreamcapes-internal-links-rollback-v1";
  const rollbackOperations = report.inverse.map((entry) => ({
    pageId: entry.pageId,
    pageSlug: entry.pageSlug,
    path: entry.path,
    kind: "rollback",
    before: { exists: true, value: entry.expected },
    after: entry.restore.exists ? entry.restore.value : null,
    guards: [{ pageId: entry.pageId, path: entry.path, hash: hash(entry.expected) }],
  }));
  const rollbackManifest = {
    ok: true,
    mode: apply ? "rollback-manifest" : "rollback-preview",
    contract: rollbackContract,
    siteId: "site_aidreamcapes",
    target,
    sourcePlanHash: manifest.planHash,
    generatedAt: new Date().toISOString(),
    note: "Field level inverse manifest against current relational rows. Apply only after reviewing the current field values.",
    entries: report.inverse,
    operations: rollbackOperations,
    planHash: hash({ contract: rollbackContract, siteId: "site_aidreamcapes", target, operations: rollbackOperations }),
  };
  fs.writeFileSync(rollbackPath, `${JSON.stringify(rollbackManifest, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        ...report,
        applied: report.applied.length,
        inverse: report.inverse.length,
        report: reportPath,
        rollback: rollbackPath,
        rollbackPlanHash: rollbackManifest.planHash,
      },
      null,
      2,
    ),
  );
  if (report.conflicts.length) process.exitCode = 2;
} finally {
  await db.$disconnect();
}
