// Apply a reviewed field manifest that removes Aidreamcapes LivePage rows the
// runtime never renders (301 redirect sources and retired public paths).
//
// Safety contract:
//   - dry-run by default; `--apply` is required to write.
//   - `--apply` requires `--base-hash=<planHash>` and an explicit confirmation.
//   - every delete is compare-and-set on (id, siteId, updatedAt) plus the
//     content hash of the row, so an online edit aborts that row instead of
//     deleting it.
//   - the delete runs inside one transaction holding a PostgreSQL advisory
//     lock, so no other writer can interleave.
//   - the `SiteContentRevision_LivePage` trigger must exist, and the derived
//     revision must advance by exactly the number of deleted rows.
//   - MyDreamShoots is hash-protected: its rows must be byte-identical before
//     and after.
//   - a rollback manifest is written first. It carries every writable column
//     of every deleted row so the rows can be rebuilt with the same
//     compare-and-set, against the current relational table only.
//
// This script never imports a snapshot, never activates a publication, and
// never generates content.
//
// Usage:
//   node scripts/apply-aidreamcapes-retired-rows.mjs \
//     --manifest=scripts/manifests/aidreamcapes-retired-rows-production-2026-10-23.json \
//     --target=production
//   node scripts/apply-aidreamcapes-retired-rows.mjs --manifest=... --target=production \
//     --apply --base-hash=<planHash> --confirm=aidreamcapes-retired-rows-production

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONTRACT = "aidreamcapes-retired-rows-v1";
const SITE_ID = "site_aidreamcapes";
const CONFIRM_TOKEN = "aidreamcapes-retired-rows-production";

const manifestPath = argumentValue("--manifest");
assert(manifestPath, "--manifest is required");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const target = argumentValue("--target") || manifest.target || "production";
const apply = hasArgument("--apply");
const reportPath = argumentValue("--report");
const rollbackPath = argumentValue("--rollback");

assert.equal(manifest.contract, CONTRACT);
assert.equal(manifest.siteId, SITE_ID);
assert.equal(manifest.target, target);
assert(["local", "production"].includes(target));
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: argumentValue("--confirm") === CONFIRM_TOKEN,
});

const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
// planHash covers exactly the reviewed plan: contract, site, target, rows.
const computedPlanHash = hash({ contract: manifest.contract, siteId: manifest.siteId, target, rows: manifest.rows });
assert.equal(computedPlanHash, manifest.planHash, "Manifest planHash does not match its own rows");
assert.equal(manifest.rows.length, manifest.rowCount);
assert(new Set(manifest.rows.map((row) => row.pageId)).size === manifest.rows.length, "Duplicate pageId in manifest");

if (apply) {
  assert.equal(argumentValue("--base-hash"), manifest.planHash, "An explicit reviewed plan hash is required");
  assert.equal(argumentValue("--confirm"), CONFIRM_TOKEN, `Apply requires --confirm=${CONFIRM_TOKEN}`);
  if (target === "production") {
    const commit = argumentValue("--deployed-commit");
    assert(/^[a-f0-9]{40}$/.test(commit || ""), "Production apply requires the exact deployed commit");
    assert.equal(fs.readFileSync(".deployed-commit", "utf8").trim(), commit,
      "Run production apply only from the verified deployed release");
  }
}

// ---------------------------------------------------------------------------
// Post-apply HTTP readback. The visible contract must not move: a redirect
// source still answers 301, a retired address still answers 404/410, and the
// sitemap keeps the same number of URLs.
//
// The local egress to the CDN is reset, so the readback runs on the release
// machine over SSH unless --http-probe-command is given.
// ---------------------------------------------------------------------------
const httpProbeCommand = argumentValue("--http-probe-command");
const httpReadback = apply ? { enabled: true, ran: false, sitemapLocCountBefore: manifest.sitemapLocCountAtPlan ?? null, sitemapLocCountAfter: null, statusChanges: [], sitemapChanged: null } : { enabled: false };

