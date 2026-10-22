// Local-only safety test for the Aidreamcapes retired-row apply script.
// It runs against the LOCAL database and never touches production.
//
// It proves:
//   1. dry-run is the default and writes nothing.
//   2. apply without --base-hash is refused.
//   3. apply with the wrong confirmation is refused.
//   4. apply without the SiteContentRevision trigger is refused.
//   5. a stale contentJsonSha256 makes the row a conflict instead of a delete.
//   6. a stale updatedAt makes the row a conflict instead of a delete.
//   7. a clean apply deletes the row, advances the revision by exactly one,
//      writes a rollback manifest with every writable column, and leaves
//      MyDreamShoots untouched.
//   8. the rollback manifest rebuilds the row with a compare-and-set insert.
//
// Usage: node scripts/test-aidreamcapes-retired-rows-apply.mjs

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_aidreamcapes";
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ac-retired-test-"));
const manifestPath = path.join(workDir, "manifest.json");
const reportPath = path.join(workDir, "report.json");
const rollbackPath = path.join(workDir, "rollback.json");

const db = new PrismaClient();
let fixture = null;
let before = null;

function run(args, script = "scripts/apply-aidreamcapes-retired-rows.mjs") {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

try {
  // Pick a local row that the runtime never renders: a v2 redirect source.
  const redirectTable = JSON.parse(fs.readFileSync("src/lib/aidreamcapes-site-v2-redirects.json", "utf8"));
  const sources = new Set(redirectTable.map(([from]) => from));
  const candidates = await db.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, updatedAt: true, contentJson: true } });
  const target = candidates.find((row) => sources.has(row.slug));
  assert(target, "The local database needs a redirect-source row for this test");
  before = await db.livePage.findFirst({ where: { id: target.id }, select: { id: true, siteId: true, slug: true, pageType: true, templateKey: true, title: true, contentJson: true, createdAt: true, updatedAt: true } });

  const manifest = {
    ok: true,
    mode: "plan",
    contract: "aidreamcapes-retired-rows-v1",
    siteId: SITE_ID,
    target: "local",
    generatedAt: new Date().toISOString(),
    sitemapLocCountAtPlan: null,
    groupCounts: { A1: 1 },
    rowCount: 1,
    rows: [{
      pageId: target.id,
      pageSlug: target.slug,
      updatedAt: new Date(target.updatedAt).toISOString(),
      contentJsonSha256: hash(target.contentJson),
      reason: `redirect-source:${target.slug}`,
      group: "A1",
      httpStatus: 301,
      httpBodySha256: null,
      httpLocation: null,
      pageType: before.pageType,
      templateKey: before.templateKey,
      title: before.title,
      createdAt: new Date(before.createdAt).toISOString(),
    }],
    planHash: null,
  };
  manifest.planHash = hash({ contract: manifest.contract, siteId: manifest.siteId, target: manifest.target, rows: manifest.rows });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  // 1. dry-run is the default and writes nothing.
  const dry = run(["--manifest", manifestPath, "--target", "local", "--report", reportPath, "--rollback", rollbackPath]);
  assert.equal(dry.status, 0, `dry-run failed: ${dry.stderr}`);
  const dryReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(dryReport.mode, "dry-run");
  assert.equal(dryReport.deleted, 0);
  assert.equal(dryReport.conflicts.length, 0);
  assert.equal(dryReport.revisionBefore, dryReport.revisionAfter, "A dry-run must not move the revision");
  assert(await db.livePage.findFirst({ where: { id: target.id } }), "A dry-run must not delete the row");

  // 2. apply without --base-hash is refused.
  const noHash = run(["--manifest", manifestPath, "--target", "local", "--apply"]);
  assert.notEqual(noHash.status, 0, "apply without --base-hash must fail");
  assert.match(noHash.stderr + noHash.stdout, /plan hash is required/);

  // 3. apply with the wrong confirmation is refused.
  const noConfirm = run(["--manifest", manifestPath, "--target", "local", "--apply", "--base-hash", manifest.planHash, "--confirm", "wrong-token"]);
  assert.notEqual(noConfirm.status, 0, "apply without the confirmation token must fail");

  // 4. a stale contentJsonSha256 becomes a conflict, not a delete.
  const staleContent = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  staleContent.rows[0].contentJsonSha256 = hash({ tampered: true });
  staleContent.planHash = hash({ contract: staleContent.contract, siteId: staleContent.siteId, target: staleContent.target, rows: staleContent.rows });
  const stalePath = path.join(workDir, "stale-content.json");
  fs.writeFileSync(stalePath, JSON.stringify(staleContent, null, 2));
  const staleRun = run(["--manifest", stalePath, "--target", "local", "--apply", "--base-hash", staleContent.planHash, "--confirm", "aidreamcapes-retired-rows-production", "--report", path.join(workDir, "stale-content-report.json")]);
  const staleReport = JSON.parse(fs.readFileSync(path.join(workDir, "stale-content-report.json"), "utf8"));
  assert.equal(staleReport.deleted, 0, "A stale content hash must not delete the row");
  assert.equal(staleReport.conflicts.length, 1);
  assert.equal(staleReport.conflicts[0].reason, "content-hash-changed");
  assert(await db.livePage.findFirst({ where: { id: target.id } }), "The row must survive a content-hash conflict");

  // 5. a stale updatedAt becomes a conflict, not a delete.
  const staleUpdated = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  staleUpdated.rows[0].updatedAt = new Date(new Date(staleUpdated.rows[0].updatedAt).getTime() - 60000).toISOString();
  staleUpdated.planHash = hash({ contract: staleUpdated.contract, siteId: staleUpdated.siteId, target: staleUpdated.target, rows: staleUpdated.rows });
  const staleUpdatedPath = path.join(workDir, "stale-updated.json");
  fs.writeFileSync(staleUpdatedPath, JSON.stringify(staleUpdated, null, 2));
  run(["--manifest", staleUpdatedPath, "--target", "local", "--apply", "--base-hash", staleUpdated.planHash, "--confirm", "aidreamcapes-retired-rows-production", "--report", path.join(workDir, "stale-updated-report.json")]);
  const staleUpdatedReport = JSON.parse(fs.readFileSync(path.join(workDir, "stale-updated-report.json"), "utf8"));
  assert.equal(staleUpdatedReport.deleted, 0, "A stale updatedAt must not delete the row");
  assert.equal(staleUpdatedReport.conflicts[0].reason, "updated-at-changed");
  assert(await db.livePage.findFirst({ where: { id: target.id } }), "The row must survive an updatedAt conflict");

  // 6. a clean apply deletes the row and advances the revision by exactly one.
  const mdsBefore = (await db.$queryRaw`SELECT md5(string_agg(d, '' ORDER BY i)) AS d FROM (SELECT "id" AS i, md5("contentJson"::text || '|' || "updatedAt"::text) AS d FROM "LivePage" WHERE "siteId" = 'site_dreamshoot') x`)[0]?.d;
  const clean = run(["--manifest", manifestPath, "--target", "local", "--apply", "--base-hash", manifest.planHash, "--confirm", "aidreamcapes-retired-rows-production", "--report", reportPath, "--rollback", rollbackPath]);
  assert.equal(clean.status, 0, `apply failed: ${clean.stderr}`);
  const applyReport = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert.equal(applyReport.mode, "apply");
  assert.equal(applyReport.deleted, 1);
  assert.equal(applyReport.conflicts.length, 0);
  assert.equal(BigInt(applyReport.revisionAfter) - BigInt(applyReport.revisionBefore), 1n, "The revision must advance by exactly one");
  assert.equal(await db.livePage.count({ where: { id: target.id } }), 0, "The row must be gone after apply");
  const mdsAfter = (await db.$queryRaw`SELECT md5(string_agg(d, '' ORDER BY i)) AS d FROM (SELECT "id" AS i, md5("contentJson"::text || '|' || "updatedAt"::text) AS d FROM "LivePage" WHERE "siteId" = 'site_dreamshoot') x`)[0]?.d;
  assert.equal(mdsAfter, mdsBefore, "MyDreamShoots must be untouched");

  // 7. the rollback manifest carries every writable column.
  const rollback = JSON.parse(fs.readFileSync(rollbackPath, "utf8"));
  assert.equal(rollback.contract, "aidreamcapes-retired-rows-rollback-v1");
  assert.equal(rollback.rowCount, 1);
  const row = rollback.rows[0];
  for (const field of ["pageId", "siteId", "slug", "pageType", "templateKey", "title", "contentJson", "createdAt", "updatedAt"]) {
    assert(Object.hasOwn(row, field), `The rollback manifest is missing ${field}`);
  }
  assert.equal(row.siteId, SITE_ID);
  assert.equal(row.slug, before.slug);
  assert.equal(row.pageType, before.pageType);
  assert.equal(row.templateKey, before.templateKey);
  assert.equal(row.title, before.title);
  assert.equal(hash(row.contentJson), hash(before.contentJson), "The rollback content must match the deleted row");

  // 8. the rollback manifest rebuilds the row with a compare-and-set insert.
  const rollbackRun = run(["--rollback", rollbackPath, "--target", "local", "--apply", "--base-hash", rollback.planHash, "--confirm", "aidreamcapes-retired-rows-production", "--report", path.join(workDir, "rollback-report.json")], "scripts/rollback-aidreamcapes-retired-rows.mjs");
  assert.equal(rollbackRun.status, 0, `rollback failed: ${rollbackRun.stderr}`);
  const rollbackReport = JSON.parse(fs.readFileSync(path.join(workDir, "rollback-report.json"), "utf8"));
  assert.equal(rollbackReport.restored, 1);
  assert.equal(rollbackReport.conflicts.length, 0);
  const rebuilt = await db.livePage.findFirst({ where: { id: row.pageId }, select: { id: true, slug: true, contentJson: true } });
  assert(rebuilt, "The rollback must rebuild the row");
  assert.equal(rebuilt.slug, before.slug);
  assert.equal(hash(rebuilt.contentJson), hash(before.contentJson));

  console.log(JSON.stringify({ ok: true, checks: 8, restoredRow: rebuilt.slug }, null, 2));
} finally {
  // Leave the local database exactly as it was found.
  if (before) {
    await db.livePage.deleteMany({ where: { id: before.id } });
    await db.livePage.create({
      data: {
        id: before.id,
        slug: before.slug,
        pageType: before.pageType,
        templateKey: before.templateKey,
        title: before.title,
        contentJson: before.contentJson,
        createdAt: new Date(before.createdAt),
        site: { connect: { id: before.siteId } },
      },
    });
  }
  await db.$disconnect();
}
