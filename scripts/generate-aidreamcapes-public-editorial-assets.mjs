#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_aidreamcapes";
const PROVIDER_ID = "aiprov_image4_mysub2api";
const MODEL = "gpt-image-2";
const OUTPUT_ROOT = path.resolve(process.cwd(), "public/assets/sites/site_aidreamcapes/public-editorial/20260918-v1");
const RESULT_ROOT = path.resolve(process.cwd(), "releases/provider-results/aidreamcapes/public-editorial-20260918-v1");
const TIMEOUT_MS = 300_000;

const assets = [
  {
    key: "about-private-workspace",
    filename: "about-private-workspace.png",
    alt: "Private creative workspace with abstract photo prints, a blank monitor, and organized studio materials.",
    prompt: [
      "Create one premium editorial still-life photograph for a dark creative AI studio website.",
      "Show a private creative workspace with a blank monitor, a few abstract landscape photo prints, a notebook, and carefully arranged studio materials on a charcoal desk.",
      "Use a deep indigo-black palette with restrained violet and cyan reflections, soft window light, and generous negative space on the left for website copy.",
      "Make the scene feel calm, precise, private, and design-led. Keep every print abstract and unbranded. Do not include readable text, logos, interfaces, watermarks, people, faces, hands, collage panels, or split screens.",
      "Landscape composition, 3:2 aspect ratio, complete objects visible, natural perspective, no important subject touching the crop edges."
    ].join("\n")
  },
  {
    key: "about-studio-story",
    filename: "about-studio-story.png",
    alt: "Editorial studio table with framed abstract prints, a camera, and warm late-afternoon light.",
    prompt: [
      "Create one premium editorial still-life photograph for the About page of a dark creative AI studio website.",
      "Show a refined studio table with framed abstract photo prints, an unbranded camera, a closed notebook, color swatches, and a warm desk lamp in the background.",
      "Use charcoal, warm ivory, muted lavender, and a small amount of cyan light so it belongs to the same visual system as a black editorial design studio.",
      "Make the scene communicate craft, iteration, and thoughtful creative direction. Keep all prints abstract and unbranded. Do not include readable text, logos, interfaces, watermarks, people, faces, hands, collage panels, or split screens.",
      "Landscape composition, 3:2 aspect ratio, complete objects visible, balanced negative space, no important subject touching the crop edges."
    ].join("\n")
  }
];

const rawArgs = process.argv.slice(2);
const flags = new Set();
const values = new Map();
for (let index = 0; index < rawArgs.length; index += 1) {
  const token = rawArgs[index];
  if (!token.startsWith("--")) continue;
  const [key, ...inline] = token.slice(2).split("=");
  if (inline.length) values.set(key, inline.join("="));
  else if (rawArgs[index + 1] && !rawArgs[index + 1].startsWith("--")) values.set(key, rawArgs[++index]);
  else flags.add(key);
}

const generate = flags.has("generate");
const paidConfirmation = flags.has("confirm-paid");
const maxPaidCreates = Number(values.get("max-paid-creates") ?? 0);
const selectedKeys = new Set(String(values.get("keys") ?? "").split(",").map((value) => value.trim()).filter(Boolean));

assert.ok(Number.isInteger(maxPaidCreates) && maxPaidCreates >= 0 && maxPaidCreates <= assets.length, "max-paid-creates must be an integer from 0 to the number of assets.");
assert.equal(flags.has("retry"), false, "Paid image creation retries are disabled.");
assert.equal(flags.has("fallback"), false, "Paid image provider fallback is disabled.");

const selectedAssets = assets.filter((asset) => !selectedKeys.size || selectedKeys.has(asset.key));
assert.ok(selectedAssets.length > 0, "No matching asset keys.");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  return /\/v1$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

function imageFromBody(body) {
  const encoded = body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64;
  return encoded ? Buffer.from(encoded, "base64") : null;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: PROVIDER_ID },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, maxImagesPerRequest: true, supportsGenerationN: true }
    });
    assert(provider, `${PROVIDER_ID}: provider not found`);
    assert.equal(provider.providerType, "image");
    assert.equal(provider.modelType, MODEL);
    assert.equal(provider.enabled, true);
    assert(provider.aiUrl?.trim() && provider.apiKey?.trim(), "image4 provider credentials are incomplete");
    assert(provider.maxImagesPerRequest >= 1, "image4 provider cannot generate images");
    return { ...provider, baseUrl: normalizeBaseUrl(provider.aiUrl) };
  } finally {
    await prisma.$disconnect();
  }
}

