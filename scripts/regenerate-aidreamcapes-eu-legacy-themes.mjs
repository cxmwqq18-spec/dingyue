#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const siteId = "site_aidreamcapes_xby";
const assetSiteSlug = "site_aidreamcapes_eu";
const providerId = "aiprov_image4_mysub2api";
const expectedConfirmation = "aidreamcapes-eu-legacy-regeneration";
const batchId = String(args.batch || "aidreamcapes-eu-legacy-diverse-20260914-v1");
const root = path.resolve(".tmp", "aidreamcapes-eu-legacy-regeneration", batchId);
const manifestRoot = path.join(root, "manifests");
const backupPath = path.join(root, `${batchId}-apply-backup.json`);
const generatorPath = path.resolve("scripts/regenerate-aidreamshoots-theme-media.mjs");
const maxPaidCreateAttempts = 169;
const legacySlugs = [
  "motion-generator",
  "background-remover",
  "color-correction",
  "edit-by-prompt",
  "hairstyle-generator",
  "magic-eraser",
  "old-photo-restoration",
  "portrait-retouch",
  "background-changer",
  "social-cards",
  "unblur-image",
  "photo-enhancer",
  "virtual-try-on"
];

function parseArgs(list) {
  const result = {};
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equals = raw.indexOf("=");
    const rawKey = equals >= 0 ? raw.slice(0, equals) : raw;
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equals >= 0) result[key] = raw.slice(equals + 1);
    else {
      const next = list[index + 1];
      if (!next || next.startsWith("--")) result[key] = true;
      else { result[key] = next; index += 1; }
    }
  }
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function manifestPath(slug) {
  return path.join(manifestRoot, `${slug}.json`);
}

function slugForManifest(manifest) {
  const slug = legacySlugs.find((candidate) => manifest.batchId === `${batchId}-${candidate}`);
  assert(slug, `Manifest is not part of batch ${batchId}: ${manifest.batchId}`);
  return slug;
}

function safePublicUrl(value) {
  const url = String(value || "").trim();
  assert(url.startsWith(`/assets/sites/${assetSiteSlug}/`), `Unexpected EU source URL: ${url}`);
  return url;
}

async function loadLegacyPacks(prisma) {
  const packs = await prisma.creativePack.findMany({
    where: { siteId, status: "active", categoryRecord: { slug: { in: legacySlugs } } },
    include: { categoryRecord: true },
    orderBy: { id: "asc" }
  });
  const bySlug = new Map();
  for (const pack of packs) {
    const slug = String(pack.categoryRecord?.slug || "").toLowerCase();
    assert(legacySlugs.includes(slug), `Unexpected legacy pack slug: ${slug}`);
    assert(!bySlug.has(slug), `Multiple active legacy packs for slug: ${slug}`);
    bySlug.set(slug, pack);
  }
  assert.equal(bySlug.size, legacySlugs.length, `Expected ${legacySlugs.length} active legacy EU packs.`);
  return bySlug;
}

