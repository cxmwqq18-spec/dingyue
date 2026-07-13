import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCsrfToken(scope, sessionId) {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "dev-csrf-secret-change-me";
  const nonce = crypto.randomBytes(24).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(`${scope}:${sessionId}:${nonce}`).digest("base64url");
  return `${nonce}.${signature}`;
}

function cleanRequestJson(value) {
  const request = value && typeof value === "object" && !Array.isArray(value)
    ? structuredClone(value)
    : {};
  delete request.lastWorkerStatus;
  delete request.lastWorkerStage;
  delete request.rerunOf;
  delete request.rerunBy;
  return request;
}

function jobResult(job) {
  return job?.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson)
    ? job.resultJson
    : {};
}

async function waitForFinalJob(jobId, timeoutMs, pollMs) {
  const deadline = Date.now() + timeoutMs;
  let previousStage = "";
  while (Date.now() < deadline) {
    const job = await prisma.generationJob.findUnique({ where: { id: jobId } });
    if (!job) throw new Error(`video_probe_job_missing_${jobId}`);
    const result = jobResult(job);
    const stage = String(result.lastWorkerStage || job.status);
    if (stage !== previousStage) {
      console.log(JSON.stringify({ event: "progress", jobId, status: job.status, stage }));
      previousStage = stage;
    }
    if (["succeeded", "failed", "refunded"].includes(job.status)) return job;
    await sleep(pollMs);
  }
  throw new Error(`video_probe_timeout_${jobId}_${timeoutMs}`);
}

async function verifyVideoOutput({ baseUrl, job }) {
  const result = jobResult(job);
  const storageKey = Array.isArray(result.outputs) ? result.outputs[0]?.storageKey : undefined;
  if (!storageKey) throw new Error(`video_probe_output_storage_key_missing_${job.id}`);
  const asset = await prisma.assetUpload.findFirst({
    where: { siteId: job.siteId, customerId: job.customerId, storageKey, deletedAt: null },
    orderBy: { createdAt: "desc" }
  });
  if (!asset) throw new Error(`video_probe_output_asset_missing_${job.id}`);

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const secret = process.env.AI_WORKER_SECRET || "dev-worker-secret";
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${job.siteId}:${job.customerId}:${asset.id}:${expiresAt}`)
    .digest("hex");
  const url = new URL(`/api/sites/${job.siteId}/customers/${job.customerId}/assets/${asset.id}/download`, baseUrl);
  url.searchParams.set("worker", "1");
  url.searchParams.set("expiresAt", expiresAt);
  url.searchParams.set("signature", signature);
  const response = await fetch(url, { cache: "no-store" });
  const bytes = Buffer.from(await response.arrayBuffer());
  const mimeType = response.headers.get("content-type")?.split(";")[0] || "";
  const hasMp4Signature = bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
  if (!response.ok || !mimeType.startsWith("video/") || !bytes.length || (mimeType === "video/mp4" && !hasMp4Signature)) {
    throw new Error(`video_probe_invalid_output_${response.status}_${mimeType}_${bytes.length}`);
  }
  return { assetId: asset.id, bytes: bytes.length, mimeType, storageKey };
}

async function createProbeJob({ baseUrl, sessionId, csrfToken, sourceJob, requestJson, modelOverride }) {
  const params = structuredClone(requestJson);
  if (modelOverride) {
    params.modelOverride = modelOverride;
    params.fields = params.fields && typeof params.fields === "object" && !Array.isArray(params.fields)
      ? { ...params.fields, modelOverride }
      : { modelOverride };
  }
  const response = await fetch(new URL(`/api/sites/${sourceJob.siteId}/ai/jobs`, baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": `customer_session_${sourceJob.siteId}=${sessionId}; customer_csrf_${sourceJob.siteId}=${csrfToken}`,
      "x-csrf-token": csrfToken
    },
    body: JSON.stringify({
      customerId: sourceJob.customerId,
      aiAppSlug: "video_generator",
      params
    }),
    cache: "no-store"
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body?.job?.id) {
    throw new Error(`video_probe_create_failed_${response.status}_${JSON.stringify(body).slice(0, 500)}`);
  }
  return body.job.id;
}

async function main() {
  const sourceJobId = option("source-job");
  if (!sourceJobId) throw new Error("usage: --source-job=<failed-video-job-id>");
  const baseUrl = option("base-url", "http://localhost:3002");
  const maxAttempts = positiveInteger(option("max-attempts"), 8);
  const pollMs = positiveInteger(option("poll-ms"), 3000);
  const timeoutMs = positiveInteger(option("timeout-ms"), 20 * 60 * 1000);
  const retryDelayMs = positiveInteger(option("retry-delay-ms"), 5000);
  const modelCandidates = option("models")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const sourceJob = await prisma.generationJob.findUnique({ where: { id: sourceJobId } });
  if (!sourceJob) throw new Error(`source_job_not_found_${sourceJobId}`);
  if (sourceJob.aiAppId !== "ai_video_generator") throw new Error(`source_job_not_video_${sourceJobId}`);
  const requestJson = cleanRequestJson(sourceJob.requestJson);
  const sessionId = `sess_video_probe_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
  const csrfToken = createCsrfToken(`customer:${sourceJob.siteId}`, sessionId);
  await prisma.customerSession.create({
    data: {
      id: sessionId,
      siteId: sourceJob.siteId,
      customerId: sourceJob.customerId,
      expiresAt: new Date(Date.now() + timeoutMs + 60 * 60 * 1000)
    }
  });

  try {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const modelOverride = modelCandidates.length ? modelCandidates[(attempt - 1) % modelCandidates.length] : "";
      console.log(JSON.stringify({ event: "attempt_started", attempt, maxAttempts, sourceJobId, modelOverride: modelOverride || "provider_default" }));
      const jobId = await createProbeJob({ baseUrl, sessionId, csrfToken, sourceJob, requestJson, modelOverride });
      console.log(JSON.stringify({ event: "job_created", attempt, jobId }));
      const job = await waitForFinalJob(jobId, timeoutMs, pollMs);
      const result = jobResult(job);
      if (job.status === "succeeded") {
        const output = await verifyVideoOutput({ baseUrl, job });
        console.log(JSON.stringify({ event: "video_generation_succeeded", attempt, jobId, output }, null, 2));
        return true;
      }
      console.log(JSON.stringify({
        event: "attempt_failed",
        attempt,
        jobId,
        status: job.status,
        stage: result.lastWorkerStage,
        error: result.error,
        providerTrace: result.providerTrace,
        providerErrors: result.costTrace?.providerErrors,
        billingSettlement: result.billingSettlement
      }, null, 2));
      if (attempt < maxAttempts) await sleep(retryDelayMs);
    }
    return false;
  } finally {
    await prisma.customerSession.deleteMany({ where: { id: sessionId } });
  }
}

let succeeded = false;
try {
  succeeded = await main();
} finally {
  await prisma.$disconnect();
}
if (!succeeded) process.exitCode = 1;
