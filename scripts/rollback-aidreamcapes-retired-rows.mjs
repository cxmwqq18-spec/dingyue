// Rebuild the LivePage rows removed by apply-aidreamcapes-retired-rows.mjs.
//
// The rollback manifest carries every writable column of every deleted row, so
// a rebuild is a field-level inverse against the current relational table.
// It never imports a historical publication or snapshot.
//
// The insert is compare-and-set:
//   - a row whose id already exists is a conflict and is skipped;
//   - a slug that another live row already owns is a conflict and is skipped;
//   - the restored content must hash to the value recorded in the rollback.
//
// Usage:
//   node scripts/rollback-aidreamcapes-retired-rows.mjs \
//     --rollback=scripts/manifests/aidreamcapes-retired-rows-production-2026-10-23-rollback.json \
//     --target=production \
//     --apply --base-hash=<planHash> --confirm=aidreamcapes-retired-rows-production

import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONTRACT = "aidreamcapes-retired-rows-rollback-v1";
const SITE_ID = "site_aidreamcapes";
const CONFIRM_TOKEN = "aidreamcapes-retired-rows-production";

const rollbackPath = argumentValue("--rollback");
assert(rollbackPath, "--rollback is required");
const rollback = JSON.parse(fs.readFileSync(rollbackPath, "utf8"));
const target = argumentValue("--target") || rollback.target || "production";
const apply = hasArgument("--apply");
const reportPath = argumentValue("--report");

assert.equal(rollback.contract, CONTRACT);
assert.equal(rollback.siteId, SITE_ID);
assert.equal(rollback.target, target);
assert(["local", "production"].includes(target));
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: argumentValue("--confirm") === CONFIRM_TOKEN,
});

const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
if (apply) {
  assert.equal(argumentValue("--base-hash"), rollback.planHash, "An explicit reviewed plan hash is required");
  assert.equal(argumentValue("--confirm"), CONFIRM_TOKEN, `Apply requires --confirm=${CONFIRM_TOKEN}`);
}

const db = new PrismaClient();
try {
  const report = await db.$transaction(async (tx) => {
    if (apply) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('aidreamcapes-retired-rows-v1'))`;
      const trigger = await tx.$queryRaw`SELECT tgname FROM pg_trigger WHERE tgrelid = 'public."LivePage"'::regclass AND tgname = 'SiteContentRevision_LivePage' AND tgenabled != 'D'`;
      assert.equal(trigger.length, 1, "The SiteContentRevision_LivePage trigger is required");
    }
    const protectedHash = async () => (await tx.$queryRaw`
      SELECT md5(string_agg(row_digest, '' ORDER BY row_id)) AS digest
      FROM (
        SELECT "id" AS row_id,
               md5("contentJson"::text || '|' || "updatedAt"::text) AS row_digest
        FROM "LivePage"
        WHERE "siteId" = 'site_dreamshoot'
      ) protected_rows
    `)[0]?.digest || "";
    const revision = async () => (await tx.$queryRaw`SELECT revision::text FROM "SiteContentRevision" WHERE "siteId" = ${SITE_ID}`)[0]?.revision || "0";
    const protectedBefore = await protectedHash();
    const revisionBefore = await revision();

    const restored = [];
    const conflicts = [];
    const skipped = [];

    for (const row of rollback.rows) {
      assert.equal(row.siteId, SITE_ID, `Rollback row ${row.pageId} belongs to another store`);
      if (hash(row.contentJson) !== row.contentJsonSha256) {
        conflicts.push({ pageSlug: row.slug, pageId: row.pageId, reason: "rollback-content-hash-mismatch" });
        continue;
      }
      const existing = await tx.livePage.findFirst({ where: { id: row.pageId }, select: { id: true } });
      if (existing) { conflicts.push({ pageSlug: row.slug, pageId: row.pageId, reason: "id-already-exists" }); continue; }
      const slugOwner = await tx.livePage.findFirst({ where: { siteId: SITE_ID, slug: row.slug }, select: { id: true } });
      if (slugOwner) { conflicts.push({ pageSlug: row.slug, pageId: row.pageId, reason: "slug-already-owned" }); continue; }
      if (!apply) { skipped.push({ pageSlug: row.slug, pageId: row.pageId, reason: "dry-run" }); continue; }
      await tx.livePage.create({
        data: {
          id: row.pageId,
          slug: row.slug,
          pageType: row.pageType,
          templateKey: row.templateKey,
          title: row.title,
          contentJson: row.contentJson,
          createdAt: new Date(row.createdAt),
          site: { connect: { id: row.siteId } },
        },
      });
      const readback = await tx.livePage.findFirst({ where: { id: row.pageId }, select: { id: true, contentJson: true } });
      assert(readback, `${row.slug} was not restored`);
      assert.equal(hash(readback.contentJson), row.contentJsonSha256, `${row.slug} was restored with different content`);
      restored.push({ pageSlug: row.slug, pageId: row.pageId });
    }

    const revisionAfter = await revision();
    const protectedAfter = await protectedHash();
    assert.equal(protectedBefore, protectedAfter, "The protected MyDreamShoots store changed");
    if (apply) {
      assert.equal(BigInt(revisionAfter) - BigInt(revisionBefore), BigInt(restored.length),
        "The derived content revision must advance by exactly the number of restored rows");
    }
    return {
      ok: conflicts.length === 0,
      mode: apply ? "apply" : "dry-run",
      contract: CONTRACT,
      siteId: SITE_ID,
      target,
      planHash: rollback.planHash,
      plannedRows: rollback.rows.length,
      restored: restored.length,
      restoredRows: restored,
      conflicts,
      skipped,
      revisionBefore,
      revisionAfter,
      myDreamShootsUnchanged: true,
    };
  }, { timeout: 900000 });

  const out = reportPath || rollbackPath.replace(/\.json$/, apply ? "-apply.json" : "-dry-run.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, report: out }, null, 2));
  if (report.conflicts.length) process.exitCode = 2;
} finally {
  await db.$disconnect();
}
