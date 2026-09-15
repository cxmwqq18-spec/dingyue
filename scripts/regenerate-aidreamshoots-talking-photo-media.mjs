#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const batchId = String(args.batch || "aidreamshoots-talking-photo-20260914-v1");
const manifestPath = path.resolve(args.manifest || `.tmp/aidreamshoots-talking-photo-regeneration/${batchId}/manifest.json`);
const outputRoot = path.resolve(`.tmp/aidreamshoots-talking-photo-regeneration/${batchId}/outputs`);
const providerResultRoot = path.resolve(`releases/provider-results/aidreamshoots/talking-photo/${batchId}`);
const finalRoot = path.resolve(`public/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}`);
const finalPublicRoot = `/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}`;

const targetSiteId = "site_mydreamshoots_xby";
const targetSiteSlug = "aidreamshoots";
const targetDomain = "aidreamshoots.eu";
const pageSlug = "/ai-video-generation/talking-photo";
const sectionId = "talking_photo_landing_1";
const providerId = "aiprov_image4_mysub2api";
const imageModel = "gpt-image-2";
const providerImageGenerationsPath = "/images/generations";
const imageSize = "1024x1024";
const imageQuality = "medium";
const maxCreateTimeoutMs = 300_000;
const expectedConfirmation = "aidreamshoots-talking-photo-regeneration";
const outputWidth = 1600;
const outputHeight = 1200;
const minimumCrossAHashDistance = 10;
const minimumCrossDHashDistance = 12;
const minimumCrossColorHashDistance = 24;
const minimumUniqueImageHashCount = 7;

// The slot order is the page's image order: hero poster, then the six visible
// use-case cards. The art direction is deliberately independent per slot so a
// shared talking-photo anchor does not collapse into seven near-identical headshots.
const SLOT_PLANS = [
  {
    id: "hero-poster",
    filename: "talking-photo-hero-poster.webp",
    cardIndex: null,
    altText: "Retrato de una mujer adulta mirando a cámara en un salón luminoso para una foto parlante.",
    artDirection:
      "An adult woman with short dark curls looks directly at the camera in a sunlit home reading nook, shoulders and upper torso visible, soft terracotta chair, pale blue wall, late-morning window light, intimate editorial portrait, 50mm lens, warm neutral palette with one blue accent."
  },
  {
    id: "birthday-greeting",
    filename: "talking-photo-birthday-greeting.webp",
    cardIndex: 0,
    altText: "Mujer adulta sonriente junto a una tarta de cumpleaños en una cocina luminosa.",
    artDirection:
      "A joyful adult woman stands behind a small birthday cake in a bright modern kitchen, one hand near the cake and her face unobstructed, candid smile toward the camera, colorful paper decorations kept subtle, daylight documentary photography, 35mm lens, coral and butter-yellow accents, generous breathing room around the face."
  },
  {
    id: "personal-message",
    filename: "talking-photo-personal-message.webp",
    cardIndex: 1,
    altText: "Hombre adulto mayor mirando a cámara en una biblioteca cálida para un mensaje personal.",
    artDirection:
      "An older adult man with silver hair looks calmly into the camera from a quiet wood-paneled library, seated near a lamp with a closed notebook on a side table, no text visible, gentle afternoon light, cinematic 85mm portrait, deep olive and amber palette, thoughtful personal-message mood."
  },
  {
    id: "education-explainer",
    filename: "talking-photo-education-explainer.webp",
    cardIndex: 2,
    altText: "Profesora adulta explicando una idea frente a una pizarra en un aula luminosa.",
    artDirection:
      "A confident adult woman educator with curly hair presents beside a clean classroom whiteboard with only abstract marks and no readable words, one open hand gesture, face and mouth fully clear, bright north-facing daylight, polished documentary education photography, 50mm lens, teal, cream, and warm wood colors."
  },
  {
    id: "social-intro",
    filename: "talking-photo-social-intro.webp",
    cardIndex: 3,
    altText: "Creadora adulta grabando una presentación breve en un estudio con luz azul y coral.",
    artDirection:
      "A young adult creator with a shaved head records a short face-to-camera introduction in a compact creative studio, simple phone tripod visible at the edge but no screen text, direct eye contact, cobalt blue wall with a coral practical light, contemporary social editorial photography, 28mm lens, energetic but composed framing."
  },
  {
    id: "product-intro",
    filename: "talking-photo-product-intro.webp",
    cardIndex: 4,
    altText: "Presentadora adulta mostrando un frasco cosmético sin marca en un estudio limpio.",
    artDirection:
      "An adult female presenter holds a small unbranded matte skincare bottle at chest height while looking at the camera, clean pale-green beauty studio, product and face both sharp, no label or readable packaging, soft commercial lighting, 70mm lens, restrained sage and cream palette with a single plum accent."
  },
  {
    id: "holiday-greeting",
    filename: "talking-photo-holiday-greeting.webp",
    cardIndex: 5,
    altText: "Persona adulta compartiendo un saludo festivo junto a faroles y decoración cálida.",
    artDirection:
      "An adult person with warm brown skin gives a welcoming seasonal greeting beside handmade paper lanterns and winter greenery in a covered outdoor courtyard, no specific religious symbols, face unobstructed, blue-hour ambient light balanced with golden lantern glow, 35mm lifestyle photography, plum, amber, and pine-green palette."
  }
];

