#!/usr/bin/env node
// Bring a local development database in line with a live content dump.
//
// The live database is the source of truth for public content, so a local
// checkout must not keep serving an older or different version of the same
// pages. This script copies the exported `contentJson` of every page that
// exists in both databases, and it never creates, deletes or renames pages.
//
// The write is field level and compare-and-set:
//   1. the manifest records the local before state and the dump after state
//      for every page it touches;
//   2. the apply re-reads each row, verifies the local row still matches the
//      reviewed before hash, and writes only `contentJson`;
//   3. the apply reads every row back, checks SiteContentRevision advanced
//      once per written page, and verifies MyDreamShoots public content did
//      not change;
//   4. the apply writes a rollback file that restores the local before state.
//
// Usage:
//   node --env-file=.env.local scripts/sync-aidreamcapes-content.mjs --target=local \
//     --source-dump=/tmp/site_aidreamcapes-content-production.json
//   node --env-file=.env.local scripts/sync-aidreamcapes-content.mjs --target=local \
//     --source-dump=/tmp/site_aidreamcapes-content-production.json --apply \
//     --confirm=site_aidreamcapes-content-sync-local \
//     --base-hash=<planHash>
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONTRACT = "aidreamcapes-content-sync-local-2026-10-22-v1";
const siteId = assertAllowedSite(argumentValue("--site-id") || "site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmation = argumentValue("--confirm");
const baseHash = argumentValue("--base-hash");
const sourceDumpPath = path.resolve(argumentValue("--source-dump") || "");
const manifestPath = path.resolve(argumentValue("--out") || `releases/manifests/${siteId}-content-sync-${target}.json`);
const expectedConfirmation = `site_aidreamcapes-content-sync-${target}`;
assert(sourceDumpPath, "--source-dump=<file> is required.");
assert(fs.existsSync(sourceDumpPath), `Source dump not found: ${sourceDumpPath}.`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: false, productionConfirmed: true });
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert(baseHash, "Apply requires --base-hash=<planHash>.");
}

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
async function protectedMyDreamShootsHash(client) {
  const [pages, settings, profile] = await Promise.all([
    client.livePage.findMany({ where: { siteId: "site_dreamshoot" }, orderBy: { id: "asc" }, select: { id: true, contentJson: true, updatedAt: true } }),
    client.themeSettings.findUnique({ where: { siteId: "site_dreamshoot" }, select: { draftJson: true, publishedJson: true } }),
    client.storefrontProfile.findUnique({ where: { siteId: "site_dreamshoot" }, select: { publishedJson: true } })
  ]);
  return hash({ pages, settings, profile });
}

const dump = JSON.parse(fs.readFileSync(sourceDumpPath, "utf8"));
const dumpPages = dump.pages && typeof dump.pages === "object" ? dump.pages : dump;
assert.equal(dump.siteId ?? siteId, siteId, "The source dump belongs to another site.");
const sourceHash = hash(dumpPages);

