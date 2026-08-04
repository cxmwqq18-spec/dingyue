import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";

function isLocalTutorialBaseUrl() {
  const raw = process.env.TUTORIAL_BASE_URL || "";
  if (!raw) return true;
  const hostname = new URL(raw).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0" || hostname.endsWith(".localhost");
}

function resolveRepoPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}

function draftSourceFor(siteId, kind) {
  const envCandidates = kind === "video"
    ? [
        process.env.TUTORIAL_SOURCE_FRAME_IMAGE,
        process.env.AIDREAMCAPES_TUTORIAL_SOURCE_FRAME_IMAGE,
        process.env.TUTORIAL_SOURCE_IMAGE
      ]
    : [
        process.env.TUTORIAL_SOURCE_IMAGE,
        process.env.AIDREAMCAPES_IMAGE_TUTORIAL_SOURCE_IMAGE,
        process.env.TUTORIAL_SOURCE_FRAME_IMAGE
      ];
  const defaults = siteId === "site_aidreamcapes"
    ? [
        "public/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/private-fan-scene-album-01.webp",
        "public/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/creator-supporter-photo-wall-01.webp"
      ]
    : [
        "public/assets/dreamshoot/frames/sample-professional-headshot.png",
        "public/assets/dreamshoot/frames/faq-intro-portrait.png"
      ];
  const candidate = [...envCandidates, ...defaults]
    .filter(Boolean)
    .map(resolveRepoPath)
    .find((filePath) => fsSync.existsSync(filePath));
  if (!candidate) throw new Error(`tutorial_draft_source_missing:${siteId}:${kind}`);
  return candidate;
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${path.basename(command)} exited ${code}: ${(stderr || stdout).slice(-1200)}`));
    });
  });
}

async function writeFreshDraftImage(sourcePath, targetPath) {
  const source = sharp(sourcePath);
  const meta = await source.metadata();
  if (!meta.width || !meta.height) throw new Error(`tutorial_draft_image_metadata_missing:${sourcePath}`);
  const cropHeight = Math.max(1, Math.floor(meta.height * 0.87));
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await source
    .extract({ left: 0, top: 0, width: meta.width, height: cropHeight })
    .resize(1280, 900, { fit: "cover", position: "attention" })
    .modulate({ brightness: 1.03, saturation: 1.05 })
    .sharpen({ sigma: 0.65 })
    .webp({ quality: 92, effort: 4 })
    .toFile(targetPath);
  const outputMeta = await sharp(targetPath).metadata();
  if (!outputMeta.width || !outputMeta.height || outputMeta.format !== "webp") {
    throw new Error(`tutorial_draft_image_invalid:${targetPath}`);
  }
  return outputMeta;
}

async function writeFreshDraftVideo(sourcePath, targetPath) {
  const framePath = `${targetPath}.draft-frame.webp`;
  await writeFreshDraftImage(sourcePath, framePath);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await runCommand(ffmpegPath, [
    "-y",
    "-loop", "1",
    "-i", framePath,
    "-vf", "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0011,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=180:s=1280x720:fps=30,format=yuv420p,fade=t=in:st=0:d=0.35,fade=t=out:st=5.35:d=0.65",
    "-t", "6",
    "-an",
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    targetPath
  ]);
  await fs.rm(framePath, { force: true });
  const { stdout } = await runCommand(ffprobePath, [
    "-v", "error",
    "-print_format", "json",
    "-show_streams",
    "-show_format",
    targetPath
  ]);
  const info = JSON.parse(stdout);
  const video = (info.streams || []).find((stream) => stream.codec_type === "video");
  const duration = Number(info.format?.duration || video?.duration || 0);
  if (!video || Number(video.width) !== 1280 || Number(video.height) !== 720 || duration < 5.8 || duration > 6.2) {
    throw new Error(`tutorial_draft_video_invalid:${targetPath}:${duration}`);
  }
  return { width: Number(video.width), height: Number(video.height), duration };
}

async function previewTargetPath(storageKey) {
  const targetPath = path.resolve(process.cwd(), "data/customer-assets", storageKey);
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  return targetPath;
}

async function upsertPreviewRecords({
  prisma,
  siteId,
  customerId,
  aiAppId,
  jobId,
  assetId,
  now,
  label,
  storageKey,
  mimeType,
  requestJson,
  resultJson,
  validationReport
}) {
  await prisma.generationJob.upsert({
    where: { id: jobId },
    create: {
      id: jobId,
      siteId,
      customerId,
      aiAppId,
      status: "succeeded",
      creditsReserved: 0,
      entryPoint: "customer_workspace",
      requestJson,
      resultJson,
      createdAt: now,
      updatedAt: now
    },
    update: {
      status: "succeeded",
      requestJson,
      resultJson,
      createdAt: now,
      updatedAt: now
    }
  });
  await prisma.assetUpload.upsert({
    where: { id: assetId },
    create: {
      id: assetId,
      siteId,
      customerId,
      jobId,
      label,
      storageKey,
      mimeType,
      role: "output",
      visibility: "private",
      reviewStatus: "approved",
      validationStatus: "passed",
      validationReport,
      createdAt: now,
      updatedAt: now
    },
    update: {
      jobId,
      label,
      storageKey,
      mimeType,
      role: "output",
      visibility: "private",
      reviewStatus: "approved",
      validationStatus: "passed",
      validationReport,
      deletedAt: null,
      createdAt: now,
      updatedAt: now
    }
  });
}

async function customerForTutorial(prisma, siteId, fallbackEmail) {
  const email =
    process.env.TUTORIAL_CUSTOMER_EMAIL ||
    process.env.SMOKE_MYDREAMSHOOTS_CUSTOMER_EMAIL ||
    process.env.SMOKE_CUSTOMER_EMAIL ||
    fallbackEmail;
  return prisma.customer.findUnique({
    where: { siteId_email: { siteId, email } },
    select: { id: true }
  });
}

export async function ensureMydreamshootsLocalPreviewVideo() {
  if (process.env.MYDREAMSHOOTS_TUTORIAL_SEED_PREVIEW === "0" || !isLocalTutorialBaseUrl()) return;
  const prisma = new PrismaClient();
  try {
    const siteId = "site_dreamshoot";
    const customer = await customerForTutorial(prisma, siteId, "nora@mydreamshoots.localhost");
    if (!customer) return;
    const aiApp = await prisma.aiApp.findUnique({ where: { id: "ai_video_generator" }, select: { id: true } });
    if (!aiApp) return;

    const now = new Date();
    const runToken = Date.now().toString(36);
    const jobId = "job_mydreamshoots_tutorial_preview_video";
    const assetId = "asset_mydreamshoots_tutorial_preview_video";
    const storageKey = `sites/${siteId}/customers/${customer.id}/assets/${jobId}-fresh-${runToken}-video-1.mp4`;
    const draftSource = draftSourceFor(siteId, "video");
    const targetPath = await previewTargetPath(storageKey);
    const validation = await writeFreshDraftVideo(draftSource, targetPath);

    const requestJson = {
      mode: "video",
      outputType: "video",
      duration: "6",
      videoDuration: "6",
      durationSeconds: 6,
      videoDurationSeconds: 6,
      aspectRatio: "16:9",
      aspect_ratio: "16:9",
      resolution: "720p",
      fields: {
        mode: "video",
        outputType: "video",
        videoInputMode: "image_to_video",
        duration: "6",
        videoDuration: "6",
        durationSeconds: 6,
        videoDurationSeconds: 6,
        aspectRatio: "16:9",
        aspect_ratio: "16:9",
        resolution: "720p",
        promptNote: process.env.TUTORIAL_PROMPT_TEXT || "Create a short motion concept from the selected source frame.",
        previewMode: "fresh_draft",
        draftSource: path.basename(draftSource)
      },
      prompt: process.env.TUTORIAL_PROMPT_TEXT || "Create a short motion concept from the selected source frame.",
      worker: "local.demo.video",
      tutorialSeed: true,
      previewMode: "fresh_draft",
      draftSource: path.basename(draftSource)
    };
    const resultJson = {
      error: null,
      outputs: [{ mimeType: "video/mp4", storageKey }],
      outputSlots: [{
        index: 1,
        status: "succeeded",
        stage: "video_result_received",
        progress: 100,
        mimeType: "video/mp4",
        storageKey,
        updatedAt: now.toISOString()
      }],
      requestId: `local_mydreamshoots_tutorial_preview_video_${runToken}`,
      settledAt: now.toISOString(),
      lastWorkerStage: "video_result_received",
      lastWorkerStatus: "succeeded",
      tutorialSeed: true,
      previewMode: "fresh_draft",
      draftSource: path.basename(draftSource)
    };

    await upsertPreviewRecords({
      prisma,
      siteId,
      customerId: customer.id,
      aiAppId: aiApp.id,
      jobId,
      assetId,
      now,
      label: "Fresh draft video preview",
      storageKey,
      mimeType: "video/mp4",
      requestJson,
      resultJson,
      validationReport: {
        source: "fresh_draft_local",
        draftSource: path.basename(draftSource),
        ...validation
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function ensureAidreamcapesLocalPreviewVideo() {
  if (process.env.AIDREAMCAPES_TUTORIAL_SEED_PREVIEW === "0" || !isLocalTutorialBaseUrl()) return;
  const prisma = new PrismaClient();
  try {
    const siteId = "site_aidreamcapes";
    const customer = await customerForTutorial(prisma, siteId, "aria@aidreamcapes.localhost");
    if (!customer) return;
    const aiApp = await prisma.aiApp.findUnique({ where: { id: "ai_video_generator" }, select: { id: true } });
    if (!aiApp) return;

    const now = new Date();
    const runToken = Date.now().toString(36);
    const jobId = "job_aidreamcapes_tutorial_preview_video";
    const assetId = "asset_aidreamcapes_tutorial_preview_video";
    const storageKey = `sites/${siteId}/customers/${customer.id}/assets/${jobId}-fresh-${runToken}-video-1.mp4`;
    const draftSource = draftSourceFor(siteId, "video");
    const targetPath = await previewTargetPath(storageKey);
    const validation = await writeFreshDraftVideo(draftSource, targetPath);
    const promptText = process.env.TUTORIAL_PROMPT_TEXT || "Create a short motion concept from the selected source frame.";
    const requestJson = {
      mode: "video",
      outputType: "video",
      duration: "6",
      videoDuration: "6",
      durationSeconds: 6,
      videoDurationSeconds: 6,
      aspectRatio: "16:9",
      aspect_ratio: "16:9",
      resolution: "720p",
      fields: {
        mode: "video",
        outputType: "video",
        videoInputMode: "image_to_video",
        duration: "6",
        videoDuration: "6",
        durationSeconds: 6,
        videoDurationSeconds: 6,
        aspectRatio: "16:9",
        aspect_ratio: "16:9",
        resolution: "720p",
        promptNote: promptText,
        previewMode: "fresh_draft",
        draftSource: path.basename(draftSource)
      },
      prompt: promptText,
      worker: "local.demo.video",
      tutorialSeed: true,
      previewMode: "fresh_draft",
      draftSource: path.basename(draftSource)
    };
    const resultJson = {
      error: null,
      outputs: [{ mimeType: "video/mp4", storageKey }],
      outputSlots: [{
        index: 1,
        status: "succeeded",
        stage: "video_result_received",
        progress: 100,
        mimeType: "video/mp4",
        storageKey,
        updatedAt: now.toISOString()
      }],
      requestId: `local_aidreamcapes_tutorial_preview_video_${runToken}`,
      settledAt: now.toISOString(),
      lastWorkerStage: "video_result_received",
      lastWorkerStatus: "succeeded",
      tutorialSeed: true,
      previewMode: "fresh_draft",
      draftSource: path.basename(draftSource)
    };

    await upsertPreviewRecords({
      prisma,
      siteId,
      customerId: customer.id,
      aiAppId: aiApp.id,
      jobId,
      assetId,
      now,
      label: "Fresh draft video preview",
      storageKey,
      mimeType: "video/mp4",
      requestJson,
      resultJson,
      validationReport: {
        source: "fresh_draft_local",
        draftSource: path.basename(draftSource),
        ...validation
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function ensureMydreamshootsLocalPreviewImage() {
  if (process.env.MYDREAMSHOOTS_TUTORIAL_SEED_PREVIEW === "0" || !isLocalTutorialBaseUrl()) return;
  const prisma = new PrismaClient();
  try {
    const siteId = "site_dreamshoot";
    const customer = await customerForTutorial(prisma, siteId, "nora@mydreamshoots.localhost");
    if (!customer) return;
    const aiApp = await prisma.aiApp.findUnique({ where: { id: "ai_image" }, select: { id: true } });
    if (!aiApp) return;

    const now = new Date();
    const runToken = Date.now().toString(36);
    const jobId = "job_mydreamshoots_tutorial_preview_image";
    const assetId = "asset_mydreamshoots_tutorial_preview_image";
    const storageKey = `sites/${siteId}/customers/${customer.id}/assets/${jobId}-fresh-${runToken}-output-1.webp`;
    const draftSource = draftSourceFor(siteId, "image");
    const targetPath = await previewTargetPath(storageKey);
    const validation = await writeFreshDraftImage(draftSource, targetPath);

    const promptNote = process.env.TUTORIAL_PROMPT_NOTE ||
      "Warm romantic portrait with soft date-night lighting, natural expression, clean face detail, polished private album finish, no logos, no text, no watermark.";
    const requestJson = {
      mode: "image",
      outputType: "image",
      outputCount: 1,
      fields: {
        mode: "image",
        outputType: "image",
        packageTitle: process.env.TUTORIAL_PACKAGE_TITLE || "Valentine Photos",
        promptNote,
        previewMode: "fresh_draft",
        draftSource: path.basename(draftSource)
      },
      prompt: promptNote,
      worker: "local.demo.image",
      tutorialSeed: true,
      previewMode: "fresh_draft",
      draftSource: path.basename(draftSource)
    };
    const resultJson = {
      error: null,
      outputs: [{ mimeType: "image/webp", storageKey }],
      outputSlots: [{
        index: 1,
        status: "succeeded",
        stage: "image_result_received",
        progress: 100,
        mimeType: "image/webp",
        storageKey,
        updatedAt: now.toISOString()
      }],
      requestId: `local_mydreamshoots_tutorial_preview_image_${runToken}`,
      settledAt: now.toISOString(),
      lastWorkerStage: "image_result_received",
      lastWorkerStatus: "succeeded",
      tutorialSeed: true,
      previewMode: "fresh_draft",
      draftSource: path.basename(draftSource)
    };

    await upsertPreviewRecords({
      prisma,
      siteId,
      customerId: customer.id,
      aiAppId: aiApp.id,
      jobId,
      assetId,
      now,
      label: "Fresh draft image preview",
      storageKey,
      mimeType: "image/webp",
      requestJson,
      resultJson,
      validationReport: {
        source: "fresh_draft_local",
        draftSource: path.basename(draftSource),
        ...validation
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

export async function ensureAidreamcapesLocalPreviewImage() {
  if (process.env.AIDREAMCAPES_IMAGE_TUTORIAL_SEED_PREVIEW === "0" || !isLocalTutorialBaseUrl()) return;
  const prisma = new PrismaClient();
  try {
    const siteId = "site_aidreamcapes";
    const customer = await customerForTutorial(prisma, siteId, "aria@aidreamcapes.localhost");
    if (!customer) return;
    const aiApp = await prisma.aiApp.findUnique({ where: { id: "ai_image" }, select: { id: true } });
    if (!aiApp) return;

    const now = new Date();
    const runToken = Date.now().toString(36);
    const jobId = "job_aidreamcapes_tutorial_preview_image";
    const assetId = "asset_aidreamcapes_tutorial_preview_image";
    const storageKey = `sites/${siteId}/customers/${customer.id}/assets/${jobId}-fresh-${runToken}-output-1.webp`;
    const draftSource = draftSourceFor(siteId, "image");
    const targetPath = await previewTargetPath(storageKey);
    const validation = await writeFreshDraftImage(draftSource, targetPath);

    const promptNote = process.env.TUTORIAL_PROMPT_NOTE ||
      "Create a polished private fan-scene portrait album image from the selected approved source photo. Keep the adult subject natural, use warm cinematic event lighting, preserve clean facial detail, avoid logos, avoid public-figure resemblance, avoid text, and avoid watermarks.";
    const requestJson = {
      mode: "image",
      outputType: "image",
      outputCount: 1,
      fields: {
        mode: "image",
        outputType: "image",
        packageTitle: process.env.TUTORIAL_PACKAGE_TITLE || "Private Fan Scene Album",
        promptNote,
        previewMode: "fresh_draft",
        draftSource: path.basename(draftSource)
      },
      prompt: promptNote,
      worker: "local.demo.image",
      tutorialSeed: true,
      previewMode: "fresh_draft",
      draftSource: path.basename(draftSource)
    };
    const resultJson = {
      error: null,
      outputs: [{ mimeType: "image/webp", storageKey }],
      outputSlots: [{
        index: 1,
        status: "succeeded",
        stage: "image_result_received",
        progress: 100,
        mimeType: "image/webp",
        storageKey,
        updatedAt: now.toISOString()
      }],
      requestId: `local_aidreamcapes_tutorial_preview_image_${runToken}`,
      settledAt: now.toISOString(),
      lastWorkerStage: "image_result_received",
      lastWorkerStatus: "succeeded",
      tutorialSeed: true,
      previewMode: "fresh_draft",
      draftSource: path.basename(draftSource)
    };

    await upsertPreviewRecords({
      prisma,
      siteId,
      customerId: customer.id,
      aiAppId: aiApp.id,
      jobId,
      assetId,
      now,
      label: "Fresh draft image preview",
      storageKey,
      mimeType: "image/webp",
      requestJson,
      resultJson,
      validationReport: {
        source: "fresh_draft_local",
        draftSource: path.basename(draftSource),
        ...validation
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}
