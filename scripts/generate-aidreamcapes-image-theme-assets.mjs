#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { validateAidreamcapesImageThemePages } from "./lib/aidreamcapes-image-theme-pages.mjs";

const siteId = "site_aidreamcapes";
const providerId = "aiprov_image4_mysub2api";
const model = "gpt-image-2";
const repoRoot = process.cwd();
const publicRoot = path.resolve(repoRoot, "public/assets/sites/site_aidreamcapes");
const rawArgs = process.argv.slice(2);
const args = new Map();
const flags = new Set();
for (let index = 0; index < rawArgs.length; index += 1) {
  const raw = rawArgs[index];
  if (!raw.startsWith("--")) continue;
  const [key, ...rest] = raw.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
    continue;
  }
  const next = rawArgs[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    index += 1;
  } else {
    flags.add(key);
  }
}

const generate = flags.has("generate");
const paidConfirmation = flags.has("confirm-paid");
const force = flags.has("force");
const maxPaidCreates = Number(args.get("max-paid-creates") ?? 0);
const timeoutMs = Number(args.get("timeout-ms") ?? 300_000);
const concurrency = Number(args.get("concurrency") ?? 4);
const continueOnError = flags.has("continue-on-error");
const skippedAssets = new Set(String(args.get("skip-assets") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const selectedSlugs = new Set(String(args.get("slugs") ?? "").split(",").map((value) => value.trim()).filter(Boolean));
const outputProfile = String(args.get("output-profile") ?? "4k").trim().toLowerCase();
const resultRoot = path.resolve(repoRoot, `releases/provider-results/aidreamcapes/image-themes-v3-${outputProfile}`);

assert.ok(Number.isInteger(maxPaidCreates) && maxPaidCreates >= 0 && maxPaidCreates <= 268, "max-paid-creates must be an integer from 0 to 268.");
assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 30_000 && timeoutMs <= 900_000, "timeout-ms must be between 30000 and 900000.");
assert.ok(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 6, "concurrency must be an integer from 1 to 6.");
assert.ok(["4k", "native-1880"].includes(outputProfile), "output-profile must be 4k or native-1880.");
assert.equal(flags.has("retry"), false, "Retries are disabled for paid image creation.");

const allPages = validateAidreamcapesImageThemePages({ requireAssets: false });
const pages = allPages.filter((page) => !selectedSlugs.size || selectedSlugs.has(page.seo.canonicalPath.split("/").pop()));
assert.ok(pages.length > 0, "No matching image theme pages.");

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function pageSlug(page) {
  return page.seo.canonicalPath.split("/").filter(Boolean).pop();
}

function pageAssetDirectory(page) {
  const slug = pageSlug(page);
  return path.join(publicRoot, `${slug}-v1`, slug);
}

function sourceImages(page) {
  return [page.hero.productImage, page.hero.outputImage, ...page.examples.items.map((item) => item.image)];
}

function outputName(index) {
  if (index === 0) return "source-input";
  if (index === 1) return "hero-output";
  return `example-${String(index - 1).padStart(2, "0")}`;
}

function providerSizeFor(image) {
  const ratio = image.width / image.height;
  if (outputProfile === "native-1880") {
    if (Math.abs(ratio - 1) < 0.03) return "1880x1880";
    if (ratio > 1) return "3344x1880";
    return "1880x3344";
  }
  if (Math.abs(ratio - 1) < 0.03) return "2880x2880";
  if (ratio > 1) return "3840x2160";
  return "2160x3840";
}

function providerDimensionsFor(image) {
  const [width, height] = providerSizeFor(image).split("x").map(Number);
  return { width, height };
}

function providerAspectRatioFor(image) {
  const ratio = image.width / image.height;
  if (Math.abs(ratio - 1) < 0.03) return "1:1";
  return ratio > 1 ? "16:9" : "9:16";
}

function imageStyleFor(page, image, index) {
  const styleFamilies = [
    "quiet studio light with a warm neutral surface",
    "soft daylight with gentle natural shadows",
    "clean editorial light with a restrained background",
    "bright catalog light with generous breathing room",
    "cinematic but believable contrast with controlled highlights",
    "calm architectural setting with simple lines"
  ];
  const style = styleFamilies[index % styleFamilies.length];
  return `${style}; keep the ${page.subject ?? "main subject"} clear and make this composition visibly different from the other images on this page`;
}

function imagePrompt(page, image, index, total) {
  return [
    `Create one photorealistic final image for an Aidreamcapes ${page.seo.title.replace(/\s*\|\s*Aidreamcapes$/i, "")} page.`,
    `This is independent image ${index + 1} of ${total} for the page. The subject reserved for this theme is ${page.subject ?? "the subject described below"}. Do not import a product or person from another theme. Do not create a contact sheet, collage, split screen, title card, or blank panel.`,
    `Image direction: ${image.alt}.`,
    `Visual treatment: ${imageStyleFor(page, image, index)}.`,
    "Use clean, believable photography suited to the page topic. Each request must have its own scene, framing, lighting, and visual treatment; never reuse a generic prompt composition. Keep the main subject sharp and naturally composed for the requested image shape.",
    "Use only fictional adults or reference images the customer is authorized to use. No logos, brand names, readable text, prices, buttons, web pages, app interfaces, platform marks, watermarks, fake reviews, public figures, or invented product claims."
  ].join("\n");
}

function imageBufferFromBody(body) {
  const encoded = body?.data?.[0]?.b64_json
    ?? body?.data?.[0]?.image_base64
    ?? body?.output?.[0]?.b64_json
    ?? body?.output?.[0]?.image_base64
    ?? body?.image_base64;
  return encoded ? Buffer.from(encoded, "base64") : undefined;
}

async function downloadImage(url, providerOrigin, apiKey) {
  const imageUrl = new URL(url);
  assert.equal(imageUrl.protocol, "https:", "provider image URLs must use HTTPS.");
  assert.equal(imageUrl.origin, providerOrigin, "provider image URL origin must match the configured provider origin.");
  const response = await fetch(imageUrl, { method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, preferred: true, maxImagesPerRequest: true, supportsGenerationN: true, supportsEditN: true, imageAspectRatio: true, imageResolution: true, imageQuality: true, imageOutputFormat: true }
    });
    assert(provider, `${providerId}: provider not found`);
    assert.equal(provider.label, "image4");
    assert.equal(provider.modelType, model);
    assert.equal(provider.providerType, "image");
    assert.equal(provider.enabled, true);
    assert.equal(provider.supportsGenerationN, true);
    assert.equal(provider.supportsEditN, true);
    assert.ok(provider.maxImagesPerRequest >= 1 && provider.maxImagesPerRequest <= 10, "image4 maxImagesPerRequest must be between 1 and 10.");
    assert.ok(provider.apiKey && provider.aiUrl, "image4 provider is missing credentials or URL.");
    const baseUrl = normalizeBaseUrl(provider.aiUrl);
    const providerOrigin = new URL(baseUrl).origin;
    return { ...provider, baseUrl, providerOrigin };
  } finally {
    await prisma.$disconnect();
  }
}

