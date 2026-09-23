#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const siteId = "site_aidreamcapes_xby";
const siteSlug = "aidreamcapes-eu";
const homeSlug = "/";
const expectedConfirmation = "aidreamcapes-eu-review-theme-vendor-generation";
const batchId = "aidreamcapes-eu-review-theme-vendor-20260919-v1";
const manifestPath = path.resolve(".tmp", batchId, "manifest.json");
const stageRoot = path.resolve(".tmp", batchId, "outputs");
const publicRoot = path.resolve("public");
const finalRoot = path.resolve("public", "assets", "sites", "site_aidreamcapes_eu", "generated", "public-media", "reviews", "vendor-20260919");
const finalPublicRoot = "/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/vendor-20260919";
const avatarVersion = "20260919eureviewheadshot1";
const resultVersion = "20260919eureviewvendor1";
const imageSize = "1024x1536";
const imageQuality = "low";
const maxPaidCreates = 8;
const timeoutMs = 300_000;

const reviewPlans = [
  {
    id: "review_ava",
    shortId: "ava",
    name: "Ava M.",
    altText: "Scène de supporter d’Ava M. dans un stade, créée à partir de son portrait",
    theme: "football supporter memory",
    identity: "the same fictional adult man as the reference portrait: dark wavy hair, short beard, warm expressive eyes, joyful face",
    scene: "a packed football stadium at dusk, wearing a red jacket and holding a plain red scarf above his head, bright stadium floodlights, soft cheering crowd in the background",
    referencePath: path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-ava-headshot.webp")
  },
  {
    id: "review_lucas",
    shortId: "lucas",
    name: "Lucas R.",
    altText: "Portrait professionnel de Lucas R. dans un foyer d’opéra, créé à partir de son portrait",
    theme: "professional profile portrait",
    identity: "the same fictional adult man as the reference portrait: dark wavy hair, neat short beard, defined jaw, calm confident expression",
    scene: "a grand opera foyer with warm chandeliers and polished stone, wearing a crisp white tuxedo and black bow tie, standing in a natural three-quarter pose",
    referencePath: path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-lucas-headshot.webp")
  },
  {
    id: "review_mia",
    shortId: "mia",
    name: "Mia C.",
    altText: "Scène de carte de Noël de Mia C. près d’un sapin, créée à partir de son portrait",
    theme: "Christmas card portrait",
    identity: "the same fictional adult woman as the reference portrait: shoulder-length warm brown wavy hair, gentle smile, natural facial features",
    scene: "a cozy Christmas living room with a decorated tree, warm candlelight and soft window glow, wearing a textured red knit sweater and holding a small wrapped gift, intimate holiday-card composition",
    referencePath: path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-mia-headshot.webp")
  },
  {
    id: "review_noah",
    shortId: "noah",
    name: "Noah P.",
    altText: "Scène de petit-déjeuner de Noah P. dans une villa méditerranéenne, créée à partir de son portrait",
    theme: "private lifestyle gallery",
    identity: "the same fictional adult woman as the reference portrait: dark brown hair tied loosely back, soft features, relaxed thoughtful expression",
    scene: "a sunlit Mediterranean villa breakfast terrace overlooking distant mountains, wearing an elegant light linen outfit, holding a ceramic coffee cup beside a croissant and fresh fruit, natural morning lifestyle photography",
    referencePath: path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-noah-headshot.webp")
  },
  {
    id: "review_chloe",
    shortId: "chloe",
    name: "Chloe S.",
    altText: "Scène de créateur de Chloe S. dans une cuisine, créée à partir de son portrait",
    theme: "creator cooking scene",
    identity: "the same fictional adult man as the reference portrait: curly dark hair, full short beard, friendly eyes, approachable smile",
    scene: "a warm modern kitchen set up for a creator cooking session, wearing a simple apron, preparing colorful ingredients beside a small camera on a tripod, natural candid action and soft editorial light",
    referencePath: path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-chloe-headshot.webp")
  },
  {
    id: "review_eli",
    shortId: "eli",
    name: "Eli T.",
    altText: "Portrait de monteur vidéo d’Eli T. dans un studio créatif, créé à partir de son portrait",
    theme: "professional creative portrait",
    identity: "the same fictional adult man as the reference portrait: dark hair, short beard, focused eyes, thoughtful professional expression",
    scene: "a cinematic film-editing studio with a professional monitor showing abstract blurred color only, desk controls, headphones around his neck and soft practical lights, modern creator workspace photography",
    referencePath: path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-eli-headshot.webp")
  },
  {
    id: "review_jordan",
    shortId: "jordan",
    name: "Jordan K.",
    altText: "Portrait d’équipe de Jordan K. dans un studio lumineux, créé à partir de son portrait",
    theme: "team profile update",
    identity: "the same fictional adult woman as the reference portrait: dark hair, warm complexion, bright eyes, composed friendly expression",
    scene: "a bright contemporary team studio with mirrored architectural panels and soft daylight, wearing a mustard-yellow blouse and tailored trousers, standing beside a clean collaborative work table, polished professional profile photography",
    referencePath: path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-jordan-headshot.webp")
  },
  {
    id: "review_riley",
    shortId: "riley",
    name: "Riley W.",
    altText: "Scène de contenu social de Riley W. dans une cour de Marrakech, créée à partir de son portrait",
    theme: "travel social content",
    identity: "the same fictional adult woman as the reference portrait: dark hair, expressive eyes, natural smile, confident relaxed presence",
    scene: "a sunlit Marrakech courtyard with terracotta arches, patterned tile, leafy plants and distant warm hills, wearing a tasteful orange dress and holding a small travel camera, polished social-content travel photography",
    referencePath: path.resolve("public/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-riley-headshot.webp")
  }
];

