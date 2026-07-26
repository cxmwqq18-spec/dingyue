import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const siteId = "site_aidreamcapes";
const password = "SmokePass1!";
const createdIds = {
  customerId: undefined,
  jobId: undefined
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashPassword(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function signWorkerCallback(payload) {
  const unsigned = { ...payload };
  delete unsigned.signature;
  return crypto
    .createHmac("sha256", process.env.AI_WORKER_SECRET ?? "dev-worker-secret")
    .update(JSON.stringify(unsigned))
    .digest("hex");
}

function cookieHeader(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  const cookies = raw.length ? raw : [headers.get("set-cookie")].filter(Boolean);
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

async function createSmokeJob() {
  const aiApp = await prisma.aiApp.findFirst({ where: { slug: "image_generator" } });
  assert(aiApp, "missing_image_generator_ai_app");
  const customerId = uid("cust_job_events_smoke");
  const jobId = uid("job_events_smoke");
  const email = `${customerId}@example.test`;
  createdIds.customerId = customerId;
  createdIds.jobId = jobId;
  await prisma.customer.create({
    data: {
      id: customerId,
      siteId,
      email,
      passwordHash: hashPassword(password),
      name: "Job Events Smoke",
      status: "active",
      balance: {
        create: {
          id: uid("bal_job_events_smoke"),
          siteId,
          balance: 20,
          reserved: 0
        }
      }
    }
  });
  await prisma.generationJob.create({
    data: {
      id: jobId,
      siteId,
      customerId,
      aiAppId: aiApp.id,
      status: "queued",
      creditsReserved: 0,
      requestJson: {
        mode: "theme",
        billing: { outputCount: 1, unitCreditCost: 0, creditsReserved: 0 }
      }
    }
  });
  return { customerId, email, jobId, requestId: `req_${jobId}` };
}

async function loginCustomer(email) {
  const response = await fetch(`${baseUrl}/api/sites/${siteId}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok && data.ok, `customer_login_failed:${response.status}:${data.error ?? "unknown"}`);
  const cookie = cookieHeader(response.headers);
  assert(cookie.includes(`customer_session_${siteId}`), "missing_customer_session_cookie");
  return cookie;
}

async function openJobEventStream(cookie, jobId, expectedStatuses = ["running"]) {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/sites/${siteId}/customer/job-events`, {
    headers: { cookie },
    signal: controller.signal
  });
  assert(response.ok, `job_events_stream_failed:${response.status}`);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let readyResolved = false;
  let eventResolved = false;
  let resolveReady;
  let rejectReady;
  let resolveEvent;
  let rejectEvent;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const event = new Promise((resolve, reject) => {
    resolveEvent = resolve;
    rejectEvent = reject;
  });
  const timeout = setTimeout(() => {
    if (!eventResolved) rejectEvent(new Error("job_event_not_received"));
    controller.abort();
  }, 20_000);

  const pump = (async () => {
    try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const rawEvent of events) {
        const eventName = rawEvent.split("\n").find((line) => line.startsWith("event: "))?.slice("event: ".length);
        const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        const payload = JSON.parse(dataLine.slice("data: ".length));
        if (eventName === "ready" && !readyResolved) {
          readyResolved = true;
          resolveReady(payload);
        }
        if (eventName === "job" && payload.jobId === jobId && expectedStatuses.includes(payload.status) && !eventResolved) {
          eventResolved = true;
          clearTimeout(timeout);
          resolveEvent(payload);
          controller.abort();
          return;
        }
      }
    }
    } catch (error) {
      if (controller.signal.aborted) return;
      if (!readyResolved) rejectReady(error);
      if (!eventResolved) rejectEvent(error);
    } finally {
      clearTimeout(timeout);
    }
  })();

  return {
    ready,
    event,
    close: () => controller.abort(),
    pump
  };
}

