#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const siteId = "site_grownstride_test";
const version = process.env.TEST_ASSET_VERSION?.trim() || "20260822testasset2";
const apply = process.argv.includes("--apply");

assertDatabaseTarget({ expectedTarget: "test" });
if (apply) assertNonProductionWriteTarget();

function isPublicAsset(value) {
  return typeof value === "string" && (
    value.startsWith("/assets/dreamshoot/") ||
    value.startsWith(`/assets/sites/${siteId}/`)
  );
}

function refresh(value) {
  if (Array.isArray(value)) return value.map(refresh);
  if (!value || typeof value !== "object") {
    if (!isPublicAsset(value)) return value;
    const [pathname, query = ""] = value.split("?");
    const params = new URLSearchParams(query);
    params.set("v", version);
    return `${pathname}?${params.toString()}`;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, refresh(item)]));
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

const prisma = new PrismaClient();
try {
  const [pages, settings, packs, videoThemes] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId }, select: { id: true, slug: true, draftJson: true, publishedJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId }, select: { id: true, draftJson: true, publishedJson: true } }),
    prisma.creativePack.findMany({ where: { siteId }, select: { id: true, imageUrl: true, galleryImages: true } }),
    prisma.videoTheme.findMany({ where: { siteId }, select: { id: true, imageUrl: true, galleryImages: true } })
  ]);

  const pageUpdates = pages.map((row) => ({
    ...row,
    draftJson: refresh(row.draftJson),
    publishedJson: row.publishedJson
  })).filter((row) => changed(pages.find((item) => item.id === row.id), row));
  const settingsUpdate = settings ? {
    ...settings,
    draftJson: refresh(settings.draftJson),
    publishedJson: settings.publishedJson
  } : null;
  const packUpdates = packs.map((row) => ({ ...row, imageUrl: refresh(row.imageUrl), galleryImages: refresh(row.galleryImages) }))
    .filter((row) => changed(packs.find((item) => item.id === row.id), row));
  const videoUpdates = videoThemes.map((row) => ({ ...row, imageUrl: refresh(row.imageUrl), galleryImages: refresh(row.galleryImages) }))
    .filter((row) => changed(videoThemes.find((item) => item.id === row.id), row));

  const summary = {
    ok: true,
    mode: apply ? "applied" : "dry-run",
    siteId,
    version,
    pages: pageUpdates.length,
    settings: settingsUpdate && changed(settings, settingsUpdate) ? 1 : 0,
    creativePacks: packUpdates.length,
    videoThemes: videoUpdates.length
  };
  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const row of pageUpdates) {
        await tx.themePage.update({ where: { id: row.id }, data: { draftJson: row.draftJson, updatedAt: new Date() } });
      }
      if (settingsUpdate && changed(settings, settingsUpdate)) {
        await tx.themeSettings.update({ where: { id: settingsUpdate.id }, data: { draftJson: settingsUpdate.draftJson, updatedAt: new Date() } });
      }
      for (const row of packUpdates) {
        await tx.creativePack.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, galleryImages: row.galleryImages, updatedAt: new Date() } });
      }
      for (const row of videoUpdates) {
        await tx.videoTheme.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, galleryImages: row.galleryImages, updatedAt: new Date() } });
      }
    }, { timeout: 120_000 });
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
