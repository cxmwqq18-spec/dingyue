#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const homepageSlug = "/";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required for the homepage publication repair");
const parsedUrl = new URL(databaseUrl);
assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname), `refusing non-local database host: ${parsedUrl.hostname}`);

const { PrismaClient } = await import("@prisma/client");
const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  let resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) resolved = `${resolved}.ts`;
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { publishReviewedDraftSiteRelational } = jiti("../src/lib/stores/theme-store.ts");
const { toSite } = jiti("../src/lib/stores/prisma-mappers.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const { publicationSnapshotHash } = jiti("../src/lib/publication-snapshot-integrity.ts");

const prisma = new PrismaClient();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizeHomePage(site) {
  const page = site.pages.find((item) => item.slug === homepageSlug || item.pageType === "home");
  if (!page) throw new Error(`homepage page not found for ${siteId}`);
  const publishedJson = clone(page.draftJson ?? page.publishedJson);
  if (!publishedJson?.sections?.brand_strip_1) {
    throw new Error("homepage draftJson is missing brand_strip_1; run the homepage layout sync first");
  }
  return { page, publishedJson };
}

try {
  const siteRecord = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      activePublication: { include: { publication: true } },
      publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 },
      connect: true
    }
  });
  assert.ok(siteRecord, `site ${siteId} must exist`);

  const site = toSite(siteRecord);
  const { page: homepage, publishedJson } = normalizeHomePage(site);

  await prisma.themePage.update({
    where: { id: homepage.id },
    data: {
      draftJson: publishedJson
    }
  });

  const activePublication = siteRecord.activePublication?.publication;
  if (!activePublication || publicationSnapshotIntegrity(activePublication.snapshot) !== "valid") {
    throw new Error("active MyDreamShoots publication must exist and be valid before repairing the homepage");
  }

  const snapshot = clone(activePublication.snapshot);
  const homepageSnapshotPage = snapshot.pages.find((item) => item.id === homepage.id || item.slug === homepage.slug);
  if (!homepageSnapshotPage) throw new Error("homepage page missing from active publication snapshot");
  homepageSnapshotPage.publishedJson = clone(publishedJson);
  snapshot.snapshotHash = publicationSnapshotHash({ ...snapshot, snapshotHash: "", revisions: { ...snapshot.revisions, snapshotHash: "" } });
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "homepage repair must preserve immutable snapshot integrity");

  const result = await publishReviewedDraftSiteRelational(siteId, "repair:mydreamshoots-homepage");

  console.log(JSON.stringify({
    ok: true,
    siteId,
    homepagePageId: homepage.id,
    publicationId: result.publication.id,
    version: result.publishedVersion,
    snapshotHash: result.publication.snapshot.snapshotHash
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
