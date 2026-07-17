#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  localShowcaseImagePath,
  publicShowcaseImagePath,
  showcaseImageThemesForStore,
  showcaseStores
} from "./dreamshoot-homepage-showcase-data.mjs";

const repoRoot = process.cwd();
const rawArgs = process.argv.slice(2);
const args = new Map();
const flags = new Set();

for (let index = 0; index < rawArgs.length; index += 1) {
  const rawArg = rawArgs[index];
  if (!rawArg.startsWith("--")) continue;
  const [key, ...rest] = rawArg.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
  } else {
    const next = rawArgs[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }
}

const dryRun = flags.has("dry-run");
const force = flags.has("force");
const savePrompts = flags.has("save-prompts");
const model = String(args.get("model") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_MODEL ?? "gpt-image-2");
const imageSize = String(args.get("size") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_SIZE ?? "1024x1024");
const imageQuality = String(args.get("quality") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_QUALITY ?? "medium");
const timeoutMs = boundedNumber(args.get("timeout-ms") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_TIMEOUT_MS, 300_000, 30_000, 900_000);
const maxAttempts = boundedNumber(args.get("attempts") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_ATTEMPTS, 3, 1, 6);
const concurrency = boundedNumber(args.get("concurrency") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_CONCURRENCY, 1, 1, 3);
const limit = boundedNumber(args.get("limit") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_LIMIT, Number.POSITIVE_INFINITY, 1, Number.POSITIVE_INFINITY);
const providerLabel = String(args.get("provider-label") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_PROVIDER_LABEL ?? "").trim();
const selectedStores = csvSet(args.get("stores") ?? args.get("store") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_STORES);
const selectedSlugs = csvSet(args.get("slugs") ?? args.get("slug") ?? process.env.HOMEPAGE_SHOWCASE_IMAGE_SLUGS);
let prisma;

