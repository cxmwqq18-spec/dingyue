import "./load-runtime-env.mjs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = process.cwd();
const helperPath = path.join(root, "src/lib/video-provider-prompt.ts");
const helper = await import(pathToFileURL(helperPath).href);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function arrayValue(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
}

try {
  if (!process.env.DATABASE_URL?.trim()) {
    console.log("SKIP video prompt recompute smoke: DATABASE_URL is not configured.");
    process.exit(0);
  }
  const prisma = new PrismaClient();
  const jobId = process.env.VIDEO_PROMPT_RECOMPUTE_JOB_ID?.trim() || "job_ms73ihzg_7a6edb";
  try {
    const job = await prisma.generationJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        siteId: true,
        customerId: true,
        status: true,
        requestJson: true
      }
    });

    if (!job) {
      console.log(`SKIP video prompt recompute smoke: ${jobId} was not found in the local database.`);
      process.exit(0);
    }

    const requestJson = recordValue(job.requestJson);
    const fields = recordValue(requestJson.fields);
    const inputs = helper.videoProviderPromptInputsFromRequest(job.requestJson);
    const providerPrompt = helper.buildMinimalVideoProviderPromptText({
      aspectRatio: fields.aspectRatio || fields.aspect_ratio || requestJson.aspectRatio || requestJson.aspect_ratio,
      duration: fields.durationSeconds || fields.videoDurationSeconds || fields.duration || fields.videoDuration || requestJson.durationSeconds || requestJson.videoDurationSeconds || requestJson.duration || requestJson.videoDuration,
      referenceCount: inputs.referenceCount,
      resolution: fields.resolution || requestJson.resolution,
      userPrompt: inputs.userPrompt
    });
    const promptNote = stringValue(fields.promptNote);
    const prompt = stringValue(fields.prompt) || stringValue(requestJson.prompt);
    const referenceCount = inputs.referenceCount;

    assert(job.status === "failed", `expected ${job.id} to be a failed video job, got ${job.status}`);
    assert(inputs.userPrompt.length > 0, `expected ${job.id} to contain a user prompt`);
    assert(providerPrompt.startsWith(inputs.userPrompt), "provider prompt should start from the user's own text");
    assert(
      providerPrompt.includes(helper.MINIMAL_VIDEO_CLEAN_OUTPUT_CONSTRAINT) ||
      providerPrompt.includes(helper.MINIMAL_VIDEO_EXPLICIT_TEXT_OUTPUT_CONSTRAINT),
      "provider prompt should end with the appropriate clean MP4 constraint"
    );
    if (referenceCount === 1) {
      assert(providerPrompt.includes("Use the uploaded image as the visual reference and first-frame source."), "single-image video prompt should mention the uploaded image reference");
      assert(providerPrompt.includes("Treat it as binding visual evidence"), "single-image video prompt should lock the reference as binding evidence");
    } else if (referenceCount > 1) {
      assert(providerPrompt.includes("Use the uploaded images in the selected order as visual references."), "multi-image video prompt should mention ordered image references");
      assert(providerPrompt.includes("Treat the uploaded frames as binding visual evidence"), "multi-image video prompt should lock ordered frames as binding evidence");
    }
    assert(providerPrompt.includes("Output format lock:"), "provider prompt should state the normalized request output format");
    assert(!providerPrompt.includes("Skill pack"), "provider prompt should not include backend skill-pack wording");
    assert(!providerPrompt.includes("reference contract"), "provider prompt should not include backend reference contract wording");
    assert(!providerPrompt.includes("Theme prompt:"), "provider prompt should not include theme prompt wording");
    assert(!providerPrompt.includes("Opening sequence lock"), "provider prompt should not include opening-beat wording");
    assert(providerPrompt.length <= inputs.userPrompt.length + 1200, "provider prompt should add bounded reference-fidelity guidance without bloating the user's original text");
    assert(referenceCount === new Set([...(arrayValue(requestJson.assetIds)), ...(arrayValue(fields.frameAssetIds))]).size, "reference count should follow the selected frame asset ids");
    assert(promptNote.length > 0 || prompt.length > 0, "real job should have had some user-written video text");

    const explicitTextPrompt = helper.buildMinimalVideoProviderPromptText({
      userPrompt: "Add Chinese voiceover and show the shop name and phone number as clear subtitles.",
      referenceCount
    });
    assert(explicitTextPrompt.includes(helper.MINIMAL_VIDEO_EXPLICIT_TEXT_OUTPUT_CONSTRAINT), "explicit text requests should preserve dialogue and on-screen text");
    assert(!explicitTextPrompt.includes("No captions, text overlay"), "explicit text requests should not receive a blanket no-text constraint");

    const plainPrompt = helper.buildMinimalVideoProviderPromptText({
      userPrompt: "A quiet product close-up with a gentle camera push-in.",
      referenceCount
    });
    assert(plainPrompt.includes(helper.MINIMAL_VIDEO_CLEAN_OUTPUT_CONSTRAINT), "plain prompts should keep the clean-output constraint");

    console.log(JSON.stringify({
      jobId: job.id,
      status: job.status,
      userPromptLength: inputs.userPrompt.length,
      providerPromptLength: providerPrompt.length,
      referenceCount,
      overhead: providerPrompt.length - inputs.userPrompt.length
    }, null, 2));
    console.log("PASS video provider prompt recompute smoke");
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
