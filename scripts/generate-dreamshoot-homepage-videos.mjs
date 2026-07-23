#!/usr/bin/env node
import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import ffmpegPath from "ffmpeg-static";
import {
  localShowcaseImagePath,
  localShowcasePosterPath,
  localShowcaseVideoPath,
  showcaseStores,
  showcaseVideoPosterSlug
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
const allowDuplicate = flags.has("allow-duplicate");
const skipNormalize = flags.has("skip-normalize");
const timeoutMs = boundedNumber(args.get("timeout-ms"), 20 * 60 * 1000, 60_000, 60 * 60 * 1000);
const pollMs = boundedNumber(args.get("poll-ms"), 8_000, 2_000, 60_000);
const createTimeoutMs = boundedNumber(args.get("create-timeout-ms"), 120_000, 15_000, 300_000);
const downloadTimeoutMs = boundedNumber(args.get("download-timeout-ms"), 180_000, 30_000, 600_000);
const limit = boundedNumber(args.get("limit"), Number.POSITIVE_INFINITY, 1, Number.POSITIVE_INFINITY);
const selectedStores = csvSet(args.get("stores") ?? args.get("store"));
const selectedSlugs = csvSet(args.get("slugs") ?? args.get("slug"));
const providerId = String(args.get("provider-id") ?? "").trim();
let providerProxyDispatcher;
let providerProxyAvailability;

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
  return String(value || "").trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

function providerProxyUrl() {
  return (
    process.env.AI_WORKER_HTTP_PROXY ||
    process.env.AI_WORKER_HTTPS_PROXY ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy ||
    ""
  ).trim();
}

function shouldProxyFetch(resource, proxyUrl = providerProxyUrl()) {
  if (!proxyUrl) return false;
  try {
    const url = new URL(resource);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

async function getProviderProxyDispatcher() {
  const proxyUrl = providerProxyUrl();
  if (!proxyUrl) return undefined;
  if (providerProxyDispatcher?.proxyUrl === proxyUrl) return providerProxyDispatcher.dispatcher;
  const { ProxyAgent } = await import("undici");
  const dispatcher = new ProxyAgent(proxyUrl);
  providerProxyDispatcher = { proxyUrl, dispatcher };
  return dispatcher;
}

function loopbackProxyHost(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");
    if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) return undefined;
    const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
    return Number.isFinite(port) && port > 0 ? { hostname, port } : undefined;
  } catch {
    return undefined;
  }
}

function isLoopbackProxyUrl(value) {
  return Boolean(loopbackProxyHost(value));
}

async function isConfiguredLoopbackProxyReachable(proxyUrl) {
  const target = loopbackProxyHost(proxyUrl);
  if (!target) return true;
  const now = Date.now();
  const cacheMs = Math.max(1_000, Math.min(Number(process.env.AI_WORKER_PROXY_PROBE_CACHE_MS ?? "10000") || 10_000, 60_000));
  if (providerProxyAvailability?.proxyUrl === proxyUrl && now - providerProxyAvailability.checkedAt < cacheMs) {
    return providerProxyAvailability.reachable;
  }
  const timeoutMs = Math.max(50, Math.min(Number(process.env.AI_WORKER_PROXY_PROBE_TIMEOUT_MS ?? "250") || 250, 2_000));
  const { connect } = await import("node:net");
  const reachable = await new Promise((resolve) => {
    const socket = connect({ host: target.hostname, port: target.port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
  providerProxyAvailability = { proxyUrl, checkedAt: now, reachable };
  return reachable;
}

function shouldRetryProviderFetchWithoutProxy(error, proxyUrl) {
  if (process.env.AI_WORKER_DISABLE_PROXY_FALLBACK === "1" || !isLoopbackProxyUrl(proxyUrl)) return false;
  let proxy;
  try {
    proxy = new URL(proxyUrl);
  } catch {
    return false;
  }
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  const proxyHost = proxy.hostname.toLowerCase();
  const proxyPort = proxy.port;
  const pointsAtProxy = message.includes(proxyHost) || Boolean(proxyPort && message.includes(proxyPort));
  const connectionInterrupted = message.includes("econnrefused") ||
    message.includes("econnreset") ||
    message.includes("fetch failed") ||
    message.includes("socket") ||
    message.includes("terminated") ||
    message.includes("socket hang up") ||
    message.includes("read reset") ||
    message.includes("connection reset");
  return connectionInterrupted && (pointsAtProxy || isLoopbackProxyUrl(proxyUrl));
}

function videoProviderProtocol(baseUrl) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (hostname.includes("smartpicklid") || hostname.includes("magic666")) return "openai-videos";
  } catch {
    return "lk888-media";
  }
  return "lk888-media";
}

function isGrokImagineVideoModel(model) {
  return String(model || "").trim().toLowerCase().includes("grok-imagine-video");
}

function isImageToVideoModel(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized.includes("grok-imagine-video") || normalized.includes("image-to-video") || normalized.includes("i2v");
}

function isSmartPickLidBaseUrl(baseUrl) {
  try {
    return new URL(baseUrl).hostname.toLowerCase().includes("smartpicklid");
  } catch {
    return false;
  }
}

function videoProviderModelCandidates(provider, protocol) {
  const model = String(provider.modelType || "").trim();
  const shouldPreferSmartPickLidJsonModel = protocol === "openai-videos" && isSmartPickLidBaseUrl(provider.aiUrl);
  return Array.from(new Set([
    ...(shouldPreferSmartPickLidJsonModel ? ["grok-imagine-video"] : []),
    ...(isImageToVideoModel(model) ? [model] : []),
    "grok-imagine-video-1.5-preview",
    "grok-imagine-video"
  ].filter(Boolean)));
}

function shouldTryNextVideoModel(error) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return message.includes("model_not_found") ||
    message.includes("duplicate_video_hash") ||
    message.includes("no available channel for model") ||
    message.includes("no access to model") ||
    message.includes("first_frame_required") ||
    message.includes("reference image required") ||
    message.includes("images required") ||
    message.includes("input_reference") ||
    message.includes("create_failed_502") ||
    message.includes("create_failed_503") ||
    message.includes("create_failed_504") ||
    message.includes("create_failed_524");
}

function mimeTypeForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".webp") return "image/webp";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  return "image/png";
}

