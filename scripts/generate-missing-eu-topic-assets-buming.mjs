#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const PROVIDER_LABEL = "buming-image";
const MODEL = "gpt-image-2";
const REQUEST_SIZE = "1536x1024";
const QUALITY = "high";
const DISPLAY_WIDTH = 3840;
const PRICE_PER_REQUEST_USD = 0.0075;
const MAX_PAID_CREATE_ATTEMPTS = 11;
const APPLY = process.argv.includes("--apply");
const RAW_ONLY = process.argv.includes("--raw-only");
const RAW_DIR = "/tmp/codex-buming-eu-raw-20260926";
const REPORT_PATH = "/tmp/codex-buming-eu-topic-assets-20260926.json";

const TASKS = [
  {
    siteId: "site_aidreamcapes_xby",
    domain: "aidreamcapes.eu",
    pageSlug: "/ai-video-generation/proposal",
    oldUrl: "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/proposal/hero-ai-proposal-beach-sunset.jpg",
    newUrl: "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/proposal/hero-ai-proposal-beach-sunset.jpg",
    prompt: "Create a polished cinematic editorial photograph for the French AI video theme page 'Proposition'. Show an adult couple at a quiet beach during a warm golden-hour sunset, with one adult revealing a proposal ring and the other reacting with genuine emotion. Capture a graceful, intimate moment suitable for turning into a short proposal video, with gentle ocean light, natural body language, elegant composition, and clear visual focus on the couple. Wide landscape frame with room for a web crop. No readable text, signage, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs. Family-safe and wedding-appropriate."
  },
  {
    siteId: "site_aidreamcapes_xby",
    domain: "aidreamcapes.eu",
    pageSlug: "/ai-video-generation/engagement",
    oldUrl: "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/engagement/hero-ai-engagement-couple-sunset.jpg",
    newUrl: "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/engagement/hero-ai-engagement-couple-sunset.jpg",
    prompt: "Create a polished editorial photograph for the French AI video theme page 'Fiançailles'. Show an adult engaged couple in a tender engagement announcement portrait at sunset, with a subtle ring reveal, relaxed smiles, warm evening light, and an intimate personal atmosphere. The scene should feel ready for a short coherent engagement announcement video, with natural expressions, believable proportions, tactile clothing and background detail, and a balanced wide landscape composition with room for a web crop. No readable text, signage, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs. Family-safe and wedding-appropriate."
  },
  {
    siteId: "site_aidreamcapes_xby",
    domain: "aidreamcapes.eu",
    pageSlug: "/ai-video-generation/motion-generator",
    oldUrl: "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-02.webp",
    newUrl: "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/motion-generator/ai-video-add-ons-02-product-motion.jpg",
    prompt: "Create a polished studio editorial photograph for the French AI Motion Generator theme page. Show a single elegant consumer product on a clean studio table, prepared for a controlled product-reveal motion clip: directional light, subtle reflections, a clear hero angle, and a small sense of camera movement through layered foreground and background. No brand identity or readable packaging text. Make the product scene tactile, premium, realistic, and visually distinct from a static catalog shot. Wide landscape composition with room for a web crop. No logos, watermarks, UI, border, collage, duplicated products, distorted geometry, or readable text."
  },
  {
    siteId: "site_aidreamcapes_xby",
    domain: "aidreamcapes.eu",
    pageSlug: "/ai-video-generation/motion-generator",
    oldUrl: "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-03.webp",
    newUrl: "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/motion-generator/ai-video-add-ons-03-atmosphere-motion.jpg",
    prompt: "Create a polished atmospheric editorial photograph for the French AI Motion Generator theme page. Show a cinematic outdoor portrait scene prepared for controlled movement: an adult subject in a quiet twilight landscape, fabric and hair gently moved by a breeze, soft practical lights, layered depth, and a calm expressive pose. The image should make subject motion, environmental motion, and camera movement easy to imagine while remaining coherent and natural. Wide landscape composition with room for a web crop. No readable text, signage, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs. Family-safe."
  },
  {
    siteId: "site_aidreamcapes_xby",
    domain: "aidreamcapes.eu",
    pageSlug: "/ai-video-generation/wedding-ceremony",
    oldUrl: "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/seasonal/wedding-ceremony/hero-ai-wedding-ceremony-first-kiss.jpg",
    newUrl: "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/provider-buming-20260926/wedding-ceremony/hero-ai-wedding-ceremony-first-kiss.jpg",
    prompt: "Create a warm, graceful wedding-ceremony editorial photograph for the French AI video theme page 'Cérémonie de mariage'. Show two adult newlyweds sharing a gentle first kiss after the ceremony, framed by a softly lit aisle and elegant floral details, with guests naturally out of focus in the background. The image should feel like a memorable final frame for a short wedding ceremony video: authentic emotion, refined composition, warm light, and believable anatomy. Wide landscape frame with room for a web crop. No readable text, signage, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs. Family-safe and wedding-appropriate."
  },
  {
    siteId: "site_mydreamshoots_xby",
    domain: "aidreamshoots.eu",
    pageSlug: "/ai-video-generation/talking-photo",
    oldUrl: "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-birthday-greeting-woman-cake.webp",
    newUrl: "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-birthday-greeting-woman-cake.jpg",
    prompt: "Create a polished Spanish AI talking-photo landing-page editorial photograph. Show an adult woman smiling naturally toward the camera while holding a small birthday cake with candles in a warmly lit home celebration. Compose it as a clear portrait source that could become a talking-photo greeting video: face visible, shoulders and hands natural, believable skin and hair, warm family-safe atmosphere, wide landscape frame with room for a web crop. No readable text, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs."
  },
  {
    siteId: "site_mydreamshoots_xby",
    domain: "aidreamshoots.eu",
    pageSlug: "/ai-video-generation/talking-photo",
    oldUrl: "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-personal-message-older-man.webp",
    newUrl: "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-personal-message-older-man.jpg",
    prompt: "Create a polished Spanish AI talking-photo landing-page editorial photograph. Show an older adult man looking directly and kindly toward the camera as if delivering a personal message, seated in a softly lit home or study with subtle warm background detail. Make his face unobstructed and expressive, with natural posture and believable proportions, suitable as a source image for a talking-photo video. Wide landscape frame with room for a web crop. No readable text, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs."
  },
  {
    siteId: "site_mydreamshoots_xby",
    domain: "aidreamshoots.eu",
    pageSlug: "/ai-video-generation/talking-photo",
    oldUrl: "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-education-explainer-teacher.webp",
    newUrl: "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-education-explainer-teacher.jpg",
    prompt: "Create a polished Spanish AI talking-photo landing-page editorial photograph. Show an adult teacher presenting clearly toward the camera in a bright classroom, with a simple blank whiteboard and a few non-readable visual marks in the background. The teacher's face, shoulders, and hands should be visible and natural, making the image suitable for an educational talking-photo explainer video. Wide landscape composition with room for a web crop. No readable text, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs."
  },
  {
    siteId: "site_mydreamshoots_xby",
    domain: "aidreamshoots.eu",
    pageSlug: "/ai-video-generation/talking-photo",
    oldUrl: "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-social-video-creator.webp",
    newUrl: "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-social-video-creator.jpg",
    prompt: "Create a polished Spanish AI talking-photo landing-page editorial photograph. Show an adult content creator speaking naturally toward a camera in a modern small studio, with soft key light, a microphone and tasteful background color, but no brand marks. Face and upper body clearly visible, expressive and believable, designed as a source frame for a social-video talking-photo clip. Wide landscape composition with room for a web crop. No readable text, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs."
  },
  {
    siteId: "site_mydreamshoots_xby",
    domain: "aidreamshoots.eu",
    pageSlug: "/ai-video-generation/talking-photo",
    oldUrl: "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-product-intro-spokesperson.webp",
    newUrl: "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-product-intro-spokesperson.jpg",
    prompt: "Create a polished Spanish AI talking-photo landing-page editorial photograph. Show an adult spokesperson presenting a simple unbranded skincare bottle toward the camera in a clean bright studio, with face, hands, and product clearly visible and naturally proportioned. The image should support a product-introduction talking-photo video while keeping all packaging blank and non-readable. Wide landscape composition with room for a web crop. No readable text, logos, watermarks, UI, border, collage, duplicated products, distorted anatomy, extra fingers, or extra limbs."
  },
  {
    siteId: "site_mydreamshoots_xby",
    domain: "aidreamshoots.eu",
    pageSlug: "/ai-video-generation/talking-photo",
    oldUrl: "/assets/sites/site_aidreamshoots/visuals/talking-photo/talking-photo-holiday-greeting-woman-gift.webp",
    newUrl: "/assets/sites/site_aidreamshoots/restored/originals/aidreamshoots-eu-no-crop-v1/provider-buming-20260926/talking-photo/talking-photo-holiday-greeting-woman-gift.jpg",
    prompt: "Create a polished Spanish AI talking-photo landing-page editorial photograph. Show an adult woman smiling and looking toward the camera while holding a wrapped holiday gift in a warmly decorated living room, with tasteful seasonal lights and no readable decorations. Her face and hands should be clear and natural, suitable as a source image for a holiday greeting talking-photo video. Wide landscape composition with room for a web crop. No readable text, logos, watermarks, UI, border, collage, duplicated people, distorted anatomy, extra fingers, or extra limbs. Family-safe."
  }
];

