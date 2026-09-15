#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const providerId = "aiprov_mu13l0rf_xtekhv";
const providerLabel = "buming-image";
const model = "gpt-image-2";
const batchId = "aidreamshoots-review-media-20260915-v1";
const finalRoot = path.resolve(repoRoot, "public/assets/sites/site_aidreamshoots/generated/regenerated", batchId);
const resultRoot = path.resolve(repoRoot, "releases/provider-results/aidreamshoots/reviews", batchId);
const publicRoot = `/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}`;
const imageSize = "1024x1024";
const imageQuality = "low";
const maxPaidCreates = 16;
const timeoutMs = 300_000;

const reviewPlans = [
  {
    id: "review_ava",
    slug: "ava",
    name: "Ava M.",
    theme: "football fan photos",
    avatarSubject: "a cheerful woman in her late 20s with warm medium skin, shoulder-length dark brown wavy hair, brown eyes, and a natural bright smile",
    resultScene: "celebrating at a sunny football stadium with a small green-and-yellow scarf, soft crowd blur and no real team logos",
    avatarFile: "ava-avatar.webp",
    resultFile: "ava-football-fan.webp",
    avatarAlt: "Ava, retrato de primer plano para una galería de fotos de aficionada al fútbol.",
    resultAlt: "Ava celebra en un estadio de fútbol en su galería privada de fotos con IA."
  },
  {
    id: "review_lucas",
    slug: "lucas",
    name: "Lucas R.",
    theme: "gala profile images",
    avatarSubject: "a stylish man in his mid 30s with light olive skin, thick dark wavy hair, brown eyes, a neatly trimmed short beard, and a relaxed confident expression",
    resultScene: "attending an elegant evening gala in a black tuxedo, warm lights, softly blurred guests and a refined event entrance with no logos",
    avatarFile: "lucas-avatar.webp",
    resultFile: "lucas-gala.webp",
    avatarAlt: "Lucas, retrato de primer plano para una galería de fotos profesionales.",
    resultAlt: "Lucas posa en una gala elegante dentro de su galería privada de fotos con IA."
  },
  {
    id: "review_mia",
    slug: "mia",
    name: "Mia C.",
    theme: "Christmas holiday cards",
    avatarSubject: "a woman in her early 30s with fair warm skin, shoulder-length chestnut hair with soft waves, hazel eyes, and a kind genuine smile",
    resultScene: "holding a small wrapped holiday gift in a cozy living room beside a decorated Christmas tree and warm golden lights, no text",
    avatarFile: "mia-avatar.webp",
    resultFile: "mia-christmas.webp",
    avatarAlt: "Mia, retrato de primer plano para una galería de tarjetas navideñas.",
    resultAlt: "Mia sostiene un regalo junto al árbol en su galería privada de fotos navideñas con IA."
  },
  {
    id: "review_noah",
    slug: "noah",
    name: "Noah P.",
    theme: "private photo gallery",
    avatarSubject: "a relaxed man in his early 30s with medium tan skin, short dark curly hair, brown eyes, a neatly groomed beard, and a subtle satisfied smile",
    resultScene: "reviewing finished portrait results on a laptop in a calm modern apartment workspace with soft daylight; the laptop screen is turned away and has no readable content",
    avatarFile: "noah-avatar.webp",
    resultFile: "noah-private-gallery.webp",
    avatarAlt: "Noah, retrato de primer plano para una galería privada de fotos con IA.",
    resultAlt: "Noah revisa sus resultados en una galería privada de fotos con IA."
  },
  {
    id: "review_chloe",
    slug: "chloe",
    name: "Chloe S.",
    theme: "creator scenes",
    avatarSubject: "a woman in her late 20s with medium brown skin, long dark brown hair, brown eyes, subtle natural makeup, and a confident friendly smile",
    resultScene: "holding a compact camera in a bright creative studio with coral and cobalt color panels, modern props softly blurred and no logos or text",
    avatarFile: "chloe-avatar.webp",
    resultFile: "chloe-creator-scene.webp",
    avatarAlt: "Chloe, retrato de primer plano para una galería de contenido de creadora.",
    resultAlt: "Chloe crea contenido en un estudio luminoso dentro de su galería privada de fotos con IA."
  },
  {
    id: "review_eli",
    slug: "eli",
    name: "Eli T.",
    theme: "professional headshots",
    avatarSubject: "a man in his early 30s with fair olive skin, short dark brown hair, brown eyes, clean-shaven face, and an approachable expression",
    resultScene: "wearing a navy blazer over a light shirt in a softly blurred modern office with window light, polished but believable professional headshot styling",
    avatarFile: "eli-avatar.webp",
    resultFile: "eli-professional-headshot.webp",
    avatarAlt: "Eli, retrato de primer plano para una galería de retratos profesionales.",
    resultAlt: "Eli aparece con un retrato profesional en su galería privada de fotos con IA."
  },
  {
    id: "review_jordan",
    slug: "jordan",
    name: "Jordan K.",
    theme: "team profile portraits",
    avatarSubject: "a man in his late 30s with deep brown skin, short textured black hair, dark brown eyes, a neatly trimmed beard, and a warm professional smile",
    resultScene: "standing in a bright contemporary office for a polished team profile portrait, subtle desks and plants softly out of focus, no other visible faces and no logos",
    avatarFile: "jordan-avatar.webp",
    resultFile: "jordan-team-profile.webp",
    avatarAlt: "Jordan, retrato de primer plano para una galería de perfiles de equipo.",
    resultAlt: "Jordan posa para un perfil de equipo en su galería privada de fotos con IA."
  },
  {
    id: "review_riley",
    slug: "riley",
    name: "Riley W.",
    theme: "social content",
    avatarSubject: "a woman in her late 20s with light brown skin, long dark honey-brown hair, green-brown eyes, and a bright genuine smile",
    resultScene: "taking a casual photo with her phone at a sunny outdoor city cafe, phone held naturally without covering her face, plants and warm architecture softly blurred, no logos or text",
    avatarFile: "riley-avatar.webp",
    resultFile: "riley-social-content.webp",
    avatarAlt: "Riley, retrato de primer plano para una galería de contenido social.",
    resultAlt: "Riley crea una foto social en una cafetería dentro de su galería privada de fotos con IA."
  }
];

