#!/usr/bin/env node
// Field-level CAS apply for the reviewed Aidreamcapes header navigation plan.
//
// The reviewed manifest is the review artifact. This script:
//   1. verifies the manifest hash, the scoped target and the confirmation;
//   2. re-reads the root LivePage row and verifies its base hash and that the
//      navigation still matches the reviewed "before" state;
//   3. writes only `contentJson.siteNavigation`;
//   4. reads the row back, checks SiteContentRevision advanced once, and
//      verifies MyDreamShoots public content did not change.
//
// Dry-run is the default. Apply requires the reviewed plan hash and the
// explicit confirmation phrase:
//   node --env-file=.env scripts/apply-aidreamcapes-nav-items.mjs --target=production
//   node --env-file=.env scripts/apply-aidreamcapes-nav-items.mjs --target=production --apply \
//     --confirm=site_aidreamcapes-nav-items-production --base-hash=<planHash>
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const CONTRACT = "aidreamcapes-nav-item-2026-10-22-v1";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const confirmation = argumentValue("--confirm");
const baseHash = argumentValue("--base-hash");
const apply = hasArgument("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-nav-items-production"
  : "site_aidreamcapes-nav-items";
const manifestPath = path.resolve(
  process.cwd(),
  argumentValue("--manifest") || `scripts/manifests/aidreamcapes-nav-items-${target}-2026-10-22.json`
);

function stable(value) {
  if (value === undefined) return '"<undefined>"';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function pageHash(row) {
  return hash({
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    title: row.title,
    pageType: row.pageType,
    templateKey: row.templateKey,
    contentJson: row.contentJson,
    updatedAt: row.updatedAt
  });
}
async function protectedMyDreamShootsHash(client) {
  const [pages, settings, profile] = await Promise.all([
    client.livePage.findMany({
      where: { siteId: "site_dreamshoot" },
      orderBy: { id: "asc" },
      select: { id: true, contentJson: true, updatedAt: true }
    }),
    client.themeSettings.findUnique({ where: { siteId: "site_dreamshoot" }, select: { draftJson: true, publishedJson: true } }),
    client.storefrontProfile.findUnique({ where: { siteId: "site_dreamshoot" }, select: { publishedJson: true } })
  ]);
  return hash({ pages, settings, profile });
}

assert(fs.existsSync(manifestPath), `Manifest not found: ${manifestPath}. Run the plan script first.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not an ok plan.");
assert.equal(manifest.contract, CONTRACT, `Unsupported manifest contract: ${manifest.contract}.`);
assert.equal(manifest.siteId, SITE_ID, "Manifest must be scoped to site_aidreamcapes.");
assert.equal(manifest.target, target, `Manifest target ${manifest.target} does not match requested target ${target}.`);
assert.equal(
  hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    page: manifest.page,
    removals: manifest.removals,
    additions: manifest.additions,
    before: manifest.before,
    after: manifest.after
  }),
  manifest.planHash,
  "Manifest content does not match its plan hash."
);
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply && target === "production",
  productionConfirmed: confirmation === expectedConfirmation
});
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert(baseHash, "Apply requires --base-hash=<manifest planHash>.");
  assert.equal(baseHash, manifest.planHash, "The reviewed plan hash does not match the manifest; re-run the plan and review it again.");
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const row = await db.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: manifest.page.slug } },
    select: {
      id: true,
      siteId: true,
      slug: true,
      title: true,
      pageType: true,
      templateKey: true,
      contentJson: true,
      updatedAt: true
    }
  });
  assert(row, `No LivePage for ${SITE_ID} ${manifest.page.slug}.`);
  const currentNavigation = record(record(row.contentJson)?.siteNavigation);
  const baseMatches = pageHash(row) === manifest.page.baseHash;
  const state = !baseMatches
    ? "conflict"
    : stable(currentNavigation) === stable(manifest.after)
      ? "after"
      : stable(currentNavigation) === stable(manifest.before)
        ? "before"
        : "conflict";
  const summary = {
    ok: state !== "conflict",
    mode: apply ? "apply" : "dry-run",
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    state,
    removals: manifest.removals,
    additions: manifest.additions ?? []
  };
  if (state === "conflict") {
    console.log(JSON.stringify({
      ...summary,
      reason: baseMatches
        ? "The root navigation differs from both the reviewed before and after state; online edit wins, refusing to overwrite."
        : "The root page changed since the reviewed plan (baseHash mismatch); online edit wins, refusing to overwrite."
    }, null, 2));
    process.exitCode = 1;
  } else if (state === "after") {
    console.log(JSON.stringify({ ...summary, noop: true }, null, 2));
  } else if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    const [revisionRelation] = await db.$queryRaw`SELECT to_regclass('public."SiteContentRevision"')::text AS relation`;
    assert(revisionRelation?.relation, "SiteContentRevision table is missing; refusing to write without derived-state revision.");
    const [revisionTrigger] = await db.$queryRaw`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'public."LivePage"'::regclass
        AND tgname = 'SiteContentRevision_LivePage'
      LIMIT 1
    `;
    assert(revisionTrigger?.tgname, "SiteContentRevision_LivePage trigger is missing; refusing to write without derived-state revision.");

    const reportPath = path.resolve(
      process.cwd(),
      argumentValue("--report") || `scripts/manifests/aidreamcapes-nav-items-${target}-2026-10-22-apply-report.json`
    );
    const rollbackPath = path.resolve(
      process.cwd(),
      argumentValue("--rollback") || `scripts/manifests/aidreamcapes-nav-items-${target}-2026-10-22-rollback.json`
    );
    const report = await db.$transaction(async (tx) => {
      const protectedBefore = await protectedMyDreamShootsHash(tx);
      const readRevision = async () => {
        const rows = await tx.$queryRaw`
          SELECT "revision"::text AS revision
          FROM "SiteContentRevision"
          WHERE "siteId" = ${SITE_ID}
          LIMIT 1
        `;
        return BigInt(rows[0]?.revision ?? "0");
      };
      const revisionBefore = await readRevision();
      const nextContentJson = structuredClone(row.contentJson ?? {});
      nextContentJson.siteNavigation = structuredClone(manifest.after);
      const updated = await tx.livePage.updateMany({
        where: { id: row.id, updatedAt: row.updatedAt },
        data: { contentJson: nextContentJson }
      });
      assert.equal(updated.count, 1, "The root page changed concurrently; refusing to overwrite.");
      const readback = await tx.livePage.findUniqueOrThrow({
        where: { id: row.id },
        select: { slug: true, contentJson: true, updatedAt: true }
      });
      assert.equal(
        stable(record(readback.contentJson)?.siteNavigation),
        stable(manifest.after),
        "The root navigation did not read back at the reviewed after state."
      );
      const revisionAfter = await readRevision();
      assert.equal(revisionAfter, revisionBefore + 1n, `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected 1.`);
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the navigation apply.");
      return {
        ok: true,
        mode: "apply",
        contract: CONTRACT,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        page: manifest.page.slug,
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        revisionDelta: (revisionAfter - revisionBefore).toString(),
        removals: manifest.removals
      };
    });
    const rollback = {
      ok: true,
      contract: CONTRACT,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      page: { ...manifest.page, baseHash: null },
      before: manifest.after,
      after: manifest.before,
      removals: manifest.removals.map((removal) => ({ ...removal, reason: `restore ${removal.label}` }))
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...summary, ...report, reportPath, rollbackPath }, null, 2));
  }
} finally {
  await db.$disconnect();
}
