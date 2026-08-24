#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, parseDatabaseUrl } from "./lib/database-target.mjs";

const apply = process.argv.includes("--apply");
const productionConfirmed = process.argv.includes("--confirm-production");
if (!apply) throw new Error("Use --apply to repair the MyDreamShoots video directory publication.");
const databaseTarget = String(process.env.DATABASE_TARGET || "").trim().toLowerCase();
if (databaseTarget === "production") {
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed });
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
}

const siteId = "site_dreamshoot";
const pageSlug = "/ai-video-generation";
const repoRoot = process.cwd();
const sourceRoot = path.resolve("src");
const backupDir = path.join(repoRoot, "releases", "backups");
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
const videoDirectoryJson = (pageJson) => ({
  ...pageJson,
  sectionsOrder: ["video_theme_directory_1"],
  sections: {
    video_theme_directory_1: {
      type: "dreamshoot_tool_collection",
      settings: {
        anchor: "video-themes",
        title: "AI Video Generation",
        subtitle: "Browse every public AI video theme and open the dedicated guide for the direction you want.",
        layout: "video_theme_grid",
        headingLevel: "h1"
      },
      blocks: []
    }
  }
});

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { pages: true, activePublication: { include: { publication: true } } }
  });
  assert(site, `Missing site ${siteId}`);
  const page = site.pages.find((candidate) => candidate.slug === pageSlug);
  const active = site.activePublication?.publication;
  assert(page && active?.snapshot, "Video directory page and active publication are required");
  const sourcePage = active.snapshot.pages.find((candidate) => candidate.slug === pageSlug);
  assert(sourcePage, "Active publication must include the video directory page");

  const nextJson = videoDirectoryJson(sourcePage.publishedJson ?? page.publishedJson);
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDir, `mydreamshoots-video-directory-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(
      backupPath,
      target: databaseTarget || "local",
    `${JSON.stringify({ createdAt: new Date().toISOString(), target: databaseTarget || "local", database: parseDatabaseUrl(), page, activePublication: active }, null, 2)}\n`,
    { mode: 0o600 }
  );

  await prisma.$transaction(async (tx) => {
    await tx.themePage.update({
      where: { id: page.id },
      data: { draftJson: nextJson, publishedJson: nextJson, updatedAt: new Date() }
    });
  }, { timeout: 120_000 });

  const snapshot = clone(active.snapshot);
  const targetPage = snapshot.pages.find((candidate) => candidate.slug === pageSlug);
  assert(targetPage, "Publication page readback failed");
  targetPage.publishedJson = nextJson;
  snapshot.snapshotHash = "";
  snapshot.revisions = { ...(snapshot.revisions ?? {}), snapshotHash: "" };
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "Repaired publication snapshot must be valid");

  const published = await publishSeoSnapshotRelational({
    siteId,
    snapshot,
    actor: "repair:mydreamshoots-video-directory",
    scope: { type: "page", pageIds: [page.id], includeThemeSettings: false, includeStorefrontProfile: false }
  });
  console.log(JSON.stringify({
    ok: true,
    page: pageSlug,
    publicationId: published.publication.id,
    version: published.publishedVersion,
    backupPath
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
