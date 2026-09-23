#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { writeProviderImageBundle } from "./lib/provider-image-output.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const PROVIDER_LABEL = "buming-image";
const MODEL = "gpt-image-2";
const REQUEST_SIZE = "1536x1024";
const QUALITY = "high";
const TARGET_WIDTH = 3840;
const PRICE_PER_REQUEST_USD = 0.0075;
const PAGE_DEFINITIONS = JSON.parse(
  await fs.readFile(new URL("./data/aidreamcapes-eu-save-the-date-vendor-manifest.json", import.meta.url), "utf8")
);
const ALT_OVERRIDES = JSON.parse(
  await fs.readFile(new URL("./data/aidreamcapes-eu-save-the-date-vendor-alt-fr.json", import.meta.url), "utf8")
);
const tasks = PAGE_DEFINITIONS.flatMap((page) =>
  page.assets.map(([filename, alt], index) => ({ pageSlug: page.slug, theme: page.theme, palette: page.palette, anchor: page.anchor, filename, alt: ALT_OVERRIDES[page.slug]?.[index] ?? alt }))
);
const MAX_PAID_CREATE_ATTEMPTS = tasks.length;
const PUBLIC_BASE = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/vendor-api-gpt-image-2-4k-v1";
const LOCAL_BASE = path.resolve("public", PUBLIC_BASE.slice(1));
const REPORT_PATH = path.join(LOCAL_BASE, "_provider-results", "vendor-gpt-image-2-all-pages-run.json");
const DRY_RUN = process.argv.includes("--dry-run");
const APPLY = process.argv.includes("--apply");

if (!DRY_RUN && !APPLY) throw new Error("paid_generation_requires_--apply");
if (tasks.length !== 109) throw new Error("unexpected_task_count:" + tasks.length);

function outputFilename(filename) {
  return filename.replace(/\.(?:webp|jpe?g)$/i, ".jpg");
}
function providerBaseUrl(value) {
  const base = String(value ?? "").trim().replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : base + "/v1";
}
function imageBase64(body) {
  return body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64 ?? body?.image_base64;
}
function imageUrl(body) {
  return body?.data?.[0]?.url ?? body?.data?.[0]?.image_url ?? body?.output?.[0]?.url ?? body?.output?.[0]?.image_url ?? body?.output?.image_url ?? body?.url ?? body?.image_url;
}
async function responseImageBuffer(body) {
  const base64 = imageBase64(body);
  if (base64) return Buffer.from(base64, "base64");
  const url = imageUrl(body);
  if (!url) throw new Error("provider_response_missing_image");
  const response = await fetch(String(url));
  if (!response.ok) throw new Error("provider_image_download_failed:" + response.status);
  return Buffer.from(await response.arrayBuffer());
}
function buildPrompt(task) {
  return [
    "Create a polished editorial photograph for the " + task.theme + " theme.",
    "Scene: a real-world setting appropriate to " + task.theme + ", with " + task.anchor + "; use " + task.palette + " as the dominant color direction.",
    "Subject: clearly depict this page visual: " + JSON.stringify(task.alt) + ". Use original fictional people and pets with natural expressions and believable proportions.",
    "Important Details: cinematic natural or practical light, tactile materials, realistic skin, hair, fabric, food, paper, or foliage texture as applicable, balanced wide landscape composition, clean visual hierarchy, polished page visual.",
    "Use Case: supporting image for the " + task.theme + " AI photo and video theme detail page; reinforce the subject in the SEO alt label.",
    "Constraints: family-safe or wedding-appropriate scene; physical objects only; no readable text, signage, logos, trademarks, watermarks, UI, border, collage, duplicated subjects, distorted anatomy, or extra limbs."
  ].join("\n\n");
}
async function writeReport(report) {
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2) + "\n");
}

const pageCounts = Object.fromEntries(PAGE_DEFINITIONS.map((page) => [page.slug, page.assets.length]));
const plan = {
  siteId: SITE_ID,
  providerLabel: PROVIDER_LABEL,
  model: MODEL,
  endpoint: "/v1/images/generations",
  method: "POST",
  requestSize: REQUEST_SIZE,
  outputSize: `${TARGET_WIDTH}px wide; provider aspect ratio preserved; original response retained`,
  quality: QUALITY,
  pageCounts,
  maxPaidCreateAttempts: MAX_PAID_CREATE_ATTEMPTS,
  estimatedMaxCostUsd: Number((MAX_PAID_CREATE_ATTEMPTS * PRICE_PER_REQUEST_USD).toFixed(4)),
  attempts: []
};

