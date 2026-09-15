#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();
const confirmation = String(args.confirm || "");
const expectedConfirmation = "aidreamshoots-diverse-regeneration";
const batchId = String(args.batch || "");
const manifestPath = path.resolve(args.manifest || `releases/manifests/${batchId}.json`);
const taskId = String(args.task || "");
const timeoutMs = Number(args.timeoutMs || 600_000);
const imageModel = "gpt-image-2";
const imageSize = "1024x1024";
const quality = String(args.quality || "low");
const replacementDirection = String(args.replacementDirection || "Use one original consenting adult standing full-body on an open-air brutalist city rooftop at warm sunset, with wet concrete, sculptural parapets and a distant skyline; use a burnt-orange or cobalt windbreaker and a clear walking or turning gesture. Do not use a café, bus, train, car, indoor window, laptop, seated pose, hand-on-cheek pose, cream sweater, tight face close-up, rainy glass background, or the same person from another slot. Prioritize a wide environmental composition, strong diagonal architecture, warm golden light and visible pavement reflections.");
const replacementAltText = String(args.replacementAltText || "Urbano: retrato urbano de una persona adulta en una azotea al atardecer, imagen generada con IA para la galería privada de AIdreamshoots, variación visual 08.");

function parseArgs(list) {
  const result = {};
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equals = raw.indexOf("=");
    const key = (equals >= 0 ? raw.slice(0, equals) : raw).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equals >= 0) result[key] = raw.slice(equals + 1);
    else if (list[index + 1] && !list[index + 1].startsWith("--")) { result[key] = list[index + 1]; index += 1; }
    else result[key] = true;
  }
  return result;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function redact(value) {
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (/(?:b64|base64)/i.test(key) && typeof item === "string") return `[omitted:${item.length}]`;
    return item;
  }));
}

function payload(body) {
  return body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64 ?? body?.image_base64;
}

function replacementPrompt(previousPrompt, direction) {
  return [
    previousPrompt,
    "Replacement direction: make this candidate unmistakably different from every other staged image, especially any rainy-window close-up.",
    direction
  ].join("\n");
}

async function loadProvider() {
  assertDatabaseTarget({ expectedTarget: "local" });
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findFirst({
      where: { modelType: imageModel, enabled: true },
      orderBy: [{ preferred: "desc" }, { priority: "asc" }, { updatedAt: "desc" }]
    });
    assert(provider?.apiKey && provider.aiUrl, `No enabled provider found for ${imageModel}.`);
    return { id: provider.id, label: provider.label, baseUrl: normalizeBaseUrl(provider.aiUrl), apiKey: provider.apiKey, model: provider.modelType };
  } finally { await prisma.$disconnect(); }
}

async function main() {
  assert(confirmation === expectedConfirmation, `Replacement requires --confirm=${expectedConfirmation}.`);
  assert(batchId && taskId, "Replacement requires --batch and --task.");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(manifest.batchId === batchId, `Manifest batch id ${manifest.batchId} does not match ${batchId}.`);
  const task = manifest.tasks.find((item) => item.id === taskId);
  assert(task, `Task not found: ${taskId}`);
  assert(task.status === "succeeded" && fs.existsSync(task.stageFile), "Replacement requires an existing staged image.");

  const provider = await loadProvider();
  const modelsResponse = await fetch(`${provider.baseUrl}/models`, { headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(30_000) });
  assert(modelsResponse.ok, `Provider read-only model check failed with ${modelsResponse.status}.`);

  const previousPrompt = task.prompt;
  const previousStage = `${task.stageFile}.before-replacement`;
  fs.copyFileSync(task.stageFile, previousStage);
  task.prompt = replacementPrompt(previousPrompt, replacementDirection);
  task.altText = replacementAltText;
  const replacementKey = `${confirmation}:${manifest.batchId}:${task.id}:replacement-01`;
  const startedAt = Date.now();
  let response;
  let body = {};
  try {
    response = await fetch(`${provider.baseUrl}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}`, "Idempotency-Key": replacementKey, "X-Client-Request-Id": `${task.id}-replacement-01` },
      body: JSON.stringify({ model: provider.model, prompt: task.prompt, size: imageSize, quality, response_format: "b64_json" }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    body = await response.json().catch(() => ({}));
  } catch (error) {
    task.prompt = previousPrompt;
    writeJson(manifestPath, manifest);
    throw new Error(`Replacement provider state is ambiguous; stopped without retry: ${error instanceof Error ? error.message : String(error)}`);
  }

  const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
  const auditPath = path.join(path.dirname(manifestPath), `${manifest.batchId}-${task.id}-replacement-provider.json`);
  writeJson(auditPath, { taskId: task.id, providerId: provider.id, providerLabel: provider.label, model: provider.model, endpoint: `${provider.baseUrl}/images/generations`, idempotencyKey: replacementKey, clientRequestId: `${task.id}-replacement-01`, requestId, status: response.status, elapsedMs: Date.now() - startedAt, response: redact(body), retryPolicy: "no-retry" });
  assert(response.ok, `Replacement provider create failed with ${response.status}; stopped without retry.`);
  const encoded = payload(body);
  assert(encoded, "Replacement provider returned no image payload.");
  const replacementFile = `${task.stageFile}.replacement`;
  await sharp(Buffer.from(encoded, "base64")).rotate().resize(1024, 1024, { fit: "cover", position: "entropy" }).webp({ quality: 92, smartSubsample: true }).toFile(replacementFile);
  fs.renameSync(replacementFile, task.stageFile);
  task.outputHash = sha256(fs.readFileSync(task.stageFile));
  task.providerRequestId = requestId;
  task.error = "";
  manifest.runtime.paidCreateAttempts = Number(manifest.runtime.paidCreateAttempts || 0) + 1;
  manifest.runtime.replacementAttempts = Number(manifest.runtime.replacementAttempts || 0) + 1;
  manifest.runtime.replacedTaskIds = [...new Set([...(manifest.runtime.replacedTaskIds || []), task.id])];
  manifest.diversityResult = null;
  writeJson(manifestPath, manifest);
  console.log(JSON.stringify({ ok: true, batchId, taskId, replacement: true, paidCreateAttempts: manifest.runtime.paidCreateAttempts, previousStage, auditPath }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
