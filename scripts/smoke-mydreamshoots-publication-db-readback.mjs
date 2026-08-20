#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const requireDatabase = process.argv.includes("--require-db");
  const rawUrl = process.env.DATABASE_URL?.trim();
  if (!rawUrl) {
  const result = { ok: !requireDatabase, skipped: true, reason: "DATABASE_URL is not configured; no database was touched" };
  console.log(JSON.stringify(result, null, 2));
  if (requireDatabase) process.exitCode = 1;
} else {
  const parsed = new URL(rawUrl);
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `refusing non-local database host: ${parsed.hostname}`);
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
  const { publicationSnapshotIntegrity, publicationSnapshotHash } = createJiti(import.meta.url)("../src/lib/publication-snapshot-integrity.ts");
  const prisma = new PrismaClient();
  try {
    const active = await prisma.activeThemePublication.findUnique({
      where: { siteId },
      include: { publication: true }
    });
    assert.ok(active, "local database must have an active MyDreamShoots publication");
    const first = active.publication;
    const second = await prisma.themePublication.findUnique({ where: { id: first.id } });
    assert.ok(second, "active publication must be readable by ID");
    assert.equal(first.id, second.id);
    assert.equal(first.version, second.version);
    assert.deepEqual(first.snapshot, second.snapshot, "publication snapshot must be byte-stable on readback");
    assert.equal(publicationSnapshotIntegrity(first.snapshot), "valid", "readback snapshot must satisfy the immutable contract");
    assert.equal(publicationSnapshotHash(first.snapshot), first.snapshot.snapshotHash, "snapshot hash must verify after readback");
    for (const field of ["publishedRoutes", "publishedPageEntities", "publishedPageCopy", "publishedPageMedia", "publishedPackFacts", "publishedOffers", "publishedFacts", "publishedCollectionRefs", "publishedLinkRefs", "revisions", "snapshotHash", "buildId"]) {
      assert.ok(field in first.snapshot, `readback snapshot missing ${field}`);
    }
    console.log(JSON.stringify({ ok: true, skipped: false, siteId, publicationId: first.id, version: first.version, snapshotHash: first.snapshot.snapshotHash }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}