const START_INDEX = Math.max(0, Number(process.env.BUMING_START_INDEX ?? 0));
const END_INDEX = Math.min(TASKS.length, Math.max(START_INDEX, Number(process.env.BUMING_END_INDEX ?? TASKS.length)));
const RUN_TASKS = TASKS.slice(START_INDEX, END_INDEX);
const RUN_MAX_PAID_CREATE_ATTEMPTS = RUN_TASKS.length;
const RUN_REPORT_PATH = REPORT_PATH.replace(/\.json$/, `-${START_INDEX + 1}-${END_INDEX}.json`);

if (TASKS.length !== MAX_PAID_CREATE_ATTEMPTS) throw new Error("unexpected_task_count:" + TASKS.length);
if (!APPLY) throw new Error("paid_generation_requires_--apply");

function providerBaseUrl(value) {
  const base = String(value ?? "").trim().replace(/\/+$/, "");
  return base.endsWith("/v1") ? base : base + "/v1";
}

function imageBase64(body) {
  return body?.data?.[0]?.b64_json
    ?? body?.data?.[0]?.image_base64
    ?? body?.output?.[0]?.b64_json
    ?? body?.output?.[0]?.image_base64
    ?? body?.image_base64;
}

function imageUrl(body) {
  return body?.data?.[0]?.url
    ?? body?.data?.[0]?.image_url
    ?? body?.output?.[0]?.url
    ?? body?.output?.[0]?.image_url
    ?? body?.output?.image_url
    ?? body?.url
    ?? body?.image_url;
}

