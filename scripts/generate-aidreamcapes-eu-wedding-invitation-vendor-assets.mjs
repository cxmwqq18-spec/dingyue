#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const PROVIDER_LABEL = "buming-image";
const MODEL = "gpt-image-2";
const REQUEST_SIZE = "1536x1024";
const QUALITY = "high";
const TARGET_WIDTH = 3840;
const TARGET_HEIGHT = 2160;
const PRICE_PER_REQUEST_USD = 0.0075;
const PUBLIC_BASE = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/vendor-api-gpt-image-2-4k-v1/wedding-invitation";
const LOCAL_BASE = path.resolve("public", PUBLIC_BASE.slice(1));
const REPORT_PATH = path.join(LOCAL_BASE, "_provider-results", "vendor-gpt-image-2-wedding-invitation-run.json");
const MANIFEST = JSON.parse(await fs.readFile(new URL("./data/aidreamcapes-eu-wedding-invitation-vendor-manifest.json", import.meta.url), "utf8"));
const TASKS = MANIFEST.assets.map(([filename, alt], index) => ({
  filename,
  alt,
  index,
  outputFilename: filename.replace(/\.(?:webp|jpe?g)$/i, ".jpg")
}));
const MAX_PAID_CREATE_ATTEMPTS = TASKS.length;
const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

assertDatabaseTarget({ expectedTarget: "local" });
if (!DRY_RUN && !APPLY) throw new Error("paid_generation_requires_--apply");
if (TASKS.length !== 11) throw new Error("unexpected_wedding_invitation_task_count:" + TASKS.length);

function providerBaseUrl(value) {
  const base = String(value ?? "").trim().replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : base + "/v1";
}

function imageBase64(body) {
  return body?.data?.[0]?.b64_json
    ?? body?.data?.[0]?.image_base64
    ?? body?.output?.[0]?.b64_json
    ?? body?.output?.[0]?.image_base64
    ?? body?.image_base64;
}

function imageUrl(body) {
  return body?.data?.[0]?.url
    ?? body?.data?.[0]?.image_url
    ?? body?.output?.[0]?.url
    ?? body?.output?.[0]?.image_url
    ?? body?.output?.image_url
    ?? body?.url
    ?? body?.image_url;
}