assert.equal(SLOT_PLANS.length, 7, "Talking Photo needs one hero poster and six card images.");
assert.equal(new Set(SLOT_PLANS.map((slot) => slot.filename)).size, SLOT_PLANS.length, "Talking Photo asset filenames must be unique.");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const raw = token.slice(2);
    const separator = raw.indexOf("=");
    if (separator >= 0) {
      result[raw.slice(0, separator)] = raw.slice(separator + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[raw] = next;
      index += 1;
    } else {
      result[raw] = "true";
    }
  }
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/i);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function assertAltText(altText) {
  assert(altText.length >= 30 && altText.length <= 150, `Alt text length is outside the recommended range: ${altText}`);
  assert(!/^(?:ejemplo|imagen|foto)\s+(?:visual\s+)?(?:[0-9]+|genéric|generad)/i.test(altText), `Generic alt text is not allowed: ${altText}`);
  assert(!/[<>\n\r]/.test(altText), `Alt text contains markup or a line break: ${altText}`);
}

function getRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function stringValue(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

async function loadTargetPage(prisma) {
  const [site, page] = await Promise.all([
    prisma.site.findUnique({ where: { id: targetSiteId }, select: { id: true, slug: true, primaryDomain: true, name: true } }),
    prisma.livePage.findUnique({
      where: { siteId_slug: { siteId: targetSiteId, slug: pageSlug } },
      select: { id: true, siteId: true, slug: true, title: true, contentJson: true, updatedAt: true }
    })
  ]);
  assert(site, `Missing target site: ${targetSiteId}`);
  assert.equal(site.slug, targetSiteSlug, "Target site slug mismatch.");
  assert.equal(site.primaryDomain, targetDomain, "Target site domain mismatch.");
  assert(page, `Missing target LivePage: ${pageSlug}`);
  const pageJson = getRecord(page.contentJson);
  const sections = getRecord(pageJson?.sections);
  const section = getRecord(sections?.[sectionId]);
  const settings = getRecord(section?.settings);
  const content = getRecord(settings?.content);
  const seo = getRecord(pageJson?.seo);
  const hero = getRecord(content?.hero);
  const heroImage = getRecord(hero?.image);
  const useCases = getRecord(content?.useCases);
  const items = Array.isArray(useCases?.items) ? useCases.items : [];
  assert.equal(section?.type, "talking_photo_landing", "Target section type mismatch.");
  assert.equal(stringValue(settings?.anchor), "talking-photo", "Target theme anchor mismatch.");
  assert.equal(items.length, 6, "Talking Photo page must have six use-case image slots.");
  assert(heroImage, "Talking Photo hero image is missing.");
  assert(stringValue(heroImage.src), "Talking Photo hero image source is missing.");
  assert(stringValue(seo?.title), "Current page SEO title is missing.");
  assert(stringValue(seo?.description), "Current page SEO description is missing.");
  assert(stringValue(seo?.keywords), "Current page SEO keywords are missing.");
  return { site, page, pageJson, section, settings, content, seo, hero, heroImage, items };
}

function pageImageBeforeUrls(snapshot, slot) {
  if (slot.cardIndex === null) {
    return [...new Set([stringValue(snapshot.heroImage.src), stringValue(snapshot.hero?.video?.poster)].filter(Boolean))];
  }
  const item = getRecord(snapshot.items[slot.cardIndex]);
  const image = getRecord(item?.image);
  return [stringValue(image?.src)].filter(Boolean);
}

function buildPrompt(snapshot, slot, index) {
  const seoContext = [
    `SEO title: ${stringValue(snapshot.seo.title)}`,
    `SEO description: ${stringValue(snapshot.seo.description)}`,
    `SEO keywords: ${stringValue(snapshot.seo.keywords)}`
  ].join("\n");
  return [
    "Create one original editorial photograph for the AIdreamshoots Spanish storefront.",
    "Visual theme anchor: talking-photo — a clear adult portrait prepared to deliver a short, focused message with eyes and mouth easy to read.",
    `Page route: ${pageSlug}. Slot ${index + 1} of ${SLOT_PLANS.length}.`,
    "Use this current SEO context only to understand search intent; never render the SEO words, labels, interface, captions, or any readable text inside the image:",
    seoContext,
    `Independent scene and style direction: ${slot.artDirection}`,
    "This frame must be visually distinct from the other slots through subject identity, location, camera distance, lighting, palette, and composition while remaining part of the same talking-photo product story.",
    "Photorealistic premium storefront photography. Use an original fictional adult, natural anatomy and hands, realistic skin texture, clear eyes, a visible unobstructed mouth, and believable eye-level presence.",
    "No minors, celebrity likenesses, public figures, copied characters, nudity, sexualized posing, violence, gore, medical claims, logos, brands, watermarks, UI, subtitles, captions, signage, packaging text, or legible writing.",
    "Do not make a collage, grid, split screen, contact sheet, frame border, numbered card, or duplicate face. Fill the full square cell edge to edge; the image will be cropped to a 4:3 storefront card after generation.",
    "Keep the face readable and leave enough negative space for the website crop."
  ].join("\n");
}

function buildPlan(snapshot) {
  const tasks = SLOT_PLANS.map((slot, index) => ({
    id: slot.id,
    slot: index,
    filename: slot.filename,
    cardIndex: slot.cardIndex,
    altText: slot.altText,
    artDirection: slot.artDirection,
    prompt: buildPrompt(snapshot, slot, index),
    beforeUrls: pageImageBeforeUrls(snapshot, slot),
    stageFile: path.join(outputRoot, slot.filename),
    finalFile: path.join(finalRoot, slot.filename),
    outputRelative: path.posix.join("assets/sites/site_aidreamshoots/generated/regenerated", batchId, slot.filename),
    publicUrl: `${finalPublicRoot}/${slot.filename}`,
    status: "planned",
    outputHash: "",
    outputAHash: "",
    providerRequestId: "",
    error: ""
  }));
  for (const task of tasks) assertAltText(task.altText);
  assert.equal(new Set(tasks.map((task) => task.prompt)).size, tasks.length, "Prompts must be unique.");
  assert.equal(new Set(tasks.map((task) => task.artDirection)).size, tasks.length, "Art directions must be unique.");
  assert.equal(new Set(tasks.map((task) => task.altText)).size, tasks.length, "Alt text must be unique.");
  return {
    schemaVersion: 1,
    kind: "aidreamshoots-talking-photo-image-regeneration",
    mode: "planned",
    batchId,
    createdAt: new Date().toISOString(),
    targetSite: targetSiteId,
    targetSiteSlug,
    targetDomain,
    pageSlug,
    sectionId,
    themeAnchor: stringValue(snapshot.settings.anchor),
    seoContext: {
      title: stringValue(snapshot.seo.title),
      description: stringValue(snapshot.seo.description),
      keywords: stringValue(snapshot.seo.keywords),
      canonicalPath: stringValue(snapshot.seo.canonicalPath)
    },
    before: {
      livePageId: snapshot.page.id,
      livePageUpdatedAt: snapshot.page.updatedAt,
      heroVideoSrc: stringValue(snapshot.hero?.video?.src),
      heroVideoPoster: stringValue(snapshot.hero?.video?.poster),
      imageUrls: tasks.flatMap((task) => task.beforeUrls)
    },
    provider: {
      id: providerId,
      label: "image4",
      model: imageModel,
      endpoint: "",
      providerType: "image",
      size: imageSize,
      quality: imageQuality,
      attemptsPerCreate: 1,
      maxPaidCreateAttempts: 1,
      noAutomaticRetry: true,
      fallback: "disabled"
    },
    diversity: {
      strategy: "theme-anchor-plus-current-seo-context-plus-independent-scene-style-plus-multi-fingerprint-cross-image-gate",
      independentArtDirections: tasks.length,
      uniquePrompts: new Set(tasks.map((task) => task.prompt)).size,
      uniqueAltTexts: new Set(tasks.map((task) => task.altText)).size,
      minimumCrossAHashDistance,
      minimumCrossDHashDistance,
      minimumCrossColorHashDistance,
      minimumUniqueImageHashCount
    },
    safety: {
      paidCreateAttemptsAuthorizedByBatchScope: 1,
      noAutomaticRetry: true,
      noProviderFallback: true,
      ambiguousCreateStateStopsRun: true,
      videoSourceWillRemainUnchanged: true,
      existingPaidOutputRecoveredBeforeRegeneration: true
    },
    counts: { imageTasks: tasks.length, heroPoster: 1, useCaseCards: 6 },
    tasks
  };
}

function bitDistance(left, right) {
  let value = left ^ right;
  let distance = 0;
  while (value) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

async function imageFingerprints(filePath) {
  const luminance = await sharp(filePath).resize(8, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let total = 0;
  for (const value of luminance.data) total += value;
  const average = total / luminance.data.length;
  let averageHash = 0n;
  luminance.data.forEach((value, index) => {
    if (value >= average) averageHash |= 1n << BigInt(index);
  });

  const gradient = await sharp(filePath).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let differenceHash = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const index = row * 9 + column;
      if (gradient.data[index] >= gradient.data[index + 1]) differenceHash |= 1n << BigInt(row * 8 + column);
    }
  }

  const color = await sharp(filePath).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const channelAverages = [0, 0, 0];
  for (let index = 0; index < color.data.length; index += 3) {
    for (let channel = 0; channel < 3; channel += 1) channelAverages[channel] += color.data[index + channel];
  }
  for (let channel = 0; channel < 3; channel += 1) channelAverages[channel] /= 64;
  let colorHash = 0n;
  for (let pixel = 0; pixel < 64; pixel += 1) {
    const index = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      if (color.data[index + channel] >= channelAverages[channel]) colorHash |= 1n << BigInt(pixel * 3 + channel);
    }
  }
  return { averageHash, differenceHash, colorHash };
}

