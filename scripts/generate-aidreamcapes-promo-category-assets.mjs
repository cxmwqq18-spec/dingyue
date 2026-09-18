#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { aidreamcapesPromoCategoryPagesForMigration, validateAidreamcapesPromoCategoryContent } from "./lib/aidreamcapes-promo-category-content.mjs";

const repoRoot = process.cwd();
const siteId = "site_aidreamcapes";
const providerId = "aiprov_image4_mysub2api";
const model = "gpt-image-2";
const assetRoot = path.resolve(repoRoot, "public/assets/sites/site_aidreamcapes/promo-category-v1");
const providerRoot = path.resolve(repoRoot, "releases/provider-results/aidreamcapes/promo-category-v1");
const pages = aidreamcapesPromoCategoryPagesForMigration();
const names = ["product", "hero-output", ...Array.from({ length: 7 }, (_, index) => `example-${String(index + 1).padStart(2, "0")}`)];

const promptByKey = {
  "promo-video": "Create a premium photorealistic 3x3 contact sheet for an AI promo, launch, and sale video page. Use one coherent fictional ecommerce product: an unbranded portable desk lamp in a modern apartment. Cells in exact order: clean product input packshot; hero launch reveal with lamp switched on; product in a new-release context; hands demonstrating the useful light; restrained offer context with product visible; close-up of material and control; lamp in a seasonal room setting; creator introducing the release; final campaign-ready product frame. Every cell is one complete square photograph, same product identity, distinct framing. No readable text, dates, prices, logos, watermarks, UI, fake claims, collage borders, or invented offer terms.",
  "black-friday-countdown": "Create a premium photorealistic 3x3 contact sheet for an AI Black Friday countdown video page. Use one coherent fictional ecommerce product: an unbranded folding electric bicycle in a clean garage and city commute setting. Cells in exact order: product input packshot; hero countdown composition with bicycle ready to ride; product before the sale window; hands folding and preparing the bicycle; restrained seasonal urgency context with no readable text; close-up of hinge and frame detail; bicycle in a realistic commute setting; creator checking the product before the sale; final campaign frame with clear safe space for verified date and offer copy. Same product identity in every cell, one complete square photograph per cell. No readable text, logos, fake dates, prices, discount numbers, watermarks, UI, collage borders, or false inventory claims.",
  "limited-drop-alert": "Create a premium photorealistic 3x3 contact sheet for an AI limited drop alert video page. Use one coherent fictional product: unbranded coral trail running shoes on a clean studio table and outdoor trail. Cells in exact order: product input pair; hero release reveal with shoes centered; sealed release package and product; hands opening and lifting the shoes; a precise launch moment with safe space for verified time copy but no text; macro coral mesh and sole details; shoes staged at a trailhead; original adult creator preparing for the drop; final product and access-ready frame. Make the story about a specific release moment, not a generic advertisement. No readable text, logos, celebrity likeness, fake scarcity, inventory numbers, watermarks, UI, or collage borders.",
  "discount-free-shipping": "Create a premium photorealistic 3x3 contact sheet for an AI discount and free shipping offer video page. Use one coherent fictional ecommerce product: a compact brushed-steel travel espresso scale in a bright coffee station. Cells in exact order: product input packshot; hero product with a restrained value-message safe area; scale beside a shipping-ready package; hands weighing coffee beans; product in a useful travel brewing context; macro display and brushed steel detail with no readable numbers; package and product together; creator choosing the product for a trip; final product frame with safe space for verified offer terms. Same product identity, different framing, one square photo per cell. No readable text, prices, discount percentages, fake shipping badges, logos, watermarks, UI, or collage borders.",
  "beauty-routine": "Create a premium photorealistic 3x3 contact sheet for an AI beauty routine video page. Use one coherent unbranded amber glass facial serum bottle with dropper in a calm bathroom and vanity setting. Cells in exact order: product input packshot; hero morning skincare routine with bottle and clean hands; product placed beside a sink before application; dropper dispensing a small amount; serum texture on fingertips; gentle application to cheek in a natural adult model context; product layered into a simple routine beside moisturizer; creator checking the routine in a mirror; final bottle and calm vanity frame. Focus on order, amount, texture, and everyday context, never medical results. No readable text, logos, watermarks, UI, fake before-after claims, or collage borders.",
  "supplement-highlight": "Create a premium photorealistic 3x3 contact sheet for an AI supplement highlight video page. Use one coherent fictional product: an unbranded lemon electrolyte powder pouch and a clear glass in a bright kitchen. Cells in exact order: product input pouch; hero pouch beside a prepared drink; unopened pouch and measuring scoop; hands opening the pouch; powder being added to water; gentle stirring with visible color and texture; pouch in a gym-bag or desk context; adult creator preparing the drink without medical expression; final product and glass frame with safe space for approved product information. No readable text, ingredient claims, dosage numbers, health promises, logos, watermarks, UI, or collage borders.",
  "fashion-try-on-reel": "Create a premium photorealistic 3x3 contact sheet for an AI fashion try-on reel page. Use one coherent neutral sand overshirt jacket on one original adult model in a clean studio and street setting. Cells in exact order: jacket product input laid flat; hero full-body try-on frame; front fit and silhouette; side turn showing length and drape; controlled walk showing movement; macro fabric and seam detail; styled everyday outfit; model adjusting the jacket naturally; final vertical-ready fashion frame. Keep garment color, construction, and identity consistent. No text, brand marks, logos, watermarks, UI, fake sizing claims, celebrity likeness, or collage borders.",
  "food-video": "Create a premium photorealistic 3x3 contact sheet for an AI food and beverage video page. Use one coherent fictional product: an unbranded citrus sparkling drink bottle with glass and sliced citrus in a warm kitchen. Cells in exact order: product input bottle; hero pour into a glass; bottle and serving setup; hand opening the bottle; sparkling pour with bubbles; close-up of condensation and citrus color; drink served at an everyday table; original adult creator holding the drink in context without fake review; final bottle and glass frame. Make the story about preparation, serving, texture, and occasion. No readable text, flavor or nutrition claims, logos, watermarks, UI, invented ingredients, or collage borders.",
  "home-organization": "Create a premium photorealistic 3x3 contact sheet for an AI home organization video page. Use one coherent clear modular kitchen drawer organizer system in a lived-in kitchen. Cells in exact order: organizer product input; hero before-to-after drawer transformation; cluttered starting drawer; hands sorting utensils and small items; organizer being placed into the drawer; items arranged into visible zones; close-up of compartments and access; creator using the organized drawer; final calm kitchen reset. Make the change from clutter to order clear and believable. No readable text, logos, fake dimensions, impossible capacity, watermarks, UI, or collage borders.",
  "app-saas-demo": "Create a premium photorealistic 3x3 contact sheet for an AI app and SaaS demo video page. Use one coherent fictional analytics workspace shown on an unbranded laptop in a modern desk environment, with a generic interface and no readable text. Cells in exact order: laptop and workspace input; hero workflow from task to result; user at the starting dashboard; hand selecting a filter or workflow control; screen showing a non-readable loading or processing state; screen with an abstract chart result and no numbers; analyst reviewing the result; creator pointing to the interface in a product-demo context; final laptop and safe space for approved CTA copy. Interface must be believable but not claim a real brand or data result. No readable text, logos, watermarks, UI chrome outside the laptop, fake customer data, or collage borders.",
  "local-service-ad": "Create a premium photorealistic 3x3 contact sheet for an AI local service ad video page. Use one coherent professional residential window cleaning kit at a real-looking suburban home, with one original adult service worker and no logo. Cells in exact order: equipment product input; hero service visit at a home; clean exterior establishing the service context; worker arriving with equipment; protective setup before work; squeegee and window cleaning action; close-up of visible glass improvement without exaggerated perfection; worker completing cleanup; final home and equipment frame with safe space for verified area and booking copy. Focus on service process and trust, not unsupported coverage claims. No readable text, addresses, logos, fake reviews, watermarks, UI, celebrity likeness, or collage borders."
};

