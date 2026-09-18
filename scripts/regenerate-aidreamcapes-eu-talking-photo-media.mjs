#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const batchId = String(args.batch || "aidreamcapes-eu-talking-photo-diverse-20260914-v1");
const batchRoot = path.resolve(".tmp", "aidreamcapes-eu-talking-photo-regeneration", batchId);
const manifestPath = path.resolve(args.manifest || path.join(batchRoot, "manifest.json"));
const outputRoot = path.join(batchRoot, "outputs");
const finalRoot = path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/eu-regenerated", batchId);
const finalPublicRoot = "/assets/sites/site_aidreamcapes_eu/generated/eu-regenerated/" + batchId;
const backupPath = path.join(batchRoot, "apply-backup.json");

const siteId = "site_aidreamcapes_xby";
const siteSlug = "aidreamcapes-eu";
const pageSlug = "/ai-video-generation/talking-photo";
const sectionId = "talking_photo_landing_1";
const providerId = "aiprov_image4_mysub2api";
const providerImageGenerationsPath = "/v1/images/generations";
const imageModel = "gpt-image-2";
const imageSize = "1536x1024";
const imageQuality = "high";
const finalImageSize = { width: 1600, height: 1200 };
const maxCreateTimeoutMs = 300_000;
const expectedConfirmation = "aidreamcapes-eu-talking-photo-regeneration";
const minimumCrossAHashDistance = 10;
const minimumCrossDHashDistance = 12;
const minimumCrossColorHashDistance = 24;

const THEME_ANCHOR =
  "an AI talking-photo image set: a clear face-to-camera portrait that can plausibly deliver one short, focused message; the person, setting, and visual tone should make the intended use case immediately understandable";

// Each direction intentionally changes the person, environment, camera language,
// color emphasis, and prop so that the six page cards are useful as a set instead
// of six near-duplicates with only the noun changed.
const SCENE_STYLE_DIRECTIONS = [
  {
    key: "birthday-window-table",
    brief:
      "A warm editorial lifestyle scene with an adult woman at a sunlit dining table, holding a small frosted birthday cake with simple candles; coral, cream, and soft yellow palette, candid three-quarter pose, 50mm lens, natural window light, joyful but believable.",
    alt: "Femme adulte tenant un gâteau d'anniversaire pour un message personnalisé en photo parlante."
  },
  {
    key: "personal-library-note",
    brief:
      "An intimate portrait of an older adult man seated in a quiet home library beside a window, a closed unbranded card resting in his hands; walnut, navy, and warm beige palette, direct eye contact, 85mm portrait lens, soft side light, calm and sincere.",
    alt: "Homme âgé regardant l'objectif pour un message personnel en photo parlante."
  },
  {
    key: "classroom-board",
    brief:
      "A modern adult female instructor stands beside a matte classroom board with abstract geometric diagrams only, one open hand explaining a concept; cobalt blue and warm amber palette, medium-wide 35mm composition, clean daylight, approachable and precise.",
    alt: "Enseignante adulte présentant un cours devant un tableau sans texte pour une photo parlante explicative."
  },
  {
    key: "creator-studio-hook",
    brief:
      "A young adult content creator faces the camera at a tidy creator desk with a small microphone and compact camera in the background; cobalt and vermilion accents, energetic but natural expression, 35mm editorial framing, bright studio daylight, open negative space around the face.",
    alt: "Créatrice de contenu adulte face à la caméra dans un studio pour une introduction vidéo sociale."
  },
  {
    key: "skincare-spokesperson",
    brief:
      "An adult spokesperson in a minimal skincare studio holds a small unbranded frosted-glass serum bottle with a blank label; pale peach, sage, and white palette, 70mm product portrait, clean softbox light, face and hand both sharp, polished but human.",
    alt: "Porte-parole adulte présentant un flacon de sérum sans marque pour une introduction produit en photo parlante."
  },
  {
    key: "winter-gift-room",
    brief:
      "An adult woman in a cozy winter living room holds a neatly wrapped gift in pine green, cranberry red, and cream; warm practical lights and a softly out-of-focus tree, 35mm lifestyle composition, welcoming direct gaze, tactile seasonal detail without readable decoration.",
    alt: "Femme adulte tenant un cadeau emballé dans un intérieur hivernal pour une salutation de fête en photo parlante."
  }
];

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const value = token.slice(2);
    const separator = value.indexOf("=");
    if (separator >= 0) {
      result[value.slice(0, separator)] = value.slice(separator + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[value] = next;
      index += 1;
    } else {
      result[value] = "true";
    }
  }
  return result;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJson(value[key])]));
  }
  return value;
}