async function evaluateDiversity(manifest) {
  const failures = [];
  if (new Set(manifest.tasks.map((task) => task.prompt)).size !== manifest.tasks.length) failures.push("duplicate_prompts");
  if (new Set(manifest.tasks.map((task) => task.artDirection)).size !== manifest.tasks.length) failures.push("duplicate_art_directions");
  if (new Set(manifest.tasks.map((task) => task.altText)).size !== manifest.tasks.length) failures.push("duplicate_alt_text");

  const fingerprints = [];
  const outputHashes = new Set();
  for (const task of manifest.tasks) {
    assert(fs.existsSync(task.stageFile), `Missing staged image: ${task.stageFile}`);
    const buffer = fs.readFileSync(task.stageFile);
    const outputHash = sha256(buffer);
    outputHashes.add(outputHash);
    fingerprints.push({ id: task.id, hashes: await imageFingerprints(task.stageFile) });
  }
  if (outputHashes.size < minimumUniqueImageHashCount) failures.push("duplicate_output_hash");

  let minAverageDistance = 64;
  let minDifferenceDistance = 64;
  let minColorDistance = 192;
  let closestAveragePair = null;
  let closestDifferencePair = null;
  let closestColorPair = null;
  const visuallyClosePairs = [];
  for (let left = 0; left < fingerprints.length; left += 1) {
    for (let right = left + 1; right < fingerprints.length; right += 1) {
      const averageDistance = bitDistance(fingerprints[left].hashes.averageHash, fingerprints[right].hashes.averageHash);
      const differenceDistance = bitDistance(fingerprints[left].hashes.differenceHash, fingerprints[right].hashes.differenceHash);
      const colorDistance = bitDistance(fingerprints[left].hashes.colorHash, fingerprints[right].hashes.colorHash);
      if (averageDistance < minAverageDistance) {
        minAverageDistance = averageDistance;
        closestAveragePair = [fingerprints[left].id, fingerprints[right].id];
      }
      if (differenceDistance < minDifferenceDistance) {
        minDifferenceDistance = differenceDistance;
        closestDifferencePair = [fingerprints[left].id, fingerprints[right].id];
      }
      if (colorDistance < minColorDistance) {
        minColorDistance = colorDistance;
        closestColorPair = [fingerprints[left].id, fingerprints[right].id];
      }
      if (
        averageDistance < minimumCrossAHashDistance &&
        differenceDistance < minimumCrossDHashDistance &&
        colorDistance < minimumCrossColorHashDistance
      ) {
        visuallyClosePairs.push({
          pair: [fingerprints[left].id, fingerprints[right].id],
          averageDistance,
          differenceDistance,
          colorDistance
        });
      }
    }
  }
  if (visuallyClosePairs.length) failures.push(`cross_image_visual_similarity_pairs=${visuallyClosePairs.length}`);
  return {
    pass: failures.length === 0,
    minimumCrossAHashDistance,
    minimumCrossDHashDistance,
    minimumCrossColorHashDistance,
    actualMinimumCrossAHashDistance: minAverageDistance,
    actualMinimumCrossDHashDistance: minDifferenceDistance,
    actualMinimumCrossColorHashDistance: minColorDistance,
    closestAveragePair,
    closestDifferencePair,
    closestColorPair,
    visuallyClosePairs,
    uniqueOutputHashes: outputHashes.size,
    failures
  };
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json || body?.data?.[0]?.image_base64 || body?.output?.[0]?.b64_json || body?.output?.[0]?.image_base64 || body?.image_base64 || "";
}