async function responseImageBuffer(body) {
  const base64 = imageBase64(body);
  if (base64) return Buffer.from(base64, "base64");
  const url = imageUrl(body);
  if (!url) throw new Error("provider_response_missing_image");
  const response = await fetch(String(url), { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error("provider_image_download_failed:" + response.status);
  return Buffer.from(await response.arrayBuffer());
}

async function requestProviderJson({ endpoint, apiKey, requestId, payload, attempt }) {
  const stem = "/tmp/codex-buming-eu-request-20260926-" + attempt;
  const bodyPath = stem + ".json";
  const responsePath = stem + ".response.json";
  const headerPath = stem + ".headers.txt";
  const configPath = stem + ".curlrc";
  await fs.writeFile(bodyPath, JSON.stringify(payload));
  await fs.writeFile(configPath, [
    "url = \"" + endpoint + "\"",
    "request = POST",
    "header = \"Content-Type: application/json\"",
    "header = \"Authorization: Bearer " + apiKey + "\"",
    "header = \"Idempotency-Key: " + requestId + "\"",
    "header = \"X-Client-Request-Id: " + requestId + "\"",
    "data-binary = @" + bodyPath,
    "output = " + responsePath,
    "dump-header = " + headerPath,
    "max-time = 180",
    "silent",
    "show-error"
  ].join("\n") + "\n");
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn("curl", ["--config", configPath, "--write-out", "%{http_code}"], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
      child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
      child.on("error", reject);
      child.on("close", (code, signal) => resolve({ code, signal, stdout, stderr }));
    });
    const statusText = result.stdout.trim();
    const status = /^\d{3}$/.test(statusText.slice(-3)) ? Number(statusText.slice(-3)) : 0;
    const raw = await fs.readFile(responsePath, "utf8").catch(() => "");
    const body = raw ? JSON.parse(raw) : {};
    const headerText = await fs.readFile(headerPath, "utf8").catch(() => "");
    const requestHeader = headerText.match(/^x-request-id:\s*(.+)$/im)?.[1]?.trim() ?? headerText.match(/^request-id:\s*(.+)$/im)?.[1]?.trim() ?? "";
    if (result.code !== 0 && !status) throw new Error("provider_curl_failed:code=" + result.code + ":signal=" + (result.signal ?? "") + ":" + result.stderr.trim().slice(0, 240));
    return { status, body, providerRequestId: requestHeader };
  } finally {
    await Promise.all([bodyPath, responsePath, headerPath, configPath].map((file) => fs.rm(file, { force: true })));
  }
}