async function responseImageBuffer(body) {
  const base64 = imageBase64(body);
  if (base64) return Buffer.from(base64, "base64");
  const url = imageUrl(body);
  if (!url) throw new Error("provider_response_missing_image");
  const response = await fetch(String(url), { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error("provider_image_download_failed:" + response.status);
  return Buffer.from(await response.arrayBuffer());
}

function buildPrompt(task) {
  return [
    "Create a polished editorial photograph for a wedding invitation video theme.",
    "Scene: " + MANIFEST.anchor + ". Use " + MANIFEST.palette + " as the dominant visual direction.",
    "Subject: clearly depict this specific visual: " + task.alt + ". Use original fictional adults with natural expressions and believable proportions.",
    "Composition: balanced wide landscape frame, premium wedding stationery editorial, clear visual hierarchy, enough negative space for a web crop, tactile paper and fabric detail.",
    "Use case: supporting image for the Aidreamcapes AI wedding invitation photo and video detail page.",
    "Constraints: family-safe and wedding-appropriate; no readable generated text, names, dates, logos, trademarks, watermarks, UI, border, collage, duplicated subjects, distorted anatomy, extra fingers, or extra limbs. The invitation may contain elegant non-readable placeholder marks only; all real event text will be added separately."
  ].join("\n\n");
}

async function write4kJpeg(buffer, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(buffer)
    .rotate()
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", position: "centre" })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(outputPath);
}

async function writeReport(report) {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
}

const plan = {
  siteId: SITE_ID,
  providerLabel: PROVIDER_LABEL,
  model: MODEL,
  endpoint: "/v1/images/generations",
  method: "POST",
  requestSize: REQUEST_SIZE,
  outputSize: TARGET_WIDTH + "x" + TARGET_HEIGHT,
  quality: QUALITY,
  pageSlug: MANIFEST.slug,
  maxPaidCreateAttempts: MAX_PAID_CREATE_ATTEMPTS,
  estimatedMaxCostUsd: Number((MAX_PAID_CREATE_ATTEMPTS * PRICE_PER_REQUEST_USD).toFixed(4)),
  attempts: []
};

if (DRY_RUN) {
  console.log(JSON.stringify({ ...plan, dryRun: true, files: TASKS.map((task) => task.outputFilename) }, null, 2));
  process.exit(0);
}

for (const task of TASKS) {
  const outputPath = path.join(LOCAL_BASE, task.outputFilename);
  try {
    const stat = await fs.stat(outputPath);
    if (stat.isFile() && stat.size > 0) throw new Error("refusing_to_overwrite_existing_vendor_asset:" + outputPath);
  } catch (error) {
    if (error?.message?.startsWith("refusing_to_overwrite")) throw error;
  }
}

const prisma = new PrismaClient();
let paidAttempts = 0;
try {
  const provider = await prisma.platformAiProvider.findFirst({
    where: { label: PROVIDER_LABEL, modelType: MODEL, providerType: "image", enabled: true },
    select: { label: true, aiUrl: true, apiKey: true }
  });
  if (!provider?.apiKey || !provider.aiUrl) throw new Error("configured_vendor_provider_missing_api_credentials");
  const endpoint = providerBaseUrl(provider.aiUrl) + "/images/generations";
  console.log("paid provider plan: POST " + endpoint + " model=" + MODEL + " quality=" + QUALITY + " requestSize=" + REQUEST_SIZE + " outputSize=" + TARGET_WIDTH + "x" + TARGET_HEIGHT + " maxPaidCreateAttempts=" + MAX_PAID_CREATE_ATTEMPTS + " attemptsPerImage=1 stopOnFirstError=true");
  console.log("using vendor API provider: " + provider.label);

  for (const task of TASKS) {
    if (paidAttempts >= MAX_PAID_CREATE_ATTEMPTS) throw new Error("paid_create_cap_reached");
    paidAttempts += 1;
    const requestId = "aidreamcapes:" + SITE_ID + ":wedding-invitation-vendor-v1:" + task.filename;
    console.log("generating vendor asset " + paidAttempts + "/" + MAX_PAID_CREATE_ATTEMPTS + ": " + task.outputFilename);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + provider.apiKey,
        "Idempotency-Key": requestId
      },
      body: JSON.stringify({ model: MODEL, prompt: buildPrompt(task), size: REQUEST_SIZE, quality: QUALITY, n: 1, response_format: "b64_json" }),
      signal: AbortSignal.timeout(180_000)
    });
    const body = await response.json().catch(() => ({}));
    plan.attempts.push({
      filename: task.filename,
      outputFilename: task.outputFilename,
      requestId,
      providerRequestId: response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? "",
      providerTaskId: body?.id ?? body?.task_id ?? body?.data?.[0]?.id ?? "",
      status: response.status,
      ok: response.ok,
      usage: body?.usage ?? undefined,
      createdAt: new Date().toISOString()
    });
    await writeReport(plan);
    if (!response.ok) throw new Error(task.outputFilename + ":provider_create_failed:" + response.status);
    await write4kJpeg(await responseImageBuffer(body), path.join(LOCAL_BASE, task.outputFilename));
    const metadata = await sharp(path.join(LOCAL_BASE, task.outputFilename)).metadata();
    if (metadata.width !== TARGET_WIDTH || metadata.height !== TARGET_HEIGHT) throw new Error(task.outputFilename + ":unexpected_output_dimensions:" + metadata.width + "x" + metadata.height);
    await writeReport(plan);
  }
  plan.completed = true;
  plan.paidCreateAttempts = paidAttempts;
  plan.actualMaxCostUsd = Number((paidAttempts * PRICE_PER_REQUEST_USD).toFixed(4));
  await writeReport(plan);
  console.log(JSON.stringify({ ok: true, completed: TASKS.length, paidCreateAttempts: paidAttempts, estimatedMaxCostUsd: plan.estimatedMaxCostUsd, actualMaxCostUsd: plan.actualMaxCostUsd, reportPath: REPORT_PATH }, null, 2));
} catch (error) {
  plan.completed = false;
  plan.paidCreateAttempts = paidAttempts;
  plan.failure = error instanceof Error ? error.message : String(error);
  await writeReport(plan);
  throw error;
} finally {
  await prisma.$disconnect();
}