function imageUrlPayload(body) {
  return body?.data?.[0]?.url || body?.output?.[0]?.url || body?.url || body?.image_url || "";
}

function redactedBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => /(?:b64|base64)/i.test(key) && typeof value === "string" ? `[omitted:${value.length}]` : value));
}

async function fileExists(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, preferred: true, maxImagesPerRequest: true }
    });
    assert(provider, `${providerId}: provider not found.`);
    assert.equal(provider.providerType, "image", "Configured provider must be an image provider.");
    assert.equal(provider.modelType, imageModel, `Configured provider model must be ${imageModel}.`);
    assert.equal(provider.enabled, true, "Configured provider is disabled.");
    assert(provider.apiKey && provider.aiUrl, "Configured provider is missing credentials or URL.");
    assert(provider.maxImagesPerRequest >= 1, "Configured provider cannot accept image generation requests.");
    return { ...provider, baseUrl: normalizeBaseUrl(provider.aiUrl) };
  } finally {
    await prisma.$disconnect();
  }
}

async function checkProviderReadOnly(provider) {
  const response = await fetch(`${provider.baseUrl}/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    signal: AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => ({}));
  const ids = Array.isArray(body?.data) ? body.data.map((item) => item?.id).filter(Boolean) : [];
  assert(response.ok, `Provider read-only model check failed with ${response.status}.`);
  return { status: response.status, modelCount: ids.length, modelAvailable: ids.includes(provider.modelType) };
}

async function downloadProviderImage(url, apiKey) {
  const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(60_000) });
  assert(response.ok, `Provider image download failed with ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

async function cropContactSheet(buffer, manifest) {
  const source = sharp(buffer);
  const metadata = await source.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  assert(width >= 3 && height >= 3, "Provider contact sheet has invalid dimensions.");
  const cellWidth = Math.floor(width / 3);
  const cellHeight = Math.floor(height / 3);
  for (const task of manifest.tasks) {
    const column = task.slot % 3;
    const row = Math.floor(task.slot / 3);
    const left = column * cellWidth;
    const top = row * cellHeight;
    const extractWidth = column === 2 ? width - left : cellWidth;
    const extractHeight = row === 2 ? height - top : cellHeight;
    await source
      .clone()
      .extract({ left, top, width: extractWidth, height: extractHeight })
      .resize(outputWidth, outputHeight, { fit: "cover", position: "attention" })
      .webp({ quality: 92, smartSubsample: true })
      .toFile(task.stageFile);
    task.outputHash = sha256(fs.readFileSync(task.stageFile));
    task.status = "succeeded";
  }
}

async function generate(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Generation requires --confirm=${expectedConfirmation}.`);
  assert.equal(Number(args["max-paid-attempts"] || 1), 1, "This Talking Photo regeneration is capped at one paid create attempt.");
  assert.equal(Number(manifest.runtime?.paidCreateAttempts || 0), 0, "A paid create already exists for this manifest; inspect or recover it instead of generating again.");
  const provider = await loadProvider();
  const modelCheck = await checkProviderReadOnly(provider);
  manifest.provider = { ...manifest.provider, endpoint: `${provider.baseUrl}${providerImageGenerationsPath}`, readOnlyModelCheck: modelCheck };
  manifest.runtime = { paidCreateAttempts: 0, succeeded: 0, failed: 0, ambiguous: 0, providerRequestIds: [], startedAt: new Date().toISOString() };
  writeJson(manifestPath, manifest);
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.mkdirSync(providerResultRoot, { recursive: true });
  console.log(JSON.stringify({
    operation: "paid-create-contact-sheet",
    endpoint: `${provider.baseUrl}${providerImageGenerationsPath}`,
    method: "POST",
    provider: provider.label,
    model: provider.modelType,
    size: imageSize,
    quality: imageQuality,
    maxPaidCreateAttempts: 1,
    attemptsPerCreate: 1,
    retry: false,
    fallback: false,
    stopCondition: "stop on first failed or ambiguous create; evaluate cross-image similarity before apply"
  }, null, 2));

  const idempotencyKey = `${expectedConfirmation}:${batchId}:contact-sheet`;
  const clientRequestId = `${batchId}:contact-sheet`;
  const startedAt = Date.now();
  let response;
  let body = {};
  try {
    response = await fetch(`${provider.baseUrl}${providerImageGenerationsPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        "Idempotency-Key": idempotencyKey,
        "X-Client-Request-Id": clientRequestId
      },
      body: JSON.stringify({
        model: provider.modelType,
        prompt: [
          "Create a 3 by 3 contact sheet for one talking-photo landing page.",
          "Each cell must be a complete edge-to-edge square photograph with no gutters, labels, numbers, borders, or collage styling.",
          ...manifest.tasks.map((task, index) => `Cell ${index + 1}: ${task.prompt}`),
          "Cells 8 and 9 are additional unused quality-safe alternatives: use two distinct adult portrait scenes that follow the same page anchor and avoid repeating cells 1 through 7.",
          "The first seven cells are the only assets that will be published; keep their order exact."
        ].join("\n\n"),
        size: imageSize,
        quality: imageQuality,
        response_format: "b64_json"
      }),
      signal: AbortSignal.timeout(maxCreateTimeoutMs)
    });
    body = await response.json().catch(() => ({}));
  } catch (error) {
    manifest.runtime.paidCreateAttempts = 1;
    manifest.runtime.failed = 1;
    manifest.runtime.ambiguous = 1;
    manifest.runtime.completedAt = new Date().toISOString();
    writeJson(path.join(providerResultRoot, "provider-audit.json"), { batchId, providerId: provider.id, model: provider.modelType, endpoint: `${provider.baseUrl}${providerImageGenerationsPath}`, idempotencyKey, clientRequestId, elapsedMs: Date.now() - startedAt, error: error instanceof Error ? error.message : String(error), retryPolicy: "no-retry" });
    writeJson(manifestPath, manifest);
    throw new Error("Ambiguous provider create state; stopped without retry.");
  }

  const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
  writeJson(path.join(providerResultRoot, "provider-response.json"), { batchId, providerId: provider.id, providerLabel: provider.label, model: provider.modelType, endpoint: `${provider.baseUrl}${providerImageGenerationsPath}`, idempotencyKey, clientRequestId, requestId, status: response.status, elapsedMs: Date.now() - startedAt, response: redactedBody(body), retryPolicy: "no-retry" });
  manifest.runtime.paidCreateAttempts = 1;
  if (!response.ok) {
    manifest.runtime.failed = 1;
    manifest.runtime.completedAt = new Date().toISOString();
    writeJson(manifestPath, manifest);
    throw new Error(`Provider create failed with ${response.status}; stopped without retry.`);
  }

  const encoded = imagePayload(body);
  const sheetBuffer = encoded ? Buffer.from(encoded, "base64") : await downloadProviderImage(imageUrlPayload(body), provider.apiKey);
  const sheetPath = path.join(providerResultRoot, "contact-sheet.png");
  fs.writeFileSync(sheetPath, sheetBuffer);
  manifest.contactSheet = { path: sheetPath, sha256: sha256(sheetBuffer), requestId, idempotencyKey };
  await cropContactSheet(sheetBuffer, manifest);
  manifest.runtime.succeeded = manifest.tasks.length;
  manifest.runtime.providerRequestIds = [{ taskId: "contact-sheet", requestId }];
  manifest.runtime.completedAt = new Date().toISOString();
  manifest.diversityResult = await evaluateDiversity(manifest);
  writeJson(manifestPath, manifest);
  assert(manifest.diversityResult.pass, `Cross-image similarity gate failed; no assets were applied: ${manifest.diversityResult.failures.join("; ")}`);
  console.log(JSON.stringify({ ok: true, paidCreateAttempts: 1, generatedAssets: manifest.tasks.length, diversity: manifest.diversityResult, reportPath: manifestPath }, null, 2));
}