function clone(value) { return structuredClone(value); }
function replaceExact(value, replacements, changed) {
  if (Array.isArray(value)) return value.map((item) => replaceExact(item, replacements, changed));
  if (!value || typeof value !== "object") return typeof value === "string" && replacements.has(value) ? (changed.count += 1, replacements.get(value)) : value;
  for (const [key, child] of Object.entries(value)) value[key] = replaceExact(child, replacements, changed);
  return value;
}

async function writeReport(report) { await fs.writeFile(RUN_REPORT_PATH, JSON.stringify(report, null, 2) + "\n"); }

const report = {
  providerLabel: PROVIDER_LABEL,
  model: MODEL,
  endpoint: "https://buming001.token6688.com/v1/images/generations",
  requestSize: REQUEST_SIZE,
  quality: QUALITY,
  taskCount: RUN_TASKS.length,
  maxPaidCreateAttempts: RUN_MAX_PAID_CREATE_ATTEMPTS,
  estimatedMaxCostUsd: Number((RUN_MAX_PAID_CREATE_ATTEMPTS * PRICE_PER_REQUEST_USD).toFixed(4)),
  attempts: [],
  databaseWrites: []
};
await writeReport(report);

const prisma = new PrismaClient();
let paidAttempts = 0;
try {
  const provider = await prisma.platformAiProvider.findFirst({
    where: { label: PROVIDER_LABEL, modelType: MODEL, providerType: "image", enabled: true },
    select: { id: true, label: true, aiUrl: true, apiKey: true }
  });
  if (!provider?.apiKey || !provider.aiUrl) throw new Error("configured_vendor_provider_missing_api_credentials");
  const endpoint = providerBaseUrl(provider.aiUrl) + "/images/generations";
  if (!endpoint.startsWith("https://buming001.token6688.com/v1/")) throw new Error("unexpected_buming_image_endpoint:" + endpoint);

  const replacements = new Map(TASKS.map((task) => [task.oldUrl, task.newUrl]));
  for (const task of RUN_TASKS) {
    const displayPath = "/www/wwwroot/" + task.domain + "/current/public" + task.newUrl;
    try {
      const stat = await fs.stat(displayPath);
      if (stat.isFile() && stat.size > 0) throw new Error("refusing_to_overwrite_existing_asset:" + displayPath);
    } catch (error) {
      if (error?.message?.startsWith("refusing_to_overwrite")) throw error;
    }
  }
  for (const [runIndex, task] of RUN_TASKS.entries()) {
    const absoluteIndex = START_INDEX + runIndex;
    const displayPath = "/www/wwwroot/" + task.domain + "/current/public" + task.newUrl;
    const originalPathBase = displayPath.replace(/\.[^.]+$/, "") + ".provider-output";
    paidAttempts += 1;
    const requestId = "eu-missing-topic-assets:20260926:" + task.siteId + ":" + task.pageSlug + ":" + task.newUrl.split("/").at(-1);
    console.log(JSON.stringify({ event: "provider_create_start", attempt: paidAttempts, maxAttempts: RUN_MAX_PAID_CREATE_ATTEMPTS, taskNumber: absoluteIndex + 1, requestId, pageSlug: task.pageSlug, output: task.newUrl }));
    const { status, body, providerRequestId } = await requestProviderJson({
      endpoint,
      apiKey: provider.apiKey,
      requestId,
      payload: { model: MODEL, prompt: task.prompt, size: REQUEST_SIZE, quality: QUALITY, n: 1, response_format: "b64_json" },
      attempt: absoluteIndex + 1
    });
    const attempt = {
      attempt: paidAttempts,
      requestId,
      siteId: task.siteId,
      pageSlug: task.pageSlug,
      output: task.newUrl,
      status,
      ok: status >= 200 && status < 300,
      providerRequestId,
      providerTaskId: body?.id ?? body?.task_id ?? body?.data?.[0]?.id ?? "",
      usage: body?.usage ?? undefined,
      createdAt: new Date().toISOString()
    };
    report.attempts.push(attempt);
    await writeReport(report);
    console.log(JSON.stringify({ event: "provider_create_result", ...attempt }));
    if (!(status >= 200 && status < 300)) throw new Error(task.newUrl + ":provider_create_failed:" + status);
    const rawBuffer = await responseImageBuffer(body);
    if (RAW_ONLY) {
      const rawPath = path.join(RAW_DIR, String(absoluteIndex + 1).padStart(2, "0") + ".bin");
      await fs.mkdir(RAW_DIR, { recursive: true });
      await fs.writeFile(rawPath, rawBuffer, { flag: "wx" });
      report.attempts.at(-1).rawPath = rawPath;
      console.log(JSON.stringify({ event: "raw_provider_output_written", url: task.newUrl, rawPath, bytes: rawBuffer.length }));
    }
    await writeReport(report);
  }

  if (RAW_ONLY) {
    report.completed = true;
    report.rawOnly = true;
    report.paidCreateAttempts = paidAttempts;
    report.actualMaxCostUsd = Number((paidAttempts * PRICE_PER_REQUEST_USD).toFixed(4));
    await writeReport(report);
    console.log(JSON.stringify({ ok: true, rawOnly: true, completed: RUN_TASKS.length, taskRange: [START_INDEX + 1, END_INDEX], paidCreateAttempts: paidAttempts, estimatedMaxCostUsd: report.estimatedMaxCostUsd, actualMaxCostUsd: report.actualMaxCostUsd, rawDir: RAW_DIR }));
    process.exit(0);
  }

  for (const siteId of [...new Set(TASKS.map((task) => task.siteId))]) {
    const tasks = TASKS.filter((task) => task.siteId === siteId);
    const slugs = [...new Set(tasks.map((task) => task.pageSlug))];
    for (const slug of slugs) {
      const [livePage, themePage] = await Promise.all([
        prisma.livePage.findFirst({ where: { siteId, slug } }),
        prisma.themePage.findFirst({ where: { siteId, slug } })
      ]);
      if (!livePage) throw new Error("missing_live_page:" + siteId + ":" + slug);
      const changedLive = { count: 0 };
      const nextLive = replaceExact(clone(livePage.contentJson), replacements, changedLive);
      if (changedLive.count === 0) throw new Error("live_page_missing_expected_old_reference:" + siteId + ":" + slug);
      await prisma.livePage.update({ where: { id: livePage.id }, data: { contentJson: nextLive, updatedAt: new Date() } });
      report.databaseWrites.push({ entity: "LivePage", siteId, slug, replacements: changedLive.count });

      if (themePage) {
        const changedDraft = { count: 0 };
        const changedPublished = { count: 0 };
        const nextDraft = replaceExact(clone(themePage.draftJson), replacements, changedDraft);
        const nextPublished = replaceExact(clone(themePage.publishedJson), replacements, changedPublished);
        if (changedDraft.count || changedPublished.count) {
          await prisma.themePage.update({ where: { id: themePage.id }, data: { draftJson: nextDraft, publishedJson: nextPublished, updatedAt: new Date() } });
          report.databaseWrites.push({ entity: "ThemePage", siteId, slug, draftReplacements: changedDraft.count, publishedReplacements: changedPublished.count });
        }
      }
    }
  }
  report.completed = true;
  report.paidCreateAttempts = paidAttempts;
  report.actualMaxCostUsd = Number((paidAttempts * PRICE_PER_REQUEST_USD).toFixed(4));
  await writeReport(report);
  console.log(JSON.stringify({ ok: true, completed: TASKS.length, paidCreateAttempts: paidAttempts, estimatedMaxCostUsd: report.estimatedMaxCostUsd, actualMaxCostUsd: report.actualMaxCostUsd, databaseWrites: report.databaseWrites }));
} catch (error) {
  report.completed = false;
  report.paidCreateAttempts = paidAttempts;
  report.failure = error instanceof Error ? error.message : String(error);
  await writeReport(report);
  throw error;
} finally {
  await prisma.$disconnect();
}