async function imageDataUri(filePath) {
  const bytes = await fs.readFile(filePath);
  if (!bytes.length) throw new Error(`empty_reference_image_${filePath}`);
  return `data:${mimeTypeForFile(filePath)};base64,${bytes.toString("base64")}`;
}

function buildVideoPrompt(store, theme) {
  const posterSlug = showcaseVideoPosterSlug(store, theme);
  const isolation = store.key === "aidreamcapes"
    ? [
        "Storefront identity: Aidreamcapes travel and destination-memory examples only.",
        "Do not resemble MyDreamShoots portrait, creator, product, office, beauty, wedding-card, market, home-office, pet, or generic social-profile examples unless that detail is literally visible in the reference frame.",
        "Keep every cue grounded in travel: route, coastline, old city, resort, mountain trail, scenic overlook, or heritage destination mood."
      ]
    : [
        "Storefront identity: MyDreamShoots personal photo, portrait, creator, profile, celebration, and private-gallery examples only.",
        "Do not resemble Aidreamcapes route, destination, coastal resort, old-quarter walk, mountain trail, or travel-atlas examples unless that detail is literally visible in the reference frame.",
        "Keep every cue grounded in the selected personal photo theme rather than travel branding."
      ];
  return [
    "Create one real moving image-to-video MP4 for a storefront customer-created example carousel.",
    `Unique asset key: ${store.key}:${theme.slug}. Do not reuse or closely imitate any other storefront showcase result.`,
    `Source showcase image theme: ${posterSlug}. The final video must visibly preserve this exact source image subject, setting, wardrobe, lighting, and composition category.`,
    "Output geometry: square 1:1 video composition, centered subject, no stretched people, no squeezed scenery, no tall 9:16 mobile crop, no black side bars.",
    ...isolation,
    "Use the supplied image as the first-frame visual reference and preserve the visible subject, composition, lighting direction, wardrobe cues, and scene facts.",
    "Add natural continuous motion, subtle camera movement, environment movement, and realistic depth. The result must not be a static single-frame clip or slideshow.",
    theme.prompt,
    store.key === "aidreamcapes"
      ? "Keep the mood polished, private-gallery ready, and travel-oriented when the frame supports it."
      : "Keep the mood polished, personal-gallery ready, and theme-oriented when the frame supports it.",
    "Clean output: no subtitles, UI, logos, watermarks, captions, split screens, collage panels, or readable text overlays."
  ].filter(Boolean).join("\n\n").slice(0, 3600);
}

function openAiPayloadVariants(model, prompt, dataUri, durationSeconds) {
  const seconds = String(Math.max(3, Math.min(12, Number(durationSeconds) || 6)));
  return [
    {
      model,
      prompt,
      seconds,
      aspect_ratio: "1:1",
      resolution: "720P",
      image: dataUri
    },
    {
      model,
      prompt,
      seconds,
      size: "720p",
      image: dataUri
    }
  ];
}