function updateImage(image, task) {
  assert(image && typeof image === "object" && !Array.isArray(image), `Missing image object for ${task.id}.`);
  image.src = task.publicUrl;
  image.alt = task.altText;
}

function replaceThemeGalleryImages(galleryImages, manifest) {
  if (!Array.isArray(galleryImages)) return galleryImages;
  return galleryImages.map((value) => {
    const task = manifest.tasks.find((candidate) => candidate.beforeUrls.includes(value) && candidate.cardIndex !== null);
    return task ? task.publicUrl : value;
  });
}

function applyManifestToPage(pageJson, currentSnapshot, manifest) {
  const next = clone(pageJson);
  const section = next.sections?.[sectionId];
  const content = section?.settings?.content;
  assert(content && typeof content === "object", "Target page content disappeared before apply.");
  const hero = content.hero;
  assert(hero && typeof hero === "object", "Target page hero disappeared before apply.");
  const heroTask = manifest.tasks.find((task) => task.cardIndex === null);
  assert(heroTask, "Hero task missing from manifest.");
  const currentHeroUrls = pageImageBeforeUrls(currentSnapshot, heroTask);
  assert(heroTask.beforeUrls.some((url) => currentHeroUrls.includes(url)) || hero.image?.src === heroTask.publicUrl, "Hero image changed after planning; refusing to overwrite it.");
  updateImage(hero.image, heroTask);
  if (hero.video && typeof hero.video === "object" && hero.video.poster) hero.video.poster = heroTask.publicUrl;
  const items = content.useCases?.items;
  assert(Array.isArray(items) && items.length === 6, "Target use-case content changed before apply.");
  for (const task of manifest.tasks.filter((candidate) => candidate.cardIndex !== null)) {
    const image = items[task.cardIndex]?.image;
    const currentUrl = stringValue(image?.src);
    assert(task.beforeUrls.includes(currentUrl) || currentUrl === task.publicUrl, `Use-case image changed after planning at index ${task.cardIndex}; refusing to overwrite it.`);
    updateImage(image, task);
  }
  return next;
}