const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "generate").toLowerCase();

function parseArgs(list) {
  const result = {};
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equals = raw.indexOf("=");
    const key = raw.slice(0, equals >= 0 ? equals : undefined).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equals >= 0) result[key] = raw.slice(equals + 1);
    else {
      const next = list[index + 1];
      if (!next || next.startsWith("--")) result[key] = true;
      else { result[key] = next; index += 1; }
    }
  }
  return result;
}

function assertConfirmation() {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Requires --confirm=${expectedConfirmation}.`);
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").replace(/\/+$/, "");
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function avatarUrl(shortId) {
  return `/assets/sites/site_aidreamcapes_eu/generated/public-media/reviews/review-${shortId}-headshot.webp?v=${avatarVersion}`;
}

function resultUrl(shortId) {
  return `${finalPublicRoot}/review-${shortId}-theme.webp?v=${resultVersion}`;
}

function stripQuery(value) {
  return String(value || "").split(/[?#]/)[0];
}

function localPathForUrl(url) {
  const pathname = stripQuery(url);
  assert(pathname.startsWith("/assets/"), `Expected local asset URL, received ${url}`);
  const filePath = path.resolve(publicRoot, pathname.slice(1));
  assert(filePath.startsWith(`${publicRoot}${path.sep}`), `Asset escaped public root: ${url}`);
  return filePath;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildPrompt(plan) {
  return [
    "Use case: identity-preserve photorealistic-natural image edit.",
    "Asset type: one new vertical customer review result image for a French AI photo storefront.",
    `Theme: ${plan.theme}.`,
    `Identity reference: ${plan.identity}.`,
    `New scene: ${plan.scene}.`,
    "Use the uploaded image only as an identity reference. Keep the same fictional adult person recognizable, but create a genuinely new scene, pose, wardrobe context, camera angle, lighting setup and background.",
    "Create one single finished photograph, not a collage, not a split screen, not a before-and-after, and not an avatar crop.",
    "Premium realistic editorial photography, believable anatomy, natural hands, clean facial detail, tasteful composition, strong vertical framing.",
    "No text, no captions, no logos, no watermarks, no UI, no readable signage, no celebrity likeness, no public figure, no team or brand marks, no duplicated face, no distorted hands."
  ].join("\n");
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json || body?.data?.[0]?.image_base64 || body?.output?.[0]?.b64_json || body?.output?.[0]?.image_base64 || body?.image_base64 || "";
}

function imageUrlPayload(body) {
  return body?.data?.[0]?.url || body?.data?.[0]?.image_url || body?.output?.[0]?.url || body?.output?.[0]?.image_url || body?.url || body?.image_url || "";
}

function redactedBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => /(?:b64|base64)/i.test(key) && typeof value === "string" ? `[omitted:${value.length}]` : value));
}

async function imageBufferFromUrl(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`provider_output_download_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findFirst({
      where: { modelType: "gpt-image-2", providerType: "image", enabled: true },
      orderBy: [{ preferred: "desc" }, { priority: "asc" }, { updatedAt: "desc" }]
    });
    assert(provider?.apiKey && provider.aiUrl, "No enabled gpt-image-2 image provider is configured.");
    assert.equal(provider.supportsEditN, true, `${provider.label}: image edit support is not enabled.`);
    assert.equal(provider.maxImagesPerRequest, 1, `${provider.label}: expected one image per request for this capped run.`);
    return { id: provider.id, label: provider.label, baseUrl: normalizeBaseUrl(provider.aiUrl), apiKey: provider.apiKey, model: provider.modelType };
  } finally {
    await prisma.$disconnect();
  }
}