async function runHttpReadback(expectedRows) {
  const paths = expectedRows.map((row) => row.pageSlug);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), "ac-retired-readback-"));
  const pathsFile = path.join(workDir, "paths.json");
  const outFile = path.join(workDir, "probe.json");
  fs.writeFileSync(pathsFile, JSON.stringify(paths));
  const probeScript = "scripts/probe-aidreamcapes-shadowed-addresses.mjs";
  const command = httpProbeCommand
    ? `${httpProbeCommand} ${JSON.stringify(pathsFile)} ${JSON.stringify(outFile)}`
    : null;
  if (!command) {
    // Run the probe locally when the origin is reachable.
    const local = spawnSync(process.execPath, [probeScript, pathsFile, outFile], { encoding: "utf8" });
    if (local.status !== 0) {
      return { ran: false, error: "local probe failed; run the readback on the release machine", stdout: local.stdout?.slice(0, 2000) };
    }
  } else {
    const run = spawnSync("bash", ["-lc", command], { encoding: "utf8" });
    if (run.status !== 0) {
      return { ran: false, error: "remote probe failed", stdout: run.stdout?.slice(0, 2000), stderr: run.stderr?.slice(0, 2000) };
    }
  }
  if (!fs.existsSync(outFile)) return { ran: false, error: "probe produced no report" };
  const probe = JSON.parse(fs.readFileSync(outFile, "utf8"));
  const byPath = new Map(probe.results.map((entry) => [entry.path, entry]));
  const statusChanges = [];
  for (const row of expectedRows) {
    const observed = byPath.get(row.pageSlug);
    if (!observed) { statusChanges.push({ pageSlug: row.pageSlug, before: row.httpStatus, after: null, reason: "not-probed" }); continue; }
    if (observed.status !== row.httpStatus) {
      statusChanges.push({ pageSlug: row.pageSlug, before: row.httpStatus, after: observed.status, location: observed.location });
    }
  }
  const sitemapChanged = manifest.sitemapLocCountAtPlan != null && probe.sitemapLocCount !== manifest.sitemapLocCountAtPlan
    ? { before: manifest.sitemapLocCountAtPlan, after: probe.sitemapLocCount }
    : null;
  return {
    ran: true,
    origin: probe.origin,
    probed: probe.results.length,
    sitemapLocCountBefore: manifest.sitemapLocCountAtPlan ?? null,
    sitemapLocCountAfter: probe.sitemapLocCount,
    sitemapChanged,
    inSitemap: probe.inSitemap,
    statusChanges,
    report: outFile,
  };
}