function csvSet(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function selectedShowcaseStores() {
  return showcaseStores.filter((store) =>
    !selectedStores.size ||
    selectedStores.has(store.key) ||
    selectedStores.has(store.siteSlug) ||
    selectedStores.has(store.siteId)
  );
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return v1Match?.[1] ?? `${trimmed}/v1`;
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
    body?.url ??
    body?.image_url;
}

async function imageBufferFromUrl(url) {
  if (url.startsWith("data:")) {
    const [, payload = ""] = url.split(",", 2);
    return Buffer.from(payload, url.includes(";base64,") ? "base64" : "utf8");
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`image_url_fetch_failed_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadProvider() {
  const preferEnv = flags.has("env-provider") || process.env.HOMEPAGE_SHOWCASE_IMAGE_USE_ENV_PROVIDER === "1";
  const envBaseUrl = normalizeBaseUrl(process.env.IMAGE_API_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "");
  const envApiKey = process.env.IMAGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (preferEnv && envBaseUrl && envApiKey) {
    return { label: "environment", baseUrl: envBaseUrl, apiKey: envApiKey, model };
  }

  prisma = new PrismaClient();
  const provider = await prisma.platformAiProvider.findFirst({
    where: providerLabel ? { modelType: model, label: providerLabel } : { modelType: model },
    orderBy: [{ preferred: "desc" }, { priority: "asc" }, { updatedAt: "desc" }]
  });
  if (!provider?.apiKey) throw new Error(`No configured platform AI provider found for ${model}`);
  return {
    label: provider.label,
    baseUrl: normalizeBaseUrl(provider.aiUrl),
    apiKey: provider.apiKey,
    model: provider.modelType
  };
}

function buildPrompt(store, theme, index, total) {
  const brand = store.key === "aidreamcapes" ? "Aidreamcapes" : "MyDreamShoots";
  const storeFocus = store.key === "aidreamcapes"
    ? "destination travel portrait subscription storefront"
    : "AI portrait and personal photo subscription storefront";
  return [
    "Use case: photorealistic-natural",
    `Asset type: square homepage carousel case image for a ${storeFocus}`,
    `Primary request: create one standalone AI-provider-generated customer result example for ${brand}, theme "${theme.name}".`,
    `Theme direction: ${theme.prompt}.`,
    `Variation role: image ${index + 1} of ${total} in this storefront carousel. Make this frame visibly different in subject identity, wardrobe, scene, lighting, camera distance, color palette, and composition from the other themes.`,
    "Composition: one finished square image, premium editorial photography feel, clear focal subject, natural face and hands, polished but believable private-gallery result, strong crop for a moving homepage rail.",
    "Important: this must be a single complete image, not a contact sheet, not a collage, not a before-and-after, not a UI mockup, and not a screenshot.",
    "Constraints: no text, no captions, no logos, no watermarks, no UI, no brand marks, no celebrity likeness, no copyrighted characters, no duplicated faces, no distorted anatomy, no extra fingers, no unreadable signage."
  ].join("\n");
}

async function generateImageBuffer(provider, prompt, task) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${provider.baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: provider.model,
          prompt,
          size: imageSize,
          quality: imageQuality,
          response_format: "b64_json"
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`${task.store.key}:${task.theme.slug}: provider_failed_${response.status}_${JSON.stringify(body).slice(0, 600)}`);
      }
      const b64 = imageBase64(body);
      if (b64) return Buffer.from(b64, "base64");
      const url = imageUrl(body);
      if (url) return await imageBufferFromUrl(String(url));
      throw new Error(`${task.store.key}:${task.theme.slug}: empty_image_payload`);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`${task.store.key}:${task.theme.slug}: attempt ${attempt} failed, retrying... ${message}`);
      await sleep(8_000 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${task.store.key}:${task.theme.slug}: provider_generation_failed`);
}

async function writeWebp(filePath, buffer) {
  const sharp = (await import("sharp")).default;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp(buffer)
    .resize(1024, 1024, { fit: "cover" })
    .sharpen({ sigma: 0.35 })
    .webp({ quality: 92, smartSubsample: true })
    .toFile(filePath);
}

async function runTask(task, provider, total) {
  const filePath = path.resolve(repoRoot, localShowcaseImagePath(task.store, task.theme.slug));
  const publicPath = publicShowcaseImagePath(task.store, task.theme.slug);
  if (!force && await fileExists(filePath)) {
    return { store: task.store.key, slug: task.theme.slug, ok: true, skipped: true, image: publicPath };
  }

  const prompt = buildPrompt(task.store, task.theme, task.index, total);
  if (savePrompts) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath.replace(/\.webp$/i, ".prompt.txt"), `${prompt}\n`);
  }
  if (dryRun) {
    return { store: task.store.key, slug: task.theme.slug, ok: true, skipped: true, reason: "dry_run", image: publicPath, prompt };
  }

  const buffer = await generateImageBuffer(provider, prompt, task);
  await writeWebp(filePath, buffer);
  const stat = await fs.stat(filePath);
  return {
    store: task.store.key,
    slug: task.theme.slug,
    ok: true,
    skipped: false,
    image: publicPath,
    bytes: stat.size
  };
}

async function mapLimit(items, workerCount, mapper) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, () => worker()));
  return results;
}

async function main() {
  const stores = selectedShowcaseStores();
  if (!stores.length) throw new Error("no_showcase_store_selected");

  const tasks = stores.flatMap((store) =>
    showcaseImageThemesForStore(store)
      .filter((theme) => !selectedSlugs.size || selectedSlugs.has(theme.slug.toLowerCase()))
      .map((theme, index, themes) => ({ store, theme, index, totalForStore: themes.length }))
  ).slice(0, limit);
  if (!tasks.length) throw new Error("no_showcase_image_theme_selected");

  const provider = dryRun ? { label: "dry-run", model, baseUrl: "", apiKey: "" } : await loadProvider();
  if (!dryRun) console.log(`using platform AI provider: ${provider.label} (${provider.model})`);

  const results = await mapLimit(tasks, concurrency, async (task) => {
    const result = await runTask(task, provider, task.totalForStore).catch((error) => ({
      store: task.store.key,
      slug: task.theme.slug,
      ok: false,
      skipped: false,
      error: error instanceof Error ? error.message.slice(0, 600) : String(error).slice(0, 600)
    }));
    console.log(JSON.stringify(result));
    return result;
  });
  const failed = results.filter((result) => !result.ok);
  console.log(JSON.stringify({
    ok: failed.length === 0,
    dryRun,
    force,
    stores: stores.map((store) => store.key),
    generated: results.filter((result) => result.ok && !result.skipped).length,
    skipped: results.filter((result) => result.skipped).length,
    failed: failed.length
  }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) await prisma.$disconnect();
  });