async function checkProviderReadOnly(provider) {
  const response = await fetch(`${provider.baseUrl}/models`, { headers: { Authorization: `Bearer ${provider.apiKey}` }, signal: AbortSignal.timeout(30_000) });
  const body = await response.json().catch(() => ({}));
  assert(response.ok, `Provider read-only model check failed with ${response.status}.`);
  const ids = Array.isArray(body?.data) ? body.data.map((item) => item?.id).filter(Boolean) : [];
  return { status: response.status, modelCount: ids.length, modelMatch: ids.length === 0 ? "provider did not expose model list" : ids.includes(provider.model) };
}

async function buildEditForm(provider, plan) {
  const referenceBuffer = await sharp(plan.referencePath).rotate().png().toBuffer();
  const form = new FormData();
  form.append("model", provider.model);
  form.append("prompt", buildPrompt(plan));
  form.append("size", imageSize);
  form.append("quality", imageQuality);
  form.append("response_format", "b64_json");
  form.append("image", new Blob([referenceBuffer], { type: "image/png" }), `review-${plan.shortId}-identity.png`);
  return form;
}

function freshManifest(provider, modelCheck) {
  return {
    batchId,
    createdAt: new Date().toISOString(),
    target: { siteId, siteSlug, database: "local" },
    provider: { id: provider.id, label: provider.label, model: provider.model, endpoint: `${provider.baseUrl}/images/edits`, method: "POST", size: imageSize, quality: imageQuality, retry: false, fallback: false, readOnlyModelCheck: modelCheck },
    safety: { maxPaidCreatesAuthorized: maxPaidCreates, attemptsPerCreate: 1, stopOnFirstFailureOrAmbiguousState: true },
    runtime: { paidCreateAttempts: 0, succeeded: 0, failed: 0, ambiguous: 0, providerRequestIds: [], providerTaskIds: [] },
    tasks: reviewPlans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      referencePath: plan.referencePath,
      prompt: buildPrompt(plan),
      stageOriginalFile: path.join(stageRoot, `review-${plan.shortId}-theme.original.png`),
      stageFile: path.join(stageRoot, `review-${plan.shortId}-theme.webp`),
      publicUrl: resultUrl(plan.shortId),
      status: "planned"
    }))
  };
}