function lk888Payload(model, prompt, dataUri, durationSeconds) {
  const seconds = String(Math.max(3, Math.min(12, Number(durationSeconds) || 6)));
  return {
    model,
    prompt,
    params: {
      aspect_ratio: "1:1",
      resolution: "720p",
      duration: seconds,
      images: dataUri
    }
  };
}

function extractTaskId(body) {
  const taskId = body?.data?.task_id ?? body?.task_id ?? body?.id;
  return typeof taskId === "number" || typeof taskId === "string" ? String(taskId) : "";
}

function extractStatus(body) {
  const data = body?.data && typeof body.data === "object" ? body.data : {};
  return String(body?.status ?? data.status ?? body?.state ?? data.state ?? "").trim().toLowerCase();
}

function extractResultUrl(body) {
  const data = body?.data && typeof body.data === "object" ? body.data : {};
  return String(body?.result_url ?? data.result_url ?? data.url ?? body?.url ?? "").trim();
}

function sanitizeProviderBody(body) {
  return JSON.stringify(body ?? {}).slice(0, 320);
}

async function fetchWithTimeout(url, init, timeout, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const proxyUrl = providerProxyUrl();
  const runFetch = async (dispatcher) => fetch(url, {
    ...init,
    ...(dispatcher ? { dispatcher } : {}),
    signal: controller.signal,
    cache: "no-store"
  });
  try {
    const dispatcher = shouldProxyFetch(url, proxyUrl) && await isConfiguredLoopbackProxyReachable(proxyUrl)
      ? await getProviderProxyDispatcher()
      : undefined;
    try {
      return await runFetch(dispatcher);
    } catch (error) {
      if (dispatcher && shouldRetryProviderFetchWithoutProxy(error, proxyUrl)) {
        return await runFetch();
      }
      throw error;
    }
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`${label}_${timeout}`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url, apiKey, payload, timeout, label) {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  }, timeout, label);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${label}_failed_${response.status}_${sanitizeProviderBody(body)}`);
  return body;
}

async function createVideoTask(provider, model, protocol, prompt, dataUri, durationSeconds) {
  const baseUrl = normalizeBaseUrl(provider.aiUrl);
  const mediaBaseUrl = protocol === "lk888-media" ? baseUrl.replace(/\/api$/, "") : baseUrl;
  const endpoint = protocol === "openai-videos" ? `${baseUrl}/v1/videos` : `${mediaBaseUrl}/v1/media/generate`;
  if (protocol === "openai-videos") {
    let lastError;
    for (const payload of openAiPayloadVariants(model, prompt, dataUri, durationSeconds)) {
      try {
        const body = await postJson(endpoint, provider.apiKey, payload, createTimeoutMs, "video_create");
        const taskId = extractTaskId(body);
        if (taskId) return taskId;
        lastError = new Error(`video_create_missing_task_${sanitizeProviderBody(body)}`);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("video_create_failed");
  }

  const body = await postJson(endpoint, provider.apiKey, lk888Payload(model, prompt, dataUri, durationSeconds), createTimeoutMs, "video_create");
  const taskId = extractTaskId(body);
  if (!taskId) throw new Error(`video_create_missing_task_${sanitizeProviderBody(body)}`);
  return taskId;
}

async function pollVideoTask(provider, protocol, taskId) {
  const startedAt = Date.now();
  let lastStatus = "";
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    const baseUrl = normalizeBaseUrl(provider.aiUrl);
    const mediaBaseUrl = protocol === "lk888-media" ? baseUrl.replace(/\/api$/, "") : baseUrl;
    const urls = protocol === "openai-videos"
      ? [`${baseUrl}/v1/videos/${encodeURIComponent(taskId)}`]
      : [
          `${mediaBaseUrl}/v1/skills/task-status?task_id=${encodeURIComponent(taskId)}`,
          `${mediaBaseUrl}/v1/media/status?task_id=${encodeURIComponent(taskId)}`
        ];
    let response;
    let body = {};
    for (const [index, url] of urls.entries()) {
      response = await fetchWithTimeout(url, {
        headers: { Authorization: `Bearer ${provider.apiKey}` }
      }, Math.min(60_000, timeoutMs), "video_status");
      body = await response.json().catch(() => ({}));
      if (response.ok || protocol === "openai-videos" || index === urls.length - 1 || (response.status !== 404 && response.status !== 405)) break;
    }
    if (!response.ok) throw new Error(`video_status_failed_${response.status}_${sanitizeProviderBody(body)}`);

    const status = extractStatus(body);
    lastStatus = [status, body?.progress, body?.status_group].filter(Boolean).join("_");
    if (protocol === "openai-videos") {
      if (status === "completed" || status === "succeeded") return body;
      if (status === "failed" || status === "cancelled" || status === "canceled") {
        throw new Error(`video_provider_failed_${sanitizeProviderBody(body)}`);
      }
      continue;
    }

    if (body?.is_final === true) {
      if (status === "success" && extractResultUrl(body)) return body;
      throw new Error(`video_provider_failed_${sanitizeProviderBody(body)}`);
    }
  }
  throw new Error(`video_provider_timeout_${timeoutMs}_${lastStatus || "no_status"}`);
}

async function downloadVideo(provider, protocol, taskId, statusBody) {
  const baseUrl = normalizeBaseUrl(provider.aiUrl);
  const resultUrl = protocol === "openai-videos"
    ? `${baseUrl}/v1/videos/${encodeURIComponent(taskId)}/content`
    : extractResultUrl(statusBody);
  if (!resultUrl) throw new Error("video_download_empty_result_url");
  const response = await fetchWithTimeout(resultUrl, {
    headers: protocol === "openai-videos" ? { Authorization: `Bearer ${provider.apiKey}` } : undefined
  }, downloadTimeoutMs, "video_download");
  if (!response.ok) throw new Error(`video_download_failed_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1024) throw new Error(`video_download_too_small_${bytes.length}`);
  return bytes;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function runFfmpeg(argsForFfmpeg, label) {
  if (!ffmpegPath) throw new Error("ffmpeg_static_not_available");
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, argsForFfmpeg, { stdio: ["ignore", "ignore", "pipe"] });
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      errorText += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label}_${errorText.slice(-1200) || `ffmpeg exited ${code}`}`));
      }
    });
  });
}

async function normalizeShowcaseVideoBytes(bytes, task) {
  if (skipNormalize) return { bytes, normalized: false };
  const safeName = `${task.store.key}-${task.theme.slug}-${crypto.randomUUID()}`;
  const workDir = path.join(repoRoot, ".tmp", "dreamshoot-showcase-video-normalize");
  const inputFile = path.join(workDir, `${safeName}.input.mp4`);
  const outputFile = path.join(workDir, `${safeName}.square.mp4`);
  await fs.mkdir(workDir, { recursive: true });
  await fs.writeFile(inputFile, bytes);
  try {
    await runFfmpeg([
      "-y",
      "-i",
      inputFile,
      "-vf",
      "scale=720:720:force_original_aspect_ratio=increase,crop=720:720,setsar=1,format=yuv420p",
      "-r",
      "25",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-movflags",
      "+faststart",
      outputFile
    ], "video_normalize_failed");
    const normalized = await fs.readFile(outputFile);
    if (normalized.length < 1024) throw new Error(`video_normalize_too_small_${normalized.length}`);
    return { bytes: normalized, normalized: true };
  } finally {
    await fs.rm(inputFile, { force: true }).catch(() => {});
    await fs.rm(outputFile, { force: true }).catch(() => {});
  }
}

function videoHash(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function knownVideoDirectories() {
  return showcaseStores.map((store) => ({
    store,
    dir: path.resolve(repoRoot, store.assetRoot, "videos")
  }));
}

async function duplicateVideoForBytes(bytes, currentFile) {
  const hash = videoHash(bytes);
  for (const { store, dir } of knownVideoDirectories()) {
    let names = [];
    try {
      names = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/\.mp4$/i.test(name)) continue;
      const filePath = path.join(dir, name);
      if (path.resolve(filePath) === path.resolve(currentFile)) continue;
      const existing = await fs.readFile(filePath).catch(() => undefined);
      if (!existing?.length) continue;
      if (videoHash(existing) === hash) {
        return {
          hash,
          store: store.key,
          slug: name.replace(/\.mp4$/i, "")
        };
      }
    }
  }
  return { hash };
}

async function writeVideoFile(filePath, bytes) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.part`;
  await fs.writeFile(tempPath, bytes);
  await fs.rename(tempPath, filePath);
}