function hashJson(value) {
  return sha256(JSON.stringify(stableJson(value)));
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function compactCopy(value, maxLength = 900) {
  const normalized = text(value).replace(/\s+/g, " ");
  return normalized.length > maxLength ? normalized.slice(0, maxLength - 1) + "…" : normalized;
}

function imageFromTask(task) {
  return {
    src: task.publicUrl,
    alt: task.altText
  };
}

function currentSeoCopy(content) {
  return {
    title: compactCopy(content.seo?.title, 220),
    description: compactCopy(content.seo?.description, 800),
    keywords: compactCopy(content.seo?.keywords, 500),
    heroTitle: compactCopy(content.hero?.title, 260),
    heroBody: compactCopy(content.hero?.body, 800),
    useCasesTitle: compactCopy(content.useCases?.title, 260),
    useCasesIntro: compactCopy(content.useCases?.intro, 700)
  };
}

function buildPrompt({ seoCopy, item, direction, index }) {
  const itemCopy = [
    `Use-case ${index + 1} title: ${compactCopy(item.title, 300)}`,
    `Customer problem: ${compactCopy(item.problem, 520)}`,
    `Current page guidance: ${compactCopy(item.body, 700)}`,
    `Example spoken message: ${compactCopy(item.script, 360)}`
  ].join("\n");
  return [
    "Create one original editorial photograph for the French Aidreamcapes EU storefront.",
    "This is a visual example for an AI talking photo generator page, not a poster, screenshot, interface, or advertisement.",
    `Theme anchor: ${THEME_ANCHOR}.`,
    "Current SEO/page intent:",
    `Page title: ${seoCopy.title}`,
    `Page description: ${seoCopy.description}`,
    `Use-case section: ${seoCopy.useCasesTitle} — ${seoCopy.useCasesIntro}`,
    itemCopy,
    `Independent scene and style direction: ${direction.brief}`,
    "Make the adult subject's face, eyes, mouth, shoulders, and relevant prop readable; use a natural expression that could support a short spoken message.",
    "Use a clean 4:3 landscape composition with the subject centered or on a deliberate third, enough breathing room for responsive card crops, and no important detail at the extreme edges.",
    "The subject is fictional and adult. Use no celebrity or recognizable real person, no minor, no nudity, no sexualized framing, no violence, no weapon, and no gore.",
    "Do not render any readable words, letters, numbers, logos, trademarks, labels, watermarks, subtitles, speech bubbles, UI elements, or fake brand marks. Keep cards, boards, screens, packaging, and decorations text-free.",
    "Photorealistic editorial photography, natural anatomy, realistic hands, believable materials, controlled depth of field, and a distinct visual recipe from every other image in this six-image set."
  ].join("\n");
}

async function loadPage(prisma) {
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId, slug: pageSlug } },
    select: { id: true, siteId: true, slug: true, title: true, contentJson: true, updatedAt: true }
  });
  assert(page, `${siteId} ${pageSlug}: LivePage not found.`);
  const content = page.contentJson?.sections?.[sectionId]?.settings?.content;
  assert(content && typeof content === "object", `${pageSlug}: talking-photo content is missing.`);
  assert(Array.isArray(content.useCases?.items), `${pageSlug}: use-case items are missing.`);
  assert.equal(content.useCases.items.length, SCENE_STYLE_DIRECTIONS.length, `${pageSlug}: expected six use-case images.`);
  return { page, content };
}