function loadOrCreateManifest(provider, modelCheck) {
  if (!fs.existsSync(manifestPath)) return freshManifest(provider, modelCheck);
  const manifest = readJson(manifestPath);
  assert.equal(manifest.batchId, batchId, "Unexpected vendor generation batch manifest.");
  assert.equal(manifest.provider?.id, provider.id, "Provider changed since the batch was started; refusing mixed-provider resume.");
  assert.equal(manifest.safety?.maxPaidCreatesAuthorized, maxPaidCreates, "Paid create cap changed; refusing resume.");
  for (const task of manifest.tasks) assert(!["in_progress", "unknown_provider_state"].includes(task.status), `${task.id}: unresolved provider state requires manual review before resume.`);
  return manifest;
}

async function generateOne(provider, manifest, plan, task) {
  const idempotencyKey = `${batchId}:${plan.id}`;
  const auditPath = path.join(path.dirname(manifestPath), `${plan.id}-provider.json`);
  manifest.runtime.paidCreateAttempts += 1;
  task.status = "in_progress";
  task.idempotencyKey = idempotencyKey;
  writeJson(manifestPath, manifest);

  let response;
  let body = {};
  const startedAt = Date.now();
  try {
    response = await fetch(`${provider.baseUrl}/images/edits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        "Idempotency-Key": idempotencyKey,
        "X-Client-Request-Id": plan.id
      },
      body: await buildEditForm(provider, plan),
      signal: AbortSignal.timeout(timeoutMs)
    });
    body = await response.json().catch(() => ({}));
  } catch (error) {
    task.status = "unknown_provider_state";
    task.error = error instanceof Error ? error.message : String(error);
    manifest.runtime.ambiguous += 1;
    writeJson(auditPath, { taskId: plan.id, providerId: provider.id, providerLabel: provider.label, model: provider.model, endpoint: `${provider.baseUrl}/images/edits`, idempotencyKey, clientRequestId: plan.id, status: null, elapsedMs: Date.now() - startedAt, error: task.error, retryPolicy: "no-retry" });
    writeJson(manifestPath, manifest);
    throw new Error(`${plan.id}: ambiguous provider create state; stopped without retry.`);
  }

  const requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
  const providerTaskId = body?.data?.[0]?.creation_task_id || body?.output?.[0]?.task_id || body?.task_id || "";
  const usage = body?.usage && typeof body.usage === "object" ? body.usage : null;
  writeJson(auditPath, { taskId: plan.id, providerId: provider.id, providerLabel: provider.label, model: provider.model, endpoint: `${provider.baseUrl}/images/edits`, idempotencyKey, clientRequestId: plan.id, requestId, providerTaskId, usage, status: response.status, elapsedMs: Date.now() - startedAt, response: redactedBody(body), retryPolicy: "no-retry" });
  task.providerRequestId = requestId;
  if (!response.ok) {
    task.status = "failed";
    task.error = `provider_status_${response.status}`;
    manifest.runtime.failed += 1;
    writeJson(manifestPath, manifest);
    throw new Error(`${plan.id}: provider create failed; stopped without retry.`);
  }

  const encoded = imagePayload(body);
  const buffer = encoded ? Buffer.from(encoded, "base64") : await imageBufferFromUrl(String(imageUrlPayload(body)));
  assert(buffer.length > 1024, `${plan.id}: provider returned an unexpectedly small image.`);
  const metadata = await sharp(buffer).metadata();
  assert(metadata.width && metadata.height, `${plan.id}: provider output has no dimensions.`);
  fs.mkdirSync(stageRoot, { recursive: true });
  fs.writeFileSync(task.stageOriginalFile, buffer, { flag: "wx" });
  await sharp(buffer).rotate().webp({ quality: 92, smartSubsample: true }).toFile(task.stageFile);
  const finalMetadata = await sharp(task.stageFile).metadata();
  assert(finalMetadata.width && finalMetadata.height, `${plan.id}: staged theme output has no dimensions.`);
  task.sourceWidth = metadata.width;
  task.sourceHeight = metadata.height;
  task.providerTaskId = providerTaskId;
  task.usage = usage;
  task.outputHash = sha256(buffer);
  task.status = "succeeded";
  task.error = "";
  manifest.runtime.succeeded += 1;
  manifest.runtime.providerRequestIds.push({ taskId: plan.id, requestId });
  manifest.runtime.providerTaskIds.push({ taskId: plan.id, providerTaskId, usage });
  writeJson(manifestPath, manifest);
}

async function generate() {
  assertConfirmation();
  assert.equal(Number(args.maxPaidCreates || maxPaidCreates), maxPaidCreates, `This batch requires --max-paid-creates=${maxPaidCreates}.`);
  const provider = await loadProvider();
  const modelCheck = await checkProviderReadOnly(provider);
  const manifest = loadOrCreateManifest(provider, modelCheck);
  assert(manifest.runtime.paidCreateAttempts <= maxPaidCreates, "paid_create_cap_exceeded before starting.");
  for (const plan of reviewPlans) {
    const task = manifest.tasks.find((item) => item.id === plan.id);
    assert(task, `Missing manifest task ${plan.id}.`);
    if (task.status === "succeeded") continue;
    assert.equal(task.status, "planned", `${plan.id}: task is not safe to start.`);
    assert(manifest.runtime.paidCreateAttempts < maxPaidCreates, "paid_create_cap_exceeded.");
    console.log(`paid create ${manifest.runtime.paidCreateAttempts + 1}/${maxPaidCreates}: ${plan.id} via ${provider.label}/${provider.model}`);
    await generateOne(provider, manifest, plan, task);
  }
  assert.equal(manifest.runtime.succeeded, reviewPlans.length, "Not all review theme generations succeeded.");
  manifest.runtime.completedAt = new Date().toISOString();
  writeJson(manifestPath, manifest);
  console.log(JSON.stringify({ ok: true, mode: "generate", batchId, provider: manifest.provider, paidCreateAttempts: manifest.runtime.paidCreateAttempts, tasks: manifest.tasks.map(({ id, status, sourceWidth, sourceHeight, publicUrl }) => ({ id, status, sourceWidth, sourceHeight, publicUrl })) }, null, 2));
}

function updateReviewJson(json) {
  const next = structuredClone(json);
  const blocks = Array.isArray(next?.sections?.proof_1?.blocks) ? next.sections.proof_1.blocks : [];
  for (const plan of reviewPlans) {
    const block = blocks.find((item) => item?.id === plan.id);
    assert(block?.settings, `${plan.id}: review block is missing from homepage JSON.`);
    block.settings.avatarUrl = avatarUrl(plan.shortId);
    block.settings.resultImageUrl = resultUrl(plan.shortId);
  }
  return next;
}

function reviewParity(json) {
  const blocks = Array.isArray(json?.sections?.proof_1?.blocks) ? json.sections.proof_1.blocks : [];
  return reviewPlans.map((plan) => {
    const block = blocks.find((item) => item?.id === plan.id);
    return { id: plan.id, avatarUrl: block?.settings?.avatarUrl, resultImageUrl: block?.settings?.resultImageUrl, valid: block?.settings?.avatarUrl === avatarUrl(plan.shortId) && block?.settings?.resultImageUrl === resultUrl(plan.shortId) && stripQuery(block.settings.avatarUrl) !== stripQuery(block.settings.resultImageUrl) };
  });
}

async function apply() {
  assertConfirmation();
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  assert(fs.existsSync(manifestPath), `Missing completed generation manifest: ${manifestPath}`);
  const manifest = readJson(manifestPath);
  assert.equal(manifest.runtime?.succeeded, reviewPlans.length, "All provider generations must succeed before apply.");
  assert.equal(manifest.runtime?.failed, 0, "Failed provider generations block apply.");
  assert.equal(manifest.runtime?.ambiguous, 0, "Ambiguous provider state blocks apply.");
  for (const plan of reviewPlans) {
    const task = manifest.tasks.find((item) => item.id === plan.id);
    assert(task?.status === "succeeded" && fs.existsSync(task.stageFile), `${plan.id}: staged vendor output is missing.`);
  }

  const prisma = new PrismaClient();
  try {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.deepEqual(site, { id: siteId, slug: siteSlug, primaryDomain: "aidreamcapes.eu" }, "Target site identity check failed.");
    const [livePage, themePage] = await Promise.all([
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId, slug: homeSlug } } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug: homeSlug } } })
    ]);
    assert(livePage && themePage, "EU homepage rows are missing.");
    const nextLive = updateReviewJson(livePage.contentJson);
    const nextDraft = updateReviewJson(themePage.draftJson);
    const nextPublished = updateReviewJson(themePage.publishedJson);
    assert(reviewParity(nextLive).every((item) => item.valid), "Planned live review parity failed.");

    const mediaRows = reviewPlans.flatMap((plan) => {
      const url = resultUrl(plan.shortId);
      return [{
        id: `media_${siteId}_review_${plan.shortId}_theme_vendor`,
        siteId,
        label: `${plan.name} review themed result`,
        storageKey: stripQuery(url).replace(/^\/assets\//, ""),
        mimeType: "image/webp",
        usageType: "theme",
        sourceType: "aidreamcapes-eu-review-vendor-generation",
        previewUrl: url,
        originUrl: url,
        altText: plan.altText
      }];
    });
    const existingAssets = await prisma.mediaAsset.findMany({ where: { siteId, storageKey: { in: mediaRows.map((row) => row.storageKey) } }, select: { id: true, storageKey: true, label: true, previewUrl: true, originUrl: true, altText: true } });
    const backupPath = path.join(path.dirname(manifestPath), "apply-backup.json");
    writeJson(backupPath, { createdAt: new Date().toISOString(), target: { siteId, siteSlug, database: "local" }, livePage: { id: livePage.id, contentJson: livePage.contentJson }, themePage: { id: themePage.id, draftJson: themePage.draftJson, publishedJson: themePage.publishedJson }, mediaAssets: existingAssets });

    fs.mkdirSync(finalRoot, { recursive: true });
    for (const plan of reviewPlans) {
      const task = manifest.tasks.find((item) => item.id === plan.id);
      const target = localPathForUrl(resultUrl(plan.shortId));
      fs.copyFileSync(task.stageFile, target);
    }
    await prisma.$transaction(async (tx) => {
      await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: nextLive } });
      await tx.themePage.update({ where: { id: themePage.id }, data: { draftJson: nextDraft, publishedJson: nextPublished } });
      for (const row of mediaRows) {
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey: row.storageKey } },
          create: row,
          update: { label: row.label, mimeType: row.mimeType, usageType: row.usageType, sourceType: row.sourceType, previewUrl: row.previewUrl, originUrl: row.originUrl, altText: row.altText }
        });
      }
    }, { timeout: 30_000, maxWait: 10_000 });

    const [liveAfter, themeAfter] = await Promise.all([
      prisma.livePage.findUnique({ where: { id: livePage.id }, select: { contentJson: true } }),
      prisma.themePage.findUnique({ where: { id: themePage.id }, select: { draftJson: true, publishedJson: true } })
    ]);
    const readback = { live: reviewParity(liveAfter.contentJson), themeDraft: reviewParity(themeAfter.draftJson), themePublished: reviewParity(themeAfter.publishedJson) };
    assert(readback.live.every((item) => item.valid), "Live review readback parity failed.");
    assert(readback.themeDraft.every((item) => item.valid), "Theme draft review readback parity failed.");
    assert(readback.themePublished.every((item) => item.valid), "Theme published review readback parity failed.");
    const report = { ok: true, mode: "apply", batchId, target: { siteId, siteSlug, domain: site.primaryDomain }, appliedAt: new Date().toISOString(), backupPath, paidCreateAttempts: manifest.runtime.paidCreateAttempts, readback };
    writeJson(path.join(path.dirname(manifestPath), "apply-summary.json"), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (mode === "generate") return generate();
  if (mode === "apply") return apply();
  throw new Error(`Unsupported mode ${mode}; use --mode=generate or --mode=apply.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
