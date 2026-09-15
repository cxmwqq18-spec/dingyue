#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const APPLY = process.argv.includes("--apply");
const SITE_ID = "site_mydreamshoots_xby";
const PAGE_PATH = "/ai-save-the-date/valentines-day";
const PROVIDER_LABEL = "buming-image";
const MODEL = "gpt-image-2";
const REQUEST_SIZE = "1536x1024";
const QUALITY = "high";
const TARGET_WIDTH = 3840;
const BATCH_ID = "valentines-day-vendor-no-crop-20260915-v1";
const PUBLIC_BASE = `/assets/sites/site_aidreamshoots/visuals/save-the-date/valentines-day/${BATCH_ID}`;
const LOCAL_BASE = path.resolve("public", PUBLIC_BASE.slice(1));
const ORIGINAL_PUBLIC_BASE = `${PUBLIC_BASE}/originals`;
const ORIGINAL_LOCAL_BASE = path.join(LOCAL_BASE, "originals");
const REPORT_PATH = path.resolve(`releases/provider-results/aidreamshoots/save-the-date/${BATCH_ID}.json`);
const MAX_PAID_CREATE_ATTEMPTS = 11;
const PRICE_PER_REQUEST_USD = 0.0075;

const tasks = [
  ["hero-valentines-day-save-the-date-city-couple.jpg", "An original fictional adult engaged couple in elegant eveningwear standing together on a European waterfront promenade at blue hour, both complete faces and upper bodies fully inside the frame, distant city lights and calm water, refined Valentine wedding announcement mood, landscape 3:2 editorial photography, generous clean negative space on the left, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["hero-valentines-day-save-the-date-couple-candlelight.jpg", "An original fictional adult engaged couple sharing a tender moment during an elegant Valentine's Day candlelit dinner, both faces fully visible and comfortably inside the frame, dark wood table, warm candles, subtle red roses, refined red and amber palette, landscape 3:2 editorial photography, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["hero-valentines-day-save-the-date-proposal.jpg", "An original fictional adult man proposing to an adult woman in a rose garden at blue hour, both full faces and natural hands visible inside a spacious landscape frame, warm string lights and lanterns, believable ring, romantic Valentine's Day save-the-date story, landscape 3:2 editorial photography, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["valentines-day-save-the-date-beach-couple.jpg", "An original fictional adult engaged couple embracing near the waterline on a quiet beach at sunset, both bodies and faces fully contained in the landscape frame, pastel peach and rose sky, gentle waves and wet sand, restrained Valentine mood, landscape 3:2 editorial wedding photography, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["valentines-day-save-the-date-candlelight-dinner.jpg", "An original fictional adult engaged couple seated across an elegant Valentine's Day dinner table, both faces and both hands clearly visible inside the frame while making a gentle champagne toast, candles, red roses, crystal glasses, warm amber and burgundy palette, landscape 3:2 editorial photography, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["valentines-day-save-the-date-celebration-hug.jpg", "An original fictional adult couple celebrating their engagement with a warm natural embrace on a romantic garden terrace at dusk, both faces fully visible and their upper bodies completely inside the frame, fairy lights, lanterns, rose petals, elegant eveningwear, landscape 3:2 wedding keepsake photography, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["valentines-day-save-the-date-couple-planning.jpg", "An original fictional adult engaged couple reviewing wedding plans together at a warm home table, both faces, upper bodies, and hands fully visible inside the frame, blank abstract laptop screen with no writing, cream stationery, one red rose, soft lamp light, landscape 3:2 editorial lifestyle photography, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["valentines-day-save-the-date-beach-walk.jpg", "An original fictional adult couple walking hand in hand along a quiet beach at late sunset, both complete bodies and visible profiles fully inside the landscape frame, footprints, shallow shoreline, and one simple heart drawn in the sand, airy romantic Valentine's Day save-the-date mood, landscape 3:2 editorial photography, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["valentines-day-save-the-date-heart-bokeh-couple.jpg", "An original fictional adult engaged couple in formal eveningwear standing close together on an elegant terrace after sunset, both faces fully visible and comfortably framed, a few subtle heart-shaped red and blush lights softly blurred behind them, refined Valentine wedding editorial mood, landscape 3:2 photography, no readable text, logos, watermark, border, collage, UI, or cropped people."],
  ["valentines-day-save-the-date-invitation-envelope.jpg", "An original fictional adult couple at a softly lit wedding stationery table, both faces, upper bodies, and hands fully visible inside the frame while holding a closed cream envelope with one red heart wax seal, cream paper and rose petals, warm neutral light, landscape 3:2 Valentine's Day save-the-date editorial photography, envelope has no writing, no logos, watermark, border, collage, UI, or cropped people."],
  ["valentines-day-save-the-date-rose-garden-couple.jpg", "An original fictional adult couple walking together beside a rose garden pathway at early evening, both complete bodies and faces fully inside a spacious landscape frame, red and blush roses, low lanterns, warm string lights, elegant closing image for a Valentine's Day save-the-date story, landscape 3:2 editorial photography, no readable text, logos, watermark, border, collage, UI, or cropped people."]
].map(([filename, prompt], index) => ({ filename, prompt, index }));

assert.equal(tasks.length, MAX_PAID_CREATE_ATTEMPTS);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function providerBaseUrl(value) {
  const base = String(value || "").trim().replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : `${base}/v1`;
}

function imagePayload(body) {
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
    ?? body?.url
    ?? body?.image_url;
}

async function responseImageBuffer(body) {
  const encoded = imagePayload(body);
  if (encoded) return Buffer.from(encoded, "base64");
  const url = imageUrl(body);
  if (!url) throw new Error("provider_response_missing_image");
  const response = await fetch(String(url), { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function extensionFor(buffer) {
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  throw new Error("provider_response_unknown_image_format");
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function rawPublicUrl(filename, extension) {
  return `${ORIGINAL_PUBLIC_BASE}/${filename.replace(/\.jpg$/i, `.${extension}`)}`;
}

async function writeNoCrop4k(buffer, outputPath) {
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();
  assert(metadata.width && metadata.height, "provider image dimensions are unavailable");
  const height = Math.max(1, Math.round(TARGET_WIDTH * metadata.height / metadata.width));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await image
    .resize(TARGET_WIDTH, height, { fit: "fill", withoutEnlargement: false })
    .jpeg({ quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(outputPath);
  return { width: TARGET_WIDTH, height };
}

function patchPageJson(value, assets) {
  if (Array.isArray(value)) return value.map((item) => patchPageJson(item, assets));
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, patchPageJson(child, assets)]));
  const filename = typeof next.imageUrl === "string"
    ? next.imageUrl.split("?")[0].split("/").at(-1)
    : "";
  const asset = assets.get(filename);
  if (!asset) return next;
  return {
    ...next,
    imageUrl: asset.displayUrl,
    imageOriginalUrl: asset.originalUrl,
    imageWidth: asset.width,
    imageHeight: asset.height
  };
}

async function main() {
  if (!APPLY) throw new Error("paid_generation_requires_--apply");
  assertNonProductionWriteTarget();

  const prisma = new PrismaClient();
  const report = {
    siteId: SITE_ID,
    pagePath: PAGE_PATH,
    providerLabel: PROVIDER_LABEL,
    model: MODEL,
    endpoint: "/v1/images/generations",
    method: "POST",
    requestSize: REQUEST_SIZE,
    outputRule: "preserve provider aspect ratio; width 3840; no crop; original response bytes retained",
    quality: QUALITY,
    maxPaidCreateAttempts: MAX_PAID_CREATE_ATTEMPTS,
    estimatedMaxCostUsd: Number((MAX_PAID_CREATE_ATTEMPTS * PRICE_PER_REQUEST_USD).toFixed(4)),
    noAutomaticRetry: true,
    noProviderFallback: true,
    attempts: []
  };

  try {
    const provider = await prisma.platformAiProvider.findFirst({
      where: { label: PROVIDER_LABEL, modelType: MODEL, providerType: "image", enabled: true },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true }
    });
    if (!provider?.apiKey || !provider.aiUrl) throw new Error("configured_vendor_provider_missing_api_credentials");
    const baseUrl = providerBaseUrl(provider.aiUrl);
    const modelsResponse = await fetch(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(30_000)
    });
    if (!modelsResponse.ok) throw new Error(`provider_read_only_models_check_failed:${modelsResponse.status}`);
    report.providerId = provider.id;
    report.providerBaseUrl = baseUrl;
    report.readOnlyModelCheck = { status: modelsResponse.status, ok: true };
    await writeJson(REPORT_PATH, report);

    const assets = new Map();
    for (const task of tasks) {
      const requestId = `aidreamshoots:${SITE_ID}:valentines-no-crop-v1:${task.filename}`;
      const startedAt = Date.now();
      const attempt = { filename: task.filename, requestId, status: "started", paidCreateAttempt: task.index + 1 };
      report.attempts.push(attempt);
      await writeJson(REPORT_PATH, report);
      const response = await fetch(`${baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
          "Idempotency-Key": requestId,
          "X-Client-Request-Id": requestId
        },
        body: JSON.stringify({ model: MODEL, prompt: task.prompt, size: REQUEST_SIZE, quality: QUALITY, n: 1, response_format: "b64_json" }),
        signal: AbortSignal.timeout(300_000)
      });
      const body = await response.json().catch(() => ({}));
      attempt.status = response.status;
      attempt.ok = response.ok;
      attempt.elapsedMs = Date.now() - startedAt;
      attempt.providerRequestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
      attempt.providerTaskId = body?.id ?? body?.task_id ?? body?.data?.[0]?.id ?? "";
      attempt.responseShape = { hasBase64: Boolean(imagePayload(body)), hasUrl: Boolean(imageUrl(body)) };
      await writeJson(REPORT_PATH, report);
      if (!response.ok) throw new Error(`${task.filename}:provider_create_failed:${response.status}`);

      const rawBuffer = await responseImageBuffer(body);
      const extension = extensionFor(rawBuffer);
      const rawPath = path.join(ORIGINAL_LOCAL_BASE, task.filename.replace(/\.jpg$/i, `.${extension}`));
      const displayPath = path.join(LOCAL_BASE, task.filename);
      await fs.mkdir(path.dirname(rawPath), { recursive: true });
      await fs.writeFile(rawPath, rawBuffer);
      const dimensions = await writeNoCrop4k(rawBuffer, displayPath);
      const displayUrl = `${PUBLIC_BASE}/${task.filename}`;
      const originalUrl = rawPublicUrl(task.filename, extension);
      const rawHash = sha256(rawBuffer);
      const displayHash = sha256(await fs.readFile(displayPath));
      assets.set(task.filename, { ...dimensions, displayUrl, originalUrl, rawHash, displayHash, originalPath: rawPath, displayPath });
      attempt.originalBytes = rawBuffer.length;
      attempt.originalHash = rawHash;
      attempt.displayHash = displayHash;
      attempt.outputWidth = dimensions.width;
      attempt.outputHeight = dimensions.height;
      attempt.status = "succeeded";
      await writeJson(REPORT_PATH, report);
      console.log(`succeeded ${task.index + 1}/${tasks.length}: ${task.filename} -> ${dimensions.width}x${dimensions.height}, original preserved`);
    }

    assert.equal(assets.size, tasks.length);
    const page = await prisma.themePage.findUnique({
      where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_PATH } },
      select: { id: true, draftJson: true, publishedJson: true }
    });
    if (!page) throw new Error("valentines_day_theme_page_missing");
    const nextDraft = patchPageJson(page.draftJson, assets);
    const nextPublished = patchPageJson(page.publishedJson && Object.keys(page.publishedJson).length ? page.publishedJson : page.draftJson, assets);
    const hero = assets.get(tasks[0].filename);
    if (nextDraft?.seo && typeof nextDraft.seo === "object") nextDraft.seo.ogImage = hero.displayUrl;
    if (nextPublished?.seo && typeof nextPublished.seo === "object") nextPublished.seo.ogImage = hero.displayUrl;
    if (Array.isArray(nextDraft?.mediaManifest)) {
      nextDraft.mediaManifest = nextDraft.mediaManifest.map((item) => {
        const asset = assets.get(item.filename);
        return asset ? { ...item, src: asset.displayUrl, originalSrc: asset.originalUrl, originalUrl: asset.originalUrl, width: asset.width, height: asset.height } : item;
      });
    }
    if (Array.isArray(nextPublished?.mediaManifest)) {
      nextPublished.mediaManifest = nextPublished.mediaManifest.map((item) => {
        const asset = assets.get(item.filename);
        return asset ? { ...item, src: asset.displayUrl, originalSrc: asset.originalUrl, originalUrl: asset.originalUrl, width: asset.width, height: asset.height } : item;
      });
    }

    await prisma.$transaction(async (tx) => {
      for (const task of tasks) {
        const asset = assets.get(task.filename);
        const storageKey = asset.displayUrl.slice(1);
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: SITE_ID, storageKey } },
          create: {
            id: `media_${SITE_ID}_valentines_no_crop_${task.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
            siteId: SITE_ID,
            label: task.filename,
            storageKey,
            mimeType: "image/jpeg",
            usageType: "theme",
            sourceType: "save-the-date-valentines-day-vendor-api-gpt-image-2-original-preserved-v1",
            previewUrl: asset.displayUrl,
            originUrl: asset.originalUrl,
            altText: "",
            notes: "Vendor API original bytes preserved; 4K display derivative is resized without crop."
          },
          update: {
            previewUrl: asset.displayUrl,
            originUrl: asset.originalUrl,
            sourceType: "save-the-date-valentines-day-vendor-api-gpt-image-2-original-preserved-v1",
            notes: "Vendor API original bytes preserved; 4K display derivative is resized without crop."
          }
        });
      }
      await tx.themePage.update({ where: { id: page.id }, data: { draftJson: nextDraft, publishedJson: nextPublished } });
      await tx.livePage.updateMany({ where: { siteId: SITE_ID, slug: PAGE_PATH }, data: { contentJson: nextPublished } });
    });

    report.completed = true;
    report.paidCreateAttempts = tasks.length;
    report.actualMaxCostUsd = Number((tasks.length * PRICE_PER_REQUEST_USD).toFixed(4));
    report.publishedDisplayBase = PUBLIC_BASE;
    report.publishedOriginalBase = ORIGINAL_PUBLIC_BASE;
    await writeJson(REPORT_PATH, report);
    console.log(JSON.stringify({ ok: true, paidCreateAttempts: tasks.length, actualMaxCostUsd: report.actualMaxCostUsd, displayBase: PUBLIC_BASE, originalBase: ORIGINAL_PUBLIC_BASE, reportPath: REPORT_PATH }, null, 2));
  } catch (error) {
    report.completed = false;
    report.failure = error instanceof Error ? error.message : String(error);
    await writeJson(REPORT_PATH, report);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