async function postWorkerStatus(identity) {
  const unsigned = {
    siteId,
    requestId: identity.requestId,
    status: "running",
    stage: "provider_request_started",
    progress: 35,
    outputSlots: [{
      index: 1,
      status: "running",
      stage: "provider_request_started",
      progress: 35
    }]
  };
  const response = await fetch(`${baseUrl}/api/internal/ai-worker/jobs/${identity.jobId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...unsigned,
      signature: signWorkerCallback(unsigned)
    })
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok && data.accepted, `worker_status_callback_failed:${response.status}:${data.error ?? "unknown"}`);
}

async function createReservedSmokeJob(customerId) {
  const aiApp = await prisma.aiApp.findFirst({ where: { slug: "image_generator" } });
  assert(aiApp, "missing_image_generator_ai_app");
  const jobId = uid("job_failed_status_smoke");
  await prisma.generationJob.create({
    data: {
      id: jobId,
      siteId,
      customerId,
      aiAppId: aiApp.id,
      status: "queued",
      creditsReserved: 5,
      requestJson: {
        mode: "theme",
        billing: { outputCount: 1, unitCreditCost: 5, creditsReserved: 5 }
      }
    }
  });
  await prisma.creditBalance.update({
    where: { customerId },
    data: { balance: { decrement: 5 }, reserved: { increment: 5 } }
  });
  await prisma.creditLedger.create({
    data: {
      id: uid("led_failed_status_smoke"),
      siteId,
      customerId,
      amount: -5,
      type: "reserve",
      sourceType: "generation_job",
      sourceId: jobId
    }
  });
  return { customerId, jobId, requestId: `req_${jobId}` };
}

async function postWorkerFailedStatus(identity) {
  const unsigned = {
    siteId,
    requestId: identity.requestId,
    status: "failed",
    stage: "provider_failed",
    outputSlots: [{
      index: 1,
      status: "failed",
      stage: "provider_failed",
      error: "smoke_provider_failed"
    }]
  };
  const response = await fetch(`${baseUrl}/api/internal/ai-worker/jobs/${identity.jobId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...unsigned,
      signature: signWorkerCallback(unsigned)
    })
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok && data.accepted, `worker_failed_status_callback_failed:${response.status}:${data.error ?? "unknown"}`);
}

async function postWorkerFailedResult(identity) {
  const unsigned = {
    jobId: identity.jobId,
    siteId,
    requestId: identity.requestId,
    status: "failed",
    outputs: [],
    error: "smoke_provider_failed"
  };
  const response = await fetch(`${baseUrl}/api/internal/ai-worker/jobs/${identity.jobId}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...unsigned,
      signature: signWorkerCallback(unsigned)
    })
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok && data.accepted, `worker_failed_result_callback_failed:${response.status}:${data.error ?? "unknown"}`);
  return data;
}

async function assertFailedStatusStillSettles(customerId, cookie) {
  const identity = await createReservedSmokeJob(customerId);
  const stream = await openJobEventStream(cookie, identity.jobId, ["failed"]);
  await stream.ready;
  await postWorkerFailedStatus(identity);
  const afterStatus = await prisma.generationJob.findUniqueOrThrow({ where: { id: identity.jobId } });
  assert(afterStatus.status !== "failed", `failed_status_finalized_job_before_result:${afterStatus.status}`);
  const balanceAfterStatus = await prisma.creditBalance.findUniqueOrThrow({ where: { customerId } });
  assert(balanceAfterStatus.balance === 15 && balanceAfterStatus.reserved === 5, `failed_status_changed_balance:${balanceAfterStatus.balance}:${balanceAfterStatus.reserved}`);
  const result = await postWorkerFailedResult(identity);
  const terminalEvent = await stream.event;
  stream.close();
  await stream.pump;
  assert(result.job?.status === "failed", `failed_result_did_not_finalize:${result.job?.status ?? "missing"}`);
  assert(result.customerBalance?.available === 20, `failed_result_did_not_release_available:${result.customerBalance?.available}`);
  assert(result.customerBalance?.reserved === 0, `failed_result_did_not_release_reserved:${result.customerBalance?.reserved}`);
  assert(result.ledgerAction?.type === "release", `failed_result_missing_release:${result.ledgerAction?.type ?? "none"}`);
  return { result, terminalEvent };
}

async function cleanup() {
  await prisma.customer.deleteMany({ where: { id: createdIds.customerId } }).catch(() => undefined);
}

try {
  const identity = await createSmokeJob();
  const cookie = await loginCustomer(identity.email);
  const stream = await openJobEventStream(cookie, identity.jobId);
  await stream.ready;
  await postWorkerStatus(identity);
  const event = await stream.event;
  stream.close();
  await stream.pump;
  const failedSettlement = await assertFailedStatusStillSettles(identity.customerId, cookie);
  console.log(JSON.stringify({
    ok: true,
    jobId: event.jobId,
    status: event.status,
    type: event.type,
    stage: event.stage,
    progress: event.progress,
    failedStatusSettlement: {
      jobId: failedSettlement.result.job.id,
      status: failedSettlement.result.job.status,
      ledgerAction: failedSettlement.result.ledgerAction.type,
      event: {
        type: failedSettlement.terminalEvent.type,
        status: failedSettlement.terminalEvent.status
      }
    }
  }, null, 2));
} finally {
  await cleanup();
  await prisma.$disconnect();
}
