#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { aidreamshootsXbyThemeAltList } from "../src/lib/aidreamshoots-xby-seo-content.ts";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const siteId = "site_mydreamshoots_xby";
const repoRoot = process.cwd();
const apply = process.argv.includes("--apply");
const reportPath = path.resolve(repoRoot, "reports", `aidreamshoots-xby-seo-media-${apply ? "apply" : "dry-run"}-20260914.json`);

function cleanUrl(value) {
  return String(value || "").trim().split("?", 1)[0].split("#", 1)[0];
}

function storageKeyFromUrl(value) {
  const clean = cleanUrl(value);
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return storageKeyFromUrl(new URL(clean).pathname);
  return clean.replace(/^\/+/, "").replace(/^assets\//i, "");
}

function publicUrlForStorageKey(storageKey) {
  return `/assets/${storageKey.replace(/^\/+/, "")}`;
}

function mimeTypeFor(value) {
  const extension = path.extname(cleanUrl(value)).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".avif") return "image/avif";
  return "image/webp";
}

function mediaId(storageKey) {
  return `media_${siteId}_${crypto.createHash("sha256").update(storageKey).digest("hex").slice(0, 20)}`;
}

function parsePackImages(pack) {
  const gallery = Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((value) => typeof value === "string" && value.trim()) : [];
  assert(pack.imageUrl, `${pack.category}: missing cover image URL`);
  assert.equal(gallery.length, 12, `${pack.category}: expected 12 gallery image URLs, found ${gallery.length}`);
  return [pack.imageUrl, ...gallery];
}

function writeReport(value) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();

  const prisma = new PrismaClient();
  try {
    const packs = await prisma.creativePack.findMany({
      where: { siteId, status: "active" },
      select: {
        id: true,
        category: true,
        name: true,
        imageUrl: true,
        galleryImages: true,
        galleryImageAlts: true,
        categoryRecord: { select: { slug: true } }
      },
      orderBy: { category: "asc" }
    });
    assert.equal(packs.length, 39, `Expected 39 active XBY packs, found ${packs.length}`);

    const mediaRows = await prisma.mediaAsset.findMany({
      where: { siteId },
      select: { id: true, storageKey: true, altText: true, previewUrl: true, originUrl: true }
    });
    const mediaByKey = new Map(mediaRows.map((row) => [row.storageKey, row]));
    const backup = [];
    const changes = [];

    for (const pack of packs) {
      const slug = pack.categoryRecord?.slug || pack.category;
      const urls = parsePackImages(pack);
      const alts = aidreamshootsXbyThemeAltList(slug, 13);
      const media = urls.map((url, index) => {
        const storageKey = storageKeyFromUrl(url);
        const current = mediaByKey.get(storageKey);
        if (apply) {
          backup.push({ packId: pack.id, category: pack.category, index, url, storageKey, currentMedia: current ?? null });
        }
        return {
          index,
          url,
          storageKey,
          alt: alts[index],
          existingMediaId: current?.id ?? null,
          missing: !current
        };
      });
      changes.push({
        packId: pack.id,
        category: pack.category,
        slug,
        name: pack.name,
        imageCount: urls.length,
        altCount: alts.length,
        previousAltCount: Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts.length : 0,
        mediaMissing: media.filter((item) => item.missing).length,
        media
      });
    }

    const summary = {
      mode: apply ? "apply" : "dry-run",
      siteId,
      packCount: packs.length,
      imageCount: changes.reduce((sum, item) => sum + item.imageCount, 0),
      altCount: changes.reduce((sum, item) => sum + item.altCount, 0),
      missingMediaCount: changes.reduce((sum, item) => sum + item.mediaMissing, 0),
      reportPath,
      changes
    };
    writeReport(apply ? { ...summary, backup } : summary);
    console.log(JSON.stringify(summary, null, 2));

    if (!apply) return;

    const result = await prisma.$transaction(async (tx) => {
      let createdMedia = 0;
      let updatedMedia = 0;
      for (const change of changes) {
        await tx.creativePack.update({
          where: { id: change.packId },
          data: { galleryImageAlts: change.media.map((item) => item.alt) }
        });
        for (const item of change.media) {
          const publicUrl = publicUrlForStorageKey(item.storageKey);
          const media = await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId, storageKey: item.storageKey } },
            create: {
              id: mediaId(item.storageKey),
              siteId,
              label: item.alt,
              storageKey: item.storageKey,
              mimeType: mimeTypeFor(item.url),
              usageType: "package",
              sourceType: "xby-seo-media-repair",
              previewUrl: publicUrl,
              originUrl: publicUrl,
              altText: item.alt,
              notes: "Idempotent repair of CreativePack image association and Spanish SEO alt text."
            },
            update: {
              label: item.alt,
              mimeType: mimeTypeFor(item.url),
              altText: item.alt,
              previewUrl: publicUrl,
              originUrl: publicUrl,
              notes: "Idempotent repair of CreativePack image association and Spanish SEO alt text."
            }
          });
          if (!item.existingMediaId) createdMedia += 1;
          else if (media) updatedMedia += 1;
        }
      }
      return { packsUpdated: changes.length, createdMedia, updatedMedia };
    }, { timeout: 180_000 });
    console.log(JSON.stringify({ applied: true, ...result, snapshot: reportPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
