#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const apply = process.argv.includes("--apply");
const databaseTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();
if (databaseTarget === "production" && process.env.CONFIRM_SAVE_THE_DATE_PRODUCTION !== "1") {
  throw new Error("Production route migration requires CONFIRM_SAVE_THE_DATE_PRODUCTION=1.");
}
assertDatabaseTarget({
  expectedTarget: databaseTarget,
  env: process.env,
  requireProductionConfirmation: databaseTarget === "production",
  productionConfirmed: process.env.CONFIRM_SAVE_THE_DATE_PRODUCTION === "1"
});

const prisma = new PrismaClient();
const clone = (value) => JSON.parse(JSON.stringify(value ?? {}));
const routePrefixes = ["/holidays-events/", "/ai-video-generation/wedding-ceremony"];
const canonicalPrefix = "/ai-save-the-date/";

function canonicalPath(value) {
  if (typeof value !== "string") return value;
  const prefix = value.startsWith("/holidays-events/")
    ? "/holidays-events/"
    : (value === "/ai-video-generation/wedding-ceremony" || value.startsWith("/ai-video-generation/wedding-ceremony/"))
      ? "/ai-video-generation/"
      : "";
  if (!prefix) return value;
  const suffix = value.slice(prefix.length).replace(/^\/+|\/+$/g, "");
  return suffix ? `${canonicalPrefix}${suffix}` : value;
}

function replaceRoutes(value) {
  if (typeof value === "string") return canonicalPath(value);
  if (Array.isArray(value)) return value.map(replaceRoutes);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceRoutes(child)]));
}

try {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { pages: { orderBy: { slug: "asc" } }, settings: true }
  });
  if (!site) throw new Error(`Site not found: ${siteId}`);
  const candidates = site.pages.filter((page) => routePrefixes.some((prefix) => page.slug.startsWith(prefix)));
  const existing = new Set(site.pages.map((page) => page.slug));
  const changes = candidates.map((page) => ({
    id: page.id,
    from: page.slug,
    to: canonicalPath(page.slug),
    title: page.title
  }));
  for (const change of changes) {
    const collision = existing.has(change.to) && change.to !== change.from;
    if (collision) throw new Error(`Cannot migrate ${change.from}: target already exists (${change.to}).`);
  }

  const nextSettings = replaceRoutes(clone(site.settings?.draftJson || site.settings?.publishedJson || {}));
  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const page of candidates) {
        await tx.themePage.update({
          where: { id: page.id },
          data: {
            slug: canonicalPath(page.slug),
            draftJson: replaceRoutes(clone(page.draftJson)),
            publishedJson: replaceRoutes(clone(page.publishedJson))
          }
        });
      }
      if (site.settings) {
        await tx.themeSettings.update({ where: { siteId }, data: { draftJson: nextSettings } });
      }
    });
  }
  console.log(JSON.stringify({
    ok: true,
    siteId,
    mode: apply ? "applied-draft" : "dry-run",
    migratedPages: changes,
    settingsChanged: JSON.stringify(nextSettings) !== JSON.stringify(site.settings?.draftJson || site.settings?.publishedJson || {}),
    publicationRequired: apply
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
