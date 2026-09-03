#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { Agent } from "undici";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length) || "";
const providerLabel = process.argv.find((arg) => arg.startsWith("--provider="))?.slice("--provider=".length) || "image3";
const allowPaidCreate = process.argv.includes("--allow-paid-create");
const model = "gpt-image-2";
const width = 1600;
const height = 900;
const createSize = "1536x1024";
const requestSalt = "20260903-story-library-v2";
const auditRoot = path.join(repoRoot, "tmp", "paid-image-regeneration-20260903-story-library");
const dispatcher = new Agent({ headersTimeout: 360_000, bodyTimeout: 360_000 });

const tasks = [
  ["story-video-story-hero-library-restoration-v2", "Introduce an original story about adults restoring a neglected neighborhood library together. Wide 16:9 documentary establishing photograph of three adult volunteers entering a closed library carrying archive boxes and a rolled floor plan; shelves, ladders, dust sheets, books, hand tools, tall windows. People and place equally readable. Honest morning light, hopeful but unfinished. Original fictional adults only. No text, captions, logos, watermarks, readable signage, stage, podium, product, gifts, holiday decorations, coast, mountain, selfie, or influencer pose."],
  ["story-video-story-origin-closed-library-archive-v2", "Show why a library restoration had to begin before success was visible. Wide 16:9 documentary frame in a neglected archive room with a jammed wooden cabinet, dusty shelves, water-stained boxes, and one broken window. An adult archivist kneels and lifts a damaged community ledger while another volunteer shines a work light; problem and first clue visible. Cool window light and one work lamp. No readable text, no graduation, gifts, stage, product, phone selfie, detective costume, or noir styling."],
  ["story-video-story-journey-carrying-archive-boxes-v2", "Show an emotional journey through physical work moving a library archive to safety. Wide 16:9 side-on documentary frame in a bright library corridor with empty shelves and a ramp to a temporary archive room. One adult volunteer carries a heavy box while two others clear a path and hold a door; effort and direction obvious. Late-afternoon light. No coast, mountain, graduation, holiday gift, stage, studio portrait, product demo, or direct-to-camera pose."],
  ["story-video-story-comeback-repaired-library-window-v2", "Show a comeback through a visible repair that changes what can happen next. Wide 16:9 observational frame inside the library: an adult carpenter installs a new pane in a tall window while volunteers clean the frame; repaired glass reveals the neighborhood outside. Hands, pane, tools, and relieved people readable. Warm sunlight through the repaired window. No stage, audience, podium, performance, product packaging, gifts, holiday decorations, or influencer framing."],
  ["story-video-story-mini-documentary-bookbinder-v2", "Show a mini-documentary interview where a craftsperson explains a meaningful library restoration detail while someone records evidence. Wide 16:9 editorial photograph at a bookbinding workbench with thread, paper, clamps, repaired spines, and shelves. Adult bookbinder demonstrates a repair to an off-camera documentarian holding a small handheld camera; craft, hands, and interaction clear. Natural window light. No podcast microphone close-up, text, logos, product-ad styling, stage, graduation, holiday scene, or direct-to-camera influencer pose."],
  ["story-video-story-community-cataloging-books-v2", "Show people, action, and evidence at the center of a community story. Wide 16:9 documentary photograph in a restored library workroom where diverse adult neighbors sort, label, and shelve recovered books beside open archive boxes. Several people perform different useful actions at one table; books, blank catalog cards, and shared result visible. Bright daylight. No readable text, graduation caps, holiday decorations, gifts, product display, stage, phone selfie, or branded uniforms."],
  ["story-video-story-fictional-locked-archive-room-v2", "Show a fictional character facing a clear obstacle inside the library story. Wide 16:9 eye-level frame in an old archive room after closing with a locked metal cabinet, catalog cards, flashlight, and moonlight; no neon street. One original adult protagonist stands waist-up near center-right, full face, both eyes, shoulders, upper torso visible, holding a key that does not fit while an important box is behind the cabinet. Eyes around 45 percent image height, generous headroom. Restrained blue-gray moonlight and warm lamp. No text, logos, detective hat, cigar, trench-coat noir cliché, neon alley, face at bottom edge, stage, gift, product, or Cinematic Video reuse."],
  ["story-video-story-setup-floor-plan-archive-table-v2", "Depict story setup through a concrete plan before restoration begins. Horizontal 16:9 three-quarter top-down editorial frame of a library table with an unlabeled floor plan, archival gloves, measuring tape, pencil, keys, and arranged boxes; repaired room beyond. Two adult volunteers lean over and point to different work areas. Hands and objects legible, no portraits, no readable text. No family photos, stage, coast, gifts, graduation, phone, or product shot."],
  ["story-video-story-tension-missing-ledger-search-v2", "Depict tension as an active search for missing evidence. Wide 16:9 frame down a cramped archive aisle with open boxes, empty shelf spaces, blank inventory board, and one missing ledger slot. Two original adult volunteers search different shelves; one holds a flashlight and the other checks the empty slot. Cool practical lights, realistic worry. No talking-head portrait, detective costume, stage, holiday scene, gift, coast, phone selfie, product presentation, or readable text."],
  ["story-video-story-turning-point-key-cabinet-action-v2", "Depict the turning point as a decisive physical action. Horizontal 16:9 close-but-wide action frame in the library archive: adult volunteer's hands turn a brass key and finally open a cabinet; dust rises in a sunbeam and a recovered ledger box is revealed. Another volunteer waits behind and reacts. Key, lock, hands, and box readable; no face crop. No phone, product close-up, stage, gifts, coast, detective hat, cigar, or readable labels."],
  ["story-video-story-payoff-library-reopening-courtyard-v2", "Reveal a believable payoff after restoration is complete. Wide 16:9 documentary frame: neighborhood library doors open for the first time, repaired shelves visible inside, adults carry final boxes across a small brick courtyard, neighbors enter naturally. Candid ground-level movement, no ceremony, no stage, podium, ribbon cutting, crowd performance, text, gifts, balloons, graduation, corporate event, or product display. Golden daylight, earned warmth."],
  ["story-video-story-meaning-shared-memory-reading-table-v2", "Leave the viewer with what the restored place now means. Wide 16:9 intimate observational frame in a quiet library reading room after reopening: three adults of different ages read and listen together around a table with repaired books, mug, pencil, and an out-of-focus blank notice board. The shared place, not a single portrait, is the meaning. Calm evening light and warm lamp. No solo elderly headshot, holiday scene, stage, product, phone selfie, coast, sentimental advertising pose, or readable text."],
  ["story-video-story-closing-lights-library-evening-v2", "Show a quiet closing moment that belongs to the completed library story. Wide 16:9 cinematic-documentary exterior at blue hour: restored neighborhood library glowing warmly through windows, a few adults shelve the last books inside, bicycles and rain-dark pavement outside. Place and continuing human action carry the ending; people fully visible through windows, no single face dominates. No text, logos, stage, neon noir, holiday decorations, gifts, product display, coast, celebrity likeness, or direct-to-camera pose."]
].map(([key, prompt]) => ({ key, prompt: `Use case: photorealistic-natural\nAsset type: horizontal 16:9 storefront image for a Story Video detail page\n${prompt}` }));

