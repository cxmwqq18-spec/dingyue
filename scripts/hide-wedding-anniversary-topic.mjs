#!/usr/bin/env node
import "./load-runtime-env.mjs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = process.env.WEDDING_ANNIVERSARY_SITE_ID || "site_dreamshoot";
const apply = process.argv.includes("--apply");
const databaseTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();
if (databaseTarget === "production" && process.env.CONFIRM_WEDDING_ANNIVERSARY_HIDE !== "1") {
  throw new Error("Production hide requires CONFIRM_WEDDING_ANNIVERSARY_HIDE=1.");
}
assertDatabaseTarget({
  expectedTarget: databaseTarget,
  env: process.env,
  requireProductionConfirmation: databaseTarget === "production",
  productionConfirmed: process.env.CONFIRM_WEDDING_ANNIVERSARY_HIDE === "1"
});

const sourceRoot = path.join(process.cwd(), "src");
const originalLoad = Module._load;
Module._load = function load(request, ...args) { if (request === "server-only") return {}; return originalLoad.call(this, request, ...args); };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased;
  return originalResolve.call(this, resolved, ...args);
};

const prisma = new PrismaClient();
const hiddenPath = "/holidays-events/wedding-anniversary";
try {
  const settingsRecord = await prisma.themeSettings.findUnique({ where: { siteId } });
  if (!settingsRecord) throw new Error(`Missing theme settings for ${siteId}`);
  const settings = structuredClone(settingsRecord.draftJson || settingsRecord.publishedJson || {});
  const navigation = settings.saveTheDateNavigation;
  if (!navigation?.groups) throw new Error("Missing saveTheDateNavigation groups");
  const before = navigation.groups.flatMap((group) => group.items || []).filter((item) => item.href === hiddenPath).length;
  for (const group of navigation.groups) {
    group.items = (group.items || [])
      .filter((item) => item.href !== hiddenPath)
      .map((item, index) => ({ ...item, sortOrder: index + 1 }));
  }
  const page = await prisma.themePage.findFirst({ where: { siteId, slug: hiddenPath } });
  if (!page) throw new Error(`Missing page for ${hiddenPath}`);
  const pageJson = structuredClone(page.draftJson || page.publishedJson || {});
  pageJson.seo = {
    ...(pageJson.seo || {}),
    index: false,
    follow: true,
    robots: { ...(pageJson.seo?.robots || {}), index: false, follow: true, maxImagePreview: "large" }
  };
  if (apply) {
    await prisma.$transaction(async (tx) => {
      await tx.themeSettings.update({ where: { siteId }, data: { draftJson: settings } });
      await tx.themePage.update({ where: { id: page.id }, data: { draftJson: pageJson } });
    });
  }
  const jiti = createJiti(import.meta.url);
  const { prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({ ok: true, siteId, mode: apply ? "draft-only" : "dry-run", hiddenPath, removedItems: before, pageSeoIndex: pageJson.seo.index, manifestHash: manifest.manifestHash, publicationRequired: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