function sourceManifestFor(slug, pack) {
  const cover = safePublicUrl(pack.imageUrl);
  const gallery = Array.isArray(pack.galleryImages) ? pack.galleryImages.map(safePublicUrl) : [];
  assert.equal(gallery.length, 12, `${slug}: expected twelve existing gallery references.`);
  const references = [cover, ...gallery];
  return {
    schemaVersion: 1,
    kind: "aidreamcapes-eu-legacy-source-references",
    batchId: `${batchId}-source`,
    createdAt: new Date().toISOString(),
    targetSite: siteId,
    targetSiteSlug: assetSiteSlug,
    filters: { siteId, status: "active", categorySlug: slug },
    sourceAssetsAreReferencesOnly: true,
    tasks: references.map((reference, index) => {
      const isCover = index === 0;
      const fileName = isCover ? `${slug}-cover.webp` : `${slug}-${String(index).padStart(2, "0")}.webp`;
      return {
        id: `${batchId}-source-${slug}-${isCover ? "cover" : String(index).padStart(2, "0")}`,
        label: fileName,
        oldStorageKey: reference.replace(/^\/assets\//, "sites/"),
        oldReferences: [reference],
        references: [reference],
        contexts: [`creative-pack:${pack.id}:${isCover ? "cover" : `gallery-${String(index).padStart(2, "0")}`}`],
        targetPackId: pack.id,
        status: "source-reference"
      };
    })
  };
}

function runGenerator(slug, generatorMode) {
  const batch = `${batchId}-${slug}`;
  const sourcePath = path.join(root, "sources", `${slug}.json`);
  const outputManifest = manifestPath(slug);
  const generatorArgs = [
    generatorPath,
    `--mode=${generatorMode}`,
    `--theme=${slug}`,
    `--batch=${batch}`,
    `--manifest=${outputManifest}`,
    `--source-manifest=${sourcePath}`,
    `--target-site-id=${siteId}`,
    `--asset-site-slug=${assetSiteSlug}`,
    "--storefront-name=Aidreamcapes",
    "--locale=fr",
    `--provider-id=${providerId}`,
    `--expected-confirmation=${expectedConfirmation}`,
    "--quality=high",
    "--resolution=4K",
    "--cache-version=20260914eulegacy1"
  ];
  if (generatorMode === "generate") {
    generatorArgs.push(`--confirm=${expectedConfirmation}`, "--max-paid-attempts=13");
  }
  const result = spawnSync(process.execPath, generatorArgs, { cwd: repoRoot, env: process.env, stdio: "inherit" });
  assert.equal(result.status, 0, `Generator failed for ${slug} in ${generatorMode} mode.`);
}

async function plan() {
  assertDatabaseTarget({ expectedTarget: "local" });
  const prisma = new PrismaClient();
  try {
    const packs = await loadLegacyPacks(prisma);
    for (const slug of legacySlugs) {
      const sourcePath = path.join(root, "sources", `${slug}.json`);
      writeJson(sourcePath, sourceManifestFor(slug, packs.get(slug)));
      runGenerator(slug, "plan");
    }
    const manifests = legacySlugs.map((slug) => readJson(manifestPath(slug)));
    assert.equal(manifests.reduce((sum, manifest) => sum + manifest.tasks.length, 0), maxPaidCreateAttempts);
    assert.equal(new Set(manifests.flatMap((manifest) => manifest.tasks.map((task) => task.prompt))).size, maxPaidCreateAttempts, "All 169 prompts must be unique.");
    assert.equal(new Set(manifests.flatMap((manifest) => manifest.tasks.map((task) => task.artDirection))).size, maxPaidCreateAttempts, "All 169 art directions must be unique.");
    assert.equal(new Set(manifests.flatMap((manifest) => manifest.tasks.map((task) => task.altText))).size, maxPaidCreateAttempts, "All 169 alts must be unique.");
    writeJson(path.join(root, "plan-summary.json"), { batchId, siteId, providerId, maxPaidCreateAttempts, themes: legacySlugs, generatedAt: new Date().toISOString() });
    console.log(JSON.stringify({ ok: true, mode: "plan", batchId, themes: legacySlugs.length, tasks: maxPaidCreateAttempts, providerId, model: "gpt-image-2", paidAttempts: 0 }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function allManifests() {
  const manifests = legacySlugs.map((slug) => readJson(manifestPath(slug)));
  assert.equal(manifests.length, 13);
  for (const manifest of manifests) {
    assert.equal(manifest.tasks.length, 13);
    assert.equal(manifest.provider.id, providerId);
    assert.equal(manifest.provider.model, "gpt-image-2");
    assert.equal(manifest.provider.attemptsPerCreate, 1);
    assert.equal(manifest.provider.fallback, "disabled");
    assert.equal(manifest.safety.maxPaidCreateAttempts, 13);
  }
  return manifests;
}

async function generate() {
  assertDatabaseTarget({ expectedTarget: "local" });
  assert.equal(maxPaidCreateAttempts, 169);
  const manifests = allManifests();
  let paidAttempts = 0;
  for (const manifest of manifests) {
    const completed = manifest.runtime?.paidCreateAttempts === 13 &&
      manifest.runtime?.succeeded === 13 &&
      manifest.runtime?.failed === 0 &&
      manifest.diversityResult?.pass === true;
    if (completed) {
      console.log(`skip completed ${slugForManifest(manifest)} (13 paid requests already recorded)`);
      continue;
    }
    assert(!manifest.runtime || (manifest.runtime.paidCreateAttempts ?? 0) === 0, `${manifest.batchId}: refusing to resume a partial paid batch.`);
    assert(paidAttempts + 13 <= maxPaidCreateAttempts, "Global paid create cap exceeded.");
    runGenerator(slugForManifest(manifest), "generate");
    paidAttempts += 13;
  }
  const completed = allManifests();
  assert(completed.every((manifest) => manifest.runtime?.paidCreateAttempts === 13 && manifest.runtime?.succeeded === 13 && manifest.diversityResult?.pass === true), "Not all legacy manifests passed generation and diversity gates.");
  console.log(JSON.stringify({ ok: true, mode: "generate", batchId, paidCreateAttempts: paidAttempts, maxPaidCreateAttempts }, null, 2));
}

async function validateStaged(manifests) {
  const staged = [];
  for (const manifest of manifests) {
    assert(manifest.runtime?.succeeded === 13 && manifest.runtime?.failed === 0, `${manifest.batchId}: generation incomplete.`);
    assert(manifest.diversityResult?.pass === true, `${manifest.batchId}: diversity gate failed.`);
    for (const task of manifest.tasks) {
      assert(fs.existsSync(task.stageFile), `Missing staged file: ${task.stageFile}`);
      const buffer = fs.readFileSync(task.stageFile);
      const metadata = await sharp(buffer).metadata();
      const expected = task.outputProfile === "4K"
        ? [2896, 2172]
        : (task.isCover ? [1280, 960] : [1024, 1024]);
      assert.equal(metadata.width, expected[0], `${task.id}: width mismatch.`);
      assert.equal(metadata.height, expected[1], `${task.id}: height mismatch.`);
      assert(buffer.length > 1024, `${task.id}: staged file is unexpectedly small.`);
      staged.push({ manifest, task, sha: sha256(buffer) });
    }
  }
  assert.equal(staged.length, maxPaidCreateAttempts);
  assert.equal(new Set(staged.map((item) => item.sha)).size, maxPaidCreateAttempts, "SHA-256 duplicate found across the 169 staged files.");
  for (const manifest of manifests) {
    const cover = manifest.tasks.find((task) => task.isCover);
    const gallery = manifest.tasks.filter((task) => !task.isCover);
    assert(cover && gallery.length === 12, `${manifest.batchId}: cover/gallery count mismatch.`);
    assert(!gallery.some((task) => task.outputHash === cover.outputHash), `${manifest.batchId}: cover is reused in gallery.`);
  }
  return staged;
}

function atomicCopy(source, target) {
  assert(!fs.existsSync(target), `Refusing to overwrite existing staged batch asset: ${target}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const pending = `${target}.pending`;
  fs.copyFileSync(source, pending);
  fs.renameSync(pending, target);
}

async function apply() {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  const manifests = allManifests();
  await validateStaged(manifests);
  const prisma = new PrismaClient();
  try {
    const packs = await loadLegacyPacks(prisma);
    const backup = { createdAt: new Date().toISOString(), target: "local", siteId, batchId, packs: [] };
    for (const slug of legacySlugs) {
      const pack = packs.get(slug);
      backup.packs.push({ id: pack.id, categoryId: pack.categoryId, imageUrl: pack.imageUrl, galleryImages: pack.galleryImages, galleryImageAlts: pack.galleryImageAlts, headline: pack.headline, description: pack.description, categoryRecord: pack.categoryRecord });
    }
    writeJson(backupPath, backup);

    const updates = [];
    for (const manifest of manifests) {
      const slug = slugForManifest(manifest);
      const pack = packs.get(slug);
      assert(pack, `No pack found for ${slug}.`);
      assert(pack.siteId === siteId);
      const cover = manifest.tasks.find((task) => task.isCover);
      const gallery = manifest.tasks.filter((task) => !task.isCover).sort((a, b) => a.slotIndex - b.slotIndex);
      const url = (task) => `${task.publicUrl}?v=20260914eulegacy1`;
      const nextPack = { imageUrl: url(cover), galleryImages: gallery.map(url), galleryImageAlts: [cover, ...gallery].map((task) => task.altText) };
      assert(!nextPack.galleryImages.includes(nextPack.imageUrl));
      updates.push({ slug, pack, manifest, cover, gallery, nextPack });
    }
    for (const item of updates) {
      for (const task of item.manifest.tasks) {
        atomicCopy(task.stageFile, task.finalFile);
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const item of updates) {
        if (item.pack.categoryRecord) await tx.creativePackCategory.update({ where: { id: item.pack.categoryRecord.id }, data: { imageUrl: item.nextPack.imageUrl } });
        await tx.creativePack.update({ where: { id: item.pack.id }, data: item.nextPack });
        for (const task of [item.cover, ...item.gallery]) {
          const storageKey = task.outputRelative;
          const mediaId = `media_${siteId}_${sha256(storageKey).slice(0, 16)}`;
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId, storageKey } },
            create: { id: mediaId, siteId, label: task.altText, storageKey, mimeType: "image/webp", usageType: "package", sourceType: "ai-diverse-regeneration", previewUrl: `${task.publicUrl}?v=20260914eulegacy1`, originUrl: `${task.publicUrl}?v=20260914eulegacy1`, altText: task.altText },
            update: { label: task.altText, mimeType: "image/webp", usageType: "package", sourceType: "ai-diverse-regeneration", previewUrl: `${task.publicUrl}?v=20260914eulegacy1`, originUrl: `${task.publicUrl}?v=20260914eulegacy1`, altText: task.altText }
          });
        }
      }
    }, { timeout: 120_000 });

    const readback = await prisma.creativePack.findMany({ where: { siteId, id: { in: updates.map((item) => item.pack.id) } }, select: { id: true, imageUrl: true, galleryImages: true, galleryImageAlts: true } });
    const byId = new Map(readback.map((row) => [row.id, row]));
    for (const item of updates) {
      const row = byId.get(item.pack.id);
      assert.deepEqual(row?.galleryImages, item.nextPack.galleryImages, `${item.slug}: gallery readback failed.`);
      assert.equal(row?.imageUrl, item.nextPack.imageUrl, `${item.slug}: cover readback failed.`);
      assert.deepEqual(row?.galleryImageAlts, item.nextPack.galleryImageAlts, `${item.slug}: alt readback failed.`);
      assert(item.nextPack.galleryImages.every((url) => url.startsWith(`/assets/sites/${assetSiteSlug}/generated/regenerated/`)));
    }
    for (const item of updates) {
      const manifest = readJson(manifestPath(item.slug));
      manifest.mode = "applied";
      manifest.apply = { target: "local", appliedAt: new Date().toISOString(), backupPath, generated: 13, protectedChanged: false, unrelatedChanged: false };
      writeJson(manifestPath(item.slug), manifest);
    }
    writeJson(path.join(root, "apply-summary.json"), { ok: true, batchId, siteId, appliedThemes: legacySlugs, generated: maxPaidCreateAttempts, backupPath, appliedAt: new Date().toISOString() });
    console.log(JSON.stringify({ ok: true, mode: "apply", batchId, appliedThemes: legacySlugs.length, generated: maxPaidCreateAttempts, backupPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assert(["plan", "generate", "apply"].includes(mode), `Unsupported mode: ${mode}`);
  if (mode === "plan") await plan();
  else if (mode === "generate") await generate();
  else await apply();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
