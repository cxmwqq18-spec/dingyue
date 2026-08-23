#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply");
const backupArgument = process.argv.find((value) => value.startsWith("--backup="))?.slice("--backup=".length)
  || "releases/backups/mydreamshoots-homepage-2026-08-22T05-36-58-817Z.json";
const backupPath = path.resolve(backupArgument);
assert(fs.existsSync(backupPath), `homepage backup not found: ${backupPath}`);
assertDatabaseTarget({ expectedTarget: "local" });

const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
assert.equal(backup.siteId, siteId, "backup must belong to MyDreamShoots");
assert(backup.homepage?.publishedJson && backup.homepage?.draftJson, "backup must include homepage draft and published JSON");
assert(backup.themeSettings?.publishedJson && backup.themeSettings?.draftJson, "backup must include theme settings draft and published JSON");

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
const clone = (value) => JSON.parse(JSON.stringify(value));
const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const prisma = new PrismaClient();

try {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { pages: { where: { slug: "/" } }, settings: true, activePublication: { include: { publication: true } } }
  });
  assert(site?.settings && site.pages.length === 1 && site.activePublication?.publication, "local MyDreamShoots homepage, settings, and active publication are required");
  const homepage = site.pages[0];
  const current = {
    homepage,
    themeSettings: site.settings,
    activePublication: site.activePublication.publication
  };
  const result = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    backupPath,
    backupCreatedAt: backup.createdAt,
    currentHero: homepage.publishedJson?.sections?.hero_1?.settings?.headline,
    backupHero: backup.homepage.publishedJson?.sections?.hero_1?.settings?.headline,
    currentHomepageHash: hash(homepage.publishedJson),
    backupHomepageHash: hash(backup.homepage.publishedJson),
    currentThemeSettingsHash: hash(site.settings.publishedJson),
    backupThemeSettingsHash: hash(backup.themeSettings.publishedJson),
    untouched: ["VideoTheme", "VideoThemeCategory", "all non-homepage ThemePage rows"]
  };
  if (!apply) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const backupDir = path.resolve("releases/backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const rollbackPath = path.join(backupDir, `mydreamshoots-homepage-copy-before-restore-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(rollbackPath, `${JSON.stringify({ createdAt: new Date().toISOString(), sourceBackup: backupPath, ...current }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      await tx.themePage.update({ where: { id: homepage.id }, data: { draftJson: clone(backup.homepage.draftJson), publishedJson: clone(backup.homepage.publishedJson), updatedAt: new Date() } });
      await tx.themeSettings.update({ where: { siteId }, data: { draftJson: clone(backup.themeSettings.draftJson), publishedJson: clone(backup.themeSettings.publishedJson), updatedAt: new Date() } });
    });
    const fresh = await prisma.site.findUnique({ where: { id: siteId }, include: { pages: { where: { slug: "/" } }, settings: true, activePublication: { include: { publication: true } } } });
    assert(fresh?.activePublication?.publication && fresh.pages.length === 1 && fresh.settings, "local restore readback failed");
    assert.equal(hash(fresh.pages[0].publishedJson), hash(backup.homepage.publishedJson), "homepage published data did not match the requested backup");
    assert.equal(hash(fresh.settings.publishedJson), hash(backup.themeSettings.publishedJson), "theme settings did not match the requested backup");
    const snapshot = clone(fresh.activePublication.publication.snapshot);
    assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "current publication must be valid before homepage restore");
    const publishedPage = snapshot.pages.find((page) => page.slug === "/");
    assert(publishedPage, "active publication snapshot is missing the homepage");
    publishedPage.title = fresh.pages[0].title;
    publishedPage.publishedJson = clone(fresh.pages[0].publishedJson);
    snapshot.themeSettings = clone(fresh.settings.publishedJson);
    snapshot.snapshotHash = "";
    snapshot.revisions = { ...snapshot.revisions, snapshotHash: "" };
    snapshot.snapshotHash = publicationSnapshotHash(snapshot);
    snapshot.revisions.snapshotHash = snapshot.snapshotHash;
    assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "restored publication snapshot is invalid");
    const published = await publishSeoSnapshotRelational({ siteId, snapshot, actor: "restore:mydreamshoots-homepage-copy-from-backup" });
    console.log(JSON.stringify({ ...result, rollbackPath, publicationId: published.publication.id, version: published.publishedVersion, snapshotHash: published.publication.snapshot.snapshotHash }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