async function prepareReferenceImage(filePath) {
  const buffer = await fs.readFile(filePath);
  return sharp(buffer).rotate().png().toBuffer();
}

async function imageEditForm(modelName, prompt, size, referenceImagePath) {
  const reference = await prepareReferenceImage(referenceImagePath);
  const form = new FormData();
  form.append("model", modelName);
  form.append("prompt", prompt);
  form.append("size", size);
  form.append("quality", "high");
  form.append("n", "1");
  form.append("response_format", "b64_json");
  form.append("image", new Blob([reference], { type: "image/png" }), `${path.basename(referenceImagePath, path.extname(referenceImagePath))}.png`);
  return form;
}

async function createImage(provider, page, image, index, total, referenceImagePath) {
  const slug = pageSlug(page);
  const name = outputName(index);
  const requestId = `aidreamcapes:image-themes-v3-${outputProfile}:${slug}:${name}:${randomUUID()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const size = providerSizeFor(image);
    const useReference = Boolean(referenceImagePath);
    const quality = String(provider.imageQuality || "high").toLowerCase();
    const response = await fetch(`${provider.baseUrl}/images/${useReference ? "edits" : "generations"}`, {
      method: "POST",
      headers: useReference
        ? { Authorization: `Bearer ${provider.apiKey}`, "Idempotency-Key": requestId, "X-Client-Request-Id": requestId }
        : { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}`, "Idempotency-Key": requestId, "X-Client-Request-Id": requestId },
      signal: controller.signal,
      body: useReference
        ? await imageEditForm(model, imagePrompt(page, image, index, total), size, referenceImagePath)
        : JSON.stringify({
          model,
          prompt: imagePrompt(page, image, index, total),
          size,
          quality,
          n: 1,
          response_format: "b64_json"
        })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${slug}:provider_failed:${response.status}:request=${requestId}`);
    const buffer = imageBufferFromBody(body);
    if (buffer) return { buffer, requestId, responseType: useReference ? "edit_b64_json" : "b64_json", size };
    const imageUrl = body?.data?.[0]?.url ?? body?.output?.[0]?.url ?? body?.url ?? body?.image_url;
    if (imageUrl) return { buffer: await downloadImage(String(imageUrl), provider.providerOrigin, provider.apiKey), requestId, responseType: useReference ? "edit_url" : "url", size };
    throw new Error(`${slug}:provider_empty_image_payload:request=${requestId}`);
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${slug}:provider_request_timeout_or_unknown_state:request=${requestId}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function writeFinalImage(page, image, imageBuffer, index) {
  const metadata = await sharp(imageBuffer).metadata();
  const inputWidth = metadata.width ?? 0;
  const inputHeight = metadata.height ?? 0;
  assert.ok(inputWidth > 0 && inputHeight > 0, `${pageSlug(page)}: invalid provider image dimensions.`);
  const target = providerDimensionsFor(image);
  const minimumAcceptedWidth = target.width * 0.995;
  const minimumAcceptedHeight = target.height * 0.995;
  assert.ok(inputWidth >= minimumAcceptedWidth && inputHeight >= minimumAcceptedHeight, `${pageSlug(page)}:${outputName(index)}:provider_output_below_requested_resolution:${inputWidth}x${inputHeight}:expected_near=${target.width}x${target.height}`);
  const inputRatio = inputWidth / inputHeight;
  const targetRatio = target.width / target.height;
  assert.ok(Math.abs(inputRatio - targetRatio) < 0.01, `${pageSlug(page)}:${outputName(index)}:provider_output_ratio_mismatch:${inputWidth}x${inputHeight}:expected=${target.width}x${target.height}`);
  const directory = pageAssetDirectory(page);
  await fs.mkdir(directory, { recursive: true });
  const name = outputName(index);
  const outputPath = path.join(directory, `${name}.webp`);
  await sharp(imageBuffer)
    .resize(target.width, target.height, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 95, smartSubsample: true })
    .toFile(outputPath);
  const output = await fs.readFile(outputPath);
  const outputMetadata = await sharp(output).metadata();
  return { name, path: outputPath, src: image.src, alt: image.alt, width: outputMetadata.width ?? 0, height: outputMetadata.height ?? 0, hash: hash(output) };
}

async function outputIsReady(filePath, image) {
  try {
    const metadata = await sharp(filePath).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const target = providerDimensionsFor(image);
    return width >= target.width * 0.995 && height >= target.height * 0.995 && Math.abs((width / height) - (target.width / target.height)) < 0.01;
  } catch {
    return false;
  }
}

async function runWithConcurrency(tasks, limit, handler, onError) {
  let cursor = 0;
  let firstError;

  async function worker(workerId) {
    while (!firstError) {
      const taskIndex = cursor;
      cursor += 1;
      if (taskIndex >= tasks.length) return;
      try {
        await handler(tasks[taskIndex], workerId);
      } catch (error) {
        if (onError) {
          await onError(tasks[taskIndex], error, workerId);
          continue;
        }
        firstError ??= error;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, (_, workerId) => worker(workerId)));
  if (firstError) throw firstError;
}

async function writeOgImage(page) {
  const directory = pageAssetDirectory(page);
  const heroPath = path.join(directory, "hero-output.webp");
  const ogPath = path.join(directory, "og.webp");
  await sharp(heroPath)
    .resize(1200, 630, { fit: "cover", position: "attention", withoutEnlargement: true })
    .webp({ quality: 95, smartSubsample: true })
    .toFile(ogPath);
}

async function main() {
  const expectedOutputs = pages.reduce((total, page) => total + sourceImages(page).length, 0);
  const pending = [];
  for (const page of pages) {
    const directory = pageAssetDirectory(page);
    const images = sourceImages(page);
    for (let index = 0; index < images.length; index += 1) {
      const file = `${outputName(index)}.webp`;
      const assetKey = `${pageSlug(page)}/${outputName(index)}`;
      if (skippedAssets.has(assetKey)) continue;
      const exists = !force && await outputIsReady(path.join(directory, file), images[index]);
      if (force || !exists) pending.push({ page, image: images[index], index, total: images.length });
    }
  }
  console.log(JSON.stringify({
    dryRun: !generate,
    siteId,
    provider: "image4",
    model,
    endpoints: ["POST /v1/images/generations", "POST /v1/images/edits"],
    selectedPages: pages.map(pageSlug),
    independentImageRequestsNeeded: pending.length,
    expectedContentImages: expectedOutputs,
    expectedOgImages: pages.length,
    requestedSizes: outputProfile === "native-1880"
      ? { landscape: "3344x1880", portrait: "1880x3344", square: "1880x1880" }
      : { landscape: "3840x2160", portrait: "2160x3840", square: "2880x2880" },
    maxPaidCreates,
    concurrency,
    continueOnError,
    skippedAssets: [...skippedAssets],
    attemptsPerCreate: 1,
    stopOnFirstError: !continueOnError,
    noAutomaticRetryOrFallback: true,
    output: publicRoot,
    resultRoot
  }, null, 2));
  if (!generate) return;
  assert(paidConfirmation, "Paid creation requires --confirm-paid.");
  assert.ok(pending.length <= maxPaidCreates, `paid_create_cap_exceeded:needed=${pending.length}:cap=${maxPaidCreates}`);
  const provider = await loadProvider();
  const report = [];
  const failures = [];
  const completedBeforeRun = expectedOutputs - pending.length;
  let completedDuringRun = 0;
  let processedDuringRun = 0;
  let progressWrite = Promise.resolve();
  const persistProgress = () => {
    progressWrite = progressWrite.then(() => fs.writeFile(
      path.join(resultRoot, "generation-progress.json"),
      `${JSON.stringify({ siteId, provider: "image4", model, requestedOutputProfile: "4K-native-or-smaller-only", completed: completedBeforeRun + completedDuringRun, processed: completedBeforeRun + processedDuringRun, failed: failures.length, total: expectedOutputs, pendingAtStart: pending.length, concurrency, continueOnError, report, failures }, null, 2)}\n`,
      "utf8"
    ));
    return progressWrite;
  };
  const createTask = async (task, workerIndex) => {
    const page = task.page;
    const name = outputName(task.index);
    console.log(`provider create ${pageSlug(page)}/${name} (worker ${workerIndex + 1}/${concurrency})`);
    const rawPath = path.join(resultRoot, pageSlug(page), `${name}.png`);
    await fs.mkdir(path.dirname(rawPath), { recursive: true });
    const referenceImagePath = task.index === 0 ? undefined : path.join(pageAssetDirectory(page), "source-input.webp");
    const result = await createImage(provider, page, task.image, task.index, task.total, referenceImagePath);
    await fs.writeFile(rawPath, result.buffer);
    const file = await writeFinalImage(page, task.image, result.buffer, task.index);
    report.push({ slug: pageSlug(page), name, requestId: result.requestId, responseType: result.responseType, requestedSize: result.size, requestedQuality: "high", requestedAspectRatio: providerAspectRatioFor(task.image), outputProfile, rawPath, file });
    completedDuringRun += 1;
    processedDuringRun += 1;
    await persistProgress();
  };
  const onTaskError = async (task, error) => {
    const failure = { slug: pageSlug(task.page), name: outputName(task.index), message: error?.message ?? String(error) };
    failures.push(failure);
    processedDuringRun += 1;
    console.error(`provider create failed: ${failure.slug}/${failure.name}: ${failure.message}`);
    await persistProgress();
  };
  const sourceTasks = pending.filter((task) => task.index === 0);
  const derivedTasks = pending.filter((task) => task.index > 0);
  await runWithConcurrency(sourceTasks, concurrency, createTask, continueOnError ? onTaskError : undefined);
  const failedSourceSlugs = new Set(failures.filter((failure) => failure.name === "source-input").map((failure) => failure.slug));
  const runnableDerivedTasks = derivedTasks.filter((task) => !failedSourceSlugs.has(pageSlug(task.page)));
  await runWithConcurrency(runnableDerivedTasks, concurrency, createTask, continueOnError ? onTaskError : undefined);
  await progressWrite;
  for (const page of pages) {
    if (await outputIsReady(path.join(pageAssetDirectory(page), "hero-output.webp"), page.hero.outputImage)) await writeOgImage(page);
  }
  for (const page of pages) {
    const hashes = report.filter((item) => item.slug === pageSlug(page)).map((item) => item.file.hash);
    assert.equal(new Set(hashes).size, hashes.length, `${pageSlug(page)}: generated images are duplicates.`);
  }
  const reportPath = path.join(resultRoot, "generation-report.json");
  await fs.writeFile(reportPath, `${JSON.stringify({ siteId, provider: "image4", model, paidCreates: report.length + failures.length, generatedImages: report.length, failedCreates: failures.length, attemptsPerCreate: 1, continueOnError, report, failures }, null, 2)}\n`, "utf8");
  if (failures.length && !continueOnError) throw failures[0].message;
  console.log(JSON.stringify({ ok: failures.length === 0, siteId, provider: "image4", model, paidCreates: report.length + failures.length, generatedImages: report.length, failedCreates: failures.length, reportPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