if (!only) throw new Error("--only=<taskKey> is required; this script never creates a batch of paid images by default");
if (!tasks.some((task) => task.key === only)) throw new Error(`Unknown --only key: ${only}`);
const selected = only ? tasks.filter((task) => task.key === only) : tasks;

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return match?.[1] ?? `${trimmed}/v1`;
}
function redact(value) {
  return JSON.parse(JSON.stringify(value, (key, nested) => /(?:b64|base64)/i.test(key) && typeof nested === "string" ? `[omitted:${nested.length}]` : nested));
}
function payloadImage(body) {
  const b64 = body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64;
  return b64 ? Buffer.from(b64, "base64") : null;
}
function payloadUrl(body) {
  return body?.data?.[0]?.url ?? body?.data?.[0]?.image_url ?? body?.output?.[0]?.url ?? body?.output?.[0]?.image_url ?? "";
}
async function provider() {
  const prisma = new PrismaClient();
  try {
    const row = await prisma.platformAiProvider.findFirst({ where: { modelType: model, enabled: true, label: providerLabel }, orderBy: [{ preferred: "desc" }, { priority: "asc" }] });
    if (!row?.apiKey || !row.aiUrl) throw new Error(`No enabled ${providerLabel} provider for ${model}`);
    return { ...row, baseUrl: normalizeBaseUrl(row.aiUrl) };
  } finally { await prisma.$disconnect(); }
}
async function audit(file, value) { await fs.mkdir(auditRoot, { recursive: true }); await fs.writeFile(path.join(auditRoot, file), `${JSON.stringify(value, null, 2)}\n`); }
async function hasSuccessfulPriorRequest(task) {
  try {
    const record = JSON.parse(await fs.readFile(path.join(auditRoot, `${task.key}.json`), "utf8"));
    return record.status >= 200 && record.status < 300;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}
async function generate(row, task) {
  const idempotencyKey = `storefront:${task.key}:${requestSalt}`.slice(0, 180);
  if (await hasSuccessfulPriorRequest(task)) {
    throw new Error(`${task.key}:prior_success_cannot_be_replayed_safely; use a provider read-only result endpoint instead of POSTing this task again`);
  }
  if (!allowPaidCreate) throw new Error(`${task.key}:paid_create_requires_--allow-paid-create`);
  const response = await fetch(`${row.baseUrl}/images/generations`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${row.apiKey}`, "Idempotency-Key": idempotencyKey, "X-Client-Request-Id": idempotencyKey }, dispatcher, signal: AbortSignal.timeout(300_000), body: JSON.stringify({ model, prompt: task.prompt, size: createSize, quality: "high", response_format: "b64_json" }) });
  const rawBody = await response.text();
  let body = {};
  try { body = rawBody ? JSON.parse(rawBody) : {}; } catch { body = { parseError: true, rawPrefix: rawBody.slice(0, 500) }; }
  await audit(`${task.key}.json`, { createdAt: new Date().toISOString(), taskKey: task.key, provider: row.label, model, idempotencyKey, requestId: response.headers.get("x-request-id") || "", status: response.status, contentType: response.headers.get("content-type") || "", rawLength: rawBody.length, body: redact(body) });
  if (!response.ok) throw new Error(`${task.key}:provider_failed:${response.status}`);
  const image = payloadImage(body);
  if (image) return image;
  const url = payloadUrl(body);
  if (!url) throw new Error(`${task.key}:empty_image_payload`);
  const download = await fetch(url, { dispatcher, signal: AbortSignal.timeout(90_000) });
  if (!download.ok) throw new Error(`${task.key}:result_download_failed:${download.status}`);
  return Buffer.from(await download.arrayBuffer());
}
async function writeAsset(task, input) {
  const sourceRoot = path.join(repoRoot, "public/assets/dreamshoot/story-video");
  const cleanRoot = path.join(repoRoot, "public/assets/dreamshoot/generated/video-topic-clean/story-video");
  const pipeline = sharp(input).rotate().resize(width, height, { fit: "cover", position: "attention" }).sharpen({ sigma: 0.35 });
  await fs.mkdir(sourceRoot, { recursive: true }); await fs.mkdir(cleanRoot, { recursive: true });
  const encoded = await pipeline.clone().webp({ quality: 92, smartSubsample: true }).toBuffer();
  const png = await pipeline.clone().png({ compressionLevel: 9 }).toBuffer();
  await fs.writeFile(path.join(sourceRoot, `${task.key}.webp`), encoded);
  await fs.writeFile(path.join(sourceRoot, `${task.key}.png`), png);
  await fs.writeFile(path.join(cleanRoot, `${task.key}.webp`), encoded);
}

console.log(JSON.stringify({ model, provider: providerLabel, output: `${width}x${height}`, selected: selected.map((task) => task.key), maxPaidCreateAttempts: selected.length, retries: 0, allowPaidCreate }, null, 2));
const row = await provider();
for (const task of selected) { console.log(`generating ${task.key}`); await writeAsset(task, await generate(row, task)); }
