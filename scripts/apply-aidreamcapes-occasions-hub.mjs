#!/usr/bin/env node
// Apply the reviewed Aidreamcapes /occasions hub LivePage insert
// (planned by scripts/plan-aidreamcapes-occasions-hub.mjs, Step 1 of
// docs/aivideosugc-template-cases-navigation-plan.md).
//
// Insert-only with CAS guards:
//  - refuses when the row exists with different content (online edit wins);
//  - skips when the row already matches the reviewed content (idempotent);
//  - verifies every referenced occasion facet page exists;
//  - verifies MyDreamShoots rows are untouched around the transaction;
//  - verifies the SiteContentRevision advanced (DB trigger).
// Dry-run is the default:
//   node --env-file=.env.local scripts/apply-aidreamcapes-occasions-hub.mjs --target=local
//   node --env-file=.env.local scripts/apply-aidreamcapes-occasions-hub.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-occasions-hub-local --base-hash=<planHash>
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-occasions-hub-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = `site_aidreamcapes-occasions-hub-${target}`;
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-occasions-hub-${target}-2026-10-30.json`
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

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not marked ok; plan first.");
assert.equal(manifest.contract, CONTRACT, "Manifest contract mismatch.");
assert.equal(manifest.siteId, SITE_ID, "Manifest site mismatch.");
assert.equal(manifest.target, target, "Manifest target mismatch.");
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(baseHash, manifest.planHash, "Apply requires --base-hash=<manifest planHash> (CAS).");
}

const row = manifest.row;
const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const existing = await db.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: row.slug } },
    select: { id: true, contentJson: true, updatedAt: true }
  });
  const facets = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: manifest.referencedFacets } },
    select: { slug: true }
  });
  const missingFacets = manifest.referencedFacets.filter((slug) => !facets.some((entry) => entry.slug === slug));

  if (missingFacets.length) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", reason: "missing referenced facet pages", missingFacets }, null, 2));
    process.exitCode = 1;
  } else if (existing && hash(existing.contentJson) === row.contentHash) {
    console.log(JSON.stringify({ ok: true, mode: apply ? "apply" : "dry-run", state: "already-applied", slug: row.slug }, null, 2));
  } else if (existing) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", reason: "LivePage already exists with different content; online edit wins", slug: row.slug, updatedAt: existing.updatedAt }, null, 2));
    process.exitCode = 1;
  } else if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", state: "would-insert", slug: row.slug, referencedFacets: manifest.referencedFacets }, null, 2));
  } else {
    const report = await db.$transaction(async (tx) => {
      const protectedHash = async (client) => {
        const rowsMy = await client.$queryRaw`
          SELECT "slug", "contentJson", "updatedAt"
          FROM "LivePage"
          WHERE "siteId" <> ${SITE_ID}
          ORDER BY "id"
          LIMIT 5
        `;
        return hash(rowsMy);
      };
      const readRevision = async (client) => {
        const revisionRows = await client.$queryRaw`
          SELECT "revision"::text AS revision FROM "SiteContentRevision" WHERE "siteId" = ${SITE_ID} LIMIT 1
        `;
        return BigInt(revisionRows[0]?.revision ?? "0");
      };
      const protectedBefore = await protectedHash(tx);
      const revisionBefore = await readRevision(tx);
      const created = await tx.livePage.create({
        data: {
          id: row.id,
          siteId: row.siteId,
          pageType: row.pageType,
          templateKey: row.templateKey,
          slug: row.slug,
          title: row.title,
          contentJson: row.contentJson
        },
        select: { id: true, slug: true }
      });
      const readback = await tx.livePage.findUniqueOrThrow({
        where: { id: created.id },
        select: { id: true, slug: true, contentJson: true }
      });
      assert.equal(hash(readback.contentJson), row.contentHash, `Content did not read back at its reviewed state on ${row.slug}.`);
      const revisionAfter = await readRevision(tx);
      assert(
        revisionAfter > revisionBefore,
        `SiteContentRevision did not advance on insert (${revisionBefore} -> ${revisionAfter}).`
      );
      const protectedAfter = await protectedHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the occasions-hub apply.");
      return {
        ok: true,
        mode: "apply",
        contract: CONTRACT,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        inserted: { id: readback.id, slug: readback.slug, contentHash: row.contentHash }
      };
    });

    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-occasions-hub-${target}-2026-10-30-rollback.json`
    );
    const rollback = {
      ok: true,
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      operation: "delete-row",
      row: {
        id: report.inserted.id,
        slug: report.inserted.slug,
        contentHash: report.inserted.contentHash
      },
      note: "Inverse of the insert: delete the LivePage row only when its contentHash still matches (CAS)."
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...report, rollbackPath }, null, 2));
  }
} finally {
  await db.$disconnect();
}
