#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const dateTag = String(args.date || "20260913");
const siteId = "site_mydreamshoots_xby";
const parentCategorySlug = "lifestyle-creative";
const generator = path.resolve(repoRoot, "scripts/regenerate-aidreamshoots-theme-media.mjs");
const categories = [
  "cyberpunk",
  "boudoir",
  "holiday",
  "cannes",
  "nightlife",
  "rich-lifestyle",
  "bikini",
  "swimsuit",
  "travel",
  "soccer",
  "urban",
  "street-style",
  "mafia"
];
const sourceDir = path.resolve(repoRoot, "releases/manifests");
const totalTasks = categories.length * 13;
// Keep the batch confirmation aligned with the reusable generator's paid-call guard.
const confirmation = "aidreamshoots-diverse-regeneration";

function parseArgs(list) {
  const result = {};
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equalsIndex = raw.indexOf("=");
    const key = (equalsIndex >= 0 ? raw.slice(0, equalsIndex) : raw).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equalsIndex >= 0) result[key] = raw.slice(equalsIndex + 1);
    else if (list[index + 1] && !list[index + 1].startsWith("--")) { result[key] = list[index + 1]; index += 1; }
    else result[key] = true;
  }
  return result;
}

function slugBatch(category) {
  return `aidreamshoots-lifestyle-creative-${category}-diverse-${dateTag}-v1`;
}

function sourceManifestPath(category) {
  return path.join(sourceDir, `aidreamshoots-lifestyle-creative-${category}-source-${dateTag}.json`);
}