async function readOnlyProviderState(provider) {
  const headers = { Authorization: `Bearer ${provider.apiKey}` };
  const modelsResponse = await fetch(`${provider.baseUrl}/models`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const modelsBody = await modelsResponse.json().catch(() => ({}));
  assert.equal(modelsResponse.ok, true, `provider_models_check_failed:${modelsResponse.status}`);
  const modelIds = Array.isArray(modelsBody?.data) ? modelsBody.data.map((item) => String(item?.id ?? "")).filter(Boolean) : [];
  assert.ok(!modelIds.length || modelIds.includes(MODEL), `provider_model_not_available:${MODEL}`);

  const usageResponse = await fetch(`${provider.baseUrl}/usage`, { headers, cache: "no-store", signal: AbortSignal.timeout(30_000) });
  const usageBody = await usageResponse.json().catch(() => ({}));
  assert.equal(usageResponse.ok, true, `provider_usage_check_failed:${usageResponse.status}`);
  return {
    models: { status: modelsResponse.status, modelCount: modelIds.length, modelAvailable: true },
    usage: {
      status: usageResponse.status,
      balance: typeof usageBody?.balance === "number" ? usageBody.balance : null,
      currency: "provider-defined",
      latestDay: Array.isArray(usageBody?.daily_usage) && usageBody.daily_usage.length ? usageBody.daily_usage.at(-1) : null
    }
  };
}

async function downloadImage(url, apiKey) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  assert.equal(response.ok, true, `provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function createImage(provider, asset) {
  const requestId = `${SITE_ID}:public-editorial:20260918-v1:${asset.key}`;
  const response = await fetch(`${provider.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      "Idempotency-Key": requestId,
      "X-Client-Request-Id": requestId
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({ model: MODEL, prompt: asset.prompt, size: "1536x1024", quality: "high", n: 1, response_format: "b64_json" })
  });
  const body = await response.json().catch(() => ({}));
  const providerRequestId = response.headers.get("x-request-id") || undefined;
  if (!response.ok) throw new Error(`${asset.key}:provider_failed:${response.status}`);
  const encoded = imageFromBody(body);
  const sourceBuffer = encoded ?? (body?.data?.[0]?.url ? await downloadImage(String(body.data[0].url), provider.apiKey) : null);
  assert(sourceBuffer, `${asset.key}:provider_empty_image_payload`);
  return { requestId, providerRequestId, body, sourceBuffer };
}

async function writeAsset(asset, sourceBuffer) {
  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const outputPath = path.join(OUTPUT_ROOT, asset.filename);
  await sharp(sourceBuffer).rotate().resize({ width: 1536, height: 1024, fit: "cover", position: "attention" }).png().toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  assert.equal(metadata.width, 1536);
  assert.equal(metadata.height, 1024);
  return { outputPath, width: metadata.width, height: metadata.height, sha256: createHash("sha256").update(await fs.readFile(outputPath)).digest("hex") };
}

async function main() {
  const pending = [];
  for (const asset of selectedAssets) {
    const outputPath = path.join(OUTPUT_ROOT, asset.filename);
    if (!flags.has("force") && await fileExists(outputPath)) continue;
    pending.push(asset);
  }

  const plan = {
    dryRun: !generate,
    siteId: SITE_ID,
    providerId: PROVIDER_ID,
    model: MODEL,
    endpoint: "POST /v1/images/generations",
    method: "POST",
    selectedAssets: selectedAssets.map((asset) => ({ key: asset.key, filename: asset.filename, alt: asset.alt })),
    pendingAssets: pending.map((asset) => asset.key),
    maxPaidCreates,
    attemptsPerCreate: 1,
    retry: false,
    fallback: false,
    stopOnFirstError: true,
    outputRoot: OUTPUT_ROOT,
    reportRoot: RESULT_ROOT
  };
  console.log(JSON.stringify(plan, null, 2));
  if (!generate) return;
  assert(paidConfirmation, "Paid generation requires --confirm-paid.");
  assert(pending.length <= maxPaidCreates, `paid_create_cap_exceeded:needed=${pending.length}:cap=${maxPaidCreates}`);

  const provider = await loadProvider();
  const before = await readOnlyProviderState(provider);
  console.log(JSON.stringify({ readOnlyProviderStateBeforeCreate: before }, null, 2));
  const report = [];
  for (const [index, asset] of pending.entries()) {
    console.log(`provider create ${index + 1}/${pending.length}: ${asset.key}`);
    const result = await createImage(provider, asset);
    const output = await writeAsset(asset, result.sourceBuffer);
    report.push({ key: asset.key, requestId: result.requestId, providerRequestId: result.providerRequestId ?? null, output, usage: result.body?.usage ?? null });
  }
  const after = await readOnlyProviderState(provider);
  await fs.mkdir(RESULT_ROOT, { recursive: true });
  const reportPath = path.join(RESULT_ROOT, "generation-report.json");
  await fs.writeFile(reportPath, `${JSON.stringify({ siteId: SITE_ID, providerId: PROVIDER_ID, model: MODEL, endpoint: "POST /v1/images/generations", paidCreates: report.length, attemptsPerCreate: 1, before, after, report }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, paidCreates: report.length, reportPath, before, after, report }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
