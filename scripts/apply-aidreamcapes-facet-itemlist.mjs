#!/usr/bin/env node
// Field-level CAS apply for the reviewed Aidreamcapes facet ItemList manifest
// (planned by scripts/plan-aidreamcapes-facet-itemlist.mjs).
//
// Writes only the reviewed seo.jsonLd.@graph arrays: rebuilds the stored
// ItemList from the current templateDirectory.paths or drops it when the
// directory has no templates. No other field is touched.
//
// Dry-run is the default:
//   node --env-file=.env.production scripts/apply-aidreamcapes-facet-itemlist.mjs --target=production
//   node --env-file=.env.production scripts/apply-aidreamcapes-facet-itemlist.mjs --target=production --apply \
//     --confirm=site_aidreamcapes-facet-itemlist-production --base-hash=<planHash>
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
const CONTRACT = "aidreamcapes-facet-itemlist-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-facet-itemlist-production"
  : "site_aidreamcapes-facet-itemlist";
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-facet-itemlist-${target}-2026-10-30.json`
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

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: manifest.pages.map((page) => page.slug) } },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });

  const aborted = [];
  const skipped = [];
  const planned = [];
  for (const page of manifest.pages) {
    const row = rows.find((entry) => entry.slug === page.slug);
    if (!row) {
      aborted.push({ page: page.slug, reason: "LivePage is missing" });
      continue;
    }
    if (pageHash(row) !== page.baseHash) {
      aborted.push({ page: page.slug, reason: "LivePage changed since the reviewed plan (baseHash mismatch)" });
      continue;
    }
    const operation = page.operations[0];
    const current = row.contentJson?.seo?.jsonLd?.["@graph"];
    if (!Array.isArray(current)) {
      aborted.push({ page: page.slug, reason: "stored jsonLd @graph is missing" });
      continue;
    }
    const state = hash(current) === operation.afterHash
      ? "after"
      : hash(current) === operation.beforeHash
        ? "before"
        : "conflict";
    if (state === "conflict") {
      aborted.push({ page: page.slug, reason: "stored @graph differs from both the reviewed before and after state; online edit wins" });
      continue;
    }
    if (state === "after") {
      skipped.push({ page: page.slug, reason: "already applied" });
      continue;
    }
    const nextContentJson = structuredClone(row.contentJson ?? {});
    nextContentJson.seo.jsonLd["@graph"] = structuredClone(operation.after);
    planned.push({ row, page, nextContentJson });
  }

  const summary = {
    ok: aborted.length === 0,
    mode: apply ? "apply" : "dry-run",
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    pagesPlanned: planned.length,
    pagesAlreadyApplied: skipped.length,
    aborted,
    skipped
  };

  if (!apply || !planned.length) {
    console.log(JSON.stringify({ ...summary, noop: apply && !planned.length }, null, 2));
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
      const applied = [];
      for (const entry of planned) {
        const updated = await tx.livePage.updateMany({
          where: { id: entry.row.id, updatedAt: entry.row.updatedAt },
          data: { contentJson: entry.nextContentJson }
        });
        assert.equal(updated.count, 1, `LivePage ${entry.row.id} changed concurrently; refusing to overwrite.`);
        applied.push({ page: entry.page.slug });
      }
      const readback = [];
      for (const entry of planned) {
        const row = await tx.livePage.findUniqueOrThrow({
          where: { id: entry.row.id },
          select: { slug: true, contentJson: true, updatedAt: true }
        });
        const graph = row.contentJson?.seo?.jsonLd?.["@graph"];
        assert(Array.isArray(graph) && hash(graph) === entry.page.operations[0].afterHash, `@graph did not read back at its after state on ${entry.page.slug}.`);
        readback.push({ page: entry.page.slug, pageHash: pageHash(row) });
      }
      const revisionAfter = await readRevision(tx);
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length}.`
      );
      const protectedAfter = await protectedHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the facet-itemlist apply.");
      return {
        ok: true,
        mode: "apply",
        contract: CONTRACT,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        revisionDelta: (revisionAfter - revisionBefore).toString(),
        pagesApplied: applied.length,
        applied,
        readback
      };
    });

    const rollbackPages = planned.map((entry, index) => ({
      slug: entry.page.slug,
      pageHash: report.readback[index].pageHash,
      operations: [{
        jsonPath: "seo.jsonLd.@graph",
        field: "itemList",
        before: entry.page.operations[0].after,
        after: entry.page.operations[0].before,
        beforeHash: entry.page.operations[0].afterHash,
        afterHash: entry.page.operations[0].beforeHash
      }]
    }));
    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-facet-itemlist-${target}-2026-10-30-rollback.json`
    );
    const rollback = {
      ok: true,
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      summary: { pages: rollbackPages.length },
      pages: rollbackPages
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      ok: report.ok,
      mode: "apply",
      pagesApplied: report.pagesApplied,
      revisionBefore: report.revisionBefore,
      revisionAfter: report.revisionAfter,
      rollbackPath
    }, null, 2));
  }
} finally {
  await db.$disconnect();
}