if (DRY_RUN) {
  console.log(JSON.stringify({ ...plan, dryRun: true, files: tasks.map((task) => task.pageSlug + "/" + outputFilename(task.filename)) }, null, 2));
  process.exit(0);
}

const existing = [];
for (const task of tasks) {
  const outputPath = path.join(LOCAL_BASE, task.pageSlug, outputFilename(task.filename));
  try {
    const stat = await fs.stat(outputPath);
    if (stat.isFile() && stat.size > 0) existing.push(task.pageSlug + "/" + outputFilename(task.filename));
  } catch {
    // Fresh output path is expected.
  }
}
if (existing.length) throw new Error("refusing_to_overwrite_existing_vendor_assets:" + existing.join(","));

const prisma = new PrismaClient();
let paidAttempts = 0;
try {
  const provider = await prisma.platformAiProvider.findFirst({
    where: { label: PROVIDER_LABEL, modelType: MODEL, providerType: "image", enabled: true },
    select: { label: true, aiUrl: true, apiKey: true }
  });
  if (!provider?.apiKey || !provider.aiUrl) throw new Error("configured_vendor_provider_missing_api_credentials");
  const endpoint = providerBaseUrl(provider.aiUrl) + "/images/generations";
  console.log("paid provider plan: POST " + endpoint + " model=" + MODEL + " quality=" + QUALITY + " requestSize=" + REQUEST_SIZE + " outputSize=" + TARGET_WIDTH + "px-wide-preserve-ratio maxPaidCreateAttempts=" + MAX_PAID_CREATE_ATTEMPTS + " attemptsPerImage=1 stopOnFirstError=true");
  console.log("using vendor API provider: " + provider.label);

  for (const task of tasks) {
    if (paidAttempts >= MAX_PAID_CREATE_ATTEMPTS) throw new Error("paid_create_cap_reached");
    paidAttempts += 1;
    const outputName = outputFilename(task.filename);
    const requestId = "aidreamcapes:" + SITE_ID + ":save-the-date-vendor-v1:" + task.pageSlug + ":" + task.filename;
    console.log("generating vendor asset " + paidAttempts + "/" + MAX_PAID_CREATE_ATTEMPTS + ": " + task.pageSlug + "/" + outputName);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + provider.apiKey,
        "Idempotency-Key": requestId
      },
      body: JSON.stringify({
        model: MODEL,
        prompt: buildPrompt(task),
        size: REQUEST_SIZE,
        quality: QUALITY,
        n: 1,
        response_format: "b64_json"
      })
    });
    const body = await response.json().catch(() => ({}));
    const attempt = {
      pageSlug: task.pageSlug,
      filename: task.filename,
      outputFilename: outputName,
      requestId,
      providerRequestId: response.headers.get("x-request-id") ?? response.headers.get("request-id") ?? "",
      status: response.status,
      ok: response.ok,
      providerTaskId: body?.id ?? body?.task_id ?? body?.data?.[0]?.id ?? "",
      usage: body?.usage ?? undefined,
      createdAt: new Date().toISOString()
    };
    plan.attempts.push(attempt);
    await writeReport(plan);
    if (!response.ok) throw new Error(task.pageSlug + "/" + outputName + ":provider_create_failed:" + response.status);
    const sourceBuffer = await responseImageBuffer(body);
    const outputPath = path.join(LOCAL_BASE, task.pageSlug, outputName);
    const bundle = await writeProviderImageBundle({
      buffer: sourceBuffer,
      originalPathBase: path.join(LOCAL_BASE, "_provider-results", "originals", task.pageSlug, outputName),
      displayPath: outputPath,
      displayWidth: TARGET_WIDTH,
      label: task.pageSlug + "/" + outputName
    });
    console.log("generated vendor asset: " + PUBLIC_BASE + "/" + task.pageSlug + "/" + outputName + " -> " + bundle.displayWidth + "x" + bundle.displayHeight + "; original=" + bundle.originalPath);
    await writeReport(plan);
  }
  plan.completed = true;
  plan.paidCreateAttempts = paidAttempts;
  plan.actualMaxCostUsd = Number((paidAttempts * PRICE_PER_REQUEST_USD).toFixed(4));
  await writeReport(plan);
  console.log(JSON.stringify({ ok: true, completed: tasks.length, paidCreateAttempts: paidAttempts, estimatedMaxCostUsd: plan.estimatedMaxCostUsd, actualMaxCostUsd: plan.actualMaxCostUsd, reportPath: REPORT_PATH }, null, 2));
} catch (error) {
  plan.completed = false;
  plan.paidCreateAttempts = paidAttempts;
  plan.failure = error instanceof Error ? error.message : String(error);
  await writeReport(plan);
  throw error;
} finally {
  await prisma.$disconnect();
}