const rawArgs = process.argv.slice(2);
const args = new Map();
const flags = new Set();
for (let index = 0; index < rawArgs.length; index += 1) {
  const raw = rawArgs[index];
  if (!raw.startsWith("--")) continue;
  const [key, ...rest] = raw.slice(2).split("=");
  if (rest.length) { args.set(key, rest.join("=")); continue; }
  const next = rawArgs[index + 1];
  if (next && !next.startsWith("--")) { args.set(key, next); index += 1; } else flags.add(key);
}

const generate = flags.has("generate");
const force = flags.has("force");
const requestedSiteId = String(args.get("site-id") ?? siteId);
const maxPaidCreates = Number(args.get("max-paid-creates") ?? 11);
const attempts = Number(args.get("attempts") ?? 1);
const timeoutMs = Number(args.get("timeout-ms") ?? 300_000);
const selectedKeys = new Set(String(args.get("keys") ?? "").split(",").map((value) => value.trim()).filter(Boolean));

assert.equal(requestedSiteId, siteId, `This asset generator is restricted to ${siteId}.`);
assert.ok(Number.isInteger(maxPaidCreates) && maxPaidCreates >= 0 && maxPaidCreates <= 11, "max-paid-creates must be an integer from 0 to 11.");
assert.equal(attempts, 1, "Provider image creation retries are disabled; attempts must remain 1.");
assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 30_000 && timeoutMs <= 900_000, "timeout-ms must be between 30000 and 900000.");
assert.equal(Object.keys(promptByKey).length, pages.length, "Every Promo / Category page needs a provider prompt.");
validateAidreamcapesPromoCategoryContent({ requireAssets: false, log: (line) => console.log(`[content] ${line}`) });

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function hash(buffer) { return createHash("sha256").update(buffer).digest("hex"); }

