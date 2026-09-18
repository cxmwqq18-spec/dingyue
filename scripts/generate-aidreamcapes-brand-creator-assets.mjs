#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesBrandCreatorPagesForMigration, validateAidreamcapesBrandCreatorContent } from "./lib/aidreamcapes-brand-creator-content.mjs";

const repoRoot = process.cwd();
const siteId = "site_aidreamcapes";
const providerId = "aiprov_image4_mysub2api";
const model = "gpt-image-2";
const assetRoot = path.resolve(repoRoot, "public/assets/sites/site_aidreamcapes/brand-creator-v1");
const providerRoot = path.resolve(repoRoot, "releases/provider-results/aidreamcapes/brand-creator-v1");
const pages = aidreamcapesBrandCreatorPagesForMigration();
const names = ["product", "hero-output", ...Array.from({ length: 7 }, (_, index) => `example-${String(index + 1).padStart(2, "0")}`)];

const promptByKey = {
  "founder-update": [
    "Create a premium photorealistic 3x3 contact sheet for an AI Founder Update video page.",
    "Use one coherent fictional product: an unbranded matte-silver desktop wireless microphone, notebook, and restrained studio desk. Use one original adult founder in the creator cells, with no resemblance to any public figure.",
    "Cells in exact order: clean microphone product source; hero founder update with the founder speaking at a studio desk; founder opening with a notebook and microphone; close product or process detail supporting a real company update; founder reviewing an approved milestone board with no readable text; permitted behind-the-scenes desk setup; founder comparing two abstract prototype directions; founder looking toward a product sample ready for the next step; calm closing founder portrait with clean CTA-safe space.",
    "Make the story about point of view, context, proof, accountability, and a next step—not a generic product advertisement. Keep the same microphone identity and founder identity across relevant cells. No readable text, names, logos, metrics, funding claims, UI, watermarks, fake announcements, celebrity likeness, or collage borders. Every cell is one complete square photograph."
  ].join("\n"),
  "multilingual-video": [
    "Create a premium photorealistic 3x3 contact sheet for an AI Multilingual Video Localization page.",
    "Use one coherent fictional product: an unbranded teal travel charger with blank storyboard cards in a market-neutral studio. Use one original adult presenter, with no resemblance to any public figure.",
    "Cells in exact order: clean teal charger source product; hero presenter explaining the charger with subtitle-safe composition; presenter reviewing blank source storyboard cards; presenter speaking with generous lower-frame safe area; close presenter frame emphasizing timing and mouth movement; charger in a neutral transit-ready travel context; reviewer and presenter checking blank language cards; presenter demonstrating the product with clean side space; closing market-neutral presenter and charger frame with CTA-safe space.",
    "Make the story about source intent, language adaptation, pacing, subtitle safety, human review, and a market-specific handoff—not a generic product introduction. Keep product and presenter consistent. No readable text, translated words, flags, country stereotypes, logos, UI, watermarks, fake translation claims, celebrity likeness, or collage borders. Every cell is one complete square photograph."
  ].join("\n"),
  "cinematic-product-film": [
    "Create a premium photorealistic 3x3 contact sheet for an AI Cinematic Product Film page.",
    "Use one coherent fictional product: an unbranded obsidian sculptural wireless speaker. Build a dark architectural world with black stone, soft haze, controlled blue rim light, and warm neutral accents; no brand marks.",
    "Cells in exact order: clean obsidian speaker product source on a neutral plinth; hero cinematic reveal of the speaker in an architectural room; wide establishing world with the speaker small but identifiable; material close-up of the obsidian surface and edge; precise control and grille detail; light traveling across the speaker form; speaker placed in a quiet premium living space; slow editorial product composition with deliberate negative space; final cinematic speaker frame with clear CTA-safe space.",
    "Make the story about world, material, movement, texture, pacing, and a controlled reveal—not unsupported claims of premium quality. Keep speaker shape and identity consistent across every cell. No readable text, logos, interface, watermarks, fake certifications, impossible materials, people, celebrity likeness, or collage borders. Every cell is one complete square photograph."
  ].join("\n"),
  "trending-audio-sync": [
    "Create a premium photorealistic 3x3 contact sheet for an AI Trending Audio Sync short-form video page.",
    "Use one coherent fictional product: an unbranded translucent portable synthesizer and headphones on a color-lit studio table. Use one original adult creator, with no resemblance to any public figure.",
    "Cells in exact order: clean synthesizer and headphones source; hero creator and synthesizer in a color-lit studio reveal; creator checking audio rights with headphones and blank notes; blank beat-map cards beside the synthesizer; controlled hand movement over the translucent controls; close-up of transparent material and knobs catching colored light; creator turning the synthesizer in a readable movement phrase; vertical-safe creator and product composition with clean sides; final synthesizer on the table with negative space for an approved CTA.",
    "Make the story about rights check, beat mapping, visual timing, movement, platform-safe framing, and a deliberate close—not a claim that any audio is currently trending. Keep product and creator identity consistent. No readable text, song lyrics, platform UI, logos, watermarks, fake trend indicators, celebrity likeness, or collage borders. Every cell is one complete square photograph."
  ].join("\n")
};

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
const force = flags.has("force");
const requestedSiteId = String(args.get("site-id") ?? siteId);
const maxPaidCreates = Number(args.get("max-paid-creates") ?? 4);
const attempts = Number(args.get("attempts") ?? 1);
const timeoutMs = Number(args.get("timeout-ms") ?? 300_000);
const selectedKeys = new Set(String(args.get("keys") ?? "").split(",").map((value) => value.trim()).filter(Boolean));

