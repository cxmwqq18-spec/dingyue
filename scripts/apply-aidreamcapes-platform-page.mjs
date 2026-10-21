#!/usr/bin/env node
// Field-level create for the Aidreamcapes platform directory page.
//
// The reviewed manifest contains the exact public LivePage row. This script:
//   1. verifies the manifest hash and scoped target;
//   2. verifies every referenced public asset exists in this release;
//   3. refuses to overwrite an existing row (online edits win);
//   4. creates only the one LivePage row, reads it back, and verifies the
//      SiteContentRevision trigger advanced exactly once;
//   5. verifies MyDreamShoots public content did not change.
//
// Dry-run is the default. Apply requires the reviewed plan hash and explicit
// confirmation:
//   node scripts/apply-aidreamcapes-platform-page.mjs \
//     --target=local --apply --confirm=aidreamcapes-platform-page \
//     --base-hash=<planHash>
// Production additionally requires:
//   --target=production --confirm=aidreamcapes-platform-page-production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const CONTRACT = "aidreamcapes-platform-page-2026-10-21-v1";
const DEFAULT_MANIFEST = "scripts/manifests/aidreamcapes-platform-page-production-2026-10-21.json";
const manifestPath = path.resolve(process.cwd(), argumentValue("--manifest") || DEFAULT_MANIFEST);
const apply = hasArgument("--apply");
const target = argumentValue("--target") || "local";
const confirmation = argumentValue("--confirm");
const baseHash = argumentValue("--base-hash");
const expectedConfirmation = target === "production" ? "aidreamcapes-platform-page-production" : "aidreamcapes-platform-page";

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

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.ok, true, "Manifest is not an ok plan.");
  assert.equal(manifest.contract, CONTRACT, `Manifest contract must be ${CONTRACT}.`);
  assert.equal(manifest.siteId, SITE_ID, "Manifest must be scoped to site_aidreamcapes.");
  assert.equal(manifest.target, target, `Manifest target ${manifest.target} does not match requested target ${target}.`);
  assert.equal(manifest.slug, "/platforms", "Manifest must create /platforms.");
  assert.equal(manifest.expectedAbsent, true, "Manifest must require an absent row.");
  const value = record(manifest.value);
  assert(value, "Manifest value must be a LivePage row.");
  assert.equal(value.id, "site_aidreamcapes_platforms", "Unexpected LivePage id.");
  assert.equal(value.siteId, SITE_ID, "Unexpected row siteId.");
  assert.equal(value.slug, "/platforms", "Unexpected row slug.");
  assert.equal(value.pageType, "content", "Unexpected pageType.");
  assert.equal(value.templateKey, "aidreamcapes-v2", "Unexpected templateKey.");
  assert.equal(typeof value.title, "string", "Missing title.");
  assert(record(value.contentJson), "Missing contentJson.");
  const recomputed = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    slug: manifest.slug,
    expectedAbsent: manifest.expectedAbsent,
    value: manifest.value
  });
  assert.equal(recomputed, manifest.planHash, "Manifest content does not match its plan hash.");
  return manifest;
}

function contentAssets(contentJson) {
  const assets = new Set();
  const walk = (value) => {
    if (typeof value === "string") {
      if (/^\/assets\/sites\/site_aidreamcapes\/.+\.(?:avif|gif|jpe?g|png|webp)$/i.test(value)) assets.add(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object") Object.values(value).forEach(walk);
  };
  walk(contentJson);
  return [...assets].sort();
}

function sameRow(row, value) {
  return row.id === value.id
    && row.siteId === value.siteId
    && row.slug === value.slug
    && row.title === value.title
    && row.pageType === value.pageType
    && row.templateKey === value.templateKey
    && hash(row.contentJson) === hash(value.contentJson);
}

async function protectedMyDreamShootsHash(client) {
  const [pages, settings, profile] = await Promise.all([
    client.livePage.findMany({
      where: { siteId: "site_dreamshoot" },
      orderBy: { id: "asc" },
      select: { id: true, contentJson: true, updatedAt: true }
    }),
    client.themeSettings.findUnique({
      where: { siteId: "site_dreamshoot" },
      select: { draftJson: true, publishedJson: true }
    }),
    client.storefrontProfile.findUnique({
      where: { siteId: "site_dreamshoot" },
      select: { publishedJson: true }
    })
  ]);
  return hash({ pages, settings, profile });
}

const manifest = readManifest();
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed: confirmation === expectedConfirmation
});
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(baseHash, manifest.planHash, "Apply requires --base-hash equal to the reviewed plan hash.");
}