const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const paidConfirmation = args["confirm-paid"] === true || String(args["confirm-paid"] || "") === "true";
const requestedCap = Number(args["max-paid-creates"] ?? 0);
const resume = args.resume === true || String(args.resume || "") === "true";

assert(["plan", "generate", "recover"].includes(mode), "mode must be plan, generate, or recover");
assert.equal(args.retry, undefined, "Paid image creation retries are disabled.");
assert.equal(args.fallback, undefined, "Paid provider fallback is disabled.");
assert.equal(reviewPlans.length * 2, maxPaidCreates);
if (mode === "generate") {
  assert(paidConfirmation, "Paid creation requires --confirm-paid=true.");
  assert.equal(requestedCap, maxPaidCreates, `Paid creation requires --max-paid-creates=${maxPaidCreates}.`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const raw = token.slice(2);
    const separator = raw.indexOf("=");
    if (separator >= 0) {
      parsed[raw.slice(0, separator)] = raw.slice(separator + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      parsed[raw] = next;
      index += 1;
    } else {
      parsed[raw] = true;
    }
  }
  return parsed;
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/i);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function requestId(plan, kind) {
  return `${batchId}:${plan.id}:${kind}:${crypto.randomUUID()}`;
}

function imageBufferFromBody(body) {
  const encoded = body?.data?.[0]?.b64_json
    ?? body?.data?.[0]?.image_base64
    ?? body?.output?.[0]?.b64_json
    ?? body?.output?.[0]?.image_base64
    ?? body?.image_base64;
  return encoded ? Buffer.from(encoded, "base64") : undefined;
}

async function imageBufferFromProviderUrl(url, providerOrigin, apiKey) {
  const parsed = new URL(url);
  assert.equal(parsed.protocol, "https:", "Provider image URL must use HTTPS.");
  const allowedOrigins = new Set([providerOrigin, "https://assets.token6688.com", "https://cdn.token6688.com"]);
  assert(allowedOrigins.has(parsed.origin), "Provider image URL origin must match the configured supplier or its asset CDN.");
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(parsed, { method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store", signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw new Error(`provider_image_download_failed_${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("provider_image_download_failed");
}

function redactedProviderBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => /(?:b64|base64)/i.test(key) && typeof value === "string" ? `[omitted:${value.length}]` : value));
}