async function refreshPosterFromShowcaseImage(task, posterFile) {
  const posterSlug = showcaseVideoPosterSlug(task.store, task.theme, task.index);
  const imageFile = path.resolve(repoRoot, localShowcaseImagePath(task.store, posterSlug));
  if (!(await fileExists(imageFile))) return { ok: false, posterSlug, imageFile };
  if (force || !(await fileExists(posterFile))) {
    await fs.mkdir(path.dirname(posterFile), { recursive: true });
    await fs.copyFile(imageFile, posterFile);
  }
  return { ok: true, posterSlug, imageFile };
}

async function readVideoProviders(prisma) {
  const providers = await prisma.platformAiProvider.findMany({
    where: providerId
      ? { id: providerId, enabled: true }
      : {
          enabled: true,
          OR: [
            { modelType: { contains: "video" } },
            { modelType: { contains: "i2v" } },
            { label: { contains: "Video" } }
          ]
        },
    orderBy: [
      { preferred: "desc" },
      { priority: "asc" },
      { updatedAt: "desc" }
    ]
  });
  return providers.filter((provider) =>
    provider.apiKey?.trim() &&
    normalizeBaseUrl(provider.aiUrl) &&
    (isGrokImagineVideoModel(provider.modelType) || isImageToVideoModel(provider.modelType) || /video/i.test(provider.label))
  );
}

