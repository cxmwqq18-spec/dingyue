#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesConversionSeedingPagesForMigration } from "./lib/aidreamcapes-conversion-seeding-content.mjs";

const repoRoot = process.cwd();
const siteId = "site_aidreamcapes";
const providerId = "aiprov_image4_mysub2api";
const model = "gpt-image-2";
const assetRoot = path.resolve(repoRoot, "public/assets/sites/site_aidreamcapes/conversion-seeding-v1");
const providerRoot = path.resolve(repoRoot, "releases/provider-results/aidreamcapes/conversion-seeding-v1");
const pages = aidreamcapesConversionSeedingPagesForMigration();

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
const maxPaidCreates = Number(args.get("max-paid-creates") ?? 8);
const attempts = Number(args.get("attempts") ?? 1);
const timeoutMs = Number(args.get("timeout-ms") ?? 300_000);
const selectedKeys = new Set(String(args.get("keys") ?? "").split(",").map((value) => value.trim()).filter(Boolean));

assert.equal(requestedSiteId, siteId, `This asset generator is restricted to ${siteId}.`);
assert.ok(Number.isInteger(maxPaidCreates) && maxPaidCreates >= 0 && maxPaidCreates <= 8, "max-paid-creates must be an integer from 0 to 8.");
assert.equal(attempts, 1, "Provider image creation retries are disabled; attempts must remain 1.");
assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 30_000 && timeoutMs <= 900_000, "timeout-ms must be between 30000 and 900000.");

