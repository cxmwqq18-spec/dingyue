import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";
import { loadRuntimeEnv } from "./load-runtime-env.mjs";

loadRuntimeEnv();

const prisma = new PrismaClient();
const baseUrl = "http://127.0.0.1:3002";
const siteId = "site_aidreamcapes";
const password = "EventDrivenSmoke1!";
const customerId = `cust_video_refresh_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
const jobId = `job_video_refresh_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
const email = `${customerId}@example.test`;

function hashPassword(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function signWorkerCallback(payload) {
  return crypto
    .createHmac("sha256", process.env.AI_WORKER_SECRET ?? "dev-worker-secret")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function postCallback(path, payload) {
  const response = await fetch(`${baseUrl}/api/internal/ai-worker/jobs/${jobId}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jobId,
      ...payload,
      signature: signWorkerCallback({ jobId, ...payload })
    })
  });
  const data = await response.json().catch(() => ({}));
  assert(response.ok && data.accepted, `${path}_callback_failed:${response.status}:${data.error ?? "unknown"}`);
}

let browser;
try {
  const aiApp = await prisma.aiApp.findFirst({ where: { slug: "video_generator" } });
  assert(aiApp, "missing_video_generator_ai_app");
  await prisma.customer.create({
    data: {
      id: customerId,
      siteId,
      email,
      passwordHash: hashPassword(password),
      name: "Event Driven Smoke",
      status: "active",
      balance: {
        create: {
          id: `bal_${customerId}`,
          siteId,
          balance: 50,
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
      status: "running",
      creditsReserved: 0,
      requestJson: {
        mode: "video",
        outputType: "video",
        fields: {
          mode: "video",
          outputType: "video",
          videoThemeId: "smoke-prompt-directed-motion",
          videoThemeName: "Prompt Directed Motion"
        },
        billing: { outputCount: 1, unitCreditCost: 0, creditsReserved: 0 }
      },
      resultJson: {
        lastWorkerStage: "video_provider_running_35",
        outputSlots: [{
          index: 1,
          status: "running",
          stage: "video_provider_running_35",
          progress: 35,
          mimeType: "video/mp4"
        }]
      }
    }
  });

  const loginResponse = await fetch(`${baseUrl}/api/sites/${siteId}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  assert(loginResponse.ok, `login_failed:${loginResponse.status}`);
  const sessionCookie = (loginResponse.headers.getSetCookie?.() ?? [])
    .map((cookie) => cookie.split(";")[0])
    .find((cookie) => cookie.startsWith(`customer_session_${siteId}=`));
  assert(sessionCookie, "missing_customer_session_cookie");
  const [cookieName, cookieValue] = sessionCookie.split("=");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([{
    name: cookieName,
    value: cookieValue,
    domain: "127.0.0.1",
    path: "/"
  }]);
  const page = await context.newPage();
  let runtimeRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/api/sites/${siteId}/customer/runtime`)) runtimeRequests += 1;
  });
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto(`${baseUrl}/site/aidreamcapes/app/create#video-workspace-videos`, { waitUntil: "domcontentloaded" });
  await page.getByText("Generated video workspace").waitFor();
  await page.getByText("35%", { exact: true }).waitFor({ timeout: 15_000 });
  const requestsAfterLoad = runtimeRequests;
  await page.waitForTimeout(4_000);
  const requestsAfterQuietWindow = runtimeRequests;
  assert(requestsAfterQuietWindow - requestsAfterLoad === 0, `unexpected_runtime_polling:${requestsAfterQuietWindow - requestsAfterLoad}`);

  const requestsBeforeProgressEvent = runtimeRequests;
  await postCallback("status", {
    siteId,
    requestId: `req_${jobId}`,
    status: "running",
    stage: "video_provider_running",
    progress: 67,
    outputSlots: [{
      index: 1,
      status: "running",
      stage: "video_provider_running_67",
      progress: 67,
      mimeType: "video/mp4"
    }]
  });
  await page.getByText("67%", { exact: true }).waitFor({ timeout: 8_000 });
  await page.waitForTimeout(900);
  const requestsAfterProgressEvent = runtimeRequests;
  assert(
    requestsAfterProgressEvent === requestsBeforeProgressEvent,
    `progress_event_triggered_runtime_refresh:${requestsAfterProgressEvent - requestsBeforeProgressEvent}`
  );

  const requestsBeforeFinalEvents = runtimeRequests;
  await postCallback("status", {
    siteId,
    requestId: `req_${jobId}`,
    status: "failed",
    stage: "video_provider_failed",
    outputSlots: [{
      index: 1,
      status: "failed",
      stage: "video_provider_failed",
      error: "event_driven_smoke_failed"
    }]
  });
  await postCallback("result", {
    siteId,
    requestId: `req_${jobId}`,
    status: "failed",
    outputs: [],
    error: "event_driven_smoke_failed"
  });
  await page.getByText("Generation failed", { exact: true }).waitFor({ timeout: 8_000 });
  await page.waitForTimeout(900);
  const requestsAfterFinalEvents = runtimeRequests;
  assert(
    requestsAfterFinalEvents === requestsBeforeFinalEvents,
    `final_events_triggered_runtime_refresh:${requestsAfterFinalEvents - requestsBeforeFinalEvents}`
  );
  await page.screenshot({ path: "/tmp/video-refresh-event-driven.png", fullPage: true });
  assert(consoleErrors.length === 0, `browser_console_errors:${consoleErrors.join(" | ")}`);
  console.log(JSON.stringify({
    ok: true,
    runtimeRequestsAfterLoad: requestsAfterLoad,
    runtimeRequestsDuringQuietWindow: requestsAfterQuietWindow - requestsAfterLoad,
    runtimeRequestsAfterProgressEvent: requestsAfterProgressEvent - requestsBeforeProgressEvent,
    runtimeRequestsAfterFinalEvents: requestsAfterFinalEvents - requestsBeforeFinalEvents,
    runtimeRequestsAfterEvents: runtimeRequests,
    screenshot: "/tmp/video-refresh-event-driven.png"
  }, null, 2));
} finally {
  await browser?.close().catch(() => undefined);
  await prisma.customer.deleteMany({ where: { id: customerId } }).catch(() => undefined);
  await prisma.$disconnect();
}
