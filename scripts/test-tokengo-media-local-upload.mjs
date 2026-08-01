import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();

const siteId = process.env.TOKENGO_LOCAL_UPLOAD_SITE_ID?.trim() || "site_dreamshoot";
const customerEmail = process.env.TOKENGO_LOCAL_UPLOAD_CUSTOMER_EMAIL?.trim() || "1621417163@qq.com";
const baseUrl = process.env.TOKENGO_LOCAL_UPLOAD_BASE_URL?.trim() || "http://localhost:3002";
const videoThemeSlug = process.env.TOKENGO_LOCAL_UPLOAD_VIDEO_THEME_SLUG?.trim() || "prompt-directed-motion";
const maxPaidAttempts = 1;
const timeoutMs = Math.max(180_000, Number(process.env.TOKENGO_LOCAL_UPLOAD_TIMEOUT_MS ?? "900000") || 900_000);
const pollMs = Math.max(1_000, Number(process.env.TOKENGO_LOCAL_UPLOAD_POLL_MS ?? "5000") || 5_000);

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

function recordValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function transferSecret() {
  return process.env.CUSTOMER_ASSET_TRANSFER_SECRET?.trim() || process.env.AI_WORKER_SECRET?.trim() || "";
}

function remoteAssetBaseUrl() {
  return process.env.CUSTOMER_ASSET_WRITE_BASE_URL?.trim() ||
    process.env.CUSTOMER_ASSET_READ_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL?.trim() ||
    "";
}

async function makeTestImage() {
  const svg = Buffer.from(`
    <svg width="1024" height="576" viewBox="0 0 1024 576" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#38bdf8"/>
          <stop offset="1" stop-color="#2563eb"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="576" fill="url(#g)"/>
      <rect x="214" y="128" width="596" height="320" rx="34" fill="rgba(255,255,255,0.18)"/>
      <circle cx="368" cy="288" r="82" fill="rgba(255,255,255,0.86)"/>
      <rect x="540" y="214" width="228" height="148" rx="22" fill="rgba(15,23,42,0.26)"/>
      <path d="M542 426 C620 382 710 393 790 338" stroke="rgba(255,255,255,0.72)" stroke-width="18" stroke-linecap="round" fill="none"/>
    </svg>
  `);
  return sharp({
    create: {
      width: 1024,
      height: 576,
      channels: 3,
      background: "#2563eb"
    }
  }).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();
}