function manifestPath(category) {
  return path.join(sourceDir, `${slugBatch(category)}.json`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function storageKeyFromPublicUrl(value) {
  const clean = String(value || "").split("?", 1)[0];
  const prefix = "/assets/sites/site_aidreamshoots/";
  assert(clean.startsWith(prefix), `Unexpected Aidreamshoots asset URL: ${value}`);
  return `sites/site_aidreamshoots/${clean.slice(prefix.length)}`;
}

function sourceTask(pack, index, url) {
  const isCover = index === 0;
  const filename = isCover ? `${pack.category}-cover.webp` : `${pack.category}-${String(index).padStart(2, "0")}.webp`;
  return {
    id: `source-${pack.category}-${String(index).padStart(2, "0")}`,
    mediaAssetId: null,
    label: filename,
    oldStorageKey: storageKeyFromPublicUrl(url),
    oldPreviewUrl: url,
    oldOriginUrl: null,
    oldAltText: null,
    contexts: [`creative-pack:${pack.id}:${isCover ? "cover" : `gallery[${index - 1}]`}`],
    references: [url],
    classification: { type: "lifestyle-creative", scene: pack.name },
    sourceFile: path.resolve(repoRoot, "public", storageKeyFromPublicUrl(url).replace(/^sites\//, "")),
    size: "1024x1024"
  };
}

function sourceManifest(pack) {
  const gallery = Array.isArray(pack.galleryImages) ? pack.galleryImages : [];
  assert(pack.imageUrl && gallery.length === 12, `${pack.category}: expected one cover and twelve gallery images.`);
  const urls = [pack.imageUrl, ...gallery];
  return {
    schemaVersion: 2,
    kind: "aidreamshoots-lifestyle-creative-source-inventory",
    mode: "source-inventory",
    batchId: `lifestyle-creative-source-${pack.category}-${dateTag}`,
    createdAt: new Date().toISOString(),
    sourceSite: { id: siteId, slug: "aidreamshoots", publicPrefix: "/assets/sites/site_aidreamshoots/" },
    targetSite: { id: siteId, slug: "aidreamshoots", domain: "aidreamshoots.eu", publicPrefix: "/assets/sites/site_aidreamshoots/", storagePrefix: "sites/site_aidreamshoots/" },
    filters: { parentCategory: parentCategorySlug, category: pack.category, packId: pack.id },
    targetPackId: pack.id,
    tasks: urls.map((url, index) => sourceTask(pack, index, url))
  };
}

function runGenerator(generatorMode, category) {
  const batch = slugBatch(category);
  const manifest = manifestPath(category);
  const source = sourceManifestPath(category);
  const commandArgs = [generator, `--mode=${generatorMode}`, `--theme=${category}`, `--batch=${batch}`, `--manifest=${manifest}`];
  if (generatorMode === "plan") commandArgs.push(`--source-manifest=${source}`);
  if (generatorMode === "generate") {
    commandArgs.push(`--confirm=${confirmation}`, "--quality=low", "--max-paid-attempts=13");
    const existing = fs.existsSync(manifest) ? readJson(manifest) : null;
    if (existing?.runtime && existing.runtime.succeeded < existing.tasks.length) commandArgs.push("--resume");
  }
  if (generatorMode === "apply") commandArgs.push(`--confirm=${confirmation}`);
  const result = spawnSync(process.execPath, commandArgs, { cwd: repoRoot, stdio: "inherit", env: process.env });
  assert.equal(result.status, 0, `${category}: ${generatorMode} failed with exit code ${result.status}`);
}

async function loadPacks() {
  assertDatabaseTarget({ expectedTarget: "local" });
  const prisma = new PrismaClient();
  try {
    const parent = await prisma.creativePackCategory.findFirst({ where: { siteId, slug: parentCategorySlug, status: "active" }, select: { id: true, slug: true, label: true } });
    assert(parent, `Missing active parent category ${parentCategorySlug}.`);
    const rows = await prisma.creativePack.findMany({
      where: { siteId, status: "active", categoryRecord: { parentId: parent.id } },
      select: { id: true, name: true, category: true, imageUrl: true, galleryImages: true },
      orderBy: { categoryRecord: { sortOrder: "asc" } }
    });
    const byCategory = new Map(rows.map((row) => [row.category, row]));
    assert.equal(rows.length, categories.length, `Expected ${categories.length} active lifestyle-creative packs, found ${rows.length}.`);
    return { parent, packs: categories.map((category) => {
      const pack = byCategory.get(category);
      assert(pack, `Missing active lifestyle-creative pack for ${category}.`);
      return pack;
    }) };
  } finally { await prisma.$disconnect(); }
}

async function main() {
  assert(["plan", "generate", "apply"].includes(mode), `Unsupported mode: ${mode}`);
  const { parent, packs } = await loadPacks();
  console.log(JSON.stringify({ mode, siteId, parent, categories, packs: packs.map((pack) => ({ id: pack.id, category: pack.category, name: pack.name })), totalThemes: categories.length, assetsPerTheme: 13, totalTasks, maxPaidCreateAttempts: totalTasks, noRetry: true, noFallback: true }, null, 2));

  if (mode === "plan") {
    for (const pack of packs) {
      writeJson(sourceManifestPath(pack.category), sourceManifest(pack));
      runGenerator("plan", pack.category);
    }
    return;
  }

  for (const pack of packs) assert(fs.existsSync(manifestPath(pack.category)), `${pack.category}: missing plan manifest; run --mode=plan first.`);
  if (mode === "generate") {
    for (const pack of packs) {
      const manifest = readJson(manifestPath(pack.category));
      if (manifest.runtime?.succeeded === manifest.tasks.length && manifest.diversityResult?.pass === true) {
        console.log(`skip ${pack.category}: generation and diversity gate already complete`);
        continue;
      }
      if (manifest.runtime?.succeeded === manifest.tasks.length && manifest.diversityResult?.pass === false) {
        console.log(`defer ${pack.category}: all paid tasks succeeded but diversity gate failed; no extra paid attempt in this approved batch`);
        continue;
      }
      runGenerator("generate", pack.category);
    }
    return;
  }

  for (const pack of packs) {
    const manifest = readJson(manifestPath(pack.category));
    assert(manifest.runtime?.paidCreateAttempts >= 13 && manifest.runtime?.succeeded === 13, `${pack.category}: expected all 13 logical assets completed before apply.`);
    assert(manifest.diversityResult?.pass === true, `${pack.category}: diversity gate did not pass.`);
  }
  for (const pack of packs) runGenerator("apply", pack.category);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
