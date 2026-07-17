#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const rootDir = process.cwd();

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const siteId = argValue("--site-id", "site_dreamshoot");
const fix = process.argv.includes("--fix");

function normalizedImageUrl(imageUrl) {
  return String(imageUrl || "").trim().split("?")[0];
}

function localPublicAssetPath(imageUrl) {
  const clean = normalizedImageUrl(imageUrl);
  if (!clean.startsWith("/assets/")) return "";
  return path.join(rootDir, "public", clean.replace(/^\//, ""));
}

function runtimeImageUrl(imageUrl) {
  const clean = normalizedImageUrl(imageUrl);
  if (!clean.startsWith("/assets/dreamshoot/") || !/\.png$/i.test(clean)) return clean;
  return clean.replace(/\.png$/i, ".webp");
}

function localPublicAssetMissing(imageUrl) {
  const assetPath = localPublicAssetPath(imageUrl);
  return Boolean(assetPath && !fs.existsSync(assetPath));
}

function runtimePublicAssetMissing(imageUrl) {
  const runtimeUrl = runtimeImageUrl(imageUrl);
  const assetPath = localPublicAssetPath(runtimeUrl);
  return Boolean(assetPath && !fs.existsSync(assetPath));
}

function duplicateGroups(items, imageKey = (item) => item.imageUrl) {
  const imageMap = new Map();
  for (const item of items) {
    const imageUrl = normalizedImageUrl(imageKey(item));
    if (!imageUrl) continue;
    imageMap.set(imageUrl, [...(imageMap.get(imageUrl) ?? []), item]);
  }
  return [...imageMap.entries()].filter(([, group]) => group.length > 1);
}

async function main() {
  const packs = await prisma.creativePack.findMany({
    where: { siteId, status: "active" },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, name: true, imageUrl: true }
  });
  const categories = await prisma.creativePackCategory.findMany({
    where: { siteId, status: "active" },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }],
    select: { id: true, slug: true, label: true, parentId: true, imageUrl: true }
  });
  const missing = packs.filter((pack) => !pack.imageUrl);
  const duplicates = duplicateGroups(packs);
  const missingPackFiles = packs.filter((pack) => pack.imageUrl && localPublicAssetMissing(pack.imageUrl));
  const missingPackRuntimeFiles = packs.filter((pack) => pack.imageUrl && runtimePublicAssetMissing(pack.imageUrl));
  const missingCategories = categories.filter((category) => !category.imageUrl);
  const duplicateCategories = duplicateGroups(categories);
  const missingCategoryFiles = categories.filter((category) => category.imageUrl && localPublicAssetMissing(category.imageUrl));
  const missingCategoryRuntimeFiles = categories.filter((category) => category.imageUrl && runtimePublicAssetMissing(category.imageUrl));

  if (fix) {
    for (const [, group] of duplicates) {
      for (const pack of group.slice(1)) {
        await prisma.creativePack.update({ where: { id: pack.id }, data: { imageUrl: null } });
      }
    }
  }

  const result = {
    ok: missing.length === 0 && duplicates.length === 0 && missingPackFiles.length === 0 && missingPackRuntimeFiles.length === 0 && missingCategories.length === 0 && duplicateCategories.length === 0 && missingCategoryFiles.length === 0 && missingCategoryRuntimeFiles.length === 0,
    siteId,
    packs: {
      active: packs.length,
      missing: missing.map((pack) => ({ id: pack.id, name: pack.name })),
      missingFiles: missingPackFiles.map((pack) => ({ id: pack.id, name: pack.name, imageUrl: pack.imageUrl })),
      missingRuntimeFiles: missingPackRuntimeFiles.map((pack) => ({ id: pack.id, name: pack.name, imageUrl: pack.imageUrl, runtimeImageUrl: runtimeImageUrl(pack.imageUrl) })),
      duplicates: duplicates.map(([imageUrl, group]) => ({
        imageUrl,
        packs: group.map((pack) => ({ id: pack.id, name: pack.name })),
        fixClears: fix ? group.slice(1).map((pack) => ({ id: pack.id, name: pack.name })) : []
      }))
    },
    categories: {
      active: categories.length,
      missing: missingCategories.map((category) => ({ id: category.id, slug: category.slug, label: category.label })),
      missingFiles: missingCategoryFiles.map((category) => ({ id: category.id, slug: category.slug, label: category.label, imageUrl: category.imageUrl })),
      missingRuntimeFiles: missingCategoryRuntimeFiles.map((category) => ({ id: category.id, slug: category.slug, label: category.label, imageUrl: category.imageUrl, runtimeImageUrl: runtimeImageUrl(category.imageUrl) })),
      duplicates: duplicateCategories.map(([imageUrl, group]) => ({
        imageUrl,
        categories: group.map((category) => ({ id: category.id, slug: category.slug, label: category.label }))
      }))
    }
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok && !fix) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