function createCsrfToken(scope, sessionId) {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-csrf-secret-change-me";
  const nonce = crypto.randomBytes(24).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${scope}:${sessionId}:${nonce}`).digest("base64url");
  return `${nonce}.${signature}`;
}

async function uploadRemoteAsset(params) {
  const base = remoteAssetBaseUrl();
  const secret = transferSecret();
  if (!base) throw new Error("customer_asset_remote_base_url_required");
  if (!secret || secret === "dev-worker-secret") throw new Error("customer_asset_transfer_secret_required");
  const url = new URL("/api/internal/customer-assets", base);
  url.searchParams.set("storageKey", params.storageKey);
  url.searchParams.set("mimeType", params.mimeType);
  url.searchParams.set("purpose", "input");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Customer-Asset-Transfer-Secret": secret,
      "X-Customer-Asset-Storage-Key": params.storageKey,
      "X-Customer-Asset-Mime-Type": params.mimeType,
      "X-Customer-Asset-Purpose": "input"
    },
    body: new Uint8Array(params.bytes),
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(`remote_asset_upload_failed_${response.status}_${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

async function ensurePublicAssetReadable(storageKey) {
  const base = process.env.TOKENGO_LOCAL_UPLOAD_PUBLIC_ASSET_BASE_URL?.trim() ||
    process.env.AI_WORKER_PUBLIC_BASE_URL?.trim() ||
    process.env.CUSTOMER_ASSET_READ_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_CUSTOMER_ASSET_READ_BASE_URL?.trim() ||
    process.env.CUSTOMER_ASSET_WRITE_BASE_URL?.trim() ||
    "";
  if (!base) throw new Error("customer_asset_public_read_base_url_required");
  const customer = await prisma.assetUpload.findFirst({ where: { siteId, storageKey }, select: { id: true, customerId: true } });
  if (!customer) throw new Error("asset_metadata_missing_after_upload");
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  const signature = crypto
    .createHmac("sha256", process.env.AI_WORKER_SECRET || "dev-worker-secret")
    .update(`${siteId}:${customer.customerId}:${customer.id}:${expiresAt}`)
    .digest("hex");
  const url = new URL(`/api/sites/${siteId}/customers/${customer.customerId}/assets/${customer.id}/download`, base);
  url.searchParams.set("worker", "1");
  url.searchParams.set("expiresAt", expiresAt);
  url.searchParams.set("signature", signature);
  const response = await fetch(url, { method: "HEAD", cache: "no-store" });
  return {
    url: url.toString(),
    status: response.status,
    contentType: response.headers.get("content-type") || ""
  };
}

async function waitForFinalJob(jobId) {
  const deadline = Date.now() + timeoutMs;
  let lastStage = "";
  while (Date.now() < deadline) {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`job_missing_${jobId}`);
    const result = recordValue(job.resultJson);
    const stage = String(result.lastWorkerStage || job.status);
    if (stage !== lastStage) {
      console.log(JSON.stringify({
        event: "progress",
        jobId,
        status: job.status,
        stage,
        providerTaskId: recordValue(result.outputSlots?.[0]).providerTaskId || result.providerTaskId || undefined
      }));
      lastStage = stage;
    }
    if (["succeeded", "failed", "refunded"].includes(job.status)) return job;
    await sleep(pollMs);
  }
  throw new Error(`job_timeout_${jobId}_${timeoutMs}`);
}

async function main() {
  const [customer, theme, provider] = await Promise.all([
    prisma.customer.findFirst({
      where: { siteId, email: customerEmail },
      select: { id: true, email: true, balance: { select: { balance: true, reserved: true } } }
    }),
    prisma.videoTheme.findFirst({
      where: { siteId, status: "active", slug: videoThemeSlug },
      select: { id: true, slug: true, name: true, creditCost: true, durationSeconds: true }
    }),
    prisma.platformAiProvider.findFirst({
      where: { id: "aiprov_tokengo_media_video" },
      select: { id: true, label: true, aiUrl: true, modelType: true, enabled: true, preferred: true, priority: true, maxImagesPerRequest: true }
    })
  ]);
  if (!customer) throw new Error(`customer_missing_${siteId}_${customerEmail}`);
  if (!theme) throw new Error(`video_theme_missing_${videoThemeSlug}`);
  if (!provider?.enabled || provider.modelType !== "grok-imagine-video") {
    throw new Error(`tokengo_provider_not_ready_${provider?.modelType || "missing"}`);
  }
  const customerSession = await prisma.customerSession.findFirst({
    where: { siteId, customerId: customer.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, expiresAt: true }
  });
  if (!customerSession) throw new Error(`customer_session_missing_${siteId}_${customer.id}`);
  const csrfToken = createCsrfToken(`customer:${siteId}`, customerSession.id);

  const assetId = uid("asset_tokengo_i2v");
  const storageKey = `sites/${siteId}/customers/${customer.id}/assets/${assetId}-local-upload-i2v-test.png`;
  const bytes = await makeTestImage();
  const remote = await uploadRemoteAsset({ storageKey, bytes, mimeType: "image/png" });
  await prisma.assetUpload.create({
    data: {
      id: assetId,
      siteId,
      customerId: customer.id,
      subjectRole: "video_frame",
      label: "TokenGo local upload I2V test",
      storageKey,
      mimeType: "image/png",
      role: "input",
      visibility: "private",
      reviewStatus: "approved"
    }
  });
  const publicRead = await ensurePublicAssetReadable(storageKey);
  if (publicRead.status < 200 || publicRead.status >= 300) {
    throw new Error(`public_asset_not_readable_${publicRead.status}_${publicRead.contentType}`);
  }

  console.log(JSON.stringify({
    event: "preflight",
    maxPaidAttempts,
    provider,
    customer: { id: customer.id, email: customer.email, balance: customer.balance },
    theme,
    asset: {
      id: assetId,
      bytes: bytes.length,
      storageKey,
      remoteSize: remote?.size,
      publicRead: { status: publicRead.status, contentType: publicRead.contentType }
    },
    timeouts: {
      createMs: process.env.LOCAL_AI_WORKER_VIDEO_CREATE_TIMEOUT_MS || "180000",
      workerMs: process.env.LOCAL_AI_WORKER_VIDEO_TIMEOUT_MS || "900000"
    }
  }, null, 2));
  const requestBody = {
    customerId: customer.id,
    aiAppSlug: "video_generator",
    idempotencyKey: `tokengo-local-upload-${assetId}`,
    params: {
      mode: "video",
      outputType: "video",
      videoThemeId: theme.id,
      videoThemeSlug: theme.slug,
      videoModelFamily: "grok",
      modelFamily: "grok",
      duration: "6",
      videoDuration: "6",
      durationSeconds: 6,
      videoDurationSeconds: 6,
      aspectRatio: "16:9",
      resolution: "720p",
      assetIds: [assetId],
      fields: {
        mode: "video",
        outputType: "video",
        prompt: "Animate the abstract reference image into a short smooth clip with a gentle camera push, soft floating motion, and stable clean composition.",
        videoThemeId: theme.id,
        videoThemeSlug: theme.slug,
        videoModelFamily: "grok",
        modelFamily: "grok",
        frameAssetIds: [assetId],
        duration: "6",
        videoDuration: "6",
        durationSeconds: 6,
        videoDurationSeconds: 6,
        aspectRatio: "16:9",
        resolution: "720p"
      }
    }
  };
  const response = await fetch(new URL(`/api/sites/${siteId}/ai/jobs`, baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `customer_session_${siteId}=${customerSession.id}; customer_csrf_${siteId}=${csrfToken}`,
      "x-csrf-token": csrfToken
    },
    body: JSON.stringify(requestBody),
    cache: "no-store"
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok || !responseBody?.job?.id) {
    throw new Error(`submit_failed_${response.status}_${JSON.stringify(responseBody).slice(0, 500)}`);
  }
  console.log(JSON.stringify({ event: "job_created", jobId: responseBody.job.id, workerDispatch: responseBody.workerDispatch }, null, 2));
  const finalJob = await waitForFinalJob(responseBody.job.id);
  const result = recordValue(finalJob.resultJson);
  const outputSlots = Array.isArray(result.outputSlots) ? result.outputSlots : [];
  const outputs = Array.isArray(result.outputs) ? result.outputs : [];
  console.log(JSON.stringify({
    event: "final",
    jobId: finalJob.id,
    status: finalJob.status,
    stage: result.lastWorkerStage,
    error: result.error,
    outputSlots,
    outputs,
    costTrace: result.costTrace,
    billingSettlement: result.billingSettlement
  }, null, 2));
  if (finalJob.status !== "succeeded") process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
