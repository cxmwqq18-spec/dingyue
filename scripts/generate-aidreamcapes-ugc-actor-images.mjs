#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const siteId = "site_aidreamcapes";
const providerId = "aiprov_image4_mysub2api";
const model = "gpt-image-2";
const actorCatalogPath = path.resolve(repoRoot, "src/lib/aidreamcapes-workspace/actors.json");
const outputRoot = path.resolve(repoRoot, "public/media/site_aidreamcapes/workspace/actors/library");
const reportRoot = path.resolve(repoRoot, "releases/provider-results/aidreamcapes/ugc-actor-library-v1");
const timeoutMs = 300_000;

const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
const argValue = (name, fallback) => {
  const prefix = `--${name}=`;
  const inline = rawArgs.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = rawArgs.indexOf(`--${name}`);
  return index >= 0 ? rawArgs[index + 1] ?? fallback : fallback;
};
const generate = flags.has("generate");
const force = flags.has("force");
const maxPaidCreates = Number(argValue("max-paid-creates", "0"));
const selectedIds = new Set(String(argValue("ids", "")).split(",").map((value) => value.trim()).filter(Boolean));
const envDir = argValue("env-dir", "");
const concurrency = Number(argValue("concurrency", "4"));
if (envDir) loadRuntimeEnv({ cwd: path.resolve(repoRoot, envDir), files: [".env.local", ".env"], override: false });

