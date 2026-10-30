#!/usr/bin/env node
// Apply the reviewed Aidreamcapes mega-menu group hubHref manifest
// (planned by scripts/plan-aidreamcapes-nav-hub-hrefs.mjs, Step 2 of
// docs/aivideosugc-template-cases-navigation-plan.md).
//
// Writes only siteNavigation.menus[label=Templates].groups[].hubHref on the
// homepage LivePage row. CAS: the row must still match the planned baseHash
// and each group's current hubHref must match the planned before-state;
// otherwise the apply aborts (online edit wins). No snapshot is written.
//
//   node --env-file=.env.local scripts/apply-aidreamcapes-nav-hub-hrefs.mjs --target=local
//   node --env-file=.env.local scripts/apply-aidreamcapes-nav-hub-hrefs.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-nav-hub-hrefs-local --base-hash=<planHash>
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
const CONTRACT = "aidreamcapes-nav-hub-hrefs-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = `site_aidreamcapes-nav-hub-hrefs-${target}`;
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-nav-hub-hrefs-${target}-2026-10-30.json`
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
  const row = await db.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: manifest.page.slug } },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  if (!row) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", reason: "Homepage LivePage is missing" }, null, 2));
    process.exitCode = 1;
  } else if (pageHash(row) !== manifest.page.baseHash) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", reason: "LivePage changed since the reviewed plan (baseHash mismatch)" }, null, 2));
    process.exitCode = 1;
  } else {
    // State check per group: before | after | conflict.
    const menu = row.contentJson?.siteNavigation?.menus?.find((entry) => entry?.label === "Templates");
    assert(menu, "Templates menu is missing");
    const groupStates = manifest.operations.map((operation) => {
      const group = menu.groups?.find((entry) => entry?.label === operation.groupLabel);
      const current = group?.hubHref ?? null;
      const state = hash(current) === operation.afterHash
        ? "after"
        : hash(current) === operation.beforeHash
          ? "before"
          : "conflict";
      return { operation, group, current, state };
    });
    const conflicts = groupStates.filter((entry) => entry.state === "conflict");
    if (conflicts.length) {
      console.log(JSON.stringify({
        ok: false,
        mode: apply ? "apply" : "dry-run",
        reason: "group hubHref differs from both the reviewed before and after state; online edit wins",
        conflicts: conflicts.map((entry) => ({ group: entry.operation.groupLabel, current: entry.current }))
      }, null, 2));
      process.exitCode = 1;
    } else {
      const pending = groupStates.filter((entry) => entry.state === "before");
      if (!apply || !pending.length) {
        console.log(JSON.stringify({
          ok: true,
          mode: apply ? "apply" : "dry-run",
          noop: apply && !pending.length,
          planHash: manifest.planHash,
          groupsAlreadyApplied: groupStates.length - pending.length,
          groupsPlanned: pending.length
        }, null, 2));
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

          const nextContentJson = structuredClone(row.contentJson ?? {});
          const nextMenu = nextContentJson.siteNavigation.menus.find((entry) => entry?.label === "Templates");
          for (const entry of pending) {
            const group = nextMenu.groups.find((candidate) => candidate?.label === entry.operation.groupLabel);
            assert(group, `Group ${entry.operation.groupLabel} vanished during apply`);
            group.hubHref = entry.operation.hubHref;
          }
          const updated = await tx.livePage.updateMany({
            where: { id: row.id, updatedAt: row.updatedAt },
            data: { contentJson: nextContentJson }
          });
          assert.equal(updated.count, 1, "LivePage changed concurrently; refusing to overwrite.");

          const readbackRow = await tx.livePage.findUniqueOrThrow({
            where: { id: row.id },
            select: { slug: true, contentJson: true, updatedAt: true }
          });
          const readbackMenu = readbackRow.contentJson?.siteNavigation?.menus?.find((entry) => entry?.label === "Templates");
          const readback = pending.map((entry) => {
            const group = readbackMenu.groups?.find((candidate) => candidate?.label === entry.operation.groupLabel);
            assert.equal(group?.hubHref, entry.operation.hubHref, `hubHref did not read back on ${entry.operation.groupLabel}.`);
            return { group: entry.operation.groupLabel, hubHref: group.hubHref };
          });
          const revisionAfter = await readRevision(tx);
          assert.equal(
            revisionAfter,
            revisionBefore + BigInt(1),
            `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected 1.`
          );
          const protectedAfter = await protectedHash(tx);
          assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the nav-hub-hrefs apply.");
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
            readback
          };
        });

        const rollbackPath = path.resolve(
          process.cwd(),
          process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
          || `scripts/manifests/aidreamcapes-nav-hub-hrefs-${target}-2026-10-30-rollback.json`
        );
        const rollback = {
          ok: true,
          contract: `${CONTRACT}-rollback`,
          siteId: SITE_ID,
          target,
          generatedAt: new Date().toISOString(),
          sourcePlanHash: manifest.planHash,
          summary: { page: manifest.page.slug, fields: report.readback.length },
          page: { slug: manifest.page.slug, baseHash: report.pageHash },
          operations: manifest.operations.map((operation) => ({
            groupLabel: operation.groupLabel,
            jsonPath: `siteNavigation.menus[label=Templates].groups[label=${operation.groupLabel}].hubHref`,
            field: "hubHref",
            before: operation.before,
            after: operation.hubHref,
            beforeHash: operation.beforeHash,
            afterHash: operation.afterHash
          })),
          note: "Inverse of the apply: set each group.hubHref back to the before value (delete the field when before is null) with the page baseHash as CAS."
        };
        fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
        fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
        console.log(JSON.stringify({ ...report, rollbackPath }, null, 2));
      }
    }
  }
} finally {
  await db.$disconnect();
}