function buildPlan({ page, content }) {
  const seoCopy = currentSeoCopy(content);
  const tasks = content.useCases.items.map((item, index) => {
    const direction = SCENE_STYLE_DIRECTIONS[index];
    const slot = String(index + 1).padStart(2, "0");
    const filename = `talking-photo-${slot}-${direction.key}.webp`;
    return {
      id: `talking-photo-${slot}`,
      index,
      slot,
      directionKey: direction.key,
      artDirection: direction.brief,
      altText: direction.alt,
      prompt: buildPrompt({ seoCopy, item, direction, index }),
      previousImage: item.image ?? null,
      filename,
      stageFile: path.join(outputRoot, filename),
      finalFile: path.join(finalRoot, filename),
      outputRelative: path.posix.join("assets/sites/site_aidreamcapes_eu/generated/eu-regenerated", batchId, filename),
      publicUrl: `${finalPublicRoot}/${filename}`,
      status: "planned",
      providerRequestId: "",
      error: ""
    };
  });
  assert.equal(new Set(tasks.map((task) => task.prompt)).size, tasks.length, "Prompts must be unique.");
  assert.equal(new Set(tasks.map((task) => task.artDirection)).size, tasks.length, "Art directions must be unique.");
  assert.equal(new Set(tasks.map((task) => task.altText)).size, tasks.length, "Alt text must be unique.");
  assert(tasks.every((task) => task.altText.length >= 35 && task.altText.length <= 180), "Alt text must be descriptive and concise.");
  assert(tasks.every((task) => !/(?:exemple|example|image de couverture|cover image|image \d+)/i.test(task.altText)), "Alt text must not use generic placeholders.");
  return {
    schemaVersion: 1,
    kind: "aidreamcapes-eu-talking-photo-diverse-image-regeneration",
    mode: "planned",
    batchId,
    createdAt: new Date().toISOString(),
    targetSite: siteId,
    targetSiteSlug: siteSlug,
    pageSlug,
    sectionId,
    scope: "Talking Photo use-case images only; hero video and poster are out of scope",
    sourcePage: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      updatedAt: page.updatedAt,
      contentHash: hashJson(page.contentJson),
      seoCopy
    },
    themeAnchor: THEME_ANCHOR,
    provider: {
      id: providerId,
      label: "image4",
      model: imageModel,
      endpoint: "",
      providerType: "image",
      size: imageSize,
      quality: imageQuality,
      attemptsPerCreate: 1,
      maxPaidCreateAttempts: tasks.length,
      noAutomaticRetry: true,
      fallback: "disabled"
    },
    diversity: {
      strategy: "theme-anchor-plus-current-seo-copy-plus-independent-scene-style-plus-multi-fingerprint-cross-image-gate",
      independentArtDirections: tasks.length,
      uniquePrompts: new Set(tasks.map((task) => task.prompt)).size,
      uniqueAltTexts: new Set(tasks.map((task) => task.altText)).size,
      minimumCrossAHashDistance,
      minimumCrossDHashDistance,
      minimumCrossColorHashDistance
    },
    safety: {
      paidCreateAttemptsAuthorizedByBatchScope: null,
      noAutomaticRetry: true,
      noProviderFallback: true,
      ambiguousCreateStateStopsRun: true,
      providerResultRecoveredBeforeAnyRegeneration: true
    },
    counts: { images: tasks.length, heroVideoChanged: false },
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
  const channels = [0, 0, 0];
  for (let index = 0; index < color.data.length; index += 3) {
    for (let channel = 0; channel < 3; channel += 1) channels[channel] += color.data[index + channel];
  }
  for (let channel = 0; channel < 3; channel += 1) channels[channel] /= 64;
  let colorHash = 0n;
  for (let pixel = 0; pixel < 64; pixel += 1) {
    const index = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      if (color.data[index + channel] >= channels[channel]) colorHash |= 1n << BigInt(pixel * 3 + channel);
    }
  }
  return { averageHash, differenceHash, colorHash };
}

async function evaluateDiversity(manifest) {
  const failures = [];
  const outputHashes = new Set();
  const fingerprints = [];
  for (const task of manifest.tasks) {
    assert(fs.existsSync(task.stageFile), `Missing staged image: ${task.stageFile}`);
    outputHashes.add(sha256(fs.readFileSync(task.stageFile)));
    fingerprints.push({ id: task.id, hashes: await imageFingerprints(task.stageFile) });
  }
  if (outputHashes.size !== manifest.tasks.length) failures.push("duplicate_output_hash");

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
      if (averageDistance < minAverageDistance) { minAverageDistance = averageDistance; closestAveragePair = [fingerprints[left].id, fingerprints[right].id]; }
      if (differenceDistance < minDifferenceDistance) { minDifferenceDistance = differenceDistance; closestDifferencePair = [fingerprints[left].id, fingerprints[right].id]; }
      if (colorDistance < minColorDistance) { minColorDistance = colorDistance; closestColorPair = [fingerprints[left].id, fingerprints[right].id]; }
      if (averageDistance < minimumCrossAHashDistance && differenceDistance < minimumCrossDHashDistance && colorDistance < minimumCrossColorHashDistance) {
        visuallyClosePairs.push({ pair: [fingerprints[left].id, fingerprints[right].id], averageDistance, differenceDistance, colorDistance });
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
    actualMinimumCrossColorDistance: minColorDistance,
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
  return body?.data?.[0]?.url || body?.output?.[0]?.url || body?.url || "";
}

function redactedBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => {
    if (/(?:b64|base64)/i.test(key) && typeof value === "string") return `[omitted:${value.length}]`;
    return value;
  }));
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, maxImagesPerRequest: true }
    });
    assert(provider, `${providerId}: provider not found.`);
    assert.equal(provider.providerType, "image", "Configured provider must be an image provider.");
    assert(provider.enabled, "Configured image provider is disabled.");
    assert(provider.apiKey && provider.aiUrl, "Configured image provider is missing URL or key.");
    assert.equal(provider.modelType, imageModel, `Configured provider model must be ${imageModel}.`);
    return { ...provider, baseUrl: normalizeBaseUrl(provider.aiUrl) };
  } finally {
    await prisma.$disconnect();
  }
}

