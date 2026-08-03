import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

process.env.TUTORIAL_BASE_URL = process.env.AIDREAMCAPES_TUTORIAL_BASE_URL || "http://127.0.0.1:3002";
process.env.TUTORIAL_SITE_ID = "site_aidreamcapes";
process.env.TUTORIAL_SITE_SLUG = "aidreamcapes";
process.env.TUTORIAL_BRAND_NAME = "Aidreamcapes";
process.env.TUTORIAL_RUN_SLUG = "aidreamcapes-i2v-tutorial-real-work";
process.env.TUTORIAL_TARGET_SECONDS = "55";
process.env.TUTORIAL_OUTPUT_MP4 = "output/aidreamcapes-i2v-tutorial-55s.mp4";
process.env.TUTORIAL_REAL_GENERATION = process.env.AIDREAMCAPES_TUTORIAL_REAL_GENERATION === "1" ? "1" : "0";
process.env.TUTORIAL_MAX_ATTEMPTS = process.env.AIDREAMCAPES_TUTORIAL_MAX_ATTEMPTS || "1";
process.env.TUTORIAL_VOICE = process.env.AIDREAMCAPES_TUTORIAL_VOICE || "Samantha";
process.env.TUTORIAL_VOICE_RATE = process.env.AIDREAMCAPES_TUTORIAL_VOICE_RATE || "160";
process.env.TUTORIAL_BACKGROUND_MUSIC = process.env.AIDREAMCAPES_TUTORIAL_BACKGROUND_MUSIC || "1";
process.env.TUTORIAL_BACKGROUND_VOLUME = process.env.AIDREAMCAPES_TUTORIAL_BACKGROUND_VOLUME || "0.08";
process.env.TUTORIAL_CUSTOMER_EMAIL =
  process.env.AIDREAMCAPES_TUTORIAL_CUSTOMER_EMAIL ||
  process.env.SMOKE_AIDREAMCAPES_CUSTOMER_EMAIL ||
  "aria@aidreamcapes.localhost";
process.env.TUTORIAL_CUSTOMER_PASSWORD =
  process.env.AIDREAMCAPES_TUTORIAL_CUSTOMER_PASSWORD ||
  process.env.SMOKE_AIDREAMCAPES_CUSTOMER_PASSWORD ||
  "aria123";
process.env.TUTORIAL_SOURCE_FRAME_IMAGE =
  process.env.AIDREAMCAPES_TUTORIAL_SOURCE_FRAME_IMAGE ||
  "public/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/private-fan-scene-album-01.webp";
process.env.TUTORIAL_MASK_NAMES =
  process.env.AIDREAMCAPES_TUTORIAL_MASK_NAMES ||
  "Aria,Aria Stone,Aidreamcapes Demo,Nora Whitman,Nora,Mira,Lena,Rowan";
process.env.TUTORIAL_PROMPT_TEXT = `Create a 6-second image-to-video clip from the selected frame. Keep the adult subject, outfit, lighting, background, and color mood consistent. Add a slow cinematic push-in, subtle natural movement, gentle background glow, natural blinking, and a calm polished expression. No extra people, no logos, no watermark, no captions, no distorted hands, and no sudden scene changes. End on a steady close portrait frame.`;
process.env.TUTORIAL_NARRATION_JSON = JSON.stringify([
  { duration: 5, text: "First, sign in to your private Aidreamcapes workspace." },
  { duration: 5, text: "Open the Image to Video workspace from your account." },
  { duration: 7, text: "Click Upload, then choose a clean frame image from your computer." },
  { duration: 5, text: "Wait for the frame to finish uploading before you continue." },
  { duration: 5, text: "Select the uploaded image so the video follows this reference." },
  { duration: 9, text: "Paste clear motion instructions, then keep the video format at sixteen by nine, seven twenty p, and six seconds." },
  { duration: 5, text: "Click Generate video to submit the request through the active provider." },
  { duration: 6, text: "The request appears in Video results while the account tracks delivery." },
  { duration: 8, text: "Open the preview, press play, and review the finished video." }
]);
process.env.TUTORIAL_CAPTURE_DURATIONS_JSON = JSON.stringify({
  login: 5,
  workspace: 5,
  uploadChooser: 4,
  uploadSelected: 3,
  uploaded: 5,
  select: 5,
  prompt: 9,
  generate: 5,
  progress: 6,
  result: 8
});
process.env.TUTORIAL_CAPTIONS_JSON = JSON.stringify({
  login: "Sign in to your private Aidreamcapes workspace",
  workspace: "Open the Image to Video workspace",
  upload: "Click Upload and choose a frame image",
  uploaded: "Wait for the uploaded frame to appear",
  select: "Select the frame image to guide the video",
  prompt: "Paste the prompt and keep 16:9 / 720P / 6s",
  generate: "Click Generate video to submit",
  progress: "Track delivery in Video results",
  result: "Open preview and play the finished video"
});