const assets = contentAssets(manifest.value.contentJson);
for (const asset of assets) {
  const file = path.join(process.cwd(), "public", asset.slice(1));
  assert(fs.existsSync(file), `Referenced public asset is missing: ${asset}`);
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const select = {
    id: true,
    siteId: true,
    slug: true,
    title: true,
    pageType: true,
    templateKey: true,
    contentJson: true,
    updatedAt: true
  };
  const existing = await db.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: manifest.slug } },
    select
  });
  const idCollision = await db.livePage.findUnique({
    where: { id: manifest.value.id },
    select: { id: true, siteId: true, slug: true }
  });
  assert(!idCollision || (existing && sameRow(existing, manifest.value)), `LivePage id ${manifest.value.id} is already used by another row.`);
  if (existing) assert(sameRow(existing, manifest.value), "The /platforms row already exists with different content; online edits win. Replan or repair explicitly.");

  const summary = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    contract: manifest.contract,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    manifest: path.relative(process.cwd(), manifestPath),
    slug: manifest.slug,
    expectedAbsent: true,
    alreadyApplied: Boolean(existing),
    assets: assets.length,
    writes: existing ? 0 : 1,
    report: undefined
  };

  if (!apply || existing) {
    console.log(JSON.stringify({ ...summary, noop: apply && Boolean(existing) }, null, 2));
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
      argumentValue("--report") ||
        `scripts/manifests/aidreamcapes-platform-page-${target}-2026-10-21-apply-report.json`
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
      const current = await tx.livePage.findUnique({
        where: { siteId_slug: { siteId: SITE_ID, slug: manifest.slug } },
        select
      });
      assert(!current, "The /platforms row appeared after validation; refusing to overwrite it.");
      await tx.livePage.create({
        data: {
          id: manifest.value.id,
          siteId: manifest.value.siteId,
          slug: manifest.value.slug,
          title: manifest.value.title,
          pageType: manifest.value.pageType,
          templateKey: manifest.value.templateKey,
          contentJson: manifest.value.contentJson
        }
      });
      const readback = await tx.livePage.findUniqueOrThrow({
        where: { siteId_slug: { siteId: SITE_ID, slug: manifest.slug } },
        select
      });
      assert(sameRow(readback, manifest.value), "Created /platforms row readback mismatch.");
      const revisionAfter = await readRevision();
      assert.equal(revisionAfter, revisionBefore + 1n, `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected 1.`);
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the platform page apply.");
      const [derivedRelation] = await tx.$queryRaw`
        SELECT to_regclass('public."SitePublishedState"')::text AS relation
      `;
      const derivedState = derivedRelation?.relation
        ? (await tx.$queryRaw`
            SELECT "revision"::text AS revision, "contentHash"
            FROM "SitePublishedState"
            WHERE "siteId" = ${SITE_ID}
            LIMIT 1
          `)[0] ?? null
        : null;
      return {
        ok: true,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        owner: "LivePage.contentJson",
        created: {
          id: readback.id,
          slug: readback.slug,
          title: readback.title,
          contentHash: hash(readback.contentJson),
          updatedAt: readback.updatedAt
        },
        fieldsApplied: 1,
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        revisionDelta: (revisionAfter - revisionBefore).toString(),
        protectedMyDreamShootsHashBefore: protectedBefore,
        protectedMyDreamShootsHashAfter: protectedAfter,
        myDreamShootsChanged: protectedAfter !== protectedBefore,
        derivedStateReadOnly: derivedState
          ? { revision: derivedState.revision.toString(), contentHash: derivedState.contentHash }
          : null,
        snapshotOrPublicationWritten: false,
        historicalStateActivated: false
      };
    }, { isolationLevel: "Serializable", timeout: 180000 });

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ ...summary, report }, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      ...summary,
      revisionBefore: report.revisionBefore,
      revisionAfter: report.revisionAfter,
      revisionDelta: report.revisionDelta,
      myDreamShootsChanged: report.myDreamShootsChanged,
      report: path.relative(process.cwd(), reportPath)
    }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: apply ? "apply" : "dry-run",
    target,
    siteId: SITE_ID,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
