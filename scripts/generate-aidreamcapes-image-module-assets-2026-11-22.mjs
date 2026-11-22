#!/usr/bin/env node
// One-off paid image generation for the AIVideosUGC image-module step 2.
//
// The owner approved one gpt-image-2 packaging-design image. The platform
// provider is normally disabled, so this script reads the named provider by id
// and requires an explicit one-off confirmation instead of changing the global
// provider state. It performs exactly one create request.
//
// Run from the current production release directory:
//   node scripts/generate-aidreamcapes-image-module-assets-2026-11-22.mjs
//   node scripts/generate-aidreamcapes-image-module-assets-2026-11-22.mjs \
//     --apply --confirm=image4-one-off
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const applying = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm=image4-one-off");
const providerId = process.env.IMAGE_PROVIDER_ID || "aiprov_image4_mysub2api";
const output = process.env.IMAGE_OUTPUT || "/tmp/aidreamcapes-coffee-pouch-design-2026-11-22.webp";
const auditDir = process.env.IMAGE_AUDIT_DIR || "/tmp/aidreamcapes-image-module-2026-11-22";
const model = "gpt-image-2";
const timeoutMs = 300_000;

const prompt = [
  "Use case: photorealistic-product",
  "Asset type: ecommerce packaging design preview for a premium coffee brand",
  "Primary request: show a newly designed stand-up kraft-paper coffee pouch on a warm cafe counter.",
  "Product: one 250g stand-up coffee pouch with side gussets, matte kraft paper, a clean rectangular front label panel, sealed top, no hands.",
  "Design: deep espresso-brown front panel with a thin warm copper frame, a simple abstract coffee-bean mark, one large clean word COFFEE in a restrained modern serif, generous empty space, no small print, no barcode, no QR code.",
  "Scene: warm oak cafe counter, soft window light from the left, a few loose coffee beans and a blurred neutral cafe background, no other products.",
  "Composition: square 1:1, full pouch visible with even margins, front label panel facing the camera, product fills about 70% of the frame, sharp label edges.",
  "Style: premium specialty-coffee packaging photography, realistic paper texture, soft natural shadow, polished but not glossy.",
  "Constraints: exactly one coffee pouch; no hands, no cups, no second package, no readable small text, no logos, no watermarks, no UI, no mockup text, no celebrity likeness."
].join("\n");

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

function redact(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => {
    if (/(?:b64|base64)/i.test(key) && typeof value === "string") return `[omitted:${value.length}]`;
    return value;
  }));
}

async function loadProvider() {
  const db = new PrismaClient();
  try {
    const provider = await db.platformAiProvider.findUnique({ where: { id: providerId } });
    assert.ok(provider, `image provider ${providerId} not found`);
    assert.equal(provider.modelType, model, `provider model drifted: ${provider.modelType}`);
    assert.equal(provider.providerType, "image", `provider type drifted: ${provider.providerType}`);
    assert.ok(provider.apiKey, `provider ${providerId} has no API key`);
    assert.ok(provider.aiUrl, `provider ${providerId} has no AI URL`);
    return {
      id: provider.id,
      label: provider.label,
      enabled: provider.enabled,
      baseUrl: normalizeBaseUrl(provider.aiUrl),
      apiKey: provider.apiKey,
      model: provider.modelType
    };
  } finally {
    await db.$disconnect();
  }
}

async function downloadImage(url) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(90_000) });
  assert.ok(response.ok, `result download failed: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function createImage(provider) {
  const idempotencyKey = "aidreamcapes:image-module:coffee-pouch-design:2026-11-22";
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
      signal: controller.signal,
      body: JSON.stringify({
        model: provider.model,
        prompt,
        size: "1024x1024",
        quality: "high",
        response_format: "b64_json"
      })
    });
    const body = await response.json().catch(() => ({}));
    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
    await fs.mkdir(auditDir, { recursive: true });
    await fs.writeFile(path.join(auditDir, "coffee-pouch-design.json"), `${JSON.stringify({
      createdAt: new Date().toISOString(),
      providerId: provider.id,
      providerLabel: provider.label,
      providerEnabled: provider.enabled,
      model: provider.model,
      endpoint: `${provider.baseUrl}/images/generations`,
      idempotencyKey,
      requestId,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      prompt,
      body: redact(body)
    }, null, 2)}\n`);
    assert.ok(response.ok, `image provider failed: ${response.status}`);
    const b64 = imageBase64(body);
    const buffer = b64 ? Buffer.from(b64, "base64") : await downloadImage(imageUrl(body));
    return { buffer, requestId };
  } finally {
    clearTimeout(timer);
  }
}

const plan = {
  applying,
  paidCreateCap: 1,
  attemptsPerCreate: 1,
  stopOnFirstError: true,
  providerId,
  model,
  output,
  auditDir,
  prompt
};
console.log(JSON.stringify(plan, null, 2));
if (!applying) process.exit(0);
assert.ok(confirmed, "Paid image generation requires --confirm=image4-one-off");

const provider = await loadProvider();
console.log(JSON.stringify({ provider: { id: provider.id, label: provider.label, enabled: provider.enabled, model: provider.model, baseUrl: provider.baseUrl } }, null, 2));
const result = await createImage(provider);
await fs.mkdir(path.dirname(output), { recursive: true });
await sharp(result.buffer)
  .rotate()
  .resize(1024, 1024, { fit: "cover", position: "entropy" })
  .sharpen({ sigma: 0.35 })
  .webp({ quality: 92, smartSubsample: true })
  .toFile(output);
console.log(JSON.stringify({ ok: true, paidCreateAttempts: 1, output, requestId: result.requestId }, null, 2));
