#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, parseDatabaseUrl } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const slug = "/ai-video-generation";
const apply = process.argv.includes("--apply");
const productionConfirmed = process.argv.includes("--confirm-production");
const target = String(process.env.DATABASE_TARGET ?? "").trim().toLowerCase();
const expectedTarget = target === "remote" ? "remote" : "local";
const database = parseDatabaseUrl();
assertDatabaseTarget({ expectedTarget });
if (expectedTarget === "remote" && !productionConfirmed) throw new Error("Production video page sync requires --confirm-production.");
if (!apply) throw new Error("Use --apply to synchronize the video page from the active publication.");

const repoRoot = process.cwd();
const backupDir = path.join(repoRoot, "releases", "backups");
const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) { if (request === "server-only") return {}; return originalLoad.call(this, request, ...args); };
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};
const jiti = createJiti(import.meta.url);
const { prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { pages: true, settings: true, activePublication: { include: { publication: true } } } });
  assert(site?.settings, "MyDreamShoots site and settings are required");
  const page = site.pages.find((item) => item.slug === slug);
  const active = site.activePublication?.publication;
  assert(page && active?.snapshot, "video page and active publication are required");
  const sourcePage = active.snapshot.pages.find((item) => item.slug === slug);
  assert(sourcePage, "active publication must include /ai-video-generation");
  const backupPath = path.join(backupDir, `mydreamshoots-video-page-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), target: expectedTarget, database, page, activePublication: active }, null, 2)}\n`, { mode: 0o600 });
  const nextJson = clone(sourcePage.publishedJson);
  await prisma.$transaction(async (tx) => {
  await tx.themePage.update({ where: { id: page.id }, data: { draftJson: nextJson, updatedAt: new Date() } });
  }, { timeout: 120_000 });
  const snapshot = clone(active.snapshot);
  const targetPage = snapshot.pages.find((item) => item.slug === slug);
  assert(targetPage, "publication page readback failed");
  targetPage.publishedJson = nextJson;
  snapshot.snapshotHash = "";
  snapshot.revisions = { ...(snapshot.revisions ?? {}), snapshotHash: "" };
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "video page publication snapshot must be valid");
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({ ok: true, target: expectedTarget, page: slug, mode: "draft-only", manifestHash: manifest.manifestHash, publicationRequired: true, backupPath }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