async function apply(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(manifest.runtime?.paidCreateAttempts, 1, "Apply requires the single authorized provider create attempt.");
  assert.equal(manifest.runtime?.succeeded, manifest.tasks.length, "Every image task must succeed before apply.");
  assert.equal(manifest.runtime?.failed, 0, "Failed provider tasks block apply.");
  assert.equal(manifest.diversityResult?.pass, true, "Cross-image similarity gate must pass before apply.");
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  assert(!fs.existsSync(finalRoot), `Final output directory already exists: ${finalRoot}`);

  const prisma = new PrismaClient();
  try {
    const snapshot = await loadTargetPage(prisma);
    assert.equal(snapshot.page.id, manifest.before.livePageId, "Target LivePage changed identity after planning.");
    const nextPageJson = applyManifestToPage(snapshot.pageJson, snapshot, manifest);
    const nextHeroVideoSrc = stringValue(nextPageJson.sections?.[sectionId]?.settings?.content?.hero?.video?.src);
    assert.equal(nextHeroVideoSrc, manifest.before.heroVideoSrc, "Video source changed during image-only apply.");

    for (const task of manifest.tasks) {
      assert(await fileExists(task.stageFile), `Missing staged output: ${task.stageFile}`);
      fs.mkdirSync(path.dirname(task.finalFile), { recursive: true });
      fs.copyFileSync(task.stageFile, task.finalFile);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const currentPage = await tx.livePage.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: pageSlug } }, select: { id: true, contentJson: true } });
      assert.equal(currentPage?.id, manifest.before.livePageId, "Target LivePage changed during apply.");
      const currentForConflict = await loadTargetPage(tx);
      const pageJson = applyManifestToPage(currentForConflict.pageJson, currentForConflict, manifest);
      await tx.livePage.update({ where: { id: manifest.before.livePageId }, data: { contentJson: pageJson } });

      const theme = await tx.videoTheme.findUnique({ where: { siteId_slug: { siteId: targetSiteId, slug: "talking-photo" } }, select: { id: true, imageUrl: true, galleryImages: true } });
      if (theme) {
        await tx.videoTheme.update({
          where: { id: theme.id },
          data: {
            imageUrl: manifest.tasks.find((task) => task.cardIndex === null).publicUrl,
            galleryImages: replaceThemeGalleryImages(theme.galleryImages, manifest)
          }
        });
      }

      for (const task of manifest.tasks) {
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: targetSiteId, storageKey: task.outputRelative } },
          create: {
            id: `media_${targetSiteId}_${sha256(task.outputRelative).slice(0, 20)}`,
            siteId: targetSiteId,
            label: task.altText,
            storageKey: task.outputRelative,
            mimeType: "image/webp",
            usageType: "theme",
            sourceType: "ai-talking-photo-regeneration",
            previewUrl: task.publicUrl,
            originUrl: task.publicUrl,
            altText: task.altText,
            notes: `Generated for ${pageSlug}; batch ${batchId}.`
          },
          update: {
            label: task.altText,
            mimeType: "image/webp",
            usageType: "theme",
            sourceType: "ai-talking-photo-regeneration",
            previewUrl: task.publicUrl,
            originUrl: task.publicUrl,
            altText: task.altText,
            notes: `Generated for ${pageSlug}; batch ${batchId}.`
          }
        });
      }
      return { livePage: true, videoTheme: Boolean(theme), mediaAssets: manifest.tasks.length };
    }, { timeout: 120_000 });

    const readback = await loadTargetPage(prisma);
    const readbackContent = readback.content;
    const readbackHero = readbackContent.hero;
    assert.equal(readbackHero.image.src, manifest.tasks.find((task) => task.cardIndex === null).publicUrl, "Hero image readback failed.");
    assert.equal(readbackHero.video?.poster, manifest.tasks.find((task) => task.cardIndex === null).publicUrl, "Hero poster readback failed.");
    for (const task of manifest.tasks.filter((candidate) => candidate.cardIndex !== null)) {
      assert.equal(readbackContent.useCases.items[task.cardIndex].image.src, task.publicUrl, `Use-case image readback failed: ${task.id}`);
      assert.equal(readbackContent.useCases.items[task.cardIndex].image.alt, task.altText, `Use-case alt readback failed: ${task.id}`);
    }
    assert.equal(readbackHero.video?.src, manifest.before.heroVideoSrc, "Video source changed after apply.");
    manifest.apply = { target: "local", appliedAt: new Date().toISOString(), finalRoot, updated };
    manifest.mode = "applied";
    writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode: "applied", batchId, targetSiteId, pageSlug, updated, manifestPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assert(["plan", "generate", "apply"].includes(mode), `Unsupported mode: ${mode}`);
  assertDatabaseTarget({ expectedTarget: "local" });
  if (mode === "plan") {
    const prisma = new PrismaClient();
    try {
      const snapshot = await loadTargetPage(prisma);
      const manifest = buildPlan(snapshot);
      writeJson(manifestPath, manifest);
      console.log(JSON.stringify({ ok: true, mode, manifestPath, batchId, targetSiteId, pageSlug, themeAnchor: manifest.themeAnchor, seoContext: manifest.seoContext, generationTasks: manifest.tasks.length, maxPaidCreateAttempts: 1, provider: manifest.provider }, null, 2));
    } finally {
      await prisma.$disconnect();
    }
    return;
  }
  const manifest = readJson(manifestPath);
  assert.equal(manifest.batchId, batchId, "Manifest batch id mismatch.");
  if (mode === "generate") await generate(manifest);
  else await apply(manifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
