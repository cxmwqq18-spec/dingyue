#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { Agent } from "undici";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const dryRun = process.argv.includes("--dry-run");
const model = "gpt-image-2";
const outputWidth = 1600;
const outputHeight = 900;
const createSize = "1536x1024";
const timeoutMs = 300_000;
const downloadAttempts = 3;
const requestedOnly = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length) || "";
const requestedProvider = process.argv.find((arg) => arg.startsWith("--provider="))?.slice("--provider=".length) || "";
const requestSalt = requestedOnly ? `20260902-story-topic-media-v3-${requestedOnly}` : "20260902-story-topic-media-v2";
const auditRoot = path.join(repoRoot, "tmp", "paid-image-regeneration-20260902-story-topic");
const dispatcher = new Agent({ headersTimeout: timeoutMs + 60_000, bodyTimeout: timeoutMs + 60_000 });

const allTasks = [
  {
    key: "story-video-mini-documentary-interview-creator",
    prompt: [
      "Use case: photorealistic-natural",
      "Asset type: horizontal 16:9 storefront use-case image for a story-video detail page",
      "Primary request: show a real mini-documentary moment where a maker explains their work while a documentarian records the evidence.",
      "Scene/backdrop: an original adult craftsperson in a believable workshop with tools, work-in-progress materials, and a small camera or audio recorder held by an interviewer.",
      "Subject: the adult maker and the recording action must be clearly visible; hands, object, place, and interaction should all read at thumbnail size.",
      "Composition/framing: wide 16:9 editorial frame, balanced people and environment, faces and hands fully inside the frame, no extreme close-up and no baked-in border.",
      "Lighting/mood: natural window light with documentary texture, attentive and grounded rather than staged influencer content.",
      "Constraints: original fictional adults only; no text, captions, logos, watermarks, UI, readable signage, celebrity likenesses, podcast microphone close-up, or product-ad styling."
    ].join("\n")
  },
  {
    key: "story-video-community-shared-milestone",
    prompt: [
      "Use case: photorealistic-natural",
      "Asset type: horizontal 16:9 storefront use-case image for a story-video detail page",
      "Primary request: show a community story through people taking collective action and making visible progress together.",
      "Scene/backdrop: a diverse group of original adult neighbors restoring a shared outdoor space, planting, repairing, or organizing materials at a real community project.",
      "Subject: several people must be doing different useful actions, with tools, materials, and a visible shared result; the people are the story, not background scenery.",
      "Composition/framing: wide 16:9 documentary photograph, clear foreground action and readable faces, no posed graduation portrait and no single dominant subject.",
      "Lighting/mood: bright natural daylight, candid cooperation, credible and warm without looking like a corporate stock photo.",
      "Constraints: original fictional adults only; no text, captions, logos, watermarks, UI, readable signage, graduation caps, holiday decorations, or branded uniforms."
    ].join("\n")
  },
  {
    key: "story-video-fictional-noir-character-conflict",
    prompt: [
      "Use case: photorealistic-natural",
      "Asset type: horizontal 16:9 storefront use-case image for a story-video detail page",
      "Primary request: show a fictional character facing a clear obstacle in a noir story, with the character readable and the conflict visible.",
      "Scene/backdrop: a rain-slick neon side street at night with a doorway, reflected colored light, and an approaching obstacle in the distance.",
      "Subject: one original adult protagonist in a dark coat stands from the waist up near the center-right, facing three-quarters toward camera; show the complete face, both eyes, neck, shoulders, and upper torso clearly. The character is the unmistakable focal point.",
      "Composition/framing: wide 16:9 cinematic frame at eye level; place the protagonist's eyes around 45 percent of the image height, with generous headroom above the hair and visible shoulders below. Keep the character fully inside the middle of the frame; put the blocked exit and distant silhouette behind them, never in front. No empty blurred foreground, no face at the bottom edge, no cropped head.",
      "Lighting/mood: controlled blue and magenta practical light, sharp subject separation, suspenseful but legible.",
      "Constraints: original fictional adult only; no text, captions, logos, watermarks, UI, celebrity likenesses, cropped forehead, face at the bottom edge, detective hat, cigar, or reuse of any existing Cinematic Video image."
    ].join("\n")
  }
];
const tasks = requestedOnly ? allTasks.filter(({ key }) => key === requestedOnly) : allTasks;
if (requestedOnly && tasks.length === 0) throw new Error(`Unknown --only key: ${requestedOnly}`);

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return match?.[1] ?? `${trimmed}/v1`;
}

function imageBase64(body) {
  return body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64 ?? body?.image_base64;
}