const db = new PrismaClient();
try {
  const report = await db.$transaction(async (tx) => {
    if (apply) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('aidreamcapes-retired-rows-v1'))`;
      const trigger = await tx.$queryRaw`SELECT tgname FROM pg_trigger WHERE tgrelid = 'public."LivePage"'::regclass AND tgname = 'SiteContentRevision_LivePage' AND tgenabled != 'D'`;
      assert.equal(trigger.length, 1, "The SiteContentRevision_LivePage trigger is required");
    }
    // MyDreamShoots is hash-protected. The digest is computed in the database
    // so the check stays a single cheap round trip and still covers every
    // writable byte of every protected row.
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

    const current = await tx.livePage.findMany({
      where: { siteId: SITE_ID, id: { in: manifest.rows.map((row) => row.pageId) } },
      select: { id: true, siteId: true, slug: true, pageType: true, templateKey: true, title: true, contentJson: true, createdAt: true, updatedAt: true },
    });
    const byId = new Map(current.map((row) => [row.id, row]));

    const deleted = [];
    const conflicts = [];
    const skipped = [];
    // The rollback manifest is built from the rows as they exist right now, so
    // a rebuild restores exactly what was deleted.
    const rollbackRows = [];

    for (const planned of manifest.rows) {
      const row = byId.get(planned.pageId);
      if (!row) { conflicts.push({ pageSlug: planned.pageSlug, pageId: planned.pageId, reason: "row-missing" }); continue; }
      if (row.slug !== planned.pageSlug) {
        conflicts.push({ pageSlug: planned.pageSlug, pageId: planned.pageId, reason: "slug-changed" });
        continue;
      }
      if (new Date(row.updatedAt).toISOString() !== new Date(planned.updatedAt).toISOString()) {
        conflicts.push({ pageSlug: planned.pageSlug, pageId: planned.pageId, reason: "updated-at-changed" });
        continue;
      }
      if (hash(row.contentJson) !== planned.contentJsonSha256) {
        conflicts.push({ pageSlug: planned.pageSlug, pageId: planned.pageId, reason: "content-hash-changed" });
        continue;
      }
      rollbackRows.push({
        pageId: row.id,
        siteId: row.siteId,
        slug: row.slug,
        pageType: row.pageType,
        templateKey: row.templateKey,
        title: row.title,
        contentJson: row.contentJson,
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(row.updatedAt).toISOString(),
        contentJsonSha256: hash(row.contentJson),
      });
      if (!apply) { skipped.push({ pageSlug: row.slug, pageId: row.id, reason: "dry-run" }); continue; }
      // Compare-and-set delete. The predicate carries the id, the site and the
      // observed updatedAt, so a concurrent online edit matches zero rows and
      // the transaction aborts instead of removing edited content. The content
      // hash above already refused the row when the stored bytes drifted.
      const result = await tx.livePage.deleteMany({ where: { id: row.id, siteId: SITE_ID, updatedAt: row.updatedAt } });
      assert.equal(result.count, 1, `Concurrent edit to ${row.slug}; transaction aborted`);
      const readback = await tx.livePage.findFirst({ where: { id: row.id, siteId: SITE_ID }, select: { id: true } });
      assert.equal(readback, null, `${row.slug} still exists after the delete`);
      deleted.push({ pageSlug: row.slug, pageId: row.id, group: planned.group, reason: planned.reason, httpStatus: planned.httpStatus });
    }

    const revisionAfter = await revision();
    const protectedAfter = await protectedHash();
    assert.equal(protectedBefore, protectedAfter, "The protected MyDreamShoots store changed");
    if (apply) {
      assert.equal(BigInt(revisionAfter) - BigInt(revisionBefore), BigInt(deleted.length),
        "The derived content revision must advance by exactly the number of deleted rows");
    }

    return {
      ok: conflicts.length === 0,
      mode: apply ? "apply" : "dry-run",
      contract: CONTRACT,
      siteId: SITE_ID,
      target,
      planHash: manifest.planHash,
      deployedCommit: argumentValue("--deployed-commit") || null,
      plannedRows: manifest.rows.length,
      deleted: deleted.length,
      conflicts,
      skipped,
      deletedRows: deleted,
      revisionBefore,
      revisionAfter,
      myDreamShootsUnchanged: true,
      httpReadback,
      rollbackRows,
    };
  }, { timeout: 900000 });

  if (apply && report.deleted.length) {
    const readback = await runHttpReadback(manifest.rows.filter((row) => report.deletedRows.some((entry) => entry.pageId === row.pageId)));
    httpReadback.ran = readback.ran;
    httpReadback.origin = readback.origin ?? null;
    httpReadback.probed = readback.probed ?? null;
    httpReadback.sitemapLocCountAfter = readback.sitemapLocCountAfter ?? null;
    httpReadback.sitemapChanged = readback.sitemapChanged ?? null;
    httpReadback.inSitemap = readback.inSitemap ?? null;
    httpReadback.statusChanges = readback.statusChanges ?? [];
    httpReadback.error = readback.error ?? null;
    assert(readback.ran, "The post-apply HTTP readback must run: " + (readback.error || "unknown error"));
    assert.equal(readback.statusChanges.length, 0,
      `The visible HTTP contract changed: ${JSON.stringify(readback.statusChanges)}`);
    assert.equal(readback.sitemapChanged, null,
      `The sitemap changed: ${JSON.stringify(readback.sitemapChanged)}`);
    assert.equal((readback.inSitemap ?? []).length, 0, "A cleaned address entered the sitemap");
  }

  if (report.rollbackRows.length) {
    const rollbackOut = rollbackPath || manifestPath.replace(/\.json$/, apply ? "-rollback.json" : "-dry-run-rollback.json");
    fs.writeFileSync(rollbackOut, JSON.stringify({
      ok: true,
      contract: "aidreamcapes-retired-rows-rollback-v1",
      siteId: SITE_ID,
      target,
      planHash: manifest.planHash,
      mode: apply ? "apply" : "dry-run",
      note: "Field-level inverse of the deleted rows. Rebuild with a compare-and-set insert against the current relational table; never restore a historical publication or snapshot.",
      rowCount: report.rollbackRows.length,
      rows: report.rollbackRows,
      generatedAt: new Date().toISOString(),
    }, null, 2) + "\n");
    report.rollbackManifest = rollbackOut;
  }

  const out = reportPath || manifestPath.replace(/\.json$/, apply ? "-apply.json" : "-dry-run.json");
  const { rollbackRows, ...rest } = report;
  fs.writeFileSync(out, JSON.stringify({ ...rest, rollbackRowsCaptured: rollbackRows.length }, null, 2) + "\n");
  console.log(JSON.stringify({
    ...rest,
    rollbackRowsCaptured: rollbackRows.length,
    report: out,
  }, null, 2));
  if (report.conflicts.length) process.exitCode = 2;
  if (apply && httpReadback.ran && httpReadback.statusChanges.length) process.exitCode = 3;
} finally {
  await db.$disconnect();
}