function firstProviderUrl(value) {
  if (!value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstProviderUrl(item);
      if (found) return found;
    }
    return "";
  }
  for (const [key, child] of Object.entries(value)) {
    if (/url/i.test(key) && typeof child === "string" && /^https:\/\//i.test(child)) return child;
    const found = firstProviderUrl(child);
    if (found) return found;
  }
  return "";
}

async function providerImageBuffer(body, provider) {
  const buffer = imageBufferFromBody(body);
  if (buffer) return { buffer, responseType: "b64_json" };
  const url = body?.data?.[0]?.url ?? body?.data?.[0]?.image_url ?? body?.output?.[0]?.url ?? body?.output?.[0]?.image_url ?? body?.url ?? body?.image_url;
  if (url) return { buffer: await imageBufferFromProviderUrl(String(url), provider.origin, provider.apiKey), responseType: "url" };
  throw new Error("provider_empty_image_payload");
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, preferred: true, supportsEditN: true, maxImagesPerRequest: true, imageQuality: true, imageResolution: true, imageOutputFormat: true }
    });
    assert(provider, `Missing image provider ${providerId}`);
    assert.equal(provider.label, providerLabel);
    assert.equal(provider.modelType, model);
    assert.equal(provider.providerType, "image");
    assert.equal(provider.enabled, true);
    assert.equal(provider.supportsEditN, true);
    assert.equal(provider.maxImagesPerRequest, 1);
    assert(provider.apiKey && provider.aiUrl, "Supplier credentials are missing.");
    const baseUrl = normalizeBaseUrl(provider.aiUrl);
    return { ...provider, baseUrl, origin: new URL(baseUrl).origin };
  } finally {
    await prisma.$disconnect();
  }
}

async function preflight(provider) {
  const response = await fetch(`${provider.baseUrl}/models`, {
    method: "GET",
    headers: { Authorization: `Bearer ${provider.apiKey}`, Accept: "application/json" },
    cache: "no-store"
  });
  assert.equal(response.ok, true, `Supplier model preflight failed: ${response.status}`);
  const body = await response.json();
  const modelInfo = (body.data ?? []).find((item) => item.id === model);
  assert(modelInfo, `Supplier does not advertise ${model}`);
  return {
    endpoint: `${provider.baseUrl}/models`,
    method: "GET",
    status: response.status,
    model: modelInfo.id,
    billingMode: modelInfo.billing_mode,
    billingUnit: modelInfo.billing_unit,
    unitPriceMicroUsd: modelInfo.unit_price_micro_usd
  };
}

function avatarPrompt(plan) {
  return [
    "Use case: photorealistic-natural",
    "Asset type: square customer testimonial avatar for a Spanish AI photo storefront",
    `Primary request: create a brand-new large headshot portrait for ${plan.name}, a fictional adult customer reviewing ${plan.theme}.`,
    `Subject identity: ${plan.avatarSubject}.`,
    "Composition: tight head-and-shoulders passport-style portrait, face large, centered, looking at camera, plain softly lit background, suitable for a circular 56px avatar crop.",
    "Style: realistic premium portrait photography, natural skin texture, believable eyes and hair, no beauty-filter plasticity.",
    "Constraints: fictional adult, one person only, clear unobstructed face, no text, no logo, no watermark, no border, no collage, no split screen, no duplicated person.",
    "Avoid: illustration, CGI, celebrity likeness, distorted anatomy, extra fingers, sunglasses, heavy shadow across the face, visible signage."
  ].join("\n");
}

function resultPrompt(plan) {
  return [
    "Use case: identity-preserve",
    "Asset type: square customer testimonial result image for a Spanish AI photo storefront",
    `Primary request: create a brand-new finished themed result image for ${plan.name}'s ${plan.theme}.`,
    `Scene direction: ${plan.resultScene}.`,
    `Identity constraint: use the supplied avatar as the exact same adult person. Preserve the person's facial identity, skin tone, hair pattern, eye shape, and age; only change the scene, wardrobe, pose, and environment needed for the theme.`,
    "Composition: one complete square editorial photograph with the person clearly recognizable, face visible and large enough to compare with the avatar.",
    "Style: realistic premium AI photo result, natural skin texture, believable hands and lighting, polished but not artificial.",
    "Constraints: fictional adult, one main person, no text, no logo, no watermark, no border, no collage, no split screen, no contact sheet, no duplicated face, no readable screen content.",
    "Avoid: identity drift, different hair color, different facial structure, illustration, CGI, celebrity likeness, distorted anatomy, extra fingers, public figure resemblance."
  ].join("\n");
}