async function generateTask(task, providers) {
  const posterFile = path.resolve(repoRoot, localShowcasePosterPath(task.store, task.theme.slug));
  const videoFile = path.resolve(repoRoot, localShowcaseVideoPath(task.store, task.theme.slug));
  const poster = await refreshPosterFromShowcaseImage(task, posterFile);
  if (!poster.ok) {
    return { ...task.summary, ok: false, skipped: true, reason: "poster_source_missing", posterSlug: poster.posterSlug };
  }
  if (!(await fileExists(posterFile))) {
    return { ...task.summary, ok: false, skipped: true, reason: "poster_missing" };
  }
  if (!force && await fileExists(videoFile)) {
    return { ...task.summary, ok: true, skipped: true, reason: "video_exists" };
  }
  if (dryRun) {
    return { ...task.summary, ok: true, skipped: true, reason: "dry_run" };
  }

  const dataUri = await imageDataUri(posterFile);
  const prompt = buildVideoPrompt(task.store, task.theme);
  const providerErrors = [];

  for (const provider of providers) {
    const protocol = videoProviderProtocol(normalizeBaseUrl(provider.aiUrl));
    let createError;
    for (const model of videoProviderModelCandidates(provider, protocol)) {
      try {
        const taskId = await createVideoTask(provider, model, protocol, prompt, dataUri, task.theme.durationSeconds);
        const statusBody = await pollVideoTask(provider, protocol, taskId);
        const downloadedBytes = await downloadVideo(provider, protocol, taskId, statusBody);
        const normalizedVideo = await normalizeShowcaseVideoBytes(downloadedBytes, task);
        const bytes = normalizedVideo.bytes;
        const duplicate = await duplicateVideoForBytes(bytes, videoFile);
        if (duplicate.store && !allowDuplicate) {
          throw new Error(`duplicate_video_hash_${duplicate.hash}_matches_${duplicate.store}:${duplicate.slug}`);
        }
        await writeVideoFile(videoFile, bytes);
        return {
          ...task.summary,
          ok: true,
          skipped: false,
          provider: provider.label,
          model,
          protocol,
          taskId,
          posterSlug: poster.posterSlug,
          hash: duplicate.hash,
          normalized: normalizedVideo.normalized,
          bytes: bytes.length
        };
      } catch (error) {
        createError = error;
        providerErrors.push({
          provider: provider.label,
          model,
          error: error instanceof Error ? error.message.slice(0, 320) : String(error).slice(0, 320)
        });
        if (!shouldTryNextVideoModel(error)) break;
      }
    }
    if (createError && !shouldTryNextVideoModel(createError)) continue;
  }

  return {
    ...task.summary,
    ok: false,
    skipped: false,
    reason: "all_video_providers_failed",
    providerErrors
  };
}

async function main() {
  const stores = selectedShowcaseStores();
  if (!stores.length) throw new Error("no_showcase_store_selected");

  const tasks = stores.flatMap((store) =>
    store.videoThemes
      .filter((theme) => !selectedSlugs.size || selectedSlugs.has(theme.slug.toLowerCase()))
      .map((theme, index) => ({
        store,
        theme,
        index,
        summary: { store: store.key, slug: theme.slug }
      }))
  ).slice(0, limit);
  if (!tasks.length) throw new Error("no_showcase_video_theme_selected");

  const prisma = new PrismaClient();
  try {
    const providers = await readVideoProviders(prisma);
    if (!providers.length) throw new Error("no_internal_video_provider_available");

    const results = [];
    for (const task of tasks) {
      const result = await generateTask(task, providers);
      results.push(result);
      console.log(JSON.stringify(result));
    }

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
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