await ensureAidreamcapesLocalPreviewVideo();
await import("./record-mydreamshoots-i2v-tutorial.mjs");

async function ensureAidreamcapesLocalPreviewVideo() {
  if (process.env.AIDREAMCAPES_TUTORIAL_SEED_PREVIEW === "0") return;
  const prisma = new PrismaClient();
  try {
    const siteId = "site_aidreamcapes";
    const customer = await prisma.customer.findUnique({
      where: { siteId_email: { siteId, email: "aria@aidreamcapes.localhost" } },
      select: { id: true }
    });
    if (!customer) return;
    const aiApp = await prisma.aiApp.findUnique({ where: { id: "ai_video_generator" }, select: { id: true } });
    if (!aiApp) return;

    const now = new Date();
    const jobId = "job_aidreamcapes_tutorial_preview";
    const assetId = "asset_aidreamcapes_tutorial_preview_video";
    const storageKey = `sites/${siteId}/customers/${customer.id}/assets/${jobId}-video-1.mp4`;
    const sourceVideo = path.resolve(
      process.cwd(),
      "data/customer-assets/sites/site_aidreamcapes/customers/cust_aidreamcapes_mqq9gas9_i1vjal/assets/job_mrlqua3n_4f8408-video-1.mp4"
    );
    const targetVideo = path.resolve(process.cwd(), "data/customer-assets", storageKey);
    await fs.mkdir(path.dirname(targetVideo), { recursive: true });
    await fs.copyFile(sourceVideo, targetVideo);

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
        promptNote: process.env.TUTORIAL_PROMPT_TEXT
      },
      prompt: process.env.TUTORIAL_PROMPT_TEXT,
      worker: "local.demo.video",
      tutorialSeed: true
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
      requestId: "local_aidreamcapes_tutorial_preview",
      settledAt: now.toISOString(),
      lastWorkerStage: "video_result_received",
      lastWorkerStatus: "succeeded",
      tutorialSeed: true
    };

    await prisma.generationJob.upsert({
      where: { id: jobId },
      create: {
        id: jobId,
        siteId,
        customerId: customer.id,
        aiAppId: aiApp.id,
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
        updatedAt: now
      }
    });
    await prisma.assetUpload.upsert({
      where: { id: assetId },
      create: {
        id: assetId,
        siteId,
        customerId: customer.id,
        jobId,
        label: "Prompt Directed Motion tutorial preview",
        storageKey,
        mimeType: "video/mp4",
        role: "output",
        visibility: "private",
        reviewStatus: "approved",
        createdAt: now,
        updatedAt: now
      },
      update: {
        jobId,
        label: "Prompt Directed Motion tutorial preview",
        storageKey,
        mimeType: "video/mp4",
        role: "output",
        visibility: "private",
        reviewStatus: "approved",
        deletedAt: null,
        updatedAt: now
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}