function imageUrl(body) {
  return body?.data?.[0]?.url ?? body?.data?.[0]?.image_url ?? body?.output?.[0]?.url ?? body?.output?.[0]?.image_url ?? body?.output?.image_url ?? body?.url ?? body?.image_url;
}

function redact(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => /(?:b64|base64)/i.test(key) && typeof value === "string" ? `[omitted:${value.length}]` : value));
}

async function audit(name, value) {
  await fs.mkdir(auditRoot, { recursive: true });
  await fs.writeFile(path.join(auditRoot, name), `${JSON.stringify(value, null, 2)}\n`);
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findFirst({
      where: { modelType: model, enabled: true, ...(requestedProvider ? { label: requestedProvider } : {}) },
      orderBy: [{ preferred: "desc" }, { priority: "asc" }, { updatedAt: "desc" }]
    });
    if (!provider?.apiKey || !provider.aiUrl) throw new Error(`No enabled provider found for ${model}`);
    return { id: provider.id, label: provider.label, baseUrl: normalizeBaseUrl(provider.aiUrl), apiKey: provider.apiKey, model: provider.modelType };
  } finally {
    await prisma.$disconnect();
  }
}

async function downloadResult(url, key) {
  let lastError;
  for (let attempt = 1; attempt <= downloadAttempts; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "no-store", dispatcher, signal: AbortSignal.timeout(90_000) });
      if (!response.ok) throw new Error(`download_status_${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < downloadAttempts) console.warn(`${key}: result download failed (${attempt}/${downloadAttempts}); retrying read-only download`);
    }
  }
  throw new Error(`${key}:result_download_failed:${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function generate(provider, task) {
  const idempotencyKey = `storefront:${task.key}:${requestSalt}`.slice(0, 180);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${provider.baseUrl}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}`, "Idempotency-Key": idempotencyKey },
      dispatcher,
      signal: controller.signal,
      body: JSON.stringify({ model: provider.model, prompt: task.prompt, size: createSize, quality: "high", response_format: "b64_json" })
    });
    const body = await response.json().catch(() => ({}));
    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
    await audit(`${task.key}.json`, { createdAt: new Date().toISOString(), taskKey: task.key, providerId: provider.id, providerLabel: provider.label, model: provider.model, endpoint: `${provider.baseUrl}/images/generations`, idempotencyKey, requestId, status: response.status, body: redact(body) });
    if (!response.ok) throw new Error(`${task.key}:provider_failed:${response.status}`);
    const b64 = imageBase64(body);
    if (b64) return { buffer: Buffer.from(b64, "base64"), requestId };
    const resultUrl = imageUrl(body);
    if (!resultUrl) throw new Error(`${task.key}:empty_image_payload`);
    return { buffer: await downloadResult(resultUrl, task.key), requestId };
  } finally {
    clearTimeout(timer);
  }
}

async function writeAsset(task, buffer) {
  const sourceRoot = path.join(repoRoot, "public/assets/dreamshoot/story-video");
  const cleanRoot = path.join(repoRoot, "public/assets/dreamshoot/generated/video-topic-clean/story-video");
  const basename = task.key;
  const pipeline = sharp(buffer).rotate().resize(outputWidth, outputHeight, { fit: "cover", position: "attention" }).sharpen({ sigma: 0.35 });
  await fs.mkdir(sourceRoot, { recursive: true });
  await fs.mkdir(cleanRoot, { recursive: true });
  const encoded = await pipeline.clone().webp({ quality: 92, smartSubsample: true }).toBuffer();
  const png = await pipeline.clone().png({ compressionLevel: 9 }).toBuffer();
  await fs.writeFile(path.join(sourceRoot, `${basename}.webp`), encoded);
  await fs.writeFile(path.join(sourceRoot, `${basename}.png`), png);
  await fs.writeFile(path.join(cleanRoot, `${basename}.webp`), encoded);
}

console.log(JSON.stringify({ dryRun, model, createSize, output: `${outputWidth}x${outputHeight}`, provider: requestedProvider || "preferred", paidCreateAttempts: tasks.length, attemptsPerCreate: 1, stopOnFirstError: true, tasks: tasks.map(({ key }) => key) }, null, 2));
if (!dryRun) {
  const provider = await loadProvider();
  console.log(`using platform AI provider: ${provider.label} (${provider.model}); one create per task, no paid retries`);
  for (const task of tasks) {
    console.log(`generating ${task.key}`);
    const result = await generate(provider, task);
    await writeAsset(task, result.buffer);
    console.log(JSON.stringify({ key: task.key, requestId: result.requestId, output: `public/assets/dreamshoot/generated/video-topic-clean/story-video/${task.key}.webp` }));
  }
}
