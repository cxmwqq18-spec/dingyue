#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const siteId = "site_grownstride_test";
const targetSlugs = ["/ai-image-generation", "/ai-video-generation", "/best-ai-image", "/best-ai-video"];
const apply = process.argv.includes("--apply");

assertDatabaseTarget({ expectedTarget: "test" });
if (apply) assertNonProductionWriteTarget();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeIndexable(value) {
  const next = clone(value) ?? {};
  next.seo = {
    ...(next.seo ?? {}),
    index: true,
    follow: true,
    robots: { ...(next.seo?.robots ?? {}), index: true, follow: true }
  };
  return next;
}

const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};
const jiti = createJiti(import.meta.url);
const { publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");

const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({
    where: { siteId, slug: { in: targetSlugs } },
    select: { id: true, slug: true, draftJson: true, publishedJson: true }
  });
  assert.equal(pages.length, targetSlugs.length, "all public directory pages must exist");
  const changed = pages.filter((page) => JSON.stringify(page.draftJson) !== JSON.stringify(makeIndexable(page.draftJson)) || JSON.stringify(page.publishedJson) !== JSON.stringify(makeIndexable(page.publishedJson)));
  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const page of changed) {
        await tx.themePage.update({
          where: { id: page.id },
          data: { draftJson: makeIndexable(page.draftJson), publishedJson: makeIndexable(page.publishedJson), updatedAt: new Date() }
        });
      }
    });
    const freshSite = await prisma.site.findUnique({
      where: { id: siteId },
      include: { pages: { where: { slug: { in: targetSlugs } } }, activePublication: { include: { publication: true } } }
    });
    assert(freshSite?.activePublication?.publication, "active publication is required");
    const snapshot = clone(freshSite.activePublication.publication.snapshot);
    for (const page of freshSite.pages) {
      const publishedPage = snapshot.pages.find((candidate) => candidate.id === page.id);
      assert(publishedPage, `publication page ${page.slug} is required`);
      publishedPage.publishedJson = clone(page.publishedJson);
    }
    snapshot.snapshotHash = "";
    snapshot.revisions = { ...snapshot.revisions, snapshotHash: "" };
    snapshot.snapshotHash = publicationSnapshotHash(snapshot);
    snapshot.revisions.snapshotHash = snapshot.snapshotHash;
    assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "indexing publication must preserve snapshot integrity");
    const published = await publishSeoSnapshotRelational({ siteId, snapshot, actor: "sync:grownstride-test-public-indexing" });
    console.log(JSON.stringify({ publicationId: published.publication.id, version: published.publishedVersion, snapshotHash: published.publication.snapshot.snapshotHash }, null, 2));
  }
  console.log(JSON.stringify({ ok: true, mode: apply ? "applied" : "dry-run", siteId, pages: targetSlugs, changed: changed.length }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