const promptByKey = {
  "product-demo": [
    "Create a premium photorealistic 3x3 contact sheet for an Aidreamcapes AI Product Demo page.",
    "Use one coherent fictional ecommerce product: a compact matte espresso machine in a warm modern kitchen.",
    "Grid cells, in exact order: product input packshot; hero output showing hands operating the machine and espresso flowing; setup with machine, cup, and beans; hand preparing the water tank; finger pressing the main control; close-up of coffee extraction as visible feedback; finished espresso beside the machine; creator checking the result; closing product-ready frame.",
    "Each cell must be one complete square photograph with different framing but the same product identity. Prioritize clear action, setup, feedback, and finished result. No text, labels, logos, watermarks, UI, readable signage, collage borders, or invented product claims."
  ],
  "unboxing-experience": [
    "Create a premium photorealistic 3x3 contact sheet for an Aidreamcapes AI Unboxing Experience page.",
    "Use one coherent fictional product: matte wireless headphones with a simple unbranded package and charging case.",
    "Grid cells, in exact order: product input with closed package; hero output showing an adult creator opening the package; sealed package arriving on a tabletop; hands removing the sleeve; product and accessories revealed in sequence; creator lifting the headphones for a first look; accessories arranged for a contents check; creator inspecting the headphones; product ready for first use.",
    "The story must be about arrival, opening, reveal, and first touch, not a generic product advertisement. Use original fictional adults only. No text, labels, logos, watermarks, UI, readable packaging, or fake customer review quotes."
  ],
  "how-to-tutorial": [
    "Create a premium photorealistic 3x3 contact sheet for an Aidreamcapes AI How-to Tutorial page.",
    "Use one coherent fictional product: a portable garment steamer and a wrinkled cotton shirt in a bright home setting.",
    "Grid cells, in exact order: product input; hero output showing an adult following the steps; goal and starting setup; filling the steamer; switching the steamer on; steam passing over fabric as visible feedback; moving the steamer in the correct direction; smooth fabric finished state; creator checking the completed shirt.",
    "Make each cell instructional and easy to follow, with hands, orientation, action, and result clearly visible. No text, numbers, logos, watermarks, UI, readable labels, or unrelated fashion editorial styling."
  ],
  "feature-callout": [
    "Create a premium photorealistic 3x3 contact sheet for an Aidreamcapes AI Product Feature Callout page.",
    "Use one coherent fictional product: a matte foam facial cleanser dispenser in a clean bathroom.",
    "Grid cells, in exact order: product input; hero output showing the focused dispenser feature in use; product positioned for a single-feature explanation; finger pressing the pump; dense foam emerging as the observable effect; macro nozzle and pump detail; foam amount in a hand; creator using the dispenser in context; closing product-ready frame.",
    "Every frame must communicate one feature and one proof moment. Keep close-ups accurate and uncluttered. No text, labels, logos, watermarks, UI, readable packaging, or multiple unrelated feature claims."
  ],
  "competitor-comparison": [
    "Create a premium photorealistic 3x3 contact sheet for an Aidreamcapes AI Competitor Comparison page.",
    "Use two visibly distinct but unbranded insulated travel mugs, one charcoal and one cream, tested under neutral matching conditions.",
    "Grid cells, in exact order: both unbranded products as inputs; hero output showing a neutral side-by-side comparison; both mugs aligned before testing; matching pour test; grip and carry shape test; same-condition temperature test setup; close-up of seals and drinking openings; both mugs in the same commute context; neutral closing frame with both products and decision criteria visually clear.",
    "Make the comparison balanced and observational, never a fake winner claim. No logos, trademarks, readable text, watermarks, UI, brand colors, invented measurements, or hostile competitor framing."
  ],
  "social-proof-animation": [
    "Create a premium photorealistic 3x3 contact sheet for an Aidreamcapes AI Social Proof Animation page.",
    "Use one coherent fictional product: a sage reusable insulated water bottle in everyday desk, kitchen, and outdoor contexts.",
    "Grid cells, in exact order: product input; hero output showing the bottle beside abstract approved feedback cues with no readable text; bottle at a desk as a usage context; adult creator using it while feedback is introduced; bottle detail beside a neutral proof context; hands filling the bottle; bottle carried through a daily routine; creator reacting to a real product experience; closing product-and-proof composition.",
    "Show evidence context without fabricating a customer identity or quote. Use visual placeholders only, no readable text, ratings, fake avatars, review badges, logos, watermarks, UI, or claims."
  ],
  "duet-reaction": [
    "Create a premium photorealistic 3x3 contact sheet for an Aidreamcapes AI Duet / Reaction page.",
    "Use one coherent fictional product: a compact unbranded wireless microphone with two original adult creators in a split-screen social video setup.",
    "Grid cells, in exact order: microphone product input; hero output with two creators reacting in a split-screen composition; first creator introducing the microphone; second creator responding from another angle; both comparing size and setup; one creator testing while the other watches; shared close-up of the microphone; both agreeing on a useful use case; closing frame with both creators and product context.",
    "The subject is the exchange between two distinct points of view. Use original fictional adults only, no celebrity likenesses, no copied source footage, no text, logos, watermarks, UI, or fake social platform controls."
  ],
  "green-screen-speaking": [
    "Create a premium photorealistic 3x3 contact sheet for an Aidreamcapes AI Green Screen Speaking page.",
    "Use one coherent fictional product: a portable air quality monitor and one original adult presenter in a studio prepared for compositing.",
    "Grid cells, in exact order: product input; hero output showing the presenter speaking beside product proof; presenter standing in a clean green-screen studio; presenter pointing to reserved background space; enlarged air monitor proof behind the presenter; presenter demonstrating placement in a lived-in room; side-facing presenter leaving caption-safe space; presenter delivering a concise explanation with device visible; closing frame with presenter, product, and CTA safe area.",
    "Use clean composition with believable presenter gestures, gaze direction, and open space for a later background. No text, logos, watermarks, UI, news imagery, public figures, fake expert credentials, or readable screens."
  ]
};

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function hash(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function publicFilesForKey(key) {
  const names = ["product", "hero-output", ...Array.from({ length: 7 }, (_, index) => `example-${String(index + 1).padStart(2, "0")}`)];
  return names.flatMap((name) => [
    path.join(assetRoot, key, `${key}-${name}.webp`),
    path.join(assetRoot, key, `${key}-${name}.png`)
  ]);
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
  return (await Promise.all(publicFilesForKey(key).map(fileExists))).every(Boolean);
}

function imageBufferFromBody(body) {
  const b64 = body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64;
  return b64 ? Buffer.from(b64, "base64") : undefined;
}

async function downloadImage(url, apiKey) {
  const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function generateContactSheet(provider, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = `aidreamcapes:conversion-seeding-v1:${key}`;
  try {
    const response = await fetch(`${provider.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        "Idempotency-Key": requestId
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt: promptByKey[key].join("\n"),
        size: "1024x1024",
        quality: "medium",
        response_format: "b64_json"
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${key}:provider_failed:${response.status}`);
    const b64Buffer = imageBufferFromBody(body);
    if (b64Buffer) return { buffer: b64Buffer, requestId, responseType: "b64_json" };
    const imageUrl = body?.data?.[0]?.url ?? body?.output?.[0]?.url ?? body?.url ?? body?.image_url;
    if (imageUrl) return { buffer: await downloadImage(String(imageUrl), provider.apiKey), requestId, responseType: "url" };
    throw new Error(`${key}:provider_empty_image_payload`);
  } finally {
    clearTimeout(timer);
  }
}

async function cropContactSheet(key, buffer) {
  const source = sharp(buffer);
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  assert(width >= 3 && height >= 3, `${key}: provider output has invalid dimensions`);
  const cellWidth = Math.floor(width / 3);
  const cellHeight = Math.floor(height / 3);
  const names = ["product", "hero-output", ...Array.from({ length: 7 }, (_, index) => `example-${String(index + 1).padStart(2, "0")}`)];
  const outputs = [];
  for (let index = 0; index < names.length; index += 1) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const left = col * cellWidth;
    const top = row * cellHeight;
    const extractWidth = index % 3 === 2 ? width - left : cellWidth;
    const extractHeight = index >= 6 ? height - top : cellHeight;
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

async function main() {
  const selectedPages = pages.filter((page) => !selectedKeys.size || selectedKeys.has(page.key));
  assert(selectedPages.length > 0, "No matching conversion-seeding page keys.");
  const pending = [];
  for (const page of selectedPages) {
    const complete = !force && await allOutputsExist(page.key);
    if (!complete) pending.push(page);
  }
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
    output: assetRoot
  }, null, 2));
  if (!generate) return;
  assert(pending.length <= maxPaidCreates, `paid_create_cap_exceeded:needed=${pending.length}:cap=${maxPaidCreates}`);
  const provider = await loadProvider();
  let paidCreates = 0;
  const report = [];
  for (const page of pending) {
    paidCreates += 1;
    console.log(`provider create ${paidCreates}/${pending.length}: ${page.key}`);
    const result = await generateContactSheet(provider, page.key);
    const sheetPath = path.join(providerRoot, `${page.key}.png`);
    await fs.mkdir(path.dirname(sheetPath), { recursive: true });
    await fs.writeFile(sheetPath, result.buffer);
    const outputs = await cropContactSheet(page.key, result.buffer);
    report.push({ key: page.key, requestId: result.requestId, responseType: result.responseType, sheetPath, files: outputs });
  }
  await fs.mkdir(providerRoot, { recursive: true });
  await fs.writeFile(path.join(providerRoot, "generation-report.json"), `${JSON.stringify({ siteId, provider: "image4", model, paidCreates, attemptsPerCreate: attempts, report }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, siteId, provider: "image4", model, paidCreates, generatedImages: report.reduce((total, item) => total + item.files.length, 0), reportPath: path.join(providerRoot, "generation-report.json") }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