assert.equal(requestedSiteId, siteId, `This asset generator is restricted to ${siteId}.`);
assert.ok(Number.isInteger(maxPaidCreates) && maxPaidCreates >= 0 && maxPaidCreates <= 4, "max-paid-creates must be an integer from 0 to 4.");
assert.equal(attempts, 1, "Provider image creation retries are disabled; attempts must remain 1.");
assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 30_000 && timeoutMs <= 900_000, "timeout-ms must be between 30000 and 900000.");
assert.equal(Object.keys(promptByKey).length, pages.length, "Every Brand / Creator page needs a provider prompt.");
await validateAidreamcapesBrandCreatorContent({ requireAssets: false, log: (line) => console.log(`[content] ${line}`) });

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function allOutputsExist(key) {
  return (await Promise.all(names.flatMap((name) => [
    fileExists(path.join(assetRoot, key, `${key}-${name}.webp`)),
    fileExists(path.join(assetRoot, key, `${key}-${name}.png`))
  ]))).every(Boolean);
}

function imageBufferFromBody(body) {
  const b64 = body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64;
  return b64 ? Buffer.from(b64, "base64") : undefined;
}

async function downloadImage(url, apiKey) {
  const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function generateContactSheet(provider, key) {
  const requestId = `aidreamcapes:brand-creator-v1:${key}`;
  const response = await fetch(`${provider.baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      "Idempotency-Key": requestId,
      "X-Client-Request-Id": requestId
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({ model, prompt: promptByKey[key], size: "1024x1024", quality: "medium", response_format: "b64_json" })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${key}:provider_failed:${response.status}`);
  const b64Buffer = imageBufferFromBody(body);
  if (b64Buffer) return { buffer: b64Buffer, requestId, responseType: "b64_json" };
  const imageUrl = body?.data?.[0]?.url ?? body?.output?.[0]?.url ?? body?.url ?? body?.image_url;
  if (imageUrl) return { buffer: await downloadImage(String(imageUrl), provider.apiKey), requestId, responseType: "url" };
  throw new Error(`${key}:provider_empty_image_payload`);
}

async function cropContactSheet(key, buffer) {
  const source = sharp(buffer);
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  assert(width >= 3 && height >= 3, `${key}: provider output has invalid dimensions`);
  const cellWidth = Math.floor(width / 3);
  const cellHeight = Math.floor(height / 3);
  const outputs = [];
  for (let index = 0; index < names.length; index += 1) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const left = col * cellWidth;
    const top = row * cellHeight;
    const extractWidth = col === 2 ? width - left : cellWidth;
    const extractHeight = row === 2 ? height - top : cellHeight;
    const image = source.clone().extract({ left, top, width: extractWidth, height: extractHeight }).resize(400, 400, { fit: "cover", position: "centre" });
    const outputDir = path.join(assetRoot, key);
    await fs.mkdir(outputDir, { recursive: true });
    const webpPath = path.join(outputDir, `${key}-${names[index]}.webp`);
    const pngPath = path.join(outputDir, `${key}-${names[index]}.png`);
    await image.clone().webp({ quality: 92, smartSubsample: true }).toFile(webpPath);
    await image.clone().png().toFile(pngPath);
    const webpBuffer = await fs.readFile(webpPath);
    outputs.push({ name: names[index], webpPath, pngPath, width: 400, height: 400, hash: hash(webpBuffer) });
  }
  assert.equal(new Set(outputs.map((item) => item.hash)).size, outputs.length, `${key}: cropped assets are duplicates`);
  return outputs;
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, preferred: true, maxImagesPerRequest: true, supportsGenerationN: true }
    });
    assert(provider, `${providerId}: provider not found`);
    assert.equal(provider.label, "image4");
    assert.equal(provider.modelType, model);
    assert.equal(provider.providerType, "image");
    assert.equal(provider.enabled, true);
    assert.equal(provider.preferred, true);
    assert.equal(provider.maxImagesPerRequest >= 1, true);
    assert(provider.apiKey && provider.aiUrl, "image4 provider is missing credentials or URL");
    return { ...provider, baseUrl: normalizeBaseUrl(provider.aiUrl) };
  } finally {
    await prisma.$disconnect();
  }
}