async function callProvider(provider, plan, kind, prompt, referencePath) {
  const id = requestId(plan, kind);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let body;
    let headers = { Authorization: `Bearer ${provider.apiKey}`, "Idempotency-Key": id, "X-Client-Request-Id": id };
    let endpoint = `${provider.baseUrl}/images/generations`;
    if (referencePath) {
      endpoint = `${provider.baseUrl}/images/edits`;
      const reference = await sharp(await fs.readFile(referencePath)).rotate().png().toBuffer();
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", prompt);
      form.append("size", imageSize);
      form.append("quality", imageQuality);
      form.append("n", "1");
      form.append("response_format", "b64_json");
      form.append("image", new Blob([reference], { type: "image/png" }), `${plan.slug}-avatar.png`);
      body = form;
    } else {
      headers = { ...headers, "Content-Type": "application/json" };
      body = JSON.stringify({ model, prompt, size: imageSize, quality: imageQuality, n: 1, response_format: "b64_json" });
    }
    const response = await fetch(endpoint, { method: "POST", headers, body, signal: controller.signal });
    const responseText = await response.text();
    let responseJson = {};
    try { responseJson = JSON.parse(responseText); } catch {}
    await fs.mkdir(resultRoot, { recursive: true });
    await fs.writeFile(
      path.join(resultRoot, `${plan.slug}-${kind}-provider-response.json`),
      JSON.stringify({
        batchId,
        reviewId: plan.id,
        kind,
        requestId: id,
        endpoint,
        status: response.status,
        providerRequestId: response.headers.get("x-request-id") || response.headers.get("request-id") || "",
        response: redactedProviderBody(responseJson)
      }, null, 2) + "\n"
    );
    if (!response.ok) throw new Error(`provider_failed_${response.status}_${responseText.slice(0, 600)}`);
    const image = await providerImageBuffer(responseJson, provider);
    return {
      id,
      endpoint,
      status: response.status,
      providerRequestId: response.headers.get("x-request-id") || response.headers.get("request-id") || "",
      responseType: image.responseType,
      buffer: image.buffer
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`provider_request_timeout_or_unknown_state:${id}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function writeImage(buffer, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(buffer).rotate().resize(1024, 1024, { fit: "cover" }).webp({ quality: 92, smartSubsample: true }).toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  assert.equal(metadata.width, 1024);
  assert.equal(metadata.height, 1024);
  const stat = await fs.stat(outputPath);
  assert(stat.size > 0);
  return { width: metadata.width, height: metadata.height, bytes: stat.size };
}

function plannedTasks() {
  return reviewPlans.flatMap((plan) => [
    { id: plan.id, kind: "avatar", filename: plan.avatarFile, publicUrl: `${publicRoot}/${plan.avatarFile}`, prompt: avatarPrompt(plan), reference: null },
    { id: plan.id, kind: "result", filename: plan.resultFile, publicUrl: `${publicRoot}/${plan.resultFile}`, prompt: resultPrompt(plan), reference: plan.avatarFile }
  ]);
}

async function recoverProviderResponses(provider) {
  const tasks = plannedTasks();
  const responseFiles = (await fs.readdir(resultRoot)).filter((file) => file.endsWith("-provider-response.json")).sort();
  const recovered = [];
  for (const file of responseFiles) {
    const responsePath = path.join(resultRoot, file);
    const saved = JSON.parse(await fs.readFile(responsePath, "utf8"));
    const task = tasks.find((item) => item.id === saved.reviewId && item.kind === saved.kind);
    assert(task, `Unknown task in ${file}`);
    const plan = reviewPlans.find((item) => item.id === task.id);
    assert(plan);
    const finalPath = path.join(finalRoot, task.filename);
    try {
      const stat = await fs.stat(finalPath);
      if (stat.size > 0) {
        recovered.push({ id: task.id, kind: task.kind, skipped: true, finalPath, publicUrl: task.publicUrl });
        continue;
      }
    } catch {}
    const url = firstProviderUrl(saved.response);
    assert(url, `No provider result URL found in ${file}`);
    const buffer = await imageBufferFromProviderUrl(url, provider.origin, provider.apiKey);
    const rawPath = path.join(resultRoot, `${plan.slug}-${task.kind}.png`);
    await fs.writeFile(rawPath, buffer);
    const written = await writeImage(buffer, finalPath);
    recovered.push({ id: task.id, kind: task.kind, skipped: false, requestId: saved.requestId, providerRequestId: saved.providerRequestId, recoveredFrom: responsePath, rawPath, finalPath, publicUrl: task.publicUrl, ...written });
    console.log(`recovered provider result: ${task.id}/${task.kind}`);
  }
  await fs.writeFile(path.join(resultRoot, "recovery-report.json"), JSON.stringify({ ok: true, batchId, provider: { id: providerId, label: providerLabel, model }, readOnlyOperation: "GET provider asset CDN", recovered }, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, mode: "recover", recovered: recovered.filter((item) => !item.skipped).length, alreadyPresent: recovered.filter((item) => item.skipped).length, resultRoot }, null, 2));
}

async function main() {
  const tasks = plannedTasks();
  console.log(JSON.stringify({
    mode,
    batchId,
    provider: { id: providerId, label: providerLabel, model, endpoints: ["POST /v1/images/generations", "POST /v1/images/edits"], size: imageSize, quality: imageQuality },
    plannedPaidCreates: tasks.length,
    maxPaidCreates,
    attemptsPerCreate: 1,
    automaticRetry: false,
    providerFallback: false,
    identityStrategy: "Generate a fresh headshot first; generate each themed result with its matching headshot as the only reference image.",
    output: finalRoot
  }, null, 2));
  if (mode === "plan") return;

  const provider = await loadProvider();
  if (mode === "recover") {
    await recoverProviderResponses(provider);
    return;
  }
  const preflightResult = await preflight(provider);
  console.log(JSON.stringify({ preflight: preflightResult }, null, 2));
  await fs.mkdir(resultRoot, { recursive: true });
  await fs.writeFile(path.join(resultRoot, "generation-plan.json"), JSON.stringify({ batchId, provider: { id: providerId, label: providerLabel, model }, preflight: preflightResult, maxPaidCreates, attemptsPerCreate: 1, tasks: tasks.map(({ prompt, ...task }) => ({ ...task, prompt })) }, null, 2) + "\n");

  const report = [];
  let paidCreates = 0;
  for (const task of tasks) {
    const plan = reviewPlans.find((item) => item.id === task.id);
    assert(plan);
    const finalPath = path.join(finalRoot, task.filename);
    if (resume) {
      try {
        const stat = await fs.stat(finalPath);
        if (stat.size > 0) {
          report.push({ id: task.id, kind: task.kind, skipped: true, finalPath, publicUrl: task.publicUrl });
          continue;
        }
      } catch {}
    }
    assert(paidCreates < maxPaidCreates, "Paid create cap exceeded.");
    const referencePath = task.reference ? path.join(finalRoot, task.reference) : null;
    if (referencePath) {
      const stat = await fs.stat(referencePath);
      assert(stat.size > 0, `Missing avatar reference for ${task.id}`);
    }
    console.log(`supplier create ${paidCreates + 1}/${maxPaidCreates}: ${task.id}/${task.kind}`);
    const created = await callProvider(provider, plan, task.kind, task.prompt, referencePath);
    paidCreates += 1;
    const rawPath = path.join(resultRoot, `${plan.slug}-${task.kind}.png`);
    await fs.writeFile(rawPath, created.buffer);
    const written = await writeImage(created.buffer, finalPath);
    const item = { id: task.id, kind: task.kind, skipped: false, requestId: created.id, providerRequestId: created.providerRequestId, endpoint: created.endpoint, status: created.status, responseType: created.responseType, rawPath, finalPath, publicUrl: task.publicUrl, ...written };
    report.push(item);
    await fs.writeFile(path.join(resultRoot, "generation-progress.json"), JSON.stringify({ batchId, paidCreates, maxPaidCreates, report }, null, 2) + "\n");
  }

  assert.equal(report.length, maxPaidCreates, "Not all approved supplier tasks completed or were recovered.");
  assert.equal(new Set(reviewPlans.map((plan) => report.find((item) => item.id === plan.id && item.kind === "avatar")?.publicUrl)).size, reviewPlans.length);
  await fs.writeFile(path.join(resultRoot, "generation-report.json"), JSON.stringify({ ok: true, batchId, provider: { id: providerId, label: providerLabel, model }, paidCreates, maxPaidCreates, attemptsPerCreate: 1, preflight: preflightResult, report }, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, batchId, provider: providerLabel, model, paidCreates, maxPaidCreates, resultRoot, output: finalRoot }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
