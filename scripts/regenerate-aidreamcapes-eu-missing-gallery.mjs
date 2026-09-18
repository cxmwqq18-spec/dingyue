#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "run").toLowerCase();
const siteId = "site_aidreamcapes_xby";
const assetSiteSlug = "site_aidreamcapes_eu";
const providerId = "aiprov_image4_mysub2api";
const model = "gpt-image-2";
const expectedConfirmation = "aidreamcapes-eu-missing-gallery-regeneration";
const sourceBatchId = "aidreamcapes-eu-legacy-diverse-20260914-v1";
const batchId = String(args.batch || "aidreamcapes-eu-missing-gallery-20260914-v1");
const cacheVersion = String(args.cacheVersion || args["cache-version"] || "20260914eumissing1");
const maxPaidCreateAttempts = 6;
const maxCreateTimeoutMs = Number(args.timeoutMs || 300_000);
const missingSlugs = [
  "background-changer",
  "photo-enhancer",
  "portrait-retouch",
  "social-cards",
  "unblur-image",
  "virtual-try-on"
];
const reusableSlugs = [
  "background-remover",
  "color-correction",
  "edit-by-prompt",
  "hairstyle-generator",
  "magic-eraser",
  "motion-generator",
  "old-photo-restoration"
];
const allSlugs = [...reusableSlugs, ...missingSlugs];
const root = path.resolve(".tmp", "aidreamcapes-eu-missing-gallery-regeneration", batchId);
const manifestPath = path.join(root, "manifest.json");
const backupPath = path.join(root, `${batchId}-apply-backup.json`);
const outputRoot = path.join(root, "outputs");
const finalRoot = path.resolve("public/assets/sites", assetSiteSlug, "generated/regenerated", batchId);
const finalPublicRoot = `/assets/sites/${assetSiteSlug}/generated/regenerated/${batchId}`;
const sourceManifestRoot = path.resolve(".tmp", "aidreamcapes-eu-legacy-regeneration", sourceBatchId, "manifests");

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

function normalizeBaseUrl(value) {
  let normalized = String(value || "").trim();
  while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized.endsWith("/v1") ? normalized : `${normalized}/v1`;
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json
    ?? body?.data?.[0]?.image_base64
    ?? body?.output?.[0]?.b64_json
    ?? body?.output?.[0]?.image_base64
    ?? body?.image_base64;
}

function redactedBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => {
    if (/(?:b64|base64)/i.test(key) && typeof value === "string") return `[omitted:${value.length}]`;
    return value;
  }));
}

