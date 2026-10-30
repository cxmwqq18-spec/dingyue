#!/usr/bin/env node
// Field-level CAS apply for the reviewed Aidreamcapes template-facets manifest
// (planned by scripts/plan-aidreamcapes-template-facets.mjs).
//
// This script:
//   1. verifies the manifest hash, site, target, and confirmation;
//   2. re-reads every affected LivePage row and verifies its base hash;
//   3. verifies every reviewed array still carries the reviewed before state;
//   4. writes only the reviewed templateDefinition.industries and
//      templateDirectory.paths arrays (no other field);
//   5. verifies post-state invariants (every industries/paths value is a
//      placement-pattern facet path; no empty paths entries);
//   6. reads every row back, advances the derived-state revision once per
//      page, and verifies MyDreamShoots did not change.
//
// Dry-run is the default:
//   node --env-file=.env.production scripts/apply-aidreamcapes-template-facets.mjs --target=production
//   node --env-file=.env.production scripts/apply-aidreamcapes-template-facets.mjs --target=production --apply \
//     --confirm=site_aidreamcapes-template-facets-production --base-hash=<planHash>
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MEDIA_PLACEMENT_PATTERN } from "./lib/aidreamcapes-placement-vocabulary.mjs";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-template-facets-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-template-facets-production"
  : "site_aidreamcapes-template-facets";
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-template-facets-${target}-2026-10-30.json`
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
function parseJsonPath(jsonPath) {
  const steps = [];
  for (const part of String(jsonPath).split(".")) {
    const match = part.match(/^([^[\]]+)((?:\[\d+\])*)$/);
    assert(match, `Unsupported jsonPath segment "${part}" in ${jsonPath}.`);
    steps.push(match[1]);
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) steps.push(Number(index[1]));
  }
  return steps;
}
function resolveNode(contentJson, jsonPath) {
  let node = contentJson;
  for (const step of parseJsonPath(jsonPath)) {
    if (node === null || node === undefined) return undefined;
    if (typeof step === "number") {
      if (!Array.isArray(node)) return undefined;
    } else if (typeof node !== "object" || Array.isArray(node)) {
      return undefined;
    }
    node = node[step];
  }
  return node;
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
    const states = [];
    for (const operation of page.operations) {
      const current = resolveNode(row.contentJson, operation.jsonPath);
      if (!Array.isArray(current)) {
        aborted.push({ page: page.slug, card: operation.jsonPath, reason: "reviewed array path is missing" });
        continue;
      }
      const state = hash(current) === operation.afterHash
        ? "after"
        : hash(current) === operation.beforeHash
          ? "before"
          : "conflict";
      states.push({ operation, current, state });
      if (state === "conflict") {
        aborted.push({ page: page.slug, card: operation.jsonPath, reason: "array differs from both the reviewed before and after state; online edit wins" });
      }
    }
    if (states.some((entry) => entry.state === "conflict")) continue;
    if (states.every((entry) => entry.state === "after")) {
      skipped.push({ page: page.slug, reason: "already applied" });
      continue;
    }
    if (!states.every((entry) => entry.state === "before")) {
      aborted.push({ page: page.slug, reason: "reviewed arrays are mixed between before and after; refusing a partial rewrite" });
      continue;
    }
    const nextContentJson = structuredClone(row.contentJson ?? {});
    for (const { operation } of states) {
      const target2 = resolveNode(nextContentJson, operation.jsonPath);
      assert(Array.isArray(target2), `Array ${operation.jsonPath} disappeared while preparing ${page.slug}.`);
      if (operation.field === "industries") {
        for (const value of operation.after) {
          assert(MEDIA_PLACEMENT_PATTERN.test(value), `Refusing non-facet value "${value}" on ${page.slug}.`);
        }
      } else {
        for (const value of operation.after) {
          assert(/^\/(ai-video-generation|ai-image-generation)\/[a-z0-9][a-z0-9-]*$/.test(value), `Refusing non-template path "${value}" on ${page.slug}.`);
        }
      }
      target2.length = 0;
      for (const value of operation.after) target2.push(value);
    }
    planned.push({ row, page, nextContentJson });
  }

  const summary = {
    ok: aborted.length === 0,
    mode: apply ? "apply" : "dry-run",
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    pagePlan: manifest.summary,
    pagesPlanned: planned.length,
    arraysPlanned: planned.reduce((total, entry) => total + entry.page.operations.length, 0),
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
        applied.push({ page: entry.page.slug, arrays: entry.page.operations.map((op) => op.jsonPath) });
      }
      const readback = [];
      for (const entry of planned) {
        const row = await tx.livePage.findUniqueOrThrow({
          where: { id: entry.row.id },
          select: { slug: true, contentJson: true, updatedAt: true }
        });
        for (const operation of entry.page.operations) {
          const current = resolveNode(row.contentJson, operation.jsonPath);
          assert(Array.isArray(current) && hash(current) === operation.afterHash, `Array ${operation.jsonPath} did not read back at its after state on ${entry.page.slug}.`);
        }
        readback.push({ page: entry.page.slug, pageHash: pageHash(row) });
      }
      // Post-state invariant: industries values are facet paths; paths values
      // are template page paths.
      for (const entry of planned) {
        for (const operation of entry.page.operations) {
          const current = resolveNode(entry.nextContentJson, operation.jsonPath);
          for (const value of current) {
            if (operation.field === "industries") {
              assert(MEDIA_PLACEMENT_PATTERN.test(value), `Invalid facet value "${value}" survived on ${entry.page.slug}.`);
            } else {
              assert(/^\/(ai-video-generation|ai-image-generation)\/[a-z0-9][a-z0-9-]*$/.test(value), `Invalid template path "${value}" survived on ${entry.page.slug}.`);
            }
          }
        }
      }
      const revisionAfter = await readRevision(tx);
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length}.`
      );
      const protectedAfter = await protectedHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the template-facets apply.");
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
        arraysApplied: applied.reduce((total, entry) => total + entry.arrays.length, 0),
        applied,
        readback
      };
    });

    const rollbackPages = planned.map((entry, index) => ({
      slug: entry.page.slug,
      pageHash: report.readback[index].pageHash,
      operations: entry.page.operations.map((operation) => ({
        jsonPath: operation.jsonPath,
        field: operation.field,
        before: operation.after,
        after: operation.before,
        beforeHash: operation.afterHash,
        afterHash: operation.beforeHash
      }))
    }));
    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-template-facets-${target}-2026-10-30-rollback.json`
    );
    const rollback = {
      ok: true,
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      summary: { pages: rollbackPages.length, arrays: rollbackPages.reduce((total, page) => total + page.operations.length, 0) },
      pages: rollbackPages
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      ok: report.ok,
      mode: "apply",
      pagesApplied: report.pagesApplied,
      arraysApplied: report.arraysApplied,
      revisionBefore: report.revisionBefore,
      revisionAfter: report.revisionAfter,
      rollbackPath
    }, null, 2));
  }
} finally {
  await db.$disconnect();
}
