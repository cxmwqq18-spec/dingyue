#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Agent } from "undici";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const onlyKeys = new Set(process.argv
  .filter((arg) => arg.startsWith("--only="))
  .flatMap((arg) => arg.slice("--only=".length).split(","))
  .map((arg) => arg.trim())
  .filter(Boolean));
const model = process.env.STOREFRONT_IMAGE_REGEN_MODEL ?? "gpt-image-2";
const timeoutMs = 300_000;
const downloadAttempts = 4;
const requestSalt = "20260801visualfix1";
const auditRoot = path.join(repoRoot, "tmp", "paid-image-regeneration-20260801");
const fetchDispatcher = new Agent({
  headersTimeout: timeoutMs + 60_000,
  bodyTimeout: timeoutMs + 60_000
});

const allTasks = [
  {
    key: "mydreamshoots-thanksgiving-keepsake-cover",
    output: path.join(repoRoot, "public/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp"),
    width: 1280,
    height: 960,
    prompt: [
      "Use case: photorealistic-natural",
      "Asset type: premium storefront private-album cover image",
      "Primary request: create a warm Thanksgiving and Friendsgiving group memory image for MyDreamShoots.",
      "Scene: a believable adult family and friend gathering around a welcoming dinner table in a cozy home, with harvest food, pumpkins, candles, autumn leaves, warm amber window light, and a clear sense of gratitude and shared memory.",
      "Composition: horizontal 4:3 album-cover framing, full dinner-table context, natural candid interaction, faces and hands clearly visible, no awkward crop, strong thumbnail readability.",
      "Style: polished realistic editorial photography for a premium AI photo subscription storefront.",
      "Constraints: original fictional adults only; no text, captions, logos, watermarks, UI, readable signage, celebrity likenesses, official marks, wedding ceremony styling, bridal fashion, sari or mandap cues, or unrelated travel scenery."
    ].join("\n")
  },
  {
    key: "aidreamcapes-christmas-holiday-story",
    output: path.join(repoRoot, "public/assets/sites/site_aidreamcapes/fan-holiday-theme/posters/christmas-card-motion.webp"),
    width: 960,
    height: 960,
    prompt: [
      "Use case: photorealistic-natural",
      "Asset type: premium storefront private-holiday-album story frame",
      "Primary request: create a cozy Christmas private-album story image for Aidreamcapes.",
      "Scene: an original adult family or friend group sharing a relaxed holiday memory in a warmly lit living room, with a decorated Christmas tree, soft lights, seasonal table details, wrapped gifts, and natural conversation or album-review energy.",
      "Composition: square full-scene framing, show the room and the group clearly, balanced foreground and background, suitable as a holiday album story tile.",
      "Style: polished realistic editorial photography, intimate but unposed, premium private-gallery mood.",
      "Constraints: no postcard held in hand, no single product close-up, no text, captions, logos, watermarks, UI, readable signage, celebrity likenesses, protected characters, or branded holiday marks."
    ].join("\n")
  }
];
const tasks = onlyKeys.size ? allTasks.filter((task) => onlyKeys.has(task.key)) : allTasks;
if (!tasks.length) throw new Error(`No regeneration tasks matched --only=${Array.from(onlyKeys).join(",")}`);

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return match?.[1] ?? `${trimmed}/v1`;
}

function imageBase64(body) {
  return body?.data?.[0]?.b64_json ??
    body?.data?.[0]?.image_base64 ??
    body?.output?.[0]?.b64_json ??
    body?.output?.[0]?.image_base64 ??
    body?.image_base64;
}

function imageUrl(body) {
  return body?.data?.[0]?.url ??
    body?.data?.[0]?.image_url ??
    body?.output?.[0]?.url ??
    body?.output?.[0]?.image_url ??
    body?.output?.image_url ??
    body?.url ??
    body?.image_url;
}

function redactedBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => {
    if (/(?:b64|base64)/i.test(key) && typeof value === "string") return `[omitted:${value.length}]`;
    return value;
  }));
}