function atomicCopy(source, target) {
  assert(fs.existsSync(source), `Missing staged source: ${source}`);
  assert(!fs.existsSync(target), `Refusing to overwrite existing batch asset: ${target}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const pending = `${target}.pending`;
  fs.copyFileSync(source, pending);
  fs.renameSync(pending, target);
}

function sourceTaskFor(slug) {
  const filePath = path.join(sourceManifestRoot, `${slug}.json`);
  assert(fs.existsSync(filePath), `Missing planned source manifest: ${filePath}`);
  const manifest = readJson(filePath);
  const task = manifest.tasks?.find((candidate) => candidate.slotIndex === 1);
  assert(task, `${slug}: missing planned slot 01 task.`);
  return task;
}

function plannedTask(slug, sourceTask, sourceKind) {
  const filename = `${slug}-01-${sha256(`${batchId}:${slug}:${sourceTask.prompt}`).slice(0, 12)}.webp`;
  return {
    id: `${batchId}-${slug}-01`,
    slug,
    slotIndex: 1,
    sourceKind,
    sourceTaskId: sourceTask.id,
    targetPackId: sourceTask.targetPackId,
    prompt: sourceTask.prompt,
    artDirection: sourceTask.artDirection,
    altText: sourceTask.altText,
    filename,
    stageFile: path.join(outputRoot, filename),
    outputRelative: path.posix.join("sites", assetSiteSlug, "generated/regenerated", batchId, filename),
    publicUrl: `${finalPublicRoot}/${filename}`,
    finalFile: path.join(finalRoot, filename),
    status: sourceKind === "staged-reuse" ? "staged-reuse" : "planned",
    providerRequestId: "",
    error: ""
  };
}

function buildPlan() {
  const tasks = allSlugs.map((slug) => {
    const sourceTask = sourceTaskFor(slug);
    return plannedTask(slug, sourceTask, missingSlugs.includes(slug) ? "provider-create" : "staged-reuse");
  });
  assert.equal(tasks.length, 13);
  assert.equal(new Set(tasks.map((task) => task.prompt)).size, 13, "Missing-gallery prompts must remain unique.");
  return {
    schemaVersion: 1,
    kind: "aidreamcapes-eu-missing-gallery-regeneration",
    mode: "planned",
    batchId,
    sourceBatchId,
    targetSite: siteId,
    targetSiteSlug: assetSiteSlug,
    provider: {
      id: providerId,
      model,
      endpoint: "",
      quality: "high",
      size: "1024x1024",
      attemptsPerCreate: 1,
      noAutomaticRetry: true,
      noProviderFallback: true
    },
    safety: {
      maxPaidCreateAttempts,
      selectedPaidCreateAttempts: missingSlugs.length,
      newPaidCreates: missingSlugs.length,
      reusedStagedOutputs: reusableSlugs.length
    },
    tasks
  };
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({ where: { id: providerId } });
    assert(provider?.enabled && provider.apiKey && provider.aiUrl, `Configured provider ${providerId} is not ready.`);
    assert.equal(provider.providerType, "image", `Configured provider ${providerId} is not an image provider.`);
    assert.equal(provider.modelType, model, `Configured provider ${providerId} is not configured for ${model}.`);
    return { id: provider.id, label: provider.label, baseUrl: normalizeBaseUrl(provider.aiUrl), apiKey: provider.apiKey, model: provider.modelType };
  } finally {
    await prisma.$disconnect();
  }
}

async function readOnlyProviderChecks(provider) {
  const modelsResponse = await fetch(`${provider.baseUrl}/models`, {
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    signal: AbortSignal.timeout(30_000)
  });
  assert(modelsResponse.ok, `Provider model check failed with ${modelsResponse.status}.`);
  const modelsBody = await modelsResponse.json().catch(() => ({}));
  const modelIds = Array.isArray(modelsBody.data) ? modelsBody.data.map((item) => String(item.id || "")) : [];
  assert(modelIds.includes(provider.model), `Provider model list does not include ${provider.model}.`);

  let usage = { status: "unavailable" };
  try {
    const usageResponse = await fetch(`${provider.baseUrl}/usage`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(30_000)
    });
    const usageBody = await usageResponse.json().catch(() => ({}));
    usage = {
      status: usageResponse.status,
      remaining: usageBody.remaining ?? usageBody.balance ?? null,
      totalActualCost: usageBody.usage?.total?.actual_cost ?? null,
      currency: usageBody.currency ?? null
    };
  } catch (error) {
    usage = { status: "error", error: error instanceof Error ? error.message : String(error) };
  }
  return { modelsStatus: modelsResponse.status, configuredModelListed: true, usage };
}

async function generateMissing(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Generation requires --confirm=${expectedConfirmation}.`);
  assert.equal(Number(args.maxPaidAttempts || maxPaidCreateAttempts), maxPaidCreateAttempts, `This batch is capped at exactly ${maxPaidCreateAttempts} paid creates.`);
  const provider = await loadProvider();
  const checks = await readOnlyProviderChecks(provider);
  manifest.provider = { ...manifest.provider, label: provider.label, endpoint: `${provider.baseUrl}/images/generations`, readOnlyChecks: checks };
  manifest.runtime = { paidCreateAttempts: 0, succeeded: 0, failed: 0, startedAt: new Date().toISOString(), providerRequestIds: [] };
  fs.mkdirSync(outputRoot, { recursive: true });
  writeJson(manifestPath, manifest);
  console.log(JSON.stringify({ operation: "paid-create", endpoint: manifest.provider.endpoint, model: provider.model, quality: "high", size: "1024x1024", maxPaidCreateAttempts, selectedPaidCreateAttempts: missingSlugs.length, attemptsPerCreate: 1, retry: false, fallback: false, readOnlyChecks: checks }, null, 2));

  for (const task of manifest.tasks.filter((candidate) => candidate.sourceKind === "provider-create")) {
    const idempotencyKey = `${expectedConfirmation}:${manifest.batchId}:${task.id}`;
    const startedAt = Date.now();
    let response;
    let body = {};
    try {
      response = await fetch(`${provider.baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
          "Idempotency-Key": idempotencyKey,
          "X-Client-Request-Id": task.id
        },
        body: JSON.stringify({ model: provider.model, prompt: task.prompt, size: "1024x1024", quality: "high", response_format: "b64_json" }),
        signal: AbortSignal.timeout(maxCreateTimeoutMs)
      });
      body = await response.json().catch(() => ({}));
    } catch (error) {
      task.status = "unknown_provider_state";
      task.error = error instanceof Error ? error.message : String(error);
      manifest.runtime.failed += 1;
      writeJson(manifestPath, manifest);
      throw new Error(`${task.id}: ambiguous provider state; stopped without retry: ${task.error}`);
    }

    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
    manifest.runtime.paidCreateAttempts += 1;
    writeJson(path.join(root, `${task.id}-provider.json`), {
      taskId: task.id,
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.model,
      endpoint: `${provider.baseUrl}/images/generations`,
      idempotencyKey,
      clientRequestId: task.id,
      requestId,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      response: redactedBody(body),
      retryPolicy: "no-retry"
    });
    if (!response.ok) {
      task.status = "failed";
      task.error = `provider_status_${response.status}`;
      manifest.runtime.failed += 1;
      writeJson(manifestPath, manifest);
      throw new Error(`${task.id}: provider create failed with ${response.status}; stopped without retry.`);
    }
    const encoded = imagePayload(body);
    assert(encoded, `${task.id}: provider returned no image payload.`);
    const buffer = Buffer.from(encoded, "base64");
    await sharp(buffer)
      .rotate()
      .resize(1024, 1024, { fit: "cover", position: "attention" })
      .webp({ quality: 92, smartSubsample: true })
      .toFile(task.stageFile);
    const outputBuffer = fs.readFileSync(task.stageFile);
    const metadata = await sharp(outputBuffer).metadata();
    assert.equal(metadata.width, 1024, `${task.id}: unexpected output width.`);
    assert.equal(metadata.height, 1024, `${task.id}: unexpected output height.`);
    task.outputHash = sha256(outputBuffer);
    task.outputBytes = outputBuffer.length;
    task.providerRequestId = requestId;
    task.status = "succeeded";
    task.error = "";
    manifest.runtime.succeeded += 1;
    manifest.runtime.providerRequestIds.push({ taskId: task.id, requestId });
    writeJson(manifestPath, manifest);
    console.log(`succeeded ${task.slug} (${manifest.runtime.succeeded}/${missingSlugs.length})`);
  }
  assert.equal(manifest.runtime.paidCreateAttempts, maxPaidCreateAttempts);
  assert.equal(manifest.runtime.succeeded, missingSlugs.length);
  manifest.runtime.completedAt = new Date().toISOString();
  writeJson(manifestPath, manifest);
}

async function loadActivePacks(prisma) {
  const packs = await prisma.creativePack.findMany({
    where: { siteId, status: "active", categoryRecord: { slug: { in: allSlugs } } },
    include: { categoryRecord: true },
    orderBy: { id: "asc" }
  });
  const bySlug = new Map(packs.map((pack) => [String(pack.categoryRecord?.slug || "").toLowerCase(), pack]));
  assert.equal(bySlug.size, allSlugs.length, `Expected ${allSlugs.length} active EU packs.`);
  return bySlug;
}

async function prepareTasks(manifest) {
  for (const task of manifest.tasks) {
    if (task.sourceKind === "staged-reuse") {
      const source = sourceTaskFor(task.slug);
      assert.equal(source.status, "succeeded", `${task.slug}: staged source is not successful.`);
      assert(fs.existsSync(source.stageFile), `${task.slug}: staged source file is missing.`);
      task.sourceStageFile = source.stageFile;
      const buffer = fs.readFileSync(source.stageFile);
      task.outputHash = sha256(buffer);
      task.outputBytes = buffer.length;
      task.status = "staged-reuse";
    }
    assert(fs.existsSync(task.sourceStageFile || task.stageFile), `${task.slug}: missing staged gallery-01 output.`);
    const outputPath = task.sourceStageFile || task.stageFile;
    const metadata = await sharp(outputPath).metadata();
    assert.equal(metadata.width, 1024, `${task.slug}: gallery width mismatch.`);
    assert.equal(metadata.height, 1024, `${task.slug}: gallery height mismatch.`);
  }
  const hashes = new Set();
  for (const task of manifest.tasks) {
    const buffer = fs.readFileSync(task.sourceStageFile || task.stageFile);
    const hash = sha256(buffer);
    assert(!hashes.has(hash), `${task.slug}: duplicate regenerated gallery output.`);
    hashes.add(hash);
  }
  assert.equal(hashes.size, allSlugs.length);
}

async function apply(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(manifest.runtime?.succeeded, missingSlugs.length, "All six new paid tasks must succeed before apply.");
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  await prepareTasks(manifest);
  const prisma = new PrismaClient();
  try {
    const packs = await loadActivePacks(prisma);
    const backup = { createdAt: new Date().toISOString(), target: "local", siteId, batchId, packs: [] };
    for (const slug of allSlugs) {
      const pack = packs.get(slug);
      backup.packs.push({ id: pack.id, categoryId: pack.categoryId, imageUrl: pack.imageUrl, galleryImages: pack.galleryImages, galleryImageAlts: pack.galleryImageAlts, categoryRecord: pack.categoryRecord });
    }
    writeJson(backupPath, backup);

    const updates = [];
    for (const task of manifest.tasks) {
      const pack = packs.get(task.slug);
      assert(pack, `Missing active pack: ${task.slug}`);
      const galleryImages = Array.isArray(pack.galleryImages) ? [...pack.galleryImages] : [];
      assert.equal(galleryImages.length, 12, `${task.slug}: expected twelve existing gallery images.`);
      const galleryImageAlts = Array.isArray(pack.galleryImageAlts) ? [...pack.galleryImageAlts] : [pack.imageUrl, ...galleryImages];
      const url = `${task.publicUrl}?v=${cacheVersion}`;
      galleryImages[0] = url;
      galleryImageAlts[1] = task.altText;
      assert(!galleryImages.includes(pack.imageUrl), `${task.slug}: regenerated gallery still equals cover URL.`);
      updates.push({ task, pack, galleryImages, galleryImageAlts, url });
    }

    for (const item of updates) {
      const source = item.task.sourceStageFile || item.task.stageFile;
      atomicCopy(source, item.task.finalFile);
    }

    await prisma.$transaction(async (tx) => {
      for (const item of updates) {
        await tx.creativePack.update({ where: { id: item.pack.id }, data: { galleryImages: item.galleryImages, galleryImageAlts: item.galleryImageAlts } });
        const storageKey = item.task.outputRelative;
        const mediaId = `media_${siteId}_${sha256(storageKey).slice(0, 16)}`;
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey } },
          create: { id: mediaId, siteId, label: item.task.altText, storageKey, mimeType: "image/webp", usageType: "package", sourceType: "ai-missing-gallery-regeneration", previewUrl: item.url, originUrl: item.url, altText: item.task.altText },
          update: { label: item.task.altText, mimeType: "image/webp", usageType: "package", sourceType: "ai-missing-gallery-regeneration", previewUrl: item.url, originUrl: item.url, altText: item.task.altText }
        });
      }
    }, { timeout: 120_000 });

    const readback = await prisma.creativePack.findMany({ where: { siteId, id: { in: updates.map((item) => item.pack.id) } }, select: { id: true, imageUrl: true, galleryImages: true, galleryImageAlts: true } });
    const byId = new Map(readback.map((row) => [row.id, row]));
    for (const item of updates) {
      const row = byId.get(item.pack.id);
      assert.deepEqual(row?.galleryImages, item.galleryImages, `${item.task.slug}: gallery readback failed.`);
      assert.equal(row?.galleryImages?.length, 12, `${item.task.slug}: gallery count changed.`);
      assert.notEqual(row?.galleryImages?.[0], row?.imageUrl, `${item.task.slug}: cover and gallery-01 still share URL.`);
      assert.equal(row?.galleryImageAlts?.[1], item.task.altText, `${item.task.slug}: gallery alt readback failed.`);
    }
    manifest.mode = "applied";
    manifest.apply = { target: "local", appliedAt: new Date().toISOString(), updatedThemes: allSlugs, generated: missingSlugs.length, reused: reusableSlugs.length, backupPath };
    writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode: "applied", batchId, generated: missingSlugs.length, reused: reusableSlugs.length, updatedThemes: allSlugs, backupPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assert(["plan", "generate", "apply", "run"].includes(mode), `Unsupported mode: ${mode}`);
  if (mode === "plan") {
    const manifest = buildPlan();
    writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode, manifestPath, batchId, totalThemes: allSlugs.length, newPaidCreates: missingSlugs.length, reusedStagedOutputs: reusableSlugs.length, maxPaidCreateAttempts }, null, 2));
    return;
  }
  const manifest = mode === "generate" ? readJson(manifestPath) : mode === "apply" ? readJson(manifestPath) : buildPlan();
  if (mode === "generate") await generateMissing(manifest);
  else if (mode === "apply") await apply(manifest);
  else {
    writeJson(manifestPath, manifest);
    await generateMissing(manifest);
    await apply(manifest);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
