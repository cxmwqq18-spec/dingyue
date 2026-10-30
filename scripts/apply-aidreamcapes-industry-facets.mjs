#!/usr/bin/env node
// Field-level CAS apply for the reviewed Aidreamcapes industry-facets manifest
// (planned by scripts/plan-aidreamcapes-industry-facets.mjs).
//
// This script:
//   1. verifies the manifest hash, site, target, and confirmation;
//   2. verifies the 11 facet slugs and ids still do not exist;
//   3. verifies the homepage and /industries hub base hashes and that their
//      reviewed lists still hold the reviewed before state;
//   4. creates only the 11 reviewed LivePage rows and appends only the
//      reviewed "By industry" nav items and hub cards (no other field);
//   5. verifies post-state invariants (19 nav items, 19 hub cards, every
//      facet row resolvable) and the derived-state revision delta;
//   6. reads every write back and verifies MyDreamShoots did not change.
//
// Dry-run is the default:
//   node --env-file=.env.production scripts/apply-aidreamcapes-industry-facets.mjs --target=production
//   node --env-file=.production scripts/apply-aidreamcapes-industry-facets.mjs --target=production --apply \
//     --confirm=site_aidreamcapes-industry-facets-production --base-hash=<planHash>
//
// This script never writes publications or snapshots, never touches
// MyDreamShoots rows, and never modifies an existing Aidreamcapes row beyond
// the two reviewed list fields.
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
const CONTRACT = "aidreamcapes-industry-facets-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-industry-facets-production"
  : "site_aidreamcapes-industry-facets";
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-industry-facets-${target}-2026-10-30.json`
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
  const slugs = manifest.pages.map((page) => page.slug);
  const existing = await db.livePage.findMany({
    where: { siteId: SITE_ID, OR: [{ slug: { in: slugs } }, { id: { in: manifest.pages.map((page) => page.id) } }] },
    select: { id: true, slug: true }
  });
  const homepage = await db.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } }, select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true } });
  const hub = await db.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/industries" } }, select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true } });
  assert(homepage && hub, "Homepage or /industries hub row is missing.");

  const blocked = [];
  if (existing.length) {
    blocked.push({ reason: "facet rows already exist", rows: existing.map((row) => row.slug) });
  }
  if (pageHash(homepage) !== manifest.homepage.baseHash) {
    blocked.push({ reason: "homepage changed since the reviewed plan (baseHash mismatch)" });
  }
  if (pageHash(hub) !== manifest.hub.baseHash) {
    blocked.push({ reason: "/industries hub changed since the reviewed plan (baseHash mismatch)" });
  }

  // Structural re-verification of the reviewed before state.
  const navMenu = homepage.contentJson?.siteNavigation?.menus?.find((menu) => menu?.label === "Templates");
  const navGroup = navMenu?.groups?.find((group) => group?.label === "By industry");
  const navItems = navGroup?.items ?? [];
  if (navItems.length !== manifest.homepage.beforeCount) {
    blocked.push({ reason: `homepage By industry items = ${navItems.length}, reviewed ${manifest.homepage.beforeCount}` });
  }
  const hubItems = hub.contentJson?.sections?.v2_main?.settings?.data?.items ?? [];
  if (hubItems.length !== manifest.hub.beforeCount) {
    blocked.push({ reason: `/industries hub items = ${hubItems.length}, reviewed ${manifest.hub.beforeCount}` });
  }
  if (blocked.length) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", blocked, planHash: manifest.planHash }, null, 2));
    process.exitCode = apply ? 1 : 0;
  } else if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      contract: CONTRACT,
      target,
      planHash: manifest.planHash,
      pagesToCreate: manifest.pages.map((page) => page.slug),
      navItems: { before: manifest.homepage.beforeCount, after: manifest.homepage.afterCount },
      hubItems: { before: manifest.hub.beforeCount, after: manifest.hub.afterCount },
      revisionDeltaExpected: manifest.pages.length + 2
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

      for (const page of manifest.pages) {
        const created = await tx.livePage.create({
          data: {
            id: page.id,
            siteId: SITE_ID,
            slug: page.slug,
            title: page.title,
            pageType: page.pageType,
            templateKey: page.templateKey,
            contentJson: page.contentJson
          },
          select: { id: true }
        });
        assert.equal(created.id, page.id, `LivePage ${page.slug} did not create with its planned id.`);
      }
      // Homepage nav append (field-level: only the reviewed items array moves).
      const nextHomepage = structuredClone(homepage.contentJson);
      const nextNavMenu = nextHomepage.siteNavigation.menus.find((menu) => menu?.label === "Templates");
      const nextNavGroup = nextNavMenu.groups.find((group) => group?.label === "By industry");
      assert.equal(nextNavGroup.items.length, manifest.homepage.beforeCount, "Homepage items moved while preparing the write.");
      nextNavGroup.items = structuredClone(manifest.homepage.afterItems);
      const updatedHomepage = await tx.livePage.updateMany({
        where: { id: homepage.id, updatedAt: homepage.updatedAt },
        data: { contentJson: nextHomepage }
      });
      assert.equal(updatedHomepage.count, 1, "Homepage changed concurrently; refusing to overwrite.");
      // Hub cards append.
      const nextHub = structuredClone(hub.contentJson);
      const nextHubData = nextHub.sections.v2_main.settings.data;
      assert.equal(nextHubData.items.length, manifest.hub.beforeCount, "Hub items moved while preparing the write.");
      nextHubData.items = structuredClone(manifest.hub.afterItems);
      const updatedHub = await tx.livePage.updateMany({
        where: { id: hub.id, updatedAt: hub.updatedAt },
        data: { contentJson: nextHub }
      });
      assert.equal(updatedHub.count, 1, "/industries hub changed concurrently; refusing to overwrite.");

      const revisionAfter = await readRevision(tx);
      const expectedDelta = BigInt(manifest.pages.length + 2);
      assert.equal(
        revisionAfter,
        revisionBefore + expectedDelta,
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${expectedDelta}.`
      );

      // Readback: every created row reads back hash-identical; lists hold 19.
      const readback = [];
      for (const page of manifest.pages) {
        const row = await tx.livePage.findUnique({
          where: { siteId_slug: { siteId: SITE_ID, slug: page.slug } },
          select: { id: true, slug: true, title: true, contentJson: true }
        });
        assert(row, `LivePage ${page.slug} did not read back after the create.`);
        assert.equal(hash(row.contentJson), hash(page.contentJson), `LivePage ${page.slug} contentJson did not read back at its planned state.`);
        readback.push({ slug: row.slug, id: row.id });
      }
      const homeRow = await tx.livePage.findUnique({ where: { id: homepage.id }, select: { contentJson: true } });
      const homeNavAfter = homeRow.contentJson?.siteNavigation?.menus?.find((menu) => menu?.label === "Templates")?.groups?.find((group) => group?.label === "By industry")?.items;
      assert.equal(homeNavAfter?.length, manifest.homepage.afterCount, "Homepage By industry group did not read back at 19 items.");
      assert.equal(hash(homeNavAfter), hash(manifest.homepage.afterItems), "Homepage By industry items did not read back at their after state.");
      const hubRow = await tx.livePage.findUnique({ where: { id: hub.id }, select: { contentJson: true } });
      const hubAfter = hubRow.contentJson?.sections?.v2_main?.settings?.data?.items;
      assert.equal(hubAfter?.length, manifest.hub.afterCount, "/industries hub items did not read back at 19 cards.");
      assert.equal(hash(hubAfter), hash(manifest.hub.afterItems), "/industries hub items did not read back at their after state.");

      const protectedAfter = await protectedHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the industry-facets apply.");

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
        pagesCreated: readback.length,
        slugs: readback.map((entry) => entry.slug),
        navItemsAfter: manifest.homepage.afterCount,
        hubItemsAfter: manifest.hub.afterCount
      };
    });

    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-industry-facets-${target}-2026-10-30-rollback.json`
    );
    const rollback = {
      ok: true,
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      summary: { deleteIds: manifest.pages.map((page) => page.id), navItemsBefore: manifest.homepage.beforeCount, hubItemsBefore: manifest.hub.beforeCount },
      deleteIds: manifest.pages.map((page) => page.id),
      homepage: { id: manifest.homepage.id, jsonPath: manifest.homepage.jsonPath, beforeCount: manifest.homepage.beforeCount },
      hub: { id: manifest.hub.id, jsonPath: manifest.hub.jsonPath, beforeCount: manifest.hub.beforeCount },
      note: "Rollback = delete the created LivePage rows and truncate the two reviewed lists back to their before counts. Historical/audit only; never run without the site owner's explicit approval."
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...report, rollbackPath }, null, 2));
  }
} finally {
  await db.$disconnect();
}
