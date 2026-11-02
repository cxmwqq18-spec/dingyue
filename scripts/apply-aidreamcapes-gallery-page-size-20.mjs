#!/usr/bin/env node
// Apply the reviewed Aidreamcapes example-gallery pagination manifest
// (planned by scripts/plan-aidreamcapes-gallery-page-size-20.mjs).
//
// Writes only contentJson.sections[<v2 section>].settings.data.exampleDirectory.
// pageSize on the /templates LivePage row (12 -> 20). CAS: the row must still
// match the planned baseHash and the current pageSize must match the planned
// before-state (or already equal the after-state); otherwise the apply aborts
// (online edit wins). No snapshot is written.
//
//   node --env-file=.env.local scripts/apply-aidreamcapes-gallery-page-size-20.mjs --target=local --dry
//   node --env-file=.env.local scripts/apply-aidreamcapes-gallery-page-size-20.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-gallery-page-size-20-local --base-hash=<planHash>
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
const CONTRACT = "aidreamcapes-gallery-page-size-20-2026-11-02-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const writeRollbackOnly = process.argv.includes("--write-rollback-only");
const rollbackTargetSlug = process.argv.find((arg) => arg.startsWith("--rollback-to="))?.split("=")[1];
const expectedConfirmation = `site_aidreamcapes-gallery-page-size-20-${target}`;
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-gallery-page-size-20-${target}-2026-11-02.json`
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
const operation = manifest.operations[0];
assert.equal(manifest.operations.length, 1, "This contract writes exactly one field.");

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const row = await db.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: manifest.page.slug } },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  if (!row) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", reason: "/templates LivePage is missing" }, null, 2));
    process.exitCode = 1;
  } else if (writeRollbackOnly) {
    // Artifact-completion mode for an apply whose transaction committed but
    // whose run crashed before the rollback manifest was written. Read-only:
    // the row must already carry the after value (CAS would reject a rewrite),
    // and the emitted rollback still points at the reviewed before state.
    const sectionId = Object.entries(row.contentJson?.sections ?? {})
      .find(([, section]) => section?.settings?.data?.exampleDirectory)?.[0];
    assert(sectionId, "exampleDirectory section vanished");
    const current = row.contentJson.sections[sectionId].settings.data.exampleDirectory.pageSize ?? null;
    assert.equal(hash(current), operation.afterHash, `Refusing to write a rollback: current pageSize ${current} is not the reviewed after state.`);
    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-gallery-page-size-20-${target}-2026-11-02-rollback.json`
    );
    const rollback = {
      ok: true,
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      summary: { page: manifest.page.slug, fields: 1, note: "completed after a committed apply whose run crashed pre-artifact" },
      page: { slug: manifest.page.slug, baseHash: pageHash(row) },
      operations: [{
        field: "exampleDirectory.pageSize",
        jsonPath: manifest.jsonPath,
        before: operation.before,
        after: operation.after,
        beforeHash: operation.beforeHash,
        afterHash: operation.afterHash
      }],
      note: "Inverse of the apply: set exampleDirectory.pageSize back to the before value (delete the field when before is null) against the recorded current page baseHash."
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ok: true, mode: "write-rollback-only", current, rollbackPath, readback: { jsonPath: manifest.jsonPath, value: current } }, null, 2));
  } else if (pageHash(row) !== manifest.page.baseHash) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", reason: "LivePage changed since the reviewed plan (baseHash mismatch)" }, null, 2));
    process.exitCode = 1;
  } else {
    const sectionId = Object.entries(row.contentJson?.sections ?? {})
      .find(([, section]) => section?.settings?.data?.exampleDirectory)?.[0];
    assert(sectionId, "exampleDirectory section vanished; refusing to guess a target");
    const directory = row.contentJson.sections[sectionId].settings.data.exampleDirectory;
    const current = directory.pageSize ?? null;
    const state = hash(current) === operation.afterHash
      ? "after"
      : hash(current) === operation.beforeHash
        ? "before"
        : "conflict";
    if (state === "conflict") {
      console.log(JSON.stringify({
        ok: false,
        mode: apply ? "apply" : "dry-run",
        reason: "exampleDirectory.pageSize differs from both the reviewed before and after state; online edit wins",
        current
      }, null, 2));
      process.exitCode = 1;
    } else if (!apply || state === "after") {
      const rollbackPath = path.resolve(
        process.cwd(),
        process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
        || `scripts/manifests/aidreamcapes-gallery-page-size-20-${target}-2026-11-02-rollback.json`
      );
      if (apply) {
        // The rollback artifact must exist even when this run is a noop
        // (already applied): the transaction path also writes it, and a
        // rerun on an applied row must not lose the inverse manifest.
        const rollback = {
          ok: true,
          contract: `${CONTRACT}-rollback`,
          siteId: SITE_ID,
          target,
          generatedAt: new Date().toISOString(),
          sourcePlanHash: manifest.planHash,
          summary: { page: manifest.page.slug, fields: 1 },
          page: { slug: manifest.page.slug, baseHash: pageHash(row) },
          operations: [{
            field: "exampleDirectory.pageSize",
            jsonPath: manifest.jsonPath,
            before: operation.before,
            after: operation.after,
            beforeHash: operation.beforeHash,
            afterHash: operation.afterHash
          }],
          note: "Inverse of the apply: set exampleDirectory.pageSize back to the before value (delete the field when before is null) with the page baseHash as CAS."
        };
        fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
        fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
      }
      console.log(JSON.stringify({
        ok: true,
        mode: apply ? "apply" : "dry-run",
        noop: apply && state === "after",
        planHash: manifest.planHash,
        state
      }, null, 2));
    } else {
      const rollbackPath = path.resolve(
        process.cwd(),
        process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
        || `scripts/manifests/aidreamcapes-gallery-page-size-20-${target}-2026-11-02-rollback.json`
      );
      // The LivePage row carries a large contentJson blob; the default 5s
      // interactive-transaction timeout is not enough on the release host.
      const report = await db.$transaction(async (tx) => {
        const protectedHash = async (client) => {
          const rowsOther = await client.$queryRaw`
            SELECT "slug", "contentJson", "updatedAt"
            FROM "LivePage"
            WHERE "siteId" <> ${SITE_ID}
            ORDER BY "id"
            LIMIT 5
          `;
          return hash(rowsOther);
        };
        const readRevision = async (client) => {
          const revisionRows = await client.$queryRaw`
            SELECT "revision"::text AS revision FROM "SiteContentRevision" WHERE "siteId" = ${SITE_ID} LIMIT 1
          `;
          return BigInt(revisionRows[0]?.revision ?? "0");
        };
        const protectedBefore = await protectedHash(tx);
        const revisionBefore = await readRevision(tx);

        const nextContentJson = structuredClone(row.contentJson ?? {});
        const nextDirectory = nextContentJson.sections[sectionId].settings.data.exampleDirectory;
        if (operation.after === null) delete nextDirectory.pageSize;
        else nextDirectory.pageSize = operation.after;

        const updated = await tx.livePage.updateMany({
          where: { id: row.id, updatedAt: row.updatedAt },
          data: { contentJson: nextContentJson }
        });
        assert.equal(updated.count, 1, "LivePage changed concurrently; refusing to overwrite.");

        const readbackRow = await tx.livePage.findUniqueOrThrow({
          where: { id: row.id },
          select: { slug: true, contentJson: true, updatedAt: true }
        });
        const readbackDirectory = readbackRow.contentJson?.sections?.[sectionId]?.settings?.data?.exampleDirectory;
        assert.equal(readbackDirectory?.pageSize ?? null, operation.after, "pageSize did not read back as planned.");
        const revisionAfter = await readRevision(tx);
        assert.equal(
          revisionAfter,
          revisionBefore + BigInt(1),
          `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected 1.`
        );
        const protectedAfter = await protectedHash(tx);
        assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the gallery-page-size apply.");
        return {
          ok: true,
          mode: "apply",
          contract: CONTRACT,
          siteId: SITE_ID,
          target,
          planHash: manifest.planHash,
          revisionBefore: revisionBefore.toString(),
          revisionAfter: revisionAfter.toString(),
          pageHash: pageHash({ ...row, contentJson: nextContentJson, updatedAt: readbackRow.updatedAt }),
          readback: { jsonPath: manifest.jsonPath, value: readbackDirectory.pageSize }
        };
      }, { maxWait: 10_000, timeout: 120_000 });

      const rollback = {
        ok: true,
        contract: `${CONTRACT}-rollback`,
        siteId: SITE_ID,
        target,
        generatedAt: new Date().toISOString(),
        sourcePlanHash: manifest.planHash,
        summary: { page: manifest.page.slug, fields: 1 },
        page: { slug: manifest.page.slug, baseHash: report.pageHash },
        operations: [{
          field: "exampleDirectory.pageSize",
          jsonPath: manifest.jsonPath,
          before: operation.before,
          after: operation.after,
          beforeHash: operation.beforeHash,
          afterHash: operation.afterHash
        }],
        note: "Inverse of the apply: set exampleDirectory.pageSize back to the before value (delete the field when before is null) with the page baseHash as CAS."
      };

      fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
      fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
      console.log(JSON.stringify({ ...report, rollbackPath }, null, 2));
    }
  }
} finally {
  await db.$disconnect();
}