async function checkProviderReadOnly(provider) {
  const response = await fetch(provider.baseUrl + "/v1/models", {
    headers: { Authorization: "Bearer " + provider.apiKey },
    signal: AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => ({}));
  const ids = Array.isArray(body?.data) ? body.data.map((item) => item?.id).filter(Boolean) : [];
  assert(response.ok, `Provider read-only model check failed with ${response.status}.`);
  assert(ids.length === 0 || ids.includes(imageModel), `Provider read-only model check did not expose ${imageModel}.`);
  return { status: response.status, modelCount: ids.length, modelMatch: ids.length === 0 ? "provider did not expose model list" : ids.includes(imageModel) };
}

async function convertProviderOutput(body, task) {
  let inputBuffer;
  const encoded = imagePayload(body);
  if (encoded) {
    inputBuffer = Buffer.from(encoded, "base64");
  } else {
    const remoteUrl = imageUrlPayload(body);
    assert(remoteUrl, `${task.id}: provider returned no image payload.`);
    const response = await fetch(remoteUrl, { signal: AbortSignal.timeout(60_000) });
    assert(response.ok, `${task.id}: provider output download failed with ${response.status}.`);
    inputBuffer = Buffer.from(await response.arrayBuffer());
  }
  await sharp(inputBuffer)
    .rotate()
    .resize(finalImageSize.width, finalImageSize.height, { fit: "cover", position: "attention" })
    .webp({ quality: 92, smartSubsample: true })
    .toFile(task.stageFile);
}

async function generate(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Generation requires --confirm=${expectedConfirmation}.`);
  const maxPaidAttempts = Number(args["max-paid-attempts"] || 0);
  assert(Number.isInteger(maxPaidAttempts) && maxPaidAttempts >= manifest.tasks.length, `Generation requires --max-paid-attempts>=${manifest.tasks.length}.`);
  const provider = await loadProvider();
  const readOnlyModelCheck = await checkProviderReadOnly(provider);
  const previousRuntime = manifest.runtime || {};
  assert.equal(Number(previousRuntime.paidCreateAttempts || 0), 0, "This batch already has provider attempts; use a new approved batch.");
  manifest.provider = {
    ...manifest.provider,
    endpoint: provider.baseUrl + providerImageGenerationsPath,
    maxImagesPerRequest: provider.maxImagesPerRequest,
    maxPaidCreateAttempts: maxPaidAttempts,
    readOnlyModelCheck,
    keySource: "database"
  };
  manifest.safety.paidCreateAttemptsAuthorizedByBatchScope = maxPaidAttempts;
  manifest.runtime = {
    paidCreateAttempts: 0,
    succeeded: 0,
    failed: 0,
    ambiguous: 0,
    startedAt: new Date().toISOString(),
    providerRequestIds: []
  };
  writeJson(manifestPath, manifest);
  fs.mkdirSync(outputRoot, { recursive: true });
  console.log(JSON.stringify({
    operation: "paid-create",
    endpoint: provider.baseUrl + providerImageGenerationsPath,
    method: "POST",
    provider: provider.label,
    model: provider.modelType,
    size: imageSize,
    quality: imageQuality,
    maxPaidCreateAttempts: maxPaidAttempts,
    attemptsPerCreate: 1,
    retry: false,
    fallback: false,
    stopCondition: "stop on first failed or ambiguous create; evaluate six-image diversity before apply"
  }, null, 2));

  for (const task of manifest.tasks) {
    assert(manifest.runtime.paidCreateAttempts < maxPaidAttempts, "paid_create_cap_exceeded");
    const idempotencyKey = `${expectedConfirmation}:${manifest.batchId}:${task.id}`;
    const startedAt = Date.now();
    manifest.runtime.paidCreateAttempts += 1;
    let response;
    let body = {};
    try {
      response = await fetch(provider.baseUrl + providerImageGenerationsPath, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + provider.apiKey,
          "Idempotency-Key": idempotencyKey,
          "X-Client-Request-Id": task.id
        },
        body: JSON.stringify({ model: provider.modelType, prompt: task.prompt, size: imageSize, quality: imageQuality, response_format: "b64_json" }),
        signal: AbortSignal.timeout(maxCreateTimeoutMs)
      });
      body = await response.json().catch(() => ({}));
    } catch (error) {
      task.status = "unknown_provider_state";
      task.error = error instanceof Error ? error.message : String(error);
      manifest.runtime.ambiguous += 1;
      manifest.runtime.failed += 1;
      writeJson(path.join(batchRoot, `${manifest.batchId}-${task.id}-provider.json`), {
        taskId: task.id,
        providerId: provider.id,
        providerLabel: provider.label,
        model: provider.modelType,
        endpoint: provider.baseUrl + providerImageGenerationsPath,
        idempotencyKey,
        clientRequestId: task.id,
        requestId: "",
        status: null,
        elapsedMs: Date.now() - startedAt,
        error: task.error,
        retryPolicy: "no-retry"
      });
      writeJson(manifestPath, manifest);
      throw new Error(`${task.id}: ambiguous provider create state; stopped without retry.`);
    }
    const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
    writeJson(path.join(batchRoot, `${manifest.batchId}-${task.id}-provider.json`), {
      taskId: task.id,
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.modelType,
      endpoint: provider.baseUrl + providerImageGenerationsPath,
      idempotencyKey,
      clientRequestId: task.id,
      requestId,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      response: redactedBody(body),
      retryPolicy: "no-retry"
    });
    if (!response.ok) {
      task.status = "failed";
      task.error = `provider_status_${response.status}`;
      manifest.runtime.failed += 1;
      writeJson(manifestPath, manifest);
      throw new Error(`${task.id}: provider create failed; stopped without retry.`);
    }
    try {
      await convertProviderOutput(body, task);
    } catch (error) {
      task.status = "failed";
      task.error = error instanceof Error ? error.message : String(error);
      manifest.runtime.failed += 1;
      writeJson(manifestPath, manifest);
      throw new Error(`${task.id}: provider result conversion failed; stopped without retry.`);
    }
    task.outputHash = sha256(fs.readFileSync(task.stageFile));
    task.outputFingerprints = Object.fromEntries(Object.entries(await imageFingerprints(task.stageFile)).map(([key, value]) => [key, value.toString(16)]));
    task.providerRequestId = requestId;
    task.status = "succeeded";
    task.error = "";
    manifest.runtime.succeeded += 1;
    manifest.runtime.providerRequestIds.push({ taskId: task.id, requestId });
    writeJson(manifestPath, manifest);
    console.log(`succeeded ${task.id} (${manifest.runtime.succeeded}/${manifest.tasks.length})`);
  }

  const diversityResult = await evaluateDiversity(manifest);
  manifest.diversityResult = diversityResult;
  manifest.runtime.completedAt = new Date().toISOString();
  manifest.runtime.qualityFailed = diversityResult.pass ? 0 : diversityResult.failures.length;
  writeJson(manifestPath, manifest);
  assert(diversityResult.pass, "Diversity gate failed; no assets were applied.");
  console.log(JSON.stringify({ ok: true, paidCreateAttempts: manifest.runtime.paidCreateAttempts, diversity: diversityResult }, null, 2));
}

async function apply(manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(manifest.runtime?.succeeded, manifest.tasks.length, "All provider tasks must succeed before apply.");
  assert.equal(manifest.runtime?.failed, 0, "Failed provider tasks block apply.");
  assert.equal(manifest.diversityResult?.pass, true, "Diversity gate must pass before apply.");
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  assert(!fs.existsSync(finalRoot), `Final output directory already exists: ${finalRoot}`);

  const prisma = new PrismaClient();
  try {
    const { page, content } = await loadPage(prisma);
    assert.equal(hashJson(page.contentJson), manifest.sourcePage.contentHash, "LivePage changed after planning; refusing to overwrite newer content.");
    const backup = {
      createdAt: new Date().toISOString(),
      target: "local",
      siteId,
      pageSlug,
      page,
      content
    };
    writeJson(backupPath, backup);
    for (const task of manifest.tasks) {
      assert(fs.existsSync(task.stageFile), `Missing staged image: ${task.stageFile}`);
      fs.mkdirSync(path.dirname(task.finalFile), { recursive: true });
      fs.copyFileSync(task.stageFile, task.finalFile);
    }

    const nextContentJson = structuredClone(page.contentJson);
    const nextContent = nextContentJson.sections[sectionId].settings.content;
    for (const task of manifest.tasks) {
      const currentItem = nextContent.useCases.items[task.index];
      assert(currentItem, `Missing use-case item at index ${task.index}.`);
      currentItem.image = { ...(currentItem.image ?? {}), ...imageFromTask(task) };
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.livePage.update({ where: { id: page.id }, data: { contentJson: nextContentJson } });
      for (const task of manifest.tasks) {
        const storageKey = task.outputRelative;
        const mediaId = `media_${siteId}_${sha256(storageKey).slice(0, 16)}`;
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey } },
          create: {
            id: mediaId,
            siteId,
            label: task.altText,
            storageKey,
            mimeType: "image/webp",
            usageType: "theme",
            sourceType: "ai-talking-photo-regeneration",
            previewUrl: task.publicUrl,
            originUrl: task.publicUrl,
            altText: task.altText,
            notes: "Generated from the current Talking Photo SEO/page intent with independent scene-style direction."
          },
          update: {
            label: task.altText,
            mimeType: "image/webp",
            usageType: "theme",
            sourceType: "ai-talking-photo-regeneration",
            previewUrl: task.publicUrl,
            originUrl: task.publicUrl,
            altText: task.altText,
            notes: "Generated from the current Talking Photo SEO/page intent with independent scene-style direction."
          }
        });
      }
      return { pageId: page.id, mediaAssets: manifest.tasks.length, images: manifest.tasks.length, heroVideoChanged: false };
    }, { timeout: 120_000 });

    const readback = await loadPage(prisma);
    const readbackItems = readback.content.useCases.items;
    for (const task of manifest.tasks) {
      assert.equal(readbackItems[task.index]?.image?.src, task.publicUrl, `${task.id}: image source readback failed.`);
      assert.equal(readbackItems[task.index]?.image?.alt, task.altText, `${task.id}: alt readback failed.`);
      assert(readbackItems[task.index].image.alt.length >= 35, `${task.id}: alt text is too short.`);
    }
    const mediaReadback = await prisma.mediaAsset.findMany({ where: { siteId, storageKey: { in: manifest.tasks.map((task) => task.outputRelative) } }, select: { storageKey: true, altText: true, previewUrl: true } });
    assert.equal(mediaReadback.length, manifest.tasks.length, "MediaAsset readback count failed.");
    manifest.apply = { target: "local", appliedAt: new Date().toISOString(), backupPath, finalRoot, updated };
    manifest.mode = "applied";
    writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode: "applied", batchId, updated, backupPath, diversity: manifest.diversityResult }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assert(["plan", "generate", "apply"].includes(mode), `Unsupported mode: ${mode}`);
  assertDatabaseTarget({ expectedTarget: "local" });
  const prisma = new PrismaClient();
  try {
    if (mode === "plan") {
      if (fs.existsSync(manifestPath)) {
        const existingManifest = readJson(manifestPath);
        assert.equal(Number(existingManifest.runtime?.paidCreateAttempts || 0), 0, "Refusing to rebuild a manifest with provider attempts; use a new batch.");
      }
      const current = await loadPage(prisma);
      const manifest = buildPlan(current);
      writeJson(manifestPath, manifest);
      console.log(JSON.stringify({ ok: true, mode, manifestPath, batchId, generationTasks: manifest.tasks.length, uniquePrompts: manifest.diversity.uniquePrompts, uniqueArtDirections: manifest.diversity.independentArtDirections, uniqueAltTexts: manifest.diversity.uniqueAltTexts, provider: manifest.provider, scope: manifest.scope }, null, 2));
      return;
    }
  } finally {
    await prisma.$disconnect();
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