async function writeAudit(name, value) {
  await fs.mkdir(auditRoot, { recursive: true });
  await fs.writeFile(path.join(auditRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findFirst({
      where: { modelType: model, enabled: true },
      orderBy: [{ preferred: "desc" }, { priority: "asc" }, { updatedAt: "desc" }]
    });
    if (!provider?.apiKey || !provider.aiUrl) throw new Error(`No enabled provider found for ${model}`);
    return {
      id: provider.id,
      label: provider.label,
      baseUrl: normalizeBaseUrl(provider.aiUrl),
      apiKey: provider.apiKey,
      model: provider.modelType
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function createImage(provider, task) {
  const idempotencyKey = `storefront:${task.key}:${requestSalt}`.slice(0, 180);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(`${provider.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        "Idempotency-Key": idempotencyKey
      },
      dispatcher: fetchDispatcher,
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        prompt: task.prompt,
        size: "1024x1024",
        quality: "medium",
        response_format: "b64_json"
      })
    });
    const body = await response.json().catch(() => ({}));
    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
    await writeAudit(`${task.key}.json`, {
      createdAt: new Date().toISOString(),
      taskKey: task.key,
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.model,
      endpoint: `${provider.baseUrl}/images/generations`,
      idempotencyKey,
      requestId,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      resultUrl: imageUrl(body) || "",
      body: redactedBody(body)
    });
    if (!response.ok) throw new Error(`${task.key}:provider_failed:${response.status}`);
    const b64 = imageBase64(body);
    if (b64) return { buffer: Buffer.from(b64, "base64"), requestId, resultUrl: "" };
    const resultUrl = imageUrl(body);
    if (!resultUrl) throw new Error(`${task.key}:empty_image_payload`);
    return { buffer: await downloadImage(resultUrl, task.key), requestId, resultUrl };
  } finally {
    clearTimeout(timer);
  }
}

async function downloadImage(url, key) {
  let lastError;
  for (let attempt = 1; attempt <= downloadAttempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        dispatcher: fetchDispatcher,
        signal: AbortSignal.timeout(90_000)
      });
      if (!response.ok) throw new Error(`download_status_${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < downloadAttempts) {
        console.warn(`${key}: result download failed (${attempt}/${downloadAttempts}); retrying read-only download`);
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }
  throw new Error(`${key}:result_download_failed:${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function writeOutput(task, buffer) {
  await fs.mkdir(path.dirname(task.output), { recursive: true });
  await sharp(buffer)
    .rotate()
    .resize(task.width, task.height, { fit: "cover", position: "entropy" })
    .sharpen({ sigma: 0.35 })
    .webp({ quality: 92, smartSubsample: true })
    .toFile(task.output);
}

async function main() {
  console.log(JSON.stringify({
    dryRun,
    model,
    paidCreateCap: tasks.length,
    attemptsPerCreate: 1,
    stopOnFirstError: true,
    downloadAttempts,
    tasks: tasks.map((task) => ({ key: task.key, output: task.output, width: task.width, height: task.height }))
  }, null, 2));
  if (dryRun) return;

  const provider = await loadProvider();
  console.log(`paid provider plan: POST ${provider.baseUrl}/images/generations model=${provider.model} quality=medium size=1024x1024 maxPaidCreates=${tasks.length} attemptsPerCreate=1 stopOnFirstError=true`);
  console.log(`using platform AI provider: ${provider.label} (${provider.model})`);

  const results = [];
  for (const task of tasks) {
    console.log(`generating ${task.key} (${results.length + 1}/${tasks.length})`);
    const result = await createImage(provider, task);
    await writeOutput(task, result.buffer);
    results.push({
      key: task.key,
      output: task.output,
      requestId: result.requestId,
      resultUrlReturned: Boolean(result.resultUrl)
    });
  }
  console.log(JSON.stringify({ ok: true, paidCreateAttempts: results.length, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