assert.ok(Number.isInteger(maxPaidCreates) && maxPaidCreates >= 0 && maxPaidCreates <= 53, "max-paid-creates must be an integer from 0 to 53.");
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 6, "concurrency must be an integer from 1 to 6.");
const catalog = JSON.parse(await fs.readFile(actorCatalogPath, "utf8"));
assert.equal(catalog.count, 53, "Actor manifest must contain exactly 53 cards.");
assert.equal(catalog.provider, "image4");
assert.equal(catalog.model, model);
assert.equal(catalog.actors.length, 53);
const actors = catalog.actors.filter((actor) => !selectedIds.size || selectedIds.has(actor.actorId));
assert.ok(actors.length > 0, "No matching actors were selected.");
assert.equal(new Set(actors.map((actor) => actor.actorId)).size, actors.length, "Actor IDs must be unique.");
for (const actor of actors) {
  assert.equal(actor.imageUrl, `/media/site_aidreamcapes/workspace/actors/library/${actor.actorId}.webp`);
  assert.ok(actor.portraitPrompt.includes(actor.talent), `${actor.actorId}: prompt must retain the plan's character description.`);
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}
function hash(buffer) { return createHash("sha256").update(buffer).digest("hex"); }
async function fileExists(filePath) {
  try { const stat = await fs.stat(filePath); return stat.isFile() && stat.size > 0; } catch { return false; }
}
function imageBufferFromBody(body) {
  const encoded = body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64;
  return encoded ? Buffer.from(encoded, "base64") : undefined;
}
async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, preferred: true, maxImagesPerRequest: true }
    });
    assert(provider, `${providerId}: provider not found.`);
    assert.equal(provider.label, "image4");
    assert.equal(provider.modelType, model);
    assert.equal(provider.providerType, "image");
    assert.equal(provider.enabled, true);
    assert.ok(provider.maxImagesPerRequest >= 1);
    assert.ok(provider.apiKey?.trim() && provider.aiUrl?.trim(), "image4 credentials are incomplete.");
    return { ...provider, baseUrl: normalizeBaseUrl(provider.aiUrl) };
  } finally {
    await prisma.$disconnect();
  }
}
async function checkProviderReadOnly(provider) {
  const response = await fetch(`${provider.baseUrl}/models`, {
    method: "GET", headers: { Authorization: `Bearer ${provider.apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `image4_model_check_failed:${response.status}`);
  assert.ok(JSON.stringify(body).includes(model), `image4_model_check_missing:${model}`);
  return { status: response.status, modelVisible: true };
}
async function generateActor(provider, actor) {
  const requestId = `${siteId}:ugc-actor-library-v1:${actor.actorId}`;
  const response = await fetch(`${provider.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      "Idempotency-Key": requestId,
      "X-Client-Request-Id": requestId
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ model, prompt: actor.portraitPrompt, size: "1024x1024", quality: "medium", response_format: "b64_json" })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${actor.actorId}:image4_generation_failed:${response.status}`);
  const image = imageBufferFromBody(body);
  if (image) return { image, requestId, responseType: "b64_json" };
  const imageUrl = body?.data?.[0]?.url ?? body?.output?.[0]?.url ?? body?.url ?? body?.image_url;
  if (imageUrl) {
    const downloaded = await fetch(String(imageUrl), { method: "GET", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!downloaded.ok) throw new Error(`${actor.actorId}:image4_download_failed:${downloaded.status}`);
    return { image: Buffer.from(await downloaded.arrayBuffer()), requestId, responseType: "url" };
  }
  throw new Error(`${actor.actorId}:image4_empty_image_payload`);
}

const pending = [];
for (const actor of actors) {
  const target = path.join(outputRoot, `${actor.actorId}.webp`);
  if (force || !(await fileExists(target))) pending.push(actor);
}
console.log(JSON.stringify({
  dryRun: !generate,
  siteId,
  provider: "image4",
  providerId,
  model,
  endpoint: "POST /v1/images/generations",
  requestedActors: actors.length,
  newPaidCreatesRequired: pending.length,
  maxPaidCreates,
  concurrency,
  attemptsPerActor: 1,
  stopOnFirstError: true,
  outputRoot
}, null, 2));
if (!generate) {
  if (flags.has("check-provider")) {
    const provider = await loadProvider();
    const readOnlyCheck = await checkProviderReadOnly(provider);
    console.log(JSON.stringify({ provider: provider.label, providerId: provider.id, model, enabled: provider.enabled, preferred: provider.preferred, maxImagesPerRequest: provider.maxImagesPerRequest, readOnlyCheck }, null, 2));
  }
  process.exit(0);
}
assert.ok(pending.length <= maxPaidCreates, `paid_create_cap_exceeded:needed=${pending.length}:cap=${maxPaidCreates}`);

const provider = await loadProvider();
const readOnlyCheck = await checkProviderReadOnly(provider);
console.log(`image4 read-only check passed: model=${model}, status=${readOnlyCheck.status}`);
await fs.mkdir(outputRoot, { recursive: true });
await fs.mkdir(reportRoot, { recursive: true });
const reportPath = path.join(reportRoot, "generation-report.json");
const report = [];
const failures = [];
const writeReport = () => fs.writeFile(reportPath, `${JSON.stringify({
  siteId, provider: "image4", providerId, model, concurrency, readOnlyCheck, paidCreates: report.length + failures.length,
  generatedImages: report.length, failedCreates: failures.length, attemptsPerActor: 1, report, failures
}, null, 2)}\n`, "utf8");
let nextIndex = 0;
let stopped = false;
let reportWrite = Promise.resolve();
function persistReport() {
  reportWrite = reportWrite.then(writeReport);
  return reportWrite;
}
async function worker(workerIndex) {
  while (!stopped) {
    const index = nextIndex++;
    if (index >= pending.length) return;
    const actor = pending[index];
    const target = path.join(outputRoot, `${actor.actorId}.webp`);
    const rawTarget = path.join(reportRoot, `${actor.actorId}.png`);
    console.log(`image4 create ${index + 1}/${pending.length} (worker ${workerIndex + 1}/${concurrency}): ${actor.actorId} (${actor.name})`);
    try {
      const result = await generateActor(provider, actor);
      await fs.writeFile(rawTarget, result.image);
      const metadata = await sharp(result.image).metadata();
      assert.ok((metadata.width ?? 0) >= 512 && (metadata.height ?? 0) >= 512, `${actor.actorId}: generated image is too small.`);
      await sharp(result.image).resize(1024, 1024, { fit: "cover", position: "centre" }).webp({ quality: 90, smartSubsample: true }).toFile(target);
      const output = await fs.readFile(target);
      report.push({ actorId: actor.actorId, name: actor.name, requestId: result.requestId, responseType: result.responseType, sourceWidth: metadata.width, sourceHeight: metadata.height, file: target, sha256: hash(output), bytes: output.length });
      await persistReport();
    } catch (error) {
      failures.push({ actorId: actor.actorId, name: actor.name, error: error instanceof Error ? error.message : String(error) });
      stopped = true;
      await persistReport();
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, (_, index) => worker(index)));

const summary = { ok: failures.length === 0 && report.length === pending.length, siteId, provider: "image4", model, completed: report.length, failed: failures.length, totalActors: catalog.count, reportPath };
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
