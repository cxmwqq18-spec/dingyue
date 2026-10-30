#!/usr/bin/env node
// Apply the reviewed example-first facet manifest (planned by
// scripts/plan-aidreamcapes-facet-example-first.mjs, Step 4 of
// docs/aivideosugc-template-cases-navigation-plan.md).
//
// Per row: sets templateDirectory.hideTemplates = true and removes the stored
// jsonLd ItemList. CAS: the row must still match its planned pageHash,
// otherwise the apply aborts (online edit wins). No snapshot is written.
//
//   node --env-file=.env.local scripts/apply-aidreamcapes-facet-example-first.mjs --target=local
//   node --env-file=.env.local scripts/apply-aidreamcapes-facet-example-first.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-facet-example-first-local --base-hash=<planHash>
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
const CONTRACT = "aidreamcapes-facet-example-first-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = `site_aidreamcapes-facet-example-first-${target}`;
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-facet-example-first-${target}-2026-10-30.json`
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

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not marked ok; plan first.");
assert.equal(manifest.contract, CONTRACT, "Manifest contract mismatch.");
assert.equal(manifest.siteId, SITE_ID, "Manifest site mismatch.");
assert.equal(manifest.target, target, "Manifest target mismatch.");
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(baseHash, manifest.planHash, "Apply requires --base-hash=<manifest planHash> (CAS).");
}

const select = { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true };
const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const slugs = manifest.operations.map((entry) => entry.slug);
  const rows = await db.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, select });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  const pending = [];
  const skipped = [];
  const aborted = [];
  for (const entry of manifest.operations) {
    const row = bySlug.get(entry.slug);
    if (!row) { aborted.push({ slug: entry.slug, reason: "LivePage is missing" }); continue; }
    if (pageHash(row) !== entry.before.pageHash) {
      // Idempotence: an already-applied row (hideTemplates=true, no ItemList)
      // is fine even though its updatedAt moved past the plan.
      const directory = row.contentJson?.sections?.v2_main?.settings?.data?.templateDirectory;
      const hasItemList = Array.isArray(row.contentJson?.seo?.jsonLd?.["@graph"])
        && row.contentJson.seo.jsonLd["@graph"].some((node) => node?.["@type"] === "ItemList");
      if (directory?.hideTemplates === true && !hasItemList) { skipped.push(entry.slug); continue; }
      aborted.push({ slug: entry.slug, reason: "LivePage changed since the reviewed plan (baseHash mismatch)" });
      continue;
    }
    pending.push({ entry, row });
  }

  if (aborted.length) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", aborted }, null, 2));
    process.exitCode = 1;
  } else if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", planHash: manifest.planHash, wouldUpdate: pending.length }, null, 2));
  } else if (!pending.length) {
    console.log(JSON.stringify({ ok: true, mode: "apply", noop: true, alreadyApplied: skipped.length }, null, 2));
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

      for (const { entry, row } of pending) {
        const updated = await tx.livePage.updateMany({
          where: { id: row.id, updatedAt: row.updatedAt },
          data: { contentJson: entry.after.contentJson }
        });
        assert.equal(updated.count, 1, `LivePage ${entry.slug} changed concurrently; refusing to overwrite.`);
      }

      for (const { entry, row } of pending) {
        const readRow = await tx.livePage.findUniqueOrThrow({ where: { id: row.id }, select });
        const directory = readRow.contentJson?.sections?.v2_main?.settings?.data?.templateDirectory;
        assert.equal(directory?.hideTemplates, true, `hideTemplates did not read back on ${entry.slug}.`);
        assert(!readRow.contentJson.seo.jsonLd["@graph"].some((node) => node?.["@type"] === "ItemList"), `ItemList did not read back removed on ${entry.slug}.`);
      }

      const revisionAfter = await readRevision(tx);
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(pending.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${pending.length}.`
      );
      const protectedAfter = await protectedHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the facet example-first apply.");
      return {
        ok: true,
        mode: "apply",
        contract: CONTRACT,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        updated: pending.map(({ entry }) => entry.slug)
      };
    });

    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-facet-example-first-${target}-2026-10-30-rollback.json`
    );
    const rollback = {
      ok: true,
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      note: "Inverse of the apply: set templateDirectory.hideTemplates back to the before value (delete the field when null) and restore the stored jsonLd ItemList nodes; each before contentHash is recorded per row.",
      operations: manifest.operations.map((entry) => ({
        slug: entry.slug,
        before: entry.before,
        removedItemList: entry.removedItemList,
        note: "Inverse: delete templateDirectory.hideTemplates (was null before) and re-insert removedItemList nodes at their recorded @graph indices; before.pageHash is the pre-apply CAS hash."
      }))
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...report, rollbackPath, alreadyApplied: skipped.length }, null, 2));
  }
} finally {
  await db.$disconnect();
}