async function fileExists(filePath) {
  try { const stat = await fs.stat(filePath); return stat.isFile() && stat.size > 0; } catch { return false; }
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
  const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`provider_image_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function generateContactSheet(provider, key) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = `aidreamcapes:promo-category-v1:${key}`;
  try {
    const response = await fetch(`${provider.baseUrl}/images/generations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}`, "Idempotency-Key": requestId },
      signal: controller.signal,
      body: JSON.stringify({ model, prompt: promptByKey[key], size: "1024x1024", quality: "medium", response_format: "b64_json" })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${key}:provider_failed:${response.status}`);
    const b64Buffer = imageBufferFromBody(body);
    if (b64Buffer) return { buffer: b64Buffer, requestId, responseType: "b64_json" };
    const imageUrl = body?.data?.[0]?.url ?? body?.output?.[0]?.url ?? body?.url ?? body?.image_url;
    if (imageUrl) return { buffer: await downloadImage(String(imageUrl), provider.apiKey), requestId, responseType: "url" };
    throw new Error(`${key}:provider_empty_image_payload`);
  } finally { clearTimeout(timer); }
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
    const provider = await prisma.platformAiProvider.findUnique({ where: { id: providerId }, select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, preferred: true, maxImagesPerRequest: true, supportsGenerationN: true } });
    assert(provider, `${providerId}: provider not found`);
    assert.equal(provider.label, "image4");
    assert.equal(provider.modelType, model);
    assert.equal(provider.providerType, "image");
    assert.equal(provider.enabled, true);
    assert.equal(provider.preferred, true);
    assert.equal(provider.maxImagesPerRequest >= 1, true);
    assert(provider.apiKey && provider.aiUrl, "image4 provider is missing credentials or URL");
    return { ...provider, baseUrl: normalizeBaseUrl(provider.aiUrl) };
  } finally { await prisma.$disconnect(); }
}

async function main() {
  const selectedPages = pages.filter((page) => !selectedKeys.size || selectedKeys.has(page.key));
  assert(selectedPages.length > 0, "No matching Promo / Category page keys.");
  const pending = [];
  for (const page of selectedPages) if (!(!force && await allOutputsExist(page.key))) pending.push(page);
  console.log(JSON.stringify({ dryRun: !generate, siteId, provider: "image4", model, endpoint: "POST /v1/images/generations", selectedTopics: selectedPages.map((page) => page.key), contactSheetRequestsNeeded: pending.length, maxPaidCreates, attemptsPerCreate: attempts, stopOnFirstError: true, output: assetRoot }, null, 2));
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
  validateAidreamcapesPromoCategoryContent({ requireAssets: true, log: (line) => console.log(`[assets] ${line}`) });
  console.log(JSON.stringify({ ok: true, siteId, provider: "image4", model, paidCreates, generatedImages: report.reduce((total, item) => total + item.files.length, 0), reportPath: path.join(providerRoot, "generation-report.json") }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
