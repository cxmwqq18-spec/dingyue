#!/usr/bin/env node
// Apply the reviewed /templates example-gallery manifest (planned by
// scripts/plan-aidreamcapes-template-gallery.mjs, Step 3 of
// docs/aivideosugc-template-cases-navigation-plan.md).
//
// Field-level CAS apply: every row must still match its planned pageHash,
// otherwise the apply aborts (online edit wins). The two catalog rows are
// deleted (the runtime redirect helper sends their paths to /templates).
// No snapshot or published state is written.
//
//   node --env-file=.env.local scripts/apply-aidreamcapes-template-gallery.mjs --target=local
//   node --env-file=.env.local scripts/apply-aidreamcapes-template-gallery.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-template-gallery-local --base-hash=<planHash>
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
const CONTRACT = "aidreamcapes-template-gallery-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1];
const baseHash = process.argv.find((arg) => arg.startsWith("--base-hash="))?.split("=")[1];
const apply = process.argv.includes("--apply");
const expectedConfirmation = `site_aidreamcapes-template-gallery-${target}`;
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-template-gallery-${target}-2026-10-30.json`
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
  const allSlugs = [manifest.operations.gallery.slug, ...manifest.operations.links.map((entry) => entry.slug), "/", ...manifest.operations.deleteRows.map((entry) => entry.slug)];
  const rows = await db.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: allSlugs } }, select });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));

  // CAS: every planned row must still be at its planned state.
  const aborted = [];
  const casCheck = (slug, expectedHash) => {
    const row = bySlug.get(slug);
    if (!row) { aborted.push({ slug, reason: "LivePage is missing" }); return undefined; }
    if (pageHash(row) !== expectedHash) { aborted.push({ slug, reason: "LivePage changed since the reviewed plan (baseHash mismatch)" }); return undefined; }
    return row;
  };
  const galleryRow = casCheck(manifest.operations.gallery.slug, manifest.operations.gallery.before.pageHash);
  const linkRows = manifest.operations.links.map((entry) => ({ entry, row: casCheck(entry.slug, entry.before.pageHash) }));
  const homeRow = casCheck("/", manifest.operations.homeFooter.pageHash);
  const deleteRows = manifest.operations.deleteRows.map((entry) => ({ entry, row: casCheck(entry.slug, entry.pageHash) }));

  if (aborted.length) {
    console.log(JSON.stringify({ ok: false, mode: apply ? "apply" : "dry-run", aborted }, null, 2));
    process.exitCode = 1;
  } else if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      planHash: manifest.planHash,
      wouldUpdate: 2 + manifest.operations.links.length,
      wouldDelete: manifest.operations.deleteRows.length
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

      const rowOps = manifest.operations.links.length + 2; // links rows + gallery + home
      const deleted = [];
      for (const { entry } of deleteRows) {
        const removed = await tx.livePage.deleteMany({ where: { id: entry.row.id, updatedAt: entry.row.updatedAt } });
        assert.equal(removed.count, 1, `LivePage ${entry.slug} changed concurrently; refusing to delete.`);
        deleted.push({ slug: entry.slug });
      }
      const updatedGallery = await tx.livePage.updateMany({
        where: { id: galleryRow.id, updatedAt: galleryRow.updatedAt },
        data: { title: manifest.operations.gallery.after.title, contentJson: { ...galleryRow.contentJson, sections: { ...galleryRow.contentJson.sections, v2_main: { ...galleryRow.contentJson.sections.v2_main, settings: { ...galleryRow.contentJson.sections.v2_main.settings, data: manifest.operations.gallery.after.data } } }, seo: manifest.operations.gallery.after.seo } }
      });
      assert.equal(updatedGallery.count, 1, "Gallery row changed concurrently; refusing to overwrite.");
      let updatedLinks = 0;
      for (const { entry, row } of linkRows) {
        const updated = await tx.livePage.updateMany({
          where: { id: row.id, updatedAt: row.updatedAt },
          data: { contentJson: entry.after.contentJson }
        });
        assert.equal(updated.count, 1, `LivePage ${entry.slug} changed concurrently; refusing to overwrite.`);
        updatedLinks += 1;
      }
      const updatedHome = await tx.livePage.updateMany({
        where: { id: homeRow.id, updatedAt: homeRow.updatedAt },
        data: { contentJson: manifest.operations.homeFooter.afterContentJson }
      });
      assert.equal(updatedHome.count, 1, "Homepage changed concurrently; refusing to overwrite.");

      // Readback assertions.
      const readGallery = await tx.livePage.findUniqueOrThrow({ where: { id: galleryRow.id }, select });
      assert.equal(readGallery.title, manifest.gallery.rowTitle, "Gallery title did not read back.");
      const readData = readGallery.contentJson?.sections?.v2_main?.settings?.data;
      assert(readData?.exampleDirectory && !readData.templateDirectory, "Gallery data did not read back (exampleDirectory missing or templateDirectory still present).");
      assert(!readGallery.contentJson.seo.jsonLd["@graph"].some((node) => node["@type"] === "ItemList"), "stored ItemList did not read back removed");
      for (const { entry, row } of linkRows) {
        const readRow = await tx.livePage.findUniqueOrThrow({ where: { id: row.id }, select });
        const readLinks = readRow.contentJson?.sections?.v2_main?.settings?.data?.templateDirectory?.links;
        assert.deepEqual(readLinks, manifest.newLinks, `Links did not read back on ${entry.slug}.`);
      }
      const readHome = await tx.livePage.findUniqueOrThrow({ where: { id: homeRow.id }, select });
      for (const op of manifest.operations.homeFooter.operations) {
        const menu = readHome.contentJson?.siteNavigation?.menus?.find((entry) => entry?.label === op.menu);
        assert.deepEqual(menu?.footerLink, op.after, `Footer link did not read back on ${op.menu}.`);
      }
      for (const { entry } of deleteRows) {
        const gone = await tx.livePage.findUnique({ where: { id: entry.row.id }, select: { id: true } });
        assert.equal(gone, null, `Row ${entry.slug} still exists after delete.`);
      }

      const revisionAfter = await readRevision(tx);
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(rowOps + deleted.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${rowOps + deleted.length}.`
      );
      const protectedAfter = await protectedHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the template-gallery apply.");
      return {
        ok: true,
        mode: "apply",
        contract: CONTRACT,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        updated: { gallery: 1, links: updatedLinks, home: 1 },
        deleted,
        readback: { galleryTitle: readGallery.title, galleryH1: readData.h1 }
      };
    });

    const rollbackPath = path.resolve(
      process.cwd(),
      process.argv.find((arg) => arg.startsWith("--rollback="))?.split("=")[1]
      || `scripts/manifests/aidreamcapes-template-gallery-${target}-2026-10-30-rollback.json`
    );
    const rollback = {
      ok: true,
      contract: `${CONTRACT}-rollback`,
      siteId: SITE_ID,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      note: "Inverse of the apply: restore gallery/home rows to the reviewed before content (CAS by pageHash), re-insert the deleted catalog rows verbatim.",
      gallery: {
        slug: manifest.operations.gallery.slug,
        before: { title: manifest.operations.gallery.before.title, data: manifest.operations.gallery.before.data, seo: manifest.operations.gallery.before.seo },
        baseHash: manifest.operations.gallery.before.pageHash
      },
      links: manifest.operations.links.map((entry) => ({ slug: entry.slug, beforeContentJson: null, note: "inverse = restore templateDirectory.links to the before array", beforeLinks: entry.before.links })),
      home: { slug: "/", baseHash: manifest.operations.homeFooter.pageHash, operations: manifest.operations.homeFooter.operations.map((op) => ({ menu: op.menu, before: op.before })) },
      deletedRows: manifest.operations.deleteRows.map((entry) => ({ slug: entry.slug, row: entry.row }))
    };
    // Full before content for links rows is already embedded in each operation's row copy.
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...report, rollbackPath }, null, 2));
  }
} finally {
  await db.$disconnect();
}
