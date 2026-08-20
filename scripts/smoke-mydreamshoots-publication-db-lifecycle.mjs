#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required for the local publication lifecycle smoke");
const parsed = new URL(databaseUrl);
assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `refusing non-local database host: ${parsed.hostname}`);
assert.equal(parsed.port || "5432", "15433", "publication lifecycle smoke must use the disposable mapped PostgreSQL port 15433");

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
const { buildPublicationSnapshot, publishSeoSnapshotRelational, activateThemePublicationRelational } = jiti("../src/lib/stores/theme-store.ts");
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient();
let beforeActive;
let draftPage;
let createdPublicationIds = [];
let keepPublicationId;
const keepNewPublication = process.env.MYDREAMSHOOTS_LIFECYCLE_KEEP_NEW === "1";

function stableSnapshotJson(value) {
  return JSON.stringify(value);
}

function refreshSnapshotHash(snapshot) {
  snapshot.snapshotHash = publicationSnapshotHash({ ...snapshot, snapshotHash: "", revisions: { ...snapshot.revisions, snapshotHash: "" } });
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  return snapshot;
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
  beforeActive = await prisma.activeThemePublication.findUnique({ where: { siteId }, include: { publication: true } });
  const beforeActiveIsValid = Boolean(beforeActive?.publication && publicationSnapshotIntegrity(beforeActive.publication.snapshot) === "valid");
  const site = {
    ...toSite(siteRecord),
    storefrontProfile: {
      id: `profile_${siteId}`,
      siteId,
      draftJson: {
        identity: {
          legalName: "MyDreamShoots Local Test",
          entityType: "company",
          address: { line1: "1 Local Test Way", city: "Test City", region: "CA", postalCode: "00000", country: "US" },
          supportEmail: "local-test@example.com",
          sameAs: []
        },
        policyFacts: { usesCustomerMediaForTraining: false, sourceMediaRetentionDays: 30, refundReviewRequired: true, refundWindowDays: 7, effectiveDate: "2026-08-19", creditLifecycle: { reserve: "Test reserve statement", consume: "Test consume statement", release: "Test release statement" }, security: { transportClaimKey: "Test transport statement", storageClaimKey: "Test storage statement" } }
      },
      publishedJson: {
        identity: {
          legalName: "MyDreamShoots Local Test",
          entityType: "company",
          address: { line1: "1 Local Test Way", city: "Test City", region: "CA", postalCode: "00000", country: "US" },
          supportEmail: "local-test@example.com",
          sameAs: []
        },
        policyFacts: { usesCustomerMediaForTraining: false, sourceMediaRetentionDays: 30, refundReviewRequired: true, refundWindowDays: 7, effectiveDate: "2026-08-19", creditLifecycle: { reserve: "Test reserve statement", consume: "Test consume statement", release: "Test release statement" }, security: { transportClaimKey: "Test transport statement", storageClaimKey: "Test storage statement" } }
      }
    }
  };
  const [packRows, productRows] = await Promise.all([
    prisma.creativePack.findMany({
      where: { siteId },
      select: { id: true, status: true, creditCost: true, outputCount: true, category: true, imageUrl: true, galleryImages: true, galleryImageAlts: true, categoryRecord: { select: { slug: true } } },
      orderBy: { id: "asc" }
    }),
    prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: { id: "asc" } })
  ]);
  const normalizedPacks = packRows.map((pack) => ({
    id: pack.id,
    status: ["active", "draft", "paused"].includes(pack.status) ? pack.status : "draft",
    creditCost: Number(pack.creditCost ?? 0),
    outputCount: Number(pack.outputCount ?? 0),
    category: pack.category ?? undefined,
    categoryRecord: pack.categoryRecord?.slug ? { slug: pack.categoryRecord.slug } : null,
    imageUrl: typeof pack.imageUrl === "string" ? pack.imageUrl : undefined,
    galleryImages: Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((value) => typeof value === "string") : [],
    galleryImageAlts: (() => {
      const images = [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])].filter((value) => typeof value === "string" && value.trim());
      const label = String(pack.categoryRecord?.slug || pack.category || pack.id).replace(/[-_]+/g, " ").trim();
      return images.map((_, index) => `MyDreamShoots ${label} ${index === 0 ? "hero cover" : "gallery preview"} for image generation planning`);
    })()
  }));
  const snapshot = buildPublicationSnapshot(site, undefined, normalizedPacks, productRows.map(mapProduct));
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "builder must create a valid v1 snapshot before database publish");

  const first = await publishSeoSnapshotRelational({ siteId, snapshot, actor: "smoke:publication-lifecycle" });
  createdPublicationIds.push(first.publication.id);
  keepPublicationId = first.publication.id;
  const firstRead = await prisma.themePublication.findUnique({ where: { id: first.publication.id } });
  assert.ok(firstRead, "first publication must be readable by ID");
  const firstBytes = stableSnapshotJson(firstRead.snapshot);
  const firstHash = firstRead.snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(firstRead.snapshot), "valid");

  draftPage = await prisma.themePage.findFirst({ where: { siteId }, orderBy: { slug: "asc" }, select: { id: true, draftJson: true } });
  assert.ok(draftPage, "a draft page is required for drift testing");
  await prisma.themePage.update({ where: { id: draftPage.id }, data: { draftJson: { ...draftPage.draftJson, lifecycleSmokeDrift: true } } });
  const afterDrift = await prisma.themePublication.findUnique({ where: { id: first.publication.id } });
  assert.equal(stableSnapshotJson(afterDrift?.snapshot), firstBytes, "draft drift must not mutate the first immutable publication");

  const secondSnapshot = refreshSnapshotHash({ ...snapshot, buildId: "smoke-publication-lifecycle-second" });
  assert.equal(publicationSnapshotIntegrity(secondSnapshot), "valid");
  const second = await publishSeoSnapshotRelational({ siteId, snapshot: secondSnapshot, actor: "smoke:publication-lifecycle" });
  createdPublicationIds.push(second.publication.id);
  if (keepNewPublication) keepPublicationId = second.publication.id;
  assert.notEqual(second.publication.id, first.publication.id, "republish must create a new publication ID");
  assert.equal(second.publishedVersion, first.publishedVersion + 1, "republish must increment publication version");
  const firstAfterRepublish = await prisma.themePublication.findUnique({ where: { id: first.publication.id } });
  assert.equal(stableSnapshotJson(firstAfterRepublish?.snapshot), firstBytes, "republish must not rewrite the old snapshot");

  await activateThemePublicationRelational(siteId, first.publication.id, "smoke:publication-rollback");
  const rollbackPointer = await prisma.activeThemePublication.findUnique({ where: { siteId } });
  assert.equal(rollbackPointer?.publicationId, first.publication.id, "rollback must only switch the active pointer");
  const secondAfterRollback = await prisma.themePublication.findUnique({ where: { id: second.publication.id } });
  assert.equal(secondAfterRollback?.snapshot.snapshotHash, secondSnapshot.snapshotHash, "rollback must not rewrite the newer publication");

  await prisma.themePage.update({ where: { id: draftPage.id }, data: { draftJson: draftPage.draftJson } });
  console.log(JSON.stringify({
    ok: true,
    siteId,
    firstPublicationId: first.publication.id,
    secondPublicationId: second.publication.id,
    firstVersion: first.publishedVersion,
    secondVersion: second.publishedVersion,
    snapshotHash: firstHash,
    rollbackVerified: true,
    restoredPreviousActivePointer: beforeActiveIsValid
  }, null, 2));
} finally {
  if (draftPage) await prisma.themePage.update({ where: { id: draftPage.id }, data: { draftJson: draftPage.draftJson } }).catch(() => {});
  const restorePublicationId = keepNewPublication
    ? keepPublicationId
    : beforeActive?.publication && publicationSnapshotIntegrity(beforeActive.publication.snapshot) === "valid"
    ? beforeActive.publicationId
    : keepPublicationId;
  const activeAtCleanup = await prisma.activeThemePublication.findUnique({ where: { siteId }, select: { publicationId: true } }).catch(() => undefined);
  const testOwnedActivePointer = !activeAtCleanup?.publicationId || createdPublicationIds.includes(activeAtCleanup.publicationId);
  if (testOwnedActivePointer && restorePublicationId) {
    await prisma.activeThemePublication.upsert({ where: { siteId }, create: { siteId, publicationId: restorePublicationId, activatedBy: "smoke:publication-lifecycle-restore" }, update: { publicationId: restorePublicationId, activatedAt: new Date(), activatedBy: "smoke:publication-lifecycle-restore" } }).catch(() => {});
  } else if (testOwnedActivePointer) {
    await prisma.activeThemePublication.delete({ where: { siteId } }).catch(() => {});
  }
  const deletePublicationIds = createdPublicationIds.filter((id) => id !== restorePublicationId);
  if (deletePublicationIds.length) await prisma.themePublication.deleteMany({ where: { id: { in: deletePublicationIds } } }).catch(() => {});
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