const prisma = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await prisma.livePage.findMany({
    where: { siteId },
    orderBy: { slug: "asc" },
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
  const localBySlug = new Map(rows.map((row) => [row.slug, row]));
  const localIds = new Set(rows.map((row) => row.id));
  const planned = [];
  const skipped = [];
  const created = [];
  for (const [slug, source] of Object.entries(dumpPages)) {
    const contentJson = source && typeof source === "object" && "contentJson" in source ? source.contentJson : source;
    const row = localBySlug.get(slug);
    if (!row) {
      // A page the live site has and the local database is missing. Create it
      // with the live row identity so both databases describe the same site.
      const id = typeof source?.id === "string" && !localIds.has(source.id) ? source.id : crypto.randomUUID();
      localIds.add(id);
      created.push({
        slug,
        id,
        title: source?.title ?? null,
        pageType: source?.pageType ?? null,
        templateKey: source?.templateKey ?? null,
        beforeHash: null,
        afterHash: hash(contentJson),
        contentJson
      });
      continue;
    }
    if (hash(row.contentJson) === hash(contentJson)) {
      skipped.push({ slug, reason: "already identical" });
      continue;
    }
    planned.push({
      slug,
      id: row.id,
      baseHash: pageHash(row),
      beforeHash: hash(row.contentJson),
      afterHash: hash(contentJson),
      before: row.contentJson,
      after: contentJson
    });
  }
  const localOnly = rows.map((row) => row.slug).filter((slug) => !(slug in dumpPages));
  // Pages the live site retired. The local database keeps the same site
  // surface, so a page the live site dropped is dropped here too. The rollback
  // file carries the full row so it can be restored.
  const retired = localOnly.map((slug) => {
    const row = localBySlug.get(slug);
    return {
      slug,
      id: row.id,
      title: row.title,
      pageType: row.pageType,
      templateKey: row.templateKey,
      beforeHash: hash(row.contentJson),
      contentJson: row.contentJson
    };
  });

  const body = {
    contract: CONTRACT,
    siteId,
    target,
    sourceDump: path.relative(process.cwd(), sourceDumpPath),
    sourceHash,
    pages: planned.map((page) => ({
      slug: page.slug,
      id: page.id,
      baseHash: page.baseHash,
      beforeHash: page.beforeHash,
      afterHash: page.afterHash
    })),
    created: created.map((page) => ({
      slug: page.slug,
      id: page.id,
      title: page.title,
      pageType: page.pageType,
      templateKey: page.templateKey,
      afterHash: page.afterHash
    })),
    retired: retired.map((page) => ({
      slug: page.slug,
      id: page.id,
      title: page.title,
      pageType: page.pageType,
      templateKey: page.templateKey,
      beforeHash: page.beforeHash
    })),
    skipped
  };
  const manifest = {
    ok: true,
    mode: "plan",
    ...body,
    generatedAt: new Date().toISOString(),
    rules: {
      scope: "existing pages only; the sync never creates, deletes or renames a page",
      authority: "the live export is the source of truth for public content",
      rollback: "the apply writes the local before state for every page it wrote"
    },
    summary: {
      targetPages: rows.length,
      sourcePages: Object.keys(dumpPages).length,
      plannedPages: planned.length,
      createdPages: created.length,
      retiredPages: retired.length,
      skippedPages: skipped.length,
      localOnlyPages: localOnly.length
    },
    localOnly,
    planHash: hash(body)
  };

  if (!apply) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...manifest, manifestPath, payload: "the before/after payload is written by the apply" }, null, 2));
  } else {
    assert.equal(baseHash, manifest.planHash, "The reviewed plan hash does not match the manifest.");
    const [revisionRelation] = await prisma.$queryRaw`SELECT to_regclass('public."SiteContentRevision"')::text AS relation`;
    assert(revisionRelation?.relation, "SiteContentRevision table is missing; refusing to write without derived-state revision.");
    const [revisionTrigger] = await prisma.$queryRaw`
      SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'public."LivePage"'::regclass AND tgname = 'SiteContentRevision_LivePage'
      LIMIT 1
    `;
    assert(revisionTrigger?.tgname, "SiteContentRevision_LivePage trigger is missing; refusing to write without derived-state revision.");
    const reportPath = path.resolve(argumentValue("--report") || manifestPath.replace(/\.json$/, "-apply-report.json"));
    const rollbackPath = path.resolve(argumentValue("--rollback") || manifestPath.replace(/\.json$/, "-rollback.json"));
    const report = await prisma.$transaction(async (tx) => {
      const protectedBefore = await protectedMyDreamShootsHash(tx);
      const readRevision = async () => {
        const rowsNow = await tx.$queryRaw`
          SELECT "revision"::text AS revision FROM "SiteContentRevision" WHERE "siteId" = ${siteId} LIMIT 1
        `;
        return BigInt(rowsNow[0]?.revision ?? "0");
      };
      const revisionBefore = await readRevision();
      const written = [];
      for (const page of planned) {
        const row = await tx.livePage.findUniqueOrThrow({ where: { id: page.id }, select: { id: true, updatedAt: true, contentJson: true } });
        assert.equal(hash(row.contentJson), page.beforeHash, `${page.slug} changed since the reviewed plan; online edit wins.`);
        const updated = await tx.livePage.updateMany({
          where: { id: page.id, updatedAt: row.updatedAt },
          data: { contentJson: page.after }
        });
        assert.equal(updated.count, 1, `${page.slug} changed concurrently; refusing to overwrite.`);
        written.push(page.slug);
      }
      const added = [];
      for (const page of created) {
        await tx.livePage.create({
          data: {
            id: page.id,
            siteId,
            slug: page.slug,
            title: page.title ?? page.slug,
            pageType: page.pageType ?? "content",
            templateKey: page.templateKey,
            contentJson: page.contentJson
          }
        });
        added.push(page.slug);
      }
      const removed = [];
      for (const page of retired) {
        const row = await tx.livePage.findUniqueOrThrow({ where: { id: page.id }, select: { id: true, updatedAt: true, contentJson: true } });
        assert.equal(hash(row.contentJson), page.beforeHash, `${page.slug} changed since the reviewed plan; online edit wins.`);
        const deleted = await tx.livePage.deleteMany({ where: { id: page.id, updatedAt: row.updatedAt } });
        assert.equal(deleted.count, 1, `${page.slug} changed concurrently; refusing to remove it.`);
        removed.push(page.slug);
      }
      for (const page of planned) {
        const readback = await tx.livePage.findUniqueOrThrow({ where: { id: page.id }, select: { slug: true, contentJson: true } });
        assert.equal(hash(readback.contentJson), page.afterHash, `${page.slug} did not read back at the reviewed after hash.`);
      }
      for (const page of created) {
        const readback = await tx.livePage.findUniqueOrThrow({ where: { id: page.id }, select: { slug: true, contentJson: true } });
        assert.equal(hash(readback.contentJson), page.afterHash, `${page.slug} did not read back at the reviewed after hash.`);
      }
      const revisionAfter = await readRevision();
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length + created.length + retired.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length + created.length + retired.length}.`
      );
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the content sync.");
      return {
        ok: true,
        mode: "apply",
        contract: CONTRACT,
        siteId,
        target,
        sourceHash,
        planHash: manifest.planHash,
        pagesWritten: written.length,
        pagesCreated: added.length,
        pagesRetired: removed.length,
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        revisionDelta: (revisionAfter - revisionBefore).toString(),
        written,
        created: added,
        retired: removed
      };
    });
    const rollback = {
      ok: true,
      contract: CONTRACT,
      siteId,
      target,
      generatedAt: new Date().toISOString(),
      sourcePlanHash: manifest.planHash,
      pages: planned.map((page) => ({ slug: page.slug, id: page.id, before: page.after, after: page.before, beforeHash: page.afterHash, afterHash: page.beforeHash })),
      createdPages: created.map((page) => ({ slug: page.slug, id: page.id, title: page.title, pageType: page.pageType, templateKey: page.templateKey, contentJson: page.contentJson })),
      retiredPages: retired.map((page) => ({ slug: page.slug, id: page.id, title: page.title, pageType: page.pageType, templateKey: page.templateKey, contentJson: page.contentJson }))
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ...report, reportPath, rollbackPath }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