async function checkProviderReadOnly(provider) {
  const response = await fetch(`${provider.baseUrl}/models`, { method: "GET", headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(30_000), cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  assert.equal(response.ok, true, `provider_read_only_models_check_failed:${response.status}`);
  const modelText = JSON.stringify(body);
  assert.ok(modelText.includes(model), `provider_read_only_models_check_missing_model:${model}`);
  return { status: response.status, modelVisible: true };
}

async function main() {
  const selectedPages = pages.filter((page) => !selectedKeys.size || selectedKeys.has(page.key));
  assert(selectedPages.length > 0, "No matching Brand / Creator page keys.");
  const pending = [];
  for (const page of selectedPages) if (force || !(await allOutputsExist(page.key))) pending.push(page);
  console.log(JSON.stringify({
    dryRun: !generate,
    siteId,
    provider: "image4",
    model,
    endpoint: "POST /v1/images/generations",
    selectedTopics: selectedPages.map((page) => page.key),
    contactSheetRequestsNeeded: pending.length,
    maxPaidCreates,
    attemptsPerCreate: attempts,
    stopOnFirstError: true,
    output: assetRoot,
    imageCountPerTopic: names.length
  }, null, 2));
  if (!generate) return;
  assert(pending.length <= maxPaidCreates, `paid_create_cap_exceeded:needed=${pending.length}:cap=${maxPaidCreates}`);
  const provider = await loadProvider();
  const readOnlyCheck = await checkProviderReadOnly(provider);
  console.log(`provider read-only check: ${provider.label} model=${model} status=${readOnlyCheck.status}`);
  const report = [];
  for (const [index, page] of pending.entries()) {
    console.log(`provider create ${index + 1}/${pending.length}: ${page.key}`);
    const result = await generateContactSheet(provider, page.key);
    const sheetPath = path.join(providerRoot, `${page.key}.png`);
    await fs.mkdir(path.dirname(sheetPath), { recursive: true });
    await fs.writeFile(sheetPath, result.buffer);
    const outputs = await cropContactSheet(page.key, result.buffer);
    report.push({ key: page.key, requestId: result.requestId, responseType: result.responseType, sheetPath, files: outputs });
  }
  await fs.mkdir(providerRoot, { recursive: true });
  const reportPath = path.join(providerRoot, "generation-report.json");
  await fs.writeFile(reportPath, `${JSON.stringify({ siteId, provider: "image4", model, paidCreates: report.length, attemptsPerCreate: attempts, readOnlyCheck, report }, null, 2)}\n`, "utf8");
  await validateAidreamcapesBrandCreatorContent({ requireAssets: true, log: (line) => console.log(`[assets] ${line}`) });
  console.log(JSON.stringify({ ok: true, siteId, provider: "image4", model, paidCreates: report.length, generatedImages: report.length * names.length, reportPath }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
